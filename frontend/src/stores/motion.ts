import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type MotionModelChoice = 'global' | 'ltx23' | 'ltx25' | 'fasth3'

interface MotionStore {
  presetId: string
  modelMode: MotionModelChoice
  duration: number
  resolution: string
  aspect: string
  upscale: boolean | null
  sourceAssetId: string | null
  setPreset: (id: string) => void
  setModelMode: (mode: MotionModelChoice) => void
  setDuration: (duration: number) => void
  setResolution: (resolution: string) => void
  setAspect: (aspect: string) => void
  setUpscale: (upscale: boolean | null) => void
  setSourceAssetId: (id: string | null) => void
}

export const useMotionStore = create<MotionStore>()(
  persist(
    (set) => ({
      presetId: 'push-in',
      modelMode: 'global',
      duration: 6,
      resolution: '720p',
      aspect: '16:9',
      upscale: null,
      sourceAssetId: null,
      setPreset: (id) => set({ presetId: id }),
      setModelMode: (mode) => set({ modelMode: mode }),
      setDuration: (duration) => set({ duration }),
      setResolution: (resolution) => set({ resolution }),
      setAspect: (aspect) => set({ aspect }),
      setUpscale: (upscale) => set({ upscale }),
      setSourceAssetId: (id) => set({ sourceAssetId: id }),
    }),
    {
      name: 'pulse.motion.v1',
    },
  ),
)
