# Plan: GitHub Native Pending Review System

## Overview

Use GitHub's pending review API so comments are stored on GitHub servers, synced across devices, and compatible with GitHub's native UI.

## Workflow

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│  1. Load PR                                                     │
│     ├── Fetch submitted comments (visible to all)               │
│     └── Fetch YOUR pending review comments (only you see)       │
│                                                                 │
│  2. Add Comment                                                 │
│     ├── If no pending review exists → create one                │
│     └── Add comment to pending review → saved on GitHub         │
│                                                                 │
│  3. Publish Review                                              │
│     └── Submit pending review → all comments become visible     │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## API Calls

| Action | Endpoint | Notes |
|--------|----------|-------|
| Get submitted comments | `GET /pulls/{pr}/comments` | All review comments |
| Get my pending review | `GET /pulls/{pr}/reviews` | Filter for PENDING + my user |
| Get pending comments | `GET /pulls/{pr}/reviews/{id}/comments` | My draft comments |
| Create pending review | `POST /pulls/{pr}/reviews` | `{ event: "PENDING" }` |
| Add comment | `POST /pulls/{pr}/reviews/{id}/comments` | Attach to pending review |
| Delete pending comment | `DELETE /pulls/{pr}/comments/{comment_id}` | Remove draft |
| Submit review | `POST /pulls/{pr}/reviews/{id}/events` | `{ event: "COMMENT" }` |

## Implementation Tasks

### Task 1: Update Types
- Add `GitHubComment` type with GitHub-specific fields
- Add `PendingReview` type
- Update `PRInfo` to include comments

### Task 2: Fetch Comments API
- `fetchSubmittedComments()` - get all visible comments
- `fetchMyPendingReview()` - get current user's pending review if exists
- `fetchPendingComments()` - get comments in pending review
- `getCurrentUser()` - needed to filter "my" pending review

### Task 3: Create/Add Comments API
- `getOrCreatePendingReview()` - create if not exists
- `addPendingComment()` - add comment to pending review
- `deletePendingComment()` - remove a draft comment

### Task 4: Submit Review API
- `submitReview()` - publish with APPROVE/REQUEST_CHANGES/COMMENT

### Task 5: Line Number Mapping
- Parse markdown to map line numbers → block IDs
- GitHub comments use line numbers, we use block IDs
- Build bidirectional mapping when loading file

### Task 6: UI Updates
- Split sidebar: "Submitted" vs "Your Pending" sections
- Show pending count badge
- "Publish Review" button with review type selector
- Visual distinction: submitted (gray) vs pending (yellow/orange)
- Show "Draft" badge on pending comments

### Task 7: Comment Sync
- On load: fetch both submitted + pending, merge into view
- On add: create pending comment via API, refresh
- On delete: delete via API, refresh
- On publish: submit review, refresh to show as submitted

## UI Mockup

```
┌─────────────────────────────────┐
│  Comments                       │
├─────────────────────────────────┤
│                                 │
│  SUBMITTED (3)                  │
│  ┌───────────────────────────┐  │
│  │ @alice · 2h ago           │  │
│  │ "Looks good to me"        │  │
│  └───────────────────────────┘  │
│                                 │
│  YOUR PENDING (2)     [Publish] │
│  ┌───────────────────────────┐  │
│  │ Draft · just now      [×] │  │
│  │ "Need more detail"        │  │
│  └───────────────────────────┘  │
│                                 │
│  [+ Add comment]                │
│                                 │
└─────────────────────────────────┘
```

## File Changes

- `src/types/index.ts` - new types
- `src/services/github.ts` - new API functions
- `src/store/comments.ts` - remove local storage, use GitHub state
- `src/components/CommentSidebar/` - split sections, publish button
- `src/components/CommentThread/` - distinguish submitted vs pending
- `src/App.tsx` - pass GitHub comments to components
