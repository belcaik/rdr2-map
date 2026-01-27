export interface Category {
  id: number;
  title: string;
  icon: string;
  group_id: number;
  visible: boolean;
  marker_count: number;
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
}

export interface UserProgress {
  marker_id: number;
  found: boolean;
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
