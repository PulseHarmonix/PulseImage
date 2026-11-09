import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, ArrowRight, Camera, Download, Film, Search, X } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { queryKeys, useHistory } from '../lib/queries'
import { apiPost, mediaUrl } from '../lib/api'
import { PageContainer } from '../components/shell/PageContainer'
import { PageHeader } from '../components/shell/PageHeader'
import { Badge, Button, EmptyState, Input, Spinner } from '../components/ui'
import { cn, formatTimecode, titleFromPrompt } from '../lib/utils'
import { useUiStore } from '../stores/ui'
import type { Asset } from '../types'

interface Frame {
  index: number
  time: number
  url: string
}

export function FramesPage() {
  const history = useHistory()
  const queryClient = useQueryClient()
  const [searchParams] = useSearchParams()
  const requestedVideoId = searchParams.get('video')
  const toast = useUiStore((s) => s.toast)
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<Asset | null>(null)
  const [info, setInfo] = useState<{
    fps?: number
    duration?: number
    width?: number
    height?: number
    frame_count?: number
  }>({})
  const [frames, setFrames] = useState<Frame[]>([])
  const [start, setStart] = useState(0)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState<number | null>(null)
  const [saved, setSaved] = useState<number[]>([])
  const [previewFrame, setPreviewFrame] = useState<Frame | null>(null)
  const [previewSrc, setPreviewSrc] = useState<string | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const previewRequest = useRef(0)

  const videos = useMemo(() => {
    const search = query.toLowerCase()
    return (history.data ?? [])
      .filter(
        (asset) =>
          (asset.type === 'video' || asset.filename?.endsWith('.mp4')) &&
          (!search || `${asset.prompt || ''} ${asset.filename}`.toLowerCase().includes(search)),
      )
      .slice(0, 120)
  }, [history.data, query])

  const requestedVideo = useMemo(() => {
    if (!requestedVideoId) return null
    return (
      (history.data ?? []).find(
        (asset) =>
          asset.id === requestedVideoId &&
          (asset.type === 'video' || asset.filename?.endsWith('.mp4')),
      ) ?? null
    )
  }, [history.data, requestedVideoId])

  useEffect(() => {
    if (requestedVideo) setSelected(requestedVideo)
  }, [requestedVideo])

  useEffect(() => {
    if (selected || !videos.length || requestedVideo || !history.isFetched) return
    setSelected(videos[0])
  }, [videos, selected, requestedVideo, history.isFetched])

  useEffect(() => {
    if (!selected) return
    setLoading(true)
    setFrames([])
    setSaved([])
    setStart(0)
    void (async () => {
      try {
        const result = await apiPost<{
          success: boolean
          error?: string
          fps?: number
          duration?: number
          width?: number
          height?: number
          frame_count?: number
        }>('/frames/info', { asset_id: selected.id })
        if (!result.success) throw new Error(result.error || 'Could not inspect video')
        setInfo(result)
      } catch (error) {
        toast({
          title: 'Could not inspect video',
          description: error instanceof Error ? error.message : undefined,
          tone: 'error',
        })
      } finally {
        setLoading(false)
      }
    })()
  }, [selected, toast])

  useEffect(() => {
    if (!selected || !info.fps) return
    setLoading(true)
    void (async () => {
      try {
        const result = await apiPost<{ success: boolean; frames?: Frame[]; error?: string }>(
          '/frames/window',
          { asset_id: selected.id, start_index: start, count: 24, fps: info.fps },
        )
        if (!result.success) throw new Error(result.error || 'Could not extract frames')
        setFrames(result.frames ?? [])
      } catch (error) {
        toast({
          title: 'Frame extraction failed',
          description: error instanceof Error ? error.message : undefined,
          tone: 'error',
        })
      } finally {
        setLoading(false)
      }
    })()
  }, [selected, info.fps, start, toast])

  useEffect(() => {
    previewRequest.current += 1
    setPreviewFrame(null)
    setPreviewSrc(null)
    setPreviewLoading(false)
  }, [selected?.id, start])

  const openFramePreview = async (frame: Frame) => {
    if (!selected) return
    const requestId = previewRequest.current + 1
    previewRequest.current = requestId
    setPreviewFrame(frame)
    setPreviewSrc(frame.url)
    setPreviewLoading(true)

    try {
      const result = await apiPost<{
        success: boolean
        url?: string
        error?: string
      }>('/frames/preview', { asset_id: selected.id, frame_index: frame.index })
      if (!result.success || !result.url) throw new Error(result.error || 'Could not load frame')
      if (previewRequest.current !== requestId) return

      const url = mediaUrl(result.url)
      const image = new Image()
      image.src = url
      await image.decode().catch(() => undefined)
      if (previewRequest.current === requestId) setPreviewSrc(url)
    } catch (error) {
      if (previewRequest.current === requestId) {
        toast({
          title: 'Could not load full frame',
          description: error instanceof Error ? error.message : undefined,
          tone: 'error',
        })
      }
    } finally {
      if (previewRequest.current === requestId) setPreviewLoading(false)
    }
  }

  const closeFramePreview = () => {
    previewRequest.current += 1
    setPreviewFrame(null)
    setPreviewSrc(null)
    setPreviewLoading(false)
  }

  const saveFrame = async (frame: Frame) => {
    if (!selected) return
    setSaving(frame.index)
    try {
      const result = await apiPost<{ success: boolean; error?: string; id?: string }>(
        '/frames/save',
        { asset_id: selected.id, frame_index: frame.index },
      )
      if (!result.success) throw new Error(result.error || 'Could not save frame')
      void queryClient.invalidateQueries({ queryKey: queryKeys.history })
      setSaved((current) => [...current, frame.index])
      toast({ title: 'Frame saved to Library', tone: 'success' })
    } catch (error) {
      toast({
        title: 'Could not save frame',
        description: error instanceof Error ? error.message : undefined,
        tone: 'error',
      })
    } finally {
      setSaving(null)
    }
  }

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Single frame"
        title="Pull the perfect frame."
        description="Scrub any generated video, inspect individual frames, and save the keepers as images."
      />

      <div className="mt-6 grid gap-4 xl:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="rounded-2xl border border-line bg-white/[0.02] p-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-text-3" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Find a video…"
              className="h-9 pl-9 text-xs"
            />
          </div>
          <div className="mt-3 max-h-[58dvh] space-y-1 overflow-y-auto">
            {videos.map((video) => (
              <button
                key={video.id}
                onClick={() => {
                  setSelected(video)
                  closeFramePreview()
                }}
                className={cn(
                  'flex w-full items-center gap-2 rounded-xl px-2 py-2 text-left transition',
                  selected?.id === video.id ? 'bg-lime-soft text-lime' : 'text-text-2 hover:bg-white/[0.04]',
                )}
              >
                <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-black text-text-3">
                  <Film className="size-3.5" />
                </span>
                <span className="min-w-0">
                  <span className="line-clamp-1 text-[11px] font-medium">
                    {titleFromPrompt(video.prompt)}
                  </span>
                  <span className="block truncate text-[9px] text-text-3">{video.filename}</span>
                </span>
              </button>
            ))}
            {!videos.length ? (
              <p className="p-4 text-center text-[11px] text-text-3">No videos found.</p>
            ) : null}
          </div>
        </aside>

        <section className="min-w-0">
          {selected ? (
            <>
              <div className="relative rounded-2xl border border-line bg-black p-2">
                {previewFrame ? (
                  <>
                    <img
                      src={previewSrc || mediaUrl(previewFrame.url)}
                      alt={`Frame ${previewFrame.index}`}
                      className="max-h-[56dvh] w-full rounded-xl bg-black object-contain"
                    />
                    <div className="absolute left-4 top-4 rounded-lg bg-black/70 px-2 py-1 font-mono text-[10px] text-white/80 backdrop-blur">
                      Frame {previewFrame.index} A� {formatTimecode(previewFrame.time, info.fps || 24)}
                    </div>
                    {previewLoading ? (
                      <div className="absolute right-16 top-4 grid size-9 place-items-center rounded-xl bg-black/75 text-white shadow-lg backdrop-blur">
                        <Spinner className="size-4" />
                      </div>
                    ) : null}
                    <button
                      type="button"
                      onClick={closeFramePreview}
                      className="absolute right-4 top-4 grid size-9 place-items-center rounded-xl bg-black/75 text-white shadow-lg backdrop-blur transition hover:bg-black"
                      aria-label="Close frame preview"
                      title="Back to video"
                    >
                      <X className="size-4" />
                    </button>
                  </>
                ) : (
                  <video
                    key={selected.filename}
                    src={mediaUrl(`/videos/${selected.filename}`)}
                    controls
                    className="max-h-[56dvh] w-full rounded-xl object-contain"
                  />
                )}
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Badge>{selected.width && selected.height ? `${selected.width}×${selected.height}` : '—'}</Badge>
                <Badge>{info.fps ? `${info.fps} fps` : '—'}</Badge>
                <Badge>{info.frame_count ? `${info.frame_count} frames` : '—'}</Badge>
                <Badge>{info.duration ? `${info.duration.toFixed(2)}s` : '—'}</Badge>
                <div className="ml-auto flex items-center gap-1">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={start <= 0 || loading}
                    onClick={() => setStart(Math.max(0, start - 24))}
                  >
                    <ArrowLeft className="size-3" /> Previous
                  </Button>
                  <Button size="sm" variant="outline" disabled={loading} onClick={() => setStart(start + 24)}>
                    Next <ArrowRight className="size-3" />
                  </Button>
                </div>
              </div>

              {loading ? (
                <div className="grid place-items-center py-20">
                  <Spinner className="size-6" />
                </div>
              ) : frames.length ? (
                <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
                  {frames.map((frame) => (
                    <div
                      key={frame.index}
                      className={cn(
                        'group relative overflow-hidden rounded-lg border border-line bg-black',
                        previewFrame?.index === frame.index && 'border-lime/60 ring-1 ring-lime/40',
                      )}
                    >
                      <button
                        type="button"
                        onClick={() => void openFramePreview(frame)}
                        className="block w-full"
                        aria-label={`Preview frame ${frame.index}`}
                      >
                        <img
                          src={mediaUrl(frame.url)}
                          alt={`Frame ${frame.index}`}
                          loading="lazy"
                          className="aspect-video w-full object-cover"
                        />
                      </button>
                      <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-gradient-to-t from-black/85 to-transparent p-1.5">
                        <span className="font-mono text-[9px] text-white/70">
                          {formatTimecode(frame.time, info.fps || 24)}
                        </span>
                        <button
                          disabled={saving === frame.index || saved.includes(frame.index)}
                          onClick={() => void saveFrame(frame)}
                          className={cn(
                            'grid size-6 place-items-center rounded-md bg-black/60 text-white',
                            saved.includes(frame.index) && 'text-lime',
                          )}
                          aria-label={`Save frame ${frame.index}`}
                        >
                          {saving === frame.index ? (
                            <Spinner className="size-3" />
                          ) : saved.includes(frame.index) ? (
                            <Download className="size-3" />
                          ) : (
                            <Camera className="size-3" />
                          )}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mt-4">
                  <EmptyState
                    icon={<Camera className="size-6" />}
                    title="No frames loaded"
                    description="Try another window or reselect the video."
                  />
                </div>
              )}
            </>
          ) : (
            <EmptyState
              icon={<Film className="size-6" />}
              title="Choose a video"
              description="Pick a generated video to inspect its frames."
            />
          )}
        </section>
      </div>
    </PageContainer>
  )
}
