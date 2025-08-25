import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import VersionComparison from '../VersionComparison';
import { Archive, ArchiveStatus } from '../../types';

describe('VersionComparison', () => {
  const mockArchive1: Archive = {
    id: 'archive-1',
    url: 'https://example.com',
    domain: 'example.com',
    timestamp: new Date('2023-01-01T00:00:00Z'),
    status: ArchiveStatus.COMPLETED,
    version: 1,
    metadata: {
      pageCount: 3,
      assetCount: 5,
      totalSize: 1024,
      crawlDuration: 1000,
    },
    pages: [],
    errors: [],
  };

  const mockArchive2: Archive = {
    id: 'archive-2',
    url: 'https://example.com',
    domain: 'example.com',
    timestamp: new Date('2023-01-02T00:00:00Z'),
    status: ArchiveStatus.COMPLETED,
    version: 2,
    metadata: {
      pageCount: 5,
      assetCount: 10,
      totalSize: 2048,
      crawlDuration: 2000,
    },
    pages: [],
    errors: [
      {
        timestamp: new Date('2023-01-02T00:00:00Z'),
        type: 'network_error',
        message: 'Failed to fetch asset',
        recoverable: true,
      },
    ],
  };

  const mockArchive3: Archive = {
    id: 'archive-3',
    url: 'https://example.com',
    domain: 'example.com',
    timestamp: new Date('2023-01-03T00:00:00Z'),
    status: ArchiveStatus.COMPLETED,
    version: 3,
    metadata: {
      pageCount: 4,
      assetCount: 8,
      totalSize: 1536,
      crawlDuration: 1500,
    },
    pages: [],
    errors: [],
  };

  const versions = [mockArchive3, mockArchive2, mockArchive1]; // Sorted by version desc
  const selectedVersions: [Archive, Archive] = [mockArchive1, mockArchive2]; // older, newer

  const defaultProps = {
    versions,
    selectedVersions,
    onVersionSelect: jest.fn(),
    onClose: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the comparison modal', () => {
    render(<VersionComparison {...defaultProps} />);
    
    expect(screen.getByText('Version Comparison')).toBeInTheDocument();
    expect(screen.getByText('Version 1 (Older):')).toBeInTheDocument();
    expect(screen.getByText('Version 2 (Newer):')).toBeInTheDocument();
  });

  it('displays basic information correctly', () => {
    render(<VersionComparison {...defaultProps} />);
    
    expect(screen.getByText('https://example.com')).toBeInTheDocument();
    expect(screen.getByText('v1 → v2')).toBeInTheDocument();
    expect(screen.getByText('completed → completed')).toBeInTheDocument();
  });

  it('displays metadata changes with correct diff indicators', () => {
    render(<VersionComparison {...defaultProps} />);
    
    // Check for positive changes in metadata
    expect(screen.getByText('+2')).toBeInTheDocument();
    expect(screen.getByText('+5')).toBeInTheDocument();
    expect(screen.getByText('+1024 bytes')).toBeInTheDocument();
  });

  it('displays negative changes correctly', () => {
    // Test with archive3 (newer) vs archive2 (older) to show decreases
    const propsWithDecrease = {
      ...defaultProps,
      selectedVersions: [mockArchive2, mockArchive3] as [Archive, Archive], // v2 → v3
    };

    render(<VersionComparison {...propsWithDecrease} />);
    
    // Check for negative changes in metadata
    expect(screen.getByText('-2')).toBeInTheDocument();
    expect(screen.getByText('-512 bytes')).toBeInTheDocument();
  });

  it('displays "No change" for identical values', () => {
    const identicalArchive = {
      ...mockArchive2,
      id: 'archive-identical',
      version: 3,
      timestamp: new Date('2023-01-03T00:00:00Z'),
    };

    const propsWithNoChange = {
      ...defaultProps,
      selectedVersions: [mockArchive2, identicalArchive] as [Archive, Archive],
    };

    render(<VersionComparison {...propsWithNoChange} />);
    
    // Should show "No change" for identical metadata
    const noChangeElements = screen.getAllByText('No change');
    expect(noChangeElements.length).toBeGreaterThan(0);
  });

  it('displays timestamps and time difference', () => {
    render(<VersionComparison {...defaultProps} />);
    
    expect(screen.getByText(/12\/31\/2022.*7:00:00 PM/)).toBeInTheDocument();
    expect(screen.getByText(/1\/1\/2023.*7:00:00 PM/)).toBeInTheDocument();
    expect(screen.getByText('1 days')).toBeInTheDocument();
  });

  it('displays error information when errors exist', () => {
    render(<VersionComparison {...defaultProps} />);
    
    expect(screen.getByText('Version 1 Errors:')).toBeInTheDocument();
    expect(screen.getByText('Version 2 Errors:')).toBeInTheDocument();
    expect(screen.getByText('0')).toBeInTheDocument(); // Version 1 errors
    expect(screen.getByText('1')).toBeInTheDocument(); // Version 2 errors
  });

  it('hides error section when no errors exist', () => {
    const propsWithoutErrors = {
      ...defaultProps,
      selectedVersions: [mockArchive1, mockArchive3] as [Archive, Archive], // Both have no errors
    };

    render(<VersionComparison {...propsWithoutErrors} />);
    
    // Error section should not be visible when both versions have no errors
    expect(screen.queryByText('Version 1 Errors:')).not.toBeInTheDocument();
  });

  it('allows changing version selections', () => {
    render(<VersionComparison {...defaultProps} />);
    
    const version1Select = screen.getAllByRole('combobox')[0];
    const version2Select = screen.getAllByRole('combobox')[1];
    
    // Change version 1 selection
    fireEvent.change(version1Select, { target: { value: 'archive-2' } });
    expect(defaultProps.onVersionSelect).toHaveBeenCalledWith(0, mockArchive2);
    
    // Change version 2 selection
    fireEvent.change(version2Select, { target: { value: 'archive-3' } });
    expect(defaultProps.onVersionSelect).toHaveBeenCalledWith(1, mockArchive3);
  });

  it('displays version options in select dropdowns', () => {
    render(<VersionComparison {...defaultProps} />);
    
    const selects = screen.getAllByRole('combobox');
    
    // Check that all versions are available in both selects
    versions.forEach(version => {
      const optionText = `v${version.version} - ${version.timestamp.toLocaleString()}`;
      expect(screen.getAllByText(optionText)).toHaveLength(2); // One in each select
    });
  });

  it('calls onClose when close button is clicked', () => {
    render(<VersionComparison {...defaultProps} />);
    
    const closeButtons = screen.getAllByText('×');
    fireEvent.click(closeButtons[0]); // Header close button
    
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it('calls onClose when footer close button is clicked', () => {
    render(<VersionComparison {...defaultProps} />);
    
    const footerCloseButton = screen.getByText('Close Comparison');
    fireEvent.click(footerCloseButton);
    
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it('formats file sizes correctly', () => {
    const largeArchive = {
      ...mockArchive1,
      metadata: {
        ...mockArchive1.metadata,
        totalSize: 1024 * 1024 * 5, // 5 MB
      },
    };

    const propsWithLargeSize = {
      ...defaultProps,
      selectedVersions: [mockArchive1, largeArchive] as [Archive, Archive],
    };

    render(<VersionComparison {...propsWithLargeSize} />);
    
    expect(screen.getAllByText((content, element) => {
      return element?.textContent?.includes('1 KB → 5 MB') || false;
    })[0]).toBeInTheDocument();
  });

  it('calculates time difference correctly for different periods', () => {
    const oldArchive = {
      ...mockArchive1,
      timestamp: new Date('2023-01-01T00:00:00Z'),
    };

    const newArchive = {
      ...mockArchive2,
      timestamp: new Date('2023-01-08T00:00:00Z'), // 7 days later
    };

    const propsWithWeekDiff = {
      ...defaultProps,
      selectedVersions: [oldArchive, newArchive] as [Archive, Archive],
    };

    render(<VersionComparison {...propsWithWeekDiff} />);
    
    expect(screen.getByText('7 days')).toBeInTheDocument();
  });

  it('handles same-day timestamps', () => {
    const sameDay1 = {
      ...mockArchive1,
      timestamp: new Date('2023-01-01T10:00:00Z'),
    };

    const sameDay2 = {
      ...mockArchive2,
      timestamp: new Date('2023-01-01T15:00:00Z'),
    };

    const propsWithSameDay = {
      ...defaultProps,
      selectedVersions: [sameDay1, sameDay2] as [Archive, Archive],
    };

    render(<VersionComparison {...propsWithSameDay} />);
    
    expect(screen.getByText('0 days')).toBeInTheDocument();
  });

  it('applies correct CSS classes for diff indicators', () => {
    render(<VersionComparison {...defaultProps} />);
    
    // Positive changes should have positive class
    const positiveElements = screen.getAllByText('+2');
    expect(positiveElements[0]).toHaveClass('diffPositive');
    
    // Test with negative change
    const propsWithDecrease = {
      ...defaultProps,
      selectedVersions: [mockArchive2, mockArchive3] as [Archive, Archive],
    };

    render(<VersionComparison {...propsWithDecrease} />);
    
    const negativeElements = screen.getAllByText('-2');
    expect(negativeElements[0]).toHaveClass('diffNegative');
  });
});