import { pgTable, uuid, text, timestamp } from "drizzle-orm/pg-core";
import { expenses } from "./expenses";
import { users } from "./users";

export const expenseNotes = pgTable("expense_notes", {
    id: uuid("id").primaryKey().defaultRandom(),
    expenseId: uuid("expense_id").notNull().references(() => expenses.id, { onDelete: "cascade" }),
    userId: uuid("user_id").notNull().references(() => users.id),
    content: text("content").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type ExpenseNote = typeof expenseNotes.$inferSelect;