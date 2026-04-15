import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { ExtraProps } from 'react-markdown';
import type { PRComments } from '../../types';
import './styles.css';

interface MarkdownViewerProps {
  content: string;
  filePath: string;
  comments: PRComments;
  selectedBlockId: string | null;
  onOpenCommentForm: () => void;
  /** Lines changed in this PR. Empty set = all lines changed (new file). */
  changedLines: Set<number>;
  /** Whether this file is newly added in the PR */
  isNewFile: boolean;
  /** Block IDs that have unsaved draft text */
  draftBlockIds: Set<string>;
}

export function MarkdownViewer({ content, filePath, comments, selectedBlockId, onOpenCommentForm, changedLines, isNewFile, draftBlockIds }: MarkdownViewerProps) {
  // Use line number as block identifier
  const getBlockId = (line: number) => `${filePath}-line-${line}`;

  // Check if a block (by its start/end line range) overlaps with changed lines
  // For new files (empty changedLines set), all blocks are considered changed
  const isBlockChanged = (startLine: number, endLine: number): boolean => {
    if (isNewFile) return true;
    for (let line = startLine; line <= endLine; line++) {
      if (changedLines.has(line)) return true;
    }
    return false;
  };

  // Count comments for a block (exclude outdated and resolved)
  const getCommentCounts = (blockId: string) => {
    const github = comments.submitted.filter((t) => t.blockId === blockId && !t.isOutdated && !t.isResolved).length;
    const local = comments.localPending.filter((c) => c.blockId === blockId).length;
    return { github, local, total: github + local };
  };

  const createBlockComponent = (
    Tag: React.ElementType,
    props: ExtraProps & { children?: React.ReactNode },
    extraClass = ''
  ) => {
    const { children, node } = props;
    const startLine = node?.position?.start?.line;
    const endLine = node?.position?.end?.line;

    if (!startLine) {
      // No position info, render without block ID
      return <Tag className={extraClass}>{children}</Tag>;
    }

    const blockId = getBlockId(startLine);
    const changed = isBlockChanged(startLine, endLine || startLine);

    // Unchanged blocks: muted, not commentable
    if (!changed) {
      return (
        <Tag className={`unchanged-block ${extraClass}`}>
          {children}
        </Tag>
      );
    }

    // Changed blocks: full styling, commentable
    const counts = getCommentCounts(blockId);
    const hasLocal = counts.local > 0;
    const hasGithub = counts.github > 0;
    const hasDraft = draftBlockIds.has(blockId);
    const isSelected = blockId === selectedBlockId;

    return (
      <Tag
        className={`commentable-block ${!isNewFile ? 'changed-block' : ''} ${extraClass} ${isSelected ? 'selected' : ''} ${hasLocal ? 'has-local' : ''} ${hasGithub && !hasLocal ? 'has-github' : ''} ${hasDraft ? 'has-draft' : ''}`}
        data-block-id={blockId}
      >
        {children}
        <span className="block-actions">
          {hasDraft && counts.total === 0 && (
            <span className="draft-indicator" title="Unsaved draft">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M11.2 1.4L12.6 2.8L3.5 11.9L1.4 12.6L2.1 10.5L11.2 1.4Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/>
              </svg>
            </span>
          )}
          {counts.total > 0 && (
            <span className={`comment-indicator ${hasLocal ? 'local' : 'github'}`}>
              {counts.total}
            </span>
          )}
          {isSelected && (
            <button
              className="add-comment-btn"
              onClick={(e) => {
                e.stopPropagation();
                onOpenCommentForm();
              }}
              title="Add comment"
            >
              +
            </button>
          )}
        </span>
      </Tag>
    );
  };

  return (
    <div className="markdown-viewer">
      <div className="file-header">
        <span className="file-icon">📄</span>
        <span className="file-path">{filePath}</span>
      </div>
      <div className="markdown-content">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            p: (props) => createBlockComponent('p', props),
            h1: (props) => createBlockComponent('h1', props),
            h2: (props) => createBlockComponent('h2', props),
            h3: (props) => createBlockComponent('h3', props),
            h4: (props) => createBlockComponent('h4', props),
            h5: (props) => createBlockComponent('h5', props),
            h6: (props) => createBlockComponent('h6', props),
            li: (props) => createBlockComponent('li', props),
            blockquote: (props) => createBlockComponent('blockquote', props),
            pre: (props) => createBlockComponent('pre', props, 'code-block'),
            table: (props) => createBlockComponent('table', props, 'table-block'),
          }}
        >
          {content}
        </ReactMarkdown>
      </div>
    </div>
  );
}
