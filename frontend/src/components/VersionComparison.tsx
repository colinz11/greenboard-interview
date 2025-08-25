import React from 'react';
import { Archive } from '../types';
import styles from './VersionComparison.module.css';

interface VersionComparisonProps {
  versions: Archive[];
  selectedVersions: [Archive, Archive];
  onVersionSelect: (index: 0 | 1, version: Archive) => void;
  onClose: () => void;
}

const VersionComparison: React.FC<VersionComparisonProps> = ({
  versions,
  selectedVersions,
  onVersionSelect,
  onClose
}) => {
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

  const getMetadataDiff = (version1: Archive, version2: Archive) => {
    const diff = {
      pageCount: version2.metadata.pageCount - version1.metadata.pageCount,
      assetCount: version2.metadata.assetCount - version1.metadata.assetCount,
      totalSize: version2.metadata.totalSize - version1.metadata.totalSize,
    };
    return diff;
  };

  const renderDiffValue = (value: number, unit: string = '') => {
    if (value === 0) return <span className={styles.diffNeutral}>No change</span>;
    const sign = value > 0 ? '+' : '';
    const className = value > 0 ? styles.diffPositive : styles.diffNegative;
    return <span className={className}>{sign}{value}{unit}</span>;
  };

  const diff = getMetadataDiff(selectedVersions[0], selectedVersions[1]);

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <div className={styles.header}>
          <h2>Version Comparison</h2>
          <button className={styles.closeButton} onClick={onClose}>×</button>
        </div>

        <div className={styles.content}>
          <div className={styles.versionSelectors}>
            <div className={styles.versionSelector}>
              <label>Version 1 (Older):</label>
              <select
                value={selectedVersions[0].id}
                onChange={(e) => {
                  const version = versions.find(v => v.id === e.target.value);
                  if (version) onVersionSelect(0, version);
                }}
              >
                {versions.map((version) => (
                  <option key={version.id} value={version.id}>
                    v{version.version} - {formatTimestamp(version.timestamp)}
                  </option>
                ))}
              </select>
            </div>

            <div className={styles.versionSelector}>
              <label>Version 2 (Newer):</label>
              <select
                value={selectedVersions[1].id}
                onChange={(e) => {
                  const version = versions.find(v => v.id === e.target.value);
                  if (version) onVersionSelect(1, version);
                }}
              >
                {versions.map((version) => (
                  <option key={version.id} value={version.id}>
                    v{version.version} - {formatTimestamp(version.timestamp)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className={styles.comparison}>
            <div className={styles.comparisonSection}>
              <h3>Basic Information</h3>
              <div className={styles.comparisonGrid}>
                <div className={styles.comparisonItem}>
                  <strong>URL:</strong>
                  <span>{selectedVersions[0].url}</span>
                </div>
                <div className={styles.comparisonItem}>
                  <strong>Version:</strong>
                  <span>v{selectedVersions[0].version} → v{selectedVersions[1].version}</span>
                </div>
                <div className={styles.comparisonItem}>
                  <strong>Status:</strong>
                  <span>{selectedVersions[0].status} → {selectedVersions[1].status}</span>
                </div>
              </div>
            </div>

            <div className={styles.comparisonSection}>
              <h3>Metadata Changes</h3>
              <div className={styles.comparisonGrid}>
                <div className={styles.comparisonItem}>
                  <strong>Pages:</strong>
                  <span>
                    {selectedVersions[0].metadata.pageCount} → {selectedVersions[1].metadata.pageCount}
                    {' '}({renderDiffValue(diff.pageCount)})
                  </span>
                </div>
                <div className={styles.comparisonItem}>
                  <strong>Assets:</strong>
                  <span>
                    {selectedVersions[0].metadata.assetCount} → {selectedVersions[1].metadata.assetCount}
                    {' '}({renderDiffValue(diff.assetCount)})
                  </span>
                </div>
                <div className={styles.comparisonItem}>
                  <strong>Total Size:</strong>
                  <span>
                    {formatFileSize(selectedVersions[0].metadata.totalSize)} → {formatFileSize(selectedVersions[1].metadata.totalSize)}
                    {' '}({renderDiffValue(diff.totalSize, ' bytes')})
                  </span>
                </div>
              </div>
            </div>

            <div className={styles.comparisonSection}>
              <h3>Timestamps</h3>
              <div className={styles.comparisonGrid}>
                <div className={styles.comparisonItem}>
                  <strong>Version 1:</strong>
                  <span>{formatTimestamp(selectedVersions[0].timestamp)}</span>
                </div>
                <div className={styles.comparisonItem}>
                  <strong>Version 2:</strong>
                  <span>{formatTimestamp(selectedVersions[1].timestamp)}</span>
                </div>
                <div className={styles.comparisonItem}>
                  <strong>Time Difference:</strong>
                  <span>
                    {Math.round((new Date(selectedVersions[1].timestamp).getTime() - 
                                new Date(selectedVersions[0].timestamp).getTime()) / (1000 * 60 * 60 * 24))} days
                  </span>
                </div>
              </div>
            </div>

            {(selectedVersions[0].errors.length > 0 || selectedVersions[1].errors.length > 0) && (
              <div className={styles.comparisonSection}>
                <h3>Errors</h3>
                <div className={styles.comparisonGrid}>
                  <div className={styles.comparisonItem}>
                    <strong>Version 1 Errors:</strong>
                    <span>{selectedVersions[0].errors.length}</span>
                  </div>
                  <div className={styles.comparisonItem}>
                    <strong>Version 2 Errors:</strong>
                    <span>{selectedVersions[1].errors.length}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className={styles.footer}>
          <button className={styles.closeButton} onClick={onClose}>
            Close Comparison
          </button>
        </div>
      </div>
    </div>
  );
};

export default VersionComparison;