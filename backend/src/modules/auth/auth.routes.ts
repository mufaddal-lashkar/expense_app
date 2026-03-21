import Elysia from "elysia";
import { db } from "../../db";
import { users, sessions, memberships, organizations } from "../../db/schema";
import { eq, or, and } from "drizzle-orm";
import { signupSchema, loginSchema } from "./auth.schemas";
import { auth } from "../../lib/auth";
import { ok, err } from "../../lib/response";
import { Errors } from "../../middleware/errorHandler";
import { authRateLimit } from "../../middleware/rateLimiter";
import { sessionMiddleware } from "../../middleware/requireAuth";

export const authRoutes = new Elysia({ prefix: "/auth" })
    .use(authRateLimit)
    .use(sessionMiddleware)

    .post("/signup", async ({ body, set }) => {
        const parsed = signupSchema.safeParse(body);
        if (!parsed.success) {
            throw Errors.validation(
                "Invalid signup data",
                parsed.error.issues.map((e) => ({ field: e.path.join("."), message: e.message }))
            );
        }

        const { email, username, password } = parsed.data;

        const existing = await db.query.users.findFirst({
            where: or(eq(users.email, email), eq(users.username, username)),
            columns: { email: true, username: true },
        });

        if (existing) {
            if (existing.email === email) {
                throw Errors.conflict("An account with this email already exists");
            }
            throw Errors.conflict("This username is already taken");
        }

        const newUser = await auth.api.signUpEmail({
            body: { email, password, name: username },
        });

        if (!newUser) throw Errors.internal("Failed to create account");

        set.status = 201;
        return ok({ userId: newUser.user.id }, "Account created successfully. Please log in.");
    })

    .post("/login", async ({ body, request, set }) => {
        const parsed = loginSchema.safeParse(body);
        if (!parsed.success) {
            throw Errors.validation(
                "Invalid login data",
                parsed.error.issues.map((e) => ({ field: e.path.join("."), message: e.message }))
            );
        }

        const { email, password } = parsed.data;

        // asResponse: true returns a Response object containing the Set-Cookie headers
        const response = await auth.api.signInEmail({
            body: { email, password },
            headers: request.headers,
            asResponse: true,
        });

        if (!response.ok) {
            set.status = 401;
            return err("UNAUTHORIZED", "Invalid email or password");
        }

        // Forward BetterAuth's Set-Cookie header to our response
        const setCookieHeader = response.headers.get("Set-Cookie");
        if (setCookieHeader) {
            set.headers["Set-Cookie"] = setCookieHeader;
        }

        // The response body contains the user and token data
        const responseData = await response.json() as {
            user: {
                id: string;
                email: string;
                name: string;
                [key: string]: unknown;
            };
            token: string;
        };
        const { user, token } = responseData;

        if (!user || !token) {
             throw Errors.internal("Failed to retrieve session data from response");
        }

        const [membershipRow] = await db
            .select({
                membershipId: memberships.id,
                organizationId: memberships.organizationId,
                role: memberships.role,
                displayName: organizations.displayName,
            })
            .from(memberships)
            .innerJoin(organizations, eq(memberships.organizationId, organizations.id))
            .where(eq(memberships.userId, user.id))
            .limit(1);

        if (membershipRow) {
            await db
                .update(sessions)
                .set({ activeOrganizationId: membershipRow.organizationId })
                .where(eq(sessions.token, token));
        }

        set.status = 200;
        return ok(
            {
                user: {
                    id: user.id,
                    email: user.email,
                    username: user.name,
                },
                organization: membershipRow
                    ? {
                        id: membershipRow.organizationId,
                        displayName: membershipRow.displayName,
                        role: membershipRow.role,
                    }
                    : null,
            },
            "Logged in successfully"
        );
    })

    .post("/logout", async ({ request, session, set }) => {
        if (!session) {
            set.status = 200;
            return ok(null, "Already logged out");
        }

        const response = await auth.api.signOut({ 
            headers: request.headers,
            asResponse: true 
        });

        const setCookieHeader = response.headers.get("Set-Cookie");
        if (setCookieHeader) {
            set.headers["Set-Cookie"] = setCookieHeader;
        }

        set.status = 200;
        return ok(null, "Logged out successfully");
    })

    .get("/me", async ({ session, set }) => {
        if (!session) {
            set.status = 401;
            return err("UNAUTHORIZED", "Not authenticated");
        }

        let orgData = null;

        if (session.session.activeOrganizationId) {
            const [row] = await db
                .select({
                    organizationId: memberships.organizationId,
                    role: memberships.role,
                    displayName: organizations.displayName,
                })
                .from(memberships)
                .innerJoin(organizations, eq(memberships.organizationId, organizations.id))
                .where(
                    and(
                        eq(memberships.userId, session.user.id),
                        eq(memberships.organizationId, session.session.activeOrganizationId)
                    )
                )
                .limit(1);

            if (row) {
                orgData = {
                    id: row.organizationId,
                    displayName: row.displayName,
                    role: row.role,
                };
            }
        }

        return ok({
            user: {
                id: session.user.id,
                email: session.user.email,
                username: session.user.name,
            },
            organization: orgData,
        });
    });