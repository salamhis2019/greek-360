import type { ReactNode } from 'react'

interface RouteSkeletonPageProps {
  title: string
  description: string
  actions?: ReactNode
}

export const RouteSkeletonPage = ({ title, description, actions }: RouteSkeletonPageProps) => {
  return (
    <section className="ui-page">
      <div className="ui-page-header">
        <p className="ui-page-brand">Greek 360</p>
        <h1 className="ui-page-title">{title}</h1>
        <p className="ui-page-description">{description}</p>
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </section>
  )
}
