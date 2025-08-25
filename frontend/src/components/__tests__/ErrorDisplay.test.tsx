import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ErrorDisplay from '../ErrorDisplay';
import { ApiError } from '../../types';

describe('ErrorDisplay', () => {
  const mockOnRetry = jest.fn();
  const mockOnDismiss = jest.fn();

  beforeEach(() => {
    mockOnRetry.mockClear();
    mockOnDismiss.mockClear();
  });

  it('renders string error correctly', () => {
    render(<ErrorDisplay error="Something went wrong" />);
    
    expect(screen.getByText('❌')).toBeInTheDocument();
    expect(screen.getByText('Error')).toBeInTheDocument();
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
  });

  it('renders Error object correctly', () => {
    const error = new Error('Test error message');
    render(<ErrorDisplay error={error} />);
    
    expect(screen.getByText('Test error message')).toBeInTheDocument();
  });

  it('renders ApiError correctly', () => {
    const apiError: ApiError = {
      message: 'API request failed',
      code: 'API_ERROR',
      details: 'Additional error details',
    };
    
    render(<ErrorDisplay error={apiError} showDetails={true} />);
    
    expect(screen.getByText('API request failed')).toBeInTheDocument();
    expect(screen.getByText('Technical Details:')).toBeInTheDocument();
    expect(screen.getByText('Additional error details')).toBeInTheDocument();
  });

  it('renders warning type correctly', () => {
    render(<ErrorDisplay error="Warning message" type="warning" />);
    
    expect(screen.getByText('⚠️')).toBeInTheDocument();
    expect(screen.getByText('Warning')).toBeInTheDocument();
    expect(screen.getByText('Warning message')).toBeInTheDocument();
  });

  it('renders info type correctly', () => {
    render(<ErrorDisplay error="Info message" type="info" />);
    
    expect(screen.getByText('ℹ️')).toBeInTheDocument();
    expect(screen.getByText('Information')).toBeInTheDocument();
    expect(screen.getByText('Info message')).toBeInTheDocument();
  });

  it('shows retry button when onRetry is provided', async () => {
    render(<ErrorDisplay error="Test error" onRetry={mockOnRetry} />);
    
    const retryButton = screen.getByRole('button', { name: 'Try Again' });
    await userEvent.click(retryButton);
    
    expect(mockOnRetry).toHaveBeenCalledTimes(1);
  });

  it('shows dismiss button when onDismiss is provided', async () => {
    render(<ErrorDisplay error="Test error" onDismiss={mockOnDismiss} />);
    
    const dismissButton = screen.getByRole('button', { name: 'Dismiss' });
    await userEvent.click(dismissButton);
    
    expect(mockOnDismiss).toHaveBeenCalledTimes(1);
  });

  it('shows both buttons when both callbacks are provided', () => {
    render(<ErrorDisplay error="Test error" onRetry={mockOnRetry} onDismiss={mockOnDismiss} />);
    
    expect(screen.getByRole('button', { name: 'Try Again' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Dismiss' })).toBeInTheDocument();
  });

  it('does not show action buttons when no callbacks provided', () => {
    render(<ErrorDisplay error="Test error" />);
    
    expect(screen.queryByRole('button', { name: 'Try Again' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Dismiss' })).not.toBeInTheDocument();
  });

  it('converts technical error messages to user-friendly ones', () => {
    const testCases = [
      {
        input: 'Network Error: ECONNREFUSED',
        expected: 'Unable to connect to the server. Please check your internet connection and try again.',
      },
      {
        input: 'Request timeout after 30000ms',
        expected: 'The request took too long to complete. The website might be slow or unavailable.',
      },
      {
        input: 'HTTP 404 Not Found',
        expected: 'The requested page could not be found. Please check the URL and try again.',
      },
      {
        input: 'HTTP 403 Forbidden',
        expected: 'Access to this website is restricted. The site may block automated access.',
      },
      {
        input: 'HTTP 500 Internal Server Error',
        expected: 'The server encountered an error. Please try again later.',
      },
      {
        input: 'Invalid URL format',
        expected: 'Please enter a valid website URL (e.g., https://example.com).',
      },
    ];

    testCases.forEach(({ input, expected }) => {
      const { unmount } = render(<ErrorDisplay error={input} />);
      expect(screen.getByText(expected)).toBeInTheDocument();
      unmount();
    });
  });

  it('shows technical details when showDetails is true', () => {
    const error = new Error('Test error');
    error.stack = 'Error stack trace';
    
    render(<ErrorDisplay error={error} showDetails={true} />);
    
    expect(screen.getByText('Technical Details:')).toBeInTheDocument();
    expect(screen.getByText('Error stack trace')).toBeInTheDocument();
  });

  it('does not show technical details when showDetails is false', () => {
    const error = new Error('Test error');
    error.stack = 'Error stack trace';
    
    render(<ErrorDisplay error={error} showDetails={false} />);
    
    expect(screen.queryByText('Technical Details:')).not.toBeInTheDocument();
    expect(screen.queryByText('Error stack trace')).not.toBeInTheDocument();
  });

  it('handles ApiError with object details', () => {
    const apiError: ApiError = {
      message: 'Validation failed',
      details: { field: 'url', reason: 'invalid format' },
    };
    
    render(<ErrorDisplay error={apiError} showDetails={true} />);
    
    expect(screen.getByText('Technical Details:')).toBeInTheDocument();
    expect(screen.getByText(/"field": "url"/)).toBeInTheDocument();
    expect(screen.getByText(/"reason": "invalid format"/)).toBeInTheDocument();
  });
});