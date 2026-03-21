import Elysia from "elysia";
import { db } from "../../db";
import { organizations, memberships, invitations, sessions } from "../../db/schema";
import { eq, and } from "drizzle-orm";
import {
    createOrganizationSchema,
    createInviteSchema,
    joinInviteSchema,
} from "./organizations.schemas";
import { ok } from "../../lib/response";
import { Errors } from "../../middleware/errorHandler";
import { sessionMiddleware } from "../../middleware/requireAuth";
import { generateInviteToken, hashToken, inviteExpiresAt } from "../../lib/crypto";
import { authRateLimit } from "../../middleware/rateLimiter";

export const organizationRoutes = new Elysia({ prefix: "/organizations" })
    .use(sessionMiddleware)

    // ─── POST /organizations/create ────────────────────────────────────────────
    .post("/create", async ({ body, session, set }) => {
        if (!session) throw Errors.unauthorized();

        const parsed = createOrganizationSchema.safeParse(body);
        if (!parsed.success) {
            throw Errors.validation(
                "Invalid organization data",
                parsed.error.issues.map((e) => ({ field: e.path.join("."), message: e.message }))
            );
        }

        const { displayName } = parsed.data;
        const name = displayName.toLowerCase().trim();

        const existing = await db.query.organizations.findFirst({
            where: eq(organizations.name, name),
            columns: { id: true },
        });

        if (existing) {
            throw Errors.conflict("An organization with this name already exists");
        }

        // create org
        const org = await db.transaction(async (tx) => {
            const [createdOrg] = await tx
                .insert(organizations)
                .values({ name, displayName })
                .returning();

            // guard the array result before using it
            if (!createdOrg) throw Errors.internal("Failed to create organization");

            await tx.insert(memberships).values({
                userId: session.user.id,
                organizationId: createdOrg.id,
                role: "admin",
            });

            return createdOrg;
        });

        await db
            .update(sessions)
            .set({ activeOrganizationId: org.id })
            .where(eq(sessions.userId, session.user.id));

        set.status = 201;
        return ok(
            {
                organization: {
                    id: org.id,
                    displayName: org.displayName,
                },
                role: "admin",
            },
            "Organization created successfully"
        );
    })

    // ─── POST /organizations/invite ─────────────────────────────────────────────
    .post("/invite", async ({ body, session }) => {
        if (!session) throw Errors.unauthorized();

        const orgId = session.session.activeOrganizationId;
        if (!orgId) {
            throw Errors.forbidden("You must belong to an organization to create invites");
        }

        // find membership
        const [membership] = await db
            .select({ role: memberships.role })
            .from(memberships)
            .where(
                and(
                    eq(memberships.userId, session.user.id),
                    eq(memberships.organizationId, orgId)
                )
            )
            .limit(1);

        if (!membership || membership.role !== "admin") {
            throw Errors.forbidden("Only admins can create invite links");
        }

        const parsed = createInviteSchema.safeParse(body);
        if (!parsed.success) {
            throw Errors.validation(
                "Invalid invite data",
                parsed.error.issues.map((e) => ({ field: e.path.join("."), message: e.message }))
            );
        }

        const { role } = parsed.data;

        const rawToken = generateInviteToken();
        const tokenHash = hashToken(rawToken);
        const expiresAt = inviteExpiresAt();

        await db.insert(invitations).values({
            organizationId: orgId,
            createdBy: session.user.id,
            tokenHash,
            role,
            expiresAt,
        });

        return ok(
            {
                inviteToken: rawToken,
                expiresAt,
                role,
            },
            "Invite link created. Share the token with the new member."
        );
    })

    // ─── POST /organizations/join ───────────────────────────────────────────────
    .use(authRateLimit)
    .post("/join", async ({ body, session, set }) => {
        if (!session) throw Errors.unauthorized();

        const parsed = joinInviteSchema.safeParse(body);
        if (!parsed.success) {
            throw Errors.validation(
                "Invalid invite token",
                parsed.error.issues.map((e) => ({ field: e.path.join("."), message: e.message }))
            );
        }

        const { token } = parsed.data;
        const tokenHash = hashToken(token);

        // find invitation 
        const [inviteRow] = await db
            .select({
                id: invitations.id,
                organizationId: invitations.organizationId,
                role: invitations.role,
                expiresAt: invitations.expiresAt,
                usedAt: invitations.usedAt,
                displayName: organizations.displayName,
            })
            .from(invitations)
            .innerJoin(organizations, eq(invitations.organizationId, organizations.id))
            .where(eq(invitations.tokenHash, tokenHash))
            .limit(1);

        if (!inviteRow) {
            throw Errors.notFound("Invite");
        }

        if (inviteRow.usedAt !== null) {
            throw Errors.inviteUsed();
        }

        if (new Date() > inviteRow.expiresAt) {
            throw Errors.inviteExpired();
        }

        const [existingMembership] = await db
            .select({ id: memberships.id })
            .from(memberships)
            .where(
                and(
                    eq(memberships.userId, session.user.id),
                    eq(memberships.organizationId, inviteRow.organizationId)
                )
            )
            .limit(1);

        if (existingMembership) {
            throw Errors.conflict("You are already a member of this organization");
        }

        // create new membership
        const newMembership = await db.transaction(async (tx) => {
            await tx
                .update(invitations)
                .set({ usedAt: new Date() })
                .where(eq(invitations.id, inviteRow.id));

            const [created] = await tx
                .insert(memberships)
                .values({
                    userId: session.user.id,
                    organizationId: inviteRow.organizationId,
                    role: inviteRow.role,
                })
                .returning();

            if (!created) throw Errors.internal("Failed to join organization");

            return created;
        });

        await db
            .update(sessions)
            .set({ activeOrganizationId: inviteRow.organizationId })
            .where(eq(sessions.userId, session.user.id));

        set.status = 200;
        return ok(
            {
                organization: {
                    id: inviteRow.organizationId,
                    displayName: inviteRow.displayName,
                },
                role: newMembership.role,
            },
            `Successfully joined ${inviteRow.displayName}`
        );
    });