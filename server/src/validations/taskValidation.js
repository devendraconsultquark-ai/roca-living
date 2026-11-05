import { z } from 'zod';

const ymd = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD');
const optionalId = z.coerce.number().int().positive().nullable().optional();

const fields = {
  title: z.string().trim().min(2, 'Title must be at least 2 characters').max(255),
  notes: z.string().max(5000).nullable().optional(),
  due_date: ymd.nullable().optional(),
  priority: z.enum(['low', 'normal', 'high']).optional(),
  status: z.enum(['todo', 'in_progress', 'done']).optional(),
  assignee_type: z.enum(['none', 'landlord', 'tenant', 'contractor'], { message: 'Choose None, landlord, tenant or contractor' }).optional(),
  assignee_id: optionalId,
  property_id: optionalId
};

// Assigned to a landlord, tenant or contractor (then the person is needed), or none.
const assigneeRule = (d) => d.assignee_type === undefined || d.assignee_type === 'none' || !!d.assignee_id;
const assigneeError = { message: 'Choose who the task is assigned to', path: ['assignee_id'] };

export const createTaskSchema = z.object(fields).refine(assigneeRule, assigneeError);
export const updateTaskSchema = z.object({ ...fields, title: fields.title.optional() }).refine(assigneeRule, assigneeError);
