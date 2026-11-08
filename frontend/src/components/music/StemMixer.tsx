import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Pause, Play, Volume2, VolumeX } from 'lucide-react'
import { mediaUrl } from '../../lib/api'
import {
  formatStemClock,
  normalizeStem,
  stemMeta,
  stemRank,
  type StemInfo,
  type StemMeta,
  type StemSource,
} from '../../lib/stems'
import { clamp, cn } from '../../lib/utils'
import { AudioWaveform } from './AudioWaveform'

interface MixerRow {
  key: string
  name: string
  filename: string
  waveform?: number[]
  duration?: number
  meta: StemMeta
  isOriginal: boolean
  rank: number
}

export function StemMixer({ source, stems }: { source: StemSource; stems: StemInfo[] }) {
  const rows = useMemo<MixerRow[]>(() => {
    const original: MixerRow = {
      key: 'original',
      name: 'Original mix',
      filename: source?.filename || '',
      waveform: source?.waveform,
      duration: source?.duration,
      meta: stemMeta('original'),
      isOriginal: true,
      rank: -1,
    }

    const stemRows = stems.map((stem, index) => {
      const normalized = normalizeStem(stem.stem)
      const meta = stemMeta(stem.stem)
      return {
        key: stem.id ? `stem-${stem.id}` : `${normalized || 'stem'}-${index}`,
        name: stem.name || meta.label,
        filename: stem.filename,
        waveform: stem.waveform,
        duration: stem.duration,
        meta,
        isOriginal: false,
        rank: stemRank(stem.stem),
      }
    })

    stemRows.sort((a, b) => a.rank - b.rank)
    return [original, ...stemRows]
  }, [source, stems])

  const [playing, setPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [mediaDuration, setMediaDuration] = useState(0)
  const [muted, setMuted] = useState<Record<string, boolean>>({})
  const [solo, setSolo] = useState<Record<string, boolean>>({})
  const [volumes, setVolumes] = useState<Record<string, number>>({})
  const audioRefs = useRef(new Map<string, HTMLAudioElement>())

  const duration = useMemo(() => {
    const stemMax = stems.reduce((max, stem) => Math.max(max, stem.duration ?? 0), 0)
    return source?.duration || stemMax || mediaDuration
  }, [source?.duration, stems, mediaDuration])

  const masterKey = useMemo(() => {
    const original = rows.find((row) => row.isOriginal && row.filename)
    return original?.key ?? rows.find((row) => row.filename)?.key ?? null
  }, [rows])

  const anySolo = rows.some((row) => Boolean(solo[row.key]))
  const isRowMuted = useCallback(
    (row: MixerRow) => muted[row.key] ?? !row.isOriginal,
    [muted],
  )
  const rowVolume = useCallback(
    (row: MixerRow) => clamp(volumes[row.key] ?? 1, 0, 1),
    [volumes],
  )

  const pauseAll = useCallback(() => {
    for (const audio of audioRefs.current.values()) audio.pause()
  }, [])

  const seekTo = useCallback(
    (seconds: number) => {
      const target = duration > 0 ? clamp(seconds, 0, duration) : Math.max(0, seconds)
      for (const audio of audioRefs.current.values()) {
        try {
          audio.currentTime = target
        } catch {
          continue
        }
      }
      setCurrentTime(target)
    },
    [duration],
  )

  useEffect(() => {
    const hasSolo = rows.some((row) => Boolean(solo[row.key]))
    const master = masterKey ? audioRefs.current.get(masterKey) : undefined

    for (const row of rows) {
      const audio = audioRefs.current.get(row.key)
      if (!audio) continue
      const audible = hasSolo ? Boolean(solo[row.key]) : !isRowMuted(row)
      const isMaster = row.key === masterKey
      const volume = rowVolume(row)
      audio.volume = isMaster && !audible ? 0 : volume

      if (!playing) {
        audio.pause()
        continue
      }

      if (audible || isMaster) {
        if (audio.paused) {
          if (master && !isMaster) {
            try {
              audio.currentTime = master.currentTime
            } catch {
              audio.currentTime = 0
            }
          }
          void audio.play().catch(() => undefined)
        }
      } else if (!audio.paused) {
        audio.pause()
      }
    }
  }, [playing, rows, muted, solo, volumes, masterKey, isRowMuted, rowVolume])

  useEffect(
    () => () => {
      for (const audio of audioRefs.current.values()) audio.pause()
    },
    [],
  )

  const startPlayback = () => {
    const hasSolo = rows.some((row) => Boolean(solo[row.key]))
    const start = currentTime

    for (const row of rows) {
      const audio = audioRefs.current.get(row.key)
      if (!audio) continue
      const audible = hasSolo ? Boolean(solo[row.key]) : !isRowMuted(row)
      const isMaster = row.key === masterKey
      try {
        audio.currentTime = start
      } catch {
        continue
      }
      audio.volume = isMaster && !audible ? 0 : rowVolume(row)
      if (audible || isMaster) void audio.play().catch(() => undefined)
    }

    setCurrentTime(start)
    setPlaying(true)
  }

  const togglePlayback = () => {
    if (playing) {
      pauseAll()
      setPlaying(false)
      return
    }
    startPlayback()
  }

  const finishPlayback = () => {
    pauseAll()
    for (const audio of audioRefs.current.values()) {
      try {
        audio.currentTime = 0
      } catch {
        continue
      }
    }
    setCurrentTime(0)
    setPlaying(false)
  }

  const toggleMuted = (row: MixerRow) => {
    setMuted((prev) => ({
      ...prev,
      [row.key]: !(prev[row.key] ?? !row.isOriginal),
    }))
  }

  const toggleSolo = (key: string) => {
    setSolo((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  const setVolume = (key: string, value: number) => {
    setVolumes((prev) => ({ ...prev, [key]: clamp(value, 0, 1) }))
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 rounded-xl border border-line bg-black/30 p-2.5">
        <button
          type="button"
          onClick={togglePlayback}
          aria-label={playing ? 'Pause stems' : 'Play stems'}
          className="grid size-11 shrink-0 place-items-center rounded-full border border-lime/30 bg-lime-soft text-lime transition hover:border-lime/50"
        >
          {playing ? <Pause className="size-4" /> : <Play className="size-4" />}
        </button>
        <span className="w-10 shrink-0 font-mono text-[10px] text-text-3">
          {formatStemClock(currentTime)}
        </span>
        <input
          type="range"
          min={0}
          max={duration || 0}
          step={0.05}
          value={duration ? Math.min(currentTime, duration) : 0}
          onChange={(event) => seekTo(Number(event.target.value))}
          disabled={!duration}
          aria-label="Seek stems"
          className="h-1 min-w-0 flex-1 cursor-pointer accent-lime disabled:cursor-default disabled:opacity-40"
        />
        <span className="w-10 shrink-0 text-right font-mono text-[10px] text-text-3">
          {formatStemClock(duration)}
        </span>
      </div>

      <div className="space-y-2">
        {rows.map((row) => {
          const audible = anySolo ? Boolean(solo[row.key]) : !isRowMuted(row)
          const volume = rowVolume(row)
          const Icon = row.meta.icon
          return (
            <div
              key={row.key}
              className={cn(
                'rounded-xl border p-2.5 transition',
                audible
                  ? 'border-line bg-white/[0.03]'
                  : 'border-line/60 bg-white/[0.01] opacity-75',
              )}
            >
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    'grid size-8 shrink-0 place-items-center rounded-lg',
                    row.meta.soft,
                  )}
                >
                  <Icon className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[11px] font-medium">{row.name}</p>
                  <p className="truncate text-[9px] text-text-3">
                    {row.isOriginal ? 'Source mix' : row.meta.label}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => toggleMuted(row)}
                  aria-pressed={isRowMuted(row)}
                  aria-label={`Mute ${row.name}`}
                  title="Mute"
                  className={cn(
                    'grid size-6 shrink-0 place-items-center rounded-md border text-[9px] font-semibold transition',
                    isRowMuted(row)
                      ? 'border-danger/40 bg-danger-soft text-danger'
                      : 'border-line text-text-3 hover:border-line-strong hover:text-text-2',
                  )}
                >
                  M
                </button>
                <button
                  type="button"
                  onClick={() => toggleSolo(row.key)}
                  aria-pressed={Boolean(solo[row.key])}
                  aria-label={`Solo ${row.name}`}
                  title="Solo"
                  className={cn(
                    'grid size-6 shrink-0 place-items-center rounded-md border text-[9px] font-semibold transition',
                    solo[row.key]
                      ? 'border-lime/40 bg-lime-soft text-lime'
                      : 'border-line text-text-3 hover:border-line-strong hover:text-text-2',
                  )}
                >
                  S
                </button>
                <div className="flex shrink-0 items-center gap-1.5">
                  {volume === 0 ? (
                    <VolumeX className="size-3.5 text-text-3" />
                  ) : (
                    <Volume2 className="size-3.5 text-text-3" />
                  )}
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.01}
                    value={volume}
                    onChange={(event) => setVolume(row.key, Number(event.target.value))}
                    aria-label={`${row.name} volume`}
                    className="h-1 w-14 cursor-pointer accent-lime"
                  />
                </div>
              </div>
              <div className="mt-2">
                <AudioWaveform
                  peaks={row.waveform}
                  currentTime={currentTime}
                  duration={duration}
                  onSeek={seekTo}
                  fillClassName={row.meta.fill}
                  label={`Seek ${row.name}`}
                />
              </div>
            </div>
          )
        })}
      </div>

      <div className="hidden">
        {rows.map((row) =>
          row.filename ? (
            <audio
              key={row.key}
              ref={(element) => {
                if (element) audioRefs.current.set(row.key, element)
                else audioRefs.current.delete(row.key)
              }}
              src={mediaUrl(`/audio/${row.filename}`)}
              preload="metadata"
              onLoadedMetadata={(event) => {
                const audio = event.currentTarget
                if (!audio) return
                setMediaDuration((prev) => Math.max(prev, audio.duration || 0))
              }}
              onTimeUpdate={(event) => {
                const audio = event.currentTarget
                if (row.key === masterKey && audio) setCurrentTime(audio.currentTime)
              }}
              onEnded={() => {
                if (row.key === masterKey) finishPlayback()
              }}
            />
          ) : null,
        )}
      </div>
    </div>
  )
}
