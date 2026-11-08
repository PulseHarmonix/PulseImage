import { useEffect, useState } from 'react'
import { Plus, RefreshCw, WandSparkles, X } from 'lucide-react'
import { Button, Dialog, DialogContent, Input, Select, Textarea } from '../ui'
import { usePromptStore } from '../../stores/prompt'
import { useUiStore } from '../../stores/ui'
import {
  buildH3AutoPrompt,
  getH3Presets,
  initH3StateFromAttachments,
  saveCustomPreset,
  type H3Preset,
} from '../../lib/promptBuilders'
import type { H3Audio, H3AudioType, H3PromptState, H3Subject, H3SubjectRetention } from '../../types'

const EMPTY_SUBJECT: H3Subject = {
  description: '',
  details: '',
  retention: 'fully_preserved',
}

function emptyAudio(): H3Audio {
  return {
    type: 'speech',
    subjectIndex: 0,
    retention: 'reference',
    language: 'English',
    description: '',
  }
}

export function H3AutoPromptDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const tab = usePromptStore((state) => state.tabs.find((item) => item.id === state.activeId) ?? state.tabs[0])
  const updateActive = usePromptStore((state) => state.updateActive)
  const toast = useUiStore((state) => state.toast)
  const [presets, setPresets] = useState<H3Preset[]>(getH3Presets)

  const images = tab.attachments.filter((attachment) => attachment.type === 'image')
  const audios = tab.attachments.filter((attachment) => attachment.type === 'audio')
  const h3 = tab.h3 ?? initH3StateFromAttachments(tab)
  const preview = buildH3AutoPrompt({ ...tab, h3 })

  useEffect(() => {
    if (open && !tab.h3) updateActive({ h3: initH3StateFromAttachments(tab) })
  }, [open, tab, updateActive])

  const patch = (updates: Partial<H3PromptState>) => updateActive({ h3: { ...h3, ...updates } })

  const subjects = images.map((_, index) => h3.subjects[index] ?? EMPTY_SUBJECT)
  const audioDefs = audios.map((_, index) => h3.audios[index] ?? emptyAudio())
  const dialogue = h3.dialogue.length ? h3.dialogue : [{ speaker: 1, language: 'English', text: '' }]

  const setSubject = (index: number, updates: Partial<H3Subject>) => {
    const next = subjects.map((subject) => ({ ...subject }))
    next[index] = { ...next[index], ...updates }
    patch({ subjects: next })
  }

  const setAudio = (index: number, updates: Partial<H3Audio>) => {
    const next = audioDefs.map((audio) => ({ ...audio }))
    next[index] = { ...next[index], ...updates }
    patch({ audios: next })
  }

  const setDialogue = (index: number, updates: Partial<H3PromptState['dialogue'][number]>) => {
    const next = dialogue.map((line) => ({ ...line }))
    next[index] = { ...next[index], ...updates }
    patch({ dialogue: next })
  }

  const changePreset = (value: string) => {
    const preset = presets.find((item) => item.id === value)
    const next: H3PromptState = { ...h3, preset: value }
    if (preset && preset.id !== 'none') {
      next.scene = preset.scene || ''
      next.hasSpeech = Boolean(preset.hasSpeech)
    }
    patch(next)
  }

  const savePreset = () => {
    const name = window.prompt('Preset name:', 'My preset')
    if (!name || !name.trim()) return
    saveCustomPreset('pulse_h3_presets', {
      id: `custom_${Date.now().toString(36)}`,
      name: name.trim(),
      scene: h3.scene || '',
      hasSpeech: Boolean(h3.hasSpeech),
    })
    setPresets(getH3Presets())
    toast({ title: 'Preset saved', tone: 'success' })
  }

  const applyPrompt = () => {
    const next: H3PromptState = { ...h3, enabled: true }
    updateActive({ h3: next, prompt: buildH3AutoPrompt({ ...tab, h3: next }) })
    toast({ title: 'H3 auto prompt applied', tone: 'success' })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title="FastH3 Auto Prompt"
        description="Presets fill the scene and speech setting; everything stays editable."
        className="max-w-2xl"
      >
        <div className="space-y-5">
          <section className="space-y-2">
            <h4 className="text-[10px] font-semibold uppercase tracking-[0.14em] text-text-3">Preset</h4>
            <div className="flex gap-2">
              <Select value={h3.preset} onChange={(event) => changePreset(event.target.value)}>
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
            <h4 className="text-[10px] font-semibold uppercase tracking-[0.14em] text-text-3">Scene</h4>
            <Textarea
              value={h3.scene}
              onChange={(event) => patch({ scene: event.target.value })}
              placeholder="Describe the scene, action and camera style…"
              rows={3}
            />
            <label className="flex items-center gap-2 text-[11px] text-text-2">
              <input
                type="checkbox"
                checked={h3.hasSpeech}
                onChange={(event) => patch({ hasSpeech: event.target.checked })}
                className="size-3.5 accent-lime"
              />
              This video has dialogue / speech
            </label>
          </section>

          <section className="space-y-2">
            <h4 className="text-[10px] font-semibold uppercase tracking-[0.14em] text-text-3">
              Subjects ({images.length})
            </h4>
            {images.length ? (
              <div className="space-y-3">
                {images.map((image, index) => {
                  const subject = subjects[index]
                  const label = image.prompt || image.name || `Image ${index + 1}`
                  return (
                    <div key={`${image.name}-${index}`} className="rounded-xl border border-line bg-white/[0.02] p-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="w-16 shrink-0 text-[11px] font-medium text-text-2">Subject {index + 1}</span>
                        <Input
                          value={subject.description}
                          onChange={(event) => setSubject(index, { description: event.target.value })}
                          placeholder="Describe this subject"
                          className="h-8 min-w-[160px] flex-1"
                        />
                        <Select
                          value={subject.retention}
                          onChange={(event) =>
                            setSubject(index, { retention: event.target.value as H3SubjectRetention })
                          }
                          className="w-auto min-w-[150px]"
                        >
                          <option value="fully_preserved">fully_preserved</option>
                          <option value="partially_preserved">partially_preserved</option>
                          <option value="reference">reference</option>
                        </Select>
                      </div>
                      <div className="mt-2 flex items-center gap-2">
                        <span className="w-16 shrink-0" />
                        <Input
                          value={subject.details}
                          onChange={(event) => setSubject(index, { details: event.target.value })}
                          placeholder="Face, hair, clothing details (recommended for identity)"
                          className="h-8 flex-1"
                        />
                        <span className="max-w-[90px] truncate text-[10px] text-text-3" title={label}>
                          {label}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <p className="text-[11px] text-text-3">Attach images to the prompt bar to add subjects.</p>
            )}
          </section>

          <section className="space-y-2">
            <h4 className="text-[10px] font-semibold uppercase tracking-[0.14em] text-text-3">
              Audio ({audios.length})
            </h4>
            {audios.length ? (
              <div className="space-y-2">
                {audios.map((audioAttachment, index) => {
                  const audio = audioDefs[index]
                  const isSpeech = audio.type === 'speech'
                  return (
                    <div key={`${audioAttachment.name}-${index}`} className="rounded-xl border border-line bg-white/[0.02] p-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="w-16 shrink-0 text-[11px] font-medium text-text-2">Audio {index + 1}</span>
                        <Select
                          value={audio.type}
                          onChange={(event) => {
                            const type = event.target.value as H3AudioType
                            setAudio(index, {
                              type,
                              retention: type === 'speech' ? 'reference' : 'fully_copy',
                            })
                          }}
                          className="w-auto min-w-[130px]"
                        >
                          <option value="speech">Speech / Voice</option>
                          <option value="music">Music</option>
                          <option value="ambient">Ambient / SFX</option>
                        </Select>
                        {isSpeech && images.length ? (
                          <Select
                            value={String(audio.subjectIndex)}
                            onChange={(event) => setAudio(index, { subjectIndex: Number(event.target.value) })}
                            className="w-auto min-w-[110px]"
                          >
                            {images.map((_, subjectIndex) => (
                              <option key={subjectIndex} value={subjectIndex}>
                                Subject {subjectIndex + 1}
                              </option>
                            ))}
                          </Select>
                        ) : null}
                        {isSpeech ? (
                          <Input
                            value={audio.language}
                            onChange={(event) => setAudio(index, { language: event.target.value })}
                            placeholder="Language"
                            className="h-8 w-[86px]"
                          />
                        ) : null}
                        <Select
                          value={audio.retention}
                          onChange={(event) =>
                            setAudio(index, { retention: event.target.value as H3Audio['retention'] })
                          }
                          className="w-auto min-w-[130px]"
                        >
                          {isSpeech ? (
                            <>
                              <option value="reference">reference (voice timbre)</option>
                              <option value="fully_copy">fully_copy (reuse 1:1)</option>
                            </>
                          ) : (
                            <>
                              <option value="fully_copy">fully_copy</option>
                              <option value="reference">reference</option>
                            </>
                          )}
                        </Select>
                        <span className="max-w-[90px] truncate text-[10px] text-text-3" title={audioAttachment.name}>
                          {audioAttachment.name}
                        </span>
                      </div>
                      {!isSpeech ? (
                        <div className="mt-2 flex items-center gap-2">
                          <span className="w-16 shrink-0" />
                          <Input
                            value={audio.description}
                            onChange={(event) => setAudio(index, { description: event.target.value })}
                            placeholder="Music/ambient description (optional)"
                            className="h-8 flex-1"
                          />
                        </div>
                      ) : null}
                    </div>
                  )
                })}
              </div>
            ) : (
              <p className="text-[11px] text-text-3">Attach audio to the prompt bar to add audio references.</p>
            )}
          </section>

          {h3.hasSpeech ? (
            <section className="space-y-2">
              <h4 className="text-[10px] font-semibold uppercase tracking-[0.14em] text-text-3">Dialogue</h4>
              <div className="space-y-2">
                {dialogue.map((line, index) => (
                  <div key={index} className="flex flex-wrap items-center gap-2">
                    <Select
                      value={String(line.speaker)}
                      onChange={(event) => setDialogue(index, { speaker: Number(event.target.value) })}
                      className="w-auto min-w-[120px]"
                    >
                      <option value="0">Voice</option>
                      {images.map((_, subjectIndex) => (
                        <option key={subjectIndex} value={subjectIndex + 1}>
                          Subject {subjectIndex + 1} (S{subjectIndex + 1})
                        </option>
                      ))}
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
                            : [{ speaker: 1, language: 'English', text: '' }],
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
                onClick={() => patch({ dialogue: [...dialogue, { speaker: 1, language: 'English', text: '' }] })}
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
              rows={10}
              className="font-mono text-[11px] leading-5"
            />
          </section>

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3">
            <Button
              size="sm"
              variant="ghost"
              icon={<RefreshCw className="size-3" />}
              onClick={() => updateActive({ h3: initH3StateFromAttachments(tab) })}
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
