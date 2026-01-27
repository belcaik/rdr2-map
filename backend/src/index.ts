import express from 'express';
import cors from 'cors';
import path from 'path';

import tilesRouter from './routes/tiles';
import markersRouter from './routes/markers';
import progressRouter from './routes/progress';
import { closeDb } from './db';

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/tiles', tilesRouter);
app.use('/api/markers', markersRouter);
app.use('/api/progress', progressRouter);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Error handling
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Error:', err.message);
  res.status(500).json({ error: 'Internal server error' });
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down...');
  closeDb();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\nShutting down...');
  closeDb();
  process.exit(0);
});

// Start server
app.listen(PORT, () => {
  console.log(`
====================================
  RDR2 Map Backend Server
====================================
  Port: ${PORT}

  Endpoints:
    GET  /api/health          - Health check
    GET  /api/tiles/:z/:x/:y  - Get map tile
    GET  /api/tiles/info      - Get tile config
    GET  /api/markers         - Get all markers
    GET  /api/markers/:id     - Get single marker
    GET  /api/markers/categories - Get categories
    GET  /api/progress        - Get found markers
    GET  /api/progress/stats  - Get progress stats
    POST /api/progress/:id    - Toggle marker found
    POST /api/progress/reset  - Reset all progress
====================================
  `);
});
