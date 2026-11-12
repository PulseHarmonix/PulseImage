import { useEffect, useMemo, useState } from 'react'
import { AudioWaveform, Film, Search } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { queryKeys, useHistory } from '../lib/queries'
import { apiPost, mediaUrl } from '../lib/api'
import { PageContainer } from '../components/shell/PageContainer'
import { PageHeader } from '../components/shell/PageHeader'
import { Badge, Button, EmptyState, Input, Spinner } from '../components/ui'
import { cn, formatDuration, titleFromPrompt } from '../lib/utils'
import { useUiStore } from '../stores/ui'
import type { Asset } from '../types'

interface AudioInfo {
  has_audio?: boolean
  codec?: string | null
  channels?: number
  sample_rate?: number
  duration?: number
}

type BadgeTone = 'default' | 'lime' | 'danger' | 'warning' | 'success'

function audioSummary(
  info: AudioInfo | null,
  loading: boolean,
  error: string | null,
): { label: string; tone: BadgeTone } {
  if (loading) return { label: 'Checking audio…', tone: 'default' }
  if (error) return { label: 'Audio unavailable', tone: 'danger' }
  if (info?.has_audio) {
    const codec = info.codec || 'audio'
    const channels = info.channels ? `${info.channels}ch` : '—'
    const rate = info.sample_rate ? `${Math.round(info.sample_rate / 1000)} kHz` : '—'
    return { label: `${codec} · ${channels} · ${rate}`, tone: 'success' }
  }
  return { label: 'No audio track', tone: 'warning' }
}

export function VideoAudioPage() {
  const history = useHistory()
  const queryClient = useQueryClient()
  const [searchParams] = useSearchParams()
  const requestedVideoId = searchParams.get('video')
  const toast = useUiStore((s) => s.toast)
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<Asset | null>(null)
  const [info, setInfo] = useState<AudioInfo | null>(null)
  const [infoLoading, setInfoLoading] = useState(false)
  const [infoError, setInfoError] = useState<string | null>(null)
  const [extracting, setExtracting] = useState(false)
  const [extracted, setExtracted] = useState<Asset | null>(null)

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
    if (!selected) {
      setInfo(null)
      setInfoError(null)
      setInfoLoading(false)
      return
    }

    let cancelled = false
    setInfo(null)
    setInfoError(null)
    setInfoLoading(true)
    setExtracted(null)

    void (async () => {
      try {
        const result = await apiPost<AudioInfo & { success: boolean; error?: string }>(
          '/video-audio/info',
          { asset_id: selected.id },
        )
        if (cancelled) return
        if (!result.success) throw new Error(result.error || 'Could not inspect audio')
        setInfo(result)
      } catch (error) {
        if (cancelled) return
        setInfoError(error instanceof Error ? error.message : 'Could not inspect audio')
      } finally {
        if (!cancelled) setInfoLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [selected])

  const extractAudio = async () => {
    if (!selected) return
    setExtracting(true)
    try {
      const result = await apiPost<{ success: boolean; asset?: Asset; error?: string }>(
        '/video-audio/extract',
        { asset_id: selected.id },
      )
      if (!result.success || !result.asset) {
        throw new Error(result.error || 'Could not extract audio')
      }
      setExtracted(result.asset)
      void queryClient.invalidateQueries({ queryKey: queryKeys.history })
      toast({ title: 'Audio saved to Library', tone: 'success' })
    } catch (error) {
      toast({
        title: 'Could not extract audio',
        description: error instanceof Error ? error.message : undefined,
        tone: 'error',
      })
    } finally {
      setExtracting(false)
    }
  }

  const summary = audioSummary(info, infoLoading, infoError)
  const duration = info?.duration ?? selected?.duration
  const extractDisabled =
    extracting || infoLoading || !info?.has_audio || Boolean(infoError)

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Video audio"
        title="Extract the soundtrack."
        description="Pick a generated video, preview it, and save its audio track to the Library."
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
                onClick={() => setSelected(video)}
                className={cn(
                  'flex w-full items-center gap-2 rounded-xl px-2 py-2 text-left transition',
                  selected?.id === video.id
                    ? 'bg-lime-soft text-lime'
                    : 'text-text-2 hover:bg-white/[0.04]',
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
            {history.isLoading ? (
              <div className="grid place-items-center py-6">
                <Spinner className="size-4" />
              </div>
            ) : !videos.length ? (
              <p className="p-4 text-center text-[11px] text-text-3">No videos found.</p>
            ) : null}
          </div>
        </aside>

        <section className="min-w-0">
          {selected ? (
            <>
              <div className="relative rounded-2xl border border-line bg-black p-2">
                <video
                  key={selected.filename}
                  src={mediaUrl(`/videos/${selected.filename}`)}
                  controls
                  className="max-h-[56dvh] w-full rounded-xl object-contain"
                />
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Badge>
                  {selected.width && selected.height
                    ? `${selected.width}×${selected.height}`
                    : '—'}
                </Badge>
                <Badge>{duration ? formatDuration(duration) : '—'}</Badge>
                <Badge tone={summary.tone}>{summary.label}</Badge>
                <div className="ml-auto">
                  <Button
                    variant="primary"
                    size="sm"
                    busy={extracting}
                    disabled={extractDisabled}
                    icon={<AudioWaveform className="size-3.5" />}
                    onClick={() => void extractAudio()}
                  >
                    Extract audio track
                  </Button>
                </div>
              </div>

              {infoError ? (
                <div className="mt-3 rounded-xl border border-danger/20 bg-danger-soft p-3 text-xs text-danger">
                  {infoError}
                </div>
              ) : null}

              {extracted ? (
                <div className="mt-4 rounded-2xl border border-line bg-white/[0.02] p-3">
                  <div className="flex items-center gap-2 text-xs font-medium text-text">
                    <AudioWaveform className="size-4 text-lime" />
                    Extracted audio saved to Library
                  </div>
                  <audio
                    controls
                    src={mediaUrl(`/audio/${extracted.filename}`)}
                    className="mt-3 w-full"
                  />
                  <p className="mt-2 truncate text-[10px] text-text-3">{extracted.filename}</p>
                </div>
              ) : null}
            </>
          ) : (
            <EmptyState
              icon={<AudioWaveform className="size-6" />}
              title="Choose a video"
              description="Pick a generated video to preview and extract its audio track."
            />
          )}
        </section>
      </div>
    </PageContainer>
  )
}
