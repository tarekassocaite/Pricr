import { PageShell } from '@/components/page-shell';
import { ClientsWorkbench } from '@/components/clients-workbench';

export default function ClientsPage() {
  return (
    <PageShell title="Clients" description="Run enrichment jobs and maintain account-level context.">
      <ClientsWorkbench />
    </PageShell>
  );
}
