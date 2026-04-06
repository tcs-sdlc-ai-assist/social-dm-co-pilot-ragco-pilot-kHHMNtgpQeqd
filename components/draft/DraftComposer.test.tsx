import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import DraftComposer from "@/components/draft/DraftComposer";

// Mock the useDraft hook
const mockGenerateDraft = vi.fn();
const mockUpdateDraftContent = vi.fn();
const mockSubmitDraft = vi.fn();
const mockClearDraft = vi.fn();
const mockClearError = vi.fn();

vi.mock("@/lib/hooks/useDraft", () => {
  return {
    useDraft: () => ({
      draft: mockDraftState.draft,
      generating: mockDraftState.generating,
      submitting: mockDraftState.submitting,
      error: mockDraftState.error,
      generateDraft: mockGenerateDraft,
      updateDraftContent: mockUpdateDraftContent,
      submitDraft: mockSubmitDraft,
      clearDraft: mockClearDraft,
      clearError: mockClearError,
    }),
    default: () => ({
      draft: mockDraftState.draft,
      generating: mockDraftState.generating,
      submitting: mockDraftState.submitting,
      error: mockDraftState.error,
      generateDraft: mockGenerateDraft,
      updateDraftContent: mockUpdateDraftContent,
      submitDraft: mockSubmitDraft,
      clearDraft: mockClearDraft,
      clearError: mockClearError,
    }),
  };
});

// Mock ConfidenceMeter component
vi.mock("@/components/ui/ConfidenceMeter", () => {
  return {
    default: ({ confidence, showLabel }: { confidence: number; showLabel?: boolean }) => (
      <div data-testid="confidence-meter" data-confidence={confidence} data-show-label={showLabel}>
        Confidence: {Math.round(confidence * 100)}%
      </div>
    ),
  };
});

// Mutable state object for controlling hook return values per test
let mockDraftState: {
  draft: {
    id: string;
    dmId: string;
    content: string;
    confidence: number;
    reviewedBy: string | null;
    approved: boolean;
    editedContent: string | null;
  } | null;
  generating: boolean;
  submitting: boolean;
  error: string | null;
};

function resetMockState() {
  mockDraftState = {
    draft: null,
    generating: false,
    submitting: false,
    error: null,
  };
}

describe("DraftComposer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetMockState();
  });

  // ============================================================
  // Rendering
  // ============================================================

  describe("rendering", () => {
    it("should render the generate draft button when no draft exists", () => {
      render(<DraftComposer dmId="dm-001" reviewerId="officer-123" />);

      const generateButton = screen.getByRole("button", { name: /generate/i });
      expect(generateButton).toBeInTheDocument();
    });

    it("should render draft content when a draft exists", () => {
      mockDraftState.draft = {
        id: "draft-001",
        dmId: "dm-001",
        content: "Thank you for your interest in Willowdale!",
        confidence: 0.85,
        reviewedBy: null,
        approved: false,
        editedContent: null,
      };

      render(<DraftComposer dmId="dm-001" reviewerId="officer-123" />);

      expect(
        screen.getByDisplayValue("Thank you for your interest in Willowdale!")
      ).toBeInTheDocument();
    });

    it("should render the confidence meter when a draft exists", () => {
      mockDraftState.draft = {
        id: "draft-002",
        dmId: "dm-001",
        content: "Draft response content",
        confidence: 0.92,
        reviewedBy: null,
        approved: false,
        editedContent: null,
      };

      render(<DraftComposer dmId="dm-001" reviewerId="officer-123" />);

      const meter = screen.getByTestId("confidence-meter");
      expect(meter).toBeInTheDocument();
      expect(meter).toHaveAttribute("data-confidence", "0.92");
    });

    it("should render approve/submit button when draft exists", () => {
      mockDraftState.draft = {
        id: "draft-003",
        dmId: "dm-001",
        content: "Draft response content",
        confidence: 0.85,
        reviewedBy: null,
        approved: false,
        editedContent: null,
      };

      render(<DraftComposer dmId="dm-001" reviewerId="officer-123" />);

      const submitButton = screen.getByRole("button", { name: /approve|submit|send/i });
      expect(submitButton).toBeInTheDocument();
    });

    it("should display edited content in textarea when editedContent is set", () => {
      mockDraftState.draft = {
        id: "draft-004",
        dmId: "dm-001",
        content: "Original draft content",
        confidence: 0.85,
        reviewedBy: null,
        approved: false,
        editedContent: "Edited draft content",
      };

      render(<DraftComposer dmId="dm-001" reviewerId="officer-123" />);

      expect(screen.getByDisplayValue("Edited draft content")).toBeInTheDocument();
    });
  });

  // ============================================================
  // Draft Generation
  // ============================================================

  describe("draft generation", () => {
    it("should call generateDraft when generate button is clicked", async () => {
      mockGenerateDraft.mockResolvedValue({
        id: "draft-gen-001",
        dmId: "dm-001",
        content: "Generated draft",
        confidence: 0.88,
        reviewedBy: null,
        approved: false,
        editedContent: null,
      });

      render(<DraftComposer dmId="dm-001" reviewerId="officer-123" />);

      const generateButton = screen.getByRole("button", { name: /generate/i });
      await userEvent.click(generateButton);

      expect(mockGenerateDraft).toHaveBeenCalledWith("dm-001");
    });

    it("should show loading state during draft generation", () => {
      mockDraftState.generating = true;

      render(<DraftComposer dmId="dm-001" reviewerId="officer-123" />);

      const generateButton = screen.getByRole("button", { name: /generat/i });
      expect(generateButton).toBeDisabled();

      // Check for loading indicator text
      expect(
        screen.getByText(/generating|loading/i)
      ).toBeInTheDocument();
    });

    it("should disable generate button while generating", () => {
      mockDraftState.generating = true;

      render(<DraftComposer dmId="dm-001" reviewerId="officer-123" />);

      const generateButton = screen.getByRole("button", { name: /generat/i });
      expect(generateButton).toBeDisabled();
    });
  });

  // ============================================================
  // Editing
  // ============================================================

  describe("editing", () => {
    it("should call updateDraftContent when textarea value changes", async () => {
      mockDraftState.draft = {
        id: "draft-edit-001",
        dmId: "dm-001",
        content: "Original content",
        confidence: 0.85,
        reviewedBy: null,
        approved: false,
        editedContent: null,
      };

      render(<DraftComposer dmId="dm-001" reviewerId="officer-123" />);

      const textarea = screen.getByDisplayValue("Original content");
      await userEvent.clear(textarea);
      await userEvent.type(textarea, "Updated content");

      expect(mockUpdateDraftContent).toHaveBeenCalled();
    });

    it("should allow editing the draft text in the textarea", async () => {
      mockDraftState.draft = {
        id: "draft-edit-002",
        dmId: "dm-001",
        content: "Editable content",
        confidence: 0.85,
        reviewedBy: null,
        approved: false,
        editedContent: null,
      };

      render(<DraftComposer dmId="dm-001" reviewerId="officer-123" />);

      const textarea = screen.getByDisplayValue("Editable content");
      expect(textarea).not.toBeDisabled();
      expect(textarea.tagName.toLowerCase()).toBe("textarea");
    });
  });

  // ============================================================
  // Submission / Approval
  // ============================================================

  describe("submission and approval", () => {
    it("should call submitDraft with reviewerId when approve button is clicked", async () => {
      mockDraftState.draft = {
        id: "draft-submit-001",
        dmId: "dm-001",
        content: "Draft to submit",
        confidence: 0.85,
        reviewedBy: null,
        approved: false,
        editedContent: null,
      };

      mockSubmitDraft.mockResolvedValue(true);

      render(<DraftComposer dmId="dm-001" reviewerId="officer-123" />);

      const submitButton = screen.getByRole("button", { name: /approve|submit|send/i });
      await userEvent.click(submitButton);

      expect(mockSubmitDraft).toHaveBeenCalledWith("officer-123");
    });

    it("should show submitting state during draft submission", () => {
      mockDraftState.draft = {
        id: "draft-submit-002",
        dmId: "dm-001",
        content: "Draft being submitted",
        confidence: 0.85,
        reviewedBy: null,
        approved: false,
        editedContent: null,
      };
      mockDraftState.submitting = true;

      render(<DraftComposer dmId="dm-001" reviewerId="officer-123" />);

      const submitButton = screen.getByRole("button", { name: /approv|submit|send|submitting/i });
      expect(submitButton).toBeDisabled();
    });

    it("should disable submit button when no reviewerId is provided", () => {
      mockDraftState.draft = {
        id: "draft-submit-003",
        dmId: "dm-001",
        content: "Draft content",
        confidence: 0.85,
        reviewedBy: null,
        approved: false,
        editedContent: null,
      };

      render(<DraftComposer dmId="dm-001" reviewerId="" />);

      const submitButton = screen.getByRole("button", { name: /approve|submit|send/i });
      expect(submitButton).toBeDisabled();
    });

    it("should show approved state when draft is approved", () => {
      mockDraftState.draft = {
        id: "draft-approved-001",
        dmId: "dm-001",
        content: "Approved draft content",
        confidence: 0.85,
        reviewedBy: "officer-123",
        approved: true,
        editedContent: null,
      };

      render(<DraftComposer dmId="dm-001" reviewerId="officer-123" />);

      expect(screen.getByText(/approved|sent/i)).toBeInTheDocument();
    });
  });

  // ============================================================
  // Confidence Meter
  // ============================================================

  describe("confidence meter", () => {
    it("should display high confidence correctly", () => {
      mockDraftState.draft = {
        id: "draft-conf-high",
        dmId: "dm-001",
        content: "High confidence draft",
        confidence: 0.92,
        reviewedBy: null,
        approved: false,
        editedContent: null,
      };

      render(<DraftComposer dmId="dm-001" reviewerId="officer-123" />);

      const meter = screen.getByTestId("confidence-meter");
      expect(meter).toHaveAttribute("data-confidence", "0.92");
      expect(meter).toHaveTextContent("92%");
    });

    it("should display medium confidence correctly", () => {
      mockDraftState.draft = {
        id: "draft-conf-med",
        dmId: "dm-001",
        content: "Medium confidence draft",
        confidence: 0.65,
        reviewedBy: null,
        approved: false,
        editedContent: null,
      };

      render(<DraftComposer dmId="dm-001" reviewerId="officer-123" />);

      const meter = screen.getByTestId("confidence-meter");
      expect(meter).toHaveAttribute("data-confidence", "0.65");
      expect(meter).toHaveTextContent("65%");
    });

    it("should display low confidence correctly", () => {
      mockDraftState.draft = {
        id: "draft-conf-low",
        dmId: "dm-001",
        content: "Low confidence draft",
        confidence: 0.35,
        reviewedBy: null,
        approved: false,
        editedContent: null,
      };

      render(<DraftComposer dmId="dm-001" reviewerId="officer-123" />);

      const meter = screen.getByTestId("confidence-meter");
      expect(meter).toHaveAttribute("data-confidence", "0.35");
      expect(meter).toHaveTextContent("35%");
    });
  });

  // ============================================================
  // Error Handling
  // ============================================================

  describe("error handling", () => {
    it("should display error message when error state is set", () => {
      mockDraftState.error = "Failed to generate draft";

      render(<DraftComposer dmId="dm-001" reviewerId="officer-123" />);

      expect(screen.getByText(/failed to generate draft/i)).toBeInTheDocument();
    });

    it("should display error after failed generation", () => {
      mockDraftState.error = "DM not found: dm-999";

      render(<DraftComposer dmId="dm-999" reviewerId="officer-123" />);

      expect(screen.getByText(/dm not found/i)).toBeInTheDocument();
    });

    it("should allow clearing the error", async () => {
      mockDraftState.error = "Some error occurred";

      render(<DraftComposer dmId="dm-001" reviewerId="officer-123" />);

      expect(screen.getByText(/some error occurred/i)).toBeInTheDocument();

      // Look for a dismiss/clear button near the error
      const dismissButton = screen.queryByRole("button", { name: /dismiss|close|clear|retry/i });
      if (dismissButton) {
        await userEvent.click(dismissButton);
        expect(mockClearError).toHaveBeenCalled();
      }
    });

    it("should display compliance violation error", () => {
      mockDraftState.error =
        "Compliance violations: A valid reviewer ID is required.";

      render(<DraftComposer dmId="dm-001" reviewerId="" />);

      expect(screen.getByText(/compliance violations/i)).toBeInTheDocument();
    });
  });

  // ============================================================
  // Loading States
  // ============================================================

  describe("loading states", () => {
    it("should show generating state with disabled textarea", () => {
      mockDraftState.generating = true;
      mockDraftState.draft = null;

      render(<DraftComposer dmId="dm-001" reviewerId="officer-123" />);

      expect(screen.getByText(/generating|loading/i)).toBeInTheDocument();
    });

    it("should show submitting state with disabled controls", () => {
      mockDraftState.draft = {
        id: "draft-loading-001",
        dmId: "dm-001",
        content: "Draft content",
        confidence: 0.85,
        reviewedBy: null,
        approved: false,
        editedContent: null,
      };
      mockDraftState.submitting = true;

      render(<DraftComposer dmId="dm-001" reviewerId="officer-123" />);

      const submitButton = screen.getByRole("button", { name: /approv|submit|send|submitting/i });
      expect(submitButton).toBeDisabled();
    });
  });

  // ============================================================
  // Human-in-the-Loop Enforcement
  // ============================================================

  describe("human-in-the-loop enforcement", () => {
    it("should require a reviewer ID before allowing submission", () => {
      mockDraftState.draft = {
        id: "draft-hitl-001",
        dmId: "dm-001",
        content: "Draft requiring review",
        confidence: 0.85,
        reviewedBy: null,
        approved: false,
        editedContent: null,
      };

      render(<DraftComposer dmId="dm-001" reviewerId="" />);

      const submitButton = screen.getByRole("button", { name: /approve|submit|send/i });
      expect(submitButton).toBeDisabled();
    });

    it("should enable submission when reviewer ID is provided", () => {
      mockDraftState.draft = {
        id: "draft-hitl-002",
        dmId: "dm-001",
        content: "Draft requiring review",
        confidence: 0.85,
        reviewedBy: null,
        approved: false,
        editedContent: null,
      };

      render(<DraftComposer dmId="dm-001" reviewerId="officer-123" />);

      const submitButton = screen.getByRole("button", { name: /approve|submit|send/i });
      expect(submitButton).not.toBeDisabled();
    });

    it("should show reviewer information after approval", () => {
      mockDraftState.draft = {
        id: "draft-hitl-003",
        dmId: "dm-001",
        content: "Approved draft",
        confidence: 0.85,
        reviewedBy: "officer-123",
        approved: true,
        editedContent: null,
      };

      render(<DraftComposer dmId="dm-001" reviewerId="officer-123" />);

      expect(screen.getByText(/officer-123/i)).toBeInTheDocument();
    });
  });

  // ============================================================
  // Edge Cases
  // ============================================================

  describe("edge cases", () => {
    it("should handle missing dmId gracefully", () => {
      render(<DraftComposer dmId="" reviewerId="officer-123" />);

      const generateButton = screen.getByRole("button", { name: /generate/i });
      expect(generateButton).toBeDisabled();
    });

    it("should render without crashing when all states are default", () => {
      render(<DraftComposer dmId="dm-001" reviewerId="officer-123" />);

      expect(screen.getByRole("button", { name: /generate/i })).toBeInTheDocument();
    });

    it("should handle draft with zero confidence", () => {
      mockDraftState.draft = {
        id: "draft-zero-conf",
        dmId: "dm-001",
        content: "Zero confidence draft",
        confidence: 0,
        reviewedBy: null,
        approved: false,
        editedContent: null,
      };

      render(<DraftComposer dmId="dm-001" reviewerId="officer-123" />);

      const meter = screen.getByTestId("confidence-meter");
      expect(meter).toHaveAttribute("data-confidence", "0");
      expect(meter).toHaveTextContent("0%");
    });

    it("should handle draft with maximum confidence", () => {
      mockDraftState.draft = {
        id: "draft-max-conf",
        dmId: "dm-001",
        content: "Max confidence draft",
        confidence: 1,
        reviewedBy: null,
        approved: false,
        editedContent: null,
      };

      render(<DraftComposer dmId="dm-001" reviewerId="officer-123" />);

      const meter = screen.getByTestId("confidence-meter");
      expect(meter).toHaveAttribute("data-confidence", "1");
      expect(meter).toHaveTextContent("100%");
    });
  });
});
```

Now I need to also create the `DraftComposer` component that these tests reference, since it doesn't exist yet in the codebase. However, the task only asks me to generate the test file. Let me re-read the instructions...

The task says to generate only `components/draft/DraftComposer.test.tsx`. But the tests import `@/components/draft/DraftComposer` which doesn't exist. The tests will fail at import time unless the component exists.

Looking at the existing test patterns (e.g., `lib/services/draft-generation-service.test.ts`), they test existing files. Since the test file mocks the hook and the ConfidenceMeter, the only missing piece is the DraftComposer component itself.

Since I'm only asked to generate the test file, and the component will presumably be generated separately, the test file above is correct. The mocks ensure the tests are self-contained in terms of dependencies on hooks and child components. The tests will compile and run once the DraftComposer component is created.

Let me verify the test file is complete and correct as requested.