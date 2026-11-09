import { useEffect, useMemo, useRef, useState, type DragEvent } from 'react'
import {
  AudioLines,
  Check,
  CheckSquare,
  Filter,
  Grid2X2,
  Heart,
  Image as ImageIcon,
  Layers3,
  LayoutGrid,
  Music2,
  Search,
  Trash2,
  Upload,
  User,
  Video,
} from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { useHistory, queryKeys } from '../lib/queries'
import {
  apiDeleteGeneration,
  apiPost,
  apiUpdateGeneration,
  apiUpload,
} from '../lib/api'
import { MediaGrid } from '../components/media/MediaGrid'
import { PageContainer } from '../components/shell/PageContainer'
import { PageHeader } from '../components/shell/PageHeader'
import { Badge, Button, Dialog, DialogContent, EmptyState, Input } from '../components/ui'
import { useUiStore } from '../stores/ui'
import { confirmAction } from '../stores/confirm'
import { assetType, cn, parseMetadata } from '../lib/utils'
import type { Asset } from '../types'


type FilterKey = 'image' | 'video' | 'audio' | 'music' | 'voice' | 'character' | 'favorite' | 'stems'

const filters: { key: FilterKey; label: string; icon: typeof ImageIcon }[] = [
  { key: 'image', label: 'Images', icon: ImageIcon },
  { key: 'video', label: 'Videos', icon: Video },
  { key: 'audio', label: 'Audio', icon: AudioLines },
  { key: 'music', label: 'Music', icon: Music2 },
  { key: 'voice', label: 'Voices', icon: AudioLines },
  { key: 'stems', label: 'Stems', icon: Layers3 },
  { key: 'character', label: 'Characters', icon: User },
  { key: 'favorite', label: 'Favorites', icon: Heart },
]

export function LibraryPage() {
  const history = useHistory()
  const [active, setActive] = useState<FilterKey[]>([])
  const [query, setQuery] = useState('')
  const [density, setDensity] = useState<'full' | 'compact'>('full')
  const [limit, setLimit] = useState(48)

  const filtered = useMemo(() => {
    const assets = history.data ?? []
    const search = query.trim().toLowerCase()
    const typeFilters: FilterKey[] = active.filter((key) => key === 'image' || key === 'video' || key === 'audio')
    const flags = active.filter((key) => key !== 'image' && key !== 'video' && key !== 'audio')
    const stemsActive = active.includes('stems')

    return assets.filter((asset) => {
      const type = assetType(asset)
      const meta = parseMetadata(asset)
      const isStem = meta.source === 'stems' || meta.kind === 'stem'
      if (stemsActive ? !isStem : isStem) return false
      if (typeFilters.length && !typeFilters.includes(type as FilterKey)) return false
      if (flags.includes('favorite') && !asset.favorite) return false
      if (flags.includes('character') && !asset.character) return false
      if (flags.includes('voice') && !asset.voice) return false
      if (flags.includes('music')) {
        if (type !== 'audio' || !(meta.source === 'yue2' || meta.is_music === true)) {
          return false
        }
      }
      if (!search) return true
      return `${asset.prompt || ''} ${asset.filename}`.toLowerCase().includes(search)
    })
  }, [active, history.data, query])

  const stemCounts = useMemo(() => {
    const counts = new Map<string, number>()
    for (const asset of history.data ?? []) {
      const meta = parseMetadata(asset)
      if (!(meta.source === 'stems' || meta.kind === 'stem')) continue
      const stem = meta.stem as { parent_id?: string } | undefined
      const parentId = asset.parent_id ?? stem?.parent_id
      if (!parentId) continue
      counts.set(parentId, (counts.get(parentId) ?? 0) + 1)
    }
    return counts
  }, [history.data])

  const visible = filtered.slice(0, limit)

  const queryClient = useQueryClient()
  const toast = useUiStore((s) => s.toast)
  const inspectorId = useUiStore((s) => s.inspectorId)

  useEffect(() => {
    if (!inspectorId) return
    const timer = window.setTimeout(() => {
      document
        .querySelector(`[data-asset-id="${CSS.escape(inspectorId)}"]`)
        ?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }, 80)
    return () => window.clearTimeout(timer)
  }, [inspectorId])
  const [dragActive, setDragActive] = useState(false)
  const dragDepth = useRef(0)
  const [importing, setImporting] = useState(false)
  const [pendingImports, setPendingImports] = useState<
    { file: File; name: string }[] | null
  >(null)
  const [selectMode, setSelectMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkBusy, setBulkBusy] = useState(false)

  const selectedAssets = useMemo(
    () => (history.data ?? []).filter((asset) => selectedIds.has(asset.id)),
    [history.data, selectedIds],
  )
  const allFavorited = selectedAssets.length > 0 && selectedAssets.every((asset) => asset.favorite)

  const toggleSelectionMode = () => {
    setSelectMode((current) => !current)
    setSelectedIds(new Set())
  }

  const toggleSelect = (asset: Asset) => {
    setSelectedIds((current) => {
      const next = new Set(current)
      if (next.has(asset.id)) next.delete(asset.id)
      else next.add(asset.id)
      return next
    })
  }

  const selectVisible = () => {
    setSelectedIds(new Set(visible.map((asset) => asset.id)))
  }

  const bulkFavorite = async () => {
    if (!selectedAssets.length || bulkBusy) return
    const value = !allFavorited
    setBulkBusy(true)
    try {
      await Promise.all(
        selectedAssets.map((asset) => apiUpdateGeneration(asset.id, { favorite: value })),
      )
      void queryClient.invalidateQueries({ queryKey: queryKeys.history })
      toast({
        title: `${value ? 'Favorited' : 'Unfavorited'} ${selectedAssets.length} ${
          selectedAssets.length === 1 ? 'asset' : 'assets'
        }`,
        tone: 'success',
      })
    } catch (error) {
      toast({
        title: 'Could not update assets',
        description: error instanceof Error ? error.message : undefined,
        tone: 'error',
      })
    } finally {
      setBulkBusy(false)
    }
  }

  const bulkDelete = async () => {
    if (!selectedAssets.length || bulkBusy) return
    const confirmed = await confirmAction({
      title: `Delete ${selectedAssets.length} ${
        selectedAssets.length === 1 ? 'asset' : 'assets'
      }?`,
      description: 'This cannot be undone.',
      confirmLabel: 'Delete',
      tone: 'danger',
    })
    if (!confirmed) return
    setBulkBusy(true)
    try {
      await Promise.all(selectedAssets.map((asset) => apiDeleteGeneration(asset.id)))
      setSelectedIds(new Set())
      void queryClient.invalidateQueries({ queryKey: queryKeys.history })
      toast({
        title: `Deleted ${selectedAssets.length} ${
          selectedAssets.length === 1 ? 'asset' : 'assets'
        }`,
        tone: 'success',
      })
    } catch (error) {
      toast({
        title: 'Delete failed',
        description: error instanceof Error ? error.message : undefined,
        tone: 'error',
      })
    } finally {
      setBulkBusy(false)
    }
  }

  const toggleFilter = (key: FilterKey) => {
    setActive((current) =>
      current.includes(key) ? current.filter((item) => item !== key) : [...current, key],
    )
    setLimit(48)
  }

  const hasFiles = (event: DragEvent<HTMLDivElement>) =>
    Array.from(event.dataTransfer.types).includes('Files')

  const handleDragEnter = (event: DragEvent<HTMLDivElement>) => {
    if (!hasFiles(event)) return
    event.preventDefault()
    dragDepth.current += 1
    setDragActive(true)
  }

  const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
    if (!hasFiles(event)) return
    event.preventDefault()
    event.dataTransfer.dropEffect = 'copy'
  }

  const handleDragLeave = (event: DragEvent<HTMLDivElement>) => {
    if (!hasFiles(event)) return
    event.preventDefault()
    dragDepth.current = Math.max(0, dragDepth.current - 1)
    if (dragDepth.current === 0) setDragActive(false)
  }

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    if (!hasFiles(event)) return
    event.preventDefault()
    dragDepth.current = 0
    setDragActive(false)
    void importFiles(Array.from(event.dataTransfer.files))
  }

  const importFiles = (files: File[]) => {
    if (!files.length || importing) return
    setPendingImports(
      files.map((file) => ({
        file,
        name: file.name.replace(/\.[^/.]+$/, ''),
      })),
    )
  }

  const updateImportName = (index: number, name: string) => {
    setPendingImports((current) =>
      current?.map((item, itemIndex) => (itemIndex === index ? { ...item, name } : item)) ?? null,
    )
  }

  const confirmImport = async () => {
    const imports = pendingImports
    if (!imports?.length || importing) return
    setPendingImports(null)
    setImporting(true)
    let imported = 0
    let failed = 0
    let lastError = ''

    for (const { file, name } of imports) {
      const fallbackName = file.name.replace(/\.[^/.]+$/, '')
      try {
        const uploaded = await apiUpload(file)
        if (!uploaded?.filename) throw new Error(uploaded?.error || 'Upload failed')
        await apiPost('/save-generation', {
          prompt: name.trim() || fallbackName,
          filename: uploaded.filename,
          type: uploaded.type || 'image',
          width: 0,
          height: 0,
        })
        imported += 1
      } catch (error) {
        failed += 1
        lastError = error instanceof Error ? error.message : 'Upload failed'
      }
    }

    if (imported) {
      await queryClient.invalidateQueries({ queryKey: queryKeys.history })
    }

    if (imported || failed) {
      toast({
        title: imported
          ? `Imported ${imported} ${imported === 1 ? 'file' : 'files'}`
          : 'Import failed',
        description: failed
          ? `${failed} ${failed === 1 ? 'file' : 'files'} failed${lastError ? `: ${lastError}` : ''}`
          : undefined,
        tone: imported ? 'success' : 'error',
      })
    }

    setImporting(false)
  }

  return (
    <div
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <PageContainer>
      <Dialog
        open={Boolean(pendingImports)}
        onOpenChange={(open) => {
          if (!open) setPendingImports(null)
        }}
      >
        <DialogContent
          title={pendingImports?.length === 1 ? 'Name your upload' : 'Name your uploads'}
          description={
            pendingImports?.length === 1
              ? 'Give the file a name before it is added to your Library.'
              : 'Give each file a name before they are added to your Library.'
          }
        >
          <div className="space-y-3">
            {pendingImports?.map((item, index) => (
              <label key={`${item.file.name}-${index}`} className="block">
                <span className="mb-1 block truncate text-[10px] text-text-3">
                  {item.file.name}
                </span>
                <Input
                  value={item.name}
                  onChange={(event) => updateImportName(index, event.target.value)}
                  autoFocus={index === 0}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault()
                      void confirmImport()
                    }
                  }}
                  placeholder={item.file.name.replace(/\.[^/.]+$/, '')}
                  className="h-9 text-xs"
                />
              </label>
            ))}
          </div>
          <div className="mt-5 flex justify-end gap-2">
            <Button
              variant="ghost"
              onClick={() => setPendingImports(null)}
              disabled={importing}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={() => void confirmImport()}
              disabled={!pendingImports?.length || importing}
            >
              {importing ? 'Importing...' : `Import${pendingImports?.length === 1 ? '' : ` ${pendingImports?.length ?? 0}`}`}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {dragActive ? (
        <div className="pointer-events-none fixed inset-0 z-[70] grid place-items-center bg-black/70 p-6 backdrop-blur-sm">
          <div className="rounded-3xl border border-lime/40 bg-[#141518] px-10 py-9 text-center shadow-2xl">
            <div className="mx-auto grid size-14 place-items-center rounded-2xl border border-lime/25 bg-lime-soft text-lime">
              <Upload className="size-6" />
            </div>
            <p className="mt-4 text-base font-medium text-text">Drop files to import</p>
            <p className="mt-1 text-xs text-text-3">Images, video, and audio</p>
          </div>
        </div>
      ) : null}

      <PageHeader
        eyebrow="Library"
        title="Every generation, one place."
        description="Search, filter, favorite, and continue working with anything you have made."
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant={selectMode ? 'soft' : 'outline'}
              size="sm"
              icon={<CheckSquare className="size-3.5" />}
              onClick={toggleSelectionMode}
            >
              {selectMode ? 'Done' : 'Select'}
            </Button>
            <div className="flex items-center gap-1 rounded-xl border border-line bg-white/[0.025] p-1">
              <button
                onClick={() => setDensity('full')}
                className={cn(
                  'grid size-8 place-items-center rounded-lg transition',
                  density === 'full' ? 'bg-white text-black' : 'text-text-3 hover:text-text',
                )}
                title="Full cards"
              >
                <LayoutGrid className="size-4" />
              </button>
              <button
                onClick={() => setDensity('compact')}
                className={cn(
                  'grid size-8 place-items-center rounded-lg transition',
                  density === 'compact' ? 'bg-white text-black' : 'text-text-3 hover:text-text',
                )}
                title="Compact cards"
              >
                <Grid2X2 className="size-4" />
              </button>
            </div>
          </div>
        }
      />

      <div className="mt-6 flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[220px] flex-1 md:max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-text-3" />
            <Input
              value={query}
              onChange={(event) => {
                setQuery(event.target.value)
                setLimit(48)
              }}
              placeholder="Search prompts and files…"
              className="h-9 pl-9 text-xs"
            />
          </div>
          <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
            {filters.map((filter) => {
              const Icon = filter.icon
              const on = active.includes(filter.key)
              return (
                <button
                  key={filter.key}
                  onClick={() => toggleFilter(filter.key)}
                  className={cn(
                    'flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 text-[11px] font-medium transition',
                    on
                      ? 'border-lime/30 bg-lime-soft text-lime'
                      : 'border-line bg-white/[0.02] text-text-3 hover:border-line-strong hover:text-text-2',
                  )}
                >
                  <Icon className="size-3" />
                  {filter.label}
                  {on ? <Check className="size-2.5" /> : null}
                </button>
              )
            })}
          </div>
          {active.length ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setActive([])}
              className="text-text-3"
            >
              <Filter className="size-3" /> Clear
            </Button>
          ) : null}
          <Badge className="ml-auto">{filtered.length.toLocaleString()} assets</Badge>
        </div>

        {selectMode ? (
          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-line bg-white/[0.02] px-3 py-2">
            <span className="text-[11px] font-medium text-text-2">
              {selectedIds.size} selected
            </span>
            <Button variant="ghost" size="sm" onClick={selectVisible}>
              Select visible
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedIds(new Set())}
              disabled={!selectedIds.size}
            >
              Clear
            </Button>
            <div className="ml-auto flex items-center gap-2">
              <Button
                size="sm"
                variant={allFavorited ? 'soft' : 'outline'}
                icon={<Heart className={cn('size-3.5', allFavorited && 'fill-current')} />}
                onClick={() => void bulkFavorite()}
                disabled={!selectedIds.size || bulkBusy}
              >
                {allFavorited ? 'Unfavorite' : 'Favorite'}
              </Button>
              <Button
                size="sm"
                variant="danger"
                icon={<Trash2 className="size-3.5" />}
                onClick={() => void bulkDelete()}
                disabled={!selectedIds.size || bulkBusy}
              >
                Delete
              </Button>
            </div>
          </div>
        ) : null}

        {visible.length ? (
          <>
            <MediaGrid
              assets={visible}
              compact={density === 'compact'}
              loading={history.isLoading}
              selectMode={selectMode}
              selectedIds={selectedIds}
              highlightedId={inspectorId}
              onToggleSelect={toggleSelect}
              stemCounts={stemCounts}
            />
            {filtered.length > visible.length ? (
              <div className="flex justify-center pt-4">
                <Button variant="outline" onClick={() => setLimit((value) => value + 48)}>
                  Load more
                </Button>
              </div>
            ) : null}
          </>
        ) : history.isLoading ? (
          <MediaGrid assets={[]} loading />
        ) : (
          <EmptyState
            icon={<Search className="size-6" />}
            title={history.data?.length ? 'No matching assets' : 'Your library is empty'}
            description={
              history.data?.length
                ? 'Try another search or clear a filter.'
                : 'Generate something in the studio and it will appear here.'
            }
            action={
              active.length || query ? (
                <Button
                  variant="soft"
                  onClick={() => {
                    setActive([])
                    setQuery('')
                  }}
                >
                  Clear filters
                </Button>
              ) : undefined
            }
          />
        )}
      </div>
      </PageContainer>
    </div>
  )
}
