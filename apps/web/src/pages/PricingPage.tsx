import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Sparkles, Check, Zap, Crown, CreditCard } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useAuthStore } from '@/store/auth-store';
import { paymentsApi } from '@/lib/api';
import { cn, formatPrice } from '@/lib/utils';
import { CREDIT_PACKS, SUBSCRIPTION_PLANS } from '@mrrx/shared';

export default function PricingPage() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { isAuthenticated, user, updateCredits } = useAuthStore();
  const [isYearly, setIsYearly] = useState(false);
  const [isLoading, setIsLoading] = useState<string | null>(null);

  const handlePurchase = async (kind: 'CREDITS_PACK' | 'SUBSCRIPTION', sku: string) => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }

    setIsLoading(sku);

    try {
      const order = await paymentsApi.createOrder(kind, sku);

      // Initialize Razorpay
      const options = {
        key: import.meta.env.VITE_RAZORPAY_KEY_ID,
        amount: order.amount,
        currency: order.currency,
        name: 'MirrorX',
        description: kind === 'CREDITS_PACK' ? 'Credit Pack Purchase' : 'Subscription',
        order_id: order.razorpay_order_id,
        handler: async function (response: any) {
          try {
            const result = await paymentsApi.verify(
              response.razorpay_order_id,
              response.razorpay_payment_id,
              response.razorpay_signature
            );

            if (result.success) {
              if (result.credits_balance !== undefined) {
                const pack = CREDIT_PACKS.find((p) => p.sku === sku);
                if (pack) {
                  updateCredits(pack.credits);
                }
              }

              toast({
                title: 'Payment successful!',
                description: kind === 'CREDITS_PACK'
                  ? 'Credits have been added to your account.'
                  : 'Your subscription is now active.',
              });
            }
          } catch {
            toast({
              variant: 'destructive',
              title: 'Verification failed',
              description: 'Please contact support if credits were not added.',
            });
          }
        },
        prefill: {
          email: user?.email,
          contact: user?.phone || '',
        },
        theme: {
          color: '#D4AF37',
        },
      };

      const razorpay = new (window as any).Razorpay(options);
      razorpay.open();
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Payment failed',
        description: error.message || 'Could not initiate payment.',
      });
    } finally {
      setIsLoading(null);
    }
  };

  return (
    <div className="min-h-screen bg-midnight">
      {/* Navigation */}
      <nav className="glass sticky top-0 z-50">
        <div className="container max-w-container mx-auto px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gold-gradient rounded-lg flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <span className="font-orbitron text-xl font-bold text-gold">MirrorX</span>
          </Link>

          <div className="flex items-center gap-3">
            {isAuthenticated ? (
              <Button variant="outline" asChild>
                <Link to="/app/tryon">Go to App</Link>
              </Button>
            ) : (
              <>
                <Button variant="ghost" asChild>
                  <Link to="/login">Log In</Link>
                </Button>
                <Button asChild>
                  <Link to="/signup">Get Started</Link>
                </Button>
              </>
            )}
          </div>
        </div>
      </nav>

      <div className="container max-w-container mx-auto px-6 py-section">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-16"
        >
          <h1 className="hero-heading mb-4">
            Simple, Transparent <span className="text-gold-gradient">Pricing</span>
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Start free, pay only for what you need. No hidden fees.
          </p>
        </motion.div>

        {/* Credit Packs */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mb-16"
        >
          <div className="flex items-center gap-3 mb-8">
            <CreditCard className="w-6 h-6 text-gold" />
            <h2 className="text-2xl font-orbitron font-bold">Credit Packs</h2>
          </div>
          <p className="text-muted-foreground mb-6">
            Buy credits as you need them. Each try-on uses 1 credit.
          </p>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {CREDIT_PACKS.map((pack) => (
              <Card
                key={pack.sku}
                className={cn(
                  'relative',
                  pack.popular && 'border-gold ring-2 ring-gold/20'
                )}
              >
                {pack.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 badge-premium">
                    Best Value
                  </div>
                )}
                <CardContent className="p-6">
                  <p className="text-lg font-semibold mb-1">{pack.name}</p>
                  <div className="mb-4">
                    <span className="text-3xl font-orbitron font-bold text-gold">
                      {formatPrice(pack.price_inr)}
                    </span>
                  </div>
                  <p className="text-muted-foreground mb-4">
                    {pack.credits} credits
                    <span className="text-gold ml-2">
                      ({formatPrice(Math.round(pack.price_inr / pack.credits))}/credit)
                    </span>
                  </p>
                  <Button
                    className="w-full"
                    variant={pack.popular ? 'default' : 'outline'}
                    disabled={isLoading === pack.sku}
                    onClick={() => handlePurchase('CREDITS_PACK', pack.sku)}
                  >
                    {isLoading === pack.sku ? 'Processing...' : 'Buy Now'}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </motion.div>

        {/* Subscriptions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-8">
            <div className="flex items-center gap-3">
              <Crown className="w-6 h-6 text-gold" />
              <h2 className="text-2xl font-orbitron font-bold">Subscriptions</h2>
            </div>
            <div className="flex items-center gap-3">
              <Label htmlFor="billing" className={cn(!isYearly && 'text-gold')}>
                Monthly
              </Label>
              <Switch
                id="billing"
                checked={isYearly}
                onCheckedChange={setIsYearly}
              />
              <Label htmlFor="billing" className={cn(isYearly && 'text-gold')}>
                Yearly
                <span className="ml-2 text-xs bg-gold/20 text-gold px-2 py-0.5 rounded-full">
                  Save 30%
                </span>
              </Label>
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {SUBSCRIPTION_PLANS.map((plan, index) => {
              const isCurrentPlan = user?.subscription_tier === plan.tier;
              const showPlan =
                (plan.billing_period === 'monthly' && !isYearly) ||
                (plan.billing_period === 'yearly' && isYearly) ||
                plan.price_inr === 0;

              if (!showPlan) return null;

              return (
                <motion.div
                  key={plan.sku}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 + index * 0.1 }}
                >
                  <Card
                    className={cn(
                      'h-full',
                      plan.tier === 'PRO' && 'border-gold ring-2 ring-gold/20'
                    )}
                  >
                    {plan.tier === 'PRO' && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2 badge-premium">
                        Most Popular
                      </div>
                    )}
                    <CardHeader>
                      <div className="flex items-center gap-2">
                        {plan.tier === 'FREE' ? (
                          <Zap className="w-5 h-5 text-muted-foreground" />
                        ) : (
                          <Crown className="w-5 h-5 text-gold" />
                        )}
                        <CardTitle>{plan.name}</CardTitle>
                      </div>
                      <CardDescription>{plan.tier === 'FREE' ? 'Get started' : 'For power users'}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="mb-6">
                        {plan.price_inr === 0 ? (
                          <span className="text-4xl font-orbitron font-bold">Free</span>
                        ) : (
                          <>
                            <span className="text-4xl font-orbitron font-bold text-gold">
                              {formatPrice(plan.price_inr)}
                            </span>
                            <span className="text-muted-foreground">
                              /{plan.billing_period === 'monthly' ? 'month' : 'year'}
                            </span>
                          </>
                        )}
                      </div>

                      <ul className="space-y-3 mb-6">
                        {plan.features.map((feature) => (
                          <li key={feature} className="flex items-start gap-2 text-sm">
                            <Check className="w-4 h-4 text-gold flex-shrink-0 mt-0.5" />
                            {feature}
                          </li>
                        ))}
                      </ul>

                      {isCurrentPlan ? (
                        <Button className="w-full" disabled>
                          Current Plan
                        </Button>
                      ) : plan.price_inr === 0 ? (
                        <Button className="w-full" variant="outline" asChild>
                          <Link to="/signup">Get Started</Link>
                        </Button>
                      ) : (
                        <Button
                          className="w-full"
                          variant={plan.tier === 'PRO' ? 'default' : 'outline'}
                          disabled={isLoading === plan.sku}
                          onClick={() => handlePurchase('SUBSCRIPTION', plan.sku)}
                        >
                          {isLoading === plan.sku ? 'Processing...' : 'Subscribe'}
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        </motion.div>

        {/* FAQ */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="mt-16 text-center"
        >
          <p className="text-muted-foreground">
            Questions? Contact us at{' '}
            <a href="mailto:support@mirrorx.co.in" className="text-gold hover:underline">
              support@mirrorx.co.in
            </a>
          </p>
        </motion.div>
      </div>
    </div>
  );
}
