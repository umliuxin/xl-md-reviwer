# xl-md-viewer

A web tool for reviewing markdown files from GitHub PRs with Google Docs-like inline commenting.

**Live:** https://umliuxin.github.io/xl-md-reviwer

## Why?

GitHub's PR review experience for markdown files shows raw source diffs. This tool renders the markdown content and lets you add inline comments on specific paragraphs, headings, or list items—similar to how Google Docs works.

## Features

- Load markdown files from any GitHub PR URL
- Rendered markdown preview (not raw source)
- Click any block (paragraph, heading, list item, code block, table) to add comments
- Local-first comments: draft comments saved locally until you publish
- Batch publish: submit all comments as a single GitHub review
- Reply to existing GitHub threads
- Automatic detection of resolved and outdated comments
- URL persistence: refresh the page without losing your place
- Recent PRs list with titles

## Setup

```bash
npm install
npm run dev
```

## Usage

1. Open the app (default: http://localhost:5173)
2. Add your GitHub token (get it with `gh auth token`)
3. Paste a PR URL (e.g., `https://github.com/owner/repo/pull/123`)
4. Click "Load PR" to view markdown files
5. Click any paragraph or heading to add a comment
6. Click "Publish" to submit all draft comments to GitHub

## Deploy

Automatic via GitHub Actions - push to `main` branch triggers build and deploy to GitHub Pages.

## Tech Stack

- React 19 + TypeScript
- Vite
- react-markdown + remark-gfm
- @octokit/rest (GitHub REST + GraphQL API)
