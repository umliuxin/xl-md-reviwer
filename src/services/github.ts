import { Octokit } from '@octokit/rest';
import type {
  MarkdownFile,
  PRInfo,
  GitHubComment,
  GitHubUser,
  PendingReview,
  PRComments,
  CommentThread,
  ReviewEvent,
} from '../types';

let octokit: Octokit | null = null;
let cachedUser: GitHubUser | null = null;

export function setGitHubToken(token: string) {
  octokit = new Octokit({ auth: token });
  localStorage.setItem('gh-token', token);
  cachedUser = null; // Reset cached user on token change
}

export function getStoredToken(): string | null {
  return localStorage.getItem('gh-token');
}

export function clearToken() {
  octokit = null;
  cachedUser = null;
  localStorage.removeItem('gh-token');
}

export function isAuthenticated(): boolean {
  return octokit !== null;
}

function getOctokit(): Octokit {
  if (!octokit) {
    const stored = getStoredToken();
    if (stored) {
      setGitHubToken(stored);
      return octokit!;
    }
    throw new Error('GitHub token not configured. Please add your token.');
  }
  return octokit;
}

function decodeBase64UTF8(base64: string): string {
  const binaryString = atob(base64);
  const bytes = Uint8Array.from(binaryString, (char) => char.charCodeAt(0));
  return new TextDecoder('utf-8').decode(bytes);
}

export function parsePRUrl(url: string): { owner: string; repo: string; number: number } | null {
  const match = url.match(/github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)/);
  if (!match) return null;
  return {
    owner: match[1],
    repo: match[2],
    number: parseInt(match[3], 10),
  };
}

// ===========================================
// USER
// ===========================================

export async function getCurrentUser(): Promise<GitHubUser> {
  if (cachedUser) return cachedUser;

  const client = getOctokit();
  const { data } = await client.users.getAuthenticated();

  cachedUser = {
    login: data.login,
    avatarUrl: data.avatar_url,
  };
  return cachedUser;
}

// ===========================================
// PR INFO
// ===========================================

export async function fetchPRInfo(owner: string, repo: string, prNumber: number): Promise<PRInfo> {
  const client = getOctokit();

  const { data: pr } = await client.pulls.get({
    owner,
    repo,
    pull_number: prNumber,
  });

  const { data: files } = await client.pulls.listFiles({
    owner,
    repo,
    pull_number: prNumber,
  });

  const mdFiles = files.filter(
    (f) => f.filename.endsWith('.md') && f.status !== 'removed'
  );

  if (mdFiles.length === 0) {
    throw new Error('No markdown files found in this PR');
  }

  const markdownFiles: MarkdownFile[] = await Promise.all(
    mdFiles.map(async (file) => {
      const { data } = await client.repos.getContent({
        owner,
        repo,
        path: file.filename,
        ref: pr.head.sha,
      });

      if ('content' in data && typeof data.content === 'string') {
        return {
          path: file.filename,
          content: decodeBase64UTF8(data.content.replace(/\n/g, '')),
          sha: data.sha,
        };
      }
      throw new Error(`Could not fetch content for ${file.filename}`);
    })
  );

  return {
    owner,
    repo,
    number: prNumber,
    title: pr.title,
    headSha: pr.head.sha,
    files: markdownFiles,
  };
}

// ===========================================
// FETCH COMMENTS
// ===========================================

function toGitHubComment(raw: {
  id: number;
  path?: string;
  line?: number | null;
  original_line?: number | null;
  body?: string;
  user?: { login: string; avatar_url: string } | null;
  created_at: string;
  updated_at: string;
  in_reply_to_id?: number;
}): GitHubComment {
  return {
    id: raw.id,
    path: raw.path || '',
    line: raw.line || raw.original_line || 0,
    body: raw.body || '',
    author: raw.user?.login || 'unknown',
    authorAvatar: raw.user?.avatar_url || '',
    createdAt: new Date(raw.created_at),
    updatedAt: new Date(raw.updated_at),
    inReplyToId: raw.in_reply_to_id || null,
    blockId: null, // Will be mapped later
  };
}

// Fetch all submitted (visible) review comments
export async function fetchSubmittedComments(
  owner: string,
  repo: string,
  prNumber: number
): Promise<GitHubComment[]> {
  const client = getOctokit();

  const { data } = await client.pulls.listReviewComments({
    owner,
    repo,
    pull_number: prNumber,
    per_page: 100,
  });

  return data.map(toGitHubComment);
}

// Find current user's pending review (if exists)
export async function fetchMyPendingReview(
  owner: string,
  repo: string,
  prNumber: number
): Promise<PendingReview | null> {
  const client = getOctokit();
  const user = await getCurrentUser();

  const { data: reviews } = await client.pulls.listReviews({
    owner,
    repo,
    pull_number: prNumber,
    per_page: 100,
  });

  const pendingReview = reviews.find(
    (r) => r.state === 'PENDING' && r.user?.login === user.login
  );

  if (!pendingReview) return null;

  return {
    id: pendingReview.id,
    state: 'PENDING',
    user: user.login,
  };
}

// Fetch comments from a pending review
export async function fetchPendingComments(
  owner: string,
  repo: string,
  prNumber: number,
  reviewId: number
): Promise<GitHubComment[]> {
  const client = getOctokit();

  // GitHub API: GET /repos/{owner}/{repo}/pulls/{pull_number}/reviews/{review_id}/comments
  const { data } = await client.request(
    'GET /repos/{owner}/{repo}/pulls/{pull_number}/reviews/{review_id}/comments',
    {
      owner,
      repo,
      pull_number: prNumber,
      review_id: reviewId,
      per_page: 100,
    }
  );

  return data.map(toGitHubComment);
}

// Group comments into threads (root + replies)
function groupIntoThreads(comments: GitHubComment[], isPending: boolean): CommentThread[] {
  const threadMap = new Map<number, CommentThread>();
  const replyMap = new Map<number, GitHubComment[]>();

  // First pass: identify root comments and collect replies
  for (const comment of comments) {
    if (comment.inReplyToId) {
      const replies = replyMap.get(comment.inReplyToId) || [];
      replies.push(comment);
      replyMap.set(comment.inReplyToId, replies);
    } else {
      threadMap.set(comment.id, {
        id: comment.id,
        path: comment.path,
        line: comment.line,
        blockId: comment.blockId,
        comments: [comment],
        isPending,
      });
    }
  }

  // Second pass: attach replies to their threads
  for (const [rootId, replies] of replyMap) {
    const thread = threadMap.get(rootId);
    if (thread) {
      // Sort replies by date
      replies.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
      thread.comments.push(...replies);
    }
  }

  return Array.from(threadMap.values());
}

// Fetch all comments (submitted + pending) for a PR
export async function fetchAllComments(
  owner: string,
  repo: string,
  prNumber: number
): Promise<PRComments> {
  // Fetch submitted comments
  const submittedComments = await fetchSubmittedComments(owner, repo, prNumber);
  const submittedThreads = groupIntoThreads(submittedComments, false);

  // Check for pending review
  const pendingReview = await fetchMyPendingReview(owner, repo, prNumber);

  let pendingThreads: CommentThread[] = [];
  if (pendingReview) {
    const pendingComments = await fetchPendingComments(owner, repo, prNumber, pendingReview.id);
    pendingThreads = groupIntoThreads(pendingComments, true);
  }

  return {
    submitted: submittedThreads,
    pending: pendingThreads,
    pendingReview,
  };
}

// ===========================================
// CREATE/MANAGE COMMENTS
// ===========================================

// Get or create a pending review
export async function getOrCreatePendingReview(
  owner: string,
  repo: string,
  prNumber: number
): Promise<PendingReview> {
  // Check if we already have a pending review
  const existing = await fetchMyPendingReview(owner, repo, prNumber);
  if (existing) return existing;

  // Create a new pending review
  const client = getOctokit();
  const user = await getCurrentUser();

  const { data } = await client.pulls.createReview({
    owner,
    repo,
    pull_number: prNumber,
    // Don't submit, just create as pending
  });

  return {
    id: data.id,
    state: 'PENDING',
    user: user.login,
  };
}

// Add a comment to the pending review
export async function addPendingComment(
  owner: string,
  repo: string,
  prNumber: number,
  commitSha: string,
  path: string,
  line: number,
  body: string
): Promise<GitHubComment> {
  const client = getOctokit();

  // Ensure we have a pending review
  await getOrCreatePendingReview(owner, repo, prNumber);

  // Add comment to the PR (it will automatically attach to pending review)
  const { data } = await client.pulls.createReviewComment({
    owner,
    repo,
    pull_number: prNumber,
    commit_id: commitSha,
    path,
    line,
    body,
    side: 'RIGHT', // Comment on the new version
  });

  return toGitHubComment(data);
}

// Reply to an existing comment
export async function replyToComment(
  owner: string,
  repo: string,
  prNumber: number,
  commentId: number,
  body: string
): Promise<GitHubComment> {
  const client = getOctokit();

  const { data } = await client.pulls.createReplyForReviewComment({
    owner,
    repo,
    pull_number: prNumber,
    comment_id: commentId,
    body,
  });

  return toGitHubComment(data);
}

// Delete a pending comment
export async function deletePendingComment(
  owner: string,
  repo: string,
  commentId: number
): Promise<void> {
  const client = getOctokit();

  await client.pulls.deleteReviewComment({
    owner,
    repo,
    comment_id: commentId,
  });
}

// Submit the pending review
export async function submitReview(
  owner: string,
  repo: string,
  prNumber: number,
  reviewId: number,
  event: ReviewEvent,
  body?: string
): Promise<void> {
  const client = getOctokit();

  await client.pulls.submitReview({
    owner,
    repo,
    pull_number: prNumber,
    review_id: reviewId,
    event,
    body: body || '',
  });
}

// Delete a pending review (discards all pending comments)
export async function deletePendingReview(
  owner: string,
  repo: string,
  prNumber: number,
  reviewId: number
): Promise<void> {
  const client = getOctokit();

  await client.pulls.deletePendingReview({
    owner,
    repo,
    pull_number: prNumber,
    review_id: reviewId,
  });
}
