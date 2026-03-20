# PaceWise

**AI-powered adaptive running coach that generates personalized training plans from your run data.**

🔗 **[pace-wise.vercel.app](https://pace-wise.vercel.app)**

---

## What it does

Most running plans are static — they don't know you missed a workout, had a rough week, or just ran a PR. PaceWise is different. After every run you log, it analyzes your full training history and uses Claude (Anthropic's AI) to regenerate a personalized weekly plan that adapts to where you actually are.

**Core loop:**
1. User logs a run (distance, pace, heart rate, notes)
2. Server fetches their profile + last N runs from Firestore
3. Claude generates a structured, adaptive training plan
4. Plan is validated with Zod and stored — dashboard updates instantly

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 15, TypeScript, Tailwind CSS |
| Auth | Firebase Authentication |
| Database | Firestore (subcollection schema) |
| AI | Anthropic Claude API |
| Validation | Zod (structured LLM output validation) |
| Visualization | Recharts |
| Hosting | Vercel |

---

## Architecture

### Firestore Schema

Data is modeled around a per-user subcollection structure, keeping reads efficient and scoped:

```
users/
  {uid}/
    profile          # onboarding data: goals, fitness level, weekly mileage target
    logs/
      {YYYY-MM-DD}   # individual run: distance, pace, HR, cadence, notes
    plans/
      {YYYY-MM-DD}   # AI-generated weekly training plan, versioned by date
```

### Plan Generation Pipeline

```
POST /api/log
  │
  ├─ Verify Firebase ID token (Admin SDK)
  ├─ Write run log → Firestore
  ├─ Fetch user profile + last N run logs
  ├─ Build versioned prompt with user context
  ├─ Call Anthropic Claude API
  ├─ Validate response with Zod schema
  └─ Write plan → Firestore, return to client
```

### LLM Output Validation

Claude's response is parsed against a strict Zod schema before being stored. This ensures the plan always has the expected structure — named workout days, descriptions, intensity levels — and fails loudly if the model drifts from the expected format. Prompt versioning is tracked so plan quality can be compared across prompt iterations.

### Authentication & Routing

- Firebase `onAuthStateChanged` drives an `AuthContext` that wraps the app
- `ProtectedRoute` component redirects unauthenticated users to login
- New users flow through an onboarding screen that writes their profile to Firestore before reaching the dashboard

---

## Engineering Decisions

**Why Firestore subcollections over a flat collection?**
Subcollections let us query `users/{uid}/logs` directly without filtering a global logs collection by UID. This keeps reads cheap, scoped to the user, and naturally aligns with Firestore's pricing model (per document read).

**Why validate LLM output with Zod?**
LLMs are non-deterministic. Without validation, a slightly different response shape would silently break the dashboard. Zod gives a clear contract between the AI layer and the data layer, and makes debugging prompt regressions straightforward.

**Why regenerate the full plan on every log, not just update it?**
Training context accumulates. A single hard run might not change much, but three consecutive hard runs should. By regenerating from the full history window each time, the plan stays genuinely adaptive rather than just patching the prior week.

---

## Running Locally

```bash
git clone https://github.com/your-username/pace-wise
cd pace-wise
npm install
```

Create a `.env.local` file:

```env
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
FIREBASE_ADMIN_PRIVATE_KEY=
FIREBASE_ADMIN_CLIENT_EMAIL=
ANTHROPIC_API_KEY=
```

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Roadmap

- [ ] Background plan generation via Upstash QStash (decouple AI call from HTTP response)
- [ ] Computed training load metrics (rolling weekly mileage, acute:chronic ratio)
- [ ] Sentry integration for observability and prompt error tracking


