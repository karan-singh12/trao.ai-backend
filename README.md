# Trao.ai — Backend Service & Intelligent AI Engine

> **Full-Stack AI Interview Preparation Platform (`FS-AI-INTERVIEW-01`)**  
> Built with **Node.js**, **Express 5**, **TypeScript**, and **MongoDB**. Features an Autonomous Web Research Crawler, Deterministic Mathematical Scheduling, Closed-Loop Requirement Auditing, and Multi-Provider LLM Routing.

[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue.svg)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org/)
[![MongoDB](https://img.shields.io/badge/MongoDB-Mongoose-brightgreen.svg)](https://mongoosejs.com/)
[![Tests](https://img.shields.io/badge/Tests-45%20Passing%20(100%25)-success.svg)]()
[![Appendix A](https://img.shields.io/badge/Schema-Appendix%20A%20Compliant-purple.svg)]()

---

## 📑 Table of Contents
1. [Core Architectural Philosophy & Invariants](#-core-architectural-philosophy--invariants)
2. [Deep Dive 1: "The Hardest State Problem" (The Builder)](#-deep-dive-1-the-hardest-state-problem-the-builder)
3. [Deep Dive 2: Deterministic Arithmetic Schedule Engine](#-deep-dive-2-deterministic-arithmetic-schedule-engine)
4. [Deep Dive 3: The Second Pass Coverage Feedback Loop](#-deep-dive-3-the-second-pass-coverage-feedback-loop)
5. [Deep Dive 4: Intelligent Model Routing & Multi-Provider Architecture](#-deep-dive-4-intelligent-model-routing--multi-provider-architecture)
6. [Deep Dive 5: Autonomous Web Crawler & SSRF Defense](#-deep-dive-5-autonomous-web-crawler--ssrf-defense)
7. [Full 9-Stage Sequenced Pipeline](#-full-9-stage-sequenced-pipeline)
8. [API Reference & Endpoint Contracts](#-api-reference--endpoint-contracts)
9. [Headless Batch Evaluation CLI (Appendix B)](#-headless-batch-evaluation-cli-appendix-b)
10. [Automated Test Suite (45 Passing Tests)](#-automated-test-suite-45-passing-tests)
11. [Quick Start & Local Setup](#-quick-start--local-setup)

---

## 🏛️ Core Architectural Philosophy & Invariants

Trao's engineering assessment specifically evaluates **architectural judgment**:
- **What we delegated to LLMs**: Natural language comprehension, company culture synthesis, question rubric phrasing, and active-recall explanations.
- **What we strictly refused to let LLMs decide**: Calendar arithmetic, day counts, study durations, schema invariants, and requirement coverage checking.

### Non-Negotiable Engineering Invariants
| Invariant | Our Production Implementation | What We Strictly Avoided |
| :--- | :--- | :--- |
| **No Single-Prompt Monoliths** | Discrete 9-stage sequenced pipeline where each stage's validated output feeds the next stage. | Relying on a giant single prompt to generate an entire kit at once. |
| **Pure Code Determinism** | Scheduling, integer minutes, and gap-detection math are executed strictly in pure TypeScript (`ScheduleEngine`, `CoverageEngine`). | Asking the LLM to calculate day allocations or check its own coverage. |
| **Zero Hallucination Grounding** | JDs are parsed strictly for explicit mentions. 2-line stubs extract only literal text. Unreachable URLs gracefully degrade without inventing corporate facts. | Hallucinating unmentioned frameworks, years of experience, or fake company histories. |
| **Lossless User State** | User custom edits, pinned cards, and hand-crafted questions permanently survive category regenerations. | Overwriting user edits when refreshing a category. |

---

## 🧠 Deep Dive 1: "The Hardest State Problem" (The Builder)

### The Problem
In **The Builder**, candidates customize their prep kit: editing question text, tuning answer outlines, reordering items, or pinning must-review questions. When the candidate subsequently clicks **"Regenerate Technical"** (`POST /api/kit/:id/regenerate` with `{ category: 'technical' }`), naive AI systems wipe out manual edits or duplicate IDs.

### State Tracking & Provenance
Every question entity in the schema carries explicit provenance flags:
```typescript
export interface Question {
  id: string;                      // Stable sequential ID (e.g. 'q1', 'q2')
  requirement_ids: string[];       // Foreign key references to role.requirements
  category: 'technical' | 'system-design' | 'behavioural' | 'company-fit';
  prompt: string;
  answer_outline: string;
  difficulty: 1 | 2 | 3;           // Strictly integer 1, 2, or 3
  isEdited?: boolean;              // Set to true if candidate customized prompt/outline
  isPinned?: boolean;              // Set to true if candidate locked/pinned the card
  isCustom?: boolean;              // Set to true if user hand-authored the card
}
```

### The Partitioning & Preservation Algorithm
When a category regeneration is triggered, `RegeneratorService` executes mathematical set partitioning:

$$\text{Preserved} = \{ q \in \text{Category} \mid q.\text{isPinned} \lor q.\text{isEdited} \lor q.\text{isCustom} \}$$
$$\text{Refreshed} = \{ q \in \text{Category} \mid \neg q.\text{isPinned} \land \neg q.\text{isEdited} \land \neg q.\text{isCustom} \}$$

```
Existing Question Bank
├── Unrelated Categories (behavioural, system-design) ────────► [100% UNTOUCHED]
└── Target Category ('technical')
    ├── Pinned / Edited / Custom (Preserved) ─────────────────► [LOCKED IN PLACE]
    └── Default / Untouched (Refreshed) ──────────────────────► [TARGETED LLM RE-SYNTHESIS]
                                                                        │
                                                                        ▼
                                                         [Deterministic Re-Merge]
                                                                        │
                                                                        ▼
                                                       [Re-Audit Coverage & Schedule]
```

1. **Category Isolation**: Questions belonging to other categories ($\text{category} \neq \text{target}$) are never modified.
2. **Lossless Preservation**: Pinned, edited, and custom questions in the target category retain their exact text, difficulty, and user modifications.
3. **Targeted Fresh Synthesis**: Fresh questions are generated specifically for the requirements linked to unpinned items.
4. **Deterministic Post-Audit**:
   - `CoverageEngine` immediately re-computes coverage to guarantee must-have requirements remain 100% covered.
   - `ScheduleEngine` re-allocates the schedule across the exact $N$ days without altering candidate availability.

---

## ⏱️ Deep Dive 2: Deterministic Arithmetic Schedule Engine

### Why NOT an LLM for Scheduling?
LLMs consistently fail at temporal arithmetic: they produce float minutes (e.g., $18.33$ mins), skip days, drift from the requested duration (producing 4 or 6 days instead of 5), or miss critical requirements. 

In Trao.ai, scheduling is **100% pure TypeScript deterministic mathematics** in `ScheduleEngine.ts`.

### Core Scheduling Algorithms

#### 1. Exact $N$-Day Invariant
$$\text{schedule.days.length} \equiv \text{schedule.days\_available}$$
Whether the user requests $1$ day, $5$ days, or $60$ days, the engine deterministically allocates exactly $N$ day objects.

#### 2. Harder-First Pacing Priority
Questions are deterministically ranked prior to day assignment using a composite priority score:
1. **Must-Have Requirements** are scheduled before Nice-To-Have requirements.
2. **Difficulty Level**: Harder questions ($L3 \rightarrow L2 \rightarrow L1$) land on Day 1 and early days when cognitive retention is highest.
3. **Category Sequence**: `system-design` $\rightarrow$ `technical` $\rightarrow$ `behavioural` $\rightarrow$ `company-fit`.
4. Final days are reserved for review, active recall flashcards, and mock interview polish.

#### 3. Strict Integer Durations
Daily study minutes are strictly calculated without floating-point numbers:
$$\text{Duration} = \max\left(30, \sum_{q \in \text{Day}} \text{DIFFICULTY\_MINUTES}[q.\text{difficulty}]\right)$$
- Difficulty 1 = 10 minutes
- Difficulty 2 = 15 minutes
- Difficulty 3 = 25 minutes

#### 4. Referential Integrity
Every entry in `schedule.days[i].question_ids` is verified to exist in `kit.questions`.

---

## 🔄 Deep Dive 3: The Second Pass Coverage Feedback Loop

### The Problem
During LLM question generation, models frequently suffer from **coverage blindness** — generating 10 questions for common skills (e.g., React/Node) while completely overlooking niche mandatory qualifications (e.g., Kafka, Kubernetes, or HIPAA compliance).

### Deterministic Gap Detection
After Pass 1, `CoverageEngine.getGaps()` executes pure set difference math:

$$\text{Must Requirements} = \{ r \in \text{Requirements} \mid r.\text{priority} = \text{'must'} \}$$
$$\text{Mapped Requirements} = \bigcup_{q \in \text{Questions}} q.\text{requirement\_ids}$$
$$\text{Gaps} = \text{Must Requirements} \setminus \text{Mapped Requirements}$$

### Closed-Loop Targeted Execution
```
[Initial Extraction] ──► [Pass 1 Question Gen] ──► [CoverageEngine Audit]
                                                           │
                      ┌────────────────────────────────────┴────────────────────────────────────┐
                      ▼                                                                         ▼
             [Gaps == 0 (100%)]                                                    [Gaps > 0 Detected]
                      │                                                                         │
                      ▼                                                                         ▼
            Proceed to Schedule                                                    [SecondPassRunner Triggered]
                                                                                                │
                                                                                   • Targeted LLM call for
                                                                                     MISSING requirement IDs only
                                                                                   • Merge new questions into bank
                                                                                   • Increment coverage.passes = 2
                                                                                                │
                                                                                                ▼
                                                                                       [Re-Verify 100% Coverage]
```

If $\text{Gaps} \neq \emptyset$, `SecondPassRunner`:
1. Constructs a hyper-targeted prompt containing **only** the missing must-have requirement IDs and their exact texts.
2. Generates focused questions specifically mapped to the missing IDs.
3. Merges the new questions into the kit with stable sequence IDs.
4. Records `coverage.passes = 2` in the final Appendix A kit for full audit transparency.

---

## 🔀 Deep Dive 4: Intelligent Model Routing & Multi-Provider Architecture

Trao.ai features a unified, enterprise-grade **Multi-Provider LLM SDK** with **Task-Based Routing** and **Zero-Downtime Resilient Failover**.

```
                           ┌───────────────────────────────┐
                           │      LLMFactory / Router      │
                           └───────────────┬───────────────┘
                                           │
         ┌──────────────────┬──────────────┴───────┬──────────────────┐
         ▼                  ▼                      ▼                  ▼
  [Google Gemini]        [Groq]                [OpenAI]         [OpenRouter]
  gemini-1.5-flash    llama-3.3-70b           gpt-4o-mini       200+ Models
  (1M Token Context)  (500+ tok/sec)        (Deep Rubrics)    (Llama/Claude/DS)
```

### 1. Task-Based Optimal Routing
Every pipeline stage routes to the LLM best suited for its cognitive profile:

| Task | Primary Provider & Model | Core Advantage | Automatic Fallback Chain |
| :--- | :--- | :--- | :--- |
| **`extraction`** | **Google Gemini** (`gemini-1.5-flash`) | Strict JSON grammar, structured extraction, zero hallucination | OpenAI $\rightarrow$ Groq $\rightarrow$ OpenRouter |
| **`brief`** | **Google Gemini** (`gemini-1.5-flash`) | **1,000,000 token context window** to digest full scraped web pages | OpenRouter $\rightarrow$ Groq $\rightarrow$ OpenAI |
| **`questions`** | **OpenAI** (`gpt-4o-mini`) | Nuanced interview evaluation criteria, scoring rubrics, calibrated hints | Groq $\rightarrow$ Gemini $\rightarrow$ OpenRouter |
| **`flashcards`** | **Groq** (`llama-3.3-70b-versatile`) | **Ultra-fast inference (500+ tokens/sec)** for rapid Q&A cards | Gemini $\rightarrow$ OpenRouter $\rightarrow$ OpenAI |
| **`second_pass`** | **Groq** (`llama-3.3-70b-versatile`) | Lightning-fast targeted closure of missing requirements | Gemini $\rightarrow$ OpenAI $\rightarrow$ OpenRouter |

### 2. Zero-Downtime Resilient Failover Chain
If any provider hits an error (**HTTP 429 Rate Limit**, **Quota Exceeded**, **HTTP 503**, or **Network Timeout**):
- The request never crashes.
- `ModelRouter` logs a warning and immediately switches to the next provider in the chain.
- The returned response tags `fallbackUsed: true` and lists `attemptedProviders: ['primary', 'fallback']`.
- In development/testing, `MockLLMProvider` acts as the ultimate safety net.

### 3. Built-In Token Leaky-Bucket Rate Limiter
Every provider implements an in-memory `RateLimiter`:
- **Gemini**: 14 RPM max, min 1.5s interval.
- **Groq**: 25 RPM max, min 800ms interval.
- **OpenAI**: 30 RPM max, min 500ms interval.
- **OpenRouter**: 20 RPM max, min 1000ms interval with custom `HTTP-Referer` and `X-Title` attribution headers.

---

## 🛡️ Deep Dive 5: Autonomous Web Crawler & SSRF Defense

The crawler pipeline (`CompanyCrawler`) extracts real-world company culture, hiring philosophy, and interview feedback:

### 1. SSRF & Security Defense (`UrlValidator`)
- Blocks DNS rebinding, internal loopbacks (`127.0.0.1`, `localhost`), and private IP ranges (`10.0.0.0/8`, `192.168.0.0/16`, `172.16.0.0/12`, link-local `169.254.0.0/16`).
- Enforces HTTP/HTTPS protocol whitelist.
- Normalizes naked domains (e.g. `stripe.com` $\rightarrow$ `https://stripe.com`).

### 2. Intelligent Candidate Link Ranking (`LinkRanker`)
- Crawls home page and parses all internal hyperlinks.
- Ranks subpages using keyword scoring (`careers`, `jobs`, `about`, `culture`, `engineering`, `values`).
- Filters out static assets (`.png`, `.pdf`, `.zip`), external domains, and query params.

### 3. Graceful Degradation
- If a target company domain is unreachable (HTTP 404, DNS failure, or 10-second timeout):
- **The pipeline DOES NOT abort.**
- The crawler returns clean fallback signals, and `CompanyBriefGenerator` generates a transparent brief grounded solely in the verified Job Description without inventing corporate facts.

---

## 🚀 Full 9-Stage Sequenced Pipeline

```
[Job Description + Target URL + Days Available]
                       │
                       ▼
    [Stage 0: Input Sanitization & SSRF Defense]
                       │
                       ▼
    [Stage 1: Grounded Requirement Extraction] ──────► Stable r1, r2 IDs; must vs nice
                       │
                       ▼
    [Stage 2: Autonomous Company Web Scraping] ──────► Ranked link crawling (careers, about)
                       │
                       ▼
    [Stage 3: Verified Discussion Searcher]   ──────► Public interview patterns
                       │
                       ▼
    [Stage 4: Company Brief & Culture Synth]   ──────► Grounded mission & tech stack
                       │
                       ▼
    [Stage 5: Categorized Question Generation] ──────► Tech, system design, behavioural
                       │
                       ▼
    [Stage 6: Active-Recall Flashcards Synth]  ──────► Key concept revision pairs
                       │
                       ▼
    [Stage 7: Deterministic Second Pass Loop]  ──────► Gaps check & targeted closure
                       │
                       ▼
    [Stage 8: Arithmetic Scheduling Engine]    ──────► Exact N days, integer minutes
                       │
                       ▼
    [Stage 9: Appendix A Schema Verification]  ──────► 100% strict contract validation
```

---

## 🔌 API Reference & Endpoint Contracts

### Authentication
Include `Authorization: Bearer <JWT_TOKEN>` header for protected endpoints.

### Core Endpoints

#### 1. Generate Interview Prep Kit
`POST /api/kit/generate`
```json
{
  "jobDescription": "Senior Backend Engineer at Stripe. Requirements: Node.js, Distributed Systems, Postgres, Kafka. Nice to have: Go.",
  "companyUrl": "https://stripe.com",
  "days": 5
}
```
**Response**: Complete Appendix A compliant `KitData` object with extracted role, brief, questions, flashcards, coverage, and schedule.

#### 2. Get All Kits
`GET /api/kit`
Returns all saved kits for the authenticated user, sorted by `createdAt` descending.

#### 3. Get Single Kit
`GET /api/kit/:id`
Returns full kit details by ID.

#### 4. The Builder: Category Regeneration
`POST /api/kit/:id/regenerate`
```json
{
  "category": "technical"
}
```
Refreshes unpinned/unedited questions in that category while strictly preserving custom, edited, and pinned items.

#### 5. Update Question (Inline Editing / Pinning)
`PATCH /api/kit/:id/question/:questionId`
```json
{
  "prompt": "Customized prompt for distributed systems...",
  "isEdited": true,
  "isPinned": true
}
```

#### 6. Export Kit
`GET /api/kit/:id/export?format=json` (or `markdown`)
Exports the kit in Appendix A JSON or formatted Markdown for offline study.

---

## 🤖 Headless Batch Evaluation CLI (Appendix B)

As specified in **Section 9 & Appendix B**, the backend includes a standalone batch evaluation entry point to test pipeline performance on batch cases without running the HTTP server.

### Running Batch Evaluation
```bash
npm run evaluate -- --input tests/fixtures/sample_cases.json --output dist/evaluated_kits.json
```

### What It Validates
1. Processes an array of `{ id, company_url, job_description, days }`.
2. Executes the full pipeline with live LLM routing or deterministic fallback.
3. Automatically audits each output through `AppendixAValidator`.
4. Emits a formatted evaluation report with:
   - Appendix A validation pass rate ($100\%$)
   - Average requirement extraction count
   - Second pass trigger frequency
   - Schedule invariant verification

---

## 🧪 Automated Test Suite (45 Passing Tests)

The backend features a comprehensive test suite testing every mathematical, crawler, and schema invariant:

```bash
npm test
```

### Test Suite Breakdown
```
▶ AppendixAValidator (Structure & Invariant Validation)
  ✔ validates a completely conforming Appendix A kit
  ✔ fails if top-level section is missing
  ✔ fails if difficulty is not integer 1, 2, or 3
  ✔ fails if minutes is not an integer
  ✔ fails if schedule days count does not match days_available
  ✔ fails if schedule refers to a non-existent question ID
  ✔ fails if a question references a non-existent requirement ID
  ✔ fails if requirement IDs are duplicated

▶ CoverageEngine (Deterministic Coverage Checking)
  ✔ detects uncovered must-have requirements when gaps exist
  ✔ reports 100% must-have complete coverage when all must-haves have questions
  ✔ returns specific missing requirements to drive the second pass LLM step
  ✔ generates accurate metrics in diagnostic report

▶ Crawler & Scraping Pipeline
  ✔ validates and normalizes valid public URLs
  ✔ blocks private IPs and loopback (SSRF protection)
  ✔ ranks hiring and interview links with highest priority
  ✔ cleans HTML text, strips scripts/styles/svg, and unescapes entities
  ✔ gracefully handles unreachable or 404 company URLs without failing

▶ Intelligent ModelRouter & Multi-Provider Architecture
  ✔ initializes all configured providers (Gemini, Groq, OpenAI, OpenRouter, Mock)
  ✔ routes tasks intelligently to optimal provider based on task profile
  ✔ honors preferredProvider override when requested in options
  ✔ generates status report accurately with provider models and route maps
  ✔ falls back resiliently when mock is forced
  ✔ provides task-scoped adapters via router.forTask()

▶ ScheduleEngine (Deterministic Arithmetic)
  ✔ allocates exactly N days as requested (5 days)
  ✔ handles 1-day edge case correctly
  ✔ handles 60-day edge case correctly
  ✔ places harder and higher-priority questions earlier in schedule
  ✔ strictly produces integer minutes (no floats)
  ✔ ensures every scheduled question_ids entry refers to an existing question

ℹ tests 45 | pass 45 | fail 0 (100% passing)
```

---

## 💻 Quick Start & Local Setup

### 1. Prerequisites
- **Node.js**: v18.0.0 or higher
- **MongoDB**: Local MongoDB on `mongodb://localhost:27017` or MongoDB Atlas URI

### 2. Install Dependencies
```bash
cd backend
npm install
```

### 3. Configure Environment (`.env`)
```bash
cp .env.example .env
```
Add your API keys to `.env`:
```env
PORT=5000
NODE_ENV=development
MONGODB_URI=mongodb://localhost:27017/trao_ai
CORS_ORIGIN=http://localhost:3000
JWT_SECRET=your_jwt_secret_key

# Add at least one key (Gemini is free at https://aistudio.google.com/apikey):
GEMINI_API_KEY=your_gemini_key_here
GROQ_API_KEY=your_groq_key_here
OPENAI_API_KEY=your_openai_key_here
OPENROUTER_API_KEY=your_openrouter_key_here

# Intelligent Routing (Defaults to smart task assignments)
DEFAULT_LLM_PROVIDER=gemini
```

### 4. Run Development Server
```bash
npm run dev
```
Server runs with live-reload on **`http://localhost:5000`**.

### 5. Build for Production
```bash
npm run build
npm start
```
Compiles TypeScript into `dist/` and runs the production server.