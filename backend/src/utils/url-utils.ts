import { URL } from 'url';

/**
 * Validates if a string is a valid URL
 * @param urlString - The URL string to validate
 * @returns true if valid URL, false otherwise
 */
export function isValidUrl(urlString: string): boolean {
  try {
    const url = new URL(urlString);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Extracts the domain from a URL
 * @param urlString - The URL string to extract domain from
 * @returns The domain string or null if invalid URL
 */
export function extractDomain(urlString: string): string | null {
  try {
    const url = new URL(urlString);
    return url.hostname;
  } catch {
    return null;
  }
}

/**
 * Checks if two URLs belong to the same domain
 * @param url1 - First URL
 * @param url2 - Second URL
 * @returns true if same domain, false otherwise
 */
export function isSameDomain(url1: string, url2: string): boolean {
  const domain1 = extractDomain(url1);
  const domain2 = extractDomain(url2);
  
  if (!domain1 || !domain2) {
    return false;
  }
  
  return domain1 === domain2;
}

/**
 * Normalizes a URL by removing fragments but preserving the path structure
 * @param urlString - The URL to normalize
 * @returns Normalized URL string or null if invalid
 */
export function normalizeUrl(urlString: string): string | null {
  try {
    const url = new URL(urlString);
    // Remove fragment (hash) but preserve everything else
    url.hash = '';
    
    // Only remove trailing slash if it's the root path and there are no query parameters
    // This preserves the user's intent for specific paths
    if (url.pathname === '/' && !url.search) {
      // For root URLs like "https://example.com/", keep as is
      return url.toString();
    }
    
    // For other paths, preserve the trailing slash if it was there originally
    // This is important for URLs like "https://example.com/blog/" vs "https://example.com/blog"
    return url.toString();
  } catch {
    return null;
  }
}

/**
 * Resolves a relative URL against a base URL
 * @param relativeUrl - The relative URL
 * @param baseUrl - The base URL to resolve against
 * @returns Resolved absolute URL or null if invalid
 */
export function resolveUrl(relativeUrl: string, baseUrl: string): string | null {
  try {
    const url = new URL(relativeUrl, baseUrl);
    return url.toString();
  } catch {
    return null;
  }
}

/**
 * Validates if a URL is within the same domain as the base URL
 * @param targetUrl - URL to validate
 * @param baseDomain - Base domain to check against
 * @returns true if URL is within the same domain
 */
export function isValidUrlForDomain(targetUrl: string, baseDomain: string): boolean {
  if (!isValidUrl(targetUrl)) {
    return false;
  }
  
  const targetDomain = extractDomain(targetUrl);
  return targetDomain === baseDomain;
}