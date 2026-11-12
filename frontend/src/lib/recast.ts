import type { PromptTab, RecastEngine, RecastSettings } from '../types'

export const RECAST_PRESERVE_OPTIONS = [
  'motion',
  'camera',
  'background',
  'lighting',
  'composition',
] as const

export const RECAST_ENGINE_OPTIONS: { value: RecastEngine; label: string }[] = [
  { value: 'fasth3', label: 'FastH3' },
  { value: 'ltx23', label: 'LTX 2.3 (Experimental)' },
  { value: 'ltx25', label: 'LTX 2.5 (Experimental)' },
]

export const RECAST_REFERENCE_FIT_OPTIONS = [
  { value: 'pad', label: 'Pad / fit' },
  { value: 'crop', label: 'Center crop' },
] as const

export const RECAST_SOURCE_CONTROL_OPTIONS = [
  { value: 'canny', label: 'Canny edges' },
  { value: 'pose', label: 'Pose' },
  { value: 'depth', label: 'Depth' },
  { value: 'raw', label: 'Raw source' },
] as const

export const RECAST_MAX_DURATION: Record<RecastEngine, number> = {
  fasth3: 15,
  ltx23: 40,
  ltx25: 40,
}

export function defaultRecastSettings(): RecastSettings {
  return {
    preserve: [...RECAST_PRESERVE_OPTIONS],
    audio_mode: 'mute',
    start_image_mode: 'first_frame_identity',
    source_guide_strength: 0.5,
    reference_fit: 'pad',
    source_control: 'canny',
    control_attention_strength: 0.8,
    start_image_strength: 1,
    ref_image_strength: 0.8,
    source_start: 0,
    seed: null,
    negative_prompt: '',
    prompt_enhance: false,
    sampler_name: '',
  }
}

export function recastSettingsOf(tab: Pick<PromptTab, 'recastSettings'>): RecastSettings {
  const settings = tab.recastSettings
  const fallback = defaultRecastSettings()
  if (!settings) return fallback
  const unit = (value: unknown, fallbackValue: number) =>
    typeof value === 'number' && Number.isFinite(value)
      ? Math.max(0, Math.min(1, value))
      : fallbackValue
  const seed =
    typeof settings.seed === 'number' && Number.isFinite(settings.seed)
      ? Math.max(0, Math.floor(settings.seed))
      : null
  return {
    preserve: Array.isArray(settings.preserve) ? settings.preserve : fallback.preserve,
    audio_mode: settings.audio_mode ?? fallback.audio_mode,
    start_image_mode: settings.start_image_mode ?? fallback.start_image_mode,
    source_guide_strength: unit(settings.source_guide_strength, fallback.source_guide_strength),
    reference_fit: settings.reference_fit === 'crop' ? 'crop' : 'pad',
    source_control:
      settings.source_control === 'raw' ||
      settings.source_control === 'pose' ||
      settings.source_control === 'depth'
        ? settings.source_control
        : 'canny',
    control_attention_strength: unit(
      settings.control_attention_strength,
      fallback.control_attention_strength,
    ),
    start_image_strength: unit(settings.start_image_strength, fallback.start_image_strength),
    ref_image_strength: unit(settings.ref_image_strength, fallback.ref_image_strength),
    source_start:
      typeof settings.source_start === 'number' && Number.isFinite(settings.source_start)
        ? Math.max(0, settings.source_start)
        : 0,
    seed,
    negative_prompt:
      typeof settings.negative_prompt === 'string'
        ? settings.negative_prompt
        : fallback.negative_prompt,
    prompt_enhance: Boolean(settings.prompt_enhance),
    sampler_name:
      typeof settings.sampler_name === 'string' ? settings.sampler_name : fallback.sampler_name,
  }
}

export function recastEngineForTab(
  tab: Pick<PromptTab, 'videoModel' | 'ltxVersion'>,
): RecastEngine | null {
  if (tab.videoModel === 'fasth3') return 'fasth3'
  if (tab.videoModel === 'ltx') return tab.ltxVersion === '2.5' ? 'ltx25' : 'ltx23'
  return null
}

export function recastModelPatch(engine: RecastEngine): Partial<PromptTab> {
  if (engine === 'fasth3') {
    return { videoModel: 'fasth3', fasth3Mode: 'reference' }
  }
  return { videoModel: 'ltx', ltxVersion: engine === 'ltx25' ? '2.5' : '2.3' }
}

export function recastEngineLabel(engine: RecastEngine): string {
  return RECAST_ENGINE_OPTIONS.find((option) => option.value === engine)?.label ?? engine
}

export function isRecastActive(
  tab: Pick<PromptTab, 'mode' | 'videoModel' | 'ltxVersion' | 'attachments'>,
): boolean {
  if (tab.mode !== 'video') return false
  if (!recastEngineForTab(tab)) return false
  const videos = tab.attachments.filter((item) => item.type === 'video')
  const images = tab.attachments.filter((item) => item.type === 'image')
  return videos.length === 1 && images.length >= 1
}
