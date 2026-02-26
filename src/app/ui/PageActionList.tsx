import { Link } from 'react-router-dom'

export interface PageActionItem {
  label: string
  hint?: string
  to: string
  tone?: 'primary' | 'secondary'
}

interface PageActionListProps {
  title: string
  actions: PageActionItem[]
}

export const PageActionList = ({ title, actions }: PageActionListProps) => (
  <section className="space-y-2">
    <h2 className="ui-subheading">{title}</h2>
    <div className="ui-action-list">
      {actions.map((action) => (
        <Link
          className={`ui-action-link ${action.tone === 'primary' ? 'ui-action-link-primary' : ''}`}
          key={`${action.to}-${action.label}`}
          to={action.to}
        >
          <span className="ui-action-link-main">
            <span className="ui-action-link-label">{action.label}</span>
            {action.hint ? <span className="ui-action-link-hint">{action.hint}</span> : null}
          </span>
          <span aria-hidden="true" className="ui-action-chevron">
            {'->'}
          </span>
        </Link>
      ))}
    </div>
  </section>
)
