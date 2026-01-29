import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, Sparkles, MapPin, ShoppingBag, ChevronRight, Camera,
  Check, Heart, Share2, X, Loader2
} from 'lucide-react';
import { storeApi } from '@/lib/api';
import { useStoreModeStore } from '@/store/store-mode-store';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import type { StoreProduct, StoreZone, StorePlanogram } from '@mrrx/shared';

export default function StoreProductPage() {
  const { productId } = useParams<{ productId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const {
    hasSelfie,
    setSelectedProduct,
    setCart,
    addTryOnResult,
    currentTryOn,
    setCurrentTryOn,
    isTryingOn,
    setIsTryingOn,
    setSelfieStatus,
  } = useStoreModeStore();

  const [product, setProduct] = useState<(StoreProduct & { location: StorePlanogram | null; zone: StoreZone | null }) | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedSize, setSelectedSize] = useState<string | null>(null);
  const [selectedColor, setSelectedColor] = useState<string | null>(null);
  const [tryOnResult, setTryOnResult] = useState<string | null>(null);
  const [showTryOn, setShowTryOn] = useState(false);
  const [showSelfiePrompt, setShowSelfiePrompt] = useState(false);
  const [isAddingToCart, setIsAddingToCart] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  // Fetch product details
  useEffect(() => {
    if (!productId) return;

    const fetchProduct = async () => {
      setIsLoading(true);
      try {
        const response = await storeApi.getProduct(productId);
        setProduct(response.product);
        setSelectedProduct(response.product);

        // Set default selections
        if (response.product.sizes?.length > 0) {
          setSelectedSize(response.product.sizes[0]);
        }
        if (response.product.colors?.length > 0) {
          setSelectedColor(response.product.colors[0].name);
        }
      } catch (error) {
        console.error('Failed to fetch product:', error);
        toast({
          title: 'Error',
          description: 'Failed to load product',
          variant: 'destructive',
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchProduct();
  }, [productId]);

  // Handle try-on
  const handleTryOn = async () => {
    if (!hasSelfie) {
      setShowSelfiePrompt(true);
      return;
    }

    if (!product) return;

    setIsTryingOn(true);
    setShowTryOn(true);

    try {
      const response = await storeApi.createTryOn(product.id, 'PART');

      if (response.status === 'SUCCEEDED' && response.result_image_url) {
        setTryOnResult(response.result_image_url);
        addTryOnResult({
          jobId: response.job_id,
          productId: product.id,
          resultImageUrl: response.result_image_url,
          product: response.product,
          location: response.location,
        });
        setCurrentTryOn({
          jobId: response.job_id,
          productId: product.id,
          resultImageUrl: response.result_image_url,
          product: response.product,
          location: response.location,
        });
      } else {
        throw new Error('Try-on failed');
      }
    } catch (error) {
      toast({
        title: 'Try-on failed',
        description: (error as Error).message || 'Please try again',
        variant: 'destructive',
      });
      setShowTryOn(false);
    } finally {
      setIsTryingOn(false);
    }
  };

  // Handle selfie upload from prompt
  const handleSelfieUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const base64 = event.target?.result as string;

      try {
        await storeApi.uploadSelfie(base64);
        setSelfieStatus(true);
        setShowSelfiePrompt(false);
        toast({
          title: 'Photo saved!',
          description: 'Now trying on the item...',
        });
        // Auto-trigger try-on
        handleTryOn();
      } catch (error) {
        toast({
          title: 'Upload failed',
          description: (error as Error).message,
          variant: 'destructive',
        });
      }
    };
    reader.readAsDataURL(file);
  };

  // Add to cart
  const handleAddToCart = async () => {
    if (!product) return;

    if (product.sizes?.length > 0 && !selectedSize) {
      toast({
        title: 'Select a size',
        description: 'Please choose a size before adding to cart',
        variant: 'destructive',
      });
      return;
    }

    setIsAddingToCart(true);
    try {
      const response = await storeApi.addToCart(product.id, {
        size: selectedSize || undefined,
        color: selectedColor || undefined,
        tryon_job_id: tryOnResult ? currentTryOn?.jobId : undefined, // Link try-on if available
      });

      setCart(response.cart);
      toast({
        title: 'Added to cart',
        description: `${product.name} has been added to your cart`,
      });
    } catch (error) {
      toast({
        title: 'Failed to add',
        description: (error as Error).message,
        variant: 'destructive',
      });
    } finally {
      setIsAddingToCart(false);
    }
  };

  // Format price
  const formatPrice = (paise: number) => {
    return `₹${(paise / 100).toLocaleString('en-IN')}`;
  };

  const getDiscountPercentage = (price: number, originalPrice: number | null) => {
    if (!originalPrice || originalPrice <= price) return null;
    return Math.round(((originalPrice - price) / originalPrice) * 100);
  };

  // Get all images
  const allImages = product ? [product.image_url, ...(product.additional_images || [])] : [];

  if (isLoading) {
    return (
      <div className="min-h-screen bg-midnight flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gold" />
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen bg-midnight flex flex-col items-center justify-center p-4">
        <p className="text-white/60 mb-4">Product not found</p>
        <Button onClick={() => navigate('/store/browse')} variant="outline" className="text-white border-white/20">
          Back to Browse
        </Button>
      </div>
    );
  }

  const discount = getDiscountPercentage(product.price, product.original_price);

  return (
    <div className="min-h-screen bg-midnight pb-32">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-midnight/95 backdrop-blur-lg">
        <div className="flex items-center justify-between px-4 py-3">
          <button onClick={() => navigate(-1)} className="p-2 -ml-2 rounded-full hover:bg-white/10">
            <ArrowLeft className="w-5 h-5 text-white" />
          </button>
          <div className="flex items-center gap-2">
            <button className="p-2 rounded-full hover:bg-white/10">
              <Heart className="w-5 h-5 text-white" />
            </button>
            <button className="p-2 rounded-full hover:bg-white/10">
              <Share2 className="w-5 h-5 text-white" />
            </button>
          </div>
        </div>
      </div>

      {/* Image Gallery */}
      <div className="relative">
        <div className="aspect-[3/4] bg-white/5 overflow-hidden">
          <motion.img
            key={currentImageIndex}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            src={allImages[currentImageIndex]}
            alt={product.name}
            className="w-full h-full object-cover"
          />

          {/* Try On Badge */}
          {product.is_try_on_enabled && (
            <div className="absolute top-4 right-4 bg-indigo-500/90 backdrop-blur text-white text-sm px-3 py-1.5 rounded-full flex items-center gap-2">
              <Sparkles className="w-4 h-4" />
              Virtual Try-On
            </div>
          )}

          {/* Discount Badge */}
          {discount && (
            <div className="absolute top-4 left-4 bg-red-500 text-white text-sm font-bold px-3 py-1 rounded-lg">
              {discount}% OFF
            </div>
          )}
        </div>

        {/* Image Dots */}
        {allImages.length > 1 && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
            {allImages.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrentImageIndex(i)}
                className={cn(
                  'w-2 h-2 rounded-full transition-all',
                  currentImageIndex === i ? 'bg-white w-6' : 'bg-white/50'
                )}
              />
            ))}
          </div>
        )}
      </div>

      {/* Product Info */}
      <div className="px-4 py-6 space-y-6">
        {/* Brand & Name */}
        <div>
          {product.brand && (
            <p className="text-indigo-400 text-sm font-medium uppercase tracking-wide mb-1">
              {product.brand}
            </p>
          )}
          <h1 className="text-2xl font-bold text-white">{product.name}</h1>
        </div>

        {/* Price */}
        <div className="flex items-baseline gap-3">
          <span className="text-3xl font-bold text-white">{formatPrice(product.price)}</span>
          {product.original_price && product.original_price > product.price && (
            <>
              <span className="text-lg text-white/40 line-through">
                {formatPrice(product.original_price)}
              </span>
              <span className="text-green-400 text-sm font-medium">
                Save {formatPrice(product.original_price - product.price)}
              </span>
            </>
          )}
        </div>

        {/* Location */}
        {product.location && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-green-500/10 border border-green-500/30 rounded-2xl p-4 flex items-center gap-4"
          >
            <div className="w-12 h-12 rounded-xl bg-green-500/20 flex items-center justify-center">
              <MapPin className="w-6 h-6 text-green-400" />
            </div>
            <div className="flex-1">
              <p className="text-white font-medium">Find in Store</p>
              <p className="text-green-400 text-sm">
                {[
                  product.zone?.floor && `${product.zone.floor} Floor`,
                  product.location.aisle && `Aisle ${product.location.aisle}`,
                  product.location.rack && `Rack ${product.location.rack}`,
                  product.location.shelf && `Shelf ${product.location.shelf}`,
                ].filter(Boolean).join(' → ')}
              </p>
            </div>
            <ChevronRight className="w-5 h-5 text-white/40" />
          </motion.div>
        )}

        {/* Size Selection */}
        {product.sizes && product.sizes.length > 0 && (
          <div>
            <h3 className="text-white font-medium mb-3">Size</h3>
            <div className="flex flex-wrap gap-2">
              {product.sizes.map((size) => (
                <button
                  key={size}
                  onClick={() => setSelectedSize(size)}
                  className={cn(
                    'min-w-[48px] h-12 px-4 rounded-xl text-sm font-medium transition-all border',
                    selectedSize === size
                      ? 'bg-white text-midnight border-white'
                      : 'bg-white/5 text-white border-white/10 hover:border-white/30'
                  )}
                >
                  {size}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Color Selection */}
        {product.colors && product.colors.length > 0 && (
          <div>
            <h3 className="text-white font-medium mb-3">
              Color: <span className="text-white/60">{selectedColor}</span>
            </h3>
            <div className="flex flex-wrap gap-3">
              {product.colors.map((color) => (
                <button
                  key={color.name}
                  onClick={() => setSelectedColor(color.name)}
                  className={cn(
                    'w-10 h-10 rounded-full border-2 transition-all',
                    selectedColor === color.name
                      ? 'border-white scale-110'
                      : 'border-transparent hover:border-white/50'
                  )}
                  style={{ backgroundColor: color.hex }}
                  title={color.name}
                >
                  {selectedColor === color.name && (
                    <Check className={cn(
                      'w-5 h-5 mx-auto',
                      color.hex === '#FFFFFF' || color.hex === '#FFF' ? 'text-black' : 'text-white'
                    )} />
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Description */}
        {product.description && (
          <div>
            <h3 className="text-white font-medium mb-2">Description</h3>
            <p className="text-white/60 text-sm leading-relaxed">{product.description}</p>
          </div>
        )}

        {/* Material & Care */}
        {product.material && (
          <div className="flex items-center gap-4 text-sm">
            <span className="text-white/40">Material:</span>
            <span className="text-white">{product.material}</span>
          </div>
        )}
      </div>

      {/* Bottom Action Bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-midnight/95 backdrop-blur-lg border-t border-white/10 p-4 safe-area-bottom">
        <div className="flex gap-3">
          {/* Try On Button */}
          {product.is_try_on_enabled && (
            <Button
              onClick={handleTryOn}
              disabled={isTryingOn}
              className="flex-1 py-6 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white rounded-2xl font-semibold"
            >
              {isTryingOn ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Trying On...
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5 mr-2" />
                  Try On
                </>
              )}
            </Button>
          )}

          {/* Add to Cart Button */}
          <Button
            onClick={handleAddToCart}
            disabled={isAddingToCart}
            className={cn(
              'py-6 bg-white hover:bg-white/90 text-midnight rounded-2xl font-semibold',
              product.is_try_on_enabled ? 'flex-1' : 'flex-[2]'
            )}
          >
            {isAddingToCart ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                <ShoppingBag className="w-5 h-5 mr-2" />
                Add to Cart
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Try-On Modal */}
      <AnimatePresence>
        {showTryOn && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-midnight/98 backdrop-blur-xl"
          >
            <div className="h-full flex flex-col">
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-4">
                <h2 className="text-xl font-bold text-white">Virtual Try-On</h2>
                <button onClick={() => setShowTryOn(false)}>
                  <X className="w-6 h-6 text-white" />
                </button>
              </div>

              {/* Content */}
              <div className="flex-1 flex items-center justify-center p-4">
                {isTryingOn ? (
                  <div className="text-center">
                    <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center animate-pulse">
                      <Sparkles className="w-12 h-12 text-white" />
                    </div>
                    <p className="text-white text-lg font-medium">Creating your look...</p>
                    <p className="text-white/60 text-sm mt-2">This takes about 15-30 seconds</p>
                  </div>
                ) : tryOnResult ? (
                  <motion.div
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="w-full max-w-sm"
                  >
                    <img
                      src={tryOnResult}
                      alt="Try-on result"
                      className="w-full rounded-3xl shadow-2xl"
                    />
                  </motion.div>
                ) : null}
              </div>

              {/* Actions */}
              {tryOnResult && (
                <div className="p-4 space-y-3">
                  <Button
                    onClick={handleAddToCart}
                    disabled={isAddingToCart}
                    className="w-full py-6 bg-gradient-to-r from-gold to-amber-500 hover:from-gold/90 hover:to-amber-500/90 text-midnight rounded-2xl font-semibold"
                  >
                    {isAddingToCart ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <>
                        <ShoppingBag className="w-5 h-5 mr-2" />
                        Add to Cart
                      </>
                    )}
                  </Button>
                  <Button
                    onClick={() => {
                      setShowTryOn(false);
                      navigate('/store/browse');
                    }}
                    variant="outline"
                    className="w-full py-4 border-white/20 text-white hover:bg-white/10"
                  >
                    Continue Shopping
                  </Button>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Selfie Prompt Modal */}
      <AnimatePresence>
        {showSelfiePrompt && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-midnight/95 backdrop-blur-xl flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              className="bg-white/5 rounded-3xl p-6 max-w-sm w-full text-center"
            >
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                <Camera className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Take a Photo First</h3>
              <p className="text-white/60 text-sm mb-6">
                We need a photo of you to show how this looks on you
              </p>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="user"
                onChange={handleSelfieUpload}
                className="hidden"
              />

              <Button
                onClick={() => fileInputRef.current?.click()}
                className="w-full py-4 mb-3 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-xl"
              >
                <Camera className="w-5 h-5 mr-2" />
                Take Photo
              </Button>
              <Button
                onClick={() => setShowSelfiePrompt(false)}
                variant="ghost"
                className="w-full text-white/60 hover:text-white"
              >
                Maybe Later
              </Button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
