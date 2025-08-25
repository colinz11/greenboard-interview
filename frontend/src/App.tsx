import React, { useState, useEffect } from 'react';
import { ArchiveForm, ArchiveList, ArchivedViewer, ErrorDisplay } from './components';
import VersionList from './components/VersionList';
import HtmlComparison from './components/HtmlComparison';
import ErrorBoundary from './components/ErrorBoundary';
import { archiveApi } from './services/api';
import { Archive } from './types';
import './App.css';

function App() {
  const [archives, setArchives] = useState<Archive[]>([]);
  const [groupedArchives, setGroupedArchives] = useState<{ [url: string]: Archive[] }>({});
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingArchives, setIsLoadingArchives] = useState(true);
  const [error, setError] = useState<string | undefined>(undefined);
  const [selectedArchiveId, setSelectedArchiveId] = useState<string | null>(null);
  const [compareArchiveIds, setCompareArchiveIds] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<'list' | 'versions'>('versions');

  // Load archives on component mount
  useEffect(() => {
    loadArchives();
  }, []);

  const loadArchives = async () => {
    try {
      setIsLoadingArchives(true);
      const [fetchedArchives, fetchedGroupedArchives] = await Promise.all([
        archiveApi.getArchives(),
        archiveApi.getGroupedArchives()
      ]);
      setArchives(fetchedArchives);
      setGroupedArchives(fetchedGroupedArchives);
    } catch (err) {
      console.error('Failed to load archives:', err);
      setError('Failed to load archives. Please refresh the page.');
    } finally {
      setIsLoadingArchives(false);
    }
  };

  const handleCreateArchive = async (url: string) => {
    try {
      setIsLoading(true);
      setError(undefined);
      
      const newArchive = await archiveApi.createArchive(url);
      setArchives(prev => [newArchive, ...prev]);
      
      // Update grouped archives
      setGroupedArchives(prev => {
        const normalizedUrl = url.toLowerCase().replace(/\/$/, '');
        const existing = prev[normalizedUrl] || [];
        return {
          ...prev,
          [normalizedUrl]: [newArchive, ...existing]
        };
      });
      
      // Poll for updates while archiving is in progress
      pollArchiveStatus(newArchive.id);
    } catch (err: any) {
      console.error('Failed to create archive:', err);
      let errorMessage = 'Failed to create archive';
      
      if (err.code === 'ECONNABORTED' || err.message?.includes('timeout')) {
        errorMessage = 'Archive creation is taking longer than expected. The process will continue in the background.';
      } else if (err.response?.data?.message) {
        errorMessage = err.response.data.message;
      } else if (err.message) {
        errorMessage = err.message;
      }
      
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const pollArchiveStatus = async (archiveId: string) => {
    const pollInterval = setInterval(async () => {
      try {
        const updatedArchive = await archiveApi.getArchive(archiveId);
        
        setArchives(prev => 
          prev.map(archive => 
            archive.id === archiveId ? updatedArchive : archive
          )
        );
        
        // Update grouped archives
        setGroupedArchives(prev => {
          const newGrouped = { ...prev };
          for (const url in newGrouped) {
            newGrouped[url] = newGrouped[url].map(archive =>
              archive.id === archiveId ? updatedArchive : archive
            );
          }
          return newGrouped;
        });
        
        // Stop polling if archive is complete or failed
        if (updatedArchive.status === 'completed' || updatedArchive.status === 'failed') {
          clearInterval(pollInterval);
        }
      } catch (err) {
        console.error('Failed to poll archive status:', err);
        clearInterval(pollInterval);
      }
    }, 2000); // Poll every 2 seconds
  };

  const handleSelectArchive = (archiveId: string) => {
    setSelectedArchiveId(archiveId);
  };

  const handleCloseViewer = () => {
    setSelectedArchiveId(null);
  };

  const handleCompareArchives = (archiveIds: string[]) => {
    setCompareArchiveIds(archiveIds);
  };

  const handleCloseComparison = () => {
    setCompareArchiveIds([]);
  };

  const handleReArchive = (url: string) => {
    handleCreateArchive(url);
  };

  const handleDeleteArchive = async (archiveId: string) => {
    try {
      await archiveApi.deleteArchive(archiveId);
      setArchives(prev => prev.filter(archive => archive.id !== archiveId));
      
      // Update grouped archives
      setGroupedArchives(prev => {
        const newGrouped = { ...prev };
        for (const url in newGrouped) {
          newGrouped[url] = newGrouped[url].filter(archive => archive.id !== archiveId);
          // Remove empty groups
          if (newGrouped[url].length === 0) {
            delete newGrouped[url];
          }
        }
        return newGrouped;
      });
    } catch (err: any) {
      console.error('Failed to delete archive:', err);
      setError(err.response?.data?.message || err.message || 'Failed to delete archive');
    }
  };

  const handleRetry = () => {
    setError(undefined);
    loadArchives();
  };

  const handleDismissError = () => {
    setError(undefined);
  };

  return (
    <ErrorBoundary>
      <div className="App">
        {selectedArchiveId ? (
          <ErrorBoundary>
            <ArchivedViewer
              archiveId={selectedArchiveId}
              onClose={handleCloseViewer}
            />
          </ErrorBoundary>
        ) : compareArchiveIds.length === 2 ? (
          <ErrorBoundary>
            <HtmlComparison
              archiveIds={compareArchiveIds}
              onClose={handleCloseComparison}
            />
          </ErrorBoundary>
        ) : (
        <>
          <header className="App-header">
            <h1>Web Archiving Tool</h1>
            <p>Preserve websites for future access</p>
          </header>
          
          <main>
            <ArchiveForm
              onSubmit={handleCreateArchive}
              isLoading={isLoading}
              error={error}
            />
            
            {error && (
              <ErrorDisplay
                error={error}
                onRetry={handleRetry}
                onDismiss={handleDismissError}
              />
            )}
            
            <div className="view-toggle">
              <button
                className={`toggle-button ${viewMode === 'list' ? 'active' : ''}`}
                onClick={() => setViewMode('list')}
              >
                List View
              </button>
              <button
                className={`toggle-button ${viewMode === 'versions' ? 'active' : ''}`}
                onClick={() => setViewMode('versions')}
              >
                Version View
              </button>
            </div>
            
            {viewMode === 'list' ? (
              <ArchiveList
                archives={archives}
                onSelectArchive={handleSelectArchive}
                onReArchive={handleReArchive}
                onDeleteArchive={handleDeleteArchive}
                onCompareArchives={handleCompareArchives}
                isLoading={isLoadingArchives}
              />
            ) : (
              <VersionList
                groupedArchives={groupedArchives}
                onSelectArchive={handleSelectArchive}
                onReArchive={handleReArchive}
                onDeleteArchive={handleDeleteArchive}
                isLoading={isLoadingArchives}
              />
            )}
          </main>
          </>
        )}
      </div>
    </ErrorBoundary>
  );
}

export default App;
