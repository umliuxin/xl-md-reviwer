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

export function PRInput({ onSubmit, isLoading, error }: PRInputProps) {
  const [url, setUrl] = useState('');
  const [token, setToken] = useState('');
  const [hasToken, setHasToken] = useState(false);
  const [showTokenInput, setShowTokenInput] = useState(false);
  const [recentPRs, setRecentPRs] = useState<RecentPR[]>([]);

  useEffect(() => {
    const storedToken = getStoredToken();
    if (storedToken) {
      setGitHubToken(storedToken);
      setHasToken(true);
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
      setShowTokenInput(false);
      setToken('');
    }
  };

  const handleClearToken = () => {
    clearToken();
    setHasToken(false);
  };

  const isValidUrl = url === '' || parsePRUrl(url) !== null;

  return (
    <div className="pr-input-container">
      <h1>MD Viewer</h1>
      <p className="subtitle">Review markdown files from GitHub PRs with inline comments</p>

      <div className="token-status">
        {hasToken ? (
          <div className="token-configured">
            <span className="token-badge">✓ GitHub token configured</span>
            <button className="token-clear-btn" onClick={handleClearToken}>
              Clear
            </button>
          </div>
        ) : (
          <div className="token-missing">
            <span className="token-warning">⚠ GitHub token required for private repos</span>
            <button className="token-add-btn" onClick={() => setShowTokenInput(true)}>
              Add Token
            </button>
          </div>
        )}
      </div>

      {showTokenInput && (
        <div className="token-form">
          <p className="token-hint">
            Get your token by running: <code>gh auth token</code>
          </p>
          <div className="token-input-row">
            <input
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="Paste your GitHub token"
              className="token-input"
            />
            <button onClick={handleSaveToken} disabled={!token.trim()}>
              Save
            </button>
            <button className="cancel" onClick={() => setShowTokenInput(false)}>
              Cancel
            </button>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="pr-input-form">
        <input
          type="text"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="Paste GitHub PR URL (e.g., https://github.com/linkedin-multiproduct/repo/pull/123)"
          className={`pr-input ${!isValidUrl ? 'invalid' : ''}`}
          disabled={isLoading || !hasToken}
        />
        <button type="submit" disabled={!parsePRUrl(url) || isLoading || !hasToken}>
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
                onClick={() => !isLoading && hasToken && loadPR(pr.url)}
              >
                <span className="recent-pr-info">
                  <span className="recent-pr-repo">{pr.repo}</span>
                  <span className="recent-pr-number">#{pr.number}</span>
                </span>
                <button
                  className="recent-pr-remove"
                  onClick={(e) => handleRemovePR(e, pr.url)}
                  title="Remove (e.g., when merged)"
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
