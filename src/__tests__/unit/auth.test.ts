import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { extractApiKey } from "../../lib/auth.js";
import { AuthenticationError } from "../../lib/errors.js";

describe("extractApiKey", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
    delete process.env.AIRTABLE_API_KEY;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("parameter extraction (highest priority)", () => {
    it("should extract API key from airtableApiKey parameter", () => {
      const result = extractApiKey({ airtableApiKey: "pat123456" });
      expect(result).toBe("pat123456");
    });

    it("should prefer parameter over header", () => {
      const context = {
        session: {
          headers: {
            "x-airtable-api-key": "headerKey",
          },
        },
      };
      const result = extractApiKey({ airtableApiKey: "paramKey" }, context);
      expect(result).toBe("paramKey");
    });

    it("should prefer parameter over environment variable", () => {
      process.env.AIRTABLE_API_KEY = "envKey";
      const result = extractApiKey({ airtableApiKey: "paramKey" });
      expect(result).toBe("paramKey");
    });
  });

  describe("header extraction (second priority) - via session.headers", () => {
    it("should extract from x-airtable-api-key header (lowercase)", () => {
      const context = {
        session: {
          headers: {
            "x-airtable-api-key": "headerKey123",
          },
        },
      };
      const result = extractApiKey({}, context);
      expect(result).toBe("headerKey123");
    });

    it("should extract from X-Airtable-Api-Key header (mixed case)", () => {
      const context = {
        session: {
          headers: {
            "X-Airtable-Api-Key": "headerKeyMixed",
          },
        },
      };
      const result = extractApiKey({}, context);
      expect(result).toBe("headerKeyMixed");
    });

    it("should extract from X-AIRTABLE-API-KEY header (uppercase)", () => {
      const context = {
        session: {
          headers: {
            "X-AIRTABLE-API-KEY": "headerKeyUpper",
          },
        },
      };
      const result = extractApiKey({}, context);
      expect(result).toBe("headerKeyUpper");
    });

    it("should handle array header values", () => {
      const context = {
        session: {
          headers: {
            "x-airtable-api-key": ["firstKey", "secondKey"],
          },
        },
      };
      const result = extractApiKey({}, context);
      expect(result).toBe("firstKey");
    });

    it("should extract from Authorization: Bearer header", () => {
      const context = {
        session: {
          headers: {
            authorization: "Bearer pat123456789",
          },
        },
      };
      const result = extractApiKey({}, context);
      expect(result).toBe("pat123456789");
    });

    it("should handle Authorization header (capitalized)", () => {
      const context = {
        session: {
          headers: {
            Authorization: "Bearer pat987654321",
          },
        },
      };
      const result = extractApiKey({}, context);
      expect(result).toBe("pat987654321");
    });

    it("should handle array Authorization header", () => {
      const context = {
        session: {
          headers: {
            authorization: ["Bearer patFirst", "Bearer patSecond"],
          },
        },
      };
      const result = extractApiKey({}, context);
      expect(result).toBe("patFirst");
    });

    it("should prefer x-airtable-api-key over Authorization", () => {
      const context = {
        session: {
          headers: {
            "x-airtable-api-key": "customHeaderKey",
            authorization: "Bearer patAuthKey",
          },
        },
      };
      const result = extractApiKey({}, context);
      expect(result).toBe("customHeaderKey");
    });

    it("should ignore Authorization header without Bearer prefix", () => {
      process.env.AIRTABLE_API_KEY = "envKey";
      const context = {
        session: {
          headers: {
            authorization: "Basic dXNlcjpwYXNz",
          },
        },
      };
      const result = extractApiKey({}, context);
      expect(result).toBe("envKey");
    });
  });

  describe("environment variable extraction (fallback)", () => {
    it("should extract from AIRTABLE_API_KEY environment variable", () => {
      process.env.AIRTABLE_API_KEY = "envApiKey";
      const result = extractApiKey({});
      expect(result).toBe("envApiKey");
    });

    it("should use env var when no context provided", () => {
      process.env.AIRTABLE_API_KEY = "envKey";
      const result = extractApiKey({}, undefined);
      expect(result).toBe("envKey");
    });

    it("should use env var when context has no session", () => {
      process.env.AIRTABLE_API_KEY = "envKey";
      const result = extractApiKey({}, { session: undefined });
      expect(result).toBe("envKey");
    });
  });

  describe("error cases", () => {
    it("should throw AuthenticationError when no API key found", () => {
      expect(() => extractApiKey({})).toThrow(AuthenticationError);
    });

    it("should throw with helpful message", () => {
      expect(() => extractApiKey({})).toThrow(/Airtable API key required/);
    });

    it("should throw when context has empty session headers", () => {
      const context = { session: { headers: {} } };
      expect(() => extractApiKey({}, context)).toThrow(AuthenticationError);
    });

    it("should throw when parameter is empty string", () => {
      expect(() => extractApiKey({ airtableApiKey: "" })).toThrow(AuthenticationError);
    });
  });

  describe("edge cases", () => {
    it("should handle undefined args parameter", () => {
      process.env.AIRTABLE_API_KEY = "envKey";
      const result = extractApiKey({ airtableApiKey: undefined });
      expect(result).toBe("envKey");
    });

    it("should handle null context", () => {
      process.env.AIRTABLE_API_KEY = "envKey";
      const result = extractApiKey({}, null);
      expect(result).toBe("envKey");
    });
  });
});
