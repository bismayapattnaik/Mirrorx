import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Upload,
  Camera,
  Sparkles,
  Palette,
  User,
  TrendingUp,
  ShoppingBag,
  ExternalLink,
  Ruler,
  RefreshCw,
  Check,
  ChevronRight,
  Star,
  Shirt,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { tailorApi, ProfileAnalysis, StyleRecommendation, SizeRecommendation } from '@/lib/api';
import { cn, fileToBase64, isValidImageFile } from '@/lib/utils';

type Gender = 'male' | 'female';

export default function AiTailorPage() {
  const { toast } = useToast();

  // Profile state
  const [profilePhoto, setProfilePhoto] = useState<string | null>(null);
  const [gender, setGender] = useState<Gender>('female');
  const [profile, setProfile] = useState<ProfileAnalysis | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // Recommendations state
  const [recommendations, setRecommendations] = useState<StyleRecommendation[]>([]);
  const [isLoadingRecs, setIsLoadingRecs] = useState(false);
  const [selectedOccasion, setSelectedOccasion] = useState<string>('');
  const [selectedSeason, setSelectedSeason] = useState<string>('');

  // Size recommendation state
  const [sizePhoto, setSizePhoto] = useState<string | null>(null);
  const [productCategory, setProductCategory] = useState<string>('topwear');
  const [height, setHeight] = useState<string>('');
  const [weight, setWeight] = useState<string>('');
  const [sizeRec, setSizeRec] = useState<SizeRecommendation | null>(null);
  const [isLoadingSize, setIsLoadingSize] = useState(false);

  // Trending state
  const [trends, setTrends] = useState<Array<{
    name: string;
    description: string;
    keyPieces: string[];
    celebrities: string[];
    howToWear: string;
  }>>([]);
  const [trendingRecs, setTrendingRecs] = useState<StyleRecommendation[]>([]);
  const [isLoadingTrending, setIsLoadingTrending] = useState(false);

  // Handle profile photo upload
  const handleProfilePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !isValidImageFile(file)) {
      toast({
        variant: 'destructive',
        title: 'Invalid file',
        description: 'Please upload a JPEG, PNG, or WebP image.',
      });
      return;
    }

    const base64 = await fileToBase64(file);
    setProfilePhoto(base64);
  };

  // Analyze profile
  const handleAnalyzeProfile = async () => {
    if (!profilePhoto) {
      toast({
        variant: 'destructive',
        title: 'Photo required',
        description: 'Please upload your photo first.',
      });
      return;
    }

    setIsAnalyzing(true);
    try {
      const result = await tailorApi.analyzeProfile(profilePhoto, gender);
      setProfile(result.profile);
      toast({
        title: 'Profile analyzed!',
        description: 'Your personal style profile is ready.',
      });
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Analysis failed',
        description: error.message || 'Please try again.',
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Get recommendations
  const handleGetRecommendations = async () => {
    if (!profile) {
      toast({
        variant: 'destructive',
        title: 'Profile required',
        description: 'Please analyze your profile first.',
      });
      return;
    }

    setIsLoadingRecs(true);
    try {
      const result = await tailorApi.getRecommendations(
        selectedOccasion || undefined,
        selectedSeason || undefined
      );
      setRecommendations(result.recommendations);
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Failed to get recommendations',
        description: error.message || 'Please try again.',
      });
    } finally {
      setIsLoadingRecs(false);
    }
  };

  // Handle size photo upload
  const handleSizePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !isValidImageFile(file)) {
      toast({
        variant: 'destructive',
        title: 'Invalid file',
        description: 'Please upload a JPEG, PNG, or WebP image.',
      });
      return;
    }

    const base64 = await fileToBase64(file);
    setSizePhoto(base64);
  };

  // Get size recommendation
  const handleGetSizeRec = async () => {
    if (!sizePhoto) {
      toast({
        variant: 'destructive',
        title: 'Photo required',
        description: 'Please upload a full-body photo for size recommendation.',
      });
      return;
    }

    setIsLoadingSize(true);
    try {
      const result = await tailorApi.getSizeRecommendation(
        sizePhoto,
        productCategory,
        height ? parseInt(height) : undefined,
        weight ? parseInt(weight) : undefined
      );
      setSizeRec(result.sizeRecommendation);
      toast({
        title: 'Size recommendation ready!',
        description: result.basedOnPastFeedback
          ? 'Personalized based on your past feedback.'
          : 'Based on your photo analysis.',
      });
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Size recommendation failed',
        description: error.message || 'Please try again.',
      });
    } finally {
      setIsLoadingSize(false);
    }
  };

  // Get trending outfits
  const handleGetTrending = async () => {
    setIsLoadingTrending(true);
    try {
      const result = await tailorApi.getTrending(
        selectedOccasion || undefined,
        selectedSeason || undefined
      );
      setTrends(result.trends);
      setTrendingRecs(result.recommendations);
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Failed to get trends',
        description: error.message || 'Please try again.',
      });
    } finally {
      setIsLoadingTrending(false);
    }
  };

  const occasions = ['Casual', 'Office', 'Party', 'Wedding', 'Date Night', 'Festival', 'Travel'];
  const seasons = ['Summer', 'Monsoon', 'Winter', 'All Season'];
  const categories = ['topwear', 'bottomwear', 'footwear', 'ethnic'];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-orbitron font-bold flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-gold" />
            AI Personal Tailor
          </h1>
          <p className="text-muted-foreground">
            Your personal stylist powered by AI
          </p>
        </div>
      </div>

      <Tabs defaultValue="profile" className="w-full">
        <TabsList className="w-full grid grid-cols-4 mb-6">
          <TabsTrigger value="profile" className="flex items-center gap-2">
            <User className="w-4 h-4" />
            Profile
          </TabsTrigger>
          <TabsTrigger value="recommendations" className="flex items-center gap-2">
            <Palette className="w-4 h-4" />
            Style
          </TabsTrigger>
          <TabsTrigger value="size" className="flex items-center gap-2">
            <Ruler className="w-4 h-4" />
            Size
          </TabsTrigger>
          <TabsTrigger value="trending" className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4" />
            Trending
          </TabsTrigger>
        </TabsList>

        {/* Profile Analysis Tab */}
        <TabsContent value="profile">
          <div className="grid lg:grid-cols-2 gap-6">
            {/* Photo Upload */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Camera className="w-5 h-5 text-gold" />
                  Upload Your Photo
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Gender Selection */}
                <div>
                  <Label className="mb-2 block">Select Gender</Label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => setGender('female')}
                      className={cn(
                        'p-3 rounded-xl border-2 transition-all text-center',
                        gender === 'female'
                          ? 'border-gold bg-gold/10'
                          : 'border-gold/20 hover:border-gold/40'
                      )}
                    >
                      <span className="text-xl">👩</span>
                      <div className="font-medium">Female</div>
                    </button>
                    <button
                      onClick={() => setGender('male')}
                      className={cn(
                        'p-3 rounded-xl border-2 transition-all text-center',
                        gender === 'male'
                          ? 'border-gold bg-gold/10'
                          : 'border-gold/20 hover:border-gold/40'
                      )}
                    >
                      <span className="text-xl">👨</span>
                      <div className="font-medium">Male</div>
                    </button>
                  </div>
                </div>

                {/* Photo Upload */}
                <div
                  className={cn(
                    'relative border-2 border-dashed rounded-xl p-6 text-center transition-all',
                    profilePhoto ? 'border-success' : 'border-gold/30 hover:border-gold/50'
                  )}
                >
                  {profilePhoto ? (
                    <div className="relative">
                      <img
                        src={profilePhoto}
                        alt="Your photo"
                        className="max-h-64 mx-auto rounded-lg"
                      />
                      <Button
                        size="icon"
                        variant="destructive"
                        className="absolute top-2 right-2"
                        onClick={() => setProfilePhoto(null)}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  ) : (
                    <>
                      <Upload className="w-10 h-10 mx-auto mb-3 text-muted-foreground" />
                      <p className="text-sm text-muted-foreground mb-3">
                        Upload a clear photo of yourself
                      </p>
                      <label>
                        <Button variant="outline" asChild>
                          <span>Choose Photo</span>
                        </Button>
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          className="hidden"
                          onChange={handleProfilePhotoSelect}
                        />
                      </label>
                    </>
                  )}
                </div>

                <Button
                  className="w-full"
                  onClick={handleAnalyzeProfile}
                  disabled={!profilePhoto || isAnalyzing}
                >
                  {isAnalyzing ? (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                      Analyzing...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 mr-2" />
                      Analyze My Style Profile
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>

            {/* Profile Results */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Palette className="w-5 h-5 text-gold" />
                  Your Style Profile
                </CardTitle>
              </CardHeader>
              <CardContent>
                {profile ? (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-4"
                  >
                    {/* Skin Tone */}
                    <div className="p-4 bg-charcoal rounded-xl">
                      <h4 className="font-semibold mb-2">Skin Tone Analysis</h4>
                      <p className="text-sm text-muted-foreground">
                        <span className="text-gold capitalize">{profile.skinTone.tone}</span> with{' '}
                        <span className="text-gold">{profile.skinTone.undertone}</span> undertone
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {profile.skinTone.description}
                      </p>
                    </div>

                    {/* Body & Style */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="p-3 bg-charcoal rounded-xl">
                        <p className="text-xs text-muted-foreground">Face Shape</p>
                        <p className="font-medium capitalize">{profile.faceShape}</p>
                      </div>
                      <div className="p-3 bg-charcoal rounded-xl">
                        <p className="text-xs text-muted-foreground">Body Type</p>
                        <p className="font-medium capitalize">{profile.bodyType}</p>
                      </div>
                      <div className="p-3 bg-charcoal rounded-xl col-span-2">
                        <p className="text-xs text-muted-foreground">Style Personality</p>
                        <p className="font-medium capitalize">{profile.stylePersonality}</p>
                      </div>
                    </div>

                    {/* Color Palette */}
                    <div className="p-4 bg-charcoal rounded-xl">
                      <h4 className="font-semibold mb-3">Your Color Palette</h4>
                      <div className="space-y-3">
                        <div>
                          <p className="text-xs text-gold mb-1">Best Colors</p>
                          <div className="flex flex-wrap gap-2">
                            {profile.colorPalette.bestColors.map((color, i) => (
                              <span
                                key={i}
                                className="px-2 py-1 bg-gold/10 rounded text-xs"
                              >
                                {color}
                              </span>
                            ))}
                          </div>
                        </div>
                        <div>
                          <p className="text-xs text-red-400 mb-1">Avoid</p>
                          <div className="flex flex-wrap gap-2">
                            {profile.colorPalette.avoidColors.map((color, i) => (
                              <span
                                key={i}
                                className="px-2 py-1 bg-red-500/10 rounded text-xs"
                              >
                                {color}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ) : (
                  <div className="text-center py-12 text-muted-foreground">
                    <User className="w-12 h-12 mx-auto mb-4 opacity-30" />
                    <p>Upload your photo and analyze to see your style profile</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Style Recommendations Tab */}
        <TabsContent value="recommendations">
          <div className="space-y-6">
            {/* Filters */}
            <Card>
              <CardContent className="p-4">
                <div className="flex flex-wrap gap-4 items-end">
                  <div className="flex-1 min-w-[200px]">
                    <Label className="mb-2 block">Occasion</Label>
                    <div className="flex flex-wrap gap-2">
                      {occasions.map((occ) => (
                        <button
                          key={occ}
                          onClick={() => setSelectedOccasion(selectedOccasion === occ ? '' : occ)}
                          className={cn(
                            'px-3 py-1 rounded-full text-sm transition-all',
                            selectedOccasion === occ
                              ? 'bg-gold text-black'
                              : 'bg-charcoal hover:bg-charcoal/80'
                          )}
                        >
                          {occ}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <Label className="mb-2 block">Season</Label>
                    <div className="flex flex-wrap gap-2">
                      {seasons.map((season) => (
                        <button
                          key={season}
                          onClick={() => setSelectedSeason(selectedSeason === season ? '' : season)}
                          className={cn(
                            'px-3 py-1 rounded-full text-sm transition-all',
                            selectedSeason === season
                              ? 'bg-gold text-black'
                              : 'bg-charcoal hover:bg-charcoal/80'
                          )}
                        >
                          {season}
                        </button>
                      ))}
                    </div>
                  </div>
                  <Button onClick={handleGetRecommendations} disabled={isLoadingRecs || !profile}>
                    {isLoadingRecs ? (
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Sparkles className="w-4 h-4 mr-2" />
                    )}
                    Get Recommendations
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Recommendations Grid */}
            {recommendations.length > 0 ? (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {recommendations.map((rec, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                  >
                    <Card className="h-full hover:border-gold/50 transition-colors">
                      <CardContent className="p-4 space-y-3">
                        <div className="flex items-start justify-between">
                          <div>
                            <span className="px-2 py-0.5 bg-gold/10 text-gold text-xs rounded">
                              {rec.category}
                            </span>
                            <h3 className="font-semibold mt-2">{rec.title}</h3>
                          </div>
                          <Shirt className="w-5 h-5 text-gold" />
                        </div>
                        <p className="text-sm text-muted-foreground">{rec.description}</p>
                        <div className="flex flex-wrap gap-1">
                          {rec.colors.map((color, i) => (
                            <span
                              key={i}
                              className="px-2 py-0.5 bg-charcoal text-xs rounded"
                            >
                              {color}
                            </span>
                          ))}
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gold">{rec.priceRange}</span>
                          <span className="text-muted-foreground text-xs">
                            {rec.occasions.join(', ')}
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-2 pt-2 border-t border-gold/10">
                          {rec.buyLinks?.slice(0, 3).map((link, i) => (
                            <a
                              key={i}
                              href={link.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 px-2 py-1 bg-gold/10 hover:bg-gold/20 rounded text-xs text-gold transition-colors"
                            >
                              {link.store}
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <Palette className="w-12 h-12 mx-auto mb-4 opacity-30" />
                <p>
                  {profile
                    ? 'Select occasion/season and get personalized recommendations'
                    : 'Please analyze your profile first'}
                </p>
              </div>
            )}
          </div>
        </TabsContent>

        {/* Size Recommendation Tab */}
        <TabsContent value="size">
          <div className="grid lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Ruler className="w-5 h-5 text-gold" />
                  Size Recommendation
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Category Selection */}
                <div>
                  <Label className="mb-2 block">Product Category</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {categories.map((cat) => (
                      <button
                        key={cat}
                        onClick={() => setProductCategory(cat)}
                        className={cn(
                          'p-3 rounded-xl border-2 transition-all text-center capitalize',
                          productCategory === cat
                            ? 'border-gold bg-gold/10'
                            : 'border-gold/20 hover:border-gold/40'
                        )}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Measurements */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Height (cm)</Label>
                    <Input
                      type="number"
                      placeholder="e.g., 170"
                      value={height}
                      onChange={(e) => setHeight(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label>Weight (kg)</Label>
                    <Input
                      type="number"
                      placeholder="e.g., 65"
                      value={weight}
                      onChange={(e) => setWeight(e.target.value)}
                    />
                  </div>
                </div>

                {/* Photo Upload */}
                <div
                  className={cn(
                    'relative border-2 border-dashed rounded-xl p-6 text-center transition-all',
                    sizePhoto ? 'border-success' : 'border-gold/30 hover:border-gold/50'
                  )}
                >
                  {sizePhoto ? (
                    <div className="relative">
                      <img
                        src={sizePhoto}
                        alt="Size reference"
                        className="max-h-48 mx-auto rounded-lg"
                      />
                      <Button
                        size="icon"
                        variant="destructive"
                        className="absolute top-2 right-2"
                        onClick={() => setSizePhoto(null)}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  ) : (
                    <>
                      <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                      <p className="text-xs text-muted-foreground mb-2">
                        Upload a full-body photo for accurate sizing
                      </p>
                      <label>
                        <Button variant="outline" size="sm" asChild>
                          <span>Upload Photo</span>
                        </Button>
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          className="hidden"
                          onChange={handleSizePhotoSelect}
                        />
                      </label>
                    </>
                  )}
                </div>

                <Button
                  className="w-full"
                  onClick={handleGetSizeRec}
                  disabled={!sizePhoto || isLoadingSize}
                >
                  {isLoadingSize ? (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                      Calculating...
                    </>
                  ) : (
                    <>
                      <Ruler className="w-4 h-4 mr-2" />
                      Get Size Recommendation
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>

            {/* Size Result */}
            <Card>
              <CardHeader>
                <CardTitle>Your Recommended Size</CardTitle>
              </CardHeader>
              <CardContent>
                {sizeRec ? (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="space-y-4"
                  >
                    <div className="text-center p-6 bg-gold/10 rounded-xl">
                      <p className="text-sm text-muted-foreground mb-2">
                        Recommended Size for {sizeRec.category}
                      </p>
                      <p className="text-5xl font-bold text-gold">{sizeRec.recommendedSize}</p>
                    </div>

                    {Object.keys(sizeRec.measurements).length > 0 && (
                      <div className="p-4 bg-charcoal rounded-xl">
                        <h4 className="font-semibold mb-2">Estimated Measurements</h4>
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          {sizeRec.measurements.chest && (
                            <div>
                              <span className="text-muted-foreground">Chest:</span>{' '}
                              {sizeRec.measurements.chest}
                            </div>
                          )}
                          {sizeRec.measurements.waist && (
                            <div>
                              <span className="text-muted-foreground">Waist:</span>{' '}
                              {sizeRec.measurements.waist}
                            </div>
                          )}
                          {sizeRec.measurements.hips && (
                            <div>
                              <span className="text-muted-foreground">Hips:</span>{' '}
                              {sizeRec.measurements.hips}
                            </div>
                          )}
                          {sizeRec.measurements.length && (
                            <div>
                              <span className="text-muted-foreground">Length:</span>{' '}
                              {sizeRec.measurements.length}
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    <div className="p-4 bg-charcoal rounded-xl">
                      <h4 className="font-semibold mb-2">Fit Tips</h4>
                      <ul className="space-y-2">
                        {sizeRec.fitTips.map((tip, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm">
                            <Check className="w-4 h-4 text-gold mt-0.5 shrink-0" />
                            <span className="text-muted-foreground">{tip}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </motion.div>
                ) : (
                  <div className="text-center py-12 text-muted-foreground">
                    <Ruler className="w-12 h-12 mx-auto mb-4 opacity-30" />
                    <p>Upload your photo to get personalized size recommendations</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Trending Tab */}
        <TabsContent value="trending">
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-semibold">What's Trending in India</h2>
              <Button onClick={handleGetTrending} disabled={isLoadingTrending}>
                {isLoadingTrending ? (
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <TrendingUp className="w-4 h-4 mr-2" />
                )}
                Refresh Trends
              </Button>
            </div>

            {trends.length > 0 ? (
              <>
                {/* Trend Cards */}
                <div className="grid md:grid-cols-2 gap-4">
                  {trends.map((trend, index) => (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.1 }}
                    >
                      <Card className="h-full">
                        <CardContent className="p-4">
                          <div className="flex items-start gap-3">
                            <div className="p-2 bg-gold/10 rounded-lg">
                              <Star className="w-5 h-5 text-gold" />
                            </div>
                            <div className="flex-1">
                              <h3 className="font-semibold text-gold">{trend.name}</h3>
                              <p className="text-sm text-muted-foreground mt-1">
                                {trend.description}
                              </p>
                              <div className="mt-3">
                                <p className="text-xs text-muted-foreground mb-1">Key Pieces:</p>
                                <div className="flex flex-wrap gap-1">
                                  {trend.keyPieces.slice(0, 4).map((piece, i) => (
                                    <span
                                      key={i}
                                      className="px-2 py-0.5 bg-charcoal text-xs rounded"
                                    >
                                      {piece}
                                    </span>
                                  ))}
                                </div>
                              </div>
                              {trend.celebrities.length > 0 && (
                                <p className="text-xs text-muted-foreground mt-2">
                                  Worn by: {trend.celebrities.slice(0, 3).join(', ')}
                                </p>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  ))}
                </div>

                {/* Trending Products */}
                {trendingRecs.length > 0 && (
                  <div>
                    <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                      <ShoppingBag className="w-5 h-5 text-gold" />
                      Shop the Trends
                    </h3>
                    <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
                      {trendingRecs.map((rec, index) => (
                        <motion.div
                          key={index}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: index * 0.05 }}
                        >
                          <Card className="hover:border-gold/50 transition-colors">
                            <CardContent className="p-3 space-y-2">
                              <span className="px-2 py-0.5 bg-gold/10 text-gold text-xs rounded">
                                {rec.category}
                              </span>
                              <h4 className="font-medium text-sm">{rec.title}</h4>
                              <p className="text-xs text-muted-foreground line-clamp-2">
                                {rec.description}
                              </p>
                              <div className="flex items-center justify-between">
                                <span className="text-gold text-sm">{rec.priceRange}</span>
                                <a
                                  href={rec.buyLinks?.[0]?.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-gold hover:underline text-xs flex items-center gap-1"
                                >
                                  Shop <ChevronRight className="w-3 h-3" />
                                </a>
                              </div>
                            </CardContent>
                          </Card>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <TrendingUp className="w-12 h-12 mx-auto mb-4 opacity-30" />
                <p>Click "Refresh Trends" to see what's trending in Indian fashion</p>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
