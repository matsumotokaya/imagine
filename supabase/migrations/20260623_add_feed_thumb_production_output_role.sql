-- Add the 'feed_thumb' role to production_outputs.
--
-- feed_thumb is a lightweight credited feed thumbnail (~720px long edge, WebP)
-- derived from the instagram_feed output at Publish time. The Gallery list grid
-- consumes it served `unoptimized` so the full 1080x1350 instagram_feed PNG no
-- longer drives Vercel Image Optimization transformations.
--
-- This only widens the existing CHECK constraint; no data backfill is needed.
-- Older published projects without a feed_thumb row keep falling back to the
-- full instagram_feed image in the Gallery (still optimized via next/image).

alter table public.production_outputs
  drop constraint if exists production_outputs_role_check;

alter table public.production_outputs
  add constraint production_outputs_role_check
    check (role in (
      'mobile_qhd',
      'mobile_hd',
      'pc_qhd',
      'pc_hd',
      'instagram_feed',
      'feed_thumb',
      'package_cover',
      'zip'
    ));
