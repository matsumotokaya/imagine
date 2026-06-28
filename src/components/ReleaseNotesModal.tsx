interface ReleaseNotesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ReleaseEntry {
  date: string;
  items: string[];
}

const RELEASE_NOTES: ReleaseEntry[] = [
  {
    date: 'June 28, 2026',
    items: [
      'Text Alignment: Select a text element to set left, center, or right alignment from the properties panel — works across multiple lines like Illustrator',
      'New banners now start with a centered, multi-line starter message in English',
      'Editor properties sheet on mobile now peeks from the bottom edge instead of covering the selected object, and slides up when you make a selection',
      'The mobile properties sheet no longer scrolls internally — just drag the whole sheet up or down',
    ],
  },
  {
    date: 'June 17, 2026',
    items: [
      'Unified My Page, Admin Dashboard, and Content Factory under the same header/footer shell as the rest of the site',
      'Adjusted the factory pages to feel less like separate apps and more like part of the main IMAGINE experience',
      'Added a blur slider for image elements in the editor properties panel',
      'Blur now works on PNG cutouts with a cleaner edge treatment to avoid bright white halos',
      'Increased the image blur range so stronger effects are available',
    ],
  },
  {
    date: 'June 16, 2026',
    items: [
      'Free templates and wallpaper downloads are now easier to use without logging in',
      'Guests now see clearer guidance when a feature requires login, such as Likes or premium-only content',
      'Template and design lists now include direct wallpaper download actions',
      'The login page was updated with a simpler layout and clearer plan explanations for Guest, Member, and Premium Member',
    ],
  },
  {
    date: 'April 18, 2026',
    items: [
      'Added a premium-only wallpaper preview section under the template gallery with a latest-50 snapshot from The Club thumbnails',
      'Updated wallpaper preview layout: square thumbnails, 2 columns on mobile and 3 columns on desktop',
      'Refined The Club promo copy and removed the top CTA button in that section',
      'Adjusted the promo description area to use the full section width for cleaner line wrapping',
      'Made the main header sticky and added a right-side hamburger navigation drawer',
      'Added consolidated drawer links for services, legal/site pages, and social channels (mirroring footer-level navigation)',
      'Previous session: improved Image Library performance with paged loading, infinite scroll, transformed preview URLs, and lazy/async image rendering',
    ],
  },
  {
    date: 'March 21, 2026',
    items: [
      'Added Release Notes — this feature you are reading right now',
      'Shadow Generation: Select a PNG image and click "Generate Shadow" to auto-create a black silhouette shadow object placed behind the original at 30% opacity',
      'Fit to Canvas: New button to scale an image to fit the canvas while preserving aspect ratio, centered automatically',
      'Center Alignment: Align selected objects to the horizontal or vertical center of the canvas — works with single or multiple selections',
      'Multi-Selection Editing: Change fill color and opacity across all selected objects at once',
      'Direct Title Editing: Click the design title in the editor header to edit it inline — no pencil button needed',
      'Image Placement: Imported images now appear at the center of the canvas instead of an offset position',
      'Fix: Text element opacity was not reflecting correctly due to a missing memo comparison key',
      'Added 3 new character assets to the default image library',
    ],
  },
];

export const ReleaseNotesModal = ({ isOpen, onClose }: ReleaseNotesModalProps) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative bg-[#1a1a1a] border border-[#2b2b2b] rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#2b2b2b]">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-indigo-400 text-[20px]">new_releases</span>
            <h2 className="text-base font-semibold text-gray-100">Release Notes</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"
          >
            <span className="material-symbols-outlined text-gray-400 text-[20px]">close</span>
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto px-6 py-4 space-y-6">
          {RELEASE_NOTES.map((entry) => (
            <div key={entry.date}>
              <p className="text-xs font-semibold text-indigo-400 uppercase tracking-wider mb-3">
                {entry.date}
              </p>
              <ul className="space-y-2">
                {entry.items.map((item, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-gray-300">
                    <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-indigo-500 flex-shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
