import { Inbox } from 'lucide-react'
import Card from './Card'

export default function EmptyState({
  title = 'No data available',
  message = 'There is nothing to display for the current selection.',
  icon: Icon = Inbox,
}) {
  return (
    <Card>
      <div className="flex flex-col items-center justify-center py-10 text-center">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-cg bg-cg-hover">
          <Icon className="h-6 w-6 text-cg-secondary" />
        </div>
        <h3 className="text-base font-semibold text-cg-text">{title}</h3>
        <p className="mt-2 max-w-md text-sm text-cg-muted">{message}</p>
      </div>
    </Card>
  )
}
