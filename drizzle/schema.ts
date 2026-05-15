import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, date, boolean } from "drizzle-orm/mysql-core";
import { relations } from "drizzle-orm";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// Clientes (Customers)
export const clients = mysqlTable("clients", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  phone: varchar("phone", { length: 20 }).notNull(),
  email: varchar("email", { length: 320 }).notNull(),
  address: text("address").notNull(),
  importantInfo: text("importantInfo"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Client = typeof clients.$inferSelect;
export type InsertClient = typeof clients.$inferInsert;

// Cotas (Quotas) - Relação um-para-muitos com clientes
export const quotas = mysqlTable("quotas", {
  id: int("id").autoincrement().primaryKey(),
  clientId: int("clientId").notNull(),
  group: varchar("group", { length: 100 }).notNull(),
  quotaNumber: varchar("quotaNumber", { length: 100 }).notNull(),
  contactReason: text("contactReason"),
  lastContactDate: date("lastContactDate"),
  returnDate: date("returnDate"),
  isCompleted: boolean("isCompleted").default(false).notNull(),
  generalObservations: text("generalObservations"),
  thayneCheck: boolean("thayneCheck").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Quota = typeof quotas.$inferSelect;
export type InsertQuota = typeof quotas.$inferInsert;

// Histórico de Atividades
export const activities = mysqlTable("activities", {
  id: int("id").autoincrement().primaryKey(),
  clientId: int("clientId").notNull(),
  quotaId: int("quotaId"),
  type: mysqlEnum("type", ["contact", "update", "completion", "note"]).notNull(),
  description: text("description").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Activity = typeof activities.$inferSelect;
export type InsertActivity = typeof activities.$inferInsert;

// Relações
export const clientsRelations = relations(clients, ({ many }) => ({
  quotas: many(quotas),
  activities: many(activities),
}));

export const quotasRelations = relations(quotas, ({ one, many }) => ({
  client: one(clients, {
    fields: [quotas.clientId],
    references: [clients.id],
  }),
  activities: many(activities),
}));

export const activitiesRelations = relations(activities, ({ one }) => ({
  client: one(clients, {
    fields: [activities.clientId],
    references: [clients.id],
  }),
  quota: one(quotas, {
    fields: [activities.quotaId],
    references: [quotas.id],
  }),
}));