"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

interface TrendLineProps {
  data: Array<Record<string, any>>;
  xKey: string;
  lines: Array<{ key: string; color: string; name: string }>;
  formatYAxis?: (v: number) => string;
}

export default function TrendLine({
  data,
  xKey,
  lines,
  formatYAxis,
}: TrendLineProps) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-[300px] text-sm text-muted-foreground">
        No data available
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data} margin={{ left: 10, right: 10 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
        <XAxis dataKey={xKey} tick={{ fontSize: 12, fill: "#8b8ba7" }} stroke="rgba(255,255,255,0.06)" />
        <YAxis
          tick={{ fontSize: 12, fill: "#8b8ba7" }}
          tickFormatter={formatYAxis}
          allowDecimals={false}
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
          formatter={(value, name) => [
            formatYAxis ? formatYAxis(Number(value)) : value,
            name,
          ]}
        />
        <Legend
          verticalAlign="bottom"
          iconType="circle"
          iconSize={8}
          wrapperStyle={{ fontSize: 12, color: "#8b8ba7" }}
        />
        {lines.map((line) => (
          <Line
            key={line.key}
            type="monotone"
            dataKey={line.key}
            stroke={line.color}
            name={line.name}
            strokeWidth={2}
            dot={{ r: 3 }}
            activeDot={{ r: 5 }}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
