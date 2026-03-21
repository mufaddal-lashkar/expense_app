import { pgTable, uuid, text, timestamp } from "drizzle-orm/pg-core";
import { organizations } from "./organizations";
import { users } from "./users";
import { memberRoleEnum } from "./memberships";

export const invitations = pgTable("invitations", {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
    createdBy: uuid("created_by").notNull().references(() => users.id),
    tokenHash: text("token_hash").notNull().unique(),
    role: memberRoleEnum("role").notNull().default("employee"),
    expiresAt: timestamp("expires_at").notNull(),
    usedAt: timestamp("used_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type Invitation = typeof invitations.$inferSelect;