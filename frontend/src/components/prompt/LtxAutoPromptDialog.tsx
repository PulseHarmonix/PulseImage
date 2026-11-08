import { useEffect, useState } from 'react'
import { Plus, RefreshCw, WandSparkles, X } from 'lucide-react'
import { Button, Dialog, DialogContent, Input, Select, Textarea } from '../ui'
import { usePromptStore } from '../../stores/prompt'
import { useUiStore } from '../../stores/ui'
import {
  buildLtxAutoPrompt,
  getLtxPresets,
  initLtxStateFromAttachments,
  LTX_CAMERAS,
  LTX_SHOT_TYPES,
  saveCustomPreset,
  type LtxPreset,
} from '../../lib/promptBuilders'
import type { LtxAudioType, LtxDialogueLine, LtxPromptState } from '../../types'

export function LtxAutoPromptDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const tab = usePromptStore((state) => state.tabs.find((item) => item.id === state.activeId) ?? state.tabs[0])
  const updateActive = usePromptStore((state) => state.updateActive)
  const toast = useUiStore((state) => state.toast)
  const [presets, setPresets] = useState<LtxPreset[]>(getLtxPresets)

  const images = tab.attachments.filter((attachment) => attachment.type === 'image')
  const audios = tab.attachments.filter((attachment) => attachment.type === 'audio')
  const hasImage = images.length > 0
  const hasAudio = audios.length > 0
  const ltx = tab.ltx ?? initLtxStateFromAttachments(tab)
  const preview = buildLtxAutoPrompt({ ...tab, ltx })
  const dialogue = ltx.dialogue.length
    ? ltx.dialogue
    : [{ speaker: 'subject' as const, language: 'English', text: '' }]

  useEffect(() => {
    if (open && !tab.ltx) updateActive({ ltx: initLtxStateFromAttachments(tab) })
  }, [open, tab, updateActive])

  const patch = (updates: Partial<LtxPromptState>) => updateActive({ ltx: { ...ltx, ...updates } })

  const setDialogue = (index: number, updates: Partial<LtxDialogueLine>) => {
    const next = dialogue.map((line) => ({ ...line }))
    next[index] = { ...next[index], ...updates }
    patch({ dialogue: next })
  }

  const changePreset = (value: string) => {
    const preset = presets.find((item) => item.id === value)
    const next: LtxPromptState = { ...ltx, preset: value }
    if (preset && preset.id !== 'none' && preset.fields) Object.assign(next, preset.fields)
    patch(next)
  }

  const savePreset = () => {
    const name = window.prompt('Preset name:', 'My LTX preset')
    if (!name || !name.trim()) return
    saveCustomPreset('pulse_ltx_presets', {
      id: `custom_${Date.now().toString(36)}`,
      name: name.trim(),
      fields: {
        shotType: ltx.shotType,
        action: ltx.action,
        setting: ltx.setting,
        camera: ltx.camera,
        lighting: ltx.lighting,
        style: ltx.style,
        audioType: ltx.audioType,
        audioDescription: ltx.audioDescription,
        hasSpeech: ltx.hasSpeech,
      },
    })
    setPresets(getLtxPresets())
    toast({ title: 'Preset saved', tone: 'success' })
  }

  const applyPrompt = () => {
    const next: LtxPromptState = { ...ltx, enabled: true }
    updateActive({ ltx: next, prompt: buildLtxAutoPrompt({ ...tab, ltx: next }) })
    toast({ title: 'LTX auto prompt applied', tone: 'success' })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title="LTX Auto Prompt"
        description={
          hasImage
            ? 'Image attached: the image defines appearance — focus on motion, camera and audio.'
            : 'Text-to-video: describe subject, action, setting, camera, lighting and audio.'
        }
        className="max-w-2xl"
      >
        <div className="space-y-5">
          <section className="space-y-2">
            <h4 className="text-[10px] font-semibold uppercase tracking-[0.14em] text-text-3">Preset</h4>
            <div className="flex gap-2">
              <Select value={ltx.preset} onChange={(event) => changePreset(event.target.value)}>
                {presets.map((preset) => (
                  <option key={preset.id} value={preset.id}>
                    {preset.name}
                  </option>
                ))}
              </Select>
              <Button size="sm" variant="outline" onClick={savePreset} className="shrink-0">
                Save as preset
              </Button>
            </div>
          </section>

          <section className="space-y-2">
            <h4 className="text-[10px] font-semibold uppercase tracking-[0.14em] text-text-3">Shot</h4>
            <div className="flex flex-wrap items-center gap-2">
              <span className="w-16 shrink-0 text-[11px] font-medium text-text-2">Shot</span>
              <Select
                value={ltx.shotType}
                onChange={(event) => patch({ shotType: event.target.value })}
                className="min-w-[170px] flex-1"
              >
                {LTX_SHOT_TYPES.map((shot) => (
                  <option key={shot} value={shot}>
                    {shot}
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="w-16 shrink-0 text-[11px] font-medium text-text-2">Subject</span>
              <Input
                value={ltx.subject}
                onChange={(event) => patch({ subject: event.target.value })}
                placeholder={hasImage ? 'Brief identifier (the image defines appearance)' : 'Describe the subject'}
                className="h-8 flex-1"
              />
            </div>
            <div className="flex items-start gap-2">
              <span className="w-16 shrink-0 pt-1.5 text-[11px] font-medium text-text-2">Action</span>
              <Textarea
                value={ltx.action}
                onChange={(event) => patch({ action: event.target.value })}
                placeholder="What happens / how the subject moves…"
                rows={2}
                className="flex-1"
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="w-16 shrink-0 text-[11px] font-medium text-text-2">Setting</span>
              <Input
                value={ltx.setting}
                onChange={(event) => patch({ setting: event.target.value })}
                placeholder="Where the scene takes place"
                className="h-8 flex-1"
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="w-16 shrink-0 text-[11px] font-medium text-text-2">Camera</span>
              <Select
                value={ltx.camera}
                onChange={(event) => patch({ camera: event.target.value })}
                className="min-w-[170px] flex-1"
              >
                {LTX_CAMERAS.map((camera) => (
                  <option key={camera} value={camera}>
                    {camera}
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="w-16 shrink-0 text-[11px] font-medium text-text-2">Lighting</span>
              <Input
                value={ltx.lighting}
                onChange={(event) => patch({ lighting: event.target.value })}
                placeholder="e.g. golden hour, neon, soft studio light"
                className="h-8 flex-1"
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="w-16 shrink-0 text-[11px] font-medium text-text-2">Style</span>
              <Input
                value={ltx.style}
                onChange={(event) => patch({ style: event.target.value })}
                placeholder="e.g. cinematic, film grain, commercial"
                className="h-8 flex-1"
              />
            </div>
          </section>

          <section className="space-y-2">
            <h4 className="text-[10px] font-semibold uppercase tracking-[0.14em] text-text-3">Audio</h4>
            {hasAudio ? (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="w-16 shrink-0 text-[11px] font-medium text-text-2">Type</span>
                  <Select
                    value={ltx.audioType}
                    onChange={(event) => {
                      const audioType = event.target.value as LtxAudioType
                      patch({ audioType, hasSpeech: audioType === 'speech' ? true : ltx.hasSpeech })
                    }}
                    className="min-w-[150px] flex-1"
                  >
                    <option value="none">None</option>
                    <option value="ambient">Ambient / SFX</option>
                    <option value="music">Music</option>
                    <option value="speech">Speech / Voice</option>
                  </Select>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="w-16 shrink-0 text-[11px] font-medium text-text-2">Audio</span>
                  <Input
                    value={ltx.audioDescription}
                    onChange={(event) => patch({ audioDescription: event.target.value })}
                    placeholder="Describe the audio (music style, ambience, etc.)"
                    className="h-8 flex-1"
                  />
                </div>
              </>
            ) : (
              <p className="text-[11px] text-text-3">Attach audio to the prompt bar to describe it here.</p>
            )}
            <label className="flex items-center gap-2 text-[11px] text-text-2">
              <input
                type="checkbox"
                checked={ltx.hasSpeech}
                onChange={(event) => patch({ hasSpeech: event.target.checked })}
                className="size-3.5 accent-lime"
              />
              This video has dialogue / speech
            </label>
          </section>

          {ltx.hasSpeech || ltx.audioType === 'speech' ? (
            <section className="space-y-2">
              <h4 className="text-[10px] font-semibold uppercase tracking-[0.14em] text-text-3">Dialogue</h4>
              <div className="space-y-2">
                {dialogue.map((line, index) => (
                  <div key={index} className="flex flex-wrap items-center gap-2">
                    <Select
                      value={line.speaker}
                      onChange={(event) =>
                        setDialogue(index, { speaker: event.target.value as LtxDialogueLine['speaker'] })
                      }
                      className="w-auto min-w-[110px]"
                    >
                      <option value="subject">The subject</option>
                      <option value="A voice">A voice</option>
                    </Select>
                    <Input
                      value={line.language}
                      onChange={(event) => setDialogue(index, { language: event.target.value })}
                      placeholder="Language"
                      className="h-8 w-[86px]"
                    />
                    <Input
                      value={line.text}
                      onChange={(event) => setDialogue(index, { text: event.target.value })}
                      placeholder="Dialogue line"
                      className="h-8 min-w-[140px] flex-1"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const next = dialogue.filter((_, lineIndex) => lineIndex !== index)
                        patch({
                          dialogue: next.length
                            ? next
                            : [{ speaker: 'subject', language: 'English', text: '' }],
                        })
                      }}
                      className="rounded-lg p-1.5 text-text-3 transition hover:bg-white/[0.06] hover:text-danger"
                      aria-label="Remove dialogue line"
                    >
                      <X className="size-3.5" />
                    </button>
                  </div>
                ))}
              </div>
              <Button
                size="sm"
                variant="ghost"
                icon={<Plus className="size-3" />}
                onClick={() =>
                  patch({
                    dialogue: [...dialogue, { speaker: 'subject', language: 'English', text: '' }],
                  })
                }
              >
                Add line
              </Button>
            </section>
          ) : null}

          <section className="space-y-2">
            <h4 className="text-[10px] font-semibold uppercase tracking-[0.14em] text-text-3">Prompt preview</h4>
            <Textarea
              readOnly
              value={preview}
              rows={8}
              className="font-mono text-[11px] leading-5"
            />
          </section>

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3">
            <Button
              size="sm"
              variant="ghost"
              icon={<RefreshCw className="size-3" />}
              onClick={() => updateActive({ ltx: initLtxStateFromAttachments(tab) })}
            >
              Refresh attachments
            </Button>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="ghost" onClick={() => onOpenChange(false)}>
                Close
              </Button>
              <Button size="sm" variant="primary" icon={<WandSparkles className="size-3.5" />} onClick={applyPrompt}>
                Use Prompt
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
