import { Router, Response } from 'express';
import Razorpay from 'razorpay';
import crypto from 'crypto';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { query, withTransaction } from '../db/index.js';
import { createOrderRequestSchema, verifyPaymentRequestSchema, CREDIT_PACKS, SUBSCRIPTION_PLANS } from '@mrrx/shared';

const router = Router();

// Initialize Razorpay only if credentials are provided
let razorpay: Razorpay | null = null;
if (process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET) {
  razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
  });
}

// POST /payments/create-order
router.post(
  '/create-order',
  authenticate,
  validate(createOrderRequestSchema),
  async (req: AuthRequest, res: Response) => {
    if (!razorpay) {
      return res.status(503).json({
        error: 'Service unavailable',
        message: 'Payment service is not configured',
      });
    }

    try {
      const { kind, sku } = req.body;
      const userId = req.userId!;

      let amount: number;
      let description: string;

      if (kind === 'CREDITS_PACK') {
        const pack = CREDIT_PACKS.find((p) => p.sku === sku);
        if (!pack) {
          return res.status(400).json({
            error: 'Invalid SKU',
            message: 'The specified credit pack does not exist',
          });
        }
        amount = pack.price_inr;
        description = `${pack.credits} MirrorX Credits - ${pack.name} Pack`;
      } else {
        const plan = SUBSCRIPTION_PLANS.find((p) => p.sku === sku);
        if (!plan || plan.price_inr === 0) {
          return res.status(400).json({
            error: 'Invalid SKU',
            message: 'The specified subscription plan does not exist',
          });
        }
        amount = plan.price_inr;
        description = `MirrorX ${plan.name} Subscription`;
      }

      // Create Razorpay order
      const razorpayOrder = await razorpay.orders.create({
        amount,
        currency: 'INR',
        receipt: `mirrorx_${Date.now()}`,
        notes: {
          user_id: userId,
          kind,
          sku,
        },
      });

      // Store order in database
      await query(
        `INSERT INTO orders (user_id, amount, currency, status, order_type, sku, razorpay_order_id)
         VALUES ($1, $2, 'INR', 'CREATED', $3, $4, $5)`,
        [userId, amount, kind, sku, razorpayOrder.id]
      );

      res.json({
        order_id: razorpayOrder.id,
        razorpay_order_id: razorpayOrder.id,
        amount,
        currency: 'INR',
        description,
        key_id: process.env.RAZORPAY_KEY_ID,
      });
    } catch (error) {
      console.error('Create order error:', error);
      res.status(500).json({ error: 'Server error', message: 'Failed to create payment order' });
    }
  }
);

// POST /payments/verify
router.post(
  '/verify',
  authenticate,
  validate(verifyPaymentRequestSchema),
  async (req: AuthRequest, res: Response) => {
    try {
      const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
      const userId = req.userId!;

      // Verify signature
      const body = razorpay_order_id + '|' + razorpay_payment_id;
      const expectedSignature = crypto
        .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET || '')
        .update(body)
        .digest('hex');

      if (expectedSignature !== razorpay_signature) {
        return res.status(400).json({
          error: 'Invalid signature',
          message: 'Payment verification failed',
        });
      }

      // Get order from database
      const orderResult = await query<{
        id: string;
        order_type: string;
        sku: string;
        status: string;
      }>(
        `SELECT id, order_type, sku, status FROM orders
         WHERE razorpay_order_id = $1 AND user_id = $2`,
        [razorpay_order_id, userId]
      );

      if (orderResult.rows.length === 0) {
        return res.status(404).json({
          error: 'Order not found',
          message: 'No matching order found',
        });
      }

      const order = orderResult.rows[0];

      if (order.status === 'PAID') {
        return res.json({
          success: true,
          message: 'Payment already processed',
        });
      }

      // Process payment in transaction
      const result = await withTransaction(async (client) => {
        // Update order status
        await client.query(
          `UPDATE orders SET status = 'PAID', razorpay_payment_id = $1
           WHERE id = $2`,
          [razorpay_payment_id, order.id]
        );

        if (order.order_type === 'CREDITS_PACK') {
          // Add credits
          const pack = CREDIT_PACKS.find((p) => p.sku === order.sku);
          if (pack) {
            await client.query(
              `INSERT INTO credits_ledger (user_id, amount, transaction_type, description, reference_id)
               VALUES ($1, $2, 'PURCHASE', $3, $4)`,
              [userId, pack.credits, `Purchased ${pack.name} Pack`, order.id]
            );
          }
        } else {
          // Create/update subscription
          const plan = SUBSCRIPTION_PLANS.find((p) => p.sku === order.sku);
          if (plan) {
            const endDate = plan.billing_period === 'monthly'
              ? 'NOW() + INTERVAL \'1 month\''
              : 'NOW() + INTERVAL \'1 year\'';

            await client.query(
              `INSERT INTO subscriptions (user_id, plan_type, status, start_date, end_date)
               VALUES ($1, $2, 'ACTIVE', NOW(), ${endDate})`,
              [userId, plan.tier]
            );

            await client.query(
              'UPDATE users SET subscription_tier = $1 WHERE id = $2',
              [plan.tier, userId]
            );
          }
        }

        // Get updated balance
        const balanceResult = await client.query<{ credits_balance: number }>(
          'SELECT credits_balance FROM users WHERE id = $1',
          [userId]
        );

        return balanceResult.rows[0].credits_balance;
      });

      res.json({
        success: true,
        message: 'Payment verified successfully',
        credits_balance: result,
      });
    } catch (error) {
      console.error('Verify payment error:', error);
      res.status(500).json({ error: 'Server error', message: 'Failed to verify payment' });
    }
  }
);

export default router;
