import React from 'react';
import { render, screen } from '@testing-library/react';
import LoadingSpinner from '../LoadingSpinner';

describe('LoadingSpinner', () => {
  it('renders with default props', () => {
    render(<LoadingSpinner />);
    
    expect(screen.getByText('Loading...')).toBeInTheDocument();
    // Check that spinner element exists (it has a specific class)
    const container = screen.getByText('Loading...').parentElement;
    expect(container?.querySelector('[class*="spinner"]')).toBeInTheDocument();
  });

  it('renders with custom message', () => {
    render(<LoadingSpinner message="Archiving website..." />);
    
    expect(screen.getByText('Archiving website...')).toBeInTheDocument();
  });

  it('renders without message when empty string provided', () => {
    render(<LoadingSpinner message="" />);
    
    expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
    // Spinner should still be present
    const container = document.querySelector('[class*="container"]');
    expect(container?.querySelector('[class*="spinner"]')).toBeInTheDocument();
  });

  it('applies correct size classes', () => {
    const { rerender } = render(<LoadingSpinner size="small" message="Small spinner" />);
    
    let container = screen.getByText('Small spinner').parentElement;
    let spinner = container?.querySelector('[class*="spinner"]');
    expect(spinner?.className).toMatch(/spinnerSmall/);
    
    rerender(<LoadingSpinner size="large" message="Large spinner" />);
    
    container = screen.getByText('Large spinner').parentElement;
    spinner = container?.querySelector('[class*="spinner"]');
    expect(spinner?.className).toMatch(/spinnerLarge/);
    
    rerender(<LoadingSpinner size="medium" message="Medium spinner" />);
    
    container = screen.getByText('Medium spinner').parentElement;
    spinner = container?.querySelector('[class*="spinner"]');
    expect(spinner?.className).not.toMatch(/spinnerSmall|spinnerLarge/);
  });

  it('applies correct message size classes', () => {
    const { rerender } = render(<LoadingSpinner size="small" message="Small message" />);
    
    let messageElement = screen.getByText('Small message');
    expect(messageElement.className).toMatch(/messageSmall/);
    
    rerender(<LoadingSpinner size="large" message="Large message" />);
    
    messageElement = screen.getByText('Large message');
    expect(messageElement.className).toMatch(/messageLarge/);
    
    rerender(<LoadingSpinner size="medium" message="Medium message" />);
    
    messageElement = screen.getByText('Medium message');
    expect(messageElement.className).not.toMatch(/messageSmall|messageLarge/);
  });

  it('has proper container structure', () => {
    render(<LoadingSpinner message="Test message" />);
    
    const container = screen.getByText('Test message').parentElement;
    expect(container?.className).toMatch(/container/);
    
    const spinner = container?.querySelector('[class*="spinner"]');
    expect(spinner).toBeInTheDocument();
    
    const message = container?.querySelector('[class*="message"]');
    expect(message).toBeInTheDocument();
    expect(message).toHaveTextContent('Test message');
  });
});