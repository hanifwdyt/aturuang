import { createRoute } from "@hono/zod-openapi";
import {
  RegisterBody,
  LoginBody,
  AuthResponse,
  ErrorResponse,
  MessageResponse,
  ExpenseSchema,
  ExpenseListQuery,
  ExpenseListResponse,
  ExpenseSummaryResponse,
  UserProfileResponse,
  UpdateProfileBody,
} from "./schemas.js";

const authTag = "Auth";
const expenseTag = "Expenses";
const userTag = "User";

const bearerSecurity = [{ Bearer: [] }];

// ==================== Auth Routes ====================

export const registerRoute = createRoute({
  method: "post",
  path: "/api/v1/auth/register",
  tags: [authTag],
  summary: "Register API access",
  description:
    "Link your existing Telegram account to API access. Provide your tgId + existing dashboard password for verification, then set email + new password for API login.",
  request: { body: { content: { "application/json": { schema: RegisterBody } } } },
  responses: {
    200: {
      description: "Registration successful",
      content: { "application/json": { schema: MessageResponse } },
    },
    400: {
      description: "Validation error",
      content: { "application/json": { schema: ErrorResponse } },
    },
    401: {
      description: "Invalid tgId or password",
      content: { "application/json": { schema: ErrorResponse } },
    },
    409: {
      description: "Email already registered",
      content: { "application/json": { schema: ErrorResponse } },
    },
  },
});

export const loginRoute = createRoute({
  method: "post",
  path: "/api/v1/auth/login",
  tags: [authTag],
  summary: "Login",
  description: "Login with email + password to get a JWT token (valid for 7 days).",
  request: { body: { content: { "application/json": { schema: LoginBody } } } },
  responses: {
    200: {
      description: "Login successful",
      content: { "application/json": { schema: AuthResponse } },
    },
    401: {
      description: "Invalid credentials",
      content: { "application/json": { schema: ErrorResponse } },
    },
  },
});

// ==================== Expense Routes ====================

export const listExpensesRoute = createRoute({
  method: "get",
  path: "/api/v1/expenses",
  tags: [expenseTag],
  summary: "List expenses",
  description: "Get paginated list of expenses with optional filters.",
  security: bearerSecurity,
  request: { query: ExpenseListQuery },
  responses: {
    200: {
      description: "List of expenses",
      content: { "application/json": { schema: ExpenseListResponse } },
    },
    401: {
      description: "Unauthorized",
      content: { "application/json": { schema: ErrorResponse } },
    },
  },
});

export const getExpenseRoute = createRoute({
  method: "get",
  path: "/api/v1/expenses/{id}",
  tags: [expenseTag],
  summary: "Get expense by ID",
  description: "Get a single expense by its ID.",
  security: bearerSecurity,
  request: {
    params: ExpenseSchema.pick({ id: true }),
  },
  responses: {
    200: {
      description: "Expense detail",
      content: { "application/json": { schema: ExpenseSchema } },
    },
    401: {
      description: "Unauthorized",
      content: { "application/json": { schema: ErrorResponse } },
    },
    404: {
      description: "Expense not found",
      content: { "application/json": { schema: ErrorResponse } },
    },
  },
});

export const expenseSummaryRoute = createRoute({
  method: "get",
  path: "/api/v1/expenses/summary",
  tags: [expenseTag],
  summary: "Expense summary",
  description:
    "Get expense summary: today/week/month totals, breakdown by category and mood.",
  security: bearerSecurity,
  responses: {
    200: {
      description: "Expense summary",
      content: { "application/json": { schema: ExpenseSummaryResponse } },
    },
    401: {
      description: "Unauthorized",
      content: { "application/json": { schema: ErrorResponse } },
    },
  },
});

// ==================== User Routes ====================

export const getProfileRoute = createRoute({
  method: "get",
  path: "/api/v1/user/profile",
  tags: [userTag],
  summary: "Get current user profile",
  security: bearerSecurity,
  responses: {
    200: {
      description: "User profile",
      content: { "application/json": { schema: UserProfileResponse } },
    },
    401: {
      description: "Unauthorized",
      content: { "application/json": { schema: ErrorResponse } },
    },
  },
});

export const updateProfileRoute = createRoute({
  method: "patch",
  path: "/api/v1/user/profile",
  tags: [userTag],
  summary: "Update user profile",
  description: "Update name and/or theme preference.",
  security: bearerSecurity,
  request: { body: { content: { "application/json": { schema: UpdateProfileBody } } } },
  responses: {
    200: {
      description: "Updated profile",
      content: { "application/json": { schema: UserProfileResponse } },
    },
    401: {
      description: "Unauthorized",
      content: { "application/json": { schema: ErrorResponse } },
    },
  },
});
