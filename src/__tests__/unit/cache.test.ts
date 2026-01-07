import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { SimpleCache } from "../../lib/cache.js";

describe("SimpleCache", () => {
  let cache: SimpleCache;

  beforeEach(() => {
    vi.useFakeTimers();
    cache = new SimpleCache();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should store and retrieve values", () => {
    cache.set("key1", "value1", 300); // 5 minutes
    expect(cache.get("key1")).toBe("value1");
  });

  it("should return null for missing keys", () => {
    expect(cache.get("nonexistent")).toBeNull();
  });

  it("should overwrite existing values", () => {
    cache.set("key1", "value1", 300);
    cache.set("key1", "value2", 300);
    expect(cache.get("key1")).toBe("value2");
  });

  it("should store complex objects", () => {
    const obj = { name: "test", nested: { value: 123 } };
    cache.set("object", obj, 300);
    expect(cache.get("object")).toEqual(obj);
  });

  it("should store arrays", () => {
    const arr = [1, 2, 3, { nested: true }];
    cache.set("array", arr, 300);
    expect(cache.get("array")).toEqual(arr);
  });

  it("should expire entries after TTL", () => {
    cache.set("key1", "value1", 300); // 5 minutes (300 seconds)
    expect(cache.get("key1")).toBe("value1");

    // Advance time past TTL
    vi.advanceTimersByTime(300 * 1000 + 1);

    expect(cache.get("key1")).toBeNull();
  });

  it("should not expire entries before TTL", () => {
    cache.set("key1", "value1", 300);

    // Advance time but not past TTL
    vi.advanceTimersByTime(299 * 1000);

    expect(cache.get("key1")).toBe("value1");
  });

  it("should delete entries", () => {
    cache.set("key1", "value1", 300);
    expect(cache.get("key1")).toBe("value1");

    cache.delete("key1");
    expect(cache.get("key1")).toBeNull();
  });

  it("should clear all entries", () => {
    cache.set("key1", "value1", 300);
    cache.set("key2", "value2", 300);
    cache.set("key3", "value3", 300);

    cache.clear();

    expect(cache.get("key1")).toBeNull();
    expect(cache.get("key2")).toBeNull();
    expect(cache.get("key3")).toBeNull();
  });

  it("should track size correctly", () => {
    expect(cache.size()).toBe(0);

    cache.set("key1", "value1", 300);
    expect(cache.size()).toBe(1);

    cache.set("key2", "value2", 300);
    expect(cache.size()).toBe(2);

    cache.delete("key1");
    expect(cache.size()).toBe(1);

    cache.clear();
    expect(cache.size()).toBe(0);
  });

  it("should handle empty string keys", () => {
    cache.set("", "empty key value", 300);
    expect(cache.get("")).toBe("empty key value");
  });

  it("should handle null values", () => {
    cache.set("null", null, 300);
    expect(cache.get("null")).toBeNull();
  });

  it("should reset TTL when value is updated", () => {
    cache.set("key", "value1", 300);

    // Advance 200 seconds
    vi.advanceTimersByTime(200 * 1000);

    // Update value - should reset TTL
    cache.set("key", "value2", 300);

    // Advance another 200 seconds (would have expired if TTL wasn't reset)
    vi.advanceTimersByTime(200 * 1000);

    expect(cache.get("key")).toBe("value2");

    // Advance past new TTL
    vi.advanceTimersByTime(101 * 1000);

    expect(cache.get("key")).toBeNull();
  });

  it("should handle many entries", () => {
    for (let i = 0; i < 100; i++) {
      cache.set(`key${i}`, `value${i}`, 300);
    }

    expect(cache.size()).toBe(100);

    for (let i = 0; i < 100; i++) {
      expect(cache.get(`key${i}`)).toBe(`value${i}`);
    }
  });

  it("should handle short TTL", () => {
    cache.set("key", "value", 1); // 1 second TTL

    expect(cache.get("key")).toBe("value");

    vi.advanceTimersByTime(1001);

    expect(cache.get("key")).toBeNull();
  });

  it("should handle very long TTL", () => {
    cache.set("key", "value", 86400); // 24 hours

    vi.advanceTimersByTime(86000 * 1000); // Just under 24 hours

    expect(cache.get("key")).toBe("value");
  });
});
