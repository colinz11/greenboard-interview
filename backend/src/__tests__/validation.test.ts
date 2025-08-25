import {
  validateArchive,
  validateArchivedPage,
  validateAsset,
  createArchive,
} from '../utils/validation';
import { Archive, ArchivedPage, Asset, ArchiveStatus, AssetType, ErrorType } from '../types';

describe('Data Model Validation', () => {
  describe('validateArchive', () => {
    const validArchive: Archive = {
      id: 'test-archive-1',
      url: 'https://example.com',
      domain: 'example.com',
      timestamp: new Date(),
      status: ArchiveStatus.COMPLETED,
      version: 1,
      metadata: {
        pageCount: 5,
        assetCount: 20,
        totalSize: 1024000,
        crawlDuration: 30000,
      },
      pages: [],
      errors: [],
    };

    it('should return no errors for valid archive', () => {
      const errors = validateArchive(validArchive);
      expect(errors).toHaveLength(0);
    });

    it('should return error for null/undefined archive', () => {
      expect(validateArchive(null)).toContain('Archive object is required');
      expect(validateArchive(undefined)).toContain('Archive object is required');
    });

    it('should validate required string fields', () => {
      const invalidArchive = { ...validArchive, id: '' };
      expect(validateArchive(invalidArchive)).toContain('Archive ID must be a non-empty string');

      const invalidArchive2 = { ...validArchive, url: 'invalid-url' };
      expect(validateArchive(invalidArchive2)).toContain('Archive URL must be a valid HTTP/HTTPS URL');

      const invalidArchive3 = { ...validArchive, domain: '' };
      expect(validateArchive(invalidArchive3)).toContain('Archive domain must be a non-empty string');
    });

    it('should validate domain matches URL', () => {
      const invalidArchive = { ...validArchive, domain: 'other.com' };
      expect(validateArchive(invalidArchive)).toContain('Archive domain must match the URL domain');
    });

    it('should validate timestamp is Date object', () => {
      const invalidArchive = { ...validArchive, timestamp: 'not-a-date' };
      expect(validateArchive(invalidArchive)).toContain('Archive timestamp must be a valid Date object');
    });

    it('should validate status is valid enum value', () => {
      const invalidArchive = { ...validArchive, status: 'invalid-status' as any };
      expect(validateArchive(invalidArchive)).toContain('Archive status must be a valid ArchiveStatus enum value');
    });

    it('should validate metadata fields', () => {
      const invalidArchive = {
        ...validArchive,
        metadata: {
          pageCount: -1,
          assetCount: 'not-a-number' as any,
          totalSize: -100,
          crawlDuration: 'invalid' as any,
        },
      };
      const errors = validateArchive(invalidArchive);
      expect(errors).toContain('Metadata pageCount must be a non-negative number');
      expect(errors).toContain('Metadata assetCount must be a non-negative number');
      expect(errors).toContain('Metadata totalSize must be a non-negative number');
      expect(errors).toContain('Metadata crawlDuration must be a non-negative number');
    });

    it('should validate pages array', () => {
      const invalidArchive = { ...validArchive, pages: 'not-an-array' as any };
      expect(validateArchive(invalidArchive)).toContain('Archive pages must be an array');
    });

    it('should validate errors array', () => {
      const invalidArchive = { ...validArchive, errors: 'not-an-array' as any };
      expect(validateArchive(invalidArchive)).toContain('Archive errors must be an array');
    });
  });

  describe('validateArchivedPage', () => {
    const validPage: ArchivedPage = {
      url: 'https://example.com/page',
      path: '/page',
      title: 'Test Page',
      timestamp: new Date(),
      assets: [],
      links: ['https://example.com/other'],
    };

    it('should return no errors for valid page', () => {
      const errors = validateArchivedPage(validPage);
      expect(errors).toHaveLength(0);
    });

    it('should return error for null/undefined page', () => {
      expect(validateArchivedPage(null)).toContain('ArchivedPage object is required');
      expect(validateArchivedPage(undefined)).toContain('ArchivedPage object is required');
    });

    it('should validate required fields', () => {
      const invalidPage1 = { ...validPage, url: 'invalid-url' };
      expect(validateArchivedPage(invalidPage1)).toContain('ArchivedPage URL must be a valid HTTP/HTTPS URL');

      const invalidPage2 = { ...validPage, path: '' };
      expect(validateArchivedPage(invalidPage2)).toContain('ArchivedPage path must be a non-empty string');

      const invalidPage3 = { ...validPage, title: '' };
      expect(validateArchivedPage(invalidPage3)).toContain('ArchivedPage title must be a non-empty string');

      const invalidPage4 = { ...validPage, timestamp: 'not-a-date' };
      expect(validateArchivedPage(invalidPage4)).toContain('ArchivedPage timestamp must be a valid Date object');
    });

    it('should validate assets array', () => {
      const invalidPage = { ...validPage, assets: 'not-an-array' as any };
      expect(validateArchivedPage(invalidPage)).toContain('ArchivedPage assets must be an array');
    });

    it('should validate links array', () => {
      const invalidPage1 = { ...validPage, links: 'not-an-array' as any };
      expect(validateArchivedPage(invalidPage1)).toContain('ArchivedPage links must be an array');

      const invalidPage2 = { ...validPage, links: ['invalid-url'] };
      expect(validateArchivedPage(invalidPage2)).toContain('Link 0: must be a valid URL');
    });
  });

  describe('validateAsset', () => {
    const validAsset: Asset = {
      originalUrl: 'https://example.com/style.css',
      localPath: '/assets/css/style.css',
      type: AssetType.CSS,
      size: 1024,
      contentType: 'text/css',
    };

    it('should return no errors for valid asset', () => {
      const errors = validateAsset(validAsset);
      expect(errors).toHaveLength(0);
    });

    it('should return error for null/undefined asset', () => {
      expect(validateAsset(null)).toContain('Asset object is required');
      expect(validateAsset(undefined)).toContain('Asset object is required');
    });

    it('should validate required fields', () => {
      const invalidAsset1 = { ...validAsset, originalUrl: 'invalid-url' };
      expect(validateAsset(invalidAsset1)).toContain('Asset originalUrl must be a valid HTTP/HTTPS URL');

      const invalidAsset2 = { ...validAsset, localPath: '' };
      expect(validateAsset(invalidAsset2)).toContain('Asset localPath must be a non-empty string');

      const invalidAsset3 = { ...validAsset, type: 'invalid-type' as any };
      expect(validateAsset(invalidAsset3)).toContain('Asset type must be a valid AssetType enum value');

      const invalidAsset4 = { ...validAsset, size: -1 };
      expect(validateAsset(invalidAsset4)).toContain('Asset size must be a non-negative number');

      const invalidAsset5 = { ...validAsset, contentType: '' };
      expect(validateAsset(invalidAsset5)).toContain('Asset contentType must be a non-empty string');
    });
  });

  describe('createArchive', () => {
    it('should create valid archive with required fields', () => {
      const archive = createArchive('https://example.com');
      
      expect(archive.id).toBeDefined();
      expect(archive.url).toBe('https://example.com');
      expect(archive.domain).toBe('example.com');
      expect(archive.timestamp).toBeInstanceOf(Date);
      expect(archive.status).toBe(ArchiveStatus.IN_PROGRESS);
      expect(archive.metadata).toEqual({
        pageCount: 0,
        assetCount: 0,
        totalSize: 0,
        crawlDuration: 0,
      });
      expect(archive.pages).toEqual([]);
      expect(archive.errors).toEqual([]);
    });

    it('should use provided ID when given', () => {
      const customId = 'custom-archive-id';
      const archive = createArchive('https://example.com', customId);
      expect(archive.id).toBe(customId);
    });

    it('should throw error for invalid URL', () => {
      expect(() => createArchive('invalid-url')).toThrow('Invalid URL provided');
    });

    it('should throw error when domain cannot be extracted', () => {
      // This is a bit contrived since URL constructor would fail first,
      // but testing the logic path
      expect(() => createArchive('not-a-url')).toThrow('Invalid URL provided');
    });

    it('should generate unique IDs', () => {
      const archive1 = createArchive('https://example.com');
      const archive2 = createArchive('https://example.com');
      expect(archive1.id).not.toBe(archive2.id);
    });
  });
});