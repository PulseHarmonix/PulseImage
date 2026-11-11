import { useEffect, useMemo, useState } from 'react'
import {
  ArrowUpRight,
  AudioLines,
  ChevronLeft,
  ChevronRight,
  Download,
  FileMusic,
  Heart,
  Loader2,
  Maximize2,
  Music2,
  Sparkles,
  Star,
  Trash2,
  User,
  Video,
  Volume2,
  X,
  Zap,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { useHistory, useSettings, queryKeys } from '../../lib/queries'
import { apiDeleteGeneration, apiPost, apiUpdateGeneration, mediaUrl } from '../../lib/api'
import {
  assetAspect,
  assetDisplayName,
  attachmentsFromGen,
  inferResolution,
  parseGen,
  saveResult,
  toAttachment,
  watchProgress,
} from '../../lib/assets'
import { runSerializedGeneration } from '../../lib/generationQueue'
import { scoreViewFromAsset } from '../../lib/musicScore'
import { isMusicAsset } from '../../lib/musicTracks'
import { isStemAsset, stemMeta } from '../../lib/stems'
import { upscaleFactor, upscaleFactorFromAsset } from '../../lib/upscale'
import { usePromptStore } from '../../stores/prompt'
import { useMusicGeneratorStore } from '../../stores/musicGenerator'
import { useStemsStore } from '../../stores/stems'
import { useUiStore } from '../../stores/ui'
import { useQueueStore } from '../../stores/queue'
import { confirmAction } from '../../stores/confirm'
import {
  assetType,
  assetUrl,
  cn,
  downloadFilename,
  formatDuration,
  parseMetadata,
  titleFromPrompt,
  uid,
} from '../../lib/utils'
import { Badge, Button, IconButton } from '../ui'
import { ScorePanel } from '../music/ScorePanel'
import type {
  Asset,
  Attachment,
  GeneratedResult,
  GenerateResponse,
  GenMetadata,
  PromptTab,
} from '../../types'

export function AssetInspector() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const history = useHistory()
  const settings = useSettings()
  const inspectorId = useUiStore((s) => s.inspectorId)
  const openInspector = useUiStore((s) => s.openInspector)
  const toast = useUiStore((s) => s.toast)
  const openStems = useStemsStore((s) => s.openStems)
  const updateActive = usePromptStore((s) => s.updateActive)
  const updateMusicGenerator = useMusicGeneratorStore((s) => s.update)
  const addQueue = useQueueStore((s) => s.add)
  const updateQueue = useQueueStore((s) => s.update)
  const [busyAction, setBusyAction] = useState<null | 'upscale' | 'variations' | 'video'>(null)
  const [fullscreen, setFullscreen] = useState(false)
  const [scoreAssetId, setScoreAssetId] = useState<string | null>(null)
  const busy = busyAction !== null

  const assets = useMemo(() => history.data ?? [], [history.data])
  const asset = assets.find((item) => item.id === inspectorId)
  const index = asset ? assets.findIndex((item) => item.id === asset.id) : -1
  const related = useMemo(() => {
    if (!asset) return []
    const seen = new Set([asset.id])
    const result: Asset[] = []
    const add = (item?: Asset) => {
      if (!item || seen.has(item.id)) return
      seen.add(item.id)
      result.push(item)
    }

    if (asset.parent_id) {
      add(assets.find((item) => item.id === asset.parent_id))
      assets
        .filter((item) => item.parent_id === asset.parent_id && item.id !== asset.id)
        .forEach(add)
    }
    assets.filter((item) => item.parent_id === asset.id).forEach(add)

    return result.slice(0, 6)
  }, [asset, assets])

  useEffect(() => {
    if (!inspectorId) setFullscreen(false)
  }, [inspectorId])

  useEffect(() => {
    if (!fullscreen) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setFullscreen(false)
    }
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [fullscreen])

  if (!asset) return null

  const type = assetType(asset)
  const meta = parseMetadata(asset)
  const gen = parseGen(asset)
  const activeUpscaleSetting = settings.data?.video_upscale
  const activeUpscaleEngine =
    activeUpscaleSetting && activeUpscaleSetting !== 'off'
      ? activeUpscaleSetting
      : 'relayvsr_x2'
  const activeUpscaleFactor = upscaleFactor(activeUpscaleEngine)
  const assetUpscaleFactor = upscaleFactorFromAsset(asset)
  const assetUpscaleOn =
    Boolean(gen?.video_upscale && gen.video_upscale !== 'off') ||
    gen?.upscale?.status === 'done'
  const tts = asRecord(meta.tts)
  const music = asRecord(meta.music)
  const musicModel = metaString(music?.model)
  const fallbackVideo =
    type === 'video' && !gen?.video_model ? fallbackVideoModel(musicModel) : undefined
  const videoModel = gen?.video_model || fallbackVideo?.model
  const videoVersion = gen?.ltx_version || fallbackVideo?.version
  const speechEngine =
    type === 'audio'
      ? metaString(tts?.engine) || (meta.source === 'yue2' ? 'yue2' : undefined)
      : undefined
  const modelName =
    type === 'image'
      ? gen?.image_edit_model ||
        (gen?.attachments?.images?.length ? gen?.i2i_model : undefined) ||
        gen?.image_model
      : type === 'video'
        ? videoModel
        : type === 'audio'
          ? speechEngine
          : undefined
  const modelLabel = modelDisplayName(modelName, videoVersion)
  const isMusic = isMusicAsset(asset)
  const scoreView = isMusic ? scoreViewFromAsset(asset) : null
  const scoreOpen = scoreAssetId === asset.id
  const prompt = gen?.original_prompt || asset.prompt || ''
  const dims = asset.width && asset.height ? `${asset.width} × ${asset.height}` : ''
  const videoSrc = mediaUrl(`/videos/${asset.filename}`)
  const imageSrc = mediaUrl(`/images/${asset.filename}`)
  const audioSrc = mediaUrl(`/audio/${asset.filename}`)

  const goRelative = (delta: number) => {
    if (!assets.length) return
    const next = assets[(index + delta + assets.length) % assets.length]
    if (next) openInspector(next.id)
  }

  const toggle = async (key: 'favorite' | 'character' | 'voice' | 'music') => {
    const value = key === 'music' ? !isMusic : !asset[key]
    try {
      await apiUpdateGeneration(asset.id, { [key]: value })
      void queryClient.invalidateQueries({ queryKey: queryKeys.history })
    } catch (error) {
      toast({
        title: 'Could not update asset',
        description: error instanceof Error ? error.message : undefined,
        tone: 'error',
      })
    }
  }

  const deleteAsset = async () => {
    const confirmed = await confirmAction({
      title: 'Delete asset?',
      description: `"${titleFromPrompt(prompt) || asset.filename}" will be permanently removed. This cannot be undone.`,
      confirmLabel: 'Delete asset',
      tone: 'danger',
    })
    if (!confirmed) return
    try {
      await apiDeleteGeneration(asset.id)
      openInspector(null)
      void queryClient.invalidateQueries({ queryKey: queryKeys.history })
      toast({ title: 'Asset deleted', tone: 'success' })
    } catch (error) {
      toast({
        title: 'Delete failed',
        description: error instanceof Error ? error.message : undefined,
        tone: 'error',
      })
    }
  }

  const upscale = async () => {
    setBusyAction('upscale')
    const jobId = uid('upscale')
    addQueue({
      id: jobId,
      label: `Upscale · ${titleFromPrompt(prompt)}`,
      mode: 'upscale',
      status: 'running',
      progress: 10,
      stage: 'upscaling',
      startedAt: Date.now(),
    })
    try {
      const result = await runSerializedGeneration(() =>
        apiPost<{
          success: boolean
          error?: string
          result?: GeneratedResult
          asset?: Asset
        }>('/upscale-video', {
          asset_id: asset.id,
          job_id: jobId,
          video_upscale: activeUpscaleEngine,
        }),
      )
      if (!result.success) throw new Error(result.error || 'Upscale failed')
      updateQueue(jobId, { status: 'done', progress: 100, finishedAt: Date.now() })
      void queryClient.invalidateQueries({ queryKey: queryKeys.history })
      toast({ title: 'Upscaled asset created', tone: 'success' })
    } catch (error) {
      updateQueue(jobId, {
        status: 'error',
        error: error instanceof Error ? error.message : 'Upscale failed',
        finishedAt: Date.now(),
      })
      toast({
        title: 'Upscale failed',
        description: error instanceof Error ? error.message : undefined,
        tone: 'error',
      })
    } finally {
      setBusyAction(null)
    }
  }

  const generateVariations = async () => {
    if (type !== 'image') return
    setBusyAction('variations')

    const resolution = gen?.resolution || inferResolution(asset)
    const aspect = assetAspect(asset, gen)
    const imageModel = settings.data?.image_model || gen?.image_model || 'schnell'
    const i2iModel = settings.data?.i2i_model || gen?.i2i_model || 'klein'
    const jobId = uid('variations')

    addQueue({
      id: jobId,
      label: `Variations · ${titleFromPrompt(prompt)}`,
      mode: 'image',
      status: 'running',
      progress: 0,
      stage: 'generating',
      startedAt: Date.now(),
    })

    let saved = 0
    let lastError = ''

    try {
      let attempts = 0
      while (saved < 4 && attempts < 4) {
        attempts += 1
        const response = await runSerializedGeneration(() =>
          apiPost<GenerateResponse>('/generate', {
            prompt,
            resolution,
            aspect_ratio: aspect,
            mode: 'image',
            source_image: asset.filename,
            count: 4,
            image_model: imageModel,
            i2i_model: i2iModel,
            job_id: jobId,
          }),
        )

        if (!response.success) {
          lastError = response.error || lastError
          continue
        }

        for (const result of response.results ?? []) {
          if (saved >= 4) break
          if (!result.success) {
            lastError = result.error || lastError
            continue
          }

          const metadata: GenMetadata = {
            mode: 'image',
            resolution,
            aspect_ratio: aspect,
            duration: null,
            enhancer_id: gen?.enhancer_id || 'none',
            original_prompt: prompt,
            image_model: imageModel,
            i2i_model: i2iModel,
            attachments: {
              images: [{ id: asset.id, name: asset.filename, type: 'image' }],
              audios: [],
              audio: null,
              lora: null,
            },
          }

          const id = await saveResult({
            prompt,
            result,
            type: 'image',
            aspect,
            parentId: asset.id,
            gen: metadata,
          })
          if (id) {
            saved += 1
            updateQueue(jobId, {
              progress: Math.min(99, Math.round((saved / 4) * 100)),
            })
          }
        }
      }

      if (!saved) throw new Error(lastError || 'No variations were generated')

      updateQueue(jobId, { status: 'done', progress: 100, finishedAt: Date.now() })
      void queryClient.invalidateQueries({ queryKey: queryKeys.history })
      toast({
        title: 'Variations saved',
        description: `${saved} new ${saved === 1 ? 'image' : 'images'} added to your library.`,
        tone: 'success',
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Variation generation failed'
      updateQueue(jobId, { status: 'error', error: message, finishedAt: Date.now() })
      toast({
        title: 'Variations failed',
        description: message,
        tone: 'error',
      })
    } finally {
      setBusyAction(null)
    }
  }

  const toVideo = async () => {
    if (type !== 'image') return
    setBusyAction('video')

    const resolution = gen?.resolution || inferResolution(asset)
    const aspect = assetAspect(asset, gen)
    const duration = gen?.duration ?? asset.duration ?? 6
    const imageModel = settings.data?.image_model || gen?.image_model || 'schnell'
    const i2iModel = settings.data?.i2i_model || gen?.i2i_model || 'klein'
    const videoModel = settings.data?.video_model || gen?.video_model || 'ltx'
    const ltxVersion = settings.data?.ltx_version || gen?.ltx_version || '2.3'
    const fasth3Mode = settings.data?.fasth3_mode || gen?.fasth3_mode || 'reference'
    const upscaleRequested = assetUpscaleOn
    const jobId = uid('video')
    let stopProgress: (() => void) | null = null

    addQueue({
      id: jobId,
      label: `Video · ${titleFromPrompt(prompt)}`,
      mode: 'video',
      status: 'running',
      progress: 0,
      stage: 'generating',
      startedAt: Date.now(),
    })

    try {
      stopProgress = watchProgress(jobId, (snapshot) => {
        const progress =
          snapshot.stage === 'upscaling'
            ? Math.max(55, snapshot.workflow_percent ?? 55)
            : snapshot.workflow_percent ?? 0
        updateQueue(jobId, {
          status: snapshot.state === 'error' ? 'error' : 'running',
          progress,
          stage: snapshot.stage,
          error: snapshot.error,
        })
      })

      const response = await runSerializedGeneration(() =>
        apiPost<GenerateResponse>('/generate', {
          prompt,
          resolution,
          aspect_ratio: aspect,
          mode: 'video',
          duration,
          source_image: asset.filename,
          image_model: imageModel,
          i2i_model: i2iModel,
          video_model: videoModel,
          ltx_version: ltxVersion,
          fasth3_mode: fasth3Mode,
          video_upscale: upscaleRequested ? activeUpscaleEngine : 'off',
          job_id: jobId,
        }),
      )

      stopProgress?.()
      if (!response.success) throw new Error(response.error || 'Video generation failed')

      let saved = 0
      let lastError = ''
      for (const result of response.results ?? []) {
        if (!result.success) {
          lastError = result.error || lastError
          continue
        }
        const metadata: GenMetadata = {
          mode: 'video',
          resolution,
          aspect_ratio: aspect,
          duration,
          enhancer_id: gen?.enhancer_id || 'none',
          original_prompt: prompt,
          image_model: imageModel,
          i2i_model: i2iModel,
          video_model: videoModel,
          ltx_version: ltxVersion,
          fasth3_mode: fasth3Mode,
          video_upscale: upscaleRequested ? activeUpscaleEngine : 'off',
          upscale: result.upscale,
          attachments: {
            images: [{ id: asset.id, name: asset.filename, type: 'image' }],
            audios: [],
            audio: null,
            lora: null,
          },
        }
        const id = await saveResult({
          prompt,
          result,
          type: 'video',
          aspect,
          parentId: asset.id,
          gen: metadata,
        })
        if (id) saved += 1
      }

      if (!saved) throw new Error(lastError || 'Video generation failed')

      updateQueue(jobId, { status: 'done', progress: 100, finishedAt: Date.now() })
      void queryClient.invalidateQueries({ queryKey: queryKeys.history })
      toast({
        title: 'Video saved',
        description: `${saved} new video ${saved === 1 ? 'clip' : 'clips'} added to your library.`,
        tone: 'success',
      })
    } catch (error) {
      stopProgress?.()
      const message = error instanceof Error ? error.message : 'Video generation failed'
      updateQueue(jobId, { status: 'error', error: message, finishedAt: Date.now() })
      toast({
        title: 'Video generation failed',
        description: message,
        tone: 'error',
      })
    } finally {
      stopProgress?.()
      setBusyAction(null)
    }
  }

  const toPrompt = () => {
    const restored = attachmentsFromGen(gen, assets)
    let attachments: Attachment[] = restored
    if (!attachments.length && !gen && asset.parent_id) {
      const parent = assets.find((item) => item.id === asset.parent_id)
      if (parent && assetType(parent) === 'image') attachments = [toAttachment(parent)]
    }
    const duration = gen?.duration ?? asset.duration ?? 6

    updateActive({
      prompt,
      mode:
        gen?.mode === 'video' || gen?.mode === 'image' || gen?.mode === 'speech'
          ? gen.mode
          : type === 'video'
            ? 'video'
            : type === 'audio'
              ? 'speech'
              : 'image',
      resolution: gen?.resolution || inferResolution(asset),
      aspect: assetAspect(asset, gen),
      duration: typeof duration === 'number' ? duration : 6,
      enhancer: gen?.enhancer_id || 'none',
      videoModel: gen?.video_model || settings.data?.video_model || 'ltx',
      ltxVersion: gen?.ltx_version || settings.data?.ltx_version || '2.3',
      fasth3Mode: gen?.fasth3_mode || settings.data?.fasth3_mode || 'reference',
      imageModel: gen?.image_model || settings.data?.image_model || 'schnell',
      i2iModel: gen?.i2i_model || settings.data?.i2i_model || 'klein',
      upscale: assetUpscaleOn,
      attachments,
      ...(gen?.h3 ? { h3: gen.h3 as unknown as PromptTab['h3'] } : {}),
      ...(gen?.ltx ? { ltx: gen.ltx as unknown as PromptTab['ltx'] } : {}),
    })
    openInspector(null)
    navigate('/')
    toast({ title: 'Prompt loaded into the composer', tone: 'success' })
  }

  const coverThisSong = () => {
    if (type !== 'audio') return
    updateMusicGenerator({ coverAssetId: asset.id })
    openInspector(null)
    navigate('/songs')
    toast({ title: 'Cover source selected', tone: 'success' })
  }

  const upscaleDone = gen?.upscale?.status === 'done'
  const downloadName = downloadFilename(assetDisplayName(asset), asset.filename)

  return (
    <>
    <aside className="fixed inset-y-0 right-0 z-[65] flex w-full max-w-[420px] flex-col border-l border-line bg-surface/95 shadow-2xl backdrop-blur-xl max-md:bottom-0 max-md:top-auto max-md:max-h-[86dvh] max-md:rounded-t-2xl">
      <div className="flex items-center justify-between border-b border-line px-4 py-3">
        <div className="flex items-center gap-2">
          <Badge tone="default">{type}</Badge>
          {asset.favorite ? <Star className="size-3.5 fill-warning text-warning" /> : null}
        </div>
        <div className="flex items-center gap-1">
          <IconButton onClick={() => goRelative(-1)} aria-label="Previous asset">
            <ChevronLeft className="size-4" />
          </IconButton>
          <IconButton onClick={() => goRelative(1)} aria-label="Next asset">
            <ChevronRight className="size-4" />
          </IconButton>
          <IconButton onClick={() => openInspector(null)} aria-label="Close inspector">
            <X className="size-4" />
          </IconButton>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="relative bg-black">
          {type === 'video' ? (
            <video
              src={videoSrc}
              controls
              autoPlay
              loop
              playsInline
              className="max-h-[52dvh] w-full object-contain"
            />
          ) : type === 'audio' ? (
            <div className="flex min-h-48 flex-col items-center justify-center gap-4 bg-[#0d0e0f] p-8">
              <div className="grid size-20 place-items-center rounded-2xl bg-lime-soft text-lime">
                <Volume2 className="size-8" />
              </div>
              <audio src={audioSrc} controls className="w-full" />
            </div>
          ) : (
            <img src={imageSrc} alt={prompt} className="max-h-[56dvh] w-full object-contain" />
          )}
          <div className="absolute right-3 top-3 flex gap-1">
            <a
              href={mediaUrl(assetUrl(asset))}
              download={downloadName}
              className="grid size-8 place-items-center rounded-lg bg-black/60 text-white backdrop-blur"
              title="Download"
            >
              <Download className="size-3.5" />
            </a>
            <button
              type="button"
              onClick={() => setFullscreen(true)}
              className="grid size-8 place-items-center rounded-lg bg-black/60 text-white backdrop-blur transition hover:bg-black/80"
              title="View full screen"
              aria-label="View full screen"
            >
              <Maximize2 className="size-3.5" />
            </button>
          </div>
        </div>

        <div className="space-y-5 p-4">
          <div>
            <p className="line-clamp-2 text-xs leading-5 text-text-2">{prompt || asset.filename}</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {dims ? <Badge>{dims}</Badge> : null}
              {asset.duration ? <Badge>{formatDuration(asset.duration)}</Badge> : null}
              {modelName ? <Badge tone="lime">{modelLabel}</Badge> : null}
              {gen?.resolution ? <Badge>{gen.resolution}</Badge> : null}
              {upscaleDone ? (
                <Badge tone="success">{assetUpscaleFactor}× upscaled</Badge>
              ) : null}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Button variant="soft" icon={<ArrowUpRight className="size-3.5" />} onClick={toPrompt}>
              To Prompt
            </Button>
            {type === 'audio' ? (
              <Button
                variant="soft"
                icon={<Music2 className="size-3.5" />}
                onClick={coverThisSong}
              >
                Cover this song
              </Button>
            ) : null}
            {type === 'audio' && !isStemAsset(asset) ? (
              <Button
                variant="soft"
                icon={<AudioLines className="size-3.5" />}
                onClick={() => openStems(asset.id)}
              >
                Stems
              </Button>
            ) : null}
            {scoreView ? (
              <Button
                variant="soft"
                className="col-span-2"
                icon={<FileMusic className="size-3.5" />}
                onClick={() => setScoreAssetId(asset.id)}
              >
                Score &amp; plan
              </Button>
            ) : null}
            {type === 'video' ? (
              <Button
                variant={upscaleDone ? 'ghost' : 'outline'}
                icon={
                  busyAction === 'upscale' ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Zap className="size-3.5" />
                  )
                }
                onClick={() => void upscale()}
                disabled={busy || upscaleDone}
              >
                {upscaleDone ? 'Upscaled' : `Upscale ${activeUpscaleFactor}×`}
              </Button>
            ) : null}
            {type === 'image' ? (
              <Button
                variant="outline"
                icon={
                  busyAction === 'variations' ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="size-3.5" />
                  )
                }
                onClick={() => void generateVariations()}
                disabled={busy}
              >
                Variations
              </Button>
            ) : null}
            {type === 'image' ? (
              <Button
                variant="outline"
                icon={
                  busyAction === 'video' ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Video className="size-3.5" />
                  )
                }
                onClick={() => void toVideo()}
                disabled={busy}
              >
                To Video
              </Button>
            ) : null}
            <Button
              variant={asset.favorite ? 'soft' : 'outline'}
              icon={<Heart className={cn('size-3.5', asset.favorite && 'fill-current')} />}
              onClick={() => void toggle('favorite')}
            >
              Favorite
            </Button>
            {type === 'image' || type === 'video' ? (
              <Button
                variant={asset.character ? 'soft' : 'outline'}
                icon={<User className="size-3.5" />}
                onClick={() => void toggle('character')}
              >
                Character
              </Button>
            ) : null}
            {type === 'audio' ? (
              <Button
                variant={asset.voice ? 'soft' : 'outline'}
                icon={<Volume2 className="size-3.5" />}
                onClick={() => void toggle('voice')}
              >
                Voice
              </Button>
            ) : null}
            {type === 'audio' ? (
              <Button
                variant={isMusic ? 'soft' : 'outline'}
                icon={<Music2 className="size-3.5" />}
                onClick={() => void toggle('music')}
              >
                Music
              </Button>
            ) : null}
            <Button
              variant="danger"
              icon={<Trash2 className="size-3.5" />}
              onClick={() => void deleteAsset()}
              className="col-span-2"
            >
              Delete asset
            </Button>
          </div>

          {tts ? (
            <div className="rounded-xl border border-line bg-white/[0.02] p-3">
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-text-3">
                Speech
              </p>
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <Meta label="Engine" value={modelDisplayName(metaString(tts.engine))} />
                <Meta label="Language" value={metaString(tts.language) || '—'} />
                <Meta
                  label="Voice"
                  value={metaString(tts.voice_name) || metaString(tts.voice_id) || '—'}
                />
              </div>
            </div>
          ) : null}

          {gen ? (
            <div className="rounded-xl border border-line bg-white/[0.02] p-3">
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-text-3">
                Generation
              </p>
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <Meta label="Model" value={modelLabel} />
                <Meta label="Aspect" value={gen.aspect_ratio || '—'} />
                <Meta label="Resolution" value={gen.resolution || '—'} />
                <Meta label="Duration" value={gen.duration ? `${gen.duration}s` : '—'} />
                <Meta label="Upscale" value={gen.video_upscale || 'off'} />
                <Meta label="Enhancer" value={gen.enhancer_id || 'none'} />
                {gen.motion ? (
                  <Meta label="Motion" value={gen.motion.preset_name || gen.motion.preset_id} />
                ) : null}
              </div>
            </div>
          ) : null}

          {related.length ? (
            <div>
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-text-3">
                Related
              </p>
              <div className="grid grid-cols-3 gap-2">
                {related.map((item) => {
                  const itemType = assetType(item)
                  const stemInfo = parseMetadata(item).stem
                  const stemKey =
                    typeof stemInfo === 'object' && stemInfo
                      ? (stemInfo as Record<string, unknown>).stem
                      : undefined
                  const audioLabel = isStemAsset(item)
                    ? stemMeta(typeof stemKey === 'string' ? stemKey : undefined).label
                    : assetDisplayName(item)
                  return (
                    <button
                      key={item.id}
                      onClick={() => openInspector(item.id)}
                      className="relative aspect-square overflow-hidden rounded-lg border border-line bg-black"
                      title={itemType === 'audio' ? audioLabel : undefined}
                    >
                      {itemType === 'image' || itemType === 'video' ? (
                        <>
                          <img
                            src={mediaUrl(`/thumbnails/${item.id}.jpg`)}
                            alt=""
                            loading="lazy"
                            className="size-full object-cover"
                          />
                          {itemType === 'video' ? (
                            <span className="absolute inset-0 grid place-items-center bg-black/10">
                              <span className="grid size-7 place-items-center rounded-full bg-black/60 text-white">
                                <Video className="size-3" />
                              </span>
                            </span>
                          ) : null}
                        </>
                      ) : (
                        <div className="flex size-full flex-col items-center justify-center gap-1 bg-surface-2 px-1 text-text-3">
                          <Volume2 className="size-4 shrink-0" />
                          <span className="line-clamp-2 text-center text-[9px] leading-3 text-text-2">
                            {audioLabel}
                          </span>
                        </div>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </aside>
    {scoreView ? (
      <ScorePanel
        open={scoreOpen}
        onClose={() => setScoreAssetId(null)}
        scoreAbc={scoreView.scoreAbc}
        planning={scoreView.planning}
        title={scoreView.title}
        style={scoreView.style}
        lyrics={scoreView.lyrics}
        seed={scoreView.seed}
        maxScoreTokens={scoreView.maxScoreTokens}
        coverSource={scoreView.coverSource}
        audioFilename={scoreView.audioFilename}
        sampling={scoreView.sampling}
      />
    ) : null}
    {fullscreen ? (
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`${type} full screen preview`}
        className="fixed inset-0 z-[100] flex flex-col bg-[#050506]"
      >
        <div className="flex h-14 shrink-0 items-center gap-3 border-b border-white/10 bg-black/40 px-4 md:px-6">
          <Badge tone="default">{type}</Badge>
          <p className="min-w-0 flex-1 truncate text-xs text-text-2">
            {titleFromPrompt(prompt) || asset.filename}
          </p>
          {assets.length > 1 ? (
            <>
              <IconButton
                onClick={() => goRelative(-1)}
                aria-label="Previous asset"
                title="Previous asset"
                className="text-white hover:bg-white/10"
              >
                <ChevronLeft className="size-4" />
              </IconButton>
              <IconButton
                onClick={() => goRelative(1)}
                aria-label="Next asset"
                title="Next asset"
                className="text-white hover:bg-white/10"
              >
                <ChevronRight className="size-4" />
              </IconButton>
            </>
          ) : null}
          <a
            href={mediaUrl(assetUrl(asset))}
            download={downloadName}
            className="grid size-8 place-items-center rounded-lg text-white transition hover:bg-white/10"
            title="Download"
          >
            <Download className="size-4" />
          </a>
          <IconButton
            onClick={() => setFullscreen(false)}
            aria-label="Close full screen"
            className="text-white hover:bg-white/10"
          >
            <X className="size-4" />
          </IconButton>
        </div>

        <div className="relative flex min-h-0 flex-1 items-center justify-center p-3 md:p-8">
          {type === 'video' ? (
            <video
              key={`${asset.id}-fullscreen`}
              src={videoSrc}
              controls
              autoPlay
              loop
              playsInline
              className="max-h-full max-w-full rounded-lg bg-black shadow-2xl"
            />
          ) : type === 'audio' ? (
            <div
              key={`${asset.id}-fullscreen`}
              className="flex w-full max-w-2xl flex-col items-center gap-6 rounded-3xl border border-line bg-surface/60 p-8"
            >
              <div className="grid size-24 place-items-center rounded-3xl bg-lime-soft text-lime">
                <Volume2 className="size-10" />
              </div>
              <audio src={audioSrc} controls autoPlay className="w-full" />
            </div>
          ) : (
            <img
              key={`${asset.id}-fullscreen`}
              src={imageSrc}
              alt={prompt}
              className="max-h-full max-w-full object-contain"
            />
          )}
        </div>

        <div className="flex shrink-0 items-center justify-center border-t border-white/10 px-4 py-2 text-[10px] text-text-3">
          {asset.filename}
        </div>
      </div>
    ) : null}
    </>
  )
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined
}

function metaString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

function fallbackVideoModel(
  model?: string,
): { model: string; version?: string } | undefined {
  if (model === 'ltx23') return { model: 'ltx', version: '2.3' }
  if (model === 'ltx25') return { model: 'ltx', version: '2.5' }
  if (model === 'fasth3') return { model: 'fasth3' }
  if (model === 'grok') return { model: 'grok' }
  return undefined
}

function modelDisplayName(model?: string, ltxVersion?: string): string {
  if (model === 'ltx') return `LTX ${ltxVersion || '2.3'}`
  const labels: Record<string, string> = {
    schnell: 'Flux Schnell',
    klein: 'Flux 2 Klein',
    qwen: 'Qwen 2.5 2512',
    grok: 'Grok Imagine',
    'grok-quality': 'Grok Quality',
    flux2: 'Flux 2',
    fasth3: 'FastH3',
    qwen3: 'Qwen3-TTS',
    chatterbox: 'Chatterbox',
    cosyvoice3: 'CosyVoice 3',
    indextts25: 'IndexTTS 2',
    f5tts: 'F5-TTS',
    xttsv2: 'XTTS v2',
    zonos2: 'Zonos2',
    gpt_sovits: 'GPT-SoVITS',
    yue2: 'YuE2',
  }
  return model ? labels[model] ?? model : '—'
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[9px] uppercase tracking-wider text-text-3">{label}</p>
      <p className="truncate text-[11px] text-text-2">{value}</p>
    </div>
  )
}
