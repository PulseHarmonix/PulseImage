export type AssetType = 'image' | 'video' | 'audio'
export type PromptMode = 'image' | 'video' | 'speech'
export type AudioMode = 'off' | 'normalize' | 'enhance' | 'source'

export type RecastEngine = 'fasth3' | 'ltx23' | 'ltx25'

export type RecastReferenceFit = 'pad' | 'crop'
export type RecastSourceControl = 'raw' | 'canny' | 'pose' | 'depth'

export interface RecastSettings {
  preserve: string[]
  audio_mode: 'mute' | 'copy' | 'reference'
  start_image_mode: 'first_frame_identity' | 'identity' | 'first_frame'
  source_guide_strength: number
  reference_fit: RecastReferenceFit
  source_control: RecastSourceControl
  control_attention_strength: number
  start_image_strength: number
  ref_image_strength: number
  source_start: number
  seed: number | null
  negative_prompt: string
  prompt_enhance: boolean
  sampler_name: string
}

export interface Attachment {
  id?: string
  name: string
  displayName?: string
  type: 'image' | 'audio' | 'voice' | 'video' | 'lora'
  src?: string
  prompt?: string
  aspect?: number
  duration?: number
  voice?: boolean
}

export interface GenUpscale {
  status?: 'done' | 'failed' | 'skipped' | 'success'
  engine?: string
  model?: string
  factor?: number
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
    videos?: Attachment[]
    audio?: Attachment | null
    lora?: Attachment | null
  }
  recast?: boolean
  recast_engine?: RecastEngine
  ref_video?: string
  source_image?: string
  recast_settings?: RecastSettings
  h3?: Record<string, unknown>
  ltx?: Record<string, unknown>
  motion?: {
    preset_id: string
    preset_name: string
    source_asset_id?: string
    model: 'ltx' | 'fasth3'
    ltx_version?: string
    fasth3_mode?: string
    prompt?: string
  }
  [key: string]: unknown
}

export interface CharacterProfile {
  name?: string
  description?: string
  appearance?: string
  wardrobe?: string
  aliases?: string
  tags?: string[]
  references?: string[]
  voice_asset_id?: string
  prompt?: string
  negative_prompt?: string
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
    character_profile?: CharacterProfile
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
  generation_idle_timeout_seconds?: number
  generation_max_timeout_seconds?: number
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
  recastSettings: RecastSettings
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

export interface ReCaVSRStatus {
  available: boolean
  implemented: boolean
  nodes_ok: boolean
  models_ok: boolean
  missing: string[]
  model?: string
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
  asset_id?: string
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

export type StoryContinuityMode =
  | 'new_scene'
  | 'same_scene_frame'
  | 'same_scene_video'
  | 'match_cut'
  | 'none'

export type StoryShotStatus =
  | 'draft'
  | 'keyframes_ready'
  | 'keyframe_approved'
  | 'generating'
  | 'ready'
  | 'error'

export interface StorySettings {
  video_model: 'fasth3'
  resolution: string
  aspect_ratio: string
  style: string
  target_duration: number
  image_model?: string
}

export interface Story {
  id: string
  title: string
  premise: string
  settings: StorySettings
  created?: string
  last_updated?: string
}

export type StorySummary = Story

export interface StoryCast {
  character_asset_id: string
  role_name: string
  notes: string
  name?: string
  filename?: string
  profile?: CharacterProfile
}

export interface StoryKeyframeFrame {
  index: number
  time: number
  url: string
}

export type StorySceneAssetRole = 'background' | 'prop' | 'reference'

export interface StorySceneAsset {
  id: string
  scene_id: string
  asset_id: string
  role: StorySceneAssetRole
  label: string
  notes: string
  filename: string
  prompt: string
  metadata?: Record<string, unknown>
  width?: number
  height?: number
}

export interface StoryShot {
  id: string
  scene_id: string
  shot_number: number
  duration: number
  action: string
  camera: string
  image_prompt: string
  video_prompt: string
  character_asset_ids: string[]
  continuity_mode: StoryContinuityMode
  parent_shot_id?: string | null
  status: StoryShotStatus
  selected_image_id?: string | null
  candidate_image_ids?: string[]
  video_asset_id?: string | null
  video_filename?: string | null
  error?: string | null
  settings?: Record<string, unknown>
}

export interface StoryScene {
  id: string
  story_id: string
  scene_number: number
  title: string
  synopsis: string
  location: string
  time_of_day: string
  mood: string
  lighting?: string
  weather?: string
  palette?: string
  negative_prompt?: string
  anchor_image_id?: string | null
  anchor_frames?: StoryKeyframeFrame[]
  anchor_source_video?: string | null
  anchor_frame_index?: number | null
  assets?: StorySceneAsset[]
  shots: StoryShot[]
}

export interface StoryDetail {
  story: Story
  cast: StoryCast[]
  scenes: StoryScene[]
}
