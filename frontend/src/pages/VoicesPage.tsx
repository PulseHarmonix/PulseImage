import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { AudioLines, Mic2, Pencil, Play, Save, Search, Volume2 } from 'lucide-react'
import { useHistory, useSettings, useTtsEngines, queryKeys } from '../lib/queries'
import { apiPost, mediaUrl } from '../lib/api'
import { PageHeader } from '../components/shell/PageHeader'
import { PageContainer } from '../components/shell/PageContainer'
import { Badge, Button, Dialog, DialogContent, EmptyState, Input, Select, Textarea } from '../components/ui'
import { usePromptStore } from '../stores/prompt'
import { useUiStore } from '../stores/ui'
import { parseMetadata, titleFromPrompt } from '../lib/utils'
import type { Asset, TtsEngine, VoiceMetadata } from '../types'

const fallbackLanguages = [
  'English',
  'Chinese',
  'Japanese',
  'Korean',
  'German',
  'French',
  'Russian',
  'Portuguese',
  'Spanish',
  'Italian',
]

const controlLabels: Record<string, string> = {
  emotion: 'Emotion',
  whisper: 'Whisper',
  instruction: 'Instruction',
  ref_text: 'Ref transcript',
  seed: 'Seed',
  speed: 'Speed',
}

function readVoiceMeta(asset: Asset): VoiceMetadata {
  const meta = parseMetadata(asset)
  const voice = meta.voice
  return voice && typeof voice === 'object' ? (voice as VoiceMetadata) : {}
}

function engineControls(engine?: TtsEngine): string[] {
  return Object.entries(engine?.controls ?? {})
    .filter(([, enabled]) => enabled)
    .map(([key]) => controlLabels[key] || key)
}

export function VoicesPage() {
  const history = useHistory()
  const engines = useTtsEngines()
  const settings = useSettings()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [query, setQuery] = useState('')
  const [editing, setEditing] = useState<Asset | null>(null)
  const [draft, setDraft] = useState({ transcript: '', language: 'English', engine: 'qwen3' })
  const [saving, setSaving] = useState(false)
  const setMode = usePromptStore((s) => s.setMode)
  const addAttachment = usePromptStore((s) => s.addAttachment)
  const toast = useUiStore((s) => s.toast)

  const voices = useMemo(() => {
    const search = query.toLowerCase()
    return (history.data ?? []).filter(
      (asset) =>
        asset.type === 'audio' &&
        asset.voice &&
        (!search || `${asset.prompt || ''} ${asset.filename}`.toLowerCase().includes(search)),
    )
  }, [history.data, query])

  const selectedEngine = engines.data?.find((engine) => engine.id === draft.engine)
  const languageOptions = useMemo(() => {
    const list = selectedEngine?.languages?.length ? selectedEngine.languages : fallbackLanguages
    return draft.language && !list.includes(draft.language) ? [draft.language, ...list] : list
  }, [selectedEngine, draft.language])

  const attachVoice = (voice: Asset) => {
    setMode('speech')
    addAttachment({
      id: voice.id,
      name: voice.filename,
      type: 'voice',
      prompt: voice.prompt,
      src: mediaUrl(`/audio/${voice.filename}`),
    })
    navigate('/?mode=speech')
    toast({ title: 'Voice attached to the composer', tone: 'success' })
  }

  const openEditor = (voice: Asset) => {
    const meta = readVoiceMeta(voice)
    const engineId = meta.engine || settings.data?.tts_engine || engines.data?.[0]?.id || 'qwen3'
    const engine = engines.data?.find((item) => item.id === engineId)
    setDraft({
      transcript: meta.transcript || '',
      language: meta.language || engine?.default_language || engine?.languages?.[0] || 'English',
      engine: engineId,
    })
    setEditing(voice)
  }

  const changeEngine = (engineId: string) => {
    const engine = engines.data?.find((item) => item.id === engineId)
    setDraft((current) => ({
      ...current,
      engine: engineId,
      language: engine?.default_language || engine?.languages?.[0] || current.language,
    }))
  }

  const saveVoice = async () => {
    if (!editing) return
    setSaving(true)
    try {
      const result = await apiPost<{ success?: boolean; error?: string; voice?: VoiceMetadata }>(
        `/tts/voices/${encodeURIComponent(editing.id)}`,
        draft,
      )
      if (result.success === false) throw new Error(result.error || 'Could not save voice metadata')
      await queryClient.invalidateQueries({ queryKey: queryKeys.history })
      toast({ title: 'Voice metadata saved', tone: 'success' })
      setEditing(null)
    } catch (error) {
      toast({
        title: 'Could not save voice metadata',
        description: error instanceof Error ? error.message : undefined,
        tone: 'error',
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Voices"
        title="A cast for every scene."
        description="Reusable voice references for speech generation and FastH3/LTX audio workflows."
        actions={
          <div className="flex items-center gap-1.5">
            {(engines.data ?? []).slice(0, 3).map((engine) => (
              <Badge key={engine.id} tone="lime">
                {engine.label}
              </Badge>
            ))}
          </div>
        }
      />

      <div className="mt-6 flex items-center gap-2">
        <div className="relative max-w-sm flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-text-3" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search voices…"
            className="h-9 pl-9 text-xs"
          />
        </div>
        <Badge>{voices.length} voices</Badge>
      </div>

      {(engines.data ?? []).length ? (
        <section className="mt-5 rounded-2xl border border-line bg-white/[0.02] p-4">
          <div className="flex items-center gap-2">
            <span className="grid size-8 place-items-center rounded-lg bg-lime-soft text-lime">
              <AudioLines className="size-4" />
            </span>
            <div>
              <p className="font-display text-sm font-semibold">Engine capabilities</p>
              <p className="text-[10px] text-text-3">Install status, backends, and exposed clone controls.</p>
            </div>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {(engines.data ?? []).map((engine) => (
              <EngineCard key={engine.id} engine={engine} />
            ))}
          </div>
        </section>
      ) : null}

      {voices.length ? (
        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {voices.map((voice) => {
            const meta = readVoiceMeta(voice)
            const engineLabel =
              engines.data?.find((engine) => engine.id === meta.engine)?.label ||
              meta.engine ||
              settings.data?.tts_engine ||
              'Default engine'
            return (
              <div
                key={voice.id}
                className="rounded-2xl border border-line bg-white/[0.02] p-4 transition hover:border-line-strong"
              >
                <div className="flex items-start gap-3">
                  <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-lime-soft text-lime">
                    <Mic2 className="size-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-2 text-xs font-medium text-text">
                      {titleFromPrompt(voice.prompt || voice.filename)}
                    </p>
                    <p className="mt-0.5 truncate text-[10px] text-text-3">{voice.filename}</p>
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap gap-1">
                  <Badge tone="lime">{engineLabel}</Badge>
                  <Badge>{meta.language || 'Language unset'}</Badge>
                  {meta.transcript ? <Badge tone="success">Transcript</Badge> : null}
                </div>
                <p className="mt-2 line-clamp-2 min-h-[30px] text-[10px] leading-4 text-text-3">
                  {meta.transcript || 'No reference transcript saved yet.'}
                </p>
                <audio src={mediaUrl(`/audio/${voice.filename}`)} controls className="mt-3 h-8 w-full" />
                <div className="mt-3 flex gap-2">
                  <Button
                    size="sm"
                    variant="soft"
                    icon={<Volume2 className="size-3" />}
                    onClick={() => attachVoice(voice)}
                    className="flex-1"
                  >
                    Use voice
                  </Button>
                  <Button
                    size="icon"
                    variant="outline"
                    onClick={() => openEditor(voice)}
                    aria-label={`Edit ${voice.filename}`}
                    title="Edit voice metadata"
                  >
                    <Pencil className="size-3" />
                  </Button>
                  <a
                    href={mediaUrl(`/audio/${voice.filename}`)}
                    target="_blank"
                    rel="noreferrer"
                    className="grid size-8 place-items-center rounded-lg border border-line text-text-3 transition hover:text-text"
                    aria-label="Open voice"
                  >
                    <Play className="size-3" />
                  </a>
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="mt-8">
          <EmptyState
            icon={<Mic2 className="size-6" />}
            title="No voices yet"
            description="Mark generated audio as a voice in the Library inspector, then it will appear here."
            action={
              <Button variant="outline" onClick={() => navigate('/library')}>
                Open library
              </Button>
            }
          />
        </div>
      )}

      <Dialog open={Boolean(editing)} onOpenChange={(open) => (open ? null : setEditing(null))}>
        {editing ? (
          <DialogContent
            title="Edit voice metadata"
            description={editing.filename}
            className="max-w-2xl"
          >
            <div className="space-y-4">
              <audio src={mediaUrl(`/audio/${editing.filename}`)} controls className="h-9 w-full" />

              <label className="block">
                <span className="mb-1.5 block text-[10px] font-medium uppercase tracking-[0.12em] text-text-3">
                  Reference transcript
                </span>
                <Textarea
                  value={draft.transcript}
                  onChange={(event) => setDraft({ ...draft, transcript: event.target.value })}
                  placeholder="Type exactly what the reference voice says…"
                  rows={4}
                  className="text-xs"
                />
                <span className="mt-1 block text-[10px] text-text-3">
                  Improves cloning quality. Leave blank to use x-vector cloning when the engine supports it.
                </span>
              </label>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-1.5 block text-[10px] font-medium uppercase tracking-[0.12em] text-text-3">
                    Engine
                  </span>
                  <Select value={draft.engine} onChange={(event) => changeEngine(event.target.value)}>
                    {(engines.data ?? []).length ? (
                      (engines.data ?? []).map((engine) => (
                        <option key={engine.id} value={engine.id}>
                          {engine.label}
                          {engine.installed === false ? ' (not installed)' : ''}
                        </option>
                      ))
                    ) : (
                      <option value="qwen3">Qwen3-TTS</option>
                    )}
                  </Select>
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-[10px] font-medium uppercase tracking-[0.12em] text-text-3">
                    Language
                  </span>
                  <Select
                    value={draft.language}
                    onChange={(event) => setDraft({ ...draft, language: event.target.value })}
                  >
                    {languageOptions.map((language) => (
                      <option key={language} value={language}>
                        {language}
                      </option>
                    ))}
                  </Select>
                </label>
              </div>

              {selectedEngine ? <EngineCard engine={selectedEngine} /> : null}

              <div className="flex justify-end gap-2 border-t border-line pt-3">
                <Button variant="outline" onClick={() => setEditing(null)}>
                  Cancel
                </Button>
                <Button variant="primary" busy={saving} onClick={() => void saveVoice()} icon={<Save className="size-3.5" />}>
                  Save voice
                </Button>
              </div>
            </div>
          </DialogContent>
        ) : null}
      </Dialog>
    </PageContainer>
  )
}

function EngineCard({ engine }: { engine: TtsEngine }) {
  const controls = engineControls(engine)
  return (
    <div className="rounded-xl border border-line bg-white/[0.015] p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-[11px] font-semibold text-text">{engine.label || engine.id}</p>
          <p className="truncate font-mono text-[9px] text-text-3">{engine.id}</p>
        </div>
        <Badge tone={engine.installed === false ? 'danger' : 'success'}>
          {engine.installed === false ? 'Missing' : 'Installed'}
        </Badge>
      </div>
      <div className="mt-2 space-y-0.5 text-[10px] text-text-3">
        <p className="truncate" title={engine.node_pack}>
          Node pack: {engine.node_pack || '—'}
        </p>
        <p className="truncate" title={engine.model}>
          Model: {engine.model || '—'}
        </p>
        <p>
          Languages: {engine.languages?.length ?? 0}
          {engine.default_language ? ` · default ${engine.default_language}` : ''}
        </p>
      </div>
      <div className="mt-2 flex flex-wrap gap-1">
        {controls.length ? (
          controls.map((control) => (
            <Badge key={control} tone="lime">
              {control}
            </Badge>
          ))
        ) : (
          <span className="text-[9px] text-text-3">No clone controls exposed</span>
        )}
      </div>
    </div>
  )
}
