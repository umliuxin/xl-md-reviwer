# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # Start development server (Vite, default http://localhost:5173)
npm run build    # TypeScript check + production build
npm run lint     # ESLint with zero-warning policy
npm run preview  # Preview production build locally
npm run deploy   # Build and deploy to GitHub Pages
```

## Environment

- **Node**: Managed via Volta (v22.22.2, pinned in package.json)
- **Base path**: `/xl-md-reviwer/` (intentional typo, matches GitHub Pages URL — do not "fix")
- **Deploy**: Push to `main` auto-deploys via GitHub Actions → gh-pages branch
- **No test framework**: No unit tests configured; verify changes with `npm run build` + `npm run lint`

## Architecture

React 19 + TypeScript web app for reviewing markdown files from GitHub PRs with inline commenting. State is managed with React `useState`/`useCallback` in `App.tsx` (no external state library for app state despite zustand being installed). CSS is per-component (`styles.css` colocated in each component folder), no CSS modules or Tailwind.

### Data Flow

1. **PRInput** → User pastes GitHub PR URL + configures auth token
2. **github.ts** → Fetches PR metadata, markdown contents, and comments via Octokit (REST + GraphQL)
3. **App.tsx** → Manages PR state, file selection, block selection, and local pending comments
4. **lineMapping.ts** → Parses markdown AST to map line numbers to block IDs
5. **MarkdownViewer** → Renders markdown with react-markdown, wraps blocks in commentable elements with `data-block-id`
6. **CommentSidebar** → Shows unified threads (GitHub + local comments merged), sorted by line position
7. **InlineCommentForm** → Portal-based popover for adding new comments

### Key Patterns

- **Block IDs**: Format is `{filePath}-line-{lineNumber}`. Comments link to blocks via `blockId`.
- **Local-first comments**: New comments stored in localStorage as `LocalPendingComment` until batch-published to GitHub.
- **Unified threads**: `createUnifiedThreads()` merges GitHub threads and local comments by thread ID, displaying them together.
- **Resolved/Outdated detection**: GraphQL fetches thread resolution status; REST API's `line: null` + `original_line` indicates outdated.
- **URL persistence**: PR info stored in URL hash (`#owner/repo/number`) for refresh support. Also supports `?pr=<full-github-url>` query param (cleaned after load).
- **GitHub auth**: Token stored in localStorage, used to create Octokit client. Both REST and GraphQL APIs are used (REST for comments/reviews, GraphQL for thread resolution status).

### Comment Publishing Flow

1. User adds comments locally → stored in `comments.localPending` + localStorage
2. User clicks "Publish" → `publishReview()` separates new comments from replies
3. New comments → `pulls.createReview()` API
4. Replies to existing threads → `pulls.createReplyForReviewComment()` API

### Component Responsibilities

| Component | Purpose |
|-----------|---------|
| `PRInput` | Landing page: token config, PR URL input, recent PRs list |
| `MarkdownViewer` | Renders markdown, makes blocks clickable, shows comment count indicators |
| `CommentSidebar` | Lists unified threads, reply forms, publish button, collapsed resolved/outdated section |
| `InlineCommentForm` | Positioned popover for new comment input |
| `PublishModal` | Review event selection (Comment/Approve/Request Changes) before publishing |

### Types (src/types/index.ts)

- `GitHubComment` - Comment from GitHub API with `isOutdated` and `isResolved` flags
- `CommentThread` - Grouped GitHub comments (root + replies)
- `LocalPendingComment` - Unpublished local comment with `replyToThreadId` and `groupKey`
- `UnifiedThread` - Merged view of GitHub thread + local comments for display
