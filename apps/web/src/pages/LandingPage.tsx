import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuthStore } from '@/store/auth-store';
import {
  Zap,
  Palette,
  Download,
  ArrowRight,
  Check,
  Heart,
  Users,
  Camera,
  Shirt,
  Star,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

// Background Grid Lines
const GridBackground = () => (
  <div className="fixed inset-0 pointer-events-none z-0">
    {/* Vertical Lines */}
    <div className="absolute inset-0 max-w-7xl mx-auto flex justify-between opacity-[0.03] px-4 md:px-8">
      <div className="w-px h-full bg-white"></div>
      <div className="w-px h-full bg-white hidden md:block"></div>
      <div className="w-px h-full bg-white hidden lg:block"></div>
      <div className="w-px h-full bg-white hidden md:block"></div>
      <div className="w-px h-full bg-white"></div>
    </div>

    {/* Glow Effect */}
    <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-green-500/10 rounded-full blur-[120px]"></div>
  </div>
);

// Demo showcase data - real try-on examples
const showcaseExamples = [
  {
    id: 1,
    userImage: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=400&h=600&fit=crop&crop=face',
    resultImage: 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=400&h=600&fit=crop&crop=face',
    label: 'Casual to Formal',
  },
  {
    id: 2,
    userImage: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=600&fit=crop&crop=face',
    resultImage: 'https://images.unsplash.com/photo-1617137968427-85924c800a22?w=400&h=600&fit=crop&crop=face',
    label: 'Traditional Kurta',
  },
  {
    id: 3,
    userImage: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&h=600&fit=crop&crop=face',
    resultImage: 'https://images.unsplash.com/photo-1496747611176-843222e1e57c?w=400&h=600&fit=crop&crop=face',
    label: 'Designer Dress',
  },
  {
    id: 4,
    userImage: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=400&h=600&fit=crop&crop=face',
    resultImage: 'https://images.unsplash.com/photo-1552374196-1ab2a1c593e8?w=400&h=600&fit=crop&crop=face',
    label: 'Smart Casual',
  },
  {
    id: 5,
    userImage: 'https://images.unsplash.com/photo-1488426862026-3ee34a7d66df?w=400&h=600&fit=crop&crop=face',
    resultImage: 'https://images.unsplash.com/photo-1539109136881-3be0616acf4b?w=400&h=600&fit=crop&crop=face',
    label: 'Street Style',
  },
];

// 3D Carousel Component
const Carousel3D = () => {
  return (
    <div className="relative w-full overflow-hidden py-10 perspective-container flex justify-center mb-24">
      <div className="flex items-center justify-center gap-4 md:gap-8 min-w-max px-4">
        {/* Left Card 2 (Far Left) */}
        <div className="relative w-48 h-64 md:w-64 md:h-80 rounded-2xl overflow-hidden border border-white/10 transform opacity-40 card-3d translate-x-12 scale-90 hidden lg:block">
          <img
            src={showcaseExamples[0].resultImage}
            alt="Try-on example"
            className="w-full h-full object-cover grayscale"
          />
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-3">
            <p className="text-xs text-white/70">{showcaseExamples[0].label}</p>
          </div>
        </div>

        {/* Left Card 1 */}
        <div className="relative w-48 h-64 md:w-64 md:h-80 rounded-2xl overflow-hidden border border-white/10 transform opacity-60 card-3d translate-x-4 scale-95 hidden md:block">
          <img
            src={showcaseExamples[1].resultImage}
            alt="Try-on example"
            className="w-full h-full object-cover grayscale"
          />
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-3">
            <p className="text-xs text-white/70">{showcaseExamples[1].label}</p>
          </div>
        </div>

        {/* Center Main Card - Before/After Split */}
        <div className="relative w-64 h-80 md:w-80 md:h-96 rounded-2xl overflow-hidden border border-green-500/30 shadow-[0_0_50px_rgba(34,197,94,0.2)] z-20 bg-[#050505]">
          {/* Center Line Glow */}
          <div className="absolute inset-y-0 left-1/2 w-[2px] bg-green-400 z-40 shadow-[0_0_20px_#4ade80,0_0_40px_#4ade80]"></div>

          <div className="grid grid-cols-2 h-full">
            {/* Left half - User Photo (Original) */}
            <div className="relative h-full overflow-hidden">
              <img
                src={showcaseExamples[2].userImage}
                alt="User photo"
                className="w-full h-full object-cover grayscale brightness-90"
              />
              <div className="absolute inset-0 bg-gradient-to-r from-transparent to-black/20"></div>
              <div className="absolute bottom-3 left-3 bg-black/60 backdrop-blur-sm px-2 py-1 rounded-md">
                <p className="text-[10px] text-gray-300 font-medium">YOUR PHOTO</p>
              </div>
            </div>
            {/* Right half - Try-On Result */}
            <div className="relative h-full overflow-hidden">
              <img
                src={showcaseExamples[2].resultImage}
                alt="Try-on result"
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-l from-transparent to-black/20"></div>
              <div className="absolute bottom-3 right-3 bg-green-500/80 backdrop-blur-sm px-2 py-1 rounded-md">
                <p className="text-[10px] text-white font-medium">TRY-ON RESULT</p>
              </div>
            </div>
          </div>

          {/* Drag indicator */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-8 h-8 rounded-full bg-green-500 border-2 border-white shadow-lg flex items-center justify-center">
            <div className="flex gap-0.5">
              <div className="w-0 h-0 border-t-[4px] border-t-transparent border-b-[4px] border-b-transparent border-r-[5px] border-r-white"></div>
              <div className="w-0 h-0 border-t-[4px] border-t-transparent border-b-[4px] border-b-transparent border-l-[5px] border-l-white"></div>
            </div>
          </div>
        </div>

        {/* Right Card 1 */}
        <div className="relative w-48 h-64 md:w-64 md:h-80 rounded-2xl overflow-hidden border border-white/10 transform opacity-60 card-3d -translate-x-4 scale-95 hidden md:block">
          <img
            src={showcaseExamples[3].resultImage}
            alt="Try-on example"
            className="w-full h-full object-cover grayscale"
          />
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-3">
            <p className="text-xs text-white/70">{showcaseExamples[3].label}</p>
          </div>
        </div>

        {/* Right Card 2 (Far Right) */}
        <div className="relative w-48 h-64 md:w-64 md:h-80 rounded-2xl overflow-hidden border border-white/10 transform opacity-40 card-3d -translate-x-12 scale-90 hidden lg:block">
          <img
            src={showcaseExamples[4].resultImage}
            alt="Try-on example"
            className="w-full h-full object-cover grayscale"
          />
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-3">
            <p className="text-xs text-white/70">{showcaseExamples[4].label}</p>
          </div>
        </div>
      </div>

      {/* Bottom Fade */}
      <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-[#050505] to-transparent z-20 pointer-events-none"></div>
    </div>
  );
};

// Features data
const features = [
  {
    icon: Zap,
    title: 'Lightning-Fast\nTry-On Generation',
    description: 'Upload your photo and any outfit, get a photorealistic preview in seconds. No waiting queues.',
    color: 'text-green-400',
  },
  {
    icon: Palette,
    title: 'Works With Any\nIndian Store',
    description: 'Compatible with Myntra, Ajio, Amazon, Flipkart, Meesho and more. Just paste the product URL.',
    color: 'text-purple-400',
  },
  {
    icon: Download,
    title: 'High-Quality\nDownloads',
    description: 'Export your try-on results in high resolution. Perfect for sharing or comparing outfits.',
    color: 'text-blue-400',
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
      'Standard quality',
      'Save to wardrobe',
      'Basic support',
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
      'HD quality outputs',
      'Priority processing',
      'Shop Together access',
      'Community features',
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
      'Exclusive styles',
      'API access',
      'White-glove support',
      'Early features access',
    ],
    cta: 'Go Elite',
    popular: false,
  },
];

export default function LandingPage() {
  const { isAuthenticated, isLoading } = useAuthStore();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col items-center gap-4"
        >
          <div className="relative w-16 h-16">
            <div className="absolute inset-0 rounded-full border-4 border-green-500/20"></div>
            <div className="absolute inset-0 rounded-full border-4 border-green-500 border-t-transparent animate-spin"></div>
          </div>
          <p className="text-gray-400">Loading...</p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050505] text-gray-300 font-sans antialiased overflow-x-hidden selection:bg-green-500/30">
      <GridBackground />

      {/* Navigation */}
      <nav className="relative z-50 w-full border-b border-white/5 bg-[#050505]/50 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-6 h-6 bg-green-500 rounded-sm"></div>
            <span className="font-medium tracking-tight text-white">MirrorX</span>
          </Link>

          <div className="hidden md:flex items-center gap-6 text-sm font-medium">
            <a href="#features" className="text-gray-400 hover:text-white transition-colors">Features</a>
            <a href="#pricing" className="text-gray-400 hover:text-white transition-colors">Pricing</a>
          </div>

          <div className="flex items-center gap-3">
            {isAuthenticated ? (
              <Button asChild className="bg-white/10 hover:bg-white/20 text-white border border-white/5 rounded-full">
                <Link to="/app/tryon">Open App</Link>
              </Button>
            ) : (
              <>
                <Button variant="ghost" asChild className="text-gray-300 hover:text-white">
                  <Link to="/login">Log in</Link>
                </Button>
                <Button asChild className="bg-brand-gradient hover:opacity-90 text-white rounded-full border-0">
                  <Link to="/signup">Get Started</Link>
                </Button>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="relative z-10 pt-20 pb-32">

        {/* Hero Header */}
        <div className="max-w-4xl mx-auto text-center px-4 mb-20">
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-5xl md:text-7xl font-medium text-white tracking-tight leading-[1.1] mb-6"
          >
            T<span className="font-pixel text-green-400 opacity-90">r</span>y Any Outf<span className="font-pixel text-white/80">i</span>t <br className="hidden md:block" />
            Befo<span className="font-pixel text-green-400 opacity-90">r</span>e You B<span className="font-pixel text-white/80">u</span>y
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="text-xl text-gray-400 font-normal max-w-2xl mx-auto leading-relaxed mb-10"
          >
            AI-powered virtual try-on for Indian fashion. <br className="hidden sm:block" />
            Works with Myntra, Ajio, Amazon & more.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="flex flex-col sm:flex-row justify-center gap-4"
          >
            <Button
              size="lg"
              asChild
              className="group relative inline-flex items-center justify-center gap-2 bg-white/5 text-white px-8 py-6 rounded-full overflow-hidden border border-white/10 hover:border-green-500/50 transition-all duration-300 hover:shadow-[0_0_20px_rgba(34,197,94,0.3)]"
            >
              <Link to={isAuthenticated ? '/app/tryon' : '/signup'}>
                <div className="absolute inset-0 bg-green-500/10 translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>
                <span className="relative font-medium text-lg">Try It Free</span>
                <ArrowRight className="relative w-5 h-5 transition-transform group-hover:translate-x-1" />
              </Link>
            </Button>
          </motion.div>

          {/* Trust badges */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="flex items-center justify-center gap-6 mt-8 flex-wrap"
          >
            <div className="flex items-center gap-2">
              <div className="flex -space-x-2">
                {['👩🏻', '👨🏽', '👩🏾', '👨🏻'].map((emoji, i) => (
                  <div key={i} className="w-8 h-8 rounded-full bg-white/5 border-2 border-[#050505] flex items-center justify-center text-sm">
                    {emoji}
                  </div>
                ))}
              </div>
              <span className="text-sm text-gray-500">50K+ users</span>
            </div>
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((i) => (
                <Star key={i} className="w-4 h-4 fill-green-500 text-green-500" />
              ))}
              <span className="text-sm text-gray-500 ml-1">4.9/5 rating</span>
            </div>
          </motion.div>
        </div>

        {/* 3D Carousel */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.3 }}
        >
          <Carousel3D />
        </motion.div>

        {/* Brand Partners */}
        <div className="max-w-7xl mx-auto px-6 mb-24 border-y border-white/5 bg-white/[0.01]">
          <div className="flex flex-wrap justify-center md:justify-between items-center py-8 gap-8 opacity-40 grayscale hover:grayscale-0 transition-all duration-500">
            {['Myntra', 'Ajio', 'Amazon', 'Flipkart', 'Meesho'].map((brand) => (
              <span key={brand} className="text-lg font-medium text-white/60 hover:text-white transition-colors">
                {brand}
              </span>
            ))}
          </div>
        </div>

        {/* Features Grid */}
        <div id="features" className="max-w-7xl mx-auto px-6 mb-24">
          <div className="grid md:grid-cols-3 gap-12 relative">
            {features.map((feature, index) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="group relative p-6 rounded-2xl border border-white/5 bg-white/[0.02] hover:bg-white/[0.04] transition-colors"
              >
                <div className="absolute -top-6 left-6 text-5xl font-bold text-white/5 select-none group-hover:text-green-500/10 transition-colors">
                  0{index + 1}
                </div>
                <div className={cn(
                  "w-12 h-12 rounded-lg bg-white/5 flex items-center justify-center mb-6 border border-white/10 shadow-inner group-hover:scale-110 transition-transform duration-300",
                  feature.color
                )}>
                  <feature.icon className="w-7 h-7" strokeWidth={1.5} />
                </div>
                <h3 className="text-xl font-medium text-white mb-3 tracking-tight whitespace-pre-line">
                  {feature.title}
                </h3>
                <p className="text-lg text-gray-400 leading-relaxed">
                  {feature.description}
                </p>
              </motion.div>
            ))}
          </div>
        </div>

        {/* How It Works */}
        <div className="max-w-7xl mx-auto px-6 mb-24">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl md:text-5xl font-medium text-white mb-4">
              How It <span className="text-green-400">Works</span>
            </h2>
            <p className="text-gray-400 text-lg max-w-2xl mx-auto">
              Three simple steps to see yourself in any outfit
            </p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              { step: '01', title: 'Upload Your Photo', desc: 'Take or upload a clear selfie' },
              { step: '02', title: 'Choose Your Style', desc: 'Paste any product URL or upload an image' },
              { step: '03', title: 'See The Magic', desc: 'Get a photorealistic preview in seconds' },
            ].map((item, index) => (
              <motion.div
                key={item.step}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.15 }}
                className="relative p-8 rounded-2xl border border-white/5 bg-white/[0.02] text-center group hover:border-green-500/30 transition-colors"
              >
                <div className="absolute top-4 right-4 w-10 h-10 rounded-full bg-green-500 flex items-center justify-center text-[#050505] font-bold text-lg">
                  {index + 1}
                </div>
                <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-green-500/10 flex items-center justify-center border border-green-500/20 group-hover:scale-110 transition-transform">
                  {index === 0 && <Camera className="w-8 h-8 text-green-400" />}
                  {index === 1 && <Shirt className="w-8 h-8 text-green-400" />}
                  {index === 2 && <Zap className="w-8 h-8 text-green-400" />}
                </div>
                <h3 className="text-xl font-medium text-white mb-2">{item.title}</h3>
                <p className="text-gray-400">{item.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Social Features */}
        <div className="max-w-7xl mx-auto px-6 mb-24">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="relative p-8 md:p-12 rounded-3xl border border-white/5 bg-white/[0.02] overflow-hidden"
          >
            {/* Background glow */}
            <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-purple-500/10 rounded-full blur-[100px]"></div>

            <div className="relative z-10 grid md:grid-cols-2 gap-8 items-center">
              <div>
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-purple-500/10 border border-purple-500/30 text-purple-400 text-sm mb-6">
                  <Users className="w-4 h-4" />
                  Shop Together
                </div>
                <h2 className="text-3xl md:text-4xl font-medium text-white mb-4">
                  Get Opinions <span className="text-purple-400">Before You Buy</span>
                </h2>
                <p className="text-gray-400 text-lg mb-6">
                  Share your virtual try-ons with friends, create polls, and get votes. Never make a bad fashion decision alone again.
                </p>
                <Button asChild className="bg-gradient-to-r from-purple-500 to-pink-500 hover:opacity-90 text-white rounded-full">
                  <Link to={isAuthenticated ? '/app/feed' : '/signup'}>
                    Explore Shop Together <ArrowRight className="ml-2 w-4 h-4" />
                  </Link>
                </Button>
              </div>
              <div className="grid grid-cols-2 gap-4">
                {[
                  { icon: Users, label: 'Share with Friends', value: 'Instant sharing' },
                  { icon: Heart, label: 'Get Votes', value: 'Community picks' },
                ].map((item) => (
                  <div key={item.label} className="p-4 rounded-xl bg-white/5 border border-white/10">
                    <item.icon className="w-8 h-8 text-purple-400 mb-3" />
                    <p className="text-white font-medium">{item.label}</p>
                    <p className="text-sm text-gray-500">{item.value}</p>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        </div>

        {/* Pricing */}
        <div id="pricing" className="max-w-7xl mx-auto px-6 mb-24">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl md:text-5xl font-medium text-white mb-4">
              Simple <span className="text-green-400">Pricing</span>
            </h2>
            <p className="text-gray-400 text-lg">Start free, upgrade when you need more</p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {pricingTiers.map((tier, index) => (
              <motion.div
                key={tier.name}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className={cn(
                  "relative p-6 rounded-2xl border transition-colors",
                  tier.popular
                    ? "border-green-500/50 bg-green-500/5 shadow-[0_0_30px_rgba(34,197,94,0.15)]"
                    : "border-white/5 bg-white/[0.02] hover:bg-white/[0.04]"
                )}
              >
                {tier.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 bg-green-500 text-[#050505] text-sm font-medium rounded-full">
                    Most Popular
                  </div>
                )}
                <h3 className="text-xl font-medium text-white mb-2">{tier.name}</h3>
                <p className="text-sm text-gray-500 mb-4">{tier.description}</p>
                <div className="mb-6">
                  <span className="text-4xl font-medium text-green-400">
                    {tier.price === '0' ? 'Free' : `₹${tier.price}`}
                  </span>
                  {tier.period && (
                    <span className="text-gray-500">{tier.period}</span>
                  )}
                </div>
                <ul className="space-y-3 mb-6">
                  {tier.features.map((feature) => (
                    <li key={feature} className="flex items-center gap-2 text-sm text-gray-300">
                      <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
                      {feature}
                    </li>
                  ))}
                </ul>
                <Button
                  className={cn(
                    "w-full rounded-full",
                    tier.popular
                      ? "bg-brand-gradient hover:opacity-90 text-white"
                      : "bg-white/5 hover:bg-white/10 text-white border border-white/10"
                  )}
                  asChild
                >
                  <Link to="/signup">{tier.cta}</Link>
                </Button>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Final CTA */}
        <div className="max-w-4xl mx-auto px-6 text-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-4xl md:text-6xl font-medium text-white mb-6">
              Ready to Transform Your
              <span className="block text-green-400">Shopping Experience?</span>
            </h2>
            <p className="text-xl text-gray-400 mb-8 max-w-2xl mx-auto">
              Join 50,000+ users who never buy the wrong outfit again
            </p>
            <Button
              size="lg"
              asChild
              className="group relative inline-flex items-center justify-center gap-2 bg-brand-gradient text-white px-10 py-6 rounded-full overflow-hidden border-0 hover:shadow-[0_0_30px_rgba(34,197,94,0.4)] transition-all duration-300"
            >
              <Link to={isAuthenticated ? '/app/tryon' : '/signup'}>
                <span className="font-medium text-lg">Get Started Free</span>
                <ArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />
              </Link>
            </Button>
          </motion.div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 py-12 border-t border-white/5">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            <div>
              <Link to="/" className="flex items-center gap-2 mb-4">
                <div className="w-6 h-6 bg-green-500 rounded-sm"></div>
                <span className="font-medium text-white">MirrorX</span>
              </Link>
              <p className="text-sm text-gray-500">
                AI-powered virtual try-on for Indian fashion.
              </p>
            </div>

            <div>
              <h4 className="font-medium text-white mb-4">Product</h4>
              <ul className="space-y-2 text-sm text-gray-500">
                <li><a href="#features" className="hover:text-white transition">Features</a></li>
                <li><a href="#pricing" className="hover:text-white transition">Pricing</a></li>
              </ul>
            </div>

            <div>
              <h4 className="font-medium text-white mb-4">Legal</h4>
              <ul className="space-y-2 text-sm text-gray-500">
                <li><Link to="/legal/privacy" className="hover:text-white transition">Privacy Policy</Link></li>
                <li><Link to="/legal/terms" className="hover:text-white transition">Terms of Service</Link></li>
                <li><Link to="/legal/refund" className="hover:text-white transition">Refund Policy</Link></li>
              </ul>
            </div>

            <div>
              <h4 className="font-medium text-white mb-4">Contact</h4>
              <ul className="space-y-2 text-sm text-gray-500">
                <li>support@mirrorx.co.in</li>
                <li>business@mirrorx.co.in</li>
              </ul>
            </div>
          </div>

          <div className="pt-8 border-t border-white/5 flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-sm text-gray-500">
              &copy; {new Date().getFullYear()} MirrorX. All rights reserved.
            </p>
            <p className="text-sm text-gray-500 flex items-center gap-2">
              Made with <Heart className="w-4 h-4 text-red-500 fill-red-500" /> in India
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
