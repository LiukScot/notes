import { z } from "zod";

export const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1).max(100),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const createPageSchema = z.object({
  parentPageId: z.string().nullable().optional(),
  title: z.string().default("Untitled"),
  icon: z.string().nullable().optional(),
});

export const updatePageSchema = z.object({
  title: z.string().optional(),
  icon: z.string().nullable().optional(),
  coverImage: z.string().nullable().optional(),
  parentPageId: z.string().nullable().optional(),
});

// Database schemas
export const propertyTypeSchema = z.enum([
  "text",
  "number",
  "select",
  "multi_select",
  "date",
  "checkbox",
]);

export const createDatabaseSchema = z.object({
  parentPageId: z.string().nullable().optional(),
  title: z.string().default("Untitled Database"),
});

export const createPropertySchema = z.object({
  name: z.string().min(1),
  type: propertyTypeSchema,
  config: z.record(z.unknown()).optional(),
});

export const updatePropertySchema = z.object({
  name: z.string().min(1).optional(),
  type: propertyTypeSchema.optional(),
  config: z.record(z.unknown()).nullable().optional(),
});

export const reorderPropertiesSchema = z.object({
  propertyIds: z.array(z.string()),
});

export const createRowSchema = z.object({
  cells: z.record(z.unknown()).optional(),
});

export const updateCellSchema = z.object({
  value: z.unknown(),
});

export type SignupInput = z.infer<typeof signupSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type CreatePageInput = z.infer<typeof createPageSchema>;
export type UpdatePageInput = z.infer<typeof updatePageSchema>;
export type CreateDatabaseInput = z.infer<typeof createDatabaseSchema>;
export type CreatePropertyInput = z.infer<typeof createPropertySchema>;
export type UpdatePropertyInput = z.infer<typeof updatePropertySchema>;
export type CreateRowInput = z.infer<typeof createRowSchema>;
export type UpdateCellInput = z.infer<typeof updateCellSchema>;
