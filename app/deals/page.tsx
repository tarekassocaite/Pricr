import { PageShell } from '@/components/page-shell';
import { Button } from '@/components/ui/button';

export default function DealsPage() {
  return (
    <PageShell title="Deals" description="Track and classify opportunities from imported CSVs.">
      <div className="flex gap-3">
        <Button>Import CSV</Button>
        <Button variant="outline">Classify Deals</Button>
      </div>
    </PageShell>
  );
}
