# Thrifty API

Cooperative savings platform — digitises the traditional ajo/esusu/tontine model.
Groups of 7 contribute a fixed monthly amount; each member takes turns collecting
the full pool. Auto-debit runs between the 25th and 5th of each month.

---

## Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js 20+ (ESM) |
| Framework | Express 4 |
| Database | PostgreSQL 15 + Knex |
| Cache / Queues | Redis + BullMQ |
| Auth | JWT RS256 + Argon2id + TOTP 2FA |
| Payments | Paystack direct debit + transfers |
| Balance checks | Mono open finance API |
| KYC / BVN | NIBSS via Dojah / Smile ID |

---

## Project structure

```
thrifty-api/
│
├── src/
│   │
│   ├── config/                          Configuration — initialised once at startup
│   │   ├── database.js                  pg pool + knex instance
│   │   ├── redis.js                     ioredis client (shared across app + workers)
│   │   ├── queue.js                     BullMQ queue definitions + worker startup
│   │   └── env.js                       Zod-validated env vars — crashes on missing
│   │
│   ├── services/                        Business logic — pure functions, no HTTP
│   │   ├── auth.service.js              Registration, BVN verify, login, tokens
│   │   ├── user.service.js              Profile management, bank accounts
│   │   ├── group.service.js             Create group, join, activate, turn order
│   │   ├── cycle.service.js             Cycle creation, advancement, status updates
│   │   ├── debit.service.js             Debit initiation, fallback sweep, webhooks
│   │   ├── payout.service.js            6-guard payout with SELECT FOR UPDATE lock
│   │   ├── fraud.service.js             Flag detection, risk scoring, velocity rules
│   │   └── notification.service.js      SMS, push notification, email dispatch
│   │
│   ├── routes/                          Express routers — validate input, call service
│   │   ├── auth.routes.js               POST /register /login /refresh /logout /verify-otp
│   │   ├── user.routes.js               GET/PATCH /me, /me/bank-accounts
│   │   ├── group.routes.js              GET/POST /groups, /groups/:id/join
│   │   ├── webhook.routes.js            POST /webhooks/paystack, /webhooks/mono
│   │   └── admin.routes.js              All admin-only endpoints (separate auth)
│   │
│   ├── jobs/                            BullMQ processors — run in worker.js process
│   │   ├── debit.job.js                 Debit processor: attempt → fallback → retry
│   │   ├── payout.job.js                Payout processor + transfer confirmation handler
│   │   ├── retry.job.js                 Delayed debit retry (scheduled by debit.job)
│   │   ├── notification.job.js          SMS / push / email sender
│   │   └── scheduler.js                 Cron: enqueues monthly debit jobs on 25th
│   │
│   ├── middleware/
│   │   ├── auth.middleware.js           JWT verify, decode, attach req.user
│   │   ├── validate.js                  Zod schema validation factory
│   │   ├── rateLimiter.js               Redis sliding window — per route + per user
│   │   ├── requirePin.js                Transaction PIN check for financial actions
│   │   ├── auditLog.js                  Auto-logs every POST/PUT/PATCH/DELETE
│   │   └── errorHandler.js              Centralised — typed AppErrors vs 500s
│   │
│   ├── db/
│   │   ├── migrations/                  Knex migration files (numbered 001, 002 …)
│   │   ├── seeds/                       Dev seed data — tiers, test users, test group
│   │   └── queries/                     Domain-specific query helpers
│   │       ├── group.queries.js
│   │       ├── cycle.queries.js
│   │       └── contribution.queries.js
│   │
│   ├── lib/                             Pure utilities — no side effects, fully testable
│   │   ├── crypto.js                    AES-256-GCM encrypt/decrypt + deterministic variant
│   │   ├── idempotency.js               Key generation + Redis dedup check
│   │   ├── turnOrder.js                 Crypto Fisher-Yates shuffle (no Math.random)
│   │   ├── audit.js                     Tamper-evident hash-chained audit log writer
│   │   ├── errors.js                    AppError class with code + statusCode
│   │   ├── logger.js                    Pino structured logger (JSON in prod)
│   │   ├── paystack.js                  Paystack API: mandate, charge, transfer, webhook verify
│   │   ├── mono.js                      Mono API: account balance check before debit
│   │   └── nibss.js                     BVN verification via licensed aggregator
│   │
│   ├── app.js                           Express setup: middleware stack + route mounting
│   ├── server.js                        HTTP server entry point (starts app.js)
│   └── worker.js                        Worker entry point — starts BullMQ workers + cron
│
├── test/
│   ├── unit/                            Services tested in isolation (DB + Redis mocked)
│   ├── integration/                     Routes + real Postgres via testcontainers
│   └── fixtures/                        Shared test data factories
│
├── knexfile.js                          DB config for development / staging / production
├── package.json
└── .env.example                         Copy to .env and fill in all values
```

---

## Two processes, one codebase

The HTTP API and the job workers are **separate Node.js processes**.
Never co-locate BullMQ workers in the Express process — a slow job will block
the event loop and delay API responses.

```bash
# Terminal 1 — HTTP API (port 3000)
npm run dev

# Terminal 2 — BullMQ workers + monthly debit cron
npm run worker
```

In production, deploy as two separate services:
- `thrifty-api` — handles all HTTP requests
- `thrifty-worker` — runs debit, payout, retry, notification jobs

Scale them independently. Workers can be scaled horizontally;
BullMQ handles job distribution across multiple worker instances automatically.

---

## Core architectural rules

**1. Routes are thin.**
Validate input with Zod. Call exactly one service method. Return the result.
No business logic. No direct DB calls. No `if/else` chains.

**2. Services own all logic.**
A service method is a complete, self-contained unit of work.
It may call other services. It never touches `req` or `res`.
It is fully testable without starting an HTTP server.

**3. Financial operations are always transactional.**
Any code path that writes to `contributions`, `payouts`, `group_members`,
or `cycles` must run inside `db.transaction()`. No exceptions.

**4. Idempotency is mandatory on all financial jobs.**
BullMQ `jobId` deduplicates enqueue. Redis key deduplicates execution.
The `UNIQUE` constraint on `contributions(cycle_id, member_id)` is the
final safety net at the database layer.

**5. No UPDATE or DELETE on financial records.**
`contributions` and `payouts` rows are append-only once written.
The application DB user (`thrifty_app`) has these permissions revoked in migrations.
Corrections are made via compensating records, never by mutating existing ones.

**6. Secrets never in code.**
All credentials via env vars, validated at startup by Zod.
App refuses to start if any required secret is missing or malformed.

---

## Getting started (local)

```bash
# 1. Clone and install
cp .env.example .env
# edit .env with your local values
npm install

# 2. Start Postgres + Redis
docker compose up -d

# 3. Run migrations
npm run migrate

# 4. Seed development data
npm run seed

# 5. Start both processes
npm run dev        # terminal 1
npm run worker     # terminal 2
```

---

## Migration naming convention

```
001_create_extensions.js
002_create_users.js
003_create_bank_accounts.js
004_create_refresh_tokens.js
005_create_tiers.js
006_create_thrift_groups.js
007_create_group_members.js
008_create_cycles.js
009_create_contributions.js
010_create_payouts.js
011_create_audit_logs.js
012_create_disputes.js
013_create_fraud_flags.js
014_create_notifications.js
```

Run `npm run migrate` to apply all pending migrations in order.
Always test migrations on staging before running on production.
