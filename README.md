# 🗺️ RDR2 Interactive Map

A self-hosted interactive map for Red Dead Redemption 2, built as a full-stack web application. Browse points of interest, explore the world, and run it entirely on your own machine.

> **Note:** This project ships with zero game assets. You generate your own tiles and marker data locally using the included extractor. See [Getting Started](#getting-started).

![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)
![Python](https://img.shields.io/badge/Python-3.11-3776AB?logo=python&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-green)

---

## ✨ Features

- Interactive map with pan and zoom
- Points of interest organized by category
- Marker filtering and search
- Local tile serving — no external dependencies at runtime
- SQLite database — no Docker required
- Simple one-command startup

## 🏗️ Architecture

```
rdr2-map/
├── frontend/          # React + TypeScript (react-leaflet)
├── backend/           # Express + SQLite API
├── rdr2_extractor/    # Python data extractor (tiles + markers)
└── start.sh           # One-command startup script
```

The extractor is a **development-only tool**. Once you've generated your local data, you only need the frontend and backend to run the map.

## ⚠️ Legal Notice

This repository contains **source code only**. No game assets from Red Dead Redemption 2 are included, distributed, or hosted here. All map tiles and textures are the intellectual property of Rockstar Games / Take-Two Interactive and are protected by copyright.

By using the extractor, you are generating data for **personal, non-commercial use only**. You are responsible for complying with Rockstar Games' [EULA](https://www.rockstargames.com/eula) and applicable law.

---

## Getting Started

### Prerequisites

- Node.js 18+
- Python 3.11+
- npm

### 1. Clone the repo

```bash
git clone https://github.com/belcaik/rdr2-map.git
cd rdr2-map
```

### 2. Generate local data (one-time setup)

The extractor downloads map tiles and marker data to your local machine.

```bash
cd rdr2_extractor

# Set up Python environment
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt

# Run the extractor
python main.py
```

Tiles and marker data will be saved to `rdr2_extractor/data/`. This step can take a while depending on how many zoom levels you configure.

### 3. Import data into the backend

```bash
cd backend
npm install
npm run import-data
```

### 4. Start the app

```bash
# From the project root
chmod +x start.sh
./start.sh
```

Then open [http://localhost:5173](http://localhost:5173) in your browser.

| Service  | URL                         |
|----------|-----------------------------|
| Frontend | http://localhost:5173       |
| Backend  | http://localhost:3001       |

---

## Development

### Running services individually

```bash
# Backend
cd backend && npm run dev

# Frontend (separate terminal)
cd frontend && npm run dev
```

### Environment variables

Copy the example env files before running:

```bash
cp backend/.env.example backend/.env
```

Key variables:

| Variable         | Description                        | Default         |
|------------------|------------------------------------|-----------------|
| `PORT`           | Backend port                       | `3001`          |
| `DB_PATH`        | Path to SQLite database            | `data/rdr2.db`  |
| `TILES_DIR`      | Path to local tile directory       | `data/tiles/`   |

### Project structure (detailed)

```
frontend/
├── src/
│   ├── components/    # React components (Map, Markers, Sidebar...)
│   ├── hooks/         # Custom hooks
│   ├── services/      # API client
│   └── types/         # TypeScript types

backend/
├── src/
│   ├── routes/        # Express route handlers
│   ├── db/            # SQLite setup and queries
│   └── scripts/       # Data import scripts

rdr2_extractor/
├── src/
│   ├── browser_controller.py   # Selenium automation
│   ├── network_analyzer.py     # Traffic analysis
│   ├── data_extractor.py       # Marker extraction
│   └── tile_downloader.py      # Async tile downloader
└── config/
    └── default.json            # Extractor configuration
```

---

## Roadmap

- [ ] Canvas-based marker rendering (performance)
- [ ] Viewport virtualization
- [ ] Search and filter UI
- [ ] Mobile-friendly layout
- [ ] Docker Compose for self-hosting

## Contributing

Pull requests are welcome. For major changes, please open an issue first to discuss what you'd like to change.

## License

[MIT](./LICENSE) — source code only. See the license file for the full notice regarding third-party game assets.
