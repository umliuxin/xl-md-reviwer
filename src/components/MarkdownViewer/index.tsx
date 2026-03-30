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
}

export function MarkdownViewer({ content, filePath, comments }: MarkdownViewerProps) {
  // Use line number as block identifier
  const getBlockId = (line: number) => `${filePath}-line-${line}`;

  // Count comments for a block (both submitted and pending)
  const getBlockCommentCount = (blockId: string) => {
    const submitted = comments.submitted.filter((t) => t.blockId === blockId).length;
    const pending = comments.pending.filter((t) => t.blockId === blockId).length;
    return submitted + pending;
  };

  // Check if block has pending comments (for different styling)
  const hasPendingComments = (blockId: string) => {
    return comments.pending.some((t) => t.blockId === blockId);
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
    const commentCount = getBlockCommentCount(blockId);
    const hasPending = hasPendingComments(blockId);

    return (
      <Tag
        className={`commentable-block ${extraClass} ${commentCount > 0 ? 'has-comments' : ''} ${hasPending ? 'has-pending' : ''}`}
        data-block-id={blockId}
      >
        {children}
        {commentCount > 0 && (
          <span className={`comment-indicator ${hasPending ? 'pending' : ''}`}>
            {commentCount}
          </span>
        )}
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
