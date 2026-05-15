import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router, protectedProcedure } from "./_core/trpc";
import { z } from "zod";
import { getDb } from "./db";
import { clients, quotas, activities } from "../drizzle/schema";
import { eq, like, desc, and } from "drizzle-orm";

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

  dashboard: router({
    metrics: protectedProcedure.query(async () => {
      const db = await getDb();
      if (!db) return { totalClients: 0, todayReturns: 0, overdueReturns: 0, completedReturns: 0 };

      try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const allClients = await db.select().from(clients);
        const allQuotas = await db.select().from(quotas);

        const todayReturns = allQuotas.filter((q: any) => {
          if (!q.returnDate || q.isCompleted) return false;
          const returnDate = new Date(q.returnDate);
          returnDate.setHours(0, 0, 0, 0);
          return returnDate.getTime() === today.getTime();
        }).length;

        const overdueReturns = allQuotas.filter((q: any) => {
          if (!q.returnDate || q.isCompleted) return false;
          const returnDate = new Date(q.returnDate);
          return returnDate < today;
        }).length;

        const completedReturns = allQuotas.filter((q: any) => q.isCompleted).length;

        return {
          totalClients: allClients.length,
          todayReturns,
          overdueReturns,
          completedReturns,
        };
      } catch (error) {
        console.error("Error calculating metrics:", error);
        return { totalClients: 0, todayReturns: 0, overdueReturns: 0, completedReturns: 0 };
      }
    }),
  }),

  clients: router({
    list: protectedProcedure
      .input(z.object({
        search: z.string().optional(),
        limit: z.number().default(50),
        offset: z.number().default(0),
      }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return [];

        const query = db.select().from(clients);
        if (input.search) {
          return query.where(like(clients.name, `%${input.search}%`)).limit(input.limit).offset(input.offset);
        }
        return query.limit(input.limit).offset(input.offset);
      }),

    getById: protectedProcedure
      .input(z.number())
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return null;
        const result = await db.select().from(clients).where(eq(clients.id, input));
        return result.length > 0 ? result[0] : null;
      }),

    get360: protectedProcedure
      .input(z.number())
      .query(async ({ input: clientId }) => {
        const db = await getDb();
        if (!db) return null;

        const client = await db.select().from(clients).where(eq(clients.id, clientId));
        if (client.length === 0) return null;

        const clientQuotas = await db.select().from(quotas).where(eq(quotas.clientId, clientId));
        const clientActivities = await db.select().from(activities)
          .where(eq(activities.clientId, clientId))
          .orderBy(desc(activities.createdAt));

        return {
          client: client[0],
          quotas: clientQuotas,
          activities: clientActivities,
        };
      }),

    create: protectedProcedure
      .input(z.object({
        name: z.string(),
        phone: z.string(),
        email: z.string(),
        address: z.string(),
        importantInfo: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        return db.insert(clients).values(input);
      }),

    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().optional(),
        phone: z.string().optional(),
        email: z.string().optional(),
        address: z.string().optional(),
        importantInfo: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        const { id, ...data } = input;
        return db.update(clients).set(data).where(eq(clients.id, id));
      }),

    delete: protectedProcedure
      .input(z.number())
      .mutation(async ({ input: clientId }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        return db.delete(clients).where(eq(clients.id, clientId));
      }),
  }),

  quotas: router({
    listByClient: protectedProcedure
      .input(z.number())
      .query(async ({ input: clientId }) => {
        const db = await getDb();
        if (!db) return [];
        return db.select().from(quotas).where(eq(quotas.clientId, clientId));
      }),

    getById: protectedProcedure
      .input(z.number())
      .query(async ({ input: quotaId }) => {
        const db = await getDb();
        if (!db) return null;
        const result = await db.select().from(quotas).where(eq(quotas.id, quotaId));
        return result.length > 0 ? result[0] : null;
      }),

    create: protectedProcedure
      .input(z.object({
        clientId: z.number(),
        group: z.string(),
        quotaNumber: z.string(),
        contactReason: z.string().optional(),
        lastContactDate: z.string().optional(),
        returnDate: z.string().optional(),
        generalObservations: z.string().optional(),
        thayneCheck: z.boolean().optional(),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        return db.insert(quotas).values({
          ...input,
          lastContactDate: input.lastContactDate ? new Date(input.lastContactDate) : null,
          returnDate: input.returnDate ? new Date(input.returnDate) : null,
          thayneCheck: input.thayneCheck || false,
        });
      }),

    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        group: z.string().optional(),
        quotaNumber: z.string().optional(),
        contactReason: z.string().optional(),
        lastContactDate: z.string().optional(),
        returnDate: z.string().optional(),
        isCompleted: z.boolean().optional(),
        generalObservations: z.string().optional(),
        thayneCheck: z.boolean().optional(),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        const { id, ...data } = input;
        const updateData: any = { ...data };
        if (data.lastContactDate) updateData.lastContactDate = new Date(data.lastContactDate);
        if (data.returnDate) updateData.returnDate = new Date(data.returnDate);
        return db.update(quotas).set(updateData).where(eq(quotas.id, id));
      }),

    delete: protectedProcedure
      .input(z.number())
      .mutation(async ({ input: quotaId }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        return db.delete(quotas).where(eq(quotas.id, quotaId));
      }),

    toggleComplete: protectedProcedure
      .input(z.number())
      .mutation(async ({ input: quotaId }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        const quota = await db.select().from(quotas).where(eq(quotas.id, quotaId));
        if (quota.length === 0) throw new Error("Quota not found");
        return db.update(quotas).set({ isCompleted: !quota[0].isCompleted }).where(eq(quotas.id, quotaId));
      }),
  }),

  activities: router({
    listByClient: protectedProcedure
      .input(z.number())
      .query(async ({ input: clientId }) => {
        const db = await getDb();
        if (!db) return [];
        return db.select().from(activities)
          .where(eq(activities.clientId, clientId))
          .orderBy(desc(activities.createdAt));
      }),

    create: protectedProcedure
      .input(z.object({
        clientId: z.number(),
        quotaId: z.number().optional(),
        type: z.enum(["contact", "update", "completion", "note"]),
        description: z.string(),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        return db.insert(activities).values(input);
      }),
  }),
});

export type AppRouter = typeof appRouter;
