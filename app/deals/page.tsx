import { PageShell } from '@/components/page-shell';
import { DealsWorkbench } from '@/components/deals-workbench';

export default function DealsPage() {
  return (
    <PageShell title="Deals" description="Track and classify opportunities from imported CSVs.">
      <DealsWorkbench />
    </PageShell>
  );
}
