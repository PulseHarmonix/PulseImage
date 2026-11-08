import { useMemo, useRef } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { clamp, cn } from '../../lib/utils'

const BAR_COUNT = 96

function toBars(peaks?: number[]): number[] {
  const values = (peaks ?? []).map((value) => (Number.isFinite(value) ? Math.abs(value) : 0))
  if (!values.length) {
    return Array.from(
      { length: BAR_COUNT },
      (_, index) => 0.16 + Math.abs(Math.sin(index * 0.44)) * 0.14,
    )
  }

  let max = 0
  for (const value of values) max = Math.max(max, value)
  const scale = max > 1 ? 1 / max : 1
  const count = Math.min(BAR_COUNT, Math.max(16, values.length))
  const bars: number[] = []

  for (let index = 0; index < count; index += 1) {
    const start = Math.floor((index / count) * values.length)
    const end = Math.max(start + 1, Math.floor(((index + 1) / count) * values.length))
    let peak = 0
    for (let cursor = start; cursor < end; cursor += 1) {
      peak = Math.max(peak, values[cursor] * scale)
    }
    bars.push(clamp(peak, 0.04, 1))
  }

  return bars
}

export function AudioWaveform({
  peaks,
  currentTime,
  duration,
  onSeek,
  className,
  fillClassName = 'bg-lime',
  baseClassName = 'bg-white/15',
  disabled = false,
  label = 'Seek audio',
}: {
  peaks?: number[]
  currentTime: number
  duration: number
  onSeek: (seconds: number) => void
  className?: string
  fillClassName?: string
  baseClassName?: string
  disabled?: boolean
  label?: string
}) {
  const dragging = useRef(false)
  const bars = useMemo(() => toBars(peaks), [peaks])
  const progress = duration > 0 ? clamp(currentTime / duration, 0, 1) : 0
  const canSeek = !disabled && duration > 0

  const seekFromEvent = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (!canSeek) return
    const rect = event.currentTarget.getBoundingClientRect()
    if (!rect.width) return
    const ratio = clamp((event.clientX - rect.left) / rect.width, 0, 1)
    onSeek(ratio * duration)
  }

  const handlePointerDown = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (!canSeek) return
    dragging.current = true
    event.currentTarget.setPointerCapture(event.pointerId)
    seekFromEvent(event)
  }

  const handlePointerMove = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (!dragging.current) return
    seekFromEvent(event)
  }

  const stopDragging = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (!dragging.current) return
    dragging.current = false
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }

  return (
    <button
      type="button"
      disabled={!canSeek}
      aria-label={label}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={stopDragging}
      onPointerCancel={stopDragging}
      className={cn(
        'relative block h-10 w-full touch-none select-none overflow-hidden rounded-lg border border-line/60 bg-black/25 px-1 text-left transition',
        canSeek ? 'cursor-pointer hover:border-line-strong' : 'cursor-default opacity-70',
        className,
      )}
    >
      <div className="flex h-full w-full items-center gap-[2px]">
        {bars.map((bar, index) => (
          <span
            key={index}
            style={{ height: `${Math.max(8, bar * 100)}%` }}
            className={cn('min-w-px flex-1 rounded-full', baseClassName)}
          />
        ))}
      </div>
      <div
        className="pointer-events-none absolute inset-0 px-1"
        style={{ clipPath: `inset(0 ${100 - progress * 100}% 0 0)` }}
      >
        <div className="flex h-full w-full items-center gap-[2px]">
          {bars.map((bar, index) => (
            <span
              key={index}
              style={{ height: `${Math.max(8, bar * 100)}%` }}
              className={cn('min-w-px flex-1 rounded-full', fillClassName)}
            />
          ))}
        </div>
      </div>
      <div
        className="pointer-events-none absolute inset-y-0 w-0.5 rounded-full bg-white/80"
        style={{ left: `calc(${progress * 100}% - 1px)` }}
      />
    </button>
  )
}
