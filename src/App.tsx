import { useState, useEffect, useCallback } from 'react';
import { PRInput } from './components/PRInput';
import { MarkdownViewer } from './components/MarkdownViewer';
import { CommentSidebar } from './components/CommentSidebar';
import {
  fetchPRInfo,
  fetchAllComments,
  addPendingComment,
  deletePendingComment,
  replyToComment,
  submitReview,
} from './services/github';
import { buildLineMapping } from './services/lineMapping';
import type { PRInfo, PRComments, ReviewEvent } from './types';
import './App.css';

const emptyComments: PRComments = {
  submitted: [],
  pending: [],
  pendingReview: null,
};

function App() {
  const [prInfo, setPrInfo] = useState<PRInfo | null>(null);
  const [comments, setComments] = useState<PRComments>(emptyComments);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedFileIndex, setSelectedFileIndex] = useState(0);
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [lineMapping, setLineMapping] = useState<Map<number, string> | null>(null);
  const [blockToLine, setBlockToLine] = useState<Map<string, number> | null>(null);

  // Build line mapping when file changes
  useEffect(() => {
    if (prInfo && prInfo.files[selectedFileIndex]) {
      const file = prInfo.files[selectedFileIndex];
      const mapping = buildLineMapping(file.path, file.content);
      setLineMapping(mapping.lineToBlockId);
      setBlockToLine(mapping.blockIdToLine);
    }
  }, [prInfo, selectedFileIndex]);

  // Apply line mapping to comments
  const mappedComments: PRComments = {
    ...comments,
    submitted: comments.submitted.map((thread) => {
      const blockId = lineMapping?.get(thread.line) || null;
      console.log(`[App] Comment thread ${thread.id}: line ${thread.line} -> blockId ${blockId}`);
      return { ...thread, blockId };
    }),
    pending: comments.pending.map((thread) => {
      const blockId = lineMapping?.get(thread.line) || null;
      console.log(`[App] Pending thread ${thread.id}: line ${thread.line} -> blockId ${blockId}`);
      return { ...thread, blockId };
    }),
  };

  const loadComments = useCallback(async (owner: string, repo: string, prNumber: number) => {
    try {
      const allComments = await fetchAllComments(owner, repo, prNumber);
      setComments(allComments);
    } catch (e) {
      console.error('Failed to load comments:', e);
    }
  }, []);

  const handleLoadPR = async (owner: string, repo: string, prNumber: number) => {
    setIsLoading(true);
    setError(null);
    setComments(emptyComments);

    try {
      const info = await fetchPRInfo(owner, repo, prNumber);
      if (info.files.length === 0) {
        setError('No markdown files found in this PR');
        return;
      }
      setPrInfo(info);
      setSelectedFileIndex(0);
      setSelectedBlockId(null);

      // Load comments
      await loadComments(owner, repo, prNumber);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load PR');
    } finally {
      setIsLoading(false);
    }
  };

  const handleBlockSelect = (blockId: string) => {
    setSelectedBlockId(blockId);
  };

  const handleAddComment = async (blockId: string, body: string) => {
    if (!prInfo || !blockToLine) return;

    const line = blockToLine.get(blockId);
    if (!line) {
      console.error('Could not find line number for block:', blockId);
      return;
    }

    const currentFile = prInfo.files[selectedFileIndex];

    await addPendingComment(
      prInfo.owner,
      prInfo.repo,
      prInfo.number,
      prInfo.headSha,
      currentFile.path,
      line,
      body
    );

    // Refresh comments
    await loadComments(prInfo.owner, prInfo.repo, prInfo.number);
  };

  const handleDeleteComment = async (commentId: number) => {
    if (!prInfo) return;

    await deletePendingComment(prInfo.owner, prInfo.repo, commentId);

    // Refresh comments
    await loadComments(prInfo.owner, prInfo.repo, prInfo.number);
  };

  const handleReplyToComment = async (commentId: number, body: string) => {
    if (!prInfo) return;

    await replyToComment(prInfo.owner, prInfo.repo, prInfo.number, commentId, body);

    // Refresh comments
    await loadComments(prInfo.owner, prInfo.repo, prInfo.number);
  };

  const handlePublishReview = async (event: ReviewEvent, body?: string) => {
    if (!prInfo || !comments.pendingReview) return;

    await submitReview(
      prInfo.owner,
      prInfo.repo,
      prInfo.number,
      comments.pendingReview.id,
      event,
      body
    );

    // Refresh comments
    await loadComments(prInfo.owner, prInfo.repo, prInfo.number);
  };

  const handleBack = () => {
    setPrInfo(null);
    setComments(emptyComments);
    setSelectedBlockId(null);
    setLineMapping(null);
    setBlockToLine(null);
  };

  if (!prInfo) {
    return <PRInput onSubmit={handleLoadPR} isLoading={isLoading} error={error} />;
  }

  const currentFile = prInfo.files[selectedFileIndex];

  return (
    <div className="app">
      <header className="app-header">
        <button className="back-btn" onClick={handleBack}>
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
            onChange={(e) => {
              setSelectedFileIndex(Number(e.target.value));
              setSelectedBlockId(null);
            }}
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
        <div
          className="viewer-container"
          onClick={(e) => {
            const target = e.target as HTMLElement;
            const block = target.closest('[data-block-id]') as HTMLElement | null;
            if (block) {
              const blockId = block.dataset.blockId!;
              // Toggle: click same block to deselect
              if (blockId === selectedBlockId) {
                setSelectedBlockId(null);
              } else {
                handleBlockSelect(blockId);
              }
            } else {
              // Click outside any block to deselect
              setSelectedBlockId(null);
            }
          }}
        >
          <MarkdownViewer
            content={currentFile.content}
            filePath={currentFile.path}
            comments={mappedComments}
          />
        </div>
        <CommentSidebar
          filePath={currentFile.path}
          comments={mappedComments}
          selectedBlockId={selectedBlockId}
          onAddComment={handleAddComment}
          onDeleteComment={handleDeleteComment}
          onReplyToComment={handleReplyToComment}
          onPublishReview={handlePublishReview}
        />
      </main>
    </div>
  );
}

export default App;
