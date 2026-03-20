import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AuthButton } from './AuthButton';
import { LanguageSwitcher } from './LanguageSwitcher';
import { ReleaseNotesModal } from './ReleaseNotesModal';

interface HeaderProps {
  onBackToManager?: () => void;
  bannerName?: string;
  bannerId?: string;
  onBannerNameChange?: (newName: string) => void;
  onSaveAsTemplate?: () => void;
  isAdmin?: boolean;
}

export const Header = ({ onBackToManager, bannerName, bannerId, onBannerNameChange, onSaveAsTemplate, isAdmin }: HeaderProps) => {
  const { t } = useTranslation(['banner', 'common', 'auth']);
  const [isEditing, setIsEditing] = useState(false);
  const [editingName, setEditingName] = useState('');
  const [isReleaseNotesOpen, setIsReleaseNotesOpen] = useState(false);

  const handleStartEdit = () => {
    if (bannerName) {
      setEditingName(bannerName);
      setIsEditing(true);
    }
  };

  const handleSaveName = () => {
    if (editingName.trim() && onBannerNameChange) {
      onBannerNameChange(editingName.trim());
    }
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditingName('');
  };

  return (
    <header className="relative z-[70] h-14 md:h-16 bg-[#231b2f] border-b border-[#2b2b2b] flex items-center justify-between px-3 md:px-6">
      <div className="flex items-center gap-2 md:gap-4 overflow-hidden">
        {onBackToManager ? (
          <button
            onClick={onBackToManager}
            className="h-8 md:h-9 px-3 md:px-4 bg-white/20 hover:bg-white/30 rounded-lg flex items-center gap-1.5 md:gap-2 transition-colors flex-shrink-0"
          >
            <svg className="w-4 h-4 md:w-5 md:h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            <span className="text-white text-xs md:text-sm font-medium whitespace-nowrap">{t('banner:saveAndBack')}</span>
          </button>
        ) : (
          <Link to="/"><img src="/logo_imagine_white.svg" alt="imagine" className="h-6 md:h-7 flex-shrink-0" /></Link>
        )}
        {bannerName && (
          <>
            <span className="hidden sm:inline text-white/50">|</span>
            {isEditing ? (
              <input
                type="text"
                value={editingName}
                onChange={(e) => setEditingName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSaveName();
                  if (e.key === 'Escape') handleCancelEdit();
                }}
                onBlur={handleSaveName}
                className="hidden sm:block px-2 py-1 bg-white/90 text-gray-900 rounded border-2 border-white focus:outline-none focus:ring-2 focus:ring-white/50 font-medium text-sm"
                autoFocus
              />
            ) : (
              <div className="hidden sm:flex items-center gap-2 group/title">
                {bannerId && onBannerNameChange ? (
                  <span
                    onClick={handleStartEdit}
                    className="text-white font-medium text-sm md:text-base truncate max-w-[150px] md:max-w-none cursor-text hover:bg-white/10 px-1.5 py-0.5 -mx-1.5 rounded transition-colors"
                  >
                    {bannerName}
                  </span>
                ) : (
                  <span className="text-white font-medium text-sm md:text-base truncate max-w-[150px] md:max-w-none">{bannerName}</span>
                )}
                {isAdmin && bannerId && onSaveAsTemplate && (
                  <button
                    onClick={onSaveAsTemplate}
                    className="ml-2 px-3 py-1 bg-purple-600 hover:bg-purple-700 text-white text-xs font-medium rounded transition-colors flex items-center gap-1"
                    title="テンプレートに登録"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                    </svg>
                    <span className="hidden md:inline">テンプレート登録</span>
                  </button>
                )}
              </div>
            )}
          </>
        )}
      </div>

      <div className="flex items-center gap-2 md:gap-4 flex-shrink-0">
        <button
          onClick={() => setIsReleaseNotesOpen(true)}
          className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-gray-300 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
        >
          <span className="material-symbols-outlined text-[16px]">new_releases</span>
          <span>Release Notes</span>
        </button>
        <LanguageSwitcher />
        <AuthButton />
      </div>

      <ReleaseNotesModal isOpen={isReleaseNotesOpen} onClose={() => setIsReleaseNotesOpen(false)} />
    </header>
  );
};
