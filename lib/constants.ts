// SLA & Priority Thresholds
export const SLA_BREACH_THRESHOLD_MS: number =
  (parseInt(process.env.SLA_BREACH_MINUTES || "", 10) || 60) * 60 * 1000;

export const HIGH_PRIORITY_THRESHOLD: number =
  parseFloat(process.env.HIGH_PRIORITY_THRESHOLD || "") || 0.8;

export const LOW_CONFIDENCE_THRESHOLD: number = 0.6;

// Platforms
export const PLATFORMS = {
  FACEBOOK: "facebook",
  INSTAGRAM: "instagram",
} as const;

export type Platform = (typeof PLATFORMS)[keyof typeof PLATFORMS];

// DM Statuses
export type DMStatus = "new" | "drafted" | "sent" | "escalated";

export const STATUS_COLORS: Record<
  DMStatus,
  { text: string; bg: string; border: string }
> = {
  new: {
    text: "text-status-new",
    bg: "bg-status-new-bg",
    border: "border-status-new-border",
  },
  drafted: {
    text: "text-status-drafted",
    bg: "bg-status-drafted-bg",
    border: "border-status-drafted-border",
  },
  sent: {
    text: "text-status-sent",
    bg: "bg-status-sent-bg",
    border: "border-status-sent-border",
  },
  escalated: {
    text: "text-status-escalated",
    bg: "bg-status-escalated-bg",
    border: "border-status-escalated-border",
  },
};

// Confidence Levels
export type ConfidenceLevel = "high" | "medium" | "low";

export const CONFIDENCE_COLORS: Record<
  ConfidenceLevel,
  { text: string; bg: string; border: string }
> = {
  high: {
    text: "text-confidence-high",
    bg: "bg-confidence-high-bg",
    border: "border-confidence-high-border",
  },
  medium: {
    text: "text-confidence-medium",
    bg: "bg-confidence-medium-bg",
    border: "border-confidence-medium-border",
  },
  low: {
    text: "text-confidence-low",
    bg: "bg-confidence-low-bg",
    border: "border-confidence-low-border",
  },
};

// API Routes
export const API_ROUTES = {
  CONVERSATIONS: "/api/conversations",
  CONVERSATION_DETAIL: (id: string) => `/api/conversations/${id}`,
  GENERATE_REPLY: "/api/generate-reply",
  SEND_REPLY: "/api/send-reply",
  ESCALATE: "/api/escalate",
  LEADS: "/api/leads",
  LEAD_DETAIL: (id: string) => `/api/leads/${id}`,
  ANALYTICS: "/api/analytics",
  AUTH_SESSION: "/api/auth/session",
  AUTH_SIGNIN: "/api/auth/signin",
  AUTH_SIGNOUT: "/api/auth/signout",
} as const;

// Lead Fields
export const LEAD_FIELDS: readonly string[] = [
  "firstName",
  "lastName",
  "email",
  "phone",
  "company",
  "title",
  "industry",
  "source",
  "status",
  "notes",
] as const;

// Limits
export const MAX_DRAFT_LENGTH: number = 2000;

// Polling
export const POLLING_INTERVAL_MS: number = 30000;