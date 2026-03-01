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

// --- Multi-Factor Lead Scoring ---

export interface ScoringWeights {
  budget: number;
  stageProgress: number;
  sourceQuality: number;
  hasEmail: number;
  followUpEngagement: number;
  responseTime: number;
  recency: number;
}

export const DEFAULT_SCORING_WEIGHTS: ScoringWeights = {
  budget: 25,
  stageProgress: 20,
  sourceQuality: 10,
  hasEmail: 5,
  followUpEngagement: 15,
  responseTime: 10,
  recency: 15,
};

export interface LeadScoringInput {
  totalAmount: number;
  stage: string;
  source: string;
  email: string;
  followUpCount: number;
  createdAt: any;
  lastContactedAt: any;
}

const STAGE_SCORES: Record<string, number> = {
  new: 10,
  contacted: 25,
  qualified: 45,
  proposal_sent: 60,
  negotiation: 75,
  approved: 90,
  converted: 100,
  lost: 0,
};

const SOURCE_SCORES: Record<string, number> = {
  website_estimate: 90,
  consultation: 70,
  referral: 60,
  manual: 40,
};

function toMillis(ts: any): number | null {
  if (!ts) return null;
  if (typeof ts.toMillis === "function") return ts.toMillis();
  if (typeof ts.seconds === "number") return ts.seconds * 1000;
  if (ts instanceof Date) return ts.getTime();
  return null;
}

export function calculateLeadScore(
  lead: LeadScoringInput,
  weights: ScoringWeights = DEFAULT_SCORING_WEIGHTS,
  thresholds: LeadScoringThresholds = DEFAULT_THRESHOLDS
): { score: number; temperature: "hot" | "warm" | "cold" } {
  const budgetScore = Math.min(100, (lead.totalAmount / thresholds.hotAmount) * 100);
  const stageScore = STAGE_SCORES[lead.stage] ?? 10;
  const sourceScore = SOURCE_SCORES[lead.source] ?? 40;
  const emailScore = lead.email && lead.email.includes("@") ? 100 : 0;
  const followUpScore = Math.min(100, (lead.followUpCount / 5) * 100);

  const now = Date.now();
  const createdMs = toMillis(lead.createdAt);
  const lastContactMs = toMillis(lead.lastContactedAt);

  let responseTimeScore = 50; // default if no data
  if (createdMs && lastContactMs) {
    const hoursToRespond = (lastContactMs - createdMs) / (1000 * 60 * 60);
    responseTimeScore = Math.max(0, 100 - (hoursToRespond / 168) * 100);
  }

  let recencyScore = 50; // default if no data
  if (lastContactMs) {
    const daysSinceContact = (now - lastContactMs) / (1000 * 60 * 60 * 24);
    recencyScore = Math.max(0, 100 - (daysSinceContact / 30) * 100);
  }

  const totalWeight =
    weights.budget +
    weights.stageProgress +
    weights.sourceQuality +
    weights.hasEmail +
    weights.followUpEngagement +
    weights.responseTime +
    weights.recency;

  const weightedSum =
    budgetScore * weights.budget +
    stageScore * weights.stageProgress +
    sourceScore * weights.sourceQuality +
    emailScore * weights.hasEmail +
    followUpScore * weights.followUpEngagement +
    responseTimeScore * weights.responseTime +
    recencyScore * weights.recency;

  const score = Math.round(weightedSum / totalWeight);
  const temperature: "hot" | "warm" | "cold" =
    score >= 70 ? "hot" : score >= 40 ? "warm" : "cold";

  return { score, temperature };
}
