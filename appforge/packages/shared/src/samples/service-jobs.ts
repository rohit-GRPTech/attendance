import type { ApplicationDefinition } from '../types/application';
import { baseDefinition, dashboardPage, entity, field, listPage, notifyWorkflow, options } from './builders';

const customers = entity('customers', 'Customer', 'Customers', 'name', [
  field('name', 'Customer name', 'short_text', { required: true }),
  field('email', 'Email', 'email'),
  field('phone', 'Phone', 'phone', { required: true }),
  field('address', 'Address', 'address'),
  field('customer_since', 'Customer since', 'date'),
], 'user');

const assets = entity('assets', 'Asset', 'Assets', 'label', [
  field('label', 'Asset label', 'short_text', { required: true }),
  field('asset_type', 'Type', 'select', { options: options('Vehicle', 'HVAC unit', 'Generator', 'Machine', 'Other') }),
  field('serial_number', 'Serial number', 'short_text', { unique: true }),
  field('customer', 'Owner', 'relation', { required: true, relation: { kind: 'many_to_one', targetEntityKey: 'customers', displayFieldKey: 'name' } }),
  field('last_service_date', 'Last serviced', 'date'),
], 'wrench');

const technicians = entity('technicians', 'Technician', 'Technicians', 'name', [
  field('name', 'Technician name', 'short_text', { required: true }),
  field('email', 'Email', 'email'),
  field('specialty', 'Specialty', 'select', { options: options('Electrical', 'Mechanical', 'Plumbing', 'General') }),
  field('active', 'Active', 'boolean', { defaultValue: true }),
], 'hard-hat');

const services = entity('services', 'Service', 'Services', 'name', [
  field('name', 'Service name', 'short_text', { required: true }),
  field('standard_price', 'Standard price', 'currency', { min: 0 }),
  field('duration_minutes', 'Duration (minutes)', 'number', { min: 0 }),
], 'list-checks');

const jobs = entity('jobs', 'Job', 'Jobs', 'job_number', [
  field('job_number', 'Job number', 'short_text', { required: true, unique: true }),
  field('customer', 'Customer', 'relation', { required: true, relation: { kind: 'many_to_one', targetEntityKey: 'customers', displayFieldKey: 'name' } }),
  field('asset', 'Asset', 'relation', { relation: { kind: 'many_to_one', targetEntityKey: 'assets', displayFieldKey: 'label' } }),
  field('technician', 'Technician', 'relation', { relation: { kind: 'many_to_one', targetEntityKey: 'technicians', displayFieldKey: 'name' } }),
  field('status', 'Status', 'status', { required: true, defaultValue: 'scheduled', options: options('Scheduled', 'In progress', 'On hold', 'Completed', 'Cancelled') }),
  field('scheduled_date', 'Scheduled date', 'date', { required: true }),
  field('description', 'Work description', 'long_text'),
], 'briefcase');

const invoices = entity('invoices', 'Invoice', 'Invoices', 'invoice_number', [
  field('invoice_number', 'Invoice number', 'short_text', { required: true, unique: true }),
  field('job', 'Job', 'relation', { required: true, relation: { kind: 'many_to_one', targetEntityKey: 'jobs', displayFieldKey: 'job_number' } }),
  field('amount', 'Amount', 'currency', { required: true, min: 0 }),
  field('status', 'Status', 'status', { required: true, defaultValue: 'draft', options: options('Draft', 'Sent', 'Paid', 'Overdue', 'Void') }),
  field('due_date', 'Due date', 'date'),
], 'receipt');

const payments = entity('payments', 'Payment', 'Payments', 'reference', [
  field('reference', 'Reference', 'short_text', { required: true }),
  field('invoice', 'Invoice', 'relation', { required: true, relation: { kind: 'many_to_one', targetEntityKey: 'invoices', displayFieldKey: 'invoice_number' } }),
  field('amount', 'Amount', 'currency', { required: true, min: 0 }),
  field('method', 'Method', 'select', { options: options('Card', 'Bank transfer', 'Cash', 'Cheque') }),
  field('paid_at', 'Paid on', 'date', { required: true }),
], 'credit-card');

const entities = [customers, assets, jobs, technicians, services, invoices, payments];

const pages = [
  dashboardPage('dashboard', 'Service dashboard', [
    { label: 'Open jobs', entityKey: 'jobs' },
    { label: 'Customers', entityKey: 'customers' },
    { label: 'Unpaid invoices', entityKey: 'invoices' },
    { label: 'Active technicians', entityKey: 'technicians' },
  ], { entityKey: 'jobs', groupByFieldKey: 'status', title: 'Jobs by status' }),
  listPage('jobs', 'Jobs', 'jobs', 'briefcase', ['job_number', 'customer', 'technician', 'status', 'scheduled_date']),
  listPage('calendar', 'Schedule', 'jobs', 'calendar', ['job_number', 'customer', 'scheduled_date', 'status']),
  listPage('customers', 'Customers', 'customers', 'user', ['name', 'email', 'phone', 'customer_since']),
  listPage('technicians', 'Technicians', 'technicians', 'hard-hat', ['name', 'specialty', 'active']),
  listPage('invoices', 'Invoices', 'invoices', 'receipt', ['invoice_number', 'job', 'amount', 'status', 'due_date']),
];

const workflows = [
  {
    ...notifyWorkflow('svc', 'Assign technician', 'jobs', 'A new job was created and needs a technician assigned.'),
    trigger: { type: 'record_created' as const, entityKey: 'jobs' },
  },
  {
    ...notifyWorkflow('svc', 'Notify customer', 'jobs', 'Job status changed — the customer should be notified.'),
    trigger: { type: 'record_updated' as const, entityKey: 'jobs' },
  },
  {
    ...notifyWorkflow('svc', 'Invoice paid', 'payments', 'A payment was recorded and its invoice was marked as paid.'),
    trigger: { type: 'record_created' as const, entityKey: 'payments' },
  },
  {
    ...notifyWorkflow('svc', 'Service reminder', 'assets', 'A service reminder is due for this asset.'),
    trigger: { type: 'schedule' as const, schedule: '0 8 * * 1' },
  },
];

export const serviceJobsSample: ApplicationDefinition = baseDefinition(
  'service_jobs',
  'Service Job Management',
  'Coordinate customers, assets, technicians, jobs, invoices and payments for a field-service business.',
  'service_management',
  'wrench',
  entities,
  pages,
  workflows,
);
