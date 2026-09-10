# Trao.ai - Backend Service & AI Engine

Backend REST API, Autonomous Web Research Crawler, Deterministic Scheduling Engine, and Multi-Step LLM Pipeline for **The AI Interview Prep Kit** built with **Node.js**, **TypeScript**, and **MongoDB**.

---

## 🏗️ Architectural Foundations

### 1. The Hardest State Problem (The Builder)
When a user customizes their prep kit (editing question prompts, modifying outlines, or pinning key questions) and subsequently requests a regeneration of that category (`POST /api/kit/:id/regenerate` with `{ category: 'technical' }`), user-modified questions must survive.

- **State Tracking**: Questions carry provenance flags `isEdited?: boolean`, `isPinned?: boolean`, `isCustom?: boolean`.
- **Partitioning Algorithm**:
  $$\text{Preserved} = \{ q \in \text{Category} \mid q.\text{isPinned} \lor q.\text{isEdited} \lor q.\text{isCustom} \}$$
  $$\text{Refreshed} = \{ q \in \text{Category} \mid \neg q.\text{isPinned} \land \neg q.\text{isEdited} \land \neg q.\text{isCustom} \}$$
- Only unpinned, unedited questions are refreshed with new synthesis. Preserved questions retain custom wording and user locks.
- The deterministic `CoverageEngine` and `ScheduleEngine` re-audit the updated question set to maintain Appendix A compliance.

### 2. Deterministic Arithmetic Schedule Engine
- Calendar scheduling is strictly performed by code (`ScheduleEngine.ts`), never an LLM.
- Allocates across exactly $N$ days (`days.length === days_available`).
- Harder questions ($L3$) and must-have requirements are scheduled early in the cadence.
- Daily durations are strictly rounded integer minutes (no floating-point durations).

### 3. The Second Pass Coverage Loop
- After initial question generation, `CoverageEngine.getGaps` computes:
  $$\text{Gaps} = \text{Must Requirements} \setminus \text{Mapped Requirements}$$
- If gaps are found, `SecondPassRunner` triggers a targeted LLM call focused only on the missing requirement IDs, merges the results into the question bank, and records `coverage.passes`.

---

## 🚀 Getting Started

### Prerequisites
- Node.js v18+
- MongoDB instance (local or Atlas)

### Setup & Installation
```bash
cd backend
npm install
cp .env.example .env
```

Default `.env` settings:
```env
PORT=5000
NODE_ENV=development
MONGODB_URI=mongodb://localhost:27017/trao_ai
CORS_ORIGIN=http://localhost:3000
ALLOW_LOCAL_URLS=true
# Optional: GEMINI_API_KEY, GROQ_API_KEY, or OPENAI_API_KEY
# If omitted, system seamlessly falls back to resilient MockProvider
```

### Running the Server
```bash
npm run dev     # Starts development server with tsx watch on port 5000
npm run build   # Compiles TypeScript to dist/
npm start       # Runs compiled production server
```

---

## 🧪 Automated Testing

The backend includes a comprehensive 39-test suite validating core invariants:

```bash
npm test
```

Tests cover:
- Appendix A schema strict contract validation
- Deterministic schedule day distribution and integer minutes
- Coverage engine gap detection and Second Pass triggering
- Scraper, HTML cleaning, SSRF private IP blocking, and 404 graceful fallbacks
- Grounded requirement extraction without hallucination on stub JDs

---

## 🤖 Headless Batch Evaluation (Section 9 & Appendix B)

Run the automated evaluation CLI over test cases:

```bash
npm run evaluate -- --input <cases.json> --output <kits.json>
```

Example:
```bash
npm run evaluate -- --input tests/fixtures/sample_cases.json --output dist/test_kits.json
```