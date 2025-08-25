import React from 'react';
import { ApiError } from '../types';
import styles from './ErrorDisplay.module.css';

interface ErrorDisplayProps {
  error: string | ApiError | Error;
  type?: 'error' | 'warning' | 'info';
  onRetry?: () => void;
  onDismiss?: () => void;
  showDetails?: boolean;
}

const ErrorDisplay: React.FC<ErrorDisplayProps> = ({
  error,
  type = 'error',
  onRetry,
  onDismiss,
  showDetails = false
}) => {
  const getErrorMessage = (err: string | ApiError | Error): string => {
    if (typeof err === 'string') {
      return err;
    }
    
    if ('message' in err) {
      return err.message;
    }
    
    return 'An unexpected error occurred';
  };

  const getErrorDetails = (err: string | ApiError | Error): string | undefined => {
    if (typeof err === 'string') {
      return undefined;
    }
    
    if ('details' in err && err.details) {
      return typeof err.details === 'string' ? err.details : JSON.stringify(err.details, null, 2);
    }
    
    if ('stack' in err && err.stack) {
      return err.stack;
    }
    
    return undefined;
  };

  const getContainerClassName = (): string => {
    switch (type) {
      case 'warning':
        return `${styles.errorContainer} ${styles.warningContainer}`;
      case 'info':
        return `${styles.errorContainer} ${styles.infoContainer}`;
      default:
        return styles.errorContainer;
    }
  };

  const getIcon = (): string => {
    switch (type) {
      case 'warning':
        return '⚠️';
      case 'info':
        return 'ℹ️';
      default:
        return '❌';
    }
  };

  const getTitle = (): string => {
    switch (type) {
      case 'warning':
        return 'Warning';
      case 'info':
        return 'Information';
      default:
        return 'Error';
    }
  };

  const getUserFriendlyMessage = (message: string): string => {
    // Convert technical error messages to user-friendly ones
    if (message.includes('Network Error') || message.includes('ECONNREFUSED')) {
      return 'Unable to connect to the server. Please check your internet connection and try again.';
    }
    
    if (message.includes('timeout')) {
      return 'The request took too long to complete. The website might be slow or unavailable.';
    }
    
    if (message.includes('404') || message.includes('Not Found')) {
      return 'The requested page could not be found. Please check the URL and try again.';
    }
    
    if (message.includes('403') || message.includes('Forbidden')) {
      return 'Access to this website is restricted. The site may block automated access.';
    }
    
    if (message.includes('500') || message.includes('Internal Server Error')) {
      return 'The server encountered an error. Please try again later.';
    }
    
    if (message.includes('Invalid URL')) {
      return 'Please enter a valid website URL (e.g., https://example.com).';
    }
    
    return message;
  };

  const errorMessage = getErrorMessage(error);
  const errorDetails = getErrorDetails(error);
  const friendlyMessage = getUserFriendlyMessage(errorMessage);

  return (
    <div className={getContainerClassName()}>
      <div className={styles.errorTitle}>
        <span>{getIcon()}</span>
        {getTitle()}
      </div>
      
      <div className={styles.errorMessage}>
        {friendlyMessage}
      </div>
      
      {showDetails && errorDetails && (
        <div className={styles.errorDetails}>
          <strong>Technical Details:</strong>
          <pre>{errorDetails}</pre>
        </div>
      )}
      
      {(onRetry || onDismiss) && (
        <div className={styles.errorActions}>
          {onRetry && (
            <button className={styles.retryButton} onClick={onRetry}>
              Try Again
            </button>
          )}
          {onDismiss && (
            <button className={styles.dismissButton} onClick={onDismiss}>
              Dismiss
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default ErrorDisplay;