import type { LucideIcon } from 'lucide-react'
import { AudioLines, Disc3, Drum, Guitar, MicVocal, Music2, Piano } from 'lucide-react'
import type { Asset } from '../types'
import { assetType, parseMetadata } from './utils'

export type StemStatus = 'idle' | 'running' | 'ready' | 'error'

export interface StemSource {
  id: string
  name: string
  filename: string
  duration?: number
  waveform?: number[]
}

export interface StemInfo {
  id: string
  name: string
  stem: string
  filename: string
  duration?: number
  waveform?: number[]
}

export interface StemResponse {
  success: boolean
  status: StemStatus
  error?: string
  source?: StemSource
  stems: StemInfo[]
}

export interface StemMixSelection {
  stemIds: string[]
  volumes: Record<string, number>
}

export interface StemMixResponse {
  success: boolean
  error?: string
  asset_id?: string
  filename?: string
  duration?: number
  stem_count?: number
}

export interface StemCapabilities {
  available: boolean
  comfy_connected: boolean
  node_installed: boolean
  model?: string
  error?: string
}

export interface StemMeta {
  key: string
  label: string
  icon: LucideIcon
  soft: string
  fill: string
}

export const STEM_ORDER = ['vocals', 'drums', 'bass', 'other', 'guitar', 'piano'] as const

const STEM_ALIASES: Record<string, string> = {
  vocal: 'vocals',
  vocals: 'vocals',
  voice: 'vocals',
  drum: 'drums',
  drums: 'drums',
  percussion: 'drums',
  bass: 'bass',
  bassline: 'bass',
  other: 'other',
  instrumental: 'other',
  accompaniment: 'other',
  guitar: 'guitar',
  guitars: 'guitar',
  piano: 'piano',
  keys: 'piano',
  keyboard: 'piano',
}

const STEM_META: Record<string, Omit<StemMeta, 'key'>> = {
  original: {
    label: 'Original mix',
    icon: AudioLines,
    soft: 'bg-lime-soft text-lime',
    fill: 'bg-lime',
  },
  vocals: {
    label: 'Vocals',
    icon: MicVocal,
    soft: 'bg-sky-400/15 text-sky-300',
    fill: 'bg-sky-300',
  },
  drums: {
    label: 'Drums',
    icon: Drum,
    soft: 'bg-amber-400/15 text-amber-300',
    fill: 'bg-amber-300',
  },
  bass: {
    label: 'Bass',
    icon: Disc3,
    soft: 'bg-violet-400/15 text-violet-300',
    fill: 'bg-violet-300',
  },
  other: {
    label: 'Other',
    icon: Music2,
    soft: 'bg-zinc-400/15 text-zinc-300',
    fill: 'bg-zinc-300',
  },
  guitar: {
    label: 'Guitar',
    icon: Guitar,
    soft: 'bg-emerald-400/15 text-emerald-300',
    fill: 'bg-emerald-300',
  },
  piano: {
    label: 'Piano',
    icon: Piano,
    soft: 'bg-pink-400/15 text-pink-300',
    fill: 'bg-pink-300',
  },
}

export function normalizeStem(stem?: string | null): string {
  const value = (stem || '').trim().toLowerCase()
  return STEM_ALIASES[value] ?? value
}

export function stemMeta(stem?: string | null): StemMeta {
  const key = normalizeStem(stem) || 'other'
  const meta = STEM_META[key]
  if (meta) return { key, ...meta }
  return {
    key,
    label: key ? key.charAt(0).toUpperCase() + key.slice(1) : 'Stem',
    icon: Music2,
    soft: 'bg-white/[0.06] text-text-2',
    fill: 'bg-white/60',
  }
}

export function stemRank(stem?: string | null): number {
  const key = normalizeStem(stem)
  const index = STEM_ORDER.indexOf(key as (typeof STEM_ORDER)[number])
  return index === -1 ? STEM_ORDER.length : index
}

export function isStemAsset(asset: Asset): boolean {
  if (assetType(asset) !== 'audio') return false
  const meta = parseMetadata(asset)
  if (typeof meta.stem === 'string' && meta.stem.trim()) return true
  if (typeof meta.stem_name === 'string' && meta.stem_name.trim()) return true
  if (meta.is_stem === true) return true
  const source = typeof meta.source === 'string' ? meta.source.toLowerCase() : ''
  if (source === 'stem' || source === 'stems' || source === 'stem_separation') return true
  const kind = typeof meta.kind === 'string' ? meta.kind.toLowerCase() : ''
  return kind === 'stem' || kind === 'stems'
}

export function stemSourceTitle(
  source?: StemSource | null,
  asset?: Asset | null,
): string {
  if (source?.name?.trim()) return source.name.trim()
  if (!asset) return 'Audio track'
  const meta = parseMetadata(asset)
  if (typeof meta.name === 'string' && meta.name.trim()) return meta.name.trim()
  const prompt = (asset.prompt || '').trim()
  if (prompt) return prompt.length > 90 ? `${prompt.slice(0, 90)}...` : prompt
  return asset.filename || 'Audio track'
}

export function formatStemClock(seconds?: number | null): string {
  if (seconds == null || !Number.isFinite(seconds) || seconds < 0) return '0:00'
  const total = Math.floor(seconds)
  const minutes = Math.floor(total / 60)
  const rest = total % 60
  return `${minutes}:${rest.toString().padStart(2, '0')}`
}
