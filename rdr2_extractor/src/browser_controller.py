import time
import json
import logging
from typing import Dict, List, Any, Optional
from selenium import webdriver
from selenium.webdriver.firefox.service import Service
from selenium.webdriver.firefox.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import TimeoutException, WebDriverException
from webdriver_manager.firefox import GeckoDriverManager
from fake_useragent import UserAgent

class BrowserController:
    def __init__(self, headless: bool = True, stealth_mode: bool = True):
        self.headless = headless
        self.stealth_mode = stealth_mode
        self.driver = None
        self.network_logs = []
        self.logger = logging.getLogger(__name__)
        
    def setup_driver(self) -> webdriver.Firefox:
        """Initialize Firefox WebDriver with stealth configuration"""
        firefox_options = Options()
        
        if self.headless:
            firefox_options.add_argument("--headless")
            
        if self.stealth_mode:
            # Stealth mode configuration
            firefox_options.add_argument("--no-sandbox")
            firefox_options.add_argument("--disable-dev-shm-usage")
            
            # Random user agent
            ua = UserAgent()
            firefox_options.set_preference("general.useragent.override", ua.random)
            
            # Disable webdriver detection
            firefox_options.set_preference("dom.webdriver.enabled", False)
            firefox_options.set_preference("useAutomationExtension", False)
            
        # Enable logging
        firefox_options.set_preference("devtools.console.stdout.content", True)
        
        service = Service(GeckoDriverManager().install())
        self.driver = webdriver.Firefox(service=service, options=firefox_options)
        
        # Execute script to remove webdriver property
        if self.stealth_mode:
            self.driver.execute_script("Object.defineProperty(navigator, 'webdriver', {get: () => undefined})")
            
        return self.driver
    
    def navigate_to_site(self, url: str, wait_time: int = 10) -> bool:
        """Navigate to the target site and wait for full load"""
        try:
            self.logger.info(f"Navigating to {url}")
            self.driver.get(url)
            
            # Wait for page to load
            WebDriverWait(self.driver, wait_time).until(
                EC.presence_of_element_located((By.TAG_NAME, "body"))
            )
            
            # Additional wait for dynamic content
            time.sleep(5)
            return True
            
        except TimeoutException:
            self.logger.error(f"Timeout waiting for page to load: {url}")
            return False
        except WebDriverException as e:
            self.logger.error(f"WebDriver error: {e}")
            return False
    
    def capture_network_logs(self) -> List[Dict[str, Any]]:
        """Capture all network activity from the browser"""
        try:
            # Firefox doesn't support performance logs like Chrome
            # Instead, we'll capture console logs and try to extract network info
            logs = self.driver.get_log('browser')
            network_events = []
            
            for log in logs:
                # Filter for potential network-related messages
                if any(keyword in log['message'].lower() for keyword in ['http', 'xhr', 'fetch', 'request', 'response']):
                    network_events.append({
                        'timestamp': log['timestamp'],
                        'level': log['level'],
                        'message': log['message']
                    })
                    
            self.network_logs.extend(network_events)
            return network_events
            
        except Exception as e:
            self.logger.error(f"Error capturing network logs: {e}")
            return []
    
    def extract_window_objects(self) -> Dict[str, Any]:
        """Extract all relevant window objects from the page"""
        try:
            # Common window objects to extract
            window_objects = {}
            
            # Extract window.mapData
            map_data = self.driver.execute_script("return window.mapData || null;")
            if map_data:
                window_objects['mapData'] = map_data
                
            # Extract window.locations
            locations = self.driver.execute_script("return window.locations || null;")
            if locations:
                window_objects['locations'] = locations
                
            # Extract window.config
            config = self.driver.execute_script("return window.config || null;")
            if config:
                window_objects['config'] = config
                
            # Extract window.markers
            markers = self.driver.execute_script("return window.markers || null;")
            if markers:
                window_objects['markers'] = markers
                
            # Extract all window properties
            all_props = self.driver.execute_script("""
                var props = {};
                for (var prop in window) {
                    try {
                        if (typeof window[prop] === 'object' && window[prop] !== null) {
                            props[prop] = JSON.stringify(window[prop]);
                        } else if (typeof window[prop] !== 'function') {
                            props[prop] = window[prop];
                        }
                    } catch (e) {
                        // Skip properties that can't be serialized
                    }
                }
                return props;
            """)
            
            window_objects['all_properties'] = all_props
            
            self.logger.info(f"Extracted {len(window_objects)} window object groups")
            return window_objects
            
        except Exception as e:
            self.logger.error(f"Error extracting window objects: {e}")
            return {}
    
    def interact_with_map(self, interactions: List[str] = None) -> None:
        """Perform various interactions with the map to trigger data loading"""
        if not interactions:
            interactions = ['zoom_in', 'zoom_out', 'pan_left', 'pan_right', 'pan_up', 'pan_down']
            
        try:
            for interaction in interactions:
                self.logger.info(f"Performing interaction: {interaction}")
                
                if interaction == 'zoom_in':
                    self.driver.execute_script("window.scrollBy(0, -100);")
                elif interaction == 'zoom_out':
                    self.driver.execute_script("window.scrollBy(0, 100);")
                elif interaction.startswith('pan_'):
                    direction = interaction.split('_')[1]
                    if direction == 'left':
                        self.driver.execute_script("window.scrollBy(-100, 0);")
                    elif direction == 'right':
                        self.driver.execute_script("window.scrollBy(100, 0);")
                    elif direction == 'up':
                        self.driver.execute_script("window.scrollBy(0, -100);")
                    elif direction == 'down':
                        self.driver.execute_script("window.scrollBy(0, 100);")
                
                # Wait for potential network requests
                time.sleep(2)
                
                # Capture network activity after interaction
                self.capture_network_logs()
                
        except Exception as e:
            self.logger.error(f"Error during map interaction: {e}")
    
    def wait_for_dynamic_content(self, timeout: int = 30) -> bool:
        """Wait for dynamic content to fully load"""
        try:
            # Wait for common map elements
            selectors = [
                '[class*="map"]',
                '[class*="marker"]',
                '[class*="tile"]',
                'canvas',
                'svg'
            ]
            
            for selector in selectors:
                try:
                    WebDriverWait(self.driver, 5).until(
                        EC.presence_of_element_located((By.CSS_SELECTOR, selector))
                    )
                    self.logger.info(f"Found element with selector: {selector}")
                except TimeoutException:
                    continue
                    
            # Additional wait for JavaScript execution
            time.sleep(10)
            return True
            
        except Exception as e:
            self.logger.error(f"Error waiting for dynamic content: {e}")
            return False
    
    def save_page_source(self, filepath: str) -> bool:
        """Save the current page source to file"""
        try:
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(self.driver.page_source)
            self.logger.info(f"Page source saved to {filepath}")
            return True
        except Exception as e:
            self.logger.error(f"Error saving page source: {e}")
            return False
    
    def close(self) -> None:
        """Clean up and close the browser"""
        if self.driver:
            self.driver.quit()
            self.logger.info("Browser closed successfully")