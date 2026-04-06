"use client";

import React, { useState, useEffect, useCallback } from "react";
import useLead from "@/lib/hooks/useLead";
import type { LeadUpdatePayload } from "@/lib/hooks/useLead";
import ConfidenceMeter from "@/components/ui/ConfidenceMeter";
import StatusTag from "@/components/ui/StatusTag";
import type { DMStatus } from "@/lib/constants";

// ============================================================
// LeadCaptureSidebar — Lead data capture and Salesforce submission
// ============================================================

export interface LeadCaptureSidebarProps {
  dmId: string;
  leadId?: string | null;
  onLeadCreated?: (leadId: string) => void;
  onEscalated?: (leadId: string) => void;
  onClose?: () => void;
}

interface EditableFields {
  name: string;
  email: string;
  company: string;
  budget: string;
  location: string;
  intent: string;
  notes: string;
}

interface FieldConfidence {
  name: number;
  email: number;
  budget: number;
  location: number;
  intent: number;
}

type NotificationType = "success" | "error" | "info";

interface SidebarNotification {
  id: string;
  type: NotificationType;
  message: string;
}

function generateNotificationId(): string {
  return `notif-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
}

function CheckIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
      className="w-5 h-5"
      aria-hidden="true"
    >
      <path
        fillRule="evenodd"
        d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function ExclamationIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
      className="w-5 h-5"
      aria-hidden="true"
    >
      <path
        fillRule="evenodd"
        d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0110 5zm0 10a1 1 0 100-2 1 1 0 000 2z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function InfoIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
      className="w-5 h-5"
      aria-hidden="true"
    >
      <path
        fillRule="evenodd"
        d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a.75.75 0 000 1.5h.253a.25.25 0 01.244.304l-.459 2.066A1.75 1.75 0 0010.747 15H11a.75.75 0 000-1.5h-.253a.25.25 0 01-.244-.304l.459-2.066A1.75 1.75 0 009.253 9H9z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
      className="w-5 h-5"
      aria-hidden="true"
    >
      <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
    </svg>
  );
}

function SalesforceIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
      className="w-5 h-5"
      aria-hidden="true"
    >
      <path d="M5.433 13.917l1.262-3.155A4 4 0 017.58 9.42l6.92-6.918a2.121 2.121 0 013 3l-6.92 6.918c-.383.383-.84.685-1.343.886l-3.154 1.262a.5.5 0 01-.65-.65z" />
      <path d="M3.5 5.75c0-.69.56-1.25 1.25-1.25H10A.75.75 0 0010 3H4.75A2.75 2.75 0 002 5.75v9.5A2.75 2.75 0 004.75 18h9.5A2.75 2.75 0 0017 15.25V10a.75.75 0 00-1.5 0v5.25c0 .69-.56 1.25-1.25 1.25h-9.5c-.69 0-1.25-.56-1.25-1.25v-9.5z" />
    </svg>
  );
}

function FlagIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
      className="w-5 h-5"
      aria-hidden="true"
    >
      <path d="M3.5 2.75a.75.75 0 00-1.5 0v14.5a.75.75 0 001.5 0v-4.392l1.657-.348a6.449 6.449 0 014.271.572 7.948 7.948 0 005.965.524l2.078-.64A.75.75 0 0018 12.25v-8.5a.75.75 0 00-.904-.734l-2.38.501a7.25 7.25 0 01-4.186-.363l-.502-.2a8.75 8.75 0 00-5.053-.439l-1.475.31V2.75z" />
    </svg>
  );
}

const NOTIFICATION_COLORS: Record<NotificationType, { bg: string; border: string; text: string; icon: string }> = {
  success: {
    bg: "bg-confidence-high-bg",
    border: "border-confidence-high-border",
    text: "text-confidence-high",
    icon: "text-confidence-high",
  },
  error: {
    bg: "bg-confidence-low-bg",
    border: "border-confidence-low-border",
    text: "text-confidence-low",
    icon: "text-confidence-low",
  },
  info: {
    bg: "bg-status-new-bg",
    border: "border-status-new-border",
    text: "text-status-new",
    icon: "text-status-new",
  },
};

function NotificationBanner({
  notification,
  onDismiss,
}: {
  notification: SidebarNotification;
  onDismiss: (id: string) => void;
}) {
  const colors = NOTIFICATION_COLORS[notification.type];

  useEffect(() => {
    const timeout = setTimeout(() => {
      onDismiss(notification.id);
    }, 5000);
    return () => clearTimeout(timeout);
  }, [notification.id, onDismiss]);

  return (
    <div
      className={`flex items-start gap-2 rounded-lg border p-3 ${colors.bg} ${colors.border} animate-fade-in`}
      role="alert"
    >
      <span className={`flex-shrink-0 mt-0.5 ${colors.icon}`}>
        {notification.type === "success" && <CheckIcon />}
        {notification.type === "error" && <ExclamationIcon />}
        {notification.type === "info" && <InfoIcon />}
      </span>
      <p className={`text-body-sm flex-1 ${colors.text}`}>
        {notification.message}
      </p>
      <button
        type="button"
        onClick={() => onDismiss(notification.id)}
        className={`flex-shrink-0 ${colors.text} hover:opacity-70 transition-opacity`}
        aria-label="Dismiss notification"
      >
        <CloseIcon />
      </button>
    </div>
  );
}

function FieldLabel({
  label,
  confidence,
  required,
}: {
  label: string;
  confidence?: number;
  required?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-2 mb-1">
      <label className="text-body-sm font-medium text-gray-700">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {confidence !== undefined && (
        <span
          className={`text-2xs font-medium px-1.5 py-0.5 rounded-full ${
            confidence >= 0.8
              ? "bg-confidence-high-bg text-confidence-high"
              : confidence >= 0.5
                ? "bg-confidence-medium-bg text-confidence-medium"
                : "bg-confidence-low-bg text-confidence-low"
          }`}
        >
          {Math.round(confidence * 100)}%
        </span>
      )}
    </div>
  );
}

export default function LeadCaptureSidebar({
  dmId,
  leadId,
  onLeadCreated,
  onEscalated,
  onClose,
}: LeadCaptureSidebarProps) {
  const {
    lead,
    loading,
    error: hookError,
    extractLead,
    fetchLead,
    updateLead,
    createInSalesforce,
    escalateLead,
    clearError,
  } = useLead();

  const [fields, setFields] = useState<EditableFields>({
    name: "",
    email: "",
    company: "",
    budget: "",
    location: "",
    intent: "",
    notes: "",
  });

  const [fieldConfidence, setFieldConfidence] = useState<FieldConfidence>({
    name: 0,
    email: 0,
    budget: 0,
    location: 0,
    intent: 0,
  });

  const [overallConfidence, setOverallConfidence] = useState<number>(0);
  const [currentLeadId, setCurrentLeadId] = useState<string | null>(leadId || null);
  const [currentLeadStatus, setCurrentLeadStatus] = useState<string | null>(null);
  const [flaggedForFollowUp, setFlaggedForFollowUp] = useState<boolean>(false);
  const [extracting, setExtracting] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [creatingInSalesforce, setCreatingInSalesforce] = useState<boolean>(false);
  const [escalating, setEscalating] = useState<boolean>(false);
  const [notifications, setNotifications] = useState<SidebarNotification[]>([]);
  const [isDirty, setIsDirty] = useState<boolean>(false);

  const addNotification = useCallback(
    (type: NotificationType, message: string) => {
      const notification: SidebarNotification = {
        id: generateNotificationId(),
        type,
        message,
      };
      setNotifications((prev) => [notification, ...prev].slice(0, 3));
    },
    []
  );

  const dismissNotification = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  // Extract lead data from DM on mount if no leadId provided
  useEffect(() => {
    if (leadId) {
      fetchLead(leadId).then((leadItem) => {
        if (leadItem) {
          setCurrentLeadId(leadItem.id);
          setCurrentLeadStatus(leadItem.status || null);
          setFlaggedForFollowUp(leadItem.priorityFlag || false);
          setFields({
            name: leadItem.name || "",
            email: leadItem.email || "",
            company: leadItem.company || "",
            budget: leadItem.budget ? String(leadItem.budget) : "",
            location: leadItem.location || "",
            intent: leadItem.intent || "",
            notes: "",
          });
          setFieldConfidence({
            name: leadItem.name ? 1.0 : 0,
            email: leadItem.email ? 1.0 : 0,
            budget: leadItem.budget ? 1.0 : 0,
            location: leadItem.location ? 1.0 : 0,
            intent: leadItem.intent ? 1.0 : 0,
          });
          setOverallConfidence(leadItem.confidenceScore || 0);
        }
      });
    } else if (dmId) {
      setExtracting(true);
      extractLead(dmId)
        .then((extracted) => {
          if (extracted) {
            setFields({
              name: extracted.name || "",
              email: extracted.contact || "",
              company: "",
              budget: extracted.budget || "",
              location: extracted.location || "",
              intent: extracted.intent || "",
              notes: "",
            });
            setFieldConfidence({
              name: extracted.name !== null ? 1.0 : 0,
              email: extracted.contact !== null ? 1.0 : 0,
              budget: extracted.budget !== null ? 1.0 : 0,
              location: extracted.location !== null ? 1.0 : 0,
              intent: extracted.intent !== null ? 1.0 : 0,
            });
            setOverallConfidence(extracted.confidence);
          }
        })
        .catch(() => {
          addNotification("error", "Failed to extract lead data from DM.");
        })
        .finally(() => {
          setExtracting(false);
        });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dmId, leadId]);

  // Show hook errors as notifications
  useEffect(() => {
    if (hookError) {
      addNotification("error", hookError);
      clearError();
    }
  }, [hookError, addNotification, clearError]);

  const handleFieldChange = useCallback(
    (field: keyof EditableFields, value: string) => {
      setFields((prev) => ({ ...prev, [field]: value }));
      setIsDirty(true);
    },
    []
  );

  const handleSaveFields = useCallback(async () => {
    if (!currentLeadId) {
      addNotification("info", "Please create the lead first before saving changes.");
      return;
    }

    setSaving(true);

    try {
      const payload: LeadUpdatePayload = {
        name: fields.name || undefined,
        email: fields.email || undefined,
        company: fields.company || undefined,
        budget: fields.budget ? parseInt(fields.budget.replace(/[^0-9]/g, ""), 10) || undefined : undefined,
        location: fields.location || undefined,
        intent: fields.intent || undefined,
        notes: fields.notes || undefined,
        confirmedBy: "officer-current",
      };

      const updated = await updateLead(currentLeadId, payload);

      if (updated) {
        setCurrentLeadStatus(updated.status || currentLeadStatus);
        setIsDirty(false);
        addNotification("success", "Lead fields saved successfully.");
      } else {
        addNotification("error", "Failed to save lead fields.");
      }
    } catch {
      addNotification("error", "An error occurred while saving lead fields.");
    } finally {
      setSaving(false);
    }
  }, [currentLeadId, fields, currentLeadStatus, updateLead, addNotification]);

  const handleCreateLead = useCallback(async () => {
    if (!dmId) {
      addNotification("error", "DM ID is required to create a lead.");
      return;
    }

    setSaving(true);

    try {
      const response = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dm_id: dmId,
          extracted_data: {
            name: fields.name || null,
            contact: fields.email || null,
            budget: fields.budget || null,
            location: fields.location || null,
            intent: fields.intent || null,
            confidence: overallConfidence,
          },
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        const newLeadId = data.data?.lead_id || data.data?.lead?.id;
        if (newLeadId) {
          setCurrentLeadId(newLeadId);
          setCurrentLeadStatus("new");
          setIsDirty(false);
          addNotification("success", "Lead created successfully.");
          onLeadCreated?.(newLeadId);
        }
      } else {
        addNotification("error", data.error || "Failed to create lead.");
      }
    } catch {
      addNotification("error", "An error occurred while creating the lead.");
    } finally {
      setSaving(false);
    }
  }, [dmId, fields, overallConfidence, addNotification, onLeadCreated]);

  const handleCreateInSalesforce = useCallback(async () => {
    if (!currentLeadId) {
      addNotification("error", "Please create the lead first.");
      return;
    }

    setCreatingInSalesforce(true);

    try {
      const result = await createInSalesforce(currentLeadId, "officer-current");

      if (result) {
        addNotification(
          "success",
          `Lead submitted to Salesforce. Status: ${result.salesforceStatus}`
        );
      } else {
        addNotification("error", "Failed to create lead in Salesforce.");
      }
    } catch {
      addNotification("error", "An error occurred during Salesforce integration.");
    } finally {
      setCreatingInSalesforce(false);
    }
  }, [currentLeadId, createInSalesforce, addNotification]);

  const handleToggleFollowUp = useCallback(async () => {
    const newFlagState = !flaggedForFollowUp;
    setFlaggedForFollowUp(newFlagState);

    if (newFlagState && currentLeadId) {
      setEscalating(true);

      try {
        const result = await escalateLead(
          currentLeadId,
          "Manually flagged for Sales Consultant follow-up"
        );

        if (result) {
          setCurrentLeadStatus("escalated");
          addNotification("success", "Lead flagged for Sales Consultant follow-up.");
          onEscalated?.(currentLeadId);
        } else {
          setFlaggedForFollowUp(false);
          addNotification("error", "Failed to escalate lead.");
        }
      } catch {
        setFlaggedForFollowUp(false);
        addNotification("error", "An error occurred during escalation.");
      } finally {
        setEscalating(false);
      }
    } else if (!newFlagState) {
      addNotification("info", "Follow-up flag removed locally. Lead status unchanged.");
    }
  }, [flaggedForFollowUp, currentLeadId, escalateLead, addNotification, onEscalated]);

  const isLoading = loading || extracting;

  return (
    <aside
      className="flex flex-col w-full max-w-panel bg-white border-l border-gray-200 h-full overflow-hidden"
      aria-label="Lead Capture Sidebar"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-gray-50">
        <div className="flex items-center gap-2">
          <h3 className="text-heading-4 text-gray-900">Lead Capture</h3>
          {currentLeadStatus && (
            <StatusTag
              status={currentLeadStatus as DMStatus}
              size="sm"
            />
          )}
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
            aria-label="Close sidebar"
          >
            <CloseIcon />
          </button>
        )}
      </div>

      {/* Notifications */}
      {notifications.length > 0 && (
        <div className="px-4 pt-3 space-y-2">
          {notifications.map((notification) => (
            <NotificationBanner
              key={notification.id}
              notification={notification}
              onDismiss={dismissNotification}
            />
          ))}
        </div>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-body-sm text-gray-500">
              {extracting ? "Extracting lead data..." : "Loading lead..."}
            </p>
          </div>
        </div>
      )}

      {/* Content */}
      {!isLoading && (
        <div className="flex-1 overflow-y-auto scrollbar-thin">
          {/* Overall Confidence */}
          <div className="px-4 py-3 border-b border-gray-100">
            <p className="text-caption font-medium text-gray-500 mb-2">
              Extraction Confidence
            </p>
            <ConfidenceMeter confidence={overallConfidence} showLabel />
          </div>

          {/* Editable Fields */}
          <div className="px-4 py-4 space-y-4">
            {/* Name */}
            <div>
              <FieldLabel
                label="Name"
                confidence={fieldConfidence.name}
                required
              />
              <input
                type="text"
                value={fields.name}
                onChange={(e) => handleFieldChange("name", e.target.value)}
                placeholder="Enter lead name"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-body-sm text-gray-900 placeholder:text-gray-400 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 focus:outline-none transition-colors"
              />
            </div>

            {/* Contact / Email */}
            <div>
              <FieldLabel
                label="Contact"
                confidence={fieldConfidence.email}
              />
              <input
                type="text"
                value={fields.email}
                onChange={(e) => handleFieldChange("email", e.target.value)}
                placeholder="Email or phone number"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-body-sm text-gray-900 placeholder:text-gray-400 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 focus:outline-none transition-colors"
              />
            </div>

            {/* Company */}
            <div>
              <FieldLabel label="Company" />
              <input
                type="text"
                value={fields.company}
                onChange={(e) => handleFieldChange("company", e.target.value)}
                placeholder="Company name"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-body-sm text-gray-900 placeholder:text-gray-400 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 focus:outline-none transition-colors"
              />
            </div>

            {/* Budget */}
            <div>
              <FieldLabel
                label="Budget"
                confidence={fieldConfidence.budget}
              />
              <input
                type="text"
                value={fields.budget}
                onChange={(e) => handleFieldChange("budget", e.target.value)}
                placeholder="e.g. $500,000"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-body-sm text-gray-900 placeholder:text-gray-400 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 focus:outline-none transition-colors"
              />
            </div>

            {/* Location */}
            <div>
              <FieldLabel
                label="Location"
                confidence={fieldConfidence.location}
              />
              <input
                type="text"
                value={fields.location}
                onChange={(e) => handleFieldChange("location", e.target.value)}
                placeholder="City, State or Community"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-body-sm text-gray-900 placeholder:text-gray-400 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 focus:outline-none transition-colors"
              />
            </div>

            {/* Intent */}
            <div>
              <FieldLabel
                label="Intent"
                confidence={fieldConfidence.intent}
              />
              <textarea
                value={fields.intent}
                onChange={(e) => handleFieldChange("intent", e.target.value)}
                placeholder="Describe the lead's intent"
                rows={3}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-body-sm text-gray-900 placeholder:text-gray-400 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 focus:outline-none transition-colors resize-none"
              />
            </div>

            {/* Notes */}
            <div>
              <FieldLabel label="Notes" />
              <textarea
                value={fields.notes}
                onChange={(e) => handleFieldChange("notes", e.target.value)}
                placeholder="Additional notes for the sales team"
                rows={2}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-body-sm text-gray-900 placeholder:text-gray-400 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 focus:outline-none transition-colors resize-none"
              />
            </div>

            {/* Flag for Sales Follow-Up Toggle */}
            <div className="flex items-center justify-between rounded-lg border border-gray-200 px-3 py-3 bg-gray-50">
              <div className="flex items-center gap-2">
                <span className={`${flaggedForFollowUp ? "text-status-escalated" : "text-gray-400"}`}>
                  <FlagIcon />
                </span>
                <span className="text-body-sm font-medium text-gray-700">
                  Flag for Sales Follow-Up
                </span>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={flaggedForFollowUp}
                aria-label="Flag for Sales Follow-Up"
                onClick={handleToggleFollowUp}
                disabled={escalating}
                className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed ${
                  flaggedForFollowUp ? "bg-status-escalated" : "bg-gray-300"
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    flaggedForFollowUp ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Footer Actions */}
      {!isLoading && (
        <div className="px-4 py-3 border-t border-gray-200 bg-gray-50 space-y-2">
          {/* Save / Create Lead */}
          {!currentLeadId ? (
            <button
              type="button"
              onClick={handleCreateLead}
              disabled={saving || !fields.name.trim()}
              className="w-full flex items-center justify-center gap-2 rounded-lg bg-brand-500 px-4 py-2.5 text-body-sm font-medium text-white shadow-sm hover:bg-brand-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Creating Lead...
                </>
              ) : (
                "Create Lead"
              )}
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSaveFields}
              disabled={saving || !isDirty}
              className="w-full flex items-center justify-center gap-2 rounded-lg bg-brand-500 px-4 py-2.5 text-body-sm font-medium text-white shadow-sm hover:bg-brand-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Changes"
              )}
            </button>
          )}

          {/* Create in Salesforce */}
          <button
            type="button"
            onClick={handleCreateInSalesforce}
            disabled={creatingInSalesforce || !currentLeadId}
            className="w-full flex items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-body-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {creatingInSalesforce ? (
              <>
                <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                Submitting to Salesforce...
              </>
            ) : (
              <>
                <SalesforceIcon />
                Create Lead in Salesforce
              </>
            )}
          </button>

          {/* Lead ID Reference */}
          {currentLeadId && (
            <p className="text-2xs text-gray-400 text-center pt-1">
              Lead ID: {currentLeadId}
            </p>
          )}
        </div>
      )}
    </aside>
  );
}

export { LeadCaptureSidebar };