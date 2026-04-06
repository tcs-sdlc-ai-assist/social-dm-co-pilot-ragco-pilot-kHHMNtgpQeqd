// ============================================================
// PII Scrubber — Privacy compliance utility for PII removal
// ============================================================
// Strips personally identifiable information from text before
// sending to LLM or logging. Replaces detected PII with
// [REDACTED] tokens.
// ============================================================

/**
 * Pattern definitions for various PII types.
 * Each entry contains a regex and the redaction label.
 */
const PII_PATTERNS: { regex: RegExp; label: string }[] = [
  // Email addresses
  {
    regex: /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g,
    label: "[REDACTED EMAIL]",
  },
  // Australian phone numbers: 04xx xxx xxx, +614xxxxxxxx, (02) xxxx xxxx, etc.
  {
    regex:
      /(?:\+?61[\s\-]?)?(?:\(0[2-9]\)[\s\-]?\d{4}[\s\-]?\d{4}|0[2-9][\s\-]?\d{4}[\s\-]?\d{4}|04\d{2}[\s\-]?\d{3}[\s\-]?\d{3})/g,
    label: "[REDACTED PHONE]",
  },
  // International phone numbers: +xx xxx xxx xxxx or similar patterns
  {
    regex: /\+\d{1,3}[\s\-]?\d{2,4}[\s\-]?\d{3,4}[\s\-]?\d{3,4}/g,
    label: "[REDACTED PHONE]",
  },
  // Credit card numbers: 13-19 digits with optional spaces or dashes
  {
    regex:
      /\b(?:\d{4}[\s\-]?){3}\d{1,7}\b/g,
    label: "[REDACTED CREDIT CARD]",
  },
  // Australian Tax File Numbers (TFN): 8 or 9 digits with optional spaces or dashes
  {
    regex: /\b\d{3}[\s\-]?\d{3}[\s\-]?\d{2,3}\b/g,
    label: "[REDACTED TFN]",
  },
  // Australian Medicare numbers: 10-11 digits, often formatted as xxxx xxxxx x
  {
    regex: /\b\d{4}[\s\-]?\d{5}[\s\-]?\d{1,2}\b/g,
    label: "[REDACTED MEDICARE]",
  },
  // Street addresses: number + street name + street type
  {
    regex:
      /\b\d{1,5}[\s]+[A-Za-z]+(?:[\s]+[A-Za-z]+)*[\s]+(?:Street|St|Road|Rd|Avenue|Ave|Boulevard|Blvd|Drive|Dr|Lane|Ln|Court|Ct|Place|Pl|Terrace|Tce|Crescent|Cres|Circuit|Cct|Way|Close|Cl|Parade|Pde|Highway|Hwy)\b/gi,
    label: "[REDACTED ADDRESS]",
  },
];

/**
 * Scrubs personally identifiable information from the given text.
 * Replaces detected PII with [REDACTED] tokens.
 *
 * @param text - The input text to scrub
 * @returns The text with PII replaced by redaction tokens
 */
export function scrubPII(text: string): string {
  if (!text) {
    return text;
  }

  let scrubbed = text;

  for (const pattern of PII_PATTERNS) {
    // Reset lastIndex for global regexes by creating a fresh copy
    const regex = new RegExp(pattern.regex.source, pattern.regex.flags);
    scrubbed = scrubbed.replace(regex, pattern.label);
  }

  return scrubbed;
}

/**
 * Checks whether the given text contains any detectable PII.
 *
 * @param text - The input text to check
 * @returns true if PII is detected, false otherwise
 */
export function containsPII(text: string): boolean {
  if (!text) {
    return false;
  }

  for (const pattern of PII_PATTERNS) {
    const regex = new RegExp(pattern.regex.source, pattern.regex.flags);
    if (regex.test(text)) {
      return true;
    }
  }

  return false;
}