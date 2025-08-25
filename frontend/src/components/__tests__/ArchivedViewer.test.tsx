import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import ArchivedViewer from '../ArchivedViewer';
import { Archive, ArchiveStatus } from '../../types';

// Mock axios
jest.mock('axios', () => ({
  create: jest.fn(() => ({
    get: jest.fn(),
    post: jest.fn(),
    delete: jest.fn(),
  })),
}));

// Mock the API service
jest.mock('../../services/api', () => ({
  archiveApi: {
    getArchive: jest.fn(),
    getArchives: jest.fn(),
    createArchive: jest.fn(),
    deleteArchive: jest.fn(),
  },
}));

// Import the mocked API after mocking
const { archiveApi } = require('../../services/api');
const mockArchiveApi = archiveApi as jest.Mocked<typeof archiveApi>;

// Mock other components
jest.mock('../LoadingSpinner', () => {
  return function MockLoadingSpinner() {
    return <div data-testid="loading-spinner">Loading...</div>;
  };
});

jest.mock('../ErrorDisplay', () => {
  return function MockErrorDisplay({ error, onRetry, onDismiss }: any) {
    return (
      <div data-testid="error-display">
        <p>{error}</p>
        <button onClick={onRetry}>Retry</button>
        <button onClick={onDismiss}>Dismiss</button>
      </div>
    );
  };
});

const mockArchive: Archive = {
  id: 'test-archive-id',
  url: 'https://example.com',
  domain: 'example.com',
  timestamp: new Date('2023-01-01T12:00:00Z'),
  status: ArchiveStatus.COMPLETED,
  metadata: {
    pageCount: 3,
    assetCount: 15,
    totalSize: 1024 * 1024 * 2.5, // 2.5 MB
    crawlDuration: 5000, // 5 seconds
  },
  pages: [
    {
      url: 'https://example.com',
      path: '',
      title: 'Home Page',
      timestamp: new Date('2023-01-01T12:00:00Z'),
      assets: [],
      links: [],
    },
    {
      url: 'https://example.com/about',
      path: 'about/index.html',
      title: 'About Us',
      timestamp: new Date('2023-01-01T12:00:01Z'),
      assets: [],
      links: [],
    },
    {
      url: 'https://example.com/contact',
      path: 'contact/index.html',
      title: 'Contact',
      timestamp: new Date('2023-01-01T12:00:02Z'),
      assets: [],
      links: [],
    },
  ],
  errors: [],
};

describe('ArchivedViewer', () => {
  const mockOnClose = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    // Set up default API mock responses
    mockArchiveApi.getArchive.mockResolvedValue(mockArchive);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('renders loading state initially', async () => {
    // Delay the API response to test loading state
    mockArchiveApi.getArchive.mockImplementation(
      () => new Promise(resolve => setTimeout(() => resolve(mockArchive), 100))
    );

    render(
      <ArchivedViewer
        archiveId="test-archive-id"
        onClose={mockOnClose}
      />
    );

    expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
    expect(screen.getByText('Loading archive...')).toBeInTheDocument();

    // Wait for loading to complete
    await waitFor(() => {
      expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument();
    });
  });

  it('renders archive information correctly', async () => {
    render(
      <ArchivedViewer
        archiveId="test-archive-id"
        onClose={mockOnClose}
      />
    );

    await waitFor(() => {
      expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument();
    });

    // Check archive indicator and URL
    expect(screen.getByText('📁 ARCHIVED')).toBeInTheDocument();
    expect(screen.getByText('https://example.com')).toBeInTheDocument();

    // Check timestamp
    expect(screen.getByText(/Archived:/)).toBeInTheDocument();

    // Check status
    expect(screen.getByText('COMPLETED')).toBeInTheDocument();

    // Check page count
    expect(screen.getByText('3 pages')).toBeInTheDocument();

    // Check metadata in footer
    expect(screen.getByText('Size: 2.50 MB')).toBeInTheDocument();
    expect(screen.getByText('Assets: 15')).toBeInTheDocument();
    expect(screen.getByText('Duration: 5s')).toBeInTheDocument();
  });

  it('renders iframe with correct src URL', async () => {
    render(
      <ArchivedViewer
        archiveId="test-archive-id"
        initialPath="about/index.html"
        onClose={mockOnClose}
      />
    );

    await waitFor(() => {
      expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument();
    });

    const iframe = screen.getByTitle('Archived content: https://example.com');
    expect(iframe).toBeInTheDocument();
    expect(iframe).toHaveAttribute(
      'src',
      'http://localhost:3001/api/archives/test-archive-id/content/about/index.html'
    );
  });

  it('displays current path correctly', async () => {
    render(
      <ArchivedViewer
        archiveId="test-archive-id"
        initialPath="about/index.html"
        onClose={mockOnClose}
      />
    );

    await waitFor(() => {
      expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument();
    });

    expect(screen.getByText('/about/index.html')).toBeInTheDocument();
  });

  it('displays default path when no initial path provided', async () => {
    render(
      <ArchivedViewer
        archiveId="test-archive-id"
        onClose={mockOnClose}
      />
    );

    await waitFor(() => {
      expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument();
    });

    expect(screen.getByText('/index.html')).toBeInTheDocument();
  });

  it('renders page selector with available pages', async () => {
    render(
      <ArchivedViewer
        archiveId="test-archive-id"
        onClose={mockOnClose}
      />
    );

    await waitFor(() => {
      expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument();
    });

    const pageSelect = screen.getByLabelText('Jump to page:');
    expect(pageSelect).toBeInTheDocument();

    // Check options
    expect(screen.getByText('Home Page')).toBeInTheDocument();
    expect(screen.getByText('About Us')).toBeInTheDocument();
    expect(screen.getByText('Contact')).toBeInTheDocument();
  });

  it('handles page navigation via selector', async () => {
    render(
      <ArchivedViewer
        archiveId="test-archive-id"
        onClose={mockOnClose}
      />
    );

    await waitFor(() => {
      expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument();
    });

    const pageSelect = screen.getByLabelText('Jump to page:');
    
    // Navigate to about page
    fireEvent.change(pageSelect, { target: { value: 'about/index.html' } });

    // Check that path display updated
    expect(screen.getByText('/about/index.html')).toBeInTheDocument();

    // Check that iframe src updated
    const iframe = screen.getByTitle('Archived content: https://example.com');
    expect(iframe).toHaveAttribute(
      'src',
      'http://localhost:3001/api/archives/test-archive-id/content/about/index.html'
    );
  });

  it('handles close button click', async () => {
    render(
      <ArchivedViewer
        archiveId="test-archive-id"
        onClose={mockOnClose}
      />
    );

    await waitFor(() => {
      expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument();
    });

    const closeButton = screen.getByText('✕ Close');
    fireEvent.click(closeButton);

    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it('handles refresh button click', async () => {
    render(
      <ArchivedViewer
        archiveId="test-archive-id"
        onClose={mockOnClose}
      />
    );

    await waitFor(() => {
      expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument();
    });

    const refreshButton = screen.getByTitle('Refresh current page');
    expect(refreshButton).toBeInTheDocument();

    // Click refresh button
    fireEvent.click(refreshButton);

    // The iframe src should be updated (though we can't easily test this in jsdom)
    const iframe = screen.getByTitle('Archived content: https://example.com');
    expect(iframe).toBeInTheDocument();
  });

  it('displays error state when archive loading fails', async () => {
    const errorMessage = 'Archive not found';
    mockArchiveApi.getArchive.mockRejectedValue(new Error(errorMessage));

    render(
      <ArchivedViewer
        archiveId="test-archive-id"
        onClose={mockOnClose}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId('error-display')).toBeInTheDocument();
    });

    expect(screen.getByText(errorMessage)).toBeInTheDocument();
  });

  it('handles retry after error', async () => {
    const errorMessage = 'Network error';
    mockArchiveApi.getArchive
      .mockRejectedValueOnce(new Error(errorMessage))
      .mockResolvedValueOnce(mockArchive);

    render(
      <ArchivedViewer
        archiveId="test-archive-id"
        onClose={mockOnClose}
      />
    );

    // Wait for error state
    await waitFor(() => {
      expect(screen.getByTestId('error-display')).toBeInTheDocument();
    });

    // Click retry
    const retryButton = screen.getByText('Retry');
    fireEvent.click(retryButton);

    // Wait for successful load
    await waitFor(() => {
      expect(screen.queryByTestId('error-display')).not.toBeInTheDocument();
    }, { timeout: 3000 });

    // Wait for the archive content to load
    await waitFor(() => {
      expect(screen.getByText('https://example.com')).toBeInTheDocument();
    }, { timeout: 3000 });
  });

  it('displays archive with errors indicator', async () => {
    const archiveWithErrors = {
      ...mockArchive,
      errors: [
        {
          timestamp: new Date(),
          type: 'network',
          message: 'Failed to load image',
          url: 'https://example.com/image.jpg',
          recoverable: false,
        },
        {
          timestamp: new Date(),
          type: 'timeout',
          message: 'Request timeout',
          url: 'https://example.com/slow-page',
          recoverable: true,
        },
      ],
    };

    mockArchiveApi.getArchive.mockResolvedValue(archiveWithErrors);

    render(
      <ArchivedViewer
        archiveId="test-archive-id"
        onClose={mockOnClose}
      />
    );

    await waitFor(() => {
      expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument();
    });

    expect(screen.getByText('⚠️ 2 error(s) during archiving')).toBeInTheDocument();
  });

  it('displays different status styles correctly', async () => {
    const partialArchive = {
      ...mockArchive,
      status: ArchiveStatus.PARTIAL,
    };

    mockArchiveApi.getArchive.mockResolvedValue(partialArchive);

    render(
      <ArchivedViewer
        archiveId="test-archive-id"
        onClose={mockOnClose}
      />
    );

    await waitFor(() => {
      expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument();
    });

    const statusElement = screen.getByText('PARTIAL');
    expect(statusElement).toHaveAttribute('data-status', 'partial');
  });

  it('handles API error response format', async () => {
    const apiError = {
      response: {
        data: {
          message: 'Archive not found in database',
        },
      },
    };

    mockArchiveApi.getArchive.mockRejectedValue(apiError);

    render(
      <ArchivedViewer
        archiveId="test-archive-id"
        onClose={mockOnClose}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId('error-display')).toBeInTheDocument();
    });

    expect(screen.getByText('Archive not found in database')).toBeInTheDocument();
  });

  it('uses correct API base URL from environment', async () => {
    // Mock environment variable
    const originalEnv = process.env.REACT_APP_API_URL;
    process.env.REACT_APP_API_URL = 'https://api.example.com';

    render(
      <ArchivedViewer
        archiveId="test-archive-id"
        onClose={mockOnClose}
      />
    );

    await waitFor(() => {
      expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument();
    });

    const iframe = screen.getByTitle('Archived content: https://example.com');
    expect(iframe).toHaveAttribute(
      'src',
      'https://api.example.com/api/archives/test-archive-id/content/'
    );

    // Restore original environment
    process.env.REACT_APP_API_URL = originalEnv;
  });

  it('handles empty pages array gracefully', async () => {
    const archiveWithNoPages = {
      ...mockArchive,
      pages: [],
    };

    mockArchiveApi.getArchive.mockResolvedValue(archiveWithNoPages);

    render(
      <ArchivedViewer
        archiveId="test-archive-id"
        onClose={mockOnClose}
      />
    );

    await waitFor(() => {
      expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument();
    });

    // Page selector should not be rendered
    expect(screen.queryByLabelText('Jump to page:')).not.toBeInTheDocument();
  });
});