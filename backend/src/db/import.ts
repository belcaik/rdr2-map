import fs from 'fs';
import path from 'path';
import { initializeDatabase } from './schema';
import type { ExtractedData, RawMarkerData } from '../types';

const DATA_FILE = path.join(__dirname, '../../../rdr2_extractor/data/window_data/extracted_data_20260125_174604.json');

function importData() {
  console.log('Starting data import...');

  // Read the extracted data
  console.log(`Reading data from: ${DATA_FILE}`);
  const rawData = fs.readFileSync(DATA_FILE, 'utf-8');
  const data: ExtractedData = JSON.parse(rawData);

  console.log(`Found ${data.markers.length} markers`);

  // Initialize database
  const db = initializeDatabase();

  // Clear existing data
  console.log('Clearing existing data...');
  db.exec('DELETE FROM user_progress');
  db.exec('DELETE FROM markers');
  db.exec('DELETE FROM categories');

  // Extract unique categories
  const categoriesMap = new Map<number, RawMarkerData['category']>();
  for (const marker of data.markers) {
    if (marker.category && !categoriesMap.has(marker.category.id)) {
      categoriesMap.set(marker.category.id, marker.category);
    }
  }

  console.log(`Found ${categoriesMap.size} unique categories`);

  // Insert categories
  const insertCategory = db.prepare(`
    INSERT INTO categories (id, title, icon, group_id, visible)
    VALUES (?, ?, ?, ?, ?)
  `);

  const insertCategories = db.transaction((categories: RawMarkerData['category'][]) => {
    for (const cat of categories) {
      insertCategory.run(
        cat.id,
        cat.title,
        cat.icon,
        cat.group_id,
        cat.visible ? 1 : 0
      );
    }
  });

  insertCategories(Array.from(categoriesMap.values()));
  console.log('Categories inserted');

  // Insert markers
  const insertMarker = db.prepare(`
    INSERT INTO markers (id, name, category_id, coord_x, coord_y, description)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const insertMarkers = db.transaction((markers: RawMarkerData[]) => {
    for (const marker of markers) {
      if (marker.category && marker.coordinates) {
        insertMarker.run(
          marker.id,
          marker.name,
          marker.category.id,
          marker.coordinates.x,
          marker.coordinates.y,
          marker.description || null
        );
      }
    }
  });

  insertMarkers(data.markers);
  console.log('Markers inserted');

  // Verify counts
  const categoryCount = db.prepare('SELECT COUNT(*) as count FROM categories').get() as { count: number };
  const markerCount = db.prepare('SELECT COUNT(*) as count FROM markers').get() as { count: number };

  console.log('\n=== Import Complete ===');
  console.log(`Categories: ${categoryCount.count}`);
  console.log(`Markers: ${markerCount.count}`);

  // Show category breakdown
  console.log('\n=== Categories Breakdown ===');
  const categoryStats = db.prepare(`
    SELECT c.title, COUNT(m.id) as marker_count
    FROM categories c
    LEFT JOIN markers m ON c.id = m.category_id
    GROUP BY c.id
    ORDER BY marker_count DESC
    LIMIT 10
  `).all() as { title: string; marker_count: number }[];

  for (const stat of categoryStats) {
    console.log(`  ${stat.title}: ${stat.marker_count}`);
  }
  console.log('  ...');

  db.close();
}

importData();
