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
  }
}

export function storedScoreView(asset: Asset): ScoreView | null {
  const view = scoreViewFromAsset(asset)
  if (!view.scoreAbc && !view.planning) return null
  return view
}
