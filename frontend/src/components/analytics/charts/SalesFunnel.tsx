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

const STAGE_COLORS: Record<string, string> = {
  new: "#3B82F6",
  contacted: "#6366F1",
  qualified: "#8B5CF6",
  proposal_sent: "#A855F7",
  negotiation: "#F59E0B",
  approved: "#10B981",
  converted: "#059669",
  lost: "#EF4444",
};

const STAGE_LABELS: Record<string, string> = {
  new: "New",
  contacted: "Contacted",
  qualified: "Qualified",
  proposal_sent: "Proposal Sent",
  negotiation: "Negotiation",
  approved: "Approved",
  converted: "Converted",
  lost: "Lost",
};

interface SalesFunnelProps {
  data: Array<{ stage: string; count: number }>;
}

export default function SalesFunnel({ data }: SalesFunnelProps) {
  const chartData = data.map((d) => ({
    ...d,
    label: STAGE_LABELS[d.stage] || d.stage,
  }));

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={chartData} layout="vertical" margin={{ left: 20, right: 20 }}>
        <XAxis type="number" allowDecimals={false} tick={{ fill: "#8b8ba7", fontSize: 12 }} stroke="rgba(255,255,255,0.06)" />
        <YAxis
          type="category"
          dataKey="label"
          width={100}
          tick={{ fontSize: 12, fill: "#8b8ba7" }}
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
        />
        <Bar dataKey="count" radius={[0, 4, 4, 0]} maxBarSize={28}>
          {chartData.map((entry, i) => (
            <Cell
              key={i}
              fill={STAGE_COLORS[data[i]?.stage] || "#94A3B8"}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
