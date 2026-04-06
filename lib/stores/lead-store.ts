import { v4 as uuidv4 } from "uuid";
import sampleLeads from "@/data/sample-leads.json";

export interface Lead {
  id: string;
  name: string;
  email: string;
  company: string;
  platform: string;
  handle: string;
  budget: number;
  budgetCurrency: string;
  location: string;
  intent: string;
  priority: string;
  confidenceScore: number;
  status: string;
  tags: string[];
  firstContactAt: string;
  lastMessageAt: string;
  messageCount: number;
  slaBreached: boolean;
  notes: string;
  dmId?: string;
  priorityFlag?: boolean;
  escalatedAt?: string;
  escalationReason?: string;
  salesforceStatus?: string;
  confirmedBy?: string;
}

class LeadStore {
  private leads: Lead[];

  constructor() {
    this.leads = (sampleLeads as Lead[]).map((lead) => ({
      ...lead,
      priorityFlag: lead.priority === "high",
    }));
  }

  getAll(): Lead[] {
    return [...this.leads];
  }

  getById(id: string): Lead | undefined {
    return this.leads.find((lead) => lead.id === id);
  }

  add(lead: Omit<Lead, "id"> & { id?: string }): Lead {
    const newLead: Lead = {
      ...lead,
      id: lead.id || `lead-${uuidv4()}`,
      priorityFlag: lead.priorityFlag ?? lead.priority === "high",
    };
    this.leads.push(newLead);
    return newLead;
  }

  update(id: string, updates: Partial<Omit<Lead, "id">>): Lead | undefined {
    const index = this.leads.findIndex((lead) => lead.id === id);
    if (index === -1) {
      return undefined;
    }
    this.leads[index] = {
      ...this.leads[index],
      ...updates,
    };
    return this.leads[index];
  }

  getByStatus(status: string): Lead[] {
    return this.leads.filter((lead) => lead.status === status);
  }

  getByDmId(dmId: string): Lead | undefined {
    return this.leads.find((lead) => lead.dmId === dmId);
  }

  flagForEscalation(id: string): Lead | undefined {
    const index = this.leads.findIndex((lead) => lead.id === id);
    if (index === -1) {
      return undefined;
    }
    this.leads[index] = {
      ...this.leads[index],
      priorityFlag: true,
      priority: "high",
      status: "escalated",
      escalatedAt: new Date().toISOString(),
    };
    return this.leads[index];
  }
}

export const leadStore = new LeadStore();

export default LeadStore;