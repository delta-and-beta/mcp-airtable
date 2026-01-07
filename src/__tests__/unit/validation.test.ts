import { describe, it, expect } from "vitest";
import {
  validateFilePath,
  sanitizeFilename,
  sanitizeFormula,
  sanitizeBase64,
} from "../../lib/validation.js";
import { ValidationError } from "../../lib/errors.js";

describe("validateFilePath", () => {
  it("should accept valid file paths", () => {
    expect(validateFilePath("/tmp/test.txt")).toBe("/tmp/test.txt");
    expect(validateFilePath("./relative/path.txt")).toContain("relative/path.txt");
  });

  it("should reject empty file paths", () => {
    expect(() => validateFilePath("")).toThrow(ValidationError);
    expect(() => validateFilePath("")).toThrow("File path cannot be empty");
  });

  it("should reject path traversal attacks", () => {
    expect(() => validateFilePath("../../../etc/passwd")).toThrow(ValidationError);
    // Note: /safe/../../../etc/passwd normalizes to /etc/passwd, which triggers system dir check
    expect(() => validateFilePath("/safe/../../../etc/passwd")).toThrow(ValidationError);
    expect(() => validateFilePath("foo/../../bar")).toThrow("Path traversal detected");
  });

  it("should reject blocked system directories", () => {
    expect(() => validateFilePath("/etc/passwd")).toThrow(ValidationError);
    expect(() => validateFilePath("/var/log/syslog")).toThrow(ValidationError);
    expect(() => validateFilePath("/usr/bin/node")).toThrow(ValidationError);
    expect(() => validateFilePath("/root/.ssh/id_rsa")).toThrow(ValidationError);
    expect(() => validateFilePath("/proc/self/environ")).toThrow(ValidationError);
  });

  it("should reject Windows system directories (case-insensitive)", () => {
    expect(() => validateFilePath("C:\\Windows\\System32\\config")).toThrow(ValidationError);
    expect(() => validateFilePath("c:\\windows\\system32")).toThrow(ValidationError);
    expect(() => validateFilePath("C:\\Program Files\\app")).toThrow(ValidationError);
  });

  it("should normalize paths", () => {
    const result = validateFilePath("/tmp/./test/../test.txt");
    expect(result).toBe("/tmp/test.txt");
  });
});

describe("sanitizeFilename", () => {
  it("should accept valid filenames", () => {
    expect(sanitizeFilename("document.pdf")).toBe("document.pdf");
    expect(sanitizeFilename("my-file_v2.txt")).toBe("my-file_v2.txt");
    expect(sanitizeFilename("report.2024.csv")).toBe("report.2024.csv");
  });

  it("should reject empty filenames", () => {
    expect(() => sanitizeFilename("")).toThrow(ValidationError);
    expect(() => sanitizeFilename("")).toThrow("Filename cannot be empty");
  });

  it("should replace invalid characters with underscores", () => {
    expect(sanitizeFilename("file@name.txt")).toBe("file_name.txt");
    expect(sanitizeFilename("file name.txt")).toBe("file_name.txt");
    expect(sanitizeFilename("file<>name.txt")).toBe("file__name.txt");
  });

  it("should handle path traversal in filenames", () => {
    expect(sanitizeFilename("../../../etc/passwd")).toBe("passwd");
    expect(sanitizeFilename("/etc/passwd")).toBe("passwd");
  });

  it("should reject dangerous file extensions", () => {
    expect(() => sanitizeFilename("virus.exe")).toThrow(ValidationError);
    expect(() => sanitizeFilename("script.bat")).toThrow(ValidationError);
    expect(() => sanitizeFilename("hack.cmd")).toThrow(ValidationError);
    expect(() => sanitizeFilename("install.sh")).toThrow(ValidationError);
    expect(() => sanitizeFilename("payload.ps1")).toThrow(ValidationError);
  });

  it("should handle consecutive dots", () => {
    expect(sanitizeFilename("file...txt")).toBe("file.txt");
    expect(sanitizeFilename("a..b..c.txt")).toBe("a.b.c.txt");
  });

  it("should remove leading and trailing dots", () => {
    expect(sanitizeFilename(".hidden")).toBe("hidden");
    expect(sanitizeFilename("file.")).toBe("file");
    expect(sanitizeFilename("...file...")).toBe("file");
  });

  it("should truncate long filenames", () => {
    const longName = "a".repeat(300) + ".txt";
    const result = sanitizeFilename(longName);
    expect(result.length).toBeLessThanOrEqual(255);
  });

  it("should reject filenames that become invalid after sanitization", () => {
    // "..." becomes "." after removing leading/trailing dots and collapsing consecutive dots
    expect(() => sanitizeFilename("...")).toThrow(ValidationError);
    // Note: "@#$%" becomes "____" which is a valid filename (all underscores)
    // Only filenames that become empty or "." are rejected
    expect(() => sanitizeFilename("....")).toThrow(ValidationError);
  });
});

describe("sanitizeFormula", () => {
  it("should accept valid Airtable formulas", () => {
    expect(sanitizeFormula("{Status} = 'Active'")).toBe("{Status} = 'Active'");
    expect(sanitizeFormula("AND({Count} > 0, {Name} != '')")).toBe("AND({Count} > 0, {Name} != '')");
    expect(sanitizeFormula("FIND('test', {Name}) > 0")).toBe("FIND('test', {Name}) > 0");
  });

  it("should return empty/null formulas unchanged", () => {
    expect(sanitizeFormula("")).toBe("");
    expect(sanitizeFormula(null as any)).toBe(null);
  });

  it("should reject dangerous JavaScript functions", () => {
    expect(() => sanitizeFormula("EVAL('alert(1)')")).toThrow(ValidationError);
    expect(() => sanitizeFormula("EXEC('rm -rf /')")).toThrow(ValidationError);
    expect(() => sanitizeFormula("SYSTEM('whoami')")).toThrow(ValidationError);
    expect(() => sanitizeFormula("SCRIPT('malicious')")).toThrow(ValidationError);
    expect(() => sanitizeFormula("JAVASCRIPT:alert(1)")).toThrow(ValidationError);
    expect(() => sanitizeFormula("VBSCRIPT:msgbox(1)")).toThrow(ValidationError);
  });

  it("should reject dangerous functions case-insensitively", () => {
    expect(() => sanitizeFormula("eval('test')")).toThrow(ValidationError);
    expect(() => sanitizeFormula("Eval('test')")).toThrow(ValidationError);
    expect(() => sanitizeFormula("EvAl('test')")).toThrow(ValidationError);
  });

  it("should reject SQL injection patterns", () => {
    expect(() => sanitizeFormula("SELECT * FROM users")).toThrow(ValidationError);
    expect(() => sanitizeFormula("' OR 1=1; DROP TABLE users;--")).toThrow(ValidationError);
    expect(() => sanitizeFormula("UNION SELECT password FROM users")).toThrow(ValidationError);
    expect(() => sanitizeFormula("'; DELETE FROM records WHERE 1=1;--")).toThrow(ValidationError);
  });

  it("should reject SQL injection with comments", () => {
    expect(() => sanitizeFormula("test--comment")).toThrow(ValidationError);
    expect(() => sanitizeFormula("value; DROP TABLE")).toThrow(ValidationError);
  });

  it("should reject pipe characters (command injection)", () => {
    expect(() => sanitizeFormula("test | cat /etc/passwd")).toThrow(ValidationError);
  });
});

describe("sanitizeBase64", () => {
  it("should accept valid base64 strings", () => {
    expect(sanitizeBase64("SGVsbG8gV29ybGQ=")).toBe("SGVsbG8gV29ybGQ=");
    expect(sanitizeBase64("dGVzdA==")).toBe("dGVzdA==");
    expect(sanitizeBase64("YWJj")).toBe("YWJj");
  });

  it("should strip whitespace from base64", () => {
    expect(sanitizeBase64("SGVs bG8g V29y bGQ=")).toBe("SGVsbG8gV29ybGQ=");
    expect(sanitizeBase64("dGVz\ndA==")).toBe("dGVzdA==");
  });

  it("should reject empty base64 data", () => {
    expect(() => sanitizeBase64("")).toThrow(ValidationError);
    expect(() => sanitizeBase64("")).toThrow("Base64 data cannot be empty");
  });

  it("should reject invalid base64 format", () => {
    expect(() => sanitizeBase64("not-valid-base64!@#")).toThrow(ValidationError);
    expect(() => sanitizeBase64("invalid===")).toThrow(ValidationError);
    expect(() => sanitizeBase64("invalid====")).toThrow(ValidationError);
  });

  it("should reject base64 data exceeding 10MB", () => {
    // 10MB = 10 * 1024 * 1024 bytes
    // Base64 encodes 3 bytes into 4 chars, so need ~14M chars
    const largeBase64 = "A".repeat(14 * 1024 * 1024);
    expect(() => sanitizeBase64(largeBase64)).toThrow(ValidationError);
    expect(() => sanitizeBase64(largeBase64)).toThrow("Base64 data exceeds 10MB limit");
  });

  it("should accept base64 just under the limit", () => {
    // Just under 10MB
    const underLimitBase64 = "A".repeat(13 * 1024 * 1024);
    expect(() => sanitizeBase64(underLimitBase64)).not.toThrow();
  });
});
