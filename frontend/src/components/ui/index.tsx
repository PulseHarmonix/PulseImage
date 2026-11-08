import {
  forwardRef,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
  useEffect,
} from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import * as DropdownPrimitive from '@radix-ui/react-dropdown-menu'
import { Check, ChevronDown, Loader2, X } from 'lucide-react'
import { cn } from '../../lib/utils'
import { useUiStore } from '../../stores/ui'
import { useConfirmStore } from '../../stores/confirm'
import type { ToastMessage } from '../../types'

type Variant = 'primary' | 'secondary' | 'ghost' | 'outline' | 'danger' | 'soft'
type Size = 'sm' | 'md' | 'lg' | 'icon'

const variants: Record<Variant, string> = {
  primary:
    'border border-lime/80 bg-lime text-bg shadow-[0_1px_0_rgba(255,255,255,0.35)_inset,0_8px_24px_rgba(215,255,63,0.12)] hover:bg-[#e2ff72] active:bg-[#c7ef30]',
  secondary: 'border border-white/10 bg-white text-black hover:bg-white/90',
  ghost: 'border border-transparent bg-transparent text-text-2 hover:bg-white/[0.06] hover:text-text',
  outline: 'border border-line-strong bg-transparent text-text hover:bg-white/[0.05]',
  danger: 'border border-danger/30 bg-danger-soft text-danger hover:bg-danger/20',
  soft: 'border border-lime/20 bg-lime-soft text-lime hover:bg-lime/20',
}

const sizes: Record<Size, string> = {
  sm: 'h-8 gap-1.5 rounded-lg px-3 text-xs',
  md: 'h-10 gap-2 rounded-xl px-4 text-sm',
  lg: 'h-12 gap-2.5 rounded-xl px-5 text-sm',
  icon: 'h-9 w-9 rounded-lg p-0',
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  busy?: boolean
  icon?: ReactNode
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'ghost', size = 'md', busy, icon, children, disabled, ...props }, ref) => (
    <button
      ref={ref}
      disabled={disabled || busy}
      className={cn(
        'inline-flex select-none items-center justify-center whitespace-nowrap font-medium transition-all duration-150 disabled:opacity-45',
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    >
      {busy ? <Loader2 className="size-4 animate-spin" /> : icon}
      {children}
    </button>
  ),
)
Button.displayName = 'Button'

export const IconButton = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'ghost', ...props }, ref) => (
    <Button ref={ref} variant={variant} size="icon" className={className} {...props} />
  ),
)
IconButton.displayName = 'IconButton'

export function Badge({
  children,
  tone = 'default',
  className,
}: {
  children: ReactNode
  tone?: 'default' | 'lime' | 'danger' | 'warning' | 'success'
  className?: string
}) {
  const tones = {
    default: 'border-line bg-white/[0.04] text-text-2',
    lime: 'border-lime/20 bg-lime-soft text-lime',
    danger: 'border-danger/20 bg-danger-soft text-danger',
    warning: 'border-warning/20 bg-warning/10 text-warning',
    success: 'border-success/20 bg-success/10 text-success',
  }
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium leading-4',
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  )
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        'h-10 w-full rounded-xl border border-line bg-white/[0.035] px-3 text-sm text-text outline-none transition placeholder:text-text-3 focus:border-lime/40 focus:bg-white/[0.05]',
        className,
      )}
      {...props}
    />
  ),
)
Input.displayName = 'Input'

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn(
        'w-full resize-none rounded-xl border border-line bg-white/[0.035] px-3 py-2.5 text-sm leading-6 text-text outline-none transition placeholder:text-text-3 focus:border-lime/40 focus:bg-white/[0.05]',
        className,
      )}
      {...props}
    />
  ),
)
Textarea.displayName = 'Textarea'

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, children, ...props }, ref) => (
    <div className="relative">
      <select
        ref={ref}
        className={cn(
          'h-9 w-full appearance-none rounded-full border border-line bg-white/[0.035] pl-3 pr-8 text-xs font-medium text-text-2 outline-none transition hover:border-line-strong hover:text-text focus:border-lime/40',
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 size-3 -translate-y-1/2 text-text-3" />
    </div>
  ),
)
Select.displayName = 'Select'

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn('size-4 animate-spin text-text-3', className)} />
}

export function Progress({
  value,
  className,
  tone = 'lime',
}: {
  value: number
  className?: string
  tone?: 'lime' | 'white'
}) {
  return (
    <div className={cn('h-1.5 overflow-hidden rounded-full bg-white/[0.07]', className)}>
      <div
        className={cn(
          'h-full rounded-full transition-[width] duration-300',
          tone === 'lime' ? 'bg-lime' : 'bg-white',
        )}
        style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
      />
    </div>
  )
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode
  title: string
  description?: string
  action?: ReactNode
}) {
  return (
    <div className="flex min-h-[240px] flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-line bg-white/[0.015] p-8 text-center">
      {icon ? <div className="text-text-3">{icon}</div> : null}
      <div>
        <p className="font-display text-base font-semibold text-text">{title}</p>
        {description ? <p className="mt-1 max-w-md text-xs text-text-2">{description}</p> : null}
      </div>
      {action}
    </div>
  )
}

export const Dialog = DialogPrimitive.Root
export const DialogTrigger = DialogPrimitive.Trigger
export const DialogClose = DialogPrimitive.Close
export const DialogTitle = DialogPrimitive.Title
export const DialogDescription = DialogPrimitive.Description

export function DialogContent({
  children,
  className,
  title,
  description,
}: {
  children: ReactNode
  className?: string
  title?: string
  description?: string
}) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-[80] bg-black/70 backdrop-blur-sm data-[state=open]:animate-fade-up" />
      <DialogPrimitive.Content
        className={cn(
          'fixed left-1/2 top-1/2 z-[90] max-h-[88dvh] w-[calc(100vw-32px)] max-w-xl -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-2xl border border-line-strong bg-surface shadow-2xl outline-none data-[state=open]:animate-fade-up',
          className,
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
          <div>
            {title ? (
              <DialogPrimitive.Title className="font-display text-base font-semibold text-text">
                {title}
              </DialogPrimitive.Title>
            ) : null}
            {description ? (
              <DialogPrimitive.Description className="mt-1 text-xs text-text-2">
                {description}
              </DialogPrimitive.Description>
            ) : null}
          </div>
          <DialogPrimitive.Close className="rounded-lg p-1.5 text-text-3 transition hover:bg-white/[0.06] hover:text-text">
            <X className="size-4" />
          </DialogPrimitive.Close>
        </div>
        <div className="max-h-[calc(88dvh-66px)] overflow-y-auto p-5">{children}</div>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  )
}

export const Dropdown = DropdownPrimitive.Root
export const DropdownTrigger = DropdownPrimitive.Trigger

export function DropdownContent({
  children,
  className,
  align = 'end',
}: {
  children: ReactNode
  className?: string
  align?: 'start' | 'center' | 'end'
}) {
  return (
    <DropdownPrimitive.Portal>
      <DropdownPrimitive.Content
        align={align}
        sideOffset={8}
        className={cn(
          'z-[100] min-w-48 overflow-hidden rounded-xl border border-line-strong bg-surface-2 p-1.5 shadow-2xl data-[state=open]:animate-fade-up',
          className,
        )}
      >
        {children}
      </DropdownPrimitive.Content>
    </DropdownPrimitive.Portal>
  )
}

export function DropdownItem({
  children,
  onSelect,
  active,
  danger,
  disabled,
}: {
  children: ReactNode
  onSelect?: () => void
  active?: boolean
  danger?: boolean
  disabled?: boolean
}) {
  return (
    <DropdownPrimitive.Item
      onSelect={onSelect}
      disabled={disabled}
      className={cn(
        'flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-xs outline-none transition',
        danger
          ? 'text-danger focus:bg-danger-soft'
          : 'text-text-2 focus:bg-white/[0.06] focus:text-text',
        active && 'text-text',
        disabled && (danger ? 'cursor-not-allowed' : 'cursor-not-allowed opacity-50'),
      )}
    >
      <span className="min-w-0 flex-1">{children}</span>
      {active ? <Check className="size-3.5 text-lime" /> : null}
    </DropdownPrimitive.Item>
  )
}

export function Separator({ className }: { className?: string }) {
  return <div className={cn('h-px w-full bg-line', className)} />
}

export function ConfirmDialog() {
  const open = useConfirmStore((state) => state.open)
  const options = useConfirmStore((state) => state.options)
  const respond = useConfirmStore((state) => state.respond)

  return (
    <Dialog open={open} onOpenChange={(next) => (!next ? respond(false) : undefined)}>
      <DialogContent
        title={options?.title || 'Are you sure?'}
        description={options?.description}
        className="max-w-md"
      >
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => respond(false)}>
            {options?.cancelLabel || 'Cancel'}
          </Button>
          <Button
            variant={options?.tone === 'danger' ? 'danger' : 'primary'}
            onClick={() => respond(true)}
          >
            {options?.confirmLabel || 'Continue'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export function Toaster() {
  const toasts = useUiStore((state) => state.toasts)
  const dismissToast = useUiStore((state) => state.dismissToast)
  return (
    <div className="pointer-events-none fixed bottom-5 left-1/2 z-[120] flex w-[calc(100vw-32px)] max-w-sm -translate-x-1/2 flex-col gap-2">
      {toasts.map((toast) => (
        <ToastCard key={toast.id} toast={toast} onDismiss={() => dismissToast(toast.id)} />
      ))}
    </div>
  )
}

function ToastCard({ toast, onDismiss }: { toast: ToastMessage; onDismiss: () => void }) {
  useEffect(() => {
    const timer = window.setTimeout(onDismiss, 4200)
    return () => window.clearTimeout(timer)
  }, [onDismiss])

  const tone = {
    default: 'border-line-strong text-text',
    success: 'border-success/30 text-text',
    error: 'border-danger/30 text-text',
    warning: 'border-warning/30 text-text',
  }[toast.tone ?? 'default']

  return (
    <div className={cn('glass pointer-events-auto rounded-xl px-4 py-3 shadow-xl', tone)}>
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium">{toast.title}</p>
          {toast.description ? (
            <p className="mt-0.5 text-[11px] text-text-2">{toast.description}</p>
          ) : null}
        </div>
        <button
          onClick={onDismiss}
          className="rounded-md p-1 text-text-3 transition hover:bg-white/[0.06] hover:text-text"
          aria-label="Dismiss notification"
        >
          <X className="size-3" />
        </button>
      </div>
    </div>
  )
}
