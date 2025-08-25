import React, { useState } from 'react';
import styles from './ArchiveForm.module.css';

interface ArchiveFormProps {
  onSubmit: (url: string) => void;
  isLoading: boolean;
  error?: string;
}

const ArchiveForm: React.FC<ArchiveFormProps> = ({ onSubmit, isLoading, error }) => {
  const [url, setUrl] = useState('');
  const [validationError, setValidationError] = useState('');

  const validateUrl = (inputUrl: string): boolean => {
    if (!inputUrl.trim()) {
      setValidationError('URL is required');
      return false;
    }

    try {
      const urlObj = new URL(inputUrl);
      if (!['http:', 'https:'].includes(urlObj.protocol)) {
        setValidationError('URL must use HTTP or HTTPS protocol');
        return false;
      }
      setValidationError('');
      return true;
    } catch {
      setValidationError('Please enter a valid URL');
      return false;
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (validateUrl(url)) {
      onSubmit(url);
    }
  };

  const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newUrl = e.target.value;
    setUrl(newUrl);
    
    // Clear validation error when user starts typing
    if (validationError && newUrl.trim()) {
      setValidationError('');
    }
  };

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      <h2 className={styles.title}>Archive a Website</h2>
      
      <div className={styles.inputGroup}>
        <label htmlFor="url" className={styles.label}>
          Website URL
        </label>
        <input
          id="url"
          type="text"
          value={url}
          onChange={handleUrlChange}
          placeholder="https://example.com"
          className={`${styles.input} ${validationError ? styles.error : ''}`}
          disabled={isLoading}
        />
        {validationError && (
          <div className={styles.errorMessage}>{validationError}</div>
        )}
      </div>

      {isLoading && (
        <div className={styles.progress}>
          <div className={styles.spinner}></div>
          <span>Archiving website... This may take a few minutes.</span>
        </div>
      )}

      {error && (
        <div className={styles.errorMessage}>
          {error}
        </div>
      )}

      <button
        type="submit"
        className={styles.button}
        disabled={isLoading || !url.trim()}
      >
        {isLoading ? 'Archiving...' : 'Start Archive'}
      </button>
    </form>
  );
};

export default ArchiveForm;