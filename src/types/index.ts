// ===========================================
// LEGACY TYPES (to be removed in Task 4)
// ===========================================

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

// ===========================================
// NEW GITHUB-BASED TYPES
// ===========================================

// GitHub comment from PR review
export interface GitHubComment {
  id: number;
  path: string;
  line: number;
  body: string;
  author: string;
  authorAvatar: string;
  createdAt: Date;
  updatedAt: Date;
  inReplyToId: number | null;
  // Mapped field (not from GitHub API)
  blockId: string | null;
}

// Pending review metadata
export interface PendingReview {
  id: number;
  state: 'PENDING';
  user: string;
}

// Review submission event types
export type ReviewEvent = 'APPROVE' | 'REQUEST_CHANGES' | 'COMMENT';

// Grouped comments for display
export interface CommentThread {
  id: number;
  path: string;
  line: number;
  blockId: string | null;
  comments: GitHubComment[]; // First is root, rest are replies
  isPending: boolean;
}

// Markdown file with line mapping
export interface MarkdownFile {
  path: string;
  content: string;
  sha: string;
  // Line number -> block ID mapping (built after parsing)
  lineToBlockId?: Map<number, string>;
}

// PR info with comments
export interface PRInfo {
  owner: string;
  repo: string;
  number: number;
  title: string;
  headSha: string;
  files: MarkdownFile[];
}

// Comments state for a PR
export interface PRComments {
  submitted: CommentThread[];
  pending: CommentThread[];
  pendingReview: PendingReview | null;
}

// Current user info
export interface GitHubUser {
  login: string;
  avatarUrl: string;
}

// For creating a new comment
export interface NewComment {
  path: string;
  line: number;
  body: string;
}
