import { Archive, ArchivedPage, Asset, ArchiveStatus, AssetType, ErrorType } from '../types';
import { isValidUrl, extractDomain } from './url-utils';

/**
 * Validates an Archive object
 * @param archive - Archive object to validate
 * @returns Array of validation errors (empty if valid)
 */
export function validateArchive(archive: any): string[] {
  const errors: string[] = [];

  if (!archive) {
    errors.push('Archive object is required');
    return errors;
  }

  // Validate required fields
  if (!archive.id || typeof archive.id !== 'string') {
    errors.push('Archive ID must be a non-empty string');
  }

  if (!archive.url || typeof archive.url !== 'string') {
    errors.push('Archive URL must be a non-empty string');
  } else if (!isValidUrl(archive.url)) {
    errors.push('Archive URL must be a valid HTTP/HTTPS URL');
  }

  if (!archive.domain || typeof archive.domain !== 'string') {
    errors.push('Archive domain must be a non-empty string');
  } else if (archive.url && extractDomain(archive.url) !== archive.domain) {
    errors.push('Archive domain must match the URL domain');
  }

  if (!archive.timestamp || !(archive.timestamp instanceof Date)) {
    errors.push('Archive timestamp must be a valid Date object');
  }

  if (!Object.values(ArchiveStatus).includes(archive.status)) {
    errors.push('Archive status must be a valid ArchiveStatus enum value');
  }

  if (typeof archive.version !== 'number' || archive.version < 1) {
    errors.push('Archive version must be a positive number');
  }

  // Validate metadata
  if (!archive.metadata || typeof archive.metadata !== 'object') {
    errors.push('Archive metadata must be an object');
  } else {
    const { pageCount, assetCount, totalSize, crawlDuration } = archive.metadata;
    
    if (typeof pageCount !== 'number' || pageCount < 0) {
      errors.push('Metadata pageCount must be a non-negative number');
    }
    
    if (typeof assetCount !== 'number' || assetCount < 0) {
      errors.push('Metadata assetCount must be a non-negative number');
    }
    
    if (typeof totalSize !== 'number' || totalSize < 0) {
      errors.push('Metadata totalSize must be a non-negative number');
    }
    
    if (typeof crawlDuration !== 'number' || crawlDuration < 0) {
      errors.push('Metadata crawlDuration must be a non-negative number');
    }
  }

  // Validate pages array
  if (!Array.isArray(archive.pages)) {
    errors.push('Archive pages must be an array');
  } else {
    archive.pages.forEach((page: any, index: number) => {
      const pageErrors = validateArchivedPage(page);
      pageErrors.forEach(error => errors.push(`Page ${index}: ${error}`));
    });
  }

  // Validate errors array
  if (!Array.isArray(archive.errors)) {
    errors.push('Archive errors must be an array');
  }

  return errors;
}

/**
 * Validates an ArchivedPage object
 * @param page - ArchivedPage object to validate
 * @returns Array of validation errors (empty if valid)
 */
export function validateArchivedPage(page: any): string[] {
  const errors: string[] = [];

  if (!page) {
    errors.push('ArchivedPage object is required');
    return errors;
  }

  if (!page.url || typeof page.url !== 'string') {
    errors.push('ArchivedPage URL must be a non-empty string');
  } else if (!isValidUrl(page.url)) {
    errors.push('ArchivedPage URL must be a valid HTTP/HTTPS URL');
  }

  if (!page.path || typeof page.path !== 'string') {
    errors.push('ArchivedPage path must be a non-empty string');
  }

  if (!page.title || typeof page.title !== 'string') {
    errors.push('ArchivedPage title must be a non-empty string');
  }

  if (!page.timestamp || !(page.timestamp instanceof Date)) {
    errors.push('ArchivedPage timestamp must be a valid Date object');
  }

  if (!Array.isArray(page.assets)) {
    errors.push('ArchivedPage assets must be an array');
  } else {
    page.assets.forEach((asset: any, index: number) => {
      const assetErrors = validateAsset(asset);
      assetErrors.forEach(error => errors.push(`Asset ${index}: ${error}`));
    });
  }

  if (!Array.isArray(page.links)) {
    errors.push('ArchivedPage links must be an array');
  } else {
    page.links.forEach((link: any, index: number) => {
      if (typeof link !== 'string') {
        errors.push(`Link ${index}: must be a string`);
      } else if (!isValidUrl(link)) {
        errors.push(`Link ${index}: must be a valid URL`);
      }
    });
  }

  return errors;
}

/**
 * Validates an Asset object
 * @param asset - Asset object to validate
 * @returns Array of validation errors (empty if valid)
 */
export function validateAsset(asset: any): string[] {
  const errors: string[] = [];

  if (!asset) {
    errors.push('Asset object is required');
    return errors;
  }

  if (!asset.originalUrl || typeof asset.originalUrl !== 'string') {
    errors.push('Asset originalUrl must be a non-empty string');
  } else if (!isValidUrl(asset.originalUrl)) {
    errors.push('Asset originalUrl must be a valid HTTP/HTTPS URL');
  }

  if (!asset.localPath || typeof asset.localPath !== 'string') {
    errors.push('Asset localPath must be a non-empty string');
  }

  if (!Object.values(AssetType).includes(asset.type)) {
    errors.push('Asset type must be a valid AssetType enum value');
  }

  if (typeof asset.size !== 'number' || asset.size < 0) {
    errors.push('Asset size must be a non-negative number');
  }

  if (!asset.contentType || typeof asset.contentType !== 'string') {
    errors.push('Asset contentType must be a non-empty string');
  }

  return errors;
}

/**
 * Creates a valid Archive object with default values
 * @param url - The URL to archive
 * @param id - Optional ID (will generate if not provided)
 * @returns A valid Archive object
 */
export function createArchive(url: string, id?: string): Archive {
  if (!isValidUrl(url)) {
    throw new Error('Invalid URL provided');
  }

  const domain = extractDomain(url);
  if (!domain) {
    throw new Error('Could not extract domain from URL');
  }

  return {
    id: id || generateArchiveId(),
    url,
    domain,
    timestamp: new Date(),
    status: ArchiveStatus.IN_PROGRESS,
    version: 1, // Default version, will be updated by ArchiveService
    metadata: {
      pageCount: 0,
      assetCount: 0,
      totalSize: 0,
      crawlDuration: 0,
    },
    pages: [],
    errors: [],
  };
}

/**
 * Generates a unique archive ID
 * @returns A unique string ID
 */
function generateArchiveId(): string {
  return `archive_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}