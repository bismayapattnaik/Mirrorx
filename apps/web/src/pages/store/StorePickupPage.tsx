import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  CheckCircle2, MapPin, Clock, QrCode, ChevronDown, ChevronUp,
  ShoppingBag, Sparkles, Copy, Share2, Home
} from 'lucide-react';
import { storeApi } from '@/lib/api';
import { useStoreModeStore } from '@/store/store-mode-store';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import QRCodeGenerator from 'qrcode';
import type { StoreOrder, PickupPass, Store } from '@mrrx/shared';

export default function StorePickupPage() {
  const { passCode } = useParams<{ passCode: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  const { currentOrder, pickupPass, store: storeFromState } = useStoreModeStore();

  const [order, setOrder] = useState<StoreOrder | null>(currentOrder);
  const [pass, setPass] = useState<PickupPass | null>(pickupPass);
  const [store, setStore] = useState<Store | null>(storeFromState);
  const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(!order);
  const [showItems, setShowItems] = useState(false);

  // Fetch pickup pass details if not in state
  useEffect(() => {
    const fetchPass = async () => {
      if (!passCode) return;
      if (order && pass) {
        // Generate QR code from existing data
        generateQRCode(pass.qr_data);
        return;
      }

      setIsLoading(true);
      try {
        const response = await storeApi.getPickupPass(passCode);
        setOrder(response.order);
        setPass(response.pickup_pass);
        setStore(response.store);
        generateQRCode(response.pickup_pass.qr_data);
      } catch (error) {
        console.error('Failed to fetch pickup pass:', error);
        toast({
          title: 'Invalid Pass',
          description: 'This pickup pass is not valid',
          variant: 'destructive',
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchPass();
  }, [passCode]);

  const generateQRCode = async (data: string) => {
    try {
      const url = await QRCodeGenerator.toDataURL(data, {
        width: 300,
        margin: 2,
        color: {
          dark: '#1a1a2e',
          light: '#ffffff',
        },
      });
      setQrCodeUrl(url);
    } catch (error) {
      console.error('Failed to generate QR code:', error);
    }
  };

  const formatPrice = (paise: number) => {
    return `₹${(paise / 100).toLocaleString('en-IN')}`;
  };

  const formatTime = (dateString: string | Date) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const handleCopyCode = () => {
    if (pass?.pass_code) {
      navigator.clipboard.writeText(pass.pass_code);
      toast({
        title: 'Copied!',
        description: 'Pass code copied to clipboard',
      });
    }
  };

  const handleShare = async () => {
    if (pass?.pass_code && navigator.share) {
      try {
        await navigator.share({
          title: 'MirrorX Pickup Pass',
          text: `My pickup pass code is: ${pass.pass_code}`,
          url: window.location.href,
        });
      } catch {
        handleCopyCode();
      }
    } else {
      handleCopyCode();
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-midnight flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gold mx-auto mb-4" />
          <p className="text-white/60">Loading your pickup pass...</p>
        </div>
      </div>
    );
  }

  if (!order || !pass) {
    return (
      <div className="min-h-screen bg-midnight flex flex-col items-center justify-center p-6 text-center">
        <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center mb-6">
          <QrCode className="w-10 h-10 text-white/30" />
        </div>
        <h2 className="text-xl font-bold text-white mb-2">Pass Not Found</h2>
        <p className="text-white/60 mb-6">This pickup pass doesn't exist or has expired</p>
        <Button onClick={() => navigate('/store')} className="bg-indigo-500 text-white">
          <Home className="w-4 h-4 mr-2" />
          Back to Store
        </Button>
      </div>
    );
  }

  const isReady = order.status === 'READY_FOR_PICKUP';
  const isPickedUp = order.status === 'PICKED_UP';

  return (
    <div className="min-h-screen bg-gradient-to-b from-midnight via-midnight to-indigo-950">
      {/* Success Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="pt-8 pb-6 px-6 text-center"
      >
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', delay: 0.2 }}
          className={`w-20 h-20 mx-auto rounded-full flex items-center justify-center mb-4 ${
            isPickedUp
              ? 'bg-gradient-to-br from-green-500 to-emerald-600'
              : 'bg-gradient-to-br from-gold to-amber-500'
          }`}
        >
          {isPickedUp ? (
            <CheckCircle2 className="w-10 h-10 text-white" />
          ) : (
            <Sparkles className="w-10 h-10 text-midnight" />
          )}
        </motion.div>

        <h1 className="text-2xl font-bold text-white mb-1">
          {isPickedUp ? 'Order Picked Up!' : 'Order Confirmed!'}
        </h1>
        <p className="text-white/60">
          {isPickedUp
            ? 'Thank you for shopping with us'
            : 'Show this pass at the pickup counter'}
        </p>
      </motion.div>

      {/* QR Code */}
      {!isPickedUp && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.3 }}
          className="mx-6 mb-6"
        >
          <div className="bg-white rounded-3xl p-6 text-center">
            {qrCodeUrl && (
              <img
                src={qrCodeUrl}
                alt="Pickup QR Code"
                className="w-48 h-48 mx-auto mb-4"
              />
            )}

            <div className="flex items-center justify-center gap-2 mb-2">
              <span className="text-3xl font-bold text-midnight tracking-wider">
                {pass.pass_code}
              </span>
              <button
                onClick={handleCopyCode}
                className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <Copy className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <p className="text-gray-500 text-sm">
              Show this code to staff at pickup
            </p>
          </div>
        </motion.div>
      )}

      {/* Status */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="mx-6 mb-6"
      >
        <div className={`rounded-2xl p-4 flex items-center gap-4 ${
          isReady
            ? 'bg-green-500/10 border border-green-500/30'
            : isPickedUp
            ? 'bg-white/5 border border-white/10'
            : 'bg-indigo-500/10 border border-indigo-500/30'
        }`}>
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
            isReady
              ? 'bg-green-500/20'
              : isPickedUp
              ? 'bg-white/10'
              : 'bg-indigo-500/20'
          }`}>
            {isReady ? (
              <CheckCircle2 className="w-6 h-6 text-green-400" />
            ) : isPickedUp ? (
              <ShoppingBag className="w-6 h-6 text-white/50" />
            ) : (
              <Clock className="w-6 h-6 text-indigo-400" />
            )}
          </div>
          <div className="flex-1">
            <p className={`font-medium ${
              isReady
                ? 'text-green-400'
                : isPickedUp
                ? 'text-white/50'
                : 'text-indigo-400'
            }`}>
              {isReady
                ? 'Ready for Pickup!'
                : isPickedUp
                ? 'Order Completed'
                : 'Being Prepared'}
            </p>
            <p className="text-white/60 text-sm">
              {isReady
                ? 'Head to the pickup counter'
                : isPickedUp
                ? `Picked up at ${formatTime(order.picked_up_at!)}`
                : `Estimated ready by ${formatTime(order.pickup_time_estimate!)}`}
            </p>
          </div>
        </div>
      </motion.div>

      {/* Order Details */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="mx-6 mb-6"
      >
        <div className="bg-white/5 rounded-2xl overflow-hidden">
          {/* Order Number */}
          <div className="p-4 border-b border-white/10">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-white/60 text-sm">Order Number</p>
                <p className="text-white font-bold">{order.order_number}</p>
              </div>
              <div className="text-right">
                <p className="text-white/60 text-sm">Total Paid</p>
                <p className="text-white font-bold">{formatPrice(order.total)}</p>
              </div>
            </div>
          </div>

          {/* Store Location */}
          {store && (
            <div className="p-4 border-b border-white/10 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-green-500/20 flex items-center justify-center">
                <MapPin className="w-6 h-6 text-green-400" />
              </div>
              <div>
                <p className="text-white font-medium">{store.name}</p>
                <p className="text-white/60 text-sm">
                  {store.address_line1}, {store.city}
                </p>
              </div>
            </div>
          )}

          {/* Items */}
          <button
            onClick={() => setShowItems(!showItems)}
            className="w-full p-4 flex items-center justify-between hover:bg-white/5 transition-colors"
          >
            <div className="flex items-center gap-3">
              <ShoppingBag className="w-5 h-5 text-white/50" />
              <span className="text-white">
                {order.items?.length || 0} items in order
              </span>
            </div>
            {showItems ? (
              <ChevronUp className="w-5 h-5 text-white/50" />
            ) : (
              <ChevronDown className="w-5 h-5 text-white/50" />
            )}
          </button>

          {/* Items List */}
          {showItems && order.items && (
            <div className="px-4 pb-4 space-y-3">
              {order.items.map((item, index) => {
                const product = typeof item.product_snapshot === 'string'
                  ? JSON.parse(item.product_snapshot)
                  : item.product_snapshot;

                return (
                  <div key={index} className="flex gap-3 p-3 bg-white/5 rounded-xl">
                    <img
                      src={product?.image_url}
                      alt={product?.name}
                      className="w-16 h-20 rounded-lg object-cover"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-medium line-clamp-1">{product?.name}</p>
                      <div className="flex gap-2 mt-1">
                        {item.size && (
                          <span className="text-white/50 text-xs">Size: {item.size}</span>
                        )}
                        {item.color && (
                          <span className="text-white/50 text-xs">{item.color}</span>
                        )}
                      </div>
                      <div className="flex justify-between items-center mt-2">
                        <span className="text-white/60 text-sm">Qty: {item.quantity}</span>
                        <span className="text-white font-medium">{formatPrice(item.total_price)}</span>
                      </div>

                      {/* Location */}
                      {item.location_info && (
                        <div className="mt-2 flex items-center gap-1 text-xs text-green-400">
                          <MapPin className="w-3 h-3" />
                          {[
                            item.location_info.aisle && `Aisle ${item.location_info.aisle}`,
                            item.location_info.rack && `Rack ${item.location_info.rack}`,
                          ].filter(Boolean).join(' → ')}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </motion.div>

      {/* Actions */}
      <div className="px-6 pb-8 space-y-3">
        {!isPickedUp && (
          <Button
            onClick={handleShare}
            variant="outline"
            className="w-full py-4 border-white/20 text-white hover:bg-white/10"
          >
            <Share2 className="w-5 h-5 mr-2" />
            Share Pass
          </Button>
        )}

        <Button
          onClick={() => navigate('/store/browse')}
          className="w-full py-4 bg-indigo-500 hover:bg-indigo-600 text-white"
        >
          <Sparkles className="w-5 h-5 mr-2" />
          Continue Shopping
        </Button>
      </div>
    </div>
  );
}
