import db from '../config/db.js';
import { ApiError } from '../utils/ApiError.js';
import { catchAsync } from '../utils/catchAsync.js';
import { toYmd } from '../utils/dateHelpers.js';

// Tasks (Tasks & Alerts page, and a Tasks card on landlord / property / tenant /
// contractor pages). Assigned to a landlord, a tenant or a contractor (or
// none); optionally about a property. Admin only — the people a task is
// assigned to do not see it.
const OPEN = ['todo', 'in_progress'];

const ASSIGNEE_TABLE = {
  landlord: () => db('users').where('role', 'LANDLORD'),
  tenant: () => db('tenants'),
  contractor: () => db('contractors')
};

const baseQuery = () => db('tasks as t')
  .leftJoin('users as lu', function joinLandlord() {
    this.on('lu.id', '=', 't.assignee_id').andOn('t.assignee_type', '=', db.raw('?', ['landlord']));
  })
  .leftJoin('tenants as tn', function joinTenant() {
    this.on('tn.id', '=', 't.assignee_id').andOn('t.assignee_type', '=', db.raw('?', ['tenant']));
  })
  .leftJoin('contractors as c', function joinContractor() {
    this.on('c.id', '=', 't.assignee_id').andOn('t.assignee_type', '=', db.raw('?', ['contractor']));
  })
  .leftJoin('properties as p', 'p.id', 't.property_id')
  .leftJoin('users as cb', 'cb.id', 't.created_by')
  .select(
    't.*',
    db.raw("CASE t.assignee_type WHEN 'landlord' THEN lu.name WHEN 'tenant' THEN tn.name WHEN 'contractor' THEN COALESCE(c.company_name, c.contact_name) ELSE NULL END as assignee_name"),
    'p.name as property_name',
    'p.block_name',
    'p.apartment_number',
    'p.landlord_id as property_landlord_id',
    'cb.name as created_by_name',
    db.raw("(t.due_date IS NOT NULL AND t.due_date < CURDATE() AND t.status <> 'done') as overdue")
  );

const shape = (r) => ({
  ...r,
  due_date: toYmd(r.due_date),
  overdue: !!Number(r.overdue),
  flat: r.block_name && r.apartment_number ? `${r.block_name}-${r.apartment_number}` : null
});

const audit = (req, action, id, meta) => db('audit_log').insert({
  actor_id: req.user.id,
  actor_role: req.user.role,
  action,
  entity_type: 'task',
  entity_id: id,
  meta: JSON.stringify(meta),
  ip_address: req.ip || null
});

// The assignee and property must exist.
const checkLinks = async ({ assignee_type: type, assignee_id: id, property_id: propertyId }) => {
  if (type && type !== 'none') {
    if (!(await ASSIGNEE_TABLE[type]().where('id', id).first())) throw new ApiError(400, `That ${type} does not exist`);
  }
  if (propertyId && !(await db('properties').where('id', propertyId).first())) throw new ApiError(400, 'That property does not exist');
};

const findTask = async (id) => {
  const row = await baseQuery().where('t.id', id).first();
  if (!row) throw new ApiError(404, 'Task not found');
  return shape(row);
};

// GET /tasks?status=open|done|all&assignee_type=&assignee_id=&property_id=&landlord_id=
export const listTasks = catchAsync(async (req, res) => {
  const { status = 'all', assignee_type: type, assignee_id: assigneeId, property_id: propertyId, landlord_id: landlordId } = req.query;
  const q = baseQuery();
  if (status === 'open') q.whereIn('t.status', OPEN);
  else if (['todo', 'in_progress', 'done'].includes(status)) q.where('t.status', status);
  if (type) q.where('t.assignee_type', type);
  if (assigneeId) q.where('t.assignee_id', assigneeId);
  if (propertyId) q.where('t.property_id', propertyId);
  // A landlord's page: tasks assigned to them, or about any of their flats.
  if (landlordId) {
    q.where((w) => w
      .where((a) => a.where('t.assignee_type', 'landlord').where('t.assignee_id', landlordId))
      .orWhereIn('t.property_id', db('properties').where('landlord_id', landlordId).select('id')));
  }
  const rows = await q
    .orderByRaw("t.status = 'done' asc")
    .orderByRaw('t.due_date IS NULL asc')
    .orderBy('t.due_date', 'asc')
    .orderBy('t.created_at', 'desc');
  res.json({ success: true, data: rows.map(shape) });
});

export const createTask = catchAsync(async (req, res) => {
  const b = req.body;
  const type = b.assignee_type || 'none';
  const row = {
    title: b.title.trim(),
    notes: b.notes?.trim() || null,
    due_date: b.due_date || null,
    priority: b.priority || 'normal',
    status: b.status || 'todo',
    assignee_type: type,
    assignee_id: type === 'none' ? null : b.assignee_id,
    property_id: b.property_id || null,
    created_by: req.user.id
  };
  await checkLinks(row);
  if (row.status === 'done') row.completed_at = db.fn.now();
  const [id] = await db('tasks').insert(row);
  await audit(req, 'TASK_CREATED', id, { title: row.title, assignee_type: type, assignee_id: row.assignee_id, property_id: row.property_id });
  res.status(201).json({ success: true, data: await findTask(id) });
});

export const updateTask = catchAsync(async (req, res) => {
  const current = await db('tasks').where('id', req.params.id).first();
  if (!current) throw new ApiError(404, 'Task not found');
  const b = req.body;
  const patch = {};
  if (b.title !== undefined) patch.title = b.title.trim();
  if (b.notes !== undefined) patch.notes = b.notes?.trim() || null;
  if (b.due_date !== undefined) patch.due_date = b.due_date || null;
  if (b.priority !== undefined) patch.priority = b.priority;
  if (b.property_id !== undefined) patch.property_id = b.property_id || null;
  if (b.assignee_type !== undefined) {
    patch.assignee_type = b.assignee_type;
    patch.assignee_id = b.assignee_type === 'none' ? null : b.assignee_id;
  }
  if (b.status !== undefined && b.status !== current.status) {
    patch.status = b.status;
    patch.completed_at = b.status === 'done' ? db.fn.now() : null;
  }
  await checkLinks({ assignee_type: patch.assignee_type, assignee_id: patch.assignee_id, property_id: patch.property_id });
  if (Object.keys(patch).length) {
    await db('tasks').where('id', current.id).update({ ...patch, updated_at: db.fn.now() });
    const changed = Object.keys(patch).filter((k) => k !== 'completed_at');
    await audit(req, 'TASK_UPDATED', current.id, { changed, status: patch.status });
  }
  res.json({ success: true, data: await findTask(current.id) });
});

export const deleteTask = catchAsync(async (req, res) => {
  const current = await db('tasks').where('id', req.params.id).first();
  if (!current) throw new ApiError(404, 'Task not found');
  await db('tasks').where('id', current.id).delete();
  await audit(req, 'TASK_DELETED', current.id, { title: current.title });
  res.json({ success: true });
});

// For the alerts feed: open tasks due today or overdue.
export const dueTasks = () => baseQuery()
  .whereIn('t.status', OPEN)
  .whereNotNull('t.due_date')
  .where('t.due_date', '<=', db.raw('CURDATE()'))
  .select(db.raw('DATEDIFF(t.due_date, CURDATE()) as days_left'))
  .orderBy('t.due_date', 'asc')
  .limit(25);
