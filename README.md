# HookCalc: Crane & Rigging Calculator

One app for crane operators, riggers and lift planners. It works on phones and laptops, and offline after the first visit.

**Calculators:** crane capacity (% of chart with hook block and rigging), sling tension (length and height, angle, or off-centre load), load weight (plate, bar, pipe or tank with liquid, ISMB / HEB / IPE / W sections, volume, pieces), boom and radius with obstacle clearance, ground bearing for outriggers and crawlers with mat size, wind check for big-area loads, centre of gravity with two-point or tandem load share, parts of line, and a unit converter.

**Languages:** English, Hindi (हिन्दी) and Tamil (தமிழ்). Choose on first launch, in Settings, or with the language button on the home screen. Shared lift plans go out in the chosen language.

**Also:** a lift plan with job details and a pre-lift checklist that you can share on WhatsApp or print as a PDF, a field guide (hand signals, sling angle factors, hitches, sling colours, chain and shackle WLL, load chart tips, wind scale, power line distances, golden rules), metric and imperial units, and light and dark themes.

> HookCalc is a calculation aid. Always use the manufacturer's load chart, the rigging tags and your site rules, and have a competent person plan and supervise every lift.

## What is in this repository

| Path | What it is |
|---|---|
| `index.html` | The whole app in one file |
| `manifest.webmanifest`, `sw.js`, `icons/` | Make the app installable and able to work offline |
| `privacy.html` | Privacy policy page (Google Play needs a link to it) |
| `store/` | Play Store texts, icon and feature graphic |
| `src/` | Source code (`i18n.js` holds the Hindi and Tamil text). After editing, run `python3 src/build.py` to rebuild `index.html` and `sw.js` |
| `user-site/` | Files for a second repository, needed in step 3 |
| `.nojekyll` | Tells GitHub Pages to serve the files exactly as they are |

## 1. Put the app online with GitHub Pages
1. Upload everything in this folder to the root of the `Service-` repository: **Add file → Upload files**, drag in all files and folders, then **Commit changes**.
   The upload page sometimes skips files whose names start with a dot. If `.nojekyll` is missing afterwards, use **Add file → Create new file**, name it `.nojekyll`, leave it empty and commit.
2. Open **Settings → Pages**. Under *Build and deployment* choose **Deploy from a branch**, branch **main**, folder **/ (root)**, then **Save**.
3. After a minute or two the app is live at **https://jeffreyrakesh130898-ui.github.io/Service-/**
   On your phone, open it in Chrome, then menu **⋮ → Install app** (or *Add to Home screen*).

## 2. Make the Android app with PWABuilder
1. Go to https://www.pwabuilder.com, paste `https://jeffreyrakesh130898-ui.github.io/Service-/` and press **Start**.
2. Choose **Package for stores → Android → Generate package**. Use:
   - Package ID: `io.github.jeffreyrakesh130898.hookcalc` (it cannot be changed later)
   - App name and launcher name: `HookCalc`
   - Signing key: let PWABuilder create a new one
3. Download the zip. Keep `signing.keystore` and the passwords in `signing-key-info.txt` safe and private. You need them for every update.
4. The zip contains an `.aab` file (this is what you upload to Google Play) and an `assetlinks.json` file.

## 3. Link the website and the app (Digital Asset Links)
Android checks this address: `https://jeffreyrakesh130898-ui.github.io/.well-known/assetlinks.json`.
That is the root of your GitHub Pages domain, and a project repository such as `Service-` cannot serve it. So:
1. Create a new **public** repository named exactly `jeffreyrakesh130898-ui.github.io`.
2. Upload the contents of `user-site/` to it (keep the `.well-known` folder and `.nojekyll`). Turn on Pages for it as in step 1.
3. Replace `.well-known/assetlinks.json` with the one from the PWABuilder zip.
4. After your first upload to Play Console, search the console for **App integrity → App signing**, copy the **SHA-256 certificate fingerprint**, and add it to the `sha256_cert_fingerprints` list (keep the PWABuilder one too).
5. Check that `https://jeffreyrakesh130898-ui.github.io/.well-known/assetlinks.json` opens in a browser.

Without this step the app still works, but shows a browser address bar at the top.

## 4. Publish on Google Play
1. Create a developer account at https://play.google.com/console (one-time fee of US$25 and an identity check).
2. **Create app**: name `HookCalc: Crane & Rigging Calc`, type App, Free.
3. **Store listing**: texts from `store/store-listing.md`, icon `store/play-icon-512.png`, feature graphic `store/feature-graphic.png`, and at least 2 phone screenshots taken on your phone from the installed app.
4. **App content**: privacy policy URL `https://jeffreyrakesh130898-ui.github.io/Service-/privacy.html`; ads: no; data safety: no data collected or shared; content rating questionnaire; target audience 18 and over; category Tools.
5. **Closed test first.** New personal developer accounts must run a closed test with at least 12 testers who stay opted in for 14 days in a row before they can apply for production (Play Console Help, article 14151465). Upload the `.aab` to a closed testing track, invite 15 or more people to be safe, and keep them in the test for the full 14 days.
6. Apply for production access, then create a production release with the `.aab` and roll it out.

## Translations
All app text is in `src/i18n.js` as rows of English, Hindi and Tamil. Before publishing, ask a Hindi-speaking and a Tamil-speaking supervisor who knows crane work to go through every screen in their language, especially the warnings (Do not lift, Overload, sling angle). Fix any wording in `src/i18n.js` and rebuild. Units (t, m, kN) and site terms such as WLL and CG stay as they are.

In Play Console you can also add Hindi and Tamil store listings under **Store presence → Main store listing → Manage translations**.

## Updating the app
Edit the files in `src/`, run `python3 src/build.py`, then upload the new `index.html` and `sw.js`. Phones pick up the new version the next time the app opens. A new Play upload is only needed if you change the app name, icon or package settings.

## Ideas for later
More languages (Telugu, Kannada, Malayalam, Bengali), saved crane load charts, PDF export with a company logo.
