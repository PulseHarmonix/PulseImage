import { create } from 'zustand'

export interface ConfirmOptions {
  title: string
  description?: string
  confirmLabel?: string
  cancelLabel?: string
  tone?: 'default' | 'danger'
}

interface ConfirmStore {
  open: boolean
  options: ConfirmOptions | null
  resolve: ((value: boolean) => void) | null
  request: (options: ConfirmOptions) => Promise<boolean>
  respond: (value: boolean) => void
}

export const useConfirmStore = create<ConfirmStore>()((set, get) => ({
  open: false,
  options: null,
  resolve: null,
  request: (options) =>
    new Promise<boolean>((resolve) => {
      get().resolve?.(false)
      set({ open: true, options, resolve })
    }),
  respond: (value) => {
    const resolve = get().resolve
    set({ open: false, options: null, resolve: null })
    resolve?.(value)
  },
}))

export function confirmAction(options: ConfirmOptions): Promise<boolean> {
  return useConfirmStore.getState().request(options)
}
