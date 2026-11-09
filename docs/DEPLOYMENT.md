# Development Deployment Guide

Deploy this branch, `bootstrap/phase-1`, for development validation only. No production data or real customer images should be used.

## API — SnapDeploy (Docker)

The repository-root `Dockerfile` builds and runs the NestJS API as a standalone Node.js container.

1. Create a free SnapDeploy account using GitHub or email. The provider documents that the free tier does not require a credit card.
2. Connect this private GitHub repository and grant access only if you are comfortable with its GitHub OAuth permissions.
3. Select branch `bootstrap/phase-1` and use the repository root as the Docker build context.
4. Deploy using the root `Dockerfile`.
5. Configure the container's HTTP port as `3001` if the platform asks for one. The application also honors the platform-provided `PORT` environment variable.
6. Verify `https://<container-host>/api/v1/health`; expect JSON with `status: ok`.

Free-tier constraints to plan around: 100 container-hours per month shared across containers, up to four containers, 512 MB RAM per container, and automatic sleep after roughly 15 minutes without traffic. The provider documents wake-up delays of about 60 seconds. Treat this as a test environment, not production hosting. Review current limits before deployment.

## Web — Cloudflare Pages

Create a Pages project connected to the same GitHub repository and branch:
- Root directory: repository root
- Build command: `npm install && npm run build:web`
- Build output directory: `apps/web/out`
- Environment variable: `NEXT_PUBLIC_API_BASE_URL` = the deployed SnapDeploy API base URL (no trailing slash)

After the API is deployed, set `WEB_ORIGIN` on SnapDeploy to the exact Pages deployment origin and redeploy the API. Do not share the demo URL until CORS is restricted to the expected web origin.

## Verification

1. Open `https://<container-host>/api/v1/health`; expect JSON with `status: ok`.
2. Open the Cloudflare Pages URL.
3. Select **Check API connection**; expect a connected status.
4. Inspect browser network requests and container logs for CORS or runtime errors.

## Limitations

This is not production-ready. There is no authentication, database, tenant isolation implementation, inventory persistence, upload workflow, worker, or AI integration yet. Do not enter real customer data or sensitive images. The free container sleeps and has a monthly runtime allowance. Complete the security and release gates in `docs/TEST_PLAN.md` before onboarding users.
