import type { Asset } from '../types'
import { parseMetadata } from './utils'
import { assetDisplayName } from './assets'

export interface ScoreView {
  scoreAbc?: string
  planning?: string
  title?: string
  style?: string
  lyrics?: string
  seed?: number
  maxScoreTokens?: number
  coverSource?: string
  audioFilename?: string
  sampling?: {
    abc?: Record<string, number>
    music?: Record<string, number>
  }
}

function asNumberRecord(value: unknown): Record<string, number> | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
  const result: Record<string, number> = {}
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    if (typeof raw === 'number' && Number.isFinite(raw)) result[key] = raw
  }
  return Object.keys(result).length ? result : undefined
}

function parseSampling(value: unknown): ScoreView['sampling'] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
  const record = value as Record<string, unknown>
  const abc = asNumberRecord(record.abc)
  const music = asNumberRecord(record.music)
  if (!abc && !music) return undefined
  return { abc, music }
}

export function scoreViewFromAsset(asset: Asset): ScoreView {
  const meta = parseMetadata(asset)
  const plan =
    typeof meta.plan === 'object' && meta.plan
      ? (meta.plan as Record<string, unknown>)
      : {}
  const scoreAbc =
    typeof meta.score_abc === 'string'
      ? meta.score_abc
      : typeof plan.score_abc === 'string'
        ? plan.score_abc
        : undefined
  const planning =
    typeof plan.planning === 'string'
      ? plan.planning
      : typeof meta.planning === 'string'
        ? meta.planning
        : undefined
  return {
    scoreAbc,
    planning,
    title: assetDisplayName(asset),
    style: typeof plan.style === 'string' ? plan.style : typeof meta.style === 'string' ? meta.style : undefined,
    lyrics: typeof plan.lyrics === 'string' ? plan.lyrics : typeof meta.lyrics === 'string' ? meta.lyrics : undefined,
    seed: typeof plan.seed === 'number' ? plan.seed : typeof meta.seed === 'number' ? meta.seed : undefined,
    maxScoreTokens:
      typeof plan.max_score_tokens === 'number'
        ? plan.max_score_tokens
        : typeof meta.max_score_tokens === 'number'
          ? meta.max_score_tokens
          : undefined,
    coverSource:
      typeof plan.cover_source === 'string'
        ? plan.cover_source
        : typeof meta.cover_source === 'string'
          ? meta.cover_source
          : undefined,
    audioFilename: asset.filename,
    sampling: parseSampling(plan.sampling ?? meta.sampling),
  }
}

export function storedScoreView(asset: Asset): ScoreView | null {
  const view = scoreViewFromAsset(asset)
  if (!view.scoreAbc && !view.planning) return null
  return view
}
