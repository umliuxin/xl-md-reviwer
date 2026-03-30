import { useState } from 'react';
import { PRInput } from './components/PRInput';
import { MarkdownViewer } from './components/MarkdownViewer';
import { CommentSidebar } from './components/CommentSidebar';
import { fetchPRInfo } from './services/github';
import type { PRInfo } from './types';
import './App.css';

function App() {
  const [prInfo, setPrInfo] = useState<PRInfo | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedFileIndex, setSelectedFileIndex] = useState(0);
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);

  const handleLoadPR = async (owner: string, repo: string, prNumber: number) => {
    setIsLoading(true);
    setError(null);
    try {
      const info = await fetchPRInfo(owner, repo, prNumber);
      if (info.files.length === 0) {
        setError('No markdown files found in this PR');
        return;
      }
      setPrInfo(info);
      setSelectedFileIndex(0);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load PR');
    } finally {
      setIsLoading(false);
    }
  };

  const handleBlockSelect = (blockId: string) => {
    setSelectedBlockId(blockId);
  };

  if (!prInfo) {
    return <PRInput onSubmit={handleLoadPR} isLoading={isLoading} error={error} />;
  }

  const currentFile = prInfo.files[selectedFileIndex];

  return (
    <div className="app">
      <header className="app-header">
        <button className="back-btn" onClick={() => setPrInfo(null)}>
          ← Back
        </button>
        <div className="pr-info">
          <span className="pr-title">{prInfo.title}</span>
          <span className="pr-meta">
            {prInfo.owner}/{prInfo.repo} #{prInfo.number}
          </span>
        </div>
        {prInfo.files.length > 1 && (
          <select
            className="file-selector"
            value={selectedFileIndex}
            onChange={(e) => setSelectedFileIndex(Number(e.target.value))}
          >
            {prInfo.files.map((file, index) => (
              <option key={file.path} value={index}>
                {file.path}
              </option>
            ))}
          </select>
        )}
      </header>

      <main className="app-main">
        <div className="viewer-container" onClick={(e) => {
          const target = e.target as HTMLElement;
          const block = target.closest('[data-block-id]') as HTMLElement | null;
          if (block) {
            handleBlockSelect(block.dataset.blockId!);
          }
        }}>
          <MarkdownViewer content={currentFile.content} filePath={currentFile.path} />
        </div>
        <CommentSidebar selectedBlockId={selectedBlockId} />
      </main>
    </div>
  );
}

export default App;
