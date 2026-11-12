import { apiGet, apiPost } from './api'
import { uid } from './utils'
import {
  isRecastActive,
  recastEngineForTab,
  recastModelPatch,
  recastSettingsOf,
} from './recast'
import type {
  AppSettings,
  GeneratedResult,
  GenerateResponse,
  GenMetadata,
  PromptTab,
  ProgressSnapshot,
  QueueJob,
} from '../types'

export interface GenerationHooks {
  onQueue: (job: QueueJob) => void
  onProgress: (jobId: string, progress: ProgressSnapshot) => void
  onComplete: (jobId: string) => void
  onError: (jobId: string, error: string) => void
  onAsset: (assetId: string) => void
}

export interface RunGenerationOptions {
  label?: string
  parentId?: string
  extraMetadata?: Partial<GenMetadata>
}

function activeUpscaleEngine(settings?: AppSettings): string {
  const value = settings?.video_upscale
  return value && value !== 'off' ? value : 'relayvsr_x2'
}

function upscaleEnabled(tab: PromptTab, settings?: AppSettings): boolean {
  const active = settings?.video_upscale
  return tab.upscale ?? Boolean(active && active !== 'off')
}

function metadataFor(
  tab: PromptTab,
  result?: GeneratedResult,
  upscale?: boolean,
  extraMetadata?: Partial<GenMetadata>,
  settings?: AppSettings,
): GenMetadata {
  const images = tab.attachments
    .filter((a) => a.type === 'image')
    .map((a) => ({ id: a.id || '', name: a.name, type: 'image' as const }))
  const videos = tab.attachments
    .filter((a) => a.type === 'video')
    .map((a) => ({ id: a.id || '', name: a.name, type: 'video' as const }))
  const audios = tab.attachments
    .filter((a) => a.type === 'audio' || a.type === 'voice')
    .map((a) => ({ id: a.id || '', name: a.name, type: 'audio' as const }))

  const recast = isRecastActive(tab)
  const recastEngine = recast ? recastEngineForTab(tab) : null
  const recastModel = recastEngine ? recastModelPatch(recastEngine) : null
  const sourceVideo = videos[0]

  const metadata: GenMetadata = {
    mode: tab.mode,
    resolution: tab.resolution,
    aspect_ratio: tab.aspect,
    duration: tab.mode === 'video' ? tab.duration : null,
    enhancer_id: tab.enhancer,
    original_prompt: tab.prompt,
    image_model: tab.imageModel,
    i2i_model: tab.i2iModel,
    image_edit_model:
      tab.mode === 'image' && tab.attachments.some((a) => a.type === 'image')
        ? tab.i2iModel
        : undefined,
    video_model:
      tab.mode === 'video'
        ? recastModel?.videoModel ?? tab.videoModel
        : undefined,
    ltx_version:
      tab.mode === 'video'
        ? recast
          ? recastModel?.ltxVersion
          : tab.videoModel === 'ltx'
            ? tab.ltxVersion
            : undefined
        : undefined,
    fasth3_mode:
      tab.mode === 'video'
        ? recast
          ? recastModel?.fasth3Mode
          : tab.videoModel === 'fasth3'
            ? tab.fasth3Mode
            : undefined
        : undefined,
    recast: recast ? true : undefined,
    recast_engine: recastEngine ?? undefined,
    ref_video: recast ? sourceVideo?.name : undefined,
    source_image: recast ? images[0]?.name : undefined,
    recast_settings: recast ? recastSettingsOf(tab) : undefined,
    video_upscale: (upscale ?? Boolean(tab.upscale))
      ? activeUpscaleEngine(settings)
      : 'off',
    upscale: result?.upscale,
    attachments: {
      images,
      audios,
      videos,
      audio: audios[0] || null,
      lora: tab.attachments.find((a) => a.type === 'lora') || null,
    },
  }

  return extraMetadata ? { ...metadata, ...extraMetadata } : metadata
}

export async function saveGeneratedAsset(
  tab: PromptTab,
  result: GeneratedResult,
  type: 'image' | 'video',
  upscale?: boolean,
  parentId?: string,
  extraMetadata?: Partial<GenMetadata>,
  settings?: AppSettings,
): Promise<string | undefined> {
  const filename = result.local_filename || result.filename
  if (!filename) return undefined
  const response = await apiPost<{ success?: boolean; id?: string; error?: string }>(
    '/save-generation',
    {
      prompt: tab.prompt,
      filename,
      type,
      aspect_ratio: tab.aspect,
      width: result.width || 0,
      height: result.height || 0,
      duration: type === 'video' ? result.duration || tab.duration : undefined,
      parent_id: parentId,
      metadata: { gen: metadataFor(tab, result, upscale, extraMetadata, settings) },
    },
  )
  if (!response.success) throw new Error(response.error || 'Could not save generation')
  return response.id
}

function watchProgress(jobId: string, hooks: GenerationHooks): () => void {
  let stopped = false
  const tick = async () => {
    if (stopped) return
    try {
      const snapshot = await apiGet<ProgressSnapshot>(
        `/comfy/progress/${encodeURIComponent(jobId)}`,
      )
      if (!stopped) hooks.onProgress(jobId, snapshot)
    } catch {
      // The tracker can briefly disappear between stages; keep polling.
    }
    if (!stopped) window.setTimeout(tick, 600)
  }
  void tick()
  return () => {
    stopped = true
  }
}

export async function runGeneration(
  tab: PromptTab,
  settings: AppSettings | undefined,
  hooks: GenerationHooks,
  options?: RunGenerationOptions,
): Promise<string[]> {
  const jobId = uid('job')
  const queueJob: QueueJob = {
    id: jobId,
    label: options?.label || tab.prompt.trim().slice(0, 80) || 'Untitled generation',
    mode: tab.mode,
    status: 'running',
    progress: 0,
    stage: tab.mode === 'speech' ? 'speaking' : 'generating',
    startedAt: Date.now(),
  }
  hooks.onQueue(queueJob)

  try {
    if (tab.mode === 'speech') {
      const voice = tab.attachments.find((a) => a.type === 'voice')
      if (!voice) throw new Error('Attach a voice from the Voices library first')
      const result = await apiPost<{
        success: boolean
        error?: string
        asset_id?: string
        filename?: string
        duration?: number
      }>('/tts/generate', {
        text: tab.prompt,
        voice_id: voice.id || '',
        voice_filename: voice.name,
        engine: tab.speech.engine || settings?.tts_engine || 'qwen3',
        language: tab.speech.language,
        emotion: tab.speech.emotion,
        instruction: tab.speech.instruction,
        ref_text: tab.speech.ref_text,
        seed: tab.speech.seed,
        job_id: jobId,
      })
      if (!result.success) throw new Error(result.error || 'Speech generation failed')
      hooks.onProgress(jobId, { stage: 'speaking', workflow_percent: 100, state: 'finished' })
      if (result.asset_id) hooks.onAsset(result.asset_id)
      return result.asset_id ? [result.asset_id] : []
    }

    let generationPrompt = tab.prompt
    const enhancer =
      tab.enhancer !== 'none' && !tab.h3?.enabled && !tab.ltx?.enabled
        ? settings?.prompt_enhancers?.find((item) => item.id === tab.enhancer)
        : undefined
    if (enhancer?.prompt) {
      try {
        const enhanced = await apiPost<{ enhanced?: string }>('/ollama/enhance', {
          prompt: generationPrompt,
          enhancer: enhancer.prompt,
        })
        if (enhanced.enhanced?.trim()) generationPrompt = enhanced.enhanced.trim()
      } catch {
        // Keep the original prompt if the enhancer service is unavailable.
      }
    }

    const images = tab.attachments.filter((a) => a.type === 'image')
    const audios = tab.attachments.filter((a) => a.type === 'audio')
    const body: Record<string, unknown> = {
      prompt: generationPrompt,
      resolution: tab.resolution,
      aspect_ratio: tab.aspect,
      mode: tab.mode,
      job_id: jobId,
      image_model: tab.imageModel,
      i2i_model: tab.i2iModel,
    }

    const upscale = upscaleEnabled(tab, settings)

    if (tab.mode === 'image') {
      body.count = 1
      body.qwen_turbo = Boolean(settings?.qwen_turbo ?? true)
      const lora = tab.attachments.find((attachment) => attachment.type === 'lora')
      if (lora) {
        body.lora_name = lora.name
        body.lora_strength = 0.6
      }
      if (images[0]) body.source_image = images[0].name
      if (images[1]) body.modifier_image = images[1].name
      const response = await apiPost<GenerateResponse>('/generate', body)
      if (!response.success) throw new Error(response.error || 'Image generation failed')
      const results = response.results ?? []
      const ids: string[] = []
      for (const result of results) {
        if (!result.success) throw new Error(result.error || 'Image generation failed')
        const id = await saveGeneratedAsset(
          tab,
          result,
          'image',
          undefined,
          options?.parentId,
          options?.extraMetadata,
          settings,
        )
        if (id) ids.push(id)
      }
      hooks.onProgress(jobId, { stage: 'generating', workflow_percent: 100, state: 'finished' })
      ids.forEach(hooks.onAsset)
      return ids
    }

    const videos = tab.attachments.filter((a) => a.type === 'video')
    const recast = isRecastActive(tab)
    const recastEngine = recast ? recastEngineForTab(tab) : null
    const recastModel = recastEngine ? recastModelPatch(recastEngine) : null

    body.duration = tab.duration
    body.video_model = recastModel?.videoModel ?? tab.videoModel
    body.ltx_version = recastModel?.ltxVersion ?? tab.ltxVersion
    body.fasth3_mode = recastModel?.fasth3Mode ?? tab.fasth3Mode
    body.video_upscale = upscale ? activeUpscaleEngine(settings) : 'off'
    if (recast && videos[0]) {
      body.recast = true
      body.recast_engine = recastEngine
      body.ref_video = videos[0].name
      if (images[0]) body.source_image = images[0].name
      body.ref_images = images.slice(1).map((image) => image.name)
      body.recast_settings = recastSettingsOf(tab)
    } else {
      if (images[0]) body.source_image = images[0].name
      if (images.length > 1 || (tab.videoModel === 'fasth3' && audios.length > 1)) {
        body.ref_images = images.map((image) => image.name)
      }
    }
    if (!recast && audios.length) {
      body.ref_audios = audios.map((audio) => audio.name)
      body.modifier_audio = audios[0].name
    }

    const stopProgress = watchProgress(jobId, hooks)
    let response: GenerateResponse
    try {
      response = await apiPost<GenerateResponse>('/generate', body)
    } finally {
      stopProgress()
    }
    if (!response.success) throw new Error(response.error || 'Video generation failed')
    const results = response.results ?? []
    const ids: string[] = []
    for (const result of results) {
      if (!result.success) throw new Error(result.error || 'Video generation failed')
      const id = await saveGeneratedAsset(
        tab,
        result,
        'video',
        upscale,
        options?.parentId,
        options?.extraMetadata,
        settings,
      )
      if (id) ids.push(id)
    }
    ids.forEach(hooks.onAsset)
    return ids
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Generation failed'
    hooks.onError(jobId, message)
    throw error
  } finally {
    hooks.onComplete(jobId)
  }
}
