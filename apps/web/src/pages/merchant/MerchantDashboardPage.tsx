import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Store, BarChart3, Package, Users, QrCode, Settings, Plus,
  ShoppingBag, Eye, MousePointer, CreditCard,
  ArrowUpRight, ArrowDownRight, Clock, MapPin
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

// Mock data for demo - in production, this would come from API
const MOCK_STORES = [
  {
    id: '1',
    name: 'Fashion Hub - Indiranagar',
    slug: 'fashion-hub-indiranagar',
    status: 'ACTIVE',
    city: 'Bangalore',
    metrics: {
      todaySessions: 47,
      todayTryOns: 89,
      todayOrders: 12,
      todayRevenue: 4567800, // in paise
      conversionRate: 25.5,
    },
  },
  {
    id: '2',
    name: 'Fashion Hub - Koramangala',
    slug: 'fashion-hub-koramangala',
    status: 'ACTIVE',
    city: 'Bangalore',
    metrics: {
      todaySessions: 32,
      todayTryOns: 61,
      todayOrders: 8,
      todayRevenue: 3245600,
      conversionRate: 25.0,
    },
  },
];

const MOCK_ANALYTICS = {
  totalSessions: 1247,
  totalTryOns: 3891,
  totalOrders: 312,
  totalRevenue: 15673400,
  avgOrderValue: 502350,
  conversionRate: 25.0,
  sessionsTrend: 12.5,
  tryOnsTrend: 8.3,
  ordersTrend: 15.2,
  revenueTrend: 22.1,
};

const RECENT_ORDERS = [
  { id: 'MX-BLR-260126-0001', time: '10:45 AM', amount: 456700, status: 'READY_FOR_PICKUP', items: 3 },
  { id: 'MX-BLR-260126-0002', time: '11:12 AM', amount: 234500, status: 'CONFIRMED', items: 2 },
  { id: 'MX-BLR-260126-0003', time: '11:30 AM', amount: 678900, status: 'PICKED_UP', items: 4 },
  { id: 'MX-BLR-260126-0004', time: '12:05 PM', amount: 123400, status: 'CONFIRMED', items: 1 },
];

export default function MerchantDashboardPage() {
  const [dateRange, setDateRange] = useState<'today' | 'week' | 'month'>('today');

  const formatPrice = (paise: number) => {
    return `₹${(paise / 100).toLocaleString('en-IN')}`;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'CONFIRMED': return 'text-yellow-400 bg-yellow-400/10';
      case 'READY_FOR_PICKUP': return 'text-green-400 bg-green-400/10';
      case 'PICKED_UP': return 'text-white/50 bg-white/5';
      default: return 'text-white/50 bg-white/5';
    }
  };

  return (
    <div className="min-h-screen bg-midnight">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-midnight/95 backdrop-blur-lg border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                <Store className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-white font-bold">MirrorX Store Mode</h1>
                <p className="text-white/50 text-xs">Merchant Portal</p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <Button variant="outline" size="sm" className="border-white/10 text-white hover:bg-white/10">
                <Settings className="w-4 h-4 mr-2" />
                Settings
              </Button>
              <Button size="sm" className="bg-indigo-500 hover:bg-indigo-600 text-white">
                <Plus className="w-4 h-4 mr-2" />
                Add Store
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Overview Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[
            {
              label: 'Total Sessions',
              value: MOCK_ANALYTICS.totalSessions,
              trend: MOCK_ANALYTICS.sessionsTrend,
              icon: Eye,
              color: 'text-blue-400',
            },
            {
              label: 'Try-Ons',
              value: MOCK_ANALYTICS.totalTryOns,
              trend: MOCK_ANALYTICS.tryOnsTrend,
              icon: MousePointer,
              color: 'text-purple-400',
            },
            {
              label: 'Orders',
              value: MOCK_ANALYTICS.totalOrders,
              trend: MOCK_ANALYTICS.ordersTrend,
              icon: ShoppingBag,
              color: 'text-green-400',
            },
            {
              label: 'Revenue',
              value: formatPrice(MOCK_ANALYTICS.totalRevenue),
              trend: MOCK_ANALYTICS.revenueTrend,
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
                <div className={`flex items-center gap-1 text-sm ${stat.trend > 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {stat.trend > 0 ? (
                    <ArrowUpRight className="w-4 h-4" />
                  ) : (
                    <ArrowDownRight className="w-4 h-4" />
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
          {/* Stores List */}
          <div className="lg:col-span-2 space-y-6">
            {/* Date Range Filter */}
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-white">Your Stores</h2>
              <div className="flex gap-2">
                {['today', 'week', 'month'].map((range) => (
                  <button
                    key={range}
                    onClick={() => setDateRange(range as any)}
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

            {/* Store Cards */}
            <div className="space-y-4">
              {MOCK_STORES.map((store, index) => (
                <motion.div
                  key={store.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="bg-white/5 rounded-2xl p-6 border border-white/5 hover:border-white/10 transition-all cursor-pointer"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                        <Store className="w-6 h-6 text-white" />
                      </div>
                      <div>
                        <h3 className="text-white font-semibold">{store.name}</h3>
                        <p className="text-white/50 text-sm flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          {store.city}
                        </p>
                      </div>
                    </div>
                    <span className={cn(
                      'px-2 py-1 rounded-lg text-xs font-medium',
                      store.status === 'ACTIVE'
                        ? 'bg-green-500/10 text-green-400'
                        : 'bg-white/5 text-white/50'
                    )}>
                      {store.status}
                    </span>
                  </div>

                  {/* Store Metrics */}
                  <div className="grid grid-cols-5 gap-4">
                    <div>
                      <p className="text-white/40 text-xs">Sessions</p>
                      <p className="text-white font-semibold">{store.metrics.todaySessions}</p>
                    </div>
                    <div>
                      <p className="text-white/40 text-xs">Try-Ons</p>
                      <p className="text-white font-semibold">{store.metrics.todayTryOns}</p>
                    </div>
                    <div>
                      <p className="text-white/40 text-xs">Orders</p>
                      <p className="text-white font-semibold">{store.metrics.todayOrders}</p>
                    </div>
                    <div>
                      <p className="text-white/40 text-xs">Revenue</p>
                      <p className="text-white font-semibold">{formatPrice(store.metrics.todayRevenue)}</p>
                    </div>
                    <div>
                      <p className="text-white/40 text-xs">Conversion</p>
                      <p className="text-green-400 font-semibold">{store.metrics.conversionRate}%</p>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 mt-4 pt-4 border-t border-white/5">
                    <Button variant="outline" size="sm" className="flex-1 border-white/10 text-white hover:bg-white/10">
                      <BarChart3 className="w-4 h-4 mr-2" />
                      Analytics
                    </Button>
                    <Button variant="outline" size="sm" className="flex-1 border-white/10 text-white hover:bg-white/10">
                      <Package className="w-4 h-4 mr-2" />
                      Products
                    </Button>
                    <Button variant="outline" size="sm" className="flex-1 border-white/10 text-white hover:bg-white/10">
                      <QrCode className="w-4 h-4 mr-2" />
                      QR Codes
                    </Button>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>

          {/* Recent Orders */}
          <div className="space-y-6">
            <h2 className="text-xl font-bold text-white">Recent Orders</h2>

            <div className="bg-white/5 rounded-2xl border border-white/5 overflow-hidden">
              <div className="divide-y divide-white/5">
                {RECENT_ORDERS.map((order, index) => (
                  <motion.div
                    key={order.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: index * 0.1 }}
                    className="p-4 hover:bg-white/5 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-white font-medium text-sm">{order.id}</span>
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
                        {order.time}
                      </span>
                      <span className="text-white font-semibold">{formatPrice(order.amount)}</span>
                    </div>
                    <p className="text-white/40 text-xs mt-1">{order.items} items</p>
                  </motion.div>
                ))}
              </div>

              <div className="p-4 border-t border-white/5">
                <Button variant="ghost" className="w-full text-indigo-400 hover:text-indigo-300 hover:bg-indigo-500/10">
                  View All Orders
                </Button>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="bg-white/5 rounded-2xl p-4 border border-white/5">
              <h3 className="text-white font-medium mb-4">Quick Actions</h3>
              <div className="space-y-2">
                <Button variant="outline" className="w-full justify-start border-white/10 text-white hover:bg-white/10">
                  <Users className="w-4 h-4 mr-3 text-indigo-400" />
                  Manage Staff
                </Button>
                <Button variant="outline" className="w-full justify-start border-white/10 text-white hover:bg-white/10">
                  <Package className="w-4 h-4 mr-3 text-purple-400" />
                  Import Products (CSV)
                </Button>
                <Button variant="outline" className="w-full justify-start border-white/10 text-white hover:bg-white/10">
                  <QrCode className="w-4 h-4 mr-3 text-green-400" />
                  Generate QR Codes
                </Button>
                <Button variant="outline" className="w-full justify-start border-white/10 text-white hover:bg-white/10">
                  <BarChart3 className="w-4 h-4 mr-3 text-gold" />
                  Export Analytics
                </Button>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
