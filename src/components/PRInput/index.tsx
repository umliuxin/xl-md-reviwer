import { useState, useEffect } from 'react';
import {
  parsePRUrl,
  setGitHubToken,
  getStoredToken,
  clearToken,
} from '../../services/github';
import './styles.css';

interface PRInputProps {
  onSubmit: (owner: string, repo: string, prNumber: number) => void;
  isLoading: boolean;
  error: string | null;
}

interface RecentPR {
  url: string;
  repo: string;
  number: number;
  title?: string;
  addedAt: number;
}

const RECENT_PRS_KEY = 'recent-prs';
const MAX_RECENT_PRS = 10;

function getRecentPRs(): RecentPR[] {
  const stored = localStorage.getItem(RECENT_PRS_KEY);
  return stored ? JSON.parse(stored) : [];
}

function saveRecentPR(url: string): RecentPR[] {
  const parsed = parsePRUrl(url);
  if (!parsed) return getRecentPRs();

  const recent = getRecentPRs().filter((pr) => pr.url !== url);
  const newPR: RecentPR = {
    url,
    repo: `${parsed.owner}/${parsed.repo}`,
    number: parsed.number,
    addedAt: Date.now(),
  };
  const updated = [newPR, ...recent].slice(0, MAX_RECENT_PRS);
  localStorage.setItem(RECENT_PRS_KEY, JSON.stringify(updated));
  return updated;
}

function removeRecentPR(url: string): RecentPR[] {
  const updated = getRecentPRs().filter((pr) => pr.url !== url);
  localStorage.setItem(RECENT_PRS_KEY, JSON.stringify(updated));
  return updated;
}

// Update PR title after loading (exported for use in App.tsx)
export function updateRecentPRTitle(owner: string, repo: string, number: number, title: string): void {
  const url = `https://github.com/${owner}/${repo}/pull/${number}`;
  const recent = getRecentPRs();
  const updated = recent.map((pr) =>
    pr.url === url ? { ...pr, title } : pr
  );
  localStorage.setItem(RECENT_PRS_KEY, JSON.stringify(updated));
}

export function PRInput({ onSubmit, isLoading, error }: PRInputProps) {
  const [url, setUrl] = useState('');
  const [token, setToken] = useState('');
  const [hasToken, setHasToken] = useState(false);
  const [recentPRs, setRecentPRs] = useState<RecentPR[]>([]);
  const [showTutorial, setShowTutorial] = useState(false);

  useEffect(() => {
    const storedToken = getStoredToken();
    if (storedToken) {
      setGitHubToken(storedToken);
      setHasToken(true);
      setShowTutorial(false);
    }
    setRecentPRs(getRecentPRs());
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadPR(url);
  };

  const loadPR = (prUrl: string) => {
    const parsed = parsePRUrl(prUrl);
    if (parsed) {
      setRecentPRs(saveRecentPR(prUrl));
      onSubmit(parsed.owner, parsed.repo, parsed.number);
    }
  };

  const handleRemovePR = (e: React.MouseEvent, prUrl: string) => {
    e.stopPropagation();
    setRecentPRs(removeRecentPR(prUrl));
  };

  const handleSaveToken = () => {
    if (token.trim()) {
      setGitHubToken(token.trim());
      setHasToken(true);
      setToken('');
    }
  };

  const handleClearToken = () => {
    clearToken();
    setHasToken(false);
  };

  const isValidUrl = url === '' || parsePRUrl(url) !== null;

  // Show setup guide when no token is configured
  if (!hasToken) {
    return (
      <div className="pr-input-container">
        <h1>MD Viewer</h1>
        <p className="subtitle">Review markdown files from GitHub PRs with inline comments.</p>

        <div className="setup-guide">
          <h2>Get Started</h2>
          <p>To use this tool, you need a GitHub personal access token.</p>

          <div className="setup-steps">
            <div className="setup-step">
              <span className="step-number">1</span>
              <div className="step-content">
                <strong>Get your token</strong>
                <p>Run this command in your terminal:</p>
                <code className="code-block">gh auth token</code>
                <p className="step-hint">Don't have GitHub CLI? <a href="https://cli.github.com/" target="_blank" rel="noopener noreferrer">Install it here</a> or <a href="https://github.com/settings/tokens" target="_blank" rel="noopener noreferrer">create a token manually</a></p>
              </div>
            </div>

            <div className="setup-step">
              <span className="step-number">2</span>
              <div className="step-content">
                <strong>Paste your token below</strong>
                <div className="token-input-row">
                  <input
                    type="password"
                    value={token}
                    onChange={(e) => setToken(e.target.value)}
                    placeholder="Paste your GitHub token"
                    className="token-input"
                    autoFocus
                  />
                  <button onClick={handleSaveToken} disabled={!token.trim()}>
                    Save Token
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="pr-input-container">
      <h1>MD Viewer</h1>
      <p className="subtitle">Review markdown files from GitHub PRs with inline comments. For code changes, use GitHub's UI.</p>

      <div className="token-status">
        <div className="token-configured">
          <span className="token-badge">✓ GitHub token configured</span>
          <button className="token-clear-btn" onClick={handleClearToken}>
            Clear
          </button>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="pr-input-form">
        <input
          type="text"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="Paste GitHub PR URL (e.g., https://github.com/owner/repo/pull/123)"
          className={`pr-input ${!isValidUrl ? 'invalid' : ''}`}
          disabled={isLoading}
        />
        <button type="submit" disabled={!parsePRUrl(url) || isLoading}>
          {isLoading ? 'Loading...' : 'Load PR'}
        </button>
      </form>

      {!isValidUrl && <p className="error-text">Please enter a valid GitHub PR URL</p>}
      {error && <p className="error-text">{error}</p>}

      {recentPRs.length > 0 && (
        <div className="recent-prs">
          <h3>Recent PRs</h3>
          <ul className="recent-prs-list">
            {recentPRs.map((pr) => (
              <li
                key={pr.url}
                className="recent-pr-item"
                onClick={() => !isLoading && loadPR(pr.url)}
              >
                <span className="recent-pr-info">
                  {pr.title && <span className="recent-pr-title">{pr.title}</span>}
                  <span className="recent-pr-meta">
                    <span className="recent-pr-repo">{pr.repo}</span>
                    <span className="recent-pr-number">#{pr.number}</span>
                  </span>
                </span>
                <button
                  className="recent-pr-remove"
                  onClick={(e) => handleRemovePR(e, pr.url)}
                  title="Remove"
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="tutorial-section">
        <button
          className="tutorial-toggle"
          onClick={() => setShowTutorial(!showTutorial)}
        >
          <span className="toggle-icon">{showTutorial ? '▼' : '▶'}</span>
          How to use
        </button>

        {showTutorial && (
          <div className="tutorial-content">
            <ol>
              <li><strong>Load a PR</strong> - Paste any GitHub PR URL and click "Load PR"</li>
              <li><strong>Add comments</strong> - Click on any paragraph, heading, or list item to add a comment</li>
              <li><strong>Reply to threads</strong> - Use "Add to review" to batch replies, or "Post now" for immediate</li>
              <li><strong>Publish</strong> - Click "Publish" to submit all draft comments as a GitHub review</li>
              <li><strong>Sync</strong> - Click "Sync with GitHub" to fetch latest comments from others</li>
            </ol>
            <p className="tutorial-note">
              <strong>Note:</strong> This tool only shows markdown (.md) files. Code changes and non-markdown files should be reviewed directly in GitHub.
            </p>
            <p className="tutorial-note">
              Your comments are saved locally until published. Refresh the page anytime - your drafts persist.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
