interface GuestEditorNoticeModalProps {
  isOpen: boolean;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel: string;
}

// Single-button notice shown to guests when they enter the editor, explaining
// that edited artwork can be downloaded but saving edit data requires login.
// Dismissed by the OK button before they proceed to edit.
export const GuestEditorNoticeModal = ({
  isOpen,
  onConfirm,
  title,
  message,
  confirmLabel,
}: GuestEditorNoticeModalProps) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="border-b border-gray-200 px-6 py-4">
          <h2 className="text-lg font-bold text-gray-900">{title}</h2>
        </div>

        <div className="px-6 py-5">
          <p className="text-sm leading-relaxed text-gray-700">{message}</p>
        </div>

        <div className="px-6 pb-6">
          <button
            onClick={onConfirm}
            className="w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-indigo-700"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
