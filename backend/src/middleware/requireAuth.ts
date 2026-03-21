import Elysia from "elysia";
import { auth } from "../lib/auth";
import { db } from "../db";
import { memberships } from "../db/schema";
import { eq, and } from "drizzle-orm";
import { Errors } from "./errorHandler";

// Derive session once and share across all routes via .use()
export const sessionMiddleware = new Elysia({ name: "session" }).derive(
    { as: "global" },
    async ({ request }) => {
        const session = await auth.api.getSession({ headers: request.headers });

        return {
            // null when unauthenticated — routes decide whether to throw
            session: session ?? null,
        };
    }
);

// Guard: must be logged in
export const requireAuth = new Elysia({ name: "require-auth" })
    .use(sessionMiddleware)
    .macro({
        mustBeAuth: (enabled: boolean) => ({
            beforeHandle({ session }: { session: Awaited<ReturnType<typeof auth.api.getSession>> | null }) {
                if (enabled && !session) {
                    throw Errors.unauthorized();
                }
            },
        }),
    });

// Guard: must be logged in AND have an active org in session
export const requireOrg = new Elysia({ name: "require-org" })
    .use(sessionMiddleware)
    .derive({ as: "global" }, async ({ session }) => {
        if (!session) throw Errors.unauthorized();

        const orgId = session.session.activeOrganizationId;
        if (!orgId) {
            throw Errors.forbidden("You must belong to an organization to access this resource");
        }

        // Confirm membership still exists (could have been removed)
        const membership = await db.query.memberships.findFirst({
            where: and(
                eq(memberships.userId, session.user.id),
                eq(memberships.organizationId, orgId)
            ),
        });

        if (!membership) {
            throw Errors.forbidden("You are not a member of this organization");
        }

        return {
            currentUser: session.user,
            currentOrgId: orgId,
            currentRole: membership.role,
        };
    });

// Guard: role-level check — use after requireOrg
export function requireRole(...allowedRoles: Array<"admin" | "manager" | "employee">) {
    return new Elysia({ name: `require-role-${allowedRoles.join("-")}` })
        .use(requireOrg)
        .macro({
            checkRole: (enabled: boolean) => ({
                beforeHandle({ currentRole }: { currentRole: string }) {
                    if (enabled && !allowedRoles.includes(currentRole as "admin" | "manager" | "employee")) {
                        throw Errors.forbidden();
                    }
                },
            }),
        });
}