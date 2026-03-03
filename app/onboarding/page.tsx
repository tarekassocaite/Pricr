import { PageShell } from '@/components/page-shell';
import { OnboardingForm } from '@/components/onboarding-form';

export default function OnboardingPage() {
  return (
    <PageShell title="Onboarding" description="Set your agency economics, role costs, and service offerings.">
      <OnboardingForm />
    </PageShell>
  );
}
