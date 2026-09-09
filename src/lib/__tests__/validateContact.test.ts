import { describe, expect, it } from "vitest";
import { validateContact } from "../validateContact";

describe("validateContact", () => {
  it("rejects an empty name", () => {
    const result = validateContact({ name: "", priority: "high" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toMatch(/name/i);
    }
  });

  it("rejects a whitespace-only name", () => {
    const result = validateContact({ name: "   ", priority: "medium" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toMatch(/name/i);
    }
  });

  it("rejects an invalid priority value", () => {
    const result = validateContact({ name: "Ada Lovelace", priority: "urgent" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toMatch(/priority/i);
    }
  });

  it("rejects a missing priority", () => {
    const result = validateContact({ name: "Ada Lovelace" });
    expect(result.success).toBe(false);
  });

  it("accepts a valid contact and trims whitespace", () => {
    const result = validateContact({
      name: "  Ada Lovelace  ",
      company: "  Analytical Engines Inc  ",
      role: "Mathematician",
      met_at: "Berkeley career fair",
      notes: "Loves Babbage's work.",
      priority: "high",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe("Ada Lovelace");
      expect(result.data.company).toBe("Analytical Engines Inc");
      expect(result.data.priority).toBe("high");
    }
  });

  it("accepts a valid contact with only the required fields", () => {
    const result = validateContact({ name: "Grace Hopper", priority: "low" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.company).toBe("");
    }
  });
});
