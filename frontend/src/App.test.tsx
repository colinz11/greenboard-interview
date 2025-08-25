import React from 'react';
import { render, screen } from '@testing-library/react';

// Mock the API service to avoid axios import issues
jest.mock('./services/api', () => ({
  archiveApi: {
    getArchives: jest.fn().mockResolvedValue([]),
    createArchive: jest.fn(),
    getArchive: jest.fn(),
    deleteArchive: jest.fn(),
  },
}));

import App from './App';

test('renders web archiving tool header', () => {
  render(<App />);
  const headerElement = screen.getByText(/Web Archiving Tool/i);
  expect(headerElement).toBeInTheDocument();
});

test('renders archive form', () => {
  render(<App />);
  const formElement = screen.getByText(/Archive a Website/i);
  expect(formElement).toBeInTheDocument();
});
