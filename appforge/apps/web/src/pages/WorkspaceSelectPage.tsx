import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Boxes, Plus } from 'lucide-react';
import { branding } from '@appforge/shared';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { routes } from '@/routes';
import { Button } from '@/components/ui/button';
import { FormField, Input } from '@/components/ui/input';
import { Avatar, Badge, Card, Modal } from '@/components/ui/surfaces';
import { useToast } from '@/components/ui/overlays';
import { titleCase } from '@/lib/utils';

export function WorkspaceSelectPage() {
  const { session, selectWorkspace, applySession, signOut } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState('');

  const createWorkspace = useMutation({
    mutationFn: () => api.post<{ slug: string }>('/tenants', { name }),
    onSuccess: async () => {
      const { data } = await api.get<never>('/auth/me').catch(() => ({ data: null }));
      if (data) applySession(data);
      toast.success('Workspace created.');
      setCreateOpen(false);
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Could not create the workspace.'),
  });

  if (!session) return null;

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-lg">
        <div className="mb-6 flex items-center justify-center gap-2 text-lg font-semibold">
          <Boxes className="size-6 text-primary" aria-hidden />
          {branding.productName}
        </div>
        <Card className="p-6">
          <h1 className="text-lg font-semibold">Choose a workspace</h1>
          <p className="mt-1 text-sm text-muted-foreground">Signed in as {session.user.email}</p>
          <ul className="mt-5 space-y-2">
            {session.workspaces.map((w) => (
              <li key={w.id}>
                <button
                  className="flex w-full items-center gap-3 rounded-md border p-3 text-left transition-colors hover:border-primary/50 hover:bg-accent/40"
                  onClick={() => {
                    selectWorkspace(w.slug);
                    queryClient.clear();
                    navigate(routes.dashboard);
                  }}
                >
                  <Avatar name={w.name} size="lg" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{w.name}</span>
                    <span className="block text-xs text-muted-foreground">{titleCase(w.role)}</span>
                  </span>
                  <Badge tone="primary" className="capitalize">{w.planId}</Badge>
                </button>
              </li>
            ))}
          </ul>
          <div className="mt-5 flex items-center justify-between">
            <Button variant="outline" onClick={() => setCreateOpen(true)}><Plus /> New workspace</Button>
            <Button variant="ghost" onClick={() => { signOut(); navigate(routes.signIn); }}>Sign out</Button>
          </div>
        </Card>
      </div>

      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Create a workspace"
        description="A workspace holds your team, applications and data."
        footer={
          <>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={() => createWorkspace.mutate()} loading={createWorkspace.isPending} disabled={name.trim().length < 2}>
              Create workspace
            </Button>
          </>
        }
      >
        <FormField label="Workspace name" required>
          {(id) => <Input id={id} value={name} onChange={(e) => setName(e.target.value)} placeholder="Northwind Services" />}
        </FormField>
      </Modal>
    </div>
  );
}
