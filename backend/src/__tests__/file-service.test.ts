import * as fs from 'fs/promises';
import * as path from 'path';
import { FileService } from '../services/file-service';
import { Archive, ArchiveStatus, AssetType, ErrorType } from '../types';

// Mock fs module
jest.mock('fs/promises');
const mockFs = fs as jest.Mocked<typeof fs>;

describe('FileService', () => {
  let fileService: FileService;
  const testStoragePath = '/test/storage';
  const testArchiveId = 'test-archive-123';

  beforeEach(() => {
    fileService = new FileService({ baseStoragePath: testStoragePath });
    jest.clearAllMocks();
  });

  describe('initializeArchiveStorage', () => {
    it('should create archive directory structure', async () => {
      mockFs.mkdir.mockResolvedValue(undefined);

      await fileService.initializeArchiveStorage(testArchiveId);

      expect(mockFs.mkdir).toHaveBeenCalledWith(
        path.join(testStoragePath, testArchiveId),
        { recursive: true }
      );
      expect(mockFs.mkdir).toHaveBeenCalledWith(
        path.join(testStoragePath, testArchiveId, 'pages'),
        { recursive: true }
      );
      expect(mockFs.mkdir).toHaveBeenCalledWith(
        path.join(testStoragePath, testArchiveId, 'assets'),
        { recursive: true }
      );
      expect(mockFs.mkdir).toHaveBeenCalledWith(
        path.join(testStoragePath, testArchiveId, 'assets', 'css'),
        { recursive: true }
      );
    });

    it('should throw error if directory creation fails', async () => {
      mockFs.mkdir.mockRejectedValue(new Error('Permission denied'));

      await expect(fileService.initializeArchiveStorage(testArchiveId))
        .rejects.toThrow('Failed to initialize archive storage: Permission denied');
    });
  });

  describe('saveHtml', () => {
    it('should save HTML content to correct path', async () => {
      const htmlContent = '<html><body>Test</body></html>';
      const pagePath = 'index.html';
      
      mockFs.mkdir.mockResolvedValue(undefined);
      mockFs.writeFile.mockResolvedValue(undefined);

      const result = await fileService.saveHtml(htmlContent, pagePath, testArchiveId);

      expect(mockFs.mkdir).toHaveBeenCalledWith(
        path.dirname(path.join(testStoragePath, testArchiveId, 'pages', pagePath)),
        { recursive: true }
      );
      expect(mockFs.writeFile).toHaveBeenCalledWith(
        path.join(testStoragePath, testArchiveId, 'pages', pagePath),
        htmlContent,
        'utf-8'
      );
      expect(result).toBe(path.join(testStoragePath, testArchiveId, 'pages', pagePath));
    });

    it('should handle nested page paths', async () => {
      const htmlContent = '<html><body>About</body></html>';
      const pagePath = 'about/index.html';
      
      mockFs.mkdir.mockResolvedValue(undefined);
      mockFs.writeFile.mockResolvedValue(undefined);

      await fileService.saveHtml(htmlContent, pagePath, testArchiveId);

      expect(mockFs.mkdir).toHaveBeenCalledWith(
        path.join(testStoragePath, testArchiveId, 'pages', 'about'),
        { recursive: true }
      );
    });

    it('should throw error if save fails', async () => {
      mockFs.mkdir.mockResolvedValue(undefined);
      mockFs.writeFile.mockRejectedValue(new Error('Disk full'));

      await expect(fileService.saveHtml('content', 'index.html', testArchiveId))
        .rejects.toThrow('Failed to save HTML content: Disk full');
    });
  });

  describe('saveAsset', () => {
    it('should save CSS asset to correct subdirectory', async () => {
      const assetContent = Buffer.from('body { color: red; }');
      const originalUrl = 'https://example.com/styles/main.css';
      
      mockFs.mkdir.mockResolvedValue(undefined);
      mockFs.writeFile.mockResolvedValue(undefined);

      const result = await fileService.saveAsset(originalUrl, assetContent, testArchiveId, AssetType.CSS);

      expect(mockFs.writeFile).toHaveBeenCalledWith(
        path.join(testStoragePath, testArchiveId, 'assets', 'css', 'main.css'),
        assetContent
      );
      expect(result).toBe(path.join('assets', 'css', 'main.css'));
    });

    it('should save JavaScript asset to correct subdirectory', async () => {
      const assetContent = Buffer.from('console.log("test");');
      const originalUrl = 'https://example.com/js/app.js';
      
      mockFs.mkdir.mockResolvedValue(undefined);
      mockFs.writeFile.mockResolvedValue(undefined);

      const result = await fileService.saveAsset(originalUrl, assetContent, testArchiveId, AssetType.JAVASCRIPT);

      expect(result).toBe(path.join('assets', 'js', 'app.js'));
    });

    it('should save image asset to correct subdirectory', async () => {
      const assetContent = Buffer.from('fake-image-data');
      const originalUrl = 'https://example.com/images/logo.png';
      
      mockFs.mkdir.mockResolvedValue(undefined);
      mockFs.writeFile.mockResolvedValue(undefined);

      const result = await fileService.saveAsset(originalUrl, assetContent, testArchiveId, AssetType.IMAGE);

      expect(result).toBe(path.join('assets', 'images', 'logo.png'));
    });

    it('should handle URLs with query parameters', async () => {
      const assetContent = Buffer.from('image-data');
      const originalUrl = 'https://example.com/image.jpg?v=123&size=large';
      
      mockFs.mkdir.mockResolvedValue(undefined);
      mockFs.writeFile.mockResolvedValue(undefined);

      const result = await fileService.saveAsset(originalUrl, assetContent, testArchiveId, AssetType.IMAGE);

      expect(result).toMatch(/assets\/images\/image_[a-zA-Z0-9]+\.jpg/);
    });

    it('should throw error if save fails', async () => {
      mockFs.mkdir.mockResolvedValue(undefined);
      mockFs.writeFile.mockRejectedValue(new Error('Permission denied'));

      await expect(fileService.saveAsset('https://example.com/test.css', Buffer.from('test'), testArchiveId, AssetType.CSS))
        .rejects.toThrow('Failed to save asset: Permission denied');
    });
  });

  describe('getHtml', () => {
    it('should retrieve HTML content', async () => {
      const expectedContent = '<html><body>Test</body></html>';
      mockFs.readFile.mockResolvedValue(expectedContent);

      const result = await fileService.getHtml('index.html', testArchiveId);

      expect(mockFs.readFile).toHaveBeenCalledWith(
        path.join(testStoragePath, testArchiveId, 'pages', 'index.html'),
        'utf-8'
      );
      expect(result).toBe(expectedContent);
    });

    it('should throw error if file not found', async () => {
      mockFs.readFile.mockRejectedValue(new Error('File not found'));

      await expect(fileService.getHtml('missing.html', testArchiveId))
        .rejects.toThrow('Failed to retrieve HTML content: File not found');
    });
  });

  describe('getAsset', () => {
    it('should retrieve asset content', async () => {
      const expectedContent = Buffer.from('asset-data');
      mockFs.readFile.mockResolvedValue(expectedContent);

      const result = await fileService.getAsset('assets/css/main.css', testArchiveId);

      expect(mockFs.readFile).toHaveBeenCalledWith(
        path.join(testStoragePath, testArchiveId, 'assets/css/main.css')
      );
      expect(result).toBe(expectedContent);
    });

    it('should throw error if asset not found', async () => {
      mockFs.readFile.mockRejectedValue(new Error('File not found'));

      await expect(fileService.getAsset('assets/missing.css', testArchiveId))
        .rejects.toThrow('Failed to retrieve asset: File not found');
    });
  });

  describe('saveArchiveMetadata', () => {
    it('should save archive metadata as JSON', async () => {
      const archive: Archive = {
        id: testArchiveId,
        url: 'https://example.com',
        domain: 'example.com',
        timestamp: new Date('2023-01-01T00:00:00Z'),
        status: ArchiveStatus.COMPLETED,
        version: 1,
        metadata: {
          pageCount: 5,
          assetCount: 20,
          totalSize: 1024000,
          crawlDuration: 30000
        },
        pages: [],
        errors: []
      };

      mockFs.writeFile.mockResolvedValue(undefined);

      await fileService.saveArchiveMetadata(archive);

      expect(mockFs.writeFile).toHaveBeenCalledWith(
        path.join(testStoragePath, testArchiveId, 'manifest.json'),
        JSON.stringify(archive, null, 2),
        'utf-8'
      );
    });

    it('should throw error if save fails', async () => {
      const archive: Archive = {
        id: testArchiveId,
        url: 'https://example.com',
        domain: 'example.com',
        timestamp: new Date(),
        status: ArchiveStatus.COMPLETED,
        version: 1,
        metadata: {
          pageCount: 0,
          assetCount: 0,
          totalSize: 0,
          crawlDuration: 0
        },
        pages: [],
        errors: []
      };
      mockFs.writeFile.mockRejectedValue(new Error('Disk full'));

      await expect(fileService.saveArchiveMetadata(archive))
        .rejects.toThrow('Failed to save archive metadata: Disk full');
    });
  });

  describe('loadArchiveMetadata', () => {
    it('should load and parse archive metadata', async () => {
      const archiveData = {
        id: testArchiveId,
        url: 'https://example.com',
        domain: 'example.com',
        timestamp: '2023-01-01T00:00:00.000Z',
        status: ArchiveStatus.COMPLETED,
        metadata: {
          pageCount: 5,
          assetCount: 20,
          totalSize: 1024000,
          crawlDuration: 30000
        },
        pages: [{
          url: 'https://example.com',
          path: 'index.html',
          title: 'Test',
          timestamp: '2023-01-01T00:00:00.000Z',
          assets: [],
          links: []
        }],
        errors: [{
          timestamp: '2023-01-01T00:00:00.000Z',
          type: ErrorType.NETWORK_ERROR,
          message: 'Test error',
          recoverable: true
        }]
      };

      mockFs.readFile.mockResolvedValue(JSON.stringify(archiveData));

      const result = await fileService.loadArchiveMetadata(testArchiveId);

      expect(result.id).toBe(testArchiveId);
      expect(result.timestamp).toBeInstanceOf(Date);
      expect(result.pages[0].timestamp).toBeInstanceOf(Date);
      expect(result.errors[0].timestamp).toBeInstanceOf(Date);
    });

    it('should throw error if file not found', async () => {
      mockFs.readFile.mockRejectedValue(new Error('File not found'));

      await expect(fileService.loadArchiveMetadata(testArchiveId))
        .rejects.toThrow('Failed to load archive metadata: File not found');
    });
  });

  describe('listArchives', () => {
    it('should return list of archive directories', async () => {
      const mockEntries = [
        { name: 'archive-1', isDirectory: () => true },
        { name: 'archive-2', isDirectory: () => true },
        { name: 'file.txt', isDirectory: () => false }
      ];

      mockFs.readdir.mockResolvedValue(mockEntries as any);

      const result = await fileService.listArchives();

      expect(result).toEqual(['archive-1', 'archive-2']);
    });

    it('should return empty array if storage directory does not exist', async () => {
      const error = new Error('Directory not found');
      (error as any).code = 'ENOENT';
      mockFs.readdir.mockRejectedValue(error);

      const result = await fileService.listArchives();

      expect(result).toEqual([]);
    });

    it('should throw error for other readdir failures', async () => {
      mockFs.readdir.mockRejectedValue(new Error('Permission denied'));

      await expect(fileService.listArchives())
        .rejects.toThrow('Failed to list archives: Permission denied');
    });
  });

  describe('deleteArchive', () => {
    it('should delete archive directory', async () => {
      mockFs.rm.mockResolvedValue(undefined);

      await fileService.deleteArchive(testArchiveId);

      expect(mockFs.rm).toHaveBeenCalledWith(
        path.join(testStoragePath, testArchiveId),
        { recursive: true, force: true }
      );
    });

    it('should throw error if deletion fails', async () => {
      mockFs.rm.mockRejectedValue(new Error('Permission denied'));

      await expect(fileService.deleteArchive(testArchiveId))
        .rejects.toThrow('Failed to delete archive: Permission denied');
    });
  });

  describe('archiveExists', () => {
    it('should return true if archive exists', async () => {
      mockFs.access.mockResolvedValue(undefined);

      const result = await fileService.archiveExists(testArchiveId);

      expect(result).toBe(true);
      expect(mockFs.access).toHaveBeenCalledWith(
        path.join(testStoragePath, testArchiveId)
      );
    });

    it('should return false if archive does not exist', async () => {
      mockFs.access.mockRejectedValue(new Error('File not found'));

      const result = await fileService.archiveExists(testArchiveId);

      expect(result).toBe(false);
    });
  });

  describe('rewriteUrls', () => {
    const baseUrl = 'https://example.com';
    const html = `
      <html>
        <head>
          <link rel="stylesheet" href="https://example.com/styles.css">
          <link rel="stylesheet" href="/local/styles.css">
        </head>
        <body>
          <img src="https://example.com/image.jpg" alt="test">
          <img src="/local/image.jpg" alt="local">
          <script src="https://example.com/script.js"></script>
          <script src="/local/script.js"></script>
        </body>
      </html>
    `;

    it('should rewrite same-domain URLs to local archive paths', () => {
      const result = fileService.rewriteUrls(html, baseUrl, testArchiveId);

      expect(result).toContain(`/api/archives/${testArchiveId}/content/assets/css/styles.css`);
      expect(result).toContain(`/api/archives/${testArchiveId}/content/assets/images/image.jpg`);
      expect(result).toContain(`/api/archives/${testArchiveId}/content/assets/js/script.js`);
      
      // Local URLs should be rewritten as same-domain
      expect(result).toContain(`/api/archives/${testArchiveId}/content/assets/css/styles.css`);
      expect(result).toContain(`/api/archives/${testArchiveId}/content/assets/images/image.jpg`);
      expect(result).toContain(`/api/archives/${testArchiveId}/content/assets/js/script.js`);
    });

    it('should handle empty HTML', () => {
      const result = fileService.rewriteUrls('', baseUrl, testArchiveId);
      expect(result).toBe('');
    });

    it('should use asset mappings when provided', () => {
      const mappings = [{
        originalUrl: 'https://example.com/styles.css',
        localPath: 'assets/css/custom-styles.css',
        assetType: 'css' as any,
      }];

      const result = fileService.rewriteUrls(html, baseUrl, testArchiveId, mappings);
      expect(result).toContain(`/api/archives/${testArchiveId}/content/assets/css/custom-styles.css`);
    });
  });

  describe('rewriteCssUrls', () => {
    const baseUrl = 'https://example.com';
    const css = `
      @import url("https://example.com/fonts.css");
      body {
        background-image: url("https://example.com/bg.jpg");
      }
    `;

    it('should rewrite CSS URLs to local archive paths', () => {
      const result = fileService.rewriteCssUrls(css, baseUrl, testArchiveId);

      expect(result).toContain(`/api/archives/${testArchiveId}/content/assets/css/fonts.css`);
      expect(result).toContain(`url("/api/archives/${testArchiveId}/content/assets/images/bg.jpg")`);
    });

    it('should handle empty CSS', () => {
      const result = fileService.rewriteCssUrls('', baseUrl, testArchiveId);
      expect(result).toBe('');
    });

    it('should use asset mappings when provided', () => {
      const mappings = [{
        originalUrl: 'https://example.com/bg.jpg',
        localPath: 'assets/images/custom-bg.jpg',
        assetType: 'image' as any,
      }];

      const result = fileService.rewriteCssUrls(css, baseUrl, testArchiveId, mappings);
      expect(result).toContain(`url("/api/archives/${testArchiveId}/content/assets/images/custom-bg.jpg")`);
    });
  });
});