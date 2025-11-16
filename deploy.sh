#!/bin/bash

# Nostr-Feedz Deployment Script
set -e

echo "🚀 Starting Nostr-Feedz deployment..."

# Check if .env.production exists
if [ ! -f .env.production ]; then
    echo "❌ .env.production file not found!"
    echo "Please copy .env.production.example to .env.production and configure it."
    exit 1
fi

# Build and start services
echo "📦 Building and starting Docker services..."
docker compose down --remove-orphans
docker compose build --no-cache
docker compose up -d

# Wait for database to be ready
echo "⏳ Waiting for database to be ready..."
sleep 10

# Run database migrations
echo "🗄️  Running database migrations..."
docker compose exec app npx prisma migrate deploy

echo "✅ Deployment complete!"
echo "🌐 Your app should be available at https://nostrfeedz.com"
echo ""
echo "📊 Check status with:"
echo "  docker compose ps"
echo "  docker compose logs -f"
echo ""
echo "🛑 Stop with:"
echo "  docker compose down"