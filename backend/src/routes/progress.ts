import { Router } from 'express';
import { getDb } from '../db';
import type { UserProgress, ProgressStats } from '../types';

const router = Router();

// GET /api/progress - Get all progress entries
router.get('/', (_req, res) => {
  const db = getDb();

  const progress = db.prepare(`
    SELECT marker_id, found, found_at
    FROM user_progress
    WHERE found = 1
  `).all() as UserProgress[];

  res.json(progress);
});

// GET /api/progress/stats - Get progress statistics
router.get('/stats', (_req, res) => {
  const db = getDb();

  // Total markers
  const totalResult = db.prepare('SELECT COUNT(*) as count FROM markers').get() as { count: number };

  // Found markers
  const foundResult = db.prepare('SELECT COUNT(*) as count FROM user_progress WHERE found = 1').get() as { count: number };

  // By category
  const byCategory = db.prepare(`
    SELECT
      c.id as category_id,
      c.title as category_title,
      COUNT(m.id) as total,
      COUNT(CASE WHEN up.found = 1 THEN 1 END) as found
    FROM categories c
    LEFT JOIN markers m ON c.id = m.category_id
    LEFT JOIN user_progress up ON m.id = up.marker_id
    GROUP BY c.id
    ORDER BY c.title
  `).all() as ProgressStats['by_category'];

  const stats: ProgressStats = {
    total: totalResult.count,
    found: foundResult.count,
    by_category: byCategory
  };

  res.json(stats);
});

// POST /api/progress/:markerId - Toggle marker found status
router.post('/:markerId', (req, res) => {
  const db = getDb();
  const markerId = parseInt(req.params.markerId, 10);
  const { found } = req.body as { found?: boolean };

  // Check if marker exists
  const marker = db.prepare('SELECT id FROM markers WHERE id = ?').get(markerId);
  if (!marker) {
    res.status(404).json({ error: 'Marker not found' });
    return;
  }

  // Check current status
  const existing = db.prepare('SELECT found FROM user_progress WHERE marker_id = ?').get(markerId) as { found: number } | undefined;

  // Determine new status
  const newFound = found !== undefined ? found : !(existing?.found);

  if (existing) {
    // Update existing
    db.prepare(`
      UPDATE user_progress
      SET found = ?, found_at = ?
      WHERE marker_id = ?
    `).run(newFound ? 1 : 0, newFound ? new Date().toISOString() : null, markerId);
  } else {
    // Insert new
    db.prepare(`
      INSERT INTO user_progress (marker_id, found, found_at)
      VALUES (?, ?, ?)
    `).run(markerId, newFound ? 1 : 0, newFound ? new Date().toISOString() : null);
  }

  res.json({
    marker_id: markerId,
    found: newFound,
    found_at: newFound ? new Date().toISOString() : null
  });
});

// POST /api/progress/reset - Reset all progress
router.post('/reset', (_req, res) => {
  const db = getDb();

  db.prepare('DELETE FROM user_progress').run();

  res.json({ success: true, message: 'All progress has been reset' });
});

// POST /api/progress/category/:categoryId/reset - Reset progress for a category
router.post('/category/:categoryId/reset', (req, res) => {
  const db = getDb();
  const categoryId = parseInt(req.params.categoryId, 10);

  const result = db.prepare(`
    DELETE FROM user_progress
    WHERE marker_id IN (SELECT id FROM markers WHERE category_id = ?)
  `).run(categoryId);

  res.json({
    success: true,
    message: `Reset ${result.changes} markers in category ${categoryId}`
  });
});

export default router;
