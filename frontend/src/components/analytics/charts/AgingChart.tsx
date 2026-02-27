"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { formatCurrency } from "@/lib/analyticsHelpers";

interface AgingBucket {
  current: number;
  thirtyOne: number;
  sixtyOne: number;
  ninetyPlus: number;
}

interface AgingChartProps {
  receivable: AgingBucket;
  payable: AgingBucket;
}

export default function AgingChart({ receivable, payable }: AgingChartProps) {
  const data = [
    {
      bucket: "0-30 days",
      Receivable: receivable.current,
      Payable: payable.current,
    },
    {
      bucket: "31-60 days",
      Receivable: receivable.thirtyOne,
      Payable: payable.thirtyOne,
    },
    {
      bucket: "61-90 days",
      Receivable: receivable.sixtyOne,
      Payable: payable.sixtyOne,
    },
    {
      bucket: "90+ days",
      Receivable: receivable.ninetyPlus,
      Payable: payable.ninetyPlus,
    },
  ];

  const hasData = data.some((d) => d.Receivable > 0 || d.Payable > 0);
  if (!hasData) {
    return (
      <div className="flex items-center justify-center h-[300px] text-sm text-muted-foreground">
        No aging data available
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data} margin={{ left: 10, right: 10 }}>
        <XAxis dataKey="bucket" tick={{ fontSize: 12, fill: "#8b8ba7" }} stroke="rgba(255,255,255,0.06)" />
        <YAxis
          tick={{ fontSize: 12, fill: "#8b8ba7" }}
          tickFormatter={(v) => formatCurrency(v)}
          stroke="rgba(255,255,255,0.06)"
        />
        <Tooltip
          contentStyle={{
            background: "#161625",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 8,
            fontSize: 13,
            color: "#f0f0f5",
          }}
          formatter={(value) => [formatCurrency(Number(value))]}
        />
        <Legend
          verticalAlign="bottom"
          iconType="circle"
          iconSize={8}
          wrapperStyle={{ fontSize: 12, color: "#8b8ba7" }}
        />
        <Bar
          dataKey="Receivable"
          fill="#3B82F6"
          radius={[4, 4, 0, 0]}
          maxBarSize={30}
        />
        <Bar
          dataKey="Payable"
          fill="#F59E0B"
          radius={[4, 4, 0, 0]}
          maxBarSize={30}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
