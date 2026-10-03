# PH-M00 — Local Docker Development Runtime

Status: FROZEN upon merge of PH-M00-PLAN-002.

## Purpose
Make the local runnable PolyHunter environment predictable and visible while development proceeds. The owner should be able to open http://localhost:3000 at any time and follow the current web build while the worker runs beside it.

## Boundary
This is development-only containerization. PH-M11 still owns production container hardening, hosted secrets, persistence, reverse proxies, deployment and recovery infrastructure.

## Target development stack
One shared Node.js 24 development image is used by two Docker Compose services:

- web
  - command: Next.js development server
  - host: 0.0.0.0 inside container
  - published host port: 3000
  - source edits under apps/web and shared packages become visible without image rebuild
  - healthcheck verifies HTTP availability

- worker
  - command: TypeScript watch/restart development process
  - no host port required
  - source edits under apps/worker and shared packages restart the process
  - logs remain visible through Docker Compose

## Files expected from implementation
- Dockerfile.dev
- compose.yaml
- .dockerignore
- package/script changes strictly required for development watch
- README local-Docker instructions
- Docker smoke evidence

## Container rules
1. Base runtime is Node.js 24 on a slim Debian family image.
2. Containers run as a non-root user.
3. No privileged mode.
4. No Docker socket mount.
5. No real secrets are required for base startup.
6. Host node_modules is not required or mounted.
7. Application/package source is bind-mounted for development feedback.
8. Dependency/package-manifest changes may require rebuild.
9. Web binds to 0.0.0.0 in-container and localhost:3000 on host.
10. Compose project/service names are stable and predictable.
11. Windows Docker Desktop file watching must be supported; polling flags may be used when required.
12. The stack remains running after successful local implementation so the owner can inspect it.

## Developer command contract
- npm run docker:up
- npm run docker:down
- npm run docker:rebuild
- npm run docker:ps
- npm run docker:logs

The canonical start command must result in both services running and the web service healthy.

## Smoke obligations
- docker compose config
- docker compose build
- docker compose up -d
- docker compose ps
- HTTP success from http://localhost:3000
- worker container is running
- worker logs show successful startup
- source edit / reload smoke for web
- source edit / restart smoke for worker when practical
- npm run validate still passes outside containers
- no secret material introduced

## STOP
Leave the local Docker stack running after successful implementation. Do not begin PH-M01.
