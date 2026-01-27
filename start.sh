#!/bin/bash

# RDR2 Interactive Map - Start Script
# This script starts both the backend and frontend servers

echo "========================================"
echo "  RDR2 Interactive Map"
echo "========================================"
echo ""

# Check if backend dependencies are installed
if [ ! -d "backend/node_modules" ]; then
    echo "Installing backend dependencies..."
    cd backend && npm install && cd ..
fi

# Check if frontend dependencies are installed
if [ ! -d "frontend/node_modules" ]; then
    echo "Installing frontend dependencies..."
    cd frontend && npm install && cd ..
fi

# Check if database exists
if [ ! -f "backend/data/rdr2.db" ]; then
    echo "Database not found. Running import..."
    cd backend && npm run import-data && cd ..
fi

echo ""
echo "Starting servers..."
echo "  Backend:  http://localhost:3001"
echo "  Frontend: http://localhost:5173"
echo ""
echo "Press Ctrl+C to stop both servers"
echo ""

# Start backend in background
cd backend && npm run dev &
BACKEND_PID=$!

# Wait a moment for backend to start
sleep 2

# Start frontend
cd frontend && npm run dev &
FRONTEND_PID=$!

# Wait for both processes
wait $BACKEND_PID $FRONTEND_PID
