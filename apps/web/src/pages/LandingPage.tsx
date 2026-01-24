import { Link } from 'react-router-dom';
import { motion, useScroll, useTransform } from 'framer-motion';
import { useRef, useState } from 'react';
import { useAuthStore } from '@/store/auth-store';
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
  Ruler,
  TrendingUp,
  Heart,
  Share2,
  Calendar,
  Wand2,
  Crown,
  Target,
  Dna,
  ShoppingBag,
  Play,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { Logo } from '@/components/Logo';

// Floating 3D particles component
const FloatingParticles = () => {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {[...Array(20)].map((_, i) => (
        <motion.div
          key={i}
          className="absolute w-2 h-2 bg-gold/30 rounded-full"
          style={{
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`,
          }}
          animate={{
            y: [0, -30, 0],
            x: [0, Math.random() * 20 - 10, 0],
            opacity: [0.3, 0.8, 0.3],
            scale: [1, 1.5, 1],
          }}
          transition={{
            duration: 3 + Math.random() * 2,
            repeat: Infinity,
            delay: Math.random() * 2,
          }}
        />
      ))}
    </div>
  );
};

// 3D Card component with tilt effect
const Card3D = ({ children, className }: { children: React.ReactNode; className?: string }) => {
  const [rotateX, setRotateX] = useState(0);
  const [rotateY, setRotateY] = useState(0);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const card = e.currentTarget;
    const rect = card.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    setRotateX((y - centerY) / 10);
    setRotateY((centerX - x) / 10);
  };

  const handleMouseLeave = () => {
    setRotateX(0);
    setRotateY(0);
  };

  return (
    <motion.div
      className={cn('transform-gpu perspective-1000', className)}
      style={{
        transform: `rotateX(${rotateX}deg) rotateY(${rotateY}deg)`,
        transformStyle: 'preserve-3d',
      }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
    >
      {children}
    </motion.div>
  );
};

// Animated gradient mesh background
const GradientMesh = () => (
  <div className="absolute inset-0 overflow-hidden">
    <div className="absolute top-0 left-0 w-full h-full">
      <div className="absolute top-[10%] left-[20%] w-[600px] h-[600px] bg-gradient-to-r from-gold/20 to-royal/20 rounded-full blur-[120px] animate-pulse" />
      <div className="absolute top-[40%] right-[10%] w-[500px] h-[500px] bg-gradient-to-l from-gold/15 to-purple-500/15 rounded-full blur-[100px] animate-pulse" style={{ animationDelay: '1s' }} />
      <div className="absolute bottom-[20%] left-[30%] w-[400px] h-[400px] bg-gradient-to-t from-royal/20 to-gold/10 rounded-full blur-[80px] animate-pulse" style={{ animationDelay: '2s' }} />
    </div>
  </div>
);

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
    description: 'Take or upload a clear selfie - our AI creates your Style DNA profile',
    gradient: 'from-blue-500/20 to-cyan-500/20',
  },
  {
    icon: Shirt,
    title: 'Choose Your Style',
    description: 'Paste any product URL or upload an outfit image you want to try',
    gradient: 'from-purple-500/20 to-pink-500/20',
  },
  {
    icon: Zap,
    title: 'See Magic Happen',
    description: 'Get a photorealistic preview with your exact face in seconds',
    gradient: 'from-gold/20 to-orange-500/20',
  },
];

// Core features
const features = [
  {
    title: 'AI-Powered Accuracy',
    description: 'Our advanced AI preserves your unique features while perfectly fitting any garment',
    icon: Sparkles,
    color: 'text-gold',
    bgColor: 'bg-gold/10',
  },
  {
    title: 'Works With Any Store',
    description: 'Compatible with Myntra, Ajio, Amazon, Flipkart, Meesho and more',
    icon: Shield,
    color: 'text-blue-400',
    bgColor: 'bg-blue-400/10',
  },
  {
    title: 'Instant Results',
    description: 'See yourself in any outfit within seconds, not minutes',
    icon: Zap,
    color: 'text-purple-400',
    bgColor: 'bg-purple-400/10',
  },
  {
    title: 'Style Suggestions',
    description: 'Get AI-powered complementary item recommendations for complete looks',
    icon: Star,
    color: 'text-pink-400',
    bgColor: 'bg-pink-400/10',
  },
];

// Unique features - Growth drivers
const uniqueFeatures = [
  {
    icon: Dna,
    title: 'Style DNA',
    description: 'AI analyzes your skin tone, body type, and features to create your unique style profile',
    benefit: 'Never buy wrong colors again',
    color: 'from-gold to-orange-500',
  },
  {
    icon: Wand2,
    title: 'AI Personal Tailor',
    description: 'Get personalized wardrobe recommendations based on your Style DNA and preferences',
    benefit: 'Your 24/7 fashion consultant',
    color: 'from-purple-500 to-pink-500',
  },
  {
    icon: Ruler,
    title: 'Smart Size Predictor',
    description: 'AI predicts your exact size across different brands - no more guessing',
    benefit: 'Zero size-related returns',
    color: 'from-blue-500 to-cyan-500',
  },
  {
    icon: TrendingUp,
    title: 'Trend Radar',
    description: 'Discover trending styles that match YOUR style DNA and body type',
    benefit: 'Always stylish, always you',
    color: 'from-green-500 to-emerald-500',
  },
  {
    icon: Calendar,
    title: 'Outfit Planner',
    description: 'Plan outfits for events, weather, and occasions with AI suggestions',
    benefit: 'Never stress about what to wear',
    color: 'from-red-500 to-rose-500',
  },
  {
    icon: Share2,
    title: 'Style Community',
    description: 'Share your virtual try-ons and get feedback from fashion enthusiasts',
    benefit: 'Build your style confidence',
    color: 'from-indigo-500 to-violet-500',
  },
];

// Testimonials
const testimonials = [
  {
    name: 'Priya Sharma',
    location: 'Mumbai',
    avatar: '👩🏻',
    rating: 5,
    text: 'The Style DNA feature is incredible! It told me my skin undertone and which colors suit me best. Now every purchase is a winner!',
    highlight: 'Style DNA',
  },
  {
    name: 'Rahul Verma',
    location: 'Bangalore',
    avatar: '👨🏽',
    rating: 5,
    text: 'The size predictor saved me from 3 returns last month. It knew my Levis size is different from my Zara size!',
    highlight: 'Size Predictor',
  },
  {
    name: 'Anita Desai',
    location: 'Delhi',
    avatar: '👩🏾',
    rating: 5,
    text: 'As someone who hates trial rooms, this is a game changer. The AI tailor suggests outfits for my body type perfectly.',
    highlight: 'AI Tailor',
  },
  {
    name: 'Vikram Singh',
    location: 'Pune',
    avatar: '👨🏻',
    rating: 5,
    text: 'Used it before my wedding shopping. Tried 50+ sherwanis virtually. Found THE one without visiting a single store!',
    highlight: 'Virtual Try-On',
  },
];

// Pricing tiers
const pricingTiers = [
  {
    name: 'Free',
    price: '0',
    description: 'Perfect for trying out',
    features: [
      '5 try-ons per day',
      'Basic Style DNA',
      'Standard quality',
      'Save to wardrobe',
    ],
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
      'Full Style DNA profile',
      'AI Personal Tailor',
      'Smart Size Predictor',
      'HD quality outputs',
      'Outfit suggestions',
      'Priority support',
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
      'Trend Radar access',
      'Outfit Planner',
      'Style Community Pro',
      'API access',
      'White-glove support',
    ],
    cta: 'Go Elite',
    popular: false,
  },
];

export default function LandingPage() {
  const { isAuthenticated, isLoading } = useAuthStore();
  const heroRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ['start start', 'end start'],
  });
  const heroOpacity = useTransform(scrollYProgress, [0, 1], [1, 0]);
  const heroScale = useTransform(scrollYProgress, [0, 1], [1, 0.95]);

  // Show loading while checking auth
  if (isLoading) {
    return (
      <div className="min-h-screen bg-midnight flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col items-center gap-4"
        >
          <div className="relative w-16 h-16">
            <div className="absolute inset-0 rounded-full border-4 border-gold/20"></div>
            <div className="absolute inset-0 rounded-full border-4 border-gold border-t-transparent animate-spin"></div>
          </div>
          <p className="text-muted-foreground">Loading...</p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-midnight overflow-x-hidden">
      {/* Navigation */}
      <nav className="glass sticky top-0 z-50 border-b border-gold/10">
        <div className="container max-w-container mx-auto px-6 h-16 flex items-center justify-between">
          <Link to="/">
            <Logo size="md" />
          </Link>

          <div className="hidden md:flex items-center gap-6">
            <a href="#features" className="text-muted-foreground hover:text-gold transition">
              Features
            </a>
            <a href="#how-it-works" className="text-muted-foreground hover:text-gold transition">
              How it Works
            </a>
            <a href="#ai-tailor" className="text-muted-foreground hover:text-gold transition">
              AI Tailor
            </a>
            <a href="#pricing" className="text-muted-foreground hover:text-gold transition">
              Pricing
            </a>
          </div>

          <div className="flex items-center gap-3">
            {isAuthenticated ? (
              <Button asChild>
                <Link to="/app/tryon">Open App</Link>
              </Button>
            ) : (
              <>
                <Button variant="ghost" asChild>
                  <Link to="/login">Log In</Link>
                </Button>
                <Button asChild className="bg-gold-gradient hover:opacity-90">
                  <Link to="/signup">Get Started</Link>
                </Button>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* Hero Section - Premium 3D */}
      <section ref={heroRef} className="relative min-h-[95vh] flex items-center overflow-hidden">
        <GradientMesh />
        <FloatingParticles />

        <motion.div
          style={{ opacity: heroOpacity, scale: heroScale }}
          className="container max-w-container mx-auto px-6 relative z-10"
        >
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Left - Text Content */}
            <motion.div
              initial={{ opacity: 0, x: -50 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8 }}
            >
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-gold/20 to-gold/5 border border-gold/30 text-gold text-sm mb-6"
              >
                <Sparkles className="w-4 h-4" />
                India's #1 AI Virtual Try-On
                <Crown className="w-4 h-4" />
              </motion.div>

              <h1 className="text-5xl md:text-6xl lg:text-7xl font-orbitron font-bold leading-tight mb-6">
                Your
                <span className="block text-transparent bg-clip-text bg-gold-gradient">
                  AI Fashion Twin
                </span>
              </h1>

              <p className="text-xl text-muted-foreground mb-8 max-w-xl">
                See yourself in any outfit before buying. Upload your photo, paste any product link from Myntra, Ajio, Amazon & get a photorealistic preview in seconds.
              </p>

              <div className="flex flex-col sm:flex-row items-start gap-4 mb-12">
                <Button size="lg" asChild className="bg-gold-gradient hover:opacity-90 text-lg px-8 py-6">
                  <Link to={isAuthenticated ? '/app/tryon' : '/signup'}>
                    Try It Free <ArrowRight className="ml-2 w-5 h-5" />
                  </Link>
                </Button>
                <Button variant="outline" size="lg" asChild className="text-lg px-8 py-6 border-gold/30 hover:bg-gold/10">
                  <a href="#how-it-works">
                    <Play className="mr-2 w-5 h-5" /> Watch Demo
                  </a>
                </Button>
              </div>

              {/* Trust badges */}
              <div className="flex items-center gap-6 flex-wrap">
                <div className="flex items-center gap-2">
                  <div className="flex -space-x-2">
                    {['👩🏻', '👨🏽', '👩🏾', '👨🏻'].map((emoji, i) => (
                      <div key={i} className="w-8 h-8 rounded-full bg-charcoal border-2 border-midnight flex items-center justify-center text-sm">
                        {emoji}
                      </div>
                    ))}
                  </div>
                  <span className="text-sm text-muted-foreground">50K+ users</span>
                </div>
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <Star key={i} className="w-4 h-4 fill-gold text-gold" />
                  ))}
                  <span className="text-sm text-muted-foreground ml-1">4.9/5 rating</span>
                </div>
              </div>
            </motion.div>

            {/* Right - 3D Mockup */}
            <motion.div
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8, delay: 0.3 }}
              className="relative hidden lg:block"
            >
              <Card3D className="relative">
                <div className="relative bg-gradient-to-br from-charcoal to-midnight rounded-3xl p-8 border border-gold/20 shadow-2xl shadow-gold/10">
                  {/* Phone mockup */}
                  <div className="relative mx-auto w-[280px] h-[560px] bg-midnight rounded-[40px] border-4 border-charcoal overflow-hidden shadow-inner">
                    {/* Screen content */}
                    <div className="absolute inset-2 bg-gradient-to-b from-charcoal/50 to-midnight rounded-[32px] overflow-hidden">
                      {/* App header */}
                      <div className="bg-charcoal/80 backdrop-blur px-4 py-3 flex items-center justify-between">
                        <Logo size="sm" />
                        <div className="flex gap-2">
                          <div className="w-6 h-6 rounded-full bg-gold/20 flex items-center justify-center">
                            <Camera className="w-3 h-3 text-gold" />
                          </div>
                        </div>
                      </div>

                      {/* Demo content */}
                      <div className="p-4 space-y-4">
                        <div className="aspect-[3/4] rounded-xl bg-gradient-to-br from-gold/5 to-purple-500/5 border border-gold/10 flex items-center justify-center">
                          <motion.div
                            animate={{ scale: [1, 1.05, 1] }}
                            transition={{ duration: 2, repeat: Infinity }}
                            className="text-center"
                          >
                            <div className="text-4xl mb-2">👗</div>
                            <p className="text-xs text-muted-foreground">Virtual Try-On Result</p>
                          </motion.div>
                        </div>

                        <div className="flex gap-2">
                          <div className="flex-1 h-10 rounded-lg bg-gold/20 flex items-center justify-center">
                            <span className="text-xs text-gold">95% Match</span>
                          </div>
                          <div className="flex-1 h-10 rounded-lg bg-green-500/20 flex items-center justify-center">
                            <span className="text-xs text-green-400">Size M</span>
                          </div>
                        </div>

                        <div className="bg-charcoal/50 rounded-lg p-3">
                          <div className="text-xs text-gold mb-1">AI Says:</div>
                          <div className="text-xs text-muted-foreground">This color complements your skin tone perfectly!</div>
                        </div>
                      </div>
                    </div>

                    {/* Notch */}
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-24 h-6 bg-midnight rounded-b-2xl" />
                  </div>

                  {/* Floating elements */}
                  <motion.div
                    animate={{ y: [-5, 5, -5] }}
                    transition={{ duration: 3, repeat: Infinity }}
                    className="absolute -top-6 -right-6 bg-gold/20 backdrop-blur-sm rounded-xl p-3 border border-gold/30"
                  >
                    <div className="flex items-center gap-2">
                      <Dna className="w-5 h-5 text-gold" />
                      <span className="text-sm font-medium">Style DNA Ready</span>
                    </div>
                  </motion.div>

                  <motion.div
                    animate={{ y: [5, -5, 5] }}
                    transition={{ duration: 3, repeat: Infinity, delay: 0.5 }}
                    className="absolute -bottom-4 -left-6 bg-purple-500/20 backdrop-blur-sm rounded-xl p-3 border border-purple-500/30"
                  >
                    <div className="flex items-center gap-2">
                      <Wand2 className="w-5 h-5 text-purple-400" />
                      <span className="text-sm font-medium">AI Tailor Active</span>
                    </div>
                  </motion.div>
                </div>
              </Card3D>
            </motion.div>
          </div>
        </motion.div>
      </section>

      {/* Brand Partners Ticker */}
      <section className="py-6 border-y border-gold/10 bg-charcoal/30 overflow-hidden">
        <div className="flex animate-ticker">
          {[...brandPartners, ...brandPartners, ...brandPartners].map((brand, i) => (
            <span
              key={i}
              className="px-8 text-lg text-muted-foreground/60 whitespace-nowrap font-rajdhani hover:text-gold transition-colors"
            >
              {brand}
            </span>
          ))}
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-16 relative">
        <div className="container max-w-container mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {[
              { value: '50K+', label: 'Happy Users', icon: Heart },
              { value: '2M+', label: 'Try-Ons Generated', icon: Shirt },
              { value: '95%', label: 'Accuracy Rate', icon: Target },
              { value: '40%', label: 'Fewer Returns', icon: TrendingUp },
            ].map((stat, index) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="text-center"
              >
                <Card3D>
                  <div className="bg-gradient-to-br from-charcoal to-midnight/50 rounded-2xl p-6 border border-gold/10">
                    <stat.icon className="w-8 h-8 text-gold mx-auto mb-3" />
                    <div className="text-3xl md:text-4xl font-orbitron font-bold text-gold mb-1">
                      {stat.value}
                    </div>
                    <div className="text-sm text-muted-foreground">{stat.label}</div>
                  </div>
                </Card3D>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="py-20 relative">
        <div className="container max-w-container mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl md:text-5xl font-orbitron font-bold mb-4">
              How It <span className="text-gold">Works</span>
            </h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              Three simple steps to see yourself in any outfit
            </p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-8 relative">
            {/* Connection lines */}
            <div className="hidden md:block absolute top-1/2 left-1/4 right-1/4 h-0.5 bg-gradient-to-r from-gold/50 via-purple-500/50 to-gold/50" />

            {steps.map((step, index) => (
              <motion.div
                key={step.title}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.2 }}
              >
                <Card3D>
                  <Card className="relative overflow-hidden">
                    <div className={cn('absolute inset-0 bg-gradient-to-br opacity-50', step.gradient)} />
                    <CardContent className="p-8 text-center relative">
                      <motion.div
                        whileHover={{ scale: 1.1, rotate: 5 }}
                        className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gold/10 flex items-center justify-center border border-gold/20"
                      >
                        <step.icon className="w-10 h-10 text-gold" />
                      </motion.div>
                      <div className="absolute top-4 right-4 w-10 h-10 rounded-full bg-gold flex items-center justify-center text-midnight font-orbitron font-bold text-lg">
                        {index + 1}
                      </div>
                      <h3 className="text-xl font-semibold mb-3">{step.title}</h3>
                      <p className="text-muted-foreground">{step.description}</p>
                    </CardContent>
                  </Card>
                </Card3D>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section id="features" className="py-20 bg-gradient-to-b from-charcoal/30 to-midnight">
        <div className="container max-w-container mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl md:text-5xl font-orbitron font-bold mb-4">
              Why Choose <span className="text-gold">MirrorX</span>?
            </h2>
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
                <Card3D className="h-full">
                  <Card className="h-full hover:border-gold/30 transition-colors">
                    <CardContent className="p-6">
                      <div className={cn('w-14 h-14 rounded-xl flex items-center justify-center mb-4', feature.bgColor)}>
                        <feature.icon className={cn('w-7 h-7', feature.color)} />
                      </div>
                      <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
                      <p className="text-sm text-muted-foreground">{feature.description}</p>
                    </CardContent>
                  </Card>
                </Card3D>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* AI Tailor - Unique Features */}
      <section id="ai-tailor" className="py-20 relative overflow-hidden">
        <GradientMesh />

        <div className="container max-w-container mx-auto px-6 relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-purple-500/20 to-pink-500/20 border border-purple-500/30 text-purple-400 text-sm mb-6">
              <Wand2 className="w-4 h-4" />
              AI-Powered Features
            </div>
            <h2 className="text-4xl md:text-5xl font-orbitron font-bold mb-4">
              Your Personal <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400">AI Tailor</span>
            </h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              Beyond try-on - MirrorX understands YOUR unique style and body to give personalized recommendations
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {uniqueFeatures.map((feature, index) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
              >
                <Card3D className="h-full">
                  <Card className="h-full group hover:border-gold/30 transition-all duration-300">
                    <CardContent className="p-6">
                      <div className={cn(
                        'w-14 h-14 rounded-xl flex items-center justify-center mb-4 bg-gradient-to-br',
                        feature.color
                      )}>
                        <feature.icon className="w-7 h-7 text-white" />
                      </div>
                      <h3 className="text-xl font-semibold mb-2 group-hover:text-gold transition-colors">
                        {feature.title}
                      </h3>
                      <p className="text-muted-foreground mb-4">{feature.description}</p>
                      <div className="inline-flex items-center gap-2 text-sm text-gold">
                        <Check className="w-4 h-4" />
                        {feature.benefit}
                      </div>
                    </CardContent>
                  </Card>
                </Card3D>
              </motion.div>
            ))}
          </div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mt-12"
          >
            <Button size="lg" asChild className="bg-gradient-to-r from-purple-500 to-pink-500 hover:opacity-90">
              <Link to={isAuthenticated ? '/app/tailor' : '/signup'}>
                Discover Your Style DNA <ArrowRight className="ml-2 w-5 h-5" />
              </Link>
            </Button>
          </motion.div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-20 bg-charcoal/30">
        <div className="container max-w-container mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl md:text-5xl font-orbitron font-bold mb-4">
              Loved by <span className="text-gold">Shoppers</span>
            </h2>
            <p className="text-muted-foreground text-lg">Real reviews from real users</p>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {testimonials.map((testimonial, index) => (
              <motion.div
                key={testimonial.name}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
              >
                <Card3D className="h-full">
                  <Card className="h-full">
                    <CardContent className="p-6">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="w-12 h-12 rounded-full bg-gold/10 flex items-center justify-center text-2xl">
                          {testimonial.avatar}
                        </div>
                        <div>
                          <p className="font-semibold">{testimonial.name}</p>
                          <p className="text-sm text-muted-foreground">{testimonial.location}</p>
                        </div>
                      </div>
                      <div className="flex gap-1 mb-3">
                        {[...Array(testimonial.rating)].map((_, i) => (
                          <Star key={i} className="w-4 h-4 fill-gold text-gold" />
                        ))}
                      </div>
                      <p className="text-muted-foreground text-sm mb-3">&ldquo;{testimonial.text}&rdquo;</p>
                      <div className="inline-block px-3 py-1 rounded-full bg-gold/10 text-gold text-xs">
                        {testimonial.highlight}
                      </div>
                    </CardContent>
                  </Card>
                </Card3D>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-20">
        <div className="container max-w-container mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl md:text-5xl font-orbitron font-bold mb-4">
              Simple <span className="text-gold">Pricing</span>
            </h2>
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
                <Card3D className="h-full">
                  <Card
                    className={cn(
                      'relative h-full',
                      tier.popular && 'border-gold ring-2 ring-gold/20'
                    )}
                  >
                    {tier.popular && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 bg-gold text-midnight text-sm font-semibold rounded-full">
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
                        className={cn(
                          'w-full',
                          tier.popular ? 'bg-gold-gradient hover:opacity-90' : ''
                        )}
                        variant={tier.popular ? 'default' : 'outline'}
                        asChild
                      >
                        <Link to="/signup">{tier.cta}</Link>
                      </Button>
                    </CardContent>
                  </Card>
                </Card3D>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* B2B CTA */}
      <section className="py-20">
        <div className="container max-w-container mx-auto px-6">
          <Card3D>
            <Card className="bg-gradient-to-br from-charcoal to-midnight border-gold/30 overflow-hidden">
              <CardContent className="p-8 md:p-12 relative">
                <FloatingParticles />
                <div className="grid md:grid-cols-2 gap-8 items-center relative z-10">
                  <div>
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-gold/10 text-gold text-sm mb-4">
                      <ShoppingBag className="w-4 h-4" />
                      For E-Commerce Businesses
                    </div>
                    <h2 className="text-3xl md:text-4xl font-orbitron font-bold mb-4">
                      Integrate MirrorX into Your Store
                    </h2>
                    <p className="text-muted-foreground mb-6">
                      Reduce returns by 40% and increase conversions by 25%. Our API and Shopify plugin make integration seamless.
                    </p>
                    <Button asChild className="bg-gold-gradient hover:opacity-90">
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
                      <Card3D key={stat.label}>
                        <div className="bg-midnight/50 rounded-xl p-4 text-center border border-gold/10">
                          <div className="text-2xl font-orbitron font-bold text-gold">
                            {stat.value}
                          </div>
                          <div className="text-sm text-muted-foreground">{stat.label}</div>
                        </div>
                      </Card3D>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </Card3D>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-20 relative overflow-hidden">
        <GradientMesh />
        <div className="container max-w-container mx-auto px-6 text-center relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-4xl md:text-6xl font-orbitron font-bold mb-6">
              Ready to Transform Your
              <span className="block text-gold">Shopping Experience?</span>
            </h2>
            <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
              Join 50,000+ users who never buy the wrong outfit again
            </p>
            <Button size="lg" asChild className="bg-gold-gradient hover:opacity-90 text-lg px-10 py-6">
              <Link to={isAuthenticated ? '/app/tryon' : '/signup'}>
                Get Started Free <ArrowRight className="ml-2 w-6 h-6" />
              </Link>
            </Button>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 border-t border-gold/10">
        <div className="container max-w-container mx-auto px-6">
          <div className="grid md:grid-cols-4 gap-8">
            <div>
              <Logo size="md" />
              <p className="text-sm text-muted-foreground mt-4">
                AI-powered virtual try-on & personal styling for Indian fashion.
              </p>
            </div>

            <div>
              <h4 className="font-semibold mb-4">Product</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#features" className="hover:text-gold transition">Features</a></li>
                <li><a href="#ai-tailor" className="hover:text-gold transition">AI Tailor</a></li>
                <li><a href="#pricing" className="hover:text-gold transition">Pricing</a></li>
                <li><a href="#how-it-works" className="hover:text-gold transition">How It Works</a></li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold mb-4">Legal</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><Link to="/legal/privacy" className="hover:text-gold transition">Privacy Policy</Link></li>
                <li><Link to="/legal/terms" className="hover:text-gold transition">Terms of Service</Link></li>
                <li><Link to="/legal/refund" className="hover:text-gold transition">Refund Policy</Link></li>
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
            <p className="text-sm text-muted-foreground flex items-center gap-2">
              Made with <Heart className="w-4 h-4 text-red-500 fill-red-500" /> in India
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
