import { useState } from 'react';
import { useCommentsStore } from '../../store/comments';
import { CommentThread } from '../CommentThread';
import './styles.css';

interface CommentSidebarProps {
  selectedBlockId: string | null;
}

export function CommentSidebar({ selectedBlockId }: CommentSidebarProps) {
  const [newCommentText, setNewCommentText] = useState('');
  const [showResolved, setShowResolved] = useState(false);
  const { comments, addComment } = useCommentsStore();

  const handleAddComment = () => {
    if (selectedBlockId && newCommentText.trim()) {
      addComment(selectedBlockId, newCommentText.trim());
      setNewCommentText('');
    }
  };

  const filteredComments = showResolved
    ? comments
    : comments.filter((c) => !c.resolved);

  const sortedComments = [...filteredComments].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  return (
    <aside className="comment-sidebar">
      <div className="sidebar-header">
        <h2>Comments</h2>
        <label className="show-resolved">
          <input
            type="checkbox"
            checked={showResolved}
            onChange={(e) => setShowResolved(e.target.checked)}
          />
          Show resolved
        </label>
      </div>

      {selectedBlockId && (
        <div className="new-comment-form">
          <textarea
            value={newCommentText}
            onChange={(e) => setNewCommentText(e.target.value)}
            placeholder="Add a comment on selected block..."
          />
          <button onClick={handleAddComment} disabled={!newCommentText.trim()}>
            Add Comment
          </button>
        </div>
      )}

      {!selectedBlockId && (
        <p className="sidebar-hint">Click on a paragraph or heading to add a comment</p>
      )}

      <div className="comments-list">
        {sortedComments.length === 0 ? (
          <p className="no-comments">No comments yet</p>
        ) : (
          sortedComments.map((comment) => (
            <CommentThread key={comment.id} comment={comment} />
          ))
        )}
      </div>
    </aside>
  );
}
