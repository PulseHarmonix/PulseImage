export type AssetType = 'image' | 'video' | 'audio'
export type PromptMode = 'image' | 'video' | 'speech'
export type AudioMode = 'off' | 'normalize' | 'enhance' | 'source'

export interface Attachment {
  id?: string
  name: string
  displayName?: string
  type: 'image' | 'audio' | 'voice' | 'video' | 'lora'
  src?: string
  prompt?: string
  aspect?: number
  voice?: boolean
}

export interface GenUpscale {
  status?: 'done' | 'failed' | 'skipped' | 'success'
  engine?: string
  model?: string
  detail?: number
  source_filename?: string
  original_filename?: string
  original_width?: number
  original_height?: number
  width?: number
  height?: number
  error?: string
}

export interface GenMetadata {
  mode?: string
  resolution?: string
  aspect_ratio?: string
  duration?: number | null
  enhancer_id?: string
  original_prompt?: string
  image_model?: string
  i2i_model?: string
  image_edit_model?: string
  video_model?: string
  ltx_version?: string
  fasth3_mode?: string
  video_upscale?: string
  upscale?: GenUpscale
  audio_enhance?: Record<string, unknown>
  attachments?: {
    images?: Attachment[]
    audios?: Attachment[]
    audio?: Attachment | null
    lora?: Attachment | null
  }
  h3?: Record<string, unknown>
  ltx?: Record<string, unknown>
  [key: string]: unknown
}

export interface Asset {
  id: string
  type: AssetType
  prompt?: string
  filename: string
  width?: number
  height?: number
  aspect_ratio?: string
  duration?: number
  parent_id?: string | null
  metadata?: {
    gen?: GenMetadata
    duration?: number
    name?: string
    voice?: VoiceMetadata
    [key: string]: unknown
  }
  created?: string
  last_updated?: string
  favorite?: boolean
  character?: boolean
  voice?: boolean
  children?: string[]
}

export interface PromptEnhancer {
  id: string
  name: string
  prompt: string
}

export interface VoiceMetadata {
  transcript?: string
  language?: string
  engine?: string
  [key: string]: unknown
}

export interface AdminSetting {
  key: string
  value: string
  updated_at?: string
}

export interface AppSettings {
  image_model?: string
  i2i_model?: string
  video_model?: string
  ltx_version?: string
  fasth3_mode?: string
  video_upscale?: string
  relayvsr_detail?: number
  relayvsr_timeout_seconds?: number
  qwen_turbo?: boolean
  tts_engine?: string
  comfyui_url?: string
  ollama_url?: string
  ollama_model?: string
  prompt_enhancers?: Partial<PromptEnhancer>[]
  library_density?: 'full' | 'compact'
  library_filters?: string[]
  library_video_playback?: '1st_frame' | 'play_loop'
  segment_timecode_offsets?: Record<string, number>
  [key: string]: unknown
}

export interface SpeechConfig {
  engine: string
  language: string
  emotion: string
  instruction: string
  seed: number
  ref_text: string
}

export type H3AudioType = 'speech' | 'music' | 'ambient'
export type H3SubjectRetention = 'fully_preserved' | 'partially_preserved' | 'reference'
export type H3AudioRetention = 'reference' | 'fully_copy'

export interface H3Subject {
  description: string
  details: string
  retention: H3SubjectRetention
}

export interface H3Audio {
  type: H3AudioType
  subjectIndex: number
  retention: H3AudioRetention
  language: string
  description: string
}

export interface H3DialogueLine {
  speaker: number
  language: string
  text: string
}

export interface H3PromptState {
  enabled: boolean
  preset: string
  scene: string
  hasSpeech: boolean
  subjects: H3Subject[]
  audios: H3Audio[]
  dialogue: H3DialogueLine[]
}

export type LtxAudioType = 'none' | 'ambient' | 'music' | 'speech'

export interface LtxDialogueLine {
  speaker: 'subject' | 'A voice'
  language: string
  text: string
}

export interface LtxPromptState {
  enabled: boolean
  preset: string
  shotType: string
  subject: string
  action: string
  setting: string
  camera: string
  lighting: string
  style: string
  audioType: LtxAudioType
  audioDescription: string
  hasSpeech: boolean
  dialogue: LtxDialogueLine[]
}

export interface PromptTab {
  id: string
  label: string
  prompt: string
  mode: PromptMode
  imageModel: string
  i2iModel: string
  videoModel: string
  ltxVersion: string
  fasth3Mode: string
  resolution: string
  aspect: string
  duration: number
  enhancer: string
  upscale: boolean | null
  audio: AudioMode
  attachments: Attachment[]
  speech: SpeechConfig
  h3?: H3PromptState
  ltx?: LtxPromptState
}

export interface TtsEngine {
  id: string
  label: string
  installed?: boolean
  default_language?: string
  languages?: string[]
  controls?: Record<string, boolean>
  node_pack?: string
  model?: string
}

export interface ComfyStatus {
  connected: boolean
  url?: string
}

export interface RelayStatus {
  available: boolean
  nodes_ok: boolean
  models_ok: boolean
  missing: string[]
  model?: string
  vae?: string
  url?: string
}

export interface ProgressSnapshot {
  job_id?: string
  index?: number
  stage?: 'generating' | 'upscaling' | 'enhancing_audio' | string
  state?: string
  error?: string
  node_id?: string
  node_title?: string
  node_percent?: number
  workflow_percent?: number
  queue_remaining?: number
}

export interface GeneratedResult {
  success: boolean
  error?: string
  filename?: string
  local_filename?: string
  width?: number
  height?: number
  duration?: number
  fps?: number
  upscale?: GenUpscale
  type?: string
}

export interface GenerateResponse {
  success: boolean
  error?: string
  results?: GeneratedResult[]
}

export interface QueueJob {
  id: string
  label: string
  mode: PromptMode | 'upscale' | 'audio'
  status: 'queued' | 'running' | 'done' | 'error'
  progress: number
  stage?: string
  error?: string
  startedAt: number
  finishedAt?: number
}

export interface ToastMessage {
  id: string
  title: string
  description?: string
  tone?: 'default' | 'success' | 'error' | 'warning'
}

export interface MusicProject {
  id: string
  title: string
  settings?: Record<string, unknown>
  audio?: Record<string, unknown>
  slots?: unknown[]
  created?: string
  last_updated?: string
  [key: string]: unknown
}

export interface FrameInfo {
  index: number
  time?: number
  filename?: string
  src?: string
  [key: string]: unknown
}
