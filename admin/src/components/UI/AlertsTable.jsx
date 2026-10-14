// Items needing attention (the /reports/alerts feed): shared by the Dashboard's
// "Recent Alerts & Tasks" card and the Tasks & Alerts page.

// Pill styling (types/statuses come from the alerts feed)
const ALERT_TYPES = {
  compliance: { label: 'Compliance', cls: 'bg-status-danger-bg text-status-danger' },
  deposit: { label: 'Deposit', cls: 'bg-brand-accent/10 text-brand-accent' },
  maintenance: { label: 'Maintenance', cls: 'bg-status-warning/10 text-status-warning' },
  landlord_payment: { label: 'Landlord Payment', cls: 'bg-status-success-bg text-status-success' },
};
const ALERT_STATUSES = {
  open: { label: 'Open', cls: 'bg-status-danger-bg text-status-danger' },
  sent: { label: 'Sent', cls: 'bg-status-info-bg text-status-info' },
  new: { label: 'New', cls: 'bg-status-info-bg text-status-info' },
  triaged: { label: 'Triaged', cls: 'bg-brand-accent/10 text-brand-accent' },
  awaiting_approval: { label: 'Awaiting Approval', cls: 'bg-status-warning/10 text-status-warning' },
  in_progress: { label: 'In Progress', cls: 'bg-status-info-bg text-status-info' },
};
const PRIORITY_STYLES = {
  high: 'bg-status-danger-bg text-status-danger',
  medium: 'bg-status-warning/10 text-status-warning',
};

export const AlertsTable = ({ alerts }) => (
  <div className="overflow-x-auto">
    <table className="w-full min-w-[640px]">
      <thead>
        <tr className="text-left">
          <th className="text-2xs font-bold text-gray-400 capitalize pb-2 pr-3">Type</th>
          <th className="text-2xs font-bold text-gray-400 capitalize pb-2 pr-3">Description</th>
          <th className="text-2xs font-bold text-gray-400 capitalize pb-2 pr-3">Related To</th>
          <th className="text-2xs font-bold text-gray-400 capitalize pb-2 pr-3">Due</th>
          <th className="text-2xs font-bold text-gray-400 capitalize pb-2 pr-3">Priority</th>
          <th className="text-2xs font-bold text-gray-400 capitalize pb-2">Status</th>
        </tr>
      </thead>
      <tbody>
        {alerts.map((a, i) => {
          const type = ALERT_TYPES[a.type] || { label: a.type, cls: 'bg-surface-hover text-gray-400' };
          const status = ALERT_STATUSES[a.status] || { label: a.status, cls: 'bg-surface-hover text-gray-400' };
          return (
            <tr key={i} className="border-t border-card-border/60">
              <td className="py-2.5 pr-3">
                <span className={`px-2 py-0.5 rounded-sm text-2xs font-bold whitespace-nowrap ${type.cls}`}>{type.label}</span>
              </td>
              <td className="py-2.5 pr-3 text-xs font-semibold text-brand-primary">{a.description}</td>
              <td className="py-2.5 pr-3 text-xs font-semibold text-gray-400 whitespace-nowrap">{a.related_to}</td>
              <td className={`py-2.5 pr-3 text-xs font-bold whitespace-nowrap ${
                a.due === 'Overdue' ? 'text-status-danger' : a.due === 'Today' ? 'text-status-warning' : 'text-gray-400'
              }`}>
                {a.due || '—'}
              </td>
              <td className="py-2.5 pr-3">
                <span className={`px-2 py-0.5 rounded-sm text-2xs font-bold ${PRIORITY_STYLES[a.priority] || ''}`}>
                  {a.priority === 'high' ? 'High' : 'Medium'}
                </span>
              </td>
              <td className="py-2.5">
                <span className={`px-2 py-0.5 rounded-sm text-2xs font-bold whitespace-nowrap ${status.cls}`}>{status.label}</span>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  </div>
);
