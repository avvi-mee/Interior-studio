export type TimePreset = "today" | "this_week" | "this_month" | "this_quarter" | "this_year" | "custom";

export interface DateRange {
  start: Date;
  end: Date;
}

export function getDateRangeForPreset(preset: TimePreset): DateRange {
  const now = new Date();
  const end = now;
  let start: Date;

  switch (preset) {
    case "today":
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      break;
    case "this_week": {
      const day = now.getDay(); // 0 = Sunday
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - day);
      break;
    }
    case "this_month":
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      break;
    case "this_quarter": {
      const quarterMonth = Math.floor(now.getMonth() / 3) * 3;
      start = new Date(now.getFullYear(), quarterMonth, 1);
      break;
    }
    case "this_year":
      start = new Date(now.getFullYear(), 0, 1);
      break;
    default:
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      break;
  }

  return { start, end };
}

export function groupByTimeBucket(
  items: Array<{ createdAt: any }>,
  dateRange: DateRange
): Array<{ date: string; count: number }> {
  const diffDays = Math.ceil(
    (dateRange.end.getTime() - dateRange.start.getTime()) / 86400000
  );

  const buckets = new Map<string, number>();

  for (const item of items) {
    const ts = item.createdAt?.toMillis
      ? item.createdAt.toMillis()
      : item.createdAt instanceof Date
      ? item.createdAt.getTime()
      : null;
    if (!ts) continue;

    const d = new Date(ts);
    let key: string;

    if (diffDays < 14) {
      // Group by day
      key = d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
    } else if (diffDays < 90) {
      // Group by week (start of week)
      const weekStart = new Date(d);
      weekStart.setDate(d.getDate() - d.getDay());
      key = weekStart.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
    } else {
      // Group by month
      key = d.toLocaleDateString("en-IN", { month: "short", year: "2-digit" });
    }

    buckets.set(key, (buckets.get(key) || 0) + 1);
  }

  return Array.from(buckets.entries()).map(([date, count]) => ({ date, count }));
}

export function groupByMonth(
  items: Array<{ createdAt: any; [key: string]: any }>,
  valueKeys: string[]
): Array<Record<string, any>> {
  const buckets = new Map<string, Record<string, number>>();

  for (const item of items) {
    const ts = item.createdAt?.toMillis
      ? item.createdAt.toMillis()
      : item.createdAt instanceof Date
      ? item.createdAt.getTime()
      : null;
    if (!ts) continue;

    const d = new Date(ts);
    const key = d.toLocaleDateString("en-IN", { month: "short", year: "2-digit" });

    if (!buckets.has(key)) {
      const init: Record<string, number> = {};
      for (const vk of valueKeys) init[vk] = 0;
      buckets.set(key, init);
    }

    const bucket = buckets.get(key)!;
    for (const vk of valueKeys) {
      bucket[vk] += Number(item[vk]) || 0;
    }
  }

  return Array.from(buckets.entries()).map(([month, values]) => ({
    month,
    ...values,
  }));
}

export function formatCurrency(amount: number): string {
  if (amount >= 10000000) return `₹${(amount / 10000000).toFixed(1)}Cr`;
  if (amount >= 100000) return `₹${(amount / 100000).toFixed(1)}L`;
  return `₹${amount.toLocaleString("en-IN")}`;
}
