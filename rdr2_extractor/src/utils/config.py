import json
import os
from pathlib import Path
from typing import Any, Dict, Optional, Union
import logging

class Config:
    """Configuration management for RDR2 Extractor"""
    
    def __init__(self, config_file: Optional[str] = None):
        self.logger = logging.getLogger(__name__)
        self._config = {}
        
        # Load default configuration
        self._load_defaults()
        
        # Load from file if provided
        if config_file:
            self.load_from_file(config_file)
        
        # Load from environment variables
        self._load_from_env()
    
    def _load_defaults(self) -> None:
        """Load default configuration values"""
        self._config = {
            'target': {
                'url': 'https://rdr2map.com',
                'wait_time': 10,
                'max_retries': 3
            },
            'browser': {
                'headless': True,
                'stealth_mode': True,
                'interactions': [
                    'zoom_in', 'zoom_out', 'pan_left', 'pan_right', 'pan_up', 'pan_down'
                ],
                'window_size': {'width': 1920, 'height': 1080},
                'user_agent': None  # Will use fake-useragent if None
            },
            'download': {
                'rate_limit': 2.0,
                'max_concurrent': 3,
                'max_tiles': 1000,
                'timeout': 30,
                'retry_attempts': 3,
                'respect_robots_txt': True
            },
            'output': {
                'base_dir': 'data',
                'network_logs': 'data/network_logs',
                'window_data': 'data/window_data',
                'tiles': 'data/tiles',
                'markers': 'data/markers'
            },
            'logging': {
                'level': 'INFO',
                'file': 'rdr2_extractor.log',
                'max_size_mb': 50,
                'backup_count': 5,
                'format': '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
            },
            'analysis': {
                'save_page_source': True,
                'extract_images': True,
                'analyze_css': False,
                'deep_scan_window_objects': True
            },
            'api': {
                'endpoints_file': 'data/api_endpoints.json',
                'save_responses': True,
                'max_response_size_mb': 10
            }
        }
    
    def load_from_file(self, config_file: str) -> None:
        """Load configuration from JSON file"""
        config_path = Path(config_file)
        
        if not config_path.exists():
            self.logger.warning(f"Configuration file not found: {config_file}")
            # Create default config file
            self.save_to_file(config_file)
            return
        
        try:
            with open(config_path, 'r', encoding='utf-8') as f:
                file_config = json.load(f)
            
            # Merge with existing config
            self._deep_merge(self._config, file_config)
            self.logger.info(f"Configuration loaded from {config_file}")
            
        except (json.JSONDecodeError, IOError) as e:
            self.logger.error(f"Error loading configuration file {config_file}: {e}")
            raise
    
    def save_to_file(self, config_file: str) -> None:
        """Save current configuration to JSON file"""
        config_path = Path(config_file)
        
        # Create directory if it doesn't exist
        config_path.parent.mkdir(parents=True, exist_ok=True)
        
        try:
            with open(config_path, 'w', encoding='utf-8') as f:
                json.dump(self._config, f, indent=2)
            
            self.logger.info(f"Configuration saved to {config_file}")
            
        except IOError as e:
            self.logger.error(f"Error saving configuration file {config_file}: {e}")
            raise
    
    def _load_from_env(self) -> None:
        """Load configuration from environment variables"""
        env_mappings = {
            'RDR2_TARGET_URL': 'target.url',
            'RDR2_HEADLESS': 'browser.headless',
            'RDR2_STEALTH_MODE': 'browser.stealth_mode',
            'RDR2_RATE_LIMIT': 'download.rate_limit',
            'RDR2_MAX_CONCURRENT': 'download.max_concurrent',
            'RDR2_MAX_TILES': 'download.max_tiles',
            'RDR2_OUTPUT_DIR': 'output.base_dir',
            'RDR2_LOG_LEVEL': 'logging.level',
            'RDR2_LOG_FILE': 'logging.file'
        }
        
        for env_var, config_key in env_mappings.items():
            env_value = os.getenv(env_var)
            if env_value is not None:
                # Convert string values to appropriate types
                converted_value = self._convert_env_value(env_value)
                self.set(config_key, converted_value)
                self.logger.debug(f"Set {config_key} = {converted_value} from {env_var}")
    
    def _convert_env_value(self, value: str) -> Union[str, int, float, bool]:
        """Convert environment variable string to appropriate type"""
        # Boolean conversion
        if value.lower() in ('true', '1', 'yes', 'on'):
            return True
        elif value.lower() in ('false', '0', 'no', 'off'):
            return False
        
        # Numeric conversions
        try:
            # Try integer first
            if '.' not in value:
                return int(value)
            else:
                return float(value)
        except ValueError:
            pass
        
        # Return as string
        return value
    
    def get(self, key: str, default: Any = None) -> Any:
        """Get configuration value using dot notation"""
        try:
            keys = key.split('.')
            value = self._config
            
            for k in keys:
                value = value[k]
            
            return value
            
        except (KeyError, TypeError):
            return default
    
    def set(self, key: str, value: Any) -> None:
        """Set configuration value using dot notation"""
        keys = key.split('.')
        config = self._config
        
        # Navigate to the parent of the target key
        for k in keys[:-1]:
            if k not in config:
                config[k] = {}
            config = config[k]
        
        # Set the value
        config[keys[-1]] = value
    
    def has(self, key: str) -> bool:
        """Check if configuration key exists"""
        return self.get(key) is not None
    
    def update(self, config_dict: Dict[str, Any]) -> None:
        """Update configuration with dictionary"""
        self._deep_merge(self._config, config_dict)
    
    def _deep_merge(self, base: Dict[str, Any], update: Dict[str, Any]) -> None:
        """Recursively merge two dictionaries"""
        for key, value in update.items():
            if key in base and isinstance(base[key], dict) and isinstance(value, dict):
                self._deep_merge(base[key], value)
            else:
                base[key] = value
    
    def to_dict(self) -> Dict[str, Any]:
        """Return configuration as dictionary"""
        return self._config.copy()
    
    def validate(self) -> bool:
        """Validate configuration values"""
        validation_errors = []
        
        # Validate target URL
        target_url = self.get('target.url')
        if not target_url or not target_url.startswith(('http://', 'https://')):
            validation_errors.append("Invalid target URL")
        
        # Validate numeric values
        rate_limit = self.get('download.rate_limit')
        if not isinstance(rate_limit, (int, float)) or rate_limit < 0:
            validation_errors.append("Rate limit must be a positive number")
        
        max_concurrent = self.get('download.max_concurrent')
        if not isinstance(max_concurrent, int) or max_concurrent < 1:
            validation_errors.append("Max concurrent must be a positive integer")
        
        max_tiles = self.get('download.max_tiles')
        if not isinstance(max_tiles, int) or max_tiles < 1:
            validation_errors.append("Max tiles must be a positive integer")
        
        # Validate output directories
        base_dir = self.get('output.base_dir')
        if not base_dir:
            validation_errors.append("Base output directory must be specified")
        
        # Log validation errors
        if validation_errors:
            for error in validation_errors:
                self.logger.error(f"Configuration validation error: {error}")
            return False
        
        return True
    
    def create_output_directories(self) -> None:
        """Create all configured output directories"""
        directories = [
            self.get('output.base_dir'),
            self.get('output.network_logs'),
            self.get('output.window_data'),
            self.get('output.tiles'),
            self.get('output.markers')
        ]
        
        for directory in directories:
            if directory:
                Path(directory).mkdir(parents=True, exist_ok=True)
                self.logger.debug(f"Created directory: {directory}")
    
    def get_browser_config(self) -> Dict[str, Any]:
        """Get browser-specific configuration"""
        return self.get('browser', {})
    
    def get_download_config(self) -> Dict[str, Any]:
        """Get download-specific configuration"""
        return self.get('download', {})
    
    def get_output_config(self) -> Dict[str, Any]:
        """Get output-specific configuration"""
        return self.get('output', {})
    
    def get_logging_config(self) -> Dict[str, Any]:
        """Get logging-specific configuration"""
        return self.get('logging', {})
    
    def __str__(self) -> str:
        """String representation of configuration"""
        return json.dumps(self._config, indent=2)
    
    def __repr__(self) -> str:
        """String representation of configuration"""
        return f"Config({len(self._config)} sections)"