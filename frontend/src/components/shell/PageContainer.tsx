import type { ReactNode } from 'react'
import { cn } from '../../lib/utils'

export function PageContainer({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'mx-auto w-full max-w-[1700px] px-4 pb-10 pt-16 md:px-8 md:pt-8',
        className,
      )}
    >
      {children}
    </div>
  )
}
