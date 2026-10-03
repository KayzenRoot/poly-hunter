# Migration & Recovery

Status: FROZEN upon merge of PH-PLAN-001.

## Database migrations
Forward-only by default. Every migration is versioned, tested on representative data and has rollback or roll-forward guidance. Destructive changes require an explicit HIGH_ASSURANCE Work Order.

## Worker recovery
On restart:
1. acquire tenant execution lease;
2. load last durable config/state;
3. fetch remote open orders/positions/fills;
4. reconcile drift;
5. remain entry-blocked until reconciliation is known-safe;
6. resume only eligible tenants.

## Provider outage
Stop new entries on stale/unknown market data. Preserve open-order knowledge, retry bounded/idempotent reads/cancels and surface DEGRADED status.

## Kill switch
Global/tenant kill:
- atomically mark execution disabled;
- stop new intents;
- issue idempotent cancels for eligible open orders;
- reconcile final remote state;
- record audit/journal evidence.

## Secret compromise
Disable tenant LIVE, revoke/rotate provider/session authorization where supported, rotate application encryption material as needed and preserve redacted audit evidence.

## Backup
Postgres backups plus schema/migration version and encrypted-secret ciphertext are required before production-live migrations.
