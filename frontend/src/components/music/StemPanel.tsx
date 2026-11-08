import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, AudioLines, ExternalLink, Loader2, RefreshCw, X } from 'lucide-react'
import { apiGet, apiPost } from '../../lib/api'
import { watchProgress } from '../../lib/assets'
import { queryKeys, useHistory, useStemCapabilities } from '../../lib/queries'
import { stemSourceTitle, type StemResponse, type StemSource } from '../../lib/stems'
import { uid } from '../../lib/utils'
import { useQueueStore } from '../../stores/queue'
import { useStemsStore } from '../../stores/stems'
import { useUiStore } from '../../stores/ui'
import { Badge, Button, IconButton, Progress } from '../ui'
import { StemMixer } from './StemMixer'

export function StemPanel() {
  const open = useStemsStore((state) => state.open)
  const assetId = useStemsStore((state) => state.assetId)
  const closeStems = useStemsStore((state) => state.closeStems)
  const history = useHistory()
  const capabilities = useStemCapabilities()
  const queryClient = useQueryClient()
  const toast = useUiStore((state) => state.toast)
  const addQueue = useQueueStore((state) => state.add)
  const updateQueue = useQueueStore((state) => state.update)

  const [data, setData] = useState<StemResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [running, setRunning] = useState(false)
  const [progress, setProgress] = useState(0)
  const [stage, setStage] = useState<string | null>(null)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const activeAssetRef = useRef<string | null>(null)
  const loadedAssetRef = useRef<string | null>(null)
  const attemptedRef = useRef<Set<string>>(new Set())
  const runningRef = useRef(false)
  const runningAssetRef = useRef<string | null>(null)
  const stopProgressRef = useRef<(() => void) | null>(null)

  const asset = useMemo(
    () => (history.data ?? []).find((item) => item.id === assetId),
    [history.data, assetId],
  )

  const loadStems = useCallback(async (id: string) => {
    if (loadedAssetRef.current !== id) {
      loadedAssetRef.current = null
      setData(null)
      setFetchError(null)
      setActionError(null)
      setRunning(false)
      setProgress(0)
      setStage(null)
    }
    setLoading(true)
    setFetchError(null)
    try {
      const result = await apiGet<StemResponse>(`/stems/${encodeURIComponent(id)}`)
      if (activeAssetRef.current !== id) return
      setData(result)
      loadedAssetRef.current = id
    } catch (error) {
      if (activeAssetRef.current !== id) return
      setFetchError(error instanceof Error ? error.message : 'Could not load stems')
    } finally {
      if (activeAssetRef.current === id) setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!assetId) return
    activeAssetRef.current = assetId
    const timer = window.setTimeout(() => {
      void loadStems(assetId)
    }, 0)
    return () => window.clearTimeout(timer)
  }, [assetId, loadStems])

  const startSeparation = useCallback(
    async (id: string, name: string) => {
      if (runningRef.current && runningAssetRef.current === id) return
      runningRef.current = true
      runningAssetRef.current = id
      const jobId = uid('stems')

      setRunning(true)
      setProgress(0)
      setStage('separating')
      setActionError(null)

      addQueue({
        id: jobId,
        label: `Stems · ${name}`,
        mode: 'audio',
        status: 'running',
        progress: 0,
        stage: 'separating',
        startedAt: Date.now(),
      })

      const stop = watchProgress(jobId, (snapshot) => {
        const percent = Math.max(
          0,
          Math.min(100, Number(snapshot.workflow_percent ?? snapshot.node_percent ?? 0)),
        )
        updateQueue(jobId, {
          status: snapshot.state === 'error' ? 'error' : 'running',
          progress: percent,
          stage: snapshot.stage,
          error: snapshot.error,
        })
        if (activeAssetRef.current === id) {
          setProgress(percent)
          setStage(snapshot.stage || 'separating')
        }
      })
      stopProgressRef.current = stop

      try {
        const result = await apiPost<StemResponse>(`/stems/${encodeURIComponent(id)}`, {
          job_id: jobId,
        })
        if (!result.success) throw new Error(result.error || 'Stem separation failed')
        stop()

        updateQueue(jobId, {
          status: 'done',
          progress: 100,
          stage: 'done',
          finishedAt: Date.now(),
        })

        if (activeAssetRef.current === id) {
          setData((prev) =>
            result.source || !prev?.source ? result : { ...result, source: prev.source },
          )
          loadedAssetRef.current = id
          setRunning(false)
          setProgress(100)
          setStage('done')
          setActionError(null)
        }

        void queryClient.invalidateQueries({ queryKey: queryKeys.history })
        toast({
          title: 'Stems ready',
          description: `${name} is ready in the mixer.`,
          tone: 'success',
        })
      } catch (error) {
        stop()
        const message = error instanceof Error ? error.message : 'Stem separation failed'
        updateQueue(jobId, { status: 'error', error: message, finishedAt: Date.now() })
        if (activeAssetRef.current === id) {
          setRunning(false)
          setStage(null)
          setActionError(message)
        }
        toast({ title: 'Stem separation failed', description: message, tone: 'error' })
      } finally {
        stop()
        if (stopProgressRef.current === stop) stopProgressRef.current = null
        if (runningAssetRef.current === id) {
          runningRef.current = false
          runningAssetRef.current = null
        }
      }
    },
    [addQueue, queryClient, toast, updateQueue],
  )

  const title = stemSourceTitle(data?.source, asset)
  const stems = data?.stems ?? []
  const capability = capabilities.data
  const capabilityError =
    capabilities.error instanceof Error
      ? capabilities.error.message
      : (capability?.error ?? null)
  const unavailable = capabilities.isError || Boolean(capability && !capability.available)

  useEffect(() => {
    if (!open || !assetId || running) return
    if (!data || data.status !== 'idle' || data.stems.length) return
    if (!capability?.available) return
    if (attemptedRef.current.has(assetId)) return
    attemptedRef.current.add(assetId)
    void startSeparation(assetId, stemSourceTitle(data.source, asset))
  }, [open, assetId, running, data, capability, asset, startSeparation])

  useEffect(() => {
    if (!assetId || running || data?.status !== 'running') return
    let cancelled = false
    const timer = window.setTimeout(async () => {
      try {
        const result = await apiGet<StemResponse>(`/stems/${encodeURIComponent(assetId)}`)
        if (cancelled || activeAssetRef.current !== assetId) return
        setData(result)
        loadedAssetRef.current = assetId
      } catch {
        return
      }
    }, 2500)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [assetId, running, data])

  useEffect(
    () => () => {
      stopProgressRef.current?.()
    },
    [],
  )

  const source = useMemo<StemSource | null>(() => {
    if (!data) return null
    const base = data.source
    const filename = base?.filename || asset?.filename || ''
    if (!filename && !base) return null
    return {
      id: base?.id || asset?.id || assetId || '',
      name: base?.name || title,
      filename,
      duration: base?.duration ?? asset?.duration,
      waveform: base?.waveform,
    }
  }, [data, asset, assetId, title])

  const dataError = data?.status === 'error' ? data.error || 'Stem separation failed' : null
  const errorMessage = actionError || dataError || fetchError
  const showMixer = Boolean(source && stems.length)
  const showRunning = running || data?.status === 'running'
  const showRetry = Boolean(errorMessage)
  const isIdle = !data || data.status === 'idle'
  const showUnavailable = !showMixer && !showRunning && !showRetry && unavailable
  const showPreparing = !showMixer && !showRunning && !showRetry && !unavailable && isIdle
  const showEmpty =
    Boolean(data) && !showMixer && !showRunning && !showRetry && !showUnavailable && !showPreparing

  if (!open) return null

  const retry = () => {
    if (!assetId) return
    if (fetchError && !actionError && !dataError) {
      void loadStems(assetId)
      return
    }
    if (!capability?.available) return
    attemptedRef.current.add(assetId)
    void startSeparation(assetId, title)
  }

  const retryLabel = fetchError && !actionError && !dataError ? 'Retry' : 'Retry separation'

  return (
    <>
      <button
        className="fixed inset-0 z-[70] bg-black/55 backdrop-blur-sm"
        onClick={closeStems}
        aria-label="Close stems panel"
      />
      <aside className="fixed inset-y-0 right-0 z-[75] flex w-full max-w-[1040px] flex-col border-l border-line-strong bg-surface shadow-2xl">
        <div className="flex items-center gap-3 border-b border-line px-4 py-3">
          <span className="grid size-8 place-items-center rounded-lg bg-lime-soft text-lime">
            <AudioLines className="size-4" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-display text-sm font-semibold">Stems</p>
            <p className="truncate text-[10px] text-text-3">{title}</p>
          </div>
          {showRunning ? (
            <Badge tone="lime">separating</Badge>
          ) : stems.length ? (
            <Badge tone="success">{stems.length} stems</Badge>
          ) : null}
          <IconButton onClick={closeStems} aria-label="Close stems panel">
            <X className="size-4" />
          </IconButton>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {loading && !data ? (
            <div className="flex items-center justify-center gap-2 py-16 text-xs text-text-3">
              <Loader2 className="size-4 animate-spin" />
              Loading stems...
            </div>
          ) : null}

          {showMixer && source ? (
            <div className="space-y-3">
              <StemMixer key={source.id || source.filename} source={source} stems={stems} />
              <p className="text-[10px] text-text-3">
                The original mix plays by default. Stems start muted; use mute, solo, and volume
                to build the balance.
              </p>
            </div>
          ) : null}

          {showRunning ? (
            <div className={showMixer ? 'mt-3 rounded-xl border border-line bg-white/[0.02] p-3' : 'rounded-xl border border-line bg-white/[0.02] p-4'}>
              <div className="flex items-center gap-2">
                <Loader2 className="size-4 animate-spin text-lime" />
                <p className="min-w-0 flex-1 text-xs font-medium">Separating stems...</p>
                <span className="font-mono text-[10px] text-text-3">{Math.round(progress)}%</span>
              </div>
              <Progress value={progress} className="mt-3" />
              <p className="mt-2 text-[10px] text-text-3">
                {stage ? `Stage: ${stage}` : 'Waiting for the separator to report progress.'}
              </p>
            </div>
          ) : null}

          {showRetry ? (
            <div className={showMixer || showRunning ? 'mt-3 rounded-xl border border-danger/30 bg-danger-soft p-4' : 'rounded-xl border border-danger/30 bg-danger-soft p-4'}>
              <div className="flex items-start gap-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-danger/15 text-danger">
                  <AlertTriangle className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-text">Stem separation failed</p>
                  <p className="mt-1 text-xs leading-5 text-text-2">{errorMessage}</p>
                  <Button
                    size="sm"
                    variant="outline"
                    className="mt-3"
                    icon={<RefreshCw className="size-3.5" />}
                    onClick={retry}
                    disabled={running || !capability?.available}
                  >
                    {retryLabel}
                  </Button>
                </div>
              </div>
            </div>
          ) : null}

          {showUnavailable ? (
            <div className="rounded-2xl border border-warning/25 bg-warning/10 p-4">
              <div className="flex items-start gap-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-warning/15 text-warning">
                  <AlertTriangle className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-text">Stem separation is not ready</p>
                  <p className="mt-1 text-xs leading-5 text-text-2">
                    {capability?.comfy_connected
                      ? capability.node_installed
                        ? 'ComfyUI is online, but the separation model is missing. Install it from Models.'
                        : 'ComfyUI is online, but the stem separation node is not installed.'
                      : 'ComfyUI could not be reached. Check the server status and try again.'}
                  </p>
                  {capability?.model ? (
                    <p className="mt-1 text-[10px] text-text-3">Model: {capability.model}</p>
                  ) : null}
                  {capabilityError ? (
                    <p className="mt-1 text-[10px] leading-4 text-text-3">{capabilityError}</p>
                  ) : null}
                  <Link
                    to="/models"
                    onClick={closeStems}
                    className="mt-3 inline-flex items-center gap-1.5 text-[10px] font-medium text-lime transition hover:underline"
                  >
                    Open Models <ExternalLink className="size-2.5" />
                  </Link>
                </div>
              </div>
            </div>
          ) : null}

          {showPreparing ? (
            <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-line bg-white/[0.015] px-6 py-16 text-center">
              <Loader2 className="size-5 animate-spin text-lime" />
              <p className="text-xs font-medium">Preparing stem separation...</p>
              <p className="max-w-sm text-[10px] text-text-3">
                The first separation can take a few minutes. You can close this panel and the
                job will keep running in the queue.
              </p>
            </div>
          ) : null}

          {showEmpty ? (
            <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-line bg-white/[0.015] px-6 py-16 text-center">
              <AudioLines className="size-6 text-text-3" />
              <div>
                <p className="text-xs font-medium">No stems were returned</p>
                <p className="mt-1 max-w-sm text-[10px] text-text-3">
                  Run separation again to build a stem mix for this track.
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                icon={<RefreshCw className="size-3.5" />}
                onClick={retry}
                disabled={running || !capability?.available}
              >
                Separate stems
              </Button>
            </div>
          ) : null}
        </div>
      </aside>
    </>
  )
}
