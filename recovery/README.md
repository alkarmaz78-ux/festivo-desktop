# FESTIVO recovery and screen personalization

This branch preserves the original Worker before making changes and contains the updated build.

## Files
- `recovery/worker-original-2026-11-09.js` — exact Worker source downloaded from Cloudflare before the screen redesign.
- `recovery/worker-personalized-screen-2026-11-09.js` — updated Worker source deployed to Cloudflare Worker `festivo`.
- `recovery/supabase-host-onboard.js` — updated `host-onboard` Edge Function (version 5).
- `recovery/supabase-wishes-feed.js` — updated `wishes-feed` Edge Function (version 4).

## Screen changes
- Message/photo cards use a 2-column × 3-row grid (one independent cell per card); no free-floating positions or crossing paths.
- The screen keeps the six latest visible cards. New approved items replace the oldest visible cards, so the screen stays readable during a busy event.
- The title at the top of the projector screen is editable per event.
- Five event covers are available per event: Birthday, Wedding, Corporate, New Year, and Anniversary.

## How the host changes the screen
Open the host dashboard, find the event card, enter the title that should appear at the top, select the cover, and click **Save screen design**. Settings are stored per event in the existing `public.settings` table.

## Routing
The root URL remains the host login. A root URL with `?event=...` continues to open the guest page directly. Existing Supabase tables, guest page, moderation page, projector page, QR join flow and MP3 sound remain in the Worker bundle.

## Supabase settings added
- `settings.display_title` — text, default `FESTIVO`.
- `settings.display_theme` — text, default `birthday`, constrained to the five supported theme identifiers.

## Recovery note
The Supabase project was paused (INACTIVE) and was restored. Its status subsequently returned to ACTIVE_HEALTHY. The old Cloudflare export-only helper Worker was removed after recovery; the production `festivo` Worker is the updated application.
