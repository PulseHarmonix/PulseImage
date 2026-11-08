import { useEffect, useMemo, useState, type DragEvent, type MouseEvent } from 'react'
import { Check, Heart, Image as ImageIcon, Layers3, Play, Star, User, Volume2, Zap } from 'lucide-react'
import { useUiStore } from '../../stores/ui'
import { mediaUrl } from '../../lib/api'
import { dispatchAttachAsset, dragPayload } from '../../lib/assets'
import { assetType, cn, formatDuration, inferAspect, parseMetadata, titleFromPrompt } from '../../lib/utils'
import { Badge } from '../ui'
import type { Asset } from '../../types'

export function MediaCard({
  asset,
  compact = false,
  selected = false,
  highlighted = false,
  selectMode = false,
  stemCount,
  onToggleSelect,
}: {
  asset: Asset
  compact?: boolean
  selected?: boolean
  highlighted?: boolean
  selectMode?: boolean
  stemCount?: number
  onToggleSelect?: (asset: Asset) => void
}) {
  const openInspector = useUiStore((s) => s.openInspector)
  const [thumbBroken, setThumbBroken] = useState(false)
  const type = assetType(asset)
  const meta = parseMetadata(asset)
  const gen = meta.gen
  const fallbackSrc = mediaUrl(
    type === 'video' ? `/videos/${asset.filename}` : type === 'audio' ? `/audio/${asset.filename}` : `/images/${asset.filename}`,
  )
  const src = thumbBroken ? fallbackSrc : mediaUrl(`/thumbnails/${asset.id}.jpg`)
  const upscale = gen?.upscale?.status === 'done'
  const label = String(meta.name || titleFromPrompt(gen?.original_prompt || asset.prompt))

  const handleClick = () => {
    if (selectMode) {
      onToggleSelect?.(asset)
      return
    }
    openInspector(asset.id)
  }

  const handleDoubleClick = (event: MouseEvent<HTMLButtonElement>) => {
    if (selectMode) return
    event.preventDefault()
    event.stopPropagation()
    dispatchAttachAsset(asset)
  }

  const handleDragStart = (event: DragEvent<HTMLButtonElement>) => {
    const payload = JSON.stringify(dragPayload(asset))
    event.dataTransfer.setData('application/json', payload)
    event.dataTransfer.setData('text/plain', payload)
    event.dataTransfer.effectAllowed = 'copy'
  }

  return (
    <button
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      onDragStart={handleDragStart}
      draggable
      data-asset-id={asset.id}
      className={cn(
        'group relative block w-full overflow-hidden rounded-xl border bg-surface text-left transition duration-200 hover:z-10 hover:-translate-y-0.5 hover:border-line-strong',
        selected || highlighted ? 'border-lime/70 ring-1 ring-lime/30' : 'border-line',
      )}
      style={{ aspectRatio: inferAspect(asset) }}
      aria-label={selectMode ? `${selected ? 'Deselect' : 'Select'} ${label}` : `Open ${label}`}
    >
      {type === 'image' || type === 'video' ? (
        <>
          <img
            src={src}
            alt={label}
            loading="lazy"
            onError={() => setThumbBroken(true)}
            className="size-full object-cover transition duration-300 group-hover:scale-[1.02]"
          />
          {type === 'video' ? (
            <span className="absolute inset-0 grid place-items-center bg-black/10 opacity-0 transition group-hover:opacity-100">
              <span className="grid size-10 place-items-center rounded-full bg-black/65 text-white backdrop-blur">
                <Play className="ml-0.5 size-4 fill-current" />
              </span>
            </span>
          ) : null}
        </>
      ) : (
        <div className="flex size-full flex-col items-center justify-center gap-3 bg-[#0d0e0f] p-4">
          <span className="grid size-12 place-items-center rounded-2xl bg-lime-soft text-lime">
            <Volume2 className="size-5" />
          </span>
          <span className="line-clamp-2 text-center text-[11px] text-text-2">{label}</span>
        </div>
      )}

      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />

      <div className="absolute left-2 top-2 flex gap-1">
        {selectMode ? (
          <span
            className={cn(
              'grid size-5 place-items-center rounded-md border backdrop-blur transition',
              selected
                ? 'border-lime bg-lime text-bg'
                : 'border-white/60 bg-black/45 text-transparent',
            )}
          >
            <Check className="size-3" strokeWidth={3} />
          </span>
        ) : compact ? null : (
          <span className="grid size-6 place-items-center rounded-md bg-black/50 text-white backdrop-blur">
            {type === 'video' ? (
              <Play className="size-2.5 fill-current" />
            ) : type === 'audio' ? (
              <Volume2 className="size-2.5" />
            ) : (
              <ImageIcon className="size-2.5" />
            )}
          </span>
        )}
        {upscale ? (
          <Badge tone="success" className="bg-black/55 backdrop-blur">
            <Zap className="size-2.5" /> 2×
          </Badge>
        ) : null}
        {stemCount ? (
          <Badge className="bg-black/55 backdrop-blur">
            <Layers3 className="size-2.5" /> {stemCount} stems
          </Badge>
        ) : null}
      </div>

      <div className="absolute right-2 top-2 flex gap-1">
        {asset.favorite ? <Star className="size-3.5 fill-warning text-warning drop-shadow" /> : null}
        {asset.character ? <User className="size-3.5 text-sky-300 drop-shadow" /> : null}
        {asset.voice ? <Volume2 className="size-3.5 text-lime drop-shadow" /> : null}
      </div>

      <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 p-2.5">
        <div className="min-w-0">
          <p className="line-clamp-1 text-[11px] font-medium text-white/90">{label}</p>
          <p className="mt-0.5 flex items-center gap-1.5 text-[9px] text-white/50">
            {asset.duration ? <span>{formatDuration(asset.duration)}</span> : null}
            {asset.width && asset.height ? <span>{asset.width}×{asset.height}</span> : null}
          </p>
        </div>
        {asset.favorite ? <Heart className="size-3 fill-warning text-warning" /> : null}
      </div>
    </button>
  )
}

function columnCountFor(compact: boolean): number {
  const width = window.innerWidth
  if (compact) {
    return width >= 1280 ? 7 : width >= 768 ? 5 : 3
  }
  return width >= 1536 ? 5 : width >= 1280 ? 4 : width >= 768 ? 3 : 2
}

function useColumnCount(compact: boolean): number {
  const [count, setCount] = useState(() => columnCountFor(compact))
  useEffect(() => {
    const update = () => setCount(columnCountFor(compact))
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [compact])
  return count
}

function aspectRatio(asset: Asset): number {
  const [width, height] = inferAspect(asset)
    .split('/')
    .map((value) => Number(value.trim()))
  return width > 0 && height > 0 ? width / height : 16 / 9
}

export function MediaGrid({
  assets,
  compact,
  loading,
  selectMode = false,
  selectedIds,
  highlightedId,
  stemCounts,
  onToggleSelect,
}: {
  assets: Asset[]
  compact?: boolean
  loading?: boolean
  selectMode?: boolean
  selectedIds?: Set<string>
  highlightedId?: string | null
  stemCounts?: Map<string, number>
  onToggleSelect?: (asset: Asset) => void
}) {
  const columnCount = useColumnCount(Boolean(compact))
  const columns = useMemo(() => {
    const next = Array.from({ length: columnCount }, () => [] as Asset[])
    const heights = Array.from({ length: columnCount }, () => 0)
    for (const asset of assets) {
      let shortest = 0
      for (let index = 1; index < heights.length; index += 1) {
        if (heights[index] < heights[shortest]) shortest = index
      }
      next[shortest].push(asset)
      heights[shortest] += 1 / aspectRatio(asset)
    }
    return next
  }, [assets, columnCount])

  const gridStyle = {
    gridTemplateColumns: `repeat(${columnCount}, minmax(0, 1fr))`,
  }

  if (loading) {
    return (
      <div className="grid items-start gap-2" style={gridStyle}>
        {Array.from({ length: 10 }).map((_, index) => (
          <div
            key={index}
            className="skeleton rounded-xl border border-line"
            style={{ aspectRatio: '4 / 5' }}
          />
        ))}
      </div>
    )
  }

  return (
    <div className="grid items-start gap-2" style={gridStyle}>
      {columns.map((column, columnIndex) => (
        <div key={columnIndex} className="min-w-0 space-y-2">
          {column.map((asset) => (
            <MediaCard
              key={asset.id}
              asset={asset}
              compact={compact}
              selectMode={selectMode}
              selected={selectedIds?.has(asset.id) ?? false}
              highlighted={highlightedId === asset.id}
              stemCount={stemCounts?.get(asset.id)}
              onToggleSelect={onToggleSelect}
            />
          ))}
        </div>
      ))}
    </div>
  )
}
