# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a two-part project for recreating the Red Dead Redemption 2 interactive map locally:

1. **Data Scraper (Python)** - Extracts all data from https://rdr2map.com including:
   - Background map images and tiles
   - Point of interest (POI) data and coordinates
   - Road/path data
   - Textures and assets
   - Interactive elements

2. **Local Interactive Map (React + TypeScript Backend)** - Recreates the map functionality using scraped data:
   - React frontend for map visualization
   - TypeScript backend API
   - Database (Docker-based) for storing map data
   - Local asset serving

## Architecture

### Part 1: Python Scraper
- Located in `/scraper/` directory
- Uses requests/scrapy for web scraping
- Handles image downloads and asset management
- Outputs structured data (JSON) and organized assets
- May require reverse engineering of rdr2map.com API endpoints

### Part 2: Local Map Application
- **Frontend**: React application (`/frontend/`)
  - Map rendering (likely using Leaflet, OpenLayers, or custom canvas)
  - POI markers and popups
  - Interactive features (zoom, pan, search)
  - Asset loading and caching

- **Backend**: TypeScript/Node.js API (`/backend/`)
  - Serves map data and assets
  - Database queries for POI data
  - Image/tile serving endpoints
  - Search and filtering APIs

- **Database**: Docker-based storage
  - Stores POI coordinates and metadata
  - Map tile references
  - User preferences/settings
  - Docker Compose configuration

## Key Technical Considerations

- **Map Tiling**: Large background images need to be split into tiles for efficient loading
- **Asset Management**: Organize downloaded assets by type (images, icons, data files)
- **Data Structure**: Maintain relationships between POIs, categories, and map regions
- **Performance**: Implement lazy loading for map tiles and assets
- **Legal Compliance**: Ensure scraping respects robots.txt and terms of service

## Development Workflow

This project will likely require:
1. Analysis of rdr2map.com structure and API endpoints
2. Building robust scraping with rate limiting and error handling
3. Setting up Docker development environment
4. Implementing map rendering with proper coordinate systems
5. Creating efficient data storage and retrieval systems

## Common Commands

### Python Scraper Setup
```bash
# Navigate to scraper directory
cd scraper/

# Set up pyenv and Python version
export PYENV_ROOT="$HOME/.pyenv"
export PATH="$PYENV_ROOT/bin:$PATH"
eval "$(pyenv init -)"
pyenv local 3.11.9

# Create and activate virtual environment
python -m venv venv
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env
```

### Running the Scraper
```bash
# Activate virtual environment
source venv/bin/activate

# Run the main scraper
python src/rdr2_scraper.py

# Check scraper logs
tail -f scraper.log
```

## Dependencies

Expected major dependencies:
- **Python**: requests, scrapy, Pillow (image processing)
- **React**: Leaflet/OpenLayers, axios, styled-components
- **Backend**: Express.js, TypeORM/Prisma, cors
- **Database**: PostgreSQL or MongoDB (Docker)
- **Docker**: docker-compose for development environment