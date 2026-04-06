// ============================================================
// Shared TypeScript type definitions and interfaces
// ============================================================

// ----- Enums -----

export enum UserRole {
  SOCIAL_MEDIA_OFFICER = "SOCIAL_MEDIA_OFFICER",
  SALES_CONSULTANT = "SALES_CONSULTANT",
  ADMIN = "ADMIN",
}

export enum DMStatus {
  NEW = "NEW",
  DRAFTED = "DRAFTED",
  SENT = "SENT",
  ESCALATED = "ESCALATED",
}

export enum LeadStatus {
  EXTRACTED = "EXTRACTED",
  CONFIRMED = "CONFIRMED",
  CREATED_IN_SF = "CREATED_IN_SF",
  ESCALATED = "ESCALATED",
}

export enum NotificationType {
  HIGH_PRIORITY_LEAD = "HIGH_PRIORITY_LEAD",
  SLA_BREACH = "SLA_BREACH",
  LEAD_CREATED = "LEAD_CREATED",
  ESCALATION = "ESCALATION",
}

// ----- Types -----

export type ConfidenceLevel = "high" | "medium" | "low";

// ----- Interfaces -----

export interface DMMessage {
  id: string;
  sender: string;
  platform: string;
  timestamp: string;
  content: string;
  status: DMStatus;
}

export interface DraftResponse {
  id: string;
  dmId: string;
  content: string;
  confidence: number;
  reviewedBy: string | null;
  approved: boolean;
  editedContent: string | null;
}

export interface LeadData {
  id: string;
  name: string;
  contact: string;
  budget: string | null;
  location: string | null;
  intent: string | null;
  source: string;
  status: LeadStatus;
  priorityFlag: boolean;
  dmId: string;
  createdAt: string;
}

export interface Notification {
  id: string;
  leadId: string;
  recipientId: string;
  type: NotificationType;
  timestamp: string;
  status: string;
  message: string;
}

export interface AuditLogEntry {
  id: string;
  action: string;
  actor: string;
  timestamp: string;
  entityRef: string;
  details: string;
}

export interface KnowledgeBaseEntry {
  id: string;
  category: string;
  question: string;
  answer: string;
  propertyInfo: Record<string, string> | null;
}

export interface ExtractedLeadFields {
  name: string | null;
  contact: string | null;
  budget: string | null;
  location: string | null;
  intent: string | null;
  confidence: number;
}

export interface SalesforceLeadPayload {
  FirstName: string;
  LastName: string;
  Company: string;
  Email?: string;
  Phone?: string;
  LeadSource: string;
  Description?: string;
  Status: string;
  Street?: string;
  City?: string;
  State?: string;
  PostalCode?: string;
  Country?: string;
  [key: string]: string | undefined;
}

export interface APIResponse<T> {
  success: boolean;
  data: T | null;
  error: string | null;
}