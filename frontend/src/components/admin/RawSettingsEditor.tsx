import { useCallback, useEffect, useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { RefreshCcw, Save, Search, SlidersHorizontal } from 'lucide-react'
import { apiGet, apiPost } from '../../lib/api'
import { queryKeys } from '../../lib/queries'
import { useUiStore } from '../../stores/ui'
import { Badge, Button, Input, Textarea } from '../ui'
import type { AdminSetting } from '../../types'

export function RawSettingsEditor() {
  const queryClient = useQueryClient()
  const toast = useUiStore((s) => s.toast)
  const [rows, setRows] = useState<AdminSetting[]>([])
  const [draft, setDraft] = useState<Record<string, string>>({})
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const result = await apiGet<{ settings?: AdminSetting[] }>('/admin/settings')
      const next = result.settings ?? []
      setRows(next)
      setDraft(Object.fromEntries(next.map((row) => [row.key, row.value ?? ''])))
    } catch (error) {
      toast({
        title: 'Could not load settings',
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
    const query = search.trim().toLowerCase()
    if (!query) return rows
    return rows.filter((row) => row.key.toLowerCase().includes(query))
  }, [rows, search])

  const saveAll = async () => {
    setSaving(true)
    let count = 0
    try {
      for (const row of rows) {
        await apiPost('/admin/update-setting', { key: row.key, value: draft[row.key] ?? '' })
        count += 1
      }
      await queryClient.invalidateQueries({ queryKey: queryKeys.settings })
      toast({ title: `Saved ${count} settings`, tone: 'success' })
    } catch (error) {
      toast({
        title: 'Could not save settings',
        description: error instanceof Error ? error.message : undefined,
        tone: 'error',
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="rounded-2xl border border-line bg-white/[0.02] p-4">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="grid size-8 place-items-center rounded-lg bg-lime-soft text-lime">
            <SlidersHorizontal className="size-4" />
          </span>
          <div>
            <h2 className="font-display text-sm font-semibold">Settings editor</h2>
            <p className="text-[10px] text-text-3">
              Raw database key/value pairs written through /admin/update-setting.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge>{rows.length} keys</Badge>
          <Button size="sm" variant="outline" onClick={() => void load()} busy={loading} icon={<RefreshCcw className="size-3.5" />}>
            Refresh
          </Button>
          <Button size="sm" variant="primary" onClick={() => void saveAll()} busy={saving} icon={<Save className="size-3.5" />}>
            Save all
          </Button>
        </div>
      </div>

      <div className="relative mb-3 max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-text-3" />
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Filter setting keys…"
          className="h-9 pl-9 text-xs"
        />
      </div>

      <div className="max-h-[520px] space-y-2 overflow-y-auto pr-1">
        {filtered.map((row) => (
          <div key={row.key} className="grid gap-2 rounded-xl border border-line bg-white/[0.015] p-2.5 md:grid-cols-[220px_minmax(0,1fr)]">
            <div className="min-w-0">
              <p className="truncate font-mono text-[11px] font-medium text-text" title={row.key}>
                {row.key}
              </p>
              {row.updated_at ? (
                <p className="mt-0.5 text-[9px] text-text-3">Updated {row.updated_at}</p>
              ) : null}
            </div>
            <Textarea
              value={draft[row.key] ?? ''}
              onChange={(event) => setDraft((current) => ({ ...current, [row.key]: event.target.value }))}
              rows={2}
              className="min-h-[54px] font-mono text-[11px]"
            />
          </div>
        ))}
        {!filtered.length ? (
          <p className="rounded-xl border border-dashed border-line p-4 text-center text-[11px] text-text-3">
            {loading ? 'Loading settings…' : 'No matching settings.'}
          </p>
        ) : null}
      </div>
    </section>
  )
}
