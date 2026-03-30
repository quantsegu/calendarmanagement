This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Deploy to Railway (Docker)

This repo includes a `Dockerfile` and `railway.toml` for Railway deployments.

### Required env vars (set in Railway)
- `DATABASE_URL`: Postgres connection string, e.g. `postgresql://USER:PASSWORD@HOST:5432/DBNAME?schema=public`
- `APP_BASE_URL`: your Railway app URL (used for OAuth redirects), e.g. `https://your-app.up.railway.app`
- `APP_PASSWORD`: required in production to enable owner login (shared planner is still public via `/plan/:token`)
- `SESSION_SECRET` (optional): if set, overrides JWT signing key (recommended)

### Database schema provisioning
`railway.toml` runs `prisma db push` on deploy so Railway can boot immediately against Postgres.

After deploying, API docs should be available at `/docs` and the OpenAPI JSON at `/api/openapi`.
