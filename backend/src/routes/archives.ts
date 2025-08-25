import { Router, Request, Response } from 'express';
import { ArchiveService } from '../services/archive-service';
import { CrawlerOptions } from '../types';
import path from 'path';
import config from '../config';

// Basic input sanitization
function sanitizeUrl(url: string): string {
  return url.trim().replace(/[<>'"]/g, '');
}

function isValidUrl(url: string): boolean {
  try {
    const urlObj = new URL(url);
    return ['http:', 'https:'].includes(urlObj.protocol);
  } catch {
    return false;
  }
}

// Factory function to create router with optional service injection
export function createArchiveRouter(injectedArchiveService?: ArchiveService): Router {
    const router = Router();

    // Initialize archive service with configuration or use injected one
    const archiveService = injectedArchiveService || new ArchiveService({
        storageBasePath: path.join(process.cwd(), config.storageBasePath),
        defaultCrawlerOptions: config.crawler,
        maxConcurrentArchives: config.maxConcurrentArchives,
    });

    /**
     * POST /api/archives
     * Create a new archive
     */
    router.post('/', async (req: Request, res: Response) => {
        try {
            const { url, options } = req.body;

            if (!url) {
                return res.status(400).json({
                    error: 'URL is required',
                    code: 'MISSING_URL',
                });
            }

            if (typeof url !== 'string') {
                return res.status(400).json({
                    error: 'URL must be a string',
                    code: 'INVALID_URL_TYPE',
                });
            }

            // Sanitize and validate URL
            const sanitizedUrl = sanitizeUrl(url);
            if (!isValidUrl(sanitizedUrl)) {
                return res.status(400).json({
                    error: 'Invalid URL format. Must be a valid HTTP or HTTPS URL',
                    code: 'INVALID_URL_FORMAT',
                });
            }

            // Validate crawler options if provided
            let crawlerOptions: Partial<CrawlerOptions> | undefined;
            if (options) {
                crawlerOptions = {};
                if (options.maxDepth !== undefined) {
                    if (typeof options.maxDepth !== 'number' || options.maxDepth < 1 || options.maxDepth > 10) {
                        return res.status(400).json({
                            error: 'maxDepth must be a number between 1 and 10',
                            code: 'INVALID_MAX_DEPTH',
                        });
                    }
                    crawlerOptions.maxDepth = options.maxDepth;
                }
                if (options.maxPages !== undefined) {
                    if (typeof options.maxPages !== 'number' || options.maxPages < 1 || options.maxPages > 1000) {
                        return res.status(400).json({
                            error: 'maxPages must be a number between 1 and 1000',
                            code: 'INVALID_MAX_PAGES',
                        });
                    }
                    crawlerOptions.maxPages = options.maxPages;
                }
                if (options.timeout !== undefined) {
                    if (typeof options.timeout !== 'number' || options.timeout < 1000 || options.timeout > 120000) {
                        return res.status(400).json({
                            error: 'timeout must be a number between 1000 and 120000 milliseconds',
                            code: 'INVALID_TIMEOUT',
                        });
                    }
                    crawlerOptions.timeout = options.timeout;
                }
                if (options.respectRobots !== undefined) {
                    if (typeof options.respectRobots !== 'boolean') {
                        return res.status(400).json({
                            error: 'respectRobots must be a boolean',
                            code: 'INVALID_RESPECT_ROBOTS',
                        });
                    }
                    crawlerOptions.respectRobots = options.respectRobots;
                }
            }

            const archive = await archiveService.createArchive(sanitizedUrl, crawlerOptions);

            return res.status(201).json({
                success: true,
                data: archive,
            });
        } catch (error) {
            console.error('Error creating archive:', error);

            const message = error instanceof Error ? error.message : 'Unknown error occurred';

            // Handle specific error types
            if (message.includes('Invalid URL')) {
                return res.status(400).json({
                    error: message,
                    code: 'INVALID_URL',
                });
            }

            if (message.includes('Maximum concurrent archives')) {
                return res.status(429).json({
                    error: message,
                    code: 'TOO_MANY_CONCURRENT_ARCHIVES',
                });
            }

            if (message.includes('already in progress')) {
                return res.status(409).json({
                    error: message,
                    code: 'ARCHIVE_IN_PROGRESS',
                });
            }

            return res.status(500).json({
                error: 'Failed to create archive',
                code: 'INTERNAL_ERROR',
                details: message,
            });
        }
    });

    /**
     * GET /api/archives
     * List all archives
     */
    router.get('/', async (req: Request, res: Response) => {
        try {
            const archives = await archiveService.getArchives();

            return res.json({
                success: true,
                data: archives,
                count: archives.length,
            });
        } catch (error) {
            console.error('Error listing archives:', error);

            const message = error instanceof Error ? error.message : 'Unknown error occurred';

            return res.status(500).json({
                error: 'Failed to list archives',
                code: 'INTERNAL_ERROR',
                details: message,
            });
        }
    });

    /**
     * GET /api/archives/versions/:encodedUrl
     * Get all versions of a specific URL
     */
    router.get('/versions/:encodedUrl', async (req: Request, res: Response) => {
        try {
            const { encodedUrl } = req.params;

            if (!encodedUrl) {
                return res.status(400).json({
                    error: 'URL is required',
                    code: 'MISSING_URL',
                });
            }

            // Decode the URL
            let url: string;
            try {
                url = decodeURIComponent(encodedUrl);
            } catch (error) {
                return res.status(400).json({
                    error: 'Invalid URL encoding',
                    code: 'INVALID_URL_ENCODING',
                });
            }

            const versions = await archiveService.getArchiveVersions(url);

            return res.json({
                success: true,
                data: versions,
                count: versions.length,
            });
        } catch (error) {
            console.error('Error getting archive versions:', error);

            const message = error instanceof Error ? error.message : 'Unknown error occurred';

            if (message.includes('Invalid URL')) {
                return res.status(400).json({
                    error: message,
                    code: 'INVALID_URL',
                });
            }

            return res.status(500).json({
                error: 'Failed to get archive versions',
                code: 'INTERNAL_ERROR',
                details: message,
            });
        }
    });

    /**
     * GET /api/archives/grouped
     * Get archives grouped by URL
     */
    router.get('/grouped', async (req: Request, res: Response) => {
        try {
            const groupedArchives = await archiveService.getArchivesByUrl();

            return res.json({
                success: true,
                data: groupedArchives,
                count: Object.keys(groupedArchives).length,
            });
        } catch (error) {
            console.error('Error getting grouped archives:', error);

            const message = error instanceof Error ? error.message : 'Unknown error occurred';

            return res.status(500).json({
                error: 'Failed to get grouped archives',
                code: 'INTERNAL_ERROR',
                details: message,
            });
        }
    });

    /**
     * GET /api/archives/:id
     * Get specific archive details
     */
    router.get('/:id', async (req: Request, res: Response) => {
        try {
            const { id } = req.params;

            if (!id) {
                return res.status(400).json({
                    error: 'Archive ID is required',
                    code: 'MISSING_ARCHIVE_ID',
                });
            }

            const archive = await archiveService.getArchive(id);

            return res.json({
                success: true,
                data: archive,
            });
        } catch (error) {
            console.error('Error getting archive:', error);

            const message = error instanceof Error ? error.message : 'Unknown error occurred';

            if (message.includes('Archive not found')) {
                return res.status(404).json({
                    error: 'Archive not found',
                    code: 'ARCHIVE_NOT_FOUND',
                    details: message,
                });
            }

            return res.status(500).json({
                error: 'Failed to get archive',
                code: 'INTERNAL_ERROR',
                details: message,
            });
        }
    });

    /**
     * GET /api/archives/:id/content/*
     * Serve archived content (HTML pages and assets)
     */
    router.get('/:id/content/*', async (req: Request, res: Response) => {
        try {
            const { id } = req.params;
            const contentPath = req.params[0] || '';

            if (!id) {
                return res.status(400).json({
                    error: 'Archive ID is required',
                    code: 'MISSING_ARCHIVE_ID',
                });
            }

            // Check if archive exists first
            const archiveExists = await archiveService.archiveExists(id);
            if (!archiveExists) {
                return res.status(404).json({
                    error: 'Archive not found',
                    code: 'ARCHIVE_NOT_FOUND',
                });
            }

            const { content, contentType } = await archiveService.getArchivedContent(id, contentPath);

            // Set appropriate headers
            res.set('Content-Type', contentType);
            res.set('Cache-Control', 'public, max-age=3600'); // Cache for 1 hour
            res.set('X-Archive-ID', id);
            res.set('X-Content-Path', contentPath);
            
            // For archived content, set permissive headers to allow proper display
            if (contentType.includes('text/html')) {
                // Remove restrictive frame options and set permissive CSP for archived HTML content
                res.removeHeader('X-Frame-Options');
                res.set('Content-Security-Policy', 
                    "default-src 'self' 'unsafe-inline' 'unsafe-eval' data: blob: *; " +
                    "frame-ancestors *; " +
                    "frame-src *; " +
                    "img-src 'self' data: blob: *; " +
                    "script-src 'self' 'unsafe-inline' 'unsafe-eval' *; " +
                    "style-src 'self' 'unsafe-inline' *;"
                );
            } else if (contentType.includes('text/css') || contentType.includes('application/javascript') || contentType.includes('image/') || contentPath.includes('/assets/css/')) {
                // For CSS, JS, and image assets, allow cross-origin loading to support archived content
                res.removeHeader('X-Frame-Options');
                res.set('Access-Control-Allow-Origin', '*');
                res.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
                res.set('Access-Control-Allow-Headers', 'Content-Type');
                // Set permissive CSP for assets
                res.set('Content-Security-Policy', 
                    "default-src *; " +
                    "style-src 'self' 'unsafe-inline' *; " +
                    "script-src 'self' 'unsafe-inline' 'unsafe-eval' *; " +
                    "img-src 'self' data: blob: *; " +
                    "font-src 'self' data: *;"
                );
            } else {
                // For other content types, use functional headers
                res.set('X-Frame-Options', 'SAMEORIGIN');
                res.set('Content-Security-Policy', "frame-ancestors 'self' http://localhost:3000 https://localhost:3000");
            }

            return res.send(content);
        } catch (error) {
            console.error('Error serving archived content:', error);

            const message = error instanceof Error ? error.message : 'Unknown error occurred';

            if (message.includes('not found') || message.includes('does not exist')) {
                return res.status(404).json({
                    error: 'Content not found',
                    code: 'CONTENT_NOT_FOUND',
                    details: message,
                });
            }

            return res.status(500).json({
                error: 'Failed to serve archived content',
                code: 'INTERNAL_ERROR',
                details: message,
            });
        }
    });

    /**
     * DELETE /api/archives/:id
     * Delete an archive
     */
    router.delete('/:id', async (req: Request, res: Response) => {
        try {
            const { id } = req.params;

            if (!id) {
                return res.status(400).json({
                    error: 'Archive ID is required',
                    code: 'MISSING_ARCHIVE_ID',
                });
            }

            await archiveService.deleteArchive(id);

            return res.json({
                success: true,
                message: 'Archive deleted successfully',
            });
        } catch (error) {
            console.error('Error deleting archive:', error);

            const message = error instanceof Error ? error.message : 'Unknown error occurred';

            if (message.includes('Archive not found') || message.includes('does not exist')) {
                return res.status(404).json({
                    error: 'Archive not found',
                    code: 'ARCHIVE_NOT_FOUND',
                    details: message,
                });
            }

            if (message.includes('archiving in progress')) {
                return res.status(409).json({
                    error: 'Cannot delete archive while archiving is in progress',
                    code: 'ARCHIVE_IN_PROGRESS',
                    details: message,
                });
            }

            return res.status(500).json({
                error: 'Failed to delete archive',
                code: 'INTERNAL_ERROR',
                details: message,
            });
        }
    });

    /**
     * GET /api/archives/:id/progress
     * Get archive progress (for active archives)
     */
    router.get('/:id/progress', async (req: Request, res: Response) => {
        try {
            const { id } = req.params;

            if (!id) {
                return res.status(400).json({
                    error: 'Archive ID is required',
                    code: 'MISSING_ARCHIVE_ID',
                });
            }

            const progress = archiveService.getArchiveProgress(id);

            if (!progress) {
                return res.status(404).json({
                    error: 'Archive progress not found (archive may be completed or not exist)',
                    code: 'PROGRESS_NOT_FOUND',
                });
            }

            return res.json({
                success: true,
                data: progress,
            });
        } catch (error) {
            console.error('Error getting archive progress:', error);

            const message = error instanceof Error ? error.message : 'Unknown error occurred';

            return res.status(500).json({
                error: 'Failed to get archive progress',
                code: 'INTERNAL_ERROR',
                details: message,
            });
        }
    });

    return router;
}

// Export default router for production use
export default createArchiveRouter();