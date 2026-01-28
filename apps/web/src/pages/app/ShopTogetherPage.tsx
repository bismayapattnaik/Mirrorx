import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users,
  MessageCircle,
  ThumbsUp,
  Share2,
  TrendingUp,
  Send,
  X,
  ExternalLink,
  Clock,
  Filter,
  RefreshCw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useToast } from '@/hooks/use-toast';
import { useAuthStore } from '@/store/auth-store';
import { feedApi, FeedPost, FeedComment } from '@/lib/api';
import { cn } from '@/lib/utils';

function timeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return date.toLocaleDateString();
}

interface PostCardProps {
  post: FeedPost;
  onVote: (postId: string, option: string) => void;
  onComment: (postId: string) => void;
  onShare: (post: FeedPost) => void;
}

function PostCard({ post, onVote, onComment, onShare }: PostCardProps) {
  const totalVotes = post.total_votes || 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
    >
      <Card className="overflow-hidden hover:border-gold/30 transition-colors">
        <CardContent className="p-0">
          {/* Header */}
          <div className="p-4 flex items-center gap-3">
            <Avatar className="w-10 h-10">
              <AvatarImage src={post.user_avatar || undefined} />
              <AvatarFallback>{post.user_name?.[0] || 'U'}</AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <p className="font-medium">{post.user_name}</p>
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {timeAgo(post.created_at)}
              </p>
            </div>
          </div>

          {/* Image */}
          <div className="relative aspect-[3/4] bg-charcoal">
            <img
              src={post.tryon_image_url}
              alt="Try-on result"
              className="w-full h-full object-cover"
            />
            {post.is_poll && (
              <div className="absolute top-2 right-2 bg-gold/90 text-midnight px-2 py-1 rounded-full text-xs font-medium">
                Poll
              </div>
            )}
          </div>

          {/* Caption */}
          {post.caption && (
            <div className="px-4 py-2">
              <p className="text-sm">{post.caption}</p>
            </div>
          )}

          {/* Poll Options */}
          {post.is_poll && post.poll_options && (
            <div className="px-4 py-2 space-y-2">
              {post.poll_options.map((option) => {
                const voteCount = post.votes?.[option] || 0;
                const percentage = totalVotes > 0 ? (voteCount / totalVotes) * 100 : 0;
                const isSelected = post.user_vote === option;

                return (
                  <button
                    key={option}
                    onClick={() => onVote(post.id, option)}
                    className={cn(
                      'w-full text-left relative overflow-hidden rounded-lg border transition-all',
                      isSelected
                        ? 'border-gold bg-gold/10'
                        : 'border-gold/20 hover:border-gold/40'
                    )}
                  >
                    <div
                      className="absolute inset-0 bg-gold/20 transition-all"
                      style={{ width: post.has_voted ? `${percentage}%` : '0%' }}
                    />
                    <div className="relative px-4 py-3 flex items-center justify-between">
                      <span className={cn('font-medium', isSelected && 'text-gold')}>
                        {option}
                      </span>
                      {post.has_voted && (
                        <span className="text-sm text-muted-foreground">
                          {Math.round(percentage)}%
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
              <p className="text-xs text-muted-foreground text-center">
                {totalVotes} {totalVotes === 1 ? 'vote' : 'votes'}
              </p>
            </div>
          )}

          {/* Actions */}
          <div className="px-4 py-3 border-t border-gold/10 flex items-center gap-2">
            {!post.is_poll && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onVote(post.id, 'like')}
                className={cn(post.has_voted && 'text-gold')}
              >
                <ThumbsUp className="w-4 h-4 mr-1" />
                {totalVotes > 0 && totalVotes}
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={() => onComment(post.id)}>
              <MessageCircle className="w-4 h-4 mr-1" />
              {post.comments_count > 0 && post.comments_count}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => onShare(post)}>
              <Share2 className="w-4 h-4" />
            </Button>
            {post.product_url && (
              <Button variant="ghost" size="sm" asChild className="ml-auto">
                <a href={post.product_url} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="w-4 h-4 mr-1" />
                  Shop
                </a>
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

interface CommentsModalProps {
  postId: string;
  onClose: () => void;
}

function CommentsModal({ postId, onClose }: CommentsModalProps) {
  const { user } = useAuthStore();
  const { toast } = useToast();
  const [comments, setComments] = useState<FeedComment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    loadComments();
  }, [postId]);

  const loadComments = async () => {
    try {
      const data = await feedApi.getComments(postId);
      setComments(data.comments);
    } catch {
      toast({ variant: 'destructive', title: 'Failed to load comments' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const data = await feedApi.addComment(postId, newComment.trim());
      setComments([...comments, data.comment]);
      setNewComment('');
    } catch {
      toast({ variant: 'destructive', title: 'Failed to add comment' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/80 z-50 flex items-end md:items-center justify-center"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: 100 }}
        animate={{ y: 0 }}
        exit={{ y: 100 }}
        className="bg-charcoal w-full md:max-w-lg md:rounded-xl max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 border-b border-gold/20 flex items-center justify-between">
          <h3 className="font-semibold">Comments</h3>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-[200px]">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <RefreshCw className="w-6 h-6 animate-spin text-gold" />
            </div>
          ) : comments.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              No comments yet. Be the first!
            </div>
          ) : (
            comments.map((comment) => (
              <div key={comment.id} className="flex gap-3">
                <Avatar className="w-8 h-8">
                  <AvatarImage src={comment.user_avatar || undefined} />
                  <AvatarFallback>{comment.user_name?.[0] || 'U'}</AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <div className="flex items-baseline gap-2">
                    <span className="font-medium text-sm">{comment.user_name}</span>
                    <span className="text-xs text-muted-foreground">
                      {timeAgo(comment.created_at)}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground">{comment.content}</p>
                </div>
              </div>
            ))
          )}
        </div>

        <form onSubmit={handleSubmit} className="p-4 border-t border-gold/20 flex gap-2">
          <Avatar className="w-8 h-8">
            <AvatarImage src={user?.avatar_url || undefined} />
            <AvatarFallback>{user?.name?.[0] || 'U'}</AvatarFallback>
          </Avatar>
          <Input
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder="Add a comment..."
            className="flex-1"
          />
          <Button type="submit" size="icon" disabled={!newComment.trim() || isSubmitting}>
            <Send className="w-4 h-4" />
          </Button>
        </form>
      </motion.div>
    </motion.div>
  );
}

export default function ShopTogetherPage() {
  const { toast } = useToast();
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'polls' | 'trending'>('all');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);

  useEffect(() => {
    loadPosts(true);
  }, [filter]);

  const loadPosts = async (reset = false) => {
    try {
      const currentPage = reset ? 1 : page;
      const data = await feedApi.getFeed({
        page: currentPage,
        limit: 20,
        filter: filter === 'trending' ? 'all' : filter,
      });

      if (reset) {
        setPosts(data.posts);
        setPage(1);
      } else {
        setPosts((prev) => [...prev, ...data.posts]);
      }
      setHasMore(data.has_more);
    } catch {
      toast({ variant: 'destructive', title: 'Failed to load feed' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleVote = async (postId: string, option: string) => {
    try {
      const data = await feedApi.vote(postId, option);
      setPosts((prev) =>
        prev.map((post) => {
          if (post.id === postId) {
            return {
              ...post,
              votes: data.votes,
              total_votes: Object.values(data.votes).reduce((a, b) => a + b, 0),
              has_voted: true,
              user_vote: option,
            };
          }
          return post;
        })
      );
    } catch {
      toast({ variant: 'destructive', title: 'Failed to vote' });
    }
  };

  const handleShare = async (post: FeedPost) => {
    const shareText = `Check out this outfit on MirrorX! ${post.caption || ''}`;
    const shareUrl = `${window.location.origin}/app/feed?post=${post.id}`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: 'MirrorX Try-On',
          text: shareText,
          url: shareUrl,
        });
      } catch {
        // User cancelled
      }
    } else {
      // Copy to clipboard
      await navigator.clipboard.writeText(`${shareText}\n${shareUrl}`);
      toast({ title: 'Link copied to clipboard!' });
    }
  };

  const loadMore = () => {
    if (hasMore && !isLoading) {
      setPage((p) => p + 1);
      loadPosts();
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <Users className="w-8 h-8 text-gold" />
          <h1 className="text-2xl md:text-3xl font-orbitron font-bold">Shop Together</h1>
        </div>
        <p className="text-muted-foreground">
          See what others are trying on, vote on polls, and share your looks
        </p>
      </div>

      {/* Tabs */}
      <Tabs value={filter} onValueChange={(v) => setFilter(v as typeof filter)} className="mb-6">
        <TabsList className="w-full">
          <TabsTrigger value="all" className="flex-1">
            <Users className="w-4 h-4 mr-2" />
            All
          </TabsTrigger>
          <TabsTrigger value="polls" className="flex-1">
            <ThumbsUp className="w-4 h-4 mr-2" />
            Polls
          </TabsTrigger>
          <TabsTrigger value="trending" className="flex-1">
            <TrendingUp className="w-4 h-4 mr-2" />
            Trending
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Feed */}
      <div className="space-y-4 pb-20">
        {isLoading && posts.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="w-8 h-8 animate-spin text-gold" />
          </div>
        ) : posts.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="font-semibold mb-2">No posts yet</h3>
              <p className="text-muted-foreground text-sm mb-4">
                Be the first to share your try-on! Go to the Try On page, create a look, and share it here.
              </p>
              <Button asChild>
                <a href="/app/tryon">Try On Now</a>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <>
            <AnimatePresence>
              {posts.map((post) => (
                <PostCard
                  key={post.id}
                  post={post}
                  onVote={handleVote}
                  onComment={(id) => setSelectedPostId(id)}
                  onShare={handleShare}
                />
              ))}
            </AnimatePresence>

            {hasMore && (
              <div className="text-center pt-4">
                <Button variant="outline" onClick={loadMore} disabled={isLoading}>
                  {isLoading ? (
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Filter className="w-4 h-4 mr-2" />
                  )}
                  Load More
                </Button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Comments Modal */}
      <AnimatePresence>
        {selectedPostId && (
          <CommentsModal postId={selectedPostId} onClose={() => setSelectedPostId(null)} />
        )}
      </AnimatePresence>
    </div>
  );
}
