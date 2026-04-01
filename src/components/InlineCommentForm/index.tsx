import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import './styles.css';

interface InlineCommentFormProps {
  blockId: string;
  onSubmit: (blockId: string, body: string) => Promise<void>;
  onCancel: () => void;
}

// Calculate position based on target element
function calculatePosition(blockId: string): { top: number; left: number } | null {
  // Query the DOM for the current element (handles re-renders)
  const targetElement = document.querySelector(`[data-block-id="${blockId}"]`);
  if (!targetElement) return null;

  const rect = targetElement.getBoundingClientRect();
  const formWidth = 300;
  const formHeight = 200;
  const viewportHeight = window.innerHeight;
  const viewportWidth = window.innerWidth;

  let top = rect.top;
  let left = rect.right + 16;

  // Keep form within viewport vertically
  if (top + formHeight > viewportHeight - 20) {
    top = Math.max(20, viewportHeight - formHeight - 20);
  }

  // If form would go off right edge, position to the left
  if (left + formWidth > viewportWidth - 20) {
    left = Math.max(20, rect.left - formWidth - 16);
  }

  return { top, left };
}

export function InlineCommentForm({
  blockId,
  onSubmit,
  onCancel,
}: InlineCommentFormProps) {
  const [text, setText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const formRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Calculate initial position synchronously
  const [position, setPosition] = useState(() => calculatePosition(blockId) || { top: -9999, left: -9999 });

  const updatePosition = useCallback(() => {
    const newPos = calculatePosition(blockId);
    if (newPos) {
      setPosition(newPos);
    }
  }, [blockId]);

  // Update position on scroll/resize
  useEffect(() => {
    // Initial position update
    updatePosition();

    window.addEventListener('scroll', updatePosition, true);
    window.addEventListener('resize', updatePosition);

    return () => {
      window.removeEventListener('scroll', updatePosition, true);
      window.removeEventListener('resize', updatePosition);
    };
  }, [updatePosition]);

  // Auto-focus textarea
  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  // Handle click outside to cancel
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (formRef.current && !formRef.current.contains(e.target as Node)) {
        // Don't close if clicking on a commentable block - let viewer-container handle that
        const clickedBlock = (e.target as HTMLElement).closest('[data-block-id]');
        if (clickedBlock) return;

        if (!text.trim()) {
          onCancel();
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onCancel, text]);

  // Handle Escape key and Ctrl+Enter
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCancel();
      } else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        handleSubmit();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onCancel, text, isSubmitting]);

  const handleSubmit = async () => {
    if (!text.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      await onSubmit(blockId, text.trim());
      setText('');
      onCancel();
    } finally {
      setIsSubmitting(false);
    }
  };

  const form = (
    <div
      ref={formRef}
      className="inline-comment-form"
      style={{
        position: 'fixed',
        top: `${position.top}px`,
        left: `${position.left}px`,
      }}
    >
      <textarea
        ref={textareaRef}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Add a comment..."
        disabled={isSubmitting}
        rows={3}
      />
      <div className="inline-comment-actions">
        <button
          className="cancel-btn"
          onClick={onCancel}
          disabled={isSubmitting}
        >
          Cancel
        </button>
        <button
          className="submit-btn"
          onClick={handleSubmit}
          disabled={!text.trim() || isSubmitting}
        >
          {isSubmitting ? 'Adding...' : 'Comment'}
        </button>
      </div>
      <div className="inline-comment-hint">
        Ctrl+Enter to submit
      </div>
    </div>
  );

  // Use portal to render outside the scrolling container
  return createPortal(form, document.body);
}
