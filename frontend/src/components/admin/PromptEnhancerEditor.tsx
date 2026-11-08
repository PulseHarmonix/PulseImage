import { useEffect, useState } from 'react'
import { Plus, Save, Trash2, WandSparkles } from 'lucide-react'
import { useSettings, useUpdateSettings } from '../../lib/queries'
import { useUiStore } from '../../stores/ui'
import { Button, Input, Textarea } from '../ui'
import type { PromptEnhancer } from '../../types'

export function PromptEnhancerEditor() {
  const settings = useSettings()
  const updateSettings = useUpdateSettings()
  const toast = useUiStore((s) => s.toast)
  const [enhancers, setEnhancers] = useState<PromptEnhancer[]>([])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const raw = settings.data?.prompt_enhancers
    if (!Array.isArray(raw)) return
    setEnhancers(
      raw.map((item, index) => ({
        id: String(item?.id ?? `custom-${index}`),
        name: String(item?.name ?? 'Untitled'),
        prompt: String(item?.prompt ?? ''),
      })),
    )
  }, [settings.data])

  const update = (index: number, patch: Partial<PromptEnhancer>) => {
    setEnhancers((current) =>
      current.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)),
    )
  }

  const add = () => {
    setEnhancers((current) => [
      ...current,
      { id: `custom-${Date.now().toString(36)}`, name: 'Custom Style', prompt: '' },
    ])
  }

  const remove = (index: number) => {
    if (enhancers.length <= 1) {
      toast({ title: 'Keep at least one enhancer', tone: 'warning' })
      return
    }
    setEnhancers((current) => current.filter((_, itemIndex) => itemIndex !== index))
  }

  const save = async () => {
    const seen = new Set<string>()
    const cleaned = enhancers.map((enhancer, index) => {
      let id = enhancer.id.trim() || `custom-${index}`
      if (seen.has(id)) id = `${id}-${index}`
      seen.add(id)
      return {
        id,
        name: enhancer.name.trim() || 'Untitled',
        prompt: enhancer.prompt,
      }
    })
    setSaving(true)
    try {
      await updateSettings({ prompt_enhancers: cleaned })
      setEnhancers(cleaned)
      toast({ title: 'Prompt enhancers saved', tone: 'success' })
    } catch (error) {
      toast({
        title: 'Could not save enhancers',
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
            <WandSparkles className="size-4" />
          </span>
          <div>
            <h2 className="font-display text-sm font-semibold">Prompt enhancers</h2>
            <p className="text-[10px] text-text-3">
              Style presets offered in the composer and applied through Ollama.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={add} icon={<Plus className="size-3.5" />}>
            Add
          </Button>
          <Button size="sm" variant="primary" onClick={() => void save()} busy={saving} icon={<Save className="size-3.5" />}>
            Save enhancers
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        {enhancers.map((enhancer, index) => (
          <div
            key={`${enhancer.id}-${index}`}
            className="grid gap-2 rounded-xl border border-line bg-white/[0.015] p-2.5 sm:grid-cols-[170px_minmax(0,1fr)_auto]"
          >
            <div className="space-y-2">
              <Input
                value={enhancer.id}
                onChange={(event) => update(index, { id: event.target.value })}
                placeholder="id"
                className="h-8 font-mono text-[11px]"
              />
              <Input
                value={enhancer.name}
                onChange={(event) => update(index, { name: event.target.value })}
                placeholder="Name"
                className="h-8 text-[11px]"
              />
            </div>
            <Textarea
              value={enhancer.prompt}
              onChange={(event) => update(index, { prompt: event.target.value })}
              placeholder="Enhancement prompt…"
              rows={2}
              className="min-h-[68px] text-[11px]"
            />
            <Button
              size="icon"
              variant="danger"
              onClick={() => remove(index)}
              aria-label={`Remove ${enhancer.name || enhancer.id}`}
              title="Remove enhancer"
            >
              <Trash2 className="size-3.5" />
            </Button>
          </div>
        ))}
        {!enhancers.length ? (
          <p className="rounded-xl border border-dashed border-line p-4 text-center text-[11px] text-text-3">
            No prompt enhancers yet. Add one to get started.
          </p>
        ) : null}
      </div>
    </section>
  )
}
