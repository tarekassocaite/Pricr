import { NextResponse } from 'next/server';
import { ZodError } from 'zod';

import { getSupabaseServerClient } from '@/lib/supabase/server';
import { csvDealRowSchema, importDealsRequestSchema } from '@/lib/validation/deals';
import type { TableInsert } from '@/types/supabase';

interface ParsedRow {
  rowNumber: number;
  raw: Record<string, string>;
}

interface RowError {
  rowNumber: number;
  message: string;
}

function parseCsv(csv: string): { headers: string[]; rows: ParsedRow[] } {
  const lines = csv
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (lines.length === 0) {
    return { headers: [], rows: [] };
  }

  const headers = lines[0].split(',').map((header) => header.trim());
  const rows: ParsedRow[] = lines.slice(1).map((line, index) => {
    const values = line.split(',').map((value) => value.trim());
    const raw = headers.reduce<Record<string, string>>((acc, header, columnIndex) => {
      acc[header] = values[columnIndex] ?? '';
      return acc;
    }, {});

    return {
      rowNumber: index + 2,
      raw
    };
  });

  return { headers, rows };
}

export async function POST(request: Request) {
  const json = await request.json().catch(() => null);
  const parsed = importDealsRequestSchema.safeParse(json);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const requiredColumns = ['close_date', 'amount', 'currency', 'outcome', 'description', 'client_domain'];
  const { headers, rows } = parseCsv(parsed.data.csv);

  if (headers.length === 0) {
    return NextResponse.json({ error: 'CSV is empty' }, { status: 400 });
  }

  const missingColumns = requiredColumns.filter((column) => !headers.includes(column));
  if (missingColumns.length > 0) {
    return NextResponse.json(
      {
        error: `Missing required columns: ${missingColumns.join(', ')}`
      },
      { status: 400 }
    );
  }

  const rowErrors: RowError[] = [];
  const validDeals: Array<TableInsert<'deals'>> = [];
  const previewRows = rows.map((row) => {
    try {
      const validated = csvDealRowSchema.parse(row.raw);
      const closeDate = new Date(validated.close_date);

      if (Number.isNaN(closeDate.getTime())) {
        throw new Error('close_date must be a valid date');
      }

      const amount = validated.amount === '' ? null : Number(validated.amount);
      if (amount !== null && Number.isNaN(amount)) {
        throw new Error('amount must be a number when provided');
      }

      validDeals.push({
        close_date: closeDate.toISOString().slice(0, 10),
        amount,
        currency: validated.currency,
        outcome: validated.outcome,
        description: validated.description,
        client_domain: validated.client_domain,
        offering_id: validated.offering_id || null
      });

      return {
        rowNumber: row.rowNumber,
        ...row.raw,
        status: 'valid' as const
      };
    } catch (error) {
      const message =
        error instanceof ZodError
          ? error.issues[0]?.message ?? 'Invalid row'
          : error instanceof Error
            ? error.message
            : 'Invalid row';

      rowErrors.push({ rowNumber: row.rowNumber, message });

      return {
        rowNumber: row.rowNumber,
        ...row.raw,
        status: 'error' as const,
        error: message
      };
    }
  });

  if (parsed.data.dryRun) {
    return NextResponse.json({
      importedRows: 0,
      validRows: validDeals.length,
      invalidRows: rowErrors.length,
      columns: headers,
      rowErrors,
      previewRows,
      message: 'CSV validated. Ready to import valid rows.'
    });
  }

  if (validDeals.length === 0) {
    return NextResponse.json(
      {
        importedRows: 0,
        validRows: 0,
        invalidRows: rowErrors.length,
        columns: headers,
        rowErrors,
        previewRows,
        message: 'No valid rows to import.'
      },
      { status: 400 }
    );
  }

  const supabase = getSupabaseServerClient();
  const { data: insertedRows, error } = await supabase
    .from('deals')
    // Supabase generated types in this repo currently infer never for insert values.
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-expect-error Pending generated type fix.
    .insert(validDeals)
    .select('id');

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    importedRows: insertedRows?.length ?? validDeals.length,
    validRows: validDeals.length,
    invalidRows: rowErrors.length,
    columns: headers,
    rowErrors,
    previewRows,
    message: 'CSV import completed.'
  });
}
