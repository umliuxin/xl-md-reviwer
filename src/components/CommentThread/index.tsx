import { useState } from 'react';
import type { Comment } from '../../types';
import { useCommentsStore } from '../../store/comments';
import './styles.css';

interface CommentThreadProps {
  comment: Comment;
}

export function CommentThread({ comment }: CommentThreadProps) {
  const [replyText, setReplyText] = useState('');
  const [isReplying, setIsReplying] = useState(false);
  const { addReply, resolveComment, deleteComment, activeCommentId, setActiveComment } =
    useCommentsStore();

  const handleReply = () => {
    if (replyText.trim()) {
      addReply(comment.id, replyText.trim());
      setReplyText('');
      setIsReplying(false);
    }
  };

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const isActive = activeCommentId === comment.id;

  return (
    <div
      className={`comment-thread ${isActive ? 'active' : ''} ${comment.resolved ? 'resolved' : ''}`}
      onClick={() => setActiveComment(comment.id)}
    >
      <div className="comment-header">
        <div className="comment-author">{comment.author}</div>
        <div className="comment-date">{formatDate(comment.createdAt)}</div>
      </div>
      <div className="comment-text">{comment.text}</div>

      {comment.replies.length > 0 && (
        <div className="replies">
          {comment.replies.map((reply) => (
            <div key={reply.id} className="reply">
              <div className="reply-header">
                <span className="reply-author">{reply.author}</span>
                <span className="reply-date">{formatDate(reply.createdAt)}</span>
              </div>
              <div className="reply-text">{reply.text}</div>
            </div>
          ))}
        </div>
      )}

      {!comment.resolved && (
        <div className="comment-actions">
          {isReplying ? (
            <div className="reply-form">
              <textarea
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                placeholder="Write a reply..."
                autoFocus
              />
              <div className="reply-buttons">
                <button onClick={handleReply} disabled={!replyText.trim()}>
                  Reply
                </button>
                <button className="cancel" onClick={() => setIsReplying(false)}>
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <>
              <button className="action-btn" onClick={() => setIsReplying(true)}>
                Reply
              </button>
              <button className="action-btn resolve" onClick={() => resolveComment(comment.id)}>
                Resolve
              </button>
              <button className="action-btn delete" onClick={() => deleteComment(comment.id)}>
                Delete
              </button>
            </>
          )}
        </div>
      )}

      {comment.resolved && <div className="resolved-badge">✓ Resolved</div>}
    </div>
  );
}
