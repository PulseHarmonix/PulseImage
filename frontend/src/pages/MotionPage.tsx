import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { Camera, ExternalLink, Image as ImageIcon, Sparkles, X, Zap } from 'lucide-react'
import { useHistory, useRelayCapabilities, useSettings, queryKeys } from '../lib/queries'
import { mediaUrl } from '../lib/api'
import { assetDisplayName, toAttachment } from '../lib/assets'
import { runGeneration } from '../lib/generation'
import { upscaleEngineLabel, upscaleFactor } from '../lib/upscale'
import { BASE_VIDEO_RESOLUTIONS, videoResolutionsFor } from '../lib/videoResolutions'
import { createPromptTab } from '../stores/prompt'
import { useQueueStore } from '../stores/queue'
import { useUiStore } from '../stores/ui'
import { useMotionStore, type MotionModelChoice } from '../stores/motion'
import { PageContainer } from '../components/shell/PageContainer'
import { PageHeader } from '../components/shell/PageHeader'
import { MotionPresetPreview } from '../components/motion/MotionPresetPreview'
import {
  MOTION_PRESETS,
  buildMotionPrompt,
  type MotionPreset,
} from '../lib/motionPresets'
import { Badge, Button, EmptyState, Progress, Select, Spinner } from '../components/ui'
import { assetType, cn, formatDuration, parseMetadata } from '../lib/utils'

const modelOptions: { value: MotionModelChoice; label: string }[] = [
  { value: 'global', label: 'Settings default' },
  { value: 'ltx23', label: 'LTX 2.3' },
  { value: 'ltx25', label: 'LTX 2.5' },
  { value: 'fasth3', label: 'FastH3' },
]

const durationOptions = [4, 6, 8, 10, 15, 20, 30, 40, 50, 60]
const aspectOptions = ['16:9', '9:16', '1:1', '3:2', '2:3']
const galleryGroups: MotionPreset['group'][] = ['Camera', 'Dynamic']

export function MotionPage() {
  const history = useHistory()
  const settings = useSettings()
  const relay = useRelayCapabilities()
  const queryClient = useQueryClient()

  const inspectorId = useUiStore((s) => s.inspectorId)
  const openInspector = useUiStore((s) => s.openInspector)
  const toast = useUiStore((s) => s.toast)
  const queueAdd = useQueueStore((s) => s.add)
  const queueUpdate = useQueueStore((s) => s.update)
  const jobs = useQueueStore((s) => s.jobs)

  const presetId = useMotionStore((s) => s.presetId)
  const setPreset = useMotionStore((s) => s.setPreset)
  const modelMode = useMotionStore((s) => s.modelMode)
  const setModelMode = useMotionStore((s) => s.setModelMode)
  const duration = useMotionStore((s) => s.duration)
  const setDuration = useMotionStore((s) => s.setDuration)
  const resolution = useMotionStore((s) => s.resolution)
  const setResolution = useMotionStore((s) => s.setResolution)
  const aspect = useMotionStore((s) => s.aspect)
  const setAspect = useMotionStore((s) => s.setAspect)
  const upscale = useMotionStore((s) => s.upscale)
  const setUpscale = useMotionStore((s) => s.setUpscale)
  const sourceAssetId = useMotionStore((s) => s.sourceAssetId)
  const setSourceAssetId = useMotionStore((s) => s.setSourceAssetId)

  const [submitting, setSubmitting] = useState(false)
  const [activeJobId, setActiveJobId] = useState<string | null>(null)
  const [latestResultId, setLatestResultId] = useState<string | null>(null)

  const imageAssets = useMemo(
    () => (history.data ?? []).filter((asset) => assetType(asset) === 'image'),
    [history.data],
  )
  const previewImage = useMemo(() => {
    if (!inspectorId) return undefined
    return imageAssets.find((asset) => asset.id === inspectorId)
  }, [imageAssets, inspectorId])

  useEffect(() => {
    if (previewImage) setSourceAssetId(previewImage.id)
  }, [previewImage, setSourceAssetId])

  const sourceAsset = useMemo(
    () => imageAssets.find((asset) => asset.id === sourceAssetId) ?? previewImage,
    [imageAssets, sourceAssetId, previewImage],
  )
  const preset = useMemo(
    () => MOTION_PRESETS.find((item) => item.id === presetId),
    [presetId],
  )

  const resolved = useMemo(() => {
    const settingsVersion = settings.data?.ltx_version === '2.5' ? '2.5' : '2.3'
    if (modelMode === 'ltx23') return { videoModel: 'ltx' as const, ltxVersion: '2.3' }
    if (modelMode === 'ltx25') return { videoModel: 'ltx' as const, ltxVersion: '2.5' }
    if (modelMode === 'fasth3') {
      return { videoModel: 'fasth3' as const, ltxVersion: settingsVersion }
    }
    if (settings.data?.video_model === 'fasth3') {
      return { videoModel: 'fasth3' as const, ltxVersion: settingsVersion }
    }
    return { videoModel: 'ltx' as const, ltxVersion: settingsVersion }
  }, [modelMode, settings.data?.video_model, settings.data?.ltx_version])

  const isFastH3 = resolved.videoModel === 'fasth3'
  const resolutionOptions = useMemo(() => videoResolutionsFor(resolved.videoModel), [resolved.videoModel])
  const effectiveDuration = isFastH3 ? Math.min(duration, 15) : duration
  const activeUpscaleSetting = settings.data?.video_upscale
  const activeUpscaleEngineValue =
    activeUpscaleSetting && activeUpscaleSetting !== 'off'
      ? activeUpscaleSetting
      : 'relayvsr_x2'
  const upscaleEngine = upscaleEngineLabel(activeUpscaleEngineValue)
  const upscaleFactorValue = upscaleFactor(activeUpscaleEngineValue)
  const activeUpscaleIsRecavsr = activeUpscaleEngineValue.toLowerCase().includes('recavsr')
  const upscaleAvailable = activeUpscaleIsRecavsr
    ? relay.data?.recavsr
      ? relay.data.recavsr.available && relay.data.recavsr.implemented
      : undefined
    : relay.data?.relayvsr?.available
  const upscaleDisabled = upscaleAvailable === false
  const upscaleDisabledReason =
    activeUpscaleIsRecavsr && relay.data?.recavsr && !relay.data.recavsr.implemented
      ? 'integration pending'
      : 'is unavailable'
  const effectiveUpscale =
    upscale ?? Boolean(activeUpscaleSetting && activeUpscaleSetting !== 'off')

  useEffect(() => {
    if (!resolutionOptions.includes(resolution)) {
      setResolution('1080p')
    }
  }, [resolutionOptions, resolution, setResolution])

  const activeJob = activeJobId ? jobs.find((job) => job.id === activeJobId) : undefined
  const latestResult = latestResultId
    ? history.data?.find((asset) => asset.id === latestResultId)
    : undefined
  const latestMotion = latestResult
    ? parseMetadata(latestResult).gen?.motion
    : undefined
  const latestPresetName = latestMotion?.preset_name || preset?.name || 'Motion clip'
  const latestModelLabel =
    latestMotion?.model === 'fasth3'
      ? 'FastH3'
      : latestMotion?.model === 'ltx'
        ? `LTX ${latestMotion.ltx_version ?? resolved.ltxVersion}`
        : isFastH3
          ? 'FastH3'
          : `LTX ${resolved.ltxVersion}`

  const clearSource = () => {
    setSourceAssetId(null)
    if (previewImage) openInspector(null)
  }

  const generate = async () => {
    if (!preset || !sourceAsset || submitting) return
    setSubmitting(true)
    const tab = createPromptTab(1, {
      mode: 'video',
      label: preset.name,
      prompt: buildMotionPrompt(preset, resolved.videoModel),
      videoModel: resolved.videoModel,
      ltxVersion: resolved.ltxVersion,
      fasth3Mode: 'i2v',
      resolution,
      aspect,
      duration: effectiveDuration,
      upscale: effectiveUpscale,
      enhancer: 'none',
      attachments: [toAttachment(sourceAsset)],
    })
    try {
      await runGeneration(
        tab,
        settings.data,
        {
          onQueue: (job) => {
            queueAdd(job)
            setActiveJobId(job.id)
          },
          onProgress: (jobId, snapshot) => {
            const progress =
              snapshot.stage === 'upscaling'
                ? Math.max(55, snapshot.workflow_percent ?? 55)
                : snapshot.workflow_percent ?? 0
            queueUpdate(jobId, {
              status: snapshot.state === 'error' ? 'error' : 'running',
              progress,
              stage: snapshot.stage,
              error: snapshot.error,
            })
          },
          onComplete: (jobId) => {
            const current = useQueueStore.getState().jobs.find((job) => job.id === jobId)
            if (current?.status === 'error') return
            queueUpdate(jobId, {
              status: 'done',
              progress: 100,
              stage: 'done',
              finishedAt: Date.now(),
            })
            void queryClient.invalidateQueries({ queryKey: queryKeys.history })
          },
          onError: (jobId, error) => {
            queueUpdate(jobId, {
              status: 'error',
              error,
              finishedAt: Date.now(),
            })
            toast({ title: 'Motion generation failed', description: error, tone: 'error' })
          },
          onAsset: (assetId) => {
            setLatestResultId(assetId)
            void queryClient.invalidateQueries({ queryKey: queryKeys.history })
          },
        },
        {
          label: `${preset.name} · ${assetDisplayName(sourceAsset)}`,
          parentId: sourceAsset.id,
          extraMetadata: {
            motion: {
              preset_id: preset.id,
              preset_name: preset.name,
              source_asset_id: sourceAsset.id,
              model: resolved.videoModel,
              ltx_version: resolved.videoModel === 'ltx' ? resolved.ltxVersion : undefined,
              fasth3_mode: resolved.videoModel === 'fasth3' ? 'i2v' : undefined,
              prompt: tab.prompt,
            },
          },
        },
      )
    } catch {
      // runGeneration reports failures through onError.
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <PageContainer className="pb-12">
      <PageHeader
        eyebrow="Motion"
        title="Give a still a camera move."
        description="Pick a camera or motion preset, then bring a Library still to life with LTX or FastH3."
        actions={
          <Badge tone="lime">
            <Camera className="size-3" />
            {MOTION_PRESETS.length} presets
          </Badge>
        }
      />

      <div className="mt-6 grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)]">
        <section className="min-w-0 space-y-4">
          <div className="rounded-2xl border border-line bg-white/[0.02] p-4">
            <div className="flex items-start gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-lime-soft text-lime">
                <Sparkles className="size-4" />
              </span>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-display text-sm font-semibold text-text">
                    {preset?.name ?? 'No preset selected'}
                  </p>
                  {preset ? <Badge tone="lime">{preset.group}</Badge> : null}
                </div>
                <p className="mt-1 text-xs leading-5 text-text-2">
                  {preset?.description ?? 'Choose a preset below to start.'}
                </p>
                {preset ? (
                  <p className="mt-2 text-[10px] leading-4 text-text-3">{preset.prompt}</p>
                ) : null}
              </div>
            </div>
          </div>

          {galleryGroups.map((group) => {
            const items = MOTION_PRESETS.filter((item) => item.group === group)
            return (
              <div
                key={group}
                className="rounded-2xl border border-line bg-white/[0.02] p-4"
              >
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="font-display text-sm font-semibold text-text">{group}</p>
                    <p className="text-[10px] text-text-3">
                      {group === 'Camera'
                        ? 'Classic camera moves, smooth and controlled.'
                        : 'High-energy moves for dramatic beats.'}
                    </p>
                  </div>
                  <Badge>{items.length}</Badge>
                </div>
                <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {items.map((item) => {
                    const selected = item.id === presetId
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setPreset(item.id)}
                        className={cn(
                          'overflow-hidden rounded-xl border bg-black/20 p-1.5 text-left transition',
                          selected
                            ? 'border-lime ring-1 ring-lime/40'
                            : 'border-line hover:border-line-strong',
                        )}
                      >
                        <MotionPresetPreview preset={item} />
                        <div className="px-1 pb-1 pt-2">
                          <p
                            className={cn(
                              'truncate text-[11px] font-medium',
                              selected ? 'text-lime' : 'text-text',
                            )}
                          >
                            {item.name}
                          </p>
                          <p className="mt-0.5 line-clamp-2 text-[9px] leading-4 text-text-3">
                            {item.description}
                          </p>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </section>

        <aside className="min-w-0 space-y-3">
          <div className="rounded-2xl border border-line bg-white/[0.02] p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-display text-sm font-semibold text-text">
                  Selected from Library
                </p>
                <p className="text-[10px] text-text-3">The still that starts the shot.</p>
              </div>
              {sourceAsset ? (
                <button
                  type="button"
                  onClick={clearSource}
                  className="grid size-6 shrink-0 place-items-center rounded-md text-text-3 transition hover:bg-white/10 hover:text-text"
                  aria-label="Clear source image"
                  title="Clear source image"
                >
                  <X className="size-3.5" />
                </button>
              ) : null}
            </div>

            {sourceAsset ? (
              <>
                <img
                  src={mediaUrl(`/images/${sourceAsset.filename}`)}
                  alt={assetDisplayName(sourceAsset)}
                  className="mt-3 aspect-video w-full rounded-xl border border-line object-cover"
                />
                <p className="mt-2 truncate text-[11px] font-medium text-text">
                  {assetDisplayName(sourceAsset)}
                </p>
                <p className="text-[10px] text-text-3">
                  {sourceAsset.width && sourceAsset.height
                    ? `${sourceAsset.width} × ${sourceAsset.height}`
                    : 'Image'}
                </p>
              </>
            ) : (
              <div className="mt-3">
                <EmptyState
                  icon={<ImageIcon className="size-6" />}
                  title="No source image"
                  description="Open an image in the Library preview, then return here to give it a camera move."
                  action={
                    <Link
                      to="/library"
                      className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-line-strong px-3 text-xs font-medium text-text transition hover:bg-white/[0.05]"
                    >
                      Open Library
                      <ExternalLink className="size-3" />
                    </Link>
                  }
                />
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-line bg-white/[0.02] p-4">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="font-display text-sm font-semibold text-text">Shot settings</p>
                <p className="text-[10px] text-text-3">Model, resolution and duration.</p>
              </div>
              <Badge tone={isFastH3 ? 'warning' : 'lime'}>
                {isFastH3 ? 'FastH3' : 'LTX'}
              </Badge>
            </div>

            <div className="mt-3 space-y-2.5">
              <label className="block">
                <span className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-text-3">
                  Model
                </span>
                <Select
                  value={modelMode}
                  onChange={(event) => {
                    const nextMode = event.target.value as MotionModelChoice
                    setModelMode(nextMode)
                    if (nextMode === 'fasth3' && !BASE_VIDEO_RESOLUTIONS.includes(resolution)) {
                      setResolution('1080p')
                    }
                  }}
                >
                  {modelOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </Select>
              </label>

              <div className="grid grid-cols-2 gap-2">
                <label className="block">
                  <span className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-text-3">
                    Duration
                  </span>
                  <Select
                    value={effectiveDuration}
                    onChange={(event) => setDuration(Number(event.target.value))}
                  >
                    {durationOptions
                      .filter((value) => !isFastH3 || value <= 15)
                      .map((value) => (
                        <option key={value} value={value}>
                          {value}s
                        </option>
                      ))}
                  </Select>
                </label>
                <label className="block">
                  <span className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-text-3">
                    Resolution
                  </span>
                  <Select
                    value={resolution}
                    onChange={(event) => setResolution(event.target.value)}
                  >
                    {resolutionOptions.map((value) => (
                      <option key={value} value={value}>
                        {value}
                      </option>
                    ))}
                  </Select>
                </label>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <label className="block">
                  <span className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-text-3">
                    Aspect
                  </span>
                  <Select
                    value={aspect}
                    onChange={(event) => setAspect(event.target.value)}
                  >
                    {aspectOptions.map((value) => (
                      <option key={value} value={value}>
                        {value}
                      </option>
                    ))}
                  </Select>
                </label>
                <div>
                  <span className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-text-3">
                    Upscale
                  </span>
                  <button
                    type="button"
                    onClick={() => setUpscale(!effectiveUpscale)}
                    disabled={upscaleDisabled}
                    className={cn(
                      'flex h-9 w-full items-center justify-between gap-2 rounded-full border px-3 text-[11px] font-medium transition disabled:cursor-not-allowed disabled:opacity-45',
                      effectiveUpscale
                        ? 'border-lime/30 bg-lime-soft text-lime'
                        : 'border-line text-text-3 hover:border-line-strong hover:text-text-2',
                    )}
                    title={
                      upscaleDisabled
                        ? `${upscaleEngine} ${upscaleDisabledReason}`
                        : `${upscaleEngine} ${upscaleFactorValue}x upscale ${effectiveUpscale ? 'on' : 'off'}`
                    }
                  >
                    <span className="flex items-center gap-1.5">
                      <Zap className="size-3" />
                      {upscaleEngine} {upscaleFactorValue}x
                    </span>
                    <span>{effectiveUpscale ? 'On' : 'Off'}</span>
                  </button>
                </div>
              </div>

              {isFastH3 ? (
                <p className="text-[9px] leading-4 text-warning">
                  FastH3 is limited to 15s, so longer requests will be clipped to{' '}
                  {effectiveDuration}s.
                </p>
              ) : null}
            </div>

            <Button
              variant="primary"
              className="mt-3 w-full"
              disabled={!sourceAsset || !preset || submitting}
              busy={submitting}
              icon={<Camera className="size-3.5" />}
              onClick={() => void generate()}
            >
              {submitting ? 'Generating motion...' : 'Generate motion'}
            </Button>

            {submitting ? (
              <div className="mt-3 rounded-xl border border-line bg-black/20 p-2.5">
                {activeJob ? (
                  <>
                    <div className="flex items-center justify-between gap-2 text-[10px] text-text-3">
                      <span className="truncate">{activeJob.stage || 'generating'}</span>
                      <span>{Math.round(activeJob.progress)}%</span>
                    </div>
                    <Progress value={activeJob.progress} className="mt-1.5" />
                  </>
                ) : (
                  <div className="flex items-center gap-2 text-[10px] text-text-3">
                    <Spinner className="size-3" />
                    Preparing the shot...
                  </div>
                )}
              </div>
            ) : null}
          </div>

          {latestResult ? (
            <div className="rounded-2xl border border-lime/25 bg-lime-soft/20 p-4">
              <div className="flex items-center gap-2">
                <Camera className="size-4 text-lime" />
                <p className="font-display text-sm font-semibold text-text">
                  {latestPresetName}
                </p>
                <Badge tone="success">generated</Badge>
              </div>
              <video
                src={mediaUrl(`/videos/${latestResult.filename}`)}
                controls
                playsInline
                preload="metadata"
                className="mt-3 w-full rounded-xl border border-line bg-black"
              />
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <Badge>{latestModelLabel}</Badge>
                <Badge>
                  {formatDuration(latestResult.duration) || `${effectiveDuration}s`}
                </Badge>
              </div>
              <Button
                variant="soft"
                size="sm"
                className="mt-3 w-full"
                icon={<ExternalLink className="size-3.5" />}
                onClick={() => openInspector(latestResult.id)}
              >
                Open in Library
              </Button>
            </div>
          ) : null}
        </aside>
      </div>
    </PageContainer>
  )
}
