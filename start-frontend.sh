#!/bin/bash

# Start the TanStack Router + Vite frontend

cd "$(dirname "$0")/frontend"

echo "🚀 Starting TanStack Router + Vite Frontend..."
echo "================================"

# Check if bun or npm is available
if command -v bun &> /dev/null; then
    PKG_MANAGER="bun"
elif command -v npm &> /dev/null; then
    PKG_MANAGER="npm"
else
    echo "❌ Neither bun nor npm is installed. Please install one of them first."
    exit 1
fi

echo "📦 Using $PKG_MANAGER as package manager"

# Install dependencies if node_modules doesn't exist
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    $PKG_MANAGER install
fi

# Kill any process already using port 3000
PORT=3000
PID=$(lsof -ti:$PORT 2>/dev/null)
if [ -n "$PID" ]; then
    echo "⚠️  Port $PORT is already in use by PID $PID"
    echo "🔪 Killing process..."
    kill -9 $PID 2>/dev/null
    sleep 1
    echo "✅ Port $PORT is now free"
fi

# Start the development server
echo ""
echo "🌐 Starting Vite dev server on port 3000..."
echo ""

$PKG_MANAGER run dev
