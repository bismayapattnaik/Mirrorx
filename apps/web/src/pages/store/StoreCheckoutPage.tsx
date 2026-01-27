import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowLeft, User, Phone, Mail, CreditCard, Loader2, Shield,
  ChevronRight, Smartphone, CheckCircle2
} from 'lucide-react';
import { storeApi } from '@/lib/api';
import { useStoreModeStore } from '@/store/store-mode-store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';

declare global {
  interface Window {
    Razorpay: any;
  }
}

export default function StoreCheckoutPage() {
  const navigate = useNavigate();
  const { toast } = useToast();

  const { store, cart, setCurrentOrder, setPickupPass, setCart } = useStoreModeStore();

  const [customerInfo, setCustomerInfo] = useState({
    name: '',
    phone: '',
    email: '',
  });
  const [isProcessing, setIsProcessing] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const formatPrice = (paise: number) => {
    return `₹${(paise / 100).toLocaleString('en-IN')}`;
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!customerInfo.phone.trim()) {
      newErrors.phone = 'Phone number is required for pickup';
    } else if (!/^[6-9]\d{9}$/.test(customerInfo.phone)) {
      newErrors.phone = 'Enter a valid 10-digit phone number';
    }

    if (customerInfo.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerInfo.email)) {
      newErrors.email = 'Enter a valid email address';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const loadRazorpay = (): Promise<boolean> => {
    return new Promise((resolve) => {
      if (window.Razorpay) {
        resolve(true);
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  };

  const handlePayment = async () => {
    if (!validateForm()) return;
    if (!cart) return;

    setIsProcessing(true);

    try {
      // Load Razorpay
      const razorpayLoaded = await loadRazorpay();
      if (!razorpayLoaded) {
        throw new Error('Failed to load payment gateway');
      }

      // Create checkout order
      const checkoutResponse = await storeApi.createCheckout({
        customer_name: customerInfo.name || undefined,
        customer_phone: customerInfo.phone,
        customer_email: customerInfo.email || undefined,
      });

      // Configure Razorpay
      const options = {
        key: checkoutResponse.key_id,
        amount: checkoutResponse.amount,
        currency: checkoutResponse.currency,
        name: store?.name || 'MirrorX Store',
        description: `Order #${checkoutResponse.order_number}`,
        order_id: checkoutResponse.razorpay_order_id,
        prefill: {
          name: customerInfo.name,
          contact: customerInfo.phone,
          email: customerInfo.email,
        },
        theme: {
          color: '#6366F1',
          backdrop_color: 'rgba(0,0,0,0.9)',
        },
        modal: {
          ondismiss: () => {
            setIsProcessing(false);
          },
        },
        handler: async (response: any) => {
          try {
            // Verify payment
            const verifyResponse = await storeApi.verifyPayment(
              checkoutResponse.order_id,
              response.razorpay_order_id,
              response.razorpay_payment_id,
              response.razorpay_signature
            );

            // Store order and pickup pass
            setCurrentOrder(verifyResponse.order);
            setPickupPass(verifyResponse.pickup_pass);
            setCart(null);

            // Navigate to pickup pass page
            navigate(`/store/pickup/${verifyResponse.pickup_pass.pass_code}`);

            toast({
              title: 'Payment successful!',
              description: 'Your order has been placed',
            });
          } catch (error) {
            toast({
              title: 'Payment verification failed',
              description: (error as Error).message,
              variant: 'destructive',
            });
          } finally {
            setIsProcessing(false);
          }
        },
      };

      const razorpay = new window.Razorpay(options);
      razorpay.on('payment.failed', (response: any) => {
        toast({
          title: 'Payment failed',
          description: response.error.description || 'Please try again',
          variant: 'destructive',
        });
        setIsProcessing(false);
      });

      razorpay.open();
    } catch (error) {
      toast({
        title: 'Checkout failed',
        description: (error as Error).message,
        variant: 'destructive',
      });
      setIsProcessing(false);
    }
  };

  if (!cart || cart.items?.length === 0) {
    navigate('/store/cart');
    return null;
  }

  const itemCount = cart.items?.reduce((sum, item) => sum + item.quantity, 0) || 0;

  return (
    <div className="min-h-screen bg-midnight pb-40">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-midnight/95 backdrop-blur-lg border-b border-white/10">
        <div className="flex items-center gap-4 px-4 py-4">
          <button onClick={() => navigate(-1)} className="p-2 -ml-2 rounded-full hover:bg-white/10">
            <ArrowLeft className="w-5 h-5 text-white" />
          </button>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-white">Checkout</h1>
            <p className="text-white/60 text-sm">{itemCount} items</p>
          </div>
        </div>
      </div>

      <div className="px-4 py-6 space-y-6">
        {/* Customer Info */}
        <div className="bg-white/5 rounded-2xl p-4 space-y-4">
          <h3 className="text-white font-medium flex items-center gap-2">
            <User className="w-5 h-5 text-indigo-400" />
            Contact Details
          </h3>
          <p className="text-white/60 text-sm -mt-2">
            We'll send your pickup pass to this number
          </p>

          <div className="space-y-4">
            <div>
              <label className="text-white/70 text-sm mb-1 block">Name (Optional)</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/50" />
                <Input
                  value={customerInfo.name}
                  onChange={(e) => setCustomerInfo({ ...customerInfo, name: e.target.value })}
                  placeholder="Your name"
                  className="pl-10 bg-white/5 border-white/10 text-white"
                />
              </div>
            </div>

            <div>
              <label className="text-white/70 text-sm mb-1 block">Phone Number *</label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/50" />
                <Input
                  type="tel"
                  value={customerInfo.phone}
                  onChange={(e) => setCustomerInfo({ ...customerInfo, phone: e.target.value.replace(/\D/g, '').slice(0, 10) })}
                  placeholder="10-digit mobile number"
                  className={`pl-10 bg-white/5 text-white ${errors.phone ? 'border-red-500' : 'border-white/10'}`}
                />
              </div>
              {errors.phone && (
                <p className="text-red-400 text-xs mt-1">{errors.phone}</p>
              )}
            </div>

            <div>
              <label className="text-white/70 text-sm mb-1 block">Email (Optional)</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/50" />
                <Input
                  type="email"
                  value={customerInfo.email}
                  onChange={(e) => setCustomerInfo({ ...customerInfo, email: e.target.value })}
                  placeholder="For receipt (optional)"
                  className={`pl-10 bg-white/5 text-white ${errors.email ? 'border-red-500' : 'border-white/10'}`}
                />
              </div>
              {errors.email && (
                <p className="text-red-400 text-xs mt-1">{errors.email}</p>
              )}
            </div>
          </div>
        </div>

        {/* Order Summary */}
        <div className="bg-white/5 rounded-2xl p-4 space-y-3">
          <h3 className="text-white font-medium mb-4">Order Summary</h3>

          <div className="flex justify-between text-white/70">
            <span>Subtotal ({itemCount} items)</span>
            <span>{formatPrice(cart.subtotal)}</span>
          </div>

          {cart.discount > 0 && (
            <div className="flex justify-between text-green-400">
              <span>Discount</span>
              <span>-{formatPrice(cart.discount)}</span>
            </div>
          )}

          <div className="flex justify-between text-white/70">
            <span>GST (18%)</span>
            <span>{formatPrice(cart.tax)}</span>
          </div>

          <div className="border-t border-white/10 pt-3 mt-3">
            <div className="flex justify-between text-white text-lg font-bold">
              <span>Total</span>
              <span>{formatPrice(cart.total)}</span>
            </div>
          </div>
        </div>

        {/* Payment Methods */}
        <div className="bg-white/5 rounded-2xl p-4">
          <h3 className="text-white font-medium flex items-center gap-2 mb-4">
            <CreditCard className="w-5 h-5 text-indigo-400" />
            Payment Method
          </h3>

          <div className="space-y-3">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex items-center gap-4 p-4 bg-indigo-500/10 border border-indigo-500/30 rounded-xl"
            >
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                <Smartphone className="w-6 h-6 text-white" />
              </div>
              <div className="flex-1">
                <p className="text-white font-medium">UPI / Cards / Netbanking</p>
                <p className="text-white/60 text-sm">Powered by Razorpay</p>
              </div>
              <CheckCircle2 className="w-6 h-6 text-indigo-400" />
            </motion.div>
          </div>
        </div>

        {/* Security Note */}
        <div className="flex items-center gap-3 text-white/50 text-sm">
          <Shield className="w-5 h-5 flex-shrink-0" />
          <span>Your payment is secured with 256-bit encryption. We never store your card details.</span>
        </div>
      </div>

      {/* Bottom Action Bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-midnight/95 backdrop-blur-lg border-t border-white/10 p-4 safe-area-bottom">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-white/60 text-sm">Amount to Pay</p>
            <p className="text-2xl font-bold text-white">{formatPrice(cart.total)}</p>
          </div>
          {cart.discount > 0 && (
            <div className="text-right">
              <p className="text-green-400 text-sm">You save {formatPrice(cart.discount)}</p>
            </div>
          )}
        </div>

        <Button
          onClick={handlePayment}
          disabled={isProcessing}
          className="w-full py-6 text-lg bg-gradient-to-r from-gold to-amber-500 hover:from-gold/90 hover:to-amber-500/90 text-midnight rounded-2xl font-semibold"
        >
          {isProcessing ? (
            <>
              <Loader2 className="w-5 h-5 mr-2 animate-spin" />
              Processing...
            </>
          ) : (
            <>
              Pay {formatPrice(cart.total)}
              <ChevronRight className="w-5 h-5 ml-2" />
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
