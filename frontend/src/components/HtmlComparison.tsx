import React, { useState, useEffect } from 'react';
import { Archive } from '../types';
import { archiveApi } from '../services/api';
import styles from './HtmlComparison.module.css';

interface HtmlComparisonProps {
  archiveIds: string[];
  onClose: () => void;
}

/**
 * Component for comparing two archived versions of the same website
 * Shows side-by-side diff view of HTML content
 */
const HtmlComparison: React.FC<HtmlComparisonProps> = ({ archiveIds, onClose }) => {
  const [archives, setArchives] = useState<[Archive | null, Archive | null]>([null, null]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadArchives = async () => {
      try {
        setLoading(true);
        setError(null);

        if (archiveIds.length !== 2) {
          setError('Exactly two archives are required for comparison');
          return;
        }

        const [archive1, archive2] = await Promise.all([
          archiveApi.getArchive(archiveIds[0]),
          archiveApi.getArchive(archiveIds[1])
        ]);

        setArchives([archive1, archive2]);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load archives for comparison');
      } finally {
        setLoading(false);
      }
    };

    loadArchives();
  }, [archiveIds]);

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.header}>
          <h2>Loading Comparison...</h2>
          <button onClick={onClose} className={styles.closeButton}>×</button>
        </div>
        <div className={styles.loading}>
          <div className={styles.spinner}></div>
          <p>Loading archives for comparison...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.container}>
        <div className={styles.header}>
          <h2>Comparison Error</h2>
          <button onClick={onClose} className={styles.closeButton}>×</button>
        </div>
        <div className={styles.error}>
          <p>Error: {error}</p>
          <button onClick={onClose} className={styles.button}>Close</button>
        </div>
      </div>
    );
  }

  const [archive1, archive2] = archives;

  if (!archive1 || !archive2) {
    return (
      <div className={styles.container}>
        <div className={styles.header}>
          <h2>Comparison Error</h2>
          <button onClick={onClose} className={styles.closeButton}>×</button>
        </div>
        <div className={styles.error}>
          <p>Could not load one or both archives for comparison</p>
          <button onClick={onClose} className={styles.button}>Close</button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2>Archive Comparison</h2>
        <button onClick={onClose} className={styles.closeButton}>×</button>
      </div>
      
      <div className={styles.archiveInfo}>
        <div className={styles.archiveDetails}>
          <h3>Version 1</h3>
          <p><strong>URL:</strong> {archive1.url}</p>
          <p><strong>Archived:</strong> {new Date(archive1.timestamp).toLocaleString()}</p>
          <p><strong>Status:</strong> {archive1.status}</p>
          <p><strong>Pages:</strong> {archive1.metadata.pageCount}</p>
        </div>
        <div className={styles.archiveDetails}>
          <h3>Version 2</h3>
          <p><strong>URL:</strong> {archive2.url}</p>
          <p><strong>Archived:</strong> {new Date(archive2.timestamp).toLocaleString()}</p>
          <p><strong>Status:</strong> {archive2.status}</p>
          <p><strong>Pages:</strong> {archive2.metadata.pageCount}</p>
        </div>
      </div>

      <div className={styles.comparisonView}>
        <div className={styles.viewerContainer}>
          <h4>Version 1 ({new Date(archive1.timestamp).toLocaleDateString()})</h4>
          <iframe
            src={`/api/archives/${archive1.id}/content/pages/index.html`}
            className={styles.viewer}
            title={`Archive 1 - ${archive1.url}`}
            sandbox="allow-same-origin allow-scripts allow-forms"
          />
        </div>
        <div className={styles.viewerContainer}>
          <h4>Version 2 ({new Date(archive2.timestamp).toLocaleDateString()})</h4>
          <iframe
            src={`/api/archives/${archive2.id}/content/pages/index.html`}
            className={styles.viewer}
            title={`Archive 2 - ${archive2.url}`}
            sandbox="allow-same-origin allow-scripts allow-forms"
          />
        </div>
      </div>

      <div className={styles.actions}>
        <button onClick={onClose} className={styles.button}>
          Close Comparison
        </button>
      </div>
    </div>
  );
};

export default HtmlComparison;