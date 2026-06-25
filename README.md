# IMAGINE

Browser-based design tool with template and rule-based image generation.

---

## Quick Start

```bash
# Install dependencies
npm install

# Start dev server (http://localhost:5173)
npm run dev

# Build for production
npm run build
```

## Tech Stack

- **Frontend**: React 19.2.0 + Vite + TypeScript
- **Canvas**: Konva.js (react-konva)
- **Styling**: TailwindCSS
- **Backend**: Supabase (Auth, Database, Storage)
- **Cross-service Promo (Temporary)**: The Club wallpaper thumbnail preview (`latest 50` snapshot) shown under the template list, sourced from Cloudflare R2 and linked to `https://whatif-ep.xyz/the-club`
- **Email**:
  - `noreply@whatif-ep.xyz` - Outbound only (Resend SMTP). Password reset, contact form notifications
  - `contact@whatif-ep.xyz` - Inbound. Legal pages contact address. Cloudflare Email Routing → Gmail
  - `imagine@whatif-ep.xyz` - Inbound. Discord account, general use. Cloudflare Email Routing → Gmail. Previously used for STORES contact via LOLIPOP webmail (past emails are no longer accessible)
- **Data Fetching**: React Query (@tanstack/react-query)
- **i18n**: react-i18next (English/Japanese)

## Features

### Canvas Editing
- **Text**: Add/edit text with custom fonts, size, weight, letter spacing, line height
- **Shapes**: Rectangle, circle, triangle, star, heart with fill/stroke controls
- **Images**: Upload to personal library or use default library, drag & drop support
- **Effects**: Shadow (blur, offset X/Y, opacity, color)
- **Transform**: Drag, resize, rotate with visual transformers
- **Multi-selection**: Shift+Click to select multiple elements, group transform/move

### Keyboard Shortcuts
- **Cmd/Ctrl + Z/Y**: Undo/Redo
- **Cmd/Ctrl + C/V**: Copy/Paste
- **Delete/Backspace**: Delete selected element(s)
- **Arrow keys**: Move element (1px normal, 10px with Shift)

### Zoom & Pan
- **Trackpad Pinch**: Zoom in/out (blocks browser zoom)
- **Ctrl/Cmd + Wheel**: Zoom in/out
- **Regular Wheel**: Pan canvas
- **Grab & Drag**: Pan with mouse
- **Fit Button**: Reset view to center

### User Management
- **Authentication**: Google / Apple / Email via Supabase
- **Roles**: `admin` | `user`
- **Subscription**: `free` | `premium` ($3/month via Stripe)

### Admin Features
- **Admin Dashboard** (`/admin`): Storage usage monitoring, user/content stats, Supabase Free plan limits
- **Content Factory** (`/admin/content-factory`): Admin-only workflow board for official work production, wallpaper output planning, and Gallery publish sequencing
  - Project creation auto-generates 3 editable drafts (Portrait / Landscape / Feed). The Cover is **not** an editable draft — it is composed headlessly from the HD wallpaper at Publish time
  - `Work Metadata` is the canonical Gallery metadata for the work itself: `Work Title`, `Release Date`, `Work Tags`, `Summary`
  - `Asset Tags` / `Asset Notes` belong to premium library assets (`default_images`) and are **not** the same as Gallery work metadata
  - **Publish** builds 5 PNG exports (mobile QHD/HD, PC QHD/HD, Instagram feed) + auto-composes the 1600×1600 `package_cover`, saved to `user-images/{userId}/production/{projectId}/`
  - **Cover Lab** (`/admin/cover-lab`): admin preview for tuning the package cover layout (`coverComposer.ts`)
- **Template Management**: Add, edit, delete, and reorder templates in the gallery
- **Default Image Library**: Upload and manage public image assets available to all users
- **Save As Template**: Convert any banner into a public template from the editor header
- Admin role is set via `profiles.role = 'admin'` in the database

### Data Persistence
- **Auto-save**: 3-second debounce with real-time status indicator
- **Storage**: Supabase PostgreSQL (JSONB for elements)
- **Guest Mode**: Single trial banner in localStorage
- **Image Libraries**: User library (private uploads) + Default library (premium and official assets)

### Export
- PNG export at original resolution from the editor
- Saved preview assets per banner:
  - `thumbnail_url`: JPEG thumbnail (400px, 70% quality)
  - `fullres_url`: PNG download asset at canvas resolution
- The saved download asset reuses the same PNG export path as the editor download action
- Both saved assets use fixed Storage paths with overwrite semantics, so old revisions do not accumulate

## Gallery Integration (whatif-ep.xyz ⇄ app.whatif-ep.xyz)

IMAGINE is linked with the WHATIF Gallery (`whatif-ep.xyz`, a Next.js app sharing the same
Supabase project) so a published work can be opened directly in the IMAGINE editor for
non-credit / resize edits.

- **Template promotion**: On Content Factory **Publish**, the project's `instagram_feed`
  banner is promoted to a `premium` row in `templates` (idempotency key
  `templates.production_project_id`), and an `imagine_starter` offer is written into the
  Gallery's `work_offers` with `target_url = https://app.whatif-ep.xyz/banner?template=<id>`.
  The Gallery's "イラストを編集" (Edit in IMAGINE) button then lights up automatically — no
  Gallery code change needed per work.
- **Canonical work sync**: Content Factory also upserts the Gallery's canonical
  `works` / `work_variants` rows, stores `production_projects.work_id` / `variant_id`,
  and republishes `Work Tags` / `Summary` / `Release Date` from the project metadata so
  the Gallery detail sidebar and admin edit screen stay aligned.
- **Direct open** (`/banner?template=<id>`): opens that template through the shared
  `useOpenTemplate` flow (same premium guard as the template gallery). Not logged in →
  redirected to login and returned to the URL; logged-in free → upgrade modal; premium → edit.
- **Cross-subdomain SSO**: Gallery and IMAGINE are different subdomains, so Supabase
  sessions (localStorage) are not shared by default. A shared cookie `wf-sso-token` on
  `.whatif-ep.xyz` carries the Supabase access/refresh tokens: Gallery writes it on
  sign-in / refresh and IMAGINE adopts it via `setSession()` on boot, so no re-login is
  needed. Enabled by setting `VITE_SSO_COOKIE_DOMAIN` (IMAGINE) and
  `NEXT_PUBLIC_SSO_COOKIE_DOMAIN` (Gallery) to `.whatif-ep.xyz` in Vercel. When unset, the
  cookie is host-only and SSO is effectively off (harmless). See [docs/sso-dev.md](docs/sso-dev.md)
  for local testing with hosts-based pseudo-subdomains.

  > **Refactoring note — the current SSO is intentionally simple.** It is a pragmatic
  > implementation; a more robust approach exists. Trade-offs to revisit:
  > - The refresh token sits in a **non-HttpOnly** cookie (the SPA must read it in JS),
  >   exposing it to XSS. A future version should use an HttpOnly, server-mediated session.
  > - Both apps run `autoRefreshToken` against the same cookie, so refresh-token rotation
  >   can race when both tabs are open at once. Designate a single refresh owner, or make
  >   IMAGINE read-only of the cookie.
  > - The custom cookie + manual chunk-splitting diverges from Supabase's `@supabase/ssr`
  >   standard. Consider unifying both apps' auth storage on one cookie scheme, moving
  >   IMAGINE onto `@supabase/ssr`, or consolidating both apps onto a single domain.

## Project Structure

```
src/
├── components/         # UI components (Canvas, Sidebar, PropertyPanel, etc.)
├── pages/              # Page components (BannerEditor, BannerManager, TemplateGallery)
├── hooks/              # Custom hooks (useBanners, useTemplates, useZoomControl, etc.)
├── types/              # TypeScript types (template.ts: CanvasElement, TextElement, etc.)
├── utils/              # Utilities (bannerStorage, templateStorage, supabase client)
├── i18n/               # Translation files (en, ja)
└── contexts/           # React contexts (AuthContext)
```

## Environment Variables

Create `.env.local` for local development:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_STRIPE_MODE=live
VITE_STRIPE_PRICE_ID=price_1ThWnuQ2eK2Q8eWbgAEh4fwE
VITE_THE_CLUB_R2_BASE_URL=https://pub-9339dc326a024891a297479881e66962.r2.dev
VITE_SSO_COOKIE_DOMAIN=.whatif-ep.xyz
```

`VITE_THE_CLUB_R2_BASE_URL` is optional (defaults to the current R2 public endpoint). It is used for the temporary The Club thumbnail preview section.

`VITE_SSO_COOKIE_DOMAIN` enables cross-subdomain SSO with the Gallery (see "Gallery Integration"). Set it to `.whatif-ep.xyz` in production. When unset, the SSO cookie is host-only and session sharing is off (harmless for local dev).

When local development points at the production Supabase project, keep `VITE_STRIPE_MODE=live` so billing behavior matches production.

For production (Vercel), set these in Project Settings → Environment Variables.

Supabase Edge Functions also need these secrets for signup / premium notification emails:

```env
RESEND_API_KEY=re_xxx
RESEND_FROM_EMAIL=noreply@whatif-ep.xyz
CONTACT_NOTIFICATION_EMAIL=contact@whatif-ep.xyz
```

## Database Schema

### Core Tables
- **`profiles`**: User metadata (role, subscription_tier, full_name, avatar_url)
- **`banners`**: User banner data (elements as JSONB, canvas_color, thumbnail_url, fullres_url)
- **`templates`**: Public templates (elements, plan_type: free/premium)
- **`default_images`**: Premium image library and official asset metadata
- **`user_images`**: Private user image library metadata

See [docs/DATABASE.md](docs/DATABASE.md) for full schema details.

## Deployment (Vercel)

1. Build command: `npm run build`
2. Output directory: `dist`
3. Set environment variables (see above)
4. Add custom domain via Vercel → Settings → Domains

## Session Note: 2026-06-25

This session shipped the current production baseline for admin workflow and account notification changes.

- Implemented Content Factory authoring defaults:
  - release date defaults to today
  - work title can be prefilled from episode numbering conventions
  - work-tag suggestions/history are easier to reuse
  - default image selection flow favors common official assets such as character cutouts
- Updated Factory Project Manager defaults:
  - list opens on `draft`
  - returns to `draft` after actions
  - default sort is newest registration first
- Expanded Admin Dashboard:
  - premium / free user tiles open a user directory view
  - admin user directory fetch now goes through `get-admin-user-directory`
- Added Resend-based account notifications from Supabase Edge Functions:
  - signup notifications to registrant and `contact@whatif-ep.xyz`
  - premium activation notifications to registrant and admin
- Signup notification timing was corrected:
  - email/password signup no longer sends before verify
  - verified-account notification is sent after email confirmation
  - production behavior was checked against a real account and confirmed to send after verify

Remaining production verification:

- Premium activation notification still needs a real production confirmation run
- The wording of the verified-account welcome mail still reads like immediate signup success and should be revised in a later pass
- Gallery wallpaper purchase notification is implemented on the Gallery webhook side and needs separate production confirmation there

## Documentation

- [Renewal Status](docs/RENEWAL_STATUS.md) - Current checkpoint, next-session restart point, and the unresolved thumbnail-save blocker
- [Schema Alignment](docs/SCHEMA_ALIGNMENT.md) - Production schema audit, canonical schema, and migration rollout order
- [Production Projects](docs/PRODUCTION_PROJECTS.md) - Variant-level package model for Content Factory, editable banners, outputs, and delivery packages
- [Development Guide](docs/DEVELOPMENT.md) - Architecture, conventions, adding features
- [Performance Guide](docs/PERFORMANCE.md) - React Query cache settings, optimization history
- [Database Schema](docs/DATABASE.md) - Full table definitions and RLS policies
- [SSO Dev Testing](docs/sso-dev.md) - Local testing of cross-subdomain session sharing with the Gallery
- [R2 Migration Design](docs/R2_MIGRATION.md) - Cloudflare R2 への画像ストレージ移行設計（未実装・次セッション向け）

## Renewal Note

Current renewal priority is not feature expansion first.  
The immediate focus is `thumbnail save stability + schema alignment + library normalization` so future Content Factory and wallpaper work can proceed on a stable base.

## i18n (Internationalization)

Supported languages: English / Japanese / SC / TC / 韓国語

```typescript
import { useTranslation } from 'react-i18next';

const MyComponent = () => {
  const { t } = useTranslation('editor');
  return <button>{t('download')}</button>;
};
```

Translation files: `/src/i18n/locales/{en,ja}/*.json`

---

## License

Proprietary - All rights reserved
