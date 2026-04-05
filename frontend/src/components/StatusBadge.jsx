export default function StatusBadge({ status }) {
  const styles = {
    overdue:      'bg-red-100 text-red-800 border border-red-200',
    pending:      'bg-amber-100 text-amber-800 border border-amber-200',
    filed:        'bg-green-100 text-green-800 border border-green-200',
    not_required: 'bg-gray-100 text-gray-600 border border-gray-200',
    waived:       'bg-purple-100 text-purple-800 border border-purple-200',
    prospect:     'bg-blue-100 text-blue-800 border border-blue-200',
    committed:    'bg-orange-100 text-orange-800 border border-orange-200',
    closed:       'bg-green-100 text-green-800 border border-green-200',
    active:       'bg-green-100 text-green-800 border border-green-200',
    paused:       'bg-yellow-100 text-yellow-800 border border-yellow-200',
  }

  const labels = {
    overdue:      'Overdue',
    pending:      'Pending',
    filed:        'Filed',
    not_required: 'Not Required',
    waived:       'Waived',
    prospect:     'Prospect',
    committed:    'Committed',
    closed:       'Closed',
    active:       'Active',
    paused:       'Paused',
  }

  const cls = styles[status] || 'bg-gray-100 text-gray-600 border border-gray-200'
  const label = labels[status] || status

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${cls}`}>
      {label}
    </span>
  )
}
