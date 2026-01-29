import { useEffect, useState, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Camera, Sparkles, ChevronRight, MapPin, Clock, Shield, Upload } from 'lucide-react';
import { storeApi } from '@/lib/api';
import { useStoreModeStore } from '@/store/store-mode-store';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

export default function StoreEntryPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();

  const {
    setSession,
    setSelfieStatus,
    setLoading,
    setError,
    store,
    hasSelfie,
    error,
  } = useStoreModeStore();

  const [step, setStep] = useState<'loading' | 'welcome' | 'selfie' | 'ready'>('loading');
  const [selfiePreview, setSelfiePreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [consentGiven, setConsentGiven] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const qrCodeId = searchParams.get('qr');

  // Initialize session from QR code
  useEffect(() => {
    async function initSession() {
      if (!qrCodeId) {
        setError('Invalid QR code. Please scan again.');
        setStep('welcome');
        return;
      }

      setLoading(true);
      try {
        const response = await storeApi.createSession(qrCodeId, {
          userAgent: navigator.userAgent,
          screenWidth: window.innerWidth,
          screenHeight: window.innerHeight,
        });

        setSession(
          response.session_token,
          { id: '', store_id: response.store.id } as any,
          response.store,
          response.zones
        );

        // Check if we have a saved selfie
        try {
          const sessionInfo = await storeApi.getSession();
          setSelfieStatus(sessionInfo.has_selfie);
          if (sessionInfo.has_selfie) {
            setStep('ready');
          } else {
            setStep('welcome');
          }
        } catch {
          setStep('welcome');
        }
      } catch (err) {
        setError((err as Error).message);
        setStep('welcome');
        toast({
          title: 'Connection Error',
          description: (err as Error).message,
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    }

    initSession();
  }, [qrCodeId]);

  // Handle selfie upload
  const handleSelfieSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file
    if (!file.type.startsWith('image/')) {
      toast({
        title: 'Invalid file',
        description: 'Please select an image file',
        variant: 'destructive',
      });
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: 'File too large',
        description: 'Please select an image under 10MB',
        variant: 'destructive',
      });
      return;
    }

    // Preview
    const reader = new FileReader();
    reader.onload = async (event) => {
      const base64 = event.target?.result as string;
      setSelfiePreview(base64);

      // Upload
      setIsUploading(true);
      try {
        await storeApi.uploadSelfie(base64, consentGiven);
        setSelfieStatus(true);
        setStep('ready');
        toast({
          title: 'Photo saved!',
          description: 'You can now try on clothes',
        });
      } catch (err) {
        toast({
          title: 'Upload failed',
          description: (err as Error).message,
          variant: 'destructive',
        });
      } finally {
        setIsUploading(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleContinue = () => {
    if (hasSelfie) {
      navigate('/store/browse');
    } else {
      setStep('selfie');
    }
  };

  const handleSkipSelfie = () => {
    navigate('/store/browse');
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-midnight via-midnight to-indigo-950 flex flex-col">
      <AnimatePresence mode="wait">
        {/* Loading State */}
        {step === 'loading' && (
          <motion.div
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex-1 flex items-center justify-center"
          >
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center animate-pulse">
                <Sparkles className="w-8 h-8 text-white" />
              </div>
              <p className="text-white/70">Setting up your experience...</p>
            </div>
          </motion.div>
        )}

        {/* Welcome State */}
        {step === 'welcome' && store && (
          <motion.div
            key="welcome"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="flex-1 flex flex-col"
          >
            {/* Store Banner */}
            {store.banner_url && (
              <div className="relative h-48 overflow-hidden">
                <img
                  src={store.banner_url}
                  alt={store.name}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-midnight via-midnight/50 to-transparent" />
              </div>
            )}

            {/* Content */}
            <div className="flex-1 px-6 py-8 -mt-12 relative z-10">
              {/* Store Logo */}
              <div className="flex items-center gap-4 mb-6">
                {store.logo_url ? (
                  <img
                    src={store.logo_url}
                    alt={store.name}
                    className="w-16 h-16 rounded-2xl object-cover border-2 border-white/20"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center border-2 border-white/20">
                    <span className="text-white font-bold text-2xl">{store.name[0]}</span>
                  </div>
                )}
                <div>
                  <h1 className="text-2xl font-bold text-white">{store.name}</h1>
                  <p className="text-white/60 text-sm flex items-center gap-1">
                    <MapPin className="w-3 h-3" />
                    {store.city}, {store.state}
                  </p>
                </div>
              </div>

              {/* Features */}
              <div className="space-y-4 mb-8">
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.1 }}
                  className="bg-white/5 rounded-2xl p-4 flex items-center gap-4"
                >
                  <div className="w-12 h-12 rounded-xl bg-indigo-500/20 flex items-center justify-center">
                    <Sparkles className="w-6 h-6 text-indigo-400" />
                  </div>
                  <div>
                    <h3 className="text-white font-medium">Virtual Try-On</h3>
                    <p className="text-white/60 text-sm">See how clothes look on you instantly</p>
                  </div>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.2 }}
                  className="bg-white/5 rounded-2xl p-4 flex items-center gap-4"
                >
                  <div className="w-12 h-12 rounded-xl bg-green-500/20 flex items-center justify-center">
                    <MapPin className="w-6 h-6 text-green-400" />
                  </div>
                  <div>
                    <h3 className="text-white font-medium">Find in Store</h3>
                    <p className="text-white/60 text-sm">We'll guide you to the item location</p>
                  </div>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.3 }}
                  className="bg-white/5 rounded-2xl p-4 flex items-center gap-4"
                >
                  <div className="w-12 h-12 rounded-xl bg-gold/20 flex items-center justify-center">
                    <Clock className="w-6 h-6 text-gold" />
                  </div>
                  <div>
                    <h3 className="text-white font-medium">Quick Pickup</h3>
                    <p className="text-white/60 text-sm">Pay on app, skip the billing queue</p>
                  </div>
                </motion.div>
              </div>

              {/* CTA */}
              <Button
                onClick={handleContinue}
                className="w-full py-6 text-lg bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white rounded-2xl font-semibold"
              >
                Start Shopping
                <ChevronRight className="w-5 h-5 ml-2" />
              </Button>
            </div>
          </motion.div>
        )}

        {/* Selfie Upload Step */}
        {step === 'selfie' && (
          <motion.div
            key="selfie"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="flex-1 flex flex-col px-6 py-8"
          >
            <div className="text-center mb-8">
              <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                <Camera className="w-10 h-10 text-white" />
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">Take a Quick Photo</h2>
              <p className="text-white/60">
                Upload a photo of yourself to see how clothes look on you
              </p>
            </div>

            {/* Preview or Upload Area */}
            <div className="flex-1 flex flex-col items-center justify-center">
              {selfiePreview ? (
                <motion.div
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="relative"
                >
                  <img
                    src={selfiePreview}
                    alt="Your photo"
                    className="w-64 h-80 object-cover rounded-3xl border-4 border-white/20"
                  />
                  {isUploading && (
                    <div className="absolute inset-0 bg-midnight/80 rounded-3xl flex items-center justify-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gold" />
                    </div>
                  )}
                </motion.div>
              ) : (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-64 h-80 rounded-3xl border-2 border-dashed border-white/30 flex flex-col items-center justify-center gap-4 hover:border-white/50 hover:bg-white/5 transition-all"
                >
                  <Upload className="w-12 h-12 text-white/50" />
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

            {/* Privacy Note & Consent */}
            <div className="space-y-4 mb-6">
              <div className="flex items-start gap-3 p-4 bg-white/5 rounded-xl border border-white/10">
                <input
                  type="checkbox"
                  id="consent"
                  checked={consentGiven}
                  onChange={(e) => setConsentGiven(e.target.checked)}
                  className="mt-1 w-4 h-4 rounded border-white/20 bg-transparent text-indigo-500 focus:ring-indigo-500"
                />
                <label htmlFor="consent" className="text-sm text-white/70 leading-snug cursor-pointer">
                  I consent to MirrorX processing my photo for the sole purpose of Virtual Try-On.
                  My data will be deleted when this session ends.
                </label>
              </div>

              <div className="flex items-center gap-2 text-white/40 text-xs px-1">
                <Shield className="w-3 h-3" />
                <span>DPDP Act Compliant • Ephemeral Processing</span>
              </div>
            </div>

            {/* Actions */}
            <div className="space-y-3">
              {!selfiePreview && (
                <Button
                  onClick={() => consentGiven ? fileInputRef.current?.click() : toast({ title: "Consent required", description: "Please accept the privacy terms to continue.", variant: "destructive" })}
                  disabled={!consentGiven}
                  className="w-full py-6 text-lg bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white rounded-2xl font-semibold disabled:opacity-50"
                >
                  <Camera className="w-5 h-5 mr-2" />
                  Take Photo
                </Button>
              )}
              <Button
                onClick={handleSkipSelfie}
                variant="ghost"
                className="w-full py-4 text-white/70 hover:text-white hover:bg-white/10"
              >
                Skip for now
              </Button>
            </div>
          </motion.div>
        )}

        {/* Ready State */}
        {step === 'ready' && store && (
          <motion.div
            key="ready"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="flex-1 flex flex-col items-center justify-center px-6 text-center"
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', delay: 0.2 }}
              className="w-24 h-24 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center mb-6"
            >
              <Sparkles className="w-12 h-12 text-white" />
            </motion.div>

            <h2 className="text-2xl font-bold text-white mb-2">You're all set!</h2>
            <p className="text-white/60 mb-8">
              Browse {store.name} and try on clothes virtually
            </p>

            <Button
              onClick={() => navigate('/store/browse')}
              className="px-12 py-6 text-lg bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white rounded-2xl font-semibold"
            >
              Start Browsing
              <ChevronRight className="w-5 h-5 ml-2" />
            </Button>
          </motion.div>
        )}

        {/* Error State */}
        {error && !store && (
          <motion.div
            key="error"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex-1 flex flex-col items-center justify-center px-6 text-center"
          >
            <div className="w-20 h-20 rounded-full bg-red-500/20 flex items-center justify-center mb-6">
              <span className="text-4xl">😕</span>
            </div>
            <h2 className="text-xl font-bold text-white mb-2">Something went wrong</h2>
            <p className="text-white/60 mb-6">{error}</p>
            <Button
              onClick={() => window.location.reload()}
              variant="outline"
              className="border-white/30 text-white hover:bg-white/10"
            >
              Try Again
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
