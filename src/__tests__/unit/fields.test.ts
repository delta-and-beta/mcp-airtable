import { describe, it, expect, vi, beforeEach } from "vitest";
import { FIELD_TYPES, FIELD_COLORS, CHECKBOX_ICONS, RATING_ICONS } from "../../lib/field-types.js";
import { AirtableClient } from "../../lib/airtable.js";
import { ValidationError } from "../../lib/errors.js";

describe("Field Types Constants", () => {
  describe("FIELD_TYPES", () => {
    it("should contain all common field types", () => {
      expect(FIELD_TYPES).toContain("singleLineText");
      expect(FIELD_TYPES).toContain("multilineText");
      expect(FIELD_TYPES).toContain("singleSelect");
      expect(FIELD_TYPES).toContain("multipleSelects");
      expect(FIELD_TYPES).toContain("checkbox");
      expect(FIELD_TYPES).toContain("date");
      expect(FIELD_TYPES).toContain("number");
      expect(FIELD_TYPES).toContain("currency");
      expect(FIELD_TYPES).toContain("multipleRecordLinks");
    });

    it("should have correct number of field types", () => {
      expect(FIELD_TYPES.length).toBeGreaterThanOrEqual(28);
    });
  });

  describe("FIELD_COLORS", () => {
    it("should contain bright colors", () => {
      expect(FIELD_COLORS).toContain("blueBright");
      expect(FIELD_COLORS).toContain("redBright");
      expect(FIELD_COLORS).toContain("greenBright");
      expect(FIELD_COLORS).toContain("yellowBright");
    });

    it("should contain light colors", () => {
      expect(FIELD_COLORS).toContain("blueLight");
      expect(FIELD_COLORS).toContain("redLight");
    });

    it("should contain dark colors", () => {
      expect(FIELD_COLORS).toContain("blueDark");
      expect(FIELD_COLORS).toContain("redDark");
    });

    it("should have 30 colors (10 hues x 3 shades)", () => {
      expect(FIELD_COLORS.length).toBe(30);
    });
  });

  describe("CHECKBOX_ICONS", () => {
    it("should contain standard icons", () => {
      expect(CHECKBOX_ICONS).toContain("check");
      expect(CHECKBOX_ICONS).toContain("star");
      expect(CHECKBOX_ICONS).toContain("heart");
      expect(CHECKBOX_ICONS).toContain("flag");
    });
  });

  describe("RATING_ICONS", () => {
    it("should contain rating icons", () => {
      expect(RATING_ICONS).toContain("star");
      expect(RATING_ICONS).toContain("heart");
      expect(RATING_ICONS).toContain("thumbsUp");
    });
  });
});

describe("AirtableClient Field Methods", () => {
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockFetch = vi.fn();
    global.fetch = mockFetch as unknown as typeof fetch;
  });

  describe("createField", () => {
    it("should call the correct endpoint with POST", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: "fldNewField123",
          name: "Priority",
          type: "singleSelect",
        }),
      });

      const client = new AirtableClient("pat123", "appBase123456789");
      const result = await client.createField("tblTable123456789", {
        name: "Priority",
        type: "singleSelect",
        options: {
          choices: [{ name: "High" }, { name: "Low" }],
        },
      });

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.airtable.com/v0/meta/bases/appBase123456789/tables/tblTable123456789/fields",
        expect.objectContaining({
          method: "POST",
          headers: {
            Authorization: "Bearer pat123",
            "Content-Type": "application/json",
          },
        })
      );
      expect(result.id).toBe("fldNewField123");
    });

    it("should include description when provided", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: "fld123", name: "Test", type: "singleLineText" }),
      });

      const client = new AirtableClient("pat123", "appBase123456789");
      await client.createField("tblTable123456789", {
        name: "Test",
        type: "singleLineText",
        description: "A test field",
      });

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.description).toBe("A test field");
    });

    it("should throw ValidationError when baseId is missing", async () => {
      const client = new AirtableClient("pat123");
      await expect(
        client.createField("tblTable", { name: "Test", type: "singleLineText" })
      ).rejects.toThrow(ValidationError);
    });

    it("should handle API errors", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 422,
        statusText: "Unprocessable Entity",
        json: async () => ({ error: { message: "Invalid field type" } }),
      });

      const client = new AirtableClient("pat123", "appBase123456789");
      await expect(
        client.createField("tblTable", { name: "Test", type: "invalid" })
      ).rejects.toThrow("Invalid field type");
    });

    it("should URL-encode table name with spaces", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: "fld123" }),
      });

      const client = new AirtableClient("pat123", "appBase123456789");
      await client.createField("My Table Name", { name: "Test", type: "singleLineText" });

      expect(mockFetch.mock.calls[0][0]).toContain("My%20Table%20Name");
    });
  });

  describe("updateField", () => {
    it("should call the correct endpoint with PATCH", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: "fldField123",
          name: "Updated Name",
        }),
      });

      const client = new AirtableClient("pat123", "appBase123456789");
      const result = await client.updateField(
        "tblTable123456789",
        "fldField123",
        { name: "Updated Name" }
      );

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.airtable.com/v0/meta/bases/appBase123456789/tables/tblTable123456789/fields/fldField123",
        expect.objectContaining({
          method: "PATCH",
        })
      );
      expect(result.name).toBe("Updated Name");
    });

    it("should throw ValidationError when neither name nor description provided", async () => {
      const client = new AirtableClient("pat123", "appBase123456789");
      await expect(
        client.updateField("tblTable", "fldField", {})
      ).rejects.toThrow(ValidationError);
    });

    it("should allow updating only description", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: "fld123", description: "New description" }),
      });

      const client = new AirtableClient("pat123", "appBase123456789");
      await client.updateField("tblTable", "fldField", {
        description: "New description",
      });

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.description).toBe("New description");
      expect(callBody.name).toBeUndefined();
    });

    it("should throw ValidationError when baseId is missing", async () => {
      const client = new AirtableClient("pat123");
      await expect(
        client.updateField("tblTable", "fldField", { name: "New" })
      ).rejects.toThrow(ValidationError);
    });

    it("should handle API errors", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: "Not Found",
        json: async () => ({ error: { message: "Field not found" } }),
      });

      const client = new AirtableClient("pat123", "appBase123456789");
      await expect(
        client.updateField("tblTable", "fldNotExist", { name: "New" })
      ).rejects.toThrow("Field not found");
    });
  });
});
