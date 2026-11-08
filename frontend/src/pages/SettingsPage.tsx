import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Check, Database, Image as ImageIcon, RefreshCcw, Server, Settings2, Shield, SlidersHorizontal, Sparkles, Wrench } from 'lucide-react'
import { useSettings, useUpdateSettings } from '../lib/queries'
import { apiPost } from '../lib/api'
import { PageHeader } from '../components/shell/PageHeader'
import { PromptEnhancerEditor } from '../components/admin/PromptEnhancerEditor'
import { RawSettingsEditor } from '../components/admin/RawSettingsEditor'
import { LibraryEditor } from '../components/admin/LibraryEditor'
import { Badge, Button, Input } from '../components/ui'
import { useUiStore } from '../stores/ui'

export function SettingsPage() {
  const settings = useSettings()
  const updateSettings = useUpdateSettings()
  const toast = useUiStore((s) => s.toast)
  const [form, setForm] = useState({
    comfyui_url: '',
    ollama_url: '',
    ollama_model: '',
    failed_gen_clear_seconds: 600,
    relayvsr_detail: 1,
    relayvsr_timeout_seconds: 1800,
  })
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (!settings.data) return
    const data = settings.data as Record<string, unknown>
    setForm({
      comfyui_url: String(data.comfyui_url || ''),
      ollama_url: String(data.ollama_url || ''),
      ollama_model: String(data.ollama_model || ''),
      failed_gen_clear_seconds: Number(data.failed_gen_clear_seconds || 600),
      relayvsr_detail: Number(data.relayvsr_detail || 1),
      relayvsr_timeout_seconds: Number(data.relayvsr_timeout_seconds || 1800),
    })
  }, [settings.data])

  const save = async () => {
    await updateSettings(form)
    setSaved(true)
    toast({ title: 'Settings saved', tone: 'success' })
    window.setTimeout(() => setSaved(false), 1500)
  }

  return (
    <div className="mx-auto w-full max-w-[1000px] px-4 pb-10 pt-16 md:px-8 md:pt-8">
      <PageHeader
        eyebrow="Settings"
        title="Workspace controls."
        description="Server connections, generation defaults, and local processing options."
        actions={
          <Button variant="primary" onClick={() => void save()} icon={saved ? <Check className="size-4" /> : <Settings2 className="size-4" />}>
            {saved ? 'Saved' : 'Save changes'}
          </Button>
        }
      />

      <div className="mt-6 space-y-4">
        <Section icon={<Server className="size-4" />} title="Servers" description="Local endpoints for ComfyUI and Ollama.">
          <Field label="ComfyUI URL">
            <Input
              value={form.comfyui_url}
              onChange={(event) => setForm({ ...form, comfyui_url: event.target.value })}
              placeholder="http://127.0.0.1:8188"
            />
          </Field>
          <Field label="Ollama URL">
            <Input
              value={form.ollama_url}
              onChange={(event) => setForm({ ...form, ollama_url: event.target.value })}
              placeholder="http://127.0.0.1:11434"
            />
          </Field>
          <Field label="Ollama model">
            <Input
              value={form.ollama_model}
              onChange={(event) => setForm({ ...form, ollama_model: event.target.value })}
              placeholder="qwen3:8b"
            />
          </Field>
        </Section>

        <Section icon={<SlidersHorizontal className="size-4" />} title="Generation" description="Timeouts and post-processing defaults.">
          <Field label="Failed generation clear timeout (seconds)">
            <Input
              type="number"
              min={30}
              value={form.failed_gen_clear_seconds}
              onChange={(event) => setForm({ ...form, failed_gen_clear_seconds: Number(event.target.value) })}
            />
          </Field>
          <Field label="RelayVSR detail">
            <Input
              type="number"
              min={0}
              max={1}
              step={0.05}
              value={form.relayvsr_detail}
              onChange={(event) => setForm({ ...form, relayvsr_detail: Number(event.target.value) })}
            />
          </Field>
          <Field label="RelayVSR timeout (seconds)">
            <Input
              type="number"
              min={60}
              value={form.relayvsr_timeout_seconds}
              onChange={(event) => setForm({ ...form, relayvsr_timeout_seconds: Number(event.target.value) })}
            />
          </Field>
        </Section>

        <PromptEnhancerEditor />

        <Section icon={<Shield className="size-4" />} title="Local privacy" description="Pulse stores your media and project data locally.">
          <div className="rounded-xl border border-line bg-white/[0.02] p-4">
            <div className="flex items-center gap-2">
              <Badge tone="lime">
                <Sparkles className="size-2.5" /> Local-first
              </Badge>
              <p className="text-xs font-medium">No account required</p>
            </div>
            <p className="mt-2 text-[11px] leading-5 text-text-2">
              Prompts, generations, voices, projects, and settings stay on this machine. ComfyUI and Ollama
              connections are used only for generation.
            </p>
          </div>
        </Section>
      </div>
    </div>
  )
}

function Section({
  icon,
  title,
  description,
  children,
}: {
  icon: React.ReactNode
  title: string
  description: string
  children: React.ReactNode
}) {
  return (
    <section className="rounded-2xl border border-line bg-white/[0.02] p-4">
      <div className="mb-4 flex items-center gap-2">
        <span className="grid size-8 place-items-center rounded-lg bg-white/[0.04] text-text-2">{icon}</span>
        <div>
          <h2 className="font-display text-sm font-semibold">{title}</h2>
          <p className="text-[10px] text-text-3">{description}</p>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">{children}</div>
    </section>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[10px] font-medium uppercase tracking-[0.12em] text-text-3">
        {label}
      </span>
      {children}
    </label>
  )
}

export function AdminPage() {
  const toast = useUiStore((s) => s.toast)
  const [thumbBusy, setThumbBusy] = useState(false)
  const [thumbResult, setThumbResult] = useState<{
    total?: number
    generated?: number
    failed?: number
    skipped?: number
  } | null>(null)

  const generateThumbnails = async () => {
    setThumbBusy(true)
    try {
      const result = await apiPost<{
        total?: number
        generated?: number
        failed?: number
        skipped?: number
      }>('/admin/generate-thumbnails')
      setThumbResult(result)
      toast({ title: 'Thumbnail scan complete', tone: 'success' })
    } catch (error) {
      toast({
        title: 'Thumbnail generation failed',
        description: error instanceof Error ? error.message : undefined,
        tone: 'error',
      })
    } finally {
      setThumbBusy(false)
    }
  }

  return (
    <div className="mx-auto w-full max-w-[1200px] px-4 pb-10 pt-16 md:px-8 md:pt-8">
      <PageHeader
        eyebrow="Admin"
        title="Library maintenance."
        description="Inspect every generation, toggle library flags, edit raw settings, and repair thumbnails."
      />

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <button
          onClick={() => void generateThumbnails()}
          disabled={thumbBusy}
          className="rounded-2xl border border-line bg-white/[0.02] p-5 text-left transition hover:border-line-strong disabled:opacity-60"
        >
          <span className="grid size-8 place-items-center rounded-lg bg-lime-soft text-lime">
            {thumbBusy ? <RefreshCcw className="size-4 animate-spin" /> : <ImageIcon className="size-4" />}
          </span>
          <p className="mt-3 font-display text-sm font-semibold">Generate all thumbnails</p>
          <p className="mt-1 text-[11px] text-text-3">Scan the library and create missing thumbnails.</p>
          {thumbResult ? (
            <p className="mt-2 text-[10px] text-text-3">
              {thumbResult.generated ?? 0} created · {thumbResult.skipped ?? 0} skipped ·{' '}
              {thumbResult.failed ?? 0} failed
            </p>
          ) : null}
        </button>
        <Link
          to="/settings"
          className="rounded-2xl border border-line bg-white/[0.02] p-5 transition hover:border-line-strong"
        >
          <span className="grid size-8 place-items-center rounded-lg bg-lime-soft text-lime">
            <Wrench className="size-4" />
          </span>
          <p className="mt-3 font-display text-sm font-semibold">Open settings</p>
          <p className="mt-1 text-[11px] text-text-3">Edit server connections, enhancers, and generation defaults.</p>
        </Link>
        <Link
          to="/models"
          className="rounded-2xl border border-line bg-white/[0.02] p-5 transition hover:border-line-strong"
        >
          <span className="grid size-8 place-items-center rounded-lg bg-lime-soft text-lime">
            <Database className="size-4" />
          </span>
          <p className="mt-3 font-display text-sm font-semibold">Model readiness</p>
          <p className="mt-1 text-[11px] text-text-3">Check workflow models, LoRAs, and ComfyUI capabilities.</p>
        </Link>
      </div>

      <div className="mt-4 space-y-4">
        <RawSettingsEditor />
        <LibraryEditor />
      </div>
    </div>
  )
}
