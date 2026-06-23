import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';

export const GalleryTabs = () => {
  const { t } = useTranslation(['banner']);
  const location = useLocation();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const isAdmin = profile?.role === 'admin';

  const tabs = [
    { path: '/', label: t('banner:templatesTab') },
    { path: '/mydesign', label: t('banner:myBannersTab') },
    ...(isAdmin ? [{ path: '/mydesign/factory', label: t('banner:factoryBannersTab') }] : []),
  ];

  return (
    <div className="flex items-center gap-3 mb-6">
      {tabs.map((tab) => {
        const isActive = location.pathname === tab.path;
        return (
          <button
            key={tab.path}
            onClick={() => navigate(tab.path)}
            className={`px-3 sm:px-4 py-2 rounded-full text-[0.7rem] sm:text-sm font-semibold whitespace-nowrap transition-colors ${
              isActive
                ? 'bg-indigo-600 text-white'
                : 'bg-[#2b2b2b] text-gray-300 hover:bg-[#333333]'
            }`}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
};
