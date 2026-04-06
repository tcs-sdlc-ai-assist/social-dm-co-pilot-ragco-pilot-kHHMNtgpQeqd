"use client";

import React, { useState, useCallback, useMemo } from "react";
import Header from "@/components/layout/Header";
import InboxPanel from "@/components/inbox/InboxPanel";
import DMDetailView from "@/components/inbox/DMDetailView";
import LeadCaptureSidebar from "@/components/lead/LeadCaptureSidebar";
import NotificationCenter from "@/components/notifications/NotificationCenter";
import type { InboxDM } from "@/lib/hooks/useInbox";
import type { DMDetail } from "@/components/inbox/DMDetailView";

// ============================================================
// Main Dashboard Page — Three-panel Co-Pilot workspace
// ============================================================

function SparklesIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
      className="w-12 h-12 text-brand-500"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 0 0-2.455 2.456ZM16.894 20.567 16.5 21.75l-.394-1.183a2.25 2.25 0 0 0-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 0 0 1.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 0 0 1.423 1.423l1.183.394-1.183.394a2.25 2.25 0 0 0-1.423 1.423Z"
      />
    </svg>
  );
}

function InboxIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
      className="w-5 h-5 text-gray-400"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M2.25 13.5h3.86a2.25 2.25 0 0 1 2.012 1.244l.256.512a2.25 2.25 0 0 0 2.013 1.244h3.218a2.25 2.25 0 0 0 2.013-1.244l.256-.512a2.25 2.25 0 0 1 2.013-1.244h3.859m-17.5 0V6.75A2.25 2.25 0 0 1 4.5 4.5h15a2.25 2.25 0 0 1 2.25 2.25v6.75m-17.5 0v4.5A2.25 2.25 0 0 0 4.5 19.5h15a2.25 2.25 0 0 0 2.25-2.25v-4.5"
      />
    </svg>
  );
}

function WelcomePanel() {
  return (
    <div className="flex flex-col items-center justify-center h-full px-8 py-16 text-center bg-white">
      <div className="flex items-center justify-center w-20 h-20 rounded-full bg-brand-50 mb-6">
        <SparklesIcon />
      </div>
      <h2 className="text-heading-2 text-gray-900 mb-2">
        Welcome to DM Copilot
      </h2>
      <p className="text-body text-gray-500 max-w-md mb-8">
        Select a message from the inbox to view details, generate AI-powered
        draft responses, extract lead data, and manage your Salesforce pipeline.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-2xl w-full">
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-left">
          <div className="flex items-center gap-2 mb-2">
            <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-brand-100 text-brand-700 text-body-sm font-semibold">
              1
            </span>
            <span className="text-body-sm font-medium text-gray-700">
              Select a DM
            </span>
          </div>
          <p className="text-caption text-gray-500">
            Choose a message from the inbox panel to begin the workflow.
          </p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-left">
          <div className="flex items-center gap-2 mb-2">
            <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-brand-100 text-brand-700 text-body-sm font-semibold">
              2
            </span>
            <span className="text-body-sm font-medium text-gray-700">
              Review &amp; Respond
            </span>
          </div>
          <p className="text-caption text-gray-500">
            Generate an AI draft, review it, and approve before sending.
          </p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-left">
          <div className="flex items-center gap-2 mb-2">
            <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-brand-100 text-brand-700 text-body-sm font-semibold">
              3
            </span>
            <span className="text-body-sm font-medium text-gray-700">
              Capture Leads
            </span>
          </div>
          <p className="text-caption text-gray-500">
            Extract lead data and push to Salesforce for follow-up.
          </p>
        </div>
      </div>
      <div className="mt-8 flex items-center gap-2 text-body-sm text-gray-400">
        <InboxIcon />
        <span>Select a message from the inbox to get started</span>
      </div>
    </div>
  );
}

function mapInboxDMToDetail(dm: InboxDM): DMDetail {
  return {
    id: dm.id,
    platform: dm.platform,
    conversationId: dm.conversationId,
    sender: {
      id: dm.sender.id,
      name: dm.sender.name,
      handle: dm.sender.handle,
      avatarUrl: dm.sender.avatarUrl,
    },
    content: dm.content,
    timestamp: dm.timestamp,
    intent: dm.intent,
    status: dm.status,
    priority: dm.priority,
    confidenceScore: dm.confidenceScore,
    slaDeadline: dm.slaDeadline,
    draftResponse: dm.draftResponse,
    sentAt: dm.sentAt,
    escalationReason: dm.escalationReason,
    metadata: {
      communityName: dm.metadata.communityName,
      propertyType: dm.metadata.propertyType,
      bedrooms: dm.metadata.bedrooms,
    },
    draft: dm.draft,
    lead: dm.lead
      ? {
          id: dm.lead.id,
          name: dm.lead.name,
          email: dm.lead.email,
          company: dm.lead.company,
          platform: dm.lead.platform,
          budget: dm.lead.budget,
          location: dm.lead.location,
          intent: dm.lead.intent,
          priority: dm.lead.priority,
          confidenceScore: dm.lead.confidenceScore,
          status: dm.lead.status,
          slaBreached: dm.lead.slaBreached,
          dmId: dm.lead.dmId,
          priorityFlag: dm.lead.priorityFlag,
          escalatedAt: dm.lead.escalatedAt,
          escalationReason: dm.lead.escalationReason,
          salesforceStatus: dm.lead.salesforceStatus,
        }
      : undefined,
    slaBreached: dm.slaBreached,
  };
}

export default function DashboardPage() {
  const [selectedDM, setSelectedDM] = useState<InboxDM | null>(null);
  const [leadId, setLeadId] = useState<string | null>(null);
  const [showNotifications, setShowNotifications] = useState<boolean>(false);
  const [mobileView, setMobileView] = useState<"inbox" | "detail" | "lead">(
    "inbox"
  );

  const recipientId = "officer-default";
  const reviewerId = "officer-default";

  const handleSelectDM = useCallback((dm: InboxDM) => {
    setSelectedDM(dm);
    setLeadId(dm.lead?.id || null);
    setMobileView("detail");
  }, []);

  const handleBackToInbox = useCallback(() => {
    setSelectedDM(null);
    setLeadId(null);
    setMobileView("inbox");
  }, []);

  const handleStatusChange = useCallback(
    (dmId: string, newStatus: string) => {
      if (selectedDM && selectedDM.id === dmId) {
        setSelectedDM((prev) =>
          prev ? { ...prev, status: newStatus } : null
        );
      }
    },
    [selectedDM]
  );

  const handleLeadCreated = useCallback((newLeadId: string) => {
    setLeadId(newLeadId);
  }, []);

  const handleEscalated = useCallback((_leadId: string) => {
    // Lead escalation handled — could refresh inbox or show notification
  }, []);

  const handleNotificationClick = useCallback(() => {
    setShowNotifications((prev) => !prev);
  }, []);

  const handleNavigateToDM = useCallback(
    (dmId: string) => {
      // Close notification center and attempt to select the DM
      setShowNotifications(false);
      // The inbox will need to be scrolled/filtered to this DM
      // For now, we clear selection so the user can find it
      if (selectedDM?.id !== dmId) {
        setSelectedDM(null);
        setLeadId(null);
        setMobileView("inbox");
      }
    },
    [selectedDM]
  );

  const handleNavigateToLead = useCallback(
    (navLeadId: string) => {
      setShowNotifications(false);
      setLeadId(navLeadId);
      if (!selectedDM) {
        setMobileView("lead");
      }
    },
    [selectedDM]
  );

  const dmDetail: DMDetail | null = useMemo(() => {
    if (!selectedDM) return null;
    return mapInboxDMToDetail(selectedDM);
  }, [selectedDM]);

  const showLeadSidebar = selectedDM !== null;

  return (
    <div className="flex flex-col h-screen bg-gray-50 overflow-hidden">
      {/* Header */}
      <Header
        userRole="SOCIAL_MEDIA_OFFICER"
        userName="Officer"
        unreadNotificationCount={0}
        onNotificationClick={handleNotificationClick}
        activePath="/inbox"
      />

      {/* Notification Center */}
      {showNotifications && (
        <div className="absolute top-header right-4 z-50">
          <NotificationCenter
            recipientId={recipientId}
            onNavigateToDM={handleNavigateToDM}
            onNavigateToLead={handleNavigateToLead}
          />
        </div>
      )}

      {/* Main Content — Three-panel layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel — Inbox */}
        <div
          className={`w-full lg:w-1/3 lg:max-w-[420px] flex-shrink-0 border-r border-gray-200 ${
            mobileView === "inbox" ? "block" : "hidden lg:block"
          }`}
        >
          <InboxPanel
            onSelectDM={handleSelectDM}
            selectedDMId={selectedDM?.id || null}
            pollingEnabled={true}
          />
        </div>

        {/* Center Panel — DM Detail */}
        <div
          className={`flex-1 min-w-0 ${
            mobileView === "detail" || mobileView === "lead"
              ? "block"
              : "hidden lg:block"
          }`}
        >
          {dmDetail ? (
            <DMDetailView
              dm={dmDetail}
              onBack={handleBackToInbox}
              onStatusChange={handleStatusChange}
            />
          ) : (
            <WelcomePanel />
          )}
        </div>

        {/* Right Panel — Lead Capture Sidebar */}
        {showLeadSidebar && (
          <div
            className={`w-full lg:w-80 xl:w-96 flex-shrink-0 border-l border-gray-200 ${
              mobileView === "lead" ? "block" : "hidden xl:block"
            }`}
          >
            <LeadCaptureSidebar
              dmId={selectedDM?.id || ""}
              leadId={leadId}
              onLeadCreated={handleLeadCreated}
              onEscalated={handleEscalated}
              onClose={() => setMobileView("detail")}
            />
          </div>
        )}
      </div>

      {/* Mobile Bottom Navigation */}
      {selectedDM && (
        <div className="flex items-center border-t border-gray-200 bg-white lg:hidden">
          <button
            type="button"
            onClick={() => setMobileView("inbox")}
            className={`flex-1 flex flex-col items-center gap-0.5 py-2.5 text-2xs font-medium transition-colors duration-200 ${
              mobileView === "inbox"
                ? "text-brand-600 bg-brand-50"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="w-5 h-5"
              aria-hidden="true"
            >
              <path
                fillRule="evenodd"
                d="M1 11.27c0-.246.033-.492.099-.73l1.523-5.521A2.75 2.75 0 0 1 5.273 3h9.454a2.75 2.75 0 0 1 2.651 2.019l1.523 5.52c.066.239.099.485.099.732V15.25A2.75 2.75 0 0 1 16.25 18H3.75A2.75 2.75 0 0 1 1 15.25V11.27Z"
                clipRule="evenodd"
              />
            </svg>
            Inbox
          </button>
          <button
            type="button"
            onClick={() => setMobileView("detail")}
            className={`flex-1 flex flex-col items-center gap-0.5 py-2.5 text-2xs font-medium transition-colors duration-200 ${
              mobileView === "detail"
                ? "text-brand-600 bg-brand-50"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="w-5 h-5"
              aria-hidden="true"
            >
              <path
                fillRule="evenodd"
                d="M4.5 2A1.5 1.5 0 0 0 3 3.5v13A1.5 1.5 0 0 0 4.5 18h11a1.5 1.5 0 0 0 1.5-1.5V7.621a1.5 1.5 0 0 0-.44-1.06l-4.12-4.122A1.5 1.5 0 0 0 11.378 2H4.5Z"
                clipRule="evenodd"
              />
            </svg>
            Detail
          </button>
          <button
            type="button"
            onClick={() => setMobileView("lead")}
            className={`flex-1 flex flex-col items-center gap-0.5 py-2.5 text-2xs font-medium transition-colors duration-200 ${
              mobileView === "lead"
                ? "text-brand-600 bg-brand-50"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="w-5 h-5"
              aria-hidden="true"
            >
              <path d="M10 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM3.465 14.493a1.23 1.23 0 0 0 .41 1.412A9.957 9.957 0 0 0 10 18c2.31 0 4.438-.784 6.131-2.1.43-.333.604-.903.408-1.41a7.002 7.002 0 0 0-13.074.003Z" />
            </svg>
            Lead
          </button>
        </div>
      )}
    </div>
  );
}