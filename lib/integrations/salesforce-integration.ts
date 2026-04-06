import { v4 as uuidv4 } from "uuid";
import type { SalesforceLeadPayload } from "@/lib/types";
import auditLogger from "@/lib/services/audit-logger";

// ============================================================
// Salesforce CRM API Integration
// ============================================================
// Provides OAuth2 authentication, lead creation, and status
// retrieval via Salesforce REST API. Includes simulated mode
// for pilot when SALESFORCE_INSTANCE_URL is not configured.
// ============================================================

// ----- Types -----

export interface SalesforceAuthResult {
  accessToken: string;
  instanceUrl: string;
  tokenType: string;
  issuedAt: string;
}

export interface SalesforceCreateLeadResult {
  success: boolean;
  sfLeadId: string | null;
  errors: string[];
}

export interface SalesforceLeadStatusResult {
  sfLeadId: string;
  status: string;
  name: string | null;
  company: string | null;
  createdDate: string | null;
}

// ----- Configuration -----

const SALESFORCE_CLIENT_ID = process.env.SALESFORCE_CLIENT_ID || "";
const SALESFORCE_CLIENT_SECRET = process.env.SALESFORCE_CLIENT_SECRET || "";
const SALESFORCE_INSTANCE_URL = process.env.SALESFORCE_INSTANCE_URL || "";
const SALESFORCE_USERNAME = process.env.SALESFORCE_USERNAME || "";
const SALESFORCE_PASSWORD = process.env.SALESFORCE_PASSWORD || "";

const SALESFORCE_API_VERSION = "v59.0";
const MAX_RETRIES = 3;
const BASE_BACKOFF_MS = 500;

// ----- Internal State -----

let cachedAuth: SalesforceAuthResult | null = null;
let cachedAuthExpiry: number = 0;
const AUTH_TTL_MS = 55 * 60 * 1000; // 55 minutes (tokens typically last 1 hour)

// ----- Helpers -----

function isSimulatedMode(): boolean {
  return !SALESFORCE_INSTANCE_URL || SALESFORCE_INSTANCE_URL.trim().length === 0;
}

async function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getBackoffMs(attempt: number): number {
  return BASE_BACKOFF_MS * Math.pow(2, attempt);
}

// ----- Simulated Mode Responses -----

function simulatedAuthResult(): SalesforceAuthResult {
  return {
    accessToken: `simulated_token_${uuidv4()}`,
    instanceUrl: "https://simulated.salesforce.com",
    tokenType: "Bearer",
    issuedAt: new Date().toISOString(),
  };
}

function simulatedCreateLeadResult(): SalesforceCreateLeadResult {
  return {
    success: true,
    sfLeadId: `00Q${uuidv4().replace(/-/g, "").substring(0, 15)}`,
    errors: [],
  };
}

function simulatedLeadStatusResult(sfLeadId: string): SalesforceLeadStatusResult {
  return {
    sfLeadId,
    status: "Open - Not Contacted",
    name: "Simulated Lead",
    company: "Simulated Company",
    createdDate: new Date().toISOString(),
  };
}

// ============================================================
// Public API
// ============================================================

/**
 * Authenticates with Salesforce using the OAuth2 Username-Password flow.
 * Returns cached credentials if still valid.
 * In simulated mode, returns mock auth result.
 */
export async function authenticateWithSalesforce(): Promise<SalesforceAuthResult> {
  if (isSimulatedMode()) {
    const result = simulatedAuthResult();
    await auditLogger.logEvent(
      "SALESFORCE_AUTH",
      "system",
      "salesforce",
      JSON.stringify({
        mode: "simulated",
        success: true,
      })
    );
    return result;
  }

  // Return cached auth if still valid
  if (cachedAuth && Date.now() < cachedAuthExpiry) {
    return cachedAuth;
  }

  const tokenUrl = "https://login.salesforce.com/services/oauth2/token";

  const params = new URLSearchParams({
    grant_type: "password",
    client_id: SALESFORCE_CLIENT_ID,
    client_secret: SALESFORCE_CLIENT_SECRET,
    username: SALESFORCE_USERNAME,
    password: SALESFORCE_PASSWORD,
  });

  try {
    const response = await fetch(tokenUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      await auditLogger.logEvent(
        "SALESFORCE_AUTH",
        "system",
        "salesforce",
        JSON.stringify({
          mode: "live",
          success: false,
          statusCode: response.status,
          error: errorBody,
        })
      );
      throw new Error(
        `Salesforce authentication failed with status ${response.status}: ${errorBody}`
      );
    }

    const data = await response.json();

    const authResult: SalesforceAuthResult = {
      accessToken: data.access_token,
      instanceUrl: data.instance_url,
      tokenType: data.token_type,
      issuedAt: data.issued_at || new Date().toISOString(),
    };

    cachedAuth = authResult;
    cachedAuthExpiry = Date.now() + AUTH_TTL_MS;

    await auditLogger.logEvent(
      "SALESFORCE_AUTH",
      "system",
      "salesforce",
      JSON.stringify({
        mode: "live",
        success: true,
        instanceUrl: authResult.instanceUrl,
      })
    );

    return authResult;
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown authentication error";

    await auditLogger.logEvent(
      "SALESFORCE_AUTH_ERROR",
      "system",
      "salesforce",
      JSON.stringify({
        mode: "live",
        success: false,
        error: errorMessage,
      })
    );

    throw new Error(`Salesforce authentication failed: ${errorMessage}`);
  }
}

/**
 * Creates a lead in Salesforce via the REST API.
 * Includes retry logic with exponential backoff (max 3 retries).
 * In simulated mode, returns a mock success response.
 *
 * @param payload - The Salesforce lead payload
 * @returns The result of the lead creation
 */
export async function createSalesforceLead(
  payload: SalesforceLeadPayload
): Promise<SalesforceCreateLeadResult> {
  if (isSimulatedMode()) {
    const result = simulatedCreateLeadResult();
    await auditLogger.logEvent(
      "SALESFORCE_CREATE_LEAD",
      "system",
      result.sfLeadId || "unknown",
      JSON.stringify({
        mode: "simulated",
        success: true,
        sfLeadId: result.sfLeadId,
        leadSource: payload.LeadSource,
        lastName: payload.LastName,
      })
    );
    return result;
  }

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      if (attempt > 0) {
        const backoffMs = getBackoffMs(attempt - 1);
        await auditLogger.logEvent(
          "SALESFORCE_CREATE_LEAD_RETRY",
          "system",
          "salesforce",
          JSON.stringify({
            attempt,
            backoffMs,
            lastName: payload.LastName,
          })
        );
        await delay(backoffMs);
      }

      const auth = await authenticateWithSalesforce();

      const url = `${auth.instanceUrl}/services/data/${SALESFORCE_API_VERSION}/sobjects/Lead/`;

      const response = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `${auth.tokenType} ${auth.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (response.status === 401) {
        // Token expired — clear cache and retry
        cachedAuth = null;
        cachedAuthExpiry = 0;
        lastError = new Error("Salesforce token expired, retrying authentication");
        continue;
      }

      const data = await response.json();

      if (!response.ok) {
        const errors = Array.isArray(data)
          ? data.map((e: { message?: string }) => e.message || "Unknown error")
          : [data.message || `HTTP ${response.status}`];

        await auditLogger.logEvent(
          "SALESFORCE_CREATE_LEAD_ERROR",
          "system",
          "salesforce",
          JSON.stringify({
            mode: "live",
            success: false,
            attempt,
            statusCode: response.status,
            errors,
          })
        );

        // Don't retry on 4xx client errors (except 401 handled above)
        if (response.status >= 400 && response.status < 500) {
          return {
            success: false,
            sfLeadId: null,
            errors,
          };
        }

        lastError = new Error(errors.join("; "));
        continue;
      }

      const result: SalesforceCreateLeadResult = {
        success: data.success === true,
        sfLeadId: data.id || null,
        errors: data.errors || [],
      };

      await auditLogger.logEvent(
        "SALESFORCE_CREATE_LEAD",
        "system",
        result.sfLeadId || "unknown",
        JSON.stringify({
          mode: "live",
          success: result.success,
          sfLeadId: result.sfLeadId,
          attempt,
          leadSource: payload.LeadSource,
          lastName: payload.LastName,
        })
      );

      return result;
    } catch (error) {
      lastError =
        error instanceof Error ? error : new Error("Unknown error during lead creation");

      await auditLogger.logEvent(
        "SALESFORCE_CREATE_LEAD_ERROR",
        "system",
        "salesforce",
        JSON.stringify({
          mode: "live",
          success: false,
          attempt,
          error: lastError.message,
        })
      );

      if (attempt === MAX_RETRIES) {
        break;
      }
    }
  }

  const errorMessage = lastError
    ? lastError.message
    : "Max retries exceeded for Salesforce lead creation";

  await auditLogger.logEvent(
    "SALESFORCE_CREATE_LEAD_FAILED",
    "system",
    "salesforce",
    JSON.stringify({
      mode: "live",
      success: false,
      error: errorMessage,
      maxRetries: MAX_RETRIES,
    })
  );

  return {
    success: false,
    sfLeadId: null,
    errors: [errorMessage],
  };
}

/**
 * Retrieves the status of a lead in Salesforce by its Salesforce Lead ID.
 * In simulated mode, returns a mock status response.
 *
 * @param sfLeadId - The Salesforce Lead ID
 * @returns The lead status information
 */
export async function getSalesforceLeadStatus(
  sfLeadId: string
): Promise<SalesforceLeadStatusResult> {
  if (!sfLeadId || sfLeadId.trim().length === 0) {
    throw new Error("Salesforce Lead ID is required");
  }

  if (isSimulatedMode()) {
    const result = simulatedLeadStatusResult(sfLeadId);
    await auditLogger.logEvent(
      "SALESFORCE_GET_LEAD_STATUS",
      "system",
      sfLeadId,
      JSON.stringify({
        mode: "simulated",
        success: true,
        sfLeadId,
        status: result.status,
      })
    );
    return result;
  }

  try {
    const auth = await authenticateWithSalesforce();

    const url = `${auth.instanceUrl}/services/data/${SALESFORCE_API_VERSION}/sobjects/Lead/${sfLeadId}?fields=Id,Status,Name,Company,CreatedDate`;

    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `${auth.tokenType} ${auth.accessToken}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const errorBody = await response.text();
      await auditLogger.logEvent(
        "SALESFORCE_GET_LEAD_STATUS_ERROR",
        "system",
        sfLeadId,
        JSON.stringify({
          mode: "live",
          success: false,
          statusCode: response.status,
          error: errorBody,
        })
      );
      throw new Error(
        `Failed to retrieve Salesforce lead status: HTTP ${response.status}`
      );
    }

    const data = await response.json();

    const result: SalesforceLeadStatusResult = {
      sfLeadId: data.Id || sfLeadId,
      status: data.Status || "Unknown",
      name: data.Name || null,
      company: data.Company || null,
      createdDate: data.CreatedDate || null,
    };

    await auditLogger.logEvent(
      "SALESFORCE_GET_LEAD_STATUS",
      "system",
      sfLeadId,
      JSON.stringify({
        mode: "live",
        success: true,
        sfLeadId: result.sfLeadId,
        status: result.status,
      })
    );

    return result;
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error retrieving lead status";

    await auditLogger.logEvent(
      "SALESFORCE_GET_LEAD_STATUS_ERROR",
      "system",
      sfLeadId,
      JSON.stringify({
        mode: "live",
        success: false,
        error: errorMessage,
      })
    );

    throw new Error(`Failed to retrieve Salesforce lead status: ${errorMessage}`);
  }
}

/**
 * Clears the cached Salesforce authentication token.
 * Useful for testing or forcing re-authentication.
 */
export function clearSalesforceAuthCache(): void {
  cachedAuth = null;
  cachedAuthExpiry = 0;
}