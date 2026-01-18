import { Router, Response, Request } from 'express';
import crypto from 'crypto';
import { query, withTransaction } from '../db/index.js';
import { CREDIT_PACKS, SUBSCRIPTION_PLANS } from '@facefit/shared';

const router = Router();

// POST /webhooks/razorpay - Handle Razorpay webhooks
router.post('/razorpay', async (req: Request, res: Response) => {
  try {
    const signature = req.headers['x-razorpay-signature'] as string;
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;

    if (!webhookSecret) {
      console.error('RAZORPAY_WEBHOOK_SECRET not configured');
      return res.status(500).json({ error: 'Webhook not configured' });
    }

    // Verify webhook signature
    const body = req.body.toString();
    const expectedSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(body)
      .digest('hex');

    if (expectedSignature !== signature) {
      console.warn('Invalid Razorpay webhook signature');
      return res.status(400).json({ error: 'Invalid signature' });
    }

    const event = JSON.parse(body);
    const eventType = event.event;

    console.log(`Razorpay webhook received: ${eventType}`);

    // Handle different event types
    switch (eventType) {
      case 'payment.captured': {
        const payment = event.payload.payment.entity;
        const orderId = payment.order_id;

        // Check if already processed (idempotency)
        const existingOrder = await query<{ status: string }>(
          'SELECT status FROM orders WHERE razorpay_order_id = $1',
          [orderId]
        );

        if (existingOrder.rows.length === 0) {
          console.warn(`Order not found for payment: ${orderId}`);
          break;
        }

        if (existingOrder.rows[0].status === 'PAID') {
          console.log(`Payment already processed: ${orderId}`);
          break;
        }

        // Process payment
        await withTransaction(async (client) => {
          const orderResult = await client.query<{
            id: string;
            user_id: string;
            order_type: string;
            sku: string;
          }>(
            `UPDATE orders SET status = 'PAID', razorpay_payment_id = $1,
                    payment_method = $2
             WHERE razorpay_order_id = $3
             RETURNING id, user_id, order_type, sku`,
            [payment.id, payment.method, orderId]
          );

          if (orderResult.rows.length === 0) return;

          const order = orderResult.rows[0];

          if (order.order_type === 'CREDITS_PACK') {
            const pack = CREDIT_PACKS.find((p) => p.sku === order.sku);
            if (pack) {
              await client.query(
                `INSERT INTO credits_ledger (user_id, amount, transaction_type, description, reference_id)
                 VALUES ($1, $2, 'PURCHASE', $3, $4)`,
                [order.user_id, pack.credits, `Purchased ${pack.name} Pack (webhook)`, order.id]
              );
            }
          } else {
            const plan = SUBSCRIPTION_PLANS.find((p) => p.sku === order.sku);
            if (plan) {
              const endDate = plan.billing_period === 'monthly'
                ? 'NOW() + INTERVAL \'1 month\''
                : 'NOW() + INTERVAL \'1 year\'';

              await client.query(
                `INSERT INTO subscriptions (user_id, plan_type, status, start_date, end_date)
                 VALUES ($1, $2, 'ACTIVE', NOW(), ${endDate})`,
                [order.user_id, plan.tier]
              );

              await client.query(
                'UPDATE users SET subscription_tier = $1 WHERE id = $2',
                [plan.tier, order.user_id]
              );
            }
          }
        });

        console.log(`Payment processed via webhook: ${orderId}`);
        break;
      }

      case 'payment.failed': {
        const payment = event.payload.payment.entity;
        const orderId = payment.order_id;

        await query(
          `UPDATE orders SET status = 'FAILED', error_message = $1
           WHERE razorpay_order_id = $2 AND status != 'PAID'`,
          [payment.error_description || 'Payment failed', orderId]
        );

        console.log(`Payment failed: ${orderId}`);
        break;
      }

      case 'subscription.activated': {
        const subscription = event.payload.subscription.entity;
        const subscriptionId = subscription.id;

        await query(
          `UPDATE subscriptions SET status = 'ACTIVE', razorpay_subscription_id = $1
           WHERE razorpay_subscription_id = $1`,
          [subscriptionId]
        );

        console.log(`Subscription activated: ${subscriptionId}`);
        break;
      }

      case 'subscription.cancelled': {
        const subscription = event.payload.subscription.entity;
        const subscriptionId = subscription.id;

        await withTransaction(async (client) => {
          const subResult = await client.query<{ user_id: string }>(
            `UPDATE subscriptions SET status = 'CANCELLED'
             WHERE razorpay_subscription_id = $1
             RETURNING user_id`,
            [subscriptionId]
          );

          if (subResult.rows.length > 0) {
            await client.query(
              'UPDATE users SET subscription_tier = \'FREE\' WHERE id = $1',
              [subResult.rows[0].user_id]
            );
          }
        });

        console.log(`Subscription cancelled: ${subscriptionId}`);
        break;
      }

      case 'refund.processed': {
        const refund = event.payload.refund.entity;
        const paymentId = refund.payment_id;

        await withTransaction(async (client) => {
          const orderResult = await client.query<{ id: string; user_id: string; order_type: string; sku: string }>(
            `UPDATE orders SET status = 'REFUNDED'
             WHERE razorpay_payment_id = $1
             RETURNING id, user_id, order_type, sku`,
            [paymentId]
          );

          if (orderResult.rows.length > 0) {
            const order = orderResult.rows[0];

            if (order.order_type === 'CREDITS_PACK') {
              const pack = CREDIT_PACKS.find((p) => p.sku === order.sku);
              if (pack) {
                await client.query(
                  `INSERT INTO credits_ledger (user_id, amount, transaction_type, description, reference_id)
                   VALUES ($1, $2, 'REFUND', 'Refund for order', $3)`,
                  [order.user_id, -pack.credits, order.id]
                );
              }
            }
          }
        });

        console.log(`Refund processed: ${paymentId}`);
        break;
      }

      default:
        console.log(`Unhandled webhook event: ${eventType}`);
    }

    res.json({ status: 'ok' });
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

export default router;
