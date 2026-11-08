import { useEffect } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { Menu } from 'lucide-react'
import { Sidebar } from './Sidebar'
import { QueuePanel } from './QueuePanel'
import { PromptDock } from '../prompt/PromptDock'
import { AssetInspector } from '../media/AssetInspector'
import { ConfirmDialog, Toaster } from '../ui'
import { useUiStore } from '../../stores/ui'
import { cn } from '../../lib/utils'

export function AppShell() {
  const location = useLocation()
  const setMobileSidebar = useUiStore((s) => s.setMobileSidebar)
  const sidebarCollapsed = useUiStore((s) => s.sidebarCollapsed)
  const composerOpen = useUiStore((s) => s.composerOpen)
  const setComposerOpen = useUiStore((s) => s.setComposerOpen)
  const showDock = location.pathname === '/' || location.pathname === '/library'

  useEffect(() => {
    if (!showDock) setComposerOpen(false)
    else setComposerOpen(location.pathname === '/')
  }, [location.pathname, setComposerOpen, showDock])

  return (
    <div className="min-h-dvh bg-bg text-text">
      <Sidebar />
      <button
        onClick={() => setMobileSidebar(true)}
        className="fixed left-3 top-3 z-[55] grid size-10 place-items-center rounded-xl border border-line-strong bg-surface/90 text-text-2 shadow-xl backdrop-blur-xl md:hidden"
        aria-label="Open navigation"
      >
        <Menu className="size-4" />
      </button>
      <div className={showDock ? (composerOpen ? 'pb-64' : 'pb-20') : ''}>
        <main
          className={cn(
            'min-h-dvh pl-0 transition-[padding] duration-200',
            sidebarCollapsed ? 'md:pl-[76px]' : 'md:pl-[264px]',
          )}
        >
          <Outlet />
        </main>
      </div>
      {showDock ? <PromptDock /> : null}
      <QueuePanel />
      <AssetInspector />
      <ConfirmDialog />
      <Toaster />
    </div>
  )
}
