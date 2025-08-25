import React from 'react';
import styles from './LoadingSpinner.module.css';

interface LoadingSpinnerProps {
  message?: string;
  size?: 'small' | 'medium' | 'large';
}

const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ 
  message = 'Loading...', 
  size = 'medium' 
}) => {
  const getSpinnerClassName = (): string => {
    switch (size) {
      case 'small':
        return `${styles.spinner} ${styles.spinnerSmall}`;
      case 'large':
        return `${styles.spinner} ${styles.spinnerLarge}`;
      default:
        return styles.spinner;
    }
  };

  const getMessageClassName = (): string => {
    switch (size) {
      case 'small':
        return `${styles.message} ${styles.messageSmall}`;
      case 'large':
        return `${styles.message} ${styles.messageLarge}`;
      default:
        return styles.message;
    }
  };

  return (
    <div className={styles.container}>
      <div className={getSpinnerClassName()}></div>
      {message && <span className={getMessageClassName()}>{message}</span>}
    </div>
  );
};

export default LoadingSpinner;