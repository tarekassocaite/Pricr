import { NextResponse } from 'next/server';
import { z } from 'zod';

import { getSupabaseServerClient } from '@/lib/supabase/server';

type InputDeal = { id: string; description: string };
type InputOffering = { id: string; name: string };
type Classification = { deal_id: string; offering_id: string; confidence: number; rationale: string };

const payloadSchema = z.object({
  deals: z
    .array(
      z.object({
        id: z.string().uuid(),
        description: z.string().min(1)
      })
    )
    .min(1),
  offerings: z
    .array(
      z.object({
        id: z.string().uuid(),
        name: z.string().min(1)
      })
    )
    .min(1)
});

const classificationSchema = z.object({
  deal_id: z.string().uuid(),
  offering_id: z.string().uuid(),
  confidence: z.number().min(0).max(1),
  rationale: z.string().min(1)
});

const outputSchema = z.object({
  classifications: z.array(classificationSchema)
});

type ClassificationOutput = { classifications: Classification[] };

function parseOutputJson(rawContent: string) {
  const cleaned = rawContent.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```$/i, '').trim();
  return JSON.parse(cleaned);
}

function validateClassificationCoverage(
  output: ClassificationOutput,
  dealIds: Set<string>,
  offeringIds: Set<string>
): { ok: true } | { ok: false; message: string; details?: unknown } {
  const invalidReferences = output.classifications.filter(
    (item: Classification) => !dealIds.has(item.deal_id) || !offeringIds.has(item.offering_id)
  );

  if (invalidReferences.length > 0) {
    return {
      ok: false,
      message: 'Model returned unknown deal_id or offering_id references.',
      details: invalidReferences
    };
  }

  const seen = new Set<string>();
  const duplicateDeals = output.classifications.filter((item: Classification) => {
    if (seen.has(item.deal_id)) {
      return true;
    }
    seen.add(item.deal_id);
    return false;
  });

  if (duplicateDeals.length > 0) {
    return {
      ok: false,
      message: 'Model returned duplicate classifications for a deal_id.',
      details: duplicateDeals
    };
  }

  const missingDealIds = [...dealIds].filter((dealId) => !seen.has(dealId));
  if (missingDealIds.length > 0) {
    return {
      ok: false,
      message: 'Model did not classify every input deal.',
      details: missingDealIds
    };
  }

  return { ok: true };
}

async function classifyDealsWithOpenAI(input: z.infer<typeof payloadSchema>) {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error('Missing OPENAI_API_KEY');
  }

  const systemPrompt =
    'You are a sales ops assistant. Match each deal to exactly one offering. Return strict JSON only with no markdown.';

  const userPrompt = JSON.stringify(
    {
      task: 'Classify each deal to exactly one offering with confidence and concise rationale.',
      deals: input.deals,
      offerings: input.offerings,
      response_format: {
        classifications: [
          {
            deal_id: 'uuid from input deals',
            offering_id: 'uuid from input offerings',
            confidence: 'number between 0 and 1',
            rationale: 'brief reason'
          }
        ]
      }
    },
    null,
    2
  );

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL ?? 'gpt-4.1-mini',
        temperature: 0,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ]
      })
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`OpenAI request failed (${response.status}): ${body}`);
    }

    const completion = await response.json();
    const content: string | undefined = completion?.choices?.[0]?.message?.content;

    if (!content) {
      if (attempt === 1) {
        throw new Error('OpenAI returned an empty response content');
      }
      continue;
    }

    try {
      const parsedJson = parseOutputJson(content);
      return outputSchema.parse(parsedJson);
    } catch {
      if (attempt === 1) {
        throw new Error('OpenAI returned invalid JSON response');
      }
    }
  }

  throw new Error('Unable to classify deals');
}

export async function POST(request: Request) {
  const json = await request.json().catch(() => null);
  const parsed = payloadSchema.safeParse(json);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const output = await classifyDealsWithOpenAI(parsed.data);
    const dealIds = new Set<string>(parsed.data.deals.map((deal: InputDeal) => deal.id));
    const offeringIds = new Set<string>(parsed.data.offerings.map((offering: InputOffering) => offering.id));

    const coverage = validateClassificationCoverage(output, dealIds, offeringIds);
    if (!coverage.ok) {
      return NextResponse.json({ error: coverage.message, details: coverage.details }, { status: 422 });
    }

    const supabase = getSupabaseServerClient();

    for (const classification of output.classifications) {
      const { error } = await supabase
        .from('deals')
        .update({ offering_id: classification.offering_id })
        .eq('id', classification.deal_id);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
    }

    return NextResponse.json(output);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Classification failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
