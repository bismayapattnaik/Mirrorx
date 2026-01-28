import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, Minus, Plus, Trash2, ShoppingBag, Tag,
  ChevronRight, Loader2, Sparkles
} from 'lucide-react';
import { storeApi } from '@/lib/api';
import { useStoreModeStore } from '@/store/store-mode-store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import type { StoreProduct } from '@mrrx/shared';

export default function StoreCartPage() {
  const navigate = useNavigate();
  const { toast } = useToast();

  const { cart, setCart, setLoading, isLoading } = useStoreModeStore();

  const [couponCode, setCouponCode] = useState('');
  const [isApplyingCoupon, setIsApplyingCoupon] = useState(false);
  const [updatingItemId, setUpdatingItemId] = useState<string | null>(null);

  // Fetch cart on mount
  useEffect(() => {
    const fetchCart = async () => {
      setLoading(true);
      try {
        const response = await storeApi.getCart();
        setCart(response.cart);
      } catch (error) {
        console.error('Failed to fetch cart:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchCart();
  }, []);

  const formatPrice = (paise: number) => {
    return `₹${(paise / 100).toLocaleString('en-IN')}`;
  };

  const handleUpdateQuantity = async (itemId: string, newQuantity: number) => {
    setUpdatingItemId(itemId);
    try {
      if (newQuantity <= 0) {
        const response = await storeApi.removeFromCart(itemId);
        setCart(response.cart);
        toast({
          title: 'Item removed',
          description: 'Item has been removed from your cart',
        });
      } else {
        const response = await storeApi.updateCartItem(itemId, { quantity: newQuantity });
        setCart(response.cart);
      }
    } catch (error) {
      toast({
        title: 'Update failed',
        description: (error as Error).message,
        variant: 'destructive',
      });
    } finally {
      setUpdatingItemId(null);
    }
  };

  const handleRemoveItem = async (itemId: string) => {
    setUpdatingItemId(itemId);
    try {
      const response = await storeApi.removeFromCart(itemId);
      setCart(response.cart);
      toast({
        title: 'Item removed',
        description: 'Item has been removed from your cart',
      });
    } catch (error) {
      toast({
        title: 'Remove failed',
        description: (error as Error).message,
        variant: 'destructive',
      });
    } finally {
      setUpdatingItemId(null);
    }
  };

  const handleApplyCoupon = async () => {
    if (!couponCode.trim()) return;

    setIsApplyingCoupon(true);
    try {
      const response = await storeApi.applyCoupon(couponCode.trim());
      setCart(response.cart);
      toast({
        title: 'Coupon applied!',
        description: `You saved ${formatPrice(response.discount_applied)}`,
      });
      setCouponCode('');
    } catch (error) {
      toast({
        title: 'Invalid coupon',
        description: (error as Error).message,
        variant: 'destructive',
      });
    } finally {
      setIsApplyingCoupon(false);
    }
  };

  const handleCheckout = () => {
    navigate('/store/checkout');
  };

  const cartItems = cart?.items || [];
  const itemCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-midnight flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gold" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-midnight pb-40">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-midnight/95 backdrop-blur-lg border-b border-white/10">
        <div className="flex items-center gap-4 px-4 py-4">
          <button onClick={() => navigate(-1)} className="p-2 -ml-2 rounded-full hover:bg-white/10">
            <ArrowLeft className="w-5 h-5 text-white" />
          </button>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-white">Shopping Cart</h1>
            <p className="text-white/60 text-sm">
              {itemCount} {itemCount === 1 ? 'item' : 'items'}
            </p>
          </div>
        </div>
      </div>

      {cartItems.length === 0 ? (
        // Empty Cart
        <div className="flex flex-col items-center justify-center min-h-[60vh] p-6 text-center">
          <div className="w-24 h-24 rounded-full bg-white/5 flex items-center justify-center mb-6">
            <ShoppingBag className="w-12 h-12 text-white/30" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Your cart is empty</h2>
          <p className="text-white/60 mb-6">Start adding items to see them here</p>
          <Button
            onClick={() => navigate('/store/browse')}
            className="bg-indigo-500 hover:bg-indigo-600 text-white"
          >
            <Sparkles className="w-4 h-4 mr-2" />
            Start Shopping
          </Button>
        </div>
      ) : (
        <>
          {/* Cart Items */}
          <div className="px-4 py-4 space-y-4">
            <AnimatePresence mode="popLayout">
              {cartItems.map((item) => {
                const product = item.product as StoreProduct;
                const isUpdating = updatingItemId === item.id;

                return (
                  <motion.div
                    key={item.id}
                    layout
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: -100 }}
                    className="bg-white/5 rounded-2xl overflow-hidden"
                  >
                    <div className="flex gap-4 p-4">
                      {/* Product Image */}
                      <div className="w-24 h-32 rounded-xl overflow-hidden bg-white/5 flex-shrink-0">
                        <img
                          src={product?.image_url}
                          alt={product?.name}
                          className="w-full h-full object-cover"
                        />
                      </div>

                      {/* Product Info */}
                      <div className="flex-1 min-w-0">
                        {product?.brand && (
                          <p className="text-indigo-400 text-xs font-medium uppercase">
                            {product.brand}
                          </p>
                        )}
                        <h3 className="text-white font-medium mt-1 line-clamp-2">{product?.name}</h3>

                        {/* Size & Color */}
                        <div className="flex gap-2 mt-2">
                          {item.size && (
                            <span className="px-2 py-1 bg-white/10 rounded text-xs text-white/70">
                              Size: {item.size}
                            </span>
                          )}
                          {item.color && (
                            <span className="px-2 py-1 bg-white/10 rounded text-xs text-white/70">
                              {item.color}
                            </span>
                          )}
                        </div>

                        {/* Price */}
                        <p className="text-white font-bold mt-2">{formatPrice(item.unit_price)}</p>
                      </div>

                      {/* Delete Button */}
                      <button
                        onClick={() => handleRemoveItem(item.id)}
                        disabled={isUpdating}
                        className="p-2 h-fit rounded-full hover:bg-white/10 text-white/50 hover:text-red-400 transition-colors"
                      >
                        {isUpdating ? (
                          <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                          <Trash2 className="w-5 h-5" />
                        )}
                      </button>
                    </div>

                    {/* Quantity Controls */}
                    <div className="flex items-center justify-between px-4 py-3 border-t border-white/5">
                      <div className="flex items-center gap-4">
                        <button
                          onClick={() => handleUpdateQuantity(item.id, item.quantity - 1)}
                          disabled={isUpdating}
                          className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20 disabled:opacity-50"
                        >
                          <Minus className="w-4 h-4" />
                        </button>
                        <span className="text-white font-medium w-8 text-center">{item.quantity}</span>
                        <button
                          onClick={() => handleUpdateQuantity(item.id, item.quantity + 1)}
                          disabled={isUpdating}
                          className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20 disabled:opacity-50"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>
                      <p className="text-white font-bold">{formatPrice(item.total_price)}</p>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>

          {/* Coupon Section */}
          <div className="px-4 py-4">
            <div className="bg-white/5 rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <Tag className="w-5 h-5 text-gold" />
                <span className="text-white font-medium">Apply Coupon</span>
              </div>
              <div className="flex gap-2">
                <Input
                  value={couponCode}
                  onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                  placeholder="Enter code"
                  className="flex-1 bg-white/5 border-white/10 text-white uppercase"
                />
                <Button
                  onClick={handleApplyCoupon}
                  disabled={isApplyingCoupon || !couponCode.trim()}
                  className="bg-white/10 hover:bg-white/20 text-white"
                >
                  {isApplyingCoupon ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    'Apply'
                  )}
                </Button>
              </div>
              {cart?.coupon_code && (
                <div className="flex items-center justify-between mt-3 p-2 bg-green-500/10 rounded-lg">
                  <span className="text-green-400 text-sm font-medium">
                    {cart.coupon_code} applied
                  </span>
                  <span className="text-green-400 text-sm">
                    -{formatPrice(cart.discount || 0)}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Order Summary */}
          <div className="px-4 py-4">
            <div className="bg-white/5 rounded-2xl p-4 space-y-3">
              <h3 className="text-white font-medium mb-4">Order Summary</h3>

              <div className="flex justify-between text-white/70">
                <span>Subtotal ({itemCount} items)</span>
                <span>{formatPrice(cart?.subtotal || 0)}</span>
              </div>

              {cart && cart.discount > 0 && (
                <div className="flex justify-between text-green-400">
                  <span>Discount</span>
                  <span>-{formatPrice(cart.discount)}</span>
                </div>
              )}

              <div className="flex justify-between text-white/70">
                <span>GST (18%)</span>
                <span>{formatPrice(cart?.tax || 0)}</span>
              </div>

              <div className="border-t border-white/10 pt-3 mt-3">
                <div className="flex justify-between text-white text-lg font-bold">
                  <span>Total</span>
                  <span>{formatPrice(cart?.total || 0)}</span>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Bottom Action Bar */}
      {cartItems.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-midnight/95 backdrop-blur-lg border-t border-white/10 p-4 safe-area-bottom">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-white/60 text-sm">Total Amount</p>
              <p className="text-2xl font-bold text-white">{formatPrice(cart?.total || 0)}</p>
            </div>
            <div className="text-right">
              <p className="text-white/60 text-sm">{itemCount} items</p>
              {cart && cart.discount > 0 && (
                <p className="text-green-400 text-sm">You save {formatPrice(cart.discount)}</p>
              )}
            </div>
          </div>

          <Button
            onClick={handleCheckout}
            className="w-full py-6 text-lg bg-gradient-to-r from-gold to-amber-500 hover:from-gold/90 hover:to-amber-500/90 text-midnight rounded-2xl font-semibold"
          >
            Proceed to Checkout
            <ChevronRight className="w-5 h-5 ml-2" />
          </Button>
        </div>
      )}
    </div>
  );
}
