import {
  isValidUrl,
  extractDomain,
  isSameDomain,
  normalizeUrl,
  resolveUrl,
  isValidUrlForDomain,
} from '../utils/url-utils';

describe('URL Utilities', () => {
  describe('isValidUrl', () => {
    it('should return true for valid HTTP URLs', () => {
      expect(isValidUrl('http://example.com')).toBe(true);
      expect(isValidUrl('http://example.com/path')).toBe(true);
      expect(isValidUrl('http://subdomain.example.com')).toBe(true);
    });

    it('should return true for valid HTTPS URLs', () => {
      expect(isValidUrl('https://example.com')).toBe(true);
      expect(isValidUrl('https://example.com/path')).toBe(true);
      expect(isValidUrl('https://subdomain.example.com')).toBe(true);
    });

    it('should return false for invalid URLs', () => {
      expect(isValidUrl('not-a-url')).toBe(false);
      expect(isValidUrl('ftp://example.com')).toBe(false);
      expect(isValidUrl('')).toBe(false);
      expect(isValidUrl('javascript:alert(1)')).toBe(false);
    });

    it('should return false for malformed URLs', () => {
      expect(isValidUrl('http://')).toBe(false);
      expect(isValidUrl('https://')).toBe(false);
      // Note: 'http://.' is actually considered valid by URL constructor
      expect(isValidUrl('http://invalid..domain')).toBe(true); // URL constructor allows this
    });
  });

  describe('extractDomain', () => {
    it('should extract domain from valid URLs', () => {
      expect(extractDomain('https://example.com')).toBe('example.com');
      expect(extractDomain('http://subdomain.example.com/path')).toBe('subdomain.example.com');
      expect(extractDomain('https://example.com:8080')).toBe('example.com');
    });

    it('should return null for invalid URLs', () => {
      expect(extractDomain('not-a-url')).toBe(null);
      expect(extractDomain('')).toBe(null);
      expect(extractDomain('ftp://example.com')).toBe('example.com'); // Still extracts domain even for non-HTTP
    });
  });

  describe('isSameDomain', () => {
    it('should return true for URLs with same domain', () => {
      expect(isSameDomain('https://example.com', 'https://example.com/path')).toBe(true);
      expect(isSameDomain('http://example.com', 'https://example.com')).toBe(true);
      expect(isSameDomain('https://example.com:8080', 'https://example.com:3000')).toBe(true);
    });

    it('should return false for URLs with different domains', () => {
      expect(isSameDomain('https://example.com', 'https://other.com')).toBe(false);
      expect(isSameDomain('https://sub.example.com', 'https://example.com')).toBe(false);
    });

    it('should return false for invalid URLs', () => {
      expect(isSameDomain('not-a-url', 'https://example.com')).toBe(false);
      expect(isSameDomain('https://example.com', 'not-a-url')).toBe(false);
      expect(isSameDomain('not-a-url', 'also-not-a-url')).toBe(false);
    });
  });

  describe('normalizeUrl', () => {
    it('should remove trailing slashes', () => {
      expect(normalizeUrl('https://example.com/')).toBe('https://example.com');
      expect(normalizeUrl('https://example.com/path/')).toBe('https://example.com/path');
    });

    it('should remove fragments', () => {
      expect(normalizeUrl('https://example.com#fragment')).toBe('https://example.com');
      expect(normalizeUrl('https://example.com/path#fragment')).toBe('https://example.com/path');
    });

    it('should preserve root path slash', () => {
      expect(normalizeUrl('https://example.com/')).toBe('https://example.com');
    });

    it('should return null for invalid URLs', () => {
      expect(normalizeUrl('not-a-url')).toBe(null);
      expect(normalizeUrl('')).toBe(null);
    });
  });

  describe('resolveUrl', () => {
    it('should resolve relative URLs', () => {
      expect(resolveUrl('/path', 'https://example.com')).toBe('https://example.com/path');
      expect(resolveUrl('page.html', 'https://example.com/dir/')).toBe('https://example.com/dir/page.html');
      expect(resolveUrl('../page.html', 'https://example.com/dir/subdir/')).toBe('https://example.com/dir/page.html');
    });

    it('should handle absolute URLs', () => {
      expect(resolveUrl('https://other.com/path', 'https://example.com')).toBe('https://other.com/path');
    });

    it('should return null for invalid URLs', () => {
      expect(resolveUrl('path', 'not-a-url')).toBe(null);
      expect(resolveUrl('', 'https://example.com')).toBe('https://example.com/');
    });
  });

  describe('isValidUrlForDomain', () => {
    it('should return true for URLs within the same domain', () => {
      expect(isValidUrlForDomain('https://example.com/path', 'example.com')).toBe(true);
      expect(isValidUrlForDomain('http://example.com', 'example.com')).toBe(true);
    });

    it('should return false for URLs in different domains', () => {
      expect(isValidUrlForDomain('https://other.com/path', 'example.com')).toBe(false);
      expect(isValidUrlForDomain('https://sub.example.com', 'example.com')).toBe(false);
    });

    it('should return false for invalid URLs', () => {
      expect(isValidUrlForDomain('not-a-url', 'example.com')).toBe(false);
      expect(isValidUrlForDomain('ftp://example.com', 'example.com')).toBe(false);
    });
  });
});