import { create } from 'zustand'
import type { QueueJob } from '../types'

interface QueueStore {
  jobs: QueueJob[]
  add: (job: QueueJob) => void
  update: (id: string, updates: Partial<QueueJob>) => void
  remove: (id: string) => void
  clearFinished: () => void
  syncExternal: (jobs: QueueJob[]) => void
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
  syncExternal: (externalJobs) =>
    set((state) => {
      const serverIds = new Set(externalJobs.map((job) => job.id))
      const jobs = new Map(
        state.jobs
          .filter((job) => !job.external || serverIds.has(job.id))
          .map((job) => [job.id, job]),
      )
      for (const job of externalJobs) {
        const current = jobs.get(job.id)
        if (current && !current.external) continue
        jobs.set(job.id, { ...job, external: true })
      }
      return {
        jobs: [...jobs.values()]
          .sort((a, b) => b.startedAt - a.startedAt)
          .slice(0, 50),
      }
    }),
}))
