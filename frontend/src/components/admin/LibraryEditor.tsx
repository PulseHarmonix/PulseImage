import { useCallback, useEffect, useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import {
  AudioLines,
  Image as ImageIcon,
  Mic2,
  RefreshCcw,
  Search,
  Star,
  Trash2,
  User,
  Video,
} from 'lucide-react'
import { apiGet, apiPost, mediaUrl } from '../../lib/api'
import { queryKeys } from '../../lib/queries'
import { useUiStore } from '../../stores/ui'
import { confirmAction } from '../../stores/confirm'
import { assetType, cn, formatDuration, titleFromPrompt } from '../../lib/utils'
import { Badge, Button, Input, Select } from '../ui'
import type { Asset } from '../../types'

type FilterType = 'all' | 'image' | 'video' | 'audio'

export function LibraryEditor() {
  const queryClient = useQueryClient()
  const toast = useUiStore((s) => s.toast)
  const [items, setItems] = useState<Asset[]>([])
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<FilterType>('all')
  const [loading, setLoading] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [limit, setLimit] = useState(100)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const result = await apiGet<{ generations?: Asset[] }>('/admin/generations')
      setItems(result.generations ?? [])
    } catch (error) {
      toast({
        title: 'Could not load library',
        description: error instanceof Error ? error.message : undefined,
        tone: 'error',
      })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    void load()
  }, [load])

  const filtered = useMemo(() => {
    const search = query.trim().toLowerCase()
    return items.filter((asset) => {
      if (filter !== 'all' && assetType(asset) !== filter) return false
      if (!search) return true
      return `${asset.prompt || ''} ${asset.filename || ''} ${asset.id}`.toLowerCase().includes(search)
    })
  }, [items, query, filter])

  const visible = filtered.slice(0, limit)

  const toggle = async (asset: Asset, key: 'favorite' | 'character' | 'voice') => {
    const value = !asset[key]
    setBusyId(asset.id)
    try {
      await apiPost('/admin/update-generation', { id: asset.id, [key]: value })
      setItems((current) =>
        current.map((item) => (item.id === asset.id ? { ...item, [key]: value } : item)),
      )
      void queryClient.invalidateQueries({ queryKey: queryKeys.history })
    } catch (error) {
      toast({
        title: 'Could not update asset',
        description: error instanceof Error ? error.message : undefined,
        tone: 'error',
      })
    } finally {
      setBusyId(null)
    }
  }

  const remove = async (asset: Asset) => {
    const confirmed = await confirmAction({
      title: 'Delete asset?',
      description: `"${titleFromPrompt(asset.prompt) || asset.filename}" will be permanently removed. This cannot be undone.`,
      confirmLabel: 'Delete asset',
      tone: 'danger',
    })
    if (!confirmed) return
    setBusyId(asset.id)
    try {
      await apiPost('/admin/delete-generation', { id: asset.id })
      setItems((current) => current.filter((item) => item.id !== asset.id))
      void queryClient.invalidateQueries({ queryKey: queryKeys.history })
      toast({ title: 'Asset deleted', tone: 'success' })
    } catch (error) {
      toast({
        title: 'Delete failed',
        description: error instanceof Error ? error.message : undefined,
        tone: 'error',
      })
    } finally {
      setBusyId(null)
    }
  }

  return (
    <section className="rounded-2xl border border-line bg-white/[0.02] p-4">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-sm font-semibold">Library editor</h2>
          <p className="text-[10px] text-text-3">
            Favorite, character, and voice flags plus destructive deletes for every generation.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge>{filtered.length} items</Badge>
          <Button size="sm" variant="outline" onClick={() => void load()} busy={loading} icon={<RefreshCcw className="size-3.5" />}>
            Refresh
          </Button>
        </div>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1 md:max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-text-3" />
          <Input
            value={query}
            onChange={(event) => {
              setQuery(event.target.value)
              setLimit(100)
            }}
            placeholder="Search prompts, files, or ids…"
            className="h-9 pl-9 text-xs"
          />
        </div>
        <Select
          value={filter}
          onChange={(event) => {
            setFilter(event.target.value as FilterType)
            setLimit(100)
          }}
        >
          <option value="all">All types</option>
          <option value="image">Images</option>
          <option value="video">Videos</option>
          <option value="audio">Audio</option>
        </Select>
      </div>

      <div className="overflow-x-auto rounded-xl border border-line">
        <div className="min-w-[760px]">
          <div className="grid grid-cols-[56px_minmax(0,1fr)_120px_150px_44px] gap-3 border-b border-line bg-white/[0.03] px-3 py-2 text-[9px] font-semibold uppercase tracking-[0.14em] text-text-3">
            <span />
            <span>Generation</span>
            <span>Type</span>
            <span>Flags</span>
            <span />
          </div>
          <div className="max-h-[520px] overflow-y-auto">
            {visible.map((asset) => {
              const type = assetType(asset)
              const busy = busyId === asset.id
              return (
                <div
                  key={asset.id}
                  className="grid grid-cols-[56px_minmax(0,1fr)_120px_150px_44px] items-center gap-3 border-b border-line/60 px-3 py-2 last:border-b-0 hover:bg-white/[0.02]"
                >
                  <AssetThumbnail asset={asset} />
                  <div className="min-w-0">
                    <p className="truncate text-[11px] font-medium text-text">
                      {titleFromPrompt(asset.prompt || asset.filename)}
                    </p>
                    <p className="truncate text-[9px] text-text-3" title={asset.filename}>
                      {asset.filename}
                    </p>
                    <p className="truncate font-mono text-[9px] text-text-3/70" title={asset.id}>
                      {asset.id}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-1">
                    <Badge>{type}</Badge>
                    {asset.duration ? <span className="text-[9px] text-text-3">{formatDuration(asset.duration)}</span> : null}
                    {asset.width && asset.height ? (
                      <span className="text-[9px] text-text-3">
                        {asset.width}×{asset.height}
                      </span>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-1">
                    <FlagButton
                      active={Boolean(asset.favorite)}
                      disabled={busy}
                      label="Favorite"
                      onClick={() => void toggle(asset, 'favorite')}
                    >
                      <Star className={cn('size-3.5', asset.favorite && 'fill-current')} />
                    </FlagButton>
                    {type === 'image' ? (
                      <FlagButton
                        active={Boolean(asset.character)}
                        disabled={busy}
                        label="Character"
                        onClick={() => void toggle(asset, 'character')}
                      >
                        <User className="size-3.5" />
                      </FlagButton>
                    ) : null}
                    {type === 'audio' ? (
                      <FlagButton
                        active={Boolean(asset.voice)}
                        disabled={busy}
                        label="Voice"
                        onClick={() => void toggle(asset, 'voice')}
                      >
                        <Mic2 className="size-3.5" />
                      </FlagButton>
                    ) : null}
                  </div>
                  <Button
                    size="icon"
                    variant="danger"
                    disabled={busy}
                    onClick={() => void remove(asset)}
                    aria-label={`Delete ${asset.filename}`}
                    title="Delete generation"
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              )
            })}
            {filtered.length > visible.length ? (
              <div className="flex justify-center border-t border-line p-3">
                <Button size="sm" variant="outline" onClick={() => setLimit((value) => value + 100)}>
                  Load more ({filtered.length - visible.length} remaining)
                </Button>
              </div>
            ) : null}
            {!filtered.length ? (
              <p className="p-6 text-center text-[11px] text-text-3">
                {loading ? 'Loading generations…' : 'No matching generations.'}
              </p>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  )
}

function AssetThumbnail({ asset }: { asset: Asset }) {
  const [broken, setBroken] = useState(false)
  const type = assetType(asset)
  const Icon = type === 'video' ? Video : type === 'audio' ? AudioLines : ImageIcon

  if (type === 'audio' || broken) {
    return (
      <span className="grid size-12 place-items-center rounded-lg border border-line bg-black/30 text-text-3">
        <Icon className="size-4" />
      </span>
    )
  }

  return (
    <img
      src={mediaUrl(`/thumbnails/${asset.id}.jpg`)}
      alt={asset.filename}
      loading="lazy"
      onError={() => setBroken(true)}
      className="size-12 rounded-lg border border-line object-cover"
    />
  )
}

function FlagButton({
  active,
  disabled,
  label,
  onClick,
  children,
}: {
  active: boolean
  disabled?: boolean
  label: string
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      title={label}
      aria-label={label}
      aria-pressed={active}
      className={cn(
        'grid size-7 place-items-center rounded-lg border transition disabled:opacity-40',
        active
          ? 'border-lime/30 bg-lime-soft text-lime'
          : 'border-line bg-transparent text-text-3 hover:border-line-strong hover:text-text',
      )}
    >
      {children}
    </button>
  )
}
