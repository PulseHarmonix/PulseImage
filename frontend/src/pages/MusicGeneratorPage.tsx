import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  AudioLines,
  Dices,
  ExternalLink,
  FileMusic,
  Info,
  Music2,
  RefreshCcw,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  WandSparkles,
  X,
} from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { useHistory, useSongCapabilities, queryKeys } from '../lib/queries'
import { apiDeleteGeneration, apiPost, mediaUrl } from '../lib/api'
import { assetType, parseMetadata, formatDuration, uid } from '../lib/utils'
import { assetDisplayName, watchProgress } from '../lib/assets'
import { storedScoreView } from '../lib/musicScore'
import type { ScoreView } from '../lib/musicScore'
import { runSerializedGeneration } from '../lib/generationQueue'
import { useQueueStore } from '../stores/queue'
import { confirmAction } from '../stores/confirm'
import { useUiStore } from '../stores/ui'
import { useMusicGeneratorStore } from '../stores/musicGenerator'
import { PageHeader } from '../components/shell/PageHeader'
import { ScorePanel } from '../components/music/ScorePanel'
import { Badge, Button, EmptyState, Input, Select, Spinner, Textarea } from '../components/ui'
import type { Asset, ProgressSnapshot } from '../types'

type Planning = 'full' | 'melody' | 'off'

interface SongResult {
  success: boolean
  error?: string
  asset_id?: string
  filename?: string
  duration?: number
  name?: string
  score_abc?: string
  planning?: string
}

const durationOptions = [30, 60, 90, 120, 180, 240, 300, 360, 420, 480, 540, 600]
const styleExamples = [
  'warm piano pop, expressive female vocal, 88 BPM',
  'cinematic synthwave, analog synths, 112 BPM',
  'acoustic folk, fingerpicked guitar, intimate male vocal',
  'funk disco, slap bass, brass, 118 BPM',
]

function percentFromSnapshot(snapshot: ProgressSnapshot): number {
  const value = Number(snapshot.workflow_percent ?? snapshot.node_percent ?? 0)
  return Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0))
}

function songName(asset: Asset): string {
  const meta = parseMetadata(asset)
  if (typeof meta.name === 'string' && meta.name.trim()) return meta.name.trim()
  return asset.prompt || title(asset)
}

function songDuration(asset: Asset): number | undefined {
  const meta = parseMetadata(asset)
  const value =
    typeof meta.duration === 'number'
      ? meta.duration
      : typeof meta.duration === 'string'
        ? Number(meta.duration)
        : asset.duration
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

function title(asset: Asset): string {
  const prompt = (asset.prompt || '').trim()
  return prompt.length > 64 ? `${prompt.slice(0, 64)}...` : prompt || 'YuE2 song'
}

export function MusicGeneratorPage() {
  const history = useHistory()
  const capabilities = useSongCapabilities()
  const queryClient = useQueryClient()
  const queueAdd = useQueueStore((s) => s.add)
  const queueUpdate = useQueueStore((s) => s.update)
  const toast = useUiStore((s) => s.toast)
  const inspectorId = useUiStore((s) => s.inspectorId)
  const openInspector = useUiStore((s) => s.openInspector)
  const lyricsRef = useRef<HTMLTextAreaElement>(null)
  const persisted = useMusicGeneratorStore((s) => s.values)
  const updatePersisted = useMusicGeneratorStore((s) => s.update)

  const [title, setTitle] = useState(persisted.title)
  const [style, setStyle] = useState(persisted.style)
  const [lyrics, setLyrics] = useState(persisted.lyrics)
  const [instrumental, setInstrumental] = useState(persisted.instrumental)
  const [planning, setPlanning] = useState<Planning>(persisted.planning)
  const [maxDuration, setMaxDuration] = useState(persisted.maxDuration)
  const [acousticSteps, setAcousticSteps] = useState(persisted.acousticSteps)
  const [maxScoreTokens, setMaxScoreTokens] = useState(persisted.maxScoreTokens)
  const [seed, setSeed] = useState(persisted.seed)
  const [randomizeSeed, setRandomizeSeed] = useState(Boolean(persisted.randomizeSeed))
  const [advanced, setAdvanced] = useState(persisted.advanced)
  const [temperature, setTemperature] = useState(persisted.temperature)
  const [topP, setTopP] = useState(persisted.topP)
  const [topK, setTopK] = useState(persisted.topK)
  const [repetitionPenalty, setRepetitionPenalty] = useState(persisted.repetitionPenalty)
  const [guidance, setGuidance] = useState(persisted.guidance)
  const [submitting, setSubmitting] = useState(false)
  const [lastResult, setLastResult] = useState<SongResult | null>(null)
  const [scoreView, setScoreView] = useState<ScoreView | null>(null)
  const [scoreOpen, setScoreOpen] = useState(false)

  const inspectorAudio = useMemo(
    () =>
      (history.data ?? []).find(
        (asset) => asset.id === inspectorId && assetType(asset) === 'audio',
      ),
    [history.data, inspectorId],
  )
  useEffect(() => {
    if (inspectorAudio && inspectorAudio.id !== persisted.coverAssetId) {
      updatePersisted({ coverAssetId: inspectorAudio.id })
    }
  }, [inspectorAudio, persisted.coverAssetId, updatePersisted])

  const selectedAudio = useMemo(
    () =>
      inspectorAudio ??
      (history.data ?? []).find(
        (asset) => asset.id === persisted.coverAssetId && assetType(asset) === 'audio',
      ),
    [history.data, inspectorAudio, persisted.coverAssetId],
  )
  const selectedAudioName = selectedAudio
    ? assetDisplayName(selectedAudio)
    : undefined
  const clearCoverSource = () => {
    updatePersisted({ coverAssetId: '' })
    openInspector(null)
  }

  const deleteSong = async (song: Asset) => {
    const confirmed = await confirmAction({
      title: 'Delete song?',
      description: `"${songName(song)}" will be permanently removed. This cannot be undone.`,
      confirmLabel: 'Delete song',
      tone: 'danger',
    })
    if (!confirmed) return
    try {
      await apiDeleteGeneration(song.id)
      if (persisted.coverAssetId === song.id) updatePersisted({ coverAssetId: '' })
      if (inspectorId === song.id) openInspector(null)
      if (lastResult?.asset_id === song.id) {
        setLastResult(null)
        setScoreView(null)
      }
      await queryClient.invalidateQueries({ queryKey: queryKeys.history })
      toast({ title: 'Song deleted', tone: 'success' })
    } catch (error) {
      toast({
        title: 'Delete failed',
        description: error instanceof Error ? error.message : undefined,
        tone: 'error',
      })
    }
  }

  useEffect(() => {
    updatePersisted({
      title,
      style,
      lyrics,
      instrumental,
      planning,
      maxDuration,
      acousticSteps,
      maxScoreTokens,
      seed,
      randomizeSeed,
      advanced,
      temperature,
      topP,
      topK,
      repetitionPenalty,
      guidance,
    })
  }, [
    title,
    style,
    lyrics,
    instrumental,
    planning,
    maxDuration,
    acousticSteps,
    maxScoreTokens,
    seed,
    randomizeSeed,
    advanced,
    temperature,
    topP,
    topK,
    repetitionPenalty,
    guidance,
    updatePersisted,
  ])

  const songs = useMemo(() => {
    return (history.data ?? []).filter((asset) => {
      if (asset.type !== 'audio') return false
      const meta = parseMetadata(asset)
      return meta.source === 'yue2'
    })
  }, [history.data])

  const insertSection = (section: string) => {
    const el = lyricsRef.current
    const token = `\n[${section}]\n`
    if (!el) {
      setLyrics((current) => `${current}${token}`)
      return
    }
    const start = el.selectionStart ?? lyrics.length
    const end = el.selectionEnd ?? lyrics.length
    const next = `${lyrics.slice(0, start)}${token}${lyrics.slice(end)}`
    setLyrics(next)
    window.requestAnimationFrame(() => {
      el.focus()
      el.setSelectionRange(start + token.length, start + token.length)
    })
  }

  const submitSong = (
    path: '/songs/generate' | '/songs/cover',
    extra: Record<string, unknown>,
    fallbackTitle = '',
  ) => {
    if (!capabilities.data?.available) {
      toast({
        title: 'YuE2 is not available in ComfyUI',
        description: 'Install the native YuE2 nodes and INT8 checkpoint in ComfyUI.',
        tone: 'error',
      })
      return
    }
    if (!style.trim() && !lyrics.trim()) {
      toast({ title: 'Add a style or lyrics first', tone: 'warning' })
      return
    }

    const generationSeed = randomizeSeed
      ? Math.floor(Math.random() * 0x1fffffffffffff)
      : seed
    if (randomizeSeed) setSeed(generationSeed)

    const generationTitle = title.trim() || fallbackTitle
    const jobId = uid(path === '/songs/cover' ? 'cover' : 'song')
    const queueId = uid('music_generation')
    const label =
      generationTitle.slice(0, 72) ||
      style.trim().slice(0, 72) ||
      titleFromLyrics(lyrics) ||
      'YuE2 song'
    queueAdd({
      id: queueId,
      label,
      mode: 'audio',
      status: 'queued',
      progress: 0,
      stage: 'queued',
      startedAt: Date.now(),
    })
    setSubmitting(true)
    setLastResult(null)
    setScoreView(null)

    void runSerializedGeneration(async () => {
      queueUpdate(queueId, {
        status: 'running',
        progress: 0,
        stage: 'planning',
        startedAt: Date.now(),
      })
      const stopProgress = watchProgress(jobId, (snapshot) => {
        const percent = percentFromSnapshot(snapshot)
        queueUpdate(queueId, {
          status: snapshot.state === 'error' ? 'error' : 'running',
          progress: percent,
          stage: snapshot.stage || 'generating',
          error: snapshot.error,
        })
      })

      try {
        const result = await apiPost<SongResult>(path, {
          title: generationTitle,
          style,
          lyrics: instrumental ? '' : lyrics,
          planning,
          max_duration: maxDuration,
          acoustic_steps: acousticSteps,
          max_score_tokens: maxScoreTokens,
          seed: generationSeed,
          job_id: jobId,
          temperature,
          top_p: topP,
          top_k: topK,
          repetition_penalty: repetitionPenalty,
          guidance,
          ...extra,
        })
        if (!result.success) throw new Error(result.error || 'Song generation failed')
        stopProgress()

        const resultPlanning = path === '/songs/cover' ? 'cover' : planning
        setLastResult({
          ...result,
          planning: resultPlanning,
        })
        setScoreView({
          scoreAbc: result.score_abc,
          planning: resultPlanning,
          title: result.name || generationTitle || title || 'YuE2 song',
          style,
          lyrics: instrumental ? '' : lyrics,
          seed: generationSeed,
          maxScoreTokens,
          coverSource: path === '/songs/cover' ? selectedAudioName : undefined,
          audioFilename: result.filename,
        })
        setScoreOpen(true)
        queueUpdate(queueId, {
          status: 'done',
          progress: 100,
          stage: 'done',
          finishedAt: Date.now(),
        })
        await queryClient.invalidateQueries({ queryKey: queryKeys.history })
        await capabilities.refetch()
        toast({
          title: path === '/songs/cover' ? 'Cover generated' : 'Song generated',
          description: result.name || 'Added to the Library.',
          tone: 'success',
        })
      } catch (error) {
        stopProgress()
        const message = error instanceof Error ? error.message : 'Song generation failed'
        queueUpdate(queueId, {
          status: 'error',
          error: message,
          finishedAt: Date.now(),
        })
        toast({ title: 'Song generation failed', description: message, tone: 'error' })
      } finally {
        stopProgress()
        setSubmitting(false)
      }
    })
  }

  const generate = () => {
    submitSong('/songs/generate', {})
  }

  const coverSelected = () => {
    if (!selectedAudio) {
      toast({ title: 'Select an audio asset in the Library first', tone: 'warning' })
      return
    }
    if (!capabilities.data?.cover_available) {
      toast({ title: 'YuE2 cover support is not available', tone: 'error' })
      return
    }
    submitSong('/songs/cover', { asset_id: selectedAudio.id }, selectedAudioName || '')
  }

  const capability = capabilities.data
  const unavailable = capability && !capability.available
  const canGenerate =
    Boolean(capability?.available) &&
    !submitting &&
    Boolean(style.trim() || lyrics.trim())

  return (
    <div className="mx-auto w-full max-w-[1500px] px-4 pb-12 pt-16 md:px-8 md:pt-8">
      <PageHeader
        eyebrow="Music"
        title="Make a song from a style and lyrics."
        description="Generate full songs with YuE2 locally through ComfyUI, then use them anywhere in the studio."
        actions={
          <div className="flex items-center gap-2">
            {capability ? (
              <Badge tone={capability.available ? 'success' : 'warning'}>
                {capability.available ? 'YuE2 ready' : 'YuE2 unavailable'}
              </Badge>
            ) : (
              <Badge>checking YuE2...</Badge>
            )}
            <Button
              size="sm"
              variant="outline"
              icon={<FileMusic className="size-3.5" />}
              onClick={() => setScoreOpen(true)}
            >
              Score &amp; plan
            </Button>
            <Button
              size="sm"
              variant="outline"
              icon={<RefreshCcw className="size-3.5" />}
              onClick={() => void capabilities.refetch()}
              busy={capabilities.isFetching}
            >
              Check again
            </Button>
          </div>
        }
      />

      {unavailable ? (
        <div className="mt-6 rounded-2xl border border-warning/25 bg-warning/10 p-4">
          <div className="flex items-start gap-3">
            <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-warning/15 text-warning">
              <Info className="size-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-text">YuE2 is not available in ComfyUI</p>
              <p className="mt-1 text-xs leading-5 text-text-2">
                {capability?.comfy_connected
                  ? 'ComfyUI is online, but the native YuE2 nodes or INT8 checkpoint are missing. Install/update ComfyUI and ensure yue2_3b_int8_convrot.safetensors is available.'
                  : 'ComfyUI could not be reached. Check the ComfyUI URL and server status.'}
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-3 text-[10px] text-text-3">
                <span>ComfyUI: {capability?.comfy_url || 'unknown'}</span>
                {capability?.missing?.length ? (
                  <span>Missing: {capability.missing.join(', ')}</span>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <div className="mt-6 grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
        <section className="space-y-3">
          <div className="rounded-2xl border border-line bg-white/[0.02] p-4">
            <div className="flex items-center gap-2">
              <WandSparkles className="size-4 text-lime" />
              <div>
                <p className="font-display text-sm font-semibold">Song</p>
                <p className="text-[10px] text-text-3">Describe the sound, then write the words.</p>
              </div>
            </div>

            <label className="mt-4 block">
              <span className="mb-1.5 block text-[10px] font-medium uppercase tracking-wider text-text-3">
                Song title
              </span>
              <Input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Song title (optional)"
                className="h-9 text-xs"
              />
            </label>

            <label className="mt-3 block">
              <span className="mb-1.5 block text-[10px] font-medium uppercase tracking-wider text-text-3">
                Style
              </span>
              <Textarea
                value={style}
                onChange={(event) => setStyle(event.target.value)}
                rows={3}
                placeholder="warm piano pop, expressive female vocal, 88 BPM, uplifting"
                className="text-xs leading-5"
              />
            </label>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {styleExamples.map((example) => (
                <button
                  key={example}
                  onClick={() => setStyle(example)}
                  className="rounded-full border border-line px-2 py-1 text-[9px] text-text-3 transition hover:border-lime/30 hover:text-lime"
                >
                  {example}
                </button>
              ))}
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <button
                onClick={() => setInstrumental((value) => !value)}
                className={`flex h-6 items-center gap-1.5 rounded-full border px-2 text-[10px] font-medium transition ${
                  instrumental
                    ? 'border-lime/30 bg-lime-soft text-lime'
                    : 'border-line text-text-3 hover:text-text-2'
                }`}
              >
                <Sparkles className="size-3" />
                Instrumental
              </button>
              {['Verse', 'Pre Chorus', 'Chorus', 'Bridge', 'Outro'].map((section) => (
                <button
                  key={section}
                  onClick={() => insertSection(section)}
                  disabled={instrumental}
                  className="rounded-full border border-line px-2 py-1 text-[9px] text-text-3 transition hover:border-line-strong hover:text-text-2 disabled:opacity-40"
                >
                  + {section}
                </button>
              ))}
            </div>

            <label className="mt-4 block">
              <span className="mb-1.5 block text-[10px] font-medium uppercase tracking-wider text-text-3">
                Lyrics
              </span>
              <Textarea
                ref={lyricsRef}
                value={instrumental ? '' : lyrics}
                onChange={(event) => setLyrics(event.target.value)}
                disabled={instrumental}
                rows={10}
                placeholder="[Verse]&#10;Morning light across the floor&#10;...&#10;&#10;[Chorus]&#10;Take me where the rivers run..."
                className="font-mono text-[11px] leading-5"
              />
            </label>
            <p className="mt-1.5 text-[10px] text-text-3">
              {instrumental
                ? 'Leave the lyrics blank and describe the instrumentation in the style.'
                : 'Use [Verse], [Chorus], and other section tags on their own lines.'}
            </p>
          </div>

          <div className="rounded-2xl border border-line bg-white/[0.02] p-4">
            <div className="flex flex-wrap items-end gap-3">
              <label className="flex flex-col gap-1 text-[10px] text-text-3">
                Planning
                <Select
                  className="h-8 min-w-[100px] pl-2 pr-6 text-[11px]"
                  value={planning}
                  onChange={(event) => setPlanning(event.target.value as Planning)}
                >
                  <option value="full">Full</option>
                  <option value="melody">Melody</option>
                  <option value="off">Off</option>
                </Select>
              </label>
              <label className="flex flex-col gap-1 text-[10px] text-text-3">
                Max duration
                <Select
                  className="h-8 min-w-[92px] pl-2 pr-6 text-[11px]"
                  value={maxDuration}
                  onChange={(event) => setMaxDuration(Number(event.target.value))}
                >
                  {durationOptions.map((value) => (
                    <option key={value} value={value}>
                      {value}s
                    </option>
                  ))}
                </Select>
              </label>
              <label className="flex flex-col gap-1 text-[10px] text-text-3">
                Acoustic steps
                <Input
                  type="number"
                  min={1}
                  max={64}
                  value={acousticSteps}
                  onChange={(event) => setAcousticSteps(Number(event.target.value))}
                  className="h-8 w-[84px] text-xs"
                />
              </label>
              <label className="flex flex-col gap-1 text-[10px] text-text-3">
                Seed
                <div className="flex items-center gap-1">
                  <Input
                    type="number"
                    min={0}
                    value={seed}
                    disabled={randomizeSeed}
                    onChange={(event) => setSeed(Number(event.target.value))}
                    className="h-8 w-[118px] text-xs disabled:opacity-50"
                  />
                  <button
                    type="button"
                    aria-pressed={randomizeSeed}
                    aria-label="Randomize seed before generation"
                    title={
                      randomizeSeed
                        ? 'Random seed is on: generate with a new seed'
                        : 'Random seed is off: use the seed above'
                    }
                    onClick={() => setRandomizeSeed((value) => !value)}
                    className={`grid h-8 w-8 shrink-0 place-items-center rounded-full border transition ${
                      randomizeSeed
                        ? 'border-lime/30 bg-lime-soft text-lime'
                        : 'border-line text-text-3 hover:border-line-strong hover:text-text-2'
                    }`}
                  >
                    <Dices className="size-3.5" />
                  </button>
                </div>
              </label>
              <Button
                variant="ghost"
                size="sm"
                className="ml-auto"
                icon={<SlidersHorizontal className="size-3.5" />}
                onClick={() => setAdvanced((value) => !value)}
              >
                {advanced ? 'Less' : 'Advanced'}
              </Button>
            </div>

            {advanced ? (
              <div className="mt-3 grid gap-3 border-t border-line pt-3 sm:grid-cols-3 lg:grid-cols-6">
                <label className="flex flex-col gap-1 text-[10px] text-text-3">
                  Temperature
                  <Input
                    type="number"
                    step="0.05"
                    min={0}
                    max={5}
                    value={temperature}
                    onChange={(event) => setTemperature(Number(event.target.value))}
                    className="h-8 text-xs"
                  />
                </label>
                <label className="flex flex-col gap-1 text-[10px] text-text-3">
                  Top P
                  <Input
                    type="number"
                    step="0.01"
                    min={0.01}
                    max={1}
                    value={topP}
                    onChange={(event) => setTopP(Number(event.target.value))}
                    className="h-8 text-xs"
                  />
                </label>
                <label className="flex flex-col gap-1 text-[10px] text-text-3">
                  Top K
                  <Input
                    type="number"
                    min={1}
                    max={1000}
                    value={topK}
                    onChange={(event) => setTopK(Number(event.target.value))}
                    className="h-8 text-xs"
                  />
                </label>
                <label className="flex flex-col gap-1 text-[10px] text-text-3">
                  Repetition
                  <Input
                    type="number"
                    step="0.01"
                    min={0.1}
                    max={3}
                    value={repetitionPenalty}
                    onChange={(event) => setRepetitionPenalty(Number(event.target.value))}
                    className="h-8 text-xs"
                  />
                </label>
                <label className="flex flex-col gap-1 text-[10px] text-text-3">
                  Guidance
                  <Input
                    type="number"
                    step="0.01"
                    min={0}
                    max={20}
                    value={guidance}
                    onChange={(event) => setGuidance(Number(event.target.value))}
                    className="h-8 text-xs"
                  />
                </label>
                <label className="flex flex-col gap-1 text-[10px] text-text-3">
                  Score tokens
                  <Input
                    type="number"
                    step={128}
                    min={1}
                    max={20000}
                    value={maxScoreTokens}
                    onChange={(event) => setMaxScoreTokens(Number(event.target.value))}
                    className="h-8 text-xs"
                  />
                </label>
              </div>
            ) : null}

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <Button
                variant="primary"
                icon={submitting ? <Spinner className="size-3.5" /> : <Music2 className="size-3.5" />}
                disabled={!canGenerate}
                onClick={generate}
              >
                {submitting ? 'Generating song...' : 'Generate song'}
              </Button>
              <span className="text-[10px] text-text-3">
                {planning === 'full'
                  ? 'Full planning writes melody and chords.'
                  : planning === 'melody'
                    ? 'Melody planning writes the vocal line.'
                    : 'Off skips symbolic planning.'}
              </span>
            </div>
          </div>

          {lastResult ? (
            <div className="rounded-2xl border border-lime/25 bg-lime-soft/20 p-4">
              <div className="flex items-center gap-2">
                <AudioLines className="size-4 text-lime" />
                <p className="font-display text-sm font-semibold">{lastResult.name || 'New song'}</p>
                <Badge tone="success">generated</Badge>
                {lastResult.duration ? <Badge>{formatDuration(lastResult.duration)}</Badge> : null}
              </div>
              {lastResult.filename ? (
                <audio
                  src={mediaUrl(`/audio/${lastResult.filename}`)}
                  controls
                  className="mt-3 w-full"
                />
              ) : null}
              {lastResult.score_abc ? (
                <details className="mt-3">
                  <summary className="cursor-pointer text-[10px] text-text-3">ABC score</summary>
                  <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap text-[10px] text-text-2">
                    {lastResult.score_abc}
                  </pre>
                </details>
              ) : null}
            </div>
          ) : null}
        </section>

        <aside className="min-w-0">
          {selectedAudio ? (
            <div className="mb-3 rounded-2xl border border-line bg-white/[0.02] p-4">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="font-display text-sm font-semibold">Selected from Library</p>
                  <p className="text-[10px] text-text-3">Use this audio as a cover source.</p>
                </div>
                <div className="flex items-center gap-1">
                  <Badge tone="lime">audio</Badge>
                  <button
                    type="button"
                    onClick={clearCoverSource}
                    className="grid size-6 place-items-center rounded-md text-text-3 transition hover:bg-white/10 hover:text-text"
                    aria-label="Clear cover source"
                    title="Clear cover source"
                  >
                    <X className="size-3.5" />
                  </button>
                </div>
              </div>
              <p className="mt-3 truncate text-[11px] font-medium text-text">{selectedAudioName}</p>
              <audio
                src={mediaUrl(`/audio/${selectedAudio.filename}`)}
                controls
                preload="metadata"
                className="mt-2 h-8 w-full"
              />
              <Button
                variant="soft"
                size="sm"
                className="mt-3 w-full"
                icon={<Music2 className="size-3.5" />}
                disabled={!capability?.cover_available || submitting || (!style.trim() && !lyrics.trim())}
                onClick={coverSelected}
                title={
                  capability?.cover_available
                    ? 'Transcribe the selected audio and generate a cover'
                    : 'YuE2 cover support is unavailable'
                }
              >
                Cover selected audio
              </Button>
              <p className="mt-2 text-[9px] leading-4 text-text-3">
                Uses the style and lyrics above. The source melody is transcribed by SheetSage2.
              </p>
            </div>
          ) : null}
          <div className="rounded-2xl border border-line bg-white/[0.02] p-4">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="font-display text-sm font-semibold">Recent songs</p>
                <p className="text-[10px] text-text-3">Generated audio lives in your Library.</p>
              </div>
              <Badge>{songs.length}</Badge>
            </div>

            <div className="mt-3 space-y-2">
              {songs.length ? (
                songs.slice(0, 30).map((song) => {
                  const meta = parseMetadata(song)
                  const stored = storedScoreView(song)
                  return (
                    <div
                      key={song.id}
                      className="rounded-xl border border-line bg-black/20 p-3"
                    >
                      <div className="flex items-start gap-2">
                        <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-lime-soft text-lime">
                          <Music2 className="size-4" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[11px] font-medium">{songName(song)}</p>
                          <p className="mt-0.5 truncate text-[9px] text-text-3">
                            {typeof meta.style === 'string' ? meta.style : song.prompt}
                          </p>
                          <div className="mt-1 flex items-center gap-1.5">
                            <Badge>{formatDuration(songDuration(song)) || 'audio'}</Badge>
                            {typeof meta.planning === 'string' ? (
                              <Badge>{meta.planning}</Badge>
                            ) : null}
                            {stored ? (
                              <button
                                type="button"
                                onClick={() => {
                                  setScoreView(stored)
                                  setScoreOpen(true)
                                }}
                                className="text-[9px] font-medium text-lime transition hover:underline"
                              >
                                Score &amp; plan
                              </button>
                            ) : null}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => void deleteSong(song)}
                          className="grid size-6 shrink-0 place-items-center rounded-md text-text-3 transition hover:bg-danger-soft hover:text-danger"
                          aria-label={`Delete ${songName(song)}`}
                          title="Delete song"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>
                      <audio
                        src={mediaUrl(`/audio/${song.filename}`)}
                        controls
                        preload="metadata"
                        className="mt-2 h-8 w-full"
                      />
                    </div>
                  )
                })
              ) : (
                <EmptyState
                  icon={<Music2 className="size-6" />}
                  title="No YuE2 songs yet"
                  description="Generate a song and it will appear here and in the Library."
                />
              )}
            </div>

            <div className="mt-4 border-t border-line pt-3">
              <Link
                to="/music"
                className="inline-flex items-center gap-1.5 text-[10px] text-text-3 transition hover:text-lime"
              >
                Use a song in Music Video <ExternalLink className="size-2.5" />
              </Link>
            </div>
          </div>
        </aside>
      </div>

      <ScorePanel
        open={scoreOpen}
        onClose={() => setScoreOpen(false)}
        scoreAbc={scoreView?.scoreAbc ?? lastResult?.score_abc}
        planning={scoreView?.planning ?? lastResult?.planning ?? planning}
        title={scoreView?.title ?? lastResult?.name ?? title ?? 'YuE2 song'}
        style={scoreView?.style ?? style}
        lyrics={scoreView?.lyrics ?? (instrumental ? '' : lyrics)}
        seed={scoreView?.seed ?? seed}
        maxScoreTokens={scoreView?.maxScoreTokens ?? maxScoreTokens}
        coverSource={
          scoreView?.coverSource ??
          (lastResult?.planning === 'cover' ? selectedAudioName : undefined)
        }
        audioFilename={scoreView?.audioFilename ?? lastResult?.filename}
      />
    </div>
  )
}

function titleFromLyrics(lyrics: string): string {
  for (const line of lyrics.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (trimmed && !(trimmed.startsWith('[') && trimmed.endsWith(']'))) {
      return trimmed.slice(0, 72)
    }
  }
  return ''
}
