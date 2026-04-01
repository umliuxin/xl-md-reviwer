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
  originalLine: number;
  body: string;
  author: string;
  authorAvatar: string;
  createdAt: Date;
  updatedAt: Date;
  inReplyToId: number | null;
  // Mapped field (not from GitHub API)
  blockId: string | null;
  // True if the line no longer exists in current version
  isOutdated: boolean;
  // True if the thread has been resolved
  isResolved: boolean;
}

// Local pending comment (not yet published to GitHub)
export interface LocalPendingComment {
  id: string; // Local UUID
  path: string;
  line: number;
  blockId: string | null;
  body: string;
  createdAt: Date;
  // If replying to an existing GitHub thread, store context
  replyToThreadId?: number;
  // Grouping key - standalone comments use unique id, replies share thread's key
  groupKey?: string;
}

// Grouped local comments on the same line (like a thread)
export interface LocalCommentThread {
  blockId: string | null;
  path: string;
  line: number;
  comments: LocalPendingComment[];
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
  isOutdated: boolean;
  isResolved: boolean;
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
  submitted: CommentThread[];       // From GitHub (already published)
  localPending: LocalPendingComment[]; // Local drafts (not yet on GitHub)
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

// Unified comment item for display (can be GitHub or local)
export interface UnifiedCommentItem {
  type: 'github' | 'local';
  id: string | number;
  body: string;
  createdAt: Date;
  // GitHub-specific
  author?: string;
  authorAvatar?: string;
  githubId?: number; // For replying
  // Local-specific
  localId?: string; // For deleting
}

// Unified thread combining GitHub and local comments on the same line
export interface UnifiedThread {
  blockId: string | null;
  path: string;
  line: number;
  items: UnifiedCommentItem[];
  githubThreadId?: number; // For replying to GitHub thread
  hasGithub: boolean;
  hasLocal: boolean;
  isOutdated: boolean;
  isResolved: boolean;
}
