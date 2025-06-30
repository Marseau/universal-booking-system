#!/bin/bash

# Universal Booking System Setup Script
echo "🚀 Universal Booking System - Setup Script"
echo "==========================================="

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18+ first."
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "❌ Node.js version 18+ is required. Current version: $(node -v)"
    exit 1
fi

echo "✅ Node.js $(node -v) detected"

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Check if .env file exists
if [ ! -f ".env" ]; then
    echo "📄 Creating .env file from .env.example..."
    cp .env.example .env
    echo "⚠️  Please edit .env file with your actual configuration values"
else
    echo "✅ .env file already exists"
fi

# Build the project
echo "🔨 Building the project..."
npm run build

# Check if TypeScript compilation was successful
if [ $? -eq 0 ]; then
    echo "✅ Build successful"
else
    echo "❌ Build failed. Please check for TypeScript errors."
    exit 1
fi

echo ""
echo "🎉 Setup completed successfully!"
echo ""
echo "📋 Next steps:"
echo "1. Edit .env file with your configuration:"
echo "   - SUPABASE_URL and SUPABASE_ANON_KEY"
echo "   - WHATSAPP_TOKEN and WHATSAPP_PHONE_NUMBER_ID"
echo "   - OPENAI_API_KEY"
echo "   - ZOHO_SMTP_USER and ZOHO_SMTP_PASS"
echo "   - GOOGLE_CALENDAR credentials (optional)"
echo ""
echo "2. Run the admin database schema:"
echo "   Execute database/admin-schema.sql in your Supabase database"
echo ""
echo "3. Start the development server:"
echo "   npm run dev"
echo ""
echo "4. Access the admin dashboard:"
echo "   http://localhost:3000/admin"
echo "   Default login: admin@universalbooking.com / admin123"
echo "   ⚠️  CHANGE THE DEFAULT PASSWORD IMMEDIATELY!"
echo ""
echo "5. Test the AI system:"
echo "   npm run test:ai"
echo ""
echo "6. Test WhatsApp integration:"
echo "   npm run test:whatsapp"
echo ""
echo "🔧 Available commands:"
echo "   npm run dev          - Start development server"
echo "   npm run build        - Build for production"
echo "   npm run start        - Start production server"
echo "   npm run test:all     - Run all AI tests"
echo "   npm run logs         - View application logs"
echo ""
echo "📚 Documentation: https://github.com/Marseau/universal-booking-system"
echo ""
echo "🆘 Need help? Check the troubleshooting section in README.md"