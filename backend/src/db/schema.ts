import Database from 'better-sqlite3';
import path from 'path';

const DB_PATH = path.join(__dirname, '../../data/rdr2.db');

export function initializeDatabase(): Database.Database {
  const db = new Database(DB_PATH);

  // Enable foreign keys
  db.pragma('foreign_keys = ON');

  // Create tables
  db.exec(`
    -- Categories table
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY,
      title TEXT NOT NULL,
      icon TEXT NOT NULL,
      group_id INTEGER,
      visible INTEGER DEFAULT 1
    );

    -- Markers table
    CREATE TABLE IF NOT EXISTS markers (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      category_id INTEGER NOT NULL,
      coord_x REAL NOT NULL,
      coord_y REAL NOT NULL,
      description TEXT,
      FOREIGN KEY (category_id) REFERENCES categories(id)
    );

    -- User progress table
    CREATE TABLE IF NOT EXISTS user_progress (
      marker_id INTEGER PRIMARY KEY,
      found INTEGER DEFAULT 0,
      found_at TEXT,
      FOREIGN KEY (marker_id) REFERENCES markers(id)
    );

    -- Indexes for performance
    CREATE INDEX IF NOT EXISTS idx_markers_category ON markers(category_id);
    CREATE INDEX IF NOT EXISTS idx_progress_found ON user_progress(found);
  `);

  return db;
}

export function getDatabase(): Database.Database {
  return new Database(DB_PATH);
}
