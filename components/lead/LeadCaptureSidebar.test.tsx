import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import LeadCaptureSidebar from "@/components/lead/LeadCaptureSidebar";

// Mock the useLead hook
const mockExtractLead = vi.fn();
const mockFetchLead = vi.fn();
const mockFetchLeads = vi.fn();
const mockUpdateLead = vi.fn();
const mockCreateInSalesforce = vi.fn();
const mockEscalateLead = vi.fn();
const mockClearError = vi.fn();
const mockClearLead = vi.fn();

vi.mock("@/lib/hooks/useLead", () => {
  return {
    useLead: () => ({
      lead: mockLeadState.lead,
      leads: mockLeadState.leads,
      loading: mockLeadState.loading,
      error: mockLeadState.error,
      extractLead: mockExtractLead,
      fetchLead: mockFetchLead,
      fetchLeads: mockFetchLeads,
      updateLead: mockUpdateLead,
      createInSalesforce: mockCreateInSalesforce,
      escalateLead: mockEscalateLead,
      clearError: mockClearError,
      clearLead: mockClearLead,
    }),
    default: () => ({
      lead: mockLeadState.lead,
      leads: mockLeadState.leads,
      loading: mockLeadState.loading,
      error: mockLeadState.error,
      extractLead: mockExtractLead,
      fetchLead: mockFetchLead,
      fetchLeads: mockFetchLeads,
      updateLead: mockUpdateLead,
      createInSalesforce: mockCreateInSalesforce,
      escalateLead: mockEscalateLead,
      clearError: mockClearError,
      clearLead: mockClearLead,
    }),
  };
});

let mockLeadState: {
  lead: {
    id: string;
    name: string;
    contact: string;
    budget: string | null;
    location: string | null;
    intent: string | null;
    source: string;
    status: string;
    priorityFlag: boolean;
    dmId: string;
    createdAt: string;
  } | null;
  leads: Array<Record<string, unknown>>;
  loading: boolean;
  error: string | null;
};

const defaultLead = {
  id: "lead-test-001",
  name: "Sarah Mitchell",
  contact: "sarah@example.com",
  budget: "$500,000",
  location: "Sydney, NSW",
  intent: "Interested in Willowdale 3BR",
  source: "social_dm",
  status: "EXTRACTED",
  priorityFlag: false,
  dmId: "dm-test-001",
  createdAt: "2024-10-28T09:15:00.000Z",
};

describe("LeadCaptureSidebar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLeadState = {
      lead: { ...defaultLead },
      leads: [],
      loading: false,
      error: null,
    };
  });

  // ============================================================
  // Rendering auto-filled fields
  // ============================================================

  describe("renders auto-filled fields", () => {
    it("should display the lead name", () => {
      render(<LeadCaptureSidebar leadId="lead-test-001" dmId="dm-test-001" />);

      const nameInput = screen.getByDisplayValue("Sarah Mitchell");
      expect(nameInput).toBeInTheDocument();
    });

    it("should display the lead contact", () => {
      render(<LeadCaptureSidebar leadId="lead-test-001" dmId="dm-test-001" />);

      const contactInput = screen.getByDisplayValue("sarah@example.com");
      expect(contactInput).toBeInTheDocument();
    });

    it("should display the lead budget", () => {
      render(<LeadCaptureSidebar leadId="lead-test-001" dmId="dm-test-001" />);

      const budgetInput = screen.getByDisplayValue("$500,000");
      expect(budgetInput).toBeInTheDocument();
    });

    it("should display the lead location", () => {
      render(<LeadCaptureSidebar leadId="lead-test-001" dmId="dm-test-001" />);

      const locationInput = screen.getByDisplayValue("Sydney, NSW");
      expect(locationInput).toBeInTheDocument();
    });

    it("should display the lead intent", () => {
      render(<LeadCaptureSidebar leadId="lead-test-001" dmId="dm-test-001" />);

      const intentInput = screen.getByDisplayValue("Interested in Willowdale 3BR");
      expect(intentInput).toBeInTheDocument();
    });

    it("should display empty fields when lead data is null", () => {
      mockLeadState.lead = {
        ...defaultLead,
        name: "Unknown",
        contact: "",
        budget: null,
        location: null,
        intent: null,
      };

      render(<LeadCaptureSidebar leadId="lead-test-001" dmId="dm-test-001" />);

      const nameInput = screen.getByDisplayValue("Unknown");
      expect(nameInput).toBeInTheDocument();
    });

    it("should show loading state when loading is true", () => {
      mockLeadState.loading = true;

      render(<LeadCaptureSidebar leadId="lead-test-001" dmId="dm-test-001" />);

      const loadingIndicator = screen.getByText(/loading/i);
      expect(loadingIndicator).toBeInTheDocument();
    });
  });

  // ============================================================
  // Fields are editable
  // ============================================================

  describe("fields are editable", () => {
    it("should allow editing the name field", async () => {
      const user = userEvent.setup();
      render(<LeadCaptureSidebar leadId="lead-test-001" dmId="dm-test-001" />);

      const nameInput = screen.getByDisplayValue("Sarah Mitchell");
      await user.clear(nameInput);
      await user.type(nameInput, "Sarah M. Updated");

      expect(nameInput).toHaveValue("Sarah M. Updated");
    });

    it("should allow editing the contact field", async () => {
      const user = userEvent.setup();
      render(<LeadCaptureSidebar leadId="lead-test-001" dmId="dm-test-001" />);

      const contactInput = screen.getByDisplayValue("sarah@example.com");
      await user.clear(contactInput);
      await user.type(contactInput, "sarah.updated@example.com");

      expect(contactInput).toHaveValue("sarah.updated@example.com");
    });

    it("should allow editing the budget field", async () => {
      const user = userEvent.setup();
      render(<LeadCaptureSidebar leadId="lead-test-001" dmId="dm-test-001" />);

      const budgetInput = screen.getByDisplayValue("$500,000");
      await user.clear(budgetInput);
      await user.type(budgetInput, "$750,000");

      expect(budgetInput).toHaveValue("$750,000");
    });

    it("should allow editing the location field", async () => {
      const user = userEvent.setup();
      render(<LeadCaptureSidebar leadId="lead-test-001" dmId="dm-test-001" />);

      const locationInput = screen.getByDisplayValue("Sydney, NSW");
      await user.clear(locationInput);
      await user.type(locationInput, "Melbourne, VIC");

      expect(locationInput).toHaveValue("Melbourne, VIC");
    });

    it("should allow editing the intent field", async () => {
      const user = userEvent.setup();
      render(<LeadCaptureSidebar leadId="lead-test-001" dmId="dm-test-001" />);

      const intentInput = screen.getByDisplayValue("Interested in Willowdale 3BR");
      await user.clear(intentInput);
      await user.type(intentInput, "Looking for 4BR in Aura");

      expect(intentInput).toHaveValue("Looking for 4BR in Aura");
    });

    it("should call updateLead when save button is clicked after editing", async () => {
      const user = userEvent.setup();
      mockUpdateLead.mockResolvedValue({
        id: "lead-test-001",
        name: "Sarah M. Updated",
      });

      render(<LeadCaptureSidebar leadId="lead-test-001" dmId="dm-test-001" />);

      const nameInput = screen.getByDisplayValue("Sarah Mitchell");
      await user.clear(nameInput);
      await user.type(nameInput, "Sarah M. Updated");

      const saveButton = screen.getByRole("button", { name: /save/i });
      await user.click(saveButton);

      await waitFor(() => {
        expect(mockUpdateLead).toHaveBeenCalledWith(
          "lead-test-001",
          expect.objectContaining({
            name: "Sarah M. Updated",
          })
        );
      });
    });
  });

  // ============================================================
  // Salesforce button triggers creation
  // ============================================================

  describe("Salesforce button triggers creation", () => {
    it("should render a Salesforce creation button", () => {
      render(<LeadCaptureSidebar leadId="lead-test-001" dmId="dm-test-001" />);

      const sfButton = screen.getByRole("button", { name: /salesforce/i });
      expect(sfButton).toBeInTheDocument();
    });

    it("should call createInSalesforce when Salesforce button is clicked", async () => {
      const user = userEvent.setup();
      mockCreateInSalesforce.mockResolvedValue({
        leadId: "lead-test-001",
        salesforceStatus: "pending_manual",
      });

      render(<LeadCaptureSidebar leadId="lead-test-001" dmId="dm-test-001" />);

      const sfButton = screen.getByRole("button", { name: /salesforce/i });
      await user.click(sfButton);

      await waitFor(() => {
        expect(mockCreateInSalesforce).toHaveBeenCalledWith(
          "lead-test-001",
          undefined
        );
      });
    });

    it("should show success notification after Salesforce creation", async () => {
      const user = userEvent.setup();
      mockCreateInSalesforce.mockResolvedValue({
        leadId: "lead-test-001",
        salesforceStatus: "pending_manual",
      });

      render(<LeadCaptureSidebar leadId="lead-test-001" dmId="dm-test-001" />);

      const sfButton = screen.getByRole("button", { name: /salesforce/i });
      await user.click(sfButton);

      await waitFor(() => {
        const successMessage = screen.getByText(/salesforce/i);
        expect(successMessage).toBeInTheDocument();
      });
    });

    it("should disable Salesforce button while loading", async () => {
      const user = userEvent.setup();
      let resolvePromise: (value: unknown) => void;
      const pendingPromise = new Promise((resolve) => {
        resolvePromise = resolve;
      });
      mockCreateInSalesforce.mockReturnValue(pendingPromise);

      render(<LeadCaptureSidebar leadId="lead-test-001" dmId="dm-test-001" />);

      const sfButton = screen.getByRole("button", { name: /salesforce/i });
      await user.click(sfButton);

      await waitFor(() => {
        expect(sfButton).toBeDisabled();
      });

      resolvePromise!({
        leadId: "lead-test-001",
        salesforceStatus: "pending_manual",
      });
    });
  });

  // ============================================================
  // Flag toggle works
  // ============================================================

  describe("flag toggle works", () => {
    it("should render a priority flag toggle", () => {
      render(<LeadCaptureSidebar leadId="lead-test-001" dmId="dm-test-001" />);

      const flagToggle = screen.getByRole("checkbox", { name: /priority/i });
      expect(flagToggle).toBeInTheDocument();
    });

    it("should reflect the current priority flag state", () => {
      mockLeadState.lead = { ...defaultLead, priorityFlag: true };

      render(<LeadCaptureSidebar leadId="lead-test-001" dmId="dm-test-001" />);

      const flagToggle = screen.getByRole("checkbox", { name: /priority/i });
      expect(flagToggle).toBeChecked();
    });

    it("should reflect unchecked state when priorityFlag is false", () => {
      mockLeadState.lead = { ...defaultLead, priorityFlag: false };

      render(<LeadCaptureSidebar leadId="lead-test-001" dmId="dm-test-001" />);

      const flagToggle = screen.getByRole("checkbox", { name: /priority/i });
      expect(flagToggle).not.toBeChecked();
    });

    it("should call escalateLead when flag is toggled on", async () => {
      const user = userEvent.setup();
      mockLeadState.lead = { ...defaultLead, priorityFlag: false };
      mockEscalateLead.mockResolvedValue({
        id: "lead-test-001",
        status: "escalated",
        priorityFlag: true,
      });

      render(<LeadCaptureSidebar leadId="lead-test-001" dmId="dm-test-001" />);

      const flagToggle = screen.getByRole("checkbox", { name: /priority/i });
      await user.click(flagToggle);

      await waitFor(() => {
        expect(mockEscalateLead).toHaveBeenCalledWith(
          "lead-test-001",
          expect.any(String)
        );
      });
    });

    it("should call updateLead to unflag when toggle is turned off", async () => {
      const user = userEvent.setup();
      mockLeadState.lead = { ...defaultLead, priorityFlag: true };
      mockUpdateLead.mockResolvedValue({
        id: "lead-test-001",
        priorityFlag: false,
        priority: "medium",
      });

      render(<LeadCaptureSidebar leadId="lead-test-001" dmId="dm-test-001" />);

      const flagToggle = screen.getByRole("checkbox", { name: /priority/i });
      await user.click(flagToggle);

      await waitFor(() => {
        expect(mockUpdateLead).toHaveBeenCalledWith(
          "lead-test-001",
          expect.objectContaining({
            priority: "medium",
          })
        );
      });
    });
  });

  // ============================================================
  // Success notification shown
  // ============================================================

  describe("success notification shown", () => {
    it("should show success message after saving lead fields", async () => {
      const user = userEvent.setup();
      mockUpdateLead.mockResolvedValue({
        id: "lead-test-001",
        name: "Updated Name",
      });

      render(<LeadCaptureSidebar leadId="lead-test-001" dmId="dm-test-001" />);

      const nameInput = screen.getByDisplayValue("Sarah Mitchell");
      await user.clear(nameInput);
      await user.type(nameInput, "Updated Name");

      const saveButton = screen.getByRole("button", { name: /save/i });
      await user.click(saveButton);

      await waitFor(() => {
        const successMessage = screen.getByText(/saved/i);
        expect(successMessage).toBeInTheDocument();
      });
    });

    it("should show success message after Salesforce creation", async () => {
      const user = userEvent.setup();
      mockCreateInSalesforce.mockResolvedValue({
        leadId: "lead-test-001",
        salesforceStatus: "pending_manual",
      });

      render(<LeadCaptureSidebar leadId="lead-test-001" dmId="dm-test-001" />);

      const sfButton = screen.getByRole("button", { name: /salesforce/i });
      await user.click(sfButton);

      await waitFor(() => {
        const successMessage = screen.getByText(/success|created|salesforce/i);
        expect(successMessage).toBeInTheDocument();
      });
    });

    it("should show success message after escalation", async () => {
      const user = userEvent.setup();
      mockLeadState.lead = { ...defaultLead, priorityFlag: false };
      mockEscalateLead.mockResolvedValue({
        id: "lead-test-001",
        status: "escalated",
        priorityFlag: true,
      });

      render(<LeadCaptureSidebar leadId="lead-test-001" dmId="dm-test-001" />);

      const flagToggle = screen.getByRole("checkbox", { name: /priority/i });
      await user.click(flagToggle);

      await waitFor(() => {
        const successMessage = screen.getByText(/escalat/i);
        expect(successMessage).toBeInTheDocument();
      });
    });
  });

  // ============================================================
  // Error handling for failed creation
  // ============================================================

  describe("error handling for failed creation", () => {
    it("should display error message when Salesforce creation fails", async () => {
      const user = userEvent.setup();
      mockCreateInSalesforce.mockResolvedValue(null);
      mockLeadState.error = "Salesforce integration error";

      render(<LeadCaptureSidebar leadId="lead-test-001" dmId="dm-test-001" />);

      const sfButton = screen.getByRole("button", { name: /salesforce/i });
      await user.click(sfButton);

      await waitFor(() => {
        const errorMessage = screen.getByText(/error|failed/i);
        expect(errorMessage).toBeInTheDocument();
      });
    });

    it("should display error message when updateLead fails", async () => {
      const user = userEvent.setup();
      mockUpdateLead.mockResolvedValue(null);
      mockLeadState.error = "Failed to update lead";

      render(<LeadCaptureSidebar leadId="lead-test-001" dmId="dm-test-001" />);

      const saveButton = screen.getByRole("button", { name: /save/i });
      await user.click(saveButton);

      await waitFor(() => {
        const errorMessage = screen.getByText(/error|failed/i);
        expect(errorMessage).toBeInTheDocument();
      });
    });

    it("should display error message when escalation fails", async () => {
      const user = userEvent.setup();
      mockLeadState.lead = { ...defaultLead, priorityFlag: false };
      mockEscalateLead.mockResolvedValue(null);
      mockLeadState.error = "Failed to escalate lead";

      render(<LeadCaptureSidebar leadId="lead-test-001" dmId="dm-test-001" />);

      const flagToggle = screen.getByRole("checkbox", { name: /priority/i });
      await user.click(flagToggle);

      await waitFor(() => {
        const errorMessage = screen.getByText(/error|failed/i);
        expect(errorMessage).toBeInTheDocument();
      });
    });

    it("should allow clearing the error state", async () => {
      const user = userEvent.setup();
      mockLeadState.error = "Some error occurred";

      render(<LeadCaptureSidebar leadId="lead-test-001" dmId="dm-test-001" />);

      const errorMessage = screen.getByText(/error|failed|some error/i);
      expect(errorMessage).toBeInTheDocument();

      const dismissButton = screen.queryByRole("button", { name: /dismiss|close|clear/i });
      if (dismissButton) {
        await user.click(dismissButton);

        await waitFor(() => {
          expect(mockClearError).toHaveBeenCalled();
        });
      }
    });

    it("should show error when lead is not found", () => {
      mockLeadState.lead = null;
      mockLeadState.error = null;

      render(<LeadCaptureSidebar leadId="lead-nonexistent" dmId="dm-test-001" />);

      const noLeadMessage = screen.getByText(/no lead|not found|extract/i);
      expect(noLeadMessage).toBeInTheDocument();
    });

    it("should call extractLead when no lead exists and extract button is clicked", async () => {
      const user = userEvent.setup();
      mockLeadState.lead = null;
      mockExtractLead.mockResolvedValue({
        name: "Extracted Name",
        contact: "extracted@example.com",
        budget: "$400,000",
        location: "Brisbane",
        intent: "Interested in Aura",
        confidence: 0.75,
      });

      render(<LeadCaptureSidebar leadId="" dmId="dm-test-001" />);

      const extractButton = screen.getByRole("button", { name: /extract/i });
      await user.click(extractButton);

      await waitFor(() => {
        expect(mockExtractLead).toHaveBeenCalledWith("dm-test-001");
      });
    });
  });

  // ============================================================
  // Component structure
  // ============================================================

  describe("component structure", () => {
    it("should render the sidebar heading", () => {
      render(<LeadCaptureSidebar leadId="lead-test-001" dmId="dm-test-001" />);

      const heading = screen.getByText(/lead/i);
      expect(heading).toBeInTheDocument();
    });

    it("should render the lead status", () => {
      render(<LeadCaptureSidebar leadId="lead-test-001" dmId="dm-test-001" />);

      const status = screen.getByText(/extracted|new/i);
      expect(status).toBeInTheDocument();
    });

    it("should render the lead source", () => {
      render(<LeadCaptureSidebar leadId="lead-test-001" dmId="dm-test-001" />);

      const source = screen.getByText(/social/i);
      expect(source).toBeInTheDocument();
    });
  });
});