# xl-md-viewer

A web tool for reviewing markdown files from GitHub PRs with Google Docs-like inline commenting.

## Why?

GitHub's PR review experience for markdown files shows raw source diffs. This tool renders the markdown content and lets you add inline comments on specific paragraphs, headings, or list items—similar to how Google Docs works.

## Features

- Load markdown files from any GitHub PR URL
- Rendered markdown preview (not source code)
- Click any block (paragraph, heading, list item) to add comments
- Comment threads with replies
- Resolve/delete comments
- Comments persist in localStorage

## Setup

```bash
npm install
npm run dev
```

## Usage

1. Open the app (default: http://localhost:5173)
2. Add your GitHub token (get it with `gh auth token`)
3. Paste a PR URL (e.g., `https://github.com/linkedin-multiproduct/repo/pull/123`)
4. Click "Load PR" to view markdown files
5. Click any paragraph or heading to add a comment

## Tech Stack

- React 19 + TypeScript
- Vite
- react-markdown + remark-gfm
- @octokit/rest (GitHub API)
- Zustand (state management)
