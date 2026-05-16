import { describe, expect, test } from "bun:test";
import {
  signupSchema,
  loginSchema,
  createPageSchema,
  updatePageSchema,
  reorderPagesSchema,
  createPropertySchema,
  reorderPropertiesSchema,
  propertyTypeSchema,
  updateCellSchema,
} from "./validators.ts";

describe("signupSchema", () => {
  test("accepts valid input", () => {
    expect(
      signupSchema.safeParse({
        email: "a@b.com",
        password: "Password123!",
        name: "A",
      }).success
    ).toBe(true);
  });

  test("rejects email longer than 254 chars", () => {
    const longEmail = `${"x".repeat(250)}@e.co`;
    expect(
      signupSchema.safeParse({
        email: longEmail,
        password: "Password123!",
        name: "X",
      }).success
    ).toBe(false);
  });

  test("rejects password shorter than 8 chars", () => {
    expect(
      signupSchema.safeParse({
        email: "a@b.com",
        password: "short",
        name: "X",
      }).success
    ).toBe(false);
  });

  test("rejects empty name", () => {
    expect(
      signupSchema.safeParse({
        email: "a@b.com",
        password: "Password123!",
        name: "",
      }).success
    ).toBe(false);
  });
});

describe("loginSchema", () => {
  test("accepts any non-empty password (no min length on login)", () => {
    expect(
      loginSchema.safeParse({ email: "a@b.com", password: "x" }).success
    ).toBe(true);
  });

  test("rejects invalid email format", () => {
    expect(
      loginSchema.safeParse({ email: "not-email", password: "x" }).success
    ).toBe(false);
  });
});

describe("createPageSchema", () => {
  test("title defaults to 'Untitled'", () => {
    const result = createPageSchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.title).toBe("Untitled");
    }
  });
});

describe("updatePageSchema coverImage validation (PR #18)", () => {
  test("accepts https:// URL", () => {
    expect(
      updatePageSchema.safeParse({ coverImage: "https://e.com/x.png" }).success
    ).toBe(true);
  });

  test("accepts internal /uploads/ path", () => {
    expect(
      updatePageSchema.safeParse({ coverImage: "/uploads/covers/u/x.png" })
        .success
    ).toBe(true);
  });

  test("rejects http:// (non-TLS)", () => {
    expect(
      updatePageSchema.safeParse({ coverImage: "http://e.com/x.png" }).success
    ).toBe(false);
  });

  test("rejects javascript: URL", () => {
    expect(
      updatePageSchema.safeParse({ coverImage: "javascript:alert(1)" }).success
    ).toBe(false);
  });

  test("rejects data: URL", () => {
    expect(
      updatePageSchema.safeParse({ coverImage: "data:text/html,<script>" })
        .success
    ).toBe(false);
  });

  test("rejects URL longer than 2048 chars", () => {
    const long = `https://e.com/${"a".repeat(2100)}.png`;
    expect(updatePageSchema.safeParse({ coverImage: long }).success).toBe(
      false
    );
  });

  test("accepts URL exactly 2048 chars", () => {
    const padding = "a".repeat(2048 - "https://e.com/".length);
    const exact = `https://e.com/${padding}`;
    expect(exact.length).toBe(2048);
    expect(updatePageSchema.safeParse({ coverImage: exact }).success).toBe(
      true
    );
  });

  test("accepts coverImage: null (clears cover)", () => {
    expect(
      updatePageSchema.safeParse({ coverImage: null }).success
    ).toBe(true);
  });
});

describe("reorderPagesSchema", () => {
  test("requires at least one ordered page", () => {
    expect(
      reorderPagesSchema.safeParse({
        parentPageId: null,
        orderedPageIds: [],
      }).success
    ).toBe(false);
  });

  test("accepts null parentPageId", () => {
    expect(
      reorderPagesSchema.safeParse({
        parentPageId: null,
        orderedPageIds: ["a"],
      }).success
    ).toBe(true);
  });
});

describe("propertyTypeSchema", () => {
  test("accepts the 6 supported types", () => {
    for (const t of ["text", "number", "select", "multi_select", "date", "checkbox"]) {
      expect(propertyTypeSchema.safeParse(t).success).toBe(true);
    }
  });

  test("rejects unknown type", () => {
    expect(propertyTypeSchema.safeParse("rocket").success).toBe(false);
  });
});

describe("createPropertySchema", () => {
  test("rejects empty name", () => {
    expect(
      createPropertySchema.safeParse({ name: "", type: "text" }).success
    ).toBe(false);
  });
});

describe("reorderPropertiesSchema", () => {
  test("accepts string array", () => {
    expect(
      reorderPropertiesSchema.safeParse({ propertyIds: ["a", "b"] }).success
    ).toBe(true);
  });
});

describe("updateCellSchema", () => {
  test("accepts arbitrary unknown value (string)", () => {
    expect(updateCellSchema.safeParse({ value: "x" }).success).toBe(true);
  });
  test("accepts null value", () => {
    expect(updateCellSchema.safeParse({ value: null }).success).toBe(true);
  });
});
