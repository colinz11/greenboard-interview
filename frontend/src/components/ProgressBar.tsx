import React from 'react';
import styles from './ProgressBar.module.css';

interface ProgressBarProps {
  progress: number; // 0-100
  status: string;
  details?: {
    pagesDiscovered: number;
    pagesCrawled: number;
    assetsDownloaded: number;
    totalSize?: number;
  };
  estimatedTimeRemaining?: number; // in seconds
  currentUrl?: string;
}

const ProgressBar: React.FC<ProgressBarProps> = ({ 
  progress, 
  status, 
  details, 
  estimatedTimeRemaining,
  currentUrl
}) => {
  const formatTime = (seconds: number): string => {
    if (seconds < 60) return `${Math.round(seconds)}s`;
    if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
    return `${Math.round(seconds / 3600)}h`;
  };

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'in_progress': return '#2196F3';
      case 'completed': return '#4CAF50';
      case 'failed': return '#F44336';
      case 'partial': return '#FF9800';
      default: return '#9E9E9E';
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <span className={styles.status} style={{ color: getStatusColor(status) }}>
          {status.replace('_', ' ').toUpperCase()}
        </span>
        {estimatedTimeRemaining && estimatedTimeRemaining > 0 && (
          <span className={styles.timeRemaining}>
            ~{formatTime(estimatedTimeRemaining)} remaining
          </span>
        )}
      </div>
      
      <div className={styles.progressBarContainer}>
        <div 
          className={styles.progressBar}
          style={{ 
            width: `${Math.min(100, Math.max(0, progress))}%`,
            backgroundColor: getStatusColor(status)
          }}
        />
      </div>
      
      <div className={styles.progressText}>
        {progress.toFixed(1)}% complete
      </div>
      
      {currentUrl && status === 'in_progress' && (
        <div className={styles.currentUrl}>
          <span className={styles.currentUrlLabel}>Currently processing:</span>
          <span className={styles.currentUrlValue}>{currentUrl}</span>
        </div>
      )}
      
      {details && (
        <div className={styles.details}>
          <div className={styles.detailItem}>
            <span className={styles.detailLabel}>Pages:</span>
            <span className={styles.detailValue}>
              {details.pagesCrawled} / {details.pagesDiscovered} discovered
            </span>
          </div>
          <div className={styles.detailItem}>
            <span className={styles.detailLabel}>Assets:</span>
            <span className={styles.detailValue}>
              {details.assetsDownloaded} downloaded
            </span>
          </div>
          {details.totalSize && details.totalSize > 0 && (
            <div className={styles.detailItem}>
              <span className={styles.detailLabel}>Size:</span>
              <span className={styles.detailValue}>
                {(details.totalSize / 1024).toFixed(1)} KB
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ProgressBar;