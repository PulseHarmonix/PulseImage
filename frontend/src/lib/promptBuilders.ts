import type {
  H3Audio,
  H3PromptState,
  H3Subject,
  LtxPromptState,
  PromptTab,
} from '../types'

export interface H3Preset {
  id: string
  name: string
  scene?: string
  hasSpeech?: boolean
}

export interface LtxPreset {
  id: string
  name: string
  fields?: Partial<LtxPromptState>
}

export interface SpeechPreset {
  id: string
  name: string
  language: string
  emotion: string
  instruction: string
  seed: number
}

export const H3_PROMPT_PRESETS: H3Preset[] = [
  { id: 'none', name: 'None', scene: '', hasSpeech: false },
  {
    id: 'selfie',
    name: 'Selfie — talking to camera',
    scene:
      "A selfie-style close-up: the subject holds the camera at arm's length and talks directly to the lens. Natural lighting, shallow depth of field.",
    hasSpeech: true,
  },
  {
    id: 'selfie_walking',
    name: 'Selfie — walking',
    scene:
      "A selfie-style walking shot: the subject holds the camera at arm's length while walking forward and talking to the lens. Slight handheld motion.",
    hasSpeech: true,
  },
  {
    id: 'selfie_car',
    name: 'Selfie — in a car',
    scene:
      "A selfie-style shot inside a car: the subject sits in the driver's seat, holds the camera at arm's length, and talks to the lens. Daylight through the windows.",
    hasSpeech: true,
  },
  {
    id: 'selfie_outdoor',
    name: 'Selfie — outdoors',
    scene:
      "A selfie-style outdoor shot: the subject holds the camera at arm's length, talking to the lens, with a natural landscape behind.",
    hasSpeech: true,
  },
  {
    id: 'selfie_night',
    name: 'Selfie — night',
    scene:
      "A selfie-style night shot: the subject holds the camera at arm's length, talking to the lens, with city lights bokeh behind.",
    hasSpeech: true,
  },
  {
    id: 'selfie_group',
    name: 'Group selfie',
    scene: 'A group selfie: several subjects crowd the frame, talking to the camera, handheld.',
    hasSpeech: true,
  },
  {
    id: 'performance',
    name: 'Music performance',
    scene: 'A cinematic music-video performance: the subject performs to camera in a dramatic setting.',
    hasSpeech: false,
  },
  {
    id: 'portrait',
    name: 'Cinematic portrait',
    scene: 'A cinematic portrait: the subject looks at the camera, shallow depth of field, dramatic lighting.',
    hasSpeech: false,
  },
  {
    id: 'product',
    name: 'Product showcase',
    scene: 'A clean product showcase: the subject presents the product to the camera in a well-lit studio.',
    hasSpeech: false,
  },
]

export const LTX_PROMPT_PRESETS: LtxPreset[] = [
  { id: 'none', name: 'None', fields: {} },
  {
    id: 'selfie',
    name: 'Selfie — talking to camera',
    fields: {
      shotType: 'selfie close-up',
      action: 'talks directly to the camera',
      camera: 'is handheld',
      lighting: 'natural light',
      style: 'cinematic',
      hasSpeech: true,
      audioType: 'speech',
    },
  },
  {
    id: 'selfie_walking',
    name: 'Selfie — walking',
    fields: {
      shotType: 'selfie medium shot',
      action: 'walks forward while talking to the camera',
      camera: 'is handheld and tracking',
      lighting: 'natural light',
      style: 'cinematic',
      hasSpeech: true,
      audioType: 'speech',
    },
  },
  {
    id: 'selfie_car',
    name: 'Selfie — in a car',
    fields: {
      shotType: 'selfie close-up',
      action: 'talks to the camera while driving',
      setting: 'inside a car',
      camera: 'is handheld',
      lighting: 'daylight through the windows',
      style: 'cinematic',
      hasSpeech: true,
      audioType: 'speech',
    },
  },
  {
    id: 'cinematic_portrait',
    name: 'Cinematic portrait',
    fields: {
      shotType: 'close-up',
      action: 'looks toward the camera',
      camera: 'slowly dollies in',
      lighting: 'dramatic side light',
      style: 'cinematic film',
      hasSpeech: false,
    },
  },
  {
    id: 'performance',
    name: 'Music performance',
    fields: {
      shotType: 'medium shot',
      action: 'performs to the camera',
      camera: 'slowly orbits the subject',
      lighting: 'stage lights',
      style: 'music video',
      hasSpeech: false,
      audioType: 'music',
    },
  },
  {
    id: 'product',
    name: 'Product showcase',
    fields: {
      shotType: 'close-up',
      action: 'presents the product to the camera',
      camera: 'slowly pans across the product',
      lighting: 'soft studio light',
      style: 'commercial',
      hasSpeech: false,
    },
  },
  {
    id: 'golden_hour',
    name: 'Golden hour',
    fields: {
      shotType: 'wide shot',
      action: 'stands in the scene',
      camera: 'is static',
      lighting: 'golden hour',
      style: 'cinematic',
    },
  },
  {
    id: 'neon_night',
    name: 'Neon night',
    fields: {
      shotType: 'medium shot',
      action: 'walks through the scene',
      camera: 'is handheld',
      lighting: 'neon city lights',
      style: 'cinematic',
    },
  },
]

export const SPEECH_PRESETS: SpeechPreset[] = [
  { id: 'spk_neutral', name: 'Neutral', language: 'English', emotion: 'neutral', instruction: '', seed: 0 },
  { id: 'spk_happy', name: 'Happy', language: 'English', emotion: 'happy', instruction: '', seed: 0 },
  { id: 'spk_sad', name: 'Sad', language: 'English', emotion: 'sad', instruction: '', seed: 0 },
  { id: 'spk_angry', name: 'Angry', language: 'English', emotion: 'angry', instruction: '', seed: 0 },
  { id: 'spk_whisper', name: 'Whisper', language: 'English', emotion: 'whisper', instruction: '', seed: 0 },
  {
    id: 'spk_narrator',
    name: 'Narrator',
    language: 'English',
    emotion: 'neutral',
    instruction: 'A warm, measured narrator voice.',
    seed: 0,
  },
]

export const SPEECH_EMOTIONS = [
  ['neutral', 'Neutral'],
  ['happy', 'Happy'],
  ['sad', 'Sad'],
  ['angry', 'Angry'],
  ['whisper', 'Whisper'],
  ['fearful', 'Fearful'],
  ['surprised', 'Surprised'],
  ['disgusted', 'Disgusted'],
  ['custom', 'Custom'],
] as const

export const LTX_SHOT_TYPES = [
  'extreme close-up',
  'close-up',
  'medium close-up',
  'medium shot',
  'medium wide shot',
  'wide shot',
  'establishing shot',
  'selfie close-up',
  'selfie medium shot',
  'over-the-shoulder shot',
  'overhead shot',
]

export const LTX_CAMERAS = [
  'is static',
  'slowly dollies in',
  'slowly dollies out',
  'is handheld',
  'is handheld and tracking',
  'tracks the subject',
  'pans across the scene',
  'zooms in',
  'zooms out',
  'slowly orbits the subject',
]

export function looksLikeGuid(value: unknown): boolean {
  const text = String(value ?? '').trim()
  return (
    /^[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}$/i.test(text) ||
    /^[0-9a-f]{32}$/i.test(text)
  )
}

export function loadCustomPresets<T>(key: string): T[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) || '[]')
    return Array.isArray(parsed) ? (parsed as T[]) : []
  } catch {
    return []
  }
}

export function saveCustomPreset<T extends { id?: string; name?: string }>(key: string, preset: T): T[] {
  const custom = loadCustomPresets<T>(key).filter((item) => item && item.id && item.name)
  const next = [...custom, preset]
  localStorage.setItem(key, JSON.stringify(next))
  return next
}

export function getH3Presets(): H3Preset[] {
  const custom = loadCustomPresets<H3Preset>('pulse_h3_presets').filter(
    (preset) => preset && preset.id && preset.name,
  )
  return [...H3_PROMPT_PRESETS, ...custom]
}

export function getLtxPresets(): LtxPreset[] {
  const custom = loadCustomPresets<LtxPreset>('pulse_ltx_presets').filter(
    (preset) => preset && preset.id && preset.name,
  )
  return [...LTX_PROMPT_PRESETS, ...custom]
}

export function initH3StateFromAttachments(tab: PromptTab, forceScene = false): H3PromptState {
  const images = tab.attachments.filter((attachment) => attachment.type === 'image')
  const audios = tab.attachments.filter((attachment) => attachment.type === 'audio')
  const prev: Partial<H3PromptState> = tab.h3 ?? {}
  const prevSubjects: Partial<H3Subject>[] = Array.isArray(prev.subjects) ? prev.subjects : []
  const prevAudios: Partial<H3Audio>[] = Array.isArray(prev.audios) ? prev.audios : []
  const inputVal = (tab.prompt || '').trim()
  const sceneFromInput = inputVal && !/^\s*subject_definitions:/i.test(inputVal) ? inputVal : ''
  const firstImage = images[0]
  const sceneDefault = firstImage?.prompt || ''

  return {
    enabled: Boolean(prev.enabled),
    preset: prev.preset || 'none',
    scene: forceScene ? sceneDefault : prev.scene || sceneFromInput || sceneDefault,
    hasSpeech: prev.hasSpeech != null ? Boolean(prev.hasSpeech) : false,
    subjects: images.map((image, index) => {
      const old = prevSubjects[index] || {}
      const rawFallback = (image.prompt || (image.name || '').replace(/\.[^.]+$/, '') || '').trim()
      const fallback = looksLikeGuid(rawFallback) ? '' : rawFallback
      return {
        description: old.description || fallback,
        details: old.details || '',
        retention: old.retention || 'fully_preserved',
      }
    }),
    audios: audios.map((_attachment, index) => {
      const old = prevAudios[index] || {}
      return {
        type: old.type || 'speech',
        subjectIndex: Number.isInteger(old.subjectIndex) ? Number(old.subjectIndex) : 0,
        retention: old.retention || (old.type === 'speech' ? 'reference' : 'fully_copy'),
        language: old.language || 'English',
        description: old.description || '',
      }
    }),
    dialogue:
      Array.isArray(prev.dialogue) && prev.dialogue.length
        ? prev.dialogue.map((line) => ({ ...line }))
        : [{ speaker: 1, language: 'English', text: '' }],
  }
}

export function buildH3AutoPrompt(tab: PromptTab): string {
  const h3: Partial<H3PromptState> = tab.h3 ?? {}
  const images = tab.attachments.filter((attachment) => attachment.type === 'image')
  const audios = tab.attachments.filter((attachment) => attachment.type === 'audio')
  const prevSubjects = Array.isArray(h3.subjects) ? h3.subjects : []
  const prevAudios = Array.isArray(h3.audios) ? h3.audios : []
  const subjects: H3Subject[] = images.map(
    (_, index) => prevSubjects[index] || { description: '', details: '', retention: 'fully_preserved' },
  )
  const audioDefs: H3Audio[] = audios.map(
    (_, index) =>
      prevAudios[index] || {
        type: 'speech',
        subjectIndex: 0,
        retention: 'reference',
        language: 'English',
        description: '',
      },
  )
  const lines = ['subject_definitions:']

  subjects.forEach((subject, index) => {
    const description = (subject.description || '').trim() || `the subject shown in <Picture ${index + 1}>`
    lines.push(`<Subject ${index + 1}> is ${description}.`)
    const details = (subject.details || '').trim()
    if (details) lines.push(`<Subject ${index + 1}> has ${details}.`)
  })
  audioDefs.forEach((audio, index) => {
    if (audio.type === 'speech') {
      if (subjects.length) {
        const subjectIndex = Math.min(
          Math.max(0, Number(audio.subjectIndex) || 0),
          subjects.length - 1,
        )
        lines.push(
          `<Audio ${index + 1}> is the voice-timbre reference for <Subject ${subjectIndex + 1}> (S${subjectIndex + 1}).`,
        )
      } else {
        lines.push(`<Audio ${index + 1}> is the voice-timbre reference for the speaker (S1).`)
      }
    } else {
      const label = audio.type === 'music' ? 'music' : 'ambient sound'
      const extra = (audio.description || '').trim()
      lines.push(`<Audio ${index + 1}> is a ${label} reference${extra ? ': ' + extra : '.'}`)
    }
  })
  lines.push('')

  const subjectTags = subjects.map((_, index) => `<Subject ${index + 1}> (S${index + 1})`).join(', ')
  const audioTags = audioDefs.map((_, index) => `<Audio ${index + 1}>`).join(', ')
  lines.push('summary:')
  const hasSpeechAudio = audioDefs.some((audio) => audio.type === 'speech')
  if (audioDefs.length && subjects.length) {
    if (hasSpeechAudio) {
      lines.push(
        `[reference generation + audio reference] The target video features ${subjectTags}, with ${audioTags} used as audio references.`,
      )
    } else {
      lines.push(
        `[reference generation + audio] The target video features ${subjectTags}, with ${audioTags} used as the audio track.`,
      )
    }
  } else if (subjects.length) {
    lines.push(`[reference generation] The target video features ${subjectTags} from the attached reference images.`)
  } else if (audioDefs.length) {
    lines.push(`[audio reference] The target video uses ${audioTags} as audio references.`)
  } else {
    lines.push('[reference generation] The target video is generated from the prompt.')
  }
  lines.push('')

  lines.push('retention_analysis:')
  subjects.forEach((subject, index) => {
    const retention = subject.retention || 'fully_preserved'
    lines.push(
      `<Subject ${index + 1}> (appears in [Shot 1]): ${retention} - the subject from <Picture ${index + 1}> is retained.`,
    )
  })
  audioDefs.forEach((audio, index) => {
    const retention = audio.retention || (audio.type === 'speech' ? 'reference' : 'fully_copy')
    if (audio.type === 'speech') {
      if (subjects.length) {
        const subjectIndex = Math.min(
          Math.max(0, Number(audio.subjectIndex) || 0),
          subjects.length - 1,
        )
        if (retention === 'fully_copy') {
          lines.push(`<Audio ${index + 1}>: fully_copy - <Audio ${index + 1}> is reused 1:1 as the final audio.`)
        } else {
          lines.push(
            `<Audio ${index + 1}>: reference - <Subject ${subjectIndex + 1}> (S${subjectIndex + 1}) follows <Audio ${index + 1}>'s voice timbre without copying the original signal.`,
          )
        }
      } else {
        lines.push(`<Audio ${index + 1}>: ${retention} - the voice reference is used for the speaker.`)
      }
    } else {
      const label = audio.type === 'music' ? 'music track' : 'ambient track'
      lines.push(`<Audio ${index + 1}>: ${retention} - <Audio ${index + 1}> is used as the ${label}.`)
    }
  })
  lines.push('')

  lines.push('detailed_description:')
  lines.push('[Shot 1] ' + ((h3.scene || '').trim() || 'A cinematic shot.'))
  if (h3.hasSpeech) {
    ;(h3.dialogue || []).forEach((line) => {
      const text = (line.text || '').trim()
      if (!text) return
      const speaker = Number(line.speaker) || 0
      const language = (line.language || 'English').trim() || 'English'
      if (speaker > 0 && speaker <= subjects.length) {
        lines.push(`<Subject ${speaker}> (S${speaker}) says, <d>[${language}] ${text}</d>`)
      } else {
        lines.push(`A voice (S${speaker || 1}) says, <d>[${language}] ${text}</d>`)
      }
    })
  }
  return lines.join('\n')
}

export function initLtxStateFromAttachments(tab: PromptTab): LtxPromptState {
  const images = tab.attachments.filter((attachment) => attachment.type === 'image')
  const audios = tab.attachments.filter((attachment) => attachment.type === 'audio')
  const prev: Partial<LtxPromptState> = tab.ltx ?? {}
  const firstImage = images[0]
  const rawSubject = firstImage ? firstImage.prompt || (firstImage.name || '').replace(/\.[^.]+$/, '') || '' : ''
  const subjectDefault = looksLikeGuid(rawSubject) ? '' : rawSubject

  return {
    enabled: Boolean(prev.enabled),
    preset: prev.preset || 'none',
    shotType: prev.shotType || 'medium shot',
    subject: prev.subject != null ? prev.subject : subjectDefault,
    action: prev.action || '',
    setting: prev.setting || '',
    camera: prev.camera || 'is static',
    lighting: prev.lighting || '',
    style: prev.style || 'cinematic',
    audioType: prev.audioType || (audios.length ? 'music' : 'none'),
    audioDescription: prev.audioDescription || '',
    hasSpeech: prev.hasSpeech != null ? Boolean(prev.hasSpeech) : false,
    dialogue: Array.isArray(prev.dialogue)
      ? prev.dialogue.map((line) => ({ ...line }))
      : [{ speaker: 'subject', language: 'English', text: '' }],
  }
}

export function buildLtxAutoPrompt(tab: PromptTab): string {
  const ltx: Partial<LtxPromptState> = tab.ltx ?? {}
  const images = tab.attachments.filter((attachment) => attachment.type === 'image')
  const audios = tab.attachments.filter((attachment) => attachment.type === 'audio')
  const hasImage = images.length > 0
  const hasAudio = audios.length > 0
  const subject = (ltx.subject || '').trim()
  const action = (ltx.action || '').trim()
  const setting = (ltx.setting || '').trim()
  const shotType = (ltx.shotType || '').trim()
  const camera = (ltx.camera || '').trim()
  const lighting = (ltx.lighting || '').trim()
  const style = (ltx.style || '').trim()
  const audioType = ltx.audioType || 'none'
  const audioDescription = (ltx.audioDescription || '').trim()
  const hasSpeech = Boolean(ltx.hasSpeech) || audioType === 'speech'

  const parts: string[] = []
  if (!hasImage) {
    let sentence = ''
    if (shotType) sentence += shotType + ' of '
    sentence += subject || 'a subject'
    if (action) sentence += ', ' + action
    if (setting) sentence += ', in ' + setting
    parts.push(sentence + '.')
  } else {
    let sentence = subject ? subject + ' ' : ''
    sentence += action || 'moves naturally'
    parts.push(sentence + '.')
    if (setting) parts.push('The scene is ' + setting + '.')
  }
  if (camera) parts.push('The camera ' + camera + '.')
  if (lighting) parts.push('The scene is lit by ' + lighting + '.')
  if (style) parts.push('The visual style is ' + style + '.')
  if (hasAudio) {
    if (audioType === 'speech') parts.push('The audio features spoken dialogue.')
    else if (audioType === 'music')
      parts.push(audioDescription ? 'Music: ' + audioDescription + '.' : 'Music plays in the background.')
    else if (audioType === 'ambient')
      parts.push(audioDescription ? 'Ambient sound: ' + audioDescription + '.' : 'Ambient sound fills the scene.')
  }
  if (hasSpeech) {
    ;(ltx.dialogue || []).forEach((line) => {
      const text = (line.text || '').trim()
      if (!text) return
      const language = (line.language || 'English').trim()
      const speaker = line.speaker || 'subject'
      const rawLabel = speaker === 'subject' ? subject || 'The subject' : speaker
      const speakerLabel = rawLabel.charAt(0).toUpperCase() + rawLabel.slice(1)
      const langPart = language && language.toLowerCase() !== 'english' ? ` in ${language}` : ''
      const lineText = /[.!?]$/.test(text) ? text : text + '.'
      parts.push(`${speakerLabel} says${langPart}, "${lineText}"`)
    })
  }
  return parts.filter(Boolean).join(' ')
}
