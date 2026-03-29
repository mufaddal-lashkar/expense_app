# AI-Powered Multi-Tenant Expense Management System

A comprehensive, enterprise-ready expense management platform featuring multi-tenancy, Role-Based Access Control (RBAC), AI-driven anomaly detection, and real-time streaming reports.

## Core Features
- **Multi-Tenancy**: Complete data isolation between organizations using context-aware middleware.
- **AI Anomaly Detection**: Automated analysis of expenses for potential fraud or policy violations using LangChain and Llama 3.
- **Streaming Reports**: Real-time monthly financial summaries generated via AI and streamed to the browser using Server-Sent Events (SSE).
- **Secure Authentication**: Robust session management and RBAC (Admin, Manager, Employee) powered by BetterAuth.

---

## 🛠️ Prerequisites
- **Database**: PostgreSQL (Running locally or via Docker)
- **Runtime**: [Bun](https://bun.sh/) (for Backend), [Node.js 20+](https://nodejs.org/) (for Frontend)
- **AI Runtime**: [Python 3.11+](https://www.python.org/)
- **API Keys**: A [Groq API Key](https://console.groq.com/) for the AI service.

---

## 🚀 Local Setup

### 1. Database Setup
Ensure PostgreSQL is running and create a database named `expense_app`.

```bash
# Example psql command
psql -U postgres -c "CREATE DATABASE expense_app;"
```

### 2. Backend Service (Elysia + Drizzle)
The backend handles authentication, business logic, and database orchestration.

```bash
cd backend
bun install

# Setup environment
# Edit .env with your DATABASE_URL and BETTER_AUTH_SECRET
cp .env.example .env 

# Push database schema
bun x drizzle-kit push

# Start the server
bun src/index.ts
```
*Backend runs on `http://localhost:3001`*

### 3. AI Service (FastAPI + LangChain)
The AI service performs expensive computations like anomaly detection and report generation.

```bash
cd ai-service
python -m venv .venv

# Windows
.\.venv\Scripts\activate
# macOS/Linux
source .venv/bin/activate

pip install -e .

# Setup environment
# Add your GROQ_API_KEY to .env
cp .env.example .env

# Start the service
python app/main.py
```
*AI service runs on `http://localhost:8000`*

### 4. Frontend Application (Next.js)
The modern React UI for employees and managers.

```bash
cd frontend
bun install # or npm install

# Start development server
bun run dev
```
*Frontend runs on `http://localhost:3000`*

---

## 🧪 Service Communication
- **Frontend** → **Backend** (REST/SSE on Port 3001)
- **Backend** → **AI Service** (Internal REST on Port 8000)
- **Backend** → **PostgreSQL** (SQL via Drizzle)