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

Use Node.js `>=22 <27` and npm. CI uses Node.js 24 LTS.

```sh
npm ci
npm run validate
```

The web and worker workspaces are engineering shells only. Product behavior is not part of PH-M00.
