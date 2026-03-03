import { NextResponse } from 'next/server';
import { z } from 'zod';

import { getSupabaseServerClient } from '@/lib/supabase/server';

const payloadSchema = z.object({
  client_domain: z.string().trim().min(1),
  offering_id: z.string().uuid(),
  offering_name: z.string().trim().min(1),
  package_name: z.enum(['Essential', 'Standard', 'Premium']),
  timeline_weeks: z.number().min(1).max(52),
  total_price: z.number().positive(),
  assumptions: z.array(z.string()).default([]),
  exclusions: z.array(z.string()).default([]),
  type: z.enum(['proposal', 'sow'])
});

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);
}

export async function POST(request: Request) {
  try {
    const json = await request.json().catch(() => null);
    const parsed = payloadSchema.safeParse(json);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const scopeIntro =
      parsed.data.package_name === 'Essential'
        ? 'A lean execution package focused on critical outcomes.'
        : parsed.data.package_name === 'Standard'
          ? 'A balanced package combining strategy and execution.'
          : 'A high-touch package with expanded strategic support.';

    const markdown =
      parsed.data.type === 'proposal'
        ? `# Proposal - ${parsed.data.offering_name}

## Client
${parsed.data.client_domain}

## Package
${parsed.data.package_name}

## Investment
${formatCurrency(parsed.data.total_price)}

## Timeline
${parsed.data.timeline_weeks} weeks

## Scope Overview
${scopeIntro}

## Assumptions
${parsed.data.assumptions.length ? parsed.data.assumptions.map((item) => `- ${item}`).join('\n') : '- Client feedback is provided within agreed review windows.'}

## Exclusions
${parsed.data.exclusions.length ? parsed.data.exclusions.map((item) => `- ${item}`).join('\n') : '- Third-party tools and ad spend are excluded.'}

## Notes
Pricing guidance based on your inputs and historical patterns.
`
        : `# Statement of Work (SOW) - ${parsed.data.offering_name}

## Parties
- Service Provider: Pricr Agency
- Client: ${parsed.data.client_domain}

## Engagement
- Package: ${parsed.data.package_name}
- Timeline: ${parsed.data.timeline_weeks} weeks
- Fees: ${formatCurrency(parsed.data.total_price)}

## Deliverables
- Delivery aligned to agreed package scope.
- Weekly status reporting and milestone checkpoints.

## Assumptions
${parsed.data.assumptions.length ? parsed.data.assumptions.map((item) => `- ${item}`).join('\n') : '- Client will provide required access and approvals in a timely manner.'}

## Exclusions
${parsed.data.exclusions.length ? parsed.data.exclusions.map((item) => `- ${item}`).join('\n') : '- Legal, compliance, and paid media budgets are excluded.'}

## Disclaimer
Not legal advice. Review required.
`;

    const supabase = getSupabaseServerClient();
    const { data, error } = await supabase
      .from('documents')
      // Supabase generated types in this repo currently infer never for insert values.
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-expect-error Pending generated type fix.
      .insert({
        client_domain: parsed.data.client_domain.toLowerCase(),
        offering_id: parsed.data.offering_id,
        package_name: parsed.data.package_name,
        type: parsed.data.type,
        markdown,
        pdf_url: null
      })
      .select('*')
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      document: data,
      markdown,
      pdf_available: false,
      message: 'Document generated. Markdown preview is available as fallback.'
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate document' },
      { status: 500 }
    );
  }
}
