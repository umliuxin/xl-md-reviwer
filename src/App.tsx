import { useState, useEffect, useCallback } from 'react';
import { PRInput, updateRecentPRTitle } from './components/PRInput';
import { MarkdownViewer } from './components/MarkdownViewer';
import { CommentSidebar } from './components/CommentSidebar';
import { InlineCommentForm } from './components/InlineCommentForm';
import {
  fetchPRInfo,
  fetchCommentThreads,
  publishReview,
  replyToComment,
  parsePRUrl,
} from './services/github';
import { buildLineMapping } from './services/lineMapping';
import type { PRInfo, PRComments, ReviewEvent, LocalPendingComment } from './types';
import './App.css';

const emptyComments: PRComments = {
  submitted: [],
  localPending: [],
};

// LocalStorage key for pending comments
const getLocalStorageKey = (owner: string, repo: string, prNumber: number) =>
  `pr-comments-${owner}-${repo}-${prNumber}`;


// Load local comments from localStorage
function loadLocalComments(owner: string, repo: string, prNumber: number): LocalPendingComment[] {
  try {
    const key = getLocalStorageKey(owner, repo, prNumber);
    const stored = localStorage.getItem(key);
    if (!stored) return [];
    const parsed = JSON.parse(stored);
    // Restore Date objects
    return parsed.map((c: LocalPendingComment) => ({
      ...c,
      createdAt: new Date(c.createdAt),
    }));
  } catch {
    return [];
  }
}

// Save local comments to localStorage
function saveLocalComments(owner: string, repo: string, prNumber: number, comments: LocalPendingComment[]) {
  const key = getLocalStorageKey(owner, repo, prNumber);
  localStorage.setItem(key, JSON.stringify(comments));
}

// Parse PR info from URL (checks ?pr= query param first, then hash)
function parsePRFromUrl(): { owner: string; repo: string; number: number } | null {
  // Check for ?pr= query parameter first
  const params = new URLSearchParams(window.location.search);
  const prParam = params.get('pr');
  if (prParam) {
    const parsed = parsePRUrl(prParam);
    if (parsed) return parsed;
  }

  // Fall back to hash format (#owner/repo/123)
  const hash = window.location.hash.slice(1);
  if (!hash) return null;
  const match = hash.match(/^([^/]+)\/([^/]+)\/(\d+)$/);
  if (!match) return null;
  return { owner: match[1], repo: match[2], number: parseInt(match[3], 10) };
}

// Update URL hash with PR info
function updateHash(owner: string, repo: string, prNumber: number) {
  window.location.hash = `${owner}/${repo}/${prNumber}`;
}

// Clear URL (hash and query params)
function clearUrl() {
  history.pushState('', document.title, window.location.pathname);
}

function App() {
  const [prInfo, setPrInfo] = useState<PRInfo | null>(null);
  const [comments, setComments] = useState<PRComments>(emptyComments);
  // Start loading if URL has a PR hash
  const [isLoading, setIsLoading] = useState(() => parsePRFromUrl() !== null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedFileIndex, setSelectedFileIndex] = useState(0);
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [showInlineForm, setShowInlineForm] = useState(false);
  const [lineMapping, setLineMapping] = useState<Map<number, string> | null>(null);
  const [blockToLine, setBlockToLine] = useState<Map<string, number> | null>(null);

  // Auto-load PR from URL hash on mount
  useEffect(() => {
    const prFromHash = parsePRFromUrl();
    if (prFromHash) {
      handleLoadPR(prFromHash.owner, prFromHash.repo, prFromHash.number);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Build line mapping when file changes
  useEffect(() => {
    if (prInfo && prInfo.files[selectedFileIndex]) {
      const file = prInfo.files[selectedFileIndex];
      const mapping = buildLineMapping(file.path, file.content);
      setLineMapping(mapping.lineToBlockId);
      setBlockToLine(mapping.blockIdToLine);
    }
  }, [prInfo, selectedFileIndex]);

  // Persist local comments to localStorage
  useEffect(() => {
    if (prInfo && comments.localPending.length >= 0) {
      saveLocalComments(prInfo.owner, prInfo.repo, prInfo.number, comments.localPending);
    }
  }, [prInfo, comments.localPending]);


  // Apply line mapping to submitted comments (only for current file)
  const currentFilePath = prInfo?.files[selectedFileIndex]?.path;
  const mappedComments: PRComments = {
    ...comments,
    submitted: comments.submitted.map((thread) => ({
      ...thread,
      // Only map comments for the current file, others get null blockId
      blockId: thread.path === currentFilePath ? (lineMapping?.get(thread.line) || null) : null,
    })),
  };

  const loadSubmittedComments = useCallback(async (owner: string, repo: string, prNumber: number) => {
    try {
      const threads = await fetchCommentThreads(owner, repo, prNumber);
      setComments((prev) => ({
        ...prev,
        submitted: threads,
      }));
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

      // Update URL hash and save title to recent PRs
      updateHash(owner, repo, prNumber);
      updateRecentPRTitle(owner, repo, prNumber, info.title);

      // Load local comments from localStorage
      const localComments = loadLocalComments(owner, repo, prNumber);
      setComments((prev) => ({
        ...prev,
        localPending: localComments,
      }));

      // Load submitted comments from GitHub
      await loadSubmittedComments(owner, repo, prNumber);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load PR');
    } finally {
      setIsLoading(false);
    }
  };

  // Add a local pending comment (stored in state, not GitHub)
  const handleAddComment = async (blockId: string, body: string) => {
    if (!prInfo) return;

    // Try to get line from mapping, fallback to parsing blockId
    let line = blockToLine?.get(blockId);
    if (!line) {
      // BlockId format: "{filePath}-line-{lineNumber}"
      const match = blockId.match(/-line-(\d+)$/);
      if (match) {
        line = parseInt(match[1], 10);
      } else {
        console.error('Could not find line number for block:', blockId);
        return;
      }
    }

    const currentFile = prInfo.files[selectedFileIndex];

    const commentId = crypto.randomUUID();
    const newComment: LocalPendingComment = {
      id: commentId,
      path: currentFile.path,
      line,
      blockId,
      body,
      createdAt: new Date(),
      // Standalone comment - use unique key so it doesn't group with others
      groupKey: `standalone-${commentId}`,
    };

    setComments((prev) => ({
      ...prev,
      localPending: [...prev.localPending, newComment],
    }));
  };

  // Delete a local pending comment
  const handleDeleteLocalComment = (commentId: string) => {
    setComments((prev) => ({
      ...prev,
      localPending: prev.localPending.filter((c) => c.id !== commentId),
    }));
  };

  // Reply immediately (posts to GitHub right away)
  const handleReplyImmediate = async (commentId: number, body: string) => {
    if (!prInfo) return;

    await replyToComment(prInfo.owner, prInfo.repo, prInfo.number, commentId, body);

    // Refresh submitted comments
    await loadSubmittedComments(prInfo.owner, prInfo.repo, prInfo.number);
  };

  // Add reply to local review (will be published with batch)
  const handleReplyToReview = (thread: { path: string; line: number; blockId: string | null; id: number }, body: string) => {
    const newComment: LocalPendingComment = {
      id: crypto.randomUUID(),
      path: thread.path,
      line: thread.line,
      blockId: thread.blockId,
      body,
      createdAt: new Date(),
      replyToThreadId: thread.id,
      // Reply - use thread's blockId as groupKey so it groups with the thread
      groupKey: thread.blockId || `line-${thread.line}`,
    };

    setComments((prev) => ({
      ...prev,
      localPending: [...prev.localPending, newComment],
    }));
  };

  // Publish all local pending comments to GitHub
  const handlePublishReview = async (event: ReviewEvent, body?: string) => {
    if (!prInfo || comments.localPending.length === 0) return;

    await publishReview(
      prInfo.owner,
      prInfo.repo,
      prInfo.number,
      prInfo.headSha,
      comments.localPending,
      event,
      body
    );

    // Clear local pending comments
    setComments((prev) => ({
      ...prev,
      localPending: [],
    }));

    // Refresh submitted comments from GitHub
    await loadSubmittedComments(prInfo.owner, prInfo.repo, prInfo.number);
  };

  const handleBack = () => {
    setPrInfo(null);
    setComments(emptyComments);
    setSelectedBlockId(null);
    setShowInlineForm(false);
    setLineMapping(null);
    setBlockToLine(null);
    clearUrl();
  };

  // Sync with GitHub
  const handleSync = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (!prInfo || isRefreshing) return;
    setIsRefreshing(true);
    try {
      const info = await fetchPRInfo(prInfo.owner, prInfo.repo, prInfo.number);
      setPrInfo(info);
      await loadSubmittedComments(prInfo.owner, prInfo.repo, prInfo.number);
    } catch (e) {
      console.error('Failed to sync:', e);
    } finally {
      setIsRefreshing(false);
    }
  };

  if (!prInfo) {
    // Show loading screen with a rotating tip
    if (isLoading) {
      const tips = [
        <>Share a direct link using <code>?pr=https://github.com/.../pull/123</code></>,
        'Click any paragraph or heading to add a comment',
        'Your draft comments are saved locally until you publish',
        'Use "Add to review" to batch multiple comments before publishing',
        'Click "Sync with GitHub" to fetch the latest comments from others',
        'This tool only shows markdown files — review code changes in GitHub',
      ];
      const tipIndex = Math.floor(Date.now() / 1000) % tips.length;

      return (
        <div className="loading-screen">
          <p className="loading-text">Loading PR...</p>
          <div className="did-you-know">
            <strong>Did you know?</strong>
            <p>{tips[tipIndex]}</p>
          </div>
        </div>
      );
    }
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
          <a
            className="pr-title"
            href={`https://github.com/${prInfo.owner}/${prInfo.repo}/pull/${prInfo.number}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            {prInfo.title}
          </a>
          <span className="pr-meta">
            {prInfo.owner}/{prInfo.repo} #{prInfo.number}
          </span>
        </div>
        <div className="header-actions">
          <button
            type="button"
            className="sync-btn"
            onClick={handleSync}
            disabled={isRefreshing}
          >
            {isRefreshing ? 'Syncing...' : 'Sync with GitHub'}
          </button>
        </div>
      </header>

      <div className="md-only-banner">
        Viewing {prInfo.files.length} markdown {prInfo.files.length === 1 ? 'file' : 'files'}.{' '}
        <a
          href={`https://github.com/${prInfo.owner}/${prInfo.repo}/pull/${prInfo.number}/files`}
          target="_blank"
          rel="noopener noreferrer"
        >
          Review code changes in GitHub →
        </a>
      </div>

      {prInfo.files.length > 1 && (
        <div className="file-list">
          {prInfo.files.map((file, index) => (
            <button
              key={file.path}
              className={`file-item ${index === selectedFileIndex ? 'active' : ''}`}
              onClick={() => {
                setSelectedFileIndex(index);
                setSelectedBlockId(null);
                setShowInlineForm(false);
              }}
            >
              {file.path}
            </button>
          ))}
        </div>
      )}

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
                setShowInlineForm(false);
              } else {
                setSelectedBlockId(blockId);
                // Check if this block has any comments
                const hasLocalComments = mappedComments.localPending.some((c) => c.blockId === blockId);
                const hasGithubComments = mappedComments.submitted.some((t) => t.blockId === blockId);
                // Only show inline form if no existing comments
                setShowInlineForm(!hasLocalComments && !hasGithubComments);
              }
            } else {
              // Click outside any block to deselect
              setSelectedBlockId(null);
              setShowInlineForm(false);
            }
          }}
        >
          <MarkdownViewer
            content={currentFile.content}
            filePath={currentFile.path}
            comments={mappedComments}
            selectedBlockId={selectedBlockId}
            onOpenCommentForm={() => setShowInlineForm(true)}
          />
          {showInlineForm && selectedBlockId && (
            <InlineCommentForm
              key={selectedBlockId}
              blockId={selectedBlockId}
              onSubmit={handleAddComment}
              onCancel={() => {
                setShowInlineForm(false);
              }}
            />
          )}
        </div>
        <CommentSidebar
          filePath={currentFile.path}
          comments={mappedComments}
          selectedBlockId={selectedBlockId}
          onDeleteLocalComment={handleDeleteLocalComment}
          onReplyImmediate={handleReplyImmediate}
          onReplyToReview={handleReplyToReview}
          onPublishReview={handlePublishReview}
          onSelectBlock={setSelectedBlockId}
        />
      </main>
    </div>
  );
}

export default App;
