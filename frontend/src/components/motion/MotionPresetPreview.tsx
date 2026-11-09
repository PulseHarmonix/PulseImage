import { useState } from 'react'
import { Camera } from 'lucide-react'
import { mediaUrl } from '../../lib/api'
import { motionPreviewPaths, type MotionPreset } from '../../lib/motionPresets'

export function MotionPresetPreview({ preset }: { preset: MotionPreset }) {
  const paths = motionPreviewPaths(preset.id)
  const posterSrc = mediaUrl(paths.poster)
  const videoSrc = mediaUrl(paths.video)
  const [posterError, setPosterError] = useState(false)
  const [videoError, setVideoError] = useState(false)

  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-lg border border-line bg-black/40">
      <div
        className="absolute inset-0"
        style={{
          background: `radial-gradient(circle at 30% 20%, hsl(${preset.hue} 55% 24%), transparent 60%), linear-gradient(135deg, hsl(${preset.hue} 60% 16%), hsl(${(preset.hue + 45) % 360} 55% 7%))`,
        }}
      />
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 px-2 text-center">
        <Camera className="size-4 text-white/60" strokeWidth={1.6} />
        <p className="truncate text-[10px] font-medium text-white/85">{preset.name}</p>
        <p className="text-[8px] uppercase tracking-[0.16em] text-white/40">
          Preview coming soon
        </p>
      </div>
      {!posterError ? (
        <img
          src={posterSrc}
          alt=""
          loading="lazy"
          onError={() => setPosterError(true)}
          className="absolute inset-0 size-full object-cover"
        />
      ) : null}
      {!videoError ? (
        <video
          key={videoSrc}
          src={videoSrc}
          poster={posterSrc}
          muted
          loop
          autoPlay
          playsInline
          preload="auto"
          onError={() => setVideoError(true)}
          className="absolute inset-0 size-full object-cover"
        />
      ) : null}
    </div>
  )
}
