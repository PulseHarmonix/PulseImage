import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight,
  AudioLines,
  Check,
  Cpu,
  Image as ImageIcon,
  Layers3,
  RefreshCcw,
  ShieldCheck,
  Sparkles,
  Video,
  Zap,
} from 'lucide-react'
import {
  useComfyStatus,
  useRelayCapabilities,
  useSettings,
  useStemCapabilities,
  useTtsEngines,
  useUpdateSettings,
} from '../lib/queries'
import { apiGet } from '../lib/api'
import { PageHeader } from '../components/shell/PageHeader'
import { PageContainer } from '../components/shell/PageContainer'
import { Badge, Button, Select } from '../components/ui'
import { useUiStore } from '../stores/ui'
import { cn } from '../lib/utils'

const imageModels = ['schnell', 'klein', 'qwen', 'grok', 'grok-quality']
const editModels = ['klein', 'flux2', 'grok', 'grok-quality']
const videoModels = ['ltx', 'fasth3', 'grok']

type ModelCategory = 'checkpoints' | 'loras' | 'vaes' | 'clips' | 'upscalers'

const REQUIRED_WORKFLOW_MODELS: Record<ModelCategory, string[]> = {
  checkpoints: [
    'flux1-schnell-fp8.safetensors',
    'flux-2-klein-base-9b-fp8.safetensors',
    'ltx-2.3-22b-dev-fp8.safetensors',
    'flux2_dev_fp8mixed.safetensors',
    'flux1-schnell.safetensors',
    'qwen_image_2512_fp8_e4m3fn.safetensors',
    'relayvsr_x2_lightx2v_int8_convrot.safetensors',
  ],
  loras: [
    'Flux_2-Turbo-LoRA_comfyui.safetensors',
    'woman1ai.safetensors',
    'ltx_2.3_22b_distilled_1.1_lora_dynamic_fro09_avg_rank_111_bf16.safetensors',
    'gemma-3-12b-it-abliterated_lora_rank64_bf16.safetensors',
    'Qwen-Image-2512-Lightning-4steps-V1.0-fp32.safetensors',
  ],
  vaes: [
    'full_encoder_small_decoder.safetensors',
    'ae.safetensors',
    'qwen_image_vae.safetensors',
    'relayvsr_flash_vae_x2_fp32.safetensors',
  ],
  clips: [
    'mistral_3_small_flux2_bf16.safetensors',
    'qwen_3_8b_fp8mixed.safetensors',
    't5xxl_fp16.safetensors',
    'clip_l.safetensors',
    'qwen_2.5_vl_7b_fp8_scaled.safetensors',
    'gemma_3_12B_it_fp4_mixed.safetensors',
  ],
  upscalers: [
    'ltx-2.3-spatial-upscaler-x2-1.1.safetensors',
    'ltx-2.5-latent-spatial-upscaler-x2-bf16-1.0.safetensors',
  ],
}

const categoryLabels: Record<ModelCategory, string> = {
  checkpoints: 'Checkpoints',
  loras: 'LoRAs',
  vaes: 'VAEs',
  clips: 'CLIP / Text encoders',
  upscalers: 'Upscalers',
}

interface ComfyModels {
  connected?: boolean
  checkpoints?: string[]
  loras?: string[]
  vaes?: string[]
  clips?: string[]
  upscalers?: string[]
  error?: string
}

const emptyModels: ComfyModels = {
  checkpoints: [],
  loras: [],
  vaes: [],
  clips: [],
  upscalers: [],
}

export function ModelsPage() {
  const settings = useSettings()
  const engines = useTtsEngines()
  const comfy = useComfyStatus()
  const relay = useRelayCapabilities()
  const stems = useStemCapabilities()
  const updateSettings = useUpdateSettings()
  const toast = useUiStore((s) => s.toast)
  const [models, setModels] = useState<ComfyModels>(emptyModels)
  const [loras, setLoras] = useState<string[]>([])
  const [refreshing, setRefreshing] = useState(false)
  const [lorasRefreshing, setLorasRefreshing] = useState(false)
  const [saved, setSaved] = useState(false)

  const save = async (updates: Record<string, unknown>) => {
    await updateSettings(updates)
    setSaved(true)
    window.setTimeout(() => setSaved(false), 1200)
  }

  const refreshModels = useCallback(async () => {
    setRefreshing(true)
    try {
      const result = await apiGet<ComfyModels>('/comfy/models')
      setModels(result)
      if (result.connected === false) {
        toast({
          title: 'ComfyUI unreachable',
          description: result.error || 'Start the ComfyUI server and scan again.',
          tone: 'error',
        })
      }
    } catch (error) {
      toast({
        title: 'Could not scan models',
        description: error instanceof Error ? error.message : undefined,
        tone: 'error',
      })
    } finally {
      setRefreshing(false)
    }
  }, [toast])

  const refreshLoras = useCallback(async (refresh = false) => {
    setLorasRefreshing(true)
    try {
      const result = await apiGet<{ loras?: string[] }>(`/loras${refresh ? '?refresh=true' : ''}`)
      setLoras(result.loras ?? [])
    } catch (error) {
      toast({
        title: 'Could not load LoRAs',
        description: error instanceof Error ? error.message : undefined,
        tone: 'error',
      })
    } finally {
      setLorasRefreshing(false)
    }
  }, [toast])

  useEffect(() => {
    void refreshModels()
    void refreshLoras(false)
  }, [refreshModels, refreshLoras])

  const data = settings.data
  const relayStatus = relay.data?.relayvsr
  const recavsrStatus = relay.data?.recavsr
  const activeUpscale = data?.video_upscale || 'off'
  const recavsrHint = !recavsrStatus
    ? 'Checking'
    : !recavsrStatus.available
      ? 'Not installed'
      : !recavsrStatus.implemented
        ? 'Integration pending'
        : 'Ready'
  const relayHint = !relayStatus ? 'Checking' : relayStatus.available ? 'Ready' : 'Unavailable'
  const stemStatus = stems.data
  const enhancers = data?.prompt_enhancers ?? []
  const stemLabel = !stemStatus
    ? 'Checking'
    : stemStatus.available
      ? 'Ready'
      : !stemStatus.comfy_connected
        ? 'ComfyUI offline'
        : !stemStatus.node_installed
          ? 'Node missing'
          : 'Unavailable'

  const workflowProgress = useMemo(() => {
    let present = 0
    let total = 0
    for (const category of Object.keys(REQUIRED_WORKFLOW_MODELS) as ModelCategory[]) {
      const available = new Set(models[category] ?? [])
      for (const model of REQUIRED_WORKFLOW_MODELS[category]) {
        total += 1
        if (available.has(model)) present += 1
      }
    }
    return { present, total }
  }, [models])

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Models"
        title="Tune the engine room."
        description="Choose generation models, inspect ComfyUI assets, and check upscaler readiness."
        actions={
          <div className="flex items-center gap-2">
            {saved ? (
              <Badge tone="success">
                <Check className="size-2.5" /> Saved
              </Badge>
            ) : null}
            <Button
              variant="outline"
              onClick={() => {
                void refreshModels()
                void stems.refetch()
                void relay.refetch()
              }}
              busy={refreshing || stems.isFetching}
            >
              <RefreshCcw className="size-3.5" /> Refresh scan
            </Button>
          </div>
        }
      />

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Panel icon={<ImageIcon className="size-4" />} title="Image generation" subtitle="Text-to-image models">
          <div className="grid gap-2 sm:grid-cols-2">
            {imageModels.map((model) => (
              <Option
                key={model}
                active={data?.image_model === model}
                label={modelLabel(model)}
                onClick={() => void save({ image_model: model })}
              />
            ))}
          </div>
          <button
            onClick={() => void save({ qwen_turbo: !data?.qwen_turbo })}
            className="mt-3 flex w-full items-center justify-between gap-3 rounded-xl border border-line bg-white/[0.02] px-3 py-2.5 text-left transition hover:border-line-strong"
          >
            <span>
              <span className="block text-xs font-medium text-text">Qwen Turbo</span>
              <span className="mt-0.5 block text-[10px] text-text-3">Four-step Lightning LoRA for Qwen images</span>
            </span>
            <span
              className={cn(
                'relative h-5 w-9 shrink-0 rounded-full transition',
                data?.qwen_turbo ? 'bg-lime' : 'bg-white/10',
              )}
            >
              <span
                className={cn(
                  'absolute top-0.5 size-4 rounded-full transition-all',
                  data?.qwen_turbo ? 'left-[18px] bg-bg' : 'left-0.5 bg-text-3',
                )}
              />
            </span>
          </button>
        </Panel>
        <Panel icon={<Layers3 className="size-4" />} title="Image editing" subtitle="Reference and instruction models">
          <div className="grid gap-2 sm:grid-cols-2">
            {editModels.map((model) => (
              <Option
                key={model}
                active={data?.i2i_model === model}
                label={modelLabel(model)}
                onClick={() => void save({ i2i_model: model })}
              />
            ))}
          </div>
        </Panel>
        <Panel icon={<Video className="size-4" />} title="Video generation" subtitle="LTX, FastH3, and cloud video">
          <div className="grid gap-2 sm:grid-cols-3">
            {videoModels.map((model) => (
              <Option
                key={model}
                active={data?.video_model === model}
                label={model === 'fasth3' ? 'FastH3' : model === 'grok' ? 'Grok' : `LTX ${data?.ltx_version || '2.3'}`}
                onClick={() => void save({ video_model: model })}
              />
            ))}
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <Select
              value={data?.ltx_version || '2.3'}
              onChange={(event) => void save({ ltx_version: event.target.value })}
            >
              <option value="2.3">LTX 2.3</option>
              <option value="2.5">LTX 2.5</option>
            </Select>
            <Select
              value={data?.fasth3_mode || 'reference'}
              onChange={(event) => void save({ fasth3_mode: event.target.value })}
            >
              <option value="reference">FastH3 Reference</option>
              <option value="i2v">FastH3 First frame</option>
            </Select>
          </div>
        </Panel>
        <Panel icon={<AudioLines className="size-4" />} title="Speech engines" subtitle="Local TTS backends">
          <div className="grid gap-2 sm:grid-cols-2">
            {(engines.data ?? []).map((engine) => (
              <Option
                key={engine.id}
                active={data?.tts_engine === engine.id}
                label={engine.label}
                hint={engine.installed === false ? 'missing' : 'ready'}
                onClick={() => void save({ tts_engine: engine.id })}
              />
            ))}
          </div>
        </Panel>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Panel icon={<Zap className="size-4" />} title="Upscalers" subtitle="Default video post-upscale">
          <div className="grid gap-2 sm:grid-cols-3">
            <Option
              active={activeUpscale === 'off'}
              label="Off"
              hint="No upscale"
              onClick={() => void save({ video_upscale: 'off' })}
            />
            <Option
              active={activeUpscale === 'relayvsr_x2'}
              label="RelayVSR 2x"
              hint={relayHint}
              disabled={Boolean(relayStatus && !relayStatus.available)}
              onClick={() => void save({ video_upscale: 'relayvsr_x2' })}
            />
            <Option
              active={activeUpscale === 'recavsr_x4'}
              label="ReCaVSR 4x"
              hint={recavsrHint}
              disabled={!recavsrStatus?.implemented || !recavsrStatus?.available}
              onClick={() => void save({ video_upscale: 'recavsr_x4' })}
            />
          </div>
          <div className="mt-3 space-y-2 text-[11px]">
            <div className="flex items-start justify-between gap-3 rounded-xl border border-line bg-white/[0.02] px-3 py-2">
              <div className="min-w-0">
                <p className="text-[10px] font-medium text-text-2">RelayVSR 2x</p>
                <p className="mt-0.5 text-[10px] text-text-3">
                  {relayStatus?.available
                    ? 'Nodes and weights are ready.'
                    : relayStatus?.missing?.length
                      ? relayStatus.missing.join(' · ')
                      : relayStatus
                        ? 'Unavailable'
                        : 'Checking ComfyUI…'}
                </p>
              </div>
              <Badge tone={relayStatus?.available ? 'success' : relayStatus ? 'danger' : 'default'}>
                {relayHint}
              </Badge>
            </div>
            <div className="flex items-start justify-between gap-3 rounded-xl border border-line bg-white/[0.02] px-3 py-2">
              <div className="min-w-0">
                <p className="text-[10px] font-medium text-text-2">ReCaVSR 4x</p>
                <p className="mt-0.5 text-[10px] text-text-3">
                  {!recavsrStatus
                    ? 'Checking ComfyUI…'
                    : !recavsrStatus.available
                      ? recavsrStatus.missing?.length
                        ? recavsrStatus.missing.join(' · ')
                        : 'Not installed'
                      : !recavsrStatus.implemented
                        ? 'Nodes and weights are ready — integration is still pending.'
                        : recavsrStatus.model
                          ? `Nodes and weights are ready · ${recavsrStatus.model}`
                          : 'Nodes and weights are ready.'}
                </p>
              </div>
              <Badge
                tone={
                  !recavsrStatus
                    ? 'default'
                    : recavsrStatus.implemented && recavsrStatus.available
                      ? 'success'
                      : !recavsrStatus.implemented
                        ? 'warning'
                        : 'danger'
                }
              >
                {recavsrHint}
              </Badge>
            </div>
          </div>
          <p className="mt-2 text-[10px] text-text-3">
            Off disables upscaling by default. Per-generation overrides remain available.
            ReCaVSR 4x is limited to 4096 px per side / 4K output for H.264 playback.
          </p>
        </Panel>
        <Panel icon={<Cpu className="size-4" />} title="ComfyUI" subtitle="Server and workflow assets">
          <div className="flex items-center justify-between rounded-xl border border-line bg-white/[0.02] p-3">
            <div>
              <p className="text-xs font-medium">{comfy.data?.connected ? 'Connected' : 'Offline'}</p>
              <p className="mt-0.5 text-[10px] text-text-3">{comfy.data?.url || data?.comfyui_url}</p>
            </div>
            <Badge tone={comfy.data?.connected ? 'success' : 'danger'}>
              {comfy.data?.connected ? 'Online' : 'Offline'}
            </Badge>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
            <AssetCount label="Checkpoints" count={models.checkpoints?.length} />
            <AssetCount label="LoRAs" count={models.loras?.length} />
            <AssetCount label="VAEs" count={models.vaes?.length} />
            <AssetCount label="CLIPs" count={models.clips?.length} />
            <AssetCount label="Upscalers" count={models.upscalers?.length} />
          </div>
        </Panel>
        <Panel icon={<Layers3 className="size-4" />} title="Stems" subtitle="Audio stem separation">
          <div className="flex items-center justify-between gap-3 rounded-xl border border-line bg-white/[0.02] p-3">
            <div>
              <p className="text-xs font-medium">Status</p>
              <p className="mt-0.5 text-[11px] text-text-3">
                {stemStatus?.available
                  ? 'Separation node is installed. The model downloads on first use.'
                  : stemStatus?.error || 'ComfyUI-Demucs-AudioSeparator'}
              </p>
            </div>
            <Badge tone={!stemStatus ? 'default' : stemStatus.available ? 'success' : 'danger'}>
              {stemLabel}
            </Badge>
          </div>
          <div className="mt-3 space-y-2 text-[11px]">
            <div className="flex items-center justify-between gap-2 rounded-lg border border-line px-3 py-2">
              <span className="text-text-3">Node</span>
              <span className="truncate font-mono text-[10px] text-text-2">
                ComfyUI-Demucs-AudioSeparator
              </span>
            </div>
            <div className="flex items-center justify-between gap-2 rounded-lg border border-line px-3 py-2">
              <span className="text-text-3">Model</span>
              <span className="font-mono text-[10px] text-text-2">
                {stemStatus?.model || 'htdemucs_6s'}
              </span>
            </div>
          </div>
          <p className="mt-2 text-[10px] text-text-3">
            The model downloads on first separation. Install ComfyUI-Demucs-AudioSeparator in ComfyUI,
            then restart ComfyUI.
          </p>
        </Panel>
      </div>

      <section className="mt-4 rounded-2xl border border-line bg-white/[0.02] p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="grid size-8 place-items-center rounded-lg bg-lime-soft text-lime">
              <ShieldCheck className="size-4" />
            </span>
            <div>
              <p className="font-display text-sm font-semibold">Workflow Models</p>
              <p className="text-[10px] text-text-3">
                {models.connected === false
                  ? 'ComfyUI unreachable — start the server and scan again.'
                  : `${workflowProgress.present} of ${workflowProgress.total} required models present`}
              </p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => void refreshModels()} busy={refreshing}>
            <RefreshCcw className="size-3.5" /> Check models
          </Button>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {(Object.keys(REQUIRED_WORKFLOW_MODELS) as ModelCategory[]).map((category) => {
            const required = REQUIRED_WORKFLOW_MODELS[category]
            const available = new Set(models[category] ?? [])
            const present = required.filter((model) => available.has(model)).length
            return (
              <div key={category} className="rounded-xl border border-line bg-white/[0.015] p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-text-3">
                    {categoryLabels[category]}
                  </p>
                  <Badge tone={present === required.length ? 'success' : present ? 'warning' : 'danger'}>
                    {present}/{required.length}
                  </Badge>
                </div>
                <div className="mt-2 max-h-64 space-y-1 overflow-y-auto pr-1">
                  {required.map((model) => {
                    const isPresent = available.has(model)
                    return (
                      <div
                        key={model}
                        className="flex items-center justify-between gap-2 rounded-lg border border-line/60 px-2 py-1.5"
                        title={model}
                      >
                        <span className="truncate font-mono text-[10px] text-text-2">{model}</span>
                        <Badge tone={isPresent ? 'success' : 'danger'} className="shrink-0">
                          {isPresent ? 'Present' : 'Missing'}
                        </Badge>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      </section>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Panel
          icon={<Layers3 className="size-4" />}
          title="LoRAs"
          subtitle={`${loras.length} ${loras.length === 1 ? 'LoRA' : 'LoRAs'} available`}
        >
          <div className="flex items-center justify-between gap-2">
            <p className="text-[10px] text-text-3">Flux Schnell and workflow LoRAs reported by ComfyUI.</p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void refreshLoras(true)}
              busy={lorasRefreshing}
            >
              <RefreshCcw className="size-3.5" /> Refresh
            </Button>
          </div>
          <div className="mt-3 max-h-60 overflow-y-auto rounded-xl border border-line bg-black/20 p-2">
            {loras.length ? (
              <div className="space-y-1">
                {loras.map((lora) => (
                  <div key={lora} className="flex items-center gap-2 rounded-lg px-2 py-1.5">
                    <Layers3 className="size-3 shrink-0 text-text-3" />
                    <span className="truncate font-mono text-[10px] text-text-2" title={lora}>
                      {lora}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="p-3 text-center text-[11px] text-text-3">
                {lorasRefreshing ? 'Loading LoRAs…' : 'No LoRAs found.'}
              </p>
            )}
          </div>
        </Panel>

        <Panel
          icon={<Sparkles className="size-4" />}
          title="Prompt enhancers"
          subtitle={`${enhancers.length} defaults configured`}
        >
          <div className="flex flex-wrap gap-1.5">
            {enhancers.slice(0, 12).map((enhancer) => (
              <Badge key={enhancer.id}>{enhancer.name || enhancer.id}</Badge>
            ))}
            {!enhancers.length ? (
              <p className="text-[11px] text-text-3">No enhancers configured yet.</p>
            ) : null}
          </div>
          <Link
            to="/settings"
            className="mt-3 inline-flex items-center gap-1.5 text-[11px] font-medium text-lime transition hover:text-[#e2ff72]"
          >
            Edit prompt enhancers <ArrowRight className="size-3" />
          </Link>
        </Panel>
      </div>
    </PageContainer>
  )
}

function Panel({
  icon,
  title,
  subtitle,
  children,
}: {
  icon: React.ReactNode
  title: string
  subtitle: string
  children: React.ReactNode
}) {
  return (
    <section className="rounded-2xl border border-line bg-white/[0.02] p-4">
      <div className="mb-3 flex items-center gap-2">
        <span className="grid size-8 place-items-center rounded-lg bg-lime-soft text-lime">{icon}</span>
        <div>
          <p className="font-display text-sm font-semibold">{title}</p>
          <p className="text-[10px] text-text-3">{subtitle}</p>
        </div>
      </div>
      {children}
    </section>
  )
}

function Option({
  active,
  label,
  hint,
  disabled,
  onClick,
}: {
  active?: boolean
  label: string
  hint?: string
  disabled?: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'flex items-center justify-between gap-2 rounded-xl border px-3 py-2.5 text-left text-[11px] font-medium transition',
        active
          ? 'border-lime/30 bg-lime-soft text-lime'
          : 'border-line bg-white/[0.02] text-text-2',
        disabled
          ? 'cursor-not-allowed opacity-45'
          : active
            ? ''
            : 'hover:border-line-strong hover:text-text',
      )}
    >
      <span>{label}</span>
      {active ? <Check className="size-3" /> : hint ? <span className="text-[9px] text-text-3">{hint}</span> : null}
    </button>
  )
}

function AssetCount({ label, count }: { label: string; count?: number }) {
  return (
    <div className="rounded-lg border border-line px-3 py-2">
      <p className="text-[9px] uppercase tracking-wider text-text-3">{label}</p>
      <p className="font-display text-base font-semibold tabular-nums">{count ?? '—'}</p>
    </div>
  )
}

function modelLabel(model: string) {
  return {
    schnell: 'Flux Schnell',
    klein: 'Flux 2 Klein',
    qwen: 'Qwen 2.5 2512',
    grok: 'Grok Imagine',
    'grok-quality': 'Grok Quality',
    flux2: 'Flux 2',
  }[model] || model
}
