import json
import logging
import asyncio
import aiohttp
from typing import Dict, List, Any, Optional, Set
from urllib.parse import urlparse, urljoin
from pathlib import Path
import re
from datetime import datetime
import time

class NetworkAnalyzer:
    def __init__(self, output_dir: str = "data/network_logs"):
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)
        self.logger = logging.getLogger(__name__)
        
        # Track different types of requests
        self.api_endpoints = set()
        self.image_requests = set()
        self.tile_requests = set()
        self.data_endpoints = set()
        self.cdn_patterns = set()
        
        # Request patterns to identify
        self.patterns = {
            'api': [r'/api/', r'/v\d+/', r'\.json', r'/data/'],
            'tiles': [r'/tiles/', r'/\d+/\d+/\d+\.(png|jpg|jpeg)', r'tile'],
            'images': [r'\.(png|jpg|jpeg|gif|svg|webp)', r'/images/', r'/img/'],
            'markers': [r'/markers/', r'/poi/', r'/locations/'],
            'mapdata': [r'mapdata', r'map-data', r'gamedata']
        }
    
    def analyze_network_logs(self, logs: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Analyze captured network logs and categorize requests"""
        analysis = {
            'total_requests': len(logs),
            'api_calls': [],
            'image_requests': [],
            'tile_requests': [],
            'data_endpoints': [],
            'cdn_requests': [],
            'unique_domains': set(),
            'request_patterns': {},
            'timestamp': datetime.now().isoformat()
        }
        
        for log in logs:
            try:
                if log['method'] == 'Network.requestWillBeSent':
                    self._analyze_request(log['params'], analysis)
                elif log['method'] == 'Network.responseReceived':
                    self._analyze_response(log['params'], analysis)
            except Exception as e:
                self.logger.warning(f"Error analyzing log entry: {e}")
                continue
        
        # Convert sets to lists for JSON serialization
        analysis['unique_domains'] = list(analysis['unique_domains'])
        analysis['api_endpoints'] = list(self.api_endpoints)
        analysis['image_requests'] = list(self.image_requests)
        analysis['tile_requests'] = list(self.tile_requests)
        analysis['data_endpoints'] = list(self.data_endpoints)
        analysis['cdn_patterns'] = list(self.cdn_patterns)
        
        return analysis
    
    def _analyze_request(self, params: Dict[str, Any], analysis: Dict[str, Any]) -> None:
        """Analyze individual request parameters"""
        try:
            request_data = params.get('request', {})
            url = request_data.get('url', '')
            method = request_data.get('method', 'GET')
            headers = request_data.get('headers', {})
            
            if not url:
                return
                
            parsed_url = urlparse(url)
            domain = parsed_url.netloc
            path = parsed_url.path
            
            # Track unique domains
            analysis['unique_domains'].add(domain)
            
            # Categorize request
            category = self._categorize_request(url, headers)
            
            request_info = {
                'url': url,
                'method': method,
                'domain': domain,
                'path': path,
                'category': category,
                'headers': headers,
                'timestamp': params.get('timestamp', time.time())
            }
            
            # Add to appropriate category
            if category == 'api':
                analysis['api_calls'].append(request_info)
                self.api_endpoints.add(url)
            elif category == 'image':
                analysis['image_requests'].append(request_info)
                self.image_requests.add(url)
            elif category == 'tile':
                analysis['tile_requests'].append(request_info)
                self.tile_requests.add(url)
            elif category == 'data':
                analysis['data_endpoints'].append(request_info)
                self.data_endpoints.add(url)
                
            # Check for CDN patterns
            if self._is_cdn_request(domain, path):
                analysis['cdn_requests'].append(request_info)
                self.cdn_patterns.add(domain)
                
        except Exception as e:
            self.logger.warning(f"Error analyzing request: {e}")
    
    def _analyze_response(self, params: Dict[str, Any], analysis: Dict[str, Any]) -> None:
        """Analyze response parameters"""
        try:
            response_data = params.get('response', {})
            url = response_data.get('url', '')
            status = response_data.get('status', 0)
            mime_type = response_data.get('mimeType', '')
            headers = response_data.get('headers', {})
            
            # Track response patterns
            content_type = headers.get('content-type', mime_type)
            if content_type not in analysis['request_patterns']:
                analysis['request_patterns'][content_type] = 0
            analysis['request_patterns'][content_type] += 1
            
        except Exception as e:
            self.logger.warning(f"Error analyzing response: {e}")
    
    def _categorize_request(self, url: str, headers: Dict[str, Any]) -> str:
        """Categorize request based on URL and headers"""
        url_lower = url.lower()
        
        # Check content type in headers
        content_type = headers.get('accept', '').lower()
        
        # Check for API patterns
        for pattern in self.patterns['api']:
            if re.search(pattern, url_lower):
                return 'api'
        
        # Check for tile patterns
        for pattern in self.patterns['tiles']:
            if re.search(pattern, url_lower):
                return 'tile'
        
        # Check for image patterns
        for pattern in self.patterns['images']:
            if re.search(pattern, url_lower):
                return 'image'
        
        # Check for data patterns
        for pattern in self.patterns['mapdata']:
            if re.search(pattern, url_lower):
                return 'data'
        
        # Check content type
        if 'application/json' in content_type:
            return 'api'
        elif any(img_type in content_type for img_type in ['image/', 'png', 'jpeg', 'jpg']):
            return 'image'
        
        return 'other'
    
    def _is_cdn_request(self, domain: str, path: str) -> bool:
        """Check if request is from a CDN"""
        cdn_indicators = [
            'cdn', 'cloudfront', 'fastly', 'cloudflare', 'akamai',
            'amazonaws', 'gstatic', 'jsdelivr', 'unpkg'
        ]
        
        domain_lower = domain.lower()
        return any(indicator in domain_lower for indicator in cdn_indicators)
    
    def extract_api_endpoints(self, logs: List[Dict[str, Any]]) -> List[Dict[str, str]]:
        """Extract and analyze API endpoints from network logs"""
        endpoints = []
        
        for log in logs:
            try:
                if log['method'] == 'Network.requestWillBeSent':
                    request = log['params']['request']
                    url = request['url']
                    method = request['method']
                    
                    # Check if this looks like an API endpoint
                    if self._is_api_endpoint(url):
                        endpoint_info = {
                            'url': url,
                            'method': method,
                            'base_url': self._extract_base_url(url),
                            'path': urlparse(url).path,
                            'query_params': urlparse(url).query,
                            'headers': request.get('headers', {}),
                            'timestamp': log.get('timestamp', time.time())
                        }
                        endpoints.append(endpoint_info)
                        
            except Exception as e:
                self.logger.warning(f"Error extracting API endpoint: {e}")
                continue
        
        return endpoints
    
    def _is_api_endpoint(self, url: str) -> bool:
        """Determine if URL is likely an API endpoint"""
        api_indicators = [
            '/api/', '/v1/', '/v2/', '/v3/', '/data/',
            '.json', '/graphql', '/rest/', '/endpoint/'
        ]
        
        url_lower = url.lower()
        return any(indicator in url_lower for indicator in api_indicators)
    
    def _extract_base_url(self, url: str) -> str:
        """Extract base URL from full URL"""
        parsed = urlparse(url)
        return f"{parsed.scheme}://{parsed.netloc}"
    
    def identify_tile_patterns(self, logs: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Identify tile loading patterns from network logs"""
        tile_patterns = {
            'base_urls': set(),
            'zoom_levels': set(),
            'coordinate_patterns': [],
            'tile_formats': set(),
            'tile_servers': set()
        }
        
        tile_regex = re.compile(r'/(\d+)/(\d+)/(\d+)\.(png|jpg|jpeg|webp)')
        
        for log in logs:
            try:
                if log['method'] == 'Network.requestWillBeSent':
                    url = log['params']['request']['url']
                    
                    # Check for tile pattern
                    match = tile_regex.search(url)
                    if match:
                        zoom, x, y, format_ext = match.groups()
                        
                        tile_patterns['zoom_levels'].add(int(zoom))
                        tile_patterns['tile_formats'].add(format_ext)
                        tile_patterns['base_urls'].add(self._extract_base_url(url))
                        tile_patterns['coordinate_patterns'].append({
                            'zoom': int(zoom),
                            'x': int(x),
                            'y': int(y),
                            'url': url
                        })
                        
                        # Extract tile server domain
                        domain = urlparse(url).netloc
                        tile_patterns['tile_servers'].add(domain)
                        
            except Exception as e:
                self.logger.warning(f"Error identifying tile pattern: {e}")
                continue
        
        # Convert sets to lists for JSON serialization
        tile_patterns['base_urls'] = list(tile_patterns['base_urls'])
        tile_patterns['zoom_levels'] = sorted(list(tile_patterns['zoom_levels']))
        tile_patterns['tile_formats'] = list(tile_patterns['tile_formats'])
        tile_patterns['tile_servers'] = list(tile_patterns['tile_servers'])
        
        return tile_patterns
    
    def save_analysis(self, analysis: Dict[str, Any], filename: str = None) -> str:
        """Save network analysis to file"""
        if not filename:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            filename = f"network_analysis_{timestamp}.json"
        
        filepath = self.output_dir / filename
        
        try:
            with open(filepath, 'w', encoding='utf-8') as f:
                json.dump(analysis, f, indent=2, default=str)
            
            self.logger.info(f"Network analysis saved to {filepath}")
            return str(filepath)
            
        except Exception as e:
            self.logger.error(f"Error saving analysis: {e}")
            raise
    
    def load_analysis(self, filepath: str) -> Dict[str, Any]:
        """Load previously saved network analysis"""
        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                analysis = json.load(f)
            
            self.logger.info(f"Network analysis loaded from {filepath}")
            return analysis
            
        except Exception as e:
            self.logger.error(f"Error loading analysis: {e}")
            raise
    
    def generate_report(self, analysis: Dict[str, Any]) -> str:
        """Generate a human-readable report from analysis"""
        report = []
        report.append("=== NETWORK TRAFFIC ANALYSIS REPORT ===")
        report.append(f"Generated: {analysis.get('timestamp', 'Unknown')}")
        report.append(f"Total Requests: {analysis.get('total_requests', 0)}")
        report.append("")
        
        # Unique domains
        domains = analysis.get('unique_domains', [])
        report.append(f"Unique Domains ({len(domains)}):")
        for domain in sorted(domains):
            report.append(f"  - {domain}")
        report.append("")
        
        # API endpoints
        api_calls = analysis.get('api_calls', [])
        report.append(f"API Endpoints ({len(api_calls)}):")
        for api in api_calls[:10]:  # Show first 10
            report.append(f"  - {api.get('method', 'GET')} {api.get('url', '')}")
        if len(api_calls) > 10:
            report.append(f"  ... and {len(api_calls) - 10} more")
        report.append("")
        
        # Image requests
        images = analysis.get('image_requests', [])
        report.append(f"Image Requests ({len(images)}):")
        for img in images[:5]:  # Show first 5
            report.append(f"  - {img.get('url', '')}")
        if len(images) > 5:
            report.append(f"  ... and {len(images) - 5} more")
        report.append("")
        
        # Tile requests
        tiles = analysis.get('tile_requests', [])
        report.append(f"Tile Requests ({len(tiles)}):")
        for tile in tiles[:5]:  # Show first 5
            report.append(f"  - {tile.get('url', '')}")
        if len(tiles) > 5:
            report.append(f"  ... and {len(tiles) - 5} more")
        
        return "\n".join(report)