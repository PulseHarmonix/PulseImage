import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface MusicGeneratorValues {
  title: string
  style: string
  lyrics: string
  instrumental: boolean
  planning: 'full' | 'melody' | 'off'
  maxDuration: number
  acousticSteps: number
  maxScoreTokens: number
  seed: number
  randomizeSeed: boolean
  advanced: boolean
  temperature: number
  topP: number
  topK: number
  repetitionPenalty: number
  guidance: number
  tileFrames: number
  downloadMissing: boolean
  coverAssetId: string
}

interface MusicGeneratorStore {
  values: MusicGeneratorValues
  update: (updates: Partial<MusicGeneratorValues>) => void
}

const defaults: MusicGeneratorValues = {
  title: '',
  style: '',
  lyrics: '',
  instrumental: false,
  planning: 'full',
  maxDuration: 600,
  acousticSteps: 32,
  maxScoreTokens: 8192,
  seed: 831001,
  randomizeSeed: false,
  advanced: false,
  temperature: 1,
  topP: 0.95,
  topK: 100,
  repetitionPenalty: 1.2,
  guidance: 1,
  tileFrames: 1024,
  downloadMissing: true,
  coverAssetId: '',
}

export const useMusicGeneratorStore = create<MusicGeneratorStore>()(
  persist(
    (set) => ({
      values: defaults,
      update: (updates) =>
        set((state) => ({ values: { ...state.values, ...updates } })),
    }),
    {
      name: 'pulse.musicGenerator.v1',
      version: 2,
      migrate: (persisted, version) => {
        const state = persisted as { values?: Partial<MusicGeneratorValues> }
        if (version < 2 && state.values?.maxScoreTokens === 4096) {
          return {
            ...state,
            values: { ...state.values, maxScoreTokens: 8192 },
          }
        }
        return state
      },
      merge: (persisted, current) => ({
        ...current,
        values: {
          ...defaults,
          ...((persisted as { values?: Partial<MusicGeneratorValues> })?.values ?? {}),
        },
      }),
    },
  ),
)
