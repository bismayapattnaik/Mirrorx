import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Heart,
  Plus,
  Trash2,
  ExternalLink,
  TrendingDown,
  Bell,
  RefreshCw,
  Filter,
  Search,
  ShoppingBag,
  IndianRupee,
  Crown,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useAuthStore } from '@/store/auth-store';
import { wishlistApi, WishlistItem, NotificationPreferences } from '@/lib/api';
import { cn, formatDate } from '@/lib/utils';

const PLATFORMS = [
  { value: 'all', label: 'All Platforms' },
  { value: 'myntra', label: 'Myntra' },
  { value: 'ajio', label: 'Ajio' },
  { value: 'amazon', label: 'Amazon' },
  { value: 'flipkart', label: 'Flipkart' },
  { value: 'meesho', label: 'Meesho' },
];

const OCCASION_TAGS = [
  'office', 'casual', 'party', 'wedding', 'festive', 'vacation', 'date', 'ethnic'
];

export default function WishlistPage() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { user } = useAuthStore();

  const [isLoading, setIsLoading] = useState(true);
  const [items, setItems] = useState<WishlistItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);

  // Filters
  const [search, setSearch] = useState('');
  const [platform, setPlatform] = useState('all');
  const [showOnSale, setShowOnSale] = useState(false);

  // Add item dialog
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [productUrl, setProductUrl] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [isAdding, setIsAdding] = useState(false);

  // Settings dialog
  const [showSettingsDialog, setShowSettingsDialog] = useState(false);
  const [alertSettings, setAlertSettings] = useState<NotificationPreferences | null>(null);

  // Price check
  const [checkingPrice, setCheckingPrice] = useState<string | null>(null);

  const isPremium = user?.subscription_tier !== 'FREE';

  // Fetch wishlist items
  useEffect(() => {
    async function fetchItems() {
      setIsLoading(true);
      try {
        const response = await wishlistApi.list({
          page,
          limit: 20,
          platform: platform !== 'all' ? platform : undefined,
          on_sale: showOnSale || undefined,
        });
        setItems(response.items);
        setTotal(response.total);
      } catch {
        toast({
          variant: 'destructive',
          title: 'Failed to load wishlist',
          description: 'Please try again.',
        });
      } finally {
        setIsLoading(false);
      }
    }

    fetchItems();
  }, [page, platform, showOnSale, toast]);

  // Fetch alert settings
  useEffect(() => {
    async function fetchSettings() {
      try {
        const settings = await wishlistApi.getAlertSettings();
        setAlertSettings(settings);
      } catch {
        // Settings might not exist yet
      }
    }
    fetchSettings();
  }, []);

  const handleAddItem = async () => {
    if (!productUrl.trim()) {
      toast({
        variant: 'destructive',
        title: 'URL required',
        description: 'Please enter a product URL.',
      });
      return;
    }

    setIsAdding(true);
    try {
      const newItem = await wishlistApi.add(productUrl, selectedTags);
      setItems([newItem, ...items]);
      setShowAddDialog(false);
      setProductUrl('');
      setSelectedTags([]);
      toast({
        title: 'Added to wishlist',
        description: newItem.title || 'Product added successfully.',
      });
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Failed to add item',
        description: error.message || 'Could not extract product info.',
      });
    } finally {
      setIsAdding(false);
    }
  };

  const handleCheckPrice = async (item: WishlistItem) => {
    setCheckingPrice(item.id);
    try {
      const result = await wishlistApi.checkPrice(item.id);
      if (result.price_dropped) {
        toast({
          title: 'Price Dropped!',
          description: `Price went from ${formatPrice(result.old_price)} to ${formatPrice(result.new_price)} (-${result.discount_percentage}%)`,
        });
      } else {
        toast({
          title: 'Price checked',
          description: 'No price change detected.',
        });
      }
      // Refresh the item
      const updatedItem = await wishlistApi.get(item.id);
      setItems(items.map((i) => (i.id === item.id ? updatedItem : i)));
    } catch {
      toast({
        variant: 'destructive',
        title: 'Failed to check price',
      });
    } finally {
      setCheckingPrice(null);
    }
  };

  const handleDeleteItem = async (id: string) => {
    try {
      await wishlistApi.delete(id);
      setItems(items.filter((i) => i.id !== id));
      toast({
        title: 'Removed from wishlist',
      });
    } catch {
      toast({
        variant: 'destructive',
        title: 'Failed to remove item',
      });
    }
  };

  const handleUpdateSettings = async (updates: Partial<NotificationPreferences>) => {
    try {
      const updated = await wishlistApi.updateAlertSettings(updates);
      setAlertSettings(updated);
      toast({
        title: 'Settings updated',
      });
    } catch {
      toast({
        variant: 'destructive',
        title: 'Failed to update settings',
      });
    }
  };

  const toggleTag = (tag: string) => {
    if (selectedTags.includes(tag)) {
      setSelectedTags(selectedTags.filter((t) => t !== tag));
    } else {
      setSelectedTags([...selectedTags, tag]);
    }
  };

  const formatPrice = (price: number | null) => {
    if (price === null) return '-';
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(price);
  };

  const getPlatformColor = (platform: string) => {
    const colors: Record<string, string> = {
      myntra: 'bg-pink-500',
      ajio: 'bg-orange-500',
      amazon: 'bg-yellow-500',
      flipkart: 'bg-blue-500',
      meesho: 'bg-purple-500',
    };
    return colors[platform.toLowerCase()] || 'bg-gray-500';
  };

  const saleItems = items.filter((i) => i.is_on_sale);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-sora font-bold">My Wishlist</h1>
          <p className="text-muted-foreground">
            Track prices and get alerts for your favorite items
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowSettingsDialog(true)}>
            <Bell className="w-4 h-4 mr-2" />
            Alerts
          </Button>
          <Button onClick={() => setShowAddDialog(true)} className="bg-gold hover:bg-gold/90">
            <Plus className="w-4 h-4 mr-2" />
            Add Item
          </Button>
        </div>
      </div>

      {/* Sale Banner */}
      {saleItems.length > 0 && (
        <Card className="bg-gradient-to-r from-green-500/20 to-emerald-500/10 border-green-500/30">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
                <TrendingDown className="w-5 h-5 text-green-500" />
              </div>
              <div>
                <p className="font-semibold text-green-500">
                  {saleItems.length} item{saleItems.length > 1 ? 's' : ''} on sale!
                </p>
                <p className="text-sm text-muted-foreground">
                  Some items in your wishlist have dropped in price
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              className="border-green-500/50 text-green-500 hover:bg-green-500/10"
              onClick={() => setShowOnSale(true)}
            >
              View Sales
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search by title or brand..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>

            <div className="flex gap-3">
              <Select value={platform} onValueChange={setPlatform}>
                <SelectTrigger className="w-40">
                  <Filter className="w-4 h-4 mr-2" />
                  <SelectValue placeholder="Platform" />
                </SelectTrigger>
                <SelectContent>
                  {PLATFORMS.map((p) => (
                    <SelectItem key={p.value} value={p.value}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Button
                variant={showOnSale ? 'default' : 'outline'}
                onClick={() => setShowOnSale(!showOnSale)}
                className={showOnSale ? 'bg-green-500 hover:bg-green-600' : ''}
              >
                <TrendingDown className="w-4 h-4 mr-2" />
                On Sale
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Content */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-64 bg-charcoal rounded-xl shimmer" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <Card className="py-16">
          <CardContent className="text-center">
            <Heart className="w-16 h-16 mx-auto mb-4 text-muted-foreground opacity-50" />
            <h3 className="text-xl font-semibold mb-2">Your wishlist is empty</h3>
            <p className="text-muted-foreground mb-4">
              Add items from Myntra, Ajio, Amazon, Flipkart, or Meesho to track prices
            </p>
            <Button onClick={() => setShowAddDialog(true)} className="bg-gold hover:bg-gold/90">
              <Plus className="w-4 h-4 mr-2" />
              Add First Item
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <AnimatePresence mode="popLayout">
            {items.map((item, index) => (
              <motion.div
                key={item.id}
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ delay: index * 0.05 }}
              >
                <Card className="group overflow-hidden h-full flex flex-col">
                  {/* Image */}
                  <div className="relative aspect-square bg-charcoal">
                    {item.image_url ? (
                      <img
                        src={item.image_url}
                        alt={item.title || 'Product'}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <ShoppingBag className="w-12 h-12 text-muted-foreground" />
                      </div>
                    )}

                    {/* Platform Badge */}
                    <div
                      className={cn(
                        'absolute top-2 left-2 px-2 py-1 rounded-full text-xs font-semibold text-white',
                        getPlatformColor(item.platform)
                      )}
                    >
                      {item.platform}
                    </div>

                    {/* Sale Badge */}
                    {item.is_on_sale && (
                      <div className="absolute top-2 right-2 bg-green-500 px-2 py-1 rounded-full text-xs font-semibold text-white flex items-center gap-1">
                        <TrendingDown className="w-3 h-3" />
                        Sale
                      </div>
                    )}

                    {/* Hover Actions */}
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => handleCheckPrice(item)}
                        disabled={checkingPrice === item.id}
                      >
                        {checkingPrice === item.id ? (
                          <RefreshCw className="w-4 h-4 animate-spin" />
                        ) : (
                          <RefreshCw className="w-4 h-4 mr-1" />
                        )}
                        Check Price
                      </Button>
                      <Button size="icon" variant="secondary" asChild>
                        <a href={item.product_url} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      </Button>
                      <Button
                        size="icon"
                        variant="destructive"
                        onClick={() => handleDeleteItem(item.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>

                  {/* Info */}
                  <CardContent className="p-4 flex-1 flex flex-col">
                    <div className="flex-1">
                      {item.brand && (
                        <p className="text-sm text-gold font-medium">{item.brand}</p>
                      )}
                      <h3 className="font-semibold line-clamp-2">{item.title || 'Unknown Product'}</h3>

                      {/* Tags */}
                      {item.occasion_tags && item.occasion_tags.length > 0 && (
                        <div className="flex gap-1 flex-wrap mt-2">
                          {item.occasion_tags.slice(0, 3).map((tag) => (
                            <span
                              key={tag}
                              className="px-2 py-0.5 bg-gold/10 text-gold text-xs rounded-full capitalize"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Price */}
                    <div className="mt-3 pt-3 border-t border-border">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xl font-bold text-gold flex items-center">
                            <IndianRupee className="w-4 h-4" />
                            {item.current_price?.toLocaleString() || '-'}
                          </p>
                          {item.original_price && item.original_price > (item.current_price || 0) && (
                            <p className="text-sm text-muted-foreground line-through">
                              {formatPrice(item.original_price)}
                            </p>
                          )}
                        </div>
                        {item.is_on_sale && item.original_price && item.current_price && (
                          <span className="bg-green-500/20 text-green-500 px-2 py-1 rounded text-sm font-semibold">
                            -{Math.round(((item.original_price - item.current_price) / item.original_price) * 100)}%
                          </span>
                        )}
                      </div>
                      {item.last_price_check && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Last checked: {formatDate(item.last_price_check)}
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Pagination */}
      {total > 20 && (
        <div className="flex justify-center gap-2">
          <Button
            variant="outline"
            disabled={page === 1}
            onClick={() => setPage(page - 1)}
          >
            Previous
          </Button>
          <span className="flex items-center px-4 text-muted-foreground">
            Page {page} of {Math.ceil(total / 20)}
          </span>
          <Button
            variant="outline"
            disabled={page >= Math.ceil(total / 20)}
            onClick={() => setPage(page + 1)}
          >
            Next
          </Button>
        </div>
      )}

      {/* Add Item Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add to Wishlist</DialogTitle>
            <DialogDescription>
              Paste a product URL from Myntra, Ajio, Amazon, Flipkart, or Meesho
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="product-url">Product URL</Label>
              <Input
                id="product-url"
                placeholder="https://www.myntra.com/..."
                value={productUrl}
                onChange={(e) => setProductUrl(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Occasion Tags (optional)</Label>
              <div className="flex flex-wrap gap-2">
                {OCCASION_TAGS.map((tag) => (
                  <button
                    key={tag}
                    onClick={() => toggleTag(tag)}
                    className={cn(
                      'px-3 py-1.5 rounded-full text-sm transition-colors capitalize',
                      selectedTags.includes(tag)
                        ? 'bg-gold text-white'
                        : 'bg-charcoal text-muted-foreground hover:bg-charcoal-light'
                    )}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleAddItem}
              disabled={isAdding}
              className="bg-gold hover:bg-gold/90"
            >
              {isAdding ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                  Adding...
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4 mr-2" />
                  Add to Wishlist
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Alert Settings Dialog */}
      <Dialog open={showSettingsDialog} onOpenChange={setShowSettingsDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bell className="w-5 h-5" />
              Alert Settings
            </DialogTitle>
            <DialogDescription>
              Configure how you want to be notified about price drops
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="price-alerts">Price Drop Alerts</Label>
                <p className="text-sm text-muted-foreground">
                  Get notified when prices drop
                </p>
              </div>
              <Switch
                id="price-alerts"
                checked={alertSettings?.price_drop_alerts ?? true}
                onCheckedChange={(checked) =>
                  handleUpdateSettings({ price_drop_alerts: checked })
                }
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="weekly-digest">Weekly Digest</Label>
                <p className="text-sm text-muted-foreground">
                  Summary of all price changes
                </p>
              </div>
              <Switch
                id="weekly-digest"
                checked={alertSettings?.weekly_digest ?? false}
                onCheckedChange={(checked) =>
                  handleUpdateSettings({ weekly_digest: checked })
                }
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="email-notifications">Email Notifications</Label>
                <p className="text-sm text-muted-foreground">
                  Receive alerts via email
                </p>
              </div>
              <Switch
                id="email-notifications"
                checked={alertSettings?.email_notifications ?? true}
                onCheckedChange={(checked) =>
                  handleUpdateSettings({ email_notifications: checked })
                }
              />
            </div>

            {!isPremium && (
              <Card className="bg-gold/10 border-gold/30">
                <CardContent className="p-4 flex items-center gap-3">
                  <Crown className="w-8 h-8 text-gold" />
                  <div className="flex-1">
                    <p className="font-semibold">Upgrade to PRO</p>
                    <p className="text-sm text-muted-foreground">
                      Get real-time price alerts and more features
                    </p>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => navigate('/pricing')}
                    className="bg-gold hover:bg-gold/90"
                  >
                    Upgrade
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>

          <DialogFooter>
            <Button onClick={() => setShowSettingsDialog(false)}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
