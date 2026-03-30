import { Octokit } from '@octokit/rest';
import type { MarkdownFile, PRInfo } from '../types';

let octokit: Octokit | null = null;

export function setGitHubToken(token: string) {
  octokit = new Octokit({ auth: token });
  localStorage.setItem('gh-token', token);
}

export function getStoredToken(): string | null {
  return localStorage.getItem('gh-token');
}

export function clearToken() {
  octokit = null;
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
    files: markdownFiles,
  };
}
