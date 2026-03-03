import { NextResponse } from 'next/server';

import { getSupabaseServerClient } from '@/lib/supabase/server';
import type { TableInsert } from '@/types/supabase';

type CsvErrorRow = {
  row: number;
  errors: string[];
};

type CsvRow = Record<string, string>;

const REQUIRED_COLUMNS = ['close_date', 'outcome', 'description', 'client_domain'] as const;

function parseCsvLine(line: string) {
  const values: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === ',' && !inQuotes) {
      values.push(current.trim());
      current = '';
      continue;
    }

    current += char;
  }

  values.push(current.trim());
  return values;
}

function parseCsv(csvText: string) {
  const lines = csvText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    return { headers: [], rows: [] as CsvRow[] };
  }

  const headers = parseCsvLine(lines[0]).map((header) => header.toLowerCase());
  const rows = lines.slice(1).map((line) => {
    const values = parseCsvLine(line);
    return headers.reduce<CsvRow>((acc, header, index) => {
      acc[header] = values[index] ?? '';
      return acc;
    }, {});
  });

  return { headers, rows };
}

function parseAmount(raw: string) {
  const normalized = raw.replace(/[£$,\s]/g, '');
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function validateAndMapRow(row: CsvRow, rowNumber: number) {
  const errors: string[] = [];

  for (const column of REQUIRED_COLUMNS) {
    if (!row[column] || row[column].trim().length === 0) {
      errors.push(`Missing ${column}`);
    }
  }

  const amountRaw = row.amount_gbp || row.amount;
  if (!amountRaw || amountRaw.trim().length === 0) {
    errors.push('Missing amount_gbp or amount');
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(row.close_date || '')) {
    errors.push('close_date must use YYYY-MM-DD');
  }

  if (!['won', 'lost'].includes((row.outcome || '').toLowerCase())) {
    errors.push('outcome must be won or lost');
  }

  const amount = amountRaw ? parseAmount(amountRaw) : null;
  if (amountRaw && amount === null) {
    errors.push('Amount must be a valid number');
  }

  if (errors.length > 0) {
    return {
      deal: null,
      error: { row: rowNumber, errors } satisfies CsvErrorRow
    };
  }

  const deal: TableInsert<'deals'> = {
    close_date: row.close_date,
    amount,
    currency: 'GBP',
    outcome: row.outcome.toLowerCase() as 'won' | 'lost',
    description: row.description,
    client_domain: row.client_domain.toLowerCase()
  };

  return { deal, error: null };
}

export async function POST(request: Request) {
  const formData = await request.formData().catch(() => null);
  const fileEntry = formData?.get('file');

  if (!(fileEntry instanceof File)) {
    return NextResponse.json({ error: 'Expected multipart upload with a file field named "file".' }, { status: 400 });
  }

  const csvText = await fileEntry.text();
  const { headers, rows } = parseCsv(csvText);

  const hasAllRequiredColumns = REQUIRED_COLUMNS.every((column) => headers.includes(column));
  const hasAmountColumn = headers.includes('amount_gbp') || headers.includes('amount');

  if (!hasAllRequiredColumns || !hasAmountColumn) {
    return NextResponse.json(
      {
        error:
          'Missing required CSV columns. Required: close_date, outcome, description, client_domain and one of amount_gbp|amount.'
      },
      { status: 400 }
    );
  }

  const validDeals: TableInsert<'deals'>[] = [];
  const errorRows: CsvErrorRow[] = [];

  rows.forEach((row, index) => {
    const { deal, error } = validateAndMapRow(row, index + 2);
    if (deal) {
      validDeals.push(deal);
      return;
    }
    if (error) {
      errorRows.push(error);
    }
  });

  if (validDeals.length > 0) {
    const supabase = getSupabaseServerClient();
    const { error } = await supabase
      .from('deals')
      // Supabase generated types in this repo currently infer never for insert values.
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-expect-error Pending generated type fix.
      .insert(validDeals);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  return NextResponse.json({
    inserted_count: validDeals.length,
    error_rows: errorRows
  });
}
