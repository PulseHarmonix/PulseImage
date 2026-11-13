import { useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import {
  BookOpen,
  Clapperboard,
  Crosshair,
  Download,
  Film,
  Image as ImageIcon,
  ImagePlus,
  Palette,
  Plus,
  Sparkles,
  Trash2,
  UserPlus,
  Video,
} from 'lucide-react'
import { apiDelete, apiPost, apiUrl, mediaUrl } from '../lib/api'
import {
  queryKeys,
  useCharacters,
  useHistory,
  useStories,
  useStory,
} from '../lib/queries'
import { assetDisplayName } from '../lib/assets'
import { cn, formatDuration, uid } from '../lib/utils'
import { useUiStore } from '../stores/ui'
import { useQueueStore } from '../stores/queue'
import { confirmAction } from '../stores/confirm'
import { runSerializedGeneration } from '../lib/generationQueue'
import { PageContainer } from '../components/shell/PageContainer'
import { PageHeader } from '../components/shell/PageHeader'
import {
  Badge,
  Button,
  EmptyState,
  IconButton,
  Input,
  Select,
  Spinner,
  Textarea,
} from '../components/ui'
import type {
  Asset,
  Story,
  StoryCast,
  StoryContinuityMode,
  StoryScene,
  StorySceneAsset,
  StorySceneAssetRole,
  StorySettings,
  StoryShot,
  StoryKeyframeFrame,
} from '../types'

const aspectOptions = ['16:9', '9:16', '1:1', '3:2', '2:3']
const resolutionOptions = ['240p', '320p', '480p', '720p', '1080p']
const storyDurationOptions = [30, 45, 60, 75, 90]
const continuityOptions: { value: StoryContinuityMode; label: string }[] = [
  { value: 'new_scene', label: 'New scene' },
  { value: 'same_scene_frame', label: 'Same scene - frame' },
  { value: 'same_scene_video', label: 'Same scene - video' },
  { value: 'match_cut', label: 'Match cut' },
  { value: 'none', label: 'None' },
]
const sceneAssetRoleOptions: { value: StorySceneAssetRole; label: string }[] = [
  { value: 'background', label: 'Background' },
  { value: 'prop', label: 'Prop' },
  { value: 'reference', label: 'Reference' },
]
const sceneAnchorFrameCount = 24

type Tone = 'default' | 'lime' | 'danger' | 'warning' | 'success'

const statusTone: Record<string, Tone> = {
  draft: 'default',
  keyframes_ready: 'warning',
  keyframe_approved: 'lime',
  generating: 'warning',
  ready: 'success',
  clip_ready: 'success',
  error: 'danger',
}

interface CreateForm {
  title: string
  premise: string
  target_duration: number
  style: string
  resolution: string
  aspect_ratio: string
}

const defaultCreateForm: CreateForm = {
  title: '',
  premise: '',
  target_duration: 30,
  style: 'cinematic',
  resolution: '1080p',
  aspect_ratio: '16:9',
}

function normalizeSettings(settings?: Partial<StorySettings>): StorySettings {
  return {
    video_model: 'fasth3',
    resolution: settings?.resolution || '1080p',
    aspect_ratio: settings?.aspect_ratio || '16:9',
    style: settings?.style || 'cinematic',
    target_duration: Number(settings?.target_duration) || 30,
  }
}

function characterLabel(asset?: Asset): string {
  if (!asset) return 'Unknown character'
  const name = asset.metadata?.character_profile?.name?.trim()
  return name || assetDisplayName(asset)
}

function keyframeFrames(shot: StoryShot): StoryKeyframeFrame[] {
  const raw = shot.settings?.keyframe_frames
  if (!Array.isArray(raw)) return []
  return raw
    .filter((item): item is StoryKeyframeFrame => Boolean(item && typeof item === 'object'))
    .filter(
      (item) =>
        typeof item.index === 'number' &&
        typeof item.time === 'number' &&
        typeof item.url === 'string',
    )
}

function keyframeFrameIndex(shot: StoryShot): number | null {
  const raw = shot.settings?.keyframe_frame_index
  return typeof raw === 'number' ? raw : null
}

export function StoriesPage() {
  const stories = useStories()
  const characters = useCharacters()
  const history = useHistory()
  const queryClient = useQueryClient()
  const toast = useUiStore((s) => s.toast)

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const storyList = stories.data ?? []
  const activeId =
    selectedId && storyList.some((story) => story.id === selectedId)
      ? selectedId
      : storyList[0]?.id ?? null
  const storyQuery = useStory(activeId)
  const detail = storyQuery.data

  const [showCreate, setShowCreate] = useState(false)
  const [createForm, setCreateForm] = useState<CreateForm>(defaultCreateForm)
  const [creating, setCreating] = useState(false)
  const [planning, setPlanning] = useState(false)
  const [exporting, setExporting] = useState(false)

  const assetById = useMemo(
    () => new Map((history.data ?? []).map((asset) => [asset.id, asset])),
    [history.data],
  )
  const characterById = useMemo(
    () => new Map((characters.data ?? []).map((asset) => [asset.id, asset])),
    [characters.data],
  )

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: queryKeys.stories })
  }

  const createStory = async () => {
    const title = createForm.title.trim()
    if (!title) {
      toast({ title: 'Give the story a title first', tone: 'warning' })
      return
    }
    setCreating(true)
    try {
      const response = await apiPost<{ story: Story }>('/stories', {
        title,
        premise: createForm.premise.trim(),
        settings: {
          video_model: 'fasth3',
          resolution: createForm.resolution,
          aspect_ratio: createForm.aspect_ratio,
          style: createForm.style.trim() || 'cinematic',
          target_duration: createForm.target_duration,
        },
      })
      await refresh()
      setSelectedId(response.story.id)
      setCreateForm(defaultCreateForm)
      setShowCreate(false)
      toast({ title: 'Story created', tone: 'success' })
    } catch (error) {
      toast({
        title: 'Could not create story',
        description: error instanceof Error ? error.message : undefined,
        tone: 'error',
      })
    } finally {
      setCreating(false)
    }
  }

  const deleteStory = async (story: Story) => {
    const confirmed = await confirmAction({
      title: 'Delete story?',
      description: `"${story.title}" and all its scenes and shots will be removed.`,
      confirmLabel: 'Delete story',
      tone: 'danger',
    })
    if (!confirmed) return
    try {
      await apiDelete(`/stories/${story.id}`)
      if (activeId === story.id) setSelectedId(null)
      await refresh()
      toast({ title: 'Story deleted', tone: 'success' })
    } catch (error) {
      toast({
        title: 'Could not delete story',
        description: error instanceof Error ? error.message : undefined,
        tone: 'error',
      })
    }
  }

  const planStory = async () => {
    if (!activeId) return
    setPlanning(true)
    try {
      await apiPost(`/stories/${activeId}/plan`)
      await refresh()
      toast({ title: 'Storyboard generated', tone: 'success' })
    } catch (error) {
      toast({
        title: 'Could not generate storyboard',
        description: error instanceof Error ? error.message : undefined,
        tone: 'error',
      })
    } finally {
      setPlanning(false)
    }
  }

  const exportStory = async () => {
    if (!activeId) return
    setExporting(true)
    try {
      const response = await fetch(apiUrl(`/stories/${activeId}/export`))
      if (!response.ok) throw new Error(`Export failed (${response.status})`)
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      const name = (detail?.story.title || 'story').replace(/[^a-z0-9-_ ]/gi, '').trim()
      anchor.href = url
      anchor.download = `${name || 'story'}.zip`
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      URL.revokeObjectURL(url)
      toast({ title: 'Story exported', tone: 'success' })
    } catch (error) {
      toast({
        title: 'Could not export story',
        description: error instanceof Error ? error.message : undefined,
        tone: 'error',
      })
    } finally {
      setExporting(false)
    }
  }

  const addScene = async () => {
    if (!activeId) return
    try {
      await apiPost(`/stories/${activeId}/scenes`, {
        title: `Scene ${(detail?.scenes.length ?? 0) + 1}`,
        synopsis: '',
      })
      await refresh()
    } catch (error) {
      toast({
        title: 'Could not add scene',
        description: error instanceof Error ? error.message : undefined,
        tone: 'error',
      })
    }
  }

  const characterList = characters.data ?? []

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Narrative studio"
        title="Stories"
        description="Build characters, plan scenes, choose starting frames and generate clips shot by shot."
        actions={
          <Button
            variant="primary"
            icon={<Plus className="size-4" />}
            onClick={() => setShowCreate((open) => !open)}
          >
            New story
          </Button>
        }
      />

      <div className="mt-5 grid gap-5 lg:grid-cols-[290px_minmax(0,1fr)]">
        <aside className="space-y-3 self-start rounded-2xl border border-line bg-surface/60 p-3">
          <div className="flex items-center justify-between px-1">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-text-3">
              Projects
            </p>
            <Badge>{storyList.length}</Badge>
          </div>

          {showCreate ? (
            <div className="space-y-2 rounded-xl border border-line bg-white/[0.02] p-2.5">
              <Input
                value={createForm.title}
                onChange={(event) =>
                  setCreateForm((current) => ({ ...current, title: event.target.value }))
                }
                placeholder="Story title"
              />
              <Textarea
                value={createForm.premise}
                onChange={(event) =>
                  setCreateForm((current) => ({ ...current, premise: event.target.value }))
                }
                placeholder="Premise"
                rows={3}
              />
              <div className="grid grid-cols-2 gap-2">
                <Select
                  value={String(createForm.target_duration)}
                  onChange={(event) =>
                    setCreateForm((current) => ({
                      ...current,
                      target_duration: Number(event.target.value),
                    }))
                  }
                  aria-label="Target duration"
                >
                  {storyDurationOptions.map((value) => (
                    <option key={value} value={value}>
                      {value}s
                    </option>
                  ))}
                </Select>
                <Select
                  value={createForm.resolution}
                  onChange={(event) =>
                    setCreateForm((current) => ({ ...current, resolution: event.target.value }))
                  }
                  aria-label="Resolution"
                >
                  {resolutionOptions.map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Input
                  value={createForm.style}
                  onChange={(event) =>
                    setCreateForm((current) => ({ ...current, style: event.target.value }))
                  }
                  placeholder="Style"
                />
                <Select
                  value={createForm.aspect_ratio}
                  onChange={(event) =>
                    setCreateForm((current) => ({ ...current, aspect_ratio: event.target.value }))
                  }
                  aria-label="Aspect ratio"
                >
                  {aspectOptions.map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </Select>
              </div>
              <Button
                variant="primary"
                className="w-full"
                busy={creating}
                icon={<Sparkles className="size-3.5" />}
                onClick={() => void createStory()}
              >
                Create story
              </Button>
            </div>
          ) : null}

          {stories.isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Spinner />
            </div>
          ) : stories.isError ? (
            <p className="rounded-lg border border-danger/20 bg-danger-soft px-3 py-2 text-[11px] text-danger">
              Could not load stories.
            </p>
          ) : storyList.length ? (
            <div className="space-y-1.5">
              {storyList.map((story) => {
                const active = story.id === activeId
                return (
                  <div
                    key={story.id}
                    className={cn(
                      'group flex items-start gap-1 rounded-xl border px-2.5 py-2 transition',
                      active
                        ? 'border-lime/30 bg-lime-soft'
                        : 'border-transparent hover:bg-white/[0.04]',
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => setSelectedId(story.id)}
                      className="min-w-0 flex-1 text-left"
                    >
                      <p
                        className={cn(
                          'truncate text-xs font-medium',
                          active ? 'text-lime' : 'text-text',
                        )}
                      >
                        {story.title || 'Untitled story'}
                      </p>
                      <p className="line-clamp-2 text-[10px] leading-4 text-text-3">
                        {story.premise || 'No premise yet'}
                      </p>
                    </button>
                    <IconButton
                      className="size-7 text-text-3 opacity-0 transition group-hover:opacity-100"
                      onClick={() => void deleteStory(story)}
                      aria-label={`Delete ${story.title}`}
                    >
                      <Trash2 className="size-3.5" />
                    </IconButton>
                  </div>
                )
              })}
            </div>
          ) : (
            <p className="rounded-lg border border-dashed border-line px-3 py-6 text-center text-[11px] text-text-3">
              No stories yet. Create one to begin.
            </p>
          )}
        </aside>

        <section className="min-w-0 space-y-4">
          {!activeId ? (
            <EmptyState
              icon={<BookOpen className="size-8" />}
              title="No story selected"
              description="Pick a project from the list or create a new story to start building your storyboard."
              action={
                <Button
                  variant="primary"
                  icon={<Plus className="size-4" />}
                  onClick={() => setShowCreate(true)}
                >
                  New story
                </Button>
              }
            />
          ) : storyQuery.isLoading ? (
            <div className="flex min-h-[240px] items-center justify-center rounded-2xl border border-line bg-surface/60">
              <Spinner />
            </div>
          ) : storyQuery.isError || !detail ? (
            <EmptyState
              icon={<BookOpen className="size-8" />}
              title="Could not load story"
              description="The story may have been removed, or the backend is still starting up."
              action={
                <Button variant="outline" onClick={() => void storyQuery.refetch()}>
                  Retry
                </Button>
              }
            />
          ) : (
            <>
              <div className="rounded-2xl border border-line bg-surface/60 p-4">
                <StorySettingsPanel
                  key={`${detail.story.id}:${detail.story.last_updated ?? ''}`}
                  story={detail.story}
                  onSaved={refresh}
                />
                <div className="mt-4 flex flex-wrap gap-2 border-t border-line pt-4">
                  <Button
                    variant="primary"
                    busy={planning}
                    icon={<Sparkles className="size-4" />}
                    onClick={() => void planStory()}
                  >
                    Generate storyboard
                  </Button>
                  <Button
                    variant="outline"
                    busy={exporting}
                    icon={<Download className="size-4" />}
                    onClick={() => void exportStory()}
                  >
                    Export ZIP
                  </Button>
                  <Button
                    variant="danger"
                    icon={<Trash2 className="size-4" />}
                    onClick={() => void deleteStory(detail.story)}
                  >
                    Delete story
                  </Button>
                </div>
              </div>

              <CastPanel
                storyId={detail.story.id}
                cast={detail.cast ?? []}
                characters={characterList}
                onChanged={refresh}
              />

              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Clapperboard className="size-4 text-lime" />
                  <h2 className="font-display text-base font-semibold text-text">Scenes</h2>
                  <Badge>{detail.scenes?.length ?? 0}</Badge>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  icon={<Plus className="size-3.5" />}
                  onClick={() => void addScene()}
                >
                  Add scene
                </Button>
              </div>

              {detail.scenes?.length ? (
                <div className="space-y-4">
                  {detail.scenes.map((scene) => (
                    <SceneCard
                      key={scene.id}
                      storyId={detail.story.id}
                      scene={scene}
                      cast={detail.cast ?? []}
                      characterById={characterById}
                      assetById={assetById}
                      onChanged={refresh}
                    />
                  ))}
                </div>
              ) : (
                <EmptyState
                  icon={<Clapperboard className="size-8" />}
                  title="No scenes yet"
                  description="Generate an AI storyboard or add a scene manually, then add shots to generate casting frames and clips."
                />
              )}
            </>
          )}
        </section>
      </div>
    </PageContainer>
  )
}

function StorySettingsPanel({ story, onSaved }: { story: Story; onSaved: () => Promise<void> }) {
  const toast = useUiStore((s) => s.toast)
  const initial = normalizeSettings(story.settings)
  const [title, setTitle] = useState(story.title)
  const [premise, setPremise] = useState(story.premise)
  const [style, setStyle] = useState(initial.style)
  const [targetDuration, setTargetDuration] = useState(initial.target_duration)
  const [resolution, setResolution] = useState(initial.resolution)
  const [aspectRatio, setAspectRatio] = useState(initial.aspect_ratio)
  const [saving, setSaving] = useState(false)

  const save = async () => {
    setSaving(true)
    try {
      await apiPost(`/stories/${story.id}`, {
        title: title.trim() || story.title,
        premise: premise.trim(),
        settings: {
          video_model: 'fasth3',
          resolution,
          aspect_ratio: aspectRatio,
          style: style.trim() || 'cinematic',
          target_duration: targetDuration,
        },
      })
      await onSaved()
      toast({ title: 'Story updated', tone: 'success' })
    } catch (error) {
      toast({
        title: 'Could not update story',
        description: error instanceof Error ? error.message : undefined,
        tone: 'error',
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone="lime">FastH3</Badge>
        <Badge>{story.settings?.aspect_ratio || aspectRatio}</Badge>
        <Badge>{story.settings?.resolution || resolution}</Badge>
      </div>
      <Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Title" />
      <Textarea
        value={premise}
        onChange={(event) => setPremise(event.target.value)}
        placeholder="Premise"
        rows={3}
      />
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <label className="space-y-1">
          <span className="block text-[9px] uppercase tracking-wider text-text-3">Style</span>
          <Input
            value={style}
            onChange={(event) => setStyle(event.target.value)}
            placeholder="cinematic"
            className="h-9 text-xs"
          />
        </label>
        <label className="space-y-1">
          <span className="block text-[9px] uppercase tracking-wider text-text-3">Duration</span>
          <Select
            value={String(targetDuration)}
            onChange={(event) => setTargetDuration(Number(event.target.value))}
          >
            {storyDurationOptions.map((value) => (
              <option key={value} value={value}>
                {value}s
              </option>
            ))}
          </Select>
        </label>
        <label className="space-y-1">
          <span className="block text-[9px] uppercase tracking-wider text-text-3">Resolution</span>
          <Select value={resolution} onChange={(event) => setResolution(event.target.value)}>
            {resolutionOptions.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </Select>
        </label>
        <label className="space-y-1">
          <span className="block text-[9px] uppercase tracking-wider text-text-3">Aspect</span>
          <Select value={aspectRatio} onChange={(event) => setAspectRatio(event.target.value)}>
            {aspectOptions.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </Select>
        </label>
      </div>
      <div className="flex flex-wrap items-end gap-2">
        <Button variant="soft" size="sm" busy={saving} onClick={() => void save()}>
          Save changes
        </Button>
      </div>
    </div>
  )
}

function CastPanel({
  storyId,
  cast,
  characters,
  onChanged,
}: {
  storyId: string
  cast: StoryCast[]
  characters: Asset[]
  onChanged: () => Promise<void>
}) {
  const toast = useUiStore((s) => s.toast)
  const [characterId, setCharacterId] = useState('')
  const [roleName, setRoleName] = useState('')
  const [notes, setNotes] = useState('')
  const [adding, setAdding] = useState(false)

  const available = characters.filter(
    (character) => !cast.some((entry) => entry.character_asset_id === character.id),
  )
  const effectiveId = characterId || available[0]?.id || ''

  const add = async () => {
    const chosen = characters.find((character) => character.id === effectiveId)
    if (!chosen) {
      toast({ title: 'Select a character from the library', tone: 'warning' })
      return
    }
    setAdding(true)
    try {
      await apiPost(`/stories/${storyId}/cast`, {
        character_asset_id: chosen.id,
        role_name: roleName.trim() || characterLabel(chosen),
        notes: notes.trim(),
      })
      setCharacterId('')
      setRoleName('')
      setNotes('')
      await onChanged()
    } catch (error) {
      toast({
        title: 'Could not add cast member',
        description: error instanceof Error ? error.message : undefined,
        tone: 'error',
      })
    } finally {
      setAdding(false)
    }
  }

  return (
    <div className="space-y-3 rounded-2xl border border-line bg-surface/60 p-4">
      <div className="flex items-center gap-2">
        <UserPlus className="size-4 text-lime" />
        <h2 className="font-display text-base font-semibold text-text">Cast</h2>
        <Badge>{cast.length}</Badge>
      </div>

      {cast.length ? (
        <div className="space-y-2">
          {cast.map((entry) => (
            <CastRow
              key={entry.character_asset_id}
              storyId={storyId}
              entry={entry}
              onChanged={onChanged}
            />
          ))}
        </div>
      ) : (
        <p className="text-[11px] text-text-3">
          No cast yet. Characters flagged in the Library appear here.
        </p>
      )}

      {available.length ? (
        <div className="grid gap-2 border-t border-line pt-3 sm:grid-cols-[1fr_1fr_1fr_auto]">
          <Select
            value={effectiveId}
            onChange={(event) => setCharacterId(event.target.value)}
            aria-label="Character"
          >
            {available.map((character) => (
              <option key={character.id} value={character.id}>
                {characterLabel(character)}
              </option>
            ))}
          </Select>
          <Input
            value={roleName}
            onChange={(event) => setRoleName(event.target.value)}
            placeholder="Role name"
            className="h-9 text-xs"
          />
          <Input
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Notes"
            className="h-9 text-xs"
          />
          <Button
            variant="outline"
            size="sm"
            busy={adding}
            icon={<Plus className="size-3.5" />}
            onClick={() => void add()}
          >
            Add
          </Button>
        </div>
      ) : characters.length ? (
        <p className="border-t border-line pt-3 text-[11px] text-text-3">
          All library characters are already in the cast.
        </p>
      ) : (
        <p className="border-t border-line pt-3 text-[11px] text-text-3">
          No library characters found. Flag an image as a character in the Library inspector.
        </p>
      )}
    </div>
  )
}

function CastRow({
  storyId,
  entry,
  onChanged,
}: {
  storyId: string
  entry: StoryCast
  onChanged: () => Promise<void>
}) {
  const toast = useUiStore((s) => s.toast)
  const [roleName, setRoleName] = useState(entry.role_name ?? '')
  const [notes, setNotes] = useState(entry.notes ?? '')
  const [saving, setSaving] = useState(false)
  const dirty = roleName !== (entry.role_name ?? '') || notes !== (entry.notes ?? '')

  const save = async () => {
    setSaving(true)
    try {
      await apiPost(`/stories/${storyId}/cast`, {
        character_asset_id: entry.character_asset_id,
        role_name: roleName,
        notes,
      })
      await onChanged()
    } catch (error) {
      toast({
        title: 'Could not update cast member',
        description: error instanceof Error ? error.message : undefined,
        tone: 'error',
      })
    } finally {
      setSaving(false)
    }
  }

  const remove = async () => {
    try {
      await apiDelete(`/stories/${storyId}/cast/${entry.character_asset_id}`)
      await onChanged()
    } catch (error) {
      toast({
        title: 'Could not remove cast member',
        description: error instanceof Error ? error.message : undefined,
        tone: 'error',
      })
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-line bg-white/[0.02] p-2">
      <img
        src={mediaUrl(`/thumbnails/${entry.character_asset_id}.jpg`)}
        alt={entry.name || entry.role_name}
        loading="lazy"
        className="size-10 shrink-0 rounded-lg border border-line object-cover"
      />
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-medium text-text">
          {entry.name || entry.profile?.name || 'Character'}
        </p>
        <p className="truncate text-[10px] text-text-3">
          {entry.profile?.description || entry.filename || entry.character_asset_id}
        </p>
      </div>
      <Input
        value={roleName}
        onChange={(event) => setRoleName(event.target.value)}
        placeholder="Role"
        className="h-8 w-32 text-xs"
      />
      <Input
        value={notes}
        onChange={(event) => setNotes(event.target.value)}
        placeholder="Notes"
        className="h-8 w-40 text-xs"
      />
      <Button
        variant="ghost"
        size="sm"
        busy={saving}
        disabled={!dirty}
        onClick={() => void save()}
      >
        Save
      </Button>
      <IconButton
        className="size-8 text-text-3 hover:text-danger"
        onClick={() => void remove()}
        aria-label="Remove cast member"
      >
        <Trash2 className="size-3.5" />
      </IconButton>
    </div>
  )
}

function SceneCard({
  storyId,
  scene,
  cast,
  characterById,
  assetById,
  onChanged,
}: {
  storyId: string
  scene: StoryScene
  cast: StoryCast[]
  characterById: Map<string, Asset>
  assetById: Map<string, Asset>
  onChanged: () => Promise<void>
}) {
  const toast = useUiStore((s) => s.toast)
  const [title, setTitle] = useState(scene.title ?? '')
  const [synopsis, setSynopsis] = useState(scene.synopsis ?? '')
  const [location, setLocation] = useState(scene.location ?? '')
  const [timeOfDay, setTimeOfDay] = useState(scene.time_of_day ?? '')
  const [mood, setMood] = useState(scene.mood ?? '')
  const [lighting, setLighting] = useState(scene.lighting ?? '')
  const [weather, setWeather] = useState(scene.weather ?? '')
  const [palette, setPalette] = useState(scene.palette ?? '')
  const [negativePrompt, setNegativePrompt] = useState(scene.negative_prompt ?? '')
  const [saving, setSaving] = useState(false)
  const [addingShot, setAddingShot] = useState(false)

  const castSummary = useMemo(() => {
    const names = new Set<string>()
    for (const shot of scene.shots ?? []) {
      for (const id of shot.character_asset_ids ?? []) {
        const entry = cast.find((member) => member.character_asset_id === id)
        const name = entry
          ? entry.name || entry.role_name
          : characterById.has(id)
            ? characterLabel(characterById.get(id))
            : undefined
        if (name) names.add(name)
      }
    }
    return Array.from(names)
  }, [scene.shots, cast, characterById])

  const save = async () => {
    setSaving(true)
    try {
      await apiPost(`/stories/${storyId}/scenes/${scene.id}`, {
        title,
        synopsis,
        location,
        time_of_day: timeOfDay,
        mood,
        lighting,
        weather,
        palette,
        negative_prompt: negativePrompt,
      })
      await onChanged()
      toast({ title: 'Scene saved', tone: 'success' })
    } catch (error) {
      toast({
        title: 'Could not save scene',
        description: error instanceof Error ? error.message : undefined,
        tone: 'error',
      })
    } finally {
      setSaving(false)
    }
  }

  const addShot = async () => {
    setAddingShot(true)
    try {
      await apiPost(`/stories/${storyId}/scenes/${scene.id}/shots`, {
        action: '',
        duration: 6,
      })
      await onChanged()
    } catch (error) {
      toast({
        title: 'Could not add shot',
        description: error instanceof Error ? error.message : undefined,
        tone: 'error',
      })
    } finally {
      setAddingShot(false)
    }
  }

  const remove = async () => {
    const confirmed = await confirmAction({
      title: 'Delete scene?',
      description: `"${scene.title || `Scene ${scene.scene_number}`}" and its shots will be removed.`,
      confirmLabel: 'Delete scene',
      tone: 'danger',
    })
    if (!confirmed) return
    try {
      await apiDelete(`/stories/${storyId}/scenes/${scene.id}`)
      await onChanged()
    } catch (error) {
      toast({
        title: 'Could not delete scene',
        description: error instanceof Error ? error.message : undefined,
        tone: 'error',
      })
    }
  }

  return (
    <div className="space-y-3 rounded-2xl border border-line bg-surface/60 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone="lime">Scene {scene.scene_number}</Badge>
        <Input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Scene title"
          className="h-9 min-w-40 flex-1 text-sm"
        />
        <Button variant="soft" size="sm" busy={saving} onClick={() => void save()}>
          Save scene
        </Button>
        <IconButton
          className="size-8 text-text-3 hover:text-danger"
          onClick={() => void remove()}
          aria-label="Delete scene"
        >
          <Trash2 className="size-3.5" />
        </IconButton>
      </div>

      <Textarea
        value={synopsis}
        onChange={(event) => setSynopsis(event.target.value)}
        placeholder="Scene synopsis"
        rows={2}
      />
      <div className="grid gap-2 sm:grid-cols-3">
        <Input
          value={location}
          onChange={(event) => setLocation(event.target.value)}
          placeholder="Location"
          className="h-9 text-xs"
        />
        <Input
          value={timeOfDay}
          onChange={(event) => setTimeOfDay(event.target.value)}
          placeholder="Time of day"
          className="h-9 text-xs"
        />
        <Input
          value={mood}
          onChange={(event) => setMood(event.target.value)}
          placeholder="Mood"
          className="h-9 text-xs"
        />
      </div>

      <div className="space-y-3 rounded-xl border border-line bg-black/20 p-3">
        <div className="flex flex-wrap items-center gap-2">
          <Palette className="size-3.5 text-lime" />
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-text-3">
            Scene setup
          </p>
          {castSummary.length ? (
            <span className="truncate text-[10px] text-text-3">
              Cast: {castSummary.join(', ')}
            </span>
          ) : null}
          <span className="ml-auto text-[10px] text-text-3">Look fields save with scene</span>
        </div>

        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <label className="space-y-1">
            <span className="block text-[9px] uppercase tracking-wider text-text-3">Lighting</span>
            <Input
              value={lighting}
              onChange={(event) => setLighting(event.target.value)}
              placeholder="Lighting"
              className="h-8 text-xs"
            />
          </label>
          <label className="space-y-1">
            <span className="block text-[9px] uppercase tracking-wider text-text-3">Weather</span>
            <Input
              value={weather}
              onChange={(event) => setWeather(event.target.value)}
              placeholder="Weather"
              className="h-8 text-xs"
            />
          </label>
          <label className="space-y-1">
            <span className="block text-[9px] uppercase tracking-wider text-text-3">Palette</span>
            <Input
              value={palette}
              onChange={(event) => setPalette(event.target.value)}
              placeholder="Palette"
              className="h-8 text-xs"
            />
          </label>
          <label className="space-y-1">
            <span className="block text-[9px] uppercase tracking-wider text-text-3">
              Negative prompt
            </span>
            <Input
              value={negativePrompt}
              onChange={(event) => setNegativePrompt(event.target.value)}
              placeholder="Things to avoid"
              className="h-8 text-xs"
            />
          </label>
        </div>

        <SceneReferencesPanel storyId={storyId} scene={scene} onChanged={onChanged} />
        <SceneAnchorPanel
          storyId={storyId}
          scene={scene}
          assetById={assetById}
          onChanged={onChanged}
        />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-text-3">
            Shots
          </p>
          <Button
            variant="outline"
            size="sm"
            busy={addingShot}
            icon={<Plus className="size-3.5" />}
            onClick={() => void addShot()}
          >
            Add shot
          </Button>
        </div>
        {scene.shots?.length ? (
          scene.shots.map((shot) => (
            <ShotCard
              key={shot.id}
              storyId={storyId}
              shot={shot}
              cast={cast}
              characterById={characterById}
              assetById={assetById}
              onChanged={onChanged}
            />
          ))
        ) : (
          <p className="rounded-xl border border-dashed border-line px-3 py-4 text-center text-[11px] text-text-3">
            No shots in this scene yet.
          </p>
        )}
      </div>
    </div>
  )
}

function SceneReferencesPanel({
  storyId,
  scene,
  onChanged,
}: {
  storyId: string
  scene: StoryScene
  onChanged: () => Promise<void>
}) {
  const history = useHistory()
  const queryClient = useQueryClient()
  const toast = useUiStore((s) => s.toast)
  const queueAdd = useQueueStore((s) => s.add)
  const queueUpdate = useQueueStore((s) => s.update)
  const [selectedAssetId, setSelectedAssetId] = useState('')
  const [role, setRole] = useState<StorySceneAssetRole>('background')
  const [label, setLabel] = useState('')
  const [adding, setAdding] = useState(false)
  const [removingId, setRemovingId] = useState<string | null>(null)
  const [prompt, setPrompt] = useState('')
  const [genLabel, setGenLabel] = useState('')
  const [genRole, setGenRole] = useState<StorySceneAssetRole>('background')
  const [generating, setGenerating] = useState(false)
  const [generateError, setGenerateError] = useState<string | null>(null)

  const references = scene.assets ?? []
  const imageAssets = (history.data ?? []).filter((asset) => asset.type === 'image')
  const available = imageAssets.filter(
    (asset) => !references.some((reference) => reference.asset_id === asset.id),
  )
  const effectiveId =
    selectedAssetId && available.some((asset) => asset.id === selectedAssetId)
      ? selectedAssetId
      : available[0]?.id ?? ''

  const addFromLibrary = async () => {
    const chosen = available.find((asset) => asset.id === effectiveId)
    if (!chosen) {
      toast({ title: 'Select an image from the library', tone: 'warning' })
      return
    }
    setAdding(true)
    try {
      await apiPost(`/stories/${storyId}/scenes/${scene.id}/assets`, {
        asset_id: chosen.id,
        role,
        label: label.trim() || assetDisplayName(chosen),
        notes: '',
      })
      setSelectedAssetId('')
      setLabel('')
      await onChanged()
      toast({ title: 'Scene reference added', tone: 'success' })
    } catch (error) {
      toast({
        title: 'Could not add scene reference',
        description: error instanceof Error ? error.message : undefined,
        tone: 'error',
      })
    } finally {
      setAdding(false)
    }
  }

  const removeReference = async (reference: StorySceneAsset) => {
    setRemovingId(reference.asset_id)
    try {
      await apiDelete(`/stories/${storyId}/scenes/${scene.id}/assets/${reference.asset_id}`)
      await onChanged()
    } catch (error) {
      toast({
        title: 'Could not remove scene reference',
        description: error instanceof Error ? error.message : undefined,
        tone: 'error',
      })
    } finally {
      setRemovingId(null)
    }
  }

  const generateReference = async () => {
    const resolvedPrompt = prompt.trim()
    if (!resolvedPrompt) {
      toast({ title: 'Describe the reference to generate', tone: 'warning' })
      return
    }
    setGenerating(true)
    setGenerateError(null)
    const queueId = uid('scene-reference')
    queueAdd({
      id: queueId,
      label: `Scene reference - Scene ${scene.scene_number}`,
      mode: 'image',
      status: 'queued',
      progress: 0,
      stage: 'queued',
      startedAt: Date.now(),
    })
    try {
      await runSerializedGeneration(async () => {
        queueUpdate(queueId, {
          status: 'running',
          progress: 8,
          stage: 'generating',
          startedAt: Date.now(),
        })
        try {
          await apiPost<{ asset?: StorySceneAsset }>(
            `/stories/${storyId}/scenes/${scene.id}/assets/generate`,
            { role: genRole, label: genLabel.trim(), prompt: resolvedPrompt },
          )
          setPrompt('')
          setGenLabel('')
          await onChanged()
          void queryClient.invalidateQueries({ queryKey: queryKeys.history })
          queueUpdate(queueId, {
            status: 'done',
            progress: 100,
            stage: 'reference ready',
            finishedAt: Date.now(),
          })
          toast({ title: 'Scene reference ready', tone: 'success' })
        } catch (error) {
          const message =
            error instanceof Error ? error.message : 'Reference generation failed'
          setGenerateError(message)
          queueUpdate(queueId, {
            status: 'error',
            error: message,
            finishedAt: Date.now(),
          })
          throw error
        }
      })
    } catch (error) {
      toast({
        title: 'Could not generate scene reference',
        description: error instanceof Error ? error.message : undefined,
        tone: 'error',
      })
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div className="space-y-2 rounded-lg border border-line bg-white/[0.02] p-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <ImageIcon className="size-3.5 text-text-3" />
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-text-3">
          Scene references
        </p>
        <Badge>{references.length}</Badge>
      </div>

      {references.length ? (
        <div className="grid gap-2 sm:grid-cols-2">
          {references.map((reference) => (
            <div
              key={reference.id}
              className="flex items-center gap-2 rounded-lg border border-line bg-black/20 p-2"
            >
              <img
                src={mediaUrl(`/thumbnails/${reference.asset_id}.jpg`)}
                alt={reference.label || reference.filename}
                loading="lazy"
                className="size-10 shrink-0 rounded-lg border border-line object-cover"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium text-text">
                  {reference.label || reference.filename || 'Reference'}
                </p>
                <p className="truncate text-[10px] text-text-3">
                  {reference.role}
                  {reference.notes ? ` - ${reference.notes}` : ''}
                </p>
              </div>
              <IconButton
                className="size-8 text-text-3 hover:text-danger"
                busy={removingId === reference.asset_id}
                onClick={() => void removeReference(reference)}
                aria-label={`Remove ${reference.label || reference.filename}`}
              >
                <Trash2 className="size-3.5" />
              </IconButton>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-[10px] text-text-3">
          No references yet. Add backgrounds, props or reference images for this scene.
        </p>
      )}

      {available.length ? (
        <div className="grid gap-2 border-t border-line pt-2 sm:grid-cols-[1fr_120px_1fr_auto]">
          <Select
            value={effectiveId}
            onChange={(event) => setSelectedAssetId(event.target.value)}
            aria-label="Library image"
          >
            {available.map((asset) => (
              <option key={asset.id} value={asset.id}>
                {assetDisplayName(asset)}
              </option>
            ))}
          </Select>
          <Select
            value={role}
            onChange={(event) => setRole(event.target.value as StorySceneAssetRole)}
            aria-label="Reference role"
          >
            {sceneAssetRoleOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
          <Input
            value={label}
            onChange={(event) => setLabel(event.target.value)}
            placeholder="Label"
            className="h-9 text-xs"
          />
          <Button
            variant="outline"
            size="sm"
            busy={adding}
            icon={<Plus className="size-3.5" />}
            onClick={() => void addFromLibrary()}
          >
            Add
          </Button>
        </div>
      ) : imageAssets.length ? (
        <p className="border-t border-line pt-2 text-[10px] text-text-3">
          Every library image is already attached to this scene.
        </p>
      ) : (
        <p className="border-t border-line pt-2 text-[10px] text-text-3">
          No library images found. Generate one below or save images to the Library first.
        </p>
      )}

      <div className="grid gap-2 border-t border-line pt-2 sm:grid-cols-[120px_1fr_1fr_auto]">
        <Select
          value={genRole}
          onChange={(event) => setGenRole(event.target.value as StorySceneAssetRole)}
          aria-label="Generated reference role"
        >
          {sceneAssetRoleOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
        <Input
          value={genLabel}
          onChange={(event) => setGenLabel(event.target.value)}
          placeholder="Prop or location"
          className="h-9 text-xs"
        />
        <Input
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          placeholder="Describe the missing reference"
          className="h-9 text-xs"
        />
        <Button
          variant="outline"
          size="sm"
          busy={generating}
          icon={<ImagePlus className="size-3.5" />}
          onClick={() => void generateReference()}
        >
          Generate
        </Button>
      </div>
      {generateError ? (
        <p className="rounded-lg border border-danger/20 bg-danger-soft px-2 py-1.5 text-[10px] text-danger">
          {generateError}
        </p>
      ) : null}
    </div>
  )
}

function SceneAnchorPanel({
  storyId,
  scene,
  assetById,
  onChanged,
}: {
  storyId: string
  scene: StoryScene
  assetById: Map<string, Asset>
  onChanged: () => Promise<void>
}) {
  const queryClient = useQueryClient()
  const toast = useUiStore((s) => s.toast)
  const queueAdd = useQueueStore((s) => s.add)
  const queueUpdate = useQueueStore((s) => s.update)
  const [frames, setFrames] = useState<StoryKeyframeFrame[]>(() => scene.anchor_frames ?? [])
  const [selectedFrameIndex, setSelectedFrameIndex] = useState<number | null>(
    () => scene.anchor_frame_index ?? null,
  )
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null)
  const [generating, setGenerating] = useState(false)
  const [selectingFrame, setSelectingFrame] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  const approvedAsset =
    selectedAsset ??
    (scene.anchor_image_id ? assetById.get(scene.anchor_image_id) ?? null : null)
  const sourceVideo = scene.anchor_source_video || undefined

  const generateAnchor = async () => {
    setGenerating(true)
    setError(null)
    const queueId = uid('scene-anchor')
    queueAdd({
      id: queueId,
      label: `Scene anchor - Scene ${scene.scene_number}`,
      mode: 'video',
      status: 'queued',
      progress: 0,
      stage: 'queued',
      startedAt: Date.now(),
    })
    try {
      await runSerializedGeneration(async () => {
        queueUpdate(queueId, {
          status: 'running',
          progress: 8,
          stage: 'generating',
          startedAt: Date.now(),
        })
        try {
          const response = await apiPost<{
            scene?: StoryScene
            frames?: StoryKeyframeFrame[]
            source_video?: string
            fps?: number
          }>(`/stories/${storyId}/scenes/${scene.id}/anchor`)
          setFrames(response.frames ?? response.scene?.anchor_frames ?? [])
          setSelectedFrameIndex(response.scene?.anchor_frame_index ?? null)
          setSelectedAsset(null)
          await onChanged()
          void queryClient.invalidateQueries({ queryKey: queryKeys.history })
          queueUpdate(queueId, {
            status: 'done',
            progress: 100,
            stage: 'frames ready',
            finishedAt: Date.now(),
          })
          toast({ title: 'Scene anchor ready - choose a frame', tone: 'success' })
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Scene anchor failed'
          setError(message)
          queueUpdate(queueId, {
            status: 'error',
            error: message,
            finishedAt: Date.now(),
          })
          throw err
        }
      })
    } catch (err) {
      toast({
        title: 'Could not generate scene anchor',
        description: err instanceof Error ? err.message : undefined,
        tone: 'error',
      })
    } finally {
      setGenerating(false)
    }
  }

  const selectFrame = async (frameIndex: number) => {
    setSelectingFrame(frameIndex)
    setError(null)
    try {
      const response = await apiPost<{ scene?: StoryScene; asset?: Asset }>(
        `/stories/${storyId}/scenes/${scene.id}/select-anchor-frame`,
        { frame_index: frameIndex },
      )
      setSelectedFrameIndex(frameIndex)
      if (response.asset) setSelectedAsset(response.asset)
      await onChanged()
      void queryClient.invalidateQueries({ queryKey: queryKeys.history })
      toast({ title: 'Scene anchor approved', tone: 'success' })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not select anchor frame'
      setError(message)
      toast({
        title: 'Could not select anchor frame',
        description: message,
        tone: 'error',
      })
    } finally {
      setSelectingFrame(null)
    }
  }

  return (
    <div className="space-y-2 rounded-lg border border-line bg-white/[0.02] p-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <Crosshair className="size-3.5 text-text-3" />
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-text-3">
          Scene anchor
        </p>
        <Button
          variant="outline"
          size="sm"
          busy={generating}
          icon={<Sparkles className="size-3.5" />}
          onClick={() => void generateAnchor()}
        >
          Generate scene anchor
        </Button>
        <span className="text-[10px] text-text-3">
          Local FastH3 plate exposing {sceneAnchorFrameCount} frames.
        </span>
      </div>

      {frames.length ? (
        <div className="grid grid-cols-6 gap-1.5">
          {frames.slice(0, sceneAnchorFrameCount).map((frame) => {
            const selected = selectedFrameIndex === frame.index
            return (
              <button
                key={`${frame.index}-${frame.url}`}
                type="button"
                onClick={() => void selectFrame(frame.index)}
                disabled={selectingFrame !== null}
                className={cn(
                  'group relative aspect-video overflow-hidden rounded-md border bg-black transition',
                  selected
                    ? 'border-lime ring-1 ring-lime/50'
                    : 'border-line hover:border-line-strong',
                )}
                title={`Frame ${frame.index} - ${frame.time.toFixed(2)}s`}
              >
                <img
                  src={mediaUrl(frame.url)}
                  alt={`Anchor frame ${frame.index}`}
                  loading="lazy"
                  className="size-full object-cover"
                />
                <span className="absolute bottom-0.5 right-0.5 rounded bg-black/65 px-1 text-[8px] text-white">
                  {frame.index}
                </span>
                {selected ? (
                  <span className="absolute left-0.5 top-0.5 rounded bg-lime px-1 text-[8px] font-semibold text-bg">
                    Anchor
                  </span>
                ) : null}
                {selectingFrame === frame.index ? (
                  <span className="absolute inset-0 grid place-items-center bg-black/60">
                    <Spinner className="text-white" />
                  </span>
                ) : null}
              </button>
            )
          })}
        </div>
      ) : (
        <p className="text-[10px] text-text-3">
          No anchor frames yet. Generate a scene anchor to approve a starting frame for this
          scene.
        </p>
      )}

      {approvedAsset ? (
        <div className="flex flex-wrap items-end gap-3 rounded-lg border border-lime/20 bg-lime-soft/40 p-2">
          <img
            src={mediaUrl(`/images/${approvedAsset.filename}`)}
            alt={assetDisplayName(approvedAsset)}
            className="aspect-video w-full max-w-[220px] rounded-lg border border-line object-cover"
          />
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-lime">
              Approved anchor
            </p>
            <p className="truncate text-[10px] text-text-2">
              {assetDisplayName(approvedAsset)}
            </p>
            {sourceVideo ? (
              <p className="truncate text-[10px] text-text-3">Source: {sourceVideo}</p>
            ) : null}
          </div>
        </div>
      ) : null}

      {error ? (
        <p className="rounded-lg border border-danger/20 bg-danger-soft px-2 py-1.5 text-[10px] text-danger">
          {error}
        </p>
      ) : null}
    </div>
  )
}

function ShotCard({
  storyId,
  shot,
  cast,
  characterById,
  assetById,
  onChanged,
}: {
  storyId: string
  shot: StoryShot
  cast: StoryCast[]
  characterById: Map<string, Asset>
  assetById: Map<string, Asset>
  onChanged: () => Promise<void>
}) {
  const toast = useUiStore((s) => s.toast)
  const queryClient = useQueryClient()
  const queueAdd = useQueueStore((s) => s.add)
  const queueUpdate = useQueueStore((s) => s.update)
  const [duration, setDuration] = useState(String(shot.duration ?? 4))
  const [action, setAction] = useState(shot.action ?? '')
  const [camera, setCamera] = useState(shot.camera ?? '')
  const [imagePrompt, setImagePrompt] = useState(shot.image_prompt ?? '')
  const [videoPrompt, setVideoPrompt] = useState(shot.video_prompt ?? '')
  const [continuity, setContinuity] = useState<StoryContinuityMode>(
    shot.continuity_mode ?? 'new_scene',
  )
  const [saving, setSaving] = useState(false)
  const [keyframesBusy, setKeyframesBusy] = useState(false)
  const [frames, setFrames] = useState<StoryKeyframeFrame[]>(() => keyframeFrames(shot))
  const [selectedFrameIndex, setSelectedFrameIndex] = useState<number | null>(() =>
    keyframeFrameIndex(shot),
  )
  const [selectingFrame, setSelectingFrame] = useState<number | null>(null)
  const [generating, setGenerating] = useState(false)

  const selectedAsset = shot.selected_image_id
    ? assetById.get(shot.selected_image_id)
    : undefined
  const videoFilename =
    shot.video_filename ||
    (shot.video_asset_id ? assetById.get(shot.video_asset_id)?.filename : undefined)
  const clipReady =
    Boolean(videoFilename) || shot.status === 'ready' || String(shot.status) === 'clip_ready'

  const characterNames = (shot.character_asset_ids ?? [])
    .map((id) => {
      const fromCast = cast.find((entry) => entry.character_asset_id === id)
      if (fromCast) return fromCast.name || fromCast.role_name
      return characterById.has(id) ? characterLabel(characterById.get(id)) : undefined
    })
    .filter((name): name is string => Boolean(name))

  const save = async () => {
    setSaving(true)
    try {
      await apiPost(`/stories/${storyId}/shots/${shot.id}`, {
        duration: Number(duration) || 4,
        action,
        camera,
        image_prompt: imagePrompt,
        video_prompt: videoPrompt,
        continuity_mode: continuity,
      })
      await onChanged()
      toast({ title: 'Shot saved', tone: 'success' })
    } catch (error) {
      toast({
        title: 'Could not save shot',
        description: error instanceof Error ? error.message : undefined,
        tone: 'error',
      })
    } finally {
      setSaving(false)
    }
  }

  const makeKeyframes = async () => {
    setKeyframesBusy(true)
    const queueId = uid('casting')
    queueAdd({
      id: queueId,
      label: `Casting clip ? Shot ${shot.shot_number}`,
      mode: 'video',
      status: 'queued',
      progress: 0,
      stage: 'queued',
      startedAt: Date.now(),
    })
    try {
      await runSerializedGeneration(async () => {
        queueUpdate(queueId, {
          status: 'running',
          progress: 8,
          stage: 'casting',
          startedAt: Date.now(),
        })
        try {
          const response = await apiPost<{
            shot: StoryShot
            frames?: StoryKeyframeFrame[]
          }>(`/stories/${storyId}/shots/${shot.id}/keyframes`)
          setFrames(response.frames ?? keyframeFrames(response.shot))
          setSelectedFrameIndex(keyframeFrameIndex(response.shot))
          await onChanged()
          void queryClient.invalidateQueries({ queryKey: queryKeys.history })
          queueUpdate(queueId, {
            status: 'done',
            progress: 100,
            stage: 'frames ready',
            finishedAt: Date.now(),
          })
          toast({ title: 'Casting clip ready ? choose a frame', tone: 'success' })
        } catch (error) {
          queueUpdate(queueId, {
            status: 'error',
            error: error instanceof Error ? error.message : 'Casting clip failed',
            finishedAt: Date.now(),
          })
          throw error
        }
      })
    } catch (error) {
      toast({
        title: 'Could not generate casting clip',
        description: error instanceof Error ? error.message : undefined,
        tone: 'error',
      })
    } finally {
      setKeyframesBusy(false)
    }
  }

  const selectFrame = async (frameIndex: number) => {
    setSelectingFrame(frameIndex)
    try {
      await apiPost(`/stories/${storyId}/shots/${shot.id}/select-frame`, {
        frame_index: frameIndex,
      })
      setSelectedFrameIndex(frameIndex)
      await onChanged()
      void queryClient.invalidateQueries({ queryKey: queryKeys.history })
    } catch (error) {
      toast({
        title: 'Could not select frame',
        description: error instanceof Error ? error.message : undefined,
        tone: 'error',
      })
    } finally {
      setSelectingFrame(null)
    }
  }

  const generateClip = async () => {
    setGenerating(true)
    const queueId = uid('story-clip')
    queueAdd({
      id: queueId,
      label: `Shot clip ? Shot ${shot.shot_number}`,
      mode: 'video',
      status: 'queued',
      progress: 0,
      stage: 'queued',
      startedAt: Date.now(),
    })
    try {
      await runSerializedGeneration(async () => {
        queueUpdate(queueId, {
          status: 'running',
          progress: 8,
          stage: 'generating',
          startedAt: Date.now(),
        })
        try {
          const response = await apiPost<{
            shot: StoryShot
            result?: { success?: boolean; error?: string }
          }>(`/stories/${storyId}/shots/${shot.id}/generate`)
          await onChanged()
          void queryClient.invalidateQueries({ queryKey: queryKeys.history })
          if (response.result?.error) throw new Error(response.result.error)
          queueUpdate(queueId, {
            status: 'done',
            progress: 100,
            stage: 'clip ready',
            finishedAt: Date.now(),
          })
          toast({ title: 'Clip ready', tone: 'success' })
        } catch (error) {
          queueUpdate(queueId, {
            status: 'error',
            error: error instanceof Error ? error.message : 'Clip generation failed',
            finishedAt: Date.now(),
          })
          throw error
        }
      })
    } catch (error) {
      toast({
        title: 'Could not generate clip',
        description: error instanceof Error ? error.message : undefined,
        tone: 'error',
      })
    } finally {
      setGenerating(false)
    }
  }

  const remove = async () => {
    try {
      await apiDelete(`/stories/${storyId}/shots/${shot.id}`)
      await onChanged()
    } catch (error) {
      toast({
        title: 'Could not delete shot',
        description: error instanceof Error ? error.message : undefined,
        tone: 'error',
      })
    }
  }

  return (
    <div className="space-y-3 rounded-xl border border-line bg-white/[0.02] p-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge>Shot {shot.shot_number}</Badge>
        <Badge tone={statusTone[shot.status] ?? 'default'}>{shot.status.replace(/_/g, ' ')}</Badge>
        {shot.duration ? <Badge>{formatDuration(shot.duration)}</Badge> : null}
        {characterNames.length ? (
          <span className="text-[10px] text-text-3">{characterNames.join(', ')}</span>
        ) : null}
        <div className="ml-auto flex items-center gap-1">
          <Button variant="soft" size="sm" busy={saving} onClick={() => void save()}>
            Save shot
          </Button>
          <IconButton
            className="size-8 text-text-3 hover:text-danger"
            onClick={() => void remove()}
            aria-label="Delete shot"
          >
            <Trash2 className="size-3.5" />
          </IconButton>
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-[90px_1fr_1fr]">
        <label className="space-y-1">
          <span className="block text-[9px] uppercase tracking-wider text-text-3">Duration</span>
          <Input
            type="number"
            min={1}
            max={15}
            value={duration}
            onChange={(event) => setDuration(event.target.value)}
            className="h-8 text-xs"
          />
        </label>
        <label className="space-y-1">
          <span className="block text-[9px] uppercase tracking-wider text-text-3">Camera</span>
          <Input
            value={camera}
            onChange={(event) => setCamera(event.target.value)}
            placeholder="Camera movement / framing"
            className="h-8 text-xs"
          />
        </label>
        <label className="space-y-1">
          <span className="block text-[9px] uppercase tracking-wider text-text-3">Continuity</span>
          <Select
            value={continuity}
            onChange={(event) => setContinuity(event.target.value as StoryContinuityMode)}
          >
            {continuityOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
            {!continuityOptions.some((option) => option.value === continuity) ? (
              <option value={continuity}>{continuity.replace(/_/g, ' ')}</option>
            ) : null}
          </Select>
        </label>
      </div>

      <div className="grid gap-2 lg:grid-cols-3">
        <label className="space-y-1">
          <span className="block text-[9px] uppercase tracking-wider text-text-3">Action</span>
          <Textarea
            value={action}
            onChange={(event) => setAction(event.target.value)}
            placeholder="What happens in the shot"
            rows={3}
            className="text-xs"
          />
        </label>
        <label className="space-y-1">
          <span className="block text-[9px] uppercase tracking-wider text-text-3">Image prompt</span>
          <Textarea
            value={imagePrompt}
            onChange={(event) => setImagePrompt(event.target.value)}
            placeholder="Keyframe prompt"
            rows={3}
            className="text-xs"
          />
        </label>
        <label className="space-y-1">
          <span className="block text-[9px] uppercase tracking-wider text-text-3">Video prompt</span>
          <Textarea
            value={videoPrompt}
            onChange={(event) => setVideoPrompt(event.target.value)}
            placeholder="Clip prompt"
            rows={3}
            className="text-xs"
          />
        </label>
      </div>

      <div className="rounded-lg border border-line bg-black/20 p-2.5">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <ImageIcon className="size-3.5 text-text-3" />
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-text-3">
            Starting frame
          </p>
          <Button
            variant="outline"
            size="sm"
            busy={keyframesBusy}
            icon={<Sparkles className="size-3.5" />}
            onClick={() => void makeKeyframes()}
          >
            Generate 1s casting clip
          </Button>
          <span className="text-[10px] text-text-3">
            Uses this shot&apos;s reference images, then exposes 24 frames.
          </span>
        </div>

        {frames.length ? (
          <div className="grid grid-cols-6 gap-1.5">
            {frames.map((frame) => {
              const selected = selectedFrameIndex === frame.index
              return (
                <button
                  key={`${frame.index}-${frame.url}`}
                  type="button"
                  onClick={() => void selectFrame(frame.index)}
                  disabled={selectingFrame !== null}
                  className={cn(
                    'group relative aspect-video overflow-hidden rounded-md border bg-black transition',
                    selected
                      ? 'border-lime ring-1 ring-lime/50'
                      : 'border-line hover:border-line-strong',
                  )}
                  title={`Frame ${frame.index} ? ${frame.time.toFixed(2)}s`}
                >
                  <img
                    src={mediaUrl(frame.url)}
                    alt={`Frame ${frame.index}`}
                    loading="lazy"
                    className="size-full object-cover"
                  />
                  <span className="absolute bottom-0.5 right-0.5 rounded bg-black/65 px-1 text-[8px] text-white">
                    {frame.index}
                  </span>
                  {selected ? (
                    <span className="absolute left-0.5 top-0.5 rounded bg-lime px-1 text-[8px] font-semibold text-bg">
                      Start
                    </span>
                  ) : null}
                  {selectingFrame === frame.index ? (
                    <span className="absolute inset-0 grid place-items-center bg-black/60">
                      <Spinner className="text-white" />
                    </span>
                  ) : null}
                </button>
              )
            })}
          </div>
        ) : shot.selected_image_id && selectedAsset ? (
          <img
            src={mediaUrl(`/images/${selectedAsset.filename}`)}
            alt={assetDisplayName(selectedAsset)}
            className="aspect-video w-full max-w-xs rounded-lg border border-line object-cover"
          />
        ) : (
          <p className="text-[10px] text-text-3">
            No casting frames yet. Generate a 1s casting clip, or skip the starting frame
            and generate the shot from the shot&apos;s reference images.
          </p>
        )}
      </div>

      <div className="rounded-lg border border-line bg-black/20 p-2.5">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <Video className="size-3.5 text-text-3" />
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-text-3">Clip</p>
          <Button
            variant="outline"
            size="sm"
            busy={generating}
            icon={<Film className="size-3.5" />}
            onClick={() => void generateClip()}
          >
            {shot.selected_image_id ? 'Generate clip' : 'Generate from references'}
          </Button>
          {shot.status === 'generating' ? <Spinner /> : null}
        </div>
        {videoFilename ? (
          <video
            key={videoFilename}
            src={mediaUrl(`/videos/${videoFilename}`)}
            controls
            loop
            playsInline
            className="aspect-video w-full max-w-md rounded-lg border border-line bg-black object-contain"
          />
        ) : (
          <p className="text-[10px] text-text-3">
            {clipReady
              ? 'Clip is ready but no filename was returned.'
              : shot.selected_image_id
                ? 'No clip yet. Generate after approving a starting frame.'
                : 'No clip yet. Generate from the shot reference images, or choose a casting frame first.'}
          </p>
        )}
        {shot.error ? (
          <p className="mt-2 rounded-lg border border-danger/20 bg-danger-soft px-2 py-1.5 text-[10px] text-danger">
            {shot.error}
          </p>
        ) : null}
      </div>
    </div>
  )
}
