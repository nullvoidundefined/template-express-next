# template-express-next

## Deployment Notes

- **Vercel root directory**: When deploying the `web-client` to Vercel, set the **Root Directory** to `web-client/` in the Vercel project settings. Vercel checks for `next` in the root `package.json` before running install, but in this monorepo the Next.js dependency lives in `web-client/package.json`. Without setting the root directory, builds will fail with "No Next.js version detected."

  The fix is to either:
  1. Set "Root Directory" to `web-client` in the Vercel dashboard project settings, or
  2. Use `vercel --cwd web-client` or connect the GitHub repo with the root directory set to `web-client` in Vercel's project config.
