import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Store, Package, QrCode, Clock, CheckCircle2, AlertCircle,
  LogOut, RefreshCw, X, MapPin, User, Phone, ChevronRight,
  Scan, ShoppingBag, Loader2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { storeStaffApi } from '@/lib/api';
import type { StoreOrder, StorePlanogram } from '@mrrx/shared';

interface StaffInfo {
  id: string;
  name: string;
  email: string;
  role: string;
  store_id: string;
}

interface OrderWithLocation extends StoreOrder {
  items_with_locations?: Array<{
    item: StoreOrder['items'][0];
    location: StorePlanogram | null;
  }>;
}

export default function StaffDashboardPage() {
  const navigate = useNavigate();
  const [staffInfo, setStaffInfo] = useState<StaffInfo | null>(null);
  const [staffToken, setStaffToken] = useState<string | null>(null);
  const [orders, setOrders] = useState<StoreOrder[]>([]);
  const [activeTab, setActiveTab] = useState<'pending' | 'ready' | 'completed'>('pending');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showScanDialog, setShowScanDialog] = useState(false);
  const [scanInput, setScanInput] = useState('');
  const [scannedOrder, setScannedOrder] = useState<OrderWithLocation | null>(null);
  const [isScanning, setIsScanning] = useState(false);

  const [selectedOrder, setSelectedOrder] = useState<StoreOrder | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Load staff info from localStorage
  useEffect(() => {
    const token = localStorage.getItem('mirrorx_staff_token');
    const info = localStorage.getItem('mirrorx_staff_info');

    if (!token || !info) {
      navigate('/staff/login');
      return;
    }

    setStaffToken(token);
    setStaffInfo(JSON.parse(info));
  }, [navigate]);

  // Fetch orders
  const fetchOrders = useCallback(async () => {
    if (!staffToken) return;

    try {
      setIsLoading(true);
      const status = activeTab === 'pending' ? 'CONFIRMED' : activeTab === 'ready' ? 'READY_FOR_PICKUP' : 'PICKED_UP';
      const { orders: fetchedOrders } = await storeStaffApi.getOrders(staffToken, status);
      setOrders(fetchedOrders);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch orders');
    } finally {
      setIsLoading(false);
    }
  }, [staffToken, activeTab]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(fetchOrders, 30000);
    return () => clearInterval(interval);
  }, [fetchOrders]);

  const handleLogout = () => {
    localStorage.removeItem('mirrorx_staff_token');
    localStorage.removeItem('mirrorx_staff_info');
    navigate('/staff/login');
  };

  const handleScanPickup = async () => {
    if (!staffToken || !scanInput.trim()) return;

    setIsScanning(true);
    try {
      const { order, items_with_locations } = await storeStaffApi.scanPickupPass(
        staffToken,
        scanInput.trim()
      );
      setScannedOrder({ ...order, items_with_locations });
      setScanInput('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid pickup pass');
    } finally {
      setIsScanning(false);
    }
  };

  const handleMarkReady = async (orderId: string) => {
    if (!staffToken) return;

    setIsProcessing(true);
    try {
      await storeStaffApi.markReadyForPickup(staffToken, orderId);
      await fetchOrders();
      setSelectedOrder(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update order');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCompletePickup = async (orderId: string) => {
    if (!staffToken) return;

    setIsProcessing(true);
    try {
      await storeStaffApi.completePickup(staffToken, orderId);
      await fetchOrders();
      setScannedOrder(null);
      setShowScanDialog(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to complete pickup');
    } finally {
      setIsProcessing(false);
    }
  };

  const formatPrice = (paise: number) => {
    return `₹${(paise / 100).toLocaleString('en-IN')}`;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'CONFIRMED': return 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20';
      case 'READY_FOR_PICKUP': return 'bg-green-500/10 text-green-400 border-green-500/20';
      case 'PICKED_UP': return 'bg-white/5 text-white/50 border-white/10';
      default: return 'bg-white/5 text-white/50 border-white/10';
    }
  };

  if (!staffInfo) {
    return null;
  }

  return (
    <div className="min-h-screen bg-midnight">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-midnight/95 backdrop-blur-lg border-b border-white/10">
        <div className="max-w-4xl mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center">
                <Store className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-white font-bold">Staff Portal</h1>
                <p className="text-white/50 text-xs">{staffInfo.name} | {staffInfo.role}</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                className="border-white/10 text-white hover:bg-white/10"
                onClick={fetchOrders}
                disabled={isLoading}
              >
                <RefreshCw className={cn('w-4 h-4', isLoading && 'animate-spin')} />
              </Button>
              <Button
                size="sm"
                className="bg-green-500 hover:bg-green-600 text-white"
                onClick={() => setShowScanDialog(true)}
              >
                <Scan className="w-4 h-4 mr-2" />
                Scan Pickup
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-white/60 hover:text-white"
                onClick={handleLogout}
              >
                <LogOut className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6">
        {/* Error Message */}
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center gap-3"
          >
            <AlertCircle className="w-5 h-5 text-red-400" />
            <p className="text-red-400 flex-1">{error}</p>
            <Button
              variant="ghost"
              size="sm"
              className="text-red-400 hover:text-red-300"
              onClick={() => setError(null)}
            >
              <X className="w-4 h-4" />
            </Button>
          </motion.div>
        )}

        {/* Order Stats */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          {[
            { label: 'Pending', value: orders.filter(o => o.status === 'CONFIRMED').length, color: 'text-yellow-400', bg: 'bg-yellow-500/10' },
            { label: 'Ready', value: orders.filter(o => o.status === 'READY_FOR_PICKUP').length, color: 'text-green-400', bg: 'bg-green-500/10' },
            { label: 'Completed Today', value: orders.filter(o => o.status === 'PICKED_UP').length, color: 'text-blue-400', bg: 'bg-blue-500/10' },
          ].map((stat) => (
            <div
              key={stat.label}
              className={cn('rounded-xl p-4 border border-white/5', stat.bg)}
            >
              <p className="text-white/60 text-sm">{stat.label}</p>
              <p className={cn('text-3xl font-bold mt-1', stat.color)}>{stat.value}</p>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
          <TabsList className="w-full bg-white/5 border border-white/10 mb-6">
            <TabsTrigger value="pending" className="flex-1 data-[state=active]:bg-yellow-500/20 data-[state=active]:text-yellow-400">
              <Clock className="w-4 h-4 mr-2" />
              Pending
            </TabsTrigger>
            <TabsTrigger value="ready" className="flex-1 data-[state=active]:bg-green-500/20 data-[state=active]:text-green-400">
              <Package className="w-4 h-4 mr-2" />
              Ready
            </TabsTrigger>
            <TabsTrigger value="completed" className="flex-1 data-[state=active]:bg-blue-500/20 data-[state=active]:text-blue-400">
              <CheckCircle2 className="w-4 h-4 mr-2" />
              Completed
            </TabsTrigger>
          </TabsList>

          {/* Orders List */}
          <TabsContent value={activeTab} className="mt-0">
            {isLoading && orders.length === 0 ? (
              <div className="text-center py-12">
                <Loader2 className="w-8 h-8 text-white/40 animate-spin mx-auto mb-3" />
                <p className="text-white/60">Loading orders...</p>
              </div>
            ) : orders.length === 0 ? (
              <div className="text-center py-12">
                <ShoppingBag className="w-12 h-12 text-white/20 mx-auto mb-3" />
                <p className="text-white/60">No {activeTab} orders</p>
              </div>
            ) : (
              <div className="space-y-3">
                <AnimatePresence>
                  {orders.map((order, index) => (
                    <motion.div
                      key={order.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, x: -100 }}
                      transition={{ delay: index * 0.05 }}
                      className="bg-white/5 rounded-xl p-4 border border-white/5 cursor-pointer hover:border-white/20 transition-all"
                      onClick={() => setSelectedOrder(order)}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="flex items-center gap-3">
                            <span className="text-white font-bold">{order.order_number}</span>
                            <span className={cn(
                              'px-2 py-0.5 rounded text-xs font-medium border',
                              getStatusColor(order.status)
                            )}>
                              {order.status.replace(/_/g, ' ')}
                            </span>
                          </div>
                          <div className="flex items-center gap-4 mt-2 text-sm text-white/60">
                            <span className="flex items-center gap-1">
                              <User className="w-3 h-3" />
                              {order.customer_name}
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {new Date(order.created_at).toLocaleTimeString('en-IN', {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-white font-bold">{formatPrice(order.total)}</p>
                          <p className="text-white/40 text-sm">{order.items?.length || 0} items</p>
                        </div>
                        <ChevronRight className="w-5 h-5 text-white/40 ml-2" />
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </main>

      {/* Scan Pickup Dialog */}
      <Dialog open={showScanDialog} onOpenChange={setShowScanDialog}>
        <DialogContent className="bg-midnight border-white/10 text-white max-w-md">
          <DialogHeader>
            <DialogTitle>Scan Pickup Pass</DialogTitle>
          </DialogHeader>

          {!scannedOrder ? (
            <div className="space-y-4">
              <div className="relative">
                <QrCode className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-white/40" />
                <Input
                  placeholder="Enter pickup code (e.g., MX-ABC123)"
                  value={scanInput}
                  onChange={(e) => setScanInput(e.target.value.toUpperCase())}
                  onKeyDown={(e) => e.key === 'Enter' && handleScanPickup()}
                  className="pl-10 bg-white/5 border-white/10 text-white text-lg font-mono tracking-wider"
                  autoFocus
                />
              </div>

              <Button
                className="w-full bg-green-500 hover:bg-green-600 text-white h-12"
                onClick={handleScanPickup}
                disabled={isScanning || !scanInput.trim()}
              >
                {isScanning ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    <Scan className="w-5 h-5 mr-2" />
                    Verify Pass
                  </>
                )}
              </Button>

              <p className="text-white/40 text-sm text-center">
                Enter the pickup pass code shown on customer's phone
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Order Info */}
              <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4">
                <div className="flex items-center gap-2 text-green-400 mb-2">
                  <CheckCircle2 className="w-5 h-5" />
                  <span className="font-bold">Valid Pickup Pass</span>
                </div>
                <p className="text-white font-bold text-lg">{scannedOrder.order_number}</p>
              </div>

              {/* Customer Info */}
              <div className="bg-white/5 rounded-lg p-4">
                <h4 className="text-white/60 text-sm mb-2">Customer</h4>
                <p className="text-white font-medium">{scannedOrder.customer_name}</p>
                {scannedOrder.customer_phone && (
                  <p className="text-white/60 text-sm flex items-center gap-1 mt-1">
                    <Phone className="w-3 h-3" />
                    {scannedOrder.customer_phone}
                  </p>
                )}
              </div>

              {/* Items with Locations */}
              <div className="bg-white/5 rounded-lg p-4">
                <h4 className="text-white/60 text-sm mb-3">
                  Items to Pick ({scannedOrder.items_with_locations?.length || 0})
                </h4>
                <div className="space-y-3">
                  {scannedOrder.items_with_locations?.map((itemData, index) => (
                    <div key={index} className="flex items-start gap-3 pb-3 border-b border-white/5 last:border-0 last:pb-0">
                      <div className="w-8 h-8 rounded bg-white/10 flex items-center justify-center text-white font-bold text-sm">
                        {itemData.item.quantity}x
                      </div>
                      <div className="flex-1">
                        <p className="text-white text-sm">{(itemData.item as any).product?.name || 'Product'}</p>
                        <p className="text-white/40 text-xs">
                          Size: {itemData.item.size} | Color: {itemData.item.color}
                        </p>
                        {itemData.location && (
                          <p className="text-indigo-400 text-xs mt-1 flex items-center gap-1">
                            <MapPin className="w-3 h-3" />
                            Aisle {itemData.location.aisle} / Row {itemData.location.row} / Shelf {itemData.location.shelf}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Total */}
              <div className="flex items-center justify-between py-3 border-t border-white/10">
                <span className="text-white/60">Total</span>
                <span className="text-white text-xl font-bold">{formatPrice(scannedOrder.total)}</span>
              </div>

              {/* Actions */}
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  className="flex-1 border-white/10 text-white hover:bg-white/10"
                  onClick={() => {
                    setScannedOrder(null);
                    setScanInput('');
                  }}
                >
                  Cancel
                </Button>
                <Button
                  className="flex-1 bg-green-500 hover:bg-green-600 text-white"
                  onClick={() => handleCompletePickup(scannedOrder.id)}
                  disabled={isProcessing}
                >
                  {isProcessing ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <>
                      <CheckCircle2 className="w-5 h-5 mr-2" />
                      Complete Pickup
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Order Details Dialog */}
      <Dialog open={!!selectedOrder} onOpenChange={(open) => !open && setSelectedOrder(null)}>
        <DialogContent className="bg-midnight border-white/10 text-white max-w-md">
          <DialogHeader>
            <DialogTitle>Order Details</DialogTitle>
          </DialogHeader>

          {selectedOrder && (
            <div className="space-y-4">
              {/* Order Info */}
              <div className="flex items-center justify-between">
                <span className="text-white font-bold text-lg">{selectedOrder.order_number}</span>
                <span className={cn(
                  'px-2 py-1 rounded text-sm font-medium border',
                  getStatusColor(selectedOrder.status)
                )}>
                  {selectedOrder.status.replace(/_/g, ' ')}
                </span>
              </div>

              {/* Customer Info */}
              <div className="bg-white/5 rounded-lg p-4">
                <h4 className="text-white/60 text-sm mb-2">Customer</h4>
                <p className="text-white font-medium">{selectedOrder.customer_name}</p>
                {selectedOrder.customer_phone && (
                  <p className="text-white/60 text-sm">{selectedOrder.customer_phone}</p>
                )}
                {selectedOrder.customer_email && (
                  <p className="text-white/60 text-sm">{selectedOrder.customer_email}</p>
                )}
              </div>

              {/* Items */}
              <div className="bg-white/5 rounded-lg p-4">
                <h4 className="text-white/60 text-sm mb-3">Items ({selectedOrder.items?.length || 0})</h4>
                <div className="space-y-2">
                  {selectedOrder.items?.map((item, index) => (
                    <div key={index} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
                      <div>
                        <p className="text-white text-sm">{(item as any).product?.name || 'Product'}</p>
                        <p className="text-white/40 text-xs">
                          Size: {item.size} | Color: {item.color} | Qty: {item.quantity}
                        </p>
                      </div>
                      <span className="text-white font-medium">{formatPrice(item.total_price)}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Pricing */}
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-white/60">Subtotal</span>
                  <span className="text-white">{formatPrice(selectedOrder.subtotal)}</span>
                </div>
                {selectedOrder.discount > 0 && (
                  <div className="flex justify-between text-green-400">
                    <span>Discount</span>
                    <span>-{formatPrice(selectedOrder.discount)}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-white/60">Tax (GST 18%)</span>
                  <span className="text-white">{formatPrice(selectedOrder.tax)}</span>
                </div>
                <div className="flex justify-between pt-2 border-t border-white/10">
                  <span className="text-white font-medium">Total</span>
                  <span className="text-white font-bold text-lg">{formatPrice(selectedOrder.total)}</span>
                </div>
              </div>

              {/* Actions */}
              {selectedOrder.status === 'CONFIRMED' && (
                <Button
                  className="w-full bg-green-500 hover:bg-green-600 text-white"
                  onClick={() => handleMarkReady(selectedOrder.id)}
                  disabled={isProcessing}
                >
                  {isProcessing ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <>
                      <Package className="w-5 h-5 mr-2" />
                      Mark Ready for Pickup
                    </>
                  )}
                </Button>
              )}

              {selectedOrder.status === 'READY_FOR_PICKUP' && (
                <div className="text-center py-4">
                  <p className="text-white/60">Waiting for customer to collect</p>
                  <p className="text-green-400 font-medium mt-1">Ready for Pickup</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
