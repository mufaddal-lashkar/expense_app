import { pgTable, uuid, text, timestamp } from "drizzle-orm/pg-core";

export const organizations = pgTable("organizations", {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull().unique(),
    displayName: text("display_name").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type Organization = typeof organizations.$inferSelect;
export type NewOrganization = typeof organizations.$inferInsert;