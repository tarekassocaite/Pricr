import { PageShell } from '@/components/page-shell';
import { DocumentsWorkbench } from '@/components/documents-workbench';

export default function DocumentsPage() {
  return (
    <PageShell title="Documents" description="Generate proposal and SOW drafts from selected pricing packages.">
      <DocumentsWorkbench />
    </PageShell>
  );
}
