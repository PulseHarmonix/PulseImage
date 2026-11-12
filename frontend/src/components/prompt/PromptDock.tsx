import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import { useQueryClient } from '@tanstack/react-query'
import {
  ArrowUp,
  ChevronDown,
  ChevronUp,
  CircleQuestionMark,
  Image as ImageIcon,
  Loader2,
  Mic2,
  Paperclip,
  Plus,
  Settings2,
  SlidersHorizontal,
  Sparkles,
  Video,
  WandSparkles,
  X,
  Zap,
} from 'lucide-react'
import { usePromptStore } from '../../stores/prompt'
import { useQueueStore } from '../../stores/queue'
import { useUiStore } from '../../stores/ui'
import { useHistory, useRelayCapabilities, queryKeys, useSettings, useTtsEngines, useUpdateSettings } from '../../lib/queries'
import { apiGet, apiUpload } from '../../lib/api'
import { assetDisplayName, PULSE_ATTACH_EVENT, type AssetDragPayload } from '../../lib/assets'
import { runGeneration } from '../../lib/generation'
import { runSerializedGeneration } from '../../lib/generationQueue'
import { upscaleEngineLabel, upscaleFactor } from '../../lib/upscale'
import { BASE_VIDEO_RESOLUTIONS, LTX_VIDEO_RESOLUTIONS, videoResolutionsFor } from '../../lib/videoResolutions'
import {
  RECAST_ENGINE_OPTIONS,
  RECAST_MAX_DURATION,
  RECAST_PRESERVE_OPTIONS,
  RECAST_REFERENCE_FIT_OPTIONS,
  RECAST_SOURCE_CONTROL_OPTIONS,
  isRecastActive,
  recastEngineForTab,
  recastEngineLabel,
  recastModelPatch,
  recastSettingsOf,
} from '../../lib/recast'
import type { Attachment, PromptMode, PromptTab, RecastEngine, RecastSettings } from '../../types'
import { cn, formatDuration, titleFromPrompt } from '../../lib/utils'
import { mediaUrl } from '../../lib/api'
import {
  Badge,
  Button,
  Dropdown,
  DropdownContent,
  DropdownItem,
  DropdownTrigger,
  IconButton,
  Input,
  Select,
  Textarea,
} from '../ui'
import { useLocation } from 'react-router-dom'
import {
  buildH3AutoPrompt,
  buildLtxAutoPrompt,
  initH3StateFromAttachments,
  initLtxStateFromAttachments,
} from '../../lib/promptBuilders'
import { H3AutoPromptDialog } from './H3AutoPromptDialog'
import { LtxAutoPromptDialog } from './LtxAutoPromptDialog'
import { PromptHelpDialog } from './PromptHelpDialog'
import { SpeechSetupDialog } from './SpeechSetupDialog'

const modeOptions: { mode: PromptMode; label: string; icon: typeof ImageIcon }[] = [
  { mode: 'image', label: 'Image', icon: ImageIcon },
  { mode: 'video', label: 'Video', icon: Video },
  { mode: 'speech', label: 'Speech', icon: Mic2 },
]

const imageModels = [
  { value: 'schnell', label: 'Flux Schnell', canEdit: false },
  { value: 'klein', label: 'Flux 2 Klein', canEdit: true },
  { value: 'qwen', label: 'Qwen 2.5 2512', canEdit: false },
  { value: 'grok', label: 'Grok Imagine', canEdit: true },
  { value: 'grok-quality', label: 'Grok Quality', canEdit: true },
  { value: 'flux2', label: 'Flux 2', canEdit: true, editOnly: true },
]

const videoModels = [
  { value: 'ltx-2.3', label: 'LTX 2.3' },
  { value: 'ltx-2.5', label: 'LTX 2.5' },
  { value: 'fasth3', label: 'FastH3' },
  { value: 'grok', label: 'Grok Imagine' },
]

const aspects = ['16:9', '9:16', '1:1', '3:2', '2:3']
const durations = [1, 6, 10, 15, 20, 30, 40, 50, 60]

function readVideoDuration(file: File): Promise<number | undefined> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file)
    const video = document.createElement('video')
    const finish = (value?: number) => {
      URL.revokeObjectURL(url)
      resolve(value)
    }
    video.preload = 'metadata'
    video.onloadedmetadata = () =>
      finish(Number.isFinite(video.duration) ? video.duration : undefined)
    video.onerror = () => finish(undefined)
    video.src = url
  })
}

function roundDuration(value: number): number {
  return Math.round(value * 10) / 10
}

function attachmentCounts(tab: PromptTab) {
  return {
    images: tab.attachments.filter((item) => item.type === 'image').length,
    videos: tab.attachments.filter((item) => item.type === 'video').length,
    audios: tab.attachments.filter((item) => item.type === 'audio').length,
  }
}

function attachmentRejectionReason(tab: PromptTab, type: Attachment['type']): string | null {
  if (type === 'voice') {
    return tab.mode === 'speech' && !tab.attachments.some((item) => item.type === 'voice')
      ? null
      : 'Only one marked Voice can be attached in Speech mode.'
  }

  const { images, videos, audios } = attachmentCounts(tab)
  const hasVideo = videos > 0
  const hasLora = tab.attachments.some((item) => item.type === 'lora')
  const isVideo = tab.mode === 'video'
  const isFastH3 = isVideo && tab.videoModel === 'fasth3'
  const isFastH3FirstFrame = isFastH3 && tab.fasth3Mode === 'i2v'
  const isLtx = isVideo && tab.videoModel === 'ltx'
  const isGrok = isVideo && tab.videoModel === 'grok'
  const loraReason = 'LoRA can only be added on an empty prompt.'
  const recastReason = 'Recast does not support Grok. Choose FastH3 or an LTX engine.'

  if (type === 'video') {
    if (!isVideo) return 'Source videos are only supported in Video mode.'
    if (isGrok) return recastReason
    if (!isFastH3 && !isLtx) return 'Source videos require FastH3 or LTX.'
    if (hasLora) return loraReason
    return hasVideo ? 'Only one source video is supported.' : null
  }

  if (tab.mode === 'speech') return 'That attachment is not compatible with the current prompt setup.'
  if (type === 'audio' && tab.mode !== 'video') {
    return 'Audio attachments are only supported in Video mode.'
  }
  if (type === 'lora' && tab.mode !== 'image') {
    return 'LoRA is only supported for image generation.'
  }

  if (type === 'lora') return tab.attachments.length === 0 ? null : loraReason

  if (type === 'image') {
    if (hasLora) return loraReason
    if (hasVideo) {
      if (isGrok) return recastReason
      return images < 6 ? null : 'Recast supports up to 6 images (one starting image plus references).'
    }
    if (isFastH3FirstFrame) {
      return images < 1 ? null : 'FastH3 First-frame mode accepts one image and no audio.'
    }
    if (isGrok) return images < 1 ? null : 'Grok video accepts one image and no audio.'
    if (isLtx) return images < 1 ? null : 'LTX supports one source image.'
    if (isFastH3) return images < 6 ? null : 'FastH3 supports up to 6 reference images.'
    return audios === 0 && images < 2
      ? null
      : 'That attachment is not compatible with the current prompt setup.'
  }

  if (type === 'audio') {
    if (hasVideo) return 'Source audio is controlled by the Recast setting.'
    if (hasLora) return loraReason
    if (isGrok) return 'Grok video accepts one image and no audio.'
    if (isFastH3FirstFrame) return 'FastH3 First-frame mode accepts one image and no audio.'
    if (isLtx) {
      if (images === 0) return 'LTX audio-to-video needs one source image first.'
      return audios < 1 ? null : 'LTX supports one audio reference.'
    }
    if (isFastH3) return audios < 3 ? null : 'FastH3 supports up to 3 reference audios.'
    return audios === 0 ? null : 'Only one audio reference is supported.'
  }
  return null
}

function videoSetupIssue(tab: PromptTab): string | null {
  const { images, videos, audios } = attachmentCounts(tab)
  const hasVoice = tab.attachments.some((item) => item.type === 'voice')
  const hasLora = tab.attachments.some((item) => item.type === 'lora')

  if (tab.mode === 'image') {
    if (videos > 0) return 'Source videos are only supported in Video mode.'
    if (audios > 0) return 'Audio attachments are only supported in Video mode.'
    if (hasVoice) return 'Voice attachments are only supported in Speech mode.'
    return null
  }

  if (tab.mode === 'speech') {
    const invalid = tab.attachments.some((item) => item.type !== 'voice')
    return invalid ? 'Speech mode only supports one Voice attachment.' : null
  }

  if (hasVoice) return 'Voice attachments are only supported in Speech mode.'
  if (hasLora) return 'LoRA is only supported for image generation.'
  if (videos > 1) return 'Only one source video is supported.'

  if (videos > 0) {
    if (tab.videoModel !== 'fasth3' && tab.videoModel !== 'ltx') {
      return 'Recast does not support Grok. Choose FastH3 or an LTX engine.'
    }
    if (images === 0) return 'Add a starting image to use Recast.'
    if (images > 6) return 'Recast supports up to 6 images (one starting image plus references).'
    return null
  }

  if (tab.videoModel === 'fasth3') {
    if (tab.fasth3Mode === 'i2v') {
      return images > 1 || audios > 0
        ? 'FastH3 First-frame mode accepts one image and no audio.'
        : null
    }
    if (images > 6) return 'FastH3 supports up to 6 reference images.'
    if (audios > 3) return 'FastH3 supports up to 3 reference audios.'
    return null
  }

  if (tab.videoModel === 'grok') {
    return images > 1 || audios > 0 ? 'Grok video accepts one image and no audio.' : null
  }

  if (tab.videoModel === 'ltx') {
    if (images > 1) return 'LTX supports one source image.'
    if (audios > 1) return 'LTX supports one audio reference.'
    if (audios > 0 && images === 0) return 'LTX audio-to-video needs one source image first.'
    return null
  }

  return null
}

function labelledAttachments(attachments: Attachment[], recast = false) {
  let imageIndex = 0
  let videoIndex = 0
  let audioIndex = 0
  return attachments.map((attachment) => {
    let label = attachment.name
    if (attachment.type === 'video') {
      videoIndex += 1
      label = recast ? 'Motion source' : `Video ${videoIndex}`
    } else if (attachment.type === 'image') {
      imageIndex += 1
      label = recast
        ? imageIndex === 1
          ? 'Starting character'
          : `Character ref ${imageIndex - 1}`
        : `Image ${imageIndex}`
    } else if (attachment.type === 'audio') {
      audioIndex += 1
      label = `Audio ${audioIndex}`
    } else if (attachment.type === 'voice') {
      label = 'Voice'
    }
    return { attachment, label }
  })
}

export function PromptDock() {
  const location = useLocation()
  const settings = useSettings()
  const engines = useTtsEngines()
  const history = useHistory()
  const relay = useRelayCapabilities()
  const queryClient = useQueryClient()
  const tabs = usePromptStore((s) => s.tabs)
  const activeId = usePromptStore((s) => s.activeId)
  const setActive = usePromptStore((s) => s.setActive)
  const addTab = usePromptStore((s) => s.addTab)
  const closeTab = usePromptStore((s) => s.closeTab)
  const updateActive = usePromptStore((s) => s.updateActive)
  const setMode = usePromptStore((s) => s.setMode)
  const addAttachment = usePromptStore((s) => s.addAttachment)
  const removeAttachment = usePromptStore((s) => s.removeAttachment)
  const hydrateDefaults = usePromptStore((s) => s.hydrateDefaults)
  const addQueue = useQueueStore((s) => s.add)
  const updateQueue = useQueueStore((s) => s.update)
  const sidebarCollapsed = useUiStore((s) => s.sidebarCollapsed)
  const composerOpen = useUiStore((s) => s.composerOpen)
  const setComposerOpen = useUiStore((s) => s.setComposerOpen)
  const composerPromptHeight = useUiStore((s) => s.composerPromptHeight)
  const setComposerPromptHeight = useUiStore((s) => s.setComposerPromptHeight)
  const toast = useUiStore((s) => s.toast)
  const updateSettings = useUpdateSettings()
  const fileInput = useRef<HTMLInputElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (!composerOpen) return
    const timer = window.setTimeout(() => inputRef.current?.focus(), 60)
    return () => window.clearTimeout(timer)
  }, [composerOpen])
  const pendingRef = useRef<PromptTab[]>([])
  const runningRef = useRef(false)
  const [busy, setBusy] = useState(false)
  const [advanced, setAdvanced] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [loras, setLoras] = useState<string[]>([])
  const [dragOver, setDragOver] = useState(false)
  const [promptHeight, setPromptHeight] = useState(composerPromptHeight)
  const [resizingPrompt, setResizingPrompt] = useState(false)
  const promptHeightRef = useRef(promptHeight)
  const resizeDragRef = useRef<{ startY: number; startHeight: number } | null>(null)

  useEffect(() => {
    promptHeightRef.current = promptHeight
  }, [promptHeight])

  const clampPromptHeight = useCallback((value: number) => {
    const max = Math.round(window.innerHeight * 0.6)
    return Math.max(30, Math.min(value, max))
  }, [])

  useEffect(() => {
    if (resizeDragRef.current) return
    const next = clampPromptHeight(composerPromptHeight)
    setPromptHeight(next)
    promptHeightRef.current = next
  }, [composerPromptHeight, clampPromptHeight])

  useEffect(() => {
    const handleResize = () => {
      const next = clampPromptHeight(promptHeightRef.current)
      if (next === promptHeightRef.current) return
      promptHeightRef.current = next
      setPromptHeight(next)
      if (!resizeDragRef.current) setComposerPromptHeight(next)
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [clampPromptHeight, setComposerPromptHeight])

  useEffect(() => {
    const root = document.documentElement
    if (!composerOpen) {
      root.style.removeProperty('--composer-extra-height')
      return
    }
    root.style.setProperty('--composer-extra-height', `${Math.max(0, promptHeight - 30)}px`)
    return () => {
      root.style.removeProperty('--composer-extra-height')
    }
  }, [composerOpen, promptHeight])

  const handleResizePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.preventDefault()
    resizeDragRef.current = { startY: event.clientY, startHeight: promptHeightRef.current }
    setResizingPrompt(true)
    event.currentTarget.setPointerCapture(event.pointerId)
    event.currentTarget.focus()
  }

  const handleResizePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = resizeDragRef.current
    if (!drag) return
    const next = clampPromptHeight(drag.startHeight + (drag.startY - event.clientY))
    promptHeightRef.current = next
    setPromptHeight(next)
  }

  const finishResize = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!resizeDragRef.current) return
    resizeDragRef.current = null
    setResizingPrompt(false)
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    setComposerPromptHeight(promptHeightRef.current)
  }

  const handleResizeKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    let next: number | null = null
    if (event.key === 'ArrowUp') next = promptHeightRef.current + 16
    else if (event.key === 'ArrowDown') next = promptHeightRef.current - 16
    else if (event.key === 'Home') next = 30
    if (next === null) return
    event.preventDefault()
    const clamped = clampPromptHeight(next)
    promptHeightRef.current = clamped
    setPromptHeight(clamped)
    setComposerPromptHeight(clamped)
  }

  useEffect(() => {
    void apiGet<{ loras?: string[] }>('/loras')
      .then((result) => setLoras(result.loras ?? []))
      .catch(() => setLoras([]))
  }, [])

  const addAssetAttachment = useCallback(
    (attachment: Attachment) => {
      const state = usePromptStore.getState()
      const current = state.tabs.find((item) => item.id === state.activeId) ?? state.tabs[0]
      if (!current) return false
      if (attachment.type === 'image' && current.mode === 'image') {
        const hasImage = current.attachments.some((item) => item.type === 'image')
        const modelValue = hasImage ? current.i2iModel : current.imageModel
        const model = imageModels.find((item) => item.value === modelValue)
        if (!model?.canEdit) {
          toast({
            title: 'Image editing not supported',
            description: `${model?.label ?? modelValue} is text-to-image only. Choose Flux 2 Klein, Flux 2, Grok Imagine, or Grok Quality before attaching an image.`,
            tone: 'error',
          })
          return false
        }
        if (!hasImage) {
          usePromptStore.getState().updateActive({ i2iModel: modelValue })
        }
      }
      const rejection = attachmentRejectionReason(current, attachment.type)
      if (rejection) {
        toast({
          title: 'Cannot add attachment',
          description: rejection,
          tone: 'error',
        })
        return false
      }
      if (attachment.type === 'video') {
        const engine = recastEngineForTab(current)
        const cap = engine ? RECAST_MAX_DURATION[engine] : 60
        const rest = current.attachments.filter(
          (item) => item.type !== 'video' && item.type !== 'audio',
        )
        const patch: Partial<PromptTab> = { attachments: [...rest, attachment] }
        if (attachment.duration && Number.isFinite(attachment.duration)) {
          patch.duration = roundDuration(
            Math.min(Math.max(1, attachment.duration), cap),
          )
        }
        state.updateActive(patch)
      } else {
        addAttachment(attachment)
      }
      return true
    },
    [addAttachment, toast],
  )

  useEffect(() => {
    const attach = (event: Event) => {
      const detail = (event as CustomEvent<Attachment>).detail
      if (!detail?.name) return
      const state = usePromptStore.getState()
      const current = state.tabs.find((item) => item.id === state.activeId) ?? state.tabs[0]
      let type = detail.type
      if (current?.mode === 'speech' && type === 'audio') {
        if (!detail.voice) {
          toast({
            title: 'Voice required',
            description: 'Mark this audio as a Voice first (mic icon in the Library).',
            tone: 'error',
          })
          return
        }
        type = 'voice'
      }
      addAssetAttachment({ ...detail, type })
    }
    window.addEventListener(PULSE_ATTACH_EVENT, attach)
    return () => window.removeEventListener(PULSE_ATTACH_EVENT, attach)
  }, [addAssetAttachment, toast])
  const [h3Open, setH3Open] = useState(false)
  const [ltxOpen, setLtxOpen] = useState(false)
  const [speechOpen, setSpeechOpen] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)

  const tab = tabs.find((item) => item.id === activeId) ?? tabs[0]
  const hasImageAttachment = tab.attachments.some((item) => item.type === 'image')
  const activeImageModelValue = hasImageAttachment ? tab.i2iModel : tab.imageModel
  const activeImageModel = imageModels.find((model) => model.value === activeImageModelValue)
  const isFastH3 = tab.mode === 'video' && tab.videoModel === 'fasth3'
  const isLtx = tab.mode === 'video' && tab.videoModel === 'ltx'
  const autoPromptEnabled = isFastH3 ? Boolean(tab.h3?.enabled) : isLtx ? Boolean(tab.ltx?.enabled) : false
  const resolutionChoices = isLtx ? LTX_VIDEO_RESOLUTIONS : BASE_VIDEO_RESOLUTIONS
  const videoAttachment = tab.attachments.find((item) => item.type === 'video')
  const [probedSourceDuration, setProbedSourceDuration] = useState<number | null>(null)
  const sourceVideoDuration = videoAttachment?.duration ?? probedSourceDuration ?? undefined
  const recastEngine = recastEngineForTab(tab)
  const recastActive = isRecastActive(tab)
  const recastSettings = recastSettingsOf(tab)
  const recastCap = recastEngine ? RECAST_MAX_DURATION[recastEngine] : 60
  const recastDurationWarning =
    sourceVideoDuration && recastEngine && sourceVideoDuration > recastCap
      ? `Motion source is ${formatDuration(sourceVideoDuration)}; ${recastEngineLabel(recastEngine)} caps Recast at ${recastCap}s.`
      : null
  const sourceDurationFits = Boolean(
    sourceVideoDuration && Number.isFinite(sourceVideoDuration) && sourceVideoDuration <= recastCap,
  )
  const sourceDurationChoice =
    sourceVideoDuration && Number.isFinite(sourceVideoDuration) && sourceVideoDuration > 0
      ? roundDuration(recastActive ? Math.min(sourceVideoDuration, recastCap) : sourceVideoDuration)
      : null
  const durationChoices = (() => {
    const maxDuration = recastActive ? recastCap : Infinity
    const values = new Set(durations.filter((value) => value <= maxDuration))
    if (tab.duration && Number.isFinite(tab.duration) && tab.duration <= maxDuration) {
      values.add(tab.duration)
    }
    if (sourceDurationChoice !== null) {
      values.add(sourceDurationChoice)
    }
    return Array.from(values).sort((a, b) => a - b)
  })()

  useEffect(() => {
    if (!resolutionChoices.includes(tab.resolution)) {
      updateActive({ resolution: '1080p' })
    }
  }, [resolutionChoices, tab.resolution, updateActive])

  useEffect(() => {
    if (!videoAttachment || !recastEngine) return
    if (tab.duration > recastCap) updateActive({ duration: recastCap })
  }, [videoAttachment, recastEngine, recastCap, tab.duration, updateActive])

  useEffect(() => {
    if (!videoAttachment) {
      setProbedSourceDuration(null)
      return
    }
    if (typeof videoAttachment.duration === 'number' && Number.isFinite(videoAttachment.duration)) {
      setProbedSourceDuration(null)
      return
    }
    const src = videoAttachment.src || mediaUrl(`/videos/${videoAttachment.name}`)
    if (!src) return
    let cancelled = false
    const video = document.createElement('video')
    const finish = (duration?: number) => {
      if (!cancelled && typeof duration === 'number' && Number.isFinite(duration) && duration > 0) {
        setProbedSourceDuration(duration)
      }
    }
    video.preload = 'metadata'
    video.onloadedmetadata = () => finish(video.duration)
    video.onerror = () => finish(undefined)
    video.src = src
    return () => {
      cancelled = true
      video.removeAttribute('src')
      video.load()
    }
  }, [videoAttachment?.id, videoAttachment?.name, videoAttachment?.src, videoAttachment?.duration])

  useEffect(() => {
    if (!settings.data) return
    hydrateDefaults({
      imageModel: settings.data.image_model,
      i2iModel: settings.data.i2i_model,
      videoModel: settings.data.video_model,
      ltxVersion: settings.data.ltx_version,
      fasth3Mode: settings.data.fasth3_mode,
      speech: { engine: settings.data.tts_engine || 'qwen3' } as PromptTab['speech'],
    })
  }, [settings.data, hydrateDefaults])

  useEffect(() => {
    const mode = new URLSearchParams(location.search).get('mode') as PromptMode | null
    if (mode && ['image', 'video', 'speech'].includes(mode)) setMode(mode)
  }, [location.search, setMode])

  const voiceOptions = useMemo(
    () => (history.data ?? []).filter((asset) => asset.type === 'audio' && asset.voice),
    [history.data],
  )
  const selectedVoice = tab.attachments.find((a) => a.type === 'voice')
  const enhancerOptions = useMemo(() => {
    const raw = settings.data?.prompt_enhancers
    return Array.isArray(raw)
      ? raw.filter(
          (item): item is { id: string; name?: string } =>
            Boolean(item) && typeof item === 'object' && 'id' in item,
        )
      : []
  }, [settings.data?.prompt_enhancers])

  const videoSelection = tab.videoModel === 'ltx' ? `ltx-${tab.ltxVersion}` : tab.videoModel
  const activeUpscaleSetting = settings.data?.video_upscale
  const activeUpscaleEngineValue =
    activeUpscaleSetting && activeUpscaleSetting !== 'off'
      ? activeUpscaleSetting
      : 'relayvsr_x2'
  const upscaleEngine = upscaleEngineLabel(activeUpscaleEngineValue)
  const upscaleFactorValue = upscaleFactor(activeUpscaleEngineValue)
  const activeUpscaleIsRecavsr = activeUpscaleEngineValue.toLowerCase().includes('recavsr')
  const upscaleAvailable = activeUpscaleIsRecavsr
    ? relay.data?.recavsr
      ? relay.data.recavsr.available && relay.data.recavsr.implemented
      : undefined
    : relay.data?.relayvsr?.available
  const upscaleUnavailable = upscaleAvailable === false
  const upscaleUnavailableReason =
    activeUpscaleIsRecavsr && relay.data?.recavsr && !relay.data.recavsr.implemented
      ? 'integration pending'
      : 'unavailable'
  const effectiveUpscale =
    tab.upscale ?? Boolean(activeUpscaleSetting && activeUpscaleSetting !== 'off')

  const setVideoSelection = (value: string) => {
    const nextModel = value.startsWith('ltx-') ? 'ltx' : value
    if (videoAttachment && nextModel === 'grok') {
      toast({
        title: 'Recast does not support Grok',
        description: 'Remove the source video or choose FastH3 / LTX to use Recast.',
        tone: 'error',
      })
      return
    }
    const resolutionPatch = videoResolutionsFor(nextModel).includes(tab.resolution)
      ? {}
      : { resolution: '1080p' }
    const nextEngine =
      nextModel === 'fasth3' ? 'fasth3' : value === 'ltx-2.5' ? 'ltx25' : 'ltx23'
    const durationPatch = videoAttachment
      ? { duration: Math.min(tab.duration, RECAST_MAX_DURATION[nextEngine]) }
      : {}
    if (value.startsWith('ltx-')) {
      updateActive({ videoModel: 'ltx', ltxVersion: value.slice(4), ...resolutionPatch, ...durationPatch })
      void updateSettings({ video_model: 'ltx', ltx_version: value.slice(4) })
    } else {
      updateActive({ videoModel: value, ...resolutionPatch, ...durationPatch })
      void updateSettings({ video_model: value })
    }
  }

  const updateRecastSettings = (patch: Partial<RecastSettings>) => {
    updateActive({ recastSettings: { ...recastSettings, ...patch } })
  }

  const setRecastEngine = (engine: RecastEngine) => {
    const patch = recastModelPatch(engine)
    updateActive({
      ...patch,
      duration: Math.min(tab.duration, RECAST_MAX_DURATION[engine]),
    })
    if (patch.videoModel === 'ltx') {
      void updateSettings({ video_model: 'ltx', ltx_version: patch.ltxVersion })
    } else {
      void updateSettings({ video_model: patch.videoModel })
    }
  }

  const togglePreserve = (value: string) => {
    const preserve = recastSettings.preserve.includes(value)
      ? recastSettings.preserve.filter((item) => item !== value)
      : [...recastSettings.preserve, value]
    updateRecastSettings({ preserve })
  }

  const toggleAutoPrompt = () => {
    if (isLtx) {
      const state = tab.ltx ?? initLtxStateFromAttachments(tab)
      if (!state.enabled) {
        const next = { ...state, enabled: true }
        updateActive({ ltx: next, prompt: buildLtxAutoPrompt({ ...tab, ltx: next }) })
      } else {
        updateActive({ ltx: { ...state, enabled: false } })
      }
      return
    }
    if (isFastH3) {
      const state = tab.h3 ?? initH3StateFromAttachments(tab)
      if (!state.enabled) {
        const next = { ...state, enabled: true }
        updateActive({ h3: next, prompt: buildH3AutoPrompt({ ...tab, h3: next }) })
      } else {
        updateActive({ h3: { ...state, enabled: false } })
      }
    }
  }

  const setupIssue = videoSetupIssue(tab)
  const canGenerate = Boolean(tab.prompt.trim()) && !setupIssue

  const executeGeneration = async (snapshot: PromptTab) => {
    runningRef.current = true
    setBusy(true)
    try {
      const ids = await runSerializedGeneration(() => runGeneration(snapshot, settings.data, {
        onQueue: (job) => addQueue(job),
        onProgress: (jobId, progressSnapshot) => {
          const progress =
            progressSnapshot.stage === 'upscaling'
              ? Math.max(55, progressSnapshot.workflow_percent ?? 55)
              : progressSnapshot.workflow_percent ?? 0
          updateQueue(jobId, {
            status: progressSnapshot.state === 'error' ? 'error' : 'running',
            progress,
            stage: progressSnapshot.stage,
            error: progressSnapshot.error,
          })
        },
        onComplete: (jobId) => {
          const current = useQueueStore.getState().jobs.find((job) => job.id === jobId)
          if (current?.status === 'error') return
          updateQueue(jobId, {
            status: 'done',
            progress: 100,
            finishedAt: Date.now(),
          })
          void queryClient.invalidateQueries({ queryKey: queryKeys.history })
        },
        onError: (jobId, error) => {
          updateQueue(jobId, {
            status: 'error',
            error,
            finishedAt: Date.now(),
          })
          toast({ title: 'Generation failed', description: error, tone: 'error' })
        },
        onAsset: () => {
          void queryClient.invalidateQueries({ queryKey: queryKeys.history })
        },
      }))
      if (ids.length) {
        toast({
          title: snapshot.mode === 'speech' ? 'Speech saved' : 'Generation saved',
          description: `${ids.length} ${ids.length === 1 ? 'asset' : 'assets'} added to your library.`,
          tone: 'success',
        })
      }
    } catch {
      // runGeneration already reported the error.
    } finally {
      runningRef.current = false
      const next = pendingRef.current.shift()
      if (next) {
        void executeGeneration(next)
      } else {
        setBusy(false)
      }
    }
  }

  const handleGenerate = () => {
    const issue = videoSetupIssue(tab)
    if (issue) {
      toast({ title: 'Cannot generate', description: issue, tone: 'error' })
      return
    }
    if (!canGenerate) return
    const snapshot: PromptTab = {
      ...tab,
      attachments: tab.attachments.map((attachment) => ({ ...attachment })),
      h3: tab.h3 ? JSON.parse(JSON.stringify(tab.h3)) : tab.h3,
      ltx: tab.ltx ? JSON.parse(JSON.stringify(tab.ltx)) : tab.ltx,
    }
    if (runningRef.current) {
      pendingRef.current.push(snapshot)
      toast({ title: 'Added to queue', description: snapshot.prompt.slice(0, 80), tone: 'default' })
      return
    }
    void executeGeneration(snapshot)
  }

  const handleFile = async (file: File) => {
    setUploading(true)
    try {
      const result = await apiUpload(file)
      const name = result.filename
      if (!name) throw new Error('Upload failed')
      const type: Attachment['type'] = file.type.startsWith('video/')
        ? 'video'
        : file.type.startsWith('audio/')
          ? 'audio'
          : 'image'
      const duration = type === 'video' ? await readVideoDuration(file) : undefined
      addAssetAttachment({
        name,
        displayName: file.name,
        type,
        src:
          type === 'video'
            ? `/videos/${name}`
            : type === 'audio'
              ? `/audio/${name}`
              : `/images/${name}`,
        duration,
      })
    } catch (error) {
      toast({
        title: 'Upload failed',
        description: error instanceof Error ? error.message : 'Could not upload file',
        tone: 'error',
      })
    } finally {
      setUploading(false)
      if (fileInput.current) fileInput.current.value = ''
    }
  }

  const attachVoice = (assetId: string) => {
    const asset = voiceOptions.find((item) => item.id === assetId)
    if (!asset) return
    addAttachment({
      id: asset.id,
      name: asset.filename,
      displayName: assetDisplayName(asset),
      type: 'voice',
      prompt: asset.prompt,
    })
  }

  const isAssetDrag = (event: DragEvent<HTMLDivElement>) => {
    const types = Array.from(event.dataTransfer.types)
    if (types.includes('Files')) return false
    return types.includes('application/json') || types.includes('text/plain')
  }

  const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
    if (!isAssetDrag(event)) return
    event.preventDefault()
    event.dataTransfer.dropEffect = 'copy'
    setDragOver(true)
  }

  const handleDragLeave = (event: DragEvent<HTMLDivElement>) => {
    if (!isAssetDrag(event)) return
    if (event.currentTarget.contains(event.relatedTarget as Node | null)) return
    setDragOver(false)
  }

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    if (!isAssetDrag(event)) return
    event.preventDefault()
    setDragOver(false)

    const raw =
      event.dataTransfer.getData('application/json') ||
      event.dataTransfer.getData('text/plain')
    if (!raw) return

    let data: AssetDragPayload
    try {
      data = JSON.parse(raw) as AssetDragPayload
    } catch {
      return
    }
    if (!data?.name || !data.type) return

    const state = usePromptStore.getState()
    const current = state.tabs.find((item) => item.id === state.activeId) ?? state.tabs[0]
    let type: Attachment['type'] = data.type
    if (current?.mode === 'speech' && type === 'audio') {
      if (!data.voice) {
        toast({
          title: 'Voice required',
          description: 'Mark this audio as a Voice first (mic icon in the Library).',
          tone: 'error',
        })
        return
      }
      type = 'voice'
    }

    const added = addAssetAttachment({
      id: data.id,
      name: data.name,
      displayName: data.displayName,
      type,
      src: data.src,
      prompt: data.prompt,
      aspect: data.aspect,
      duration: data.duration,
      voice: data.voice,
    })
    if (added) setComposerOpen(true)
  }


  if (!composerOpen) {
    return (
      <div
        className={cn(
          'fixed inset-x-0 z-[58] md:pl-[264px]',
          sidebarCollapsed && 'md:pl-[76px]',
        )}
        style={{ bottom: 'var(--music-player-height, 0px)' }}
      >
        <div
          className={cn(
            'border-t border-line-strong bg-[#111214]/95 shadow-[0_-16px_50px_rgba(0,0,0,0.35)] backdrop-blur-2xl transition',
            dragOver && 'ring-2 ring-inset ring-lime/50',
          )}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <div className="flex h-14 items-center gap-2 px-2 md:px-4">
            <IconButton
              onClick={() => setComposerOpen(true)}
              aria-label="Open composer"
              title="Open composer"
            >
              <ChevronUp className="size-4" />
            </IconButton>
            <button
              onClick={() => setComposerOpen(true)}
              className="min-w-0 flex-1 text-left"
            >
              <span className="block truncate text-[11px] text-text-3">
                Describe what you want to create…
              </span>
              <span className="block text-[9px] uppercase tracking-[0.14em] text-text-3/70">
                Image · Video · Speech
              </span>
            </button>
            <div className="hidden items-center gap-0.5 sm:flex">
              {modeOptions.map(({ mode, label, icon: Icon }) => (
                <IconButton
                  key={mode}
                  className={cn(
                    'size-7',
                    tab.mode === mode ? 'bg-lime-soft text-lime' : 'text-text-3',
                  )}
                  onClick={() => {
                    setMode(mode)
                    setComposerOpen(true)
                  }}
                  aria-label={`Create ${label.toLowerCase()}`}
                  title={label}
                >
                  <Icon className="size-3.5" />
                </IconButton>
              ))}
            </div>
            <Button
              variant="primary"
              size="sm"
              onClick={() => setComposerOpen(true)}
              aria-label="Open create composer"
            >
              Create
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div
      className={cn(
        'pointer-events-none fixed inset-x-0 z-[58] md:pl-[264px]',
        sidebarCollapsed && 'md:pl-[76px]',
      )}
      style={{ bottom: 'var(--music-player-height, 0px)' }}
    >
      <div
        className={cn(
          'animate-fade-up pointer-events-auto w-full overflow-visible border-t border-line-strong bg-[#111214]/95 shadow-[0_-16px_50px_rgba(0,0,0,0.35)] backdrop-blur-2xl',
          resizingPrompt ? 'transition-none' : 'transition',
          dragOver && 'ring-2 ring-inset ring-lime/50',
        )}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <div
          role="separator"
          aria-orientation="horizontal"
          aria-label="Resize prompt editor"
          tabIndex={0}
          onPointerDown={handleResizePointerDown}
          onPointerMove={handleResizePointerMove}
          onPointerUp={finishResize}
          onPointerCancel={finishResize}
          onKeyDown={handleResizeKeyDown}
          className={cn(
            'group flex h-2.5 cursor-ns-resize touch-none select-none items-center justify-center border-b border-line/60 outline-none transition-colors focus-visible:bg-lime/10',
            resizingPrompt ? 'bg-lime/20' : 'hover:bg-white/[0.04]',
          )}
        >
          <span
            className={cn(
              'h-0.5 w-8 rounded-full transition-colors',
              resizingPrompt ? 'bg-lime' : 'bg-line-strong group-hover:bg-lime/60',
            )}
          />
        </div>
        <div className="flex items-center gap-1 overflow-x-auto border-b border-line px-2 pt-1 no-scrollbar">
          {tabs.map((item) => (
            <button
              key={item.id}
              onClick={() => setActive(item.id)}
              className={cn(
                'group flex shrink-0 items-center gap-1.5 rounded-t-lg px-2 py-1 text-[11px] font-medium transition',
                item.id === activeId ? 'text-text' : 'text-text-3 hover:text-text-2',
              )}
            >
              <span className="max-w-[140px] truncate" title={item.prompt || item.label}>
                {item.label}
              </span>
              {tabs.length > 1 ? (
                <span
                  role="button"
                  tabIndex={0}
                  onClick={(event) => {
                    event.stopPropagation()
                    closeTab(item.id)
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') closeTab(item.id)
                  }}
                  className="rounded p-0.5 opacity-0 transition hover:bg-white/10 group-hover:opacity-100"
                >
                  <X className="size-2.5" />
                </span>
              ) : null}
            </button>
          ))}
          <button
            type="button"
            onClick={addTab}
            aria-label="New prompt tab"
            title="New prompt tab"
            className="ml-1 flex h-6 shrink-0 items-center gap-1 rounded-full border border-line bg-white/[0.035] px-2 text-[10px] font-medium text-text-2 transition hover:border-lime/30 hover:bg-lime-soft hover:text-lime"
          >
            <Plus className="size-3" />
            New tab
          </button>
          <IconButton
            className="ml-auto size-7 shrink-0"
            onClick={() => setComposerOpen(false)}
            aria-label="Collapse composer"
            title="Collapse composer"
          >
            <ChevronDown className="size-3.5" />
          </IconButton>
        </div>

        <div className="flex flex-wrap items-center gap-1 border-b border-line px-2 py-1.5">
          <div className="flex items-center gap-0.5 rounded-full border border-line bg-black/20 p-0.5">
            {modeOptions.map(({ mode, label, icon: Icon }) => (
              <button
                key={mode}
                onClick={() => setMode(mode)}
                className={cn(
                  'flex h-6 items-center gap-1.5 rounded-full px-2 text-[11px] font-medium transition',
                  tab.mode === mode ? 'bg-white text-black' : 'text-text-3 hover:text-text',
                )}
              >
                <Icon className="size-3" />
                {label}
              </button>
            ))}
          </div>

          {recastActive ? (
            <Badge tone="lime">
              <Sparkles className="size-3" />
              Recast
            </Badge>
          ) : null}

          {tab.mode === 'image' ? (
            <Dropdown>
              <DropdownTrigger asChild>
                <button
                  type="button"
                  className="flex h-6 items-center gap-1 rounded-full border border-line bg-white/[0.035] pl-2.5 pr-2 text-[11px] font-medium text-text-2 outline-none transition hover:border-line-strong hover:text-text focus:border-lime/40"
                >
                  <span className="max-w-[132px] truncate">
                    {activeImageModel?.label ?? activeImageModelValue}
                  </span>
                  <ChevronDown className="size-3 text-text-3" />
                </button>
              </DropdownTrigger>
              <DropdownContent>
                {hasImageAttachment ? (
                  <>
                    {imageModels.map((model) => (
                      <DropdownItem
                        key={model.value}
                        active={model.canEdit && tab.i2iModel === model.value}
                        danger={!model.canEdit}
                        disabled={!model.canEdit}
                        onSelect={() => {
                          if (!model.canEdit) return
                          updateActive({ i2iModel: model.value })
                          void updateSettings({ i2i_model: model.value })
                        }}
                      >
                        <span className="flex items-center justify-between gap-3">
                          <span>{model.label}</span>
                          {!model.canEdit ? (
                            <span className="text-[10px] opacity-80">Text-to-image only</span>
                          ) : null}
                        </span>
                      </DropdownItem>
                    ))}
                    <div className="mt-1 border-t border-line px-2.5 pb-1 pt-2 text-[10px] leading-4 text-text-3">
                      Edit with Flux 2 Klein, Flux 2, Grok Imagine, or Grok Quality.
                    </div>
                  </>
                ) : (
                  imageModels
                    .filter((model) => !model.editOnly)
                    .map((model) => (
                      <DropdownItem
                        key={model.value}
                        active={tab.imageModel === model.value}
                        onSelect={() => {
                          updateActive({ imageModel: model.value })
                          void updateSettings({ image_model: model.value })
                        }}
                      >
                        {model.label}
                      </DropdownItem>
                    ))
                )}
              </DropdownContent>
            </Dropdown>
          ) : tab.mode === 'video' ? (
            <Select
              className="h-6 pl-2 pr-6 text-[11px] w-auto min-w-[112px]"
              value={videoSelection}
              onChange={(event) => setVideoSelection(event.target.value)}
            >
              {videoModels.map((model) => (
                <option
                  key={model.value}
                  value={model.value}
                  disabled={Boolean(videoAttachment) && model.value === 'grok'}
                >
                  {model.label}
                </option>
              ))}
            </Select>
          ) : (
            <Select
              className="h-6 pl-2 pr-6 text-[11px] w-auto min-w-[120px]"
              value={tab.speech.engine}
              onChange={(event) => {
                updateActive({ speech: { ...tab.speech, engine: event.target.value } })
                void updateSettings({ tts_engine: event.target.value })
              }}
            >
              {(engines.data ?? []).map((engine) => (
                <option key={engine.id} value={engine.id}>
                  {engine.label}
                </option>
              ))}
            </Select>
          )}

          {tab.mode !== 'speech' ? (
            <>
              <Select
                className="h-6 pl-2 pr-6 text-[11px] w-auto min-w-[76px]"
                value={tab.resolution}
                onChange={(event) => updateActive({ resolution: event.target.value })}
              >
                {resolutionChoices.map((res) => (
                  <option key={res} value={res}>
                    {res}
                  </option>
                ))}
              </Select>
              <Select
                className="h-6 pl-2 pr-6 text-[11px] w-auto min-w-[70px]"
                value={tab.aspect}
                onChange={(event) => updateActive({ aspect: event.target.value })}
              >
                {aspects.map((aspect) => (
                  <option key={aspect} value={aspect}>
                    {aspect}
                  </option>
                ))}
              </Select>
            </>
          ) : null}

          {tab.mode === 'video' ? (
            <Select
              className="h-6 pl-2 pr-6 text-[11px] w-auto min-w-[72px]"
              value={tab.duration}
              onChange={(event) => updateActive({ duration: Number(event.target.value) })}
              title={
                sourceVideoDuration
                  ? `Motion source duration: ${formatDuration(sourceVideoDuration)}`
                  : undefined
              }
            >
              {durationChoices.map((duration) => {
                const isSourceDuration =
                  recastActive &&
                  sourceDurationChoice !== null &&
                  Math.abs(duration - sourceDurationChoice) < 0.01
                const label = isSourceDuration
                  ? sourceDurationFits
                    ? `Same as source (${formatDuration(sourceVideoDuration!)})`
                    : `Source longer ? max ${recastCap}s`
                  : `${duration}s`
                return (
                  <option key={duration} value={duration}>
                    {label}
                  </option>
                )
              })}
            </Select>
          ) : null}

          {tab.mode === 'video' ? (
            <button
              onClick={() => updateActive({ upscale: !effectiveUpscale })}
              disabled={upscaleUnavailable}
              className={cn(
                'flex h-6 items-center gap-1.5 rounded-full border px-2 text-[11px] font-medium transition',
                effectiveUpscale
                  ? 'border-lime/30 bg-lime-soft text-lime'
                  : 'border-line text-text-3',
                upscaleUnavailable
                  ? 'cursor-not-allowed opacity-45'
                  : effectiveUpscale
                    ? ''
                    : 'hover:border-line-strong hover:text-text-2',
              )}
              title={
                upscaleUnavailable
                  ? `${upscaleEngine} ${upscaleUnavailableReason}`
                  : `${upscaleEngine} ${upscaleFactorValue}x upscale ${effectiveUpscale ? 'on' : 'off'}`
              }
            >
              <Zap className="size-3" />
              {upscaleFactorValue}x
            </button>
          ) : null}

          {tab.mode !== 'speech' ? (
            <label
              className="flex h-6 items-center gap-1.5 rounded-full border border-line bg-black/20 pl-2 pr-1 text-[11px] text-text-3"
              title="Apply a prompt enhancer with Ollama"
            >
              <WandSparkles className="size-3" />
              <Select
                className="h-5 border-0 bg-transparent pl-0 pr-5 text-[11px] text-text-2"
                value={tab.enhancer}
                onChange={(event) => updateActive({ enhancer: event.target.value })}
              >
                <option value="none">No enhancement</option>
                {enhancerOptions
                  .filter((enhancer) => enhancer.id !== 'none')
                  .map((enhancer) => (
                    <option key={enhancer.id} value={enhancer.id}>
                      {enhancer.name || enhancer.id}
                    </option>
                  ))}
              </Select>
            </label>
          ) : null}

          {isFastH3 || isLtx ? (
            <div className="flex items-center gap-0.5 rounded-full border border-line bg-black/20 p-0.5">
              <button
                onClick={toggleAutoPrompt}
                aria-pressed={autoPromptEnabled}
                className={cn(
                  'flex h-6 items-center gap-1.5 rounded-full px-2 text-[11px] font-medium transition',
                  autoPromptEnabled ? 'bg-lime-soft text-lime' : 'text-text-3 hover:text-text',
                )}
                title="Use the auto prompt builder"
              >
                <WandSparkles className="size-3" />
                Auto Prompt
              </button>
              <button
                onClick={() => (isLtx ? setLtxOpen(true) : setH3Open(true))}
                className="flex h-6 items-center gap-1 rounded-full px-2 text-[11px] font-medium text-text-3 transition hover:text-text"
                title="Set up the auto prompt"
              >
                <Settings2 className="size-3" />
                Setup
              </button>
            </div>
          ) : null}

          {tab.mode === 'speech' ? (
            <button
              onClick={() => setSpeechOpen(true)}
              className="flex h-6 items-center gap-1.5 rounded-full border border-line px-2 text-[11px] font-medium text-text-3 transition hover:border-line-strong hover:text-text-2"
              title="Voice, emotion and transcript"
            >
              <Mic2 className="size-3" />
              Voice Setup
            </button>
          ) : null}

          <button
            onClick={() => setHelpOpen(true)}
            className="ml-auto flex h-6 items-center gap-1.5 rounded-full px-2 text-[11px] font-medium text-text-3 transition hover:text-text"
            title="How to write the prompt"
          >
            <CircleQuestionMark className="size-3.5" />
            Help
          </button>

          <button
            onClick={() => setAdvanced(!advanced)}
            className={cn(
              'flex h-6 items-center gap-1.5 rounded-full px-2 text-[11px] font-medium transition',
              advanced ? 'bg-white/[0.06] text-text' : 'text-text-3 hover:text-text',
            )}
          >
            <SlidersHorizontal className="size-3" />
            {advanced ? 'Less' : 'More'}
            <ChevronDown className={cn('size-3 transition', advanced && 'rotate-180')} />
          </button>
        </div>

        {advanced ? (
          <div className="flex flex-wrap items-center gap-1.5 border-b border-line bg-white/[0.015] px-2 py-1.5">
            {tab.mode === 'image' ? (
              <label className="flex items-center gap-2 text-[10px] text-text-3">
                LoRA
                <Select
                  className="h-6 pl-2 pr-6 text-[11px] min-w-[140px]"
                  value={tab.attachments.find((attachment) => attachment.type === 'lora')?.name || ''}
                  onChange={(event) => {
                    const rest = tab.attachments.filter((attachment) => attachment.type !== 'lora')
                    updateActive({
                      attachments: event.target.value
                        ? [...rest, { name: event.target.value, type: 'lora' }]
                        : rest,
                    })
                  }}
                >
                  <option value="">None</option>
                  {loras.map((lora) => (
                    <option key={lora} value={lora}>
                      {lora}
                    </option>
                  ))}
                </Select>
              </label>
            ) : null}
            {tab.mode === 'video' && recastActive ? (
              <div className="flex w-full flex-wrap items-center gap-x-3 gap-y-1.5">
                <label className="flex items-center gap-2 text-[10px] text-text-3">
                  Recast engine
                  <Select
                    className="h-6 pl-2 pr-6 text-[11px] min-w-[160px]"
                    value={recastEngine ?? 'fasth3'}
                    onChange={(event) => setRecastEngine(event.target.value as RecastEngine)}
                  >
                    {RECAST_ENGINE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </Select>
                </label>
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="text-[10px] text-text-3">Preserve</span>
                  {RECAST_PRESERVE_OPTIONS.map((option) => (
                    <label
                      key={option}
                      className="flex items-center gap-1 text-[10px] capitalize text-text-3"
                    >
                      <input
                        type="checkbox"
                        className="size-3 accent-lime"
                        checked={recastSettings.preserve.includes(option)}
                        onChange={() => togglePreserve(option)}
                      />
                      {option}
                    </label>
                  ))}
                </div>
                <label className="flex items-center gap-2 text-[10px] text-text-3">
                  Source audio
                  <Select
                    className="h-6 pl-2 pr-6 text-[11px] min-w-[136px]"
                    value={recastSettings.audio_mode}
                    onChange={(event) =>
                      updateRecastSettings({
                        audio_mode: event.target.value as RecastSettings['audio_mode'],
                      })
                    }
                  >
                    <option value="mute">Mute</option>
                    <option value="copy">Keep source audio</option>
                    <option value="reference">Use as audio reference</option>
                  </Select>
                </label>
                <label className="flex items-center gap-2 text-[10px] text-text-3">
                  Starting image
                  <Select
                    className="h-6 pl-2 pr-6 text-[11px] min-w-[150px]"
                    value={recastSettings.start_image_mode}
                    onChange={(event) =>
                      updateRecastSettings({
                        start_image_mode: event.target
                          .value as RecastSettings['start_image_mode'],
                      })
                    }
                  >
                    <option value="first_frame_identity">First frame + identity</option>
                    <option value="identity">Identity only</option>
                    <option value="first_frame">First frame only</option>
                  </Select>
                </label>
                {recastEngine === 'ltx23' || recastEngine === 'ltx25' ? (
                  <>
                    <label className="flex items-center gap-2 text-[10px] text-text-3">
                      Motion source
                      <Select
                        className="h-6 pl-2 pr-6 text-[11px] min-w-[116px]"
                        value={recastSettings.source_control}
                        onChange={(event) =>
                          updateRecastSettings({
                            source_control: event.target
                              .value as RecastSettings['source_control'],
                          })
                        }
                      >
                        {RECAST_SOURCE_CONTROL_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </Select>
                    </label>
                    <label className="flex items-center gap-2 text-[10px] text-text-3">
                      Reference fit
                      <Select
                        className="h-6 pl-2 pr-6 text-[11px] min-w-[108px]"
                        value={recastSettings.reference_fit}
                        onChange={(event) =>
                          updateRecastSettings({
                            reference_fit: event.target
                              .value as RecastSettings['reference_fit'],
                          })
                        }
                      >
                        {RECAST_REFERENCE_FIT_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </Select>
                    </label>
                    <label className="flex items-center gap-2 text-[10px] text-text-3">
                      Start at
                      <Input
                        type="number"
                        min={0}
                        step={0.1}
                        className="h-6 w-16 text-[11px]"
                        value={recastSettings.source_start}
                        onChange={(event) =>
                          updateRecastSettings({
                            source_start: Math.max(0, Number(event.target.value) || 0),
                          })
                        }
                        title="Seconds into the source video"
                      />
                    </label>
                    <label className="flex items-center gap-2 text-[10px] text-text-3">
                      Source strength
                      <input
                        type="range"
                        min={0}
                        max={1}
                        step={0.05}
                        value={recastSettings.source_guide_strength}
                        onChange={(event) =>
                          updateRecastSettings({
                            source_guide_strength: Number(event.target.value),
                          })
                        }
                        className="w-20 accent-lime"
                      />
                      <span className="w-7 text-text-2">
                        {recastSettings.source_guide_strength.toFixed(2)}
                      </span>
                    </label>
                    <label className="flex items-center gap-2 text-[10px] text-text-3">
                      Control attention
                      <input
                        type="range"
                        min={0}
                        max={1}
                        step={0.05}
                        value={recastSettings.control_attention_strength}
                        onChange={(event) =>
                          updateRecastSettings({
                            control_attention_strength: Number(event.target.value),
                          })
                        }
                        className="w-20 accent-lime"
                      />
                      <span className="w-7 text-text-2">
                        {recastSettings.control_attention_strength.toFixed(2)}
                      </span>
                    </label>
                    <label className="flex items-center gap-2 text-[10px] text-text-3">
                      Identity strength
                      <input
                        type="range"
                        min={0}
                        max={1}
                        step={0.05}
                        value={recastSettings.start_image_strength}
                        onChange={(event) =>
                          updateRecastSettings({
                            start_image_strength: Number(event.target.value),
                          })
                        }
                        className="w-20 accent-lime"
                      />
                      <span className="w-7 text-text-2">
                        {recastSettings.start_image_strength.toFixed(2)}
                      </span>
                    </label>
                    <label className="flex items-center gap-2 text-[10px] text-text-3">
                      Ref strength
                      <input
                        type="range"
                        min={0}
                        max={1}
                        step={0.05}
                        value={recastSettings.ref_image_strength}
                        onChange={(event) =>
                          updateRecastSettings({
                            ref_image_strength: Number(event.target.value),
                          })
                        }
                        className="w-20 accent-lime"
                      />
                      <span className="w-7 text-text-2">
                        {recastSettings.ref_image_strength.toFixed(2)}
                      </span>
                    </label>
                    <label className="flex items-center gap-2 text-[10px] text-text-3">
                      Seed
                      <Input
                        type="number"
                        min={0}
                        step={1}
                        placeholder="Random"
                        className="h-6 w-24 text-[11px]"
                        value={recastSettings.seed ?? ''}
                        onChange={(event) =>
                          updateRecastSettings({
                            seed:
                              event.target.value === ''
                                ? null
                                : Math.max(0, Math.floor(Number(event.target.value) || 0)),
                          })
                        }
                      />
                    </label>
                    <label className="flex items-center gap-2 text-[10px] text-text-3">
                      Sampler
                      <Select
                        className="h-6 pl-2 pr-6 text-[11px] min-w-[146px]"
                        value={recastSettings.sampler_name || 'auto'}
                        onChange={(event) =>
                          updateRecastSettings({
                            sampler_name: event.target.value === 'auto' ? '' : event.target.value,
                          })
                        }
                      >
                        <option value="auto">Auto</option>
                        <option value="euler_ancestral_cfg_pp">Euler ancestral CFG++</option>
                        <option value="euler_ancestral">Euler ancestral</option>
                        <option value="euler">Euler</option>
                      </Select>
                    </label>
                    <label className="flex items-center gap-1.5 text-[10px] text-text-3">
                      <input
                        type="checkbox"
                        className="size-3 accent-lime"
                        checked={recastSettings.prompt_enhance}
                        onChange={(event) =>
                          updateRecastSettings({ prompt_enhance: event.target.checked })
                        }
                      />
                      Enhance prompt
                    </label>
                    <label className="flex w-full items-center gap-2 text-[10px] text-text-3">
                      Negative
                      <Input
                        className="h-6 flex-1 text-[11px]"
                        value={recastSettings.negative_prompt}
                        onChange={(event) =>
                          updateRecastSettings({ negative_prompt: event.target.value })
                        }
                        placeholder="Default: game, cartoon, childish, ugly"
                      />
                    </label>
                    <span className="w-full text-[10px] text-warning">
                      Experimental: LTX Recast uses the union-control IC-LoRA and may need strength tuning.
                    </span>
                  </>
                ) : null}
                {recastDurationWarning ? (
                  <span className="w-full text-[10px] text-warning">{recastDurationWarning}</span>
                ) : null}
              </div>
            ) : null}
            {tab.mode === 'video' && !recastActive ? (
              <label className="flex items-center gap-2 text-[10px] text-text-3">
                FastH3 mode
                <Select
                  className="h-6 pl-2 pr-6 text-[11px] min-w-[108px]"
                  value={tab.fasth3Mode}
                  onChange={(event) => updateActive({ fasth3Mode: event.target.value })}
                >
                  <option value="reference">Reference</option>
                  <option value="i2v">First frame</option>
                </Select>
              </label>
            ) : null}
            {tab.mode === 'speech' ? (
              <>
                <label className="flex items-center gap-2 text-[10px] text-text-3">
                  Emotion
                  <Select
                    className="h-6 pl-2 pr-6 text-[11px] min-w-[90px]"
                    value={tab.speech.emotion}
                    onChange={(event) =>
                      updateActive({ speech: { ...tab.speech, emotion: event.target.value } })
                    }
                  >
                    {['neutral', 'happy', 'sad', 'angry', 'surprised'].map((emotion) => (
                      <option key={emotion} value={emotion}>
                        {emotion}
                      </option>
                    ))}
                  </Select>
                </label>
                <Select
                  className="h-6 pl-2 pr-6 text-[11px] min-w-[112px]"
                  value={selectedVoice?.id || ''}
                  onChange={(event) => attachVoice(event.target.value)}
                >
                  <option value="">Attach voice…</option>
                  {voiceOptions.map((voice) => (
                    <option key={voice.id} value={voice.id}>
                      {voice.prompt || voice.filename}
                    </option>
                  ))}
                </Select>
              </>
            ) : null}
          </div>
        ) : null}

        <div className="p-2">
          <div className="rounded-xl border border-line bg-black/20 focus-within:border-lime/30">
            <div className="flex items-start gap-2 p-2">
              <IconButton
                className="mt-0.5 size-7 shrink-0"
                onClick={() => fileInput.current?.click()}
                disabled={uploading}
                aria-label="Add attachment"
              >
                {uploading ? <Loader2 className="size-4 animate-spin" /> : <Paperclip className="size-4" />}
              </IconButton>
              <input
                ref={fileInput}
                type="file"
                accept="image/*,audio/*,video/*"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0]
                  if (file) void handleFile(file)
                }}
              />
              <Textarea
                ref={inputRef}
                value={tab.prompt}
                onChange={(event) => updateActive({ prompt: event.target.value })}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault()
                    void handleGenerate()
                  }
                }}
                rows={1}
                style={{ height: promptHeight }}
                className="min-h-[30px] flex-1 overflow-y-auto border-0 bg-transparent px-0 py-0.5 text-[11px] focus:bg-transparent"
                placeholder={
                  tab.mode === 'video'
                    ? 'Describe the video, dialogue, sound, and camera…'
                    : tab.mode === 'speech'
                      ? 'Type what the voice should say…'
                      : 'Describe the image you want to make…'
                }
              />
              {tab.prompt ? (
                <IconButton
                  className="mt-0.5 size-7 shrink-0 text-text-3 hover:text-danger"
                  onClick={() => {
                    updateActive({ prompt: '' })
                    inputRef.current?.focus()
                  }}
                  aria-label="Clear prompt"
                  title="Clear prompt"
                >
                  <X className="size-3.5" />
                </IconButton>
              ) : null}
              <Button
                variant="primary"
                size="icon"
                onClick={() => void handleGenerate()}
                disabled={!canGenerate}
                className="mt-0.5 size-8 shrink-0 rounded-full bg-lime"
                aria-label="Generate"
              >
                {busy ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <ArrowUp className="size-4" strokeWidth={2.6} />
                )}
              </Button>
            </div>
            {tab.attachments.length ? (
              <div className="flex gap-1.5 overflow-x-auto border-t border-line px-1.5 py-1 no-scrollbar">
                {labelledAttachments(
                  tab.attachments,
                  Boolean(videoAttachment) && Boolean(recastEngine),
                ).map(({ attachment, label }, index) => (
                  <AttachmentChip
                    key={`${attachment.type}-${attachment.name}-${index}`}
                    attachment={attachment}
                    label={label}
                    onRemove={() => removeAttachment(index)}
                  />
                ))}
              </div>
            ) : null}
          </div>
          {setupIssue ? (
            <p className="mt-1 px-1 text-[10px] leading-4 text-danger">{setupIssue}</p>
          ) : null}
          {recastDurationWarning && !advanced ? (
            <p className="mt-1 px-1 text-[10px] leading-4 text-warning">
              {recastDurationWarning}
            </p>
          ) : null}
          <div className="mt-1 flex items-center justify-between gap-2 px-1">
            <div className="flex items-center gap-2 text-[10px] text-text-3">
              <Sparkles className="size-3 text-lime" />
              <span>Local-first · your files stay on this machine</span>
            </div>
            <span className="text-[10px] text-text-3">
              {tab.mode === 'video'
                ? `${tab.resolution} · ${tab.aspect} · ${tab.duration}s`
                : tab.mode === 'speech'
                  ? tab.speech.engine
                  : `${tab.resolution} · ${tab.aspect}`}
            </span>
          </div>
        </div>
      </div>

      <H3AutoPromptDialog open={h3Open} onOpenChange={setH3Open} />
      <LtxAutoPromptDialog open={ltxOpen} onOpenChange={setLtxOpen} />
      <SpeechSetupDialog
        key={`speech-${tab.id}-${speechOpen ? 'open' : 'closed'}`}
        open={speechOpen}
        onOpenChange={setSpeechOpen}
      />
      <PromptHelpDialog open={helpOpen} onOpenChange={setHelpOpen} />
    </div>
  )
}

function AttachmentChip({
  attachment,
  label,
  onRemove,
}: {
  attachment: Attachment
  label: string
  onRemove: () => void
}) {
  const isImage = attachment.type === 'image'
  const isVideo = attachment.type === 'video'
  const displayName =
    attachment.displayName ||
    (attachment.prompt ? titleFromPrompt(attachment.prompt) : '') ||
    attachment.name
  const src =
    attachment.src ||
    (isImage
      ? `/images/${attachment.name}`
      : isVideo
        ? `/videos/${attachment.name}`
        : `/audio/${attachment.name}`)
  return (
    <div
      className="group relative flex h-9 shrink-0 items-center gap-2 rounded-lg border border-line bg-white/[0.03] px-2"
      title={attachment.name}
    >
      {isImage ? (
        <img src={mediaUrl(src)} alt="" className="size-6 rounded-md object-cover" />
      ) : isVideo ? (
        <div className="relative size-6 overflow-hidden rounded-md bg-lime-soft text-lime">
          <video
            src={mediaUrl(src)}
            muted
            preload="metadata"
            className="size-full object-cover"
          />
          <span className="absolute inset-0 grid place-items-center bg-black/35">
            <Video className="size-3" />
          </span>
        </div>
      ) : (
        <div className="grid size-6 place-items-center rounded-md bg-lime-soft text-lime">
          {attachment.type === 'lora' ? (
            <SlidersHorizontal className="size-3.5" />
          ) : (
            <Mic2 className="size-3.5" />
          )}
        </div>
      )}
      <div className="max-w-[140px]">
        <p className="truncate text-[10px] font-medium text-text-2">{label}</p>
        <p className="truncate text-[9px] text-text-3">
          {displayName}
          {isVideo && attachment.duration ? ` · ${formatDuration(attachment.duration)}` : ''}
        </p>
      </div>
      <button
        onClick={onRemove}
        className="absolute -right-1 -top-1 hidden rounded-full border border-line bg-surface p-0.5 text-text-3 hover:text-danger group-hover:block"
        aria-label="Remove attachment"
      >
        <X className="size-2.5" />
      </button>
    </div>
  )
}
