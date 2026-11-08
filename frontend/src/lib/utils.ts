import clsx, { type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import type { Asset, GenMetadata } from '../types'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function parseMetadata(asset?: Asset | null): { gen?: GenMetadata; [key: string]: unknown } {
  const raw = asset?.metadata
  if (!raw) return {}
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw) as Record<string, unknown>
    } catch {
      return {}
    }
  }
  return raw
}

export function assetType(asset: Asset): Asset['type'] {
  if (asset.type) return asset.type
  if (asset.filename?.match(/\.(mp4|mov|webm|mkv)$/i)) return 'video'
  if (asset.filename?.match(/\.(mp3|wav|ogg|m4a|aac|flac)$/i)) return 'audio'
  return 'image'
}

export function assetUrl(asset: Asset): string {
  const type = assetType(asset)
  if (type === 'video') return `/videos/${asset.filename}`
  if (type === 'audio') return `/audio/${asset.filename}`
  return `/images/${asset.filename}`
}

export function formatDuration(seconds?: number | null): string {
  if (seconds == null || !Number.isFinite(seconds)) return ''
  const total = Math.max(0, Math.round(seconds))
  const minutes = Math.floor(total / 60)
  const rest = total % 60
  return minutes > 0 ? `${minutes}:${String(rest).padStart(2, '0')}` : `${rest}s`
}

export function formatTimecode(seconds?: number | null, fps = 24, offset = 0): string {
  if (seconds == null || !Number.isFinite(seconds)) return '—'
  const totalFrames = Math.max(0, Math.round(seconds * fps) + offset)
  const frames = totalFrames % fps
  const totalSeconds = Math.floor(totalFrames / fps)
  const secs = totalSeconds % 60
  const minutes = Math.floor(totalSeconds / 60) % 60
  const hours = Math.floor(totalSeconds / 3600)
  return `${hours > 0 ? `${hours}:` : ''}${String(minutes).padStart(hours > 0 ? 2 : 1, '0')}:${String(secs).padStart(2, '0')}:${String(frames).padStart(2, '0')}`
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

export function uid(prefix = 'id'): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms))
}

export function inferAspect(asset: Asset): string {
  if (asset.width && asset.height) return `${asset.width} / ${asset.height}`
  return asset.aspect_ratio?.replace(':', ' / ') || '16 / 9'
}

export function titleFromPrompt(prompt?: string): string {
  const raw = String(prompt || '')
  const detailed = raw.match(/detailed_description:\s*\[Shot\s*1\]\s*([^\n]+)/i)
  const firstShot = detailed || raw.match(/\[Shot\s*1\]\s*([^\n]+)/i)
  if (firstShot?.[1]) {
    const label = firstShot[1].replace(/\s+/g, ' ').trim()
    return label.length > 72 ? `${label.slice(0, 72)}…` : label
  }

  const trimmed = raw.replace(/\s+/g, ' ').trim()
  if (!trimmed) return 'Untitled generation'

  const subject = trimmed.match(/<Subject\s*1>\s*is\s*([^.\n]+)/i)
  if (subject?.[1]) {
    const label = subject[1].replace(/\s+/g, ' ').trim()
    return label.length > 64 ? `${label.slice(0, 64)}…` : label
  }

  return trimmed.length > 64 ? `${trimmed.slice(0, 64)}…` : trimmed
}

export function downloadFilename(
  name: string | undefined,
  sourceFilename: string | undefined,
  fallback = 'download',
): string {
  const source = sourceFilename || ''
  const extension = source.match(/\.[a-z0-9]+$/i)?.[0] || ''
  const base = (name || source.replace(/\.[^.]+$/, '') || fallback)
    .replace(/[\\/:*?"<>|\u0000-\u001f]+/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 180) || fallback
  return extension && !base.toLowerCase().endsWith(extension.toLowerCase())
    ? `${base}${extension}`
    : base
}

export function safeNumber(value: unknown, fallback = 0): number {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  return Boolean(target.closest('input, textarea, [contenteditable="true"], select'))
}
