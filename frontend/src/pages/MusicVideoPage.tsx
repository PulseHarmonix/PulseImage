import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Clapperboard,
  Clock3,
  Download,
  Eraser,
  Film,
  Loader2,
  Music2,
  Pause,
  Play,
  Plus,
  RefreshCcw,
  Sparkles,
  Trash2,
  Users,
  Wand2,
  X,
} from 'lucide-react'
import { apiDelete, apiGet, apiPost, apiUrl, mediaUrl } from '../lib/api'
import { assetDisplayName } from '../lib/assets'
import { runSerializedGeneration } from '../lib/generationQueue'
import { useHistory, useSettings } from '../lib/queries'
import { PageHeader } from '../components/shell/PageHeader'
import {
  Badge,
  Button,
  EmptyState,
  IconButton,
  Input,
  Progress,
  Select,
  Textarea,
} from '../components/ui'
import { useQueueStore } from '../stores/queue'
import { useMusicBatchStore } from '../stores/musicBatch'
import { useUiStore } from '../stores/ui'
import { confirmAction } from '../stores/confirm'
import { assetType, cn, downloadFilename, formatDuration, titleFromPrompt } from '../lib/utils'
import type { ProgressSnapshot } from '../types'

interface Segment {
  id: string
  slot_id: string
  start_time: number
  end_time: number
  prompt: string
  status?: string
  video_filename?: string
  video_asset_id?: string
  error?: string
}

interface SlotImage {
  asset_id?: string
  filename?: string
  name?: string
}

interface Slot {
  id: string
  slot_number: number
  name: string
  image?: SlotImage
  segments?: Segment[]
}

interface SectionTiming {
  name: string
  start: number
  end: number
}

interface ProjectSettings {
  model?: string
  resolution?: string
  aspect_ratio?: string
  sections?: SectionTiming[]
  [key: string]: unknown
}

interface ProjectAudio {
  asset_id?: string
  filename?: string
  name?: string
  duration?: number
}

interface Project {
  id: string
  title: string
  settings?: ProjectSettings
  audio?: ProjectAudio
  slots?: Slot[]
  created?: string
  last_updated?: string
}

interface GenerateOptions {
  trackQueue?: boolean
  refresh?: boolean
  silent?: boolean
  onProgress?: (percent: number) => void
}

const SECTION_NAMES = [
  'Intro',
  'Verse 1',
  'Pre Chorus 1',
  'Chorus 1',
  'Verse 2',
  'Pre Chorus 2',
  'Chorus 2',
  'Verse 3',
  'Pre Chorus 3',
  'Chorus 3',
  'Verse 4',
  'Pre Chorus 4',
  'Chorus 4',
  'Bridge',
  'Outro',
]

const modelOptions = [
  { value: '', label: 'App default' },
  { value: 'ltx23', label: 'LTX 2.3' },
  { value: 'ltx25', label: 'LTX 2.5' },
  { value: 'fasth3', label: 'FastH3' },
  { value: 'grok', label: 'Grok' },
]

const resolutionOptions = ['480p', '720p', '1080p']
const aspectOptions = ['16:9', '9:16', '1:1', '3:2', '2:3']

function readSections(value: unknown): SectionTiming[] {
  const stored = Array.isArray(value) ? value : []
  return SECTION_NAMES.map((name, index) => {
    const entry = stored[index] as Partial<SectionTiming> | undefined
    return {
      name,
      start: Math.max(0, Number(entry?.start) || 0),
      end: Math.max(0, Number(entry?.end) || 0),
    }
  })
}

function watchProgress(
  jobId: string,
  onSnapshot: (snapshot: ProgressSnapshot) => void,
): () => void {
  let stopped = false
  const tick = async () => {
    if (stopped) return
    try {
      const snapshot = await apiGet<ProgressSnapshot>(
        `/comfy/progress/${encodeURIComponent(jobId)}`,
      )
      if (!stopped) onSnapshot(snapshot)
    } catch {
      // The tracker can briefly disappear between stages; keep polling.
    }
    if (!stopped) window.setTimeout(tick, 700)
  }
  void tick()
  return () => {
    stopped = true
  }
}

function percentFromSnapshot(snapshot: ProgressSnapshot): number {
  const value = Number(snapshot.workflow_percent ?? snapshot.node_percent ?? 0)
  return Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0))
}

function modelLabel(model?: string): string {
  return modelOptions.find((option) => option.value === (model || ''))?.label || 'App default'
}

type TimelineDragMode = 'move' | 'start' | 'end'

interface TimelineDrag {
  mode: TimelineDragMode
  originStart: number
  originEnd: number
  startX: number
  width: number
  moved: boolean
}

function roundTenths(value: number): number {
  return Math.round(value * 10) / 10
}

function TimelineSegment({
  segment,
  duration,
  maxDuration,
  selected,
  generating,
  ready,
  onSelect,
  onPreview,
  onCommit,
}: {
  segment: Segment
  duration: number
  maxDuration: number
  selected: boolean
  generating: boolean
  ready: boolean
  onSelect: () => void
  onPreview: (updates: { start_time: number; end_time: number }) => void
  onCommit: (updates: { start_time: number; end_time: number }) => void
}) {
  const [dragging, setDragging] = useState(false)
  const dragRef = useRef<TimelineDrag | null>(null)
  const previewRef = useRef<{ start: number; end: number } | null>(null)
  const callbacks = useRef({ onPreview, onCommit })
  callbacks.current = { onPreview, onCommit }

  useEffect(() => {
    if (!dragging) return

    const move = (event: globalThis.PointerEvent) => {
      const drag = dragRef.current
      if (!drag) return
      const secondsPerPixel = duration / Math.max(drag.width, 1)
      const delta = roundTenths((event.clientX - drag.startX) * secondsPerPixel)
      const minDuration = 0.1
      let start = drag.originStart
      let end = drag.originEnd

      if (drag.mode === 'move') {
        const length = drag.originEnd - drag.originStart
        const maxStart = Math.max(0, duration - length)
        start = Math.min(Math.max(0, roundTenths(drag.originStart + delta)), maxStart)
        end = start + length
      } else if (drag.mode === 'start') {
        start = Math.min(
          Math.max(0, roundTenths(drag.originStart + delta)),
          drag.originEnd - minDuration,
        )
        start = Math.max(start, drag.originEnd - maxDuration)
        end = drag.originEnd
      } else {
        end = Math.max(
          drag.originStart + minDuration,
          Math.min(duration, roundTenths(drag.originEnd + delta)),
        )
        end = Math.min(end, drag.originStart + maxDuration)
        start = drag.originStart
      }

      if (start !== drag.originStart || end !== drag.originEnd) drag.moved = true
      previewRef.current = { start, end }
      callbacks.current.onPreview({ start_time: start, end_time: end })
    }

    const finish = () => {
      const drag = dragRef.current
      const preview = previewRef.current
      dragRef.current = null
      previewRef.current = null
      setDragging(false)
      if (drag?.moved && preview) {
        callbacks.current.onCommit({
          start_time: preview.start,
          end_time: preview.end,
        })
      }
    }

    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', finish)
    window.addEventListener('pointercancel', finish)
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', finish)
      window.removeEventListener('pointercancel', finish)
    }
  }, [dragging, duration, maxDuration])

  const beginDrag = (event: ReactPointerEvent<HTMLSpanElement>, mode: TimelineDragMode) => {
    event.preventDefault()
    event.stopPropagation()
    const track = (event.currentTarget as HTMLElement).closest('[data-timeline-track]')
    const width = track?.getBoundingClientRect().width ?? 1
    dragRef.current = {
      mode,
      originStart: segment.start_time,
      originEnd: segment.end_time,
      startX: event.clientX,
      width,
      moved: false,
    }
    previewRef.current = {
      start: segment.start_time,
      end: segment.end_time,
    }
    onSelect()
    setDragging(true)
  }

  const left = (segment.start_time / Math.max(duration, 1)) * 100
  const width = Math.max(
    0.6,
    ((segment.end_time - segment.start_time) / Math.max(duration, 1)) * 100,
  )

  return (
    <span
      onClick={(event) => {
        event.stopPropagation()
        onSelect()
      }}
      onPointerDown={(event) => beginDrag(event, 'move')}
      className={cn(
        'absolute top-0.5 h-6 touch-none select-none overflow-hidden rounded border px-1 text-left text-[8px] leading-5 transition',
        dragging ? 'cursor-grabbing' : 'cursor-grab',
        segment.status === 'error' || segment.error
          ? 'border-danger/40 bg-danger/25 text-danger'
          : selected
            ? 'z-10 border-lime bg-lime font-semibold text-bg shadow-[0_0_0_2px_rgba(215,255,63,0.25)]'
            : generating
              ? 'animate-pulse border-sky-400/50 bg-sky-400/20 text-sky-300'
              : ready
                ? 'border-lime/40 bg-lime/35 text-lime'
                : 'border-warning/20 bg-warning/10 text-warning hover:bg-warning/20',
      )}
      style={{ left: `${left}%`, width: `${width}%` }}
      title={segment.prompt}
    >
      <span
        onPointerDown={(event) => beginDrag(event, 'start')}
        className="absolute inset-y-0 left-0 z-20 w-2 cursor-ew-resize bg-transparent hover:bg-white/35"
        aria-hidden
      />
      <span className="pointer-events-none relative z-10">{segment.prompt}</span>
      <span
        onPointerDown={(event) => beginDrag(event, 'end')}
        className="absolute inset-y-0 right-0 z-20 w-2 cursor-ew-resize bg-transparent hover:bg-white/35"
        aria-hidden
      />
    </span>
  )
}

function SegmentRow({
  segment,
  busy,
  progress,
  batchActive,
  selected,
  videoName,
  playingAudio,
  audioAvailable,
  onSelect,
  onToggleAudio,
  onDraft,
  onSave,
  onGenerate,
  onDelete,
}: {
  segment: Segment
  busy: boolean
  progress: number
  batchActive: boolean
  selected: boolean
  videoName?: string
  playingAudio: boolean
  audioAvailable: boolean
  onSelect: () => void
  onToggleAudio: () => void
  onDraft: (updates: Partial<Pick<Segment, 'start_time' | 'end_time' | 'prompt'>>) => void
  onSave: (updates: Partial<Pick<Segment, 'start_time' | 'end_time' | 'prompt'>>) => void
  onGenerate: () => void
  onDelete: () => void
}) {
  const [start, setStart] = useState(segment.start_time ?? 0)
  const [end, setEnd] = useState(segment.end_time ?? 0)
  const [prompt, setPrompt] = useState(segment.prompt ?? '')
  const [fullscreen, setFullscreen] = useState(false)

  useEffect(() => {
    setStart(segment.start_time ?? 0)
    setEnd(segment.end_time ?? 0)
    setPrompt(segment.prompt ?? '')
  }, [segment.start_time, segment.end_time, segment.prompt])

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

  const generating = busy || segment.status === 'generating'
  const ready = Boolean(segment.video_filename)
  const failed = !generating && (segment.status === 'error' || Boolean(segment.error))
  const duration = Math.max(0, end - start)
  const videoDownloadName = downloadFilename(
    videoName || prompt,
    segment.video_filename,
    'segment',
  )

  const commitStart = () => {
    if (Number.isFinite(start)) onSave({ start_time: start })
  }
  const commitEnd = () => {
    if (Number.isFinite(end)) onSave({ end_time: end })
  }
  const commitPrompt = () => {
    onSave({ prompt })
  }

  return (
    <>
    <div
      data-segment-card={segment.id}
      onClick={onSelect}
      className={cn(
        'cursor-pointer rounded-xl border p-3 transition',
        selected
          ? 'border-lime/60 bg-lime-soft/20 ring-1 ring-lime/25'
          : generating
            ? 'border-lime/30 bg-white/[0.02]'
            : failed
              ? 'border-danger/25 bg-white/[0.02]'
              : 'border-line bg-white/[0.02]',
      )}
    >
      <div className="flex flex-wrap items-start gap-3">
        <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-black text-text-3">
          {ready ? <Film className="size-4 text-lime" /> : <Clapperboard className="size-4" />}
        </div>

        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Input
              type="number"
              min={0}
              step={0.1}
              value={start}
              onChange={(event) => {
                const value = Number(event.target.value)
                setStart(value)
                onDraft({ start_time: Number.isFinite(value) ? value : 0 })
              }}
              onBlur={commitStart}
              className="h-8 w-[84px] px-2 text-xs"
              aria-label="Segment start time"
            />
            <span className="text-[10px] text-text-3">to</span>
            <Input
              type="number"
              min={0}
              step={0.1}
              value={end}
              onChange={(event) => {
                const value = Number(event.target.value)
                setEnd(value)
                onDraft({ end_time: Number.isFinite(value) ? value : 0 })
              }}
              onBlur={commitEnd}
              className="h-8 w-[84px] px-2 text-xs"
              aria-label="Segment end time"
            />
            <span className="text-[10px] text-text-3">{duration.toFixed(1)}s</span>
            <span className="text-[10px] text-text-3">
              {formatDuration(start) || '0s'} → {formatDuration(end) || '0s'}
            </span>
            {generating ? (
              <Badge tone="lime">
                <Loader2 className="size-2.5 animate-spin" />
                {progress > 0 ? `${Math.round(progress)}%` : 'generating'}
              </Badge>
            ) : ready ? (
              <Badge tone="success">ready</Badge>
            ) : failed ? (
              <Badge tone="danger">error</Badge>
            ) : (
              <Badge>{segment.status || 'draft'}</Badge>
            )}
          </div>

          <Textarea
            value={prompt}
            onChange={(event) => {
              setPrompt(event.target.value)
              onDraft({ prompt: event.target.value })
            }}
            onBlur={commitPrompt}
            rows={2}
            placeholder="Describe this shot…"
            className="min-h-[56px] px-2.5 py-2 text-xs leading-5"
          />

          {generating ? <Progress value={progress} /> : null}
          {segment.error ? <p className="text-[10px] text-danger">{segment.error}</p> : null}
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <Button
            size="sm"
            variant={playingAudio ? 'soft' : 'ghost'}
            disabled={!audioAvailable}
            onClick={(event) => {
              event.stopPropagation()
              onToggleAudio()
            }}
            icon={playingAudio ? <Pause className="size-3" /> : <Play className="size-3" />}
            title={audioAvailable ? 'Play the song for this section' : 'No audio track set'}
          >
            {playingAudio ? 'Stop' : 'Play section'}
          </Button>
          {ready && segment.video_filename ? (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                if (playingAudio) onToggleAudio()
                setFullscreen(true)
              }}
              icon={<Film className="size-3" />}
              title="Open full screen"
            >
              Open
            </Button>
          ) : null}
          <Button
            size="sm"
            variant={ready ? 'outline' : 'soft'}
            busy={generating}
            disabled={generating || batchActive}
            onClick={onGenerate}
            icon={
              generating ? <Loader2 className="size-3 animate-spin" /> : <Wand2 className="size-3" />
            }
          >
            {ready ? 'Regenerate' : 'Generate'}
          </Button>
          <IconButton
            variant="ghost"
            onClick={onDelete}
            disabled={generating}
            aria-label="Delete segment"
            title="Delete segment"
          >
            <Trash2 className="size-3.5" />
          </IconButton>
        </div>
      </div>
    </div>

    {fullscreen && segment.video_filename ? (
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Segment video preview"
        className="fixed inset-0 z-[100] flex flex-col bg-[#050506]"
      >
        <div className="flex h-14 shrink-0 items-center gap-3 border-b border-white/10 bg-black/40 px-4 md:px-6">
          <Badge tone="lime">segment</Badge>
          <p className="min-w-0 flex-1 truncate text-xs text-text-2">
            {prompt || 'Segment preview'}
          </p>
          <span className="hidden text-[10px] text-text-3 sm:inline">
            {formatDuration(start)} – {formatDuration(end)}
          </span>
          <a
            href={mediaUrl(`/videos/${segment.video_filename}`)}
            download={videoDownloadName}
            className="grid size-8 place-items-center rounded-lg text-white transition hover:bg-white/10"
            title="Download"
          >
            <Download className="size-4" />
          </a>
          <IconButton
            onClick={() => setFullscreen(false)}
            aria-label="Close video preview"
            className="text-white hover:bg-white/10"
          >
            <X className="size-4" />
          </IconButton>
        </div>

        <div className="flex min-h-0 flex-1 items-center justify-center p-3 md:p-8">
          <video
            key={segment.video_filename}
            src={mediaUrl(`/videos/${segment.video_filename}`)}
            controls
            autoPlay
            playsInline
            className="max-h-full max-w-full rounded-lg bg-black shadow-2xl"
          />
        </div>

        <div className="flex shrink-0 items-center justify-center border-t border-white/10 px-4 py-2 text-[10px] text-text-3">
          {videoName || segment.video_filename}
        </div>
      </div>
    ) : null}
    </>
  )
}

export function MusicVideoPage() {
  const queryClient = useQueryClient()
  const history = useHistory()
  const settings = useSettings()

  const toast = useUiStore((s) => s.toast)
  const inspectorId = useUiStore((s) => s.inspectorId)
  const queueAdd = useQueueStore((s) => s.add)
  const queueUpdate = useQueueStore((s) => s.update)

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null)
  const [selectedSegmentId, setSelectedSegmentId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [segmentForm, setSegmentForm] = useState({ start: 0, end: 8, prompt: '' })
  const [activeSegments, setActiveSegments] = useState<Record<string, boolean>>({})
  const [segmentProgress, setSegmentProgress] = useState<Record<string, number>>({})
  const batchState = useMusicBatchStore((s) => s.batch)
  const [showTimings, setShowTimings] = useState(false)
  const [sectionDraft, setSectionDraft] = useState<SectionTiming[]>([])
  const [playingSegmentId, setPlayingSegmentId] = useState<string | null>(null)
  const [playingSong, setPlayingSong] = useState(false)
  const sectionAudioRef = useRef<HTMLAudioElement | null>(null)
  const songAudioRef = useRef<HTMLAudioElement | null>(null)

  const projectsQuery = useQuery({
    queryKey: ['music', 'projects'],
    queryFn: () => apiGet<{ projects: Project[] }>('/music/projects'),
  })
  const projects = projectsQuery.data?.projects ?? []

  const projectQuery = useQuery({
    queryKey: ['music', 'project', selectedId],
    queryFn: () => apiGet<Project>(`/music/projects/${selectedId}`),
    enabled: Boolean(selectedId),
  })
  const project = projectQuery.data
  const slots = project?.slots ?? []
  const selectedSlot = slots.find((slot) => slot.id === selectedSlotId) ?? slots[0]

  useEffect(() => {
    if (selectedSegmentId && !selectedSlot?.segments?.some((segment) => segment.id === selectedSegmentId)) {
      setSelectedSegmentId(null)
    }
  }, [selectedSlot, selectedSegmentId])

  useEffect(() => {
    if (!selectedSegmentId) return
    const timer = window.setTimeout(() => {
      document
        .querySelector(`[data-segment-card="${CSS.escape(selectedSegmentId)}"]`)
        ?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }, 60)
    return () => window.clearTimeout(timer)
  }, [selectedSegmentId])

  const historyAssets = history.data ?? []
  const historyAssetById = useMemo(
    () => new Map(historyAssets.map((asset) => [asset.id, asset])),
    [historyAssets],
  )
  const audioAssets = historyAssets.filter((asset) => assetType(asset) === 'audio')
  const imageAssets = historyAssets.filter((asset) => assetType(asset) === 'image')
  const previewImage = inspectorId
    ? imageAssets.find((asset) => asset.id === inspectorId)
    : undefined
  const videoNameForSegment = (segment: Segment) => {
    const asset = segment.video_asset_id
      ? historyAssetById.get(segment.video_asset_id)
      : undefined
    return asset ? assetDisplayName(asset) : undefined
  }
  const selectedCharacterImage = selectedSlot?.image?.asset_id
    ? imageAssets.find((asset) => asset.id === selectedSlot.image?.asset_id)
    : undefined
  const selectedCharacterImageName = selectedCharacterImage
    ? assetDisplayName(selectedCharacterImage)
    : titleFromPrompt(selectedSlot?.image?.name || selectedSlot?.image?.filename)
  const selectedCharacterImageAspect =
    selectedCharacterImage?.width && selectedCharacterImage?.height
      ? selectedCharacterImage.width / selectedCharacterImage.height
      : undefined

  const allSegments = useMemo(
    () =>
      slots.flatMap((slot) =>
        (slot.segments ?? []).map((segment) => ({ segment, slot })),
      ),
    [slots],
  )

  const audioDuration =
    project?.audio?.duration ??
    audioAssets.find((asset) => asset.id === project?.audio?.asset_id)?.duration
  const duration =
    audioDuration && audioDuration > 0
      ? audioDuration
      : Math.max(8, ...allSegments.map(({ segment }) => segment.end_time || 0))
  const projectModel =
    project?.settings?.model ||
    (settings.data?.video_model === 'fasth3'
      ? 'fasth3'
      : settings.data?.video_model === 'grok'
        ? 'grok'
        : settings.data?.ltx_version === '2.5'
          ? 'ltx25'
          : 'ltx23')
  const segmentMaxDuration = projectModel === 'fasth3' ? 15 : 40

  useEffect(() => {
    return () => {
      sectionAudioRef.current?.pause()
      songAudioRef.current?.pause()
    }
  }, [])

  useEffect(() => {
    sectionAudioRef.current?.pause()
    songAudioRef.current?.pause()
    setPlayingSegmentId(null)
    setPlayingSong(false)
  }, [project?.id, project?.audio?.filename])

  useEffect(() => {
    if (!playingSegmentId) return
    const audio = sectionAudioRef.current
    const item = allSegments.find((entry) => entry.segment.id === playingSegmentId)
    if (!audio || !item) return

    const endTime = Number(item.segment.end_time) || 0
    const stopAtEnd = () => {
      if (audio.currentTime >= endTime - 0.03) {
        audio.pause()
        setPlayingSegmentId(null)
      }
    }
    const onEnded = () => setPlayingSegmentId(null)
    const timer = window.setInterval(stopAtEnd, 30)
    audio.addEventListener('ended', onEnded)
    return () => {
      window.clearInterval(timer)
      audio.removeEventListener('ended', onEnded)
    }
  }, [playingSegmentId, allSegments])

  const batch = batchState?.projectId === project?.id ? batchState : null
  const totalSegments = allSegments.length
  const readySegments = allSegments.filter(({ segment }) => Boolean(segment.video_filename)).length
  const missingSegments = allSegments.filter(({ segment }) => !segment.video_filename).length
  const timedSections = readSections(project?.settings?.sections).filter(
    (section) => section.end > section.start,
  ).length
  const batchActive = Boolean(batch)

  useEffect(() => {
    if (!selectedId && projects[0]) setSelectedId(projects[0].id)
  }, [projects, selectedId])

  useEffect(() => {
    if (project && !selectedSlotId) setSelectedSlotId(project.slots?.[0]?.id ?? null)
    if (project && selectedSlotId && !project.slots?.some((slot) => slot.id === selectedSlotId)) {
      setSelectedSlotId(project.slots?.[0]?.id ?? null)
    }
  }, [project, selectedSlotId])

  useEffect(() => {
    setSectionDraft(readSections(project?.settings?.sections))
  }, [project?.id, project?.settings?.sections])

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ['music'] })
  }

  const showError = (title: string, error: unknown) => {
    toast({
      title,
      description: error instanceof Error ? error.message : undefined,
      tone: 'error',
    })
  }

  const createProject = async () => {
    setCreating(true)
    try {
      const created = await apiPost<Project>('/music/projects', {
        title: 'Untitled Music Video',
      })
      setSelectedId(created.id)
      setSelectedSlotId(null)
      await queryClient.invalidateQueries({ queryKey: ['music', 'projects'] })
      toast({ title: 'Music video project created', tone: 'success' })
    } catch (error) {
      showError('Could not create project', error)
    } finally {
      setCreating(false)
    }
  }

  const deleteProject = async (id: string) => {
    const confirmed = await confirmAction({
      title: 'Delete project?',
      description: 'The music video project will be removed. Library media is kept.',
      confirmLabel: 'Delete project',
      tone: 'danger',
    })
    if (!confirmed) return
    setBusy(`project-${id}`)
    try {
      await apiDelete(`/music/projects/${id}`)
      queryClient.removeQueries({ queryKey: ['music', 'project', id] })
      if (selectedId === id) {
        setSelectedId(null)
        setSelectedSlotId(null)
      }
      await queryClient.invalidateQueries({ queryKey: ['music', 'projects'] })
      toast({ title: 'Project deleted', tone: 'success' })
    } catch (error) {
      showError('Could not delete project', error)
    } finally {
      setBusy(null)
    }
  }

  const patchProject = async (path: string, body: unknown) => {
    if (!project) return
    setBusy(path)
    try {
      await apiPost(`/music/projects/${project.id}${path}`, body)
      await refresh()
    } catch (error) {
      showError('Could not update project', error)
    } finally {
      setBusy(null)
    }
  }

  const saveTitle = async (value: string) => {
    if (!project) return
    const title = value.trim() || 'Untitled Music Video'
    queryClient.setQueryData<Project>(['music', 'project', project.id], { ...project, title })
    await patchProject('/title', { title })
  }

  const updateSlot = async (slotId: string, body: unknown) => {
    setBusy(`slot-${slotId}`)
    try {
      await apiPost(`/music/slots/${slotId}`, body)
      await refresh()
    } catch (error) {
      showError('Could not update character slot', error)
    } finally {
      setBusy(null)
    }
  }

  const saveSections = async (sections: SectionTiming[]) => {
    if (!project) return
    setBusy('sections')
    try {
      await apiPost(`/music/projects/${project.id}/settings`, { settings: { sections } })
      await refresh()
    } catch (error) {
      showError('Could not save section timings', error)
    } finally {
      setBusy(null)
    }
  }

  const updateSection = (index: number, field: 'start' | 'end', value: number) => {
    setSectionDraft((current) =>
      current.map((section, sectionIndex) =>
        sectionIndex === index
          ? { ...section, [field]: Math.max(0, Number.isFinite(value) ? value : 0) }
          : section,
      ),
    )
  }

  const addSegment = async () => {
    if (!selectedSlot) return
    if (segmentForm.end <= segmentForm.start) {
      toast({ title: 'End time must be after start time', tone: 'warning' })
      return
    }
    if (!segmentForm.prompt.trim()) {
      toast({ title: 'Write a prompt for this segment', tone: 'warning' })
      return
    }
    setBusy('segment')
    try {
      await apiPost(`/music/slots/${selectedSlot.id}/segments`, {
        start_time: segmentForm.start,
        end_time: segmentForm.end,
        prompt: segmentForm.prompt,
      })
      setSegmentForm({
        start: segmentForm.end,
        end: segmentForm.end + 6,
        prompt: '',
      })
      await refresh()
    } catch (error) {
      showError('Could not add segment', error)
    } finally {
      setBusy(null)
    }
  }

  const previewSegment = (
    segment: Segment,
    updates: Partial<Pick<Segment, 'start_time' | 'end_time' | 'prompt'>>,
  ) => {
    if (!project) return
    queryClient.setQueryData<Project>(['music', 'project', project.id], (current) => {
      if (!current) return current
      return {
        ...current,
        slots: (current.slots ?? []).map((slot) =>
          slot.id === segment.slot_id
            ? {
                ...slot,
                segments: (slot.segments ?? []).map((item) =>
                  item.id === segment.id ? { ...item, ...updates } : item,
                ),
              }
            : slot,
        ),
      }
    })
  }

  const updateSegment = async (
    segment: Segment,
    updates: Partial<Pick<Segment, 'start_time' | 'end_time' | 'prompt'>>,
  ) => {
    try {
      await apiPost(`/music/segments/${segment.id}`, updates)
    } catch (error) {
      await refresh()
      showError('Could not update segment', error)
    }
  }

  const toggleSong = () => {
    const filename = project?.audio?.filename
    if (!filename) {
      toast({ title: 'Set an audio track first', tone: 'warning' })
      return
    }

    let player = songAudioRef.current
    const source = mediaUrl(`/audio/${filename}`)
    if (!player) {
      player = new Audio(source)
      player.preload = 'auto'
      player.dataset.source = source
      player.addEventListener('ended', () => setPlayingSong(false))
      songAudioRef.current = player
    } else if (player.dataset.source !== source) {
      player.dataset.source = source
      player.src = source
      player.currentTime = 0
      setPlayingSong(false)
    }

    if (playingSong) {
      player.pause()
      setPlayingSong(false)
      return
    }

    sectionAudioRef.current?.pause()
    setPlayingSegmentId(null)
    if (player.ended || (Number.isFinite(player.duration) && player.currentTime >= player.duration - 0.05)) {
      player.currentTime = 0
    }
    setPlayingSong(true)
    void player.play().catch((error: unknown) => {
      setPlayingSong(false)
      showError('Could not play song', error)
    })
  }

  const toggleSectionAudio = (segment: Segment) => {
    const filename = project?.audio?.filename
    if (!filename) {
      toast({ title: 'Set an audio track first', tone: 'warning' })
      return
    }

    songAudioRef.current?.pause()
    setPlayingSong(false)

    const audio = sectionAudioRef.current
    if (playingSegmentId === segment.id) {
      audio?.pause()
      setPlayingSegmentId(null)
      return
    }

    let player = audio
    const source = mediaUrl(`/audio/${filename}`)
    if (!player) {
      player = new Audio(source)
      player.preload = 'auto'
      sectionAudioRef.current = player
    } else if (player.dataset.source !== source) {
      player.dataset.source = source
      player.src = source
    }

    player.pause()
    player.currentTime = Math.max(0, Number(segment.start_time) || 0)
    setPlayingSegmentId(segment.id)
    void player.play().catch((error: unknown) => {
      setPlayingSegmentId(null)
      showError('Could not play section', error)
    })
  }

  const deleteSegment = async (segment: Segment) => {
    const confirmed = await confirmAction({
      title: 'Delete segment?',
      description: `${formatDuration(segment.start_time)} to ${formatDuration(segment.end_time)} will be removed from this character.`,
      confirmLabel: 'Delete segment',
      tone: 'danger',
    })
    if (!confirmed) return
    setBusy(`segment-${segment.id}`)
    try {
      await apiDelete(`/music/segments/${segment.id}`)
      await refresh()
      toast({ title: 'Segment deleted', tone: 'success' })
    } catch (error) {
      showError('Could not delete segment', error)
    } finally {
      setBusy(null)
    }
  }

  const generateSegment = async (segment: Segment, options?: GenerateOptions): Promise<boolean> => {
    if (!project) return false
    const slot = slots.find((item) => item.id === segment.slot_id)
    if (!project.audio?.filename) {
      if (!options?.silent) {
        toast({ title: 'Set an audio track first', tone: 'warning' })
      }
      return false
    }
    if (!slot?.image?.filename) {
      if (!options?.silent) {
        toast({ title: 'Set an image for this character first', tone: 'warning' })
      }
      return false
    }

    const trackQueue = options?.trackQueue !== false
    const jobId = `seg_${segment.id}_${Date.now().toString(36)}`
    const queueId = `music_${segment.id}_${Date.now().toString(36)}`
    const label = `${slot.name || 'Character'} ${Number(segment.start_time).toFixed(1)}–${Number(
      segment.end_time,
    ).toFixed(1)}s`

    if (trackQueue) {
      queueAdd({
        id: queueId,
        label,
        mode: 'video',
        status: 'queued',
        progress: 0,
        stage: 'queued',
        startedAt: Date.now(),
      })
    }

    return runSerializedGeneration(async () => {
      if (trackQueue) {
        queueUpdate(queueId, {
          status: 'running',
          progress: 0,
          stage: 'generating',
          startedAt: Date.now(),
        })
      }

      setActiveSegments((current) => ({ ...current, [segment.id]: true }))
      setSegmentProgress((current) => ({ ...current, [segment.id]: 0 }))

      const stopProgress = watchProgress(jobId, (snapshot) => {
        const percent = percentFromSnapshot(snapshot)
        setSegmentProgress((current) => ({ ...current, [segment.id]: percent }))
        options?.onProgress?.(percent)
        if (trackQueue) {
          queueUpdate(queueId, {
            progress: percent,
            stage: snapshot.stage || 'generating',
          })
        }
      })

      try {
        const result = await apiPost<{ success: boolean; error?: string }>(
          `/music/segments/${segment.id}/generate`,
          {
            job_id: jobId,
            video_upscale: settings.data?.video_upscale || 'off',
            upscale_detail: settings.data?.relayvsr_detail,
          },
        )
        if (!result.success) throw new Error(result.error || 'Generation failed')
        stopProgress()

        if (trackQueue) {
          queueUpdate(queueId, {
            status: 'done',
            progress: 100,
            stage: 'done',
            finishedAt: Date.now(),
          })
        }
        if (!options?.silent) {
          await queryClient.invalidateQueries({ queryKey: ['history'] })
          toast({ title: 'Segment generated', tone: 'success' })
        }
        return true
      } catch (error) {
        stopProgress()
        const message = error instanceof Error ? error.message : 'Generation failed'
        if (trackQueue) {
          queueUpdate(queueId, {
            status: 'error',
            error: message,
            finishedAt: Date.now(),
          })
        }
        if (!options?.silent) showError('Segment generation failed', error)
        return false
      } finally {
        stopProgress()
        if (options?.refresh !== false) await refresh()
        setActiveSegments((current) => {
          const next = { ...current }
          delete next[segment.id]
          return next
        })
        setSegmentProgress((current) => {
          const next = { ...current }
          delete next[segment.id]
          return next
        })
      }
    })
  }

  const runBatch = async (mode: 'all' | 'missing') => {
    if (!project) return
    if (useMusicBatchStore.getState().batch) {
      toast({ title: 'A music video batch is already running', tone: 'warning' })
      return
    }
    const items = slots
      .filter((slot) => Boolean(slot.image?.filename))
      .flatMap((slot) =>
        (slot.segments ?? [])
          .filter((segment) => (mode === 'all' ? true : !segment.video_filename))
          .map((segment) => ({ segment, slot })),
      )

    if (!items.length) {
      toast({
        title: mode === 'all' ? 'No segments to generate' : 'No missing segments',
        tone: 'warning',
      })
      return
    }

    const label = mode === 'all' ? 'All scenes' : 'Missing scenes'
    const confirmed = await confirmAction({
      title: mode === 'all' ? 'Regenerate all scenes?' : 'Generate missing scenes?',
      description:
        mode === 'all'
          ? `${items.length} segment(s) across ${new Set(items.map((item) => item.slot.id)).size} character(s) will be regenerated.`
          : `${items.length} missing segment(s) will be generated.`,
      confirmLabel: mode === 'all' ? 'Regenerate all' : 'Generate missing',
    })
    if (!confirmed) return

    const batchJobId = `music_batch_${Date.now().toString(36)}`
    useMusicBatchStore.getState().start({
      id: batchJobId,
      projectId: project.id,
      label,
      mode,
      total: items.length,
      done: 0,
      currentLabel: '',
      cancelled: false,
    })
    queueAdd({
      id: batchJobId,
      label: `${label} (${items.length})`,
      mode: 'video',
      status: 'running',
      progress: 0,
      stage: `0/${items.length}`,
      startedAt: Date.now(),
    })

    let ok = 0
    let failed = 0

    for (let index = 0; index < items.length; index += 1) {
      if (useMusicBatchStore.getState().batch?.cancelled) break
      const item = items[index]
      const currentLabel = `${item.slot.name || 'Character'} ${Number(
        item.segment.start_time,
      ).toFixed(1)} - ${Number(item.segment.end_time).toFixed(1)}s`
      useMusicBatchStore.getState().update((current) => ({
        ...current,
        currentLabel,
        done: index,
      }))
      queueUpdate(batchJobId, {
        stage: currentLabel,
        progress: (index / items.length) * 100,
      })

      const success = await generateSegment(item.segment, {
        trackQueue: false,
        silent: true,
        refresh: false,
        onProgress: (percent) => {
          queueUpdate(batchJobId, {
            stage: currentLabel,
            progress: ((index + percent / 100) / items.length) * 100,
          })
        },
      })
      if (success) ok += 1
      else failed += 1
      useMusicBatchStore.getState().update((current) => ({
        ...current,
        done: index + 1,
        currentLabel,
      }))
    }

    const cancelled = useMusicBatchStore.getState().batch?.cancelled ?? false
    useMusicBatchStore.getState().clear(batchJobId)
    queueUpdate(batchJobId, {
      status: failed ? 'error' : 'done',
      progress: 100,
      stage: cancelled ? 'cancelled' : 'complete',
      error: failed ? `${failed} segment(s) failed` : undefined,
      finishedAt: Date.now(),
    })

    await refresh()
    await queryClient.invalidateQueries({ queryKey: ['history'] })
    toast({
      title: cancelled
        ? `Batch cancelled — ${ok} generated, ${failed} failed`
        : `Batch complete — ${ok} generated, ${failed} failed`,
      tone: failed ? 'error' : 'success',
    })
  }

  const cancelBatch = () => {
    useMusicBatchStore.getState().requestCancel()
  }

  const clearSegments = async () => {
    if (!project || !totalSegments) return
    const confirmed = await confirmAction({
      title: 'Clear all segments?',
      description: `This removes ${totalSegments} segment(s) from every character. This cannot be undone.`,
      confirmLabel: 'Clear segments',
      tone: 'danger',
    })
    if (!confirmed) return
    setBusy('clear')
    try {
      const result = await apiPost<{ success: boolean; deleted?: number }>(
        `/music/projects/${project.id}/segments/clear`,
      )
      await refresh()
      toast({
        title: 'Segments cleared',
        description: result.deleted ? `${result.deleted} removed` : undefined,
        tone: 'success',
      })
    } catch (error) {
      showError('Could not clear segments', error)
    } finally {
      setBusy(null)
    }
  }

  const reapplyNames = async () => {
    if (!project) return
    const confirmed = await confirmAction({
      title: 'Re-apply export names?',
      description: 'Timecode filenames will be re-applied using the selected project model.',
      confirmLabel: 'Re-apply names',
    })
    if (!confirmed) return
    setBusy('reapply')
    try {
      const result = await apiPost<{ success: boolean; updated?: number; total?: number }>(
        `/music/projects/${project.id}/segments/reapply-names`,
      )
      await refresh()
      toast({
        title: 'Export names updated',
        description: `${result.updated ?? 0} of ${result.total ?? 0} filename(s)`,
        tone: 'success',
      })
    } catch (error) {
      showError('Could not re-apply export names', error)
    } finally {
      setBusy(null)
    }
  }

  const autoCreateSegments = async () => {
    if (!project) return
    if (!timedSections) {
      toast({ title: 'Add section timings first', tone: 'warning' })
      setShowTimings(true)
      return
    }
    const maxClip = segmentMaxDuration
    const confirmed = await confirmAction({
      title: 'Create segments from timings?',
      description: `${timedSections} timed sections will be applied to characters with images that have no segments. Padding: 3s, chunk overlap: 3s, max clip: ${maxClip}s.`,
      confirmLabel: 'Create segments',
    })
    if (!confirmed) return
    setBusy('auto')
    try {
      const result = await apiPost<{
        success: boolean
        created?: number
        slots_processed?: number
      }>(`/music/projects/${project.id}/auto-segments`)
      await refresh()
      toast({
        title: result.created
          ? `Created ${result.created} segments across ${result.slots_processed ?? 0} character(s)`
          : 'No characters to fill',
        description: result.created
          ? undefined
          : 'Add images or clear existing segments first.',
        tone: result.created ? 'success' : 'warning',
      })
    } catch (error) {
      showError('Could not auto-create segments', error)
    } finally {
      setBusy(null)
    }
  }

  const chooseAudio = async (assetId: string) => {
    if (!project || !assetId) return
    const asset = audioAssets.find((item) => item.id === assetId)
    if (!asset) return
    await patchProject('/audio', {
      asset_id: asset.id,
      filename: asset.filename,
      name: asset.prompt || asset.filename,
    })
  }

  const removeAudio = async () => {
    await patchProject('/audio', { asset_id: '', filename: '', name: '' })
  }

  const assignImage = async (assetId: string) => {
    if (!selectedSlot) return
    const asset = imageAssets.find((item) => item.id === assetId)
    if (!asset) return
    await updateSlot(selectedSlot.id, {
      image: {
        asset_id: asset.id,
        filename: asset.filename,
        name: asset.prompt || asset.filename,
      },
    })
  }

  return (
    <div className="mx-auto w-full max-w-[1600px] px-4 pb-10 pt-16 md:px-8 md:pt-8">
      <PageHeader
        eyebrow="Music video"
        title="Build visuals around the track."
        description="Assign characters to slots, write timed segments, and generate every beat."
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => void refresh()}
              icon={<RefreshCcw className="size-3.5" />}
            >
              Refresh
            </Button>
            <Button
              variant="primary"
              onClick={() => void createProject()}
              busy={creating}
              icon={<Plus className="size-4" />}
            >
              New project
            </Button>
          </div>
        }
      />

      <div className="mt-6 grid gap-4 xl:grid-cols-[260px_minmax(0,1fr)]">
        <aside className="rounded-2xl border border-line bg-white/[0.02] p-3">
          <p className="px-2 pb-2 text-[9px] font-semibold uppercase tracking-[0.18em] text-text-3">
            Projects
          </p>
          <div className="max-h-[62dvh] space-y-1 overflow-y-auto">
            {projects.map((item) => (
              <div
                key={item.id}
                className={cn(
                  'flex items-center gap-1 rounded-xl pr-1 transition',
                  selectedId === item.id ? 'bg-lime-soft' : 'hover:bg-white/[0.04]',
                )}
              >
                <button
                  onClick={() => {
                    setSelectedId(item.id)
                    setSelectedSlotId(null)
                  }}
                  className={cn(
                    'min-w-0 flex-1 rounded-xl px-2.5 py-2 text-left transition',
                    selectedId === item.id ? 'text-lime' : 'text-text-2',
                  )}
                >
                  <p className="truncate text-[11px] font-medium">{item.title}</p>
                  <p className="truncate text-[9px] text-text-3">
                    {item.audio?.name || item.audio?.filename || 'No audio'} ·{' '}
                    {modelLabel(item.settings?.model)}
                  </p>
                </button>
                <IconButton
                  variant="ghost"
                  busy={busy === `project-${item.id}`}
                  onClick={() => void deleteProject(item.id)}
                  aria-label={`Delete ${item.title}`}
                  title="Delete project"
                  className="shrink-0"
                >
                  <Trash2 className="size-3.5" />
                </IconButton>
              </div>
            ))}
            {!projects.length && !projectsQuery.isLoading ? (
              <EmptyState
                icon={<Music2 className="size-5" />}
                title="No projects"
                description="Create a project to start building a music video."
              />
            ) : null}
          </div>
        </aside>

        <section className="min-w-0">
          {project ? (
            <div className="space-y-4">
              <div className="rounded-2xl border border-line bg-white/[0.02] p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    value={project.title}
                    onChange={(event) =>
                      queryClient.setQueryData<Project>(
                        ['music', 'project', project.id],
                        { ...project, title: event.target.value },
                      )
                    }
                    onBlur={(event) => void saveTitle(event.currentTarget.value)}
                    className="min-w-[200px] flex-1 border-none bg-transparent font-display text-xl font-semibold text-text outline-none"
                    aria-label="Project title"
                  />
                  <Badge tone="lime">{modelLabel(project.settings?.model)}</Badge>
                  <Badge>{project.settings?.resolution || '720p'}</Badge>
                  <Badge>{project.settings?.aspect_ratio || '3:2'}</Badge>
                  <Button
                    variant="danger"
                    size="sm"
                    busy={busy === `project-${project.id}`}
                    onClick={() => void deleteProject(project.id)}
                    icon={<Trash2 className="size-3.5" />}
                  >
                    Delete
                  </Button>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Select
                    className="w-auto min-w-[130px]"
                    value={project.settings?.model || ''}
                    onChange={(event) =>
                      void patchProject('/settings', {
                        settings: { ...(project.settings || {}), model: event.target.value },
                      })
                    }
                  >
                    {modelOptions.map((model) => (
                      <option key={model.value || 'default'} value={model.value}>
                        {model.label}
                      </option>
                    ))}
                  </Select>
                  <Select
                    className="w-auto min-w-[90px]"
                    value={project.settings?.resolution || '720p'}
                    onChange={(event) =>
                      void patchProject('/settings', {
                        settings: {
                          ...(project.settings || {}),
                          resolution: event.target.value,
                        },
                      })
                    }
                  >
                    {resolutionOptions.map((value) => (
                      <option key={value} value={value}>
                        {value}
                      </option>
                    ))}
                  </Select>
                  <Select
                    className="w-auto min-w-[76px]"
                    value={project.settings?.aspect_ratio || '3:2'}
                    onChange={(event) =>
                      void patchProject('/settings', {
                        settings: {
                          ...(project.settings || {}),
                          aspect_ratio: event.target.value,
                        },
                      })
                    }
                  >
                    {aspectOptions.map((value) => (
                      <option key={value} value={value}>
                        {value}
                      </option>
                    ))}
                  </Select>
                  <Select
                    className="w-auto min-w-[180px]"
                    value={project.audio?.asset_id || ''}
                    onChange={(event) => void chooseAudio(event.target.value)}
                  >
                    <option value="" disabled>
                      Choose audio track…
                    </option>
                    {audioAssets.map((asset) => (
                      <option key={asset.id} value={asset.id}>
                        {titleFromPrompt(asset.prompt || asset.filename)}
                      </option>
                    ))}
                  </Select>
                  <Button
                    variant={playingSong ? 'soft' : 'outline'}
                    size="sm"
                    disabled={!project.audio?.filename}
                    onClick={toggleSong}
                    icon={
                      playingSong ? (
                        <Pause className="size-3.5" />
                      ) : (
                        <Play className="size-3.5" />
                      )
                    }
                    title={project.audio?.filename ? 'Play the full song' : 'Set an audio track first'}
                  >
                    {playingSong ? 'Pause song' : 'Play song'}
                  </Button>
                  {project.audio?.filename ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => void removeAudio()}
                      icon={<X className="size-3.5" />}
                    >
                      Clear audio
                    </Button>
                  ) : null}
                  <a href={apiUrl(`/music/projects/${project.id}/segments/zip`)}>
                    <Button variant="outline" size="sm" icon={<Download className="size-3.5" />}>
                      Export ZIP
                    </Button>
                  </a>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-line pt-3">
                  <Button
                    variant={showTimings ? 'soft' : 'outline'}
                    size="sm"
                    onClick={() => setShowTimings((current) => !current)}
                    icon={<Clock3 className="size-3.5" />}
                  >
                    Timings ({timedSections})
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    busy={busy === 'auto'}
                    disabled={batchActive}
                    onClick={() => void autoCreateSegments()}
                    icon={<Sparkles className="size-3.5" />}
                  >
                    Auto segments
                  </Button>
                  <Button
                    variant="soft"
                    size="sm"
                    disabled={!totalSegments || batchActive}
                    onClick={() => void runBatch('all')}
                    icon={<Wand2 className="size-3.5" />}
                  >
                    Generate all ({totalSegments})
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={!missingSegments || batchActive}
                    onClick={() => void runBatch('missing')}
                    icon={<Wand2 className="size-3.5" />}
                  >
                    Missing ({missingSegments})
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    busy={busy === 'reapply'}
                    disabled={!readySegments || batchActive}
                    onClick={() => void reapplyNames()}
                    icon={<RefreshCcw className="size-3.5" />}
                  >
                    Re-apply names
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    busy={busy === 'clear'}
                    disabled={!totalSegments || batchActive}
                    onClick={() => void clearSegments()}
                    icon={<Eraser className="size-3.5" />}
                  >
                    Clear segments
                  </Button>
                </div>

                {batch ? (
                  <div className="mt-3 rounded-xl border border-lime/20 bg-lime-soft/40 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-[11px] font-medium text-lime">
                        {batch.cancelled ? 'Cancelling' : batch.label} · {batch.done}/{batch.total}
                        {batch.currentLabel ? ` — ${batch.currentLabel}` : ''}
                      </p>
                      <Button
                        variant="danger"
                        size="sm"
                        disabled={batch.cancelled}
                        onClick={cancelBatch}
                        icon={<X className="size-3.5" />}
                      >
                        Cancel
                      </Button>
                    </div>
                    <Progress value={(batch.done / Math.max(1, batch.total)) * 100} className="mt-2" />
                  </div>
                ) : null}

                {showTimings ? (
                  <div className="mt-3 rounded-xl border border-line bg-black/20 p-3">
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-[11px] font-medium text-text">Song sections</p>
                        <p className="text-[9px] text-text-3">
                          Timings drive auto-created segments. Changes save on blur.
                        </p>
                      </div>
                      <Badge>
                        Last end:{' '}
                        {formatDuration(
                          sectionDraft.reduce((max, section) => Math.max(max, section.end), 0),
                        ) || '0s'}
                      </Badge>
                    </div>
                    <div className="max-h-72 space-y-1 overflow-y-auto pr-1">
                      {sectionDraft.map((section, index) => (
                        <div
                          key={section.name}
                          className="grid grid-cols-[minmax(0,1fr)_80px_80px] items-center gap-2"
                        >
                          <span className="truncate text-[10px] text-text-2">{section.name}</span>
                          <Input
                            type="number"
                            min={0}
                            step={0.1}
                            value={section.start}
                            onChange={(event) =>
                              updateSection(index, 'start', Number(event.target.value))
                            }
                            onBlur={() => void saveSections(sectionDraft)}
                            className="h-7 px-2 text-[10px]"
                            aria-label={`${section.name} start`}
                          />
                          <Input
                            type="number"
                            min={0}
                            step={0.1}
                            value={section.end}
                            onChange={(event) =>
                              updateSection(index, 'end', Number(event.target.value))
                            }
                            onBlur={() => void saveSections(sectionDraft)}
                            className="h-7 px-2 text-[10px]"
                            aria-label={`${section.name} end`}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="rounded-2xl border border-line bg-white/[0.02] p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-display text-sm font-semibold">Timeline</p>
                    <p className="text-[10px] text-text-3">
                      Every character track. Select a row to edit its segments.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge tone="lime">{formatDuration(duration) || '0s'}</Badge>
                    <Badge>{totalSegments} segments</Badge>
                    <Badge tone="success">{readySegments} ready</Badge>
                    {missingSegments ? <Badge tone="warning">{missingSegments} missing</Badge> : null}
                  </div>
                </div>

                <div className="mt-4 space-y-1.5">
                  <div className="grid grid-cols-[128px_minmax(0,1fr)] items-center gap-2">
                    <span />
                    <div className="relative h-4 text-[8px] text-text-3">
                      {[0, 25, 50, 75, 100].map((percent) => (
                        <span
                          key={percent}
                          className="absolute top-0 -translate-x-1/2 tabular-nums"
                          style={{ left: `${percent}%` }}
                        >
                          {formatDuration((duration * percent) / 100) || '0s'}
                        </span>
                      ))}
                    </div>
                  </div>
                  {slots.map((slot) => (
                    <div
                      key={slot.id}
                      className="grid grid-cols-[128px_minmax(0,1fr)] items-center gap-2"
                    >
                      <button
                        onClick={() => setSelectedSlotId(slot.id)}
                        className={cn(
                          'flex min-w-0 items-center gap-1.5 rounded-lg px-1.5 py-1 text-left transition',
                          selectedSlot?.id === slot.id
                            ? 'bg-lime-soft text-lime'
                            : 'text-text-2 hover:bg-white/[0.04]',
                        )}
                      >
                        <span className="grid size-6 shrink-0 place-items-center overflow-hidden rounded bg-black">
                          {slot.image?.filename ? (
                            <img
                              src={mediaUrl(`/images/${slot.image.filename}`)}
                              alt=""
                              className="size-full object-cover"
                            />
                          ) : (
                            <Users className="size-3 text-text-3" />
                          )}
                        </span>
                        <span className="truncate text-[10px] font-medium">{slot.name}</span>
                      </button>
                      <button
                        data-timeline-track
                        onClick={() => setSelectedSlotId(slot.id)}
                        className={cn(
                          'relative h-7 overflow-hidden rounded-md border bg-black/35 transition',
                          selectedSlot?.id === slot.id ? 'border-lime/30' : 'border-line',
                        )}
                        aria-label={`Select ${slot.name} timeline`}
                      >
                        {(slot.segments ?? []).map((segment) => (
                          <TimelineSegment
                            key={segment.id}
                            segment={segment}
                            duration={duration}
                            maxDuration={segmentMaxDuration}
                            selected={selectedSegmentId === segment.id}
                            generating={Boolean(activeSegments[segment.id])}
                            ready={Boolean(segment.video_filename)}
                            onSelect={() => {
                              setSelectedSlotId(slot.id)
                              setSelectedSegmentId(segment.id)
                            }}
                            onPreview={(updates) => previewSegment(segment, updates)}
                            onCommit={(updates) => void updateSegment(segment, updates)}
                          />
                        ))}
                      </button>
                    </div>
                  ))}
                  {!slots.some((slot) => (slot.segments ?? []).length) ? (
                    <p className="py-3 text-center text-[10px] text-text-3">
                      No segments yet. Add one below or auto-create from song sections.
                    </p>
                  ) : null}
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
                <div className="rounded-2xl border border-line bg-white/[0.02] p-3">
                  <p className="px-1 pb-2 text-[9px] font-semibold uppercase tracking-[0.18em] text-text-3">
                    Characters
                  </p>
                  <div className="space-y-1">
                    {slots.map((slot) => (
                      <button
                        key={slot.id}
                        onClick={() => setSelectedSlotId(slot.id)}
                        className={cn(
                          'flex w-full items-center gap-2 rounded-xl px-2 py-2 text-left transition',
                          selectedSlot?.id === slot.id
                            ? 'bg-lime-soft text-lime'
                            : 'text-text-2 hover:bg-white/[0.04]',
                        )}
                      >
                        <span className="grid size-8 shrink-0 place-items-center overflow-hidden rounded-lg bg-black">
                          {slot.image?.filename ? (
                            <img
                              src={mediaUrl(`/images/${slot.image.filename}`)}
                              alt=""
                              className="size-full object-cover"
                            />
                          ) : (
                            <Users className="size-3.5 text-text-3" />
                          )}
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate text-[11px] font-medium">{slot.name}</span>
                          <span className="block text-[9px] text-text-3">
                            {slot.segments?.length || 0} segments
                          </span>
                        </span>
                      </button>
                    ))}
                  </div>

                  {selectedSlot ? (
                    <div className="mt-3 space-y-2 border-t border-line pt-3">
                      <Input
                        key={`${selectedSlot.id}:${selectedSlot.name}`}
                        defaultValue={selectedSlot.name}
                        onBlur={(event) => {
                          const name = event.currentTarget.value.trim()
                          if (name && name !== selectedSlot.name) {
                            void updateSlot(selectedSlot.id, { name })
                          }
                        }}
                        placeholder="Character name"
                        className="h-9 text-xs"
                        aria-label="Character name"
                      />
                      <Select
                        value={selectedSlot.image?.asset_id || ''}
                        onChange={(event) => {
                          const value = event.target.value
                          if (value === '__preview__' && previewImage) {
                            void assignImage(previewImage.id)
                          } else if (value) {
                            void assignImage(value)
                          }
                        }}
                      >
                        {previewImage ? (
                          <option value="__preview__">
                            Use from preview — {assetDisplayName(previewImage)}
                          </option>
                        ) : null}
                        <option value="" disabled>
                          Assign character image.
                        </option>
                        {imageAssets.map((asset) => (
                          <option key={asset.id} value={asset.id}>
                            {titleFromPrompt(asset.prompt || asset.filename)}
                          </option>
                        ))}
                      </Select>
                      {selectedSlot.image?.filename ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="w-full"
                          busy={busy === `slot-${selectedSlot.id}`}
                          onClick={() => void updateSlot(selectedSlot.id, { image: {} })}
                          icon={<X className="size-3.5" />}
                        >
                          Remove image
                        </Button>
                      ) : null}
                    </div>
                  ) : null}
                </div>

                <div className="space-y-3">
                  <div className="grid items-stretch gap-3 md:grid-cols-[minmax(0,3fr)_minmax(0,1fr)]">
                    <div className="flex h-full flex-col justify-between rounded-2xl border border-line bg-white/[0.02] p-3">
                      <p className="font-display text-sm font-semibold">
                        {selectedSlot?.name || 'Segments'}
                      </p>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Badge>{selectedSlot?.segments?.length || 0} shots</Badge>
                        <Badge>{formatDuration(duration) || '0s'}</Badge>
                      </div>
                    </div>

                    <div
                      className={cn(
                        'relative overflow-hidden rounded-2xl border border-line bg-black',
                        (!selectedSlot?.image?.filename || !selectedCharacterImageAspect) &&
                          'aspect-video',
                      )}
                      style={
                        selectedCharacterImageAspect
                          ? { aspectRatio: selectedCharacterImageAspect }
                          : undefined
                      }
                      aria-label={`Character image for ${selectedSlot?.name || 'character'}`}
                      title={selectedCharacterImageName}
                    >
                      {selectedSlot?.image?.filename ? (
                        <img
                          src={mediaUrl(`/images/${selectedSlot.image.filename}`)}
                          alt={selectedCharacterImageName || selectedSlot.name}
                          className="size-full object-cover"
                        />
                      ) : (
                        <div className="flex size-full flex-col items-center justify-center gap-1.5 px-2 text-center text-text-3">
                          <Users className="size-6" />
                          <p className="text-[9px] leading-3">No character image</p>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-line bg-white/[0.02] p-4">
                    <p className="mb-3 font-display text-sm font-semibold">Add segment</p>
                    <div className="grid gap-2 sm:grid-cols-[100px_100px_minmax(0,1fr)_auto]">
                      <Input
                        type="number"
                        min={0}
                        step={0.1}
                        value={segmentForm.start}
                        onChange={(event) =>
                          setSegmentForm({ ...segmentForm, start: Number(event.target.value) })
                        }
                        placeholder="Start"
                      />
                      <Input
                        type="number"
                        min={0}
                        step={0.1}
                        value={segmentForm.end}
                        onChange={(event) =>
                          setSegmentForm({ ...segmentForm, end: Number(event.target.value) })
                        }
                        placeholder="End"
                      />
                      <Input
                        value={segmentForm.prompt}
                        onChange={(event) =>
                          setSegmentForm({ ...segmentForm, prompt: event.target.value })
                        }
                        placeholder="Describe this shot…"
                      />
                      <Button
                        variant="soft"
                        onClick={() => void addSegment()}
                        busy={busy === 'segment'}
                        disabled={!selectedSlot}
                      >
                        <Plus className="size-3.5" /> Add
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    {(selectedSlot?.segments ?? []).map((segment) => (
                      <SegmentRow
                        key={segment.id}
                        segment={segment}
                        busy={Boolean(activeSegments[segment.id])}
                        progress={segmentProgress[segment.id] ?? 0}
                        batchActive={batchActive}
                        selected={selectedSegmentId === segment.id}
                        videoName={videoNameForSegment(segment)}
                        playingAudio={playingSegmentId === segment.id}
                        audioAvailable={Boolean(project?.audio?.filename)}
                        onSelect={() => {
                          if (selectedSlot) setSelectedSlotId(selectedSlot.id)
                          setSelectedSegmentId(segment.id)
                        }}
                        onToggleAudio={() => toggleSectionAudio(segment)}
                        onDraft={(updates) => previewSegment(segment, updates)}
                        onSave={(updates) => void updateSegment(segment, updates)}
                        onGenerate={() => void generateSegment(segment)}
                        onDelete={() => void deleteSegment(segment)}
                      />
                    ))}
                    {!selectedSlot?.segments?.length ? (
                      <EmptyState
                        icon={<Clapperboard className="size-6" />}
                        title="No segments yet"
                        description="Add a timed segment above, then generate it against the project audio."
                      />
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <EmptyState
              icon={<Music2 className="size-6" />}
              title={projectsQuery.isLoading ? 'Loading projects…' : 'Select or create a project'}
              description="Music video projects hold your audio, character slots, and timed segment prompts."
              action={
                <Button
                  variant="primary"
                  onClick={() => void createProject()}
                  busy={creating}
                >
                  Create project
                </Button>
              }
            />
          )}
        </section>
      </div>
    </div>
  )
}
