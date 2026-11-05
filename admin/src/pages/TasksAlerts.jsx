import { useState, useEffect, useMemo, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { BellRing, AlertTriangle, ListTodo, CalendarX, Plus, Pencil, Trash2, Check, RotateCcw } from 'lucide-react';
import { StatCard } from '../components/UI/StatCard';
import { Skeleton } from '../components/UI/Skeleton';
import { AlertsTable } from '../components/UI/AlertsTable';
import { DataTable } from '../components/UI/DataTable';
import { Dropdown } from '../components/UI/Dropdown';
import { Button } from '../components/UI/Button';
import { RowActionsMenu } from '../components/UI/RowActionsMenu';
import { TaskModal } from '../components/UI/TaskModal';
import { SearchInput, Pill } from '../components/UI/DesignKit';
import { useToast } from '../components/UI/ToastContext';
import { useTasks } from '../hooks/useTasks';
import { TASK_STATUS, TASK_PRIORITY, ASSIGNEE_TYPE, ASSIGNEE_OPTIONS, NOT_ASSIGNED, assigneeLink, isOpenTask, prefillFromAlert } from '../utilities/tasks';
import { shortDate } from '../utilities/designTokens';
import api from '../utilities/api';

const STATUS_FILTER = { open: 'Open', todo: 'To Do', in_progress: 'In Progress', done: 'Done' };

// Tasks (made here, assigned to a landlord, a tenant or a contractor,
// optionally about a property) and alerts (same feed as the header bell and
// the Dashboard; open tasks due today or overdue are in it too).
export const TasksAlerts = () => {
  const { addToast } = useToast();
  const [alerts, setAlerts] = useState(null);
  const { rows, reload, setStatus, remove } = useTasks({ status: 'all' });
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('open');
  const [typeFilter, setTypeFilter] = useState('');
  const [modal, setModal] = useState(null); // { task } | { prefill } | {} for new
  const [searchParams, setSearchParams] = useSearchParams();

  // ?task=<id> (from the Dashboard or the header search) opens that task.
  useEffect(() => {
    const wanted = searchParams.get('task');
    if (!wanted || rows === null) return;
    const t = rows.find((x) => String(x.id) === String(wanted));
    Promise.resolve().then(() => {
      if (t) setModal({ task: t });
      setSearchParams({}, { replace: true });
    });
  }, [searchParams, rows, setSearchParams]);

  const loadAlerts = useCallback(() => api.get('/reports/alerts', { params: { all: 1 } })
    .then((res) => setAlerts(res.data.data))
    .catch((err) => {
      addToast(err.response?.data?.message || 'Failed to load alerts', 'error');
      setAlerts({ total: 0, items: [] });
    }), [addToast]);
  useEffect(() => {
    Promise.resolve().then(loadAlerts);
  }, [loadAlerts]);

  const afterChange = () => { reload(); loadAlerts(); };

  const loading = alerts === null;
  const items = alerts?.items || [];
  const high = items.filter((a) => a.priority === 'high').length;
  const tasks = useMemo(() => rows || [], [rows]);
  const openTasks = tasks.filter(isOpenTask);
  const overdue = openTasks.filter((t) => t.overdue).length;

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return tasks.filter((t) => (statusFilter === 'open' ? isOpenTask(t) : !statusFilter || t.status === statusFilter)
      && (!typeFilter || t.assignee_type === typeFilter)
      && (!q || [t.title, t.notes, t.assignee_name, t.flat, t.property_name].some((v) => String(v || '').toLowerCase().includes(q))));
  }, [tasks, search, statusFilter, typeFilter]);

  const columns = [
    {
      header: 'Task',
      accessor: 'title',
      sortable: true,
      renderCell: (t) => (
        <span className="block max-w-[320px]">
          <button type="button" onClick={() => setModal({ task: t })} className={`block text-left text-xs font-bold text-brand-primary hover:underline cursor-pointer truncate max-w-full ${t.status === 'done' ? 'line-through opacity-60' : ''}`}>{t.title}</button>
          {t.notes && <span className="block text-[11px] text-gray-400 font-semibold truncate">{t.notes}</span>}
        </span>
      ),
    },
    {
      header: 'Assigned To',
      accessor: 'assignee_name',
      sortable: true,
      renderCell: (t) => {
        const link = assigneeLink(t);
        return (
          <span className="block max-w-[220px]">
            {link ? (
              <>
                <Link to={link} className="block text-xs font-bold text-brand-primary hover:underline truncate">{t.assignee_name}</Link>
                <span className="block text-[11px] text-gray-400 font-semibold">{ASSIGNEE_TYPE[t.assignee_type]}</span>
              </>
            ) : <span className="block text-xs font-semibold text-gray-400">{NOT_ASSIGNED}</span>}
          </span>
        );
      },
    },
    {
      header: 'Property',
      accessor: 'flat',
      sortable: true,
      renderCell: (t) => (t.property_id ? <Link to={`/properties/${t.property_id}`} className="text-xs font-semibold text-brand-primary hover:underline whitespace-nowrap">{t.flat || t.property_name}</Link> : <span className="text-gray-400">—</span>),
    },
    {
      header: 'Due',
      accessor: 'due_date',
      sortable: true,
      sortValue: (t) => t.due_date || '9999-12-31',
      renderCell: (t) => (t.due_date ? <span className={`text-xs font-semibold whitespace-nowrap ${t.overdue ? 'text-status-danger' : ''}`}>{shortDate(t.due_date)}{t.overdue ? ' · Overdue' : ''}</span> : <span className="text-gray-400">—</span>),
    },
    { header: 'Priority', accessor: 'priority', sortable: true, renderCell: (t) => <Pill tone={TASK_PRIORITY[t.priority].tone}>{TASK_PRIORITY[t.priority].label}</Pill> },
    { header: 'Status', accessor: 'status', sortable: true, renderCell: (t) => <Pill tone={TASK_STATUS[t.status].tone}>{TASK_STATUS[t.status].label}</Pill> },
    {
      header: '',
      accessor: 'id',
      align: 'right',
      renderCell: (t) => (
        <RowActionsMenu
          label={`Actions for ${t.title}`}
          items={[
            t.status === 'done'
              ? { label: 'Reopen', icon: RotateCcw, onClick: () => setStatus(t, 'todo').then(loadAlerts) }
              : { label: 'Mark Done', icon: Check, onClick: () => setStatus(t, 'done').then(loadAlerts) },
            { label: 'Edit', icon: Pencil, onClick: () => setModal({ task: t }) },
            { label: 'Delete', icon: Trash2, danger: true, onClick: () => remove(t).then(loadAlerts) },
          ]}
        />
      ),
    },
  ];

  return (
    <div className="py-6 max-w-[1440px] mx-auto px-8 flex flex-col gap-6 font-sans text-brand-primary">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Open Tasks" value={rows === null ? '…' : String(openTasks.length)} icon={ListTodo} iconColor="text-brand-accent bg-brand-accent/10" />
        <StatCard
          label="Overdue Tasks"
          value={rows === null ? '…' : String(overdue)}
          icon={CalendarX}
          iconColor="text-status-danger bg-status-danger/10"
          valueColor={overdue > 0 ? 'text-status-danger' : 'text-brand-primary'}
        />
        <StatCard label="Alerts" value={loading ? '…' : String(alerts.total)} icon={BellRing} iconColor="text-brand-accent bg-brand-accent/10" />
        <StatCard
          label="High Priority Alerts"
          value={loading ? '…' : String(high)}
          icon={AlertTriangle}
          iconColor="text-status-danger bg-status-danger/10"
          valueColor={high > 0 ? 'text-status-danger' : 'text-brand-primary'}
        />
      </div>

      <div className="card-bg border border-card-border rounded-card shadow-premium p-5 flex flex-col gap-4">
        <div className="flex items-center justify-between gap-3 pb-3 border-b border-card-border">
          <h3 className="text-sm-portal font-bold text-brand-primary">Tasks</h3>
          <Button variant="primary" size="sm" icon={Plus} onClick={() => setModal({})}>New Task</Button>
        </div>
        <div className="flex flex-col md:flex-row md:items-end gap-3 flex-wrap">
          <SearchInput value={search} onChange={setSearch} placeholder="Search task, person or flat…" className="w-full md:w-72" />
          <div className="w-full md:w-44">
            <Dropdown id="task-status-filter" placeholder="All Statuses" clearable options={Object.entries(STATUS_FILTER).map(([value, label]) => ({ value, label }))} value={statusFilter} onChange={(v) => setStatusFilter(v || '')} />
          </div>
          <div className="w-full md:w-48">
            <Dropdown id="task-type-filter" placeholder="Assigned To: Anyone" clearable options={ASSIGNEE_OPTIONS} value={typeFilter} onChange={(v) => setTypeFilter(v || '')} />
          </div>
          <span className="md:ml-auto text-xs text-status-muted md:pb-2.5">{rows === null ? '' : `${visible.length} of ${tasks.length} tasks`}</span>
        </div>
        {rows === null ? (
          <Skeleton radius="card" className="h-40 w-full" />
        ) : visible.length === 0 ? (
          <p className="text-xs text-gray-400 font-semibold py-8 text-center">
            {tasks.length === 0 ? 'No tasks yet — click New Task to add one.' : 'No tasks match these filters.'}
          </p>
        ) : (
          <DataTable columns={columns} data={visible} />
        )}
      </div>

      <div className="card-bg border border-card-border rounded-card shadow-premium p-5 flex flex-col gap-3">
        <h3 className="text-sm-portal font-bold text-brand-primary pb-3 border-b border-card-border">Alerts</h3>
        {loading ? (
          <Skeleton radius="card" className="h-48 w-full" />
        ) : items.length === 0 ? (
          <p className="text-xs text-gray-400 font-semibold py-8 text-center">
            Nothing needs attention — no expiring certificates, unregistered deposits, urgent maintenance, pending payments or tasks due.
          </p>
        ) : (
          <AlertsTable
            alerts={items}
            onMakeTask={(a) => setModal({ prefill: prefillFromAlert(a) })}
            onOpenTask={(a) => setModal({ task: tasks.find((t) => t.id === a.task_id) })}
          />
        )}
      </div>

      {modal && <TaskModal task={modal.task} prefill={modal.prefill} onClose={() => setModal(null)} onSaved={afterChange} />}
    </div>
  );
};
