import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ArchiveForm from '../ArchiveForm';

describe('ArchiveForm', () => {
  const mockOnSubmit = jest.fn();

  beforeEach(() => {
    mockOnSubmit.mockClear();
  });

  it('renders form elements correctly', () => {
    render(<ArchiveForm onSubmit={mockOnSubmit} isLoading={false} />);
    
    expect(screen.getByText('Archive a Website')).toBeInTheDocument();
    expect(screen.getByLabelText('Website URL')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Start Archive' })).toBeInTheDocument();
  });

  it('validates URL input correctly', async () => {
    render(<ArchiveForm onSubmit={mockOnSubmit} isLoading={false} />);
    
    const input = screen.getByLabelText('Website URL');
    const button = screen.getByRole('button', { name: 'Start Archive' });
    
    // Test empty URL - button should be disabled
    expect(button).toBeDisabled();
    
    // Test invalid URL
    await userEvent.type(input, 'invalid-url');
    expect(button).not.toBeDisabled();
    await userEvent.click(button);
    expect(screen.getByText('Please enter a valid URL')).toBeInTheDocument();
    expect(mockOnSubmit).not.toHaveBeenCalled();
    
    // Test non-HTTP protocol
    await userEvent.clear(input);
    await userEvent.type(input, 'ftp://example.com');
    await userEvent.click(button);
    expect(screen.getByText('URL must use HTTP or HTTPS protocol')).toBeInTheDocument();
    expect(mockOnSubmit).not.toHaveBeenCalled();
  });

  it('submits valid URL', async () => {
    render(<ArchiveForm onSubmit={mockOnSubmit} isLoading={false} />);
    
    const input = screen.getByLabelText('Website URL');
    const button = screen.getByRole('button', { name: 'Start Archive' });
    
    await userEvent.type(input, 'https://example.com');
    await userEvent.click(button);
    
    expect(mockOnSubmit).toHaveBeenCalledWith('https://example.com');
  });

  it('clears validation error when user starts typing', async () => {
    render(<ArchiveForm onSubmit={mockOnSubmit} isLoading={false} />);
    
    const input = screen.getByLabelText('Website URL');
    const button = screen.getByRole('button', { name: 'Start Archive' });
    
    // Type invalid URL to trigger validation error
    await userEvent.type(input, 'invalid-url');
    await userEvent.click(button);
    expect(screen.getByText('Please enter a valid URL')).toBeInTheDocument();
    
    // Start typing to clear error
    await userEvent.clear(input);
    await userEvent.type(input, 'h');
    expect(screen.queryByText('Please enter a valid URL')).not.toBeInTheDocument();
  });

  it('shows loading state correctly', () => {
    render(<ArchiveForm onSubmit={mockOnSubmit} isLoading={true} />);
    
    expect(screen.getByText('Archiving website... This may take a few minutes.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Archiving...' })).toBeDisabled();
    expect(screen.getByLabelText('Website URL')).toBeDisabled();
  });

  it('displays error message when provided', () => {
    const errorMessage = 'Failed to archive website';
    render(<ArchiveForm onSubmit={mockOnSubmit} isLoading={false} error={errorMessage} />);
    
    expect(screen.getByText(errorMessage)).toBeInTheDocument();
  });

  it('disables submit button when URL is empty', async () => {
    render(<ArchiveForm onSubmit={mockOnSubmit} isLoading={false} />);
    
    const button = screen.getByRole('button', { name: 'Start Archive' });
    expect(button).toBeDisabled();
    
    const input = screen.getByLabelText('Website URL');
    await userEvent.type(input, 'https://example.com');
    expect(button).not.toBeDisabled();
    
    await userEvent.clear(input);
    expect(button).toBeDisabled();
  });

  it('handles form submission with Enter key', async () => {
    render(<ArchiveForm onSubmit={mockOnSubmit} isLoading={false} />);
    
    const input = screen.getByLabelText('Website URL');
    await userEvent.type(input, 'https://example.com');
    await userEvent.keyboard('{Enter}');
    
    expect(mockOnSubmit).toHaveBeenCalledWith('https://example.com');
  });
});