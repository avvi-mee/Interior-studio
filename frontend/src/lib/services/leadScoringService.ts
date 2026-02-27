export interface LeadScoringThresholds {
  hotAmount: number;   // Amount >= this = Hot lead
  warmAmount: number;  // Amount >= this = Warm lead
  // Below warmAmount = Cold lead
}

export const DEFAULT_THRESHOLDS: LeadScoringThresholds = {
  hotAmount: 1000000,  // ₹10,00,000
  warmAmount: 500000,  // ₹5,00,000
};

export function deriveTemperature(
  totalAmount: number,
  thresholds: LeadScoringThresholds
): "hot" | "warm" | "cold" {
  if (totalAmount >= thresholds.hotAmount) return "hot";
  if (totalAmount >= thresholds.warmAmount) return "warm";
  return "cold";
}

export function temperatureToScore(temperature: "hot" | "warm" | "cold"): number {
  if (temperature === "hot") return 90;
  if (temperature === "warm") return 55;
  return 20;
}
