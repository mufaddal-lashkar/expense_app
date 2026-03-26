import Elysia from "elysia";
import { db } from "../../db";
import { expenses } from "../../db/schema";
import { eq, and } from "drizzle-orm";
import { ok } from "../../lib/response";
import { Errors } from "../../middleware/errorHandler";
import { requireOrg } from "../../middleware/requireAuth";

const AI_SERVICE_URL = process.env.AI_SERVICE_URL ?? "http://localhost:8000";

export const aiRoutes = new Elysia({ prefix: "/expenses" })
    .use(requireOrg)

    // POST /expenses/:id/analyze
    .post("/:id/analyze", async ({ params, currentOrgId, currentRole }) => {
        if (currentRole === "employee") throw Errors.forbidden();

        const [expense] = await db
            .select()
            .from(expenses)
            .where(
                and(
                    eq(expenses.id, params.id),
                    eq(expenses.organizationId, currentOrgId)
                )
            )
            .limit(1);

        if (!expense) throw Errors.notFound("Expense");

        // ── Mocked response — replace with real fetch once AI service is built ──
        const mockAiResponse = {
            isAnomaly: false,
            flags: [],
            confidenceScore: 0.95,
            recommendation: "approve" as const,
        };

        // TODO: replace mock with real call
        // const response = await fetch(`${AI_SERVICE_URL}/analyze`, {
        //   method: "POST",
        //   headers: { "Content-Type": "application/json" },
        //   body: JSON.stringify({
        //     id: expense.id,
        //     title: expense.title,
        //     amount: expense.amount,
        //     category: expense.category,
        //     merchantName: expense.merchantName,
        //     description: expense.description,
        //   }),
        // });
        // if (!response.ok) throw Errors.internal("AI service unavailable");
        // const aiResult = await response.json();

        // Update expense with AI flags
        await db
            .update(expenses)
            .set({
                aiAnalyzed: true,
                aiFlags: mockAiResponse,
                updatedAt: new Date(),
            })
            .where(eq(expenses.id, params.id));

        return ok(mockAiResponse, "Expense analyzed successfully");
    })

    // ─── GET /expenses/report/stream ─────────────────────────────────────────────
    // Proxies SSE stream from AI service for monthly report
    .get("/report/stream", async ({ query, currentOrgId, currentRole, set }) => {
        // 🔒 Only manager or admin
        if (currentRole === "employee") throw Errors.forbidden();

        const month = query.month as string | undefined;
        if (!month || !/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
            throw Errors.validation("month query param must be in format YYYY-MM");
        }

        // Fetch all org expenses for the given month — scoped to org 🔒
        const [year, mon] = month.split("-").map(Number);
        const from = new Date(year!, mon! - 1, 1);
        const to = new Date(year!, mon!, 0, 23, 59, 59);

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
                    eq(expenses.organizationId, currentOrgId), // 🔒
                    eq(expenses.status, "approved")
                )
            );

        // ── Mocked SSE stream — replace with real proxy once AI service is built ──
        const mockChunks = [
            "## Monthly Expense Report\n\n",
            `**Period:** ${month}\n\n`,
            `**Total Expenses:** ${monthExpenses.length}\n\n`,
            "### Summary\n\n",
            "Analysis complete. No anomalies detected.\n",
        ];

        set.headers["Content-Type"] = "text/event-stream";
        set.headers["Cache-Control"] = "no-cache";
        set.headers["Connection"] = "keep-alive";

        // TODO: replace mock stream with real AI service proxy
        // const aiResponse = await fetch(`${AI_SERVICE_URL}/generate-report`, {
        //   method: "POST",
        //   headers: { "Content-Type": "application/json" },
        //   body: JSON.stringify({ expenses: monthExpenses, month }),
        // });
        // return aiResponse.body; // proxy the stream directly

        return new Response(
            new ReadableStream({
                async start(controller) {
                    for (const chunk of mockChunks) {
                        controller.enqueue(
                            new TextEncoder().encode(`data: ${JSON.stringify({ text: chunk, done: false })}\n\n`)
                        );
                        await new Promise((r) => setTimeout(r, 100)); // simulate streaming delay
                    }
                    controller.enqueue(
                        new TextEncoder().encode(`data: ${JSON.stringify({ text: "", done: true })}\n\n`)
                    );
                    controller.close();
                },
            }),
            {
                headers: {
                    "Content-Type": "text/event-stream",
                    "Cache-Control": "no-cache",
                    Connection: "keep-alive",
                },
            }
        );
    });