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

export type SignupInput = z.infer<typeof signupSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type CreatePageInput = z.infer<typeof createPageSchema>;
export type UpdatePageInput = z.infer<typeof updatePageSchema>;
