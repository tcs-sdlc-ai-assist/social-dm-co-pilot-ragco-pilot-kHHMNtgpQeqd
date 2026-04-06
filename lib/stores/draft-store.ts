import { DraftResponse } from "@/lib/types";

class DraftStore {
  private drafts: Map<string, DraftResponse> = new Map();

  getAll(): DraftResponse[] {
    return Array.from(this.drafts.values());
  }

  getById(id: string): DraftResponse | undefined {
    return this.drafts.get(id);
  }

  getByDmId(dmId: string): DraftResponse | undefined {
    for (const draft of this.drafts.values()) {
      if (draft.dmId === dmId) {
        return draft;
      }
    }
    return undefined;
  }

  add(draft: DraftResponse): DraftResponse {
    this.drafts.set(draft.id, { ...draft });
    return this.drafts.get(draft.id)!;
  }

  update(id: string, updates: Partial<Omit<DraftResponse, "id">>): DraftResponse | undefined {
    const existing = this.drafts.get(id);
    if (!existing) {
      return undefined;
    }
    const updated: DraftResponse = { ...existing, ...updates, id: existing.id };
    this.drafts.set(id, updated);
    return updated;
  }

  approve(id: string, reviewerId: string): DraftResponse | undefined {
    const existing = this.drafts.get(id);
    if (!existing) {
      return undefined;
    }
    const approved: DraftResponse = {
      ...existing,
      approved: true,
      reviewedBy: reviewerId,
    };
    this.drafts.set(id, approved);
    return approved;
  }
}

export const draftStore = new DraftStore();
export { DraftStore };