import hashlib
import time
import json
import re
from typing import Any, Dict, List, Optional, Union
from pathlib import Path
from urllib.parse import urlparse, urljoin
import logging

def generate_hash(data: Union[str, bytes, dict]) -> str:
    """Generate MD5 hash for data"""
    if isinstance(data, dict):
        data = json.dumps(data, sort_keys=True)
    if isinstance(data, str):
        data = data.encode('utf-8')
    
    return hashlib.md5(data).hexdigest()

def sanitize_filename(filename: str) -> str:
    """Sanitize filename for safe filesystem usage"""
    # Remove invalid characters
    sanitized = re.sub(r'[<>:"/\\|?*]', '_', filename)
    
    # Remove leading/trailing spaces and dots
    sanitized = sanitized.strip(' .')
    
    # Limit length
    if len(sanitized) > 200:
        sanitized = sanitized[:200]
    
    # Ensure not empty
    if not sanitized:
        sanitized = 'unnamed'
    
    return sanitized

def ensure_directory(path: Union[str, Path]) -> Path:
    """Ensure directory exists, create if necessary"""
    path_obj = Path(path)
    path_obj.mkdir(parents=True, exist_ok=True)
    return path_obj

def get_file_size_mb(filepath: Union[str, Path]) -> float:
    """Get file size in megabytes"""
    try:
        size_bytes = Path(filepath).stat().st_size
        return size_bytes / (1024 * 1024)
    except (OSError, FileNotFoundError):
        return 0.0

def format_bytes(size_bytes: int) -> str:
    """Format bytes as human readable string"""
    if size_bytes == 0:
        return "0 B"
    
    size_names = ["B", "KB", "MB", "GB", "TB"]
    i = 0
    while size_bytes >= 1024 and i < len(size_names) - 1:
        size_bytes /= 1024.0
        i += 1
    
    return f"{size_bytes:.1f} {size_names[i]}"

def format_duration(seconds: float) -> str:
    """Format duration in seconds as human readable string"""
    if seconds < 60:
        return f"{seconds:.1f}s"
    elif seconds < 3600:
        minutes = seconds / 60
        return f"{minutes:.1f}m"
    else:
        hours = seconds / 3600
        return f"{hours:.1f}h"

def is_valid_url(url: str) -> bool:
    """Check if URL is valid"""
    try:
        result = urlparse(url)
        return all([result.scheme, result.netloc])
    except Exception:
        return False

def extract_domain(url: str) -> Optional[str]:
    """Extract domain from URL"""
    try:
        parsed = urlparse(url)
        return parsed.netloc
    except Exception:
        return None

def build_url(base_url: str, path: str, params: Optional[Dict[str, Any]] = None) -> str:
    """Build URL from components"""
    url = urljoin(base_url, path)
    
    if params:
        query_parts = []
        for key, value in params.items():
            query_parts.append(f"{key}={value}")
        
        if query_parts:
            separator = '&' if '?' in url else '?'
            url += separator + '&'.join(query_parts)
    
    return url

def safe_json_load(filepath: Union[str, Path], default: Any = None) -> Any:
    """Safely load JSON file with error handling"""
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError, IOError):
        return default

def safe_json_save(data: Any, filepath: Union[str, Path], indent: int = 2) -> bool:
    """Safely save data as JSON with error handling"""
    try:
        ensure_directory(Path(filepath).parent)
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=indent, default=str)
        return True
    except (IOError, TypeError):
        return False

def merge_dicts(dict1: Dict[str, Any], dict2: Dict[str, Any]) -> Dict[str, Any]:
    """Deep merge two dictionaries"""
    result = dict1.copy()
    
    for key, value in dict2.items():
        if key in result and isinstance(result[key], dict) and isinstance(value, dict):
            result[key] = merge_dicts(result[key], value)
        else:
            result[key] = value
    
    return result

def flatten_dict(d: Dict[str, Any], parent_key: str = '', sep: str = '.') -> Dict[str, Any]:
    """Flatten nested dictionary"""
    items = []
    for k, v in d.items():
        new_key = f"{parent_key}{sep}{k}" if parent_key else k
        if isinstance(v, dict):
            items.extend(flatten_dict(v, new_key, sep=sep).items())
        else:
            items.append((new_key, v))
    return dict(items)

def chunk_list(lst: List[Any], chunk_size: int) -> List[List[Any]]:
    """Split list into chunks of specified size"""
    return [lst[i:i + chunk_size] for i in range(0, len(lst), chunk_size)]

def retry_on_exception(max_retries: int = 3, delay: float = 1.0, backoff_factor: float = 2.0):
    """Decorator to retry function on exception"""
    def decorator(func):
        def wrapper(*args, **kwargs):
            last_exception = None
            
            for attempt in range(max_retries + 1):
                try:
                    return func(*args, **kwargs)
                except Exception as e:
                    last_exception = e
                    
                    if attempt < max_retries:
                        sleep_time = delay * (backoff_factor ** attempt)
                        time.sleep(sleep_time)
                        continue
                    else:
                        raise last_exception
            
            return None
        return wrapper
    return decorator

class RateLimiter:
    """Simple rate limiter"""
    
    def __init__(self, max_calls: int, time_window: float):
        self.max_calls = max_calls
        self.time_window = time_window
        self.calls = []
    
    def wait_if_needed(self):
        """Wait if rate limit would be exceeded"""
        now = time.time()
        
        # Remove old calls outside the time window
        self.calls = [call_time for call_time in self.calls if now - call_time < self.time_window]
        
        # If we're at the limit, wait
        if len(self.calls) >= self.max_calls:
            oldest_call = min(self.calls)
            wait_time = self.time_window - (now - oldest_call)
            if wait_time > 0:
                time.sleep(wait_time)
        
        # Record this call
        self.calls.append(time.time())

class ProgressTracker:
    """Track progress of operations"""
    
    def __init__(self, total: int, description: str = "Processing"):
        self.total = total
        self.description = description
        self.current = 0
        self.start_time = time.time()
        self.logger = logging.getLogger(__name__)
    
    def update(self, increment: int = 1):
        """Update progress"""
        self.current += increment
        self._maybe_log_progress()
    
    def _maybe_log_progress(self):
        """Log progress if significant milestone reached"""
        percentage = (self.current / self.total) * 100
        
        # Log every 10% or on completion
        if percentage % 10 < (1 / self.total * 100) or self.current >= self.total:
            elapsed = time.time() - self.start_time
            rate = self.current / elapsed if elapsed > 0 else 0
            
            eta_seconds = (self.total - self.current) / rate if rate > 0 else 0
            eta_str = format_duration(eta_seconds) if eta_seconds > 0 else "N/A"
            
            self.logger.info(
                f"{self.description}: {self.current}/{self.total} "
                f"({percentage:.1f}%) - Rate: {rate:.1f}/s - ETA: {eta_str}"
            )
    
    def finish(self):
        """Mark as finished"""
        self.current = self.total
        elapsed = time.time() - self.start_time
        self.logger.info(
            f"{self.description} completed: {self.total} items in {format_duration(elapsed)}"
        )

def validate_coordinates(x: Union[int, float], y: Union[int, float]) -> bool:
    """Validate coordinate values"""
    try:
        x_val = float(x)
        y_val = float(y)
        
        # Basic range check (adjust based on expected coordinate system)
        return -180 <= x_val <= 180 and -90 <= y_val <= 90
    except (ValueError, TypeError):
        return False

def normalize_coordinates(coords: Dict[str, Any]) -> Optional[Dict[str, float]]:
    """Normalize coordinate data to standard format"""
    try:
        # Try different coordinate field names
        x_fields = ['x', 'lng', 'lon', 'longitude', 'long']
        y_fields = ['y', 'lat', 'latitude']
        
        x_val = None
        y_val = None
        
        for field in x_fields:
            if field in coords:
                x_val = float(coords[field])
                break
        
        for field in y_fields:
            if field in coords:
                y_val = float(coords[field])
                break
        
        if x_val is not None and y_val is not None:
            return {'x': x_val, 'y': y_val}
        
        return None
        
    except (ValueError, TypeError, KeyError):
        return None

def extract_numbers_from_string(text: str) -> List[float]:
    """Extract all numbers from a string"""
    pattern = r'-?\d+\.?\d*'
    matches = re.findall(pattern, text)
    return [float(match) for match in matches if match]

def clean_text(text: str) -> str:
    """Clean text by removing extra whitespace and special characters"""
    if not isinstance(text, str):
        return str(text)
    
    # Remove extra whitespace
    cleaned = re.sub(r'\s+', ' ', text.strip())
    
    # Remove non-printable characters
    cleaned = ''.join(char for char in cleaned if char.isprintable())
    
    return cleaned

def is_image_url(url: str) -> bool:
    """Check if URL points to an image"""
    image_extensions = ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.bmp']
    url_lower = url.lower()
    
    return any(url_lower.endswith(ext) for ext in image_extensions)

def extract_image_format(url: str) -> Optional[str]:
    """Extract image format from URL"""
    try:
        path = urlparse(url).path.lower()
        if '.' in path:
            return path.split('.')[-1]
        return None
    except Exception:
        return None