# Expense Management System — Project Report
**Author:** Mufaddal Lashkar  
**Date:** March 29, 2026  
**Repository:** [mufaddal-lashkar/expense_app](file:///e:/projects/assignment-projects/expense-app)

---

## B.1 — Architecture Overview

### 1. System Architecture Diagram

```text
                                    +-----------------------+
                                    |       Frontend        |
                                    |   (Next.js + React)   |
                                    +-----------+-----------+
                                                |
                                                | HTTP (REST / JSON)
                                                | SSE (Event Stream)
                                                |
                                    +-----------v-----------+
                                    |        Backend        |
              SQL Queries           |   (Elysia + Drizzle)  |
      +-----------------------------+                       +<------+
      |       (PostgreSQL)          |                       |       |
      |                             +-----------+-----------+       |
      +-------------^---------------+           |                   | REST / JSON
                    |                           | HTTP (REST / JSON)| (Internal)
                    |                           |                   |
                    |               +-----------v-----------+       |
                    |               |      AI Service       |       |
                    +---------------+   (FastAPI + LCEL)    |-------+
                      SQL Queries   |                       |
                                    +-----------------------+
```

### 2. Communication & Protocols
The system is composed of three decoupled services communicating over HTTP.
- **Frontend** (Port 3000) communicates with the **Backend** (Port 3001) via **REST/JSON** for standard CRUD operations and authentication. Real-time report generation uses **SSE (Server-Sent Events)** streaming. All requests include an `Authorization: Bearer <token>` header.
- **Backend** acts as the central orchestrator and gatekeeper. It performs **SQL queries** to a PostgreSQL database via Drizzle ORM.
- **AI Service** (Port 8000) provides heavy-duty compute for expense analysis and report generation. The Backend calls the AI Service via internal **REST/JSON** requests (`fetch`). For report generation, the AI Service returns a streaming response which the Backend proxies directly to the Frontend to maintain a real-time feedback loop.

### 3. Request Lifecycle Walkthroughs

#### Lifecycle 1 — Submitting an Expense
1.  **Frontend**: The user views an expense in `frontend/src/app/(app)/expenses/[id]/page.tsx` and clicks the "Submit for approval" button. This triggers `submitExpense(id)` in the `useExpenseStore` (`frontend/src/store/expenseStore.ts`).
2.  **API**: The store calls `expensesApi.submit(id)` in `frontend/src/lib/api.ts`, which sends a `POST /expenses/:id/submit` request to the backend.
3.  **Backend Middleware**: `backend/src/middleware/requireAuth.ts` derives the session and organization context (`requireOrg`), ensuring the user is authorized.
4.  **Route Handler**: The request hits `backend/src/modules/expenses/expenses.routes.ts` in the `.post("/:id/submit", ...)` handler.
5.  **State Machine**: The code calls `isValidTransition` in `backend/src/modules/expenses/expenses.transitions.ts` to ensure the expense can move from `draft` to `submitted`.
6.  **Database**: Drizzle executes an `.update(expenses)` query in `backend/src/db/schema/expenses.ts`.
7.  **Response**: A `200 OK` response with the updated expense object is returned to the frontend.

#### Lifecycle 2 — Generating a Monthly AI Report
1.  **Frontend Hook**: A manager clicks "Generate Report" in `frontend/src/app/(app)/reports/page.tsx`. This triggers `startStream()` from the `useSSEStream` hook (`frontend/src/hooks/useSSEStream.ts`).
2.  **SSE Call**: The hook initiates a `fetch` request to `backend/api/expenses/report/stream?month=YYYY-MM` with `Accept: text/event-stream`.
3.  **Backend Proxy**: The request is handled by `backend/src/modules/expenses/ai.routes.ts`. The handler fetches all non-draft expenses for the month scoped to `currentOrgId` using Drizzle.
4.  **AI Invocation**: The backend initiates a `fetch` to the AI Service endpoint `POST /generate-report`.
5.  **AI Service**: FastAPI in `ai-service/app/routes/report.py` receives the request and calls `stream_report` in `ai-service/app/agents/reporter.py`.
6.  **LangChain Stream**: The reporter agent uses `llm.astream(messages)` to generate the markdown report in real-time. Chunks are yielded back to the FastAPI route.
7.  **Final Proxy**: The Backend receives the stream and returns a `new Response(aiResponse.body)` with SSE headers, allowing the Frontend to render the markdown character-by-character as it arrives.

---

## B.2 — Key Design Decisions

### 1. Elysia `.derive()` for Context Inversion
- **What I did**: Created a `requireOrg` middleware in `backend/src/middleware/requireAuth.ts` using Elysia's `.derive()` method to pass `currentOrgId`, `currentUser`, and `currentRole` directly into route handlers.
- **Alternatives**: 
    1. Passing a simple `Request` object and parsing the token in every route.
    2. Using a standard global middleware that attaches context to the request object (Express-style).
- **Why I chose this**: `.derive()` provides full TypeScript type safety for the injected properties. It ensures that any route using this middleware *cannot* compile if the context isn't used correctly, eliminating a huge class of multi-tenancy access bugs.
- **Where to see it**: `backend/src/middleware/requireAuth.ts:L35-62`

### 2. Custom fetch-based SSE Stream Hook
- **What I did**: Built `useSSEStream.ts` in the frontend using `ReadableStream` and `getReader()` instead of the standard `EventSource` API.
- **Alternatives**:
    1. Standard browser `EventSource` API.
    2. Socket.io for bi-directional communication.
- **Why I chose this**: `EventSource` does not support custom headers (like `Authorization: Bearer <token>`) natively without hacky workarounds. By using `fetch` with the `text/event-stream` header and manually consuming the `ReadableStream`, I maintained a modern, secure, and robust streaming implementation.
- **Where to see it**: `frontend/src/hooks/useSSEStream.ts:L38-118`

### 3. Proactive Metadata Extraction for AI Reports
- **What I did**: In `ai-service/app/agents/reporter.py`, I pre-process the expense data in Python (calculating total spend, category breakdowns, and flags) *before* sending it to the LLM prompt.
- **Alternatives**:
    1. Passing the raw JSON file of all expenses to the LLM and letting it calculate sums.
    2. Using a LangChain `PandasDataFrameAgent`.
- **Why I chose this**: LLMs are notoriously poor at math and accurately counting items in large lists. By performing the "heavy lifting" of data aggregation in deterministic Python code, the AI generates much more reliable financial reports while saving significantly on token costs.
- **Where to see it**: `ai-service/app/agents/reporter.py:L25-75`

### 4. Zod Schema Composition for Reusability
- **What I did**: Structured `expenses.schemas.ts` using composition. The `createExpenseSchema` is the base, which is then refined and extended for updates and rejections.
- **Alternatives**:
    1. Duplicating fields across multiple separate schemas.
    2. Using raw TypeScript interfaces and manual `if` check validation.
- **Why I chose this**: It ensures a "Single Source of Truth." If a field like `amount` changes its validation rules (e.g., maximum limit), it updates across the entire application (Submit, Update, List filters) simultaneously.
- **Where to see it**: `backend/src/modules/expenses/expenses.schemas.ts:L24-78`

### 5. Multi-store Zustand Slices
- **What I did**: Separated state into `authStore.ts` and `expenseStore.ts`.
- **Alternatives**:
    1. A single massive global store for the entire app.
    2. React Context API for each feature.
- **Why I chose this**: Separating the stores prevents unnecessary re-renders. A change in an expense's status doesn't trigger components listening to the user's organization profile. It makes the codebase easier to debug as state transitions are logically grouped.
- **Where to see it**: `frontend/src/store/` (directory structure)

---

## B.3 — AI Usage Log

### Configuration
#### [Drizzle Migration SQL]
- **AI-assisted or Hand-written:** AI-assisted
- **What was generated/written:** The initial `0000_..._migration.sql` files and schema scaffolding.
- **Prompt used:** "Generate a Drizzle schema for a multi-tenant expense app with users, organizations, and expenses."
- **What was accepted:** Core table structures and relationships.
- **What was modified:** Added custom indexes for `organizationId` and improved enum naming.
- **Why:** To ensure consistency with the backend's naming conventions.

### Backend
#### [requireAuth Middleware]
- **AI-assisted or Hand-written:** Hand-written
- **What was written:** The `.derive()` logic and membership validity checks.
- **Prompt used:** hand-written — no prompt
- **What was accepted:** N/A
- **What was modified:** N/A
- **Why:** This core security logic was too project-specific and sensitive to rely on generic generation.

#### [expenses.transitions.ts]
- **AI-assisted or Hand-written:** Hand-written
- **What was written:** The state machine logic for expense status transitions.
- **Prompt used:** hand-written — no prompt
- **What was accepted:** N/A
- **What was modified:** N/A
- **Why:** This contains the specific RBAC rules for the application.

### Frontend
#### [useSSEStream Hook]
- **AI-assisted or Hand-written:** Hand-written
- **What was written:** Byte-by-byte `TextDecoder` and buffer management for the SSE stream.
- **Prompt used:** hand-written — no prompt
- **What was accepted:** N/A
- **What was modified:** N/A
- **Why:** Standard AI suggestions for SSE usually rely on `EventSource`, which lacks the required Header support.

#### [UI Components (Button, Input, Badge)]
- **AI-assisted or Hand-written:** AI-assisted
- **What was generated:** Accessible TailwindCSS layouts for basic UI primitives.
- **Prompt used:** "Create a reusable Button component in React using Tailwind and Lucide icons."
- **What was accepted:** Most of the CSS classes and structure.
- **What was modified:** Added `isLoading` state and custom glassmorphism variants.
- **Why:** To achieve a premium aesthetic beyond standard Radix/Shadcn defaults.

### AI Service
#### [reporter.py Agent]
- **AI-assisted or Hand-written:** Hand-written
- **What was written:** Data aggregation logic and `astream` generator.
- **Prompt used:** hand-written — no prompt
- **What was accepted:** N/A
- **What was modified:** N/A
- **Why:** Precise data aggregation is required to ensure the LLM doesn't hallucinate numbers.

---

## B.4 — Challenges & Learnings

The hardest part of this project was undoubtedly the **Synchronous Streaming Proxying**. Implementing a real-time AI report isn't just about calling an LLM; it's about chaining a sequence of streams from the AI Service, through the Backend, and into the React state. I had to learn how to handle `ReadableStream` objects in Bun/Elysia and bridge them to the frontend's `TextDecoder` while ensuring that a connection failure in the AI Service didn't hang the entire Backend event loop. This felt like "plumbing for data," where even a small buffer mismatch could cause the entire report to fail rendering.

A concept that truly "clicked" for me was **Identity-Driven Multi-Tenancy**. In previous projects, I had manually added `WHERE organization_id = ?` to every query, which is error-prone. In this project, I leaned heavily into the Elysia middleware pattern. Once I realized I could globally derive the `currentOrgId` and use it as a required parameter in my Drizzle queries, the security of the app felt rock-solid. It simplified the developer experience because I no longer had to "worry" about security in the route handlers; it was enforced by the type system itself.

If I were to start over, I would implement **Edge-based AI Analyzers**. Currently, the AI analysis happens on a separate Python instance. While powerful, it adds latency. For simple anomaly checks (like checking if an amount is a duplicate), I'd move that logic into an Edge Function or a worker within the Backend service itself to speed up the submission feedback loop. I'd also like to add "soft-rejects" where the AI can automatically ask the user for a more readable receipt before the manager even sees it.

---

## B.5 — Self-Assessment: Code Review Checklist

**Security:**
- [x] All database queries filter by `organizationId` ✅ `backend/src/modules/expenses/expenses.routes.ts` (Every query includes `eq(expenses.organizationId, currentOrgId)`)
- [x] Authentication required on all endpoints ✅ `backend/src/index.ts` (Uses `expenseRoutes` and `aiRoutes` which both `.use(requireOrg)`)
- [x] Role checks for manager/admin-only operations ✅ `backend/src/modules/expenses/expenses.routes.ts:L344` (Check role in `/approve`)
- [x] Employees can only access their own expenses ✅ `backend/src/modules/expenses/expenses.routes.ts:L52-55` (Filtering rows by `submittedBy`)
- [x] No hardcoded secrets or API keys ✅ `.env` usage in `backend/src/lib/auth.ts` and `ai-service/app/config.py`.
- [x] Input validation on all user data ✅ `expenses.schemas.ts` (Used in every `.post` and `.patch` route).

**Code Quality:**
- [x] Follows platform patterns from the course ✅ Elysia + Drizzle context pattern.
- [x] Proper error handling (no swallowed errors) ✅ `backend/src/middleware/errorHandler.ts` catches and formats all exceptions.
- [x] No `console.log` in backend (use proper logging) ✅ No console.log in backend.
- [x] TypeScript types are specific (no `any`) ✅ Strict Zod inference used for all route inputs and outputs.
- [x] Async code properly handles errors with try/catch ✅ Visible in `expenseStore.ts` and all AI agent streaming logic.

**Performance:**
- [x] Queries select only needed columns ✅ `backend/src/modules/expenses/expenses.routes.ts:L95-112` (Select block excludes large or sensitive fields).
- [x] No N+1 query patterns ✅ `innerJoin(users, ...)` used in list and detail endpoints.
- [x] Pagination on list endpoints ✅ `backend/src/modules/expenses/expenses.routes.ts:L116` (Uses `.offset()` and `.limit()`).
- [x] Parallel operations where possible ✅ `backend/src/modules/expenses/expenses.routes.ts:L94` (Parallel fetch and count using `Promise.all`).

**Style:**
- [x] Naming follows conventions ✅ CamelCase for TS/JS, snake_case for Python.
- [x] No commented-out or dead code ✅ Clean routes.
- [x] Single responsibility functions ✅ Separation between `routes`, `schemas`, and `transition` logic.
- [x] Logical file organization ✅ Grouped by modules (Authentication, Expenses, Organizations).
