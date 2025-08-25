import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';
import {
  Archive,
  ArchiveStatus,
  CrawlerOptions,
  ArchiveError,
  ErrorType,
  ArchivedPage,
  Asset,
  AssetType,
  ArchiveVersion,
} from '../types';
import { CrawlerService } from './crawler-service';
import { FileService } from './file-service';
import { extractDomain, normalizeUrl } from '../utils/url-utils';
import { createArchive } from '../utils/validation';
import { AssetPathMapping } from '../utils/url-rewriter';

/**
 * Configuration options for the ArchiveService
 */
export interface ArchiveServiceOptions {
  /** Base path for storing archive files */
  storageBasePath: string;
  /** Default crawler configuration options */
  defaultCrawlerOptions?: Partial<CrawlerOptions>;
  /** Maximum number of concurrent archiving operations */
  maxConcurrentArchives?: number;
}

/**
 * Progress information for an active archive operation
 */
export interface ArchiveProgress {
  /** Unique identifier for the archive */
  archiveId: string;
  /** URL being archived */
  url: string;
  /** Current status of the archiving process */
  status: ArchiveStatus;
  /** Detailed progress metrics */
  progress: {
    /** Number of pages discovered during crawling */
    pagesDiscovered: number;
    /** Number of pages successfully crawled */
    pagesCrawled: number;
    /** Number of assets downloaded */
    assetsDownloaded: number;
    /** Total size of archived content in bytes */
    totalSize: number;
  };
  /** List of errors encountered during archiving */
  errors: ArchiveError[];
  /** When the archiving process started */
  startTime: Date;
  /** Estimated completion time (if available) */
  estimatedCompletion?: Date;
  /** Currently processing URL */
  currentUrl?: string;
}

/**
 * Service for managing website archiving operations
 * 
 * This service orchestrates the crawling, downloading, and storage of website content.
 * It manages concurrent archiving operations and provides progress tracking.
 */
export class ArchiveService {
  private fileService: FileService;
  private crawlerService: CrawlerService;
  private activeArchives = new Map<string, ArchiveProgress>();
  private maxConcurrentArchives: number;
  private defaultCrawlerOptions: CrawlerOptions;

  constructor(
    options: ArchiveServiceOptions,
    fileService?: FileService,
    crawlerService?: CrawlerService
  ) {
    this.fileService = fileService || new FileService({
      baseStoragePath: options.storageBasePath,
    });
    this.crawlerService = crawlerService || new CrawlerService();
    this.maxConcurrentArchives = options.maxConcurrentArchives || 3;
    this.defaultCrawlerOptions = {
      maxDepth: 3, // Increased depth for more comprehensive archiving
      maxPages: 1000, // Increased page limit for comprehensive archiving
      timeout: 15000, // Timeout per page (15 seconds)
      respectRobots: true,
      ...options.defaultCrawlerOptions,
    };
  }

  /**
   * Create a new archive for the given URL
   * 
   * This method initiates the archiving process by:
   * 1. Validating the URL and checking concurrent limits
   * 2. Creating archive metadata and storage structure
   * 3. Starting the crawling and downloading process
   * 4. Tracking progress and handling errors
   * 
   * @param url - The URL to archive (must be valid HTTP/HTTPS)
   * @param options - Optional crawler configuration to override defaults
   * @returns Promise resolving to the created Archive object
   * @throws Error if URL is invalid, concurrent limit reached, or archive already in progress
   */
  async createArchive(
    url: string,
    options?: Partial<CrawlerOptions>
  ): Promise<Archive> {
    // Validate URL
    const normalizedUrl = normalizeUrl(url);
    if (!normalizedUrl) {
      throw new Error(`Invalid URL: ${url}`);
    }

    const domain = extractDomain(normalizedUrl);
    if (!domain) {
      throw new Error(`Cannot extract domain from URL: ${url}`);
    }

    // Check concurrent archive limit
    if (this.activeArchives.size >= this.maxConcurrentArchives) {
      throw new Error(
        `Maximum concurrent archives limit reached (${this.maxConcurrentArchives}). Please wait for existing archives to complete.`
      );
    }

    // Check if archive for this URL is already in progress
    const existingArchive = Array.from(this.activeArchives.values()).find(
      progress => progress.url === normalizedUrl && progress.status === ArchiveStatus.IN_PROGRESS
    );
    if (existingArchive) {
      throw new Error(`Archive for ${normalizedUrl} is already in progress`);
    }

    // Get the next version number for this URL
    const latestVersion = await this.getLatestVersionNumber(normalizedUrl);
    const nextVersion = latestVersion + 1;

    // Create archive record
    const archiveId = uuidv4();
    const archive = createArchive(normalizedUrl, archiveId);
    archive.version = nextVersion;

    // Initialize progress tracking
    const progress: ArchiveProgress = {
      archiveId,
      url: normalizedUrl,
      status: ArchiveStatus.IN_PROGRESS,
      progress: {
        pagesDiscovered: 0,
        pagesCrawled: 0,
        assetsDownloaded: 0,
        totalSize: 0,
      },
      errors: [],
      startTime: new Date(),
    };
    this.activeArchives.set(archiveId, progress);

    try {
      // Initialize storage
      await this.fileService.initializeArchiveStorage(archiveId);

      // Save initial archive metadata
      await this.fileService.saveArchiveMetadata(archive);

      // Start archiving process asynchronously
      this.performArchiving(archive, options).catch(error => {
        console.error(`Archive ${archiveId} failed:`, error);
      });

      return archive;
    } catch (error) {
      // Clean up on initialization failure
      this.activeArchives.delete(archiveId);
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to create archive: ${message}`);
    }
  }

  /**
   * Get archive by ID
   */
  async getArchive(archiveId: string): Promise<Archive> {
    try {
      return await this.fileService.loadArchiveMetadata(archiveId);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Archive not found: ${message}`);
    }
  }

  /**
   * List all archives
   */
  async getArchives(): Promise<Archive[]> {
    try {
      const archiveIds = await this.fileService.listArchives();
      const archives: Archive[] = [];

      for (const archiveId of archiveIds) {
        try {
          const archive = await this.fileService.loadArchiveMetadata(archiveId);
          archives.push(archive);
        } catch (error) {
          // Skip corrupted archives
          console.warn(`Failed to load archive ${archiveId}:`, error);
        }
      }

      // Sort by timestamp (newest first)
      return archives.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to list archives: ${message}`);
    }
  }

  /**
   * Get all versions of a specific URL
   */
  async getArchiveVersions(url: string): Promise<Archive[]> {
    try {
      const normalizedUrl = normalizeUrl(url);
      if (!normalizedUrl) {
        throw new Error(`Invalid URL: ${url}`);
      }

      const allArchives = await this.getArchives();
      const urlVersions = allArchives.filter(archive => 
        normalizeUrl(archive.url) === normalizedUrl
      );

      // Sort by version number (newest first)
      return urlVersions.sort((a, b) => b.version - a.version);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to get archive versions: ${message}`);
    }
  }

  /**
   * Get grouped archives by URL with version information
   */
  async getArchivesByUrl(): Promise<{ [url: string]: Archive[] }> {
    try {
      const allArchives = await this.getArchives();
      const groupedArchives: { [url: string]: Archive[] } = {};

      for (const archive of allArchives) {
        const normalizedUrl = normalizeUrl(archive.url);
        if (!normalizedUrl) continue;

        if (!groupedArchives[normalizedUrl]) {
          groupedArchives[normalizedUrl] = [];
        }
        groupedArchives[normalizedUrl].push(archive);
      }

      // Sort each group by version number (newest first)
      for (const url in groupedArchives) {
        groupedArchives[url].sort((a, b) => b.version - a.version);
      }

      return groupedArchives;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to group archives by URL: ${message}`);
    }
  }

  /**
   * Get the latest version number for a URL
   */
  async getLatestVersionNumber(url: string): Promise<number> {
    try {
      const versions = await this.getArchiveVersions(url);
      return versions.length > 0 ? Math.max(...versions.map(v => v.version)) : 0;
    } catch (error) {
      // If no versions exist, return 0
      return 0;
    }
  }

  /**
   * Delete an archive
   */
  async deleteArchive(archiveId: string): Promise<void> {
    // Check if archive is currently being processed
    if (this.activeArchives.has(archiveId)) {
      throw new Error(`Cannot delete archive ${archiveId}: archiving in progress`);
    }

    try {
      await this.fileService.deleteArchive(archiveId);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to delete archive: ${message}`);
    }
  }

  /**
   * Get progress information for an active archive
   */
  getArchiveProgress(archiveId: string): ArchiveProgress | null {
    return this.activeArchives.get(archiveId) || null;
  }

  /**
   * Get progress information for all active archives
   */
  getActiveArchives(): ArchiveProgress[] {
    return Array.from(this.activeArchives.values());
  }

  /**
   * Check if an archive exists
   */
  async archiveExists(archiveId: string): Promise<boolean> {
    return await this.fileService.archiveExists(archiveId);
  }

  /**
   * Get archived content (HTML or asset)
   */
  async getArchivedContent(
    archiveId: string,
    contentPath: string
  ): Promise<{ content: Buffer | string; contentType: string }> {
    try {
      // Get archive metadata for URL rewriting
      const archive = await this.getArchive(archiveId);
      
      // Check if it's an HTML page
      if (contentPath.endsWith('.html') || contentPath === '' || contentPath === '/') {
        let pagePath = contentPath;
        
        // If no specific path is requested, find the home page
        if (!pagePath || pagePath === '/') {
          // Find the home page (usually the first page or one with path 'index.html')
          const homePage = archive.pages.find(page => 
            page.path === 'index.html' || 
            page.url === archive.url ||
            page.path.endsWith('/index.html')
          ) || archive.pages[0]; // Fallback to first page
          
          pagePath = homePage ? homePage.path : 'index.html';
        }
        
        const htmlContent = await this.fileService.getHtml(pagePath, archiveId);
        
        // Rewrite URLs in HTML content to point to archived assets
        const rewrittenHtml = this.fileService.rewriteUrls(htmlContent, archive.url, archiveId);
        
        return {
          content: rewrittenHtml,
          contentType: 'text/html; charset=utf-8',
        };
      }

      // Handle CSS files - need URL rewriting
      // Check for CSS files by extension OR if they're in the css directory
      const isCssFile = contentPath.endsWith('.css') || contentPath.includes('/assets/css/');
      if (isCssFile) {
        const cssContent = await this.fileService.getAsset(contentPath, archiveId);
        
        // Force CSS content type for files in css directory
        const contentType = contentPath.includes('/assets/css/') ? 'text/css' : this.getContentTypeFromPath(contentPath);
        
        // Rewrite URLs in CSS content to point to archived assets
        const cssString = cssContent.toString('utf-8');
        const rewrittenCss = this.fileService.rewriteCssUrls(cssString, archive.url, archiveId);
        
        return {
          content: rewrittenCss,
          contentType,
        };
      }

      // Handle other asset requests (images, JS, fonts, etc.)
      const assetContent = await this.fileService.getAsset(contentPath, archiveId);
      const contentType = this.getContentTypeFromPath(contentPath);
      
      return {
        content: assetContent,
        contentType,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to get archived content: ${message}`);
    }
  }

  // Private methods

  /**
   * Perform the actual archiving process
   */
  private async performArchiving(
    archive: Archive,
    options?: Partial<CrawlerOptions>
  ): Promise<void> {
    const archiveId = archive.id;
    const progress = this.activeArchives.get(archiveId);
    
    if (!progress) {
      throw new Error(`Archive progress not found for ${archiveId}`);
    }

    try {
      // Merge crawler options
      const crawlerOptions: CrawlerOptions = {
        ...this.defaultCrawlerOptions,
        ...options,
      };

      // Set up a timeout for the entire archiving process (10 minutes max)
      const archiveTimeout = 600000; // 10 minutes
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new Error('Archive process timed out after 10 minutes'));
        }, archiveTimeout);
      });

      // Initialize crawler before starting
      await this.crawlerService.initialize();
      
      // Start crawling with progress updates and timeout
      const crawlResult = await Promise.race([
        this.crawlerService.crawlSite(archive.url, crawlerOptions, (crawlProgress) => {
          // Update progress in real-time
          progress.progress.pagesDiscovered = crawlProgress.pagesFound;
          progress.progress.pagesCrawled = crawlProgress.pagesCrawled;
          progress.currentUrl = crawlProgress.currentUrl;
          console.log(`Progress: ${crawlProgress.pagesCrawled}/${crawlProgress.pagesFound} pages crawled`);
        }),
        timeoutPromise
      ]);

      // Update progress
      progress.progress.pagesDiscovered = crawlResult.pages.length;
      progress.errors.push(...crawlResult.errors);

      // Collect all assets first
      const allAssets: Asset[] = [];
      for (const page of crawlResult.pages) {
        allAssets.push(...page.assets);
      }

      // Download and save assets first (this sets the localPath for each asset)
      await this.downloadAssets(allAssets, archiveId, progress);

      // Now process and save each page with correct asset mappings
      const processedPages: ArchivedPage[] = [];
      for (const page of crawlResult.pages) {
        try {
          const processedPage = await this.processPage(page, archiveId);
          processedPages.push(processedPage);
          
          progress.progress.pagesCrawled++;
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          progress.errors.push({
            timestamp: new Date(),
            type: ErrorType.STORAGE_ERROR,
            message: `Failed to process page ${page.url}: ${message}`,
            url: page.url,
            recoverable: false,
          });
        }
      }

      // Update archive with final results
      const finalArchive: Archive = {
        ...archive,
        status: progress.errors.length > 0 ? ArchiveStatus.PARTIAL : ArchiveStatus.COMPLETED,
        pages: processedPages,
        errors: progress.errors,
        metadata: {
          pageCount: processedPages.length,
          assetCount: allAssets.length,
          totalSize: progress.progress.totalSize,
          crawlDuration: crawlResult.duration,
        },
      };

      // Save final archive metadata
      await this.fileService.saveArchiveMetadata(finalArchive);

      // Update progress status
      progress.status = finalArchive.status;

    } catch (error) {
      // Handle archiving failure
      console.error('Archive failed with error:', error);
      const message = error instanceof Error ? error.message : (typeof error === 'object' ? JSON.stringify(error) : String(error));
      const isTimeout = message.includes('timeout') || message.includes('timed out');
      
      // If it's a timeout, mark as partial instead of failed
      progress.status = isTimeout ? ArchiveStatus.PARTIAL : ArchiveStatus.FAILED;
      progress.errors.push({
        timestamp: new Date(),
        type: isTimeout ? ErrorType.TIMEOUT_ERROR : ErrorType.NETWORK_ERROR,
        message: isTimeout ? 
          `Archive partially completed due to timeout: ${message}` : 
          `Archive failed: ${message}`,
        recoverable: false,
      });

      // Save failed/partial archive state
      try {
        const finalArchive: Archive = {
          ...archive,
          status: progress.status,
          errors: progress.errors,
          metadata: {
            pageCount: progress.progress.pagesCrawled,
            assetCount: progress.progress.assetsDownloaded,
            totalSize: progress.progress.totalSize,
            crawlDuration: Date.now() - progress.startTime.getTime(),
          },
        };
        await this.fileService.saveArchiveMetadata(finalArchive);
      } catch (saveError) {
        console.error(`Failed to save archive state:`, saveError);
      }
    } finally {
      // Clean up active archive tracking
      setTimeout(() => {
        this.activeArchives.delete(archiveId);
      }, 60000); // Keep progress info for 1 minute after completion
    }
  }

  /**
   * Process a single page: save HTML and extract assets
   */
  private async processPage(page: ArchivedPage, archiveId: string): Promise<ArchivedPage> {
    // Use the actual HTML content from the crawler, or fallback to a basic page
    const htmlContent = page.htmlContent || `<!DOCTYPE html><html><head><title>${page.title}</title></head><body><h1>Page: ${page.url}</h1><p>Content not available</p></body></html>`;
    
    // Rewrite URLs in HTML content to point to archived assets
    const rewrittenHtml = await this.rewriteHtmlUrls(htmlContent, page, archiveId);
    
    // Save rewritten HTML content
    await this.fileService.saveHtml(rewrittenHtml, page.path, archiveId);

    // Remove htmlContent from the page object to avoid storing it in metadata
    const { htmlContent: _, ...pageWithoutHtml } = page;
    return pageWithoutHtml;
  }

  /**
   * Rewrite URLs in HTML content to point to archived assets
   */
  private async rewriteHtmlUrls(htmlContent: string, page: ArchivedPage, archiveId: string): Promise<string> {
    const { UrlRewriter } = await import('../utils/url-rewriter');
    
    // Create asset mappings for this page
    const assetMappings: AssetPathMapping[] = page.assets.map(asset => ({
      originalUrl: asset.originalUrl,
      localPath: asset.localPath,
      assetType: asset.type,
    }));
    
    // Create URL rewriter
    const rewriter = new UrlRewriter({
      archiveId,
      baseUrl: page.url,
    });
    
    // Add asset mappings
    rewriter.addAssetMappings(assetMappings);
    
    // Rewrite HTML URLs
    return rewriter.rewriteHtmlUrls(htmlContent);
  }

  /**
   * Rewrite URLs in CSS content to point to archived assets
   */
  private async rewriteCssUrls(cssContent: string, cssUrl: string, archiveId: string, allAssets: Asset[]): Promise<string> {
    const { UrlRewriter } = await import('../utils/url-rewriter');
    
    // Create asset mappings for all assets
    const assetMappings: AssetPathMapping[] = allAssets.map(asset => ({
      originalUrl: asset.originalUrl,
      localPath: asset.localPath,
      assetType: asset.type,
    }));
    
    // Create URL rewriter with CSS file as base URL
    const rewriter = new UrlRewriter({
      archiveId,
      baseUrl: cssUrl,
    });
    
    // Add asset mappings
    rewriter.addAssetMappings(assetMappings);
    
    // Rewrite CSS URLs
    return rewriter.rewriteCssUrls(cssContent);
  }

  /**
   * Download and save all assets
   */
  private async downloadAssets(
    assets: Asset[],
    archiveId: string,
    progress: ArchiveProgress
  ): Promise<void> {
    const downloadPromises = assets.map(async (asset) => {
      try {
        console.log(`📥 Downloading asset: ${asset.originalUrl}`);
        
        // Actually download the asset content
        let assetContent = await this.downloadAssetContent(asset.originalUrl);
        
        // If it's a CSS file, rewrite URLs within it
        if (asset.type === AssetType.CSS && assetContent.length > 0) {
          try {
            const cssText = assetContent.toString('utf-8');
            const rewrittenCss = await this.rewriteCssUrls(cssText, asset.originalUrl, archiveId, assets);
            assetContent = Buffer.from(rewrittenCss, 'utf-8');
            console.log(`🎨 Rewrote CSS URLs in: ${asset.originalUrl}`);
          } catch (error) {
            console.warn(`⚠️ Failed to rewrite CSS URLs in ${asset.originalUrl}:`, error);
          }
        }
        
        const localPath = await this.fileService.saveAsset(
          asset.originalUrl,
          assetContent,
          archiveId,
          asset.type
        );

        // Update asset with actual local path and size
        asset.localPath = localPath;
        asset.size = assetContent.length;
        
        progress.progress.assetsDownloaded++;
        progress.progress.totalSize += asset.size;
        
        console.log(`✅ Downloaded asset: ${asset.originalUrl} (${assetContent.length} bytes) -> ${localPath}`);

      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`❌ Failed to download asset ${asset.originalUrl}:`, message);
        
        progress.errors.push({
          timestamp: new Date(),
          type: ErrorType.STORAGE_ERROR,
          message: `Failed to download asset ${asset.originalUrl}: ${message}`,
          url: asset.originalUrl,
          recoverable: true,
        });
        
        // Create fallback content for failed downloads
        const fallbackContent = Buffer.from(`/* Failed to load asset: ${asset.originalUrl} */`);
        try {
          const localPath = await this.fileService.saveAsset(
            asset.originalUrl,
            fallbackContent,
            archiveId,
            asset.type
          );
          asset.localPath = localPath;
          asset.size = fallbackContent.length;
        } catch (fallbackError) {
          console.error(`❌ Failed to save fallback content for ${asset.originalUrl}:`, fallbackError);
        }
      }
    });

    // Wait for all downloads to complete (with some concurrency control)
    const batchSize = 5;
    for (let i = 0; i < downloadPromises.length; i += batchSize) {
      const batch = downloadPromises.slice(i, i + batchSize);
      await Promise.allSettled(batch);
    }
  }

  /**
   * Download actual asset content from URL
   */
  private async downloadAssetContent(url: string): Promise<Buffer> {
    try {
      const response = await axios.get(url, {
        responseType: 'arraybuffer',
        timeout: 15000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; WebArchiver/1.0; +https://webarchiver.com/bot)',
          'Accept': '*/*',
          'Accept-Language': 'en-US,en;q=0.5',
          'Accept-Encoding': 'gzip, deflate',
          'Connection': 'keep-alive',
        },
        maxRedirects: 5,
        validateStatus: (status) => status < 400,
      });
      
      return Buffer.from(response.data);
    } catch (error: any) {
      if (error.code === 'ECONNABORTED') {
        throw new Error(`Download timeout for ${url}`);
      } else if (error.response) {
        throw new Error(`HTTP ${error.response.status}: ${error.response.statusText} for ${url}`);
      } else {
        throw new Error(`Network error downloading ${url}: ${error.message || String(error)}`);
      }
    }
  }

  /**
   * Determine content type from file path
   */
  private getContentTypeFromPath(filePath: string): string {
    const ext = filePath.split('.').pop()?.toLowerCase();
    
    switch (ext) {
      case 'html':
      case 'htm':
        return 'text/html; charset=utf-8';
      case 'css':
        return 'text/css';
      case 'js':
        return 'application/javascript';
      case 'json':
        return 'application/json';
      case 'png':
        return 'image/png';
      case 'jpg':
      case 'jpeg':
        return 'image/jpeg';
      case 'gif':
        return 'image/gif';
      case 'svg':
        return 'image/svg+xml';
      case 'woff':
        return 'font/woff';
      case 'woff2':
        return 'font/woff2';
      case 'ttf':
        return 'font/ttf';
      default:
        return 'application/octet-stream';
    }
  }
}