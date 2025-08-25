import React, { useState, useEffect, useRef } from 'react';
import { Archive, ArchiveStatus } from '../types';
import { archiveApi } from '../services/api';
import { LoadingSpinner, ErrorDisplay } from './';
import styles from './ArchivedViewer.module.css';

interface ArchivedViewerProps {
  archiveId: string;
  initialPath?: string;
  onClose: () => void;
}

const ArchivedViewer: React.FC<ArchivedViewerProps> = ({
  archiveId,
  initialPath = '',
  onClose,
}) => {
  const [archive, setArchive] = useState<Archive | null>(null);
  const [currentPath, setCurrentPath] = useState(initialPath);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | undefined>(undefined);
  const [showErrors, setShowErrors] = useState(false);
  const [contentError, setContentError] = useState<string | undefined>(undefined);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Load archive metadata
  useEffect(() => {
    loadArchive();
  }, [archiveId]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadArchive = async () => {
    try {
      setIsLoading(true);
      setError(undefined);
      const archiveData = await archiveApi.getArchive(archiveId);
      setArchive(archiveData);
    } catch (err: any) {
      console.error('Failed to load archive:', err);
      setError(err.response?.data?.message || err.message || 'Failed to load archive');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle iframe navigation
  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    const handleIframeLoad = () => {
      setContentError(undefined); // Clear any previous content errors
      try {
        // Try to get the current URL from the iframe
        const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
        if (iframeDoc) {
          const currentUrl = iframeDoc.location.href;
          // Extract the path from the archive content URL
          const pathMatch = currentUrl.match(/\/api\/archives\/[^/]+\/content\/(.*)$/);
          if (pathMatch) {
            setCurrentPath(pathMatch[1] || '');
          }
        }
      } catch (e) {
        // Cross-origin restrictions may prevent access to iframe content
        // This is expected for some archived content
        console.debug('Cannot access iframe content due to cross-origin restrictions');
      }
    };

    const handleIframeError = () => {
      setContentError('Failed to load archived content. The page may be corrupted or missing.');
    };

    iframe.addEventListener('load', handleIframeLoad);
    iframe.addEventListener('error', handleIframeError);
    return () => {
      iframe.removeEventListener('load', handleIframeLoad);
      iframe.removeEventListener('error', handleIframeError);
    };
  }, []);

  const getContentUrl = (path: string = currentPath) => {
    const apiBaseUrl = process.env.REACT_APP_API_URL || 'http://localhost:3001';
    return `${apiBaseUrl}/api/archives/${archiveId}/content/${path}`;
  };

  const formatTimestamp = (timestamp: Date) => {
    return new Date(timestamp).toLocaleString();
  };

  const handleNavigateToPath = (path: string) => {
    setCurrentPath(path);
    if (iframeRef.current) {
      iframeRef.current.src = getContentUrl(path);
    }
  };

  const handleRefresh = () => {
    if (iframeRef.current) {
      iframeRef.current.src = getContentUrl(currentPath);
    }
  };

  const handleRetry = () => {
    setError(undefined);
    loadArchive();
  };

  if (isLoading) {
    return (
      <div className={styles.container}>
        <div className={styles.header}>
          <button className={styles.closeButton} onClick={onClose}>
            ✕ Close
          </button>
        </div>
        <div className={styles.loadingContainer}>
          <LoadingSpinner />
          <p>Loading archive...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.container}>
        <div className={styles.header}>
          <button className={styles.closeButton} onClick={onClose}>
            ✕ Close
          </button>
        </div>
        <div className={styles.errorContainer}>
          <ErrorDisplay
            error={error}
            onRetry={handleRetry}
            onDismiss={() => setError(undefined)}
          />
        </div>
      </div>
    );
  }

  if (!archive) {
    return (
      <div className={styles.container}>
        <div className={styles.header}>
          <button className={styles.closeButton} onClick={onClose}>
            ✕ Close
          </button>
        </div>
        <div className={styles.errorContainer}>
          <p>Archive not found</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {/* Archive Context Header */}
      <div className={styles.header}>
        <div className={styles.archiveInfo}>
          <div className={styles.archiveTitle}>
            <span className={styles.archiveIndicator}>📁 ARCHIVED</span>
            <span className={styles.originalUrl}>{archive.url}</span>
          </div>
          <div className={styles.archiveMetadata}>
            <span className={styles.timestamp}>
              Archived: {formatTimestamp(archive.timestamp)}
            </span>
            <span className={styles.status} data-status={archive.status}>
              {archive.status.toUpperCase()}
              {archive.status === ArchiveStatus.PARTIAL && (
                <span className={styles.partialWarning} title="This archive is incomplete">
                  ⚠️
                </span>
              )}
            </span>
            <span className={styles.pageCount}>
              {archive.metadata.pageCount} pages
            </span>
          </div>
        </div>
        
        <div className={styles.controls}>
          {archive.errors.length > 0 && (
            <button 
              className={styles.errorsButton} 
              onClick={() => setShowErrors(!showErrors)}
              title={`View ${archive.errors.length} error(s)`}
            >
              ⚠️ {archive.errors.length} Error{archive.errors.length !== 1 ? 's' : ''}
            </button>
          )}
          <button 
            className={styles.refreshButton} 
            onClick={handleRefresh}
            title="Refresh current page"
          >
            🔄
          </button>
          <button className={styles.closeButton} onClick={onClose}>
            ✕ Close
          </button>
        </div>
      </div>

      {/* Navigation Bar */}
      <div className={styles.navigation}>
        <div className={styles.pathDisplay}>
          <span className={styles.pathLabel}>Path:</span>
          <span className={styles.currentPath}>
            /{currentPath || 'index.html'}
          </span>
        </div>
        
        {archive.pages.length > 0 && (
          <div className={styles.pageSelector}>
            <label htmlFor="page-select">Jump to page:</label>
            <select
              id="page-select"
              value={currentPath}
              onChange={(e) => handleNavigateToPath(e.target.value)}
              className={styles.pageSelect}
            >
              <option value="">Home Page</option>
              {archive.pages
                .filter(page => page.path !== '' && page.path !== 'index.html')
                .map((page, index) => (
                  <option key={`${page.path}-${index}`} value={page.path}>
                    {page.title || page.path}
                  </option>
                ))}
            </select>
          </div>
        )}
      </div>

      {/* Errors Panel */}
      {showErrors && archive.errors.length > 0 && (
        <div className={styles.errorsPanel}>
          <div className={styles.errorsPanelHeader}>
            <h3>Archive Errors ({archive.errors.length})</h3>
            <button 
              className={styles.closeErrorsButton}
              onClick={() => setShowErrors(false)}
            >
              ✕
            </button>
          </div>
          <div className={styles.errorsList}>
            {archive.errors.map((error, index) => (
              <div key={`${error.timestamp}-${index}`} className={styles.errorItem}>
                <div className={styles.errorHeader}>
                  <span className={styles.errorType}>{error.type}</span>
                  <span className={styles.errorTime}>
                    {new Date(error.timestamp).toLocaleString()}
                  </span>
                  {error.recoverable && (
                    <span className={styles.errorRecoverable}>Recoverable</span>
                  )}
                </div>
                <div className={styles.errorMessage}>{error.message}</div>
                {error.url && (
                  <div className={styles.errorUrl}>URL: {error.url}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Content Error Display */}
      {contentError && (
        <div className={styles.contentError}>
          <div className={styles.contentErrorMessage}>
            ⚠️ {contentError}
          </div>
          <button 
            className={styles.retryContentButton}
            onClick={() => {
              setContentError(undefined);
              handleRefresh();
            }}
          >
            Retry
          </button>
        </div>
      )}

      {/* Content Viewer */}
      <div className={styles.contentContainer}>
        {(archive.status === ArchiveStatus.PARTIAL || archive.status === ArchiveStatus.FAILED) && (
          <div className={styles.partialWarningBanner}>
            <span className={styles.warningIcon}>⚠️</span>
            <span className={styles.warningText}>
              {archive.status === ArchiveStatus.PARTIAL 
                ? 'This archive is incomplete. Some content may be missing or broken.'
                : 'This archive failed to complete. Content may be severely limited.'}
            </span>
            {archive.errors.length > 0 && (
              <button 
                className={styles.viewErrorsButton}
                onClick={() => setShowErrors(true)}
              >
                View Errors
              </button>
            )}
          </div>
        )}
        <iframe
          ref={iframeRef}
          src={getContentUrl()}
          className={styles.contentFrame}
          title={`Archived content: ${archive.url}`}
          sandbox="allow-scripts allow-same-origin allow-forms"
        />
      </div>

      {/* Archive Status Footer */}
      <div className={styles.footer}>
        <div className={styles.archiveStats}>
          <span>Size: {(archive.metadata.totalSize / 1024 / 1024).toFixed(2)} MB</span>
          <span>Assets: {archive.metadata.assetCount}</span>
          <span>Duration: {Math.round(archive.metadata.crawlDuration / 1000)}s</span>
        </div>
        
        {archive.errors.length > 0 && (
          <div className={styles.errorIndicator}>
            ⚠️ {archive.errors.length} error(s) during archiving
          </div>
        )}
      </div>
    </div>
  );
};

export default ArchivedViewer;