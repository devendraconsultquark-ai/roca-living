import { useEffect, useState } from 'react';
import { ListTodo, X } from 'lucide-react';
import api from '../../utilities/api';
import { useToast } from './ToastContext';
import { Button } from './Button';
import { Input } from './Input';
import { Dropdown } from './Dropdown';
import { DatePicker } from './DatePicker';
import { TASK_STATUS, TASK_PRIORITY, ASSIGNEE_TYPE, ASSIGNEE_OPTIONS } from '../../utilities/tasks';

// New / edit task. `task` = the task being edited (omit for new); `prefill` =
// { assignee_type, assignee_id, property_id, title, notes, priority, due_date }
// when opened from a record page or "Make Task".
const flatOf = (p) => (p.block_name && p.apartment_number ? `${p.block_name}-${p.apartment_number}` : null);

export const TaskModal = ({ task = null, prefill = {}, onClose, onSaved }) => {
  const { addToast } = useToast();
  const [form, setForm] = useState(() => ({
    title: task?.title || prefill.title || '',
    notes: task?.notes || prefill.notes || '',
    due_date: task?.due_date || prefill.due_date || '',
    priority: task?.priority || prefill.priority || 'normal',
    status: task?.status || 'todo',
    // None, or a landlord / tenant / contractor (then the person)
    assignee_type: task?.assignee_type || prefill.assignee_type || 'none',
    assignee_id: task?.assignee_id || prefill.assignee_id || null,
    property_id: task?.property_id || prefill.property_id || null,
  }));
  const [lists, setLists] = useState(null);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  useEffect(() => {
    const get = (path) => api.get(path, { skipInterceptorError: true }).then((r) => r.data?.data || []).catch(() => []);
    Promise.all([get('/landlords'), get('/tenancies/tenants/all'), get('/maintenance/contractors'), get('/properties')])
      .then(([landlords, tenants, contractors, properties]) => setLists({ landlords, tenants, contractors, properties }));
  }, []);

  const people = !lists ? [] : {
    landlord: lists.landlords.map((l) => ({ value: l.id, label: l.name })),
    tenant: lists.tenants.map((t) => ({ value: t.rawId, label: t.property_name ? `${t.name} · ${t.property_name}` : t.name })),
    contractor: lists.contractors.map((c) => ({ value: c.id, label: [c.company_name || c.contact_name, c.trade].filter(Boolean).join(' · ') })),
  }[form.assignee_type] || [];
  const propertyOptions = (lists?.properties || []).map((p) => ({ value: p.id, label: [flatOf(p), p.name || p.address_line1].filter(Boolean).join(' · ') }));

  const chooseType = (type) => setForm((f) => ({ ...f, assignee_type: type || 'none', assignee_id: null }));
  // The property a landlord / tenant task is usually about: the tenant's flat;
  // the landlord's flat (keeps the one already chosen if it is theirs). Can be changed.
  const propertyFor = (type, id, current) => {
    if (!id || !lists) return current;
    if (type === 'tenant') return lists.tenants.find((t) => t.rawId === id)?.property_id || current;
    if (type === 'landlord') {
      const theirs = lists.properties.filter((p) => p.landlord_id === id).map((p) => p.id);
      return theirs.includes(current) ? current : theirs[0] || current;
    }
    return current;
  };
  const choosePerson = (id) => setForm((f) => ({ ...f, assignee_id: id || null, property_id: propertyFor(f.assignee_type, id, f.property_id) }));

  const save = async (e) => {
    e.preventDefault();
    const errs = {};
    if (form.title.trim().length < 2) errs.title = 'Enter a title';
    if (form.assignee_type !== 'none' && !form.assignee_id) errs.assignee_id = `Choose the ${ASSIGNEE_TYPE[form.assignee_type].toLowerCase()}`;
    setErrors(errs);
    if (Object.keys(errs).length) return;
    const body = {
      title: form.title.trim(),
      notes: form.notes.trim() || null,
      due_date: form.due_date || null,
      priority: form.priority,
      assignee_type: form.assignee_type,
      assignee_id: form.assignee_type === 'none' ? null : form.assignee_id,
      property_id: form.property_id || null,
      ...(task ? { status: form.status } : {}),
    };
    setSaving(true);
    try {
      if (task) await api.patch(`/tasks/${task.id}`, body);
      else await api.post('/tasks', body);
      addToast(task ? 'Task updated' : 'Task created', 'success');
      onSaved?.();
      onClose();
    } catch (err) {
      addToast(err.response?.data?.errors?.[0]?.message || err.response?.data?.message || 'Failed to save task', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-overlay backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
      <form onSubmit={save} className="bg-white rounded-2xl shadow-xl w-full max-w-xl border border-card-border overflow-hidden my-8">
        <div className="bg-brand-primary text-white p-5 font-bold flex items-center gap-2 select-none">
          <ListTodo size={18} />
          <span>{task ? 'Edit Task' : 'New Task'}</span>
          <button type="button" onClick={onClose} disabled={saving} className="ml-auto p-1 rounded-md text-white/80 hover:text-white hover:bg-white/10 cursor-pointer disabled:opacity-50" aria-label="Close">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 flex flex-col gap-4 max-h-[75vh] overflow-y-auto">
          <Input id="task-title" label="Title" required value={form.title} onChange={(e) => set('title', e.target.value)} error={errors.title} placeholder="e.g. Book smoke alarm check" />
          <div>
            <label htmlFor="task-notes" className="block text-xs font-semibold text-status-muted mb-1">Notes</label>
            <textarea
              id="task-notes"
              rows={3}
              value={form.notes}
              onChange={(e) => set('notes', e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-brand-accent bg-white resize-y"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Dropdown
              id="task-assignee-type"
              label="Assigned To"
              hint="Who must do it. Landlords, tenants and contractors don't see tasks; this is for tracking."
              options={ASSIGNEE_OPTIONS}
              value={form.assignee_type}
              onChange={chooseType}
            />
            {form.assignee_type !== 'none' && (
              <Dropdown
                id="task-assignee"
                label={ASSIGNEE_TYPE[form.assignee_type]}
                placeholder={lists ? `Choose ${ASSIGNEE_TYPE[form.assignee_type].toLowerCase()}…` : 'Loading…'}
                searchable
                options={people}
                value={form.assignee_id}
                onChange={choosePerson}
                error={errors.assignee_id}
                disabled={!lists}
              />
            )}
          </div>
          <Dropdown
            id="task-property"
            label="Property"
            placeholder={lists ? 'No property' : 'Loading…'}
            searchable
            clearable
            options={propertyOptions}
            value={form.property_id}
            onChange={(v) => set('property_id', v || null)}
            disabled={!lists}
          />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <DatePicker id="task-due" label="Due Date" value={form.due_date} onChange={(v) => set('due_date', v || '')} />
            <Dropdown
              id="task-priority"
              label="Priority"
              options={Object.entries(TASK_PRIORITY).map(([value, p]) => ({ value, label: p.label }))}
              value={form.priority}
              onChange={(v) => set('priority', v || 'normal')}
            />
            {task && (
              <Dropdown
                id="task-status"
                label="Status"
                options={Object.entries(TASK_STATUS).map(([value, s]) => ({ value, label: s.label }))}
                value={form.status}
                onChange={(v) => set('status', v || 'todo')}
              />
            )}
          </div>
        </div>

        <div className="px-6 pb-6 flex justify-end gap-3">
          <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button type="submit" variant="primary" disabled={saving}>{saving ? 'Saving…' : task ? 'Save Task' : 'Create Task'}</Button>
        </div>
      </form>
    </div>
  );
};
