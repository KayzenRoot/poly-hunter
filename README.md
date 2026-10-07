# PolyHunter

PolyHunter is a GEF-governed multi-tenant micro-SaaS for low-notional Polymarket automation.

## Current state
- GEF Bootstrap: 1.1.2
- Product implementation: not started
- Canonical engineering sources: `.engineering/`
- Current checkpoint: `.engineering/CHECKPOINT.md` and `.engineering/CHECKPOINT.json`

## MVP thesis
The MVP targets frequent, small, maker-first trades with strict risk controls rather than a daily-profit guarantee. The primary strategy is a deterministic Micro Maker Scalper; a small Arbitrage Sentinel is secondary. Replay and paper modes precede live mode.

## Safety boundary
Live trading is HIGH_ASSURANCE. No implementation increment may activate live order submission until the Source Pack, paper/replay acceptance gates, tenant isolation, secret handling, geographic eligibility checks, kill switches and recovery obligations are objectively satisfied.

See `.engineering/SOURCE-HIERARCHY.md` for authority and `.engineering/BACKLOG.md` for the module map.

## Development

Use Node.js `>=24 <27` and npm. The official `@polymarket/client` workspace
requires Node.js 24 or newer; CI and the local Docker image use Node.js 24.

```sh
npm ci
npm run validate
```

The web and worker workspaces remain engineering shells in this increment. PH-M01-WO-001 adds the persistence boundary only; authentication, secrets and product behavior are outside its scope.

### Local Docker runtime

With Docker Desktop using the Linux Engine, copy `.env.example` to the ignored local `.env` file, then start the web, worker and PostgreSQL services. Compose requires this local-only configuration and does not contain a password fallback:

```sh
npm run docker:up
```

Open [http://localhost:3000](http://localhost:3000) to view the web shell. The PostgreSQL 17 service is reachable only on the Compose network; it has a persistent named volume and is not published to the host. Both Node services receive `DATABASE_URL` inside the container only. Local defaults are development-only and must never be reused in production.

Apply the checked-in Drizzle migrations and run the real PostgreSQL isolation suite from the web container:

```sh
npm run db:migrate
npm run db:test:integration
```

The integration suite creates two disposable databases, applies migrations from empty state, re-applies them to verify repeatability, then checks constraints, deletion behavior, membership revocation and tenant A/B isolation. CI performs the migration and suite against a PostgreSQL 17 service.

```sh
npm run docker:ps
npm run docker:logs
npm run docker:rebuild
npm run docker:down
```

`docker:logs` follows recent logs from all services. Rebuild after changing a package manifest or the lockfile. `docker:down` stops and removes the Compose containers while preserving the Next.js cache and PostgreSQL data volumes.
