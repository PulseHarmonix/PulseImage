import { apiGet, apiPost, mediaUrl } from './api'
import { assetType, assetUrl, parseMetadata, titleFromPrompt } from './utils'
import type {
  Asset,
  Attachment,
  GeneratedResult,
  GenMetadata,
  ProgressSnapshot,
} from '../types'

export const PULSE_ATTACH_EVENT = 'pulse:attach-asset'

export interface AssetDragPayload {
  type: 'image' | 'video' | 'audio'
  name: string
  displayName?: string
  src: string
  aspect: number
  id: string
  prompt: string
  duration?: number
  voice: boolean
}

export interface SaveResultInput {
  prompt: string
  result: GeneratedResult
  type: 'image' | 'video'
  aspect: string
  parentId?: string
  gen: GenMetadata
}

export function parseGen(asset?: Asset | null): GenMetadata | undefined {
  const meta = parseMetadata(asset)
  const gen = meta.gen
  return gen && typeof gen === 'object' ? (gen as GenMetadata) : undefined
}

export function assetDisplayName(asset: Asset): string {
  const metaName = parseMetadata(asset).name
  if (typeof metaName === 'string' && metaName.trim()) return metaName.trim()
  const promptTitle = titleFromPrompt(parseGen(asset)?.original_prompt || asset.prompt)
  return promptTitle !== 'Untitled generation' ? promptTitle : asset.filename
}

export function assetDuration(asset: Asset): number | undefined {
  if (typeof asset.duration === 'number' && Number.isFinite(asset.duration)) {
    return asset.duration
  }
  const meta = parseMetadata(asset)
  if (typeof meta.duration === 'number' && Number.isFinite(meta.duration)) {
    return meta.duration
  }
  const genDuration = parseGen(asset)?.duration
  return typeof genDuration === 'number' && Number.isFinite(genDuration) ? genDuration : undefined
}

export function toAttachment(asset: Asset): Attachment {
  const type = assetType(asset)
  const aspect = asset.width && asset.height ? asset.width / asset.height : undefined
  return {
    id: asset.id,
    name: asset.filename,
    displayName: assetDisplayName(asset),
    type: type === 'video' ? 'video' : type === 'audio' ? 'audio' : 'image',
    src: mediaUrl(assetUrl(asset)),
    prompt: asset.prompt || '',
    aspect: aspect && Number.isFinite(aspect) ? aspect : undefined,
    duration: assetDuration(asset),
    voice: Boolean(asset.voice),
  }
}

export const assetToAttachment = toAttachment

export function dragPayload(asset: Asset): AssetDragPayload {
  const type = assetType(asset)
  const aspect = asset.width && asset.height ? asset.width / asset.height : 1.5
  return {
    type: type === 'video' ? 'video' : type === 'audio' ? 'audio' : 'image',
    name: asset.filename || '',
    displayName: assetDisplayName(asset),
    src: mediaUrl(assetUrl(asset)),
    aspect: Number.isFinite(aspect) && aspect > 0 ? aspect : 1.5,
    id: asset.id || '',
    prompt: (asset.prompt || '').trim(),
    duration: assetDuration(asset),
    voice: Boolean(asset.voice),
  }
}

export function dispatchAttachAsset(asset: Asset): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(PULSE_ATTACH_EVENT, { detail: toAttachment(asset) }))
}

export function inferResolution(asset?: Asset | null): string {
  const long = Math.max(asset?.width || 0, asset?.height || 0)
  if (long >= 3000) return '4K'
  if (long >= 2000) return '1440p'
  if (long >= 1500) return '1080p'
  if (long >= 900) return '720p'
  if (long >= 400) return '480p'
  return '720p'
}

export function assetAspect(asset: Asset, gen?: GenMetadata): string {
  if (gen?.aspect_ratio) return gen.aspect_ratio
  if (asset.aspect_ratio) return asset.aspect_ratio
  if (asset.width && asset.height) return `${asset.width}:${asset.height}`
  return '16:9'
}

function findAssetRef(
  ref: Attachment | null | undefined,
  assets: Asset[],
  type: 'image' | 'audio' | 'video',
): Asset | undefined {
  if (!ref) return undefined
  if (ref.id) {
    const byId = assets.find((asset) => asset.id === ref.id)
    if (byId) return byId
  }
  const name = ref.name || (ref as { filename?: string }).filename
  if (!name) return undefined
  const base = name.split('/').pop()
  return assets.find((asset) => {
    if (assetType(asset) !== type) return false
    return asset.filename === name || asset.filename === base
  })
}

export function attachmentsFromGen(
  gen: GenMetadata | undefined,
  assets: Asset[],
): Attachment[] {
  if (!gen?.attachments) return []
  const { images, audios, videos, audio, lora } = gen.attachments
  const imageRefs = Array.isArray(images) ? images.filter(Boolean) : []
  const videoRefs = Array.isArray(videos) ? videos.filter(Boolean) : []
  let audioRefs = Array.isArray(audios) ? audios.filter(Boolean) : []
  if (!audioRefs.length && audio) audioRefs = [audio]

  if (lora?.name && !imageRefs.length && !videoRefs.length && !audioRefs.length) {
    return [{ id: lora.id, name: lora.name, type: 'lora', prompt: lora.prompt }]
  }

  const result: Attachment[] = []
  const seen = new Set<string>()
  const push = (attachment: Attachment) => {
    const key = `${attachment.type}:${attachment.id || ''}:${attachment.name}`
    if (seen.has(key)) return
    seen.add(key)
    result.push(attachment)
  }

  for (const ref of videoRefs) {
    const asset = findAssetRef(ref, assets, 'video')
    if (asset) {
      push(toAttachment(asset))
    } else if (ref.name) {
      push({
        id: ref.id,
        name: ref.name,
        type: 'video',
        src: mediaUrl(`/videos/${ref.name}`),
        prompt: ref.prompt,
        duration: ref.duration,
      })
    }
  }

  for (const ref of imageRefs) {
    const asset = findAssetRef(ref, assets, 'image')
    if (asset) {
      push(toAttachment(asset))
    } else if (ref.name) {
      push({
        id: ref.id,
        name: ref.name,
        type: 'image',
        src: mediaUrl(`/images/${ref.name}`),
        prompt: ref.prompt,
      })
    }
  }

  for (const ref of audioRefs) {
    const asset = findAssetRef(ref, assets, 'audio')
    if (asset) {
      push(toAttachment(asset))
    } else if (ref.name) {
      push({
        id: ref.id,
        name: ref.name,
        type: 'audio',
        src: mediaUrl(`/audio/${ref.name}`),
        prompt: ref.prompt,
      })
    }
  }

  return result
}

export async function saveResult({
  prompt,
  result,
  type,
  aspect,
  parentId,
  gen,
}: SaveResultInput): Promise<string | undefined> {
  const filename = result.local_filename || result.filename
  if (!filename) return undefined

  const response = await apiPost<{ success?: boolean; id?: string; error?: string }>(
    '/save-generation',
    {
      prompt,
      filename,
      type,
      aspect_ratio: aspect,
      width: result.width || 0,
      height: result.height || 0,
      duration: type === 'video' ? result.duration ?? gen.duration ?? undefined : undefined,
      parent_id: parentId,
      metadata: { gen: { ...gen, upscale: result.upscale ?? gen.upscale } },
    },
  )

  if (!response.success) throw new Error(response.error || 'Could not save generation')
  return response.id
}

export function watchProgress(
  jobId: string,
  onProgress: (snapshot: ProgressSnapshot) => void,
): () => void {
  let stopped = false
  const tick = async () => {
    if (stopped) return
    try {
      const snapshot = await apiGet<ProgressSnapshot>(
        `/comfy/progress/${encodeURIComponent(jobId)}`,
      )
      if (!stopped) onProgress(snapshot)
    } catch {
      // The tracker can briefly disappear between stages; keep polling.
    }
    if (!stopped) window.setTimeout(tick, 700)
  }
  void tick()
  return () => {
    stopped = true
  }
}
