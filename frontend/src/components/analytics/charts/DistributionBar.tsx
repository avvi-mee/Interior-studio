"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

interface DistributionBarProps {
  data: Array<{ label: string; value: number; color?: string }>;
  layout?: "horizontal" | "vertical";
  formatValue?: (v: number) => string;
}

const DEFAULT_COLOR = "#3B82F6";

export default function DistributionBar({
  data,
  layout = "horizontal",
  formatValue,
}: DistributionBarProps) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-[300px] text-sm text-muted-foreground">
        No data available
      </div>
    );
  }

  const isVertical = layout === "vertical";

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart
        data={data}
        layout={isVertical ? "vertical" : "horizontal"}
        margin={{ left: isVertical ? 20 : 0, right: 10 }}
      >
        {isVertical ? (
          <>
            <XAxis type="number" allowDecimals={false} tickFormatter={formatValue} tick={{ fill: "#8b8ba7", fontSize: 12 }} stroke="rgba(255,255,255,0.06)" />
            <YAxis type="category" dataKey="label" width={100} tick={{ fontSize: 12, fill: "#8b8ba7" }} stroke="rgba(255,255,255,0.06)" />
          </>
        ) : (
          <>
            <XAxis dataKey="label" tick={{ fontSize: 12, fill: "#8b8ba7" }} stroke="rgba(255,255,255,0.06)" />
            <YAxis allowDecimals={false} tickFormatter={formatValue} tick={{ fill: "#8b8ba7", fontSize: 12 }} stroke="rgba(255,255,255,0.06)" />
          </>
        )}
        <Tooltip
          contentStyle={{
            background: "#161625",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 8,
            fontSize: 13,
            color: "#f0f0f5",
          }}
          formatter={(value) => [
            formatValue ? formatValue(Number(value)) : value,
          ]}
        />
        <Bar
          dataKey="value"
          radius={isVertical ? [0, 4, 4, 0] : [4, 4, 0, 0]}
          maxBarSize={40}
        >
          {data.map((entry, i) => (
            <Cell key={i} fill={entry.color || DEFAULT_COLOR} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
