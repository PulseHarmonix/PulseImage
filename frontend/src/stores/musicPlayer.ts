import { create } from 'zustand'
import { mediaUrl } from '../lib/api'
import type { MusicTrack } from '../lib/musicTracks'

export interface MusicPlayerState {
  track: MusicTrack | null
  queue: MusicTrack[]
  index: number
  playing: boolean
  currentTime: number
  duration: number
  volume: number
  muted: boolean
  expanded: boolean
  visible: boolean
  playTrack: (track: MusicTrack, queue?: MusicTrack[]) => void
  toggle: () => void
  next: () => void
  previous: () => void
  seek: (seconds: number) => void
  setVolume: (volume: number) => void
  toggleMute: () => void
  setExpanded: (expanded: boolean) => void
  stop: () => void
}

let audioElement: HTMLAudioElement | null = null
let listenersBound = false

function ensureAudio(): HTMLAudioElement | null {
  if (typeof window === 'undefined' || typeof Audio === 'undefined') return null
  if (!audioElement) {
    audioElement = new Audio()
    audioElement.preload = 'metadata'
    audioElement.volume = useMusicPlayerStore.getState().volume
    audioElement.muted = useMusicPlayerStore.getState().muted
  }
  if (!listenersBound) {
    listenersBound = true
    const element = audioElement
    element.addEventListener('timeupdate', () => {
      useMusicPlayerStore.setState({ currentTime: element.currentTime })
    })
    element.addEventListener('loadedmetadata', () => {
      useMusicPlayerStore.setState({
        duration: Number.isFinite(element.duration) ? element.duration : 0,
      })
    })
    element.addEventListener('durationchange', () => {
      useMusicPlayerStore.setState({
        duration: Number.isFinite(element.duration) ? element.duration : 0,
      })
    })
    element.addEventListener('play', () => {
      useMusicPlayerStore.setState({ playing: true })
    })
    element.addEventListener('pause', () => {
      useMusicPlayerStore.setState({ playing: false })
    })
    element.addEventListener('ended', () => {
      useMusicPlayerStore.getState().next()
    })
  }
  return audioElement
}

export const useMusicPlayerStore = create<MusicPlayerState>()((set, get) => ({
  track: null,
  queue: [],
  index: 0,
  playing: false,
  currentTime: 0,
  duration: 0,
  volume: 0.8,
  muted: false,
  expanded: true,
  visible: false,

  playTrack: (track, queue) => {
    const state = get()
    const existing = state.queue.some((item) => item.id === track.id) ? state.queue : null
    let nextQueue = queue && queue.length ? [...queue] : existing ?? [track]
    let index = nextQueue.findIndex((item) => item.id === track.id)
    if (index < 0) {
      nextQueue = [...nextQueue, track]
      index = nextQueue.length - 1
    }

    const element = ensureAudio()
    if (element) {
      element.src = mediaUrl(`/audio/${track.filename}`)
      element.currentTime = 0
      element.volume = state.volume
      element.muted = state.muted
      void element.play().catch(() => {
        useMusicPlayerStore.setState({ playing: false })
      })
    }

    set({
      track,
      queue: nextQueue,
      index,
      currentTime: 0,
      duration: track.duration ?? 0,
      visible: true,
    })
  },

  toggle: () => {
    const element = ensureAudio()
    if (!element) return
    if (element.paused) {
      void element.play().catch(() => {
        useMusicPlayerStore.setState({ playing: false })
      })
    } else {
      element.pause()
    }
  },

  next: () => {
    const { queue, index } = get()
    if (!queue.length) return
    if (queue.length === 1) {
      get().playTrack(queue[0], queue)
      return
    }
    const nextIndex = (index + 1) % queue.length
    get().playTrack(queue[nextIndex], queue)
  },

  previous: () => {
    const { queue, index } = get()
    if (!queue.length) return
    if (queue.length === 1) {
      get().playTrack(queue[0], queue)
      return
    }
    const previousIndex = (index - 1 + queue.length) % queue.length
    get().playTrack(queue[previousIndex], queue)
  },

  seek: (seconds) => {
    const element = ensureAudio()
    const duration = get().duration
    const target = Math.max(0, duration > 0 ? Math.min(seconds, duration) : seconds)
    if (element) element.currentTime = target
    set({ currentTime: target })
  },

  setVolume: (volume) => {
    const next = Math.min(1, Math.max(0, volume))
    const element = ensureAudio()
    if (element) {
      element.volume = next
      element.muted = get().muted
    }
    set({ volume: next })
  },

  toggleMute: () => {
    const muted = !get().muted
    const element = ensureAudio()
    if (element) element.muted = muted
    set({ muted })
  },

  setExpanded: (expanded) => set({ expanded }),

  stop: () => {
    const element = ensureAudio()
    if (element) {
      element.pause()
      element.removeAttribute('src')
      element.load()
    }
    set({
      track: null,
      queue: [],
      index: 0,
      playing: false,
      currentTime: 0,
      duration: 0,
      visible: false,
    })
  },
}))
