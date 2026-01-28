import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Filter, X, Sparkles, MapPin, ChevronDown } from 'lucide-react';
import { storeApi } from '@/lib/api';
import { useStoreModeStore } from '@/store/store-mode-store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import type { StoreProduct, StoreZone, StorePlanogram, StoreProductCategory } from '@mrrx/shared';

const CATEGORIES: { value: StoreProductCategory; label: string }[] = [
  { value: 'tops', label: 'Tops' },
  { value: 'shirts', label: 'Shirts' },
  { value: 'tshirts', label: 'T-Shirts' },
  { value: 'dresses', label: 'Dresses' },
  { value: 'jeans', label: 'Jeans' },
  { value: 'trousers', label: 'Trousers' },
  { value: 'kurtas', label: 'Kurtas' },
  { value: 'sarees', label: 'Sarees' },
  { value: 'jackets', label: 'Jackets' },
  { value: 'ethnicwear', label: 'Ethnic' },
];

export default function StoreBrowsePage() {
  const navigate = useNavigate();
  const {
    store,
    zones,
    products,
    currentZone,
    searchQuery,
    filters,
    setProducts,
    setCurrentZone,
    setSearchQuery,
    setFilters,
    setLoading,
    isLoading,
  } = useStoreModeStore();

  const [showFilters, setShowFilters] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [total, setTotal] = useState(0);

  // Redirect if no store
  useEffect(() => {
    if (!store) {
      navigate('/store');
    }
  }, [store, navigate]);

  // Fetch products
  useEffect(() => {
    if (!store) return;

    const fetchProducts = async () => {
      setLoading(true);
      try {
        const response = await storeApi.getProducts(store.id, {
          zone_id: currentZone?.id,
          category: filters.category,
          gender: filters.gender,
          min_price: filters.minPrice,
          max_price: filters.maxPrice,
          search: searchQuery || undefined,
          page,
          limit: 20,
        });

        if (page === 1) {
          setProducts(response.products);
        } else {
          setProducts([...products, ...response.products]);
        }
        setTotal(response.total);
        setHasMore(response.products.length === 20);
      } catch (error) {
        console.error('Failed to fetch products:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchProducts();
  }, [store?.id, currentZone?.id, filters, searchQuery, page]);

  const handleProductClick = (product: StoreProduct & { location: StorePlanogram | null }) => {
    navigate(`/store/product/${product.id}`);
  };

  const handleZoneSelect = (zone: StoreZone | null) => {
    setCurrentZone(zone);
    setPage(1);
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
  };

  const formatPrice = (paise: number) => {
    return `₹${(paise / 100).toLocaleString('en-IN')}`;
  };

  const getDiscountPercentage = (price: number, originalPrice: number | null) => {
    if (!originalPrice || originalPrice <= price) return null;
    return Math.round(((originalPrice - price) / originalPrice) * 100);
  };

  if (!store) return null;

  return (
    <div className="min-h-screen bg-midnight">
      {/* Search Bar */}
      <div className="sticky top-0 z-40 bg-midnight/95 backdrop-blur-lg px-4 py-3 border-b border-white/10">
        <form onSubmit={handleSearch} className="flex gap-2">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/50" />
            <Input
              type="text"
              placeholder="Search products..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 bg-white/5 border-white/10 text-white placeholder:text-white/50 rounded-xl"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2"
              >
                <X className="w-4 h-4 text-white/50" />
              </button>
            )}
          </div>
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => setShowFilters(true)}
            className="border-white/10 bg-white/5 hover:bg-white/10"
          >
            <Filter className="w-4 h-4 text-white" />
          </Button>
        </form>
      </div>

      {/* Zone Tabs */}
      {zones && zones.length > 0 && (
        <div className="px-4 py-3 overflow-x-auto hide-scrollbar">
          <div className="flex gap-2 min-w-max">
            <button
              onClick={() => handleZoneSelect(null)}
              className={cn(
                'px-4 py-2 rounded-full text-sm font-medium transition-all whitespace-nowrap',
                !currentZone
                  ? 'bg-indigo-500 text-white'
                  : 'bg-white/5 text-white/70 hover:bg-white/10'
              )}
            >
              All Items
            </button>
            {zones.map((zone) => (
              <button
                key={zone.id}
                onClick={() => handleZoneSelect(zone)}
                className={cn(
                  'px-4 py-2 rounded-full text-sm font-medium transition-all whitespace-nowrap',
                  currentZone?.id === zone.id
                    ? 'bg-indigo-500 text-white'
                    : 'bg-white/5 text-white/70 hover:bg-white/10'
                )}
              >
                {zone.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Category Pills */}
      <div className="px-4 py-2 overflow-x-auto hide-scrollbar border-b border-white/5">
        <div className="flex gap-2 min-w-max">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.value}
              onClick={() => setFilters({ ...filters, category: filters.category === cat.value ? undefined : cat.value })}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
                filters.category === cat.value
                  ? 'bg-gold/20 text-gold border border-gold/30'
                  : 'bg-white/5 text-white/60 hover:text-white hover:bg-white/10'
              )}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Results Count */}
      <div className="px-4 py-3 flex items-center justify-between">
        <p className="text-white/60 text-sm">
          {total} {total === 1 ? 'item' : 'items'} found
        </p>
        {currentZone && (
          <span className="text-xs text-indigo-400 flex items-center gap-1">
            <MapPin className="w-3 h-3" />
            {currentZone.floor && `${currentZone.floor} Floor, `}
            {currentZone.section}
          </span>
        )}
      </div>

      {/* Products Grid */}
      <div className="px-4 pb-24">
        {isLoading && page === 1 ? (
          <div className="grid grid-cols-2 gap-3">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="bg-white/5 rounded-2xl aspect-[3/4] animate-pulse" />
            ))}
          </div>
        ) : products.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-white/5 flex items-center justify-center">
              <Search className="w-8 h-8 text-white/30" />
            </div>
            <p className="text-white/60">No products found</p>
            <p className="text-white/40 text-sm mt-1">Try adjusting your filters</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3">
              <AnimatePresence mode="popLayout">
                {products.map((product, index) => {
                  const discount = getDiscountPercentage(product.price, product.original_price);

                  return (
                    <motion.div
                      key={product.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      transition={{ delay: index * 0.05 }}
                      onClick={() => handleProductClick(product)}
                      className="bg-white/5 rounded-2xl overflow-hidden cursor-pointer group hover:bg-white/10 transition-all"
                    >
                      {/* Image */}
                      <div className="relative aspect-[3/4] overflow-hidden">
                        <img
                          src={product.image_url}
                          alt={product.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          loading="lazy"
                        />

                        {/* Discount Badge */}
                        {discount && (
                          <div className="absolute top-2 left-2 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-lg">
                            {discount}% OFF
                          </div>
                        )}

                        {/* Try-On Badge */}
                        {product.is_try_on_enabled && (
                          <div className="absolute top-2 right-2 bg-indigo-500/90 text-white text-xs px-2 py-1 rounded-lg flex items-center gap-1">
                            <Sparkles className="w-3 h-3" />
                            Try On
                          </div>
                        )}

                        {/* Location Indicator */}
                        {product.location && (
                          <div className="absolute bottom-2 left-2 bg-midnight/80 backdrop-blur text-white text-xs px-2 py-1 rounded-lg flex items-center gap-1">
                            <MapPin className="w-3 h-3 text-green-400" />
                            {product.location.aisle && `Aisle ${product.location.aisle}`}
                          </div>
                        )}
                      </div>

                      {/* Info */}
                      <div className="p-3">
                        {product.brand && (
                          <p className="text-white/50 text-xs font-medium uppercase tracking-wide">
                            {product.brand}
                          </p>
                        )}
                        <h3 className="text-white text-sm font-medium mt-1 line-clamp-2">
                          {product.name}
                        </h3>
                        <div className="flex items-baseline gap-2 mt-2">
                          <span className="text-white font-bold">
                            {formatPrice(product.price)}
                          </span>
                          {product.original_price && product.original_price > product.price && (
                            <span className="text-white/40 text-xs line-through">
                              {formatPrice(product.original_price)}
                            </span>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>

            {/* Load More */}
            {hasMore && (
              <div className="mt-6 text-center">
                <Button
                  onClick={() => setPage(page + 1)}
                  variant="outline"
                  disabled={isLoading}
                  className="border-white/10 text-white hover:bg-white/10"
                >
                  {isLoading ? 'Loading...' : 'Load More'}
                  <ChevronDown className="w-4 h-4 ml-2" />
                </Button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Filters Modal */}
      <AnimatePresence>
        {showFilters && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-midnight/95 backdrop-blur-lg"
          >
            <div className="h-full flex flex-col">
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-4 border-b border-white/10">
                <h2 className="text-xl font-bold text-white">Filters</h2>
                <button onClick={() => setShowFilters(false)}>
                  <X className="w-6 h-6 text-white" />
                </button>
              </div>

              {/* Filter Options */}
              <div className="flex-1 overflow-auto p-4 space-y-6">
                {/* Gender */}
                <div>
                  <h3 className="text-white font-medium mb-3">Gender</h3>
                  <div className="flex gap-2">
                    {['male', 'female', 'unisex'].map((g) => (
                      <button
                        key={g}
                        onClick={() => setFilters({ ...filters, gender: filters.gender === g ? undefined : g })}
                        className={cn(
                          'px-4 py-2 rounded-xl text-sm font-medium transition-all capitalize',
                          filters.gender === g
                            ? 'bg-indigo-500 text-white'
                            : 'bg-white/5 text-white/70'
                        )}
                      >
                        {g}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Price Range */}
                <div>
                  <h3 className="text-white font-medium mb-3">Price Range</h3>
                  <div className="flex gap-3">
                    <Input
                      type="number"
                      placeholder="Min ₹"
                      value={filters.minPrice ? filters.minPrice / 100 : ''}
                      onChange={(e) => setFilters({ ...filters, minPrice: e.target.value ? Number(e.target.value) * 100 : undefined })}
                      className="bg-white/5 border-white/10 text-white"
                    />
                    <Input
                      type="number"
                      placeholder="Max ₹"
                      value={filters.maxPrice ? filters.maxPrice / 100 : ''}
                      onChange={(e) => setFilters({ ...filters, maxPrice: e.target.value ? Number(e.target.value) * 100 : undefined })}
                      className="bg-white/5 border-white/10 text-white"
                    />
                  </div>
                </div>

                {/* Quick Price Options */}
                <div>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { label: 'Under ₹500', max: 50000 },
                      { label: '₹500 - ₹1000', min: 50000, max: 100000 },
                      { label: '₹1000 - ₹2000', min: 100000, max: 200000 },
                      { label: 'Above ₹2000', min: 200000 },
                    ].map((option) => (
                      <button
                        key={option.label}
                        onClick={() => setFilters({ ...filters, minPrice: option.min, maxPrice: option.max })}
                        className={cn(
                          'px-3 py-2 rounded-lg text-sm transition-all',
                          filters.minPrice === option.min && filters.maxPrice === option.max
                            ? 'bg-gold/20 text-gold border border-gold/30'
                            : 'bg-white/5 text-white/60'
                        )}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="p-4 border-t border-white/10 space-y-3">
                <Button
                  onClick={() => {
                    setFilters({});
                    setPage(1);
                  }}
                  variant="outline"
                  className="w-full border-white/10 text-white hover:bg-white/10"
                >
                  Clear All
                </Button>
                <Button
                  onClick={() => {
                    setShowFilters(false);
                    setPage(1);
                  }}
                  className="w-full bg-indigo-500 hover:bg-indigo-600 text-white"
                >
                  Apply Filters
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Custom scrollbar hide */}
      <style>{`
        .hide-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .hide-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </div>
  );
}
