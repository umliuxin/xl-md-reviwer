# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # Start development server (Vite)
npm run build    # TypeScript check + production build
npm run preview  # Preview production build locally
```

## Architecture

This is a React + TypeScript web app for reviewing markdown files from GitHub PRs with Google Docs-like inline commenting.

### Data Flow

1. **PRInput** → User pastes GitHub PR URL + configures auth token
2. **github.ts** → Fetches PR metadata and markdown file contents via Octokit
3. **App.tsx** → Manages PR state, file selection, and block selection
4. **MarkdownViewer** → Renders markdown with react-markdown, wraps each block (p, h1-h3, li, blockquote) in commentable elements with `data-block-id`
5. **CommentSidebar** → Shows comment threads for selected block
6. **comments.ts (Zustand)** → Persists comments to localStorage

### Key Patterns

- **Block IDs**: Each commentable element gets an ID like `{filePath}-block-{index}`. Comments are linked to blocks via `blockId`.
- **GitHub Auth**: Token stored in localStorage, loaded on init. Required for linkedin-multiproduct private repos.
- **State**: Zustand with `persist` middleware for comments; React useState for UI state (selected file, selected block, PR info).

### Component Responsibilities

| Component | Purpose |
|-----------|---------|
| `PRInput` | Landing page: token config + PR URL input |
| `MarkdownViewer` | Renders markdown, makes blocks clickable, shows comment indicators |
| `CommentSidebar` | Lists comments for selected block, add/reply/resolve/delete |
| `CommentThread` | Single comment with replies |
