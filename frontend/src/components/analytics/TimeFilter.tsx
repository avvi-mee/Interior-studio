"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  TimePreset,
  DateRange,
  getDateRangeForPreset,
} from "@/lib/analyticsHelpers";

const PRESETS: Array<{ label: string; value: TimePreset }> = [
  { label: "Today", value: "today" },
  { label: "This Week", value: "this_week" },
  { label: "This Month", value: "this_month" },
  { label: "This Quarter", value: "this_quarter" },
  { label: "This Year", value: "this_year" },
  { label: "Custom", value: "custom" },
];

interface TimeFilterProps {
  value: TimePreset;
  dateRange: DateRange;
  onChange: (preset: TimePreset, range: DateRange) => void;
}

function toInputDate(d: Date): string {
  return d.toISOString().split("T")[0];
}

export default function TimeFilter({
  value,
  dateRange,
  onChange,
}: TimeFilterProps) {
  const handlePreset = (preset: TimePreset) => {
    if (preset === "custom") {
      onChange("custom", dateRange);
    } else {
      onChange(preset, getDateRangeForPreset(preset));
    }
  };

  const handleCustomDate = (field: "start" | "end", dateStr: string) => {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return;
    const newRange = {
      ...dateRange,
      [field]: field === "end"
        ? new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59)
        : new Date(d.getFullYear(), d.getMonth(), d.getDate()),
    };
    onChange("custom", newRange);
  };

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {PRESETS.map((preset) => (
        <Button
          key={preset.value}
          size="sm"
          variant={value === preset.value ? "default" : "outline"}
          className="h-8 text-xs"
          onClick={() => handlePreset(preset.value)}
        >
          {preset.label}
        </Button>
      ))}
      {value === "custom" && (
        <div className="flex items-center gap-1.5">
          <Input
            type="date"
            className="h-8 text-xs w-[130px]"
            value={toInputDate(dateRange.start)}
            onChange={(e) => handleCustomDate("start", e.target.value)}
          />
          <span className="text-xs text-muted-foreground">to</span>
          <Input
            type="date"
            className="h-8 text-xs w-[130px]"
            value={toInputDate(dateRange.end)}
            onChange={(e) => handleCustomDate("end", e.target.value)}
          />
        </div>
      )}
    </div>
  );
}
