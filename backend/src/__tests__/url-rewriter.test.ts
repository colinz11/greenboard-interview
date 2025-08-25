import { UrlRewriter, createUrlRewriter, rewriteHtmlUrls, rewriteCssUrls, AssetPathMapping } from '../utils/url-rewriter';
import { AssetType } from '../types';

describe('UrlRewriter', () => {
  const baseUrl = 'https://example.com';
  const archiveId = 'test-archive-123';
  let rewriter: UrlRewriter;

  beforeEach(() => {
    rewriter = new UrlRewriter({
      archiveId,
      baseUrl,
    });
  });

  describe('constructor', () => {
    it('should initialize with default options', () => {
      const rewriter = new UrlRewriter({ archiveId, baseUrl });
      expect(rewriter).toBeInstanceOf(UrlRewriter);
    });

    it('should accept custom archive base path', () => {
      const customRewriter = new UrlRewriter({
        archiveId,
        baseUrl,
        archiveBasePath: '/custom/archives',
      });
      expect(customRewriter).toBeInstanceOf(UrlRewriter);
    });
  });

  describe('addAssetMapping', () => {
    it('should add asset mapping', () => {
      const mapping: AssetPathMapping = {
        originalUrl: 'https://example.com/style.css',
        localPath: 'assets/css/style.css',
        assetType: AssetType.CSS,
      };

      rewriter.addAssetMapping(mapping);
      const rewrittenUrl = rewriter.rewriteUrl('https://example.com/style.css');
      expect(rewrittenUrl).toBe(`/api/archives/${archiveId}/content/assets/css/style.css`);
    });

    it('should add multiple asset mappings', () => {
      const mappings: AssetPathMapping[] = [
        {
          originalUrl: 'https://example.com/style.css',
          localPath: 'assets/css/style.css',
          assetType: AssetType.CSS,
        },
        {
          originalUrl: 'https://example.com/script.js',
          localPath: 'assets/js/script.js',
          assetType: AssetType.JAVASCRIPT,
        },
      ];

      rewriter.addAssetMappings(mappings);
      
      expect(rewriter.rewriteUrl('https://example.com/style.css'))
        .toBe(`/api/archives/${archiveId}/content/assets/css/style.css`);
      expect(rewriter.rewriteUrl('https://example.com/script.js'))
        .toBe(`/api/archives/${archiveId}/content/assets/js/script.js`);
    });
  });

  describe('rewriteUrl', () => {
    it('should rewrite same-domain URLs to local paths', () => {
      const url = 'https://example.com/images/logo.png';
      const result = rewriter.rewriteUrl(url);
      expect(result).toBe(`/api/archives/${archiveId}/content/assets/images/logo.png`);
    });

    it('should preserve external URLs', () => {
      const url = 'https://external.com/image.jpg';
      const result = rewriter.rewriteUrl(url);
      expect(result).toBe(url);
    });

    it('should handle relative URLs', () => {
      const url = '/images/logo.png';
      const result = rewriter.rewriteUrl(url);
      expect(result).toBe(`/api/archives/${archiveId}/content/assets/images/logo.png`);
    });

    it('should handle URLs with query parameters', () => {
      const url = 'https://example.com/image.jpg?v=123&size=large';
      const result = rewriter.rewriteUrl(url);
      expect(result).toMatch(new RegExp(`/api/archives/${archiveId}/content/assets/images/image_[a-zA-Z0-9]+\\.jpg`));
    });

    it('should skip data URLs', () => {
      const url = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==';
      const result = rewriter.rewriteUrl(url);
      expect(result).toBe(url);
    });

    it('should skip blob URLs', () => {
      const url = 'blob:https://example.com/550e8400-e29b-41d4-a716-446655440000';
      const result = rewriter.rewriteUrl(url);
      expect(result).toBe(url);
    });

    it('should skip javascript URLs', () => {
      const url = 'javascript:void(0)';
      const result = rewriter.rewriteUrl(url);
      expect(result).toBe(url);
    });

    it('should skip mailto URLs', () => {
      const url = 'mailto:test@example.com';
      const result = rewriter.rewriteUrl(url);
      expect(result).toBe(url);
    });

    it('should skip tel URLs', () => {
      const url = 'tel:+1234567890';
      const result = rewriter.rewriteUrl(url);
      expect(result).toBe(url);
    });

    it('should skip fragment URLs', () => {
      const url = '#section1';
      const result = rewriter.rewriteUrl(url);
      expect(result).toBe(url);
    });

    it('should handle empty URLs', () => {
      const result = rewriter.rewriteUrl('');
      expect(result).toBe('');
    });

    it('should handle page links differently', () => {
      const url = 'https://example.com/about';
      const result = rewriter.rewriteUrl(url, true);
      expect(result).toBe(`/api/archives/${archiveId}/content/pages/about/index.html`);
    });
  });

  describe('resolveUrl', () => {
    it('should resolve relative URLs to absolute', () => {
      const result = rewriter.resolveUrl('/path/to/resource');
      expect(result).toBe('https://example.com/path/to/resource');
    });

    it('should preserve absolute URLs', () => {
      const url = 'https://external.com/resource';
      const result = rewriter.resolveUrl(url);
      expect(result).toBe(url);
    });

    it('should handle invalid URLs gracefully', () => {
      const result = rewriter.resolveUrl('not-a-valid-url');
      expect(result).toBe('https://example.com/not-a-valid-url');
    });
  });

  describe('isSameDomain', () => {
    it('should return true for same domain URLs', () => {
      expect(rewriter.isSameDomain('https://example.com/path')).toBe(true);
      expect(rewriter.isSameDomain('http://example.com/path')).toBe(true);
    });

    it('should return false for different domain URLs', () => {
      expect(rewriter.isSameDomain('https://other.com/path')).toBe(false);
    });

    it('should handle invalid URLs gracefully', () => {
      expect(rewriter.isSameDomain('not-a-url')).toBe(false);
    });
  });

  describe('generateAssetPath', () => {
    it('should generate correct path for CSS files', () => {
      const result = rewriter.generateAssetPath('https://example.com/styles/main.css');
      expect(result).toBe('assets/css/main.css');
    });

    it('should generate correct path for JavaScript files', () => {
      const result = rewriter.generateAssetPath('https://example.com/js/app.js');
      expect(result).toBe('assets/js/app.js');
    });

    it('should generate correct path for image files', () => {
      const result = rewriter.generateAssetPath('https://example.com/images/logo.png');
      expect(result).toBe('assets/images/logo.png');
    });

    it('should generate correct path for font files', () => {
      const result = rewriter.generateAssetPath('https://example.com/fonts/roboto.woff2');
      expect(result).toBe('assets/fonts/roboto.woff2');
    });

    it('should handle URLs with query parameters', () => {
      const result = rewriter.generateAssetPath('https://example.com/image.jpg?v=123');
      expect(result).toMatch(/assets\/images\/image_[a-zA-Z0-9]+\.jpg/);
    });

    it('should handle URLs without file extensions', () => {
      const result = rewriter.generateAssetPath('https://example.com/api/data');
      expect(result).toBe('assets/other/data');
    });
  });

  describe('generatePagePath', () => {
    it('should generate correct path for root URL', () => {
      const result = rewriter.generatePagePath('https://example.com/');
      expect(result).toBe('index.html');
    });

    it('should generate correct path for directory URLs', () => {
      const result = rewriter.generatePagePath('https://example.com/about/');
      expect(result).toBe('about/index.html');
    });

    it('should generate correct path for file URLs', () => {
      const result = rewriter.generatePagePath('https://example.com/contact.html');
      expect(result).toBe('contact.html');
    });

    it('should generate correct path for URLs without extension', () => {
      const result = rewriter.generatePagePath('https://example.com/about');
      expect(result).toBe('about/index.html');
    });
  });

  describe('rewriteHtmlUrls', () => {
    it('should rewrite link href attributes', () => {
      const html = '<link rel="stylesheet" href="https://example.com/style.css">';
      const result = rewriter.rewriteHtmlUrls(html);
      expect(result).toContain(`/api/archives/${archiveId}/content/assets/css/style.css`);
    });

    it('should rewrite script src attributes', () => {
      const html = '<script src="https://example.com/script.js"></script>';
      const result = rewriter.rewriteHtmlUrls(html);
      expect(result).toContain(`/api/archives/${archiveId}/content/assets/js/script.js`);
    });

    it('should rewrite img src attributes', () => {
      const html = '<img src="https://example.com/image.jpg" alt="test">';
      const result = rewriter.rewriteHtmlUrls(html);
      expect(result).toContain(`/api/archives/${archiveId}/content/assets/images/image.jpg`);
    });

    it('should rewrite img srcset attributes', () => {
      const html = '<img srcset="https://example.com/small.jpg 480w, https://example.com/large.jpg 800w" alt="test">';
      const result = rewriter.rewriteHtmlUrls(html);
      expect(result).toContain(`/api/archives/${archiveId}/content/assets/images/small.jpg 480w`);
      expect(result).toContain(`/api/archives/${archiveId}/content/assets/images/large.jpg 800w`);
    });

    it('should rewrite anchor href attributes for same-domain links', () => {
      const html = '<a href="https://example.com/about">About</a>';
      const result = rewriter.rewriteHtmlUrls(html);
      expect(result).toContain(`/api/archives/${archiveId}/content/pages/about/index.html`);
    });

    it('should preserve external anchor links', () => {
      const html = '<a href="https://external.com/page">External</a>';
      const result = rewriter.rewriteHtmlUrls(html);
      expect(result).toContain('https://external.com/page');
    });

    it('should rewrite form action attributes', () => {
      const html = '<form action="https://example.com/submit">...</form>';
      const result = rewriter.rewriteHtmlUrls(html);
      expect(result).toContain(`/api/archives/${archiveId}/content/pages/submit/index.html`);
    });

    it('should rewrite iframe src attributes', () => {
      const html = '<iframe src="https://example.com/embed"></iframe>';
      const result = rewriter.rewriteHtmlUrls(html);
      expect(result).toContain(`/api/archives/${archiveId}/content/pages/embed/index.html`);
    });

    it('should rewrite object data attributes', () => {
      const html = '<object data="https://example.com/document.pdf"></object>';
      const result = rewriter.rewriteHtmlUrls(html);
      expect(result).toContain(`/api/archives/${archiveId}/content/assets/other/document.pdf`);
    });

    it('should rewrite embed src attributes', () => {
      const html = '<embed src="https://example.com/video.mp4">';
      const result = rewriter.rewriteHtmlUrls(html);
      expect(result).toContain(`/api/archives/${archiveId}/content/assets/other/video.mp4`);
    });

    it('should rewrite source src attributes', () => {
      const html = '<source src="https://example.com/audio.mp3" type="audio/mpeg">';
      const result = rewriter.rewriteHtmlUrls(html);
      expect(result).toContain(`/api/archives/${archiveId}/content/assets/other/audio.mp3`);
    });

    it('should rewrite track src attributes', () => {
      const html = '<track src="https://example.com/subtitles.vtt" kind="subtitles">';
      const result = rewriter.rewriteHtmlUrls(html);
      expect(result).toContain(`/api/archives/${archiveId}/content/assets/other/subtitles.vtt`);
    });

    it('should preserve data URLs', () => {
      const dataUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==';
      const html = `<img src="${dataUrl}" alt="test">`;
      const result = rewriter.rewriteHtmlUrls(html);
      expect(result).toContain(dataUrl);
    });

    it('should preserve javascript URLs', () => {
      const html = '<a href="javascript:void(0)">Click</a>';
      const result = rewriter.rewriteHtmlUrls(html);
      expect(result).toContain('javascript:void(0)');
    });

    it('should handle complex HTML with multiple elements', () => {
      const html = `
        <html>
          <head>
            <link rel="stylesheet" href="https://example.com/style.css">
            <script src="https://example.com/script.js"></script>
          </head>
          <body>
            <img src="https://example.com/image.jpg" alt="test">
            <a href="https://example.com/about">About</a>
            <a href="https://external.com/page">External</a>
          </body>
        </html>
      `;
      
      const result = rewriter.rewriteHtmlUrls(html);
      
      expect(result).toContain(`/api/archives/${archiveId}/content/assets/css/style.css`);
      expect(result).toContain(`/api/archives/${archiveId}/content/assets/js/script.js`);
      expect(result).toContain(`/api/archives/${archiveId}/content/assets/images/image.jpg`);
      expect(result).toContain(`/api/archives/${archiveId}/content/pages/about/index.html`);
      expect(result).toContain('https://external.com/page');
    });
  });

  describe('rewriteCssUrls', () => {
    it('should rewrite @import statements with url()', () => {
      const css = '@import url("https://example.com/fonts.css");';
      const result = rewriter.rewriteCssUrls(css);
      expect(result).toContain(`/api/archives/${archiveId}/content/assets/css/fonts.css`);
    });

    it('should rewrite @import statements without url()', () => {
      const css = '@import "https://example.com/base.css";';
      const result = rewriter.rewriteCssUrls(css);
      expect(result).toContain(`/api/archives/${archiveId}/content/assets/css/base.css`);
    });

    it('should rewrite @import statements with single quotes', () => {
      const css = "@import 'https://example.com/theme.css';";
      const result = rewriter.rewriteCssUrls(css);
      expect(result).toContain(`/api/archives/${archiveId}/content/assets/css/theme.css`);
    });

    it('should rewrite url() functions in CSS properties', () => {
      const css = 'background-image: url("https://example.com/bg.jpg");';
      const result = rewriter.rewriteCssUrls(css);
      expect(result).toContain(`url("/api/archives/${archiveId}/content/assets/images/bg.jpg")`);
    });

    it('should rewrite url() functions without quotes', () => {
      const css = 'background-image: url(https://example.com/bg.png);';
      const result = rewriter.rewriteCssUrls(css);
      expect(result).toContain(`url("/api/archives/${archiveId}/content/assets/images/bg.png")`);
    });

    it('should rewrite url() functions with single quotes', () => {
      const css = "background-image: url('https://example.com/bg.gif');";
      const result = rewriter.rewriteCssUrls(css);
      expect(result).toContain(`url("/api/archives/${archiveId}/content/assets/images/bg.gif")`);
    });

    it('should rewrite font-face src urls', () => {
      const css = `
        @font-face {
          font-family: 'MyFont';
          src: url('https://example.com/font.woff2') format('woff2'),
               url('https://example.com/font.woff') format('woff');
        }
      `;
      const result = rewriter.rewriteCssUrls(css);
      expect(result).toContain(`url("/api/archives/${archiveId}/content/assets/fonts/font.woff2")`);
      expect(result).toContain(`url("/api/archives/${archiveId}/content/assets/fonts/font.woff")`);
    });

    it('should preserve data URLs in CSS', () => {
      const dataUrl = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMSIgaGVpZ2h0PSIxIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbGw9IiNmZmYiLz48L3N2Zz4=';
      const css = `background-image: url("${dataUrl}");`;
      const result = rewriter.rewriteCssUrls(css);
      expect(result).toContain(dataUrl);
    });

    it('should preserve external URLs in CSS', () => {
      const css = 'background-image: url("https://external.com/bg.jpg");';
      const result = rewriter.rewriteCssUrls(css);
      expect(result).toContain('https://external.com/bg.jpg');
    });

    it('should handle complex CSS with multiple url() functions', () => {
      const css = `
        body {
          background-image: url("https://example.com/bg.jpg");
        }
        
        .icon {
          background: url('https://example.com/icon.svg') no-repeat;
        }
        
        @font-face {
          font-family: 'CustomFont';
          src: url(https://example.com/font.woff2);
        }
        
        @import url("https://example.com/normalize.css");
      `;
      
      const result = rewriter.rewriteCssUrls(css);
      
      expect(result).toContain(`url("/api/archives/${archiveId}/content/assets/images/bg.jpg")`);
      expect(result).toContain(`url("/api/archives/${archiveId}/content/assets/images/icon.svg")`);
      expect(result).toContain(`url("/api/archives/${archiveId}/content/assets/fonts/font.woff2")`);
      expect(result).toContain(`/api/archives/${archiveId}/content/assets/css/normalize.css`);
    });
  });

  describe('utility functions', () => {
    describe('createUrlRewriter', () => {
      it('should create a UrlRewriter instance', () => {
        const rewriter = createUrlRewriter({ archiveId, baseUrl });
        expect(rewriter).toBeInstanceOf(UrlRewriter);
      });
    });

    describe('rewriteHtmlUrls', () => {
      it('should rewrite HTML URLs using utility function', () => {
        const html = '<img src="https://example.com/image.jpg" alt="test">';
        const result = rewriteHtmlUrls(html, { archiveId, baseUrl });
        expect(result).toContain(`/api/archives/${archiveId}/content/assets/images/image.jpg`);
      });

      it('should use asset mappings', () => {
        const html = '<img src="https://example.com/image.jpg" alt="test">';
        const mappings: AssetPathMapping[] = [{
          originalUrl: 'https://example.com/image.jpg',
          localPath: 'assets/images/custom-image.jpg',
          assetType: AssetType.IMAGE,
        }];
        
        const result = rewriteHtmlUrls(html, { archiveId, baseUrl }, mappings);
        expect(result).toContain(`/api/archives/${archiveId}/content/assets/images/custom-image.jpg`);
      });
    });

    describe('rewriteCssUrls', () => {
      it('should rewrite CSS URLs using utility function', () => {
        const css = 'background-image: url("https://example.com/bg.jpg");';
        const result = rewriteCssUrls(css, { archiveId, baseUrl });
        expect(result).toContain(`url("/api/archives/${archiveId}/content/assets/images/bg.jpg")`);
      });

      it('should use asset mappings', () => {
        const css = 'background-image: url("https://example.com/bg.jpg");';
        const mappings: AssetPathMapping[] = [{
          originalUrl: 'https://example.com/bg.jpg',
          localPath: 'assets/images/custom-bg.jpg',
          assetType: AssetType.IMAGE,
        }];
        
        const result = rewriteCssUrls(css, { archiveId, baseUrl }, mappings);
        expect(result).toContain(`url("/api/archives/${archiveId}/content/assets/images/custom-bg.jpg")`);
      });
    });
  });
});