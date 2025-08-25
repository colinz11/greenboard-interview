import { URL } from 'url';
import * as path from 'path';
import { AssetType } from '../types';

export interface UrlRewriteOptions {
  archiveId: string;
  baseUrl: string;
  archiveBasePath?: string;
}

export interface AssetPathMapping {
  originalUrl: string;
  localPath: string;
  assetType: AssetType;
}

/**
 * Comprehensive URL rewriting utility for archived content
 */
export class UrlRewriter {
  private options: UrlRewriteOptions;
  private assetMappings: Map<string, AssetPathMapping>;

  constructor(options: UrlRewriteOptions) {
    this.options = {
      archiveBasePath: '/api/archives',
      ...options,
    };
    this.assetMappings = new Map();
  }

  /**
   * Add asset mapping for URL rewriting
   */
  addAssetMapping(mapping: AssetPathMapping): void {
    this.assetMappings.set(mapping.originalUrl, mapping);
  }

  /**
   * Add multiple asset mappings
   */
  addAssetMappings(mappings: AssetPathMapping[]): void {
    mappings.forEach(mapping => this.addAssetMapping(mapping));
  }

  /**
   * Rewrite URLs in HTML content
   */
  rewriteHtmlUrls(html: string): string {
    let rewrittenHtml = html;

    // Rewrite link href attributes (CSS, icons, etc.)
    rewrittenHtml = this.rewriteHtmlAttribute(rewrittenHtml, 'link', 'href');
    
    // Rewrite script src attributes
    rewrittenHtml = this.rewriteHtmlAttribute(rewrittenHtml, 'script', 'src');
    
    // Rewrite img src attributes
    rewrittenHtml = this.rewriteHtmlAttribute(rewrittenHtml, 'img', 'src');
    
    // Rewrite img srcset attributes
    rewrittenHtml = this.rewriteHtmlSrcset(rewrittenHtml);
    
    // Rewrite anchor href attributes (for same-domain links)
    rewrittenHtml = this.rewriteHtmlAttribute(rewrittenHtml, 'a', 'href', true);
    
    // Rewrite form action attributes
    rewrittenHtml = this.rewriteHtmlAttribute(rewrittenHtml, 'form', 'action', true);
    
    // Rewrite iframe src attributes
    rewrittenHtml = this.rewriteHtmlAttribute(rewrittenHtml, 'iframe', 'src', true);
    
    // Rewrite object data attributes
    rewrittenHtml = this.rewriteHtmlAttribute(rewrittenHtml, 'object', 'data');
    
    // Rewrite embed src attributes
    rewrittenHtml = this.rewriteHtmlAttribute(rewrittenHtml, 'embed', 'src');
    
    // Rewrite source src attributes (for audio/video)
    rewrittenHtml = this.rewriteHtmlAttribute(rewrittenHtml, 'source', 'src');
    
    // Rewrite track src attributes (for video subtitles)
    rewrittenHtml = this.rewriteHtmlAttribute(rewrittenHtml, 'track', 'src');

    return rewrittenHtml;
  }

  /**
   * Rewrite URLs in CSS content
   */
  rewriteCssUrls(css: string): string {
    let rewrittenCss = css;

    // Rewrite @import statements
    rewrittenCss = rewrittenCss.replace(
      /@import\s+(?:url\()?["']?([^"')]+)["']?\)?[^;]*;/gi,
      (match, url) => {
        const rewrittenUrl = this.rewriteUrl(url);
        return match.replace(url, rewrittenUrl);
      }
    );

    // Rewrite url() functions
    rewrittenCss = rewrittenCss.replace(
      /url\(["']?([^"')]+)["']?\)/gi,
      (match, url) => {
        const rewrittenUrl = this.rewriteUrl(url);
        return `url("${rewrittenUrl}")`;
      }
    );

    return rewrittenCss;
  }

  /**
   * Rewrite a single URL
   */
  rewriteUrl(url: string, isPageLink: boolean = false): string {
    if (!url || url.trim() === '') {
      return url;
    }

    // Skip data URLs, blob URLs, and javascript: URLs
    if (this.isSpecialUrl(url)) {
      return url;
    }

    try {
      const resolvedUrl = this.resolveUrl(url);
      
      // Check if we have a specific mapping for this URL
      const mapping = this.assetMappings.get(resolvedUrl);
      if (mapping) {
        // Use absolute path from archive root for proper resolution
        return `${this.options.archiveBasePath}/${this.options.archiveId}/content/${mapping.localPath}`;
      }

      // For page links, rewrite to archived page path
      if (isPageLink && this.isSameDomain(resolvedUrl)) {
        const pagePath = this.generatePagePath(resolvedUrl);
        return `${this.options.archiveBasePath}/${this.options.archiveId}/content/pages/${pagePath}`;
      }

      // For assets, generate local path based on URL
      if (this.isSameDomain(resolvedUrl)) {
        const localPath = this.generateAssetPath(resolvedUrl);
        return `${this.options.archiveBasePath}/${this.options.archiveId}/content/${localPath}`;
      }

      // Return original URL for external resources
      return url;
    } catch (error) {
      // If URL parsing fails, return original URL
      return url;
    }
  }

  /**
   * Convert relative URLs to absolute URLs
   */
  resolveUrl(url: string): string {
    try {
      // If it's already an absolute URL, return as is
      if (url.startsWith('http://') || url.startsWith('https://')) {
        return url;
      }
      return new URL(url, this.options.baseUrl).href;
    } catch {
      return url;
    }
  }

  /**
   * Check if URL is from the same domain as the base URL
   */
  isSameDomain(url: string): boolean {
    try {
      const urlObj = new URL(url);
      const baseUrlObj = new URL(this.options.baseUrl);
      return urlObj.hostname === baseUrlObj.hostname;
    } catch {
      return false;
    }
  }

  /**
   * Generate local asset path for a URL
   */
  generateAssetPath(url: string): string {
    try {
      const urlObj = new URL(url);
      const pathname = urlObj.pathname;
      const fileName = path.basename(pathname) || 'index';
      const assetType = this.detectAssetType(fileName, urlObj.pathname);
      const subDir = this.getAssetSubDirectory(assetType);
      
      // Handle query parameters
      let finalFileName = fileName;
      if (urlObj.search) {
        const queryHash = Buffer.from(urlObj.search).toString('base64').slice(0, 8);
        const ext = path.extname(fileName);
        const name = path.basename(fileName, ext);
        finalFileName = `${name}_${queryHash}${ext}`;
      }
      
      return path.join('assets', subDir, finalFileName);
    } catch {
      return 'assets/other/unknown';
    }
  }

  /**
   * Generate local page path for a URL
   */
  generatePagePath(url: string): string {
    try {
      const urlObj = new URL(url);
      let pathname = urlObj.pathname;
      
      // Remove leading slash
      if (pathname.startsWith('/')) {
        pathname = pathname.slice(1);
      }
      
      // Handle root path
      if (pathname === '' || pathname === '/') {
        return 'index.html';
      }
      
      // Handle directory paths
      if (pathname.endsWith('/')) {
        return path.join(pathname, 'index.html');
      }
      
      // Handle paths without extension
      if (!path.extname(pathname)) {
        return path.join(pathname, 'index.html');
      }
      
      return pathname;
    } catch {
      return 'index.html';
    }
  }

  /**
   * Detect asset type from URL
   */
  private detectAssetType(fileName: string, pathname: string): AssetType {
    const ext = path.extname(fileName).toLowerCase();
    
    // CSS files
    if (ext === '.css') {
      return AssetType.CSS;
    }
    
    // JavaScript files
    if (['.js', '.mjs', '.jsx'].includes(ext)) {
      return AssetType.JAVASCRIPT;
    }
    
    // Image files
    if (['.jpg', '.jpeg', '.png', '.gif', '.svg', '.webp', '.bmp', '.ico'].includes(ext)) {
      return AssetType.IMAGE;
    }
    
    // Font files
    if (['.woff', '.woff2', '.ttf', '.otf', '.eot'].includes(ext)) {
      return AssetType.FONT;
    }
    
    // HTML files
    if (['.html', '.htm'].includes(ext)) {
      return AssetType.HTML;
    }
    
    return AssetType.OTHER;
  }

  /**
   * Get asset subdirectory for asset type
   */
  private getAssetSubDirectory(assetType: AssetType): string {
    switch (assetType) {
      case AssetType.CSS:
        return 'css';
      case AssetType.JAVASCRIPT:
        return 'js';
      case AssetType.IMAGE:
        return 'images';
      case AssetType.FONT:
        return 'fonts';
      case AssetType.HTML:
        return 'pages';
      default:
        return 'other';
    }
  }

  /**
   * Check if URL is a special URL that shouldn't be rewritten
   */
  private isSpecialUrl(url: string): boolean {
    const trimmedUrl = url.trim().toLowerCase();
    return (
      trimmedUrl.startsWith('data:') ||
      trimmedUrl.startsWith('blob:') ||
      trimmedUrl.startsWith('javascript:') ||
      trimmedUrl.startsWith('mailto:') ||
      trimmedUrl.startsWith('tel:') ||
      trimmedUrl.startsWith('#') ||
      trimmedUrl === ''
    );
  }

  /**
   * Rewrite HTML attribute values
   */
  private rewriteHtmlAttribute(
    html: string,
    tagName: string,
    attributeName: string,
    isPageLink: boolean = false
  ): string {
    const regex = new RegExp(
      `<${tagName}[^>]*\\s${attributeName}=["']([^"']+)["'][^>]*>`,
      'gi'
    );
    
    return html.replace(regex, (match, url) => {
      const rewrittenUrl = this.rewriteUrl(url, isPageLink);
      return match.replace(url, rewrittenUrl);
    });
  }

  /**
   * Rewrite srcset attributes (for responsive images)
   */
  private rewriteHtmlSrcset(html: string): string {
    return html.replace(
      /(<img[^>]*\s)srcset=["']([^"']+)["']([^>]*>)/gi,
      (match, prefix, srcset, suffix) => {
        const rewrittenSrcset = srcset
          .split(',')
          .map((src: string) => {
            const parts = src.trim().split(/\s+/);
            if (parts.length > 0) {
              parts[0] = this.rewriteUrl(parts[0]);
            }
            return parts.join(' ');
          })
          .join(', ');
        
        return `${prefix}srcset="${rewrittenSrcset}"${suffix}`;
      }
    );
  }
}

/**
 * Utility function to create a URL rewriter instance
 */
export function createUrlRewriter(options: UrlRewriteOptions): UrlRewriter {
  return new UrlRewriter(options);
}

/**
 * Utility function to rewrite URLs in HTML content
 */
export function rewriteHtmlUrls(
  html: string,
  options: UrlRewriteOptions,
  assetMappings: AssetPathMapping[] = []
): string {
  const rewriter = createUrlRewriter(options);
  rewriter.addAssetMappings(assetMappings);
  return rewriter.rewriteHtmlUrls(html);
}

/**
 * Utility function to rewrite URLs in CSS content
 */
export function rewriteCssUrls(
  css: string,
  options: UrlRewriteOptions,
  assetMappings: AssetPathMapping[] = []
): string {
  const rewriter = createUrlRewriter(options);
  rewriter.addAssetMappings(assetMappings);
  return rewriter.rewriteCssUrls(css);
}