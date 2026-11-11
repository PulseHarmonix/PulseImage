import type { Asset } from '../types'
import { assetDisplayName } from './assets'
import { assetType, parseMetadata } from './utils'

export interface MusicTrack {
  id: string
  title: string
  filename: string
  duration?: number
  style?: string
  styleTags: string[]
  lyrics?: string
  created?: string
}

function metadataRecord(asset: Asset): Record<string, unknown> {
  return parseMetadata(asset) as Record<string, unknown>
}

function planRecord(meta: Record<string, unknown>): Record<string, unknown> {
  const plan = meta.plan
  return plan && typeof plan === 'object' && !Array.isArray(plan)
    ? (plan as Record<string, unknown>)
    : {}
}

function styleFrom(meta: Record<string, unknown>): string | undefined {
  if (typeof meta.style === 'string' && meta.style.trim()) return meta.style
  const plan = planRecord(meta)
  if (typeof plan.style === 'string' && plan.style.trim()) return plan.style
  return undefined
}

function lyricsFrom(meta: Record<string, unknown>): string | undefined {
  if (typeof meta.lyrics === 'string') return meta.lyrics
  const plan = planRecord(meta)
  if (typeof plan.lyrics === 'string') return plan.lyrics
  return undefined
}

function durationFrom(asset: Asset, meta: Record<string, unknown>): number | undefined {
  if (typeof asset.duration === 'number' && Number.isFinite(asset.duration)) {
    return asset.duration
  }
  if (typeof meta.duration === 'number' && Number.isFinite(meta.duration)) {
    return meta.duration
  }
  return undefined
}

export function isMusicAsset(asset: Asset): boolean {
  if (assetType(asset) !== 'audio') return false
  const meta = metadataRecord(asset)
  if (meta.is_music === false) return false
  return meta.source === 'yue2' || meta.is_music === true || meta.kind === 'music'
}

export function styleTagsFor(asset: Asset): string[] {
  const style = styleFrom(metadataRecord(asset))
  if (!style) return []
  const seen = new Set<string>()
  const tags: string[] = []
  for (const raw of style.split(',')) {
    const tag = raw.trim()
    if (!tag) continue
    const key = tag.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    tags.push(tag)
  }
  return tags
}

export function trackFromAsset(asset: Asset): MusicTrack {
  const meta = metadataRecord(asset)
  return {
    id: asset.id,
    title: assetDisplayName(asset),
    filename: asset.filename,
    duration: durationFrom(asset, meta),
    style: styleFrom(meta),
    styleTags: styleTagsFor(asset),
    lyrics: lyricsFrom(meta),
    created: asset.created,
  }
}

export function musicTracksFromAssets(assets: Asset[]): MusicTrack[] {
  return assets.filter((asset) => isMusicAsset(asset)).map((asset) => trackFromAsset(asset))
}
