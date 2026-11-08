import { useEffect, useMemo, useRef, useState } from 'react'
import abcjs from 'abcjs'
import { FileMusic, Pause, Play, X } from 'lucide-react'
import { Badge, IconButton } from '../ui'
import { mediaUrl } from '../../lib/api'
import { parseVocalTiming } from '../../lib/abcTiming'

const samplingLabels: Record<string, string> = {
  temperature: 'Temperature',
  top_p: 'Top P',
  top_k: 'Top K',
  repetition_penalty: 'Repetition',
  penalty_window: 'Penalty window',
  guidance: 'Guidance',
}

function formatClock(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00'
  const total = Math.floor(seconds)
  const minutes = Math.floor(total / 60)
  const secs = total % 60
  return `${minutes}:${secs.toString().padStart(2, '0')}`
}

export function ScorePanel({
  open,
  onClose,
  scoreAbc,
  planning,
  title,
  style,
  lyrics,
  seed,
  maxScoreTokens,
  coverSource,
  audioFilename,
  sampling,
}: {
  open: boolean
  onClose: () => void
  scoreAbc?: string
  planning?: string
  title?: string
  style?: string
  lyrics?: string
  seed?: number
  maxScoreTokens?: number
  coverSource?: string
  audioFilename?: string
  sampling?: {
    abc?: Record<string, number>
    music?: Record<string, number>
  }
}) {
  const scoreRef = useRef<HTMLDivElement>(null)
  const audioRef = useRef<HTMLAudioElement>(null)
  const [playing, setPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [audioDuration, setAudioDuration] = useState(0)

  const timing = useMemo(() => parseVocalTiming(scoreAbc ?? '', lyrics), [scoreAbc, lyrics])
  const audioSrc = audioFilename ? mediaUrl(`/audio/${audioFilename}`) : ''

  useEffect(() => {
    if (!open || !scoreRef.current) return
    scoreRef.current.innerHTML = ''
    if (!scoreAbc?.trim()) return
    try {
      abcjs.renderAbc(scoreRef.current, scoreAbc, {
        responsive: 'resize',
        add_classes: true,
        staffwidth: 920,
        paddingtop: 4,
        paddingbottom: 4,
      })
    } catch {
      scoreRef.current.textContent = scoreAbc
    }
  }, [open, scoreAbc])

  const closePanel = () => {
    const audio = audioRef.current
    if (audio) {
      audio.pause()
      audio.currentTime = 0
    }
    setPlaying(false)
    setCurrentTime(0)
    setAudioDuration(0)
    onClose()
  }

  const togglePlayback = () => {
    const audio = audioRef.current
    if (!audio) return
    if (audio.paused) {
      void audio.play().catch(() => setPlaying(false))
    } else {
      audio.pause()
    }
  }

  const seekTo = (seconds: number) => {
    const audio = audioRef.current
    const limit = audioDuration || timing.duration || 0
    const target = Math.max(0, Math.min(seconds, limit))
    if (audio) audio.currentTime = target
    setCurrentTime(target)
  }

  const playbackDuration = audioDuration || timing.duration || 0
  const totalDuration = playbackDuration || 1
  const playheadPercent = Math.min(100, Math.max(0, (currentTime / totalDuration) * 100))
  const activeSectionIndex = timing.sections.findIndex(
    (section) => currentTime >= section.start && currentTime < section.end,
  )
  const activeLineIndex = timing.lines.findIndex(
    (line) => currentTime >= line.start && currentTime < line.end,
  )

  if (!open) return null

  return (
    <>
      <button
        className="fixed inset-0 z-[70] bg-black/55 backdrop-blur-sm"
        onClick={closePanel}
        aria-label="Close score panel"
      />
      <aside className="fixed inset-y-0 right-0 z-[75] flex w-full max-w-[1040px] flex-col border-l border-line-strong bg-surface shadow-2xl">
        <audio
          ref={audioRef}
          src={audioSrc}
          preload="metadata"
          onLoadStart={() => {
            setPlaying(false)
            setCurrentTime(0)
            setAudioDuration(0)
          }}
          onLoadedMetadata={(event) => setAudioDuration(event.currentTarget.duration || 0)}
          onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onEnded={() => {
            setPlaying(false)
            setCurrentTime(0)
            if (audioRef.current) audioRef.current.currentTime = 0
          }}
          className="hidden"
        />
        <div className="flex items-center gap-3 border-b border-line px-4 py-3">
          <span className="grid size-8 place-items-center rounded-lg bg-lime-soft text-lime">
            <FileMusic className="size-4" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-display text-sm font-semibold">Score &amp; plan</p>
            <p className="truncate text-[10px] text-text-3">{title || 'YuE2 song'}</p>
          </div>
          <IconButton onClick={closePanel} aria-label="Close score panel">
            <X className="size-4" />
          </IconButton>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge tone="lime">{planning || 'unknown'}</Badge>
            {coverSource ? <Badge tone="default">cover</Badge> : null}
            {seed != null ? <Badge>seed {seed}</Badge> : null}
            {maxScoreTokens ? <Badge>{maxScoreTokens} score tokens</Badge> : null}
          </div>

          {audioFilename ? (
            <div className="mt-3 flex items-center gap-3 rounded-xl border border-line bg-black/30 p-2.5">
              <button
                type="button"
                onClick={togglePlayback}
                disabled={!audioSrc}
                aria-label={playing ? 'Pause audio' : 'Play audio'}
                className="grid size-11 shrink-0 place-items-center rounded-full border border-lime/30 bg-lime-soft text-lime transition hover:border-lime/50 disabled:opacity-40"
              >
                {playing ? <Pause className="size-4" /> : <Play className="size-4" />}
              </button>
              <span className="w-9 shrink-0 font-mono text-[10px] text-text-3">
                {formatClock(currentTime)}
              </span>
              <input
                type="range"
                min={0}
                max={playbackDuration}
                step={0.1}
                value={Math.min(currentTime, playbackDuration)}
                onChange={(event) => seekTo(Number(event.target.value))}
                disabled={!playbackDuration}
                aria-label="Seek audio"
                className="h-1 min-w-0 flex-1 cursor-pointer accent-lime disabled:cursor-default disabled:opacity-40"
              />
              <span className="w-9 shrink-0 text-right font-mono text-[10px] text-text-3">
                {formatClock(playbackDuration)}
              </span>
            </div>
          ) : null}

          <p className="mt-4 text-[10px] font-semibold uppercase tracking-[0.16em] text-text-3">
            Sheet music
          </p>
          {scoreAbc?.trim() ? (
            <div className="mt-2 overflow-x-auto rounded-xl border border-line bg-[#f4f1e7] p-3 text-black">
              <div ref={scoreRef} className="min-w-[820px]" />
            </div>
          ) : (
            <div className="mt-2 rounded-xl border border-dashed border-line bg-white/[0.02] p-5 text-center">
              <p className="text-xs text-text-2">No symbolic score was returned.</p>
              <p className="mt-1 text-[10px] text-text-3">
                {planning === 'off'
                  ? 'Off mode generates directly without ABC planning.'
                  : 'This run did not expose an ABC score from ComfyUI.'}
              </p>
            </div>
          )}

          <div className="mt-5">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-text-3">
                Vocal timing
              </p>
              {timing.hasVocal ? (
                <span className="text-[9px] text-text-3">{formatClock(timing.duration)}</span>
              ) : null}
            </div>
            {timing.hasVocal ? (
              <>
                <div className="relative mt-2 h-9 overflow-hidden rounded-lg border border-line bg-black/30">
                  <div className="flex h-full">
                    {timing.sections.map((section, index) => {
                      const width = Math.max(
                        0,
                        ((section.end - section.start) / totalDuration) * 100,
                      )
                      const active = index === activeSectionIndex
                      return (
                        <div
                          key={`${section.label}-${index}`}
                          title={`${section.label} · ${formatClock(section.start)}`}
                          style={{ width: `${width}%` }}
                          className={`flex min-w-0 items-center justify-center border-r border-line/60 px-1 text-[9px] transition last:border-r-0 ${
                            active ? 'bg-lime-soft text-lime' : 'text-text-3'
                          }`}
                        >
                          <span className="truncate capitalize">{section.label}</span>
                        </div>
                      )
                    })}
                  </div>
                  {audioFilename ? (
                    <div
                      className="pointer-events-none absolute inset-y-0 w-0.5 bg-lime"
                      style={{ left: `${playheadPercent}%` }}
                    />
                  ) : null}
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {timing.sections.map((section, index) => (
                    <span
                      key={`${section.label}-${index}-time`}
                      className={`rounded-md border px-1.5 py-1 text-[9px] ${
                        index === activeSectionIndex
                          ? 'border-lime/40 bg-lime-soft text-lime'
                          : 'border-line text-text-3'
                      }`}
                    >
                      <span className="capitalize">{section.label}</span>
                      {' '}
                      {formatClock(section.start)}
                      {section.vocalStart != null &&
                      Math.abs(section.vocalStart - section.start) > 0.5
                        ? ` / vocal ${formatClock(section.vocalStart)}`
                        : ''}
                    </span>
                  ))}
                </div>
                {timing.lines.length ? (
                  <div className="mt-2 space-y-1">
                    {timing.lines.map((line, index) => {
                      const active = index === activeLineIndex
                      return (
                        <button
                          key={`${line.start}-${index}`}
                          type="button"
                          onClick={() => seekTo(line.start)}
                          disabled={!audioFilename}
                          className={`flex w-full items-baseline gap-2 rounded-lg border px-2 py-1.5 text-left transition ${
                            active
                              ? 'border-lime/40 bg-lime-soft/40 text-text'
                              : 'border-transparent text-text-2 hover:border-line hover:bg-white/[0.03]'
                          } disabled:cursor-default`}
                        >
                          <span
                            className={`w-10 shrink-0 font-mono text-[9px] ${
                              active ? 'text-lime' : 'text-text-3'
                            }`}
                          >
                            {formatClock(line.start)}
                          </span>
                          <span className="min-w-0 flex-1 truncate text-[11px]">{line.text}</span>
                          {line.section ? (
                            <span className="shrink-0 text-[9px] text-text-3">{line.section}</span>
                          ) : null}
                        </button>
                      )
                    })}
                  </div>
                ) : (
                  <p className="mt-2 text-[10px] text-text-3">
                    No lyric timing was derived from this score.
                  </p>
                )}
              </>
            ) : (
              <div className="mt-2 rounded-xl border border-dashed border-line bg-white/[0.02] p-3">
                <p className="text-[10px] text-text-3">
                  {scoreAbc?.trim()
                    ? 'No vocal melody or lyrics were exposed in this score.'
                    : 'No score was returned for this run.'}
                </p>
              </div>
            )}
          </div>

          {scoreAbc?.trim() ? (
            <details className="mt-3">
              <summary className="cursor-pointer text-[10px] text-text-3">ABC source</summary>
              <pre className="mt-2 max-h-56 overflow-auto whitespace-pre-wrap rounded-xl border border-line bg-black/30 p-3 text-[10px] leading-5 text-text-2">
                {scoreAbc}
              </pre>
            </details>
          ) : null}

          <div className="mt-5 space-y-2 border-t border-line pt-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-text-3">
              Plan details
            </p>
            {sampling && (sampling.abc || sampling.music) ? (
              <div>
                <p className="text-[9px] uppercase tracking-wider text-text-3">Sampling</p>
                <div className="mt-1 space-y-1.5">
                  {sampling.abc ? (
                    <div>
                      <p className="text-[9px] font-medium text-text-2">ABC</p>
                      <div className="mt-0.5 flex flex-wrap gap-1.5">
                        {Object.entries(sampling.abc).map(([key, value]) => (
                          <span
                            key={key}
                            className="rounded-md border border-line px-1.5 py-1 text-[9px] text-text-3"
                          >
                            {samplingLabels[key] ?? key}{' '}
                            <span className="font-mono text-text-2">{value}</span>
                          </span>
                        ))}
                      </div>
                    </div>
                  ) : null}
                  {sampling.music ? (
                    <div>
                      <p className="text-[9px] font-medium text-text-2">Music</p>
                      <div className="mt-0.5 flex flex-wrap gap-1.5">
                        {Object.entries(sampling.music).map(([key, value]) => (
                          <span
                            key={key}
                            className="rounded-md border border-line px-1.5 py-1 text-[9px] text-text-3"
                          >
                            {samplingLabels[key] ?? key}{' '}
                            <span className="font-mono text-text-2">{value}</span>
                          </span>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            ) : null}
            {style ? (
              <div>
                <p className="text-[9px] uppercase tracking-wider text-text-3">Style</p>
                <p className="mt-0.5 whitespace-pre-wrap text-[11px] leading-5 text-text-2">
                  {style}
                </p>
              </div>
            ) : null}
            {lyrics ? (
              <div>
                <p className="text-[9px] uppercase tracking-wider text-text-3">Lyrics</p>
                <pre className="mt-0.5 max-h-48 overflow-auto whitespace-pre-wrap font-sans text-[11px] leading-5 text-text-2">
                  {lyrics}
                </pre>
              </div>
            ) : null}
          </div>
        </div>
      </aside>
    </>
  )
}
