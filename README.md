# Web Archiving Tool

A full-stack web archiving application that creates complete snapshots of websites with preserved styling, functionality, and assets. View archived pages exactly as they appeared when captured.

## ✨ Features

- **Complete Website Archiving** - Captures HTML, CSS, JavaScript, images, fonts, and all assets
- **Perfect Visual Preservation** - Archived pages look exactly like the original
- **Real-time Progress Tracking** - Watch archiving progress with detailed status updates
- **Archive Management** - View, organize, and delete archived websites
- **Version History** - Compare different versions of the same website over time
- **Responsive Archive Viewer** - Browse archived content with navigation and controls
- **Error Handling** - Graceful handling of timeouts and partial archives

## 🚀 Quick Start

### Prerequisites

- Node.js (v16 or higher)
- npm or yarn

### Installation & Setup

1. **Clone and install dependencies:**
```bash
git clone <repository-url>
cd web-archiving-tool
npm install
cd backend && npm install
cd ../frontend && npm install
```

2. **Start the application:**
```bash
# Terminal 1: Start backend (from project root)
cd backend && npm run dev

# Terminal 2: Start frontend (from project root)  
cd frontend && npm start
```

3. **Access the application:**
- Frontend: http://localhost:3000
- Backend API: http://localhost:3001

## 🎯 How to Use

1. **Create an Archive:**
   - Enter any website URL in the form
   - Click "Archive Website" 
   - Watch real-time progress as the site is crawled and saved

2. **View Archives:**
   - Browse your archived websites in the main list
   - Click "View Archive" to see the preserved website
   - Navigate through archived pages with full functionality

3. **Manage Archives:**
   - Delete unwanted archives
   - Compare different versions of the same site
   - Track archive metadata (size, page count, duration)

## 🏗️ Architecture

### Backend (`/backend`)
- **Express.js API** with TypeScript
- **Puppeteer-based crawler** for website capture
- **File system storage** for archived content
- **URL rewriting engine** for asset preservation
- **Progress tracking** with real-time updates

### Frontend (`/frontend`)
- **React with TypeScript** for the user interface
- **Archive viewer component** with iframe rendering
- **Real-time progress monitoring** with polling
- **Responsive design** for all screen sizes

## 📡 API Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/archives` | Create new archive |
| `GET` | `/api/archives` | List all archives |
| `GET` | `/api/archives/:id` | Get archive details |
| `GET` | `/api/archives/:id/content/*` | Serve archived content |
| `GET` | `/api/archives/:id/progress` | Get archiving progress |
| `DELETE` | `/api/archives/:id` | Delete archive |

## 🔧 Technical Features

### Advanced Web Crawling
- **Smart asset detection** - Finds CSS, JS, images, fonts automatically
- **URL rewriting** - Converts all links to archived versions
- **Timeout handling** - Graceful partial archiving on slow sites
- **Error recovery** - Continues archiving despite individual page failures

### Content Preservation
- **CSS preprocessing** - Rewrites `url()` and `@import` statements
- **JavaScript compatibility** - Preserves dynamic functionality
- **Font preservation** - Downloads and serves custom fonts
- **Image optimization** - Handles all image formats and responsive images

### Security & Performance
- **Permissive CSP headers** - Allows archived content to display properly
- **CORS support** - Enables cross-origin asset loading
- **Efficient caching** - Optimized headers for browser caching
- **Sandboxed serving** - Isolated archive content delivery

## 📁 Project Structure

```
web-archiving-tool/
├── backend/                 # Node.js backend
│   ├── src/
│   │   ├── routes/         # API endpoints
│   │   ├── services/       # Core business logic
│   │   │   ├── archive-service.ts    # Archive management
│   │   │   ├── crawler-service.ts    # Web crawling
│   │   │   └── file-service.ts       # File operations
│   │   ├── utils/          # Utilities
│   │   │   ├── url-rewriter.ts       # URL rewriting engine
│   │   │   └── validation.ts         # Input validation
│   │   ├── config/         # Configuration management
│   │   └── types/          # TypeScript definitions
│   ├── archives/           # Stored archive data
│   ├── .env.example        # Environment configuration template
│   └── dist/              # Compiled JavaScript
├── frontend/               # React frontend
│   ├── src/
│   │   ├── components/     # React components
│   │   │   ├── ArchiveForm.tsx       # Archive creation form
│   │   │   ├── ArchiveList.tsx       # Archive listing
│   │   │   ├── ArchivedViewer.tsx    # Archive viewer
│   │   │   └── ProgressBar.tsx       # Progress tracking
│   │   ├── services/       # API client
│   │   └── types/          # TypeScript types
│   └── build/             # Production build
├── docs/                   # Documentation
│   ├── API.md             # API documentation
│   ├── DEPLOYMENT.md      # Deployment guide
│   └── TROUBLESHOOTING.md # Troubleshooting guide
└── README.md
```

## 🧪 Testing

```bash
# Run backend tests
cd backend && npm test

# Run frontend tests  
cd frontend && npm test
```

## 🚀 Production Deployment

1. **Build the applications:**
```bash
cd backend && npm run build
cd ../frontend && npm run build
```

2. **Start production server:**
```bash
cd backend && npm start
```

3. **Serve frontend build** using your preferred web server (nginx, Apache, etc.)

## 📚 Documentation

- **[API Documentation](docs/API.md)** - Complete API reference with examples
- **[Deployment Guide](docs/DEPLOYMENT.md)** - Production deployment instructions
- **[Troubleshooting Guide](docs/TROUBLESHOOTING.md)** - Common issues and solutions

## 🔍 Quick Troubleshooting

### Common Issues

- **Archive not displaying:** Check browser console for CSP errors
- **Slow archiving:** Large sites may take several minutes
- **Missing assets:** Some sites block automated crawling
- **Timeout errors:** Increase timeout settings for slow sites

### Performance Tips

- Archive smaller sites first to test functionality
- Monitor disk space as archives can be large
- Clean up old archives periodically
- Use fast internet connection for better crawling speed

For detailed troubleshooting, see [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md).

## 📄 License

This project is licensed under the MIT License.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

---

**Built with ❤️ for preserving the web, one site at a time.**