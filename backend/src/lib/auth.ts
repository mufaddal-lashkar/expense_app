import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "../db";
import * as schema from "../db/schema";

export const auth = betterAuth({
    database: drizzleAdapter(db, {
        provider: "pg",
        schema: {
            user: schema.users,
            session: schema.sessions,
            account: schema.accounts,
            verification: schema.verifications,
        },
    }),
    user: {
        fields: {
            name: "username",
        },
    },
    secret: process.env.BETTER_AUTH_SECRET!,
    baseURL: process.env.BETTER_AUTH_URL!,
    session: {
        expiresIn: 60 * 60 * 24 * 7,
        updateAge: 60 * 60 * 24,
        cookieCache: {
            enabled: true,
            maxAge: 60 * 5,
        },
        additionalFields: {
            activeOrganizationId: {
                type: "string",
                required: false,
                defaultValue: null,
                input: false,
            },
        },
    },
    password: {
        minLength: 8,
        maxLength: 128,
    },
    trustedOrigins: [process.env.FRONTEND_URL!],
    emailAndPassword: {
        enabled: true,
    },
    advanced: {
        database: {
            generateId: "uuid",
        },
    },
});

export type Auth = typeof auth;