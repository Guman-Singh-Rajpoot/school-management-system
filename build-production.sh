#!/bin/bash
# Build script for production setup
# This script helps you prepare the project for Render deployment

set -e

echo "🏗️  Building School Management System for Production..."
echo "=================================================="

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Backend setup
echo -e "${BLUE}📦 Setting up backend...${NC}"
cd backend

echo "   Installing Python dependencies..."
pip install -r requirements.txt

echo "   Running migrations..."
python manage.py migrate

echo "   Collecting static files..."
python manage.py collectstatic --noinput

cd ..

# Frontend setup
echo -e "${BLUE}🎨 Building frontend...${NC}"
cd frontend

echo "   Installing Node dependencies..."
npm install

echo "   Building React application..."
npm run build

cd ..

echo ""
echo -e "${GREEN}✅ Build completed successfully!${NC}"
echo ""
echo "📝 Next steps:"
echo "   1. Commit your changes to Git"
echo "   2. Push to your GitHub repository"
echo "   3. Connect your repository to Render dashboard"
echo "   4. Render will automatically deploy when you push"
echo ""
echo "🔗 Render Dashboard: https://dashboard.render.com"
echo ""
