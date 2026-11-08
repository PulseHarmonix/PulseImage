import { Link } from 'react-router-dom'
import {
  ArrowRight,
  AudioLines,
  Image as ImageIcon,
  Sparkles,
  Video,
} from 'lucide-react'
import { useHistory } from '../lib/queries'
import { MediaGrid } from '../components/media/MediaGrid'
import { PageHeader } from '../components/shell/PageHeader'
import { Badge, Button, EmptyState } from '../components/ui'
import { usePromptStore } from '../stores/prompt'
import { useUiStore } from '../stores/ui'
import { assetType } from '../lib/utils'
import { isStemAsset } from '../lib/stems'

export function StudioPage() {
  const history = useHistory()
  const setMode = usePromptStore((s) => s.setMode)
  const setComposerOpen = useUiStore((s) => s.setComposerOpen)
  const openComposer = (mode: 'image' | 'video' | 'speech') => {
    setMode(mode)
    setComposerOpen(true)
  }
  const assets = history.data ?? []
  const recent = assets.filter((asset) => !isStemAsset(asset)).slice(0, 12)
  const counts = {
    images: assets.filter((asset) => assetType(asset) === 'image').length,
    videos: assets.filter((asset) => assetType(asset) === 'video').length,
    audio: assets.filter((asset) => assetType(asset) === 'audio').length,
  }

  return (
    <div className="mx-auto w-full max-w-[1700px] px-4 pb-10 pt-16 md:px-8 md:pt-8">
      <PageHeader
        eyebrow="Local generative studio"
        title="Make something impossible."
        description="Image, video, speech, and music video generation in one private workspace."
        actions={
          <Button variant="outline" onClick={() => openComposer('video')}>
            <Video className="size-4" />
            New video
          </Button>
        }
      />

      {!history.isLoading && !assets.length ? (
        <div className="mt-10">
          <div className="relative overflow-hidden rounded-3xl border border-line bg-[radial-gradient(circle_at_20%_10%,rgba(215,255,63,0.12),transparent_35%),radial-gradient(circle_at_80%_30%,rgba(255,255,255,0.05),transparent_30%),#0d0e0f] p-8 md:p-12">
            <div className="pointer-events-none absolute -right-24 -top-24 size-72 rounded-full bg-lime/10 blur-3xl" />
            <div className="max-w-2xl">
              <Badge tone="lime">
                <Sparkles className="size-2.5" /> Prompt-first
              </Badge>
              <h2 className="mt-4 max-w-xl text-balance font-display text-4xl font-semibold tracking-[-0.04em] text-text md:text-5xl">
                Start with a thought. Leave with a film.
              </h2>
              <p className="mt-3 max-w-lg text-sm leading-6 text-text-2">
                Use the composer below to create images, clips, and voices. Attach references,
                choose a model, and keep everything in your local library.
              </p>
              <div className="mt-6 flex flex-wrap gap-2">
                <Button variant="primary" onClick={() => openComposer('image')}>
                  <ImageIcon className="size-4" /> Create image
                </Button>
                <Button variant="outline" onClick={() => openComposer('video')}>
                  <Video className="size-4" /> Create video
                </Button>
                <Button variant="ghost" onClick={() => openComposer('speech')}>
                  <AudioLines className="size-4" /> Generate speech
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <>
          <div className="mt-8 grid grid-cols-2 gap-2 md:grid-cols-4">
            <Stat label="All generations" value={assets.length} icon={<Sparkles className="size-3.5" />} />
            <Stat label="Images" value={counts.images} icon={<ImageIcon className="size-3.5" />} />
            <Stat label="Videos" value={counts.videos} icon={<Video className="size-3.5" />} />
            <Stat label="Audio" value={counts.audio} icon={<AudioLines className="size-3.5" />} />
          </div>

          <section className="mt-10">
            <div className="mb-3 flex items-center justify-between gap-4">
              <div>
                <h2 className="font-display text-lg font-semibold tracking-tight">Recent work</h2>
                <p className="text-[11px] text-text-3">Your latest generations across every mode.</p>
              </div>
              <Link
                to="/library"
                className="flex items-center gap-1 text-[11px] font-medium text-text-2 transition hover:text-lime"
              >
                Open library <ArrowRight className="size-3" />
              </Link>
            </div>
            <MediaGrid assets={recent} loading={history.isLoading} />
          </section>

          {!recent.length ? (
            <div className="mt-8">
              <EmptyState
                icon={<Sparkles className="size-6" />}
                title="Your first generation is waiting"
                description="Describe something in the composer below, or attach a reference image to guide it."
                action={
                  <Button variant="soft" onClick={() => openComposer('image')}>
                    Start creating
                  </Button>
                }
              />
            </div>
          ) : null}
        </>
      )}
    </div>
  )
}

function Stat({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-line bg-white/[0.02] px-3 py-3">
      <div className="flex items-center gap-1.5 text-text-3">
        {icon}
        <span className="text-[9px] uppercase tracking-[0.14em]">{label}</span>
      </div>
      <p className="mt-1 font-display text-xl font-semibold tabular-nums text-text">
        {value.toLocaleString()}
      </p>
    </div>
  )
}
