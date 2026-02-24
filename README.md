# RDR2 Interactive Map

A local recreation of the Red Dead Redemption 2 interactive map with React frontend and TypeScript backend.

## Quick Start

```bash
# Backend
cd backend && npm install && npm run dev

# Frontend (separate terminal)
cd frontend && npm install && npm run dev
```

Open http://localhost:5173 in your browser.

## Map Tiles

This project requires RDR2 map tiles to display the background map.

**For local development:** Run the extractor in `rdr2_extractor/` to download
tiles for personal use. Tiles are stored in `rdr2_extractor/data/tiles/` and
served by the backend.

**For deployment without tiles:** The app works without tiles — markers render
on a dark background. Set `VITE_TILE_SOURCE=none` in `frontend/.env`:

```bash
cp frontend/.env.example frontend/.env
# Edit frontend/.env and set VITE_TILE_SOURCE=none
```

The tile downloader is included for personal local use only.
Downloaded tiles must not be redistributed.

## Project Structure

```
frontend/     React + Vite frontend (react-leaflet, Leaflet)
backend/      Express + better-sqlite3 API server
rdr2_extractor/  Python data extraction scripts
```

## API Endpoints

| Endpoint | Description |
|---|---|
| `GET /api/markers` | All markers (supports `?bbox=`, `?category_ids=`, `?limit=`, `?offset=`) |
| `GET /api/markers/categories` | Category list with counts |
| `GET /api/tiles/:z/:x/:y.jpg` | Map tile images |
| `GET /api/progress` | User progress (found markers) |
| `POST /api/progress/:id` | Toggle marker found status |
