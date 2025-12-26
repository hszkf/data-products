#!/bin/bash

# Start both frontend and backend

SCRIPT_DIR="$(dirname "$0")"

echo "🚀 Starting SQL Query Studio (Data Products)"
echo "============================================="
echo ""

# Function to cleanup background processes
cleanup() {
    echo ""
    echo "🛑 Stopping all services..."
    kill $BACKEND_PID 2>/dev/null
    kill $FRONTEND_PID 2>/dev/null
    exit 0
}

# Set up trap for cleanup
trap cleanup SIGINT SIGTERM

# Start backend in background
echo "📡 Starting Backend (Hono + Bun)..."
cd "$SCRIPT_DIR/backend"

# Load environment variables if .env exists
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
fi

# Install backend dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing backend dependencies..."
    bun install
fi

bun run src/index.ts &
BACKEND_PID=$!
echo "   Backend PID: $BACKEND_PID"

# Wait for backend to start
sleep 2

# Start frontend in background
echo ""
echo "🎨 Starting Frontend (TanStack Router + Vite)..."
cd "$SCRIPT_DIR/frontend"

# Install frontend dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing frontend dependencies..."
    bun install || npm install
fi

bun run dev &
FRONTEND_PID=$!
echo "   Frontend PID: $FRONTEND_PID"

echo ""
echo "============================================="
echo "✅ Services started!"
echo ""
echo "   Backend:  http://localhost:${PORT:-8080}"
echo "   Frontend: http://localhost:3000"
echo ""
echo "Press Ctrl+C to stop all services"
echo "============================================="

# Wait for processes
wait
