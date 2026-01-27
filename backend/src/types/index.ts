export interface Category {
  id: number;
  title: string;
  icon: string;
  group_id: number;
  visible: boolean;
}

export interface Marker {
  id: number;
  name: string;
  category_id: number;
  coord_x: number;
  coord_y: number;
  description: string | null;
}

export interface MarkerWithCategory extends Marker {
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

// Raw data from scraped JSON
export interface RawMarkerData {
  id: number;
  name: string;
  category: {
    id: number;
    title: string;
    icon: string;
    group_id: number;
    visible: boolean;
  };
  coordinates: {
    x: number;
    y: number;
  };
  description: string | null;
}

export interface ExtractedData {
  markers: RawMarkerData[];
  analysis_summary: {
    marker_categories: Record<string, number>;
  };
}
