import React, { useState } from 'react';
import { Archive, ArchiveStatus } from '../types';
import VersionComparison from './VersionComparison';
import styles from './VersionList.module.css';

interface VersionListProps {
  groupedArchives: { [url: string]: Archive[] };
  onSelectArchive: (archiveId: string) => void;
  onReArchive: (url: string) => void;
  onDeleteArchive: (archiveId: string) => void;
  isLoading?: boolean;
}

const VersionList: React.FC<VersionListProps> = ({
  groupedArchives,
  onSelectArchive,
  onReArchive,
  onDeleteArchive,
  isLoading = false
}) => {
  const [expandedUrls, setExpandedUrls] = useState<Set<string>>(new Set());
  const [comparisonData, setComparisonData] = useState<{
    versions: Archive[];
    selectedVersions: [Archive, Archive];
  } | null>(null);

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

  const toggleUrlExpansion = (url: string) => {
    const newExpanded = new Set(expandedUrls);
    if (newExpanded.has(url)) {
      newExpanded.delete(url);
    } else {
      newExpanded.add(url);
    }
    setExpandedUrls(newExpanded);
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

  const handleCompareVersions = (versions: Archive[]) => {
    if (versions.length < 2) {
      alert('At least 2 versions are required for comparison');
      return;
    }

    // Default to comparing the two most recent versions
    const sortedVersions = [...versions].sort((a, b) => b.version - a.version);
    setComparisonData({
      versions: sortedVersions,
      selectedVersions: [sortedVersions[1], sortedVersions[0]], // older first, newer second
    });
  };

  const handleVersionSelect = (index: 0 | 1, version: Archive) => {
    if (!comparisonData) return;
    
    const newSelectedVersions: [Archive, Archive] = [...comparisonData.selectedVersions];
    newSelectedVersions[index] = version;
    
    setComparisonData({
      ...comparisonData,
      selectedVersions: newSelectedVersions,
    });
  };

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

  const urls = Object.keys(groupedArchives);
  if (urls.length === 0) {
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
      <h2 className={styles.title}>Archived Websites ({urls.length} sites)</h2>
      
      <div className={styles.list}>
        {urls.map((url) => {
          const versions = groupedArchives[url];
          const latestVersion = versions[0]; // Already sorted by version desc
          const isExpanded = expandedUrls.has(url);

          return (
            <div key={url} className={styles.urlGroup}>
              <div className={styles.urlHeader}>
                <div className={styles.urlInfo}>
                  <button
                    className={styles.urlToggle}
                    onClick={() => toggleUrlExpansion(url)}
                  >
                    <span className={`${styles.toggleIcon} ${isExpanded ? styles.expanded : ''}`}>
                      ▶
                    </span>
                    <span className={styles.urlText}>{url}</span>
                  </button>
                  <div className={styles.urlMeta}>
                    <span className={styles.versionCount}>
                      {versions.length} version{versions.length !== 1 ? 's' : ''}
                    </span>
                    <span className={styles.latestTimestamp}>
                      Latest: {formatTimestamp(latestVersion.timestamp)}
                    </span>
                    <span className={`${styles.status} ${getStatusClassName(latestVersion.status)}`}>
                      {latestVersion.status.replace('_', ' ')}
                    </span>
                  </div>
                </div>
                
                <div className={styles.urlActions}>
                  {latestVersion.status === ArchiveStatus.COMPLETED && (
                    <button
                      className={`${styles.actionButton} ${styles.primary}`}
                      onClick={() => handleViewArchive(latestVersion.id)}
                      title="View latest version"
                    >
                      View Latest
                    </button>
                  )}
                  {versions.length > 1 && (
                    <button
                      className={styles.actionButton}
                      onClick={() => handleCompareVersions(versions)}
                      title="Compare versions"
                    >
                      Compare
                    </button>
                  )}
                  <button
                    className={styles.actionButton}
                    onClick={() => handleReArchive(url)}
                    title="Create a new archive of this website"
                  >
                    Re-archive
                  </button>
                </div>
              </div>

              {isExpanded && (
                <div className={styles.versionsList}>
                  {versions.map((version) => (
                    <div key={version.id} className={styles.versionItem}>
                      <div className={styles.versionInfo}>
                        <div className={styles.versionHeader}>
                          <span className={styles.versionNumber}>v{version.version}</span>
                          <span className={styles.versionTimestamp}>
                            {formatTimestamp(version.timestamp)}
                          </span>
                          <span className={`${styles.versionStatus} ${getStatusClassName(version.status)}`}>
                            {version.status.replace('_', ' ')}
                          </span>
                        </div>
                        
                        {version.status === ArchiveStatus.COMPLETED && (
                          <div className={styles.versionMetadata}>
                            <span>📄 {version.metadata.pageCount} pages</span>
                            <span>🗂️ {version.metadata.assetCount} assets</span>
                            <span>💾 {formatFileSize(version.metadata.totalSize)}</span>
                          </div>
                        )}
                        
                        {version.errors.length > 0 && (
                          <div className={styles.versionErrors}>
                            <span>⚠️ {version.errors.length} errors</span>
                          </div>
                        )}
                      </div>
                      
                      <div className={styles.versionActions}>
                        {version.status === ArchiveStatus.COMPLETED && (
                          <button
                            className={`${styles.actionButton} ${styles.small} ${styles.primary}`}
                            onClick={() => handleViewArchive(version.id)}
                            title="View this version"
                          >
                            View
                          </button>
                        )}
                        <button
                          className={`${styles.actionButton} ${styles.small} ${styles.danger}`}
                          onClick={() => handleDeleteArchive(version.id)}
                          title="Delete this version"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {comparisonData && (
        <VersionComparison
          versions={comparisonData.versions}
          selectedVersions={comparisonData.selectedVersions}
          onVersionSelect={handleVersionSelect}
          onClose={() => setComparisonData(null)}
        />
      )}
    </div>
  );
};

export default VersionList;