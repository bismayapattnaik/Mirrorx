import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Sparkles,
  Camera,
  Shirt,
  Zap,
  Shield,
  Star,
  ArrowRight,
  Check,
  ChevronRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

// Animation variants
const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.6 },
};

// Brand partners
const brandPartners = [
  'Myntra', 'Ajio', 'Amazon Fashion', 'Flipkart', 'Meesho',
  'Tata Cliq', 'Nykaa Fashion', 'H&M', 'Zara', 'Fabindia',
];

// How it works steps
const steps = [
  {
    icon: Camera,
    title: 'Upload Your Photo',
    description: 'Take or upload a clear selfie - our AI needs just one good photo',
  },
  {
    icon: Shirt,
    title: 'Choose Your Style',
    description: 'Paste any product URL or upload an outfit image you want to try',
  },
  {
    icon: Zap,
    title: 'See Yourself Transformed',
    description: 'Get a photorealistic preview of you wearing the outfit in seconds',
  },
];

// Features
const features = [
  {
    title: 'AI-Powered Accuracy',
    description: 'Our advanced AI preserves your unique features while perfectly fitting any garment',
    icon: Sparkles,
  },
  {
    title: 'Works With Any Store',
    description: 'Compatible with Myntra, Ajio, Amazon, Flipkart, Meesho and more',
    icon: Shield,
  },
  {
    title: 'Instant Results',
    description: 'See yourself in any outfit within seconds, not minutes',
    icon: Zap,
  },
  {
    title: 'Style Suggestions',
    description: 'Get AI-powered complementary item recommendations for complete looks',
    icon: Star,
  },
];

// Testimonials
const testimonials = [
  {
    name: 'Priya Sharma',
    location: 'Mumbai',
    rating: 5,
    text: 'Finally I can see how clothes actually look on me before buying! Saved me so many returns.',
  },
  {
    name: 'Rahul Verma',
    location: 'Bangalore',
    rating: 5,
    text: 'The accuracy is mind-blowing. My wife uses it daily for shopping decisions.',
  },
  {
    name: 'Anita Desai',
    location: 'Delhi',
    rating: 5,
    text: 'As someone who hates trial rooms, this is a game changer. 10/10 recommend!',
  },
];

// Pricing tiers
const pricingTiers = [
  {
    name: 'Free',
    price: '0',
    description: 'Perfect for trying out',
    features: ['5 try-ons per day', 'Basic AI suggestions', 'Save to wardrobe', 'Standard quality'],
    cta: 'Get Started Free',
    popular: false,
  },
  {
    name: 'Pro',
    price: '149',
    period: '/month',
    description: 'For fashion enthusiasts',
    features: [
      'Unlimited try-ons',
      'Advanced AI styling',
      'Priority processing',
      'HD quality outputs',
      'Outfit combinations',
      'Email support',
    ],
    cta: 'Start Pro Trial',
    popular: true,
  },
  {
    name: 'Elite',
    price: '999',
    period: '/year',
    description: 'Best value for power users',
    features: [
      'Everything in Pro',
      'Ultra HD quality',
      'API access',
      'Custom integrations',
      'Priority support',
      'Early feature access',
    ],
    cta: 'Go Elite',
    popular: false,
  },
];

export default function LandingPage() {
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

          <div className="hidden md:flex items-center gap-6">
            <a href="#features" className="text-muted-foreground hover:text-foreground transition">
              Features
            </a>
            <a href="#how-it-works" className="text-muted-foreground hover:text-foreground transition">
              How it Works
            </a>
            <a href="#pricing" className="text-muted-foreground hover:text-foreground transition">
              Pricing
            </a>
          </div>

          <div className="flex items-center gap-3">
            <Button variant="ghost" asChild>
              <Link to="/login">Log In</Link>
            </Button>
            <Button asChild>
              <Link to="/signup">Get Started</Link>
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative min-h-[90vh] flex items-center overflow-hidden">
        {/* Background gradient */}
        <div className="absolute inset-0 bg-gradient-to-b from-midnight via-midnight to-charcoal/50" />
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-gold/10 rounded-full blur-[100px]" />
        <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-royal/20 rounded-full blur-[80px]" />

        <div className="container max-w-container mx-auto px-6 relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="max-w-3xl mx-auto text-center"
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gold/10 text-gold text-sm mb-6">
              <Sparkles className="w-4 h-4" />
              AI-Powered Virtual Try-On
            </div>

            <h1 className="hero-heading mb-6">
              See Yourself in
              <span className="text-gold-gradient block mt-2">Any Outfit Instantly</span>
            </h1>

            <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
              Experience clothes before you buy. Upload your photo, paste any product link,
              and see a photorealistic preview in seconds. Works with Myntra, Ajio, Amazon & more.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button size="lg" asChild className="w-full sm:w-auto">
                <Link to="/signup">
                  Try It Free <ArrowRight className="ml-2 w-5 h-5" />
                </Link>
              </Button>
              <Button variant="outline" size="lg" asChild className="w-full sm:w-auto">
                <a href="#how-it-works">See How It Works</a>
              </Button>
            </div>

            {/* Stats ticker */}
            <div className="mt-12 grid grid-cols-3 gap-8 max-w-lg mx-auto">
              {[
                { value: '50K+', label: 'Try-ons Daily' },
                { value: '95%', label: 'Accuracy Rate' },
                { value: '4.9', label: 'User Rating' },
              ].map((stat) => (
                <div key={stat.label} className="text-center">
                  <div className="text-2xl font-orbitron font-bold text-gold">{stat.value}</div>
                  <div className="text-sm text-muted-foreground">{stat.label}</div>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* Brand Partners Ticker */}
      <section className="py-8 border-y border-gold/10 overflow-hidden">
        <div className="flex animate-ticker">
          {[...brandPartners, ...brandPartners].map((brand, i) => (
            <span
              key={i}
              className="px-8 text-lg text-muted-foreground whitespace-nowrap font-rajdhani"
            >
              {brand}
            </span>
          ))}
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="py-section">
        <div className="container max-w-container mx-auto px-6">
          <motion.div {...fadeInUp} className="text-center mb-16">
            <h2 className="section-heading mb-4">How It Works</h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              Three simple steps to see yourself in any outfit
            </p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-8">
            {steps.map((step, index) => (
              <motion.div
                key={step.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.2 }}
              >
                <Card className="relative group">
                  <CardContent className="p-8 text-center">
                    <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-gold/10 flex items-center justify-center group-hover:bg-gold/20 transition-colors">
                      <step.icon className="w-8 h-8 text-gold" />
                    </div>
                    <div className="absolute top-4 right-4 w-8 h-8 rounded-full bg-gold/10 flex items-center justify-center text-gold font-orbitron font-bold">
                      {index + 1}
                    </div>
                    <h3 className="text-xl font-semibold mb-3">{step.title}</h3>
                    <p className="text-muted-foreground">{step.description}</p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-section bg-charcoal/30">
        <div className="container max-w-container mx-auto px-6">
          <motion.div {...fadeInUp} className="text-center mb-16">
            <h2 className="section-heading mb-4">Why MirrorX?</h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              The most advanced virtual try-on technology, built for Indian fashion
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((feature, index) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
              >
                <Card className="h-full">
                  <CardContent className="p-6">
                    <div className="w-12 h-12 rounded-xl bg-gold/10 flex items-center justify-center mb-4">
                      <feature.icon className="w-6 h-6 text-gold" />
                    </div>
                    <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
                    <p className="text-sm text-muted-foreground">{feature.description}</p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-section">
        <div className="container max-w-container mx-auto px-6">
          <motion.div {...fadeInUp} className="text-center mb-16">
            <h2 className="section-heading mb-4">Loved by Shoppers</h2>
            <p className="text-muted-foreground text-lg">Real reviews from real users</p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-6">
            {testimonials.map((testimonial, index) => (
              <motion.div
                key={testimonial.name}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.15 }}
              >
                <Card>
                  <CardContent className="p-6">
                    <div className="flex gap-1 mb-4">
                      {[...Array(testimonial.rating)].map((_, i) => (
                        <Star key={i} className="w-4 h-4 fill-gold text-gold" />
                      ))}
                    </div>
                    <p className="text-muted-foreground mb-4">&ldquo;{testimonial.text}&rdquo;</p>
                    <div>
                      <p className="font-semibold">{testimonial.name}</p>
                      <p className="text-sm text-muted-foreground">{testimonial.location}</p>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-section bg-charcoal/30">
        <div className="container max-w-container mx-auto px-6">
          <motion.div {...fadeInUp} className="text-center mb-16">
            <h2 className="section-heading mb-4">Simple Pricing</h2>
            <p className="text-muted-foreground text-lg">Start free, upgrade when you need more</p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {pricingTiers.map((tier, index) => (
              <motion.div
                key={tier.name}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.15 }}
              >
                <Card
                  className={cn(
                    'relative h-full',
                    tier.popular && 'border-gold ring-2 ring-gold/20'
                  )}
                >
                  {tier.popular && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 badge-premium">
                      Most Popular
                    </div>
                  )}
                  <CardContent className="p-6">
                    <h3 className="text-xl font-semibold mb-2">{tier.name}</h3>
                    <p className="text-sm text-muted-foreground mb-4">{tier.description}</p>
                    <div className="mb-6">
                      <span className="text-4xl font-orbitron font-bold text-gold">
                        {tier.price === '0' ? 'Free' : `₹${tier.price}`}
                      </span>
                      {tier.period && (
                        <span className="text-muted-foreground">{tier.period}</span>
                      )}
                    </div>
                    <ul className="space-y-3 mb-6">
                      {tier.features.map((feature) => (
                        <li key={feature} className="flex items-center gap-2 text-sm">
                          <Check className="w-4 h-4 text-gold flex-shrink-0" />
                          {feature}
                        </li>
                      ))}
                    </ul>
                    <Button
                      className="w-full"
                      variant={tier.popular ? 'default' : 'outline'}
                      asChild
                    >
                      <Link to="/signup">{tier.cta}</Link>
                    </Button>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* B2B CTA */}
      <section className="py-section">
        <div className="container max-w-container mx-auto px-6">
          <Card className="bg-gradient-to-br from-charcoal to-midnight border-gold/30">
            <CardContent className="p-8 md:p-12">
              <div className="grid md:grid-cols-2 gap-8 items-center">
                <div>
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-gold/10 text-gold text-sm mb-4">
                    For Businesses
                  </div>
                  <h2 className="section-heading mb-4">
                    Integrate MirrorX into Your Store
                  </h2>
                  <p className="text-muted-foreground mb-6">
                    Reduce returns by 40% and increase conversions. Our API and Shopify plugin
                    make integration seamless.
                  </p>
                  <Button asChild>
                    <a href="mailto:business@mirrorx.co.in">
                      Contact Sales <ChevronRight className="w-4 h-4 ml-1" />
                    </a>
                  </Button>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  {[
                    { value: '-40%', label: 'Return Rate' },
                    { value: '+25%', label: 'Conversion' },
                    { value: '10K+', label: 'API Calls/Day' },
                    { value: '99.9%', label: 'Uptime SLA' },
                  ].map((stat) => (
                    <div
                      key={stat.label}
                      className="bg-midnight/50 rounded-xl p-4 text-center border border-gold/10"
                    >
                      <div className="text-2xl font-orbitron font-bold text-gold">
                        {stat.value}
                      </div>
                      <div className="text-sm text-muted-foreground">{stat.label}</div>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 border-t border-gold/10">
        <div className="container max-w-container mx-auto px-6">
          <div className="grid md:grid-cols-4 gap-8">
            <div>
              <Link to="/" className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 bg-gold-gradient rounded-lg flex items-center justify-center">
                  <Sparkles className="w-5 h-5 text-white" />
                </div>
                <span className="font-orbitron text-xl font-bold text-gold">MirrorX</span>
              </Link>
              <p className="text-sm text-muted-foreground">
                AI-powered virtual try-on for Indian fashion e-commerce.
              </p>
            </div>

            <div>
              <h4 className="font-semibold mb-4">Product</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#features" className="hover:text-foreground">Features</a></li>
                <li><a href="#pricing" className="hover:text-foreground">Pricing</a></li>
                <li><a href="#how-it-works" className="hover:text-foreground">How It Works</a></li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold mb-4">Legal</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><Link to="/legal/privacy" className="hover:text-foreground">Privacy Policy</Link></li>
                <li><Link to="/legal/terms" className="hover:text-foreground">Terms of Service</Link></li>
                <li><Link to="/legal/refund" className="hover:text-foreground">Refund Policy</Link></li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold mb-4">Contact</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>support@mirrorx.co.in</li>
                <li>business@mirrorx.co.in</li>
              </ul>
            </div>
          </div>

          <div className="mt-8 pt-8 border-t border-gold/10 flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-sm text-muted-foreground">
              &copy; {new Date().getFullYear()} MirrorX. All rights reserved.
            </p>
            <p className="text-sm text-muted-foreground">Made with love in India</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
