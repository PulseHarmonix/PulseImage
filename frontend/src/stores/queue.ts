import { create } from 'zustand'
import type { QueueJob } from '../types'

interface QueueStore {
  jobs: QueueJob[]
  add: (job: QueueJob) => void
  update: (id: string, updates: Partial<QueueJob>) => void
  remove: (id: string) => void
  clearFinished: () => void
}

export const useQueueStore = create<QueueStore>((set) => ({
  jobs: [],
  add: (job) => set((state) => ({ jobs: [job, ...state.jobs].slice(0, 50) })),
  update: (id, updates) =>
    set((state) => ({
      jobs: state.jobs.map((job) => (job.id === id ? { ...job, ...updates } : job)),
    })),
  remove: (id) => set((state) => ({ jobs: state.jobs.filter((job) => job.id !== id) })),
  clearFinished: () =>
    set((state) => ({
      jobs: state.jobs.filter((job) => job.status === 'queued' || job.status === 'running'),
    })),
}))
