import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Upload,
  Camera,
  Link as LinkIcon,
  Sparkles,
  Shirt,
  ArrowRight,
  Download,
  Save,
  RefreshCw,
  X,
  Check,
  ShoppingBag,
  ExternalLink,
  Lightbulb,
  ThumbsUp,
  ThumbsDown,
  User,
  Ruler,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { useAppStore } from '@/store/app-store';
import { useAuthStore } from '@/store/auth-store';
import { tryOnApi, productApi, wardrobeApi, creditsApi, tailorApi, StyleRecommendation, SizeRecommendation } from '@/lib/api';
import { cn, fileToBase64, isValidImageFile } from '@/lib/utils';

export default function TryOnPage() {
  const { toast } = useToast();
  const { user } = useAuthStore();
  const {
    tryOn,
    setTryOnSelfie,
    setTryOnProduct,
    setTryOnProductUrl,
    setTryOnMode,
    setTryOnGender,
    setTryOnResult,
    setTryOnJob,
    setFeedbackSubmitted,
    resetTryOn,
    dailyFreeRemaining,
    setDailyFreeRemaining,
  } = useAppStore();

  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [productUrlInput, setProductUrlInput] = useState('');
  const [isExtractingUrl, setIsExtractingUrl] = useState(false);
  const [dragActive, setDragActive] = useState<'selfie' | 'product' | null>(null);
  const [isSubmittingFeedback, setIsSubmittingFeedback] = useState(false);
  const [feedbackNotes, setFeedbackNotes] = useState('');
  const [outfitSuggestions, setOutfitSuggestions] = useState<{
    analysis: string;
    stylingTips: string[];
    complementaryItems: Array<{
      type: string;
      description: string;
      priceRange: string;
      stores: Array<{ name: string; url: string }>;
    }>;
  } | null>(null);
  const [complementaryItems, setComplementaryItems] = useState<StyleRecommendation[]>([]);
  const [sizeRecommendation, setSizeRecommendation] = useState<SizeRecommendation | null>(null);
  const [isLoadingComplementary, setIsLoadingComplementary] = useState(false);

  // Fetch credits on mount
  useState(() => {
    creditsApi.getBalance().then((data) => {
      setDailyFreeRemaining(data.daily_free_remaining);
    }).catch(() => {});
  });

  const handleFileDrop = useCallback(
    async (e: React.DragEvent, type: 'selfie' | 'product') => {
      e.preventDefault();
      setDragActive(null);

      const file = e.dataTransfer.files[0];
      if (!file || !isValidImageFile(file)) {
        toast({
          variant: 'destructive',
          title: 'Invalid file',
          description: 'Please upload a JPEG, PNG, or WebP image.',
        });
        return;
      }

      const base64 = await fileToBase64(file);
      if (type === 'selfie') {
        setTryOnSelfie(base64);
      } else {
        setTryOnProduct(base64);
        setTryOnProductUrl(null);
      }
    },
    [toast, setTryOnSelfie, setTryOnProduct, setTryOnProductUrl]
  );

  const handleFileSelect = async (
    e: React.ChangeEvent<HTMLInputElement>,
    type: 'selfie' | 'product'
  ) => {
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
    if (type === 'selfie') {
      setTryOnSelfie(base64);
    } else {
      setTryOnProduct(base64);
      setTryOnProductUrl(null);
    }
  };

  const handleExtractUrl = async () => {
    if (!productUrlInput.trim()) return;

    setIsExtractingUrl(true);
    try {
      const product = await productApi.extract(productUrlInput);
      if (product.image_url) {
        // Fetch and convert to base64
        const response = await fetch(product.image_url);
        const blob = await response.blob();
        const base64 = await fileToBase64(new File([blob], 'product.jpg'));
        setTryOnProduct(base64);
        setTryOnProductUrl(productUrlInput);
        toast({
          title: 'Product extracted',
          description: product.title || 'Product image loaded successfully',
        });
      }
    } catch {
      toast({
        variant: 'destructive',
        title: 'Extraction failed',
        description: 'Could not extract product. Please upload the image manually.',
      });
    } finally {
      setIsExtractingUrl(false);
    }
  };

  const handleGenerate = async () => {
    if (!tryOn.selfieImage || !tryOn.productImage) {
      toast({
        variant: 'destructive',
        title: 'Images required',
        description: 'Please upload both your selfie and a product image.',
      });
      return;
    }

    setIsGenerating(true);
    setProgress(0);

    // Simulate progress
    const progressInterval = setInterval(() => {
      setProgress((p) => Math.min(p + 10, 90));
    }, 500);

    try {
      // Convert base64 to File for API
      const selfieBlob = await fetch(tryOn.selfieImage).then((r) => r.blob());
      const selfieFile = new File([selfieBlob], 'selfie.jpg', { type: 'image/jpeg' });

      const productBlob = await fetch(tryOn.productImage).then((r) => r.blob());
      const productFile = new File([productBlob], 'product.jpg', { type: 'image/jpeg' });

      const result = await tryOnApi.create(
        selfieFile,
        productFile,
        tryOn.mode,
        tryOn.gender,
        tryOn.productUrl || undefined
      );

      setProgress(100);

      // Check if result image was actually generated
      if (!result.result_image_url) {
        console.error('No result_image_url in response:', result);
        toast({
          variant: 'destructive',
          title: 'Generation incomplete',
          description: 'The AI could not generate an image. Please try again with different photos.',
        });
        return;
      }

      // Log successful result
      console.log('Try-on result received, image size:', result.result_image_url.length);

      setTryOnResult(result.result_image_url);
      setTryOnJob(result);

      // Store outfit suggestions if available (FULL_FIT mode)
      if ((result as any).outfit_suggestions) {
        setOutfitSuggestions((result as any).outfit_suggestions);
      } else {
        setOutfitSuggestions(null);
      }

      // Fetch complementary items for the product (top wear -> bottom wear suggestions)
      try {
        setIsLoadingComplementary(true);
        const compResult = await tailorApi.getComplementary(tryOn.productImage, 'topwear');
        setComplementaryItems(compResult.complementaryItems || []);

        // Also get size recommendation
        const sizeResult = await tailorApi.getSizeRecommendation(
          tryOn.selfieImage,
          'topwear'
        );
        setSizeRecommendation(sizeResult.sizeRecommendation);
      } catch {
        // Non-critical, don't show error
      } finally {
        setIsLoadingComplementary(false);
      }

      // Refresh credits
      const balance = await creditsApi.getBalance();
      setDailyFreeRemaining(balance.daily_free_remaining);

      toast({
        title: 'Try-on complete!',
        description: 'Your virtual try-on is ready.',
      });
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Generation failed',
        description: error.message || 'Please try again.',
      });
    } finally {
      clearInterval(progressInterval);
      setIsGenerating(false);
      setProgress(0);
    }
  };

  const handleSaveToWardrobe = async () => {
    if (!tryOn.currentJob?.job_id) return;

    try {
      await wardrobeApi.save(tryOn.currentJob.job_id);
      toast({
        title: 'Saved!',
        description: 'Added to your wardrobe.',
      });
    } catch {
      toast({
        variant: 'destructive',
        title: 'Save failed',
        description: 'Could not save to wardrobe.',
      });
    }
  };

  const handleDownload = () => {
    if (!tryOn.resultImage) return;

    const link = document.createElement('a');
    link.href = tryOn.resultImage;
    link.download = `mirrorx-tryon-${Date.now()}.jpg`;
    link.click();
  };

  const handleFeedback = async (satisfied: boolean) => {
    if (!tryOn.currentJob?.job_id) return;

    setIsSubmittingFeedback(true);
    try {
      await tryOnApi.submitFeedback(
        tryOn.currentJob.job_id,
        satisfied,
        satisfied ? undefined : feedbackNotes || 'User was not satisfied with the result',
        satisfied ? undefined : ['face_mismatch', 'unrealistic']
      );

      setFeedbackSubmitted(true);
      setFeedbackNotes('');

      toast({
        title: satisfied ? 'Thank you!' : 'Feedback received',
        description: satisfied
          ? 'We appreciate your positive feedback!'
          : 'Thank you! We\'ll use your feedback to improve.',
      });
    } catch {
      toast({
        variant: 'destructive',
        title: 'Feedback failed',
        description: 'Could not submit feedback. Please try again.',
      });
    } finally {
      setIsSubmittingFeedback(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-orbitron font-bold">Virtual Try-On</h1>
          <p className="text-muted-foreground">
            See yourself in any outfit instantly
          </p>
        </div>
        <div className="text-right">
          <p className="text-sm text-muted-foreground">Credits</p>
          <p className="text-xl font-bold text-gold">{user?.credits_balance || 0}</p>
          {user?.subscription_tier === 'FREE' && (
            <p className="text-xs text-muted-foreground">
              {dailyFreeRemaining} free tries left today
            </p>
          )}
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Input Section */}
        <div className="space-y-6">
          {/* Selfie Upload */}
          <Card>
            <CardContent className="p-6">
              <Label className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Camera className="w-5 h-5 text-gold" />
                Your Photo
              </Label>

              <div
                className={cn(
                  'relative border-2 border-dashed rounded-xl p-8 text-center transition-all',
                  dragActive === 'selfie'
                    ? 'border-gold bg-gold/5'
                    : 'border-gold/30 hover:border-gold/50',
                  tryOn.selfieImage && 'border-success'
                )}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragActive('selfie');
                }}
                onDragLeave={() => setDragActive(null)}
                onDrop={(e) => handleFileDrop(e, 'selfie')}
              >
                {tryOn.selfieImage ? (
                  <div className="relative">
                    <img
                      src={tryOn.selfieImage}
                      alt="Your photo"
                      className="max-h-64 mx-auto rounded-lg"
                    />
                    <Button
                      size="icon"
                      variant="destructive"
                      className="absolute top-2 right-2"
                      onClick={() => setTryOnSelfie(null)}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ) : (
                  <>
                    <Upload className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                    <p className="text-muted-foreground mb-4">
                      Drag & drop your photo or
                    </p>
                    <label>
                      <Button variant="outline" asChild>
                        <span>Choose File</span>
                      </Button>
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        className="hidden"
                        onChange={(e) => handleFileSelect(e, 'selfie')}
                      />
                    </label>
                  </>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Product Input */}
          <Card>
            <CardContent className="p-6">
              <Label className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Shirt className="w-5 h-5 text-gold" />
                Product / Outfit
              </Label>

              <Tabs defaultValue="upload" className="w-full">
                <TabsList className="w-full mb-4">
                  <TabsTrigger value="upload" className="flex-1">
                    <Upload className="w-4 h-4 mr-2" />
                    Upload
                  </TabsTrigger>
                  <TabsTrigger value="url" className="flex-1">
                    <LinkIcon className="w-4 h-4 mr-2" />
                    Paste URL
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="upload">
                  <div
                    className={cn(
                      'relative border-2 border-dashed rounded-xl p-8 text-center transition-all',
                      dragActive === 'product'
                        ? 'border-gold bg-gold/5'
                        : 'border-gold/30 hover:border-gold/50',
                      tryOn.productImage && 'border-success'
                    )}
                    onDragOver={(e) => {
                      e.preventDefault();
                      setDragActive('product');
                    }}
                    onDragLeave={() => setDragActive(null)}
                    onDrop={(e) => handleFileDrop(e, 'product')}
                  >
                    {tryOn.productImage ? (
                      <div className="relative">
                        <img
                          src={tryOn.productImage}
                          alt="Product"
                          className="max-h-48 mx-auto rounded-lg"
                        />
                        <Button
                          size="icon"
                          variant="destructive"
                          className="absolute top-2 right-2"
                          onClick={() => {
                            setTryOnProduct(null);
                            setTryOnProductUrl(null);
                          }}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    ) : (
                      <>
                        <Shirt className="w-10 h-10 mx-auto mb-3 text-muted-foreground" />
                        <p className="text-sm text-muted-foreground mb-3">
                          Drop product image here
                        </p>
                        <label>
                          <Button variant="outline" size="sm" asChild>
                            <span>Browse</span>
                          </Button>
                          <input
                            type="file"
                            accept="image/jpeg,image/png,image/webp"
                            className="hidden"
                            onChange={(e) => handleFileSelect(e, 'product')}
                          />
                        </label>
                      </>
                    )}
                  </div>
                </TabsContent>

                <TabsContent value="url">
                  <div className="space-y-3">
                    <Input
                      placeholder="https://www.myntra.com/... or https://www.ajio.com/..."
                      value={productUrlInput}
                      onChange={(e) => setProductUrlInput(e.target.value)}
                    />
                    <Button
                      className="w-full"
                      onClick={handleExtractUrl}
                      disabled={isExtractingUrl || !productUrlInput.trim()}
                    >
                      {isExtractingUrl ? (
                        <>
                          <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                          Extracting...
                        </>
                      ) : (
                        <>
                          Extract Product <ArrowRight className="w-4 h-4 ml-2" />
                        </>
                      )}
                    </Button>
                    <p className="text-xs text-muted-foreground text-center">
                      Works with Myntra, Ajio, Amazon, Flipkart, Meesho
                    </p>
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          {/* Gender Selection */}
          <Card>
            <CardContent className="p-6">
              <Label className="text-lg font-semibold mb-4 flex items-center gap-2">
                <User className="w-5 h-5 text-gold" />
                Select Gender
              </Label>
              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={() => setTryOnGender('female')}
                  className={cn(
                    'p-4 rounded-xl border-2 transition-all text-center',
                    tryOn.gender === 'female'
                      ? 'border-gold bg-gold/10'
                      : 'border-gold/20 hover:border-gold/40'
                  )}
                >
                  <div className="text-2xl mb-2">👩</div>
                  <div className="font-semibold">Female</div>
                </button>
                <button
                  onClick={() => setTryOnGender('male')}
                  className={cn(
                    'p-4 rounded-xl border-2 transition-all text-center',
                    tryOn.gender === 'male'
                      ? 'border-gold bg-gold/10'
                      : 'border-gold/20 hover:border-gold/40'
                  )}
                >
                  <div className="text-2xl mb-2">👨</div>
                  <div className="font-semibold">Male</div>
                </button>
              </div>
            </CardContent>
          </Card>

          {/* Mode Selection */}
          <Card>
            <CardContent className="p-6">
              <Label className="text-lg font-semibold mb-4">Try-On Mode</Label>
              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={() => setTryOnMode('PART')}
                  className={cn(
                    'p-4 rounded-xl border-2 transition-all text-left',
                    tryOn.mode === 'PART'
                      ? 'border-gold bg-gold/10'
                      : 'border-gold/20 hover:border-gold/40'
                  )}
                >
                  <div className="font-semibold mb-1">Part Mode</div>
                  <div className="text-sm text-muted-foreground">
                    Try single item
                  </div>
                </button>
                <button
                  onClick={() => setTryOnMode('FULL_FIT')}
                  className={cn(
                    'p-4 rounded-xl border-2 transition-all text-left',
                    tryOn.mode === 'FULL_FIT'
                      ? 'border-gold bg-gold/10'
                      : 'border-gold/20 hover:border-gold/40'
                  )}
                >
                  <div className="font-semibold mb-1">Full Fit</div>
                  <div className="text-sm text-muted-foreground">
                    Complete outfit
                  </div>
                </button>
              </div>
            </CardContent>
          </Card>

          {/* Generate Button */}
          <Button
            size="lg"
            className="w-full h-14 text-lg"
            onClick={handleGenerate}
            disabled={isGenerating || !tryOn.selfieImage || !tryOn.productImage}
          >
            {isGenerating ? (
              <>
                <Sparkles className="w-5 h-5 mr-2 animate-pulse" />
                Generating...
              </>
            ) : (
              <>
                <Sparkles className="w-5 h-5 mr-2" />
                Generate Try-On
              </>
            )}
          </Button>

          {isGenerating && (
            <div className="space-y-2">
              <Progress value={progress} />
              <p className="text-sm text-center text-muted-foreground">
                AI is creating your look...
              </p>
            </div>
          )}
        </div>

        {/* Result Section */}
        <Card className="h-fit sticky top-20">
          <CardContent className="p-6">
            <Label className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-gold" />
              Result
            </Label>

            <AnimatePresence mode="wait">
              {tryOn.resultImage ? (
                <motion.div
                  key="result"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="space-y-4"
                >
                  <div className="relative rounded-xl overflow-hidden bg-charcoal">
                    <img
                      src={tryOn.resultImage}
                      alt="Try-on result"
                      className="w-full"
                      onError={(e) => {
                        console.error('Image failed to load:', e);
                        toast({
                          variant: 'destructive',
                          title: 'Image display error',
                          description: 'The generated image could not be displayed. Please try again.',
                        });
                      }}
                      onLoad={() => {
                        console.log('Try-on image loaded successfully');
                      }}
                    />
                    <div className="absolute top-3 right-3 badge-premium">
                      <Check className="w-3 h-3" /> AI Generated
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <Button variant="outline" onClick={handleDownload}>
                      <Download className="w-4 h-4 mr-2" />
                      Download
                    </Button>
                    <Button variant="outline" onClick={handleSaveToWardrobe}>
                      <Save className="w-4 h-4 mr-2" />
                      Save
                    </Button>
                    <Button variant="outline" onClick={() => {
                      resetTryOn();
                      setOutfitSuggestions(null);
                      setFeedbackNotes('');
                      setComplementaryItems([]);
                      setSizeRecommendation(null);
                    }}>
                      <RefreshCw className="w-4 h-4 mr-2" />
                      New
                    </Button>
                  </div>

                  {/* Feedback Section */}
                  {!tryOn.feedbackSubmitted ? (
                    <div className="mt-4 p-4 bg-charcoal rounded-xl">
                      <p className="text-sm font-medium text-center mb-3">
                        Was this try-on accurate?
                      </p>
                      <div className="flex gap-3 justify-center">
                        <Button
                          variant="outline"
                          className="flex-1 border-green-500/30 hover:bg-green-500/10 hover:border-green-500"
                          onClick={() => handleFeedback(true)}
                          disabled={isSubmittingFeedback}
                        >
                          <ThumbsUp className="w-4 h-4 mr-2 text-green-500" />
                          Yes, looks great!
                        </Button>
                        <Button
                          variant="outline"
                          className="flex-1 border-red-500/30 hover:bg-red-500/10 hover:border-red-500"
                          onClick={() => handleFeedback(false)}
                          disabled={isSubmittingFeedback}
                        >
                          <ThumbsDown className="w-4 h-4 mr-2 text-red-500" />
                          No, needs improvement
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground text-center mt-2">
                        Your feedback helps our AI improve
                      </p>
                    </div>
                  ) : (
                    <div className="mt-4 p-4 bg-green-500/10 rounded-xl border border-green-500/30">
                      <p className="text-sm text-center text-green-400 flex items-center justify-center gap-2">
                        <Check className="w-4 h-4" />
                        Thank you for your feedback!
                      </p>
                    </div>
                  )}

                  {/* Size Recommendation */}
                  {sizeRecommendation && (
                    <div className="mt-4 p-4 bg-charcoal rounded-xl">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-semibold text-gold flex items-center gap-2">
                          <Ruler className="w-4 h-4" />
                          Recommended Size
                        </h4>
                        <span className="text-2xl font-bold text-gold">
                          {sizeRecommendation.recommendedSize}
                        </span>
                      </div>
                      {sizeRecommendation.fitTips && sizeRecommendation.fitTips.length > 0 && (
                        <ul className="text-xs text-muted-foreground space-y-1">
                          {sizeRecommendation.fitTips.slice(0, 2).map((tip, i) => (
                            <li key={i} className="flex items-start gap-2">
                              <Check className="w-3 h-3 text-gold mt-0.5 shrink-0" />
                              {tip}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}

                  {/* Complementary Items - Bottom Wear Suggestions */}
                  {complementaryItems.length > 0 && (
                    <div className="mt-4 border-t border-gold/20 pt-4">
                      <h4 className="font-semibold text-gold flex items-center gap-2 mb-3">
                        <Shirt className="w-4 h-4" />
                        Complete Your Look
                      </h4>
                      <p className="text-xs text-muted-foreground mb-3">
                        Based on your top wear, we suggest these matching items:
                      </p>
                      <div className="space-y-2">
                        {complementaryItems.slice(0, 3).map((item, index) => (
                          <div
                            key={index}
                            className="bg-charcoal rounded-lg p-3"
                          >
                            <div className="flex justify-between items-start mb-2">
                              <div>
                                <span className="text-xs text-gold">{item.category}</span>
                                <p className="font-medium text-sm">{item.title}</p>
                              </div>
                              <span className="text-xs text-gold">{item.priceRange}</span>
                            </div>
                            <p className="text-xs text-muted-foreground mb-2 line-clamp-2">
                              {item.description}
                            </p>
                            <div className="flex flex-wrap gap-1">
                              {item.buyLinks?.slice(0, 3).map((link, i) => (
                                <a
                                  key={i}
                                  href={link.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 px-2 py-0.5 bg-gold/10 hover:bg-gold/20 rounded text-xs text-gold transition-colors"
                                >
                                  {link.store}
                                  <ExternalLink className="w-3 h-3" />
                                </a>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {isLoadingComplementary && (
                    <div className="mt-4 p-4 bg-charcoal rounded-xl">
                      <div className="flex items-center justify-center gap-2 text-muted-foreground">
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span className="text-sm">Finding matching items...</span>
                      </div>
                    </div>
                  )}

                  {/* Outfit Suggestions for FULL_FIT mode */}
                  {outfitSuggestions && (
                    <div className="mt-6 space-y-4">
                      <div className="border-t border-gold/20 pt-4">
                        <h3 className="font-semibold text-gold flex items-center gap-2 mb-3">
                          <Lightbulb className="w-5 h-5" />
                          Complete Your Look
                        </h3>

                        {/* Style Analysis */}
                        {outfitSuggestions.analysis && (
                          <p className="text-sm text-muted-foreground mb-4">
                            {outfitSuggestions.analysis}
                          </p>
                        )}

                        {/* Styling Tips */}
                        {outfitSuggestions.stylingTips && outfitSuggestions.stylingTips.length > 0 && (
                          <div className="mb-4">
                            <p className="text-xs font-medium text-gold mb-2">Styling Tips:</p>
                            <ul className="text-xs text-muted-foreground space-y-1">
                              {outfitSuggestions.stylingTips.slice(0, 3).map((tip, i) => (
                                <li key={i} className="flex items-start gap-2">
                                  <span className="text-gold">•</span>
                                  {tip}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {/* Complementary Items with Buy Links */}
                        {outfitSuggestions.complementaryItems && outfitSuggestions.complementaryItems.length > 0 && (
                          <div className="space-y-3">
                            <p className="text-xs font-medium text-gold mb-2">
                              <ShoppingBag className="w-4 h-4 inline mr-1" />
                              Suggested Items to Buy:
                            </p>
                            {outfitSuggestions.complementaryItems.map((item, index) => (
                              <div
                                key={index}
                                className="bg-charcoal rounded-lg p-3 space-y-2"
                              >
                                <div className="flex justify-between items-start">
                                  <div>
                                    <p className="font-medium text-sm">{item.type}</p>
                                    <p className="text-xs text-muted-foreground">{item.description}</p>
                                    <p className="text-xs text-gold mt-1">{item.priceRange}</p>
                                  </div>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                  {item.stores.slice(0, 4).map((store, storeIndex) => (
                                    <a
                                      key={storeIndex}
                                      href={store.url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="inline-flex items-center gap-1 px-2 py-1 bg-gold/10 hover:bg-gold/20 rounded text-xs text-gold transition-colors"
                                    >
                                      {store.name}
                                      <ExternalLink className="w-3 h-3" />
                                    </a>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </motion.div>
              ) : (
                <motion.div
                  key="placeholder"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="aspect-[3/4] bg-charcoal rounded-xl flex flex-col items-center justify-center text-muted-foreground"
                >
                  <Sparkles className="w-16 h-16 mb-4 opacity-20" />
                  <p>Your try-on result will appear here</p>
                </motion.div>
              )}
            </AnimatePresence>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
