import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Camera, Sparkles, ChevronRight, X, Loader2,
  ShoppingBag, ArrowLeft, Check, Grid, Shirt, User
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import QRCode from 'qrcode';

// BBA Cloths Demo Inventory - 25 Items
const BBA_INVENTORY = [
  // T-Shirts (5)
  { id: 'bba-001', name: 'Classic White Tee', category: 'tshirts', price: 59900, image: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=400&h=500&fit=crop', color: 'White', sizes: ['S', 'M', 'L', 'XL'] },
  { id: 'bba-002', name: 'Black Essentials Tee', category: 'tshirts', price: 59900, image: 'https://images.unsplash.com/photo-1503341504253-dff4815485f1?w=400&h=500&fit=crop', color: 'Black', sizes: ['S', 'M', 'L', 'XL'] },
  { id: 'bba-003', name: 'Navy Blue Crew Neck', category: 'tshirts', price: 69900, image: 'https://images.unsplash.com/photo-1618354691373-d851c5c3a990?w=400&h=500&fit=crop', color: 'Navy', sizes: ['S', 'M', 'L', 'XL'] },
  { id: 'bba-004', name: 'Olive Green Pocket Tee', category: 'tshirts', price: 74900, image: 'https://images.unsplash.com/photo-1583743814966-8936f5b7be1a?w=400&h=500&fit=crop', color: 'Olive', sizes: ['S', 'M', 'L', 'XL'] },
  { id: 'bba-005', name: 'Striped Classic Tee', category: 'tshirts', price: 79900, image: 'https://images.unsplash.com/photo-1523381294911-8d3cead13475?w=400&h=500&fit=crop', color: 'Multi', sizes: ['S', 'M', 'L', 'XL'] },

  // Shirts (5)
  { id: 'bba-006', name: 'Oxford Blue Shirt', category: 'shirts', price: 129900, image: 'https://images.unsplash.com/photo-1596755094514-f87e34085b2c?w=400&h=500&fit=crop', color: 'Blue', sizes: ['S', 'M', 'L', 'XL'] },
  { id: 'bba-007', name: 'White Formal Shirt', category: 'shirts', price: 119900, image: 'https://images.unsplash.com/photo-1598032895397-b9472444bf93?w=400&h=500&fit=crop', color: 'White', sizes: ['S', 'M', 'L', 'XL'] },
  { id: 'bba-008', name: 'Denim Casual Shirt', category: 'shirts', price: 149900, image: 'https://images.unsplash.com/photo-1588359348347-9bc6cbbb689e?w=400&h=500&fit=crop', color: 'Denim', sizes: ['S', 'M', 'L', 'XL'] },
  { id: 'bba-009', name: 'Checked Flannel Shirt', category: 'shirts', price: 139900, image: 'https://images.unsplash.com/photo-1608063615781-e2ef8c73d114?w=400&h=500&fit=crop', color: 'Red Check', sizes: ['S', 'M', 'L', 'XL'] },
  { id: 'bba-010', name: 'Linen Summer Shirt', category: 'shirts', price: 159900, image: 'https://images.unsplash.com/photo-1594938298603-c8148c4dae35?w=400&h=500&fit=crop', color: 'Beige', sizes: ['S', 'M', 'L', 'XL'] },

  // Jackets (4)
  { id: 'bba-011', name: 'Black Leather Jacket', category: 'jackets', price: 499900, image: 'https://images.unsplash.com/photo-1551028719-00167b16eac5?w=400&h=500&fit=crop', color: 'Black', sizes: ['S', 'M', 'L', 'XL'] },
  { id: 'bba-012', name: 'Denim Trucker Jacket', category: 'jackets', price: 299900, image: 'https://images.unsplash.com/photo-1576995853123-5a10305d93c0?w=400&h=500&fit=crop', color: 'Blue', sizes: ['S', 'M', 'L', 'XL'] },
  { id: 'bba-013', name: 'Bomber Jacket Navy', category: 'jackets', price: 349900, image: 'https://images.unsplash.com/photo-1591047139829-d91aecb6caea?w=400&h=500&fit=crop', color: 'Navy', sizes: ['S', 'M', 'L', 'XL'] },
  { id: 'bba-014', name: 'Windbreaker Jacket', category: 'jackets', price: 249900, image: 'https://images.unsplash.com/photo-1544022613-e87ca75a784a?w=400&h=500&fit=crop', color: 'Green', sizes: ['S', 'M', 'L', 'XL'] },

  // Dresses (4)
  { id: 'bba-015', name: 'Floral Summer Dress', category: 'dresses', price: 189900, image: 'https://images.unsplash.com/photo-1572804013309-59a88b7e92f1?w=400&h=500&fit=crop', color: 'Floral', sizes: ['XS', 'S', 'M', 'L'] },
  { id: 'bba-016', name: 'Little Black Dress', category: 'dresses', price: 219900, image: 'https://images.unsplash.com/photo-1595777457583-95e059d581b8?w=400&h=500&fit=crop', color: 'Black', sizes: ['XS', 'S', 'M', 'L'] },
  { id: 'bba-017', name: 'Red Evening Dress', category: 'dresses', price: 279900, image: 'https://images.unsplash.com/photo-1566174053879-31528523f8ae?w=400&h=500&fit=crop', color: 'Red', sizes: ['XS', 'S', 'M', 'L'] },
  { id: 'bba-018', name: 'Casual Maxi Dress', category: 'dresses', price: 169900, image: 'https://images.unsplash.com/photo-1496747611176-843222e1e57c?w=400&h=500&fit=crop', color: 'White', sizes: ['XS', 'S', 'M', 'L'] },

  // Tops (4)
  { id: 'bba-019', name: 'Silk Blouse White', category: 'tops', price: 159900, image: 'https://images.unsplash.com/photo-1564257631407-4deb1f99d992?w=400&h=500&fit=crop', color: 'White', sizes: ['XS', 'S', 'M', 'L'] },
  { id: 'bba-020', name: 'Crop Top Black', category: 'tops', price: 89900, image: 'https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?w=400&h=500&fit=crop', color: 'Black', sizes: ['XS', 'S', 'M', 'L'] },
  { id: 'bba-021', name: 'Knit Sweater Pink', category: 'tops', price: 179900, image: 'https://images.unsplash.com/photo-1434389677669-e08b4cac3105?w=400&h=500&fit=crop', color: 'Pink', sizes: ['XS', 'S', 'M', 'L'] },
  { id: 'bba-022', name: 'Tank Top Grey', category: 'tops', price: 49900, image: 'https://images.unsplash.com/photo-1485218126466-34e6392ec754?w=400&h=500&fit=crop', color: 'Grey', sizes: ['XS', 'S', 'M', 'L'] },

  // Kurtas (3)
  { id: 'bba-023', name: 'White Cotton Kurta', category: 'kurtas', price: 139900, image: 'https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=400&h=500&fit=crop', color: 'White', sizes: ['S', 'M', 'L', 'XL'] },
  { id: 'bba-024', name: 'Navy Embroidered Kurta', category: 'kurtas', price: 199900, image: 'https://images.unsplash.com/photo-1594938328870-9623159c8c99?w=400&h=500&fit=crop', color: 'Navy', sizes: ['S', 'M', 'L', 'XL'] },
  { id: 'bba-025', name: 'Festive Gold Kurta', category: 'kurtas', price: 299900, image: 'https://images.unsplash.com/photo-1583391733956-6c78276477e2?w=400&h=500&fit=crop', color: 'Gold', sizes: ['S', 'M', 'L', 'XL'] },
];

const CATEGORIES = [
  { value: 'all', label: 'All Items' },
  { value: 'tshirts', label: 'T-Shirts' },
  { value: 'shirts', label: 'Shirts' },
  { value: 'jackets', label: 'Jackets' },
  { value: 'dresses', label: 'Dresses' },
  { value: 'tops', label: 'Tops' },
  { value: 'kurtas', label: 'Kurtas' },
];

type DemoStep = 'qr' | 'welcome' | 'selfie' | 'browse' | 'trying' | 'gallery';

interface TryOnResult {
  productId: string;
  product: typeof BBA_INVENTORY[0];
  resultImage: string;
  status: 'pending' | 'processing' | 'done' | 'error';
}

export default function BBAClothsDemo() {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Demo state
  const [step, setStep] = useState<DemoStep>('qr');
  const [selfieImage, setSelfieImage] = useState<string | null>(null);
  const [selfieFile, setSelfieFile] = useState<File | null>(null);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [tryOnResults, setTryOnResults] = useState<TryOnResult[]>([]);
  const [currentTryingProduct, setCurrentTryingProduct] = useState<typeof BBA_INVENTORY[0] | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [tryAllMode, setTryAllMode] = useState(false);
  const [tryAllProgress, setTryAllProgress] = useState(0);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>('');

  const filteredProducts = selectedCategory === 'all'
    ? BBA_INVENTORY
    : BBA_INVENTORY.filter(p => p.category === selectedCategory);

  const formatPrice = (paise: number) => `₹${(paise / 100).toLocaleString('en-IN')}`;

  // Generate QR Code URL (demo purposes - shows the store URL)
  const storeUrl = `${window.location.origin}/demo/bba-cloths`;

  // Generate QR Code on mount
  useEffect(() => {
    const generateQR = async () => {
      try {
        const dataUrl = await QRCode.toDataURL(storeUrl, {
          width: 256,
          margin: 2,
          color: {
            dark: '#1a1a2e',
            light: '#ffffff',
          },
        });
        setQrCodeDataUrl(dataUrl);
      } catch (err) {
        console.error('QR generation error:', err);
      }
    };
    generateQR();
  }, [storeUrl]);

  // Handle selfie selection
  const handleSelfieSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast({ title: 'Invalid file', description: 'Please select an image', variant: 'destructive' });
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast({ title: 'File too large', description: 'Please select an image under 10MB', variant: 'destructive' });
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      setSelfieImage(event.target?.result as string);
      setSelfieFile(file);
      setStep('browse');
      toast({ title: 'Photo saved!', description: 'Now browse and try on clothes' });
    };
    reader.readAsDataURL(file);
  };

  // Try on a single product
  const handleTryOn = async (product: typeof BBA_INVENTORY[0]) => {
    if (!selfieImage || !selfieFile) {
      toast({ title: 'Photo required', description: 'Please upload your photo first', variant: 'destructive' });
      return;
    }

    setCurrentTryingProduct(product);
    setStep('trying');
    setIsProcessing(true);

    try {
      // Create FormData for API call
      const formData = new FormData();
      formData.append('selfie_image', selfieFile);

      // Fetch product image and convert to file
      const productImageResponse = await fetch(product.image);
      const productImageBlob = await productImageResponse.blob();
      const productImageFile = new File([productImageBlob], 'product.jpg', { type: 'image/jpeg' });
      formData.append('product_image', productImageFile);
      formData.append('mode', 'PART');
      formData.append('gender', 'female');

      // Call the real try-on API
      const API_BASE = import.meta.env.VITE_API_URL || '/api';
      const response = await fetch(`${API_BASE}/tryon`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Try-on failed');
      }

      const result = await response.json();

      if (result.status === 'SUCCEEDED' && result.result_image_url) {
        const newResult: TryOnResult = {
          productId: product.id,
          product,
          resultImage: result.result_image_url,
          status: 'done',
        };

        setTryOnResults(prev => {
          const filtered = prev.filter(r => r.productId !== product.id);
          return [newResult, ...filtered];
        });

        toast({ title: 'Try-on complete!', description: `${product.name} looks great on you!` });
      } else if (result.status === 'PENDING' || result.status === 'PROCESSING') {
        // Poll for result
        const jobId = result.job_id;
        await pollForResult(jobId, product);
      } else {
        throw new Error('Unexpected status');
      }
    } catch (error) {
      console.error('Try-on error:', error);
      // For demo, create a simulated result with the product image
      const demoResult: TryOnResult = {
        productId: product.id,
        product,
        resultImage: product.image, // Fallback to product image
        status: 'done',
      };
      setTryOnResults(prev => {
        const filtered = prev.filter(r => r.productId !== product.id);
        return [demoResult, ...filtered];
      });
      toast({ title: 'Demo Mode', description: 'Showing product preview (API unavailable)' });
    } finally {
      setIsProcessing(false);
      setCurrentTryingProduct(null);
      setStep('browse');
    }
  };

  // Poll for try-on result
  const pollForResult = async (jobId: string, product: typeof BBA_INVENTORY[0]) => {
    const API_BASE = import.meta.env.VITE_API_URL || '/api';
    let attempts = 0;
    const maxAttempts = 30;

    while (attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 2000));
      attempts++;

      try {
        const response = await fetch(`${API_BASE}/tryon/${jobId}`);
        const result = await response.json();

        if (result.status === 'SUCCEEDED' && result.result_image_url) {
          const newResult: TryOnResult = {
            productId: product.id,
            product,
            resultImage: result.result_image_url,
            status: 'done',
          };

          setTryOnResults(prev => {
            const filtered = prev.filter(r => r.productId !== product.id);
            return [newResult, ...filtered];
          });

          return;
        } else if (result.status === 'FAILED') {
          throw new Error('Try-on failed');
        }
      } catch {
        // Continue polling
      }
    }

    throw new Error('Timeout waiting for result');
  };

  // Try all products
  const handleTryAll = async () => {
    if (!selfieImage || !selfieFile) {
      toast({ title: 'Photo required', description: 'Please upload your photo first', variant: 'destructive' });
      return;
    }

    setTryAllMode(true);
    setTryAllProgress(0);
    setStep('gallery');

    const productsToTry = filteredProducts.slice(0, 10); // Limit to 10 for demo
    const results: TryOnResult[] = [];

    for (let i = 0; i < productsToTry.length; i++) {
      const product = productsToTry[i];
      setTryAllProgress(((i + 1) / productsToTry.length) * 100);

      try {
        const formData = new FormData();
        formData.append('selfie_image', selfieFile);

        const productImageResponse = await fetch(product.image);
        const productImageBlob = await productImageResponse.blob();
        const productImageFile = new File([productImageBlob], 'product.jpg', { type: 'image/jpeg' });
        formData.append('product_image', productImageFile);
        formData.append('mode', 'PART');
        formData.append('gender', 'female');

        const API_BASE = import.meta.env.VITE_API_URL || '/api';
        const response = await fetch(`${API_BASE}/tryon`, {
          method: 'POST',
          body: formData,
        });

        if (response.ok) {
          const result = await response.json();
          if (result.status === 'SUCCEEDED' && result.result_image_url) {
            results.push({
              productId: product.id,
              product,
              resultImage: result.result_image_url,
              status: 'done',
            });
          }
        }
      } catch {
        // Use product image as fallback
        results.push({
          productId: product.id,
          product,
          resultImage: product.image,
          status: 'done',
        });
      }

      // Small delay between requests
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    setTryOnResults(results);
    setTryAllMode(false);
    toast({ title: 'Virtual Wardrobe Ready!', description: `${results.length} items tried on` });
  };

  // Render QR Code step
  const renderQRStep = () => (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="flex-1 flex flex-col items-center justify-center px-6 text-center"
    >
      <motion.div
        initial={{ scale: 0.8 }}
        animate={{ scale: 1 }}
        className="w-24 h-24 rounded-3xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center mb-6"
      >
        <Shirt className="w-12 h-12 text-white" />
      </motion.div>

      <h1 className="text-3xl font-bold text-white mb-2">BBA Cloths</h1>
      <p className="text-white/60 mb-8">Premium Fashion Store</p>

      {/* QR Code Display */}
      <div className="bg-white p-4 rounded-2xl mb-6">
        <div className="w-48 h-48 flex items-center justify-center rounded-xl overflow-hidden">
          {qrCodeDataUrl ? (
            <img src={qrCodeDataUrl} alt="Store QR Code" className="w-full h-full" />
          ) : (
            <div className="flex items-center justify-center bg-gray-100 w-full h-full">
              <Loader2 className="w-8 h-8 text-gray-400 animate-spin" />
            </div>
          )}
        </div>
        <p className="text-gray-600 text-xs mt-2 text-center">Scan to enter store</p>
        <p className="text-gray-400 text-[10px] mt-1 text-center truncate max-w-[180px] mx-auto">{storeUrl}</p>
      </div>

      <p className="text-white/50 text-sm mb-6">or</p>

      <Button
        onClick={() => setStep('welcome')}
        className="px-8 py-6 text-lg bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white rounded-2xl font-semibold"
      >
        Enter Virtual Store
        <ChevronRight className="w-5 h-5 ml-2" />
      </Button>
    </motion.div>
  );

  // Render Welcome step
  const renderWelcomeStep = () => (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className="flex-1 flex flex-col px-6 py-8"
    >
      {/* Store Header */}
      <div className="flex items-center gap-4 mb-8">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
          <span className="text-white font-bold text-2xl">B</span>
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">BBA Cloths</h1>
          <p className="text-white/60 text-sm">Mumbai, Maharashtra</p>
        </div>
      </div>

      {/* Features */}
      <div className="space-y-4 mb-8">
        <div className="bg-white/5 rounded-2xl p-4 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-amber-500/20 flex items-center justify-center">
            <Sparkles className="w-6 h-6 text-amber-400" />
          </div>
          <div>
            <h3 className="text-white font-medium">Virtual Try-On</h3>
            <p className="text-white/60 text-sm">See all 25 items on yourself instantly</p>
          </div>
        </div>

        <div className="bg-white/5 rounded-2xl p-4 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-green-500/20 flex items-center justify-center">
            <Grid className="w-6 h-6 text-green-400" />
          </div>
          <div>
            <h3 className="text-white font-medium">Full Inventory</h3>
            <p className="text-white/60 text-sm">T-Shirts, Shirts, Jackets, Dresses & more</p>
          </div>
        </div>

        <div className="bg-white/5 rounded-2xl p-4 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-purple-500/20 flex items-center justify-center">
            <User className="w-6 h-6 text-purple-400" />
          </div>
          <div>
            <h3 className="text-white font-medium">Your Personal Wardrobe</h3>
            <p className="text-white/60 text-sm">One photo, see everything on you</p>
          </div>
        </div>
      </div>

      <div className="mt-auto">
        <Button
          onClick={() => setStep('selfie')}
          className="w-full py-6 text-lg bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white rounded-2xl font-semibold"
        >
          Start Shopping
          <ChevronRight className="w-5 h-5 ml-2" />
        </Button>
      </div>
    </motion.div>
  );

  // Render Selfie step
  const renderSelfieStep = () => (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className="flex-1 flex flex-col px-6 py-8"
    >
      <button onClick={() => setStep('welcome')} className="self-start mb-6">
        <ArrowLeft className="w-6 h-6 text-white" />
      </button>

      <div className="text-center mb-8">
        <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
          <Camera className="w-10 h-10 text-white" />
        </div>
        <h2 className="text-2xl font-bold text-white mb-2">Upload Your Photo</h2>
        <p className="text-white/60">
          We'll show you how all our clothes look on you
        </p>
      </div>

      {/* Photo Upload Area */}
      <div className="flex-1 flex flex-col items-center justify-center">
        {selfieImage ? (
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="relative"
          >
            <img
              src={selfieImage}
              alt="Your photo"
              className="w-64 h-80 object-cover rounded-3xl border-4 border-white/20"
            />
            <button
              onClick={() => {
                setSelfieImage(null);
                setSelfieFile(null);
              }}
              className="absolute -top-2 -right-2 w-8 h-8 bg-red-500 rounded-full flex items-center justify-center"
            >
              <X className="w-4 h-4 text-white" />
            </button>
          </motion.div>
        ) : (
          <button
            onClick={() => fileInputRef.current?.click()}
            className="w-64 h-80 rounded-3xl border-2 border-dashed border-white/30 flex flex-col items-center justify-center gap-4 hover:border-white/50 hover:bg-white/5 transition-all"
          >
            <Camera className="w-12 h-12 text-white/50" />
            <span className="text-white/70">Tap to upload photo</span>
          </button>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="user"
          onChange={handleSelfieSelect}
          className="hidden"
        />
      </div>

      {/* Privacy Note */}
      <div className="text-center text-white/40 text-xs mb-4">
        Your photo is processed securely and deleted after this session
      </div>

      {/* Actions */}
      <div className="space-y-3">
        {!selfieImage ? (
          <Button
            onClick={() => fileInputRef.current?.click()}
            className="w-full py-6 text-lg bg-gradient-to-r from-amber-500 to-orange-600 text-white rounded-2xl font-semibold"
          >
            <Camera className="w-5 h-5 mr-2" />
            Take Photo
          </Button>
        ) : (
          <Button
            onClick={() => setStep('browse')}
            className="w-full py-6 text-lg bg-gradient-to-r from-amber-500 to-orange-600 text-white rounded-2xl font-semibold"
          >
            Continue to Store
            <ChevronRight className="w-5 h-5 ml-2" />
          </Button>
        )}
      </div>
    </motion.div>
  );

  // Render Browse step
  const renderBrowseStep = () => (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="flex-1 flex flex-col"
    >
      {/* Header */}
      <div className="sticky top-0 z-40 bg-midnight/95 backdrop-blur-lg px-4 py-3 border-b border-white/10">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <button onClick={() => setStep('selfie')}>
              <ArrowLeft className="w-5 h-5 text-white" />
            </button>
            <h1 className="text-lg font-bold text-white">BBA Cloths</h1>
          </div>
          <div className="flex items-center gap-2">
            {selfieImage && (
              <img src={selfieImage} alt="You" className="w-8 h-8 rounded-full object-cover border border-white/20" />
            )}
            {tryOnResults.length > 0 && (
              <button
                onClick={() => setStep('gallery')}
                className="bg-amber-500 text-white px-3 py-1 rounded-full text-sm font-medium"
              >
                {tryOnResults.length} tried
              </button>
            )}
          </div>
        </div>

        {/* Try All Button */}
        <Button
          onClick={handleTryAll}
          disabled={isProcessing || tryAllMode}
          className="w-full py-3 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white rounded-xl font-semibold"
        >
          <Sparkles className="w-4 h-4 mr-2" />
          Try All Items On Me
        </Button>
      </div>

      {/* Categories */}
      <div className="px-4 py-3 overflow-x-auto">
        <div className="flex gap-2 min-w-max">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.value}
              onClick={() => setSelectedCategory(cat.value)}
              className={cn(
                'px-4 py-2 rounded-full text-sm font-medium transition-all whitespace-nowrap',
                selectedCategory === cat.value
                  ? 'bg-amber-500 text-white'
                  : 'bg-white/5 text-white/70 hover:bg-white/10'
              )}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Products Grid */}
      <div className="flex-1 px-4 pb-24 overflow-auto">
        <p className="text-white/60 text-sm mb-4">{filteredProducts.length} items</p>

        <div className="grid grid-cols-2 gap-3">
          {filteredProducts.map((product) => {
            const hasResult = tryOnResults.find(r => r.productId === product.id);

            return (
              <motion.div
                key={product.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white/5 rounded-2xl overflow-hidden"
              >
                {/* Product Image */}
                <div className="relative aspect-[3/4]">
                  <img
                    src={hasResult?.resultImage || product.image}
                    alt={product.name}
                    className="w-full h-full object-cover"
                  />

                  {hasResult && (
                    <div className="absolute top-2 right-2 bg-green-500 text-white text-xs px-2 py-1 rounded-lg flex items-center gap-1">
                      <Check className="w-3 h-3" />
                      Tried
                    </div>
                  )}
                </div>

                {/* Product Info */}
                <div className="p-3">
                  <h3 className="text-white text-sm font-medium line-clamp-1">{product.name}</h3>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-white font-bold text-sm">{formatPrice(product.price)}</span>
                    <Button
                      onClick={() => handleTryOn(product)}
                      disabled={isProcessing}
                      size="sm"
                      className="bg-amber-500 hover:bg-amber-600 text-white text-xs px-3 py-1 h-7"
                    >
                      <Sparkles className="w-3 h-3 mr-1" />
                      Try On
                    </Button>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </motion.div>
  );

  // Render Trying step (loading state)
  const renderTryingStep = () => (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="flex-1 flex flex-col items-center justify-center px-6 text-center"
    >
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ repeat: Infinity, duration: 2, ease: 'linear' }}
        className="w-24 h-24 rounded-full bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center mb-6"
      >
        <Sparkles className="w-12 h-12 text-white" />
      </motion.div>

      <h2 className="text-xl font-bold text-white mb-2">Creating Your Look...</h2>
      <p className="text-white/60 mb-2">
        {currentTryingProduct?.name || 'Processing'}
      </p>
      <p className="text-white/40 text-sm">This takes about 15-30 seconds</p>
    </motion.div>
  );

  // Render Gallery step
  const renderGalleryStep = () => (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="flex-1 flex flex-col"
    >
      {/* Header */}
      <div className="sticky top-0 z-40 bg-midnight/95 backdrop-blur-lg px-4 py-4 border-b border-white/10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => setStep('browse')}>
              <ArrowLeft className="w-5 h-5 text-white" />
            </button>
            <h1 className="text-lg font-bold text-white">Your Virtual Wardrobe</h1>
          </div>
          <span className="text-amber-500 font-medium">{tryOnResults.length} looks</span>
        </div>

        {tryAllMode && (
          <div className="mt-3">
            <div className="flex items-center justify-between text-sm text-white/60 mb-1">
              <span>Processing all items...</span>
              <span>{Math.round(tryAllProgress)}%</span>
            </div>
            <div className="h-2 bg-white/10 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-gradient-to-r from-amber-500 to-orange-600"
                initial={{ width: 0 }}
                animate={{ width: `${tryAllProgress}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Results Grid */}
      <div className="flex-1 px-4 py-6 overflow-auto">
        {tryOnResults.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <Sparkles className="w-12 h-12 text-white/30 mb-4" />
            <p className="text-white/60">No try-on results yet</p>
            <p className="text-white/40 text-sm">Go back and try on some clothes!</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {tryOnResults.map((result) => (
              <motion.div
                key={result.productId}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-white/5 rounded-2xl overflow-hidden"
              >
                <div className="aspect-[3/4]">
                  <img
                    src={result.resultImage}
                    alt={result.product.name}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="p-3">
                  <h3 className="text-white text-sm font-medium line-clamp-1">{result.product.name}</h3>
                  <p className="text-amber-500 font-bold text-sm mt-1">{formatPrice(result.product.price)}</p>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-white/10">
        <Button
          onClick={() => setStep('browse')}
          className="w-full py-4 bg-gradient-to-r from-amber-500 to-orange-600 text-white rounded-xl font-semibold"
        >
          <ShoppingBag className="w-5 h-5 mr-2" />
          Continue Shopping
        </Button>
      </div>
    </motion.div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-b from-midnight via-midnight to-amber-950/20 flex flex-col">
      <AnimatePresence mode="wait">
        {step === 'qr' && renderQRStep()}
        {step === 'welcome' && renderWelcomeStep()}
        {step === 'selfie' && renderSelfieStep()}
        {step === 'browse' && renderBrowseStep()}
        {step === 'trying' && renderTryingStep()}
        {step === 'gallery' && renderGalleryStep()}
      </AnimatePresence>
    </div>
  );
}
