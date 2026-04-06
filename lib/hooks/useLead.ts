import { useState, useCallback } from "react";
import type { LeadData, ExtractedLeadFields, APIResponse } from "@/lib/types";

// ============================================================
// useLead — Custom hook for lead management and Salesforce integration
// ============================================================

export interface LeadListItem {
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

export interface LeadUpdatePayload {
  name?: string;
  email?: string;
  company?: string;
  budget?: number;
  budgetCurrency?: string;
  location?: string;
  intent?: string;
  priority?: string;
  status?: string;
  tags?: string[];
  notes?: string;
  confirmedBy?: string;
}

export interface UseLeadReturn {
  lead: LeadData | null;
  leads: LeadListItem[];
  loading: boolean;
  error: string | null;
  extractLead: (dmId: string) => Promise<ExtractedLeadFields | null>;
  fetchLead: (leadId: string) => Promise<LeadListItem | null>;
  fetchLeads: (filters?: Record<string, string>) => Promise<void>;
  updateLead: (id: string, fields: LeadUpdatePayload) => Promise<LeadListItem | null>;
  createInSalesforce: (leadId: string, confirmedBy?: string) => Promise<{ leadId: string; salesforceStatus: string } | null>;
  escalateLead: (leadId: string, reason?: string) => Promise<LeadListItem | null>;
  clearError: () => void;
  clearLead: () => void;
}

export function useLead(): UseLeadReturn {
  const [lead, setLead] = useState<LeadData | null>(null);
  const [leads, setLeads] = useState<LeadListItem[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const clearLead = useCallback(() => {
    setLead(null);
  }, []);

  /**
   * Extracts lead data from a DM by calling the extraction endpoint.
   */
  const extractLead = useCallback(async (dmId: string): Promise<ExtractedLeadFields | null> => {
    if (!dmId || dmId.trim().length === 0) {
      setError("DM ID is required for lead extraction");
      return null;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/lead/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dm_id: dmId }),
      });

      const data = await response.json();

      if (!response.ok) {
        const errorMessage = data.error || `Lead extraction failed with status ${response.status}`;
        setError(errorMessage);
        return null;
      }

      const extractedFields: ExtractedLeadFields = data.data ?? data;

      if (data.lead) {
        setLead(data.lead);
      }

      return extractedFields;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to extract lead data";
      setError(errorMessage);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Fetches a single lead by ID.
   */
  const fetchLead = useCallback(async (leadId: string): Promise<LeadListItem | null> => {
    if (!leadId || leadId.trim().length === 0) {
      setError("Lead ID is required");
      return null;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/leads/${leadId}`, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      });

      const data = await response.json();

      if (!response.ok) {
        const errorMessage = data.error || `Failed to fetch lead with status ${response.status}`;
        setError(errorMessage);
        return null;
      }

      const leadItem: LeadListItem = data.data ?? data;
      return leadItem;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to fetch lead";
      setError(errorMessage);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Fetches a list of leads with optional filters.
   */
  const fetchLeads = useCallback(async (filters?: Record<string, string>): Promise<void> => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (filters) {
        for (const [key, value] of Object.entries(filters)) {
          if (value !== undefined && value !== null && value !== "") {
            params.set(key, value);
          }
        }
      }

      const queryString = params.toString();
      const url = queryString ? `/api/leads?${queryString}` : "/api/leads";

      const response = await fetch(url, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      });

      const data = await response.json();

      if (!response.ok) {
        const errorMessage = data.error || `Failed to fetch leads with status ${response.status}`;
        setError(errorMessage);
        return;
      }

      const leadsList: LeadListItem[] = Array.isArray(data) ? data : (data.data ?? []);
      setLeads(leadsList);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to fetch leads";
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Updates lead fields after officer review.
   */
  const updateLead = useCallback(async (
    id: string,
    fields: LeadUpdatePayload
  ): Promise<LeadListItem | null> => {
    if (!id || id.trim().length === 0) {
      setError("Lead ID is required for update");
      return null;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/leads/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(fields),
      });

      const data = await response.json();

      if (!response.ok) {
        const errorMessage = data.error || `Failed to update lead with status ${response.status}`;
        setError(errorMessage);
        return null;
      }

      const updatedLead: LeadListItem = data.data ?? data;

      // Update the lead in the leads list if present
      setLeads((prev) =>
        prev.map((l) => (l.id === id ? { ...l, ...updatedLead } : l))
      );

      return updatedLead;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to update lead";
      setError(errorMessage);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Creates a lead in Salesforce via the integration endpoint.
   */
  const createInSalesforce = useCallback(async (
    leadId: string,
    confirmedBy?: string
  ): Promise<{ leadId: string; salesforceStatus: string } | null> => {
    if (!leadId || leadId.trim().length === 0) {
      setError("Lead ID is required for Salesforce creation");
      return null;
    }

    setLoading(true);
    setError(null);

    try {
      const body: Record<string, string> = {};
      if (confirmedBy) {
        body.confirmed_by = confirmedBy;
      }

      const response = await fetch(`/api/leads/${leadId}/salesforce`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (!response.ok) {
        const errorMessage = data.error || `Salesforce creation failed with status ${response.status}`;
        setError(errorMessage);
        return null;
      }

      const result = data.data ?? data;

      // Update the lead in the leads list with Salesforce status
      setLeads((prev) =>
        prev.map((l) =>
          l.id === leadId
            ? { ...l, salesforceStatus: result.salesforceStatus ?? result.salesforce_status }
            : l
        )
      );

      return {
        leadId: result.leadId ?? result.lead_id ?? leadId,
        salesforceStatus: result.salesforceStatus ?? result.salesforce_status ?? "pending",
      };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to create lead in Salesforce";
      setError(errorMessage);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Escalates a lead to a Sales Consultant.
   */
  const escalateLead = useCallback(async (
    leadId: string,
    reason?: string
  ): Promise<LeadListItem | null> => {
    if (!leadId || leadId.trim().length === 0) {
      setError("Lead ID is required for escalation");
      return null;
    }

    setLoading(true);
    setError(null);

    try {
      const body: Record<string, string> = {};
      if (reason) {
        body.reason = reason;
      }

      const response = await fetch(`/api/leads/${leadId}/escalate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (!response.ok) {
        const errorMessage = data.error || `Lead escalation failed with status ${response.status}`;
        setError(errorMessage);
        return null;
      }

      const escalatedLead: LeadListItem = data.data ?? data;

      // Update the lead in the leads list
      setLeads((prev) =>
        prev.map((l) =>
          l.id === leadId
            ? {
                ...l,
                ...escalatedLead,
                status: escalatedLead.status ?? "escalated",
                priority: escalatedLead.priority ?? "high",
                priorityFlag: true,
              }
            : l
        )
      );

      return escalatedLead;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to escalate lead";
      setError(errorMessage);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    lead,
    leads,
    loading,
    error,
    extractLead,
    fetchLead,
    fetchLeads,
    updateLead,
    createInSalesforce,
    escalateLead,
    clearError,
    clearLead,
  };
}

export default useLead;