import { useEffect, useState } from 'react';
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
  Shirt,
  ArrowRight,
  History,
  Wand2,
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
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { useAuthStore } from '@/store/auth-store';
import { occasionApi, OccasionLook, OccasionMeta, Occasion, OccasionStylistRequest } from '@/lib/api';
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

export default function OccasionStylistPage() {
  const { toast } = useToast();
  useAuthStore(); // For potential future use

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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-sora font-bold flex items-center gap-2">
            <Wand2 className="w-6 h-6 text-gold" />
            Occasion Stylist
          </h1>
          <p className="text-muted-foreground">
            AI-powered outfit suggestions for any occasion
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
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>Budget-friendly</span>
                <span>Premium</span>
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
                Style Preference
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

              {/* Gender */}
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
              <p className="text-sm text-muted-foreground mt-3">
                Selected: {colorPreferences.length}/3
              </p>
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
        /* Results View */
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

          {/* Generated Looks */}
          <div className="grid gap-6 md:grid-cols-2">
            <AnimatePresence mode="popLayout">
              {generatedLooks.map((look, index) => (
                <motion.div
                  key={look.id}
                  layout
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ delay: index * 0.1 }}
                >
                  <Card className="overflow-hidden h-full">
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between">
                        <div>
                          <span className="text-gold text-sm font-medium">
                            Look #{look.rank}
                          </span>
                          <CardTitle className="text-xl">{look.name}</CardTitle>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="icon"
                            variant={look.is_saved ? 'default' : 'outline'}
                            onClick={() => handleSaveLook(look)}
                            disabled={look.is_saved}
                            className={look.is_saved ? 'bg-gold' : ''}
                          >
                            <Heart
                              className={cn('w-4 h-4', look.is_saved && 'fill-current')}
                            />
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <p className="text-muted-foreground text-sm">
                        {look.description}
                      </p>

                      {/* Items List */}
                      <div className="space-y-2">
                        {look.items.map((item, itemIndex) => (
                          <div
                            key={itemIndex}
                            className="flex items-center gap-3 p-3 bg-charcoal rounded-lg"
                          >
                            <div className="w-10 h-10 rounded-lg bg-gold/10 flex items-center justify-center">
                              <Shirt className="w-5 h-5 text-gold" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium truncate">{item.title}</p>
                              <p className="text-sm text-muted-foreground">
                                {item.brand} • {formatPrice(item.price)}
                              </p>
                            </div>
                            {item.buy_links && item.buy_links.length > 0 && (
                              <div className="flex gap-1">
                                {item.buy_links.slice(0, 2).map((link, linkIndex) => (
                                  <Button
                                    key={linkIndex}
                                    size="sm"
                                    variant="ghost"
                                    asChild
                                    className="text-xs px-2"
                                  >
                                    <a
                                      href={link.url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                    >
                                      {link.store}
                                    </a>
                                  </Button>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>

                      {/* Total & Actions */}
                      <div className="pt-4 border-t border-border">
                        <div className="flex items-center justify-between mb-3">
                          <div>
                            <p className="text-sm text-muted-foreground">Total Estimate</p>
                            <p className="text-2xl font-bold text-gold">
                              {formatPrice(look.total_price)}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm text-muted-foreground">Palette Match</p>
                            <div className="flex items-center gap-2">
                              <Progress value={look.palette_match} className="w-20 h-2" />
                              <span className="text-sm font-medium">{look.palette_match}%</span>
                            </div>
                          </div>
                        </div>

                        {/* Rating */}
                        <div className="flex items-center justify-between">
                          <p className="text-sm text-muted-foreground">Rate this look:</p>
                          <div className="flex gap-1">
                            {[1, 2, 3, 4, 5].map((rating) => (
                              <button
                                key={rating}
                                onClick={() => handleRateLook(look, rating)}
                                className={cn(
                                  'p-1 transition-colors',
                                  (look.user_rating || 0) >= rating
                                    ? 'text-gold'
                                    : 'text-muted-foreground hover:text-gold'
                                )}
                              >
                                <Star
                                  className={cn(
                                    'w-5 h-5',
                                    (look.user_rating || 0) >= rating && 'fill-current'
                                  )}
                                />
                              </button>
                            ))}
                          </div>
                        </div>
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
              View your past occasion stylist requests
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
    </div>
  );
}
