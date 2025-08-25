export interface Archive {
  id: string;
  url: string;
  domain: string;
  timestamp: Date;
  status: ArchiveStatus;
  version: number;
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

export enum ArchiveStatus {
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  FAILED = 'failed',
  PARTIAL = 'partial'
}

export interface ArchivedPage {
  url: string;
  path: string;
  title: string;
  timestamp: Date;
  assets: Asset[];
  links: string[];
}

export interface Asset {
  originalUrl: string;
  localPath: string;
  type: AssetType;
  size: number;
  contentType: string;
}

export enum AssetType {
  HTML = 'html',
  CSS = 'css',
  JAVASCRIPT = 'javascript',
  IMAGE = 'image',
  FONT = 'font',
  OTHER = 'other'
}

export interface ArchiveError {
  timestamp: Date;
  type: string;
  message: string;
  url?: string;
  stack?: string;
  recoverable: boolean;
}

export interface ApiError {
  message: string;
  code?: string;
  details?: any;
}