import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Store, BarChart3, Package, Users, QrCode, Plus,
  ShoppingBag, Eye, MousePointer, CreditCard,
  ArrowUpRight, ArrowDownRight, Clock, MapPin, RefreshCw
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useMerchantStore } from '@/store/merchant-store';

export default function MerchantDashboardPage() {
  const navigate = useNavigate();
  const {
    selectedStore,
    analytics,
    orders,
    isLoading,
    fetchAnalytics,
    fetchOrders,
  } = useMerchantStore();

  const [dateRange, setDateRange] = useState<'today' | 'week' | 'month'>('today');

  useEffect(() => {
    if (selectedStore) {
      fetchAnalytics({ period: dateRange });
      fetchOrders({ limit: 10 });
    }
  }, [selectedStore, dateRange, fetchAnalytics, fetchOrders]);

  const formatPrice = (paise: number) => {
    return `₹${(paise / 100).toLocaleString('en-IN')}`;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'CONFIRMED': return 'text-yellow-400 bg-yellow-400/10';
      case 'READY_FOR_PICKUP': return 'text-green-400 bg-green-400/10';
      case 'PICKED_UP': return 'text-white/50 bg-white/5';
      case 'CANCELLED': return 'text-red-400 bg-red-400/10';
      default: return 'text-white/50 bg-white/5';
    }
  };

  const handleRefresh = () => {
    if (selectedStore) {
      fetchAnalytics({ period: dateRange });
      fetchOrders({ limit: 10 });
    }
  };

  // Default values for analytics
  const displayAnalytics = analytics || {
    totalSessions: 0,
    totalTryOns: 0,
    totalOrders: 0,
    totalRevenue: 0,
    avgOrderValue: 0,
    conversionRate: 0,
    sessionsTrend: 0,
    tryOnsTrend: 0,
    ordersTrend: 0,
    revenueTrend: 0,
    dailyMetrics: [],
    topProducts: [],
    funnelData: { scans: 0, sessions: 0, tryons: 0, addToCart: 0, checkout: 0, paid: 0 },
  };

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Dashboard</h1>
          <p className="text-white/60">
            {selectedStore ? selectedStore.name : 'Select a store to view analytics'}
          </p>
        </div>

        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            size="sm"
            className="border-white/10 text-white hover:bg-white/10"
            onClick={handleRefresh}
            disabled={isLoading}
          >
            <RefreshCw className={cn('w-4 h-4 mr-2', isLoading && 'animate-spin')} />
            Refresh
          </Button>
          <Button
            size="sm"
            className="bg-indigo-500 hover:bg-indigo-600 text-white"
            onClick={() => navigate('/merchant/products')}
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Product
          </Button>
        </div>
      </div>

      {!selectedStore ? (
        <div className="text-center py-20">
          <Store className="w-16 h-16 text-white/20 mx-auto mb-4" />
          <h2 className="text-white text-xl font-semibold mb-2">No Store Selected</h2>
          <p className="text-white/60 mb-6">Select a store from the sidebar to view analytics</p>
          <Button
            className="bg-indigo-500 hover:bg-indigo-600 text-white"
            onClick={() => navigate('/merchant/settings')}
          >
            <Plus className="w-4 h-4 mr-2" />
            Create New Store
          </Button>
        </div>
      ) : (
        <>
          {/* Overview Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {[
              {
                label: 'Total Sessions',
                value: displayAnalytics.totalSessions,
                trend: displayAnalytics.sessionsTrend,
                icon: Eye,
                color: 'text-blue-400',
              },
              {
                label: 'Try-Ons',
                value: displayAnalytics.totalTryOns,
                trend: displayAnalytics.tryOnsTrend,
                icon: MousePointer,
                color: 'text-purple-400',
              },
              {
                label: 'Orders',
                value: displayAnalytics.totalOrders,
                trend: displayAnalytics.ordersTrend,
                icon: ShoppingBag,
                color: 'text-green-400',
              },
              {
                label: 'Revenue',
                value: formatPrice(displayAnalytics.totalRevenue),
                trend: displayAnalytics.revenueTrend,
                icon: CreditCard,
                color: 'text-gold',
                isPrice: true,
              },
            ].map((stat, index) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className="bg-white/5 rounded-2xl p-4 border border-white/5"
              >
                <div className="flex items-center justify-between mb-3">
                  <div className={`w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center ${stat.color}`}>
                    <stat.icon className="w-5 h-5" />
                  </div>
                  <div className={`flex items-center gap-1 text-sm ${stat.trend > 0 ? 'text-green-400' : stat.trend < 0 ? 'text-red-400' : 'text-white/40'}`}>
                    {stat.trend !== 0 && (
                      stat.trend > 0 ? (
                        <ArrowUpRight className="w-4 h-4" />
                      ) : (
                        <ArrowDownRight className="w-4 h-4" />
                      )
                    )}
                    {Math.abs(stat.trend)}%
                  </div>
                </div>
                <p className="text-white/50 text-sm">{stat.label}</p>
                <p className="text-white text-2xl font-bold mt-1">
                  {stat.isPrice ? stat.value : stat.value.toLocaleString()}
                </p>
              </motion.div>
            ))}
          </div>

          <div className="grid lg:grid-cols-3 gap-8">
            {/* Store Info & Quick Actions */}
            <div className="lg:col-span-2 space-y-6">
              {/* Date Range Filter */}
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-white">Store Overview</h2>
                <div className="flex gap-2">
                  {['today', 'week', 'month'].map((range) => (
                    <button
                      key={range}
                      onClick={() => setDateRange(range as 'today' | 'week' | 'month')}
                      className={cn(
                        'px-3 py-1.5 rounded-lg text-sm font-medium transition-all capitalize',
                        dateRange === range
                          ? 'bg-indigo-500 text-white'
                          : 'bg-white/5 text-white/60 hover:bg-white/10'
                      )}
                    >
                      {range}
                    </button>
                  ))}
                </div>
              </div>

              {/* Store Card */}
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className="bg-white/5 rounded-2xl p-6 border border-white/5"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-4">
                    {selectedStore.logo_url ? (
                      <img
                        src={selectedStore.logo_url}
                        alt={selectedStore.name}
                        className="w-12 h-12 rounded-xl object-cover"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                        <Store className="w-6 h-6 text-white" />
                      </div>
                    )}
                    <div>
                      <h3 className="text-white font-semibold">{selectedStore.name}</h3>
                      <p className="text-white/50 text-sm flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {selectedStore.city}, {selectedStore.state}
                      </p>
                    </div>
                  </div>
                  <span className={cn(
                    'px-2 py-1 rounded-lg text-xs font-medium',
                    selectedStore.status === 'ACTIVE'
                      ? 'bg-green-500/10 text-green-400'
                      : 'bg-white/5 text-white/50'
                  )}>
                    {selectedStore.status}
                  </span>
                </div>

                {/* Store Metrics */}
                <div className="grid grid-cols-4 gap-4 mb-4">
                  <div>
                    <p className="text-white/40 text-xs">Conversion</p>
                    <p className="text-green-400 font-semibold">{displayAnalytics.conversionRate.toFixed(1)}%</p>
                  </div>
                  <div>
                    <p className="text-white/40 text-xs">Avg Order</p>
                    <p className="text-white font-semibold">{formatPrice(displayAnalytics.avgOrderValue)}</p>
                  </div>
                  <div>
                    <p className="text-white/40 text-xs">Try-On Rate</p>
                    <p className="text-purple-400 font-semibold">
                      {displayAnalytics.totalSessions > 0
                        ? ((displayAnalytics.totalTryOns / displayAnalytics.totalSessions) * 100).toFixed(1)
                        : 0}%
                    </p>
                  </div>
                  <div>
                    <p className="text-white/40 text-xs">Cart Rate</p>
                    <p className="text-blue-400 font-semibold">
                      {displayAnalytics.totalTryOns > 0
                        ? ((displayAnalytics.funnelData.addToCart / displayAnalytics.totalTryOns) * 100).toFixed(1)
                        : 0}%
                    </p>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2 pt-4 border-t border-white/5">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 border-white/10 text-white hover:bg-white/10"
                    onClick={() => navigate('/merchant/analytics')}
                  >
                    <BarChart3 className="w-4 h-4 mr-2" />
                    Analytics
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 border-white/10 text-white hover:bg-white/10"
                    onClick={() => navigate('/merchant/products')}
                  >
                    <Package className="w-4 h-4 mr-2" />
                    Products
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 border-white/10 text-white hover:bg-white/10"
                    onClick={() => navigate('/merchant/qr-codes')}
                  >
                    <QrCode className="w-4 h-4 mr-2" />
                    QR Codes
                  </Button>
                </div>
              </motion.div>

              {/* Conversion Funnel */}
              <div className="bg-white/5 rounded-2xl p-6 border border-white/5">
                <h3 className="text-white font-semibold mb-4">Conversion Funnel</h3>
                <div className="space-y-3">
                  {[
                    { label: 'QR Scans', value: displayAnalytics.funnelData.scans, color: 'bg-blue-500' },
                    { label: 'Sessions', value: displayAnalytics.funnelData.sessions, color: 'bg-indigo-500' },
                    { label: 'Try-Ons', value: displayAnalytics.funnelData.tryons, color: 'bg-purple-500' },
                    { label: 'Add to Cart', value: displayAnalytics.funnelData.addToCart, color: 'bg-pink-500' },
                    { label: 'Checkout', value: displayAnalytics.funnelData.checkout, color: 'bg-orange-500' },
                    { label: 'Paid', value: displayAnalytics.funnelData.paid, color: 'bg-green-500' },
                  ].map((step, index, arr) => {
                    const maxValue = arr[0].value || 1;
                    const percentage = (step.value / maxValue) * 100;
                    const dropoff = index > 0 && arr[index - 1].value > 0
                      ? ((arr[index - 1].value - step.value) / arr[index - 1].value * 100).toFixed(1)
                      : null;

                    return (
                      <div key={step.label} className="flex items-center gap-4">
                        <span className="text-white/60 text-sm w-24">{step.label}</span>
                        <div className="flex-1 h-6 bg-white/5 rounded-full overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${percentage}%` }}
                            transition={{ duration: 0.5, delay: index * 0.1 }}
                            className={`h-full ${step.color} rounded-full`}
                          />
                        </div>
                        <span className="text-white font-medium w-16 text-right">
                          {step.value.toLocaleString()}
                        </span>
                        {dropoff && (
                          <span className="text-red-400 text-xs w-12">
                            -{dropoff}%
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Recent Orders */}
            <div className="space-y-6">
              <h2 className="text-xl font-bold text-white">Recent Orders</h2>

              <div className="bg-white/5 rounded-2xl border border-white/5 overflow-hidden">
                {orders.length === 0 ? (
                  <div className="p-8 text-center">
                    <ShoppingBag className="w-12 h-12 text-white/20 mx-auto mb-3" />
                    <p className="text-white/60">No orders yet</p>
                  </div>
                ) : (
                  <div className="divide-y divide-white/5">
                    {orders.slice(0, 5).map((order, index) => (
                      <motion.div
                        key={order.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: index * 0.1 }}
                        className="p-4 hover:bg-white/5 transition-colors cursor-pointer"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-white font-medium text-sm">{order.order_number}</span>
                          <span className={cn(
                            'px-2 py-0.5 rounded text-xs font-medium',
                            getStatusColor(order.status)
                          )}>
                            {order.status.replace(/_/g, ' ')}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-white/50 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {new Date(order.created_at).toLocaleTimeString('en-IN', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                          <span className="text-white font-semibold">{formatPrice(order.total)}</span>
                        </div>
                        <p className="text-white/40 text-xs mt-1">
                          {order.items?.length || 0} items
                        </p>
                      </motion.div>
                    ))}
                  </div>
                )}

                <div className="p-4 border-t border-white/5">
                  <Button
                    variant="ghost"
                    className="w-full text-indigo-400 hover:text-indigo-300 hover:bg-indigo-500/10"
                    onClick={() => navigate('/merchant/analytics')}
                  >
                    View All Orders
                  </Button>
                </div>
              </div>

              {/* Quick Actions */}
              <div className="bg-white/5 rounded-2xl p-4 border border-white/5">
                <h3 className="text-white font-medium mb-4">Quick Actions</h3>
                <div className="space-y-2">
                  <Button
                    variant="outline"
                    className="w-full justify-start border-white/10 text-white hover:bg-white/10"
                    onClick={() => navigate('/merchant/staff')}
                  >
                    <Users className="w-4 h-4 mr-3 text-indigo-400" />
                    Manage Staff
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full justify-start border-white/10 text-white hover:bg-white/10"
                    onClick={() => navigate('/merchant/products')}
                  >
                    <Package className="w-4 h-4 mr-3 text-purple-400" />
                    Import Products (CSV)
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full justify-start border-white/10 text-white hover:bg-white/10"
                    onClick={() => navigate('/merchant/qr-codes')}
                  >
                    <QrCode className="w-4 h-4 mr-3 text-green-400" />
                    Generate QR Codes
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full justify-start border-white/10 text-white hover:bg-white/10"
                    onClick={() => navigate('/merchant/analytics')}
                  >
                    <BarChart3 className="w-4 h-4 mr-3 text-gold" />
                    Export Analytics
                  </Button>
                </div>
              </div>

              {/* Top Products */}
              {displayAnalytics.topProducts.length > 0 && (
                <div className="bg-white/5 rounded-2xl p-4 border border-white/5">
                  <h3 className="text-white font-medium mb-4">Top Products</h3>
                  <div className="space-y-3">
                    {displayAnalytics.topProducts.slice(0, 5).map((product, index) => (
                      <div key={product.id} className="flex items-center gap-3">
                        <span className="text-white/40 text-sm w-4">{index + 1}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-white text-sm truncate">{product.name}</p>
                          <p className="text-white/40 text-xs">
                            {product.tryons} try-ons | {product.orders} orders
                          </p>
                        </div>
                        <span className="text-green-400 text-sm font-medium">
                          {formatPrice(product.revenue)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
