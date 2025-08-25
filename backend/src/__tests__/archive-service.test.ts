import { ArchiveService, ArchiveServiceOptions } from '../services/archive-service';
import { ArchiveStatus, ErrorType, AssetType } from '../types';
import { FileService } from '../services/file-service';
import { CrawlerService } from '../services/crawler-service';
import * as fs from 'fs/promises';
import * as path from 'path';
import { tmpdir } from 'os';

describe('ArchiveService', () => {
  let archiveService: ArchiveService;
  let tempDir: string;
  let mockCrawlerService: jest.Mocked<CrawlerService>;
  let mockFileService: jest.Mocked<FileService>;

  beforeEach(async () => {
    // Create temporary directory for testing
    tempDir = await fs.mkdtemp(path.join(tmpdir(), 'archive-test-'));
    
    // Create mock services
    mockFileService = {
      initializeArchiveStorage: jest.fn().mockResolvedValue(undefined),
      saveArchiveMetadata: jest.fn().mockResolvedValue(undefined),
      loadArchiveMetadata: jest.fn(),
      listArchives: jest.fn().mockResolvedValue([]),
      deleteArchive: jest.fn().mockResolvedValue(undefined),
      archiveExists: jest.fn().mockResolvedValue(true),
      saveHtml: jest.fn().mockResolvedValue('path/to/file.html'),
      saveAsset: jest.fn().mockResolvedValue('assets/css/style.css'),
      getHtml: jest.fn(),
      getAsset: jest.fn(),
      getArchiveSize: jest.fn().mockResolvedValue(1024),
      rewriteUrls: jest.fn(),
      rewriteCssUrls: jest.fn(),
    } as any;

    mockCrawlerService = {
      initialize: jest.fn().mockResolvedValue(undefined),
      cleanup: jest.fn().mockResolvedValue(undefined),
      crawlSite: jest.fn().mockResolvedValue({
        pages: [
          {
            url: 'https://example.com',
            path: 'index.html',
            title: 'Example Site',
            timestamp: new Date(),
            assets: [
              {
                originalUrl: 'https://example.com/style.css',
                localPath: 'assets/css/style.css',
                type: AssetType.CSS,
                size: 1024,
                contentType: 'text/css',
              },
            ],
            links: ['https://example.com/about'],
          },
        ],
        errors: [],
        totalSize: 2048,
        duration: 1000,
      }),
      extractLinksFromHtml: jest.fn(),
      extractLinks: jest.fn(),
      isValidUrl: jest.fn(),
    } as any;
    
    const options: ArchiveServiceOptions = {
      storageBasePath: tempDir,
      maxConcurrentArchives: 2,
      defaultCrawlerOptions: {
        maxDepth: 2,
        maxPages: 10,
        timeout: 5000,
        respectRobots: false,
      },
    };

    archiveService = new ArchiveService(options, mockFileService, mockCrawlerService);


  });

  afterEach(async () => {
    // Clean up temporary directory
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('createArchive', () => {
    it('should create a new archive successfully', async () => {
      const url = 'https://example.com';
      
      const archive = await archiveService.createArchive(url);

      expect(archive).toBeDefined();
      expect(archive.url).toBe(url);
      expect(archive.domain).toBe('example.com');
      expect(archive.status).toBe(ArchiveStatus.IN_PROGRESS);
      expect(archive.id).toBeDefined();
      expect(mockFileService.initializeArchiveStorage).toHaveBeenCalledWith(archive.id);
      expect(mockFileService.saveArchiveMetadata).toHaveBeenCalledWith(archive);
    });

    it('should reject invalid URLs', async () => {
      const invalidUrl = 'not-a-url';
      
      await expect(archiveService.createArchive(invalidUrl)).rejects.toThrow('Invalid URL');
    });

    it('should enforce concurrent archive limits', async () => {
      const url1 = 'https://example1.com';
      const url2 = 'https://example2.com';
      const url3 = 'https://example3.com';

      // Create two archives (should succeed)
      await archiveService.createArchive(url1);
      await archiveService.createArchive(url2);

      // Third archive should fail due to limit
      await expect(archiveService.createArchive(url3)).rejects.toThrow(
        'Maximum concurrent archives limit reached'
      );
    });

    it('should prevent duplicate archives for the same URL', async () => {
      const url = 'https://example.com';
      
      // Create first archive
      await archiveService.createArchive(url);
      
      // Attempt to create second archive for same URL should fail
      await expect(archiveService.createArchive(url)).rejects.toThrow(
        'Archive for https://example.com is already in progress'
      );
    });

    it('should handle storage initialization failure', async () => {
      const url = 'https://example.com';
      mockFileService.initializeArchiveStorage.mockRejectedValueOnce(
        new Error('Storage initialization failed')
      );

      await expect(archiveService.createArchive(url)).rejects.toThrow(
        'Failed to create archive: Storage initialization failed'
      );
    });
  });

  describe('getArchive', () => {
    it('should retrieve an existing archive', async () => {
      const archiveId = 'test-archive-id';
      const mockArchive = {
        id: archiveId,
        url: 'https://example.com',
        domain: 'example.com',
        timestamp: new Date(),
        status: ArchiveStatus.COMPLETED,
        version: 1,
        metadata: {
          pageCount: 1,
          assetCount: 1,
          totalSize: 2048,
          crawlDuration: 1000,
        },
        pages: [],
        errors: [],
      };

      mockFileService.loadArchiveMetadata.mockResolvedValueOnce(mockArchive);

      const result = await archiveService.getArchive(archiveId);

      expect(result).toEqual(mockArchive);
      expect(mockFileService.loadArchiveMetadata).toHaveBeenCalledWith(archiveId);
    });

    it('should handle non-existent archive', async () => {
      const archiveId = 'non-existent';
      mockFileService.loadArchiveMetadata.mockRejectedValueOnce(
        new Error('Archive not found')
      );

      await expect(archiveService.getArchive(archiveId)).rejects.toThrow(
        'Archive not found'
      );
    });
  });

  describe('getArchives', () => {
    it('should list all archives sorted by timestamp', async () => {
      const archive1 = {
        id: 'archive-1',
        url: 'https://example1.com',
        domain: 'example1.com',
        timestamp: new Date('2023-01-01'),
        status: ArchiveStatus.COMPLETED,
        version: 1,
        metadata: { pageCount: 1, assetCount: 1, totalSize: 1024, crawlDuration: 500 },
        pages: [],
        errors: [],
      };

      const archive2 = {
        id: 'archive-2',
        url: 'https://example2.com',
        domain: 'example2.com',
        timestamp: new Date('2023-01-02'),
        status: ArchiveStatus.COMPLETED,
        version: 1,
        metadata: { pageCount: 2, assetCount: 2, totalSize: 2048, crawlDuration: 1000 },
        pages: [],
        errors: [],
      };

      mockFileService.listArchives.mockResolvedValueOnce(['archive-1', 'archive-2']);
      mockFileService.loadArchiveMetadata
        .mockResolvedValueOnce(archive1)
        .mockResolvedValueOnce(archive2);

      const result = await archiveService.getArchives();

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual(archive2); // Newer first
      expect(result[1]).toEqual(archive1);
    });

    it('should handle corrupted archive metadata gracefully', async () => {
      const validArchive = {
        id: 'valid-archive',
        url: 'https://example.com',
        domain: 'example.com',
        timestamp: new Date(),
        status: ArchiveStatus.COMPLETED,
        version: 1,
        metadata: { pageCount: 1, assetCount: 1, totalSize: 1024, crawlDuration: 500 },
        pages: [],
        errors: [],
      };

      mockFileService.listArchives.mockResolvedValueOnce(['valid-archive', 'corrupted-archive']);
      mockFileService.loadArchiveMetadata
        .mockResolvedValueOnce(validArchive)
        .mockRejectedValueOnce(new Error('Corrupted metadata'));

      const result = await archiveService.getArchives();

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(validArchive);
    });
  });

  describe('deleteArchive', () => {
    it('should delete an archive successfully', async () => {
      const archiveId = 'test-archive';

      await archiveService.deleteArchive(archiveId);

      expect(mockFileService.deleteArchive).toHaveBeenCalledWith(archiveId);
    });

    it('should prevent deletion of active archives', async () => {
      const url = 'https://example.com';
      const archive = await archiveService.createArchive(url);

      await expect(archiveService.deleteArchive(archive.id)).rejects.toThrow(
        'Cannot delete archive'
      );
    });

    it('should handle deletion errors', async () => {
      const archiveId = 'test-archive';
      mockFileService.deleteArchive.mockRejectedValueOnce(
        new Error('Deletion failed')
      );

      await expect(archiveService.deleteArchive(archiveId)).rejects.toThrow(
        'Failed to delete archive: Deletion failed'
      );
    });
  });

  describe('progress tracking', () => {
    it('should track archive progress', async () => {
      const url = 'https://example.com';
      const archive = await archiveService.createArchive(url);

      const progress = archiveService.getArchiveProgress(archive.id);

      expect(progress).toBeDefined();
      expect(progress?.archiveId).toBe(archive.id);
      expect(progress?.status).toBe(ArchiveStatus.IN_PROGRESS);
      expect(progress?.progress).toBeDefined();
      expect(progress?.startTime).toBeDefined();
    });

    it('should return null for non-existent archive progress', () => {
      const progress = archiveService.getArchiveProgress('non-existent');
      expect(progress).toBeNull();
    });

    it('should list all active archives', async () => {
      const url1 = 'https://example1.com';
      const url2 = 'https://example2.com';
      
      await archiveService.createArchive(url1);
      await archiveService.createArchive(url2);

      const activeArchives = archiveService.getActiveArchives();

      expect(activeArchives).toHaveLength(2);
      expect(activeArchives.every(a => a.status === ArchiveStatus.IN_PROGRESS)).toBe(true);
    });
  });

  describe('archiveExists', () => {
    it('should check if archive exists', async () => {
      const archiveId = 'test-archive';
      mockFileService.archiveExists.mockResolvedValueOnce(true);

      const exists = await archiveService.archiveExists(archiveId);

      expect(exists).toBe(true);
      expect(mockFileService.archiveExists).toHaveBeenCalledWith(archiveId);
    });
  });

  describe('getArchivedContent', () => {
    it('should retrieve HTML content', async () => {
      const archiveId = 'test-archive';
      const contentPath = 'index.html';
      const htmlContent = '<html><body>Test</body></html>';

      mockFileService.getHtml.mockResolvedValueOnce(htmlContent);

      const result = await archiveService.getArchivedContent(archiveId, contentPath);

      expect(result.content).toBe(htmlContent);
      expect(result.contentType).toBe('text/html; charset=utf-8');
      expect(mockFileService.getHtml).toHaveBeenCalledWith(contentPath, archiveId);
    });

    it('should retrieve asset content', async () => {
      const archiveId = 'test-archive';
      const contentPath = 'assets/css/style.css';
      const assetContent = Buffer.from('body { color: red; }');

      mockFileService.getAsset.mockResolvedValueOnce(assetContent);

      const result = await archiveService.getArchivedContent(archiveId, contentPath);

      expect(result.content).toBe(assetContent);
      expect(result.contentType).toBe('text/css');
      expect(mockFileService.getAsset).toHaveBeenCalledWith(contentPath, archiveId);
    });

    it('should handle default HTML path', async () => {
      const archiveId = 'test-archive';
      const htmlContent = '<html><body>Home</body></html>';

      mockFileService.getHtml.mockResolvedValueOnce(htmlContent);

      const result = await archiveService.getArchivedContent(archiveId, '');

      expect(mockFileService.getHtml).toHaveBeenCalledWith('index.html', archiveId);
    });

    it('should handle content retrieval errors', async () => {
      const archiveId = 'test-archive';
      const contentPath = 'missing.html';

      mockFileService.getHtml.mockRejectedValueOnce(new Error('File not found'));

      await expect(
        archiveService.getArchivedContent(archiveId, contentPath)
      ).rejects.toThrow('Failed to get archived content');
    });
  });

  describe('error handling and recovery', () => {
    it('should handle timeout errors as partial archives', async () => {
      const url = 'https://example.com';
      mockCrawlerService.crawlSite.mockRejectedValueOnce(
        new Error('Network timeout')
      );

      const archive = await archiveService.createArchive(url);

      // Wait a bit for async processing
      await new Promise(resolve => setTimeout(resolve, 100));

      const progress = archiveService.getArchiveProgress(archive.id);
      // Timeout errors should result in PARTIAL status, not FAILED
      expect(progress?.status).toBe(ArchiveStatus.PARTIAL);
      expect(progress?.errors).toContainEqual(
        expect.objectContaining({
          type: ErrorType.TIMEOUT_ERROR,
          message: expect.stringContaining('Archive partially completed due to timeout'),
        })
      );
    });

    it('should handle non-timeout crawler failures as failed archives', async () => {
      const url = 'https://example.com';
      mockCrawlerService.crawlSite.mockRejectedValueOnce(
        new Error('Connection refused')
      );

      const archive = await archiveService.createArchive(url);

      // Wait a bit for async processing
      await new Promise(resolve => setTimeout(resolve, 100));

      const progress = archiveService.getArchiveProgress(archive.id);
      expect(progress?.status).toBe(ArchiveStatus.FAILED);
      expect(progress?.errors).toContainEqual(
        expect.objectContaining({
          type: ErrorType.NETWORK_ERROR,
          message: expect.stringContaining('Archive failed'),
        })
      );
    });

    it('should handle partial failures during asset download', async () => {
      const url = 'https://example.com';
      
      // Mock crawler to return pages with assets
      mockCrawlerService.crawlSite.mockResolvedValueOnce({
        pages: [
          {
            url: 'https://example.com',
            path: 'index.html',
            title: 'Example',
            timestamp: new Date(),
            assets: [
              {
                originalUrl: 'https://example.com/good-asset.css',
                localPath: 'assets/css/good.css',
                type: AssetType.CSS,
                size: 1024,
                contentType: 'text/css',
              },
              {
                originalUrl: 'https://example.com/bad-asset.css',
                localPath: 'assets/css/bad.css',
                type: AssetType.CSS,
                size: 1024,
                contentType: 'text/css',
              },
            ],
            links: [],
          },
        ],
        errors: [],
        totalSize: 2048,
        duration: 1000,
      });

      // Mock asset saving to fail for one asset
      mockFileService.saveAsset
        .mockResolvedValueOnce('assets/css/good.css')
        .mockRejectedValueOnce(new Error('Storage full'));

      const archive = await archiveService.createArchive(url);

      // Wait for async processing
      await new Promise(resolve => setTimeout(resolve, 200));

      const progress = archiveService.getArchiveProgress(archive.id);
      expect(progress?.errors).toContainEqual(
        expect.objectContaining({
          type: ErrorType.STORAGE_ERROR,
          message: expect.stringContaining('Failed to download asset'),
          recoverable: true,
        })
      );
    });
  });

  describe('concurrent archiving safety', () => {
    it('should handle multiple archives concurrently', async () => {
      const url1 = 'https://example1.com';
      const url2 = 'https://example2.com';

      const [archive1, archive2] = await Promise.all([
        archiveService.createArchive(url1),
        archiveService.createArchive(url2),
      ]);

      expect(archive1.id).not.toBe(archive2.id);
      expect(archive1.url).toBe(url1);
      expect(archive2.url).toBe(url2);

      const activeArchives = archiveService.getActiveArchives();
      expect(activeArchives).toHaveLength(2);
    });

    it('should prevent resource conflicts between concurrent archives', async () => {
      const url1 = 'https://example1.com';
      const url2 = 'https://example2.com';

      await Promise.all([
        archiveService.createArchive(url1),
        archiveService.createArchive(url2),
      ]);

      // Verify that each archive gets its own storage initialization
      expect(mockFileService.initializeArchiveStorage).toHaveBeenCalledTimes(2);
      
      const calls = mockFileService.initializeArchiveStorage.mock.calls;
      expect(calls[0][0]).not.toBe(calls[1][0]); // Different archive IDs
    });
  });

  describe('versioning functionality', () => {
    describe('getArchiveVersions', () => {
      it('should return versions for a specific URL sorted by version desc', async () => {
        const archive1 = {
          id: 'archive-1',
          url: 'https://example.com',
          domain: 'example.com',
          timestamp: new Date('2023-01-01'),
          status: ArchiveStatus.COMPLETED,
          version: 1,
          metadata: { pageCount: 1, assetCount: 1, totalSize: 1024, crawlDuration: 500 },
          pages: [],
          errors: [],
        };

        const archive2 = {
          id: 'archive-2',
          url: 'https://example.com',
          domain: 'example.com',
          timestamp: new Date('2023-01-02'),
          status: ArchiveStatus.COMPLETED,
          version: 2,
          metadata: { pageCount: 2, assetCount: 2, totalSize: 2048, crawlDuration: 1000 },
          pages: [],
          errors: [],
        };

        const archive3 = {
          id: 'archive-3',
          url: 'https://other.com',
          domain: 'other.com',
          timestamp: new Date('2023-01-03'),
          status: ArchiveStatus.COMPLETED,
          version: 1,
          metadata: { pageCount: 1, assetCount: 1, totalSize: 1024, crawlDuration: 500 },
          pages: [],
          errors: [],
        };

        mockFileService.listArchives.mockResolvedValueOnce(['archive-1', 'archive-2', 'archive-3']);
        mockFileService.loadArchiveMetadata
          .mockResolvedValueOnce(archive1)
          .mockResolvedValueOnce(archive2)
          .mockResolvedValueOnce(archive3);

        const result = await archiveService.getArchiveVersions('https://example.com');

        expect(result).toHaveLength(2);
        expect(result[0]).toEqual(archive2); // Version 2 first
        expect(result[1]).toEqual(archive1); // Version 1 second
      });

      it('should return empty array for URL with no versions', async () => {
        mockFileService.listArchives.mockResolvedValueOnce([]);

        const result = await archiveService.getArchiveVersions('https://nonexistent.com');

        expect(result).toEqual([]);
      });

      it('should throw error for invalid URL', async () => {
        await expect(archiveService.getArchiveVersions('invalid-url')).rejects.toThrow('Invalid URL');
      });
    });

    describe('getArchivesByUrl', () => {
      it('should group archives by URL with versions sorted', async () => {
        const archive1 = {
          id: 'archive-1',
          url: 'https://example.com',
          domain: 'example.com',
          timestamp: new Date('2023-01-01'),
          status: ArchiveStatus.COMPLETED,
          version: 1,
          metadata: { pageCount: 1, assetCount: 1, totalSize: 1024, crawlDuration: 500 },
          pages: [],
          errors: [],
        };

        const archive2 = {
          id: 'archive-2',
          url: 'https://example.com',
          domain: 'example.com',
          timestamp: new Date('2023-01-02'),
          status: ArchiveStatus.COMPLETED,
          version: 2,
          metadata: { pageCount: 2, assetCount: 2, totalSize: 2048, crawlDuration: 1000 },
          pages: [],
          errors: [],
        };

        const archive3 = {
          id: 'archive-3',
          url: 'https://other.com',
          domain: 'other.com',
          timestamp: new Date('2023-01-03'),
          status: ArchiveStatus.COMPLETED,
          version: 1,
          metadata: { pageCount: 1, assetCount: 1, totalSize: 1024, crawlDuration: 500 },
          pages: [],
          errors: [],
        };

        mockFileService.listArchives.mockResolvedValueOnce(['archive-1', 'archive-2', 'archive-3']);
        mockFileService.loadArchiveMetadata
          .mockResolvedValueOnce(archive1)
          .mockResolvedValueOnce(archive2)
          .mockResolvedValueOnce(archive3);

        const result = await archiveService.getArchivesByUrl();

        expect(result).toEqual({
          'https://example.com': [archive2, archive1], // Sorted by version desc
          'https://other.com': [archive3]
        });
      });
    });

    describe('getLatestVersionNumber', () => {
      it('should return latest version number for URL', async () => {
        const archive1 = {
          id: 'archive-1',
          url: 'https://example.com',
          domain: 'example.com',
          timestamp: new Date('2023-01-01'),
          status: ArchiveStatus.COMPLETED,
          version: 1,
          metadata: { pageCount: 1, assetCount: 1, totalSize: 1024, crawlDuration: 500 },
          pages: [],
          errors: [],
        };

        const archive2 = {
          id: 'archive-2',
          url: 'https://example.com',
          domain: 'example.com',
          timestamp: new Date('2023-01-02'),
          status: ArchiveStatus.COMPLETED,
          version: 3,
          metadata: { pageCount: 2, assetCount: 2, totalSize: 2048, crawlDuration: 1000 },
          pages: [],
          errors: [],
        };

        mockFileService.listArchives.mockResolvedValueOnce(['archive-1', 'archive-2']);
        mockFileService.loadArchiveMetadata
          .mockResolvedValueOnce(archive1)
          .mockResolvedValueOnce(archive2);

        const result = await archiveService.getLatestVersionNumber('https://example.com');

        expect(result).toBe(3);
      });

      it('should return 0 for URL with no versions', async () => {
        mockFileService.listArchives.mockResolvedValueOnce([]);

        const result = await archiveService.getLatestVersionNumber('https://nonexistent.com');

        expect(result).toBe(0);
      });
    });

    describe('createArchive with versioning', () => {
      it('should assign correct version number to new archive', async () => {
        const url = 'https://example.com';
        
        // Mock existing archive with version 2
        const existingArchive = {
          id: 'existing-archive',
          url: 'https://example.com',
          domain: 'example.com',
          timestamp: new Date('2023-01-01'),
          status: ArchiveStatus.COMPLETED,
          version: 2,
          metadata: { pageCount: 1, assetCount: 1, totalSize: 1024, crawlDuration: 500 },
          pages: [],
          errors: [],
        };

        mockFileService.listArchives.mockResolvedValueOnce(['existing-archive']);
        mockFileService.loadArchiveMetadata.mockResolvedValueOnce(existingArchive);

        const newArchive = await archiveService.createArchive(url);

        expect(newArchive.version).toBe(3); // Should be next version
        expect(newArchive.url).toBe(url);
      });

      it('should assign version 1 to first archive of a URL', async () => {
        const url = 'https://newsite.com';
        
        mockFileService.listArchives.mockResolvedValueOnce([]);

        const newArchive = await archiveService.createArchive(url);

        expect(newArchive.version).toBe(1); // Should be first version
        expect(newArchive.url).toBe(url);
      });
    });
  });
});