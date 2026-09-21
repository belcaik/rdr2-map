import type { Category as CategoryResponse, Marker as MarkerResponse } from '../../../shared/api';
export type { UserProgress, ProgressStats } from '../../../shared/api';
export type Category = Omit<CategoryResponse, 'icon_asset' | 'marker_count'>;
export type MarkerWithCategory = Omit<MarkerResponse, 'category_icon_asset'>;
