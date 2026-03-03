import { z } from 'zod';

export const agencyRoleCostsSchema = z.array(
  z.object({
    role: z.string().trim().min(1, 'Role is required'),
    costPerHour: z.number().positive('Cost per hour must be greater than 0')
  })
);

export const agencySettingsSchema = z.object({
  monthlyOverheads: z.number().positive('Monthly overheads must be greater than 0'),
  utilizationPct: z.number().min(1, 'Utilization must be at least 1').max(100, 'Utilization must be <= 100'),
  targetMarginPct: z.number().min(0, 'Target margin cannot be negative').max(100, 'Target margin must be <= 100'),
  currency: z.string().trim().length(3, 'Currency must be a 3-letter code').transform((value) => value.toUpperCase()),
  roleCosts: agencyRoleCostsSchema.min(1, 'At least one role cost is required')
});

export const offeringRoleMixSchema = z.array(
  z.object({
    role: z.string().trim().min(1, 'Role is required'),
    percentage: z.number().positive('Percentage must be greater than 0').max(100, 'Percentage must be <= 100')
  })
);

export const offeringSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1, 'Offering name is required'),
  unitType: z.enum(['fixed', 'retainer']),
  baselineHours: z.number().positive('Baseline hours must be greater than 0'),
  roleMix: offeringRoleMixSchema.optional().default([])
});

export const offeringsSchema = z.array(offeringSchema);

export const onboardingPayloadSchema = z.object({
  agencySettings: agencySettingsSchema,
  offerings: offeringsSchema
});

export type AgencyRoleCostsInput = z.infer<typeof agencyRoleCostsSchema>;
export type OfferingRoleMixInput = z.infer<typeof offeringRoleMixSchema>;
export type OnboardingPayloadInput = z.infer<typeof onboardingPayloadSchema>;
