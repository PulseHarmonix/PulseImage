import { useEffect, useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Check, Image as ImageIcon, Loader2, Plus, Search, X } from 'lucide-react'
import { apiPost, mediaUrl } from '../../lib/api'
import { queryKeys, useHistory } from '../../lib/queries'
import { assetDisplayName } from '../../lib/assets'
import { assetType, cn } from '../../lib/utils'
import { useUiStore } from '../../stores/ui'
import { Badge, Button, Input, Textarea } from '../ui'
import type { Asset, CharacterProfile } from '../../types'

interface ProfileForm {
  name: string
  description: string
  appearance: string
  wardrobe: string
  aliases: string
  tags: string
  prompt: string
  negativePrompt: string
  references: string[]
}

const emptyForm: ProfileForm = {
  name: '',
  description: '',
  appearance: '',
  wardrobe: '',
  aliases: '',
  tags: '',
  prompt: '',
  negativePrompt: '',
  references: [],
}

function toForm(profile?: CharacterProfile): ProfileForm {
  if (!profile) return { ...emptyForm }
  return {
    name: profile.name ?? '',
    description: profile.description ?? '',
    appearance: profile.appearance ?? '',
    wardrobe: profile.wardrobe ?? '',
    aliases: profile.aliases ?? '',
    tags: Array.isArray(profile.tags) ? profile.tags.join(', ') : '',
    prompt: profile.prompt ?? '',
    negativePrompt: profile.negative_prompt ?? '',
    references: Array.isArray(profile.references) ? profile.references.filter(Boolean) : [],
  }
}

export function CharacterProfileEditor({ asset }: { asset: Asset }) {
  const history = useHistory()
  const queryClient = useQueryClient()
  const toast = useUiStore((s) => s.toast)
  const storedProfile = asset.metadata?.character_profile
  const profileKey = JSON.stringify(storedProfile ?? {})
  const [form, setForm] = useState<ProfileForm>(() => toForm(storedProfile))
  const [saving, setSaving] = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [pickerQuery, setPickerQuery] = useState('')

  useEffect(() => {
    setForm(toForm(storedProfile))
    // Reset drafts when switching assets or after the profile is saved.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [asset.id, profileKey])

  const images = useMemo(
    () => (history.data ?? []).filter((item) => assetType(item) === 'image'),
    [history.data],
  )
  const imageById = useMemo(() => new Map(images.map((item) => [item.id, item])), [images])
  const referenceImages = useMemo(
    () =>
      form.references
        .map((id) => imageById.get(id))
        .filter((item): item is Asset => Boolean(item)),
    [form.references, imageById],
  )
  const missingReferences = form.references.filter((id) => !imageById.has(id)).length

  const pickerResults = useMemo(() => {
    const search = pickerQuery.trim().toLowerCase()
    return images
      .filter((item) => item.id !== asset.id && !form.references.includes(item.id))
      .filter((item) => {
        if (!search) return true
        return `${assetDisplayName(item)} ${item.prompt || ''} ${item.filename}`
          .toLowerCase()
          .includes(search)
      })
      .slice(0, 48)
  }, [asset.id, form.references, images, pickerQuery])

  const set = <K extends keyof ProfileForm>(key: K, value: ProfileForm[K]) =>
    setForm((current) => ({ ...current, [key]: value }))

  const addReference = (id: string) => {
    setForm((current) => {
      if (current.references.includes(id) || current.references.length >= 5) return current
      return { ...current, references: [...current.references, id] }
    })
  }

  const removeReference = (id: string) => {
    setForm((current) => ({
      ...current,
      references: current.references.filter((item) => item !== id),
    }))
  }

  const save = async () => {
    setSaving(true)
    try {
      await apiPost(`/characters/${asset.id}`, {
        name: form.name.trim(),
        description: form.description.trim(),
        appearance: form.appearance.trim(),
        wardrobe: form.wardrobe.trim(),
        aliases: form.aliases.trim(),
        tags: form.tags
          .split(',')
          .map((tag) => tag.trim())
          .filter(Boolean),
        references: form.references,
        voice_asset_id: storedProfile?.voice_asset_id ?? '',
        prompt: form.prompt.trim(),
        negative_prompt: form.negativePrompt.trim(),
      })
      await queryClient.invalidateQueries({ queryKey: queryKeys.history })
      await queryClient.invalidateQueries({ queryKey: queryKeys.characters })
      toast({ title: 'Character profile saved', tone: 'success' })
    } catch (error) {
      toast({
        title: 'Could not save character profile',
        description: error instanceof Error ? error.message : undefined,
        tone: 'error',
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-3 rounded-xl border border-line bg-white/[0.02] p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-text-3">
          Character profile
        </p>
        <Badge tone="lime">{form.references.length}/5 refs</Badge>
      </div>

      <Input
        value={form.name}
        onChange={(event) => set('name', event.target.value)}
        placeholder="Character name"
      />
      <Textarea
        value={form.description}
        onChange={(event) => set('description', event.target.value)}
        placeholder="Short description"
        rows={2}
      />
      <Textarea
        value={form.appearance}
        onChange={(event) => set('appearance', event.target.value)}
        placeholder="Appearance"
        rows={2}
      />
      <Textarea
        value={form.wardrobe}
        onChange={(event) => set('wardrobe', event.target.value)}
        placeholder="Wardrobe"
        rows={2}
      />
      <Input
        value={form.aliases}
        onChange={(event) => set('aliases', event.target.value)}
        placeholder="Aliases (comma separated)"
      />
      <Input
        value={form.tags}
        onChange={(event) => set('tags', event.target.value)}
        placeholder="Tags (comma separated)"
      />
      <Textarea
        value={form.prompt}
        onChange={(event) => set('prompt', event.target.value)}
        placeholder="Character prompt"
        rows={3}
      />
      <Textarea
        value={form.negativePrompt}
        onChange={(event) => set('negativePrompt', event.target.value)}
        placeholder="Negative prompt"
        rows={2}
      />

      <div>
        <div className="mb-2 flex items-center justify-between gap-2">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-text-3">
            References
          </p>
          <Button
            size="sm"
            variant="outline"
            icon={<Plus className="size-3" />}
            onClick={() => setPickerOpen((open) => !open)}
            disabled={form.references.length >= 5 && !pickerOpen}
          >
            Add
          </Button>
        </div>

        {referenceImages.length || missingReferences ? (
          <div className="mb-2 grid grid-cols-5 gap-1.5">
            {referenceImages.map((image) => (
              <div
                key={image.id}
                className="group relative aspect-square overflow-hidden rounded-lg border border-line bg-black"
              >
                <img
                  src={mediaUrl(`/thumbnails/${image.id}.jpg`)}
                  alt={assetDisplayName(image)}
                  loading="lazy"
                  className="size-full object-cover"
                />
                <button
                  type="button"
                  onClick={() => removeReference(image.id)}
                  className="absolute right-0.5 top-0.5 grid size-4 place-items-center rounded bg-black/70 text-white opacity-0 transition group-hover:opacity-100"
                  aria-label="Remove reference"
                >
                  <X className="size-2.5" />
                </button>
              </div>
            ))}
            {missingReferences
              ? Array.from({ length: missingReferences }).map((_, index) => (
                  <div
                    key={`missing-${index}`}
                    className="grid aspect-square place-items-center rounded-lg border border-dashed border-line text-text-3"
                  >
                    <ImageIcon className="size-3" />
                  </div>
                ))
              : null}
          </div>
        ) : (
          <p className="mb-2 text-[10px] text-text-3">No reference images selected.</p>
        )}

        {pickerOpen ? (
          <div className="rounded-lg border border-line bg-black/20 p-2">
            <div className="relative mb-2">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3 -translate-y-1/2 text-text-3" />
              <Input
                value={pickerQuery}
                onChange={(event) => setPickerQuery(event.target.value)}
                placeholder="Search image history"
                className="h-8 pl-8 text-xs"
              />
            </div>
            {pickerResults.length ? (
              <div className="grid max-h-48 grid-cols-4 gap-1.5 overflow-y-auto pr-1">
                {pickerResults.map((image) => (
                  <button
                    key={image.id}
                    type="button"
                    onClick={() => addReference(image.id)}
                    disabled={form.references.length >= 5}
                    className={cn(
                      'aspect-square overflow-hidden rounded-lg border border-line bg-black transition hover:border-lime/50 disabled:opacity-40',
                      form.references.includes(image.id) && 'border-lime',
                    )}
                    title={assetDisplayName(image)}
                  >
                    <img
                      src={mediaUrl(`/thumbnails/${image.id}.jpg`)}
                      alt={assetDisplayName(image)}
                      loading="lazy"
                      className="size-full object-cover"
                    />
                  </button>
                ))}
              </div>
            ) : (
              <p className="py-3 text-center text-[10px] text-text-3">
                {images.length ? 'No matching images' : 'No image assets yet'}
              </p>
            )}
          </div>
        ) : null}
      </div>

      <Button
        variant="soft"
        size="sm"
        className="w-full"
        onClick={() => void save()}
        disabled={saving}
        icon={saving ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
      >
        Save profile
      </Button>
    </div>
  )
}
