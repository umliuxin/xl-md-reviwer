import { useState, useEffect, useRef } from 'react';
import type { PRComments, ReviewEvent, CommentThread, UnifiedThread, UnifiedCommentItem } from '../../types';
import { PublishModal } from '../PublishModal';
import './styles.css';

interface CommentSidebarProps {
  filePath: string;
  comments: PRComments;
  selectedBlockId: string | null;
  onDeleteLocalComment: (commentId: string) => void;
  onReplyImmediate: (commentId: number, body: string) => Promise<void>;
  onReplyToReview: (thread: CommentThread, body: string) => void;
  onPublishReview: (event: ReviewEvent, body?: string) => Promise<void>;
  onSelectBlock: (blockId: string | null) => void;
}

// Get a unique key for a thread
function getThreadKey(thread: UnifiedThread): string {
  // Use GitHub thread ID if available, otherwise use blockId or line
  if (thread.githubThreadId) {
    return `github-${thread.githubThreadId}`;
  }
  return thread.blockId || `line-${thread.line}`;
}

// Create unified threads by merging GitHub and local comments
function createUnifiedThreads(
  githubThreads: CommentThread[],
  localComments: { id: string; path: string; line: number; blockId: string | null; body: string; createdAt: Date; groupKey?: string; replyToThreadId?: number }[]
): UnifiedThread[] {
  const threadMap = new Map<string, UnifiedThread>();

  // Add GitHub threads first - each thread gets a unique key based on its ID
  for (const thread of githubThreads) {
    // Use thread ID to ensure each GitHub thread is unique
    const key = `github-${thread.id}`;
    const items: UnifiedCommentItem[] = thread.comments.map((c) => ({
      type: 'github' as const,
      id: c.id,
      body: c.body,
      createdAt: c.createdAt,
      author: c.author,
      authorAvatar: c.authorAvatar,
      githubId: c.id,
    }));

    threadMap.set(key, {
      blockId: thread.blockId,
      path: thread.path,
      line: thread.line,
      items,
      githubThreadId: thread.id,
      hasGithub: true,
      hasLocal: false,
      isOutdated: thread.isOutdated,
      isResolved: thread.isResolved,
    });
  }

  // Add local comments
  for (const comment of localComments) {
    // For replies to existing threads, use the same key as the GitHub thread
    // For standalone comments, use their unique groupKey
    const key = comment.replyToThreadId
      ? `github-${comment.replyToThreadId}`
      : comment.groupKey || `local-${comment.id}`;
    const existing = threadMap.get(key);

    const item: UnifiedCommentItem = {
      type: 'local',
      id: comment.id,
      body: comment.body,
      createdAt: comment.createdAt,
      localId: comment.id,
    };

    if (existing) {
      existing.items.push(item);
      existing.hasLocal = true;
    } else {
      threadMap.set(key, {
        blockId: comment.blockId,
        path: comment.path,
        line: comment.line,
        items: [item],
        hasGithub: false,
        hasLocal: true,
        isOutdated: false, // Local comments are never outdated
        isResolved: false,
      });
    }
  }

  // Sort items within each thread by createdAt
  for (const thread of threadMap.values()) {
    thread.items.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }

  return Array.from(threadMap.values());
}

// Scroll to a block in the markdown viewer
function scrollToBlock(blockId: string | null) {
  if (!blockId) return;
  const element = document.querySelector(`[data-block-id="${blockId}"]`);
  if (element) {
    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
}

// Format relative date
function formatDate(date: Date) {
  const d = new Date(date);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// Unified thread card component
function UnifiedThreadCard({
  thread,
  isActive,
  onDeleteLocal,
  onReplyImmediate,
  onReplyToReview,
  onClick,
}: {
  thread: UnifiedThread;
  isActive: boolean;
  onDeleteLocal: (commentId: string) => void;
  onReplyImmediate: (commentId: number, body: string) => Promise<void>;
  onReplyToReview: (thread: UnifiedThread, body: string) => void;
  onClick: () => void;
}) {
  const [showReplyForm, setShowReplyForm] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleReplyImmediate = async () => {
    if (!replyText.trim() || !thread.githubThreadId) return;
    setIsSubmitting(true);
    try {
      const firstGithub = thread.items.find((i) => i.type === 'github');
      if (firstGithub && firstGithub.githubId) {
        await onReplyImmediate(firstGithub.githubId, replyText.trim());
      }
      setReplyText('');
      setShowReplyForm(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReplyToReview = () => {
    if (!replyText.trim()) return;
    onReplyToReview(thread, replyText.trim());
    setReplyText('');
    setShowReplyForm(false);
  };

  const isHidden = thread.isOutdated || thread.isResolved;
  const cardClass = `unified-thread-card ${isActive ? 'active' : ''} ${isHidden ? 'outdated' : ''} ${thread.hasGithub && thread.hasLocal ? 'mixed' : thread.hasLocal ? 'local-only' : 'github-only'}`;

  return (
    <div className={cardClass} onClick={isHidden ? undefined : onClick}>
      {/* Header */}
      <div className="thread-header">
        <div className="thread-badges">
          {thread.hasGithub && <span className="badge github">GitHub</span>}
          {thread.hasLocal && <span className="badge local">Draft</span>}
          {thread.isResolved && <span className="badge resolved">Resolved</span>}
          {thread.isOutdated && <span className="badge outdated">Outdated</span>}
        </div>
        <span className="thread-line">
          {thread.isOutdated ? `Was line ${thread.line}` : `Line ${thread.line}`}
        </span>
      </div>

      {/* Comments */}
      <div className="thread-items">
        {thread.items.map((item) => (
          <div key={`${item.type}-${item.id}`} className={`thread-item ${item.type}`}>
            {item.type === 'github' ? (
              <>
                <div className="item-header">
                  <img src={item.authorAvatar} alt="" className="author-avatar" />
                  <span className="author-name">{item.author}</span>
                  <span className="item-date">{formatDate(item.createdAt)}</span>
                </div>
                <div className="item-body">{item.body}</div>
              </>
            ) : (
              <>
                <div className="item-header">
                  <span className="draft-label">Draft</span>
                  <span className="item-date">{formatDate(item.createdAt)}</span>
                  <button
                    className="delete-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (item.localId) onDeleteLocal(item.localId);
                    }}
                  >
                    Delete
                  </button>
                </div>
                <div className="item-body">{item.body}</div>
              </>
            )}
          </div>
        ))}
      </div>

      {/* Reply form - only for active GitHub threads */}
      {thread.hasGithub && !isHidden && (
        <div className="thread-actions" onClick={(e) => e.stopPropagation()}>
          {!showReplyForm ? (
            <button className="reply-toggle" onClick={() => setShowReplyForm(true)}>
              Reply
            </button>
          ) : (
            <div className="reply-form">
              <textarea
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                placeholder="Write a reply..."
                disabled={isSubmitting}
                rows={2}
              />
              <div className="reply-buttons">
                <button
                  className="add-to-review"
                  onClick={handleReplyToReview}
                  disabled={!replyText.trim() || isSubmitting}
                >
                  Add to review
                </button>
                <button
                  className="reply-now"
                  onClick={handleReplyImmediate}
                  disabled={!replyText.trim() || isSubmitting}
                >
                  Post now
                </button>
                <button
                  className="cancel"
                  onClick={() => {
                    setShowReplyForm(false);
                    setReplyText('');
                  }}
                  disabled={isSubmitting}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function CommentSidebar({
  filePath,
  comments,
  selectedBlockId,
  onDeleteLocalComment,
  onReplyImmediate,
  onReplyToReview,
  onPublishReview,
  onSelectBlock,
}: CommentSidebarProps) {
  const [showPublishModal, setShowPublishModal] = useState(false);
  const [showHidden, setShowHidden] = useState(false);

  // Filter comments for current file
  const fileSubmitted = comments.submitted.filter((t) => t.path === filePath);
  const fileLocalPending = comments.localPending.filter((c) => c.path === filePath);

  // Create unified threads
  const unifiedThreads = createUnifiedThreads(fileSubmitted, fileLocalPending);

  // Split into active and hidden (outdated or resolved)
  const activeThreads = unifiedThreads.filter((t) => !t.isOutdated && !t.isResolved);
  const hiddenThreads = unifiedThreads.filter((t) => t.isOutdated || t.isResolved);

  const handlePublish = async (event: ReviewEvent, body?: string) => {
    await onPublishReview(event, body);
    setShowPublishModal(false);
  };

  const handleReplyToReview = (thread: UnifiedThread, body: string) => {
    const githubThread = fileSubmitted.find((t) => t.blockId === thread.blockId);
    if (githubThread) {
      onReplyToReview(githubThread, body);
    }
  };

  const totalLocalPending = comments.localPending.length;
  const sidebarRef = useRef<HTMLElement>(null);

  // Auto-scroll to selected comment in sidebar
  useEffect(() => {
    if (!selectedBlockId || !sidebarRef.current) return;

    const activeElement = sidebarRef.current.querySelector('.unified-thread-card.active');
    if (activeElement) {
      activeElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [selectedBlockId]);

  return (
    <aside className="comment-sidebar" ref={sidebarRef}>
      <div className="sidebar-header">
        <h2>Comments</h2>
        {totalLocalPending > 0 && (
          <button className="publish-btn" onClick={() => setShowPublishModal(true)}>
            Publish ({totalLocalPending})
          </button>
        )}
      </div>

      {/* Active threads */}
      <div className="comments-section">
        {activeThreads.length > 0 ? (
          <div className="comments-list">
            {activeThreads.map((thread) => (
              <UnifiedThreadCard
                key={getThreadKey(thread)}
                thread={thread}
                isActive={thread.blockId === selectedBlockId}
                onDeleteLocal={onDeleteLocalComment}
                onReplyImmediate={onReplyImmediate}
                onReplyToReview={handleReplyToReview}
                onClick={() => {
                  onSelectBlock(thread.blockId);
                  scrollToBlock(thread.blockId);
                }}
              />
            ))}
          </div>
        ) : (
          <p className="section-empty">Click on text to add a comment</p>
        )}
      </div>

      {/* Hidden threads (outdated/resolved) - collapsible */}
      {hiddenThreads.length > 0 && (
        <div className="outdated-section">
          <button
            className="outdated-toggle"
            onClick={() => setShowHidden(!showHidden)}
          >
            <span className="toggle-icon">{showHidden ? '▼' : '▶'}</span>
            Resolved / Outdated ({hiddenThreads.length})
          </button>

          {showHidden && (
            <div className="comments-list outdated-list">
              {hiddenThreads.map((thread) => (
                <UnifiedThreadCard
                  key={getThreadKey(thread)}
                  thread={thread}
                  isActive={thread.blockId === selectedBlockId}
                  onDeleteLocal={onDeleteLocalComment}
                  onReplyImmediate={onReplyImmediate}
                  onReplyToReview={handleReplyToReview}
                  onClick={() => {
                    onSelectBlock(thread.blockId);
                    scrollToBlock(thread.blockId);
                  }}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {showPublishModal && (
        <PublishModal
          pendingCount={totalLocalPending}
          onPublish={handlePublish}
          onCancel={() => setShowPublishModal(false)}
        />
      )}
    </aside>
  );
}
