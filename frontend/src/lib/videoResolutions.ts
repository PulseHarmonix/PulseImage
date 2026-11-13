export const BASE_VIDEO_RESOLUTIONS = ['240p', '320p', '480p', '720p', '1080p']

export const LTX_VIDEO_RESOLUTIONS = ['240p', '320p', '480p', '720p', '1080p', '1440p', '4K']

export function videoResolutionsFor(model: string): string[] {
  const normalized = (model || '').trim().toLowerCase()
  return normalized.startsWith('ltx') ? LTX_VIDEO_RESOLUTIONS : BASE_VIDEO_RESOLUTIONS
}
