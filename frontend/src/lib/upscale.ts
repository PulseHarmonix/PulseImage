import type { Asset } from '../types'
import { parseMetadata } from './utils'

export function upscaleEngineLabel(value?: string | null): string {
  const normalized = (value ?? '').trim().toLowerCase()
  if (normalized === 'relayvsr_x2') return 'RelayVSR'
  if (normalized.includes('recavsr')) return 'ReCaVSR'
  return 'Upscaler'
}

export function upscaleFactor(value?: string | null, fallback = 2): number {
  const normalized = (value ?? '').trim().toLowerCase()
  if (!normalized || normalized === 'off') return fallback
  if (normalized === 'recavsr_x2') return 2
  if (normalized === 'recavsr_x4') return 4
  if (normalized.includes('recavsr')) return 4
  if (normalized === 'relayvsr_x2' || normalized.includes('relay')) return 2
  return fallback
}

function factorValue(value: unknown): number | undefined {
  const factor =
    typeof value === 'number'
      ? value
      : typeof value === 'string' && value.trim()
        ? Number(value)
        : Number.NaN
  return Number.isFinite(factor) && factor > 0 ? factor : undefined
}

export function upscaleFactorFromAsset(
  asset: Asset | null | undefined,
  fallback = 2,
): number {
  const meta = parseMetadata(asset) as Record<string, unknown>
  const gen = meta.gen as Record<string, unknown> | undefined
  const genUpscale = gen?.upscale as Record<string, unknown> | undefined
  const metaUpscale = meta.upscale as Record<string, unknown> | undefined

  const explicitFactor =
    factorValue(genUpscale?.factor) ?? factorValue(metaUpscale?.factor)
  if (explicitFactor !== undefined) return explicitFactor

  const engineValue =
    (typeof gen?.video_upscale === 'string' ? gen.video_upscale : undefined) ??
    (typeof meta.video_upscale === 'string' ? meta.video_upscale : undefined)
  return upscaleFactor(engineValue, fallback)
}
