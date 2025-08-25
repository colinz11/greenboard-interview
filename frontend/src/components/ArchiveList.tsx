import React, { useState, useEffect } from 'react';
import { Archive, ArchiveStatus } from '../types';
import ProgressBar from './ProgressBar';
import { archiveApi } from '../services/api';
import styles from './ArchiveList.module.css';

interface ArchiveListProps {
  archives: Archive[];
  onSelectArchive: (archiveId: string) => void;
  onReArchive: (url: string) => void;
  onDeleteArchive: (archiveId: string) => void;
  onCompareArchives?: (archiveIds: string[]) => void;
  isLoading?: boolean;
}

const ArchiveList: React.FC<ArchiveListProps> = ({
  archives,
  onSelectArchive,
  onReArchive,
  onDeleteArchive,
  onCompareArchives,
  isLoading = false
}) => {
  const [progressData, setProgressData] = useState<{[key: string]: any}>({});

  // Poll progress for in-progress archives
  useEffect(() => {
    const inProgressArchives = archives.filter(archive => archive.status === ArchiveStatus.IN_PROGRESS);
    
    if (inProgressArchives.length === 0) return;

    const pollProgress = async () => {
      const progressPromises = inProgressArchives.map(async (archive) => {
        try {
          const response = await archiveApi.getArchiveProgress(archive.id);
          return { id: archive.id, data: response };
        } catch (error) {
          console.error(`Failed to get progress for ${archive.id}:`, error);
          return { id: archive.id, data: null };
        }
      });

      const results = await Promise.all(progressPromises);
      const newProgressData: {[key: string]: any} = {};
      
      results.forEach(result => {
        if (result.data) {
          newProgressData[result.id] = result.data;
        }
      });

      setProgressData(newProgressData);
    };

    // Poll immediately and then every 2 seconds
    pollProgress();
    const interval = setInterval(pollProgress, 2000);

    return () => clearInterval(interval);
  }, [archives]);

  const calculateProgress = (archive: Archive): number => {
    const progress = progressData[archive.id];
    if (!progress) return 0;

    const { pagesDiscovered, pagesCrawled, assetsDownloaded } = progress.progress;
    if (pagesDiscovered === 0) return 5; // Show some progress for initialization
    
    // Calculate progress based on pages crawled and assets downloaded
    const pageProgress = pagesDiscovered > 0 ? (pagesCrawled / pagesDiscovered) * 70 : 0;
    const assetProgress = assetsDownloaded > 0 ? Math.min(30, assetsDownloaded * 2) : 0;
    
    return Math.min(95, pageProgress + assetProgress); // Cap at 95% until completion
  };

  const getEstimatedTimeRemaining = (archive: Archive): number | undefined => {
    const progress = progressData[archive.id];
    if (!progress || !progress.startTime) return undefined;

    const elapsed = Date.now() - new Date(progress.startTime).getTime();
    const currentProgress = calculateProgress(archive);
    
    if (currentProgress <= 5) return undefined;
    
    const estimatedTotal = (elapsed / currentProgress) * 100;
    const remaining = Math.max(0, (estimatedTotal - elapsed) / 1000);
    
    return remaining;
  };
  const formatTimestamp = (timestamp: Date): string => {
    const date = new Date(timestamp);
    return date.toLocaleString();
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const formatDuration = (milliseconds: number): string => {
    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  };

  const getStatusClassName = (status: ArchiveStatus): string => {
    switch (status) {
      case ArchiveStatus.COMPLETED:
        return styles.statusCompleted;
      case ArchiveStatus.IN_PROGRESS:
        return styles.statusInProgress;
      case ArchiveStatus.FAILED:
        return styles.statusFailed;
      case ArchiveStatus.PARTIAL:
        return styles.statusPartial;
      default:
        return '';
    }
  };

  const handleViewArchive = (archiveId: string) => {
    onSelectArchive(archiveId);
  };

  const handleReArchive = (url: string) => {
    if (window.confirm('This will create a new archive of this website. Continue?')) {
      onReArchive(url);
    }
  };

  const handleDeleteArchive = (archiveId: string) => {
    if (window.confirm('Are you sure you want to delete this archive? This action cannot be undone.')) {
      onDeleteArchive(archiveId);
    }
  };

  // Sort archives by timestamp (newest first)
  const sortedArchives = React.useMemo(() => {
    return [...archives].sort((a, b) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }, [archives]);

  if (isLoading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>
          <div className={styles.spinner}></div>
          <span>Loading archives...</span>
        </div>
      </div>
    );
  }

  if (archives.length === 0) {
    return (
      <div className={styles.container}>
        <div className={styles.emptyState}>
          <h3 className={styles.emptyStateTitle}>No Archives Yet</h3>
          <p className={styles.emptyStateMessage}>
            Start by archiving your first website using the form above.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2 className={styles.title}>Archived Websites ({archives.length})</h2>
      </div>
      
      <div className={styles.list}>
        {sortedArchives.map((archive) => (
          <div key={archive.id} className={styles.archiveItem}>
            <div className={styles.archiveHeader}>
              <div className={styles.archiveInfo}>
                <button
                  className={styles.archiveUrl}
                  onClick={() => handleViewArchive(archive.id)}
                  title="View archived website"
                >
                  {archive.url}
                </button>
                <div className={styles.archiveTimestamp}>
                  Archived on {formatTimestamp(archive.timestamp)}
                </div>
                <span className={`${styles.archiveStatus} ${getStatusClassName(archive.status)}`}>
                  {archive.status.replace('_', ' ')}
                </span>
              </div>
              
              <div className={styles.archiveActions}>
                {archive.status === ArchiveStatus.COMPLETED && (
                  <button
                    className={`${styles.actionButton} ${styles.primary}`}
                    onClick={() => handleViewArchive(archive.id)}
                    title="View archived website"
                  >
                    View
                  </button>
                )}
                <button
                  className={styles.actionButton}
                  onClick={() => handleReArchive(archive.url)}
                  title="Create a new archive of this website"
                >
                  Re-archive
                </button>
                <button
                  className={`${styles.actionButton} ${styles.danger}`}
                  onClick={() => handleDeleteArchive(archive.id)}
                  title="Delete this archive"
                >
                  Delete
                </button>
              </div>
            </div>
            
            {archive.status === ArchiveStatus.IN_PROGRESS && (
              <ProgressBar
                progress={calculateProgress(archive)}
                status={archive.status}
                details={progressData[archive.id]?.progress}
                estimatedTimeRemaining={getEstimatedTimeRemaining(archive)}
                currentUrl={progressData[archive.id]?.currentUrl || archive.url}
              />
            )}
            
            {archive.status === ArchiveStatus.COMPLETED && (
              <div className={styles.archiveDetails}>
                <div className={styles.archiveMetadata}>
                  <div className={styles.metadataItem}>
                    <span>📄 {archive.metadata.pageCount} pages</span>
                  </div>
                  <div className={styles.metadataItem}>
                    <span>🗂️ {archive.metadata.assetCount} assets</span>
                  </div>
                  <div className={styles.metadataItem}>
                    <span>💾 {formatFileSize(archive.metadata.totalSize)}</span>
                  </div>
                  <div className={styles.metadataItem}>
                    <span>⏱️ {formatDuration(archive.metadata.crawlDuration)}</span>
                  </div>
                </div>
              </div>
            )}
            
            {archive.errors.length > 0 && (
              <div className={styles.archiveMetadata}>
                <div className={styles.metadataItem}>
                  <span>⚠️ {archive.errors.length} errors occurred</span>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default ArchiveList;