import Elysia from "elysia";
import { rateLimit } from "elysia-rate-limit";
import { err } from "../lib/response";

// Helper to extract IP
const getIP = (req: Request) => {
    const forwarded = req.headers.get("x-forwarded-for");

    if (forwarded) {
        return forwarded.split(",")[0]!.trim();
    }

    return req.headers.get("x-real-ip") ?? "unknown";
};

// Strict limiter for auth endpoints
export const authRateLimit = rateLimit({
    duration: Number(process.env.RATE_LIMIT_WINDOW ?? 60_000),
    max: Number(process.env.RATE_LIMIT_MAX ?? 10),
    generator: (req: Request) => getIP(req), // ✅ correct
    errorResponse: new Response(
        JSON.stringify(
            err("RATE_LIMITED", "Too many requests, please try again later")
        ),
        {
            status: 429,
            headers: { "Content-Type": "application/json" },
        }
    ),
});

// Looser limiter for general API endpoints
export const apiRateLimit = rateLimit({
    duration: 60_000,
    max: 100,
    generator: (req: Request) => getIP(req), // ✅ correct
    errorResponse: new Response(
        JSON.stringify(
            err("RATE_LIMITED", "Too many requests, please try again later")
        ),
        {
            status: 429,
            headers: { "Content-Type": "application/json" },
        }
    ),
});