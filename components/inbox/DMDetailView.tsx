"use client";

import React, { useState, useEffect, useCallback } from "react";
import StatusTag from "@/components/ui/StatusTag";
import ConfidenceMeter from "@/components/ui/ConfidenceMeter";
import type { DMStatus } from "@/lib/constants";
import type { DraftResponse, ExtractedLeadFields } from "@/lib/types";

// ============================================================
// DMDetailView — Full DM detail and workflow orchestration view
// ============================================================

interface DMSender {
  id: string;
  name: string;
  handle: string;
  avatarUrl: string;
}

interface DMMetadata {
  communityName: string | null;
  propertyType: string | null;
  bedrooms: number | null;
}

interface DMDetail {
  id: string;
  platform: string;
  conversationId: string;
  sender: DMSender;
  content: string;
  timestamp: string;
  intent: string;
  status: string;
  priority: string;
  confidenceScore: number;
  slaDeadline: string;
  draftResponse?: string;
  sentAt?: string;
  escalationReason?: string;
  metadata: DMMetadata;
  draft?: DraftResponse | undefined;
  lead?: LeadListItem | undefined;
  slaBreached?: boolean;
}

interface KnowledgeContextEntry {
  id: string;
  category: string;
  question: string;
  answer: string;
  relevanceScore: number;
  propertyInfo?: Record<string, string> | null;
}

interface LeadListItem {
  id: string;
  name: string;
  email?: string;
  company?: string;
  platform?: string;
  budget?: number;
  location?: string;
  intent?: string;
  priority?: string;
  confidenceScore?: number;
  status?: string;
  slaBreached?: boolean;
  dmId?: string;
  priorityFlag?: boolean;
  escalatedAt?: string;
  escalationReason?: string;
  salesforceStatus?: string;
}

export interface DMDetailViewProps {
  dm: DMDetail;
  onBack?: () => void;
  onStatusChange?: (dmId: string, newStatus: string) => void;
}

type WorkflowStep = "view" | "drafting" | "reviewing" | "extracting" | "lead_captured" | "salesforce";

// ----- Helper Components -----

function PlatformIcon({ platform }: { platform: string }) {
  if (platform === "facebook") {
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="currentColor"
        className="w-4 h-4 text-blue-600"
        aria-hidden="true"
      >
        <path d="M22 12c0-5.523-4.477-10-10-10S2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.878v-6.987h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.988C18.343 21.128 22 16.991 22 12z" />
      </svg>
    );
  }
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      className="w-4 h-4 text-pink-500"
      aria-hidden="true"
    >
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
    </svg>
  );
}

function formatTimestamp(timestamp: string): string {
  try {
    const date = new Date(timestamp);
    return date.toLocaleString("en-AU", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return timestamp;
  }
}

function formatRelativeTime(timestamp: string): string {
  try {
    const now = Date.now();
    const then = new Date(timestamp).getTime();
    const diffMs = now - then;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  } catch {
    return "";
  }
}

function SLABadge({ slaDeadline, slaBreached }: { slaDeadline: string; slaBreached: boolean }) {
  const breached = slaBreached || new Date(slaDeadline).getTime() < Date.now();

  if (breached) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-red-300 bg-red-50 px-2 py-0.5 text-2xs font-medium text-red-700">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3" aria-hidden="true">
          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a.75.75 0 000 1.5h.253a.25.25 0 01.244.304l-.459 2.066A1.75 1.75 0 0010.747 15H11a.75.75 0 000-1.5h-.253a.25.25 0 01-.244-.304l.459-2.066A1.75 1.75 0 009.253 9H9z" clipRule="evenodd" />
        </svg>
        SLA Breached
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-green-300 bg-green-50 px-2 py-0.5 text-2xs font-medium text-green-700">
      SLA: {formatRelativeTime(slaDeadline)} remaining
    </span>
  );
}

function PriorityBadge({ priority }: { priority: string }) {
  const colorMap: Record<string, string> = {
    high: "border-red-300 bg-red-50 text-red-700",
    medium: "border-yellow-300 bg-yellow-50 text-yellow-700",
    low: "border-gray-300 bg-gray-50 text-gray-600",
  };

  const colors = colorMap[priority.toLowerCase()] || colorMap.low;

  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-2xs font-medium capitalize ${colors}`}>
      {priority}
    </span>
  );
}

// ----- Knowledge Context Panel -----

function KnowledgeContextPanel({
  entries,
  loading,
}: {
  entries: KnowledgeContextEntry[];
  loading: boolean;
}) {
  if (loading) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <h3 className="text-heading-4 text-gray-900 mb-3">Knowledge Base Context</h3>
        <div className="flex items-center gap-2 text-body-sm text-gray-500">
          <svg className="animate-spin h-4 w-4 text-brand-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" aria-hidden="true">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          Retrieving relevant context...
        </div>
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <h3 className="text-heading-4 text-gray-900 mb-3">Knowledge Base Context</h3>
        <p className="text-body-sm text-gray-500">No relevant knowledge base entries found for this message.</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <h3 className="text-heading-4 text-gray-900 mb-3">Knowledge Base Context</h3>
      <div className="space-y-3">
        {entries.map((entry) => (
          <div key={entry.id} className="rounded-md border border-gray-100 bg-gray-50 p-3">
            <div className="flex items-center justify-between mb-1.5">
              <span className="inline-flex items-center rounded-full border border-brand-200 bg-brand-50 px-2 py-0.5 text-2xs font-medium text-brand-700 capitalize">
                {entry.category}
              </span>
              <span className="text-2xs text-gray-400">
                Relevance: {Math.round(entry.relevanceScore * 100)}%
              </span>
            </div>
            <p className="text-body-sm font-medium text-gray-800 mb-1">{entry.question}</p>
            <p className="text-body-sm text-gray-600 line-clamp-3">{entry.answer}</p>
            {entry.propertyInfo && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {Object.entries(entry.propertyInfo).map(([key, value]) => (
                  <span key={key} className="inline-flex items-center rounded bg-white border border-gray-200 px-1.5 py-0.5 text-2xs text-gray-600">
                    <span className="font-medium text-gray-700 mr-1">{key}:</span>
                    {value}
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ----- Draft Composer Section -----

function DraftComposerSection({
  dm,
  draft,
  generating,
  submitting,
  error,
  onGenerate,
  onEdit,
  onSubmit,
  onRegenerate,
}: {
  dm: DMDetail;
  draft: DraftResponse | null;
  generating: boolean;
  submitting: boolean;
  error: string | null;
  onGenerate: () => void;
  onEdit: (content: string) => void;
  onSubmit: () => void;
  onRegenerate: () => void;
}) {
  const [editMode, setEditMode] = useState(false);
  const [editText, setEditText] = useState("");

  useEffect(() => {
    if (draft) {
      setEditText(draft.editedContent || draft.content);
    }
  }, [draft]);

  const handleStartEdit = () => {
    setEditMode(true);
    setEditText(draft?.editedContent || draft?.content || "");
  };

  const handleSaveEdit = () => {
    onEdit(editText);
    setEditMode(false);
  };

  const handleCancelEdit = () => {
    setEditMode(false);
    setEditText(draft?.editedContent || draft?.content || "");
  };

  if (!draft && !generating) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <h3 className="text-heading-4 text-gray-900 mb-3">Draft Response</h3>
        {dm.status === "sent" ? (
          <div className="rounded-md bg-green-50 border border-green-200 p-3">
            <p className="text-body-sm text-green-700">
              Response has been sent for this message.
            </p>
            {dm.draftResponse && (
              <p className="text-body-sm text-green-800 mt-2 italic">&ldquo;{dm.draftResponse}&rdquo;</p>
            )}
          </div>
        ) : dm.status === "escalated" ? (
          <div className="rounded-md bg-red-50 border border-red-200 p-3">
            <p className="text-body-sm text-red-700">
              This message has been escalated.
              {dm.escalationReason && ` Reason: ${dm.escalationReason}`}
            </p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3 py-4">
            <p className="text-body-sm text-gray-500 text-center">
              Generate an AI-powered draft response using knowledge base context.
            </p>
            <button
              type="button"
              onClick={onGenerate}
              className="inline-flex items-center gap-2 rounded-lg bg-brand-500 px-4 py-2 text-body-sm font-medium text-white transition-colors duration-200 hover:bg-brand-600 focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4" aria-hidden="true">
                <path d="M15.98 1.804a1 1 0 00-1.96 0l-.24 1.192a1 1 0 01-.784.785l-1.192.238a1 1 0 000 1.962l1.192.238a1 1 0 01.785.785l.238 1.192a1 1 0 001.962 0l.238-1.192a1 1 0 01.785-.785l1.192-.238a1 1 0 000-1.962l-1.192-.238a1 1 0 01-.785-.785l-.238-1.192zM6.949 5.684a1 1 0 00-1.898 0l-.683 2.051a1 1 0 01-.633.633l-2.051.683a1 1 0 000 1.898l2.051.684a1 1 0 01.633.632l.683 2.051a1 1 0 001.898 0l.683-2.051a1 1 0 01.633-.633l2.051-.683a1 1 0 000-1.898l-2.051-.683a1 1 0 01-.633-.633L6.95 5.684zM13.949 13.684a1 1 0 00-1.898 0l-.184.551a1 1 0 01-.632.633l-.551.183a1 1 0 000 1.898l.551.183a1 1 0 01.633.633l.183.551a1 1 0 001.898 0l.184-.551a1 1 0 01.632-.633l.551-.183a1 1 0 000-1.898l-.551-.184a1 1 0 01-.633-.632l-.183-.551z" />
              </svg>
              Generate Draft
            </button>
          </div>
        )}
        {error && (
          <div className="mt-3 rounded-md bg-red-50 border border-red-200 p-3">
            <p className="text-body-sm text-red-700">{error}</p>
          </div>
        )}
      </div>
    );
  }

  if (generating) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <h3 className="text-heading-4 text-gray-900 mb-3">Draft Response</h3>
        <div className="flex items-center gap-3 py-6 justify-center">
          <svg className="animate-spin h-5 w-5 text-brand-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" aria-hidden="true">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <span className="text-body-sm text-gray-600">Generating draft response...</span>
        </div>
      </div>
    );
  }

  if (!draft) {
    return null;
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-heading-4 text-gray-900">Draft Response</h3>
        <div className="w-40">
          <ConfidenceMeter confidence={draft.confidence} showLabel />
        </div>
      </div>

      {editMode ? (
        <div className="space-y-3">
          <textarea
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            rows={6}
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-body-sm text-gray-900 placeholder-gray-400 transition-colors duration-200 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 resize-y"
            placeholder="Edit the draft response..."
          />
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSaveEdit}
              className="inline-flex items-center rounded-lg bg-brand-500 px-3 py-1.5 text-body-sm font-medium text-white transition-colors duration-200 hover:bg-brand-600 focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
            >
              Save Changes
            </button>
            <button
              type="button"
              onClick={handleCancelEdit}
              className="inline-flex items-center rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-body-sm font-medium text-gray-700 transition-colors duration-200 hover:bg-gray-50 focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="rounded-md bg-gray-50 border border-gray-100 p-3">
            <p className="text-body-sm text-gray-800 whitespace-pre-wrap">
              {draft.editedContent || draft.content}
            </p>
          </div>

          {draft.editedContent && (
            <p className="text-2xs text-gray-400 italic">Edited by reviewer</p>
          )}

          {draft.approved && draft.reviewedBy && (
            <div className="rounded-md bg-green-50 border border-green-200 p-2">
              <p className="text-2xs text-green-700">
                ✓ Approved by {draft.reviewedBy}
              </p>
            </div>
          )}

          <div className="flex items-center gap-2 flex-wrap">
            {!draft.approved && (
              <>
                <button
                  type="button"
                  onClick={handleStartEdit}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-body-sm font-medium text-gray-700 transition-colors duration-200 hover:bg-gray-50 focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5" aria-hidden="true">
                    <path d="M2.695 14.763l-1.262 3.154a.5.5 0 00.65.65l3.155-1.262a4 4 0 001.343-.885L17.5 5.5a2.121 2.121 0 00-3-3L3.58 13.42a4 4 0 00-.885 1.343z" />
                  </svg>
                  Edit
                </button>
                <button
                  type="button"
                  onClick={onSubmit}
                  disabled={submitting}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-brand-500 px-3 py-1.5 text-body-sm font-medium text-white transition-colors duration-200 hover:bg-brand-600 focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? (
                    <>
                      <svg className="animate-spin h-3.5 w-3.5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Submitting...
                    </>
                  ) : (
                    <>
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5" aria-hidden="true">
                        <path d="M3.105 2.289a.75.75 0 00-.826.95l1.414 4.925A1.5 1.5 0 005.135 9.25h6.115a.75.75 0 010 1.5H5.135a1.5 1.5 0 00-1.442 1.086l-1.414 4.926a.75.75 0 00.826.95 28.896 28.896 0 0015.293-7.154.75.75 0 000-1.115A28.897 28.897 0 003.105 2.289z" />
                      </svg>
                      Approve &amp; Send
                    </>
                  )}
                </button>
              </>
            )}
            <button
              type="button"
              onClick={onRegenerate}
              disabled={generating}
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-body-sm font-medium text-gray-700 transition-colors duration-200 hover:bg-gray-50 focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5" aria-hidden="true">
                <path fillRule="evenodd" d="M15.312 11.424a5.5 5.5 0 01-9.201 2.466l-.312-.311h2.433a.75.75 0 000-1.5H4.598a.75.75 0 00-.75.75v3.634a.75.75 0 001.5 0v-2.033l.312.311a7 7 0 0011.712-3.138.75.75 0 00-1.449-.39zm-1.873-7.263a7 7 0 00-11.712 3.138.75.75 0 001.449.39 5.5 5.5 0 019.201-2.466l.312.311H10.256a.75.75 0 000 1.5h3.634a.75.75 0 00.75-.75V2.65a.75.75 0 00-1.5 0v2.033l-.312-.311a6.97 6.97 0 00-.389-.211z" clipRule="evenodd" />
              </svg>
              Regenerate
            </button>
          </div>
        </div>
      )}

      {error && (
        <div className="mt-3 rounded-md bg-red-50 border border-red-200 p-3">
          <p className="text-body-sm text-red-700">{error}</p>
        </div>
      )}
    </div>
  );
}

// ----- Lead Capture Sidebar -----

function LeadCaptureSidebar({
  dm,
  extractedFields,
  extracting,
  extractError,
  leadCreated,
  salesforceStatus,
  onExtract,
  onCreateInSalesforce,
  onEscalate,
}: {
  dm: DMDetail;
  extractedFields: ExtractedLeadFields | null;
  extracting: boolean;
  extractError: string | null;
  leadCreated: LeadListItem | null;
  salesforceStatus: string | null;
  onExtract: () => void;
  onCreateInSalesforce: () => void;
  onEscalate: () => void;
}) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 space-y-4">
      <h3 className="text-heading-4 text-gray-900">Lead Capture</h3>

      {!extractedFields && !extracting && !leadCreated && (
        <div className="flex flex-col items-center gap-3 py-3">
          <p className="text-body-sm text-gray-500 text-center">
            Extract structured lead data from this DM conversation.
          </p>
          <button
            type="button"
            onClick={onExtract}
            className="inline-flex items-center gap-2 rounded-lg border border-brand-500 bg-white px-3 py-1.5 text-body-sm font-medium text-brand-600 transition-colors duration-200 hover:bg-brand-50 focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4" aria-hidden="true">
              <path d="M10 1a6 6 0 00-3.815 10.631C7.237 12.5 8 13.443 8 14.456v.644a.75.75 0 00.572.729 6.016 6.016 0 002.856 0A.75.75 0 0012 15.1v-.644c0-1.013.762-1.957 1.815-2.825A6 6 0 0010 1zM8.863 17.414a.75.75 0 00-.226 1.483 9.066 9.066 0 002.726 0 .75.75 0 00-.226-1.483 7.553 7.553 0 01-2.274 0z" />
            </svg>
            Extract Lead Data
          </button>
        </div>
      )}

      {extracting && (
        <div className="flex items-center gap-2 py-3 justify-center">
          <svg className="animate-spin h-4 w-4 text-brand-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" aria-hidden="true">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <span className="text-body-sm text-gray-600">Extracting lead data...</span>
        </div>
      )}

      {extractError && (
        <div className="rounded-md bg-red-50 border border-red-200 p-3">
          <p className="text-body-sm text-red-700">{extractError}</p>
        </div>
      )}

      {extractedFields && !leadCreated && (
        <div className="space-y-3">
          <div className="rounded-md bg-gray-50 border border-gray-100 p-3 space-y-2">
            <FieldRow label="Name" value={extractedFields.name} />
            <FieldRow label="Contact" value={extractedFields.contact} />
            <FieldRow label="Budget" value={extractedFields.budget} />
            <FieldRow label="Location" value={extractedFields.location} />
            <FieldRow label="Intent" value={extractedFields.intent} />
          </div>
          <div className="w-full">
            <ConfidenceMeter confidence={extractedFields.confidence} showLabel />
          </div>
        </div>
      )}

      {leadCreated && (
        <div className="space-y-3">
          <div className="rounded-md bg-green-50 border border-green-200 p-3">
            <p className="text-body-sm text-green-700 font-medium">
              ✓ Lead created: {leadCreated.name}
            </p>
            <p className="text-2xs text-green-600 mt-1">ID: {leadCreated.id}</p>
          </div>

          <div className="rounded-md bg-gray-50 border border-gray-100 p-3 space-y-2">
            <FieldRow label="Name" value={leadCreated.name} />
            <FieldRow label="Email" value={leadCreated.email || null} />
            <FieldRow label="Budget" value={leadCreated.budget ? `$${leadCreated.budget.toLocaleString()}` : null} />
            <FieldRow label="Location" value={leadCreated.location || null} />
            <FieldRow label="Intent" value={leadCreated.intent || null} />
            <FieldRow label="Priority" value={leadCreated.priority || null} />
            <FieldRow label="Status" value={leadCreated.status || null} />
          </div>

          {salesforceStatus && (
            <div className="rounded-md bg-blue-50 border border-blue-200 p-2">
              <p className="text-2xs text-blue-700">
                Salesforce: <span className="font-medium capitalize">{salesforceStatus.replace(/_/g, " ")}</span>
              </p>
            </div>
          )}

          <div className="flex flex-col gap-2">
            {!salesforceStatus && (
              <button
                type="button"
                onClick={onCreateInSalesforce}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-3 py-1.5 text-body-sm font-medium text-white transition-colors duration-200 hover:bg-blue-700 focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 w-full"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4" aria-hidden="true">
                  <path d="M5.127 3.502L5.25 3.5h9.5c.041 0 .082 0 .123.002A2.251 2.251 0 0012.75 2h-5.5a2.25 2.25 0 00-2.123 1.502zM1 10.25A2.25 2.25 0 013.25 8h13.5A2.25 2.25 0 0119 10.25v5.5A2.25 2.25 0 0116.75 18H3.25A2.25 2.25 0 011 15.75v-5.5zM3.25 6.5c-.04 0-.082 0-.123.002A2.25 2.25 0 015.25 5h9.5c.98 0 1.814.627 2.123 1.502a3.819 3.819 0 00-.123-.002H3.25z" />
                </svg>
                Create in Salesforce
              </button>
            )}
            {leadCreated.status !== "escalated" && (
              <button
                type="button"
                onClick={onEscalate}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-red-300 bg-white px-3 py-1.5 text-body-sm font-medium text-red-600 transition-colors duration-200 hover:bg-red-50 focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-500 w-full"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4" aria-hidden="true">
                  <path fillRule="evenodd" d="M10 2a.75.75 0 01.75.75v12.59l1.95-2.1a.75.75 0 111.1 1.02l-3.25 3.5a.75.75 0 01-1.1 0l-3.25-3.5a.75.75 0 111.1-1.02l1.95 2.1V2.75A.75.75 0 0110 2z" clipRule="evenodd" transform="rotate(180 10 10)" />
                </svg>
                Escalate to Sales
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function FieldRow({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex items-start gap-2">
      <span className="text-2xs font-medium text-gray-500 w-16 flex-shrink-0 pt-0.5">{label}</span>
      <span className="text-body-sm text-gray-800">
        {value || <span className="text-gray-400 italic">Not detected</span>}
      </span>
    </div>
  );
}

// ============================================================
// Main DMDetailView Component
// ============================================================

export default function DMDetailView({ dm, onBack, onStatusChange }: DMDetailViewProps) {
  const [workflowStep, setWorkflowStep] = useState<WorkflowStep>("view");
  const [draft, setDraft] = useState<DraftResponse | null>(dm.draft || null);
  const [generating, setGenerating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [draftError, setDraftError] = useState<string | null>(null);
  const [knowledgeContext, setKnowledgeContext] = useState<KnowledgeContextEntry[]>([]);
  const [contextLoading, setContextLoading] = useState(false);
  const [extractedFields, setExtractedFields] = useState<ExtractedLeadFields | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [extractError, setExtractError] = useState<string | null>(null);
  const [leadCreated, setLeadCreated] = useState<LeadListItem | null>(dm.lead || null);
  const [salesforceStatus, setSalesforceStatus] = useState<string | null>(null);

  // Determine initial workflow step based on DM state
  useEffect(() => {
    if (dm.status === "sent") {
      setWorkflowStep("lead_captured");
    } else if (dm.status === "drafted" || dm.draft) {
      setWorkflowStep("reviewing");
      if (dm.draft) {
        setDraft(dm.draft);
      }
    } else if (dm.status === "escalated") {
      setWorkflowStep("lead_captured");
    }
    if (dm.lead) {
      setLeadCreated(dm.lead);
    }
  }, [dm]);

  const handleGenerateDraft = useCallback(async () => {
    setGenerating(true);
    setDraftError(null);
    setContextLoading(true);
    setWorkflowStep("drafting");

    try {
      const response = await fetch("/api/dm/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dmId: dm.id }),
      });

      const data = await response.json();

      if (!response.ok) {
        const errorMessage = data.error || `Failed to generate draft (HTTP ${response.status})`;
        setDraftError(errorMessage);
        setGenerating(false);
        setContextLoading(false);
        return;
      }

      if (data.success && data.data) {
        const generatedDraft: DraftResponse = {
          id: data.data.draft_id,
          dmId: data.data.dm_id,
          content: data.data.draft_text,
          confidence: data.data.confidence,
          reviewedBy: data.data.reviewed_by || null,
          approved: data.data.approved || false,
          editedContent: data.data.edited_content || null,
        };
        setDraft(generatedDraft);

        if (data.data.context && Array.isArray(data.data.context)) {
          setKnowledgeContext(
            data.data.context.map((entry: KnowledgeContextEntry) => ({
              id: entry.id,
              category: entry.category,
              question: entry.question,
              answer: entry.answer,
              relevanceScore: entry.relevanceScore,
              propertyInfo: entry.propertyInfo || null,
            }))
          );
        }

        setWorkflowStep("reviewing");
        onStatusChange?.(dm.id, "drafted");
      } else {
        setDraftError(data.error || "Failed to generate draft");
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "An unexpected error occurred";
      setDraftError(errorMessage);
    } finally {
      setGenerating(false);
      setContextLoading(false);
    }
  }, [dm.id, onStatusChange]);

  const handleEditDraft = useCallback((content: string) => {
    if (draft) {
      setDraft({ ...draft, editedContent: content });
    }
  }, [draft]);

  const handleSubmitDraft = useCallback(async () => {
    if (!draft) return;

    setSubmitting(true);
    setDraftError(null);

    try {
      const response = await fetch("/api/dm/draft/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          draftId: draft.id,
          reviewerId: "officer-current",
          editedContent: draft.editedContent || undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        const errorMessage = data.error || `Failed to submit draft (HTTP ${response.status})`;
        setDraftError(errorMessage);
        setSubmitting(false);
        return;
      }

      if (data.success && data.data) {
        setDraft({
          ...draft,
          approved: true,
          reviewedBy: data.data.draft?.reviewedBy || "officer-current",
          editedContent: data.data.draft?.editedContent || draft.editedContent,
        });
        setWorkflowStep("lead_captured");
        onStatusChange?.(dm.id, "sent");
      } else {
        setDraftError(data.error || "Failed to submit draft");
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "An unexpected error occurred";
      setDraftError(errorMessage);
    } finally {
      setSubmitting(false);
    }
  }, [draft, dm.id, onStatusChange]);

  const handleExtractLead = useCallback(async () => {
    setExtracting(true);
    setExtractError(null);
    setWorkflowStep("extracting");

    try {
      const response = await fetch("/api/lead/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dmId: dm.id }),
      });

      const data = await response.json();

      if (!response.ok) {
        const errorMessage = data.error || `Lead extraction failed (HTTP ${response.status})`;
        setExtractError(errorMessage);
        setExtracting(false);
        return;
      }

      if (data.success && data.data) {
        const fields: ExtractedLeadFields = {
          name: data.data.fields?.name || null,
          contact: data.data.fields?.contact || null,
          budget: data.data.fields?.budget || null,
          location: data.data.fields?.location || null,
          intent: data.data.fields?.intent || null,
          confidence: data.data.confidence || 0,
        };
        setExtractedFields(fields);

        // Auto-create lead
        await handleCreateLead(fields);
      } else {
        setExtractError(data.error || "Failed to extract lead data");
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "An unexpected error occurred";
      setExtractError(errorMessage);
    } finally {
      setExtracting(false);
    }
  }, [dm.id]);

  const handleCreateLead = useCallback(async (fields: ExtractedLeadFields) => {
    try {
      const response = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dm_id: dm.id,
          extracted_data: fields,
        }),
      });

      const data = await response.json();

      if (response.ok && data.success && data.data) {
        const lead: LeadListItem = {
          id: data.data.lead_id,
          name: data.data.lead?.name || fields.name || "Unknown",
          email: data.data.lead?.email || fields.contact || undefined,
          budget: data.data.lead?.budget || (fields.budget ? parseInt(fields.budget.replace(/[^0-9]/g, ""), 10) || 0 : 0),
          location: data.data.lead?.location || fields.location || undefined,
          intent: data.data.lead?.intent || fields.intent || undefined,
          priority: data.data.lead?.priority || "medium",
          status: data.data.lead?.status || data.data.status || "new",
          dmId: dm.id,
          priorityFlag: data.data.lead?.priorityFlag || false,
        };
        setLeadCreated(lead);
        setWorkflowStep("lead_captured");
      }
    } catch (err) {
      console.error("[DMDetailView] Failed to create lead:", err);
    }
  }, [dm.id]);

  const handleCreateInSalesforce = useCallback(async () => {
    if (!leadCreated) return;

    setSalesforceStatus("pending");

    try {
      const response = await fetch(`/api/leads/${leadCreated.id}/salesforce`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmed_by: "officer-current" }),
      });

      const data = await response.json();

      if (response.ok) {
        setSalesforceStatus(data.salesforce_status || "pending_manual");
        setWorkflowStep("salesforce");
      } else {
        setSalesforceStatus("error");
      }
    } catch {
      setSalesforceStatus("error");
    }
  }, [leadCreated]);

  const handleEscalate = useCallback(async () => {
    if (!leadCreated) return;

    try {
      const response = await fetch(`/api/leads/${leadCreated.id}/escalate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: "Escalated by officer from DM detail view" }),
      });

      const data = await response.json();

      if (response.ok && data.escalated) {
        setLeadCreated({
          ...leadCreated,
          status: "escalated",
          priority: "high",
          priorityFlag: true,
          escalatedAt: data.escalated_at,
        });
        onStatusChange?.(dm.id, "escalated");
      }
    } catch (err) {
      console.error("[DMDetailView] Failed to escalate lead:", err);
    }
  }, [leadCreated, dm.id, onStatusChange]);

  const slaBreached = dm.slaBreached ?? new Date(dm.slaDeadline).getTime() < Date.now();

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-gray-200 bg-white px-4 py-3">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center justify-center rounded-lg p-1.5 text-gray-500 transition-colors duration-200 hover:bg-gray-100 hover:text-gray-700 focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
            aria-label="Back to inbox"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5" aria-hidden="true">
              <path fillRule="evenodd" d="M17 10a.75.75 0 01-.75.75H5.612l4.158 3.96a.75.75 0 11-1.04 1.08l-5.5-5.25a.75.75 0 010-1.08l5.5-5.25a.75.75 0 111.04 1.08L5.612 9.25H16.25A.75.75 0 0117 10z" clipRule="evenodd" />
            </svg>
          </button>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-heading-3 text-gray-900 truncate">{dm.sender.name}</h2>
            <StatusTag status={dm.status as DMStatus} size="sm" />
            <PriorityBadge priority={dm.priority} />
            <SLABadge slaDeadline={dm.slaDeadline} slaBreached={slaBreached} />
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <PlatformIcon platform={dm.platform} />
            <span className="text-body-sm text-gray-500">@{dm.sender.handle}</span>
            <span className="text-gray-300">·</span>
            <span className="text-body-sm text-gray-500">{formatTimestamp(dm.timestamp)}</span>
            {dm.metadata.communityName && (
              <>
                <span className="text-gray-300">·</span>
                <span className="inline-flex items-center rounded-full border border-brand-200 bg-brand-50 px-2 py-0.5 text-2xs font-medium text-brand-700">
                  {dm.metadata.communityName}
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        <div className="flex flex-col lg:flex-row gap-4 p-4">
          {/* Main Column */}
          <div className="flex-1 min-w-0 space-y-4">
            {/* Message Content */}
            <div className="rounded-lg border border-gray-200 bg-white p-4">
              <div className="flex items-start gap-3">
                <img
                  src={dm.sender.avatarUrl}
                  alt={dm.sender.name}
                  className="w-10 h-10 rounded-full flex-shrink-0 object-cover"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-body-sm font-semibold text-gray-900">{dm.sender.name}</span>
                    <span className="text-2xs text-gray-400">{formatRelativeTime(dm.timestamp)}</span>
                  </div>
                  <p className="text-body text-gray-800 whitespace-pre-wrap">{dm.content}</p>
                  {dm.metadata.propertyType && (
                    <div className="flex flex-wrap gap-1.5 mt-3">
                      {dm.metadata.propertyType && (
                        <span className="inline-flex items-center rounded bg-gray-100 border border-gray-200 px-1.5 py-0.5 text-2xs text-gray-600 capitalize">
                          {dm.metadata.propertyType.replace(/_/g, " ")}
                        </span>
                      )}
                      {dm.metadata.bedrooms && (
                        <span className="inline-flex items-center rounded bg-gray-100 border border-gray-200 px-1.5 py-0.5 text-2xs text-gray-600">
                          {dm.metadata.bedrooms} bed
                        </span>
                      )}
                      {dm.intent && (
                        <span className="inline-flex items-center rounded bg-gray-100 border border-gray-200 px-1.5 py-0.5 text-2xs text-gray-600 capitalize">
                          {dm.intent.replace(/_/g, " ")}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Confidence Score */}
            <div className="rounded-lg border border-gray-200 bg-white p-4">
              <h3 className="text-body-sm font-medium text-gray-700 mb-2">Message Confidence</h3>
              <ConfidenceMeter confidence={dm.confidenceScore} showLabel />
            </div>

            {/* Draft Composer */}
            <DraftComposerSection
              dm={dm}
              draft={draft}
              generating={generating}
              submitting={submitting}
              error={draftError}
              onGenerate={handleGenerateDraft}
              onEdit={handleEditDraft}
              onSubmit={handleSubmitDraft}
              onRegenerate={handleGenerateDraft}
            />

            {/* Knowledge Base Context */}
            {(knowledgeContext.length > 0 || contextLoading) && (
              <KnowledgeContextPanel entries={knowledgeContext} loading={contextLoading} />
            )}
          </div>

          {/* Right Sidebar — Lead Capture */}
          <div className="w-full lg:w-80 flex-shrink-0">
            <LeadCaptureSidebar
              dm={dm}
              extractedFields={extractedFields}
              extracting={extracting}
              extractError={extractError}
              leadCreated={leadCreated}
              salesforceStatus={salesforceStatus}
              onExtract={handleExtractLead}
              onCreateInSalesforce={handleCreateInSalesforce}
              onEscalate={handleEscalate}
            />

            {/* Workflow Progress */}
            <div className="mt-4 rounded-lg border border-gray-200 bg-white p-4">
              <h3 className="text-body-sm font-medium text-gray-700 mb-3">Workflow Progress</h3>
              <div className="space-y-2">
                <WorkflowStepIndicator
                  label="View DM"
                  completed={true}
                  active={workflowStep === "view"}
                />
                <WorkflowStepIndicator
                  label="Generate Draft"
                  completed={draft !== null}
                  active={workflowStep === "drafting"}
                />
                <WorkflowStepIndicator
                  label="Review & Approve"
                  completed={draft?.approved === true}
                  active={workflowStep === "reviewing"}
                />
                <WorkflowStepIndicator
                  label="Extract Lead"
                  completed={leadCreated !== null}
                  active={workflowStep === "extracting"}
                />
                <WorkflowStepIndicator
                  label="Create in Salesforce"
                  completed={salesforceStatus !== null && salesforceStatus !== "pending" && salesforceStatus !== "error"}
                  active={workflowStep === "salesforce"}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function WorkflowStepIndicator({
  label,
  completed,
  active,
}: {
  label: string;
  completed: boolean;
  active: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <div
        className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 transition-colors duration-200 ${
          completed
            ? "bg-brand-500 text-white"
            : active
            ? "border-2 border-brand-500 bg-white"
            : "border-2 border-gray-300 bg-white"
        }`}
      >
        {completed && (
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3" aria-hidden="true">
            <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
          </svg>
        )}
        {active && !completed && (
          <div className="w-2 h-2 rounded-full bg-brand-500" />
        )}
      </div>
      <span
        className={`text-body-sm ${
          completed
            ? "text-gray-900 font-medium"
            : active
            ? "text-brand-600 font-medium"
            : "text-gray-400"
        }`}
      >
        {label}
      </span>
    </div>
  );
}

export { DMDetailView };
export type { DMDetail, KnowledgeContextEntry };