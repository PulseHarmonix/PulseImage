export type MotionModel = 'ltx' | 'fasth3'

export interface MotionPreset {
  id: string
  name: string
  group: 'Camera' | 'Dynamic'
  description: string
  prompt: string
  hue: number
}

export const MOTION_PRESETS: MotionPreset[] = [
  {
    id: 'push-in',
    name: 'Push In',
    group: 'Camera',
    description: 'A slow dolly forward that tightens on the subject.',
    prompt: 'The camera slowly pushes in toward the subject, smooth and steady.',
    hue: 84,
  },
  {
    id: 'pull-out',
    name: 'Pull Out',
    group: 'Camera',
    description: 'Ease backward to reveal the space around the subject.',
    prompt: 'The camera slowly pulls back away from the subject, revealing the surrounding scene.',
    hue: 96,
  },
  {
    id: 'pan-left',
    name: 'Pan Left',
    group: 'Camera',
    description: 'A steady horizontal sweep toward the left.',
    prompt: 'The camera pans smoothly to the left across the scene, keeping a steady horizon.',
    hue: 108,
  },
  {
    id: 'pan-right',
    name: 'Pan Right',
    group: 'Camera',
    description: 'A steady horizontal sweep toward the right.',
    prompt: 'The camera pans smoothly to the right across the scene, keeping a steady horizon.',
    hue: 120,
  },
  {
    id: 'tilt-up',
    name: 'Tilt Up',
    group: 'Camera',
    description: 'Tilt upward to reveal height and scale.',
    prompt: 'The camera tilts smoothly upward, revealing more of the subject and the space above.',
    hue: 132,
  },
  {
    id: 'tilt-down',
    name: 'Tilt Down',
    group: 'Camera',
    description: 'Tilt downward to reveal the ground and detail.',
    prompt: 'The camera tilts smoothly downward, revealing the ground and lower details.',
    hue: 144,
  },
  {
    id: 'truck-left',
    name: 'Truck Left',
    group: 'Camera',
    description: 'Glide sideways to the left, parallel to the subject.',
    prompt: 'The camera trucks smoothly to the left, gliding sideways beside the subject.',
    hue: 156,
  },
  {
    id: 'truck-right',
    name: 'Truck Right',
    group: 'Camera',
    description: 'Glide sideways to the right, parallel to the subject.',
    prompt: 'The camera trucks smoothly to the right, gliding sideways beside the subject.',
    hue: 168,
  },
  {
    id: 'jib-up',
    name: 'Jib Up',
    group: 'Camera',
    description: 'Rise on a jib to a higher vantage point.',
    prompt: 'The camera rises smoothly upward on a jib, lifting to a higher vantage point.',
    hue: 180,
  },
  {
    id: 'jib-down',
    name: 'Jib Down',
    group: 'Camera',
    description: 'Descend on a jib toward the subject.',
    prompt: 'The camera descends smoothly on a jib, lowering toward the subject.',
    hue: 192,
  },
  {
    id: 'orbit-left',
    name: 'Orbit Left',
    group: 'Camera',
    description: 'Circle around the subject toward the left.',
    prompt: 'The camera orbits smoothly around the subject toward the left, keeping the subject centered.',
    hue: 204,
  },
  {
    id: 'orbit-right',
    name: 'Orbit Right',
    group: 'Camera',
    description: 'Circle around the subject toward the right.',
    prompt: 'The camera orbits smoothly around the subject toward the right, keeping the subject centered.',
    hue: 216,
  },
  {
    id: 'arc-left',
    name: 'Arc Left',
    group: 'Camera',
    description: 'A gentle semicircle arc around the subject to the left.',
    prompt: 'The camera arcs smoothly around the subject to the left in a gentle semicircle.',
    hue: 228,
  },
  {
    id: 'arc-right',
    name: 'Arc Right',
    group: 'Camera',
    description: 'A gentle semicircle arc around the subject to the right.',
    prompt: 'The camera arcs smoothly around the subject to the right in a gentle semicircle.',
    hue: 240,
  },
  {
    id: 'crash-zoom-in',
    name: 'Crash Zoom In',
    group: 'Dynamic',
    description: 'A rapid zoom that lands in a tight frame.',
    prompt: 'The camera crash-zooms rapidly inward toward the subject, ending in a tight frame.',
    hue: 252,
  },
  {
    id: 'crash-zoom-out',
    name: 'Crash Zoom Out',
    group: 'Dynamic',
    description: 'A rapid zoom that snaps outward to the full scene.',
    prompt: 'The camera crash-zooms rapidly outward from the subject, revealing the full scene.',
    hue: 264,
  },
  {
    id: 'dolly-zoom',
    name: 'Dolly Zoom',
    group: 'Dynamic',
    description: 'The vertigo effect: dolly back while zooming in.',
    prompt: 'The camera dollies backward while zooming in, creating a dolly-zoom effect with the subject holding steady.',
    hue: 276,
  },
  {
    id: 'whip-pan',
    name: 'Whip Pan',
    group: 'Dynamic',
    description: 'A fast pan with a sharp stop on the subject.',
    prompt: 'The camera whip-pans quickly across the scene, settling on the subject with a sharp stop.',
    hue: 288,
  },
  {
    id: 'handheld-follow',
    name: 'Handheld Follow',
    group: 'Dynamic',
    description: 'A close, handheld chase behind the subject.',
    prompt: 'The camera follows the subject with subtle handheld movement, staying close behind.',
    hue: 300,
  },
  {
    id: 'tracking-follow',
    name: 'Tracking Follow',
    group: 'Dynamic',
    description: 'Track alongside the subject at their pace.',
    prompt: 'The camera tracks alongside the subject, matching their pace in a smooth continuous move.',
    hue: 312,
  },
  {
    id: 'bullet-time',
    name: 'Bullet Time',
    group: 'Dynamic',
    description: 'A slow sweep around frozen action.',
    prompt: 'The camera sweeps around the subject in slow bullet-time, freezing the action mid-motion.',
    hue: 324,
  },
  {
    id: 'reveal-pullback',
    name: 'Reveal Pullback',
    group: 'Dynamic',
    description: 'Pull back steadily to reveal the wider scene.',
    prompt: 'The camera pulls back steadily to reveal the wider scene around the subject.',
    hue: 336,
  },
]

export function motionPreviewPaths(id: string): { video: string; poster: string } {
  return {
    video: `/motion-presets/${id}.mp4`,
    poster: `/motion-presets/${id}.jpg`,
  }
}

export function buildMotionPrompt(
  preset: MotionPreset,
  model: MotionModel,
  extra?: string,
): string {
  const note = extra?.trim()
  const base =
    model === 'ltx'
      ? `Use the provided image as the first frame. ${preset.prompt} Keep the subject, scene, lighting, and composition consistent. Single continuous shot, no cuts, no text, no overlays, no black frames.`
      : `For the target video, at 0.00 seconds into the target video, <Picture 1> (from [Shot 1]) is fully referenced.\nintegrated_multimodal_description: [Shot 1] ${preset.prompt} Keep the subject and environment from <Picture 1> fully preserved. Single continuous shot, no cuts, no text, no overlays, no black frames.`
  return note ? `${base} ${note}`.trim() : base
}
