import Elysia from "elysia";
import { db } from "../../db";
import { expenses } from "../../db/schema";
import { eq, and, gte, lte, ne } from "drizzle-orm";
import { ok } from "../../lib/response";
import { Errors } from "../../middleware/errorHandler";
import { requireOrg } from "../../middleware/requireAuth";

const AI_SERVICE_URL = process.env.AI_SERVICE_URL ?? "http://localhost:8000";

// ── AI service response type ───────────────────────────────────────────────────
interface AiServiceResponse {
    is_anomaly: boolean;
    flags: Array<{
        type: string;
        severity: "low" | "medium" | "high";
        message: string;
    }>;
    confidence_score: number;
    recommendation: "approve" | "review" | "reject";
}

export const aiRoutes = new Elysia({ prefix: "/expenses" })
    .use(requireOrg)

    // ─── POST /expenses/:id/analyze ──────────────────────────────────────────────
    .post("/:id/analyze", async ({ params, currentOrgId, currentRole }) => {
        if (currentRole === "employee") throw Errors.forbidden();

        const [expense] = await db
            .select()
            .from(expenses)
            .where(
                and(
                    eq(expenses.id, params.id),
                    eq(expenses.organizationId, currentOrgId) // 🔒 org scope
                )
            )
            .limit(1);

        if (!expense) throw Errors.notFound("Expense");

        // Typed from the start — no unknown
        let aiResult: AiServiceResponse;

        try {
            const response = await fetch(`${AI_SERVICE_URL}/analyze`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    id: expense.id,
                    title: expense.title,
                    amount: Number(expense.amount),
                    currency: expense.currency,
                    category: expense.category,
                    merchant_name: expense.merchantName ?? null,
                    description: expense.description ?? null,
                    organization_id: expense.organizationId,
                }),
                signal: AbortSignal.timeout(35_000), // slightly longer than AI service's 30s
            });

            if (!response.ok) throw new Error(`AI service returned ${response.status}`);

            // cast to known type — we own the AI service so this is safe
            aiResult = await response.json() as AiServiceResponse;

        } catch (e) {
            // AI service down — don't block the user, store a safe fallback
            console.error("[AI] analyze failed:", e);
            aiResult = {
                is_anomaly: false,
                flags: [],
                confidence_score: 0,
                recommendation: "review",
            };
        }

        // Normalize snake_case → camelCase for our DB jsonb field
        const aiFlags = {
            isAnomaly: aiResult.is_anomaly,
            flags: aiResult.flags,
            confidenceScore: aiResult.confidence_score,
            recommendation: aiResult.recommendation,
        };

        await db
            .update(expenses)
            .set({ aiAnalyzed: true, aiFlags, updatedAt: new Date() })
            .where(eq(expenses.id, params.id));

        return ok(aiFlags, "Expense analyzed successfully");
    })

    // GET /expenses/report/stream
    // Fetches org expenses, proxies SSE stream from AI service to frontend
    .get("/report/stream", async ({ query, currentOrgId, currentRole }) => {
        console.log("Here")
        if (currentRole === "employee") throw Errors.forbidden();

        const month = query.month as string | undefined;
        if (!month || !/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
            throw Errors.validation("month query param must be in format YYYY-MM");
        }

        const [year, mon] = month.split("-").map(Number);
        const fromDate = new Date(year!, mon! - 1, 1);
        const toDate = new Date(year!, mon!, 0, 23, 59, 59);

        // Fetch non-draft org expenses for the given month — always scoped to org 
        const monthExpenses = await db
            .select({
                id: expenses.id,
                title: expenses.title,
                amount: expenses.amount,
                currency: expenses.currency,
                category: expenses.category,
                status: expenses.status,
                merchantName: expenses.merchantName,
                aiFlags: expenses.aiFlags,
                createdAt: expenses.createdAt,
            })
            .from(expenses)
            .where(
                and(
                    eq(expenses.organizationId, currentOrgId),
                    ne(expenses.status, "draft"),
                    gte(expenses.createdAt, fromDate),
                    lte(expenses.createdAt, toDate)
                )
            );
        
        console.log("Month Expenses :: ", monthExpenses)

        // Call AI service
        let aiResponse: Response;
        try {
            aiResponse = await fetch(`${AI_SERVICE_URL}/generate-report`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    month,
                    expenses: monthExpenses.map((e) => ({
                        id: e.id,
                        title: e.title,
                        amount: Number(e.amount),
                        currency: e.currency,
                        category: e.category,
                        status: e.status,
                        merchant_name: e.merchantName ?? null,
                        ai_flags: e.aiFlags ?? null,
                    })),
                }),
                signal: AbortSignal.timeout(120_000), // 2 min for full report generation
            });
        } catch (e) {
            throw Errors.internal("AI service is unavailable. Please try again later.");
        }

        if (!aiResponse.ok) {
            throw Errors.internal("AI service failed to generate report.");
        }

        // Proxy the stream body directly
        return new Response(aiResponse.body, {
            headers: {
                "Content-Type": "text/event-stream",
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
            },
        });
    });