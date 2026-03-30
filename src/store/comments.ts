import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Comment, Reply } from '../types';

interface CommentsState {
  comments: Comment[];
  activeCommentId: string | null;
  addComment: (blockId: string, text: string, author?: string) => void;
  addReply: (commentId: string, text: string, author?: string) => void;
  resolveComment: (commentId: string) => void;
  deleteComment: (commentId: string) => void;
  setActiveComment: (commentId: string | null) => void;
  getCommentsForBlock: (blockId: string) => Comment[];
}

export const useCommentsStore = create<CommentsState>()(
  persist(
    (set, get) => ({
      comments: [],
      activeCommentId: null,

      addComment: (blockId, text, author = 'You') => {
        const newComment: Comment = {
          id: crypto.randomUUID(),
          blockId,
          text,
          author,
          createdAt: new Date(),
          resolved: false,
          replies: [],
        };
        set((state) => ({ comments: [...state.comments, newComment] }));
      },

      addReply: (commentId, text, author = 'You') => {
        const newReply: Reply = {
          id: crypto.randomUUID(),
          text,
          author,
          createdAt: new Date(),
        };
        set((state) => ({
          comments: state.comments.map((c) =>
            c.id === commentId ? { ...c, replies: [...c.replies, newReply] } : c
          ),
        }));
      },

      resolveComment: (commentId) => {
        set((state) => ({
          comments: state.comments.map((c) =>
            c.id === commentId ? { ...c, resolved: true } : c
          ),
        }));
      },

      deleteComment: (commentId) => {
        set((state) => ({
          comments: state.comments.filter((c) => c.id !== commentId),
        }));
      },

      setActiveComment: (commentId) => {
        set({ activeCommentId: commentId });
      },

      getCommentsForBlock: (blockId) => {
        return get().comments.filter((c) => c.blockId === blockId);
      },
    }),
    {
      name: 'md-viewer-comments',
    }
  )
);
