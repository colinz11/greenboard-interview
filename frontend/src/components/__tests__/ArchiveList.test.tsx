import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ArchiveList from '../ArchiveList';
import { Archive, ArchiveStatus } from '../../types';

// Mock window.confirm
const mockConfirm = jest.fn();
Object.defineProperty(window, 'confirm', {
  value: mockConfirm,
});

describe('ArchiveList', () => {
  const mockOnSelectArchive = jest.fn();
  const mockOnReArchive = jest.fn();
  const mockOnDeleteArchive = jest.fn();

  const mockArchive: Archive = {
    id: '1',
    url: 'https://example.com',
    domain: 'example.com',
    timestamp: new Date('2023-01-01T12:00:00Z'),
    status: ArchiveStatus.COMPLETED,
    metadata: {
      pageCount: 5,
      assetCount: 20,
      totalSize: 1024000,
      crawlDuration: 30000,
    },
    pages: [],
    errors: [],
  };

  beforeEach(() => {
    mockOnSelectArchive.mockClear();
    mockOnReArchive.mockClear();
    mockOnDeleteArchive.mockClear();
    mockConfirm.mockClear();
  });

  it('renders empty state when no archives', () => {
    render(
      <ArchiveList
        archives={[]}
        onSelectArchive={mockOnSelectArchive}
        onReArchive={mockOnReArchive}
        onDeleteArchive={mockOnDeleteArchive}
      />
    );
    
    expect(screen.getByText('No Archives Yet')).toBeInTheDocument();
    expect(screen.getByText('Start by archiving your first website using the form above.')).toBeInTheDocument();
  });

  it('renders loading state', () => {
    render(
      <ArchiveList
        archives={[]}
        onSelectArchive={mockOnSelectArchive}
        onReArchive={mockOnReArchive}
        onDeleteArchive={mockOnDeleteArchive}
        isLoading={true}
      />
    );
    
    expect(screen.getByText('Loading archives...')).toBeInTheDocument();
  });

  it('renders archive list correctly', () => {
    render(
      <ArchiveList
        archives={[mockArchive]}
        onSelectArchive={mockOnSelectArchive}
        onReArchive={mockOnReArchive}
        onDeleteArchive={mockOnDeleteArchive}
      />
    );
    
    expect(screen.getByText('Archived Websites (1)')).toBeInTheDocument();
    expect(screen.getByText('https://example.com')).toBeInTheDocument();
    expect(screen.getByText(/Archived on/)).toBeInTheDocument();
    expect(screen.getByText('completed')).toBeInTheDocument();
  });

  it('displays archive metadata correctly', () => {
    render(
      <ArchiveList
        archives={[mockArchive]}
        onSelectArchive={mockOnSelectArchive}
        onReArchive={mockOnReArchive}
        onDeleteArchive={mockOnDeleteArchive}
      />
    );
    
    expect(screen.getByText('📄 5 pages')).toBeInTheDocument();
    expect(screen.getByText('🗂️ 20 assets')).toBeInTheDocument();
    expect(screen.getByText('💾 1000 KB')).toBeInTheDocument();
    expect(screen.getByText('⏱️ 30s')).toBeInTheDocument();
  });

  it('handles view archive action', async () => {
    render(
      <ArchiveList
        archives={[mockArchive]}
        onSelectArchive={mockOnSelectArchive}
        onReArchive={mockOnReArchive}
        onDeleteArchive={mockOnDeleteArchive}
      />
    );
    
    const viewButton = screen.getByRole('button', { name: 'View' });
    await userEvent.click(viewButton);
    
    expect(mockOnSelectArchive).toHaveBeenCalledWith('1');
  });

  it('handles re-archive action with confirmation', async () => {
    mockConfirm.mockReturnValue(true);
    
    render(
      <ArchiveList
        archives={[mockArchive]}
        onSelectArchive={mockOnSelectArchive}
        onReArchive={mockOnReArchive}
        onDeleteArchive={mockOnDeleteArchive}
      />
    );
    
    const reArchiveButton = screen.getByRole('button', { name: 'Re-archive' });
    await userEvent.click(reArchiveButton);
    
    expect(mockConfirm).toHaveBeenCalledWith('This will create a new archive of this website. Continue?');
    expect(mockOnReArchive).toHaveBeenCalledWith('https://example.com');
  });

  it('cancels re-archive when user declines confirmation', async () => {
    mockConfirm.mockReturnValue(false);
    
    render(
      <ArchiveList
        archives={[mockArchive]}
        onSelectArchive={mockOnSelectArchive}
        onReArchive={mockOnReArchive}
        onDeleteArchive={mockOnDeleteArchive}
      />
    );
    
    const reArchiveButton = screen.getByRole('button', { name: 'Re-archive' });
    await userEvent.click(reArchiveButton);
    
    expect(mockConfirm).toHaveBeenCalled();
    expect(mockOnReArchive).not.toHaveBeenCalled();
  });

  it('handles delete archive action with confirmation', async () => {
    mockConfirm.mockReturnValue(true);
    
    render(
      <ArchiveList
        archives={[mockArchive]}
        onSelectArchive={mockOnSelectArchive}
        onReArchive={mockOnReArchive}
        onDeleteArchive={mockOnDeleteArchive}
      />
    );
    
    const deleteButton = screen.getByRole('button', { name: 'Delete' });
    await userEvent.click(deleteButton);
    
    expect(mockConfirm).toHaveBeenCalledWith('Are you sure you want to delete this archive? This action cannot be undone.');
    expect(mockOnDeleteArchive).toHaveBeenCalledWith('1');
  });

  it('cancels delete when user declines confirmation', async () => {
    mockConfirm.mockReturnValue(false);
    
    render(
      <ArchiveList
        archives={[mockArchive]}
        onSelectArchive={mockOnSelectArchive}
        onReArchive={mockOnReArchive}
        onDeleteArchive={mockOnDeleteArchive}
      />
    );
    
    const deleteButton = screen.getByRole('button', { name: 'Delete' });
    await userEvent.click(deleteButton);
    
    expect(mockConfirm).toHaveBeenCalled();
    expect(mockOnDeleteArchive).not.toHaveBeenCalled();
  });

  it('shows errors when archive has errors', () => {
    const archiveWithErrors: Archive = {
      ...mockArchive,
      errors: [
        {
          timestamp: new Date(),
          type: 'NETWORK_ERROR',
          message: 'Failed to fetch asset',
          url: 'https://example.com/image.jpg',
          recoverable: false,
        },
        {
          timestamp: new Date(),
          type: 'TIMEOUT',
          message: 'Request timeout',
          recoverable: true,
        },
      ],
    };

    render(
      <ArchiveList
        archives={[archiveWithErrors]}
        onSelectArchive={mockOnSelectArchive}
        onReArchive={mockOnReArchive}
        onDeleteArchive={mockOnDeleteArchive}
      />
    );
    
    expect(screen.getByText('⚠️ 2 errors occurred')).toBeInTheDocument();
  });

  it('handles different archive statuses correctly', () => {
    const archives: Archive[] = [
      { ...mockArchive, id: '1', status: ArchiveStatus.COMPLETED },
      { ...mockArchive, id: '2', status: ArchiveStatus.IN_PROGRESS },
      { ...mockArchive, id: '3', status: ArchiveStatus.FAILED },
      { ...mockArchive, id: '4', status: ArchiveStatus.PARTIAL },
    ];

    render(
      <ArchiveList
        archives={archives}
        onSelectArchive={mockOnSelectArchive}
        onReArchive={mockOnReArchive}
        onDeleteArchive={mockOnDeleteArchive}
      />
    );
    
    expect(screen.getByText('completed')).toBeInTheDocument();
    expect(screen.getByText('in progress')).toBeInTheDocument();
    expect(screen.getByText('failed')).toBeInTheDocument();
    expect(screen.getByText('partial')).toBeInTheDocument();
  });

  it('only shows view button for completed archives', () => {
    const archives: Archive[] = [
      { ...mockArchive, id: '1', status: ArchiveStatus.COMPLETED },
      { ...mockArchive, id: '2', status: ArchiveStatus.IN_PROGRESS },
    ];

    render(
      <ArchiveList
        archives={archives}
        onSelectArchive={mockOnSelectArchive}
        onReArchive={mockOnReArchive}
        onDeleteArchive={mockOnDeleteArchive}
      />
    );
    
    // Should have only one View button (for completed archive)
    const viewButtons = screen.getAllByRole('button', { name: 'View' });
    expect(viewButtons).toHaveLength(1);
    
    // Should have two Re-archive buttons (for both archives)
    const reArchiveButtons = screen.getAllByRole('button', { name: 'Re-archive' });
    expect(reArchiveButtons).toHaveLength(2);
  });
});