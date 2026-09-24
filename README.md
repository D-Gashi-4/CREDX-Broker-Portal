# CredX Broker Portal

A static web page for brokers. They structure a bridging deal, see a live Indicative Quote, submit it to CredX by email, and download the client forms. It's built from the Claude Design file `CredX Broker Portal v2.dc.html`.

It needs no build step or server. Open `index.html` in a browser, or host the folder on any static host.

## Hosting

The portal is hosted on Vercel (project `credx-broker-portal`), which is linked to this repo. Every push to `main` redeploys it automatically. It needs no build settings.

## Files

- `js/config.js`: all pricing and settings (rate, fees, LTV limits, loan size limits, terms, submission email, form links). This is the only file to edit for pricing changes.
- `js/calc.js`: the pure deal maths, criteria checks, documents list and plain-text quote. It has no page code.
- `js/app.js`: page state, input handling and actions.
- `css/portal.css`: styles, including the A4 print layout used by "Download Indicative Quote (PDF)".
- `assets/`: the logo and the two client forms.
- `assets/fonts/`: Encode Sans Semi Condensed (headings and buttons). It's self-hosted and limited to the Latin character set and the two weights used (400 and 600), about 47 KB in total. Its licence is in `OFL.txt`.

Broker details and whether the "How to use" guide is hidden are remembered in the browser between visits. Deal details aren't saved.

## Tests

Open `test/calc.test.html` in a browser. It covers the spec case (net £200,000, 12 months, broker fee on, £400,000 security gives gross £245,725.61 at 61.43% LTV, or £225,134.08 over 6 months). It also covers purchase price vs market value, 2nd-charge LTV, Maximise loan, the LTV bands, submission blockers, the two-stage documents list (auction, tenanted, leasehold, 2nd charge and company borrowers) and the reference format.
