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
}

export function MarkdownViewer({ content, filePath, comments, selectedBlockId, onOpenCommentForm }: MarkdownViewerProps) {
  // Use line number as block identifier
  const getBlockId = (line: number) => `${filePath}-line-${line}`;

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

    if (!startLine) {
      // No position info, render without block ID
      return <Tag className={extraClass}>{children}</Tag>;
    }

    const blockId = getBlockId(startLine);
    const counts = getCommentCounts(blockId);

    // Determine styling: local takes precedence (orange), then github (blue)
    const hasLocal = counts.local > 0;
    const hasGithub = counts.github > 0;
    const isSelected = blockId === selectedBlockId;

    return (
      <Tag
        className={`commentable-block ${extraClass} ${isSelected ? 'selected' : ''} ${hasLocal ? 'has-local' : ''} ${hasGithub && !hasLocal ? 'has-github' : ''}`}
        data-block-id={blockId}
      >
        {children}
        <span className="block-actions">
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
