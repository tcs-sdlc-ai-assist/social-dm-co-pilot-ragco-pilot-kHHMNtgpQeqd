import { describe, it, expect } from "vitest";
import { scrubPII, containsPII } from "@/lib/compliance/pii-scrubber";

describe("scrubPII", () => {
  describe("email addresses", () => {
    it("redacts a simple email address", () => {
      const input = "Contact me at john.doe@example.com for details.";
      const result = scrubPII(input);
      expect(result).toBe("Contact me at [REDACTED EMAIL] for details.");
      expect(result).not.toContain("john.doe@example.com");
    });

    it("redacts multiple email addresses", () => {
      const input = "Email sarah@test.com or admin@company.org for help.";
      const result = scrubPII(input);
      expect(result).not.toContain("sarah@test.com");
      expect(result).not.toContain("admin@company.org");
      expect(result).toContain("[REDACTED EMAIL]");
    });

    it("redacts email addresses with plus addressing", () => {
      const input = "Send to user+tag@gmail.com please.";
      const result = scrubPII(input);
      expect(result).not.toContain("user+tag@gmail.com");
      expect(result).toContain("[REDACTED EMAIL]");
    });
  });

  describe("phone numbers", () => {
    it("redacts Australian mobile numbers (04xx xxx xxx)", () => {
      const input = "Call me on 0412 345 678 anytime.";
      const result = scrubPII(input);
      expect(result).not.toContain("0412 345 678");
      expect(result).toContain("[REDACTED PHONE]");
    });

    it("redacts Australian landline numbers (02 xxxx xxxx)", () => {
      const input = "Our office number is 02 9876 5432.";
      const result = scrubPII(input);
      expect(result).not.toContain("02 9876 5432");
      expect(result).toContain("[REDACTED PHONE]");
    });

    it("redacts Australian numbers with +61 prefix", () => {
      const input = "Reach me at +61 412 345 678.";
      const result = scrubPII(input);
      expect(result).not.toContain("+61 412 345 678");
      expect(result).toContain("[REDACTED PHONE]");
    });

    it("redacts Australian landline with area code in parentheses", () => {
      const input = "Phone: (02) 9876 5432.";
      const result = scrubPII(input);
      expect(result).not.toContain("(02) 9876 5432");
      expect(result).toContain("[REDACTED PHONE]");
    });

    it("redacts international phone numbers with + prefix", () => {
      const input = "International: +44 20 7946 0958.";
      const result = scrubPII(input);
      expect(result).not.toContain("+44 20 7946 0958");
      expect(result).toContain("[REDACTED PHONE]");
    });
  });

  describe("credit card numbers", () => {
    it("redacts credit card numbers with spaces", () => {
      const input = "My card is 4111 1111 1111 1111.";
      const result = scrubPII(input);
      expect(result).not.toContain("4111 1111 1111 1111");
      expect(result).toContain("[REDACTED CREDIT CARD]");
    });

    it("redacts credit card numbers with dashes", () => {
      const input = "Card: 5500-0000-0000-0004.";
      const result = scrubPII(input);
      expect(result).not.toContain("5500-0000-0000-0004");
      expect(result).toContain("[REDACTED CREDIT CARD]");
    });
  });

  describe("Tax File Numbers (TFN)", () => {
    it("redacts TFN with spaces", () => {
      const input = "My TFN is 123 456 789.";
      const result = scrubPII(input);
      expect(result).not.toContain("123 456 789");
      expect(result).toContain("[REDACTED TFN]");
    });

    it("redacts TFN with dashes", () => {
      const input = "TFN: 987-654-321.";
      const result = scrubPII(input);
      expect(result).not.toContain("987-654-321");
      expect(result).toContain("[REDACTED TFN]");
    });
  });

  describe("Medicare numbers", () => {
    it("redacts Medicare numbers with spaces", () => {
      const input = "Medicare number: 2345 67890 12.";
      const result = scrubPII(input);
      expect(result).not.toContain("2345 67890 12");
      expect(result).toContain("[REDACTED MEDICARE]");
    });
  });

  describe("street addresses", () => {
    it("redacts a street address with Street suffix", () => {
      const input = "I live at 123 George Street in Sydney.";
      const result = scrubPII(input);
      expect(result).not.toContain("123 George Street");
      expect(result).toContain("[REDACTED ADDRESS]");
    });

    it("redacts a street address with Road suffix", () => {
      const input = "Our office is at 456 Parramatta Road.";
      const result = scrubPII(input);
      expect(result).not.toContain("456 Parramatta Road");
      expect(result).toContain("[REDACTED ADDRESS]");
    });

    it("redacts a street address with Avenue suffix", () => {
      const input = "Meet me at 78 Victoria Avenue tomorrow.";
      const result = scrubPII(input);
      expect(result).not.toContain("78 Victoria Avenue");
      expect(result).toContain("[REDACTED ADDRESS]");
    });

    it("redacts a street address with Drive suffix", () => {
      const input = "The property is at 10 Lakeside Drive.";
      const result = scrubPII(input);
      expect(result).not.toContain("10 Lakeside Drive");
      expect(result).toContain("[REDACTED ADDRESS]");
    });

    it("redacts a street address with Boulevard suffix", () => {
      const input = "Located at 200 Sunset Boulevard.";
      const result = scrubPII(input);
      expect(result).not.toContain("200 Sunset Boulevard");
      expect(result).toContain("[REDACTED ADDRESS]");
    });
  });

  describe("mixed PII", () => {
    it("redacts multiple types of PII in one string", () => {
      const input =
        "Contact John at john@example.com or 0412 345 678. He lives at 42 King Street.";
      const result = scrubPII(input);
      expect(result).not.toContain("john@example.com");
      expect(result).not.toContain("0412 345 678");
      expect(result).not.toContain("42 King Street");
      expect(result).toContain("[REDACTED EMAIL]");
      expect(result).toContain("[REDACTED PHONE]");
      expect(result).toContain("[REDACTED ADDRESS]");
    });
  });

  describe("clean text", () => {
    it("returns clean text unchanged", () => {
      const input =
        "I am interested in the Stockland Willowdale community. What are the lot sizes available?";
      const result = scrubPII(input);
      expect(result).toBe(input);
    });

    it("returns empty string for empty input", () => {
      expect(scrubPII("")).toBe("");
    });

    it("returns the input for null-like values", () => {
      expect(scrubPII(null as unknown as string)).toBe(null);
      expect(scrubPII(undefined as unknown as string)).toBe(undefined);
    });
  });
});

describe("containsPII", () => {
  it("returns true when email is present", () => {
    expect(containsPII("Email me at test@example.com")).toBe(true);
  });

  it("returns true when phone number is present", () => {
    expect(containsPII("Call 0412 345 678")).toBe(true);
  });

  it("returns true when street address is present", () => {
    expect(containsPII("I live at 123 George Street")).toBe(true);
  });

  it("returns true when credit card number is present", () => {
    expect(containsPII("Card: 4111 1111 1111 1111")).toBe(true);
  });

  it("returns true when TFN is present", () => {
    expect(containsPII("TFN 123 456 789")).toBe(true);
  });

  it("returns false for clean text", () => {
    expect(
      containsPII("What are the available lots at Stockland Willowdale?")
    ).toBe(false);
  });

  it("returns false for empty string", () => {
    expect(containsPII("")).toBe(false);
  });

  it("returns false for null-like values", () => {
    expect(containsPII(null as unknown as string)).toBe(false);
    expect(containsPII(undefined as unknown as string)).toBe(false);
  });
});