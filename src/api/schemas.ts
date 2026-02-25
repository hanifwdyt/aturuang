import { z } from "@hono/zod-openapi";

// ==================== Auth ====================

export const RegisterBody = z
  .object({
    tgId: z.string().min(1).openapi({ example: "123456789" }),
    password: z.string().min(1).openapi({
      description: "Existing dashboard password (for verification)",
      example: "oldpass123",
    }),
    email: z.string().email().openapi({ example: "user@example.com" }),
    newPassword: z.string().min(6).openapi({
      description: "New password for API access (min 6 chars)",
      example: "securepass123",
    }),
  })
  .openapi("RegisterRequest");

export const LoginBody = z
  .object({
    email: z.string().email().openapi({ example: "user@example.com" }),
    password: z.string().min(1).openapi({ example: "securepass123" }),
  })
  .openapi("LoginRequest");

export const AuthResponse = z
  .object({
    token: z.string().openapi({ example: "eyJhbGciOi..." }),
    user: z.object({
      tgId: z.string(),
      name: z.string().nullable(),
      email: z.string(),
      theme: z.string(),
    }),
  })
  .openapi("AuthResponse");

export const ErrorResponse = z
  .object({
    error: z.string().openapi({ example: "Invalid credentials" }),
  })
  .openapi("ErrorResponse");

export const MessageResponse = z
  .object({
    message: z.string().openapi({ example: "Registration successful" }),
    token: z.string().openapi({ example: "eyJhbGciOi..." }),
    user: z.object({
      tgId: z.string(),
      name: z.string().nullable(),
      email: z.string(),
      theme: z.string(),
    }),
  })
  .openapi("RegisterResponse");

// ==================== Expenses ====================

export const ExpenseSchema = z
  .object({
    id: z.string(),
    amount: z.number().int(),
    item: z.string(),
    category: z.string(),
    place: z.string().nullable(),
    withPerson: z.string().nullable(),
    mood: z.string().nullable(),
    story: z.string().nullable(),
    rawMessage: z.string(),
    tgId: z.string(),
    date: z.string(),
    createdAt: z.string(),
  })
  .openapi("Expense");

export const ExpenseListQuery = z.object({
  page: z.string().optional().default("1").openapi({ example: "1" }),
  limit: z.string().optional().default("20").openapi({ example: "20" }),
  category: z.string().optional().openapi({ example: "food" }),
  startDate: z.string().optional().openapi({
    example: "2025-01-01",
    description: "Filter from date (YYYY-MM-DD)",
  }),
  endDate: z.string().optional().openapi({
    example: "2025-12-31",
    description: "Filter to date (YYYY-MM-DD)",
  }),
  sort: z
    .enum(["date_asc", "date_desc", "amount_asc", "amount_desc"])
    .optional()
    .default("date_desc")
    .openapi({ example: "date_desc" }),
});

export const ExpenseListResponse = z
  .object({
    data: z.array(ExpenseSchema),
    pagination: z.object({
      page: z.number(),
      limit: z.number(),
      total: z.number(),
      totalPages: z.number(),
    }),
  })
  .openapi("ExpenseListResponse");

export const ExpenseSummaryResponse = z
  .object({
    today: z.object({ total: z.number(), count: z.number() }),
    week: z.object({ total: z.number(), count: z.number() }),
    month: z.object({ total: z.number(), count: z.number() }),
    byCategory: z.record(
      z.string(),
      z.object({ total: z.number(), count: z.number() })
    ),
    byMood: z.record(z.string(), z.number()),
  })
  .openapi("ExpenseSummaryResponse");

// ==================== User ====================

export const UserProfileResponse = z
  .object({
    tgId: z.string(),
    customId: z.string().nullable(),
    email: z.string().nullable(),
    name: z.string().nullable(),
    theme: z.string(),
    createdAt: z.string(),
  })
  .openapi("UserProfileResponse");

export const UpdateProfileBody = z
  .object({
    name: z.string().min(1).optional().openapi({ example: "John Doe" }),
    theme: z.enum(["dark", "light"]).optional().openapi({ example: "dark" }),
  })
  .openapi("UpdateProfileRequest");
