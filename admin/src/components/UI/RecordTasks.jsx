import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Check, RotateCcw } from 'lucide-react';
import { SectionCard, Pill } from './DesignKit';
import { Skeleton } from './Skeleton';
import { TaskModal } from './TaskModal';
import { useTasks } from '../../hooks/useTasks';
import { TASK_PRIORITY, ASSIGNEE_TYPE, NOT_ASSIGNED, assigneeLink, isOpenTask } from '../../utilities/tasks';
import { shortDate } from '../../utilities/designTokens';

// "Tasks (n)" card on a landlord / property / tenant / contractor page: the
// tasks for that record, New Task pre-filled with it. filter = GET /tasks params.
export const RecordTasks = ({ filter, prefill, className = '' }) => {
  const { rows, reload, setStatus } = useTasks(filter);
  const [showDone, setShowDone] = useState(false);
  const [modal, setModal] = useState(null); // { task } | { } for new
  const open = (rows || []).filter(isOpenTask);
  const done = (rows || []).filter((t) => !isOpenTask(t));
  const shown = showDone ? [...open, ...done] : open;

  return (
    <SectionCard title={rows === null ? 'Tasks' : `Tasks (${open.length})`} className={className}>
      <div className="flex items-center justify-between gap-2 -mt-1">
        {done.length > 0 ? (
          <button type="button" onClick={() => setShowDone((v) => !v)} className="text-[11px] font-bold text-brand-accent hover:underline cursor-pointer">
            {showDone ? 'Hide Done' : `Show Done (${done.length})`}
          </button>
        ) : <span />}
        <button type="button" onClick={() => setModal({})} className="inline-flex items-center gap-1 text-[11px] font-bold text-brand-accent hover:underline cursor-pointer">
          <Plus size={13} /> New Task
        </button>
      </div>
      {rows === null ? (
        <Skeleton className="h-16 w-full" />
      ) : shown.length === 0 ? (
        <p className="text-[11px] text-gray-400 font-semibold py-2">No open tasks.</p>
      ) : (
        <div className="flex flex-col">
          {shown.map((t) => {
            const link = assigneeLink(t);
            return (
              <div key={t.id} className={`flex items-start gap-3 py-2.5 border-b border-card-border/60 last:border-0 ${t.status === 'done' ? 'opacity-60' : ''}`}>
                <button
                  type="button"
                  onClick={() => setStatus(t, t.status === 'done' ? 'todo' : 'done')}
                  title={t.status === 'done' ? 'Reopen' : 'Mark Done'}
                  aria-label={t.status === 'done' ? `Reopen ${t.title}` : `Mark ${t.title} done`}
                  className={`mt-0.5 w-5 h-5 rounded-md border flex items-center justify-center shrink-0 cursor-pointer ${t.status === 'done' ? 'bg-status-success border-status-success text-white' : 'border-card-border text-transparent hover:text-status-success hover:border-status-success'}`}
                >
                  {t.status === 'done' ? <RotateCcw size={11} /> : <Check size={12} />}
                </button>
                <span className="min-w-0 flex-1">
                  <button type="button" onClick={() => setModal({ task: t })} className={`block text-left text-xs font-bold text-brand-primary hover:underline cursor-pointer ${t.status === 'done' ? 'line-through' : ''}`}>
                    {t.title}
                  </button>
                  <span className="block text-[11px] text-gray-400 font-semibold">
                    {link ? <Link to={link} className="hover:underline">{t.assignee_name}</Link> : NOT_ASSIGNED}
                    {link && ` (${ASSIGNEE_TYPE[t.assignee_type]})`}
                    {t.flat && t.property_id && <> · <Link to={`/properties/${t.property_id}`} className="hover:underline">{t.flat}</Link></>}
                    {t.due_date && <span className={t.overdue ? 'text-status-danger' : ''}> · Due {shortDate(t.due_date)}</span>}
                  </span>
                </span>
                {t.priority === 'high' && <Pill tone={TASK_PRIORITY.high.tone}>High</Pill>}
              </div>
            );
          })}
        </div>
      )}
      {modal && <TaskModal task={modal.task} prefill={prefill} onClose={() => setModal(null)} onSaved={reload} />}
    </SectionCard>
  );
};
