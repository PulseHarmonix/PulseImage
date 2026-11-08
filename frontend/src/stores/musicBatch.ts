import { create } from 'zustand'

export interface MusicBatch {
  id: string
  projectId: string
  label: string
  mode: 'all' | 'missing'
  total: number
  done: number
  currentLabel: string
  cancelled: boolean
}

interface MusicBatchStore {
  batch: MusicBatch | null
  start: (batch: MusicBatch) => void
  update: (updater: (batch: MusicBatch) => MusicBatch) => void
  requestCancel: () => void
  clear: (id: string) => void
}

export const useMusicBatchStore = create<MusicBatchStore>()((set) => ({
  batch: null,
  start: (batch) => set({ batch }),
  update: (updater) =>
    set((state) => ({ batch: state.batch ? updater(state.batch) : null })),
  requestCancel: () =>
    set((state) => ({
      batch: state.batch ? { ...state.batch, cancelled: true } : null,
    })),
  clear: (id) =>
    set((state) => ({
      batch: state.batch?.id === id ? null : state.batch,
    })),
}))
