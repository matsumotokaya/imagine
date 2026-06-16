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
- **Template Management**: Add, edit, delete, and reorder templates in the gallery
- **Default Image Library**: Upload and manage public image assets available to all users
- **Save As Template**: Convert any banner into a public template from the editor header
- Admin role is set via `profiles.role = 'admin'` in the database

### Data Persistence
- **Auto-save**: 3-second debounce with real-time status indicator
- **Storage**: Supabase PostgreSQL (JSONB for elements)
- **Guest Mode**: Single trial banner in localStorage
- **Image Libraries**: User library (private) + Default library (public)

### Export
- PNG export at original resolution from the editor
- Saved preview assets per banner:
  - `thumbnail_url`: JPEG thumbnail (400px, 70% quality)
  - `fullres_url`: PNG download asset at canvas resolution
- The saved download asset reuses the same PNG export path as the editor download action
- Both saved assets use fixed Storage paths with overwrite semantics, so old revisions do not accumulate

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
```

`VITE_THE_CLUB_R2_BASE_URL` is optional (defaults to the current R2 public endpoint). It is used for the temporary The Club thumbnail preview section.

When local development points at the production Supabase project, keep `VITE_STRIPE_MODE=live` so billing behavior matches production.

For production (Vercel), set these in Project Settings → Environment Variables.

## Database Schema

### Core Tables
- **`profiles`**: User metadata (role, subscription_tier, full_name, avatar_url)
- **`banners`**: User banner data (elements as JSONB, canvas_color, thumbnail_url, fullres_url)
- **`templates`**: Public templates (elements, plan_type: free/premium)
- **`default_images`**: Default image library metadata
- **`user_images`**: User image library metadata

See [docs/DATABASE.md](docs/DATABASE.md) for full schema details.

## Deployment (Vercel)

1. Build command: `npm run build`
2. Output directory: `dist`
3. Set environment variables (see above)
4. Add custom domain via Vercel → Settings → Domains

## Documentation

- [Development Guide](docs/DEVELOPMENT.md) - Architecture, conventions, adding features
- [Performance Guide](docs/PERFORMANCE.md) - React Query cache settings, optimization history
- [Database Schema](docs/DATABASE.md) - Full table definitions and RLS policies

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
