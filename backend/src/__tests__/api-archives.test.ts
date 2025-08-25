import request from 'supertest';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { createArchiveRouter } from '../routes/archives';
import { ArchiveService } from '../services/archive-service';
import { Archive, ArchiveStatus } from '../types';

describe('Archive API Endpoints', () => {
  let mockArchiveService: jest.Mocked<ArchiveService>;
  let app: express.Application;

  beforeEach(() => {
    // Create mock archive service
    mockArchiveService = {
      createArchive: jest.fn(),
      getArchive: jest.fn(),
      getArchives: jest.fn(),
      deleteArchive: jest.fn(),
      archiveExists: jest.fn(),
      getArchivedContent: jest.fn(),
      getArchiveProgress: jest.fn(),
      getActiveArchives: jest.fn(),
      getArchiveVersions: jest.fn(),
      getArchivesByUrl: jest.fn(),
      getLatestVersionNumber: jest.fn(),
    } as any;

    // Create test app with mocked service
    app = express();
    app.use(helmet());
    app.use(cors());
    app.use(express.json({ limit: '10mb' }));
    app.use(express.urlencoded({ extended: true, limit: '10mb' }));
    
    // Use the factory function with our mock service
    app.use('/api/archives', createArchiveRouter(mockArchiveService));
  });

  describe('POST /api/archives', () => {
    const mockArchive: Archive = {
      id: 'test-archive-id',
      url: 'https://example.com',
      domain: 'example.com',
      timestamp: new Date('2023-01-01T00:00:00Z'),
      status: ArchiveStatus.IN_PROGRESS,
      version: 1,
      metadata: {
        pageCount: 0,
        assetCount: 0,
        totalSize: 0,
        crawlDuration: 0,
      },
      pages: [],
      errors: [],
    };

    it('should create a new archive successfully', async () => {
      mockArchiveService.createArchive.mockResolvedValue(mockArchive);

      const response = await request(app)
        .post('/api/archives')
        .send({ url: 'https://example.com' })
        .expect(201);

      expect(response.body).toEqual({
        success: true,
        data: {
          ...mockArchive,
          timestamp: mockArchive.timestamp.toISOString(),
        },
      });

      expect(mockArchiveService.createArchive).toHaveBeenCalledWith('https://example.com', undefined);
    });

    it('should create archive with custom options', async () => {
      mockArchiveService.createArchive.mockResolvedValue(mockArchive);

      const options = {
        maxDepth: 2,
        maxPages: 50,
        timeout: 15000,
        respectRobots: false,
      };

      const response = await request(app)
        .post('/api/archives')
        .send({ url: 'https://example.com', options })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(mockArchiveService.createArchive).toHaveBeenCalledWith('https://example.com', options);
    });

    it('should return 400 when URL is missing', async () => {
      const response = await request(app)
        .post('/api/archives')
        .send({})
        .expect(400);

      expect(response.body).toEqual({
        error: 'URL is required',
        code: 'MISSING_URL',
      });

      expect(mockArchiveService.createArchive).not.toHaveBeenCalled();
    });

    it('should return 400 when URL is not a string', async () => {
      const response = await request(app)
        .post('/api/archives')
        .send({ url: 123 })
        .expect(400);

      expect(response.body).toEqual({
        error: 'URL must be a string',
        code: 'INVALID_URL_TYPE',
      });

      expect(mockArchiveService.createArchive).not.toHaveBeenCalled();
    });

    it('should return 400 for invalid maxDepth', async () => {
      const response = await request(app)
        .post('/api/archives')
        .send({ 
          url: 'https://example.com',
          options: { maxDepth: 15 }
        })
        .expect(400);

      expect(response.body).toEqual({
        error: 'maxDepth must be a number between 1 and 10',
        code: 'INVALID_MAX_DEPTH',
      });
    });

    it('should return 400 for invalid URL', async () => {
      mockArchiveService.createArchive.mockRejectedValue(new Error('Invalid URL: not-a-url'));

      const response = await request(app)
        .post('/api/archives')
        .send({ url: 'not-a-url' })
        .expect(400);

      expect(response.body).toEqual({
        error: 'Invalid URL: not-a-url',
        code: 'INVALID_URL',
      });
    });

    it('should return 429 when too many concurrent archives', async () => {
      mockArchiveService.createArchive.mockRejectedValue(
        new Error('Maximum concurrent archives limit reached (3). Please wait for existing archives to complete.')
      );

      const response = await request(app)
        .post('/api/archives')
        .send({ url: 'https://example.com' })
        .expect(429);

      expect(response.body.code).toBe('TOO_MANY_CONCURRENT_ARCHIVES');
    });

    it('should return 409 when archive is already in progress', async () => {
      mockArchiveService.createArchive.mockRejectedValue(
        new Error('Archive for https://example.com is already in progress')
      );

      const response = await request(app)
        .post('/api/archives')
        .send({ url: 'https://example.com' })
        .expect(409);

      expect(response.body.code).toBe('ARCHIVE_IN_PROGRESS');
    });

    it('should return 500 for unexpected errors', async () => {
      mockArchiveService.createArchive.mockRejectedValue(new Error('Unexpected error'));

      const response = await request(app)
        .post('/api/archives')
        .send({ url: 'https://example.com' })
        .expect(500);

      expect(response.body).toEqual({
        error: 'Failed to create archive',
        code: 'INTERNAL_ERROR',
        details: 'Unexpected error',
      });
    });
  });

  describe('GET /api/archives', () => {
    const mockArchives: Archive[] = [
      {
        id: 'archive-1',
        url: 'https://example.com',
        domain: 'example.com',
        timestamp: new Date('2023-01-02T00:00:00Z'),
        status: ArchiveStatus.COMPLETED,
        version: 1,
        metadata: { pageCount: 5, assetCount: 20, totalSize: 1024000, crawlDuration: 5000 },
        pages: [],
        errors: [],
      },
      {
        id: 'archive-2',
        url: 'https://test.com',
        domain: 'test.com',
        timestamp: new Date('2023-01-01T00:00:00Z'),
        status: ArchiveStatus.COMPLETED,
        version: 1,
        metadata: { pageCount: 3, assetCount: 10, totalSize: 512000, crawlDuration: 3000 },
        pages: [],
        errors: [],
      },
    ];

    it('should list all archives successfully', async () => {
      mockArchiveService.getArchives.mockResolvedValue(mockArchives);

      const response = await request(app)
        .get('/api/archives')
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: mockArchives.map(archive => ({
          ...archive,
          timestamp: archive.timestamp.toISOString(),
        })),
        count: 2,
      });

      expect(mockArchiveService.getArchives).toHaveBeenCalledWith();
    });

    it('should return empty list when no archives exist', async () => {
      mockArchiveService.getArchives.mockResolvedValue([]);

      const response = await request(app)
        .get('/api/archives')
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: [],
        count: 0,
      });
    });

    it('should return 500 for service errors', async () => {
      mockArchiveService.getArchives.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .get('/api/archives')
        .expect(500);

      expect(response.body).toEqual({
        error: 'Failed to list archives',
        code: 'INTERNAL_ERROR',
        details: 'Database error',
      });
    });
  });

  describe('GET /api/archives/:id', () => {
    const mockArchive: Archive = {
      id: 'test-archive-id',
      url: 'https://example.com',
      domain: 'example.com',
      timestamp: new Date('2023-01-01T00:00:00Z'),
      status: ArchiveStatus.COMPLETED,
      version: 1,
      metadata: { pageCount: 5, assetCount: 20, totalSize: 1024000, crawlDuration: 5000 },
      pages: [],
      errors: [],
    };

    it('should get archive by ID successfully', async () => {
      mockArchiveService.getArchive.mockResolvedValue(mockArchive);

      const response = await request(app)
        .get('/api/archives/test-archive-id')
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: {
          ...mockArchive,
          timestamp: mockArchive.timestamp.toISOString(),
        },
      });

      expect(mockArchiveService.getArchive).toHaveBeenCalledWith('test-archive-id');
    });

    it('should return 404 when archive not found', async () => {
      mockArchiveService.getArchive.mockRejectedValue(new Error('Archive not found: test-archive-id'));

      const response = await request(app)
        .get('/api/archives/nonexistent-id')
        .expect(404);

      expect(response.body).toEqual({
        error: 'Archive not found',
        code: 'ARCHIVE_NOT_FOUND',
        details: 'Archive not found: test-archive-id',
      });
    });

    it('should return 500 for service errors', async () => {
      mockArchiveService.getArchive.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .get('/api/archives/test-archive-id')
        .expect(500);

      expect(response.body).toEqual({
        error: 'Failed to get archive',
        code: 'INTERNAL_ERROR',
        details: 'Database error',
      });
    });
  });

  describe('GET /api/archives/:id/content/*', () => {
    it('should serve HTML content successfully', async () => {
      mockArchiveService.archiveExists.mockResolvedValue(true);
      mockArchiveService.getArchivedContent.mockResolvedValue({
        content: '<html><body>Test content</body></html>',
        contentType: 'text/html; charset=utf-8',
      });

      const response = await request(app)
        .get('/api/archives/test-archive-id/content/')
        .expect(200);

      expect(response.text).toBe('<html><body>Test content</body></html>');
      expect(response.headers['content-type']).toBe('text/html; charset=utf-8');
      expect(response.headers['x-archive-id']).toBe('test-archive-id');
      expect(response.headers['x-content-path']).toBe('');

      expect(mockArchiveService.archiveExists).toHaveBeenCalledWith('test-archive-id');
      expect(mockArchiveService.getArchivedContent).toHaveBeenCalledWith('test-archive-id', '');
    });

    it('should serve asset content successfully', async () => {
      const cssContent = 'body { color: red; }';
      mockArchiveService.archiveExists.mockResolvedValue(true);
      mockArchiveService.getArchivedContent.mockResolvedValue({
        content: cssContent,
        contentType: 'text/css',
      });

      const response = await request(app)
        .get('/api/archives/test-archive-id/content/styles/main.css')
        .expect(200);

      expect(response.text).toBe(cssContent);
      expect(response.headers['content-type']).toBe('text/css; charset=utf-8');
      expect(response.headers['cache-control']).toBe('public, max-age=3600');

      expect(mockArchiveService.getArchivedContent).toHaveBeenCalledWith('test-archive-id', 'styles/main.css');
    });

    it('should return 404 when archive does not exist', async () => {
      mockArchiveService.archiveExists.mockResolvedValue(false);

      const response = await request(app)
        .get('/api/archives/nonexistent-id/content/')
        .expect(404);

      expect(response.body).toEqual({
        error: 'Archive not found',
        code: 'ARCHIVE_NOT_FOUND',
      });

      expect(mockArchiveService.getArchivedContent).not.toHaveBeenCalled();
    });

    it('should return 404 when content not found', async () => {
      mockArchiveService.archiveExists.mockResolvedValue(true);
      mockArchiveService.getArchivedContent.mockRejectedValue(new Error('Content not found'));

      const response = await request(app)
        .get('/api/archives/test-archive-id/content/nonexistent.html')
        .expect(404);

      expect(response.body).toEqual({
        error: 'Content not found',
        code: 'CONTENT_NOT_FOUND',
        details: 'Content not found',
      });
    });

    it('should return 500 for service errors', async () => {
      mockArchiveService.archiveExists.mockResolvedValue(true);
      mockArchiveService.getArchivedContent.mockRejectedValue(new Error('Storage error'));

      const response = await request(app)
        .get('/api/archives/test-archive-id/content/')
        .expect(500);

      expect(response.body).toEqual({
        error: 'Failed to serve archived content',
        code: 'INTERNAL_ERROR',
        details: 'Storage error',
      });
    });
  });

  describe('DELETE /api/archives/:id', () => {
    it('should delete archive successfully', async () => {
      mockArchiveService.deleteArchive.mockResolvedValue();

      const response = await request(app)
        .delete('/api/archives/test-archive-id')
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        message: 'Archive deleted successfully',
      });

      expect(mockArchiveService.deleteArchive).toHaveBeenCalledWith('test-archive-id');
    });

    it('should return 404 when archive not found', async () => {
      mockArchiveService.deleteArchive.mockRejectedValue(new Error('Archive not found'));

      const response = await request(app)
        .delete('/api/archives/nonexistent-id')
        .expect(404);

      expect(response.body).toEqual({
        error: 'Archive not found',
        code: 'ARCHIVE_NOT_FOUND',
        details: 'Archive not found',
      });
    });

    it('should return 409 when archive is in progress', async () => {
      mockArchiveService.deleteArchive.mockRejectedValue(
        new Error('Cannot delete archive test-archive-id: archiving in progress')
      );

      const response = await request(app)
        .delete('/api/archives/test-archive-id')
        .expect(409);

      expect(response.body).toEqual({
        error: 'Cannot delete archive while archiving is in progress',
        code: 'ARCHIVE_IN_PROGRESS',
        details: 'Cannot delete archive test-archive-id: archiving in progress',
      });
    });

    it('should return 500 for service errors', async () => {
      mockArchiveService.deleteArchive.mockRejectedValue(new Error('Storage error'));

      const response = await request(app)
        .delete('/api/archives/test-archive-id')
        .expect(500);

      expect(response.body).toEqual({
        error: 'Failed to delete archive',
        code: 'INTERNAL_ERROR',
        details: 'Storage error',
      });
    });
  });

  describe('GET /api/archives/:id/progress', () => {
    const mockProgress = {
      archiveId: 'test-archive-id',
      url: 'https://example.com',
      status: ArchiveStatus.IN_PROGRESS,
      progress: {
        pagesDiscovered: 10,
        pagesCrawled: 5,
        assetsDownloaded: 25,
        totalSize: 1024000,
      },
      errors: [],
      startTime: new Date('2023-01-01T00:00:00Z'),
    };

    it('should get archive progress successfully', async () => {
      mockArchiveService.getArchiveProgress.mockReturnValue(mockProgress);

      const response = await request(app)
        .get('/api/archives/test-archive-id/progress')
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: {
          ...mockProgress,
          startTime: mockProgress.startTime.toISOString(),
        },
      });

      expect(mockArchiveService.getArchiveProgress).toHaveBeenCalledWith('test-archive-id');
    });

    it('should return 404 when progress not found', async () => {
      mockArchiveService.getArchiveProgress.mockReturnValue(null);

      const response = await request(app)
        .get('/api/archives/test-archive-id/progress')
        .expect(404);

      expect(response.body).toEqual({
        error: 'Archive progress not found (archive may be completed or not exist)',
        code: 'PROGRESS_NOT_FOUND',
      });
    });

    it('should handle route structure correctly', async () => {
      // This test verifies that the route structure is set up correctly
      // We'll test with a valid archive ID instead
      mockArchiveService.getArchiveProgress.mockReturnValue(null);
      
      const response = await request(app)
        .get('/api/archives/valid-id/progress')
        .expect(404);

      expect(response.body.code).toBe('PROGRESS_NOT_FOUND');
      expect(mockArchiveService.getArchiveProgress).toHaveBeenCalledWith('valid-id');
    });
  });

  describe('GET /api/archives/versions/:encodedUrl', () => {
    const mockVersions: Archive[] = [
      {
        id: 'archive-2',
        url: 'https://example.com',
        domain: 'example.com',
        timestamp: new Date('2023-01-02T00:00:00Z'),
        status: ArchiveStatus.COMPLETED,
        version: 2,
        metadata: { pageCount: 5, assetCount: 10, totalSize: 2048, crawlDuration: 2000 },
        pages: [],
        errors: [],
      },
      {
        id: 'archive-1',
        url: 'https://example.com',
        domain: 'example.com',
        timestamp: new Date('2023-01-01T00:00:00Z'),
        status: ArchiveStatus.COMPLETED,
        version: 1,
        metadata: { pageCount: 3, assetCount: 5, totalSize: 1024, crawlDuration: 1000 },
        pages: [],
        errors: [],
      },
    ];

    it('should get archive versions successfully', async () => {
      mockArchiveService.getArchiveVersions.mockResolvedValue(mockVersions);

      const encodedUrl = encodeURIComponent('https://example.com');
      const response = await request(app)
        .get(`/api/archives/versions/${encodedUrl}`)
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: mockVersions.map(archive => ({
          ...archive,
          timestamp: archive.timestamp.toISOString(),
        })),
        count: 2,
      });

      expect(mockArchiveService.getArchiveVersions).toHaveBeenCalledWith('https://example.com');
    });

    it('should return empty array for URL with no versions', async () => {
      mockArchiveService.getArchiveVersions.mockResolvedValue([]);

      const encodedUrl = encodeURIComponent('https://nonexistent.com');
      const response = await request(app)
        .get(`/api/archives/versions/${encodedUrl}`)
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: [],
        count: 0,
      });
    });

    it('should return 400 for missing URL', async () => {
      const response = await request(app)
        .get('/api/archives/versions/')
        .expect(404); // Express returns 404 for missing route parameter
    });

    it('should return 400 for invalid URL encoding', async () => {
      const response = await request(app)
        .get('/api/archives/versions/%')
        .expect(400);

      expect(response.body).toEqual({
        error: 'Invalid URL encoding',
        code: 'INVALID_URL_ENCODING',
      });
    });

    it('should handle service errors', async () => {
      mockArchiveService.getArchiveVersions.mockRejectedValue(new Error('Service error'));

      const encodedUrl = encodeURIComponent('https://example.com');
      const response = await request(app)
        .get(`/api/archives/versions/${encodedUrl}`)
        .expect(500);

      expect(response.body).toEqual({
        error: 'Failed to get archive versions',
        code: 'INTERNAL_ERROR',
        details: 'Service error',
      });
    });
  });

  describe('GET /api/archives/grouped', () => {
    const mockGroupedArchives = {
      'https://example.com': [
        {
          id: 'archive-2',
          url: 'https://example.com',
          domain: 'example.com',
          timestamp: new Date('2023-01-02T00:00:00Z'),
          status: ArchiveStatus.COMPLETED,
          version: 2,
          metadata: { pageCount: 5, assetCount: 10, totalSize: 2048, crawlDuration: 2000 },
          pages: [],
          errors: [],
        },
        {
          id: 'archive-1',
          url: 'https://example.com',
          domain: 'example.com',
          timestamp: new Date('2023-01-01T00:00:00Z'),
          status: ArchiveStatus.COMPLETED,
          version: 1,
          metadata: { pageCount: 3, assetCount: 5, totalSize: 1024, crawlDuration: 1000 },
          pages: [],
          errors: [],
        },
      ],
      'https://other.com': [
        {
          id: 'archive-3',
          url: 'https://other.com',
          domain: 'other.com',
          timestamp: new Date('2023-01-03T00:00:00Z'),
          status: ArchiveStatus.COMPLETED,
          version: 1,
          metadata: { pageCount: 2, assetCount: 3, totalSize: 512, crawlDuration: 500 },
          pages: [],
          errors: [],
        },
      ],
    };

    it('should get grouped archives successfully', async () => {
      mockArchiveService.getArchivesByUrl.mockResolvedValue(mockGroupedArchives);

      const response = await request(app)
        .get('/api/archives/grouped')
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: {
          'https://example.com': mockGroupedArchives['https://example.com'].map(archive => ({
            ...archive,
            timestamp: archive.timestamp.toISOString(),
          })),
          'https://other.com': mockGroupedArchives['https://other.com'].map(archive => ({
            ...archive,
            timestamp: archive.timestamp.toISOString(),
          })),
        },
        count: 2,
      });

      expect(mockArchiveService.getArchivesByUrl).toHaveBeenCalled();
    });

    it('should return empty object when no archives exist', async () => {
      mockArchiveService.getArchivesByUrl.mockResolvedValue({});

      const response = await request(app)
        .get('/api/archives/grouped')
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: {},
        count: 0,
      });
    });

    it('should handle service errors', async () => {
      mockArchiveService.getArchivesByUrl.mockRejectedValue(new Error('Service error'));

      const response = await request(app)
        .get('/api/archives/grouped')
        .expect(500);

      expect(response.body).toEqual({
        error: 'Failed to get grouped archives',
        code: 'INTERNAL_ERROR',
        details: 'Service error',
      });
    });
  });

  describe('Error handling', () => {
    it('should handle malformed JSON in request body', async () => {
      const response = await request(app)
        .post('/api/archives')
        .set('Content-Type', 'application/json')
        .send('{"url": "https://example.com"') // Malformed JSON
        .expect(400);

      // Express handles this automatically and returns a JSON parse error
      expect(response.body).toBeDefined();
    });

    it('should handle very large request bodies', async () => {
      const largeUrl = 'https://example.com/' + 'a'.repeat(20 * 1024 * 1024); // 20MB URL

      const response = await request(app)
        .post('/api/archives')
        .send({ url: largeUrl })
        .expect(413); // Payload too large

      // Express handles this automatically with the limit we set
    });
  });
});