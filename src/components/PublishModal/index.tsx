import { useState } from 'react';
import type { ReviewEvent } from '../../types';
import './styles.css';

interface PublishModalProps {
  pendingCount: number;
  onPublish: (event: ReviewEvent, body?: string) => Promise<void>;
  onCancel: () => void;
}

export function PublishModal({ pendingCount, onPublish, onCancel }: PublishModalProps) {
  const [reviewType, setReviewType] = useState<ReviewEvent>('COMMENT');
  const [reviewBody, setReviewBody] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      await onPublish(reviewType, reviewBody.trim() || undefined);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <h2>Publish Review</h2>

        <p className="modal-description">
          {pendingCount} pending comment{pendingCount !== 1 ? 's' : ''} will be published.
        </p>

        <div className="review-type-section">
          <label className="review-type-label">Review type:</label>
          <div className="review-type-options">
            <label className="review-type-option">
              <input
                type="radio"
                name="reviewType"
                value="COMMENT"
                checked={reviewType === 'COMMENT'}
                onChange={() => setReviewType('COMMENT')}
              />
              <span className="option-text">
                <strong>Comment</strong>
                <small>Submit general feedback without approval</small>
              </span>
            </label>

            <label className="review-type-option">
              <input
                type="radio"
                name="reviewType"
                value="APPROVE"
                checked={reviewType === 'APPROVE'}
                onChange={() => setReviewType('APPROVE')}
              />
              <span className="option-text">
                <strong>Approve</strong>
                <small>Submit feedback and approve the PR</small>
              </span>
            </label>

            <label className="review-type-option">
              <input
                type="radio"
                name="reviewType"
                value="REQUEST_CHANGES"
                checked={reviewType === 'REQUEST_CHANGES'}
                onChange={() => setReviewType('REQUEST_CHANGES')}
              />
              <span className="option-text">
                <strong>Request Changes</strong>
                <small>Submit feedback that must be addressed</small>
              </span>
            </label>
          </div>
        </div>

        <div className="review-body-section">
          <label htmlFor="review-body">Review summary (optional):</label>
          <textarea
            id="review-body"
            value={reviewBody}
            onChange={(e) => setReviewBody(e.target.value)}
            placeholder="Leave a summary comment for the review..."
            disabled={isSubmitting}
          />
        </div>

        <div className="modal-actions">
          <button
            className="cancel-btn"
            onClick={onCancel}
            disabled={isSubmitting}
          >
            Cancel
          </button>
          <button
            className="publish-btn"
            onClick={handleSubmit}
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Publishing...' : 'Publish Review'}
          </button>
        </div>
      </div>
    </div>
  );
}
