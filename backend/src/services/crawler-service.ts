import axios from 'axios';
import * as cheerio from 'cheerio';
import { URL } from 'url';
import {
  CrawlerOptions,
  CrawlResult,
  ArchivedPage,
  ArchiveError,
  ErrorType,
  AssetType,
  Asset,
} from '../types';
import { isValidUrl, extractDomain, isSameDomain, normalizeUrl, resolveUrl } from '../utils/url-utils';

export class CrawlerService {
  private visitedUrls = new Set<string>();
  private crawledPages: ArchivedPage[] = [];
  private errors: ArchiveError[] = [];
  private startTime: number = 0;
  private urlQueue: string[] = [];
  private currentUrl: string = '';
  private currentDomain: string = '';
  private axiosInstance = axios.create({
    timeout: 30000,
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; WebArchiver/1.0; +https://webarchiver.com/bot)',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.5',
      'Accept-Encoding': 'gzip, deflate',
      'Connection': 'keep-alive',
    },
    maxRedirects: 5,
    validateStatus: (status) => status < 400,
  });

  /**
   * Initialize the crawler service
   */
  async initialize(): Promise<void> {
    console.log('🚀 Initializing HTTP-based crawler service');
    // Reset state
    this.visitedUrls.clear();
    this.crawledPages = [];
    this.errors = [];
    this.urlQueue = [];
    this.currentUrl = '';
    this.currentDomain = '';
  }

  /**
   * Clean up resources
   */
  async cleanup(): Promise<void> {
    console.log('🧹 Cleaning up crawler resources');
    this.visitedUrls.clear();
    this.crawledPages = [];
    this.errors = [];
    this.urlQueue = [];
    this.currentUrl = '';
    this.currentDomain = '';
  }

  /**
   * Crawl a website starting from the given URL
   */
  async crawlSite(url: string, options: CrawlerOptions, progressCallback?: (progress: { pagesFound: number, pagesCrawled: number, currentUrl?: string }) => void): Promise<CrawlResult> {
    this.startTime = Date.now();
    await this.initialize();

    try {
      console.log(`🚀 Starting crawl of ${url}`);
      
      const normalizedUrl = normalizeUrl(url);
      if (!normalizedUrl) {
        throw new Error(`Invalid URL: ${url}`);
      }
      
      const domain = extractDomain(normalizedUrl);
      if (!domain) {
        throw new Error(`Invalid domain for URL: ${url}`);
      }
      this.currentDomain = domain;

      console.log(`📍 Target domain: ${this.currentDomain}`);
      console.log(`📍 Starting URL: ${normalizedUrl}`);
      
      // Initialize with the starting URL - this ensures we start from the exact URL entered
      this.urlQueue.push(normalizedUrl);
      
      // Mark the starting URL as high priority by ensuring it's processed first
      console.log(`📋 Queue initialized with starting URL: ${normalizedUrl}`);

      // Set up progress reporting
      const progressInterval = setInterval(() => {
        if (progressCallback) {
          progressCallback({
            pagesFound: this.urlQueue.length + this.visitedUrls.size,
            pagesCrawled: this.crawledPages.length,
            currentUrl: this.currentUrl
          });
        }
      }, 500); // Report progress every 500ms

      try {
        // Process URLs from the queue
        while (this.urlQueue.length > 0 && this.crawledPages.length < options.maxPages) {
          const currentUrl = this.urlQueue.shift()!;
          
          if (this.visitedUrls.has(currentUrl)) {
            console.log(`⏭️  Skipping already visited: ${currentUrl}`);
            continue;
          }

          this.currentUrl = currentUrl;
          const isStartingUrl = this.crawledPages.length === 0;
          console.log(`🔍 Crawling [${this.crawledPages.length + 1}/${options.maxPages}]: ${currentUrl}${isStartingUrl ? ' (STARTING URL)' : ''}`);
          
          this.visitedUrls.add(currentUrl);
          
          const page = await this.crawlPageWithHttp(currentUrl, options.timeout);
          if (page) {
            this.crawledPages.push(page);
            console.log(`✅ Successfully crawled: "${page.title}" (${page.assets.length} assets, ${page.links.length} links)`);
            
            // Add new URLs to queue (respecting depth and domain restrictions)
            if (this.crawledPages.length < options.maxPages) {
              const newUrls = this.extractValidUrls(page.links, options);
              // Filter out URLs we've already visited or queued
              const uniqueNewUrls = newUrls.filter(newUrl => 
                !this.visitedUrls.has(newUrl) && !this.urlQueue.includes(newUrl)
              );
              this.urlQueue.push(...uniqueNewUrls);
              if (uniqueNewUrls.length > 0) {
                console.log(`📋 Added ${uniqueNewUrls.length} new URLs to queue (filtered from ${newUrls.length} found)`);
              }
            }
          } else {
            console.log(`❌ Failed to crawl: ${currentUrl}`);
          }
          
          // Small delay to be respectful to the server
          await new Promise(resolve => setTimeout(resolve, 200));
        }
        
        console.log(`🎉 Crawl completed! Found ${this.crawledPages.length} pages with ${this.errors.length} errors`);
        
        // Verify that the starting URL was crawled
        const startingPageFound = this.crawledPages.some(page => page.url === normalizedUrl);
        if (!startingPageFound && this.crawledPages.length > 0) {
          console.warn(`⚠️  Warning: Starting URL ${normalizedUrl} was not successfully crawled`);
        } else if (startingPageFound) {
          console.log(`✅ Starting URL ${normalizedUrl} was successfully crawled`);
        }
      } finally {
        clearInterval(progressInterval);
        this.currentUrl = '';
      }
      
      const duration = Date.now() - this.startTime;
      const totalSize = this.crawledPages.reduce(
        (sum, page) => sum + page.assets.reduce((assetSum, asset) => assetSum + asset.size, 0),
        0
      );

      return {
        pages: this.crawledPages,
        errors: this.errors,
        totalSize,
        duration,
      };
    } catch (error) {
      console.error('❌ Crawl failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.addError(ErrorType.NETWORK_ERROR, `Failed to crawl site: ${errorMessage}`, url);
      throw error;
    } finally {
      await this.cleanup();
    }
  }

  /**
   * Extract valid URLs from a list of links
   */
  private extractValidUrls(links: string[], options: CrawlerOptions): string[] {
    const validUrls: string[] = [];
    const seenUrls = new Set<string>();
    
    console.log(`🔗 Processing ${links.length} links found on page`);
    
    for (const link of links) {
      const normalizedLink = normalizeUrl(link);
      if (!normalizedLink) {
        continue;
      }
      
      // Skip if we've already seen this URL in this batch
      if (seenUrls.has(normalizedLink)) {
        continue;
      }
      seenUrls.add(normalizedLink);
      
      // Skip if already visited or queued
      if (this.visitedUrls.has(normalizedLink)) {
        continue;
      }
      
      // Check if it's a valid URL
      if (!isValidUrl(normalizedLink)) {
        continue;
      }
      
      // Check domain restrictions (stay within same domain)
      const linkDomain = extractDomain(normalizedLink);
      if (linkDomain !== this.currentDomain) {
        continue;
      }
      
      // Skip common non-content URLs
      if (this.shouldSkipUrl(normalizedLink)) {
        continue;
      }
      
      validUrls.push(normalizedLink);
    }
    
    console.log(`✅ Found ${validUrls.length} valid URLs from ${links.length} total links`);
    
    // Prioritize URLs that are likely to be more important:
    // 1. Shorter paths (closer to root)
    // 2. URLs that don't have query parameters
    // 3. URLs that look like content pages
    return validUrls
      .sort((a, b) => {
        const aUrl = new URL(a);
        const bUrl = new URL(b);
        
        // Prioritize URLs without query parameters
        const aHasQuery = aUrl.search.length > 0 ? 1 : 0;
        const bHasQuery = bUrl.search.length > 0 ? 1 : 0;
        if (aHasQuery !== bHasQuery) {
          return aHasQuery - bHasQuery;
        }
        
        // Then prioritize shorter paths
        return aUrl.pathname.length - bUrl.pathname.length;
      })
      .slice(0, 30); // Increased limit to find more pages
  }

  /**
   * Check if a URL should be skipped (common non-content URLs)
   */
  private shouldSkipUrl(url: string): boolean {
    const lowerUrl = url.toLowerCase();
    const skipPatterns = [
      /\.(pdf|doc|docx|xls|xlsx|ppt|pptx|zip|rar|tar|gz)$/i,
      /\.(mp3|mp4|avi|mov|wmv|flv|wav|ogg)$/i,
      /\.(exe|dmg|pkg|deb|rpm)$/i,
      /\/download\//i,
      /\/api\//i,
      /\/admin\//i,
      /\/wp-admin\//i,
      /\/login/i,
      /\/logout/i,
      /\/register/i,
      /\/signup/i,
      /\/cart/i,
      /\/checkout/i,
      /mailto:/i,
      /tel:/i,
      /javascript:/i,
      /#/
    ];
    
    return skipPatterns.some(pattern => pattern.test(url));
  }







  /**
   * Generate a local path for a page
   */
  private generatePagePath(url: string): string {
    try {
      const urlObj = new URL(url);
      let path = urlObj.pathname;
      
      // Handle root path
      if (path === '/' || path === '') {
        return 'index.html';
      }
      
      // If path already has an extension, use it as-is
      if (path.includes('.') && !path.endsWith('/')) {
        return path.startsWith('/') ? path.slice(1) : path;
      }
      
      // For paths without extensions, add index.html
      if (path.endsWith('/')) {
        path = `${path}index.html`;
      } else {
        path = `${path}/index.html`;
      }
      
      // Remove leading slash
      return path.startsWith('/') ? path.slice(1) : path;
    } catch (error) {
      console.warn(`Failed to generate page path for ${url}:`, error);
      return `page_${Date.now()}.html`;
    }
  }

  /**
   * Generate a local path for an asset
   */
  private generateAssetPath(url: string, type: AssetType): string {
    try {
      const urlObj = new URL(url);
      const pathname = urlObj.pathname;
      const filename = pathname.split('/').pop() || 'asset';
      
      const typeFolder = type.toLowerCase();
      return `assets/${typeFolder}/${filename}`;
    } catch {
      return `assets/other/asset_${Date.now()}`;
    }
  }

  /**
   * Add an error to the error collection
   */
  private addError(type: ErrorType, message: string, url?: string): void {
    this.errors.push({
      timestamp: new Date(),
      type,
      message,
      url,
      recoverable: type !== ErrorType.VALIDATION_ERROR,
    });
  }

  /**
   * Check if a URL is valid for crawling within the domain
   */
  isValidUrl(url: string, domain: string): boolean {
    try {
      if (!isValidUrl(url)) return false;
      const urlDomain = extractDomain(url);
      return urlDomain === domain;
    } catch {
      return false;
    }
  }

  /**
   * Crawl page using HTTP only
   */
  private async crawlPageWithHttp(url: string, timeout: number): Promise<ArchivedPage | null> {
    try {
      console.log(`📄 Fetching: ${url}`);
      
      const response = await this.axiosInstance.get(url, { timeout });
      
      console.log(`📊 Response: ${response.status} ${response.statusText} (${response.data.length} bytes)`);
      
      const $ = cheerio.load(response.data);
      const title = $('title').text().trim() || $('h1').first().text().trim() || 'Untitled Page';
      
      // Extract assets with better error handling
      const assets: Asset[] = [];
      let assetCount = 0;
      
      // Extract images
      $('img[src]').each((_, element) => {
        const src = $(element).attr('src');
        if (src && assetCount < 100) { // Limit assets to prevent overload
          const resolvedUrl = resolveUrl(src, url);
          if (resolvedUrl && isValidUrl(resolvedUrl)) {
            assets.push({
              originalUrl: resolvedUrl,
              localPath: '', // Will be set when downloaded
              type: AssetType.IMAGE,
              size: 0,
              contentType: this.getContentType(resolvedUrl, 'image/jpeg'),
            });
            assetCount++;
          }
        }
      });
      
      // Extract CSS
      $('link[rel="stylesheet"]').each((_, element) => {
        const href = $(element).attr('href');
        if (href && assetCount < 100) {
          const resolvedUrl = resolveUrl(href, url);
          if (resolvedUrl && isValidUrl(resolvedUrl)) {
            assets.push({
              originalUrl: resolvedUrl,
              localPath: '', // Will be set when downloaded
              type: AssetType.CSS,
              size: 0,
              contentType: 'text/css',
            });
            assetCount++;
          }
        }
      });
      
      // Extract JavaScript
      $('script[src]').each((_, element) => {
        const src = $(element).attr('src');
        if (src && assetCount < 100) {
          const resolvedUrl = resolveUrl(src, url);
          if (resolvedUrl && isValidUrl(resolvedUrl)) {
            assets.push({
              originalUrl: resolvedUrl,
              localPath: '', // Will be set when downloaded
              type: AssetType.JAVASCRIPT,
              size: 0,
              contentType: 'application/javascript',
            });
            assetCount++;
          }
        }
      });
      
      // Extract fonts
      $('link[rel="preload"][as="font"], link[href*=".woff"], link[href*=".ttf"]').each((_, element) => {
        const href = $(element).attr('href');
        if (href && assetCount < 100) {
          const resolvedUrl = resolveUrl(href, url);
          if (resolvedUrl && isValidUrl(resolvedUrl)) {
            assets.push({
              originalUrl: resolvedUrl,
              localPath: '', // Will be set when downloaded
              type: AssetType.FONT,
              size: 0,
              contentType: this.getContentType(resolvedUrl, 'font/woff'),
            });
            assetCount++;
          }
        }
      });
      
      // Extract links
      const links: string[] = [];
      $('a[href]').each((_, element) => {
        const href = $(element).attr('href');
        if (href) {
          const resolvedUrl = resolveUrl(href, url);
          if (resolvedUrl && isValidUrl(resolvedUrl)) {
            links.push(resolvedUrl);
          }
        }
      });
      
      console.log(`📋 Extracted: ${assets.length} assets, ${links.length} links`);
      
      return {
        url,
        path: this.generatePagePath(url),
        title,
        timestamp: new Date(),
        assets,
        links,
        htmlContent: response.data, // Store the actual HTML content
      };
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`❌ Failed to crawl ${url}:`, errorMessage);
      
      if (axios.isAxiosError(error)) {
        if (error.response) {
          this.addError(ErrorType.NETWORK_ERROR, `HTTP ${error.response.status}: ${error.response.statusText}`, url);
        } else if (error.code === 'ECONNABORTED') {
          this.addError(ErrorType.TIMEOUT_ERROR, `Request timeout after ${timeout}ms`, url);
        } else {
          this.addError(ErrorType.NETWORK_ERROR, `Network error: ${errorMessage}`, url);
        }
      } else {
        this.addError(ErrorType.NETWORK_ERROR, `Crawl error: ${errorMessage}`, url);
      }
      
      return null;
    }
  }

  /**
   * Get file extension from URL
   */
  private getFileExtension(url: string, defaultExt: string): string {
    try {
      const pathname = new URL(url).pathname;
      const ext = pathname.split('.').pop();
      return ext && ext.length <= 4 ? ext : defaultExt;
    } catch {
      return defaultExt;
    }
  }

  /**
   * Get content type from URL
   */
  private getContentType(url: string, defaultType: string): string {
    const ext = this.getFileExtension(url, '');
    const typeMap: { [key: string]: string } = {
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'png': 'image/png',
      'gif': 'image/gif',
      'svg': 'image/svg+xml',
      'webp': 'image/webp',
      'css': 'text/css',
      'js': 'application/javascript',
      'html': 'text/html',
      'htm': 'text/html',
      'woff': 'font/woff',
      'woff2': 'font/woff2',
      'ttf': 'font/ttf',
      'otf': 'font/otf',
    };
    return typeMap[ext.toLowerCase()] || defaultType;
  }


}