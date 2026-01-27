# RDR2 Map Data Extractor

A comprehensive Python tool for analyzing and extracting data from rdr2map.com for educational purposes. This project provides automated extraction of map tiles, point-of-interest data, and interactive elements to support local recreation of the Red Dead Redemption 2 interactive map.

## 🎯 Project Overview

This extractor implements a three-phase approach to systematically analyze and download map data:

### Phase 1: Network Traffic Analysis
- **Browser Automation**: Uses Selenium WebDriver with stealth mode
- **Network Monitoring**: Captures all HTTP requests and responses
- **Pattern Recognition**: Identifies API endpoints, tile servers, and data sources
- **Traffic Analysis**: Categorizes requests and extracts tile loading patterns

### Phase 2: Data Extraction Analysis  
- **JavaScript Execution**: Extracts window objects and embedded data
- **Data Mining**: Parses markers, coordinates, and map configuration
- **Structure Analysis**: Identifies data relationships and formats
- **Validation**: Ensures data integrity and completeness

### Phase 3: Content Extraction
- **Tile Download**: Systematic downloading of map tiles across zoom levels
- **Rate Limiting**: Respectful scraping with configurable delays
- **Asset Organization**: Structured storage of tiles and metadata
- **Progress Tracking**: Real-time download statistics and validation

## 🏗️ Architecture

```
rdr2_extractor/
├── src/
│   ├── browser_controller.py    # Selenium automation & stealth mode
│   ├── network_analyzer.py      # Network traffic analysis
│   ├── data_extractor.py        # Window object & data extraction
│   ├── tile_downloader.py       # Async tile downloading with rate limiting
│   └── utils/
│       ├── config.py            # Configuration management
│       ├── logger.py            # Logging & error tracking
│       └── helpers.py           # Utility functions
├── config/
│   └── default.json            # Default configuration
├── data/                       # Output directory
│   ├── network_logs/          # Network analysis results
│   ├── window_data/           # Extracted JavaScript data
│   ├── tiles/                 # Downloaded map tiles
│   └── markers/               # Point-of-interest data
├── requirements.txt           # Python dependencies
└── main.py                   # Main orchestrator script
```

## 🚀 Quick Start

### Installation

1. **Clone and Navigate**:
```bash
git clone <repository-url>
cd rdr2_extractor
```

2. **Automated Setup** (recommended):
```bash
./setup.sh
```
This script will:
- Configure pyenv and set Python 3.11.9
- Create and activate virtual environment
- Install all dependencies
- Create configuration files
- Set up data directories

3. **Manual Setup** (alternative):
```bash
# Configure pyenv (as per CLAUDE.md)
export PYENV_ROOT="$HOME/.pyenv"
export PATH="$PYENV_ROOT/bin:$PATH"
eval "$(pyenv init -)"
pyenv local 3.11.9

# Create and activate virtual environment
python -m venv venv
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Create configuration
cp .env.example .env
```

### Basic Usage

**Run with Convenience Script** (recommended):
```bash
./run.sh
```

**Run with Custom Options**:
```bash
./run.sh --headless --rate-limit 3.0 --max-tiles 500
```

**Manual Execution** (if environment already activated):
```bash
# Ensure virtual environment is activated
source venv/bin/activate

# Run extractor
python main.py
```

**Custom Configuration**:
```bash
python main.py --config config/my_config.json
```

**Command Line Options**:
```bash
python main.py --help
```

### Configuration Options

Key configuration parameters in `config/default.json`:

```json
{
  "target": {
    "url": "https://rdr2map.com",
    "wait_time": 10
  },
  "browser": {
    "headless": true,
    "stealth_mode": true,
    "interactions": ["zoom_in", "zoom_out", "pan_left", "pan_right"]
  },
  "download": {
    "rate_limit": 2.0,
    "max_concurrent": 3,
    "max_tiles": 1000
  }
}
```

## 📊 Output Data

### Network Analysis
- **API Endpoints**: Discovered data endpoints and their patterns
- **Tile Servers**: Map tile URLs and coordinate systems  
- **Domain Analysis**: CDN patterns and resource locations
- **Request Patterns**: HTTP headers, timing, and response analysis

### Extracted Data
- **Markers**: POI coordinates, categories, and metadata
- **Map Config**: Zoom levels, bounds, and tile sources
- **Window Objects**: All JavaScript data from the page
- **Coordinate Systems**: Spatial data relationships

### Downloaded Content
- **Map Tiles**: Organized by zoom level and coordinates
- **Metadata**: Download statistics and validation results
- **Session Reports**: Comprehensive analysis of extraction results

## 🔧 Advanced Features

### Rate Limiting & Stealth
- **Smart Delays**: Randomized intervals between requests
- **User Agent Rotation**: Prevents detection through headers
- **Stealth Mode**: Disables automation indicators
- **Respect robots.txt**: Ethical scraping practices

### Error Handling & Logging
- **Comprehensive Logging**: Multi-level logging with rotation
- **Progress Tracking**: Real-time extraction progress
- **Error Recovery**: Automatic retry with exponential backoff
- **Validation**: Data integrity checks and corruption detection

### Async Operations
- **Concurrent Downloads**: Parallel tile downloading
- **Memory Efficient**: Streaming and chunked processing
- **Progress Monitoring**: Live statistics and ETA calculation
- **Resource Management**: Automatic cleanup and session management

## 🛠️ Development

### Adding Custom Extractors

```python
from src.data_extractor import DataExtractor

class CustomExtractor(DataExtractor):
    def extract_custom_data(self, window_objects):
        # Your custom extraction logic
        pass
```

### Extending Network Analysis

```python
from src.network_analyzer import NetworkAnalyzer

class CustomAnalyzer(NetworkAnalyzer):
    def analyze_custom_patterns(self, logs):
        # Your custom pattern analysis
        pass
```

## 📋 Legal & Ethical Considerations

- **Educational Purpose**: This tool is intended for educational analysis only
- **Rate Limiting**: Implements respectful scraping practices
- **robots.txt Compliance**: Respects site scraping policies
- **Terms of Service**: Users must comply with target site terms
- **Data Usage**: Extracted data should not be redistributed commercially

## 🔍 Troubleshooting

### Common Issues

**Browser Setup Issues**:
```bash
# Install Chrome/Chromium
sudo apt-get install chromium-browser  # Ubuntu/Debian
brew install chromium  # macOS

# WebDriver issues
pip install --upgrade selenium webdriver-manager
```

**Network Connection Problems**:
- Check firewall settings
- Verify internet connectivity
- Try reducing concurrent connections
- Increase timeout values in config

**Memory Issues**:
- Reduce `max_concurrent` downloads
- Decrease `max_tiles` limit
- Enable headless mode
- Monitor system resources

### Debug Mode

```bash
python main.py --log-level DEBUG
```

This enables detailed logging for troubleshooting extraction issues.

## 📈 Performance Optimization

### Recommended Settings
- **Rate Limit**: 2-5 seconds for respectful scraping
- **Max Concurrent**: 3-5 for optimal performance
- **Headless Mode**: Reduces resource usage
- **Stealth Mode**: Prevents detection while maintaining performance

### Hardware Requirements
- **Memory**: 4GB+ RAM recommended
- **Storage**: 1GB+ for tile data
- **Network**: Stable internet connection
- **CPU**: Multi-core for concurrent operations

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Implement changes with tests
4. Submit a pull request

Please ensure all contributions maintain ethical scraping practices and include appropriate documentation.

## 📄 License

This project is provided for educational purposes only. Users are responsible for complying with all applicable laws and terms of service when using this tool.

---

**Note**: This tool is designed for educational analysis of web mapping technologies. Always respect website terms of service and implement appropriate rate limiting to avoid overwhelming target servers.