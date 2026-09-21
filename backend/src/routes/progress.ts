import { Router } from 'express';
import type Database from 'better-sqlite3';
import type { UserProgress, ProgressStats } from '../types';

export function progressRouter(db: Database.Database) {
const router = Router();

// GET /api/progress - Get all progress entries
router.get('/', (_req, res) => {


  const progress = db.prepare(`
    SELECT marker_id, found, found_at
    FROM user_progress
    WHERE found = 1
  `).all() as UserProgress[];

  res.json(progress);
});

// GET /api/progress/stats - Get progress statistics
router.get('/stats', (_req, res) => {


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

// POST /api/progress/reset - Reset all progress
router.post('/reset', (_req, res) => {


  db.prepare('DELETE FROM user_progress').run();

  res.json({ success: true, message: 'All progress has been reset' });
});

// POST /api/progress/:markerId - Toggle marker found status
router.post('/:markerId', (req, res) => {

  const markerId = Number(req.params.markerId);
  if (!Number.isSafeInteger(markerId) || markerId < 1) { res.status(400).json({error:'Invalid marker ID'}); return; }
  const { found } = req.body as { found?: boolean };

  if (found !== undefined && typeof found !== 'boolean') { res.status(400).json({error:'found must be boolean'}); return; }
  const foundAt = new Date().toISOString();

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
    `).run(newFound ? 1 : 0, newFound ? foundAt : null, markerId);
  } else {
    // Insert new
    db.prepare(`
      INSERT INTO user_progress (marker_id, found, found_at)
      VALUES (?, ?, ?)
    `).run(markerId, newFound ? 1 : 0, newFound ? foundAt : null);
  }

  res.json({
    marker_id: markerId,
    found: newFound,
    found_at: newFound ? foundAt : null
  });
});

// POST /api/progress/category/:categoryId/reset - Reset progress for a category
router.post('/category/:categoryId/reset', (req, res) => {

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

return router;
}
