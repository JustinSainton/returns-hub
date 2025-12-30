# RETURNS-HUB KNOWLEDGE BASE

**Generated:** 2025-12-29
**Stack:** Remix + Vite + Prisma + Polaris + Shopify App Remix

## OVERVIEW

Automated returns management for Shopify merchants. Handles return requests, routing rules, shipping labels (Shippo/EasyPost), and customer portal.

## STRUCTURE

```
returns-hub/
├── app/
│   ├── routes/              # Flat routes (@remix-run/fs-routes)
│   │   ├── app.*.tsx        # Admin UI routes
│   │   ├── api.*.tsx        # API endpoints
│   │   └── webhooks.*.tsx   # Shopify webhook handlers
│   ├── services/            # Server-side business logic (*.server.ts)
│   ├── components/          # Polaris-based UI components
│   ├── schemas/             # Zod validation schemas
│   ├── graphql/             # Shopify Admin API queries
│   ├── shopify.server.ts    # Shopify app config (auth, session)
│   └── db.server.ts         # Prisma client singleton
├── extensions/
│   └── return-portal/       # Customer-facing theme extension
├── prisma/
│   └── schema.prisma        # Data models (PostgreSQL)
└── scripts/
    └── deploy.sh            # Fly.io deployment
```

## WHERE TO LOOK

| Task | Location | Pattern |
|------|----------|---------|
| Add admin route | `app/routes/app.{name}.tsx` | Copy app._index.tsx structure |
| Add API endpoint | `app/routes/api.{name}.tsx` | Export loader/action functions |
| Add webhook handler | `app/routes/webhooks.{topic}.tsx` | Use authenticate.webhook |
| Business logic | `app/services/{domain}.server.ts` | Export typed functions |
| GraphQL queries | `app/graphql/{domain}.ts` | Template literal strings |
| New database model | `prisma/schema.prisma` | Then `npm run setup` |

## CODE MAP

| Symbol | Type | Location | Role |
|--------|------|----------|------|
| `shopify` | config | `shopify.server.ts` | Auth, session, API access |
| `prisma` | client | `db.server.ts` | Database operations |
| `authenticate.admin` | function | `shopify.server.ts` | Admin request auth |
| `getReturnStats` | function | `services/returns.server.ts` | Dashboard metrics |
| `createReturnRequest` | function | `services/returns.server.ts` | Core return creation |

## CONVENTIONS

### Routing (CRITICAL)
- **DO NOT** use `<a>` tags → use `Link` from `@remix-run/react` or `@shopify/polaris`
- **DO NOT** use `redirect` from `@remix-run/node` → use `authenticate.admin` redirect helper
- Embedded app requires these for session preservation

### File Naming
- Server-only code: `*.server.ts` (Remix convention)
- Route files: dot-notation (`app.returns.tsx` = `/app/returns`)

### Auth Pattern
```typescript
export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  // admin.graphql() for API calls
  // session.shop for current shop
};
```

### Service Layer
- All DB operations in `services/*.server.ts`
- Return typed data, handle errors
- Use Prisma client from `db.server.ts`

## ANTI-PATTERNS

- **Type suppression**: Never use `as any`, `@ts-ignore`
- **Direct Prisma in routes**: Always go through services
- **Lowercase `<form>`**: Use `<Form>` from Remix for session handling

## DATA MODELS

| Model | Purpose |
|-------|---------|
| `Session` | Shopify OAuth sessions |
| `ShopSettings` | Per-shop configuration |
| `ReturnRequest` | Return request with status workflow |
| `ReturnItem` | Line items in a return |
| `RoutingRule` | Conditional routing to destinations |
| `ReturnDestination` | Warehouse addresses |
| `ShippingLabel` | Generated shipping labels |

## COMMANDS

```bash
npm run dev              # shopify app dev (tunnel + HMR)
npm run build            # remix vite:build
npm run test             # vitest run
npm run test:watch       # vitest (watch mode)
npm run setup            # prisma generate && migrate deploy
npm run deploy           # shopify app deploy
npm run typecheck        # tsc --noEmit
npm run lint             # eslint
```

## DEPLOYMENT

- **Platform**: Fly.io (see `fly.toml`)
- **Database**: PostgreSQL (Fly Postgres)
- **Script**: `./scripts/deploy.sh` (creates app, db, sets secrets)
- **Docker**: Multi-stage build, Node 20 Alpine

## WEBHOOKS

Configured in `shopify.app.toml`:
- `app/uninstalled`, `app/scopes_update`
- `orders/fulfilled`
- `returns/request`, `returns/approve`, `returns/decline`, `returns/close`

## NOTES

- API version: January25 (ApiVersion.January25)
- Uses `v3_routeConfig: true` (Remix future flags enabled)
- Polaris v12 (v13 requires Node 20+)
- Theme extension in `extensions/return-portal/` for customer-facing portal
