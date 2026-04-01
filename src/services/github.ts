import { Octokit } from '@octokit/rest';
import type {
  MarkdownFile,
  PRInfo,
  GitHubComment,
  GitHubUser,
  CommentThread,
  ReviewEvent,
  LocalPendingComment,
} from '../types';

let octokit: Octokit | null = null;
let cachedUser: GitHubUser | null = null;

export function setGitHubToken(token: string) {
  octokit = new Octokit({ auth: token });
  localStorage.setItem('gh-token', token);
  cachedUser = null;
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
// FETCH COMMENTS (from GitHub)
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
  // If line is null but original_line exists, the comment is outdated
  // (the line no longer exists in the current version)
  const isOutdated = raw.line == null && raw.original_line != null;

  return {
    id: raw.id,
    path: raw.path || '',
    line: raw.line || raw.original_line || 0,
    originalLine: raw.original_line || raw.line || 0,
    body: raw.body || '',
    author: raw.user?.login || 'unknown',
    authorAvatar: raw.user?.avatar_url || '',
    createdAt: new Date(raw.created_at),
    updatedAt: new Date(raw.updated_at),
    inReplyToId: raw.in_reply_to_id || null,
    blockId: null,
    isOutdated,
    isResolved: false, // Will be set by fetchSubmittedComments
  };
}

// Fetch resolved thread IDs via GraphQL
async function fetchResolvedThreadIds(
  owner: string,
  repo: string,
  prNumber: number
): Promise<Set<number>> {
  const client = getOctokit();
  const resolvedIds = new Set<number>();

  const query = `
    query($owner: String!, $repo: String!, $prNumber: Int!) {
      repository(owner: $owner, name: $repo) {
        pullRequest(number: $prNumber) {
          reviewThreads(first: 100) {
            nodes {
              isResolved
              comments(first: 1) {
                nodes {
                  databaseId
                }
              }
            }
          }
        }
      }
    }
  `;

  try {
    const response: {
      repository: {
        pullRequest: {
          reviewThreads: {
            nodes: Array<{
              isResolved: boolean;
              comments: { nodes: Array<{ databaseId: number }> };
            }>;
          };
        };
      };
    } = await client.graphql(query, { owner, repo, prNumber });

    for (const thread of response.repository.pullRequest.reviewThreads.nodes) {
      if (thread.isResolved && thread.comments.nodes[0]) {
        resolvedIds.add(thread.comments.nodes[0].databaseId);
      }
    }
  } catch (e) {
    console.error('Failed to fetch resolved threads:', e);
  }

  return resolvedIds;
}

// Fetch all submitted review comments from GitHub
export async function fetchSubmittedComments(
  owner: string,
  repo: string,
  prNumber: number
): Promise<GitHubComment[]> {
  const client = getOctokit();

  const [{ data }, resolvedIds] = await Promise.all([
    client.pulls.listReviewComments({
      owner,
      repo,
      pull_number: prNumber,
      per_page: 100,
    }),
    fetchResolvedThreadIds(owner, repo, prNumber),
  ]);

  return data.map((c) => {
    const comment = toGitHubComment(c);
    // Mark as resolved if this comment's thread is resolved
    // Check both the comment ID and its in_reply_to_id (for replies in resolved threads)
    const rootId = c.in_reply_to_id || c.id;
    if (resolvedIds.has(rootId)) {
      comment.isResolved = true;
    }
    return comment;
  });
}

// Group comments into threads (root + replies)
function groupIntoThreads(comments: GitHubComment[]): CommentThread[] {
  const threadMap = new Map<number, CommentThread>();
  const replyMap = new Map<number, GitHubComment[]>();

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
        isPending: false,
        isOutdated: comment.isOutdated,
        isResolved: comment.isResolved,
      });
    }
  }

  for (const [rootId, replies] of replyMap) {
    const thread = threadMap.get(rootId);
    if (thread) {
      replies.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
      thread.comments.push(...replies);
    }
  }

  return Array.from(threadMap.values());
}

// Fetch submitted comments and return as threads
export async function fetchCommentThreads(
  owner: string,
  repo: string,
  prNumber: number
): Promise<CommentThread[]> {
  const comments = await fetchSubmittedComments(owner, repo, prNumber);
  return groupIntoThreads(comments);
}

// ===========================================
// PUBLISH COMMENTS (Local -> GitHub)
// ===========================================

// Publish all local pending comments as a single review
export async function publishReview(
  owner: string,
  repo: string,
  prNumber: number,
  commitSha: string,
  comments: LocalPendingComment[],
  event: ReviewEvent,
  body?: string
): Promise<void> {
  const client = getOctokit();

  if (comments.length === 0 && !body) {
    throw new Error('Nothing to publish');
  }

  // Separate new comments from replies to existing threads
  const newComments = comments.filter((c) => !c.replyToThreadId);
  const replies = comments.filter((c) => c.replyToThreadId);

  // Only create a review if there are new comments or a body
  if (newComments.length > 0 || body) {
    await client.pulls.createReview({
      owner,
      repo,
      pull_number: prNumber,
      commit_id: commitSha,
      event,
      body: body || '',
      comments: newComments.map((c) => ({
        path: c.path,
        line: c.line,
        body: c.body,
        side: 'RIGHT' as const,
      })),
    });
  }

  // Publish replies to existing threads separately
  for (const reply of replies) {
    await client.pulls.createReplyForReviewComment({
      owner,
      repo,
      pull_number: prNumber,
      comment_id: reply.replyToThreadId!,
      body: reply.body,
    });
  }
}

// ===========================================
// REPLY TO COMMENTS
// ===========================================

// Reply to an existing comment thread (immediately published)
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
