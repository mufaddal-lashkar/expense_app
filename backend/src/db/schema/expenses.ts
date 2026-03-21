import { pgTable, uuid, text, numeric, timestamp, pgEnum, jsonb, boolean } from "drizzle-orm/pg-core";
import { users } from "./users";
import { organizations } from "./organizations";

export const expenseCategoryEnum = pgEnum("expense_category", [
    "travel", "meals", "accommodation", "software", "hardware", "office", "marketing", "training", "other"
]);

export const expenseStatusEnum = pgEnum("expense_status", [
    "draft", "submitted", "approved", "rejected", "reimbursed"
]);

export const expenses = pgTable("expenses", {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
    submittedBy: uuid("submitted_by").notNull().references(() => users.id),
    title: text("title").notNull(),
    description: text("description"),
    amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
    currency: text("currency").notNull().default("USD"),
    category: expenseCategoryEnum("category").notNull(),
    status: expenseStatusEnum("status").notNull().default("draft"),
    merchantName: text("merchant_name"),
    receiptUrl: text("receipt_url"),            // required if amount > threshold
    // AI fields
    aiAnalyzed: boolean("ai_analyzed").notNull().default(false),
    aiFlags: jsonb("ai_flags"),                 // structured anomaly data from AI service
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type Expense = typeof expenses.$inferSelect;
export type NewExpense = typeof expenses.$inferInsert;