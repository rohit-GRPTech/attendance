import { useMemo, useState } from 'react';
import type { EntityDef, EntityFieldDef } from '@appforge/shared';
import { Button } from '@/components/ui/button';
import { Checkbox, FormField, Input, Select, Textarea } from '@/components/ui/input';
import { useRecords } from '@/features/records/api';

/**
 * Runtime form generated from an entity definition. Mirrors server-side
 * validation for UX; the API remains the final authority.
 */
export function RecordForm({
  appId, entity, entities, initialData, submitLabel = 'Save', onSubmit, submitting, fields,
}: {
  appId: string;
  entity: EntityDef;
  entities: EntityDef[];
  initialData?: Record<string, unknown>;
  submitLabel?: string;
  submitting?: boolean;
  onSubmit: (data: Record<string, unknown>) => void;
  /** Optional subset of field keys to render. */
  fields?: string[];
}) {
  const visibleFields = useMemo(
    () =>
      entity.fields.filter(
        (f) => !f.hidden && !f.readOnly && f.type !== 'auto_number' && f.type !== 'uuid' && (!fields || fields.includes(f.key)),
      ),
    [entity, fields],
  );
  const [values, setValues] = useState<Record<string, unknown>>(() => ({ ...(initialData ?? {}) }));
  const [errors, setErrors] = useState<Record<string, string>>({});

  const setValue = (key: string, value: unknown) => {
    setValues((v) => ({ ...v, [key]: value }));
    setErrors((e) => ({ ...e, [key]: '' }));
  };

  const validate = (): boolean => {
    const next: Record<string, string> = {};
    for (const field of visibleFields) {
      const value = values[field.key];
      const empty = value === undefined || value === null || value === '';
      if (field.required && empty) next[field.key] = `${field.label} is required.`;
      else if (!empty && field.type === 'email' && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(value)))
        next[field.key] = 'Enter a valid email address.';
      else if (!empty && ['number', 'decimal', 'currency', 'percentage'].includes(field.type)) {
        const num = Number(value);
        if (Number.isNaN(num)) next[field.key] = 'Enter a number.';
        else if (field.min !== undefined && num < field.min) next[field.key] = `Must be at least ${field.min}.`;
        else if (field.max !== undefined && num > field.max) next[field.key] = `Must be at most ${field.max}.`;
      }
    }
    setErrors(next);
    return Object.values(next).every((v) => !v);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    const cleaned: Record<string, unknown> = {};
    for (const field of visibleFields) {
      const value = values[field.key];
      if (value === undefined || value === '') continue;
      cleaned[field.key] = ['number', 'decimal', 'currency', 'percentage'].includes(field.type) ? Number(value) : value;
    }
    onSubmit(cleaned);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      {visibleFields.map((field) => (
        <FormField key={field.id} label={field.label} required={field.required} error={errors[field.key]} hint={field.description}>
          {(id) => (
            <RecordFieldInput
              id={id}
              appId={appId}
              field={field}
              entities={entities}
              value={values[field.key]}
              onChange={(v) => setValue(field.key, v)}
            />
          )}
        </FormField>
      ))}
      <div className="flex justify-end gap-2 pt-2">
        <Button type="submit" loading={submitting}>{submitLabel}</Button>
      </div>
    </form>
  );
}

function RecordFieldInput({
  id, appId, field, entities, value, onChange,
}: {
  id: string;
  appId: string;
  field: EntityFieldDef;
  entities: EntityDef[];
  value: unknown;
  onChange: (v: unknown) => void;
}) {
  switch (field.type) {
    case 'long_text':
    case 'rich_text':
      return <Textarea id={id} value={String(value ?? '')} placeholder={field.placeholder} onChange={(e) => onChange(e.target.value)} />;
    case 'number':
    case 'decimal':
    case 'currency':
    case 'percentage':
      return <Input id={id} type="number" inputMode="decimal" value={String(value ?? '')} min={field.min} max={field.max} onChange={(e) => onChange(e.target.value)} />;
    case 'boolean':
      return <Checkbox label={field.placeholder ?? 'Yes'} checked={Boolean(value)} onChange={onChange} />;
    case 'date':
      return <Input id={id} type="date" value={String(value ?? '')} onChange={(e) => onChange(e.target.value)} />;
    case 'datetime':
      return <Input id={id} type="datetime-local" value={String(value ?? '')} onChange={(e) => onChange(e.target.value)} />;
    case 'time':
      return <Input id={id} type="time" value={String(value ?? '')} onChange={(e) => onChange(e.target.value)} />;
    case 'email':
      return <Input id={id} type="email" value={String(value ?? '')} placeholder={field.placeholder} onChange={(e) => onChange(e.target.value)} />;
    case 'phone':
      return <Input id={id} type="tel" value={String(value ?? '')} placeholder={field.placeholder} onChange={(e) => onChange(e.target.value)} />;
    case 'url':
      return <Input id={id} type="url" value={String(value ?? '')} placeholder="https://" onChange={(e) => onChange(e.target.value)} />;
    case 'select':
    case 'status':
      return (
        <Select id={id} value={String(value ?? '')} onChange={(e) => onChange(e.target.value)}>
          <option value="">Select…</option>
          {(field.options ?? []).map((o) => <option key={o.id} value={o.value}>{o.label}</option>)}
        </Select>
      );
    case 'relation':
      return <RelationSelect id={id} appId={appId} field={field} entities={entities} value={value} onChange={onChange} />;
    default:
      return <Input id={id} value={String(value ?? '')} placeholder={field.placeholder} onChange={(e) => onChange(e.target.value)} />;
  }
}

function RelationSelect({
  id, appId, field, entities, value, onChange,
}: {
  id: string; appId: string; field: EntityFieldDef; entities: EntityDef[];
  value: unknown; onChange: (v: unknown) => void;
}) {
  const target = entities.find((e) => e.key === field.relation?.targetEntityKey);
  const records = useRecords(appId, target?.key, { pageSize: 100 });
  const displayKey = field.relation?.displayFieldKey ?? target?.displayFieldKey ?? 'name';
  return (
    <Select id={id} value={String(value ?? '')} onChange={(e) => onChange(e.target.value)}>
      <option value="">Select {target?.name.toLowerCase() ?? 'record'}…</option>
      {(records.data?.data ?? []).map((r) => (
        <option key={r.id} value={r.id}>{String(r.data[displayKey] ?? r.id)}</option>
      ))}
    </Select>
  );
}
