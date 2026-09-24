# CredX Broker Portal

Static site. No build step.

- `index.html` - the portal (self-contained)
- `assets/forms/` - client forms linked from the portal

## Deploy
1. Put these files at the root of your GitHub repo.
2. In Vercel: Add New Project, import the repo, Framework Preset "Other", no build command, output directory `./`.
3. Every push to the main branch redeploys.

## Editing pricing
Search `index.html` for `static CONFIG` to change rates, fees, LTV limits, email and form links.
