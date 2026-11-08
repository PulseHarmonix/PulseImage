import { create } from 'zustand'

interface StemsStore {
  assetId: string | null
  open: boolean
  openStems: (assetId: string) => void
  closeStems: () => void
}

export const useStemsStore = create<StemsStore>((set) => ({
  assetId: null,
  open: false,
  openStems: (assetId) => set({ assetId, open: true }),
  closeStems: () => set({ open: false }),
}))
