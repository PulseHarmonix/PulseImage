import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { ToastMessage } from '../types'
import { uid } from '../lib/utils'

interface UiStore {
  sidebarCollapsed: boolean
  mobileSidebarOpen: boolean
  queueOpen: boolean
  composerOpen: boolean
  composerPromptHeight: number
  inspectorId: string | null
  toasts: ToastMessage[]
  toggleSidebar: () => void
  setMobileSidebar: (open: boolean) => void
  setQueueOpen: (open: boolean) => void
  setComposerOpen: (open: boolean) => void
  setComposerPromptHeight: (height: number) => void
  openInspector: (id: string | null) => void
  toast: (toast: Omit<ToastMessage, 'id'>) => void
  dismissToast: (id: string) => void
}

export const useUiStore = create<UiStore>()(
  persist(
    (set) => ({
      sidebarCollapsed: false,
      mobileSidebarOpen: false,
      queueOpen: false,
      composerOpen: true,
      composerPromptHeight: 30,
      inspectorId: null,
      toasts: [],
      toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
      setMobileSidebar: (open) => set({ mobileSidebarOpen: open }),
      setQueueOpen: (open) => set({ queueOpen: open }),
      setComposerOpen: (open) => set({ composerOpen: open }),
      setComposerPromptHeight: (height) => set({ composerPromptHeight: height }),
      openInspector: (id) => set({ inspectorId: id }),
      toast: (toast) =>
        set((state) => ({
          toasts: [...state.toasts, { ...toast, id: uid('toast') }].slice(-4),
        })),
      dismissToast: (id) =>
        set((state) => ({ toasts: state.toasts.filter((toast) => toast.id !== id) })),
    }),
    {
      name: 'pulse.ui.v2',
      partialize: (state) => ({
        sidebarCollapsed: state.sidebarCollapsed,
        composerPromptHeight: state.composerPromptHeight,
      }),
    },
  ),
)
