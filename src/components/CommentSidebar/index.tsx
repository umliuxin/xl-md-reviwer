import { useState } from 'react';
import type { PRComments, ReviewEvent, CommentThread } from '../../types';
import { GitHubCommentThread } from '../CommentThread';
import { PublishModal } from '../PublishModal';
import './styles.css';

interface CommentSidebarProps {
  filePath: string;
  comments: PRComments;
  selectedBlockId: string | null;
  onAddComment: (blockId: string, body: string) => Promise<void>;
  onDeleteComment: (commentId: number) => Promise<void>;
  onReplyToComment: (commentId: number, body: string) => Promise<void>;
  onPublishReview: (event: ReviewEvent, body?: string) => Promise<void>;
}

export function CommentSidebar({
  filePath,
  comments,
  selectedBlockId,
  onAddComment,
  onDeleteComment,
  onReplyToComment,
  onPublishReview,
}: CommentSidebarProps) {
  const [newCommentText, setNewCommentText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPublishModal, setShowPublishModal] = useState(false);

  // Filter comments for current file
  const fileSubmitted = comments.submitted.filter((t) => t.path === filePath);
  const filePending = comments.pending.filter((t) => t.path === filePath);

  // Split into selected and others
  const splitBySelection = (threads: CommentThread[]) => {
    if (!selectedBlockId) {
      return { selected: [], others: threads };
    }
    const selected = threads.filter((t) => t.blockId === selectedBlockId);
    const others = threads.filter((t) => t.blockId !== selectedBlockId);
    return { selected, others };
  };

  const pendingSplit = splitBySelection(filePending);
  const submittedSplit = splitBySelection(fileSubmitted);

  // Combine all selected and all others
  const allSelected = [...pendingSplit.selected, ...submittedSplit.selected];
  const allOthers = [...pendingSplit.others, ...submittedSplit.others];

  const handleAddComment = async () => {
    if (!selectedBlockId || !newCommentText.trim()) return;

    setIsSubmitting(true);
    try {
      await onAddComment(selectedBlockId, newCommentText.trim());
      setNewCommentText('');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePublish = async (event: ReviewEvent, body?: string) => {
    await onPublishReview(event, body);
    setShowPublishModal(false);
  };

  const totalPending = comments.pending.length;
  const hasAnyComments = fileSubmitted.length > 0 || filePending.length > 0;

  const renderThread = (thread: CommentThread) => {
    const isPending = filePending.some((t) => t.id === thread.id);
    return (
      <GitHubCommentThread
        key={thread.id}
        thread={thread}
        isActive={thread.blockId === selectedBlockId}
        onDelete={isPending ? onDeleteComment : undefined}
        onReply={onReplyToComment}
      />
    );
  };

  return (
    <aside className="comment-sidebar">
      <div className="sidebar-header">
        <h2>Comments</h2>
        {totalPending > 0 && (
          <button
            className="publish-btn"
            onClick={() => setShowPublishModal(true)}
          >
            Publish ({totalPending})
          </button>
        )}
      </div>

      {/* Add comment form when block is selected */}
      {selectedBlockId && (
        <div className="new-comment-section">
          <div className="new-comment-hint">
            Adding comment to selected block
          </div>
          <textarea
            value={newCommentText}
            onChange={(e) => setNewCommentText(e.target.value)}
            placeholder="Write a comment..."
            disabled={isSubmitting}
          />
          <button
            onClick={handleAddComment}
            disabled={!newCommentText.trim() || isSubmitting}
          >
            {isSubmitting ? 'Adding...' : 'Add Comment'}
          </button>
        </div>
      )}

      {!selectedBlockId && (
        <p className="sidebar-hint">
          Click on a paragraph or heading to add a comment
        </p>
      )}

      {/* Selected block's comments */}
      {selectedBlockId && allSelected.length > 0 && (
        <div className="comments-section">
          <h3 className="section-title selected-title">
            Selected ({allSelected.length})
          </h3>
          <div className="comments-list">
            {allSelected.map(renderThread)}
          </div>
        </div>
      )}

      {/* Divider between selected and others */}
      {selectedBlockId && allSelected.length > 0 && allOthers.length > 0 && (
        <div className="comments-divider" />
      )}

      {/* Other comments */}
      {allOthers.length > 0 && (
        <div className="comments-section">
          <h3 className="section-title">
            {selectedBlockId ? `Others (${allOthers.length})` : `All (${allOthers.length})`}
          </h3>
          <div className="comments-list">
            {allOthers.map(renderThread)}
          </div>
        </div>
      )}

      {!hasAnyComments && (
        <p className="no-comments">No comments on this file yet</p>
      )}

      {showPublishModal && (
        <PublishModal
          pendingCount={totalPending}
          onPublish={handlePublish}
          onCancel={() => setShowPublishModal(false)}
        />
      )}
    </aside>
  );
}
