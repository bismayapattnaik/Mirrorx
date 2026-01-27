import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { query } from '../db/index.js';

const router = Router();

// Ensure feed tables exist
async function ensureFeedTables() {
  await query(`
    CREATE TABLE IF NOT EXISTS feed_posts (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      tryon_job_id UUID REFERENCES tryon_jobs(id) ON DELETE SET NULL,
      tryon_image_url TEXT NOT NULL,
      product_url TEXT,
      product_title TEXT,
      caption TEXT,
      is_poll BOOLEAN DEFAULT FALSE,
      poll_question TEXT,
      poll_options JSONB DEFAULT '[]',
      visibility TEXT DEFAULT 'public' CHECK (visibility IN ('public', 'friends', 'private')),
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS feed_votes (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      post_id UUID NOT NULL REFERENCES feed_posts(id) ON DELETE CASCADE,
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      vote_option TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(post_id, user_id)
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS feed_comments (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      post_id UUID NOT NULL REFERENCES feed_posts(id) ON DELETE CASCADE,
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      content TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  // Create indexes
  await query(`CREATE INDEX IF NOT EXISTS idx_feed_posts_user ON feed_posts(user_id)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_feed_posts_created ON feed_posts(created_at DESC)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_feed_votes_post ON feed_votes(post_id)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_feed_comments_post ON feed_comments(post_id)`);
}

// Initialize tables
ensureFeedTables().catch(console.error);

// GET /feed - Get feed posts
router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId;
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);
    const filter = (req.query.filter as string) || 'all';
    const offset = (page - 1) * limit;

    let whereClause = "fp.visibility = 'public'";
    if (filter === 'polls') {
      whereClause += ' AND fp.is_poll = TRUE';
    }

    const result = await query<{
      id: string;
      user_id: string;
      user_name: string;
      user_avatar: string | null;
      tryon_image_url: string;
      product_url: string | null;
      product_title: string | null;
      caption: string | null;
      is_poll: boolean;
      poll_question: string | null;
      poll_options: string[];
      created_at: string;
      comments_count: number;
    }>(
      `SELECT
        fp.id, fp.user_id, u.name as user_name, u.avatar_url as user_avatar,
        fp.tryon_image_url, fp.product_url, fp.product_title, fp.caption,
        fp.is_poll, fp.poll_question, fp.poll_options, fp.created_at,
        (SELECT COUNT(*)::int FROM feed_comments WHERE post_id = fp.id) as comments_count
      FROM feed_posts fp
      JOIN users u ON fp.user_id = u.id
      WHERE ${whereClause}
      ORDER BY fp.created_at DESC
      LIMIT $1 OFFSET $2`,
      [limit, offset]
    );

    // Get votes for each post and check if current user voted
    const posts = await Promise.all(
      result.rows.map(async (post) => {
        const votesResult = await query<{ vote_option: string; count: string }>(
          `SELECT vote_option, COUNT(*)::text as count
           FROM feed_votes WHERE post_id = $1
           GROUP BY vote_option`,
          [post.id]
        );

        const votes: Record<string, number> = {};
        let totalVotes = 0;
        votesResult.rows.forEach((v) => {
          votes[v.vote_option] = parseInt(v.count);
          totalVotes += parseInt(v.count);
        });

        // Check if user voted
        const userVoteResult = await query<{ vote_option: string }>(
          `SELECT vote_option FROM feed_votes WHERE post_id = $1 AND user_id = $2`,
          [post.id, userId]
        );

        return {
          ...post,
          votes,
          total_votes: totalVotes,
          has_voted: userVoteResult.rows.length > 0,
          user_vote: userVoteResult.rows[0]?.vote_option || null,
        };
      })
    );

    const countResult = await query<{ count: string }>(
      `SELECT COUNT(*) FROM feed_posts fp WHERE ${whereClause}`,
      []
    );
    const total = parseInt(countResult.rows[0].count);

    res.json({
      posts,
      total,
      page,
      has_more: offset + posts.length < total,
    });
  } catch (error) {
    console.error('Get feed error:', error);
    res.status(500).json({ error: 'Server error', message: 'Failed to get feed' });
  }
});

// POST /feed - Create a new post
router.post('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId;
    const { tryon_job_id, caption, is_poll, poll_question, poll_options, visibility } = req.body;

    if (!tryon_job_id) {
      return res.status(400).json({ error: 'Missing tryon_job_id' });
    }

    // Get try-on job
    const jobResult = await query<{ result_image_url: string; product_url: string }>(
      `SELECT result_image_url, product_url FROM tryon_jobs
       WHERE id = $1 AND user_id = $2 AND status = 'SUCCEEDED'`,
      [tryon_job_id, userId]
    );

    if (jobResult.rows.length === 0) {
      return res.status(404).json({ error: 'Try-on job not found or not completed' });
    }

    const job = jobResult.rows[0];

    const result = await query<{
      id: string;
      tryon_image_url: string;
      caption: string | null;
      is_poll: boolean;
      poll_options: string[];
      created_at: string;
    }>(
      `INSERT INTO feed_posts (user_id, tryon_job_id, tryon_image_url, product_url, caption, is_poll, poll_question, poll_options, visibility)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id, tryon_image_url, caption, is_poll, poll_options, created_at`,
      [
        userId,
        tryon_job_id,
        job.result_image_url,
        job.product_url,
        caption || null,
        is_poll || false,
        poll_question || null,
        JSON.stringify(poll_options || ['Yes', 'No']),
        visibility || 'public',
      ]
    );

    // Get user info
    const userResult = await query<{ name: string; avatar_url: string | null }>(
      `SELECT name, avatar_url FROM users WHERE id = $1`,
      [userId]
    );

    const post = {
      ...result.rows[0],
      user_id: userId,
      user_name: userResult.rows[0]?.name || 'User',
      user_avatar: userResult.rows[0]?.avatar_url,
      product_url: job.product_url,
      product_title: null,
      votes: {},
      total_votes: 0,
      comments_count: 0,
      has_voted: false,
      user_vote: null,
    };

    res.status(201).json({ success: true, post });
  } catch (error) {
    console.error('Create post error:', error);
    res.status(500).json({ error: 'Server error', message: 'Failed to create post' });
  }
});

// POST /feed/:id/vote - Vote on a poll
router.post('/:id/vote', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId;
    const postId = req.params.id;
    const { option } = req.body;

    if (!option) {
      return res.status(400).json({ error: 'Missing vote option' });
    }

    // Check if post exists and is a poll
    const postResult = await query<{ is_poll: boolean; poll_options: string[] }>(
      `SELECT is_poll, poll_options FROM feed_posts WHERE id = $1`,
      [postId]
    );

    if (postResult.rows.length === 0) {
      return res.status(404).json({ error: 'Post not found' });
    }

    // Upsert vote
    await query(
      `INSERT INTO feed_votes (post_id, user_id, vote_option)
       VALUES ($1, $2, $3)
       ON CONFLICT (post_id, user_id)
       DO UPDATE SET vote_option = $3`,
      [postId, userId, option]
    );

    // Get updated votes
    const votesResult = await query<{ vote_option: string; count: string }>(
      `SELECT vote_option, COUNT(*)::text as count
       FROM feed_votes WHERE post_id = $1
       GROUP BY vote_option`,
      [postId]
    );

    const votes: Record<string, number> = {};
    votesResult.rows.forEach((v) => {
      votes[v.vote_option] = parseInt(v.count);
    });

    res.json({ success: true, votes });
  } catch (error) {
    console.error('Vote error:', error);
    res.status(500).json({ error: 'Server error', message: 'Failed to vote' });
  }
});

// GET /feed/:id/comments - Get comments
router.get('/:id/comments', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const postId = req.params.id;

    const result = await query<{
      id: string;
      user_id: string;
      user_name: string;
      user_avatar: string | null;
      content: string;
      created_at: string;
    }>(
      `SELECT fc.id, fc.user_id, u.name as user_name, u.avatar_url as user_avatar,
              fc.content, fc.created_at
       FROM feed_comments fc
       JOIN users u ON fc.user_id = u.id
       WHERE fc.post_id = $1
       ORDER BY fc.created_at ASC`,
      [postId]
    );

    res.json({ comments: result.rows });
  } catch (error) {
    console.error('Get comments error:', error);
    res.status(500).json({ error: 'Server error', message: 'Failed to get comments' });
  }
});

// POST /feed/:id/comments - Add comment
router.post('/:id/comments', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId;
    const postId = req.params.id;
    const { content } = req.body;

    if (!content || content.trim().length === 0) {
      return res.status(400).json({ error: 'Comment content is required' });
    }

    const result = await query<{
      id: string;
      content: string;
      created_at: string;
    }>(
      `INSERT INTO feed_comments (post_id, user_id, content)
       VALUES ($1, $2, $3)
       RETURNING id, content, created_at`,
      [postId, userId, content.trim()]
    );

    // Get user info
    const userResult = await query<{ name: string; avatar_url: string | null }>(
      `SELECT name, avatar_url FROM users WHERE id = $1`,
      [userId]
    );

    const comment = {
      ...result.rows[0],
      user_id: userId,
      user_name: userResult.rows[0]?.name || 'User',
      user_avatar: userResult.rows[0]?.avatar_url,
    };

    res.status(201).json({ success: true, comment });
  } catch (error) {
    console.error('Add comment error:', error);
    res.status(500).json({ error: 'Server error', message: 'Failed to add comment' });
  }
});

// DELETE /feed/:id - Delete post
router.delete('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId;
    const postId = req.params.id;

    const result = await query(
      `DELETE FROM feed_posts WHERE id = $1 AND user_id = $2 RETURNING id`,
      [postId, userId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Post not found or not authorized' });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Delete post error:', error);
    res.status(500).json({ error: 'Server error', message: 'Failed to delete post' });
  }
});

// GET /feed/trending - Get trending posts
router.get('/trending', authenticate, async (_req: AuthRequest, res: Response) => {
  try {
    const result = await query<{
      id: string;
      user_id: string;
      user_name: string;
      user_avatar: string | null;
      tryon_image_url: string;
      product_url: string | null;
      caption: string | null;
      is_poll: boolean;
      poll_options: string[];
      created_at: string;
      vote_count: number;
    }>(
      `SELECT
        fp.id, fp.user_id, u.name as user_name, u.avatar_url as user_avatar,
        fp.tryon_image_url, fp.product_url, fp.caption,
        fp.is_poll, fp.poll_options, fp.created_at,
        (SELECT COUNT(*)::int FROM feed_votes WHERE post_id = fp.id) as vote_count
      FROM feed_posts fp
      JOIN users u ON fp.user_id = u.id
      WHERE fp.visibility = 'public'
        AND fp.created_at > NOW() - INTERVAL '7 days'
      ORDER BY vote_count DESC, fp.created_at DESC
      LIMIT 10`,
      []
    );

    res.json({ posts: result.rows });
  } catch (error) {
    console.error('Get trending error:', error);
    res.status(500).json({ error: 'Server error', message: 'Failed to get trending' });
  }
});

export default router;
