import { useState, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useCommentsStore } from '../../store/comments';
import './styles.css';

interface MarkdownViewerProps {
  content: string;
  filePath: string;
}

export function MarkdownViewer({ content, filePath }: MarkdownViewerProps) {
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const { comments, setActiveComment } = useCommentsStore();

  const getBlockId = (index: number) => `${filePath}-block-${index}`;

  const handleBlockClick = useCallback(
    (blockId: string) => {
      setSelectedBlockId(blockId);
      const blockComments = comments.filter((c) => c.blockId === blockId && !c.resolved);
      if (blockComments.length > 0) {
        setActiveComment(blockComments[0].id);
      }
    },
    [comments, setActiveComment]
  );

  const getBlockCommentCount = (blockId: string) => {
    return comments.filter((c) => c.blockId === blockId && !c.resolved).length;
  };

  let blockIndex = 0;

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
            p: ({ children }) => {
              const blockId = getBlockId(blockIndex++);
              const commentCount = getBlockCommentCount(blockId);
              return (
                <p
                  className={`commentable-block ${selectedBlockId === blockId ? 'selected' : ''} ${commentCount > 0 ? 'has-comments' : ''}`}
                  data-block-id={blockId}
                  onClick={() => handleBlockClick(blockId)}
                >
                  {children}
                  {commentCount > 0 && (
                    <span className="comment-indicator">{commentCount}</span>
                  )}
                </p>
              );
            },
            h1: ({ children }) => {
              const blockId = getBlockId(blockIndex++);
              const commentCount = getBlockCommentCount(blockId);
              return (
                <h1
                  className={`commentable-block ${selectedBlockId === blockId ? 'selected' : ''} ${commentCount > 0 ? 'has-comments' : ''}`}
                  data-block-id={blockId}
                  onClick={() => handleBlockClick(blockId)}
                >
                  {children}
                  {commentCount > 0 && (
                    <span className="comment-indicator">{commentCount}</span>
                  )}
                </h1>
              );
            },
            h2: ({ children }) => {
              const blockId = getBlockId(blockIndex++);
              const commentCount = getBlockCommentCount(blockId);
              return (
                <h2
                  className={`commentable-block ${selectedBlockId === blockId ? 'selected' : ''} ${commentCount > 0 ? 'has-comments' : ''}`}
                  data-block-id={blockId}
                  onClick={() => handleBlockClick(blockId)}
                >
                  {children}
                  {commentCount > 0 && (
                    <span className="comment-indicator">{commentCount}</span>
                  )}
                </h2>
              );
            },
            h3: ({ children }) => {
              const blockId = getBlockId(blockIndex++);
              const commentCount = getBlockCommentCount(blockId);
              return (
                <h3
                  className={`commentable-block ${selectedBlockId === blockId ? 'selected' : ''} ${commentCount > 0 ? 'has-comments' : ''}`}
                  data-block-id={blockId}
                  onClick={() => handleBlockClick(blockId)}
                >
                  {children}
                  {commentCount > 0 && (
                    <span className="comment-indicator">{commentCount}</span>
                  )}
                </h3>
              );
            },
            li: ({ children }) => {
              const blockId = getBlockId(blockIndex++);
              const commentCount = getBlockCommentCount(blockId);
              return (
                <li
                  className={`commentable-block ${selectedBlockId === blockId ? 'selected' : ''} ${commentCount > 0 ? 'has-comments' : ''}`}
                  data-block-id={blockId}
                  onClick={() => handleBlockClick(blockId)}
                >
                  {children}
                  {commentCount > 0 && (
                    <span className="comment-indicator">{commentCount}</span>
                  )}
                </li>
              );
            },
            blockquote: ({ children }) => {
              const blockId = getBlockId(blockIndex++);
              const commentCount = getBlockCommentCount(blockId);
              return (
                <blockquote
                  className={`commentable-block ${selectedBlockId === blockId ? 'selected' : ''} ${commentCount > 0 ? 'has-comments' : ''}`}
                  data-block-id={blockId}
                  onClick={() => handleBlockClick(blockId)}
                >
                  {children}
                  {commentCount > 0 && (
                    <span className="comment-indicator">{commentCount}</span>
                  )}
                </blockquote>
              );
            },
            pre: ({ children }) => {
              const blockId = getBlockId(blockIndex++);
              const commentCount = getBlockCommentCount(blockId);
              return (
                <pre
                  className={`commentable-block code-block ${selectedBlockId === blockId ? 'selected' : ''} ${commentCount > 0 ? 'has-comments' : ''}`}
                  data-block-id={blockId}
                  onClick={() => handleBlockClick(blockId)}
                >
                  {children}
                  {commentCount > 0 && (
                    <span className="comment-indicator">{commentCount}</span>
                  )}
                </pre>
              );
            },
          }}
        >
          {content}
        </ReactMarkdown>
      </div>
    </div>
  );
}
