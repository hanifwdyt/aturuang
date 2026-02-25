import { OpenAPIHono } from "@hono/zod-openapi";
import { jwt, sign } from "hono/jwt";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { apiReference } from "@scalar/hono-api-reference";
import {
  startOfDay,
  endOfDay,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
} from "date-fns";
import {
  registerRoute,
  loginRoute,
  listExpensesRoute,
  getExpenseRoute,
  expenseSummaryRoute,
  getProfileRoute,
  updateProfileRoute,
} from "./routes.js";

const prisma = new PrismaClient();

type JwtPayload = { tgId: string; email: string; exp: number };
type Env = { Variables: { jwtPayload: JwtPayload } };

export function createApi() {
  const app = new OpenAPIHono<Env>();
  const JWT_SECRET = process.env.JWT_SECRET || "change-me-in-production";

  // ==================== Auth (no JWT required) ====================

  app.openapi(registerRoute, async (c) => {
    const { tgId, password, email, newPassword } = c.req.valid("json");

    // Verify existing user via tgId + dashboard password
    const user = await prisma.user.findUnique({ where: { tgId } });
    if (!user || user.password !== password) {
      return c.json({ error: "Invalid tgId or password" }, 401);
    }

    // Check if email already taken
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return c.json({ error: "Email already registered" }, 409);
    }

    // Hash new password and save
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    const updated = await prisma.user.update({
      where: { tgId },
      data: { email, hashedPassword },
    });

    // Generate JWT
    const payload: JwtPayload = {
      tgId: updated.tgId,
      email: email,
      exp: Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60, // 7 days
    };
    const token = await sign(payload, JWT_SECRET, "HS256");

    return c.json({
      message: "Registration successful",
      token,
      user: {
        tgId: updated.tgId,
        name: updated.name,
        email: email,
        theme: updated.theme,
      },
    }, 200);
  });

  app.openapi(loginRoute, async (c) => {
    const { email, password } = c.req.valid("json");

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.hashedPassword) {
      return c.json({ error: "Invalid credentials" }, 401);
    }

    const valid = await bcrypt.compare(password, user.hashedPassword);
    if (!valid) {
      return c.json({ error: "Invalid credentials" }, 401);
    }

    const payload: JwtPayload = {
      tgId: user.tgId,
      email: email,
      exp: Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60,
    };
    const token = await sign(payload, JWT_SECRET, "HS256");

    return c.json({
      token,
      user: {
        tgId: user.tgId,
        name: user.name,
        email: email,
        theme: user.theme,
      },
    }, 200);
  });

  // ==================== JWT Middleware for protected routes ====================

  app.use("/api/v1/expenses/*", jwt({ secret: JWT_SECRET, alg: "HS256" }));
  app.use("/api/v1/user/*", jwt({ secret: JWT_SECRET, alg: "HS256" }));

  // ==================== Expenses ====================

  app.openapi(expenseSummaryRoute, async (c) => {
    const { tgId } = c.get("jwtPayload");
    const now = new Date();

    const [todayExp, weekExp, monthExp] = await Promise.all([
      prisma.expense.findMany({
        where: { tgId, date: { gte: startOfDay(now), lte: endOfDay(now) } },
      }),
      prisma.expense.findMany({
        where: {
          tgId,
          date: {
            gte: startOfWeek(now, { weekStartsOn: 1 }),
            lte: endOfWeek(now, { weekStartsOn: 1 }),
          },
        },
      }),
      prisma.expense.findMany({
        where: {
          tgId,
          date: { gte: startOfMonth(now), lte: endOfMonth(now) },
        },
      }),
    ]);

    const byCategory: Record<string, { total: number; count: number }> = {};
    const byMood: Record<string, number> = {};

    for (const e of monthExp) {
      if (!byCategory[e.category])
        byCategory[e.category] = { total: 0, count: 0 };
      byCategory[e.category].total += e.amount;
      byCategory[e.category].count++;
      if (e.mood) byMood[e.mood] = (byMood[e.mood] || 0) + 1;
    }

    return c.json({
      today: {
        total: todayExp.reduce((s, e) => s + e.amount, 0),
        count: todayExp.length,
      },
      week: {
        total: weekExp.reduce((s, e) => s + e.amount, 0),
        count: weekExp.length,
      },
      month: {
        total: monthExp.reduce((s, e) => s + e.amount, 0),
        count: monthExp.length,
      },
      byCategory,
      byMood,
    }, 200);
  });

  app.openapi(listExpensesRoute, async (c) => {
    const { tgId } = c.get("jwtPayload");
    const query = c.req.valid("query");

    const page = Math.max(1, parseInt(query.page || "1"));
    const limit = Math.min(100, Math.max(1, parseInt(query.limit || "20")));
    const skip = (page - 1) * limit;

    // Build where clause
    const where: Record<string, unknown> = { tgId };
    if (query.category) {
      where.category = { equals: query.category, mode: "insensitive" };
    }
    if (query.startDate || query.endDate) {
      const dateFilter: Record<string, Date> = {};
      if (query.startDate) dateFilter.gte = new Date(query.startDate);
      if (query.endDate) {
        dateFilter.lte = endOfDay(new Date(query.endDate));
      }
      where.date = dateFilter;
    }

    // Build orderBy
    const sortMap: Record<string, { field: string; dir: string }> = {
      date_asc: { field: "date", dir: "asc" },
      date_desc: { field: "date", dir: "desc" },
      amount_asc: { field: "amount", dir: "asc" },
      amount_desc: { field: "amount", dir: "desc" },
    };
    const sortKey = query.sort || "date_desc";
    const sortConfig = sortMap[sortKey] || sortMap.date_desc;
    const orderBy = { [sortConfig.field]: sortConfig.dir };

    const [expenses, total] = await Promise.all([
      prisma.expense.findMany({
        where: where as any,
        orderBy: orderBy as any,
        skip,
        take: limit,
      }),
      prisma.expense.count({ where: where as any }),
    ]);

    return c.json({
      data: expenses.map((e) => ({
        ...e,
        date: e.date.toISOString(),
        createdAt: e.createdAt.toISOString(),
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    }, 200);
  });

  app.openapi(getExpenseRoute, async (c) => {
    const { tgId } = c.get("jwtPayload");
    const { id } = c.req.valid("param");

    const expense = await prisma.expense.findFirst({
      where: { id, tgId },
    });

    if (!expense) {
      return c.json({ error: "Expense not found" }, 404);
    }

    return c.json({
      ...expense,
      date: expense.date.toISOString(),
      createdAt: expense.createdAt.toISOString(),
    }, 200);
  });

  // ==================== User ====================

  app.openapi(getProfileRoute, async (c) => {
    const { tgId } = c.get("jwtPayload");

    const user = await prisma.user.findUnique({ where: { tgId } });
    if (!user) {
      return c.json({ error: "User not found" }, 401);
    }

    return c.json({
      tgId: user.tgId,
      customId: user.customId,
      email: user.email,
      name: user.name,
      theme: user.theme,
      createdAt: user.createdAt.toISOString(),
    }, 200);
  });

  app.openapi(updateProfileRoute, async (c) => {
    const { tgId } = c.get("jwtPayload");
    const body = c.req.valid("json");

    const data: Record<string, string> = {};
    if (body.name !== undefined) data.name = body.name;
    if (body.theme !== undefined) data.theme = body.theme;

    const user = await prisma.user.update({
      where: { tgId },
      data,
    });

    return c.json({
      tgId: user.tgId,
      customId: user.customId,
      email: user.email,
      name: user.name,
      theme: user.theme,
      createdAt: user.createdAt.toISOString(),
    }, 200);
  });

  // ==================== OpenAPI Spec + Scalar Docs ====================

  app.doc("/doc", {
    openapi: "3.1.0",
    info: {
      title: "AturUang API",
      version: "1.0.0",
      description:
        "Public REST API for AturUang expense tracker. Register with your Telegram account, then use JWT tokens to access your expense data.",
    },
    security: [{ Bearer: [] }],
  });

  app.openAPIRegistry.registerComponent("securitySchemes", "Bearer", {
    type: "http",
    scheme: "bearer",
    bearerFormat: "JWT",
    description: "JWT token from /api/v1/auth/login",
  });

  app.get(
    "/reference",
    apiReference({
      theme: "kepler",
      url: "/doc",
      pageTitle: "AturUang API Reference",
    } as any)
  );

  return app;
}
