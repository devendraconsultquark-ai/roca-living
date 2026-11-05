// Task labels and links, shared by the Tasks & Alerts page, the task popup and
// the Tasks card on landlord / property / tenant / contractor pages.
export const TASK_STATUS = {
  todo: { label: 'To Do', tone: 'grey' },
  in_progress: { label: 'In Progress', tone: 'blue' },
  done: { label: 'Done', tone: 'green' },
};

export const TASK_PRIORITY = {
  low: { label: 'Low', tone: 'grey' },
  normal: { label: 'Normal', tone: 'blue' },
  high: { label: 'High', tone: 'red' },
};

export const ASSIGNEE_TYPE = {
  none: 'None',
  landlord: 'Landlord',
  tenant: 'Tenant',
  contractor: 'Contractor',
};

// Who a task can be assigned to (the dropdowns).
export const ASSIGNEE_OPTIONS = Object.entries(ASSIGNEE_TYPE).map(([value, label]) => ({ value, label }));
export const NOT_ASSIGNED = 'Not Assigned';

// Page of the person a task is assigned to (none when not assigned).
export const assigneeLink = (t) => ({
  landlord: `/landlords/${t.assignee_id}`,
  tenant: `/tenants/${t.assignee_id}`,
  contractor: `/contractors/${t.assignee_id}`,
}[t.assignee_type] || null);

export const isOpenTask = (t) => t.status !== 'done';
