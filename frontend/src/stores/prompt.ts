import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Attachment, AudioMode, PromptMode, PromptTab, SpeechConfig } from '../types'
import { uid } from '../lib/utils'
import { defaultRecastSettings } from '../lib/recast'

export function defaultSpeechConfig(engine = 'qwen3'): SpeechConfig {
  return {
    engine,
    language: 'English',
    emotion: 'neutral',
    instruction: '',
    seed: 0,
    ref_text: '',
  }
}

export function createPromptTab(index = 1, overrides: Partial<PromptTab> = {}): PromptTab {
  return {
    id: uid('tab'),
    label: `Tab ${index}`,
    prompt: '',
    mode: 'image',
    imageModel: 'schnell',
    i2iModel: 'klein',
    videoModel: 'ltx',
    ltxVersion: '2.3',
    fasth3Mode: 'reference',
    resolution: '720p',
    aspect: '16:9',
    duration: 6,
    enhancer: 'none',
    upscale: null,
    audio: 'auto' as AudioMode,
    attachments: [],
    speech: defaultSpeechConfig(),
    recastSettings: defaultRecastSettings(),
    ...overrides,
  }
}

const firstTab = createPromptTab(1)

function renumberTabs(tabs: PromptTab[]): PromptTab[] {
  return tabs.map((tab, index) => ({ ...tab, label: `Tab ${index + 1}` }))
}

interface PromptStore {
  tabs: PromptTab[]
  activeId: string
  setActive: (id: string) => void
  updateActive: (updates: Partial<PromptTab>) => void
  updateTab: (id: string, updates: Partial<PromptTab>) => void
  setPrompt: (prompt: string) => void
  addTab: () => void
  closeTab: (id: string) => void
  setMode: (mode: PromptMode) => void
  addAttachment: (attachment: Attachment) => void
  removeAttachment: (index: number) => void
  clearAttachments: () => void
  setSpeech: (updates: Partial<SpeechConfig>) => void
  hydrateDefaults: (defaults: Partial<PromptTab>) => void
  activeTab: () => PromptTab
}

export const usePromptStore = create<PromptStore>()(
  persist(
    (set, get) => ({
      tabs: [firstTab],
      activeId: firstTab.id,
      activeTab: () => get().tabs.find((tab) => tab.id === get().activeId) ?? get().tabs[0],
      setActive: (id) => set({ activeId: id }),
      updateActive: (updates) =>
        set((state) => ({
          tabs: state.tabs.map((tab) =>
            tab.id === state.activeId ? { ...tab, ...updates } : tab,
          ),
        })),
      updateTab: (id, updates) =>
        set((state) => ({
          tabs: state.tabs.map((tab) => (tab.id === id ? { ...tab, ...updates } : tab)),
        })),
      setPrompt: (prompt) => get().updateActive({ prompt }),
      addTab: () =>
        set((state) => {
          const tab = createPromptTab(state.tabs.length + 1, {
            ...state.tabs.find((t) => t.id === state.activeId),
            id: uid('tab'),
            label: `Tab ${state.tabs.length + 1}`,
            prompt: '',
            attachments: [],
          })
          return { tabs: renumberTabs([...state.tabs, tab]), activeId: tab.id }
        }),
      closeTab: (id) =>
        set((state) => {
          if (state.tabs.length === 1) return state
          const index = state.tabs.findIndex((tab) => tab.id === id)
          const next = state.tabs.filter((tab) => tab.id !== id)
          const activeId =
            state.activeId === id
              ? next[Math.min(index, next.length - 1)]?.id ?? next[0].id
              : state.activeId
          return { tabs: renumberTabs(next), activeId }
        }),
      setMode: (mode) => get().updateActive({ mode }),
      addAttachment: (attachment) => {
        const current = get().activeTab()
        const filtered =
          attachment.type === 'voice'
            ? current.attachments.filter((item) => item.type !== 'voice')
            : current.attachments
        get().updateActive({ attachments: [...filtered, attachment] })
      },
      removeAttachment: (index) => {
        const current = get().activeTab()
        get().updateActive({ attachments: current.attachments.filter((_, i) => i !== index) })
      },
      clearAttachments: () => get().updateActive({ attachments: [] }),
      setSpeech: (updates) => {
        const current = get().activeTab()
        get().updateActive({ speech: { ...current.speech, ...updates } })
      },
      hydrateDefaults: (defaults) => {
        const current = get().activeTab()
        const patch: Partial<PromptTab> = {}
        if (defaults.imageModel && current.imageModel === 'schnell') patch.imageModel = defaults.imageModel
        if (defaults.i2iModel && current.i2iModel === 'klein') patch.i2iModel = defaults.i2iModel
        if (defaults.videoModel && current.videoModel === 'ltx') patch.videoModel = defaults.videoModel
        if (defaults.ltxVersion && current.ltxVersion === '2.3') patch.ltxVersion = defaults.ltxVersion
        if (defaults.fasth3Mode && current.fasth3Mode === 'reference') patch.fasth3Mode = defaults.fasth3Mode
        if (defaults.speech?.engine && current.speech.engine === 'qwen3') {
          patch.speech = { ...current.speech, engine: defaults.speech.engine }
        }
        if (Object.keys(patch).length) get().updateActive(patch)
      },
    }),
    {
      name: 'pulse.promptTabs.v2',
      version: 1,
    },
  ),
)
