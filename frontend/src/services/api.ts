import type { Category, Marker, UserProgress, ProgressStats, TileInfo } from '../types';

const API_BASE = 'http://localhost:3001/api';

export async function fetchCategories(): Promise<Category[]> {
  const response = await fetch(`${API_BASE}/markers/categories`);
  if (!response.ok) throw new Error('Failed to fetch categories');
  return response.json();
}

export async function fetchMarkers(): Promise<Marker[]> {
  const response = await fetch(`${API_BASE}/markers`);
  if (!response.ok) throw new Error('Failed to fetch markers');
  return response.json();
}

export async function fetchProgress(): Promise<UserProgress[]> {
  const response = await fetch(`${API_BASE}/progress`);
  if (!response.ok) throw new Error('Failed to fetch progress');
  return response.json();
}

export async function fetchProgressStats(): Promise<ProgressStats> {
  const response = await fetch(`${API_BASE}/progress/stats`);
  if (!response.ok) throw new Error('Failed to fetch progress stats');
  return response.json();
}

export async function toggleMarkerFound(markerId: number, found?: boolean): Promise<UserProgress> {
  const response = await fetch(`${API_BASE}/progress/${markerId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ found }),
  });
  if (!response.ok) throw new Error('Failed to toggle marker');
  return response.json();
}

export async function resetProgress(): Promise<void> {
  const response = await fetch(`${API_BASE}/progress/reset`, {
    method: 'POST',
  });
  if (!response.ok) throw new Error('Failed to reset progress');
}

export async function fetchTileInfo(): Promise<TileInfo> {
  const response = await fetch(`${API_BASE}/tiles/info`);
  if (!response.ok) throw new Error('Failed to fetch tile info');
  return response.json();
}

export function getTileUrl(z: number, x: number, y: number): string {
  return `${API_BASE}/tiles/${z}/${x}/${y}.jpg`;
}
