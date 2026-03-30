import { useState } from 'react';
import type { CommentThread } from '../../types';
import './styles.css';

interface GitHubCommentThreadProps {
  thread: CommentThread;
  isActive: boolean;
  onDelete?: (commentId: number) => Promise<void>;
  onReply: (commentId: number, body: string) => Promise<void>;
}

export function GitHubCommentThread({
  thread,
  isActive,
  onDelete,
  onReply,
}: GitHubCommentThreadProps) {
  const [replyText, setReplyText] = useState('');
  const [isReplying, setIsReplying] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const rootComment = thread.comments[0];
  const replies = thread.comments.slice(1);

  const handleReply = async () => {
    if (!replyText.trim()) return;

    setIsSubmitting(true);
    try {
      await onReply(rootComment.id, replyText.trim());
      setReplyText('');
      setIsReplying(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (onDelete) {
      await onDelete(rootComment.id);
    }
  };

  const formatDate = (date: Date) => {
    const d = new Date(date);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;

    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <div className={`comment-thread ${isActive ? 'active' : ''} ${thread.isPending ? 'pending' : ''}`}>
      {/* Root comment */}
      <div className="comment-header">
        <div className="comment-author-section">
          {rootComment.authorAvatar && (
            <img
              src={rootComment.authorAvatar}
              alt={rootComment.author}
              className="author-avatar"
            />
          )}
          <span className="comment-author">{rootComment.author}</span>
          {thread.isPending && <span className="draft-tag">Draft</span>}
        </div>
        <div className="comment-meta">
          <span className="comment-date">{formatDate(rootComment.createdAt)}</span>
          <span className="comment-line">Line {thread.line}</span>
        </div>
      </div>
      <div className="comment-body">{rootComment.body}</div>

      {/* Replies */}
      {replies.length > 0 && (
        <div className="replies">
          {replies.map((reply) => (
            <div key={reply.id} className="reply">
              <div className="reply-header">
                {reply.authorAvatar && (
                  <img
                    src={reply.authorAvatar}
                    alt={reply.author}
                    className="author-avatar small"
                  />
                )}
                <span className="reply-author">{reply.author}</span>
                <span className="reply-date">{formatDate(reply.createdAt)}</span>
              </div>
              <div className="reply-body">{reply.body}</div>
            </div>
          ))}
        </div>
      )}

      {/* Actions */}
      <div className="comment-actions">
        {isReplying ? (
          <div className="reply-form">
            <textarea
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              placeholder="Write a reply..."
              disabled={isSubmitting}
              autoFocus
            />
            <div className="reply-buttons">
              <button
                onClick={handleReply}
                disabled={!replyText.trim() || isSubmitting}
              >
                {isSubmitting ? 'Sending...' : 'Reply'}
              </button>
              <button
                className="cancel"
                onClick={() => setIsReplying(false)}
                disabled={isSubmitting}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <>
            <button className="action-btn" onClick={() => setIsReplying(true)}>
              Reply
            </button>
            {thread.isPending && onDelete && (
              <button className="action-btn delete" onClick={handleDelete}>
                Delete
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
