# Web Archiving Tool Documentation

## Overview
The Web Archiving Tool is a comprehensive solution for archiving websites and preserving web content for future access.

## Features
- **Website Archiving**: Archive complete websites with all assets
- **Version Management**: Track multiple versions of the same website
- **Search & Filtering**: Find archived content quickly
- **HTML Comparison**: Compare different versions of archived pages
- **Error Handling**: Comprehensive error reporting for partial archives
- **Responsive Design**: Works on desktop and mobile devices

## Architecture
- **Backend**: Node.js with Express and TypeScript
- **Frontend**: React with TypeScript
- **Storage**: File-based storage system
- **Crawler**: HTTP-based web crawler with asset downloading

## Quick Start
1. Clone the repository
2. Install dependencies: `npm install`
3. Start the backend: `cd backend && npm run dev`
4. Start the frontend: `cd frontend && npm start`
5. Open http://localhost:3000 in your browser

## Documentation Structure
- [API Documentation](./api.md) - Backend API endpoints
- [Frontend Guide](./frontend.md) - Frontend components and usage
- [Deployment Guide](./deployment.md) - Production deployment instructions
- [Development Guide](./development.md) - Development setup and guidelines