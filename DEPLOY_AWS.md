# Deploying Comp AI on AWS

Target shape: **one EC2 instance running four containers, plus RDS for Postgres.**
Everything else (Redis, Vector, email, background jobs) is a managed service.

This is deliberately not ECS. Three long-running services plus a Trigger.dev
worker translate poorly into task definitions, and the repo's own `deploy.sh` /
`buildspec.yml` are incomplete fragments (`deploy.sh` starts mid-script and
references an undefined `$CLUSTER_NAME`; `buildspec.yml` has no `phases:` key).
If you later want ECS, the images built here are the same ones you would push.

---

## 1. What has to exist before you start

| Resource | Notes |
|---|---|
| EC2 instance | **`t4g.medium` (4 GB, Graviton/ARM)** — build images on your workstation and have the instance only pull them. Only bump to 8 GB (`t4g.large`) if you build on the box: two Next.js builds request 6 GB of heap. |
| RDS Postgres 15+ | Automated backups + PITR. This is the one thing not worth self-managing. |
| S3 bucket(s) | Uploads and org assets. Attach an instance role instead of using keys. |
| Route 53 + ACM | Three hostnames: `app.`, `portal.`, `api.` |
| Security groups | 443 in from the world; 5432 to RDS only from the instance. |

### Cost

Real `ca-central-1` on-demand rates (AWS Price List API, Aug 2026). Graviton
(`t4g`) is ~21% cheaper than `t3` and the whole stack is ARM-clean — both
`oven/bun` and `node:22-alpine` publish arm64.

| Line | Monthly | Annual |
|---|---|---|
| EC2 `t4g.medium` @ $0.0368/hr | $26.86 | $322 |
| EBS gp3 40 GB @ $0.088/GB | $3.52 | $42 |
| RDS `db.t4g.micro` @ $0.0180/hr | $13.14 | $158 |
| RDS storage 20 GB @ $0.127/GB | $2.54 | $30 |
| S3 + egress | ~$2 | ~$24 |
| **Total** | **~$48** | **~$576** |

A 1-year Compute Savings Plan takes it to roughly **$480/year**. `db.t4g.micro`
is 1 GB RAM — fine for a single organisation, and moving to `db.t4g.small`
later is a restart, not a migration.

### Third-party accounts (not optional)

- **Trigger.dev** — two projects (app + api). Without it there is no email and no
  AI onboarding. Tasks deploy separately: `bunx trigger.dev deploy`.
- **Resend** — with a **verified sending domain**. `RESEND_API_KEY` is a required
  field in both `apps/app/src/env.mjs` and `apps/portal/src/env.mjs`; the apps do
  not boot without it.
- **Upstash Redis** (REST) — ElastiCache is *not* a drop-in. `@upstash/redis`
  speaks HTTP to `/pipeline`, not the Redis wire protocol.
- **Upstash Vector** — index must be **1536 dimensions, COSINE**. No AWS equivalent.
- **OpenAI** — required for embeddings regardless of any AI Gateway key;
  embeddings never route through the Gateway.
- **Vercel AI Gateway** *(optional)* — onboarding/policy AI. Needs paid credits.

---

## 2. Environment files

Four files, none committed. `apps/api/.env` is **not** mentioned in the upstream
README but is mandatory — auth lives in the API.

```
packages/db/.env     DATABASE_URL                       (migrator + seeder)
apps/api/.env        the big one — auth, S3, AI, Trigger (API)
apps/app/.env        dashboard
apps/portal/.env     employee portal
```

Generate secrets with `openssl rand -base64 32`:

| Variable | Where | Notes |
|---|---|---|
| `AUTH_SECRET` | app | |
| `SECRET_KEY` | app, api | **≥16 chars** or the API throws at boot |
| `REVALIDATION_SECRET` | app | |
| `BETTER_AUTH_SECRET` | portal | |
| `INTERNAL_API_TOKEN` | app, portal, api | must match across all three |
| `SERVICE_TOKEN_TRIGGER` | app, api | must match |
| `SERVICE_TOKEN_PORTAL` | portal, api | must match |
| `ENCRYPTION_KEY` | **app, api** | **must match.** Encrypts integration credentials in the vault. Absent from every `.env.example`; without it, saving any integration fails with a 500 (`ENCRYPTION_KEY environment variable is not set`) *after* the credentials validate successfully — so the failure looks like a provider problem rather than a config one. Any strong random string; it is scrypt-derived with a per-record salt. |

Set `NEXT_PUBLIC_SELF_HOSTED=true` in `apps/app/.env` — organisations then
auto-approve and Stripe is not required.

### Quoting: the trap that costs an hour

Docker's `env_file` does **not** parse shell quoting. It takes each value
literally, so a line that works perfectly in local dev:

```
UPSTASH_REDIS_REST_URL="https://xxx.upstash.io"   # cache
```

reaches the container as `"https://xxx.upstash.io"` — quotes included, comment
retained — and the app dies with `invalid URL ... Received: ""https://…""`.
dotenv (what `next` and `bun` use locally) strips both, which is exactly why the
same file works in dev and fails in a container.

Before deploying, normalise them:

```bash
./scripts/env-for-docker.sh --check    # report, change nothing
./scripts/env-for-docker.sh            # rewrite in place, keeps .bak copies
```

Rule of thumb for these four files in production: **no surrounding quotes, no
inline comments.** Values containing spaces are still fine unquoted.

### Two settings that will bite you

**`AUTH_TRUSTED_ORIGINS` replaces the default origin list, it does not extend
it.** The defaults only cover `localhost`, so this is mandatory in production and
must enumerate every origin:

```
AUTH_TRUSTED_ORIGINS=https://app.example.com,https://portal.example.com,https://api.example.com
```

**The `APP_AWS_*` block is validated at API boot** (`apps/api/src/config/aws.config.ts`)
and throws if `APP_AWS_ACCESS_KEY_ID`, `APP_AWS_SECRET_ACCESS_KEY` or
`APP_AWS_BUCKET_NAME` are empty. When using an instance role, set them to any
non-empty placeholder so validation passes and let the SDK resolve real
credentials from the role.

### Restricting who can sign in

By default **anyone who can reach the URL can create an account and their own
organisation** via a magic link. On an internet-facing deployment that is almost
never what you want. Set an allowlist of email domains:

```
AUTH_ALLOWED_EMAIL_DOMAINS=c-encode.com
```

Comma-separated; the domain itself and any subdomain of it are accepted
(`dev@mail.c-encode.com` passes, `attacker@notc-encode.com` does not). Leaving it
unset imposes no restriction, which preserves upstream behaviour.

Enforcement lives in a `databaseHooks.user.create.before` hook in
`apps/api/src/auth/auth.server.ts`, so it covers every signup path at once —
magic link, email OTP, OAuth, and admin-created users. A rejected attempt gets a
403 and logs `[Auth] Blocked account creation for disallowed email domain: …`.

Note the rejection happens when the magic link is **consumed**, not when it is
requested: sending still returns 200 and an email is still delivered. No account
or session is ever created, but a stranger can cause one wasted email.

There is a second, stricter flag:

```
AUTH_DISABLE_SIGNUP=true   # magic link / OTP sign in existing users only
```

**Do not enable this unless you provision users out of band.** `apps/app/.../invite/[code]/page.tsx`
redirects unauthenticated visitors to `/auth`, so an invited person must sign
*in* — which for a new person means signing *up*. With `emailAndPassword`
disabled and no OAuth configured, turning this on means nobody can ever onboard,
including legitimate staff.

---

## 3. Build

`NEXT_PUBLIC_*` are compiled into the JavaScript bundle at **build** time
(`Dockerfile` ARGs). One image cannot be promoted from staging to production —
each environment needs its own build, or you will ship production containers
pointing at staging URLs.

```bash
export BETTER_AUTH_URL=https://app.example.com
export BETTER_AUTH_URL_PORTAL=https://portal.example.com
export API_URL=https://api.example.com

docker compose -f docker-compose.prod.yml build
```

Two Next.js builds need real memory: `bun install` pulls ~3,250 packages and the
builders set `--max_old_space_size=6144` (overridable per build with
`--build-arg NODE_HEAP_MB=4096`). Building on a machine that is also running
the stack will fail with `cannot allocate memory` — the Next build worker gets
SIGKILLed during the TypeScript pass, *after* reporting a successful compile.

**Targeting `t4g` (Graviton) from an Apple Silicon Mac** builds natively, no
emulation. Be explicit about the platform so an x86 host cannot produce images
the instance refuses to run:

```bash
docker compose -f docker-compose.prod.yml build --build-arg NODE_HEAP_MB=4096
docker save comp-api:local comp-app:local comp-portal:local | gzip | \
  ssh ec2-user@<host> 'gunzip | docker load'
```

That avoids needing ECR at all. Use ECR instead once more than one person
deploys.

---

## 4. Release

```bash
# once per release
docker compose -f docker-compose.prod.yml run --rm migrator

# once, on a brand-new database only
docker compose -f docker-compose.prod.yml run --rm seeder

docker compose -f docker-compose.prod.yml up -d api app portal
```

Order matters: `api` first. Auth lives there, so while it is down every page in
the app returns 500 with `ECONNREFUSED`. The compose file encodes this with
`depends_on: service_healthy`.

### Trigger.dev tasks

Not part of any image — deploy from a workstation or CI:

```bash
cd apps/app && bunx trigger.dev@4.4.3 deploy
cd apps/api && bunx trigger.dev@4.4.3 deploy
```

The API's Trigger build requires `packages/db/certs/rds-global-bundle.pem`, which
is gitignored (`.gitignore:24 — *.pem`). Fetch it on any fresh checkout:

```bash
mkdir -p packages/db/certs
curl -fsSL -o packages/db/certs/rds-global-bundle.pem \
  https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem
```

---

## 5. TLS

Terminate TLS at an ALB (host rules → `app`:3000, `portal`:3002, `api`:3333) or
with nginx/Caddy on the instance. The containers speak plain HTTP; nothing in the
stack terminates TLS itself.

---

## 6. Runtime notes worth knowing

**Node version.** The API runtime image is Bun, not Node — `@trycompai/utils` is
published as raw TypeScript with no build step, and the compiled API imports it
at runtime, so `node` fails with `SyntaxError: Unexpected token '<'`.

For the Next.js images, `node:22-alpine` is correct. Do not pin below 22.12:
Node 20 has no global `navigator` (SSR 500s on the dashboard) and 22.11 lacks
`require(esm)` (Prisma's client generator fails with `ERR_REQUIRE_ESM`). 22.12+
or 20.19.x both work; 22.11 is the one version that satisfies neither.

**Backups.** Comp AI holds compliance records. If you pursue SOC 2 or ISO 27001
with it, your own hosting becomes auditable evidence — RDS with PITR rather than
a Postgres container on EBS is the defensible choice.

---

## 7. AWS cloud-security scanning (the Cloud Tests feature)

45 AWS service adapters, ~80 checks. Worth enabling: when *all* findings for a
service pass, `aws-task-mappings.ts` marks the linked evidence tasks `done` with
the scan as proof — the one path to a higher framework score that isn't just
clicking tasks complete.

It works by assuming a role **twice**: the API's identity assumes a
"role-assumer", which then assumes the audited role. Comp's hosted service uses
two roles across two accounts; self-hosted, **one role does both jobs**.

The first hop sends no `ExternalId` and the second one does, so a single role
works provided its trust policy does not *require* `ExternalId` (a supplied one
is ignored when nothing conditions on it).

```jsonc
// Trust policy on comp-auditor.
// On EC2, prefer the instance role ARN over account root.
{ "Version": "2012-10-17", "Statement": [{
  "Effect": "Allow",
  "Principal": { "AWS": "arn:aws:iam::<ACCT>:role/<instance-role>" },
  "Action": "sts:AssumeRole"
}]}
```

Permissions: managed **`SecurityAudit`** + **`ViewOnlyAccess`**, plus an inline
policy letting it assume *itself* — without this the second hop fails
`AccessDenied`, because a trust policy alone does not authorise the caller:

```json
{ "Version": "2012-10-17", "Statement": [{
  "Effect": "Allow", "Action": "sts:AssumeRole",
  "Resource": "arn:aws:iam::<ACCT>:role/comp-auditor"
}]}
```

Then in `apps/api/.env`:

```
SECURITY_HUB_ROLE_ASSUMER_ARN=arn:aws:iam::<ACCT>:role/comp-auditor
```

Restart the API and connect in the UI with that same ARN, `awsType` =
`aws-commercial`, `externalId` = your organisation id, your regions, and
`awsScanMode` = `comp_scanners`. Watch it land:

```bash
docker compose -f docker-compose.prod.yml logs -f api | grep -i "Validating AWS"
```

Three log lines mean success: assuming role assumer → assuming customer role →
credentials validated. On EC2 no static credentials are needed anywhere; the
instance role is the base of the chain.

## 8. Letting an AI assistant drive compliance (MCP)

`@trycompai/mcp-server` is published on npm and points at any instance via
`--server-url`, so no Gram/OAuth setup is required. It has **two transports, and
which one you need depends on the client**:

| Client | Transport | Command |
|---|---|---|
| Claude Desktop, Claude Code, Cursor | stdio | `mcp start` |
| **claude.ai (web) and the mobile app** | Streamable HTTP | **`mcp serve`** |

### stdio — local clients

Nothing to deploy; the client spawns the process locally.

```json
{ "mcpServers": { "comp": { "command": "npx", "args": [
  "@trycompai/mcp-server", "start",
  "--server-url", "https://api.yourdomain.com",
  "--apikey", "<key from Settings → API keys>"
]}}}
```

### Streamable HTTP — claude.ai and mobile

Web and mobile clients cannot spawn a local process, so they need a reachable
endpoint. The `mcp` service in `docker-compose.prod.yml` runs this
(`StreamableHTTPServerTransport` over Express, port 2718 by default); put it
behind your TLS terminator on e.g. `mcp.yourdomain.com` and add it in claude.ai
as a custom connector.

Two things to settle before exposing it:

- **Auth.** `--no-static-auth` makes the server require credentials per request
  instead of holding a baked-in key. With a baked-in key, anyone who reaches the
  endpoint inherits that key's permissions — so either use `--no-static-auth`
  or keep the endpoint off the public internet. Remote connectors generally
  expect OAuth, which is what the API's better-auth `mcp()` plugin and the
  `GRAM_OAUTH_*` variables exist to provide; wiring that is a separate step.
- **Scope the key hard.** This exposes the compliance API to an AI client over
  the internet. Read-only plus `task:update` is a sensible ceiling.

Untested here: whether claude.ai's custom-connector flow accepts this endpoint's
auth as-is. The stdio path is verified working; treat the remote path as
"supported by the code, needs your auth decision".

The key authenticates through `HybridAuthGuard` (`x-api-key`) and **RBAC applies
to it** — scope it to what the assistant should be allowed to do. Read-only plus
`task:update` lets it progress evidence without rewriting policies. Every call
is recorded by `AuditLogInterceptor`, so machine-driven changes stay auditable.

Note it drives the compliance *workflow* (tasks, evidence, risks, vendors). It
cannot create recurring jobs — those are Trigger.dev schedules defined in code.

## 9. Verifying a deployment

```bash
curl -f https://api.example.com/api/auth/get-session   # 200, body `null`
curl -f https://app.example.com/api/health             # {"status":"ok"}
curl -I https://portal.example.com/                    # 200
docker compose -f docker-compose.prod.yml logs api | grep -i error
```

Then exercise the paths that depend on third parties, because they fail quietly
inside background jobs rather than at boot:

1. Request a magic link → the `send-email` task should report `Success`. A
   failure here is usually an unverified Resend domain.
2. Create an organisation → seeded frameworks, policies and tasks appear.
3. Confirm `_RiskToTask` / `_TaskToVendor` are non-zero — if they are empty,
   Upstash Vector or the OpenAI key is misconfigured.
