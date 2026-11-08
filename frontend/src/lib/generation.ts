import { apiGet, apiPost } from './api'
import { uid } from './utils'
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

function upscaleEnabled(tab: PromptTab, settings?: AppSettings): boolean {
  return tab.upscale ?? settings?.video_upscale === 'relayvsr_x2'
}

function metadataFor(
  tab: PromptTab,
  result?: GeneratedResult,
  upscale?: boolean,
): GenMetadata {
  const images = tab.attachments
    .filter((a) => a.type === 'image' || a.type === 'video')
    .map((a) => ({ id: a.id || '', name: a.name, type: 'image' as const }))
  const audios = tab.attachments
    .filter((a) => a.type === 'audio' || a.type === 'voice')
    .map((a) => ({ id: a.id || '', name: a.name, type: 'audio' as const }))

  return {
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
    video_model: tab.mode === 'video' ? tab.videoModel : undefined,
    ltx_version:
      tab.mode === 'video' && tab.videoModel === 'ltx' ? tab.ltxVersion : undefined,
    fasth3_mode:
      tab.mode === 'video' && tab.videoModel === 'fasth3' ? tab.fasth3Mode : undefined,
    video_upscale: (upscale ?? Boolean(tab.upscale)) ? 'relayvsr_x2' : 'off',
    upscale: result?.upscale,
    attachments: {
      images,
      audios,
      audio: audios[0] || null,
      lora: tab.attachments.find((a) => a.type === 'lora') || null,
    },
  }
}

export async function saveGeneratedAsset(
  tab: PromptTab,
  result: GeneratedResult,
  type: 'image' | 'video',
  upscale?: boolean,
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
      metadata: { gen: metadataFor(tab, result, upscale) },
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
): Promise<string[]> {
  const jobId = uid('job')
  const queueJob: QueueJob = {
    id: jobId,
    label: tab.prompt.trim().slice(0, 80) || 'Untitled generation',
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
        const id = await saveGeneratedAsset(tab, result, 'image')
        if (id) ids.push(id)
      }
      hooks.onProgress(jobId, { stage: 'generating', workflow_percent: 100, state: 'finished' })
      ids.forEach(hooks.onAsset)
      return ids
    }

    body.duration = tab.duration
    body.video_model = tab.videoModel
    body.ltx_version = tab.ltxVersion
    body.fasth3_mode = tab.fasth3Mode
    body.video_upscale = upscale ? 'relayvsr_x2' : 'off'
    if (images[0]) body.source_image = images[0].name
    if (images.length > 1 || (tab.videoModel === 'fasth3' && audios.length > 1)) {
      body.ref_images = images.map((image) => image.name)
    }
    if (audios.length) {
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
      const id = await saveGeneratedAsset(tab, result, 'video', upscale)
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
