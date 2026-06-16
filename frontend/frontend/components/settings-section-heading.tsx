'use client'

import type { ReactNode } from 'react'

type SettingsSectionHeadingProps = {
  title: string
  description?: string
  icon?: ReactNode
}

export function SettingsSectionHeading({ title, description, icon }: SettingsSectionHeadingProps) {
  return (
    <div className="flex items-start gap-3 pb-1">
      {icon ? (
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
          {icon}
        </div>
      ) : null}
      <div className="min-w-0">
        <h3 className="text-base font-semibold text-foreground">{title}</h3>
        {description ? <p className="mt-0.5 text-sm text-muted-foreground">{description}</p> : null}
      </div>
    </div>
  )
}
