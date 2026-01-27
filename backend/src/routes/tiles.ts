import { Router } from 'express';
import path from 'path';
import fs from 'fs';

const router = Router();

const TILES_DIR = path.join(__dirname, '../../../rdr2_extractor/data/tiles');

// GET /api/tiles/:z/:x/:y.jpg
router.get('/:z/:x/:y.jpg', (req, res) => {
  const { z, x, y } = req.params;

  // Construct path: tiles/zoom_{z}/{x}_{y}.jpg
  const tilePath = path.join(TILES_DIR, `zoom_${z}`, `${x}_${y}.jpg`);

  // Check if tile exists
  if (!fs.existsSync(tilePath)) {
    // Return a transparent/placeholder image or 404
    res.status(404).send('Tile not found');
    return;
  }

  // Set cache headers
  res.setHeader('Cache-Control', 'public, max-age=86400'); // Cache for 1 day
  res.setHeader('Content-Type', 'image/jpeg');

  // Send the tile
  res.sendFile(tilePath);
});

// GET /api/tiles/info - Get tile configuration
router.get('/info', (_req, res) => {
  const metadataPath = path.join(TILES_DIR, 'tile_index.json');

  if (fs.existsSync(metadataPath)) {
    const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf-8'));
    res.json(metadata);
  } else {
    res.json({
      format: 'jpg',
      zoom_levels: {
        0: { min_x: 0, max_x: 0, min_y: 0, max_y: 0 },
        1: { min_x: 0, max_x: 1, min_y: 0, max_y: 0 },
        2: { min_x: 0, max_x: 3, min_y: 0, max_y: 2 },
        3: { min_x: 0, max_x: 7, min_y: 0, max_y: 5 },
        4: { min_x: 0, max_x: 15, min_y: 0, max_y: 11 },
        5: { min_x: 0, max_x: 31, min_y: 0, max_y: 23 },
        6: { min_x: 0, max_x: 63, min_y: 0, max_y: 46 }
      }
    });
  }
});

export default router;
