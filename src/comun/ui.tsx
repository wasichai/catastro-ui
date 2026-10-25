import type { ReactNode } from 'react'
import { Alert, Button } from '@wasichai/ui'

// the native selects of the pages' toolbars
export const CONTROL = 'h-8 rounded-md border border-border bg-surface px-2 text-sm text-ink'

// a load that failed, with a retry when there is one
export function ErrorCarga({ children, onReintentar, className }: { children: ReactNode; onReintentar?: () => void; className?: string }) {
  return (
    <Alert tone="danger" className={className}>
      <span className="flex flex-wrap items-center gap-2">
        {children}
        {onReintentar && (
          <Button size="sm" variant="secondary" onClick={onReintentar}>
            Reintentar
          </Button>
        )}
      </span>
    </Alert>
  )
}
