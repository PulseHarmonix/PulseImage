import { useEffect } from 'react'
import {
  Maximize2,
  Minimize2,
  Pause,
  Play,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react'
import { useMusicPlayerStore } from '../../stores/musicPlayer'
import { useUiStore } from '../../stores/ui'
import { IconButton } from '../ui'
import { cn } from '../../lib/utils'

function formatClock(seconds?: number): string {
  const total = Math.max(0, Math.floor(seconds && Number.isFinite(seconds) ? seconds : 0))
  const minutes = Math.floor(total / 60)
  const rest = total % 60
  return `${minutes}:${String(rest).padStart(2, '0')}`
}

export function MusicPlayerBar() {
  const sidebarCollapsed = useUiStore((state) => state.sidebarCollapsed)
  const track = useMusicPlayerStore((state) => state.track)
  const playing = useMusicPlayerStore((state) => state.playing)
  const currentTime = useMusicPlayerStore((state) => state.currentTime)
  const duration = useMusicPlayerStore((state) => state.duration)
  const volume = useMusicPlayerStore((state) => state.volume)
  const muted = useMusicPlayerStore((state) => state.muted)
  const expanded = useMusicPlayerStore((state) => state.expanded)
  const visible = useMusicPlayerStore((state) => state.visible)
  const toggle = useMusicPlayerStore((state) => state.toggle)
  const next = useMusicPlayerStore((state) => state.next)
  const previous = useMusicPlayerStore((state) => state.previous)
  const seek = useMusicPlayerStore((state) => state.seek)
  const setVolume = useMusicPlayerStore((state) => state.setVolume)
  const toggleMute = useMusicPlayerStore((state) => state.toggleMute)
  const setExpanded = useMusicPlayerStore((state) => state.setExpanded)
  const stop = useMusicPlayerStore((state) => state.stop)

  useEffect(() => {
    if (!visible) return
    const height = expanded ? '88px' : '56px'
    document.documentElement.style.setProperty('--music-player-height', height)
    return () => {
      document.documentElement.style.removeProperty('--music-player-height')
    }
  }, [expanded, visible])

  if (!visible || !track) return null

  const styleLabel = track.style || track.styleTags.join(' · ')
  const total = duration > 0 ? duration : (track.duration ?? 0)
  const progress = total > 0 ? Math.min(currentTime, total) : 0

  return (
    <div
      className={cn(
        'fixed inset-x-0 bottom-0 z-[57] border-t border-line-strong bg-surface/95 shadow-[0_-16px_50px_rgba(0,0,0,0.35)] backdrop-blur-2xl md:pl-[264px]',
        sidebarCollapsed && 'md:pl-[76px]',
      )}
    >
      {expanded ? (
        <div className="flex h-[88px] items-center gap-2 px-2 md:gap-4 md:px-4">
          <div className="min-w-0 flex-1 md:w-56 md:flex-none">
            <p className="truncate text-xs font-medium text-text">{track.title}</p>
            {styleLabel ? (
              <p className="truncate text-[10px] text-text-3">{styleLabel}</p>
            ) : null}
          </div>

          <div className="flex shrink-0 items-center gap-0.5">
            <IconButton
              className="size-8"
              onClick={previous}
              aria-label="Previous track"
              title="Previous track"
            >
              <SkipBack className="size-4" />
            </IconButton>
            <IconButton
              className="size-9 bg-white/[0.04] text-text"
              onClick={toggle}
              aria-label={playing ? 'Pause' : 'Play'}
              title={playing ? 'Pause' : 'Play'}
            >
              {playing ? <Pause className="size-4" /> : <Play className="size-4" />}
            </IconButton>
            <IconButton
              className="size-8"
              onClick={next}
              aria-label="Next track"
              title="Next track"
            >
              <SkipForward className="size-4" />
            </IconButton>
          </div>

          <div className="hidden min-w-0 flex-1 items-center gap-2 sm:flex">
            <span className="w-9 shrink-0 text-right text-[10px] tabular-nums text-text-3">
              {formatClock(progress)}
            </span>
            <input
              type="range"
              min={0}
              max={total || 0}
              step={0.1}
              value={progress}
              onChange={(event) => seek(Number(event.target.value))}
              className="h-1 w-full cursor-pointer accent-lime"
              aria-label="Seek"
            />
            <span className="w-9 shrink-0 text-[10px] tabular-nums text-text-3">
              {formatClock(total)}
            </span>
          </div>

          <div className="hidden items-center gap-1 md:flex">
            <IconButton
              className="size-8"
              onClick={toggleMute}
              aria-label={muted ? 'Unmute' : 'Mute'}
              title={muted ? 'Unmute' : 'Mute'}
            >
              {muted ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
            </IconButton>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={muted ? 0 : volume}
              onChange={(event) => {
                const value = Number(event.target.value)
                if (muted) toggleMute()
                setVolume(value)
              }}
              className="h-1 w-20 cursor-pointer accent-lime"
              aria-label="Volume"
            />
          </div>

          <IconButton
            className="size-8"
            onClick={() => setExpanded(false)}
            aria-label="Compact player"
            title="Compact player"
          >
            <Minimize2 className="size-4" />
          </IconButton>
          <IconButton
            className="size-8"
            onClick={stop}
            aria-label="Close player"
            title="Close player"
          >
            <X className="size-4" />
          </IconButton>
        </div>
      ) : (
        <div className="flex h-14 items-center gap-2 px-3 md:px-4">
          <div className="flex min-w-0 flex-1 items-baseline gap-2">
            <p className="truncate text-xs font-medium text-text">{track.title}</p>
            {styleLabel ? (
              <span className="hidden truncate text-[10px] text-text-3 sm:inline">
                {styleLabel}
              </span>
            ) : null}
          </div>
          <IconButton
            className="size-8"
            onClick={toggle}
            aria-label={playing ? 'Pause' : 'Play'}
            title={playing ? 'Pause' : 'Play'}
          >
            {playing ? <Pause className="size-4" /> : <Play className="size-4" />}
          </IconButton>
          <IconButton
            className="size-8"
            onClick={next}
            aria-label="Next track"
            title="Next track"
          >
            <SkipForward className="size-4" />
          </IconButton>
          <IconButton
            className="size-8"
            onClick={() => setExpanded(true)}
            aria-label="Expand player"
            title="Expand player"
          >
            <Maximize2 className="size-4" />
          </IconButton>
          <IconButton
            className="size-8"
            onClick={stop}
            aria-label="Close player"
            title="Close player"
          >
            <X className="size-4" />
          </IconButton>
        </div>
      )}
    </div>
  )
}
