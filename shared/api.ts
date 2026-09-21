import type { Asset, Waypoint } from './contract';
export type { Asset } from './contract';

export interface Category {
  id: number;
  title: string;
  icon: string;
  group_id: number | null;
  visible: 0 | 1;
  marker_count: number;
  icon_asset: Asset | null;
  icon_reason: string | null;
}

export interface Marker {
  id: number;
  name: string;
  category_id: number;
  coord_x: number;
  coord_y: number;
  description: string | null;
  category_title: string;
  category_icon: string;
  category_icon_asset: Asset | null;
  icon_reason: string | null;
  image_discovery: Waypoint['imageDiscovery'];
  description_format: Waypoint['descriptionFormat'];
  discovery_error: string | null;
  source_url: string;
}

export interface MarkerDetail extends Marker {
  images: (Asset & { order: number; caption: string | null; attribution: string | null })[];
}

export interface UserProgress {
  marker_id: number;
  found: boolean | 0 | 1;
  found_at: string | null;
}

export interface ProgressStats {
  total: number;
  found: number;
  by_category: {
    category_id: number;
    category_title: string;
    total: number;
    found: number;
  }[];
}

export interface TileInfo {
  format: string;
  zoom_levels: {
    [key: string]: {
      min_x: number;
      max_x: number;
      min_y: number;
      max_y: number;
      count: number;
    };
  };
}
