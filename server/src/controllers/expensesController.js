import db from '../config/db.js';
import { catchAsync } from '../utils/catchAsync.js';
import { toYmd } from '../utils/dateHelpers.js';

// Accounting → Expenses: costs charged to landlords, from real records only.
//  - Apartment expenses (property Expenses tab; go on Generate Statement)
//  - Repairs taken off a landlord's payout in the Rent Cycle (deductions)
//  - Completed maintenance tickets with a final cost not taken off yet
//  - Repairs from before Roca Living (rent history)
// A ticket that became a Rent Cycle deduction is counted once (as the deduction).

const flatOf = (blockName, apt, name) => (blockName && apt ? `${String(blockName).toUpperCase()}-${apt}` : name || '—');

// GET /accounting/expenses
export const getExpenses = catchAsync(async (req, res) => {
  const expenses = await db('property_expenses as e')
    .join('properties as p', 'e.property_id', 'p.id')
    .select('e.id', 'e.expense_date', 'e.amount', 'e.description', 'e.supplier', 'e.invoice_name', 'e.statement_id',
      'p.id as property_id', 'p.block_name', 'p.apartment_number', 'p.name as property_name');

  const deductions = await db('rent_payment_deductions as d')
    .join('rent_payments as rp', 'd.rent_payment_id', 'rp.id')
    .join('tenancies as t', 'rp.tenancy_id', 't.id')
    .join('properties as p', 't.property_id', 'p.id')
    .select('d.id', 'd.created_at', 'd.amount', 'd.description', 'd.supplier', 'd.ticket_id', 'd.xero_bill_number', 'd.xero_bill_status',
      'rp.received_at', 'p.id as property_id', 'p.block_name', 'p.apartment_number', 'p.name as property_name');
  const deductedTickets = new Set(deductions.map((d) => d.ticket_id).filter(Boolean));

  const tickets = await db('maintenance_tickets as m')
    .join('properties as p', 'm.property_id', 'p.id')
    .leftJoin('contractors as c', 'm.contractor_id', 'c.id')
    .where('m.status', 'complete')
    .whereNotNull('m.invoice_amount')
    .select('m.id', 'm.title', 'm.invoice_amount', 'm.completed_at', 'm.updated_at', 'c.company_name',
      'p.id as property_id', 'p.block_name', 'p.apartment_number', 'p.name as property_name');

  const history = await db('rent_history').where('status', 'done').where('repairs', '>', 0)
    .select('id', 'flat', 'property_id', 'repair_parts', 'xero_bill_number');

  const rows = [
    ...expenses.map((e) => ({
      key: `e-${e.id}`, source: 'apartment_expense', date: toYmd(e.expense_date), amount: Number(e.amount),
      flat: flatOf(e.block_name, e.apartment_number, e.property_name), property_id: e.property_id,
      supplier: e.supplier || '—', description: e.description || '—',
      status: e.statement_id ? 'On a Statement' : 'Not on a Statement Yet',
    })),
    ...deductions.map((d) => ({
      key: `d-${d.id}`, source: 'rent_cycle', date: toYmd(d.received_at || d.created_at), amount: Number(d.amount),
      flat: flatOf(d.block_name, d.apartment_number, d.property_name), property_id: d.property_id,
      supplier: d.supplier || '—', description: d.description || '—',
      status: d.xero_bill_status === 'paid' ? 'Contractor Paid' : d.xero_bill_number ? 'Bill in Xero' : 'Taken Off Payout',
    })),
    ...tickets.filter((m) => !deductedTickets.has(m.id)).map((m) => ({
      key: `m-${m.id}`, source: 'maintenance', date: toYmd(m.completed_at || m.updated_at), amount: Number(m.invoice_amount),
      flat: flatOf(m.block_name, m.apartment_number, m.property_name), property_id: m.property_id,
      supplier: m.company_name || '—', description: m.title || `Ticket #${m.id}`,
      status: 'Not Taken Off Yet',
    })),
    ...history.flatMap((h) => {
      const parts = typeof h.repair_parts === 'string' ? JSON.parse(h.repair_parts) : (h.repair_parts || []);
      return parts.map((r, i) => ({
        key: `h-${h.id}-${i}`, source: 'before_roca_living', date: String(r.date).slice(0, 10), amount: Number(r.amount),
        flat: h.flat, property_id: h.property_id, supplier: '—', description: r.description || 'Repair',
        status: 'Before Roca Living',
      }));
    }),
  ].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));

  res.json({ success: true, data: rows });
});
