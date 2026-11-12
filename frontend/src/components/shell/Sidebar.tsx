import { useEffect } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import {
  AudioLines,
  AudioWaveform,
  BookOpen,
  Camera,
  Frame,
  Image,
  Layers3,
  Library,
  ListMusic,
  Mic2,
  Music2,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  Shield,
  Sparkles,
  Video,
  Wrench,
  X,
} from 'lucide-react'
import { useUiStore } from '../../stores/ui'
import { useQueueStore } from '../../stores/queue'
import { usePromptStore } from '../../stores/prompt'
import { useComfyStatus, useHistory, useOllamaStatus } from '../../lib/queries'
import { Badge, IconButton, Progress } from '../ui'
import { cn } from '../../lib/utils'
import type { PromptMode } from '../../types'

const primaryNav = [
  { label: 'Image', icon: Image, mode: 'image' as PromptMode, to: '/?mode=image' },
  { label: 'Video', icon: Video, mode: 'video' as PromptMode, to: '/?mode=video' },
  { label: 'Speech', icon: Mic2, mode: 'speech' as PromptMode, to: '/?mode=speech' },
]

const workspaceNav = [
  { label: 'Library', icon: Library, to: '/library' },
  { label: 'Stories', icon: BookOpen, to: '/stories' },
  { label: 'Music', icon: Music2, to: '/songs' },
  { label: 'Player', icon: ListMusic, to: '/player' },
  { label: 'Music Video', icon: AudioLines, to: '/music' },
  { label: 'Motion', icon: Camera, to: '/motion' },
  { label: 'Single Frame', icon: Frame, to: '/frames' },
  { label: 'Video Audio', icon: AudioWaveform, to: '/video-audio' },
  { label: 'Voices', icon: Mic2, to: '/voices' },
]

const systemNav = [
  { label: 'Models', icon: Layers3, to: '/models' },
  { label: 'Settings', icon: Settings, to: '/settings' },
  { label: 'Admin', icon: Shield, to: '/admin' },
]

export function Sidebar() {
  const location = useLocation()
  const navigate = useNavigate()
  const history = useHistory()
  const comfy = useComfyStatus()
  const ollama = useOllamaStatus()
  const collapsed = useUiStore((s) => s.sidebarCollapsed)
  const mobileOpen = useUiStore((s) => s.mobileSidebarOpen)
  const toggleSidebar = useUiStore((s) => s.toggleSidebar)
  const setMobileSidebar = useUiStore((s) => s.setMobileSidebar)
  const setMode = usePromptStore((s) => s.setMode)
  const setQueueOpen = useUiStore((s) => s.setQueueOpen)
  const setComposerOpen = useUiStore((s) => s.setComposerOpen)
  const inspectorId = useUiStore((s) => s.inspectorId)
  const openInspector = useUiStore((s) => s.openInspector)
  const queueOpen = useUiStore((s) => s.queueOpen)
  const jobs = useQueueStore((s) => s.jobs)
  const activeJobs = jobs.filter((job) => job.status === 'queued' || job.status === 'running')
  const runningJobList = activeJobs.filter((job) => job.status === 'running')
  const runningJobs = runningJobList.length
  const queuedJobs = activeJobs.length - runningJobs
  const completedJobs = jobs.filter((job) => job.status === 'done').length
  const queueProgress = runningJobs
    ? runningJobList.reduce((sum, job) => sum + job.progress, 0) / runningJobs
    : 0

  useEffect(() => {
    setMobileSidebar(false)
  }, [location.pathname, location.search, setMobileSidebar])

  const goMode = (mode: PromptMode) => {
    setMode(mode)
    if (location.pathname === '/' || location.pathname === '/library') {
      setComposerOpen(true)
      return
    }
    navigate(`/?mode=${mode}`)
  }

  const openFrames = () => {
    const asset = history.data?.find((item) => item.id === inspectorId)
    const video =
      asset && (asset.type === 'video' || asset.filename?.endsWith('.mp4')) ? asset : null
    openInspector(null)
    navigate(video ? `/frames?video=${encodeURIComponent(video.id)}` : '/frames')
  }

  return (
    <>
      {mobileOpen ? (
        <button
          className="fixed inset-0 z-[60] bg-black/65 backdrop-blur-sm md:hidden"
          onClick={() => setMobileSidebar(false)}
          aria-label="Close navigation"
        />
      ) : null}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-[70] flex w-[264px] flex-col border-r border-line bg-[#0c0c0d]/95 backdrop-blur-xl transition-all duration-200',
          collapsed && 'md:w-[76px]',
          mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0',
        )}
      >
        <div className="flex h-16 items-center gap-2.5 px-4">
          <div className="grid size-8 shrink-0 place-items-center rounded-xl bg-lime text-bg shadow-[0_0_24px_rgba(215,255,63,0.25)]">
            <Sparkles className="size-4" strokeWidth={2.4} />
          </div>
          {!collapsed ? (
            <div className="min-w-0">
              <p className="font-display text-sm font-semibold tracking-tight text-text">Pulse Image</p>
              <p className="truncate text-[10px] text-text-3">local generative studio</p>
            </div>
          ) : null}
          <IconButton
            className="ml-auto hidden md:inline-flex"
            onClick={toggleSidebar}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? <PanelLeftOpen className="size-4" /> : <PanelLeftClose className="size-4" />}
          </IconButton>
          <IconButton
            className="ml-auto md:hidden"
            onClick={() => setMobileSidebar(false)}
            aria-label="Close navigation"
          >
            <X className="size-4" />
          </IconButton>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-4">
          <NavSection label="Create" collapsed={collapsed}>
            {primaryNav.map((item) => {
              const Icon = item.icon
              const active =
                location.pathname === '/' &&
                new URLSearchParams(location.search).get('mode') === item.mode
              return (
                <button
                  key={item.label}
                  onClick={() => goMode(item.mode)}
                  className={cn(navItemClass, active && navActiveClass)}
                  title={collapsed ? item.label : undefined}
                >
                  <Icon className="size-[17px] shrink-0" />
                  {!collapsed ? <span>{item.label}</span> : null}
                </button>
              )
            })}
          </NavSection>

          <NavSection label="Workspace" collapsed={collapsed}>
            {workspaceNav.map((item) => {
              const Icon = item.icon
              if (item.to === '/frames') {
                return (
                  <button
                    key={item.label}
                    onClick={openFrames}
                    className={cn(
                      navItemClass,
                      location.pathname === '/frames' && navActiveClass,
                    )}
                    title={collapsed ? item.label : undefined}
                  >
                    <Icon className="size-[17px] shrink-0" />
                    {!collapsed ? <span>{item.label}</span> : null}
                  </button>
                )
              }
              return (
                <NavLink
                  key={item.label}
                  to={item.to}
                  className={({ isActive }) =>
                    cn(navItemClass, isActive && navActiveClass)
                  }
                  title={collapsed ? item.label : undefined}
                >
                  <Icon className="size-[17px] shrink-0" />
                  {!collapsed ? <span>{item.label}</span> : null}
                </NavLink>
              )
            })}
          </NavSection>

          <NavSection label="System" collapsed={collapsed}>
            {systemNav.map((item) => {
              const Icon = item.icon
              return (
                <NavLink
                  key={item.label}
                  to={item.to}
                  className={({ isActive }) =>
                    cn(navItemClass, isActive && navActiveClass)
                  }
                  title={collapsed ? item.label : undefined}
                >
                  <Icon className="size-[17px] shrink-0" />
                  {!collapsed ? <span>{item.label}</span> : null}
                </NavLink>
              )
            })}
          </NavSection>


        </div>

        <div className="border-t border-line p-3">
          <button
            onClick={() => setQueueOpen(!queueOpen)}
            className={cn(navItemClass, queueOpen && navActiveClass, 'mb-1')}
            title={
              activeJobs.length
                ? `Queue: ${runningJobs} running, ${queuedJobs} queued (${Math.round(queueProgress)}%)`
                : 'Queue'
            }
          >
            <Wrench className="size-[17px]" />
            {!collapsed ? <span>Queue</span> : null}
            {activeJobs.length || completedJobs ? (
              <span className={cn('min-w-0 shrink-0', collapsed ? 'ml-auto w-7' : 'ml-2 flex-1')}>
                {activeJobs.length ? <Progress value={queueProgress} className="h-1.5" /> : null}
                {!collapsed ? (
                  <span className="mt-1 flex items-center justify-between gap-2 text-[9px] leading-none text-text-3">
                    <span>{completedJobs} completed</span>
                    <span>{activeJobs.length} in queue</span>
                  </span>
                ) : null}
              </span>
            ) : null}
          </button>
          <div className="rounded-xl border border-line bg-white/[0.02] px-2 py-2">
            <div className={cn('grid gap-2', collapsed ? 'grid-cols-1' : 'grid-cols-2')}>
              <ServerStatus
                label="ComfyUI"
                connected={comfy.isError ? false : comfy.data?.connected}
                detail={comfy.data?.url}
                collapsed={collapsed}
              />
              <ServerStatus
                label="Ollama"
                connected={ollama.isError ? false : ollama.data?.connected}
                detail={ollama.data?.url}
                hint={ollama.data?.model}
                collapsed={collapsed}
              />
            </div>
          </div>
          {!collapsed ? (
            <div className="mt-2 flex items-center justify-between px-1">
              <Badge tone="lime">LOCAL STUDIO</Badge>
              <span className="text-[9px] text-text-3">v2</span>
            </div>
          ) : null}
        </div>
      </aside>
    </>
  )
}

function ServerStatus({
  label,
  connected,
  detail,
  hint,
  collapsed,
}: {
  label: string
  connected?: boolean
  detail?: string
  hint?: string
  collapsed: boolean
}) {
  const checking = connected === undefined
  const online = connected === true
  const stateLabel = checking ? 'checking...' : online ? 'online' : 'offline'
  const displayDetail = detail?.replace(/^https?:\/\//i, '')
  const title = `${label}: ${stateLabel}${detail ? ` - ${detail}` : ''}${hint ? ` (${hint})` : ''}`

  return (
    <div
      className={cn('flex min-w-0 items-start gap-2', collapsed && 'justify-center')}
      title={title}
    >
      <span
        className={cn(
          'mt-[3px] size-1.5 shrink-0 rounded-full',
          checking ? 'animate-pulse bg-text-3' : online ? 'bg-success' : 'bg-danger',
        )}
      />
      {!collapsed ? (
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <p className="truncate text-[10px] font-medium text-text-2">{label}</p>
            <span
              className={cn(
                'text-[9px]',
                checking ? 'text-text-3' : online ? 'text-success' : 'text-danger',
              )}
            >
              {stateLabel}
            </span>
          </div>
          <p className="truncate text-[9px] text-text-3">{displayDetail || 'checking...'}</p>
        </div>
      ) : null}
    </div>
  )
}

const navItemClass =
  'group flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-[13px] font-medium text-text-2 transition hover:bg-white/[0.05] hover:text-text'

const navActiveClass =
  'bg-lime-soft text-lime hover:bg-lime-soft hover:text-lime'

function NavSection({
  label,
  collapsed,
  children,
}: {
  label: string
  collapsed: boolean
  children: React.ReactNode
}) {
  return (
    <div className="mb-4">
      {!collapsed ? (
        <p className="mb-1 px-2.5 text-[9px] font-semibold uppercase tracking-[0.18em] text-text-3">
          {label}
        </p>
      ) : null}
      <div className="space-y-0.5">{children}</div>
    </div>
  )
}
