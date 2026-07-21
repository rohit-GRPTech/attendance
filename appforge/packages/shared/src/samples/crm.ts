import type { ApplicationDefinition } from '../types/application';
import { baseDefinition, dashboardPage, entity, field, listPage, notifyWorkflow, options, sampleId } from './builders';

const leads = entity('leads', 'Lead', 'Leads', 'name', [
  field('name', 'Full name', 'short_text', { required: true, maxLength: 120 }),
  field('email', 'Email', 'email', { required: true, unique: true }),
  field('phone', 'Phone', 'phone'),
  field('company_name', 'Company', 'short_text'),
  field('source', 'Source', 'select', { options: options('Website', 'Referral', 'Cold call', 'Event', 'Advertising') }),
  field('status', 'Status', 'status', { required: true, defaultValue: 'new', options: options('New', 'Contacted', 'Qualified', 'Unqualified', 'Converted') }),
  field('estimated_value', 'Estimated value', 'currency', { min: 0 }),
  field('notes', 'Notes', 'long_text'),
], 'user-plus');

const companies = entity('companies', 'Company', 'Companies', 'name', [
  field('name', 'Company name', 'short_text', { required: true, unique: true }),
  field('industry', 'Industry', 'select', { options: options('Technology', 'Manufacturing', 'Retail', 'Healthcare', 'Finance', 'Other') }),
  field('website', 'Website', 'url'),
  field('city', 'City', 'short_text'),
  field('employee_count', 'Employees', 'number', { min: 0 }),
], 'building-2');

const contacts = entity('contacts', 'Contact', 'Contacts', 'name', [
  field('name', 'Full name', 'short_text', { required: true }),
  field('email', 'Email', 'email', { required: true }),
  field('phone', 'Phone', 'phone'),
  field('job_title', 'Job title', 'short_text'),
  field('company', 'Company', 'relation', { relation: { kind: 'many_to_one', targetEntityKey: 'companies', displayFieldKey: 'name' } }),
], 'contact');

const activities = entity('activities', 'Activity', 'Activities', 'subject', [
  field('subject', 'Subject', 'short_text', { required: true }),
  field('type', 'Type', 'select', { required: true, options: options('Call', 'Email', 'Meeting', 'Task', 'Follow-up') }),
  field('due_date', 'Due date', 'date'),
  field('completed', 'Completed', 'boolean', { defaultValue: false }),
  field('related_lead', 'Related lead', 'relation', { relation: { kind: 'many_to_one', targetEntityKey: 'leads', displayFieldKey: 'name' } }),
  field('notes', 'Notes', 'long_text'),
], 'calendar-check');

const deals = entity('deals', 'Deal', 'Deals', 'title', [
  field('title', 'Deal title', 'short_text', { required: true }),
  field('company', 'Company', 'relation', { relation: { kind: 'many_to_one', targetEntityKey: 'companies', displayFieldKey: 'name' } }),
  field('stage', 'Stage', 'status', { required: true, defaultValue: 'qualification', options: options('Qualification', 'Proposal', 'Negotiation', 'Won', 'Lost') }),
  field('value', 'Value', 'currency', { required: true, min: 0 }),
  field('expected_close', 'Expected close', 'date'),
  field('probability', 'Probability', 'percentage', { min: 0, max: 100 }),
], 'handshake');

const entities = [leads, companies, contacts, activities, deals];

const pages = [
  dashboardPage('dashboard', 'Sales dashboard', [
    { label: 'Open leads', entityKey: 'leads' },
    { label: 'Companies', entityKey: 'companies' },
    { label: 'Contacts', entityKey: 'contacts' },
    { label: 'Open deals', entityKey: 'deals' },
  ], { entityKey: 'deals', groupByFieldKey: 'stage', title: 'Pipeline by stage' }),
  listPage('leads', 'Leads', 'leads', 'user-plus', ['name', 'email', 'company_name', 'source', 'status', 'estimated_value']),
  listPage('companies', 'Companies', 'companies', 'building-2', ['name', 'industry', 'city', 'employee_count']),
  listPage('contacts', 'Contacts', 'contacts', 'contact', ['name', 'email', 'job_title', 'phone']),
  {
    ...listPage('pipeline', 'Pipeline', 'deals', 'kanban', ['title', 'stage', 'value']),
    components: [
      { id: sampleId('cmp', 'pipeline_heading'), type: 'heading', props: { text: 'Deal pipeline', level: 1 } },
      { id: sampleId('cmp', 'pipeline_kanban'), type: 'kanban', props: { groupByFieldKey: 'stage' }, dataSource: { entityKey: 'deals' } },
    ],
  },
  listPage('activities', 'Activities', 'activities', 'calendar-check', ['subject', 'type', 'due_date', 'completed']),
];

const workflows = [
  notifyWorkflow('crm', 'Lead created alert', 'leads', 'A new lead was added to your pipeline.'),
  {
    ...notifyWorkflow('crm', 'Lead status follow-up', 'leads', 'Lead status changed — a follow-up activity was scheduled.'),
    trigger: { type: 'record_updated' as const, entityKey: 'leads' },
  },
  notifyWorkflow('crm', 'Deal won celebration', 'deals', 'Congratulations — a deal was marked as won.'),
];

export const crmSample: ApplicationDefinition = baseDefinition(
  'simple_crm',
  'Simple CRM',
  'Track leads, companies, contacts, activities and deals through a clear sales pipeline.',
  'crm',
  'users',
  entities,
  pages,
  workflows,
);
