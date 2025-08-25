// Core data types for the web archiving tool

export enum ArchiveStatus {
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  FAILED = 'failed',
  PARTIAL = 'partial',
}

export enum AssetType {
  HTML = 'html',
  CSS = 'css',
  JAVASCRIPT = 'javascript',
  IMAGE = 'image',
  FONT = 'font',
  OTHER = 'other',
}

export enum ErrorType {
  NETWORK_ERROR = 'network_error',
  CONTENT_ERROR = 'content_error',
  STORAGE_ERROR = 'storage_error',
  VALIDATION_ERROR = 'validation_error',
  TIMEOUT_ERROR = 'timeout_error',
  PERMISSION_ERROR = 'permission_error',
}

export interface Asset {
  originalUrl: string;
  localPath: string;
  type: AssetType;
  size: number;
  contentType: string;
}

export interface ArchivedPage {
  url: string;
  path: string;
  title: string;
  timestamp: Date;
  assets: Asset[];
  links: string[];
  htmlContent?: string; // Optional HTML content for storage
}

export interface ArchiveError {
  timestamp: Date;
  type: ErrorType;
  message: string;
  url?: string;
  stack?: string;
  recoverable: boolean;
}

export interface Archive {
  id: string;
  url: string;
  domain: string;
  timestamp: Date;
  status: ArchiveStatus;
  version: number; // Version number for this URL
  metadata: {
    pageCount: number;
    assetCount: number;
    totalSize: number;
    crawlDuration: number;
  };
  pages: ArchivedPage[];
  errors: ArchiveError[];
}

export interface ArchiveVersion {
  url: string;
  domain: string;
  versions: Archive[];
  latestVersion: Archive;
  totalVersions: number;
}

export interface CrawlerOptions {
  maxDepth: number;
  maxPages: number;
  timeout: number;
  respectRobots: boolean;
}

export interface CrawlResult {
  pages: ArchivedPage[];
  errors: ArchiveError[];
  totalSize: number;
  duration: number;
}

// Re-export utility functions for convenience
export {
  isValidUrl,
  extractDomain,
  isSameDomain,
  normalizeUrl,
  resolveUrl,
  isValidUrlForDomain,
} from '../utils/url-utils';

export {
  validateArchive,
  validateArchivedPage,
  validateAsset,
  createArchive,
} from '../utils/validation';

export {
  UrlRewriter,
  createUrlRewriter,
  rewriteHtmlUrls,
  rewriteCssUrls,
} from '../utils/url-rewriter';

export type {
  UrlRewriteOptions,
  AssetPathMapping,
} from '../utils/url-rewriter';