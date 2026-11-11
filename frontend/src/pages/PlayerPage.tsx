import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Calendar,
  Clock,
  ListMusic,
  Music2,
  PanelRightClose,
  PanelRightOpen,
  Pause,
  Play,
  Sparkles,
  X,
} from 'lucide-react'
import { useHistory } from '../lib/queries'
import { musicTracksFromAssets, type MusicTrack } from '../lib/musicTracks'
import { useMusicPlayerStore } from '../stores/musicPlayer'
import { PageContainer } from '../components/shell/PageContainer'
import { PageHeader } from '../components/shell/PageHeader'
import { Badge, Button, EmptyState, IconButton, Select } from '../components/ui'
import { cn, formatDuration } from '../lib/utils'

type SortKey = 'newest' | 'oldest' | 'name-asc' | 'name-desc' | 'style'

const sortOptions: { value: SortKey; label: string }[] = [
  { value: 'newest', label: 'Newest' },
  { value: 'oldest', label: 'Oldest' },
  { value: 'name-asc', label: 'Name A-Z' },
  { value: 'name-desc', label: 'Name Z-A' },
  { value: 'style', label: 'Style A-Z' },
]

const artGradients = [
  'from-emerald-400/35 via-teal-500/20 to-cyan-700/30',
  'from-fuchsia-500/35 via-purple-600/20 to-indigo-700/30',
  'from-amber-400/35 via-orange-500/20 to-rose-600/30',
  'from-sky-400/35 via-blue-500/20 to-indigo-700/30',
  'from-rose-400/35 via-pink-500/20 to-fuchsia-700/30',
  'from-lime/35 via-emerald-500/20 to-teal-700/30',
]

function artGradient(key: string): string {
  let hash = 0
  for (let index = 0; index < key.length; index += 1) {
    hash = (hash * 31 + key.charCodeAt(index)) >>> 0
  }
  return artGradients[hash % artGradients.length]
}

function trackTags(track: MusicTrack): string[] {
  const seen = new Set<string>()
  const tags: string[] = []
  for (const raw of track.styleTags ?? []) {
    for (const part of raw.split(',')) {
      const tag = part.trim()
      const key = tag.toLowerCase()
      if (!tag || seen.has(key)) continue
      seen.add(key)
      tags.push(tag)
    }
  }
  return tags
}

function trackStyle(track: MusicTrack): string {
  return track.style?.trim() || trackTags(track).join(', ')
}

function trackTimestamp(track: MusicTrack): number {
  if (!track.created) return 0
  const time = new Date(track.created).getTime()
  return Number.isFinite(time) ? time : 0
}

function formatDate(value?: string): string {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

const chipClass =
  'inline-flex items-center rounded-full border border-line bg-white/[0.04] px-2 py-0.5 text-[9px] font-medium text-text-2'

export function PlayerPage() {
  const history = useHistory()
  const navigate = useNavigate()
  const currentTrack = useMusicPlayerStore((s) => s.track)
  const playing = useMusicPlayerStore((s) => s.playing)
  const playTrack = useMusicPlayerStore((s) => s.playTrack)
  const toggle = useMusicPlayerStore((s) => s.toggle)

  const [sort, setSort] = useState<SortKey>('newest')
  const [styleFilter, setStyleFilter] = useState('all')
  const [lyricsOpen, setLyricsOpen] = useState(() =>
    typeof window === 'undefined'
      ? true
      : window.matchMedia('(min-width: 1024px)').matches,
  )

  const tracks = useMemo(
    () => musicTracksFromAssets(history.data ?? []),
    [history.data],
  )

  const styleCounts = useMemo(() => {
    const counts = new Map<string, { label: string; count: number }>()
    for (const track of tracks) {
      for (const tag of trackTags(track)) {
        const key = tag.toLowerCase()
        const existing = counts.get(key)
        if (existing) existing.count += 1
        else counts.set(key, { label: tag, count: 1 })
      }
    }
    return [...counts.values()].sort((a, b) => a.label.localeCompare(b.label))
  }, [tracks])

  const visibleTracks = useMemo(() => {
    const activeStyle = styleFilter.toLowerCase()
    const filtered =
      styleFilter === 'all'
        ? [...tracks]
        : tracks.filter((track) =>
            trackTags(track).some((tag) => tag.toLowerCase() === activeStyle),
          )

    filtered.sort((a, b) => {
      switch (sort) {
        case 'newest':
          return trackTimestamp(b) - trackTimestamp(a)
        case 'oldest':
          return trackTimestamp(a) - trackTimestamp(b)
        case 'name-asc':
          return a.title.localeCompare(b.title)
        case 'name-desc':
          return b.title.localeCompare(a.title)
        case 'style':
          return (
            trackStyle(a).localeCompare(trackStyle(b)) || a.title.localeCompare(b.title)
          )
        default:
          return 0
      }
    })

    return filtered
  }, [tracks, styleFilter, sort])

  const clearFilters = () => setStyleFilter('all')
  const goGenerate = () => navigate('/songs')

  const handleTrackClick = (track: MusicTrack) => {
    if (currentTrack?.id === track.id) {
      toggle()
      return
    }
    playTrack(track, visibleTracks)
  }

  return (
    <PageContainer className="pb-40">
      <PageHeader
        eyebrow="Music"
        title="Player"
        description="Play the songs in your Library, filter by style, and follow along with the lyrics."
        actions={
          <Button
            variant="primary"
            size="sm"
            icon={<Sparkles className="size-3.5" />}
            onClick={goGenerate}
          >
            Generate music
          </Button>
        }
      />

      <div
        className={cn(
          'mt-6 grid gap-4',
          lyricsOpen
            ? 'lg:grid-cols-[minmax(0,1fr)_minmax(300px,360px)]'
            : 'grid-cols-1',
        )}
      >
        <section className="min-w-0 space-y-3">
          <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-line bg-white/[0.02] p-2.5">
            <div className="flex items-center gap-1.5 text-text-3">
              <ListMusic className="size-4 text-lime" />
              <span className="text-[11px] font-medium">
                {visibleTracks.length} track{visibleTracks.length === 1 ? '' : 's'}
              </span>
            </div>

            <div className="ml-auto flex flex-wrap items-center gap-2">
              <Select
                aria-label="Sort tracks"
                className="h-8 min-w-[122px]"
                value={sort}
                onChange={(event) => setSort(event.target.value as SortKey)}
              >
                {sortOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>

              <Select
                aria-label="Filter by style"
                className="h-8 min-w-[150px]"
                value={styleFilter}
                onChange={(event) => setStyleFilter(event.target.value)}
              >
                <option value="all">All styles</option>
                {styleCounts.map((style) => (
                  <option key={style.label.toLowerCase()} value={style.label.toLowerCase()}>
                    {style.label} ({style.count})
                  </option>
                ))}
              </Select>

              {styleFilter !== 'all' ? (
                <Button
                  variant="ghost"
                  size="sm"
                  icon={<X className="size-3.5" />}
                  onClick={clearFilters}
                >
                  Clear
                </Button>
              ) : null}

              <IconButton
                variant="outline"
                className="h-8 w-8"
                onClick={() => setLyricsOpen((open) => !open)}
                aria-label={lyricsOpen ? 'Hide lyrics panel' : 'Show lyrics panel'}
                title={lyricsOpen ? 'Hide lyrics' : 'Show lyrics'}
              >
                {lyricsOpen ? (
                  <PanelRightClose className="size-4" />
                ) : (
                  <PanelRightOpen className="size-4" />
                )}
              </IconButton>
            </div>
          </div>

          {history.isLoading && !history.data ? (
            <div className="rounded-2xl border border-line bg-white/[0.02] p-8 text-center text-xs text-text-3">
              Loading your music...
            </div>
          ) : tracks.length === 0 ? (
            <EmptyState
              icon={<Music2 className="size-6" />}
              title="No music yet"
              description="Generate a song and it will appear here, ready to play."
              action={
                <Button
                  variant="primary"
                  size="sm"
                  icon={<Sparkles className="size-3.5" />}
                  onClick={goGenerate}
                >
                  Generate music
                </Button>
              }
            />
          ) : visibleTracks.length === 0 ? (
            <EmptyState
              icon={<ListMusic className="size-6" />}
              title="No tracks match these filters"
              description="Try a different style or clear the filter to see all of your music."
              action={
                <Button
                  variant="outline"
                  size="sm"
                  icon={<X className="size-3.5" />}
                  onClick={clearFilters}
                >
                  Clear filters
                </Button>
              }
            />
          ) : (
            <div className="space-y-2">
              {visibleTracks.map((track) => {
                const tags = trackTags(track)
                const isCurrent = currentTrack?.id === track.id
                const isPlaying = isCurrent && playing
                const date = formatDate(track.created)
                const duration = formatDuration(track.duration)
                return (
                  <button
                    key={track.id}
                    type="button"
                    onClick={() => handleTrackClick(track)}
                    aria-pressed={isCurrent}
                    className={cn(
                      'group flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition',
                      isCurrent
                        ? 'border-lime/40 bg-lime-soft/40'
                        : 'border-line bg-white/[0.02] hover:border-line-strong hover:bg-white/[0.04]',
                    )}
                  >
                    <span
                      className={cn(
                        'relative grid size-14 shrink-0 place-items-center overflow-hidden rounded-xl bg-gradient-to-br text-white/85',
                        artGradient(track.id),
                      )}
                    >
                      <span className="absolute inset-0 bg-black/10" />
                      {isPlaying ? (
                        <Pause className="size-5 fill-current" />
                      ) : (
                        <Play className="size-5 fill-current" />
                      )}
                    </span>

                    <span className="min-w-0 flex-1">
                      <span className="flex min-w-0 items-center gap-2">
                        <span
                          className={cn(
                            'truncate text-sm font-semibold',
                            isCurrent ? 'text-lime' : 'text-text',
                          )}
                        >
                          {track.title}
                        </span>
                        {isCurrent ? (
                          <Badge tone="lime">{isPlaying ? 'playing' : 'paused'}</Badge>
                        ) : null}
                      </span>

                      {tags.length ? (
                        <span className="mt-1 flex flex-wrap gap-1">
                          {tags.slice(0, 4).map((tag) => (
                            <span key={tag} className={chipClass}>
                              {tag}
                            </span>
                          ))}
                          {tags.length > 4 ? (
                            <span className={chipClass}>+{tags.length - 4}</span>
                          ) : null}
                        </span>
                      ) : trackStyle(track) ? (
                        <span className="mt-1 block truncate text-[10px] text-text-3">
                          {trackStyle(track)}
                        </span>
                      ) : null}

                      <span className="mt-1.5 flex flex-wrap items-center gap-2 text-[10px] text-text-3">
                        {date ? (
                          <span className="inline-flex items-center gap-1">
                            <Calendar className="size-3" />
                            {date}
                          </span>
                        ) : null}
                        {duration ? (
                          <span className="inline-flex items-center gap-1">
                            <Clock className="size-3" />
                            {duration}
                          </span>
                        ) : null}
                      </span>
                    </span>
                  </button>
                )
              })}
            </div>
          )}
        </section>

        {lyricsOpen ? (
          <LyricsPanel
            track={currentTrack}
            onClose={() => setLyricsOpen(false)}
            className="hidden lg:flex lg:sticky lg:top-6 lg:max-h-[calc(100dvh-220px)]"
          />
        ) : null}
      </div>

      {lyricsOpen ? (
        <div className="fixed inset-0 z-[78] lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/65 backdrop-blur-sm"
            onClick={() => setLyricsOpen(false)}
            aria-label="Close lyrics panel"
          />
          <div className="absolute inset-y-0 right-0 flex w-[min(92vw,400px)] flex-col p-2">
            <LyricsPanel
              track={currentTrack}
              onClose={() => setLyricsOpen(false)}
              className="h-full bg-surface shadow-2xl"
            />
          </div>
        </div>
      ) : null}
    </PageContainer>
  )
}

function LyricsPanel({
  track,
  onClose,
  className,
}: {
  track: MusicTrack | null
  onClose: () => void
  className?: string
}) {
  const tags = track ? trackTags(track) : []
  const date = track ? formatDate(track.created) : ''
  const duration = track ? formatDuration(track.duration) : ''

  return (
    <aside
      className={cn(
        'flex min-h-0 flex-col rounded-2xl border border-line bg-white/[0.02]',
        className,
      )}
    >
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-line px-4 py-3">
        <div className="flex items-center gap-2">
          <ListMusic className="size-4 text-lime" />
          <p className="font-display text-sm font-semibold">Lyrics</p>
        </div>
        <IconButton
          className="h-7 w-7"
          onClick={onClose}
          aria-label="Close lyrics panel"
          title="Close lyrics"
        >
          <PanelRightClose className="size-4" />
        </IconButton>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {!track ? (
          <div className="flex h-full min-h-[200px] flex-col items-center justify-center gap-2 text-center">
            <Music2 className="size-6 text-text-3" />
            <p className="text-xs text-text-3">Select a song to see its lyrics</p>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-3">
              <span
                className={cn(
                  'grid size-12 shrink-0 place-items-center rounded-xl bg-gradient-to-br text-white/85',
                  artGradient(track.id),
                )}
              >
                <Music2 className="size-5" />
              </span>
              <div className="min-w-0">
                <p className="truncate font-display text-sm font-semibold">{track.title}</p>
                <p className="truncate text-[10px] text-text-3">
                  {trackStyle(track) || 'Untitled style'}
                </p>
              </div>
            </div>

            {tags.length ? (
              <div className="mt-3 flex flex-wrap gap-1">
                {tags.map((tag) => (
                  <span key={tag} className={chipClass}>
                    {tag}
                  </span>
                ))}
              </div>
            ) : null}

            <div className="mt-2 flex flex-wrap items-center gap-3 text-[10px] text-text-3">
              <span className="inline-flex items-center gap-1">
                <Calendar className="size-3" />
                {date || 'Unknown date'}
              </span>
              <span className="inline-flex items-center gap-1">
                <Clock className="size-3" />
                {duration || 'Unknown length'}
              </span>
            </div>

            <div className="mt-4 border-t border-line pt-4">
              {track.lyrics?.trim() ? (
                <p className="whitespace-pre-wrap text-xs leading-6 text-text-2">
                  {track.lyrics}
                </p>
              ) : (
                <p className="text-xs italic text-text-3">Instrumental — no lyrics</p>
              )}
            </div>
          </>
        )}
      </div>
    </aside>
  )
}
