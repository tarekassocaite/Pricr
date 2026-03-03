import { z } from 'zod';

export const dealOutcomeSchema = z.enum(['won', 'lost']);

export const importDealsRequestSchema = z.object({
  csv: z.string().min(1, 'csv is required'),
  dryRun: z.boolean().optional().default(false)
});

export const csvDealRowSchema = z.object({
  close_date: z.string().trim().min(1, 'close_date is required'),
  amount: z.string().trim().optional().default(''),
  currency: z.string().trim().length(3, 'currency must be 3 letters').transform((value) => value.toUpperCase()),
  outcome: dealOutcomeSchema,
  description: z.string().trim().min(1, 'description is required'),
  client_domain: z.string().trim().min(1, 'client_domain is required'),
  offering_id: z.string().trim().optional().default('')
});

export const dealsFilterSchema = z.object({
  outcome: z.union([dealOutcomeSchema, z.literal('all')]).optional().default('all'),
  startDate: z.string().optional().default(''),
  endDate: z.string().optional().default(''),
  offeringId: z.string().optional().default('')
});

export type ImportDealsRequest = z.infer<typeof importDealsRequestSchema>;
export type CsvDealRowInput = z.infer<typeof csvDealRowSchema>;
export type DealsFilterInput = z.infer<typeof dealsFilterSchema>;
