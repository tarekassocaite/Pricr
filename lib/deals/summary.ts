import type { TableRow } from '@/types/supabase';

type Deal = Pick<TableRow<'deals'>, 'amount' | 'outcome'>;

export type DealPriceBucketSummary = {
  label: string;
  min_amount_gbp: number;
  max_amount_gbp: number;
  total_count: number;
  won_count: number;
  lost_count: number;
  win_rate: number;
};

export type DealPriceSummary = {
  total_deals: number;
  bucket_count: number;
  buckets: DealPriceBucketSummary[];
};

function resolveBucketCount(totalDeals: number) {
  if (totalDeals >= 120) return 6;
  if (totalDeals >= 40) return 5;
  return 4;
}

function formatCurrencyValue(value: number) {
  return `£${Math.round(value).toLocaleString('en-GB')}`;
}

export function summarizeDealsByPriceBuckets(deals: Deal[]): DealPriceSummary {
  const dealsWithAmount = deals.filter((deal): deal is Deal & { amount: number } => typeof deal.amount === 'number');

  if (dealsWithAmount.length === 0) {
    return {
      total_deals: 0,
      bucket_count: 0,
      buckets: []
    };
  }

  const amounts = dealsWithAmount.map((deal) => deal.amount);
  const minAmount = Math.min(...amounts);
  const maxAmount = Math.max(...amounts);
  const bucketCount = resolveBucketCount(dealsWithAmount.length);

  const width = minAmount === maxAmount ? 1 : (maxAmount - minAmount) / bucketCount;

  const buckets = Array.from({ length: bucketCount }, (_, index) => {
    const isLast = index === bucketCount - 1;
    const lowerBound = minAmount + width * index;
    const upperBound = isLast ? maxAmount : minAmount + width * (index + 1);

    return {
      label: `${formatCurrencyValue(lowerBound)}-${formatCurrencyValue(upperBound)}`,
      min_amount_gbp: Number(lowerBound.toFixed(2)),
      max_amount_gbp: Number(upperBound.toFixed(2)),
      total_count: 0,
      won_count: 0,
      lost_count: 0,
      win_rate: 0
    } satisfies DealPriceBucketSummary;
  });

  for (const deal of dealsWithAmount) {
    const relative = width === 0 ? 0 : (deal.amount - minAmount) / width;
    const bucketIndex = Math.min(Math.floor(relative), bucketCount - 1);
    const bucket = buckets[bucketIndex];

    bucket.total_count += 1;
    if (deal.outcome === 'won') bucket.won_count += 1;
    if (deal.outcome === 'lost') bucket.lost_count += 1;
  }

  for (const bucket of buckets) {
    bucket.win_rate = bucket.total_count === 0 ? 0 : Number((bucket.won_count / bucket.total_count).toFixed(4));
  }

  return {
    total_deals: dealsWithAmount.length,
    bucket_count: bucketCount,
    buckets
  };
}
