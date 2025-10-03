#!/bin/bash

# Script per testare il deploy localmente con Docker
# Simula l'ambiente Render

set -e

echo "🐳 Building Docker image..."
docker build -t mcp-things5-server .

echo "🚀 Starting container..."
docker run -p 3000:3000 \
  -e PORT=3000 \
  -e NODE_ENV=production \
  --name mcp-things5-test \
  --rm \
  mcp-things5-server

echo "✅ Container started on http://localhost:3000"
echo "🔍 Test with: curl http://localhost:3000/health"
