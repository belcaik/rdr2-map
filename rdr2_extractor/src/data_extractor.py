import json
import logging
from typing import Dict, List, Any, Optional
from pathlib import Path
from datetime import datetime
import re
from dataclasses import dataclass, asdict
from urllib.parse import urlparse

@dataclass
class MarkerData:
    id: str
    name: str
    category: str
    coordinates: Dict[str, float]
    description: Optional[str] = None
    image_url: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None

@dataclass
class MapRegion:
    id: str
    name: str
    bounds: Dict[str, Any]
    zoom_levels: List[int]
    tile_urls: List[str]

class DataExtractor:
    def __init__(self, output_dir: str = "data/window_data"):
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)
        self.logger = logging.getLogger(__name__)
        
        # Extracted data storage
        self.markers = []
        self.regions = []
        self.map_config = {}
        self.tile_sources = []
        
    def extract_and_analyze_window_data(self, window_objects: Dict[str, Any]) -> Dict[str, Any]:
        """Extract and analyze all window object data"""
        extracted_data = {
            'timestamp': datetime.now().isoformat(),
            'markers': [],
            'map_config': {},
            'tile_sources': [],
            'regions': [],
            'raw_data': window_objects,
            'analysis_summary': {}
        }
        
        # Process mapData
        if 'mapData' in window_objects:
            self.logger.info("Processing window.mapData")
            map_data = self._process_map_data(window_objects['mapData'])
            extracted_data.update(map_data)
        
        # Process locations
        if 'locations' in window_objects:
            self.logger.info("Processing window.locations")
            locations = self._process_locations(window_objects['locations'])
            extracted_data['markers'].extend(locations)
        
        # Process markers
        if 'markers' in window_objects:
            self.logger.info("Processing window.markers")
            markers = self._process_markers(window_objects['markers'])
            extracted_data['markers'].extend(markers)
        
        # Process config
        if 'config' in window_objects:
            self.logger.info("Processing window.config")
            config = self._process_config(window_objects['config'])
            extracted_data['map_config'].update(config)
        
        # Analyze all properties for additional data
        if 'all_properties' in window_objects:
            self.logger.info("Analyzing all window properties")
            additional_data = self._analyze_all_properties(window_objects['all_properties'])
            extracted_data.update(additional_data)
        
        # Generate analysis summary
        extracted_data['analysis_summary'] = self._generate_summary(extracted_data)
        
        return extracted_data
    
    def _process_map_data(self, map_data: Any) -> Dict[str, Any]:
        """Process window.mapData object"""
        processed = {
            'markers': [],
            'map_config': {},
            'tile_sources': [],
            'regions': []
        }
        
        try:
            if isinstance(map_data, dict):
                # Look for common map data structures
                for key, value in map_data.items():
                    if key.lower() in ['markers', 'points', 'locations', 'pois']:
                        processed['markers'].extend(self._extract_markers_from_data(value))
                    elif key.lower() in ['config', 'settings', 'options']:
                        processed['map_config'].update(self._extract_config_from_data(value))
                    elif key.lower() in ['tiles', 'layers', 'tilesources']:
                        processed['tile_sources'].extend(self._extract_tile_sources(value))
                    elif key.lower() in ['regions', 'areas', 'zones']:
                        processed['regions'].extend(self._extract_regions(value))
            
            elif isinstance(map_data, list):
                # If mapData is a list, try to process each item
                for item in map_data:
                    if isinstance(item, dict):
                        processed['markers'].extend(self._extract_markers_from_data(item))
                        
        except Exception as e:
            self.logger.error(f"Error processing map data: {e}")
        
        return processed
    
    def _process_locations(self, locations: Any) -> List[Dict[str, Any]]:
        """Process window.locations object"""
        markers = []
        
        try:
            if isinstance(locations, list):
                for location in locations:
                    marker = self._create_marker_from_location(location)
                    if marker:
                        markers.append(marker)
            elif isinstance(locations, dict):
                # If locations is a dict, might be keyed by ID or category
                for key, value in locations.items():
                    if isinstance(value, list):
                        for location in value:
                            marker = self._create_marker_from_location(location)
                            if marker:
                                markers.append(marker)
                    elif isinstance(value, dict):
                        marker = self._create_marker_from_location(value)
                        if marker:
                            markers.append(marker)
                            
        except Exception as e:
            self.logger.error(f"Error processing locations: {e}")
        
        return markers
    
    def _process_markers(self, markers_data: Any) -> List[Dict[str, Any]]:
        """Process window.markers object"""
        markers = []
        
        try:
            if isinstance(markers_data, list):
                for marker_data in markers_data:
                    marker = self._create_marker_from_data(marker_data)
                    if marker:
                        markers.append(marker)
            elif isinstance(markers_data, dict):
                for key, value in markers_data.items():
                    if isinstance(value, list):
                        for marker_data in value:
                            marker = self._create_marker_from_data(marker_data)
                            if marker:
                                markers.append(marker)
                    elif isinstance(value, dict):
                        marker = self._create_marker_from_data(value)
                        if marker:
                            markers.append(marker)
                            
        except Exception as e:
            self.logger.error(f"Error processing markers: {e}")
        
        return markers
    
    def _process_config(self, config_data: Any) -> Dict[str, Any]:
        """Process configuration data"""
        config = {}
        
        try:
            if isinstance(config_data, dict):
                # Extract common configuration keys
                for key, value in config_data.items():
                    if key.lower() in ['map', 'tiles', 'api', 'base', 'url', 'endpoint']:
                        config[key] = value
                    elif isinstance(value, (str, int, float, bool)):
                        config[key] = value
                        
        except Exception as e:
            self.logger.error(f"Error processing config: {e}")
        
        return config
    
    def _analyze_all_properties(self, all_props: Dict[str, Any]) -> Dict[str, Any]:
        """Analyze all window properties for additional data"""
        additional_data = {
            'additional_markers': [],
            'additional_config': {},
            'interesting_properties': []
        }
        
        try:
            for prop_name, prop_value in all_props.items():
                # Skip common non-relevant properties
                if prop_name.lower() in ['location', 'navigator', 'document', 'history', 'screen']:
                    continue
                
                # Look for data-like properties
                if self._is_data_property(prop_name, prop_value):
                    additional_data['interesting_properties'].append({
                        'property': prop_name,
                        'type': type(prop_value).__name__,
                        'value': prop_value if len(str(prop_value)) < 1000 else str(prop_value)[:1000] + "..."
                    })
                
                # Try to extract markers from any array-like properties
                if isinstance(prop_value, str):
                    try:
                        parsed_value = json.loads(prop_value)
                        if isinstance(parsed_value, list):
                            markers = self._extract_markers_from_data(parsed_value)
                            additional_data['additional_markers'].extend(markers)
                    except (json.JSONDecodeError, TypeError):
                        pass
                        
        except Exception as e:
            self.logger.error(f"Error analyzing all properties: {e}")
        
        return additional_data
    
    def _extract_markers_from_data(self, data: Any) -> List[Dict[str, Any]]:
        """Extract marker data from various data structures"""
        markers = []
        
        try:
            if isinstance(data, list):
                for item in data:
                    marker = self._create_marker_from_data(item)
                    if marker:
                        markers.append(marker)
            elif isinstance(data, dict):
                marker = self._create_marker_from_data(data)
                if marker:
                    markers.append(marker)
                    
        except Exception as e:
            self.logger.error(f"Error extracting markers from data: {e}")
        
        return markers
    
    def _create_marker_from_location(self, location: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Create marker object from location data"""
        try:
            # Common location data fields
            marker = {
                'id': location.get('id', location.get('_id', self._generate_safe_id(location))),
                'name': location.get('name', location.get('title', 'Unknown')),
                'category': location.get('category', location.get('type', 'unknown')),
                'coordinates': {},
                'metadata': location
            }
            
            # Extract coordinates
            coords = self._extract_coordinates(location)
            if coords:
                marker['coordinates'] = coords
            else:
                return None  # Skip markers without coordinates
            
            # Extract additional fields
            marker['description'] = location.get('description', location.get('desc'))
            marker['image_url'] = location.get('image', location.get('icon', location.get('img')))
            
            return marker
            
        except Exception as e:
            self.logger.error(f"Error creating marker from location: {e}")
            return None
    
    def _create_marker_from_data(self, data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Create marker object from generic data"""
        try:
            if not isinstance(data, dict):
                return None
            
            # Look for coordinate-like data
            coords = self._extract_coordinates(data)
            if not coords:
                return None
            
            marker = {
                'id': data.get('id', data.get('_id', self._generate_safe_id(data))),
                'name': data.get('name', data.get('title', data.get('label', 'Unknown'))),
                'category': data.get('category', data.get('type', data.get('class', 'unknown'))),
                'coordinates': coords,
                'description': data.get('description', data.get('desc')),
                'image_url': data.get('image', data.get('icon', data.get('img'))),
                'metadata': data
            }
            
            return marker
            
        except Exception as e:
            self.logger.error(f"Error creating marker from data: {e}")
            return None
    
    def _extract_coordinates(self, data: Dict[str, Any]) -> Optional[Dict[str, float]]:
        """Extract coordinate information from data"""
        try:
            coords = {}
            
            # Common coordinate field names
            coord_fields = [
                ('x', 'y'), ('lat', 'lng'), ('lat', 'lon'), ('latitude', 'longitude'),
                ('pos_x', 'pos_y'), ('coord_x', 'coord_y'), ('position_x', 'position_y')
            ]
            
            for x_field, y_field in coord_fields:
                if x_field in data and y_field in data:
                    try:
                        coords['x'] = float(data[x_field])
                        coords['y'] = float(data[y_field])
                        return coords
                    except (ValueError, TypeError):
                        continue
            
            # Check for nested coordinate objects
            coord_objects = ['coordinates', 'coord', 'pos', 'position', 'location']
            for coord_obj in coord_objects:
                if coord_obj in data and isinstance(data[coord_obj], dict):
                    nested_coords = self._extract_coordinates(data[coord_obj])
                    if nested_coords:
                        return nested_coords
            
            # Check for array-like coordinates [x, y]
            coord_arrays = ['coordinates', 'coord', 'pos', 'position']
            for coord_array in coord_arrays:
                if coord_array in data and isinstance(data[coord_array], list) and len(data[coord_array]) >= 2:
                    try:
                        coords['x'] = float(data[coord_array][0])
                        coords['y'] = float(data[coord_array][1])
                        return coords
                    except (ValueError, TypeError, IndexError):
                        continue
            
            return None
            
        except Exception as e:
            self.logger.error(f"Error extracting coordinates: {e}")
            return None
    
    def _generate_safe_id(self, data: Dict[str, Any]) -> str:
        """Generate a safe ID from data without hashable type issues"""
        try:
            # Try to use coordinates as primary identifier
            coords = self._extract_coordinates(data)
            if coords:
                return f"marker_{coords.get('x', 0)}_{coords.get('y', 0)}"
            
            # Fallback to name or any string field
            for field in ['name', 'title', 'label', 'type', 'category']:
                if field in data and isinstance(data[field], (str, int, float)):
                    return f"marker_{str(data[field]).replace(' ', '_')}"
            
            # Last resort: use timestamp-based ID
            import time
            return f"marker_{int(time.time() * 1000)}"
            
        except Exception as e:
            self.logger.error(f"Error generating safe ID: {e}")
            import time
            return f"marker_{int(time.time() * 1000)}"
    
    def _extract_config_from_data(self, data: Any) -> Dict[str, Any]:
        """Extract configuration data"""
        config = {}
        
        try:
            if isinstance(data, dict):
                for key, value in data.items():
                    if isinstance(value, (str, int, float, bool)):
                        config[key] = value
                    elif isinstance(value, dict) and len(value) < 10:  # Small nested objects
                        config[key] = value
                        
        except Exception as e:
            self.logger.error(f"Error extracting config: {e}")
        
        return config
    
    def _extract_tile_sources(self, data: Any) -> List[Dict[str, Any]]:
        """Extract tile source information"""
        tile_sources = []
        
        try:
            if isinstance(data, list):
                for item in data:
                    if isinstance(item, str) and self._looks_like_tile_url(item):
                        tile_sources.append({'url': item, 'type': 'template'})
                    elif isinstance(item, dict):
                        tile_sources.append(item)
            elif isinstance(data, dict):
                tile_sources.append(data)
            elif isinstance(data, str) and self._looks_like_tile_url(data):
                tile_sources.append({'url': data, 'type': 'template'})
                
        except Exception as e:
            self.logger.error(f"Error extracting tile sources: {e}")
        
        return tile_sources
    
    def _extract_regions(self, data: Any) -> List[Dict[str, Any]]:
        """Extract region/area information"""
        regions = []
        
        try:
            if isinstance(data, list):
                for item in data:
                    if isinstance(item, dict):
                        regions.append(item)
            elif isinstance(data, dict):
                regions.append(data)
                
        except Exception as e:
            self.logger.error(f"Error extracting regions: {e}")
        
        return regions
    
    def _is_data_property(self, prop_name: str, prop_value: Any) -> bool:
        """Check if a property looks like it contains relevant data"""
        data_indicators = [
            'map', 'marker', 'location', 'point', 'coord', 'tile',
            'data', 'config', 'api', 'endpoint', 'url', 'game'
        ]
        
        prop_lower = prop_name.lower()
        return any(indicator in prop_lower for indicator in data_indicators)
    
    def _looks_like_tile_url(self, url: str) -> bool:
        """Check if string looks like a tile URL template"""
        tile_patterns = [
            r'\{z\}', r'\{x\}', r'\{y\}',
            r'/\d+/\d+/\d+',
            r'tile', r'map'
        ]
        
        return any(re.search(pattern, url, re.IGNORECASE) for pattern in tile_patterns)
    
    def _generate_summary(self, extracted_data: Dict[str, Any]) -> Dict[str, Any]:
        """Generate analysis summary"""
        summary = {
            'total_markers': len(extracted_data.get('markers', [])),
            'marker_categories': {},
            'coordinate_ranges': {},
            'tile_sources_count': len(extracted_data.get('tile_sources', [])),
            'regions_count': len(extracted_data.get('regions', [])),
            'config_keys': list(extracted_data.get('map_config', {}).keys())
        }
        
        # Analyze marker categories
        for marker in extracted_data.get('markers', []):
            category = marker.get('category', 'unknown')
            # Ensure category is a string (handle cases where it might be a dict/object)
            if isinstance(category, dict):
                category = str(category)
            elif not isinstance(category, str):
                category = str(category)
            summary['marker_categories'][category] = summary['marker_categories'].get(category, 0) + 1
        
        # Analyze coordinate ranges
        x_coords = []
        y_coords = []
        for marker in extracted_data.get('markers', []):
            coords = marker.get('coordinates', {})
            if 'x' in coords and 'y' in coords:
                x_coords.append(coords['x'])
                y_coords.append(coords['y'])
        
        if x_coords and y_coords:
            summary['coordinate_ranges'] = {
                'x_min': min(x_coords),
                'x_max': max(x_coords),
                'y_min': min(y_coords),
                'y_max': max(y_coords)
            }
        
        return summary
    
    def save_extracted_data(self, extracted_data: Dict[str, Any], filename: str = None) -> str:
        """Save extracted data to file"""
        if not filename:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            filename = f"extracted_data_{timestamp}.json"
        
        filepath = self.output_dir / filename
        
        try:
            with open(filepath, 'w', encoding='utf-8') as f:
                json.dump(extracted_data, f, indent=2, default=str)
            
            self.logger.info(f"Extracted data saved to {filepath}")
            return str(filepath)
            
        except Exception as e:
            self.logger.error(f"Error saving extracted data: {e}")
            raise
    
    def load_extracted_data(self, filepath: str) -> Dict[str, Any]:
        """Load previously extracted data"""
        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                data = json.load(f)
            
            self.logger.info(f"Extracted data loaded from {filepath}")
            return data
            
        except Exception as e:
            self.logger.error(f"Error loading extracted data: {e}")
            raise