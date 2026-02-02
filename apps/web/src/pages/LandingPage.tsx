import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuthStore } from '@/store/auth-store';
import { useState, useEffect } from 'react';
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

// Demo showcase data - same person in input and result (simulating try-on)
const showcaseExamples = [
  {
    id: 1,
    // Same woman - input (plain) vs result (formal dress)
    inputImage: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&h=600&fit=crop&crop=face',
    resultImage: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&h=600&fit=crop',
    clothImage: 'https://images.unsplash.com/photo-1595777457583-95e059d581b8?w=400&h=600&fit=crop',
    label: 'Evening Gown',
  },
  {
    id: 2,
    // Same man - input vs result (formal suit)
    inputImage: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=600&fit=crop&crop=face',
    resultImage: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=600&fit=crop',
    clothImage: 'https://images.unsplash.com/photo-1594938298603-c8148c4dae35?w=400&h=600&fit=crop',
    label: 'Designer Suit',
  },
  {
    id: 3,
    // Same woman - input vs result (floral dress)
    inputImage: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=400&h=600&fit=crop&crop=face',
    resultImage: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=400&h=600&fit=crop',
    clothImage: 'https://images.unsplash.com/photo-1572804013309-59a88b7e92f1?w=400&h=600&fit=crop',
    label: 'Floral Dress',
  },
  {
    id: 4,
    // Same man - input vs result (casual blazer)
    inputImage: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=400&h=600&fit=crop&crop=face',
    resultImage: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=400&h=600&fit=crop',
    clothImage: 'https://images.unsplash.com/photo-1617127365659-c47fa864d8bc?w=400&h=600&fit=crop',
    label: 'Smart Casual',
  },
  {
    id: 5,
    // Same woman - input vs result (traditional)
    inputImage: 'https://images.unsplash.com/photo-1488426862026-3ee34a7d66df?w=400&h=600&fit=crop&crop=face',
    resultImage: 'https://images.unsplash.com/photo-1488426862026-3ee34a7d66df?w=400&h=600&fit=crop',
    clothImage: 'https://images.unsplash.com/photo-1583391733956-6c78276477e2?w=400&h=600&fit=crop',
    label: 'Traditional Saree',
  },
  {
    id: 6,
    // Another woman - input vs result
    inputImage: 'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=400&h=600&fit=crop&crop=face',
    resultImage: 'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=400&h=600&fit=crop',
    clothImage: 'https://images.unsplash.com/photo-1515372039744-b8f02a3ae446?w=400&h=600&fit=crop',
    label: 'Summer Dress',
  },
];

// Infinite Scrolling Carousel Component
const Carousel3D = () => {
  const [activeIndex, setActiveIndex] = useState(0);
  const totalItems = showcaseExamples.length;

  // Duplicate items for seamless infinite scroll
  const duplicatedItems = [...showcaseExamples, ...showcaseExamples, ...showcaseExamples];

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % totalItems);
    }, 3000); // Change card every 3 seconds

    return () => clearInterval(interval);
  }, [totalItems]);

  // Calculate position and styling for each card
  const getCardStyle = (index: number) => {
    const centerOffset = totalItems; // Start from middle set
    const relativeIndex = (index - centerOffset - activeIndex + totalItems) % totalItems;

    // Normalize to -2 to +2 range for visible cards
    let position = relativeIndex;
    if (position > totalItems / 2) position -= totalItems;
    if (position < -totalItems / 2) position += totalItems;

    const isCenter = position === 0;
    const isVisible = Math.abs(position) <= 2;

    // Calculate transforms based on position
    const translateX = position * 280; // Card width + gap
    const scale = isCenter ? 1 : Math.max(0.7, 1 - Math.abs(position) * 0.15);
    const opacity = isCenter ? 1 : Math.max(0.3, 1 - Math.abs(position) * 0.35);
    const zIndex = 10 - Math.abs(position);

    return {
      transform: `translateX(${translateX}px) scale(${scale})`,
      opacity: isVisible ? opacity : 0,
      zIndex,
      isCenter,
      isVisible,
    };
  };

  return (
    <div className="relative w-full overflow-hidden py-10 mb-24">
      {/* Left fade gradient */}
      <div className="absolute left-0 top-0 bottom-0 w-32 md:w-64 bg-gradient-to-r from-[#050505] via-[#050505]/80 to-transparent z-30 pointer-events-none"></div>

      {/* Right fade gradient */}
      <div className="absolute right-0 top-0 bottom-0 w-32 md:w-64 bg-gradient-to-l from-[#050505] via-[#050505]/80 to-transparent z-30 pointer-events-none"></div>

      {/* Carousel container */}
      <div className="relative flex items-center justify-center h-[400px] md:h-[450px]">
        {duplicatedItems.slice(totalItems, totalItems * 2).map((item, idx) => {
          const style = getCardStyle(idx + totalItems);

          return (
            <div
              key={`${item.id}-${idx}`}
              className="absolute transition-all duration-700 ease-out"
              style={{
                transform: style.transform,
                opacity: style.opacity,
                zIndex: style.zIndex,
              }}
            >
              {style.isCenter ? (
                // Center card - Split view with B/W left and colored right
                <div className="relative w-64 h-80 md:w-80 md:h-96 rounded-2xl overflow-hidden border-2 border-green-500/50 bg-[#050505] carousel-card-active">
                  {/* Center Line Glow */}
                  <div className="absolute inset-y-0 left-1/2 w-[3px] bg-green-400 z-40 shadow-[0_0_20px_#4ade80,0_0_40px_#4ade80] -translate-x-1/2 carousel-line-glow"></div>

                  <div className="grid grid-cols-2 h-full">
                    {/* Left half - Input Photo (B/W) */}
                    <div className="relative h-full overflow-hidden">
                      <img
                        src={item.inputImage}
                        alt="Input photo"
                        className="w-full h-full object-cover grayscale brightness-90"
                      />
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent to-black/30"></div>
                      <div className="absolute bottom-3 left-3 bg-black/70 backdrop-blur-sm px-2 py-1 rounded-md">
                        <p className="text-[10px] text-gray-300 font-medium tracking-wide">INPUT</p>
                      </div>
                    </div>

                    {/* Right half - Try-On Result (Colored) */}
                    <div className="relative h-full overflow-hidden">
                      <img
                        src={item.clothImage}
                        alt="Try-on result"
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-gradient-to-l from-transparent to-black/30"></div>
                      <div className="absolute bottom-3 right-3 bg-green-500/90 backdrop-blur-sm px-2 py-1 rounded-md">
                        <p className="text-[10px] text-white font-medium tracking-wide">RESULT</p>
                      </div>
                    </div>
                  </div>

                  {/* Drag indicator */}
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-10 h-10 rounded-full bg-green-500 border-2 border-white shadow-[0_0_20px_rgba(34,197,94,0.5)] flex items-center justify-center">
                    <div className="flex gap-0.5">
                      <div className="w-0 h-0 border-t-[5px] border-t-transparent border-b-[5px] border-b-transparent border-r-[6px] border-r-white"></div>
                      <div className="w-0 h-0 border-t-[5px] border-t-transparent border-b-[5px] border-b-transparent border-l-[6px] border-l-white"></div>
                    </div>
                  </div>

                  {/* Label */}
                  <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 text-sm text-green-400 font-medium whitespace-nowrap">
                    {item.label}
                  </div>
                </div>
              ) : (
                // Side cards - Full B/W with split preview
                <div className="relative w-48 h-64 md:w-64 md:h-80 rounded-2xl overflow-hidden border border-white/10 bg-[#050505]">
                  <div className="grid grid-cols-2 h-full">
                    {/* Left half - Input (B/W) */}
                    <div className="relative h-full overflow-hidden">
                      <img
                        src={item.inputImage}
                        alt="Input"
                        className="w-full h-full object-cover grayscale brightness-75"
                      />
                    </div>
                    {/* Right half - Result (B/W for side cards) */}
                    <div className="relative h-full overflow-hidden">
                      <img
                        src={item.clothImage}
                        alt="Result"
                        className="w-full h-full object-cover grayscale brightness-75"
                      />
                    </div>
                  </div>

                  {/* Center divider line */}
                  <div className="absolute inset-y-0 left-1/2 w-[1px] bg-white/20 -translate-x-1/2"></div>

                  {/* Bottom gradient with label */}
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-3 pt-8">
                    <p className="text-xs text-white/60 text-center">{item.label}</p>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Navigation dots */}
      <div className="flex justify-center gap-2 mt-8">
        {showcaseExamples.map((_, idx) => (
          <button
            key={idx}
            onClick={() => setActiveIndex(idx)}
            className={cn(
              "w-2 h-2 rounded-full transition-all duration-300",
              idx === activeIndex
                ? "w-6 bg-green-500"
                : "bg-white/20 hover:bg-white/40"
            )}
            aria-label={`Go to slide ${idx + 1}`}
          />
        ))}
      </div>

      {/* Bottom Fade */}
      <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-[#050505] to-transparent z-20 pointer-events-none"></div>
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
