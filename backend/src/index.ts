import { Elysia } from "elysia";
import { cors } from "@elysiajs/cors";
import { swagger } from "@elysiajs/swagger";
import { errorHandler } from "./middleware/errorHandler";
import { apiRateLimit } from "./middleware/rateLimiter";
import { authRoutes } from "./modules/auth/auth.routes";
import { organizationRoutes } from "./modules/organizations/organizations.routes";

const app = new Elysia()
    // Global plugins
    .use(
        cors({
            origin: process.env.FRONTEND_URL ?? "http://localhost:3000",
            credentials: true,
            allowedHeaders: ["Content-Type", "Authorization"],
            methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        })
    )
    .use(
        swagger({
            documentation: {
                info: { title: "Expense App API", version: "1.0.0" },
            },
        })
    )
    // Global error handler — must be before routes
    .use(errorHandler)
    // Global rate limit for all non-auth routes
    .use(apiRateLimit)

    // Health check
    .get("/health", () => ({ success: true, data: { status: "ok" } }))

    // Routes
    .use(authRoutes)
    .use(organizationRoutes)

    .listen(process.env.PORT ?? 3001);

console.log(`🦊 Backend running at http://localhost:${app.server?.port}`);