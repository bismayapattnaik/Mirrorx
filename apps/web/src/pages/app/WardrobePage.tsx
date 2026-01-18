import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Shirt,
  Search,
  Grid,
  List,
  Download,
  Trash2,
  ExternalLink,
  Filter,
  SortAsc,
  Lock,
  Crown,
  Sparkles,
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
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { useAppStore } from '@/store/app-store';
import { useAuthStore } from '@/store/auth-store';
import { wardrobeApi } from '@/lib/api';
import { formatDate, cn } from '@/lib/utils';
import type { WardrobeItem } from '@mrrx/shared';

const categories = [
  { value: 'all', label: 'All Categories' },
  { value: 'casual', label: 'Casual' },
  { value: 'formal', label: 'Formal' },
  { value: 'ethnic', label: 'Ethnic' },
  { value: 'party', label: 'Party' },
  { value: 'sports', label: 'Sports' },
];

const sortOptions = [
  { value: 'newest', label: 'Newest First' },
  { value: 'oldest', label: 'Oldest First' },
  { value: 'brand', label: 'By Brand' },
];

const FREE_WARDROBE_LIMIT = 5;

export default function WardrobePage() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { wardrobeItems, setWardrobeItems, removeWardrobeItem } = useAppStore();

  const [isLoading, setIsLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [sort, setSort] = useState('newest');
  const [selectedItem, setSelectedItem] = useState<WardrobeItem | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  const isPremium = user?.subscription_tier !== 'FREE';

  // Fetch wardrobe items
  useEffect(() => {
    async function fetchWardrobe() {
      setIsLoading(true);
      try {
        const response = await wardrobeApi.list({
          search: search || undefined,
          category: category === 'all' ? undefined : category,
          sort,
        });
        setWardrobeItems(response.items);
      } catch {
        toast({
          variant: 'destructive',
          title: 'Failed to load wardrobe',
          description: 'Please try again.',
        });
      } finally {
        setIsLoading(false);
      }
    }

    fetchWardrobe();
  }, [search, category, sort, setWardrobeItems, toast]);

  const handleDelete = async (id: string) => {
    try {
      await wardrobeApi.delete(id);
      removeWardrobeItem(id);
      setDeleteConfirm(null);
      toast({
        title: 'Deleted',
        description: 'Item removed from wardrobe.',
      });
    } catch {
      toast({
        variant: 'destructive',
        title: 'Delete failed',
        description: 'Could not delete item.',
      });
    }
  };

  const handleDownload = (item: WardrobeItem) => {
    const link = document.createElement('a');
    link.href = item.tryon_image_url;
    link.download = `mirrorx-wardrobe-${item.id}.jpg`;
    link.click();
  };

  const handleItemClick = (item: WardrobeItem, index: number) => {
    if (!isPremium && index >= FREE_WARDROBE_LIMIT) {
      setShowUpgradeModal(true);
    } else {
      setSelectedItem(item);
    }
  };

  const isItemLocked = (index: number) => !isPremium && index >= FREE_WARDROBE_LIMIT;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-orbitron font-bold">My Wardrobe</h1>
          <p className="text-muted-foreground">
            Your saved looks and try-ons
          </p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold text-gold">{wardrobeItems.length}</p>
          <p className="text-sm text-muted-foreground">saved looks</p>
          {!isPremium && wardrobeItems.length > FREE_WARDROBE_LIMIT && (
            <p className="text-xs text-gold mt-1">
              {wardrobeItems.length - FREE_WARDROBE_LIMIT} locked
            </p>
          )}
        </div>
      </div>

      {/* Premium Banner for Free Users */}
      {!isPremium && wardrobeItems.length > FREE_WARDROBE_LIMIT && (
        <Card className="bg-gradient-to-r from-gold/20 to-gold/5 border-gold/30">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gold/20 flex items-center justify-center">
                <Crown className="w-5 h-5 text-gold" />
              </div>
              <div>
                <p className="font-semibold">Unlock Your Full Wardrobe</p>
                <p className="text-sm text-muted-foreground">
                  Upgrade to Premium to view all {wardrobeItems.length} saved looks
                </p>
              </div>
            </div>
            <Button onClick={() => navigate('/app/pricing')} className="bg-gold hover:bg-gold/90">
              <Sparkles className="w-4 h-4 mr-2" />
              Upgrade Now
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
                placeholder="Search by brand or tag..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>

            <div className="flex gap-3">
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="w-40">
                  <Filter className="w-4 h-4 mr-2" />
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((cat) => (
                    <SelectItem key={cat.value} value={cat.value}>
                      {cat.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={sort} onValueChange={setSort}>
                <SelectTrigger className="w-40">
                  <SortAsc className="w-4 h-4 mr-2" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {sortOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <div className="flex border border-gold/30 rounded-lg overflow-hidden">
                <button
                  onClick={() => setViewMode('grid')}
                  className={cn(
                    'p-2 transition-colors',
                    viewMode === 'grid' ? 'bg-gold text-white' : 'text-muted-foreground'
                  )}
                >
                  <Grid className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={cn(
                    'p-2 transition-colors',
                    viewMode === 'list' ? 'bg-gold text-white' : 'text-muted-foreground'
                  )}
                >
                  <List className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Content */}
      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {[...Array(8)].map((_, i) => (
            <div
              key={i}
              className="aspect-[3/4] bg-charcoal rounded-xl shimmer"
            />
          ))}
        </div>
      ) : wardrobeItems.length === 0 ? (
        <Card className="py-16">
          <CardContent className="text-center">
            <Shirt className="w-16 h-16 mx-auto mb-4 text-muted-foreground opacity-50" />
            <h3 className="text-xl font-semibold mb-2">Your wardrobe is empty</h3>
            <p className="text-muted-foreground mb-4">
              Save your try-on results to build your virtual wardrobe
            </p>
            <Button asChild>
              <a href="/app/tryon">Start Try-On</a>
            </Button>
          </CardContent>
        </Card>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          <AnimatePresence mode="popLayout">
            {wardrobeItems.map((item, index) => (
              <motion.div
                key={item.id}
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ delay: index * 0.05 }}
              >
                <Card
                  className={cn(
                    'group overflow-hidden cursor-pointer relative',
                    isItemLocked(index) && 'ring-2 ring-gold/30'
                  )}
                  onClick={() => handleItemClick(item, index)}
                >
                  <div className="relative aspect-[3/4]">
                    <img
                      src={item.tryon_image_url}
                      alt={item.brand || 'Wardrobe item'}
                      className={cn(
                        'w-full h-full object-cover transition-all',
                        isItemLocked(index) && 'blur-md'
                      )}
                    />

                    {/* Locked Overlay */}
                    {isItemLocked(index) && (
                      <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center">
                        <div className="w-12 h-12 rounded-full bg-gold/20 flex items-center justify-center mb-2">
                          <Lock className="w-6 h-6 text-gold" />
                        </div>
                        <p className="text-sm font-medium text-white">Premium Only</p>
                        <p className="text-xs text-white/70">Upgrade to unlock</p>
                      </div>
                    )}

                    {/* Hover Actions for Unlocked Items */}
                    {!isItemLocked(index) && (
                      <>
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                        <div className="absolute bottom-0 left-0 right-0 p-3 translate-y-full group-hover:translate-y-0 transition-transform">
                          <div className="flex gap-2">
                            <Button
                              size="icon"
                              variant="secondary"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDownload(item);
                              }}
                            >
                              <Download className="w-4 h-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="destructive"
                              onClick={(e) => {
                                e.stopPropagation();
                                setDeleteConfirm(item.id);
                              }}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                  <CardContent className="p-3">
                    {item.brand && (
                      <p className="font-semibold truncate">{item.brand}</p>
                    )}
                    {item.category && (
                      <p className="text-sm text-muted-foreground capitalize">
                        {item.category}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">
                      {formatDate(item.created_at)}
                    </p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      ) : (
        <div className="space-y-3">
          {wardrobeItems.map((item, index) => (
            <Card
              key={item.id}
              className={cn(
                'overflow-hidden',
                isItemLocked(index) && 'ring-2 ring-gold/30'
              )}
            >
              <CardContent className="p-0">
                <div className="flex gap-4 items-center p-4">
                  <div className="relative">
                    <img
                      src={item.tryon_image_url}
                      alt={item.brand || 'Wardrobe item'}
                      className={cn(
                        'w-20 h-28 object-cover rounded-lg cursor-pointer',
                        isItemLocked(index) && 'blur-md'
                      )}
                      onClick={() => handleItemClick(item, index)}
                    />
                    {isItemLocked(index) && (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <Lock className="w-6 h-6 text-gold" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    {item.brand && (
                      <p className="font-semibold">{item.brand}</p>
                    )}
                    {item.category && (
                      <p className="text-sm text-muted-foreground capitalize">
                        {item.category}
                      </p>
                    )}
                    {item.tags && item.tags.length > 0 && !isItemLocked(index) && (
                      <div className="flex gap-1 mt-2 flex-wrap">
                        {item.tags.slice(0, 3).map((tag) => (
                          <span
                            key={tag}
                            className="px-2 py-0.5 bg-gold/10 text-gold text-xs rounded-full"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                    <p className="text-xs text-muted-foreground mt-2">
                      {formatDate(item.created_at)}
                    </p>
                  </div>
                  {isItemLocked(index) ? (
                    <Button
                      size="sm"
                      onClick={() => setShowUpgradeModal(true)}
                      className="bg-gold hover:bg-gold/90"
                    >
                      <Lock className="w-4 h-4 mr-1" />
                      Unlock
                    </Button>
                  ) : (
                    <div className="flex gap-2">
                      <Button size="icon" variant="ghost" onClick={() => handleDownload(item)}>
                        <Download className="w-4 h-4" />
                      </Button>
                      {item.product_url && (
                        <Button size="icon" variant="ghost" asChild>
                          <a href={item.product_url} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="w-4 h-4" />
                          </a>
                        </Button>
                      )}
                      <Button
                        size="icon"
                        variant="ghost"
                        className="text-destructive"
                        onClick={() => setDeleteConfirm(item.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Detail Dialog */}
      <Dialog open={!!selectedItem} onOpenChange={() => setSelectedItem(null)}>
        <DialogContent className="max-w-2xl">
          {selectedItem && (
            <>
              <DialogHeader>
                <DialogTitle>{selectedItem.brand || 'Look Detail'}</DialogTitle>
                <DialogDescription>
                  {formatDate(selectedItem.created_at)}
                </DialogDescription>
              </DialogHeader>
              <div className="grid md:grid-cols-2 gap-4">
                <img
                  src={selectedItem.tryon_image_url}
                  alt="Look"
                  className="w-full rounded-xl"
                />
                <div className="space-y-4">
                  {selectedItem.category && (
                    <div>
                      <p className="text-sm text-muted-foreground">Category</p>
                      <p className="capitalize">{selectedItem.category}</p>
                    </div>
                  )}
                  {selectedItem.tags && selectedItem.tags.length > 0 && (
                    <div>
                      <p className="text-sm text-muted-foreground mb-2">Tags</p>
                      <div className="flex gap-2 flex-wrap">
                        {selectedItem.tags.map((tag) => (
                          <span
                            key={tag}
                            className="px-3 py-1 bg-gold/10 text-gold text-sm rounded-full"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="flex gap-3 pt-4">
                    <Button onClick={() => handleDownload(selectedItem)}>
                      <Download className="w-4 h-4 mr-2" />
                      Download
                    </Button>
                    {selectedItem.product_url && (
                      <Button variant="outline" asChild>
                        <a
                          href={selectedItem.product_url}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <ExternalLink className="w-4 h-4 mr-2" />
                          View Product
                        </a>
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Item?</DialogTitle>
            <DialogDescription>
              This will permanently remove this item from your wardrobe.
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-3 justify-end">
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteConfirm && handleDelete(deleteConfirm)}
            >
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Upgrade Modal */}
      <Dialog open={showUpgradeModal} onOpenChange={setShowUpgradeModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Crown className="w-5 h-5 text-gold" />
              Upgrade to Premium
            </DialogTitle>
            <DialogDescription>
              Unlock your full wardrobe and get unlimited access to all your saved looks.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="bg-charcoal rounded-xl p-4 space-y-3">
              <h4 className="font-semibold">Premium Benefits:</h4>
              <ul className="space-y-2 text-sm">
                <li className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-gold" />
                  Unlimited wardrobe storage
                </li>
                <li className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-gold" />
                  Unlimited daily try-ons
                </li>
                <li className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-gold" />
                  Full Fit outfit suggestions
                </li>
                <li className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-gold" />
                  Priority AI processing
                </li>
              </ul>
            </div>
            <Button
              className="w-full bg-gold hover:bg-gold/90"
              onClick={() => {
                setShowUpgradeModal(false);
                navigate('/app/pricing');
              }}
            >
              View Pricing Plans
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
