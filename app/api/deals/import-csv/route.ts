import { NextResponse } from 'next/server';
import { z } from 'zod';

const payloadSchema = z.object({
  csv: z.string().min(1, 'csv is required')
});

export async function POST(request: Request) {
  const json = await request.json().catch(() => null);
  const parsed = payloadSchema.safeParse(json);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const [header, ...rows] = parsed.data.csv.trim().split(/\r?\n/);
  const columns = header.split(',').map((value) => value.trim());

  return NextResponse.json({
    importedRows: rows.length,
    columns,
    message: 'CSV import accepted for processing.'
  });
}
