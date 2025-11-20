#!/bin/bash

# Build script for Docker image

set -e

echo "🐋 Building Bowhead Whale Docker image..."

# Build the Docker image
docker build -t bowhead-whale:latest .

echo "✅ Build complete!"
echo ""
echo "To run the container:"
echo "  docker run -d -p 3000:3000 --name bowhead-whale bowhead-whale:latest"
echo ""
echo "Or use docker-compose:"
echo "  docker-compose up -d"

