import type { ReactNode } from 'react'

interface RouteSkeletonPageProps {
  title: string
  description: string
  actions?: ReactNode
}

export const RouteSkeletonPage = ({ title, description, actions }: RouteSkeletonPageProps) => {
  return (
    <section className="rounded-xl border border-ui-border bg-ui-surface p-5 shadow-sm">
      <h1 className="text-2xl font-semibold text-ui-heading">{title}</h1>
      <p className="mt-2 text-sm text-ui-muted">{description}</p>
      {actions ? <div className="mt-4">{actions}</div> : null}
    </section>
  )
}
