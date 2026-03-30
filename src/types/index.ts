export interface Comment {
  id: string;
  blockId: string;
  text: string;
  author: string;
  createdAt: Date;
  resolved: boolean;
  replies: Reply[];
}

export interface Reply {
  id: string;
  text: string;
  author: string;
  createdAt: Date;
}

export interface MarkdownFile {
  path: string;
  content: string;
  sha: string;
}

export interface PRInfo {
  owner: string;
  repo: string;
  number: number;
  title: string;
  files: MarkdownFile[];
}

export interface SelectionRange {
  blockId: string;
  startOffset: number;
  endOffset: number;
  text: string;
}
