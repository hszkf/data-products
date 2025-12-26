#!/bin/bash

# Start the Hono + Bun backend

cd "$(dirname "$0")/backend"

echo "🚀 Starting Hono + Bun Backend..."
echo "================================"

# Check if bun is installed
if ! command -v bun &> /dev/null; then
    echo "❌ Bun is not installed. Please install it first:"
    echo "   curl -fsSL https://bun.sh/install | bash"
    exit 1
fi

# Load environment variables if .env exists
if [ -f .env ]; then
    echo "📝 Loading environment variables from .env"
    export $(cat .env | grep -v '^#' | xargs)
fi

# Redshift Serverless configuration
export REDSHIFT_DATABASE="${REDSHIFT_DATABASE:-glue_spectrum}"
export REDSHIFT_WORKGROUP_NAME="${REDSHIFT_WORKGROUP_NAME:-serverless-workgroup}"
export AWS_REGION="${AWS_REGION:-ap-southeast-1}"

# Install dependencies if node_modules doesn't exist
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    bun install
fi

# Kill any existing process on port 8080
PORT=${PORT:-8080}
if lsof -ti:$PORT > /dev/null 2>&1; then
    echo "⚠️  Port $PORT is in use. Killing existing process..."
    lsof -ti:$PORT | xargs kill -9 2>/dev/null
    sleep 1
fi

# Start the server
echo ""
echo "🌐 Starting server on port ${PORT:-8080}..."
echo ""

bun run src/index.ts
