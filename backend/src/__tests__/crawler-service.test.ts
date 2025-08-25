import { CrawlerService } from '../services/crawler-service';
import { CrawlerOptions, ErrorType, AssetType } from '../types';
import puppeteer from 'puppeteer';

// Mock Puppeteer
jest.mock('puppeteer');
const mockPuppeteer = puppeteer as jest.Mocked<typeof puppeteer>;

// Mock page and browser
const mockPage = {
  setDefaultTimeout: jest.fn(),
  setUserAgent: jest.fn(),
  goto: jest.fn(),
  content: jest.fn(),
  title: jest.fn(),
  evaluate: jest.fn(),
  close: jest.fn(),
};

const mockBrowser = {
  newPage: jest.fn().mockResolvedValue(mockPage),
  close: jest.fn(),
};

const mockResponse = {
  ok: jest.fn().mockReturnValue(true),
  status: jest.fn().mockReturnValue(200),
  statusText: jest.fn().mockReturnValue('OK'),
};

describe('CrawlerService', () => {
  let crawlerService: CrawlerService;
  const defaultOptions: CrawlerOptions = {
    maxDepth: 3,
    maxPages: 10,
    timeout: 30000,
    respectRobots: false,
  };

  beforeEach(() => {
    crawlerService = new CrawlerService();
    jest.clearAllMocks();
    
    // Setup default mocks
    mockPuppeteer.launch.mockResolvedValue(mockBrowser as any);
    mockPage.goto.mockResolvedValue(mockResponse as any);
  });

  afterEach(async () => {
    await crawlerService.cleanup();
  });

  describe('initialization and cleanup', () => {
    it('should initialize browser successfully', async () => {
      await crawlerService.initialize();
      
      expect(mockPuppeteer.launch).toHaveBeenCalledWith({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      });
    });

    it('should cleanup browser resources', async () => {
      await crawlerService.initialize();
      await crawlerService.cleanup();
      
      expect(mockBrowser.close).toHaveBeenCalled();
    });

    it('should not initialize browser twice', async () => {
      await crawlerService.initialize();
      await crawlerService.initialize();
      
      expect(mockPuppeteer.launch).toHaveBeenCalledTimes(1);
    });
  });

  describe('crawlSite', () => {
    const sampleHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Test Page</title>
          <link rel="stylesheet" href="/styles.css">
        </head>
        <body>
          <h1>Test</h1>
          <a href="/about">About</a>
          <a href="/contact">Contact</a>
          <a href="https://external.com">External</a>
          <img src="/image.jpg" alt="Test">
          <script src="/script.js"></script>
        </body>
      </html>
    `;

    beforeEach(() => {
      mockPage.content.mockResolvedValue(sampleHtml);
      mockPage.title.mockResolvedValue('Test Page');
      mockPage.evaluate.mockResolvedValue([
        { url: 'https://example.com/styles.css', type: 'text/css' },
        { url: 'https://example.com/script.js', type: 'application/javascript' },
        { url: 'https://example.com/image.jpg', type: 'image' },
      ]);
    });

    it('should crawl a simple website successfully', async () => {
      const result = await crawlerService.crawlSite('https://example.com', defaultOptions);
      
      expect(result.pages).toHaveLength(3); // Root + about + contact
      expect(result.pages[0].url).toBe('https://example.com');
      expect(result.pages[0].title).toBe('Test Page');
      expect(result.pages[0].links).toContain('https://example.com/about');
      expect(result.pages[0].links).toContain('https://example.com/contact');
      expect(result.pages[0].links).not.toContain('https://external.com');
      expect(result.errors).toHaveLength(0);
      
      // Check that all pages are from the same domain
      const urls = result.pages.map(p => p.url);
      expect(urls).toContain('https://example.com');
      expect(urls).toContain('https://example.com/about');
      expect(urls).toContain('https://example.com/contact');
    });

    it('should extract assets correctly', async () => {
      const result = await crawlerService.crawlSite('https://example.com', defaultOptions);
      
      const page = result.pages[0];
      expect(page.assets).toHaveLength(3);
      
      const cssAsset = page.assets.find(a => a.type === AssetType.CSS);
      expect(cssAsset).toBeDefined();
      expect(cssAsset?.originalUrl).toBe('https://example.com/styles.css');
      
      const jsAsset = page.assets.find(a => a.type === AssetType.JAVASCRIPT);
      expect(jsAsset).toBeDefined();
      expect(jsAsset?.originalUrl).toBe('https://example.com/script.js');
      
      const imgAsset = page.assets.find(a => a.type === AssetType.IMAGE);
      expect(imgAsset).toBeDefined();
      expect(imgAsset?.originalUrl).toBe('https://example.com/image.jpg');
    });

    it('should respect max depth limit', async () => {
      const shallowOptions = { ...defaultOptions, maxDepth: 1 };

      const result = await crawlerService.crawlSite('https://example.com', shallowOptions);
      
      // Should only crawl the root page due to depth limit
      expect(result.pages).toHaveLength(1);
      expect(result.pages[0].url).toBe('https://example.com');
    });

    it('should respect max pages limit', async () => {
      const limitedOptions = { ...defaultOptions, maxPages: 1 };
      
      const result = await crawlerService.crawlSite('https://example.com', limitedOptions);
      
      expect(result.pages).toHaveLength(1);
    });

    it('should handle circular links without infinite loops', async () => {
      const circularHtml = `
        <html>
          <body>
            <a href="/">Home</a>
            <a href="/page1">Page 1</a>
          </body>
        </html>
      `;
      
      // Reset mocks for this specific test
      mockPage.content.mockResolvedValue(circularHtml);
      mockPage.title.mockResolvedValue('Circular Page');
      mockPage.evaluate.mockResolvedValue([]);

      const result = await crawlerService.crawlSite('https://example.com', defaultOptions);
      
      // Should not get stuck in infinite loop
      expect(result.pages.length).toBeGreaterThan(0);
      expect(result.pages.length).toBeLessThanOrEqual(defaultOptions.maxPages);
      
      // Should have visited each unique URL only once
      const urls = result.pages.map(p => p.url);
      const uniqueUrls = [...new Set(urls)];
      expect(urls.length).toBe(uniqueUrls.length);
    });

    it('should filter out external domain links', async () => {
      const result = await crawlerService.crawlSite('https://example.com', defaultOptions);
      
      const page = result.pages[0];
      const externalLinks = page.links.filter(link => !link.includes('example.com'));
      expect(externalLinks).toHaveLength(0);
      
      // All links should be from the same domain
      page.links.forEach(link => {
        expect(link).toMatch(/^https:\/\/example\.com/);
      });
    });

    it('should handle network errors gracefully', async () => {
      mockPage.goto.mockRejectedValue(new Error('Network timeout'));
      
      const result = await crawlerService.crawlSite('https://example.com', defaultOptions);
      
      expect(result.pages).toHaveLength(0);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].type).toBe(ErrorType.NETWORK_ERROR);
      expect(result.errors[0].message).toContain('Network timeout');
    });

    it('should handle HTTP error responses', async () => {
      mockResponse.ok.mockReturnValue(false);
      mockResponse.status.mockReturnValue(404);
      mockResponse.statusText.mockReturnValue('Not Found');
      
      const result = await crawlerService.crawlSite('https://example.com', defaultOptions);
      
      expect(result.pages).toHaveLength(0);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].type).toBe(ErrorType.NETWORK_ERROR);
    });

    it('should handle invalid URLs', async () => {
      await expect(
        crawlerService.crawlSite('invalid-url', defaultOptions)
      ).rejects.toThrow('Invalid URL');
    });
  });

  describe('extractLinksFromHtml', () => {
    it('should extract links from HTML correctly', () => {
      const html = `
        <html>
          <body>
            <a href="/page1">Page 1</a>
            <a href="https://example.com/page2">Page 2</a>
            <a href="mailto:test@example.com">Email</a>
            <a href="javascript:void(0)">JS Link</a>
            <a>No href</a>
          </body>
        </html>
      `;
      
      const links = crawlerService.extractLinksFromHtml(html, 'https://example.com');
      
      expect(links).toContain('https://example.com/page1');
      expect(links).toContain('https://example.com/page2');
      expect(links).not.toContain('mailto:test@example.com');
      expect(links).not.toContain('javascript:void(0)');
    });

    it('should resolve relative URLs correctly', () => {
      const html = `
        <html>
          <body>
            <a href="../parent">Parent</a>
            <a href="./current">Current</a>
            <a href="child">Child</a>
          </body>
        </html>
      `;
      
      const links = crawlerService.extractLinksFromHtml(html, 'https://example.com/sub/page');
      
      expect(links).toContain('https://example.com/parent');
      expect(links).toContain('https://example.com/sub/current');
      expect(links).toContain('https://example.com/sub/child');
    });

    it('should remove duplicate links', () => {
      const html = `
        <html>
          <body>
            <a href="/page1">Page 1</a>
            <a href="/page1">Page 1 Again</a>
            <a href="https://example.com/page1">Page 1 Absolute</a>
          </body>
        </html>
      `;
      
      const links = crawlerService.extractLinksFromHtml(html, 'https://example.com');
      
      expect(links).toHaveLength(1);
      expect(links[0]).toBe('https://example.com/page1');
    });
  });

  describe('extractLinks', () => {
    it('should filter links for same domain only', () => {
      const links = [
        'https://example.com/page1',
        'https://example.com/page2',
        'https://other.com/page3',
        'https://subdomain.example.com/page4',
      ];
      
      const filtered = crawlerService.extractLinks(links, 'https://example.com', 'example.com');
      
      expect(filtered).toContain('https://example.com/page1');
      expect(filtered).toContain('https://example.com/page2');
      expect(filtered).not.toContain('https://other.com/page3');
      expect(filtered).not.toContain('https://subdomain.example.com/page4');
    });

    it('should handle invalid URLs gracefully', () => {
      const links = [
        'https://example.com/valid',
        'invalid-url',
        'mailto:test@example.com',
        'javascript:void(0)',
      ];
      
      const filtered = crawlerService.extractLinks(links, 'https://example.com', 'example.com');
      
      expect(filtered).toHaveLength(1);
      expect(filtered[0]).toBe('https://example.com/valid');
    });
  });

  describe('isValidUrl', () => {
    it('should validate URLs for domain correctly', () => {
      expect(crawlerService.isValidUrl('https://example.com/page', 'example.com')).toBe(true);
      expect(crawlerService.isValidUrl('https://other.com/page', 'example.com')).toBe(false);
      expect(crawlerService.isValidUrl('invalid-url', 'example.com')).toBe(false);
      expect(crawlerService.isValidUrl('mailto:test@example.com', 'example.com')).toBe(false);
    });
  });

  describe('error handling', () => {
    it('should handle browser initialization failure', async () => {
      mockPuppeteer.launch.mockRejectedValue(new Error('Browser launch failed'));
      
      await expect(
        crawlerService.crawlSite('https://example.com', defaultOptions)
      ).rejects.toThrow('Browser launch failed');
    });

    it('should handle page creation failure', async () => {
      mockBrowser.newPage.mockRejectedValue(new Error('Page creation failed'));
      
      const result = await crawlerService.crawlSite('https://example.com', defaultOptions);
      
      expect(result.pages).toHaveLength(0);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].type).toBe(ErrorType.NETWORK_ERROR);
    });

    it('should handle content extraction failure', async () => {
      mockPage.content.mockRejectedValue(new Error('Content extraction failed'));
      
      const result = await crawlerService.crawlSite('https://example.com', defaultOptions);
      
      expect(result.pages).toHaveLength(0);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].type).toBe(ErrorType.NETWORK_ERROR);
    });
  });

  describe('asset type determination', () => {
    it('should determine asset types correctly from content type and URL', () => {
      // Test the asset type determination logic directly
      const service = new CrawlerService();
      
      // Test CSS
      const cssAsset = (service as any).createAssetFromResource('https://example.com/style.css', 'text/css', 'https://example.com');
      expect(cssAsset?.type).toBe(AssetType.CSS);
      
      // Test JavaScript
      const jsAsset = (service as any).createAssetFromResource('https://example.com/script.js', 'application/javascript', 'https://example.com');
      expect(jsAsset?.type).toBe(AssetType.JAVASCRIPT);
      
      // Test Image
      const imgAsset = (service as any).createAssetFromResource('https://example.com/image.png', 'image/png', 'https://example.com');
      expect(imgAsset?.type).toBe(AssetType.IMAGE);
      
      // Test Font
      const fontAsset = (service as any).createAssetFromResource('https://example.com/font.woff2', 'font/woff2', 'https://example.com');
      expect(fontAsset?.type).toBe(AssetType.FONT);
      
      // Test HTML
      const htmlAsset = (service as any).createAssetFromResource('https://example.com/page.html', 'text/html', 'https://example.com');
      expect(htmlAsset?.type).toBe(AssetType.HTML);
      
      // Test Other
      const otherAsset = (service as any).createAssetFromResource('https://example.com/data.json', 'application/json', 'https://example.com');
      expect(otherAsset?.type).toBe(AssetType.OTHER);
    });
  });
});