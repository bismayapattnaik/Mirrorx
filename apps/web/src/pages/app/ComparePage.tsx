import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Grid,
  SplitSquareVertical,
  Plus,
  Trash2,
  Trophy,
  ChevronLeft,
  ChevronRight,
  Download,
  Crown,
  Check,
  Columns,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { useAuthStore } from '@/store/auth-store';
import { compareApi, tryOnApi, CompareSet, CompareSetItem } from '@/lib/api';
import { cn, formatDate } from '@/lib/utils';

type ViewMode = 'grid' | 'slider';

interface TryOnJobItem {
  id: string;
  result_image_url: string | null;
  mode: string;
  created_at: string;
}

export default function ComparePage() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { user } = useAuthStore();

  const [isLoading, setIsLoading] = useState(true);
  const [compareSets, setCompareSets] = useState<CompareSet[]>([]);
  const [selectedSet, setSelectedSet] = useState<CompareSet | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [sliderPosition, setSliderPosition] = useState(0);

  // Create new set flow
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newSetName, setNewSetName] = useState('');
  const [recentJobs, setRecentJobs] = useState<TryOnJobItem[]>([]);
  const [selectedJobIds, setSelectedJobIds] = useState<string[]>([]);
  const [isCreating, setIsCreating] = useState(false);

  const isPremium = user?.subscription_tier !== 'FREE';
  const maxCompareItems = isPremium ? 6 : 4;

  // Fetch compare sets
  useEffect(() => {
    async function fetchSets() {
      setIsLoading(true);
      try {
        const response = await compareApi.list();
        setCompareSets(response.sets);
      } catch {
        toast({
          variant: 'destructive',
          title: 'Failed to load compare sets',
          description: 'Please try again.',
        });
      } finally {
        setIsLoading(false);
      }
    }

    fetchSets();
  }, [toast]);

  // Fetch recent tryon jobs for selection
  const fetchRecentJobs = async () => {
    try {
      const response = await tryOnApi.listRecent(50);
      setRecentJobs(response.jobs.filter(j => j.result_image_url) as TryOnJobItem[]);
    } catch {
      toast({
        variant: 'destructive',
        title: 'Failed to load try-on results',
      });
    }
  };

  const handleStartCreate = () => {
    setShowCreateDialog(true);
    setNewSetName('');
    setSelectedJobIds([]);
    fetchRecentJobs();
  };

  const handleSelectItem = (jobId: string) => {
    if (selectedJobIds.includes(jobId)) {
      setSelectedJobIds(selectedJobIds.filter((id) => id !== jobId));
    } else if (selectedJobIds.length < maxCompareItems) {
      setSelectedJobIds([...selectedJobIds, jobId]);
    } else {
      toast({
        variant: 'destructive',
        title: `Maximum ${maxCompareItems} items`,
        description: isPremium ? 'You can compare up to 6 items.' : 'Upgrade to PRO to compare up to 6 items.',
      });
    }
  };

  const handleCreateSet = async () => {
    if (selectedJobIds.length < 2) {
      toast({
        variant: 'destructive',
        title: 'Select at least 2 items',
        description: 'You need at least 2 items to compare.',
      });
      return;
    }

    setIsCreating(true);
    try {
      const newSet = await compareApi.create(selectedJobIds, newSetName || undefined);
      setCompareSets([newSet, ...compareSets]);
      setShowCreateDialog(false);
      setSelectedSet(newSet);
      toast({
        title: 'Compare set created',
        description: `Created "${newSet.name || 'New Compare Set'}" with ${newSet.items.length} items.`,
      });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Please try again.';
      toast({
        variant: 'destructive',
        title: 'Failed to create set',
        description: errorMessage,
      });
    } finally {
      setIsCreating(false);
    }
  };

  const handleSelectSet = async (set: CompareSet) => {
    try {
      const fullSet = await compareApi.get(set.id);
      setSelectedSet(fullSet);
      setSliderPosition(0);
    } catch {
      toast({
        variant: 'destructive',
        title: 'Failed to load compare set',
      });
    }
  };

  const handleSetWinner = async (item: CompareSetItem) => {
    if (!selectedSet) return;

    try {
      await compareApi.updateItem(selectedSet.id, item.id, { is_winner: true });
      const updatedSet = await compareApi.get(selectedSet.id);
      setSelectedSet(updatedSet);
      toast({
        title: 'Winner selected!',
        description: 'Your favorite look has been marked.',
      });
    } catch {
      toast({
        variant: 'destructive',
        title: 'Failed to set winner',
      });
    }
  };

  const handleDeleteSet = async (setId: string) => {
    try {
      await compareApi.delete(setId);
      setCompareSets(compareSets.filter((s) => s.id !== setId));
      if (selectedSet?.id === setId) {
        setSelectedSet(null);
      }
      toast({
        title: 'Deleted',
        description: 'Compare set removed.',
      });
    } catch {
      toast({
        variant: 'destructive',
        title: 'Failed to delete',
      });
    }
  };

  const handleDownload = (imageUrl: string, filename: string) => {
    const link = document.createElement('a');
    link.href = imageUrl;
    link.download = filename;
    link.click();
  };

  const handleSliderNav = (direction: 'prev' | 'next') => {
    if (!selectedSet) return;
    const maxPos = selectedSet.items.length - 2;
    if (direction === 'prev') {
      setSliderPosition(Math.max(0, sliderPosition - 1));
    } else {
      setSliderPosition(Math.min(maxPos, sliderPosition + 1));
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-sora font-bold">Compare Mode</h1>
          <p className="text-muted-foreground">
            Compare your try-on results side by side
          </p>
        </div>
        <Button onClick={handleStartCreate} className="bg-gold hover:bg-gold/90">
          <Plus className="w-4 h-4 mr-2" />
          New Compare
        </Button>
      </div>

      {/* Content */}
      {selectedSet ? (
        <div className="space-y-6">
          {/* Back & View Controls */}
          <div className="flex items-center justify-between">
            <Button variant="ghost" onClick={() => setSelectedSet(null)}>
              <ChevronLeft className="w-4 h-4 mr-2" />
              Back to Sets
            </Button>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground mr-2">View:</span>
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
                  onClick={() => setViewMode('slider')}
                  className={cn(
                    'p-2 transition-colors',
                    viewMode === 'slider' ? 'bg-gold text-white' : 'text-muted-foreground'
                  )}
                >
                  <Columns className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Set Title */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center justify-between">
                <span>{selectedSet.name || 'Untitled Compare Set'}</span>
                <span className="text-sm font-normal text-muted-foreground">
                  {selectedSet.items.length} items
                </span>
              </CardTitle>
            </CardHeader>
          </Card>

          {/* Grid View */}
          {viewMode === 'grid' && (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              <AnimatePresence mode="popLayout">
                {selectedSet.items.map((item, index) => (
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
                        'group overflow-hidden relative',
                        item.is_winner && 'ring-2 ring-gold'
                      )}
                    >
                      <div className="relative aspect-[3/4]">
                        <img
                          src={item.result_image_url}
                          alt={`Compare item ${index + 1}`}
                          className="w-full h-full object-cover"
                        />

                        {/* Winner Badge */}
                        {item.is_winner && (
                          <div className="absolute top-2 right-2 bg-gold text-white px-2 py-1 rounded-full text-xs font-semibold flex items-center gap-1">
                            <Trophy className="w-3 h-3" />
                            Winner
                          </div>
                        )}

                        {/* Hover Actions */}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                        <div className="absolute bottom-0 left-0 right-0 p-3 translate-y-full group-hover:translate-y-0 transition-transform">
                          <div className="flex gap-2 justify-center">
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => handleSetWinner(item)}
                              disabled={item.is_winner}
                            >
                              <Trophy className="w-4 h-4 mr-1" />
                              {item.is_winner ? 'Winner' : 'Set Winner'}
                            </Button>
                            <Button
                              size="icon"
                              variant="secondary"
                              onClick={() =>
                                handleDownload(
                                  item.result_image_url || '',
                                  `compare-${item.id}.jpg`
                                )
                              }
                            >
                              <Download className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                      <CardContent className="p-3">
                        <p className="text-sm text-muted-foreground">
                          Look #{index + 1}
                        </p>
                        {item.notes && (
                          <p className="text-xs text-muted-foreground mt-1 truncate">
                            {item.notes}
                          </p>
                        )}
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}

          {/* Slider View (Side by Side) */}
          {viewMode === 'slider' && selectedSet.items.length >= 2 && (
            <div className="space-y-4">
              <div className="flex items-center justify-center gap-4">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => handleSliderNav('prev')}
                  disabled={sliderPosition === 0}
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>

                <div className="flex gap-4 items-stretch">
                  {/* Left Image */}
                  <Card className={cn(
                    'overflow-hidden flex-1 max-w-md',
                    selectedSet.items[sliderPosition]?.is_winner && 'ring-2 ring-gold'
                  )}>
                    <div className="relative aspect-[3/4]">
                      <img
                        src={selectedSet.items[sliderPosition]?.result_image_url}
                        alt="Left comparison"
                        className="w-full h-full object-cover"
                      />
                      {selectedSet.items[sliderPosition]?.is_winner && (
                        <div className="absolute top-2 right-2 bg-gold text-white px-2 py-1 rounded-full text-xs font-semibold flex items-center gap-1">
                          <Trophy className="w-3 h-3" />
                          Winner
                        </div>
                      )}
                    </div>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">Look #{sliderPosition + 1}</span>
                        <Button
                          size="sm"
                          variant={selectedSet.items[sliderPosition]?.is_winner ? 'default' : 'outline'}
                          onClick={() => handleSetWinner(selectedSet.items[sliderPosition])}
                          disabled={selectedSet.items[sliderPosition]?.is_winner}
                          className={selectedSet.items[sliderPosition]?.is_winner ? 'bg-gold' : ''}
                        >
                          <Trophy className="w-4 h-4 mr-1" />
                          {selectedSet.items[sliderPosition]?.is_winner ? 'Winner' : 'Pick This'}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>

                  {/* VS Indicator */}
                  <div className="flex items-center">
                    <div className="w-12 h-12 rounded-full bg-gold/20 border border-gold/40 flex items-center justify-center">
                      <span className="text-gold font-bold text-sm">VS</span>
                    </div>
                  </div>

                  {/* Right Image */}
                  <Card className={cn(
                    'overflow-hidden flex-1 max-w-md',
                    selectedSet.items[sliderPosition + 1]?.is_winner && 'ring-2 ring-gold'
                  )}>
                    <div className="relative aspect-[3/4]">
                      <img
                        src={selectedSet.items[sliderPosition + 1]?.result_image_url}
                        alt="Right comparison"
                        className="w-full h-full object-cover"
                      />
                      {selectedSet.items[sliderPosition + 1]?.is_winner && (
                        <div className="absolute top-2 right-2 bg-gold text-white px-2 py-1 rounded-full text-xs font-semibold flex items-center gap-1">
                          <Trophy className="w-3 h-3" />
                          Winner
                        </div>
                      )}
                    </div>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">Look #{sliderPosition + 2}</span>
                        <Button
                          size="sm"
                          variant={selectedSet.items[sliderPosition + 1]?.is_winner ? 'default' : 'outline'}
                          onClick={() => handleSetWinner(selectedSet.items[sliderPosition + 1])}
                          disabled={selectedSet.items[sliderPosition + 1]?.is_winner}
                          className={selectedSet.items[sliderPosition + 1]?.is_winner ? 'bg-gold' : ''}
                        >
                          <Trophy className="w-4 h-4 mr-1" />
                          {selectedSet.items[sliderPosition + 1]?.is_winner ? 'Winner' : 'Pick This'}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => handleSliderNav('next')}
                  disabled={sliderPosition >= selectedSet.items.length - 2}
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>

              {/* Position Indicator */}
              <div className="flex justify-center gap-2">
                {Array.from({ length: selectedSet.items.length - 1 }).map((_, idx) => (
                  <button
                    key={idx}
                    onClick={() => setSliderPosition(idx)}
                    className={cn(
                      'w-2 h-2 rounded-full transition-colors',
                      idx === sliderPosition ? 'bg-gold' : 'bg-gold/30'
                    )}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <>
          {/* Compare Sets List */}
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[...Array(6)].map((_, idx) => (
                <div key={idx} className="h-48 bg-charcoal rounded-xl shimmer" />
              ))}
            </div>
          ) : compareSets.length === 0 ? (
            <Card className="py-16">
              <CardContent className="text-center">
                <SplitSquareVertical className="w-16 h-16 mx-auto mb-4 text-muted-foreground opacity-50" />
                <h3 className="text-xl font-semibold mb-2">No compare sets yet</h3>
                <p className="text-muted-foreground mb-4">
                  Create a compare set to compare your try-on results side by side
                </p>
                <Button onClick={handleStartCreate} className="bg-gold hover:bg-gold/90">
                  <Plus className="w-4 h-4 mr-2" />
                  Create First Compare Set
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {compareSets.map((set) => (
                <Card
                  key={set.id}
                  className="group overflow-hidden cursor-pointer hover:ring-2 hover:ring-gold/50 transition-all"
                  onClick={() => handleSelectSet(set)}
                >
                  {/* Preview Images */}
                  <div className="relative h-32 bg-charcoal flex">
                    {(set.items || []).slice(0, 3).map((item) => (
                      <div
                        key={item.id}
                        className="flex-1 border-r border-charcoal-light last:border-r-0 overflow-hidden"
                      >
                        <img
                          src={item.result_image_url}
                          alt=""
                          className="w-full h-full object-cover"
                        />
                      </div>
                    ))}
                    {(!set.items || set.items.length === 0) && (
                      <div className="flex-1 flex items-center justify-center">
                        <Grid className="w-8 h-8 text-muted-foreground" />
                      </div>
                    )}
                  </div>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-semibold">{set.name || 'Untitled Set'}</h3>
                        <p className="text-sm text-muted-foreground">
                          {set.item_count || set.items?.length || 0} items
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {formatDate(set.created_at)}
                        </p>
                      </div>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteSet(set.id);
                        }}
                      >
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </>
      )}

      {/* Create Compare Set Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Create Compare Set</DialogTitle>
            <DialogDescription>
              Select 2-{maxCompareItems} items from your recent try-ons to compare
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
            <Input
              placeholder="Set name (optional)"
              value={newSetName}
              onChange={(e) => setNewSetName(e.target.value)}
            />

            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                Selected: {selectedJobIds.length}/{maxCompareItems}
              </span>
              {!isPremium && (
                <Button
                  variant="link"
                  size="sm"
                  onClick={() => navigate('/pricing')}
                  className="text-gold"
                >
                  <Crown className="w-3 h-3 mr-1" />
                  Upgrade for 6 items
                </Button>
              )}
            </div>

            {/* Recent Try-On Jobs Grid */}
            <div className="flex-1 overflow-y-auto -mx-6 px-6">
              <div className="grid grid-cols-3 md:grid-cols-4 gap-3">
                {recentJobs.map((job) => {
                  const isSelected = selectedJobIds.includes(job.id);
                  return (
                    <Card
                      key={job.id}
                      className={cn(
                        'cursor-pointer overflow-hidden transition-all',
                        isSelected ? 'ring-2 ring-gold' : 'hover:ring-1 hover:ring-gold/50'
                      )}
                      onClick={() => handleSelectItem(job.id)}
                    >
                      <div className="relative aspect-[3/4]">
                        <img
                          src={job.result_image_url || ''}
                          alt="Try-on result"
                          className="w-full h-full object-cover"
                        />
                        {isSelected && (
                          <div className="absolute inset-0 bg-gold/20 flex items-center justify-center">
                            <div className="w-8 h-8 rounded-full bg-gold flex items-center justify-center">
                              <Check className="w-5 h-5 text-white" />
                            </div>
                          </div>
                        )}
                      </div>
                    </Card>
                  );
                })}
              </div>

              {recentJobs.length === 0 && (
                <div className="text-center py-8">
                  <p className="text-muted-foreground">
                    No try-on results yet. Create some try-ons first!
                  </p>
                  <Button
                    variant="link"
                    onClick={() => {
                      setShowCreateDialog(false);
                      navigate('/app/tryon');
                    }}
                  >
                    Go to Try-On
                  </Button>
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreateSet}
              disabled={selectedJobIds.length < 2 || isCreating}
              className="bg-gold hover:bg-gold/90"
            >
              {isCreating ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                  Creating...
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4 mr-2" />
                  Create Set ({selectedJobIds.length} items)
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
