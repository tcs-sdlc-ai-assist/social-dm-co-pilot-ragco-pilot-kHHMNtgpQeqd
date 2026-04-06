"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useLead } from "@/lib/hooks/useLead";
import type { LeadListItem, LeadUpdatePayload } from "@/lib/hooks/useLead";
import StatusTag from "@/components/ui/StatusTag";
import ConfidenceMeter from "@/components/ui/ConfidenceMeter";
import type { DMStatus } from "@/lib/constants";

// ============================================================
// Leads Page — /leads
// Displays all extracted leads with filtering, actions, and stats
// ============================================================

type StatusFilter = "all" | "new" | "drafted" | "sent" | "escalated";
type PriorityFilter = "all" | "high" | "medium" | "low";
type SortField = "name" | "budget" | "priority" | "status" | "confidenceScore" | "createdAt";
type SortOrder = "asc" | "desc";

interface LeadStats {
  total: number;
  new: number;
  drafted: number;
  sent: number;
  escalated: number;
  highPriority: number;
  slaBreached: number;
  avgConfidence: number;
}

// ----- Helper Components -----

function SearchIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
      className="w-4 h-4 text-gray-400"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z"
      />
    </svg>
  );
}

function ChevronUpDownIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
      className="w-3.5 h-3.5"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M8.25 15 12 18.75 15.75 15m-7.5-6L12 5.25 15.75 9"
      />
    </svg>
  );
}

function LoadingSpinner() {
  return (
    <svg
      className="animate-spin h-5 w-5 text-brand-500"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
}

function PriorityBadge({ priority, flagged }: { priority: string; flagged?: boolean }) {
  const colorMap: Record<string, string> = {
    high: "border-red-300 bg-red-50 text-red-700",
    medium: "border-yellow-300 bg-yellow-50 text-yellow-700",
    low: "border-gray-300 bg-gray-50 text-gray-600",
  };

  const colors = colorMap[priority.toLowerCase()] || colorMap.low;

  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-2xs font-medium capitalize ${colors}`}>
      {flagged && (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 16 16"
          fill="currentColor"
          className="w-3 h-3"
          aria-hidden="true"
        >
          <path d="M2.75 2a.75.75 0 0 0-1.5 0v12a.75.75 0 0 0 1.5 0V9.487l1.33-.28a5.16 5.16 0 0 1 3.417.458 6.66 6.66 0 0 0 4.764.42l1.664-.51A.75.75 0 0 0 14 8.862V2.614a.75.75 0 0 0-.968-.718 5.16 5.16 0 0 1-3.7-.326 6.66 6.66 0 0 0-4.406-.59L3.75 1.26V2h-1Z" />
        </svg>
      )}
      {priority}
    </span>
  );
}

function formatDate(dateString: string | undefined): string {
  if (!dateString) return "—";
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return "—";
    return date.toLocaleDateString("en-AU", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return "—";
  }
}

function formatBudget(budget: number | undefined): string {
  if (budget === undefined || budget === null || budget === 0) return "—";
  if (budget >= 1000000) {
    return `$${(budget / 1000000).toFixed(1)}M`;
  }
  if (budget >= 1000) {
    return `$${(budget / 1000).toFixed(0)}K`;
  }
  return `$${budget.toLocaleString()}`;
}

function truncateText(text: string | undefined, maxLength: number = 40): string {
  if (!text) return "—";
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength).trimEnd() + "…";
}

// ----- Stats Card -----

function StatCard({
  label,
  value,
  color,
}: {
  label: string;
  value: number | string;
  color: string;
}) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white px-4 py-3 flex flex-col gap-1">
      <span className="text-2xs font-medium text-gray-500 uppercase tracking-wide">
        {label}
      </span>
      <span className={`text-heading-3 font-semibold ${color}`}>{value}</span>
    </div>
  );
}

function StatsBar({ stats }: { stats: LeadStats }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
      <StatCard label="Total" value={stats.total} color="text-gray-900" />
      <StatCard label="New" value={stats.new} color="text-status-new" />
      <StatCard label="Drafted" value={stats.drafted} color="text-status-drafted" />
      <StatCard label="Sent" value={stats.sent} color="text-status-sent" />
      <StatCard label="Escalated" value={stats.escalated} color="text-status-escalated" />
      <StatCard label="High Priority" value={stats.highPriority} color="text-red-600" />
      <StatCard label="SLA Breached" value={stats.slaBreached} color="text-orange-600" />
      <StatCard
        label="Avg Confidence"
        value={`${Math.round(stats.avgConfidence * 100)}%`}
        color="text-brand-600"
      />
    </div>
  );
}

// ----- Filter Tabs -----

interface FilterTabProps {
  label: string;
  value: string;
  active: boolean;
  count?: number;
  onClick: () => void;
}

function FilterTab({ label, active, count, onClick }: FilterTabProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-caption font-medium whitespace-nowrap transition-colors duration-150 ${
        active
          ? "bg-brand-500 text-white"
          : "bg-gray-100 text-gray-600 hover:bg-gray-200"
      }`}
      aria-pressed={active}
    >
      {label}
      {count !== undefined && (
        <span
          className={`inline-flex items-center justify-center min-w-[1.125rem] rounded-full px-1 text-2xs font-semibold ${
            active ? "bg-white/20 text-white" : "bg-gray-200 text-gray-500"
          }`}
        >
          {count}
        </span>
      )}
    </button>
  );
}

// ----- Lead Detail Modal -----

function LeadDetailModal({
  lead,
  onClose,
  onSalesforce,
  onEscalate,
  salesforceLoading,
  escalateLoading,
}: {
  lead: LeadListItem;
  onClose: () => void;
  onSalesforce: (leadId: string) => void;
  onEscalate: (leadId: string) => void;
  salesforceLoading: boolean;
  escalateLoading: boolean;
}) {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Lead details"
    >
      <div
        className="bg-white rounded-xl shadow-dropdown max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto animate-fade-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div>
            <h2 className="text-heading-3 text-gray-900">{lead.name}</h2>
            <p className="text-caption text-gray-500 mt-0.5">ID: {lead.id}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
            aria-label="Close"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
              <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-4 space-y-4">
          {/* Status & Priority */}
          <div className="flex items-center gap-2 flex-wrap">
            {lead.status && (
              <StatusTag status={lead.status.toLowerCase() as DMStatus} size="md" />
            )}
            {lead.priority && (
              <PriorityBadge priority={lead.priority} flagged={lead.priorityFlag} />
            )}
            {lead.slaBreached && (
              <span className="inline-flex items-center gap-1 rounded-full border border-red-300 bg-red-50 px-2 py-0.5 text-2xs font-medium text-red-700">
                SLA Breached
              </span>
            )}
          </div>

          {/* Confidence */}
          {lead.confidenceScore !== undefined && (
            <div>
              <p className="text-body-sm font-medium text-gray-700 mb-1.5">Confidence Score</p>
              <ConfidenceMeter confidence={lead.confidenceScore} showLabel />
            </div>
          )}

          {/* Fields */}
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 space-y-3">
            <DetailRow label="Name" value={lead.name} />
            <DetailRow label="Email" value={lead.email} />
            <DetailRow label="Company" value={lead.company} />
            <DetailRow label="Budget" value={lead.budget ? formatBudget(lead.budget) : undefined} />
            <DetailRow label="Location" value={lead.location} />
            <DetailRow label="Intent" value={lead.intent} />
            <DetailRow label="Platform" value={lead.platform} />
            <DetailRow label="Source DM" value={lead.dmId} />
            <DetailRow label="Salesforce" value={lead.salesforceStatus} />
            <DetailRow label="Escalated At" value={lead.escalatedAt ? formatDate(lead.escalatedAt) : undefined} />
            <DetailRow label="Escalation Reason" value={lead.escalationReason} />
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex items-center gap-2 flex-wrap">
          {!lead.salesforceStatus && (
            <button
              type="button"
              onClick={() => onSalesforce(lead.id)}
              disabled={salesforceLoading}
              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-body-sm font-medium text-white shadow-sm transition-colors duration-200 hover:bg-blue-700 focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {salesforceLoading ? (
                <>
                  <LoadingSpinner />
                  Creating…
                </>
              ) : (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4" aria-hidden="true">
                    <path d="M5.433 13.917l1.262-3.155A4 4 0 017.58 9.42l6.92-6.918a2.121 2.121 0 013 3l-6.92 6.918c-.383.383-.84.685-1.343.886l-3.154 1.262a.5.5 0 01-.65-.65z" />
                    <path d="M3.5 5.75c0-.69.56-1.25 1.25-1.25H10A.75.75 0 0010 3H4.75A2.75 2.75 0 002 5.75v9.5A2.75 2.75 0 004.75 18h9.5A2.75 2.75 0 0017 15.25V10a.75.75 0 00-1.5 0v5.25c0 .69-.56 1.25-1.25 1.25h-9.5c-.69 0-1.25-.56-1.25-1.25v-9.5z" />
                  </svg>
                  Create in Salesforce
                </>
              )}
            </button>
          )}
          {lead.salesforceStatus && (
            <span className="inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-2xs font-medium text-blue-700 capitalize">
              SF: {lead.salesforceStatus.replace(/_/g, " ")}
            </span>
          )}
          {lead.status !== "escalated" && (
            <button
              type="button"
              onClick={() => onEscalate(lead.id)}
              disabled={escalateLoading}
              className="inline-flex items-center gap-1.5 rounded-lg border border-red-300 bg-white px-4 py-2 text-body-sm font-medium text-red-600 shadow-sm transition-colors duration-200 hover:bg-red-50 focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {escalateLoading ? (
                <>
                  <LoadingSpinner />
                  Escalating…
                </>
              ) : (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4" aria-hidden="true">
                    <path fillRule="evenodd" d="M10 17a.75.75 0 01-.75-.75V5.612L5.29 9.77a.75.75 0 01-1.08-1.04l5.25-5.5a.75.75 0 011.08 0l5.25 5.5a.75.75 0 11-1.08 1.04l-3.96-4.158V16.25A.75.75 0 0110 17z" clipRule="evenodd" />
                  </svg>
                  Escalate to Sales
                </>
              )}
            </button>
          )}
          <div className="flex-1" />
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-body-sm font-medium text-gray-700 shadow-sm transition-colors duration-200 hover:bg-gray-50 focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string | undefined | null }) {
  return (
    <div className="flex items-start gap-3">
      <span className="text-2xs font-medium text-gray-500 w-28 flex-shrink-0 pt-0.5">{label}</span>
      <span className="text-body-sm text-gray-800">
        {value || <span className="text-gray-400 italic">Not available</span>}
      </span>
    </div>
  );
}

// ----- Empty State -----

function EmptyState({ hasFilters }: { hasFilters: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={1}
        stroke="currentColor"
        className="w-12 h-12 text-gray-300 mb-3"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z"
        />
      </svg>
      <p className="text-body-sm font-medium text-gray-500">
        {hasFilters ? "No leads match your filters" : "No leads yet"}
      </p>
      <p className="text-caption text-gray-400 mt-1">
        {hasFilters
          ? "Try adjusting your search or filter criteria"
          : "Leads will appear here once extracted from DMs"}
      </p>
    </div>
  );
}

// ----- Error State -----

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={1.5}
        stroke="currentColor"
        className="w-10 h-10 text-red-400 mb-3"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"
        />
      </svg>
      <p className="text-body-sm font-medium text-red-600 mb-1">Failed to load leads</p>
      <p className="text-caption text-gray-500 mb-3">{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="inline-flex items-center rounded-md bg-brand-500 px-3 py-1.5 text-body-sm font-medium text-white shadow-sm hover:bg-brand-600 transition-colors duration-200 focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
      >
        Retry
      </button>
    </div>
  );
}

// ----- Sortable Column Header -----

function SortableHeader({
  label,
  field,
  currentSort,
  currentOrder,
  onSort,
}: {
  label: string;
  field: SortField;
  currentSort: SortField;
  currentOrder: SortOrder;
  onSort: (field: SortField) => void;
}) {
  const isActive = currentSort === field;

  return (
    <button
      type="button"
      onClick={() => onSort(field)}
      className={`inline-flex items-center gap-1 text-2xs font-semibold uppercase tracking-wide transition-colors duration-150 ${
        isActive ? "text-brand-600" : "text-gray-500 hover:text-gray-700"
      }`}
    >
      {label}
      <span className={isActive ? "text-brand-500" : "text-gray-300"}>
        {isActive && currentOrder === "asc" ? (
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3">
            <path fillRule="evenodd" d="M8 14a.75.75 0 0 1-.75-.75V4.56L4.03 7.78a.75.75 0 0 1-1.06-1.06l4.5-4.5a.75.75 0 0 1 1.06 0l4.5 4.5a.75.75 0 0 1-1.06 1.06L8.75 4.56v8.69A.75.75 0 0 1 8 14Z" clipRule="evenodd" />
          </svg>
        ) : isActive && currentOrder === "desc" ? (
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3">
            <path fillRule="evenodd" d="M8 2a.75.75 0 0 1 .75.75v8.69l3.22-3.22a.75.75 0 1 1 1.06 1.06l-4.5 4.5a.75.75 0 0 1-1.06 0l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.22 3.22V2.75A.75.75 0 0 1 8 2Z" clipRule="evenodd" />
          </svg>
        ) : (
          <ChevronUpDownIcon />
        )}
      </span>
    </button>
  );
}

// ============================================================
// Main Leads Page Component
// ============================================================

export default function LeadsPage() {
  const {
    leads,
    loading,
    error,
    fetchLeads,
    createInSalesforce,
    escalateLead,
    clearError,
  } = useLead();

  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [sortField, setSortField] = useState<SortField>("createdAt");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
  const [selectedLead, setSelectedLead] = useState<LeadListItem | null>(null);
  const [salesforceLoading, setSalesforceLoading] = useState<string | null>(null);
  const [escalateLoading, setEscalateLoading] = useState<string | null>(null);
  const [notification, setNotification] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const searchTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  // ----- Fetch leads on mount and filter change -----

  const loadLeads = useCallback(() => {
    const filters: Record<string, string> = {};
    if (statusFilter !== "all") {
      filters.status = statusFilter;
    }
    if (priorityFilter !== "all") {
      filters.priority = priorityFilter;
    }
    if (searchQuery.trim().length > 0) {
      filters.search = searchQuery.trim();
    }
    fetchLeads(filters);
  }, [fetchLeads, statusFilter, priorityFilter, searchQuery]);

  useEffect(() => {
    loadLeads();
  }, [loadLeads]);

  // ----- Compute stats -----

  const stats = useMemo<LeadStats>(() => {
    const s: LeadStats = {
      total: leads.length,
      new: 0,
      drafted: 0,
      sent: 0,
      escalated: 0,
      highPriority: 0,
      slaBreached: 0,
      avgConfidence: 0,
    };

    let totalConfidence = 0;

    for (const lead of leads) {
      const status = (lead.status || "").toLowerCase();
      if (status === "new") s.new++;
      else if (status === "drafted") s.drafted++;
      else if (status === "sent") s.sent++;
      else if (status === "escalated") s.escalated++;

      if ((lead.priority || "").toLowerCase() === "high") s.highPriority++;
      if (lead.slaBreached) s.slaBreached++;
      if (lead.confidenceScore !== undefined) {
        totalConfidence += lead.confidenceScore;
      }
    }

    s.avgConfidence = leads.length > 0 ? totalConfidence / leads.length : 0;

    return s;
  }, [leads]);

  // ----- Sorting -----

  const handleSort = useCallback(
    (field: SortField) => {
      if (sortField === field) {
        setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
      } else {
        setSortField(field);
        setSortOrder("desc");
      }
    },
    [sortField]
  );

  const sortedLeads = useMemo(() => {
    const sorted = [...leads];
    const order = sortOrder === "asc" ? 1 : -1;

    sorted.sort((a, b) => {
      switch (sortField) {
        case "name":
          return (a.name || "").localeCompare(b.name || "") * order;
        case "budget":
          return ((a.budget || 0) - (b.budget || 0)) * order;
        case "priority": {
          const priorityOrder: Record<string, number> = { high: 0, medium: 1, low: 2 };
          const aP = priorityOrder[(a.priority || "low").toLowerCase()] ?? 3;
          const bP = priorityOrder[(b.priority || "low").toLowerCase()] ?? 3;
          return (aP - bP) * order;
        }
        case "status": {
          const statusOrder: Record<string, number> = { new: 0, drafted: 1, sent: 2, escalated: 3 };
          const aS = statusOrder[(a.status || "new").toLowerCase()] ?? 4;
          const bS = statusOrder[(b.status || "new").toLowerCase()] ?? 4;
          return (aS - bS) * order;
        }
        case "confidenceScore":
          return ((a.confidenceScore || 0) - (b.confidenceScore || 0)) * order;
        case "createdAt":
        default:
          return 0;
      }
    });

    return sorted;
  }, [leads, sortField, sortOrder]);

  // ----- Search handler -----

  const handleSearchChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      setSearchQuery(value);

      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }

      searchTimeoutRef.current = setTimeout(() => {
        // loadLeads will be triggered by the useEffect dependency on searchQuery
      }, 300);
    },
    []
  );

  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, []);

  // ----- Actions -----

  const handleCreateInSalesforce = useCallback(
    async (leadId: string) => {
      setSalesforceLoading(leadId);
      setNotification(null);

      try {
        const result = await createInSalesforce(leadId, "officer-current");

        if (result) {
          setNotification({
            type: "success",
            message: `Lead submitted to Salesforce. Status: ${result.salesforceStatus}`,
          });
          // Refresh the selected lead if it's the one we just updated
          if (selectedLead && selectedLead.id === leadId) {
            setSelectedLead({
              ...selectedLead,
              salesforceStatus: result.salesforceStatus,
            });
          }
          loadLeads();
        } else {
          setNotification({
            type: "error",
            message: "Failed to create lead in Salesforce.",
          });
        }
      } catch {
        setNotification({
          type: "error",
          message: "An error occurred during Salesforce integration.",
        });
      } finally {
        setSalesforceLoading(null);
      }
    },
    [createInSalesforce, selectedLead, loadLeads]
  );

  const handleEscalate = useCallback(
    async (leadId: string) => {
      setEscalateLoading(leadId);
      setNotification(null);

      try {
        const result = await escalateLead(leadId, "Escalated from leads management page");

        if (result) {
          setNotification({
            type: "success",
            message: `Lead escalated successfully.`,
          });
          if (selectedLead && selectedLead.id === leadId) {
            setSelectedLead({
              ...selectedLead,
              status: "escalated",
              priority: "high",
              priorityFlag: true,
              escalatedAt: new Date().toISOString(),
            });
          }
          loadLeads();
        } else {
          setNotification({
            type: "error",
            message: "Failed to escalate lead.",
          });
        }
      } catch {
        setNotification({
          type: "error",
          message: "An error occurred during escalation.",
        });
      } finally {
        setEscalateLoading(null);
      }
    },
    [escalateLead, selectedLead, loadLeads]
  );

  // ----- Auto-dismiss notification -----

  useEffect(() => {
    if (notification) {
      const timeout = setTimeout(() => {
        setNotification(null);
      }, 5000);
      return () => clearTimeout(timeout);
    }
  }, [notification]);

  const hasActiveFilters =
    statusFilter !== "all" ||
    priorityFilter !== "all" ||
    searchQuery.trim().length > 0;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Page Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-heading-2 text-gray-900">Leads</h1>
              <p className="text-body-sm text-gray-500 mt-1">
                Manage extracted leads, review data, and push to Salesforce
              </p>
            </div>
            <button
              type="button"
              onClick={loadLeads}
              disabled={loading}
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-2 text-body-sm font-medium text-gray-700 shadow-sm transition-colors duration-200 hover:bg-gray-50 focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 disabled:opacity-50"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
                className={`w-4 h-4 ${loading ? "animate-spin" : ""}`}
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182"
                />
              </svg>
              Refresh
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Notification Banner */}
        {notification && (
          <div
            className={`rounded-lg border px-4 py-3 flex items-center gap-3 animate-fade-in ${
              notification.type === "success"
                ? "border-green-200 bg-green-50 text-green-800"
                : "border-red-200 bg-red-50 text-red-800"
            }`}
            role="alert"
          >
            {notification.type === "success" ? (
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5 flex-shrink-0 text-green-500">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5 flex-shrink-0 text-red-500">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clipRule="evenodd" />
              </svg>
            )}
            <p className="text-body-sm flex-1">{notification.message}</p>
            <button
              type="button"
              onClick={() => setNotification(null)}
              className="flex-shrink-0 hover:opacity-70 transition-opacity"
              aria-label="Dismiss"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
              </svg>
            </button>
          </div>
        )}

        {/* Stats Summary */}
        <StatsBar stats={stats} />

        {/* Filters & Search */}
        <div className="rounded-lg border border-gray-200 bg-white p-4 space-y-3">
          {/* Search */}
          <div className="relative">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3">
              <SearchIcon />
            </span>
            <input
              type="text"
              placeholder="Search leads by name, email, company, or intent…"
              value={searchQuery}
              onChange={handleSearchChange}
              className="w-full rounded-lg border border-gray-200 bg-gray-50 py-2 pl-9 pr-3 text-body-sm text-gray-900 placeholder-gray-400 transition-colors duration-200 focus:border-brand-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-brand-500"
              aria-label="Search leads"
            />
          </div>

          {/* Status Filter Tabs */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-2xs font-medium text-gray-500 mr-1">Status:</span>
            <FilterTab
              label="All"
              value="all"
              active={statusFilter === "all"}
              count={stats.total}
              onClick={() => setStatusFilter("all")}
            />
            <FilterTab
              label="New"
              value="new"
              active={statusFilter === "new"}
              count={stats.new}
              onClick={() => setStatusFilter("new")}
            />
            <FilterTab
              label="Drafted"
              value="drafted"
              active={statusFilter === "drafted"}
              count={stats.drafted}
              onClick={() => setStatusFilter("drafted")}
            />
            <FilterTab
              label="Sent"
              value="sent"
              active={statusFilter === "sent"}
              count={stats.sent}
              onClick={() => setStatusFilter("sent")}
            />
            <FilterTab
              label="Escalated"
              value="escalated"
              active={statusFilter === "escalated"}
              count={stats.escalated}
              onClick={() => setStatusFilter("escalated")}
            />
          </div>

          {/* Priority Filter Tabs */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-2xs font-medium text-gray-500 mr-1">Priority:</span>
            <FilterTab
              label="All"
              value="all"
              active={priorityFilter === "all"}
              onClick={() => setPriorityFilter("all")}
            />
            <FilterTab
              label="High"
              value="high"
              active={priorityFilter === "high"}
              count={stats.highPriority}
              onClick={() => setPriorityFilter("high")}
            />
            <FilterTab
              label="Medium"
              value="medium"
              active={priorityFilter === "medium"}
              onClick={() => setPriorityFilter("medium")}
            />
            <FilterTab
              label="Low"
              value="low"
              active={priorityFilter === "low"}
              onClick={() => setPriorityFilter("low")}
            />
          </div>
        </div>

        {/* Error State */}
        {error && !loading && (
          <ErrorState
            message={error}
            onRetry={() => {
              clearError();
              loadLeads();
            }}
          />
        )}

        {/* Loading State */}
        {loading && leads.length === 0 && !error && (
          <div className="rounded-lg border border-gray-200 bg-white">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="flex items-center gap-4 px-4 py-3 border-b border-gray-100 animate-pulse"
              >
                <div className="h-4 w-32 bg-gray-200 rounded" />
                <div className="h-4 w-24 bg-gray-200 rounded" />
                <div className="h-4 w-16 bg-gray-200 rounded" />
                <div className="h-4 w-20 bg-gray-200 rounded" />
                <div className="h-4 w-28 bg-gray-200 rounded" />
                <div className="flex-1" />
                <div className="h-4 w-16 bg-gray-200 rounded" />
              </div>
            ))}
          </div>
        )}

        {/* Empty State */}
        {!loading && !error && sortedLeads.length === 0 && (
          <div className="rounded-lg border border-gray-200 bg-white">
            <EmptyState hasFilters={hasActiveFilters} />
          </div>
        )}

        {/* Leads Table */}
        {sortedLeads.length > 0 && (
          <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px]">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    <th className="px-4 py-3 text-left">
                      <SortableHeader
                        label="Name"
                        field="name"
                        currentSort={sortField}
                        currentOrder={sortOrder}
                        onSort={handleSort}
                      />
                    </th>
                    <th className="px-4 py-3 text-left">
                      <span className="text-2xs font-semibold uppercase tracking-wide text-gray-500">
                        Contact
                      </span>
                    </th>
                    <th className="px-4 py-3 text-left">
                      <SortableHeader
                        label="Budget"
                        field="budget"
                        currentSort={sortField}
                        currentOrder={sortOrder}
                        onSort={handleSort}
                      />
                    </th>
                    <th className="px-4 py-3 text-left">
                      <span className="text-2xs font-semibold uppercase tracking-wide text-gray-500">
                        Location
                      </span>
                    </th>
                    <th className="px-4 py-3 text-left">
                      <span className="text-2xs font-semibold uppercase tracking-wide text-gray-500">
                        Intent
                      </span>
                    </th>
                    <th className="px-4 py-3 text-left">
                      <SortableHeader
                        label="Status"
                        field="status"
                        currentSort={sortField}
                        currentOrder={sortOrder}
                        onSort={handleSort}
                      />
                    </th>
                    <th className="px-4 py-3 text-left">
                      <SortableHeader
                        label="Priority"
                        field="priority"
                        currentSort={sortField}
                        currentOrder={sortOrder}
                        onSort={handleSort}
                      />
                    </th>
                    <th className="px-4 py-3 text-left">
                      <SortableHeader
                        label="Confidence"
                        field="confidenceScore"
                        currentSort={sortField}
                        currentOrder={sortOrder}
                        onSort={handleSort}
                      />
                    </th>
                    <th className="px-4 py-3 text-right">
                      <span className="text-2xs font-semibold uppercase tracking-wide text-gray-500">
                        Actions
                      </span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {sortedLeads.map((lead) => (
                    <tr
                      key={lead.id}
                      className="hover:bg-gray-50 transition-colors duration-150 cursor-pointer"
                      onClick={() => setSelectedLead(lead)}
                    >
                      <td className="px-4 py-3">
                        <div className="flex flex-col">
                          <span className="text-body-sm font-medium text-gray-900">
                            {lead.name}
                          </span>
                          {lead.company && (
                            <span className="text-2xs text-gray-400">{lead.company}</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-body-sm text-gray-600">
                          {truncateText(lead.email, 25) || "—"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-body-sm text-gray-700 font-medium">
                          {formatBudget(lead.budget)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-body-sm text-gray-600">
                          {truncateText(lead.location, 20) || "—"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-body-sm text-gray-600">
                          {truncateText(lead.intent, 30) || "—"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {lead.status ? (
                          <StatusTag
                            status={lead.status.toLowerCase() as DMStatus}
                            size="sm"
                          />
                        ) : (
                          <span className="text-2xs text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {lead.priority ? (
                          <PriorityBadge
                            priority={lead.priority}
                            flagged={lead.priorityFlag}
                          />
                        ) : (
                          <span className="text-2xs text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {lead.confidenceScore !== undefined ? (
                          <span
                            className={`text-body-sm font-semibold ${
                              lead.confidenceScore >= 0.8
                                ? "text-confidence-high"
                                : lead.confidenceScore >= 0.6
                                ? "text-confidence-medium"
                                : "text-confidence-low"
                            }`}
                          >
                            {Math.round(lead.confidenceScore * 100)}%
                          </span>
                        ) : (
                          <span className="text-2xs text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div
                          className="flex items-center justify-end gap-1"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {!lead.salesforceStatus && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleCreateInSalesforce(lead.id);
                              }}
                              disabled={salesforceLoading === lead.id}
                              className="inline-flex items-center rounded-md bg-blue-50 border border-blue-200 px-2 py-1 text-2xs font-medium text-blue-700 transition-colors duration-150 hover:bg-blue-100 focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                              title="Create in Salesforce"
                            >
                              {salesforceLoading === lead.id ? (
                                <svg className="animate-spin h-3 w-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                </svg>
                              ) : (
                                "SF"
                              )}
                            </button>
                          )}
                          {lead.salesforceStatus && (
                            <span className="inline-flex items-center rounded-md bg-blue-50 border border-blue-200 px-2 py-1 text-2xs font-medium text-blue-600">
                              ✓ SF
                            </span>
                          )}
                          {lead.status !== "escalated" && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleEscalate(lead.id);
                              }}
                              disabled={escalateLoading === lead.id}
                              className="inline-flex items-center rounded-md bg-red-50 border border-red-200 px-2 py-1 text-2xs font-medium text-red-700 transition-colors duration-150 hover:bg-red-100 focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
                              title="Escalate to Sales"
                            >
                              {escalateLoading === lead.id ? (
                                <svg className="animate-spin h-3 w-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                </svg>
                              ) : (
                                "↑"
                              )}
                            </button>
                          )}
                          {lead.status === "escalated" && (
                            <span className="inline-flex items-center rounded-md bg-red-50 border border-red-200 px-2 py-1 text-2xs font-medium text-red-600">
                              ✓ Esc
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Table Footer */}
            <div className="border-t border-gray-200 bg-gray-50 px-4 py-2">
              <p className="text-2xs text-gray-400 text-center">
                Showing {sortedLeads.length} lead{sortedLeads.length !== 1 ? "s" : ""}
                {hasActiveFilters && " (filtered)"}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Lead Detail Modal */}
      {selectedLead && (
        <LeadDetailModal
          lead={selectedLead}
          onClose={() => setSelectedLead(null)}
          onSalesforce={handleCreateInSalesforce}
          onEscalate={handleEscalate}
          salesforceLoading={salesforceLoading === selectedLead.id}
          escalateLoading={escalateLoading === selectedLead.id}
        />
      )}
    </div>
  );
}