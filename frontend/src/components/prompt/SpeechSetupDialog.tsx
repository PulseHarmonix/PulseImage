import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Mic2, Save } from 'lucide-react'
import { Button, Dialog, DialogContent, Input, Select, Textarea } from '../ui'
import { usePromptStore } from '../../stores/prompt'
import { useUiStore } from '../../stores/ui'
import { apiPost } from '../../lib/api'
import { queryKeys, useHistory, useTtsEngines, useUpdateSettings } from '../../lib/queries'
import { loadCustomPresets, saveCustomPreset, SPEECH_EMOTIONS, SPEECH_PRESETS, type SpeechPreset } from '../../lib/promptBuilders'
import type { Asset, SpeechConfig } from '../../types'

function voiceTranscript(asset?: Asset): string {
  const metadata = asset?.metadata
  if (!metadata || typeof metadata !== 'object') return ''
  const voice = (metadata as Record<string, unknown>).voice
  if (!voice || typeof voice !== 'object') return ''
  const transcript = (voice as { transcript?: unknown }).transcript
  return transcript == null ? '' : String(transcript)
}

function getSpeechPresets(): SpeechPreset[] {
  return [
    ...SPEECH_PRESETS,
    ...loadCustomPresets<SpeechPreset>('pulse_speech_presets').filter(
      (preset) => preset && preset.id && preset.name,
    ),
  ]
}

export function SpeechSetupDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const tab = usePromptStore((state) => state.tabs.find((item) => item.id === state.activeId) ?? state.tabs[0])
  const updateActive = usePromptStore((state) => state.updateActive)
  const toast = useUiStore((state) => state.toast)
  const enginesQuery = useTtsEngines()
  const history = useHistory()
  const updateSettings = useUpdateSettings()
  const queryClient = useQueryClient()
  const [presets, setPresets] = useState<SpeechPreset[]>(getSpeechPresets)
  const [spokenText, setSpokenText] = useState(tab.prompt)

  const engines = enginesQuery.data ?? []
  const engine = engines.find((item) => item.id === tab.speech.engine) ?? engines[0]
  const controls = engine?.controls ?? {}
  const canEmotion = controls.emotion !== false
  const canInstruction = controls.instruction !== false
  const canRefText = controls.ref_text !== false
  const canSeed = controls.seed !== false
  const languages = engine?.languages?.length ? engine.languages : ['English']
  const language = languages.includes(tab.speech.language)
    ? tab.speech.language
    : engine?.default_language || languages[0]
  const voices = (history.data ?? []).filter((asset) => asset.type === 'audio' && asset.voice)
  const selectedVoice = tab.attachments.find((attachment) => attachment.type === 'voice')
  const selectedAsset = selectedVoice?.id
    ? history.data?.find((asset) => String(asset.id) === String(selectedVoice.id))
    : undefined
  const transcript = tab.speech.ref_text || voiceTranscript(selectedAsset)

  const patchSpeech = (updates: Partial<SpeechConfig>) =>
    updateActive({ speech: { ...tab.speech, ...updates } })

  const changeEngine = (engineId: string) => {
    const nextEngine = engines.find((item) => item.id === engineId)
    const nextLanguages = nextEngine?.languages?.length ? nextEngine.languages : ['English']
    const nextLanguage = nextLanguages.includes(tab.speech.language)
      ? tab.speech.language
      : nextEngine?.default_language || nextLanguages[0]
    updateActive({ speech: { ...tab.speech, engine: engineId, language: nextLanguage } })
    void updateSettings({ tts_engine: engineId })
  }

  const selectVoice = (assetId: string) => {
    const attachments = tab.attachments.filter((attachment) => attachment.type !== 'voice')
    if (!assetId) {
      updateActive({ attachments, speech: { ...tab.speech, ref_text: '' } })
      return
    }
    const asset = voices.find((voice) => String(voice.id) === String(assetId))
    if (!asset) return
    updateActive({
      attachments: [
        ...attachments,
        {
          id: asset.id,
          name: asset.filename,
          type: 'voice',
          prompt: asset.prompt,
        },
      ],
      speech: { ...tab.speech, ref_text: voiceTranscript(asset) },
    })
  }

  const changePreset = (presetId: string) => {
    const preset = presets.find((item) => item.id === presetId)
    if (!preset) return
    patchSpeech({
      language: languages.includes(preset.language) ? preset.language : tab.speech.language,
      emotion: preset.emotion || 'neutral',
      instruction: preset.instruction || '',
      seed: Number(preset.seed) || 0,
    })
  }

  const savePreset = () => {
    const name = window.prompt('Preset name:', 'My speech preset')
    if (!name || !name.trim()) return
    saveCustomPreset('pulse_speech_presets', {
      id: `custom_${Date.now().toString(36)}`,
      name: name.trim(),
      language,
      emotion: tab.speech.emotion || 'neutral',
      instruction: tab.speech.instruction || '',
      seed: Number(tab.speech.seed) || 0,
    })
    setPresets(getSpeechPresets())
    toast({ title: 'Preset saved', tone: 'success' })
  }

  const saveTranscript = async () => {
    if (!selectedVoice?.id) return
    try {
      await apiPost(`/tts/voices/${selectedVoice.id}`, { transcript, language })
      patchSpeech({ ref_text: transcript })
      await queryClient.invalidateQueries({ queryKey: queryKeys.history })
      toast({ title: 'Transcript saved', tone: 'success' })
    } catch (error) {
      toast({
        title: 'Failed to save transcript',
        description: error instanceof Error ? error.message : 'Unknown error',
        tone: 'error',
      })
    }
  }

  const apply = () => {
    updateActive({ prompt: spokenText })
    onOpenChange(false)
    toast({ title: 'Speech settings applied', tone: 'success' })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title="Speech Setup"
        description="Voice, emotion, transcript, and spoken text for this tab."
        className="max-w-xl"
      >
        <div className="space-y-5">
          <section className="space-y-2">
            <h4 className="text-[10px] font-semibold uppercase tracking-[0.14em] text-text-3">Voice</h4>
            <div className="flex flex-wrap items-center gap-2">
              <span className="w-20 shrink-0 text-[11px] font-medium text-text-2">Engine</span>
              <Select
                value={tab.speech.engine}
                onChange={(event) => changeEngine(event.target.value)}
                className="min-w-[170px] flex-1"
              >
                {engines.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.label}
                    {item.installed === false ? ' (not installed)' : ''}
                  </option>
                ))}
              </Select>
            </div>
            {engine?.installed === false ? (
              <p className="rounded-lg border border-warning/20 bg-warning/10 px-3 py-2 text-[11px] text-warning">
                This engine is not installed yet. Install its node pack/model in ComfyUI before generating.
              </p>
            ) : null}
            <div className="flex flex-wrap items-center gap-2">
              <span className="w-20 shrink-0 text-[11px] font-medium text-text-2">Voice</span>
              <Select
                value={selectedVoice?.id || ''}
                onChange={(event) => selectVoice(event.target.value)}
                className="min-w-[170px] flex-1"
              >
                <option value="">No voice — drag one from Voices</option>
                {voices.map((voice) => (
                  <option key={voice.id} value={voice.id}>
                    {voice.prompt || voice.filename || voice.id}
                  </option>
                ))}
              </Select>
            </div>
            <p className="text-[10px] text-text-3">Or drag a voice from the Voices library into the prompt bar.</p>
            <div className="flex flex-wrap items-center gap-2">
              <span className="w-20 shrink-0 text-[11px] font-medium text-text-2">Language</span>
              <Select
                value={language}
                onChange={(event) => patchSpeech({ language: event.target.value })}
                className="min-w-[170px] flex-1"
              >
                {languages.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </Select>
            </div>
            {canEmotion ? (
              <div className="flex flex-wrap items-center gap-2">
                <span className="w-20 shrink-0 text-[11px] font-medium text-text-2">Emotion</span>
                <Select
                  value={tab.speech.emotion || 'neutral'}
                  onChange={(event) => patchSpeech({ emotion: event.target.value })}
                  className="min-w-[170px] flex-1"
                >
                  {SPEECH_EMOTIONS.map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </Select>
              </div>
            ) : null}
            {canInstruction ? (
              <Textarea
                value={tab.speech.instruction}
                onChange={(event) => patchSpeech({ instruction: event.target.value })}
                placeholder="Optional custom instruction — overrides the emotion preset"
                rows={2}
              />
            ) : null}
            {!canEmotion && !canInstruction ? (
              <p className="text-[11px] text-text-3">
                Emotion / Whisper instructions are not exposed by this engine&apos;s clone node. Install a Qwen3
                pack that supports “instruct”, or use another engine.
              </p>
            ) : null}
          </section>

          <section className="space-y-2">
            <h4 className="text-[10px] font-semibold uppercase tracking-[0.14em] text-text-3">Cloning</h4>
            {canRefText ? (
              <>
                <Textarea
                  value={transcript}
                  onChange={(event) => patchSpeech({ ref_text: event.target.value })}
                  placeholder="Transcript of the reference voice"
                  rows={2}
                />
                <p className="text-[10px] text-text-3">Transcript improves cloning; leave blank for x-vector mode.</p>
              </>
            ) : (
              <p className="text-[11px] text-text-3">
                This engine clones from the reference audio without a reference transcript.
              </p>
            )}
            <div className="flex flex-wrap items-center gap-2">
              {canSeed ? (
                <>
                  <span className="w-20 shrink-0 text-[11px] font-medium text-text-2">Seed</span>
                  <Input
                    type="number"
                    value={tab.speech.seed}
                    onChange={(event) => patchSpeech({ seed: Number(event.target.value) || 0 })}
                    className="h-8 min-w-[110px] flex-1"
                  />
                </>
              ) : null}
              {canRefText ? (
                <Button
                  size="sm"
                  variant="outline"
                  icon={<Save className="size-3" />}
                  onClick={() => void saveTranscript()}
                  disabled={!selectedVoice}
                  className="shrink-0"
                >
                  Save transcript
                </Button>
              ) : null}
            </div>
          </section>

          <section className="space-y-2">
            <h4 className="text-[10px] font-semibold uppercase tracking-[0.14em] text-text-3">Spoken text</h4>
            <Textarea
              value={spokenText}
              onChange={(event) => setSpokenText(event.target.value)}
              placeholder="Type what the voice should say…"
              rows={3}
            />
          </section>

          {canEmotion || canInstruction ? (
            <section className="space-y-2">
              <h4 className="text-[10px] font-semibold uppercase tracking-[0.14em] text-text-3">Preset</h4>
              <div className="flex gap-2">
                <Select value="" onChange={(event) => changePreset(event.target.value)}>
                  <option value="">Choose preset…</option>
                  {presets.map((preset) => (
                    <option key={preset.id} value={preset.id}>
                      {preset.name}
                    </option>
                  ))}
                </Select>
                <Button size="sm" variant="outline" onClick={savePreset} className="shrink-0">
                  Save preset
                </Button>
              </div>
            </section>
          ) : null}

          <div className="flex items-center justify-between gap-2 border-t border-line pt-3">
            <Button size="sm" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button size="sm" variant="primary" icon={<Mic2 className="size-3.5" />} onClick={apply}>
              Apply
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
