import { PageShell } from '@/components/page-shell';
import { DashboardWorkbench } from '@/components/dashboard-workbench';

export default function DashboardPage() {
  return (
    <PageShell title="Dashboard" description="Run transparent pricing simulations and inspect explainability signals.">
      <DashboardWorkbench />
    </PageShell>
  );
}
