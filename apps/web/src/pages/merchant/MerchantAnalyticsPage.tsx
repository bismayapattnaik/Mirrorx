import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  BarChart3, TrendingUp, TrendingDown, ShoppingBag,
  Eye, MousePointer, CreditCard, Calendar, Download
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useMerchantStore } from '@/store/merchant-store';

export default function MerchantAnalyticsPage() {
  const {
    selectedStore,
    analytics,
    fetchAnalytics,
  } = useMerchantStore();

  const [dateRange, setDateRange] = useState<'today' | 'week' | 'month'>('week');

  useEffect(() => {
    if (selectedStore) {
      fetchAnalytics({ period: dateRange });
    }
  }, [selectedStore, dateRange, fetchAnalytics]);

  const formatPrice = (paise: number) => {
    return `₹${(paise / 100).toLocaleString('en-IN')}`;
  };

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

  const downloadCSV = () => {
    const headers = ['Date', 'Sessions', 'Try-Ons', 'Orders', 'Revenue'];
    const rows = displayAnalytics.dailyMetrics.map(d => [
      d.date,
      d.sessions,
      d.tryons,
      d.orders,
      (d.revenue / 100).toFixed(2),
    ]);

    const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mirrorx_analytics_${selectedStore?.slug}_${dateRange}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!selectedStore) {
    return (
      <div className="p-8 text-center">
        <BarChart3 className="w-16 h-16 text-white/20 mx-auto mb-4" />
        <h2 className="text-white text-xl font-semibold mb-2">No Store Selected</h2>
        <p className="text-white/60">Select a store from the sidebar to view analytics</p>
      </div>
    );
  }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Analytics</h1>
          <p className="text-white/60">{selectedStore.name} performance metrics</p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex gap-2 bg-white/5 rounded-lg p-1">
            {['today', 'week', 'month'].map((range) => (
              <button
                key={range}
                onClick={() => setDateRange(range as any)}
                className={cn(
                  'px-4 py-2 rounded-lg text-sm font-medium transition-all capitalize',
                  dateRange === range
                    ? 'bg-indigo-500 text-white'
                    : 'text-white/60 hover:text-white'
                )}
              >
                {range}
              </button>
            ))}
          </div>
          <Button
            variant="outline"
            className="border-white/10 text-white hover:bg-white/10"
            onClick={downloadCSV}
          >
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          {
            label: 'Total Sessions',
            value: displayAnalytics.totalSessions.toLocaleString(),
            trend: displayAnalytics.sessionsTrend,
            icon: Eye,
            color: 'from-blue-500 to-blue-600',
          },
          {
            label: 'Try-Ons',
            value: displayAnalytics.totalTryOns.toLocaleString(),
            trend: displayAnalytics.tryOnsTrend,
            icon: MousePointer,
            color: 'from-purple-500 to-purple-600',
          },
          {
            label: 'Orders',
            value: displayAnalytics.totalOrders.toLocaleString(),
            trend: displayAnalytics.ordersTrend,
            icon: ShoppingBag,
            color: 'from-green-500 to-green-600',
          },
          {
            label: 'Revenue',
            value: formatPrice(displayAnalytics.totalRevenue),
            trend: displayAnalytics.revenueTrend,
            icon: CreditCard,
            color: 'from-amber-500 to-amber-600',
          },
        ].map((stat, index) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className="bg-white/5 rounded-2xl p-5 border border-white/5 relative overflow-hidden"
          >
            <div className={cn(
              'absolute top-0 right-0 w-24 h-24 rounded-full blur-3xl opacity-20 bg-gradient-to-br',
              stat.color
            )} />
            <div className="relative">
              <div className={cn(
                'w-10 h-10 rounded-xl flex items-center justify-center mb-3 bg-gradient-to-br',
                stat.color
              )}>
                <stat.icon className="w-5 h-5 text-white" />
              </div>
              <p className="text-white/50 text-sm">{stat.label}</p>
              <p className="text-white text-2xl font-bold mt-1">{stat.value}</p>
              <div className={cn(
                'flex items-center gap-1 mt-2 text-sm',
                stat.trend > 0 ? 'text-green-400' : stat.trend < 0 ? 'text-red-400' : 'text-white/40'
              )}>
                {stat.trend !== 0 && (
                  stat.trend > 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />
                )}
                <span>{stat.trend > 0 ? '+' : ''}{stat.trend}% vs previous</span>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-8">
        {/* Conversion Funnel */}
        <div className="bg-white/5 rounded-2xl p-6 border border-white/5">
          <h3 className="text-white font-semibold mb-6 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-indigo-400" />
            Conversion Funnel
          </h3>
          <div className="space-y-4">
            {[
              { label: 'QR Scans', value: displayAnalytics.funnelData.scans, color: 'bg-blue-500' },
              { label: 'Sessions Started', value: displayAnalytics.funnelData.sessions, color: 'bg-indigo-500' },
              { label: 'Try-Ons Completed', value: displayAnalytics.funnelData.tryons, color: 'bg-purple-500' },
              { label: 'Added to Cart', value: displayAnalytics.funnelData.addToCart, color: 'bg-pink-500' },
              { label: 'Checkout Started', value: displayAnalytics.funnelData.checkout, color: 'bg-orange-500' },
              { label: 'Orders Paid', value: displayAnalytics.funnelData.paid, color: 'bg-green-500' },
            ].map((step, index, arr) => {
              const maxValue = arr[0].value || 1;
              const percentage = (step.value / maxValue) * 100;
              const conversionFromPrev = index > 0 && arr[index - 1].value > 0
                ? ((step.value / arr[index - 1].value) * 100).toFixed(1)
                : null;

              return (
                <div key={step.label}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-white/70 text-sm">{step.label}</span>
                    <div className="flex items-center gap-3">
                      {conversionFromPrev && (
                        <span className="text-white/40 text-xs">{conversionFromPrev}%</span>
                      )}
                      <span className="text-white font-medium">{step.value.toLocaleString()}</span>
                    </div>
                  </div>
                  <div className="h-3 bg-white/5 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${percentage}%` }}
                      transition={{ duration: 0.5, delay: index * 0.1 }}
                      className={cn('h-full rounded-full', step.color)}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Overall Conversion Rate */}
          <div className="mt-6 pt-6 border-t border-white/10">
            <div className="flex items-center justify-between">
              <span className="text-white/60">Overall Conversion Rate</span>
              <span className="text-green-400 text-2xl font-bold">
                {displayAnalytics.conversionRate.toFixed(1)}%
              </span>
            </div>
            <p className="text-white/40 text-sm mt-1">
              From scan to paid order
            </p>
          </div>
        </div>

        {/* Key Metrics */}
        <div className="space-y-6">
          {/* Average Order Value */}
          <div className="bg-white/5 rounded-2xl p-6 border border-white/5">
            <h3 className="text-white font-semibold mb-4">Key Metrics</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white/5 rounded-xl p-4">
                <p className="text-white/50 text-sm">Avg Order Value</p>
                <p className="text-white text-xl font-bold mt-1">
                  {formatPrice(displayAnalytics.avgOrderValue)}
                </p>
              </div>
              <div className="bg-white/5 rounded-xl p-4">
                <p className="text-white/50 text-sm">Try-On Rate</p>
                <p className="text-white text-xl font-bold mt-1">
                  {displayAnalytics.totalSessions > 0
                    ? ((displayAnalytics.totalTryOns / displayAnalytics.totalSessions) * 100).toFixed(1)
                    : 0}%
                </p>
              </div>
              <div className="bg-white/5 rounded-xl p-4">
                <p className="text-white/50 text-sm">Cart Rate</p>
                <p className="text-white text-xl font-bold mt-1">
                  {displayAnalytics.totalTryOns > 0
                    ? ((displayAnalytics.funnelData.addToCart / displayAnalytics.totalTryOns) * 100).toFixed(1)
                    : 0}%
                </p>
              </div>
              <div className="bg-white/5 rounded-xl p-4">
                <p className="text-white/50 text-sm">Checkout Rate</p>
                <p className="text-white text-xl font-bold mt-1">
                  {displayAnalytics.funnelData.addToCart > 0
                    ? ((displayAnalytics.funnelData.paid / displayAnalytics.funnelData.addToCart) * 100).toFixed(1)
                    : 0}%
                </p>
              </div>
            </div>
          </div>

          {/* Top Products */}
          <div className="bg-white/5 rounded-2xl p-6 border border-white/5">
            <h3 className="text-white font-semibold mb-4">Top Products</h3>
            {displayAnalytics.topProducts.length === 0 ? (
              <p className="text-white/40 text-center py-8">No product data available</p>
            ) : (
              <div className="space-y-3">
                {displayAnalytics.topProducts.slice(0, 5).map((product, index) => (
                  <div
                    key={product.id}
                    className="flex items-center gap-4 p-3 bg-white/5 rounded-xl"
                  >
                    <span className="w-6 h-6 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center text-sm font-bold">
                      {index + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-sm font-medium truncate">{product.name}</p>
                      <p className="text-white/40 text-xs">
                        {product.tryons} try-ons | {product.orders} orders
                      </p>
                    </div>
                    <span className="text-green-400 font-medium">
                      {formatPrice(product.revenue)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Daily Metrics Chart (Simple representation) */}
      {displayAnalytics.dailyMetrics.length > 0 && (
        <div className="mt-8 bg-white/5 rounded-2xl p-6 border border-white/5">
          <h3 className="text-white font-semibold mb-6 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-indigo-400" />
            Daily Performance
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left py-3 px-4 text-white/60 font-medium text-sm">Date</th>
                  <th className="text-right py-3 px-4 text-white/60 font-medium text-sm">Sessions</th>
                  <th className="text-right py-3 px-4 text-white/60 font-medium text-sm">Try-Ons</th>
                  <th className="text-right py-3 px-4 text-white/60 font-medium text-sm">Orders</th>
                  <th className="text-right py-3 px-4 text-white/60 font-medium text-sm">Revenue</th>
                </tr>
              </thead>
              <tbody>
                {displayAnalytics.dailyMetrics.map((day, index) => (
                  <tr key={day.date} className={index % 2 === 0 ? 'bg-white/[0.02]' : ''}>
                    <td className="py-3 px-4 text-white">
                      {new Date(day.date).toLocaleDateString('en-IN', {
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </td>
                    <td className="py-3 px-4 text-white text-right">{day.sessions}</td>
                    <td className="py-3 px-4 text-white text-right">{day.tryons}</td>
                    <td className="py-3 px-4 text-white text-right">{day.orders}</td>
                    <td className="py-3 px-4 text-green-400 text-right font-medium">
                      {formatPrice(day.revenue)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
