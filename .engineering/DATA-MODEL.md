# Data Model

Status: FROZEN upon merge of PH-PLAN-001.

## Core entities
- tenants(id, name, status, created_at)
- users(id, status)
- tenant_memberships(user_id, tenant_id, role)
- trading_accounts(id, tenant_id, provider, wallet_address, auth_mode, status)
- encrypted_secrets(id, tenant_id, purpose, ciphertext, key_version, rotated_at)
- strategy_configs(id, tenant_id, strategy_id, version, config, enabled)
- risk_profiles(id, tenant_id, version, limits, live_enabled)
- markets(provider_market_id, metadata, status, eligibility)
- market_snapshots(market_id, timestamp, compact_book_metrics)
- order_intents(id, tenant_id, strategy_version, risk_decision_id, idempotency_key)
- orders(id, tenant_id, provider_order_id, state, side, price, size)
- fills(id, tenant_id, order_id, provider_fill_id, price, size, fee, timestamp)
- positions(id, tenant_id, market_id, quantity, cost_basis, state)
- pnl_events(id, tenant_id, realized, unrealized, fees, rebates, timestamp)
- decision_events(id, tenant_id, strategy, inputs_digest, output, timestamp)
- journal_events(id, tenant_id, aggregate_type, aggregate_id, event_type, payload_digest, timestamp)
- ai_insights(id, tenant_id, market_id, provider, schema_version, content, expires_at)
- kill_switch_events(id, scope, tenant_id nullable, actor, reason, timestamp)
- audit_logs(id, tenant_id nullable, actor, action, resource, result, timestamp)

## Rules
Every tenant-owned table carries tenant_id. Provider IDs are unique within provider scope. Money/price/size use exact decimal/numeric types, never binary float. Secret plaintext is never persisted. Journal/audit records are append-oriented. Global/system rows are the only records allowed to use a null tenant_id where the schema explicitly permits it.
