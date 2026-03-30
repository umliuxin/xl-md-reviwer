/**
 * Maps source line numbers to block IDs for markdown files.
 *
 * Block IDs are based on the block's start line number (e.g., "path/file.md-line-71").
 * This matches how MarkdownViewer assigns IDs using the AST node position.
 */

import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import type { Root, RootContent, List } from 'mdast';

export interface LineMapping {
  lineToBlockId: Map<number, string>;
  blockIdToLine: Map<string, number>;
}

interface BlockInfo {
  startLine: number;
  endLine: number;
}

/**
 * Recursively extract block nodes from the AST.
 * Only extracts blocks that MarkdownViewer renders with data-block-id.
 */
function extractBlocks(nodes: RootContent[], blocks: BlockInfo[]): void {
  for (const node of nodes) {
    if (!node.position) continue;

    const startLine = node.position.start.line;
    const endLine = node.position.end.line;

    switch (node.type) {
      case 'paragraph':
      case 'heading':
      case 'blockquote':
      case 'code':
      case 'table':
        blocks.push({ startLine, endLine });
        break;

      case 'list':
        // Lists render each item as a separate block
        for (const item of (node as List).children) {
          if (item.position) {
            blocks.push({
              startLine: item.position.start.line,
              endLine: item.position.end.line,
            });
          }
        }
        break;

      default:
        // For container nodes we don't handle, recurse into children
        if ('children' in node && Array.isArray(node.children)) {
          extractBlocks(node.children as RootContent[], blocks);
        }
        break;
    }
  }
}

/**
 * Build line-to-block mapping for a markdown file.
 *
 * @param filePath - The file path (used in block ID generation)
 * @param content - The markdown content
 * @returns LineMapping with bidirectional maps
 */
export function buildLineMapping(filePath: string, content: string): LineMapping {
  // Parse markdown using the same parser react-markdown uses
  const processor = unified().use(remarkParse).use(remarkGfm);
  const ast = processor.parse(content) as Root;

  // Extract blocks
  const blocks: BlockInfo[] = [];
  extractBlocks(ast.children, blocks);

  // Build the mappings
  // lineToBlockId: maps any line within a block to that block's ID (based on start line)
  // blockIdToLine: maps block ID to its start line
  const lineToBlockId = new Map<number, string>();
  const blockIdToLine = new Map<string, number>();

  for (const block of blocks) {
    const blockId = `${filePath}-line-${block.startLine}`;

    // Map all lines in the block to this block ID
    for (let line = block.startLine; line <= block.endLine; line++) {
      lineToBlockId.set(line, blockId);
    }

    blockIdToLine.set(blockId, block.startLine);
  }

  return { lineToBlockId, blockIdToLine };
}

/**
 * Get the block ID for a given line number.
 * Returns null if line is not part of any block (e.g., empty lines).
 */
export function getBlockIdForLine(mapping: LineMapping, line: number): string | null {
  return mapping.lineToBlockId.get(line) || null;
}

/**
 * Get the line number for a block ID.
 */
export function getLineForBlockId(mapping: LineMapping, blockId: string): number | null {
  return mapping.blockIdToLine.get(blockId) || null;
}
