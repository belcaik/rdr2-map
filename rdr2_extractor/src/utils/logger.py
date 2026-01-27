import logging
import logging.handlers
import sys
from pathlib import Path
from typing import Optional

def setup_logging(level: str = 'INFO', 
                  log_file: Optional[str] = None,
                  max_size_mb: int = 50,
                  backup_count: int = 5,
                  format_string: Optional[str] = None) -> logging.Logger:
    """
    Set up comprehensive logging for the RDR2 Extractor
    
    Args:
        level: Logging level (DEBUG, INFO, WARNING, ERROR, CRITICAL)
        log_file: Path to log file (if None, logs to console only)
        max_size_mb: Maximum log file size in MB before rotation
        backup_count: Number of backup log files to keep
        format_string: Custom log format string
    
    Returns:
        Configured root logger
    """
    
    # Convert level string to logging constant
    numeric_level = getattr(logging, level.upper(), logging.INFO)
    
    # Default format
    if not format_string:
        format_string = '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    
    # Create formatter
    formatter = logging.Formatter(format_string)
    
    # Configure root logger
    root_logger = logging.getLogger()
    root_logger.setLevel(numeric_level)
    
    # Clear any existing handlers
    for handler in root_logger.handlers[:]:
        root_logger.removeHandler(handler)
    
    # Console handler
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setLevel(numeric_level)
    console_handler.setFormatter(formatter)
    root_logger.addHandler(console_handler)
    
    # File handler (if specified)
    if log_file:
        log_path = Path(log_file)
        log_path.parent.mkdir(parents=True, exist_ok=True)
        
        # Use rotating file handler
        file_handler = logging.handlers.RotatingFileHandler(
            log_file,
            maxBytes=max_size_mb * 1024 * 1024,  # Convert MB to bytes
            backupCount=backup_count
        )
        file_handler.setLevel(numeric_level)
        file_handler.setFormatter(formatter)
        root_logger.addHandler(file_handler)
    
    # Set specific logger levels for third-party libraries
    _configure_third_party_loggers()
    
    # Log initial message
    root_logger.info(f"Logging configured - Level: {level}, File: {log_file or 'Console only'}")
    
    return root_logger

def _configure_third_party_loggers():
    """Configure logging levels for third-party libraries to reduce noise"""
    
    # Selenium WebDriver
    logging.getLogger('selenium').setLevel(logging.WARNING)
    logging.getLogger('urllib3').setLevel(logging.WARNING)
    
    # HTTP libraries
    logging.getLogger('requests').setLevel(logging.WARNING)
    logging.getLogger('aiohttp').setLevel(logging.WARNING)
    
    # Other common libraries
    logging.getLogger('PIL').setLevel(logging.WARNING)
    logging.getLogger('fake_useragent').setLevel(logging.WARNING)

def get_logger(name: str) -> logging.Logger:
    """
    Get a logger instance with the specified name
    
    Args:
        name: Logger name (typically __name__)
    
    Returns:
        Logger instance
    """
    return logging.getLogger(name)

class ProgressLogger:
    """Logger wrapper for progress tracking"""
    
    def __init__(self, logger: logging.Logger, total_items: int, item_name: str = "items"):
        self.logger = logger
        self.total_items = total_items
        self.item_name = item_name
        self.processed_items = 0
        self.last_logged_percentage = 0
        
    def update(self, count: int = 1, message: Optional[str] = None):
        """Update progress and log if significant progress made"""
        self.processed_items += count
        percentage = (self.processed_items / self.total_items) * 100
        
        # Log every 10% or on completion
        if (percentage - self.last_logged_percentage >= 10) or (self.processed_items >= self.total_items):
            progress_msg = f"Progress: {self.processed_items}/{self.total_items} {self.item_name} ({percentage:.1f}%)"
            if message:
                progress_msg += f" - {message}"
            
            self.logger.info(progress_msg)
            self.last_logged_percentage = percentage
    
    def complete(self, message: Optional[str] = None):
        """Mark progress as complete"""
        self.processed_items = self.total_items
        complete_msg = f"Completed: {self.total_items} {self.item_name}"
        if message:
            complete_msg += f" - {message}"
        
        self.logger.info(complete_msg)

class ErrorTracker:
    """Track and log errors with context"""
    
    def __init__(self, logger: logging.Logger):
        self.logger = logger
        self.errors = []
        self.warnings = []
    
    def log_error(self, error: Exception, context: str = "", critical: bool = False):
        """Log an error with context"""
        error_info = {
            'error': str(error),
            'type': type(error).__name__,
            'context': context,
            'critical': critical
        }
        
        self.errors.append(error_info)
        
        if critical:
            self.logger.critical(f"CRITICAL ERROR in {context}: {error}")
        else:
            self.logger.error(f"ERROR in {context}: {error}")
    
    def log_warning(self, message: str, context: str = ""):
        """Log a warning with context"""
        warning_info = {
            'message': message,
            'context': context
        }
        
        self.warnings.append(warning_info)
        self.logger.warning(f"WARNING in {context}: {message}")
    
    def get_error_summary(self) -> dict:
        """Get summary of all errors and warnings"""
        return {
            'total_errors': len(self.errors),
            'critical_errors': len([e for e in self.errors if e['critical']]),
            'total_warnings': len(self.warnings),
            'errors': self.errors,
            'warnings': self.warnings
        }
    
    def has_critical_errors(self) -> bool:
        """Check if any critical errors occurred"""
        return any(error['critical'] for error in self.errors)

def log_execution_time(logger: logging.Logger):
    """Decorator to log function execution time"""
    def decorator(func):
        def wrapper(*args, **kwargs):
            import time
            start_time = time.time()
            
            try:
                result = func(*args, **kwargs)
                execution_time = time.time() - start_time
                logger.debug(f"{func.__name__} completed in {execution_time:.2f} seconds")
                return result
            except Exception as e:
                execution_time = time.time() - start_time
                logger.error(f"{func.__name__} failed after {execution_time:.2f} seconds: {e}")
                raise
        
        return wrapper
    return decorator

def log_method_calls(logger: logging.Logger):
    """Decorator to log method entry/exit"""
    def decorator(func):
        def wrapper(*args, **kwargs):
            logger.debug(f"Entering {func.__name__}")
            try:
                result = func(*args, **kwargs)
                logger.debug(f"Exiting {func.__name__}")
                return result
            except Exception as e:
                logger.debug(f"Exception in {func.__name__}: {e}")
                raise
        
        return wrapper
    return decorator