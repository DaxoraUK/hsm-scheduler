# Ground Control Vercel and favicon fix

This patch fixes two separate issues:

1. The browser tab referenced `/ground-control-icon.svg`, but the asset was not present, so the old Vite favicon remained visible or cached.
2. Vercel was building commit `9652dac`, where `src/pages/MatchdayPage.jsx` imported `src/lib/engines/operationsIntelligenceEngine.js`, but that engine file had not been pushed in that commit.

After extracting this patch into the project root, run:

```powershell
npm run build
npm run test -- --run tests/regression/vercel-branding-build.test.js

git add index.html public/ground-control-icon.svg public/favicon.svg public/favicon-32x32.png public/apple-touch-icon.png src/lib/engines/operationsIntelligenceEngine.js tests/regression/vercel-branding-build.test.js
git commit -m "Fix Vercel build and add Ground Control favicon"
git push origin main
```

Vercel should redeploy automatically. If it does not, select **Redeploy** after the new commit appears.

The browser can cache favicons aggressively. After deployment, close the old tab and reopen the site, or use a hard refresh.
