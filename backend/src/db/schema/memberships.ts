import { pgTable, uuid, timestamp, pgEnum, unique } from "drizzle-orm/pg-core";
import { users } from "./users";
import { organizations } from "./organizations";

export const memberRoleEnum = pgEnum("member_role", ["admin", "manager", "employee"]);

export const memberships = pgTable("memberships", {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
    role: memberRoleEnum("role").notNull().default("employee"),
    joinedAt: timestamp("joined_at").notNull().defaultNow(),
}, (table) => ({
    // a user can only have one membership per org
    uniqueMembership: unique().on(table.userId, table.organizationId),
}));

export type Membership = typeof memberships.$inferSelect;