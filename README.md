# FitPilot

AI-powered personal fitness & nutrition coach. Starts from the Milestone 1
end-to-end loop and extends it to a usable V1: nutrition (manual + photo),
workouts, body measurements, weekly check-ins/reviews, settings, and an AI
coach with an approval gate and a feedback loop.

```
Sign Up → Goal → Baseline → Log Weight → Log Meal → Daily Summary
        → AI Coach Insight → Recommendation → User Approval → Saved Action
```

Hebrew-first, RTL, mobile-first. Runs entirely on Cloudflare's free tier:
**Pages** (hosting) + **D1** (database) + **Workers AI** (the coach model,
and the vision model behind Meal Vision) — no external API keys needed.

## Stack

- **Next.js 14** (App Router) on **Cloudflare Pages**, via `@cloudflare/next-on-pages`
- **D1** (SQLite at the edge) for all data — see `migrations/*.sql`
- **Auth.js (NextAuth v5)**, credentials provider — self-hosted, free, no third-party auth service
- **Workers AI** — `@cf/meta/llama-3.1-8b-instruct` for the coach, `@cf/llava-hf/llava-1.5-7b-hf` for Meal Vision — both free tier, swap for the Claude API later by editing `src/lib/coach.ts` only
- **Tailwind CSS**, RTL-native layout, Heebo font for Hebrew

## Feature map

| Area | Where |
|---|---|
| Auth (signup/login) | `/signup`, `/login`, `src/lib/auth.ts` |
| Onboarding (goal, baseline, tracking depth) | `/onboarding` |
| Home dashboard + coach insight + approval | `/` , `src/components/CoachInsight.tsx` |
| Nutrition — manual entry | `/nutrition`, `src/components/MealLogger.tsx` |
| Nutrition — Meal Vision (photo → AI estimate → confirm) | `src/components/MealPhotoLogger.tsx`, `src/app/api/meal-photo/**` |
| Weight + body measurements | `/progress`, `src/components/{WeightLogger,MeasurementLogger}.tsx` |
| Weekly check-in + AI weekly review | `/progress`, `src/components/{WeeklyCheckIn,WeeklyReviewCard}.tsx` |
| Workouts (exercise library, set logging) | `/workout`, `src/components/WorkoutLogger.tsx` |
| Settings (language, tracking depth, notifications) | `/settings`, `src/components/SettingsForm.tsx` |
| AI feedback loop (helpful / not helpful) | `src/components/CoachInsight.tsx`, `src/app/api/coach/feedback` |

## One-time setup

```bash
npm install

# Log in to Cloudflare
npx wrangler login

# Create the D1 database
npx wrangler d1 create fitpilot_db
# → copy the returned database_id into wrangler.toml (REPLACE_WITH_YOUR_D1_DATABASE_ID)

# Apply the schema
npm run db:migrate:local   # for local dev
npm run db:migrate:remote  # for production

# Generate an auth secret and set it as a Pages secret
openssl rand -base64 32
npx wrangler pages secret put AUTH_SECRET
# paste the generated value when prompted
```

## Local development

```bash
npm run dev
```

Note: `next dev` alone doesn't have access to D1/Workers AI bindings. This
project's `next.config.mjs` wires up `@cloudflare/next-on-pages`'s dev
platform shim automatically, so `npm run dev` should have working bindings.
If you hit binding errors locally, use the full Pages emulator instead:

```bash
npm run preview
```

## Deploy

```bash
npm run deploy
```

This runs `next-on-pages` to produce `.vercel/output/static`, then
`wrangler pages deploy`. On first deploy, Cloudflare will ask you to link
the Pages project — accept the defaults, then re-run `wrangler pages secret
put AUTH_SECRET` if it wasn't carried over, and double-check the D1 binding
is attached to the Pages project in the Cloudflare dashboard (Settings →
Functions → D1 database bindings) if `wrangler.toml` doesn't pick it up
automatically for Pages.

## Where things live

- `migrations/0001_init.sql` — core schema (users, goals, weight, nutrition
  targets, meals, check-ins, AI insights, audit log), with the
  provenance/history rules from the product spec baked into the table
  design (append-only weight/goals/nutrition-target logs, source/confidence
  on every row, audit log for approval-gated changes).
- `migrations/0002_workout_measurements_checkins.sql` — workouts, exercise
  library, progress photos (metadata only), saved/favorite meals, meal
  photos (Meal Vision), user settings, AI feedback.
- `migrations/0003_seed_exercises.sql` — a starter exercise library (15
  exercises covering a standard push/pull/legs-ish split) so workout
  logging isn't a blank slate on day one.
- `src/lib/db.ts` — all data access; this is the only layer that touches D1
  directly.
- `src/lib/nutrition.ts` — deterministic Mifflin-St Jeor baseline calorie/macro
  calculation (plain code, not the AI model — see spec §54).
- `src/lib/coach.ts` — the AI Coach: daily insights (deterministic gate
  decides *whether* one is worth generating — the model only writes the
  sentence) and the weekly review.
- `src/app/api/**` — REST endpoints backing every page.
- `src/app/{login,signup,onboarding,page,nutrition,progress,workout,settings}` —
  every screen in the app.

## What's intentionally still not here

Real object storage for meal/progress photos (the `meal_photos` and
`progress_photos` tables store a `storage_key` placeholder — wiring an R2
bucket is a follow-up, not a blocker for proving the photo → AI estimate →
confirm loop), wearable integrations, and a workout *generator* (the
exercise library and logging are in place; auto-generating a plan from
goal/equipment/history is the natural next step on top of it).

## Swapping in Claude API for the Coach later

`src/lib/coach.ts` has a single `runCoachModel()` function. Replace its body
with a call to the Anthropic Messages API (keep the same signature) and
nothing else in the app needs to change.
