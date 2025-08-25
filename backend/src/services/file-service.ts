import * as fs from 'fs/promises';
import * as path from 'path';
import { Archive, Asset, AssetType, ArchiveError, ErrorType } from '../types';
import { UrlRewriter, AssetPathMapping, createUrlRewriter } from '../utils/url-rewriter';

export interface FileServiceOptions {
  baseStoragePath: string;
}

export class FileService {
  private baseStoragePath: string;

  constructor(options: FileServiceOptions) {
    this.baseStoragePath = options.baseStoragePath;
  }

  /**
   * Initialize storage directory structure for an archive
   */
  async initializeArchiveStorage(archiveId: string): Promise<void> {
    const archivePath = this.getArchivePath(archiveId);
    const pagesPath = path.join(archivePath, 'pages');
    const assetsPath = path.join(archivePath, 'assets');
    const assetSubPaths = ['css', 'js', 'images', 'fonts', 'other'];

    try {
      // Create main archive directory
      await fs.mkdir(archivePath, { recursive: true });
      
      // Create pages directory
      await fs.mkdir(pagesPath, { recursive: true });
      
      // Create assets directory and subdirectories
      await fs.mkdir(assetsPath, { recursive: true });
      for (const subPath of assetSubPaths) {
        await fs.mkdir(path.join(assetsPath, subPath), { recursive: true });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to initialize archive storage: ${message}`);
    }
  }

  /**
   * Save HTML content to the archive
   */
  async saveHtml(content: string, pagePath: string, archiveId: string): Promise<string> {
    const archivePath = this.getArchivePath(archiveId);
    const fullPath = path.join(archivePath, 'pages', pagePath);
    
    try {
      // Ensure directory exists
      await fs.mkdir(path.dirname(fullPath), { recursive: true });
      
      // Save HTML content
      await fs.writeFile(fullPath, content, 'utf-8');
      
      return fullPath;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to save HTML content: ${message}`);
    }
  }

  /**
   * Save asset content to the archive
   */
  async saveAsset(originalUrl: string, content: Buffer, archiveId: string, assetType: AssetType): Promise<string> {
    const fileName = this.generateAssetFileName(originalUrl, assetType);
    const assetSubDir = this.getAssetSubDirectory(assetType);
    const relativePath = path.join('assets', assetSubDir, fileName);
    const fullPath = path.join(this.getArchivePath(archiveId), relativePath);
    
    try {
      // Ensure directory exists
      await fs.mkdir(path.dirname(fullPath), { recursive: true });
      
      // Save asset content
      await fs.writeFile(fullPath, content);
      
      return relativePath;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to save asset: ${message}`);
    }
  }

  /**
   * Retrieve HTML content from the archive
   */
  async getHtml(pagePath: string, archiveId: string): Promise<string> {
    const fullPath = path.join(this.getArchivePath(archiveId), 'pages', pagePath);
    
    try {
      return await fs.readFile(fullPath, 'utf-8');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to retrieve HTML content: ${message}`);
    }
  }

  /**
   * Retrieve asset content from the archive
   */
  async getAsset(assetPath: string, archiveId: string): Promise<Buffer> {
    const fullPath = path.join(this.getArchivePath(archiveId), assetPath);
    
    try {
      return await fs.readFile(fullPath);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to retrieve asset: ${message}`);
    }
  }

  /**
   * Save archive metadata to JSON file
   */
  async saveArchiveMetadata(archive: Archive): Promise<void> {
    const metadataPath = path.join(this.getArchivePath(archive.id), 'manifest.json');
    
    try {
      await fs.writeFile(metadataPath, JSON.stringify(archive, null, 2), 'utf-8');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to save archive metadata: ${message}`);
    }
  }

  /**
   * Load archive metadata from JSON file
   */
  async loadArchiveMetadata(archiveId: string): Promise<Archive> {
    const metadataPath = path.join(this.getArchivePath(archiveId), 'manifest.json');
    
    try {
      const content = await fs.readFile(metadataPath, 'utf-8');
      const archive = JSON.parse(content) as Archive;
      
      // Convert timestamp strings back to Date objects
      archive.timestamp = new Date(archive.timestamp);
      archive.pages.forEach(page => {
        page.timestamp = new Date(page.timestamp);
      });
      archive.errors.forEach(error => {
        error.timestamp = new Date(error.timestamp);
      });
      
      return archive;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to load archive metadata: ${message}`);
    }
  }

  /**
   * List all archives by reading directory structure
   */
  async listArchives(): Promise<string[]> {
    try {
      const entries = await fs.readdir(this.baseStoragePath, { withFileTypes: true });
      return entries
        .filter(entry => entry.isDirectory())
        .map(entry => entry.name);
    } catch (error) {
      if (error instanceof Error && (error as any).code === 'ENOENT') {
        return [];
      }
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to list archives: ${message}`);
    }
  }

  /**
   * Delete an entire archive
   */
  async deleteArchive(archiveId: string): Promise<void> {
    const archivePath = this.getArchivePath(archiveId);
    
    try {
      await fs.rm(archivePath, { recursive: true, force: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to delete archive: ${message}`);
    }
  }

  /**
   * Check if an archive exists
   */
  async archiveExists(archiveId: string): Promise<boolean> {
    const archivePath = this.getArchivePath(archiveId);
    
    try {
      await fs.access(archivePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get the total size of an archive
   */
  async getArchiveSize(archiveId: string): Promise<number> {
    const archivePath = this.getArchivePath(archiveId);
    
    try {
      return await this.getDirectorySize(archivePath);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to calculate archive size: ${message}`);
    }
  }

  /**
   * Rewrite URLs in HTML content to point to local assets
   */
  rewriteUrls(html: string, baseUrl: string, archiveId: string, assetMappings: AssetPathMapping[] = []): string {
    const rewriter = createUrlRewriter({
      archiveId,
      baseUrl,
    });
    
    rewriter.addAssetMappings(assetMappings);
    return rewriter.rewriteHtmlUrls(html);
  }

  /**
   * Rewrite URLs in CSS content to point to local assets
   */
  rewriteCssUrls(css: string, baseUrl: string, archiveId: string, assetMappings: AssetPathMapping[] = []): string {
    const rewriter = createUrlRewriter({
      archiveId,
      baseUrl,
    });
    
    rewriter.addAssetMappings(assetMappings);
    return rewriter.rewriteCssUrls(css);
  }

  // Private helper methods

  private getArchivePath(archiveId: string): string {
    return path.join(this.baseStoragePath, archiveId);
  }

  private generateAssetFileName(url: string, assetType?: AssetType): string {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname;
    const fileName = path.basename(pathname) || 'index';
    
    // Determine the correct extension based on asset type
    const correctExtension = this.getCorrectExtension(assetType, fileName);
    
    // Add query parameters as suffix if present
    if (urlObj.search) {
      const queryHash = Buffer.from(urlObj.search).toString('base64').slice(0, 8);
      const name = path.basename(fileName, path.extname(fileName));
      return `${name}_${queryHash}${correctExtension}`;
    }
    
    // If the file already has the correct extension, keep it
    if (path.extname(fileName).toLowerCase() === correctExtension) {
      return fileName;
    }
    
    // Replace extension with correct one
    const name = path.basename(fileName, path.extname(fileName));
    return `${name}${correctExtension}`;
  }

  private getCorrectExtension(assetType?: AssetType, fileName?: string): string {
    if (assetType) {
      switch (assetType) {
        case AssetType.CSS:
          return '.css';
        case AssetType.JAVASCRIPT:
          return '.js';
        case AssetType.IMAGE:
          // Try to preserve original image extension if valid
          if (fileName) {
            const ext = path.extname(fileName).toLowerCase();
            if (['.jpg', '.jpeg', '.png', '.gif', '.svg', '.webp', '.bmp', '.ico'].includes(ext)) {
              return ext;
            }
          }
          return '.png'; // Default image extension
        case AssetType.FONT:
          // Try to preserve original font extension if valid
          if (fileName) {
            const ext = path.extname(fileName).toLowerCase();
            if (['.woff', '.woff2', '.ttf', '.otf', '.eot'].includes(ext)) {
              return ext;
            }
          }
          return '.woff'; // Default font extension
        case AssetType.HTML:
          return '.html';
        default:
          return fileName ? path.extname(fileName) || '.bin' : '.bin';
      }
    }
    
    // Fallback to original extension
    return fileName ? path.extname(fileName) || '.bin' : '.bin';
  }

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
      default:
        return 'other';
    }
  }



  private async getDirectorySize(dirPath: string): Promise<number> {
    let totalSize = 0;
    
    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        
        if (entry.isDirectory()) {
          totalSize += await this.getDirectorySize(fullPath);
        } else {
          const stats = await fs.stat(fullPath);
          totalSize += stats.size;
        }
      }
    } catch (error) {
      // Ignore errors for individual files/directories
    }
    
    return totalSize;
  }
}