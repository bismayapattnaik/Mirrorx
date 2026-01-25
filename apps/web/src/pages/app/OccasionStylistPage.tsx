import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles,
  Calendar,
  Wallet,
  Palette,
  ChevronRight,
  Star,
  Heart,
  RefreshCw,
  IndianRupee,
  ArrowRight,
  History,
  Wand2,
  Camera,
  Download,
  X,
  ExternalLink,
  Loader2,
  ShoppingBag,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { useAuthStore } from '@/store/auth-store';
import { occasionApi, tryOnApi, OccasionLook, OccasionMeta, Occasion, OccasionStylistRequest, OccasionLookItem } from '@/lib/api';
import { cn } from '@/lib/utils';

const STYLE_LEVELS = [
  { value: 0, label: 'Modest', description: 'Conservative and subtle' },
  { value: 50, label: 'Balanced', description: 'Versatile and modern' },
  { value: 100, label: 'Bold', description: 'Fashion-forward statement' },
];

const COLOR_OPTIONS = [
  { value: 'neutral', label: 'Neutrals', colors: ['#F5F5F5', '#D3D3D3', '#808080', '#2F2F2F', '#000000'] },
  { value: 'warm', label: 'Warm Tones', colors: ['#FF6B6B', '#FFA07A', '#FFD700', '#FF8C00', '#8B4513'] },
  { value: 'cool', label: 'Cool Tones', colors: ['#4169E1', '#6A5ACD', '#20B2AA', '#5F9EA0', '#708090'] },
  { value: 'pastel', label: 'Pastels', colors: ['#FFB6C1', '#DDA0DD', '#B0E0E6', '#98FB98', '#FFFACD'] },
  { value: 'jewel', label: 'Jewel Tones', colors: ['#800020', '#2E8B57', '#4B0082', '#DAA520', '#191970'] },
  { value: 'earth', label: 'Earth Tones', colors: ['#8B7355', '#6B8E23', '#BC8F8F', '#CD853F', '#A0522D'] },
];

// Placeholder images by item type
const PLACEHOLDER_IMAGES: Record<string, string> = {
  top: 'https://images.unsplash.com/photo-1562157873-818bc0726f68?w=300&h=400&fit=crop',
  bottom: 'https://images.unsplash.com/photo-1541099649105-f69ad21f3246?w=300&h=400&fit=crop',
  footwear: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=300&h=400&fit=crop',
  accessory: 'https://images.unsplash.com/photo-1523170335258-f5ed11844a49?w=300&h=400&fit=crop',
  outerwear: 'https://images.unsplash.com/photo-1551028719-00167b16eac5?w=300&h=400&fit=crop',
};

export default function OccasionStylistPage() {
  const { toast } = useToast();
  const navigate = useNavigate();
  useAuthStore();

  const [occasions, setOccasions] = useState<OccasionMeta[]>([]);
  const [selectedOccasion, setSelectedOccasion] = useState<Occasion | null>(null);
  const [budgetMin, setBudgetMin] = useState(2000);
  const [budgetMax, setBudgetMax] = useState(15000);
  const [styleSlider, setStyleSlider] = useState(50);
  const [colorPreferences, setColorPreferences] = useState<string[]>([]);
  const [gender, setGender] = useState<'male' | 'female'>('female');

  // Results
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedLooks, setGeneratedLooks] = useState<OccasionLook[]>([]);
  const [currentRequestId, setCurrentRequestId] = useState<string | null>(null);

  // History
  const [showHistory, setShowHistory] = useState(false);
  const [historyRequests, setHistoryRequests] = useState<OccasionStylistRequest[]>([]);

  // Product images cache
  const [productImages, setProductImages] = useState<Record<string, string>>({});
  const [loadingImages, setLoadingImages] = useState<Set<string>>(new Set());

  // Try-on preview
  const [showTryOnDialog, setShowTryOnDialog] = useState(false);
  const [tryOnResult, setTryOnResult] = useState<string | null>(null);
  const [isTryingOn, setIsTryingOn] = useState(false);
  const [tryOnItem, setTryOnItem] = useState<OccasionLookItem | null>(null);
  const [hasSavedSelfie, setHasSavedSelfie] = useState(false);

  // Full look try-on
  const [tryOnLook, setTryOnLook] = useState<OccasionLook | null>(null);
  const [isFullLookTryOn, setIsFullLookTryOn] = useState(false);

  // Fetch occasions
  useEffect(() => {
    async function fetchOccasions() {
      try {
        const response = await occasionApi.getOccasions();
        setOccasions(response.occasions);
      } catch {
        toast({
          variant: 'destructive',
          title: 'Failed to load occasions',
        });
      }
    }
    fetchOccasions();
  }, [toast]);

  // Fetch history
  useEffect(() => {
    async function fetchHistory() {
      try {
        const response = await occasionApi.list();
        setHistoryRequests(response.requests);
      } catch {
        // Silent fail for history
      }
    }
    fetchHistory();
  }, []);

  // Check if user has a saved selfie
  useEffect(() => {
    async function checkSelfie() {
      try {
        const response = await tryOnApi.getSavedSelfie();
        setHasSavedSelfie(response.has_selfie);
      } catch {
        // Silent fail
      }
    }
    checkSelfie();
  }, []);

  // Fetch product image for an item
  const fetchProductImage = useCallback(async (item: OccasionLookItem, lookId: string, itemIndex: number) => {
    const cacheKey = `${lookId}_${itemIndex}`;

    if (productImages[cacheKey] || loadingImages.has(cacheKey)) {
      return;
    }

    setLoadingImages(prev => new Set(prev).add(cacheKey));

    try {
      const buyLink = item.buy_links?.[0]?.url;
      if (buyLink) {
        const response = await occasionApi.fetchProductImage(buyLink, item.type, gender);
        if (response.image_url) {
          setProductImages(prev => ({ ...prev, [cacheKey]: response.image_url }));
        }
      }
    } catch {
      // Use placeholder on error
      setProductImages(prev => ({
        ...prev,
        [cacheKey]: PLACEHOLDER_IMAGES[item.type] || PLACEHOLDER_IMAGES.top
      }));
    } finally {
      setLoadingImages(prev => {
        const newSet = new Set(prev);
        newSet.delete(cacheKey);
        return newSet;
      });
    }
  }, [productImages, loadingImages, gender]);

  // Fetch images when looks are generated
  useEffect(() => {
    if (generatedLooks.length > 0) {
      generatedLooks.forEach(look => {
        look.items.forEach((item, index) => {
          fetchProductImage(item, look.id, index);
        });
      });
    }
  }, [generatedLooks, fetchProductImage]);

  const handleGenerate = async () => {
    if (!selectedOccasion) {
      toast({
        variant: 'destructive',
        title: 'Select an occasion',
        description: 'Please select an occasion to get outfit suggestions.',
      });
      return;
    }

    setIsGenerating(true);
    setProductImages({}); // Clear image cache for new generation

    try {
      const response = await occasionApi.generate({
        occasion: selectedOccasion,
        budget_min: budgetMin,
        budget_max: budgetMax,
        style_slider: styleSlider,
        color_preferences: colorPreferences,
        use_style_dna: true,
        gender,
      });

      setGeneratedLooks(response.looks);
      setCurrentRequestId(response.request_id);
      toast({
        title: 'Looks generated!',
        description: `${response.looks.length} outfit suggestions ready for you.`,
      });
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Generation failed',
        description: error.message || 'Please try again.',
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleRateLook = async (look: OccasionLook, rating: number) => {
    if (!currentRequestId) return;

    try {
      await occasionApi.submitFeedback(currentRequestId, look.id, rating);
      setGeneratedLooks(
        generatedLooks.map((l) =>
          l.id === look.id ? { ...l, user_rating: rating } : l
        )
      );
      toast({
        title: 'Thanks for the feedback!',
        description: 'This helps us improve your recommendations.',
      });
    } catch {
      toast({
        variant: 'destructive',
        title: 'Failed to save rating',
      });
    }
  };

  const handleSaveLook = async (look: OccasionLook) => {
    if (!currentRequestId) return;

    try {
      await occasionApi.submitFeedback(currentRequestId, look.id, undefined, true);
      setGeneratedLooks(
        generatedLooks.map((l) =>
          l.id === look.id ? { ...l, is_saved: true } : l
        )
      );
      toast({
        title: 'Look saved!',
        description: 'Added to your saved looks.',
      });
    } catch {
      toast({
        variant: 'destructive',
        title: 'Failed to save look',
      });
    }
  };

  const handleTryOn = async (item: OccasionLookItem) => {
    if (!hasSavedSelfie) {
      toast({
        title: 'No saved photo',
        description: 'Please upload a photo in the Try-On feature first.',
        action: (
          <Button size="sm" onClick={() => navigate('/app/tryon')}>
            Go to Try-On
          </Button>
        ),
      });
      return;
    }

    const buyLink = item.buy_links?.[0]?.url;
    if (!buyLink) {
      toast({
        variant: 'destructive',
        title: 'No product link available',
      });
      return;
    }

    setTryOnItem(item);
    setShowTryOnDialog(true);
    setIsTryingOn(true);
    setTryOnResult(null);

    try {
      const response = await tryOnApi.quickTryOnFromUrl(buyLink, 'PART', gender);
      if (response.result_image_url) {
        setTryOnResult(response.result_image_url);
      } else {
        throw new Error('No result image generated');
      }
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Try-on failed',
        description: error.message || 'Could not generate preview.',
      });
      setShowTryOnDialog(false);
    } finally {
      setIsTryingOn(false);
    }
  };

  // Try on the complete look (full outfit)
  const handleTryCompleteLook = async (look: OccasionLook) => {
    if (!hasSavedSelfie) {
      toast({
        title: 'No saved photo',
        description: 'Please upload a photo in the Try-On feature first.',
        action: (
          <Button size="sm" onClick={() => navigate('/app/tryon')}>
            Go to Try-On
          </Button>
        ),
      });
      return;
    }

    // Get the top item (shirt/blouse) for the try-on - this works best with FULL_FIT mode
    const topItem = look.items.find(item => item.type === 'top');
    const buyLink = topItem?.buy_links?.[0]?.url;

    if (!buyLink) {
      toast({
        variant: 'destructive',
        title: 'No product available',
        description: 'Could not find a product to try on.',
      });
      return;
    }

    setTryOnLook(look);
    setTryOnItem(topItem || null);
    setIsFullLookTryOn(true);
    setShowTryOnDialog(true);
    setIsTryingOn(true);
    setTryOnResult(null);

    try {
      // Use FULL_FIT mode for complete outfit visualization
      const response = await tryOnApi.quickTryOnFromUrl(buyLink, 'FULL_FIT', gender);
      if (response.result_image_url) {
        setTryOnResult(response.result_image_url);
      } else {
        throw new Error('No result image generated');
      }
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Try-on failed',
        description: error.message || 'Could not generate preview.',
      });
      setShowTryOnDialog(false);
    } finally {
      setIsTryingOn(false);
    }
  };

  const toggleColorPref = (color: string) => {
    if (colorPreferences.includes(color)) {
      setColorPreferences(colorPreferences.filter((c) => c !== color));
    } else if (colorPreferences.length < 3) {
      setColorPreferences([...colorPreferences, color]);
    } else {
      toast({
        title: 'Maximum 3 colors',
        description: 'Remove a color preference first.',
      });
    }
  };

  const formatPrice = (price: number | null) => {
    if (price === null) return '-';
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(price);
  };

  const getOccasionIcon = (occasionId: string) => {
    const occasion = occasions.find((o) => o.id === occasionId);
    return occasion?.icon || '✨';
  };

  const getItemImage = (lookId: string, itemIndex: number, itemType: string) => {
    const cacheKey = `${lookId}_${itemIndex}`;
    return productImages[cacheKey] || PLACEHOLDER_IMAGES[itemType] || PLACEHOLDER_IMAGES.top;
  };

  const isImageLoading = (lookId: string, itemIndex: number) => {
    return loadingImages.has(`${lookId}_${itemIndex}`);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-sora font-bold flex items-center gap-2">
            <Wand2 className="w-6 h-6 text-gold" />
            AI Stylist
          </h1>
          <p className="text-muted-foreground">
            Get personalized outfit suggestions with try-on preview
          </p>
        </div>
        <Button variant="outline" onClick={() => setShowHistory(true)}>
          <History className="w-4 h-4 mr-2" />
          History
        </Button>
      </div>

      {generatedLooks.length === 0 ? (
        /* Configuration Form */
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Occasion Selection */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-gold" />
                Select Occasion
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                {occasions.map((occasion) => (
                  <button
                    key={occasion.id}
                    onClick={() => setSelectedOccasion(occasion.id as Occasion)}
                    className={cn(
                      'p-4 rounded-xl border-2 transition-all text-center',
                      selectedOccasion === occasion.id
                        ? 'border-gold bg-gold/10'
                        : 'border-border hover:border-gold/50 bg-charcoal'
                    )}
                  >
                    <span className="text-3xl block mb-2">{occasion.icon}</span>
                    <span className="text-sm font-medium">{occasion.name}</span>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Budget Range */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Wallet className="w-5 h-5 text-gold" />
                Budget Range
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-4">
                <div className="flex-1 space-y-2">
                  <Label htmlFor="budget-min">Minimum</Label>
                  <div className="relative">
                    <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="budget-min"
                      type="number"
                      value={budgetMin}
                      onChange={(e) => setBudgetMin(parseInt(e.target.value) || 0)}
                      className="pl-9"
                    />
                  </div>
                </div>
                <div className="flex-1 space-y-2">
                  <Label htmlFor="budget-max">Maximum</Label>
                  <div className="relative">
                    <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="budget-max"
                      type="number"
                      value={budgetMax}
                      onChange={(e) => setBudgetMax(parseInt(e.target.value) || 0)}
                      className="pl-9"
                    />
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                {[5000, 10000, 20000, 50000].map((amount) => (
                  <button
                    key={amount}
                    onClick={() => {
                      setBudgetMin(Math.round(amount * 0.4));
                      setBudgetMax(amount);
                    }}
                    className={cn(
                      'flex-1 py-2 rounded-lg text-sm transition-colors',
                      budgetMax === amount
                        ? 'bg-gold text-white'
                        : 'bg-charcoal text-muted-foreground hover:bg-charcoal-light'
                    )}
                  >
                    {formatPrice(amount)}
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Style Preference */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-gold" />
                Style & Gender
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={styleSlider}
                  onChange={(e) => setStyleSlider(parseInt(e.target.value))}
                  className="w-full accent-gold"
                />
                <div className="flex justify-between">
                  {STYLE_LEVELS.map((level) => (
                    <button
                      key={level.value}
                      onClick={() => setStyleSlider(level.value)}
                      className={cn(
                        'text-center px-2 py-1 rounded transition-colors',
                        Math.abs(styleSlider - level.value) < 20
                          ? 'text-gold'
                          : 'text-muted-foreground'
                      )}
                    >
                      <p className="font-medium text-sm">{level.label}</p>
                      <p className="text-xs">{level.description}</p>
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-4 border-t border-border">
                <Label className="mb-2 block">Gender</Label>
                <div className="flex gap-3">
                  <button
                    onClick={() => setGender('female')}
                    className={cn(
                      'flex-1 py-3 rounded-lg border-2 transition-all',
                      gender === 'female'
                        ? 'border-gold bg-gold/10'
                        : 'border-border hover:border-gold/50'
                    )}
                  >
                    Female
                  </button>
                  <button
                    onClick={() => setGender('male')}
                    className={cn(
                      'flex-1 py-3 rounded-lg border-2 transition-all',
                      gender === 'male'
                        ? 'border-gold bg-gold/10'
                        : 'border-border hover:border-gold/50'
                    )}
                  >
                    Male
                  </button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Color Preferences */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Palette className="w-5 h-5 text-gold" />
                Color Preferences (optional)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                {COLOR_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => toggleColorPref(option.value)}
                    className={cn(
                      'p-3 rounded-xl border-2 transition-all',
                      colorPreferences.includes(option.value)
                        ? 'border-gold bg-gold/10'
                        : 'border-border hover:border-gold/50'
                    )}
                  >
                    <div className="flex gap-1 mb-2 justify-center">
                      {option.colors.map((color, i) => (
                        <div
                          key={i}
                          className="w-4 h-4 rounded-full border border-white/20"
                          style={{ backgroundColor: color }}
                        />
                      ))}
                    </div>
                    <span className="text-sm font-medium">{option.label}</span>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Generate Button */}
          <div className="lg:col-span-2">
            <Button
              size="lg"
              className="w-full bg-gold hover:bg-gold/90 h-14 text-lg"
              onClick={handleGenerate}
              disabled={isGenerating || !selectedOccasion}
            >
              {isGenerating ? (
                <>
                  <RefreshCw className="w-5 h-5 mr-2 animate-spin" />
                  Generating Outfits...
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5 mr-2" />
                  Generate Outfit Suggestions
                  <ArrowRight className="w-5 h-5 ml-2" />
                </>
              )}
            </Button>
          </div>
        </div>
      ) : (
        /* Results View - Visual Cards */
        <div className="space-y-6">
          {/* Back & Info */}
          <div className="flex items-center justify-between">
            <Button variant="ghost" onClick={() => setGeneratedLooks([])}>
              <ChevronRight className="w-4 h-4 mr-2 rotate-180" />
              New Search
            </Button>
            <div className="text-sm text-muted-foreground">
              {getOccasionIcon(selectedOccasion || '')} {selectedOccasion?.replace('_', ' ')} • {formatPrice(budgetMin)} - {formatPrice(budgetMax)}
            </div>
          </div>

          {/* Generated Looks - Visual Layout */}
          <div className="space-y-8">
            <AnimatePresence mode="popLayout">
              {generatedLooks.map((look, lookIndex) => (
                <motion.div
                  key={look.id}
                  layout
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ delay: lookIndex * 0.1 }}
                >
                  <Card className="overflow-hidden">
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between">
                        <div>
                          <span className="text-gold text-sm font-medium">
                            Look #{look.rank}
                          </span>
                          <CardTitle className="text-xl">{look.name}</CardTitle>
                          <p className="text-muted-foreground text-sm mt-1">
                            {look.description}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="icon"
                            variant={look.is_saved ? 'default' : 'outline'}
                            onClick={() => handleSaveLook(look)}
                            disabled={look.is_saved}
                            className={look.is_saved ? 'bg-gold' : ''}
                          >
                            <Heart className={cn('w-4 h-4', look.is_saved && 'fill-current')} />
                          </Button>
                        </div>
                      </div>
                    </CardHeader>

                    <CardContent className="space-y-4">
                      {/* Try Complete Look Button */}
                      <div className="flex justify-center">
                        <Button
                          size="lg"
                          className="bg-gradient-to-r from-gold to-amber-500 hover:from-gold/90 hover:to-amber-500/90 text-black font-semibold px-8"
                          onClick={() => handleTryCompleteLook(look)}
                        >
                          <Camera className="w-5 h-5 mr-2" />
                          Try This Look On Me
                        </Button>
                      </div>

                      {/* Visual Product Grid */}
                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                        {look.items.map((item, itemIndex) => (
                          <div
                            key={itemIndex}
                            className="group relative bg-charcoal rounded-xl overflow-hidden border border-border hover:border-gold/50 transition-all"
                          >
                            {/* Product Image */}
                            <div className="aspect-[3/4] relative overflow-hidden bg-charcoal-light">
                              {isImageLoading(look.id, itemIndex) ? (
                                <div className="absolute inset-0 flex items-center justify-center">
                                  <Loader2 className="w-6 h-6 text-gold animate-spin" />
                                </div>
                              ) : (
                                <img
                                  src={getItemImage(look.id, itemIndex, item.type)}
                                  alt={item.title}
                                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                  loading="lazy"
                                />
                              )}

                              {/* Quick Actions Overlay */}
                              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                                <div className="absolute bottom-2 left-2 right-2 flex gap-2">
                                  <Button
                                    size="sm"
                                    className="flex-1 bg-gold hover:bg-gold/90 text-xs h-8"
                                    onClick={() => handleTryOn(item)}
                                  >
                                    <Camera className="w-3 h-3 mr-1" />
                                    Try On
                                  </Button>
                                  {item.buy_links?.[0] && (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="h-8 px-2"
                                      asChild
                                    >
                                      <a
                                        href={item.buy_links[0].url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                      >
                                        <ExternalLink className="w-3 h-3" />
                                      </a>
                                    </Button>
                                  )}
                                </div>
                              </div>

                              {/* Item Type Badge */}
                              <div className="absolute top-2 left-2">
                                <span className="px-2 py-1 bg-black/60 rounded-full text-xs capitalize">
                                  {item.type}
                                </span>
                              </div>
                            </div>

                            {/* Product Info */}
                            <div className="p-3">
                              <p className="font-medium text-sm truncate" title={item.title}>
                                {item.title}
                              </p>
                              <p className="text-xs text-muted-foreground truncate">
                                {item.brand}
                              </p>
                              <p className="text-gold font-semibold mt-1">
                                {formatPrice(item.price)}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Look Summary */}
                      <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-border">
                        <div className="flex items-center gap-6">
                          <div>
                            <p className="text-xs text-muted-foreground">Total</p>
                            <p className="text-xl font-bold text-gold">
                              {formatPrice(look.total_price)}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Match</p>
                            <div className="flex items-center gap-2">
                              <Progress value={look.palette_match} className="w-16 h-2" />
                              <span className="text-sm font-medium">{look.palette_match}%</span>
                            </div>
                          </div>
                        </div>

                        {/* Rating */}
                        <div className="flex items-center gap-2">
                          <p className="text-xs text-muted-foreground">Rate:</p>
                          <div className="flex gap-1">
                            {[1, 2, 3, 4, 5].map((rating) => (
                              <button
                                key={rating}
                                onClick={() => handleRateLook(look, rating)}
                                className={cn(
                                  'p-0.5 transition-colors',
                                  (look.user_rating || 0) >= rating
                                    ? 'text-gold'
                                    : 'text-muted-foreground hover:text-gold'
                                )}
                              >
                                <Star
                                  className={cn(
                                    'w-4 h-4',
                                    (look.user_rating || 0) >= rating && 'fill-current'
                                  )}
                                />
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Shop All Button */}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            // Open all buy links in new tabs
                            look.items.forEach((item) => {
                              if (item.buy_links?.[0]?.url) {
                                window.open(item.buy_links[0].url, '_blank');
                              }
                            });
                          }}
                        >
                          <ShoppingBag className="w-4 h-4 mr-2" />
                          Shop All Items
                        </Button>
                      </div>

                      {/* Rationale */}
                      <div className="p-3 bg-gold/5 rounded-lg border border-gold/20">
                        <p className="text-sm text-muted-foreground">
                          <span className="text-gold font-medium">Why this works: </span>
                          {look.rationale}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          {/* Regenerate */}
          <div className="text-center">
            <Button
              variant="outline"
              onClick={handleGenerate}
              disabled={isGenerating}
            >
              <RefreshCw className={cn('w-4 h-4 mr-2', isGenerating && 'animate-spin')} />
              Generate More Options
            </Button>
          </div>
        </div>
      )}

      {/* History Dialog */}
      <Dialog open={showHistory} onOpenChange={setShowHistory}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="w-5 h-5" />
              Previous Searches
            </DialogTitle>
            <DialogDescription>
              View your past stylist requests
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 max-h-96 overflow-y-auto">
            {historyRequests.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                No previous searches yet
              </p>
            ) : (
              historyRequests.map((request) => (
                <Card
                  key={request.id}
                  className="cursor-pointer hover:ring-1 hover:ring-gold/50 transition-all"
                  onClick={async () => {
                    try {
                      const fullRequest = await occasionApi.get(request.id);
                      if (fullRequest.looks) {
                        setGeneratedLooks(fullRequest.looks);
                        setSelectedOccasion(fullRequest.occasion);
                        setCurrentRequestId(fullRequest.id);
                        setShowHistory(false);
                      }
                    } catch {
                      toast({
                        variant: 'destructive',
                        title: 'Failed to load request',
                      });
                    }
                  }}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">
                          {getOccasionIcon(request.occasion)}
                        </span>
                        <div>
                          <p className="font-medium capitalize">
                            {request.occasion.replace('_', ' ')}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {formatPrice(request.budget_min)} - {formatPrice(request.budget_max)}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-muted-foreground">
                          {request.looks_count || 0} looks
                        </p>
                        <ChevronRight className="w-4 h-4 text-muted-foreground" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Try-On Preview Dialog */}
      <Dialog open={showTryOnDialog} onOpenChange={(open) => {
        setShowTryOnDialog(open);
        if (!open) {
          setIsFullLookTryOn(false);
          setTryOnLook(null);
        }
      }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Camera className="w-5 h-5 text-gold" />
              {isFullLookTryOn ? 'Complete Look Preview' : 'Try-On Preview'}
            </DialogTitle>
            <DialogDescription>
              {isFullLookTryOn && tryOnLook
                ? `See how "${tryOnLook.name}" looks on you`
                : tryOnItem
                ? `See how "${tryOnItem.title}" looks on you`
                : 'Virtual try-on result'}
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col items-center py-4">
            {isTryingOn ? (
              <div className="flex flex-col items-center justify-center h-64 space-y-4">
                <RefreshCw className="w-8 h-8 text-gold animate-spin" />
                <p className="text-muted-foreground">
                  {isFullLookTryOn ? 'Creating your complete look...' : 'Generating try-on preview...'}
                </p>
                <p className="text-xs text-muted-foreground">This may take a moment</p>
              </div>
            ) : tryOnResult ? (
              <div className="space-y-4 w-full">
                <div className="relative rounded-lg overflow-hidden bg-charcoal">
                  <img
                    src={tryOnResult}
                    alt="Try-on result"
                    className="w-full h-auto max-h-96 object-contain"
                  />
                </div>

                {/* Full Look Details */}
                {isFullLookTryOn && tryOnLook ? (
                  <div className="p-3 bg-charcoal rounded-lg space-y-2">
                    <p className="font-medium text-gold">{tryOnLook.name}</p>
                    <div className="text-sm text-muted-foreground space-y-1">
                      {tryOnLook.items.map((item, idx) => (
                        <div key={idx} className="flex justify-between">
                          <span className="capitalize">{item.type}: {item.title}</span>
                          <span className="text-gold">{formatPrice(item.price)}</span>
                        </div>
                      ))}
                    </div>
                    <div className="pt-2 border-t border-border flex justify-between font-semibold">
                      <span>Total</span>
                      <span className="text-gold">{formatPrice(tryOnLook.total_price)}</span>
                    </div>
                  </div>
                ) : tryOnItem && (
                  <div className="p-3 bg-charcoal rounded-lg">
                    <p className="font-medium">{tryOnItem.title}</p>
                    <p className="text-sm text-muted-foreground">
                      {tryOnItem.brand} • {formatPrice(tryOnItem.price)}
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-64">
                <X className="w-8 h-8 text-muted-foreground" />
                <p className="text-muted-foreground mt-2">No preview available</p>
              </div>
            )}
          </div>

          <DialogFooter className="flex gap-2">
            {tryOnResult && (
              <Button
                variant="outline"
                onClick={() => {
                  const link = document.createElement('a');
                  link.href = tryOnResult;
                  link.download = `tryon-${isFullLookTryOn ? tryOnLook?.name : tryOnItem?.title || 'preview'}.png`;
                  link.click();
                }}
              >
                <Download className="w-4 h-4 mr-2" />
                Save Image
              </Button>
            )}
            {isFullLookTryOn && tryOnLook && tryOnResult ? (
              <Button
                className="bg-gold hover:bg-gold/90"
                onClick={() => {
                  tryOnLook.items.forEach((item) => {
                    if (item.buy_links?.[0]?.url) {
                      window.open(item.buy_links[0].url, '_blank');
                    }
                  });
                }}
              >
                <ShoppingBag className="w-4 h-4 mr-2" />
                Shop Complete Look
              </Button>
            ) : tryOnItem?.buy_links?.[0] && tryOnResult && (
              <Button className="bg-gold hover:bg-gold/90" asChild>
                <a
                  href={tryOnItem.buy_links[0].url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Buy from {tryOnItem.buy_links[0].store}
                </a>
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
