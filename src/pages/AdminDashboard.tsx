import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useAdminStats } from '../hooks/useAdminStats';
import { Footer } from '../components/Footer';

const SUPABASE_FREE_STORAGE_BYTES = 1 * 1024 * 1024 * 1024; // 1 GB

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${units[i]}`;
}

function StorageBar({ label, used, limit }: { label: string; used: number; limit: number }) {
  const percent = limit > 0 ? Math.min((used / limit) * 100, 100) : 0;
  const barColor = percent >= 80 ? 'bg-red-500' : percent >= 50 ? 'bg-yellow-500' : 'bg-green-500';

  return (
    <div className="mb-4">
      <div className="flex justify-between items-baseline mb-1.5">
        <span className="text-sm font-medium text-gray-700">{label}</span>
        <span className="text-sm text-gray-500">
          {formatBytes(used)} / {formatBytes(limit)} ({percent.toFixed(1)}%)
        </span>
      </div>
      <div className="w-full h-3 bg-gray-200 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${barColor}`}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="bg-gray-50 rounded-lg p-4 text-center">
      <div className="text-2xl font-bold text-gray-900">{value}</div>
      <div className="text-xs text-gray-500 mt-1">{label}</div>
    </div>
  );
}

export function AdminDashboard() {
  const { user, profile, loading } = useAuth();
  const { data: stats, isLoading: statsLoading, error, refetch } = useAdminStats(user?.id);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-gray-300 border-t-indigo-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  if (profile?.role !== 'admin') {
    return <Navigate to="/" replace />;
  }

  const totalStorageBytes = (stats?.userImagesBytes ?? 0) + (stats?.defaultImagesBytes ?? 0);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <div className="flex-1 max-w-2xl mx-auto w-full px-4 py-12">
        {/* Header */}
        <div className="mb-8">
          <Link to="/" className="text-blue-600 hover:text-blue-700 mb-4 inline-block">
            &larr; Back to Home
          </Link>
          <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
          <p className="text-sm text-gray-500 mt-1">Supabase Free Plan Monitoring</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <span className="material-symbols-outlined text-[20px]">factory</span>
            Operations
          </h2>
          <div className="grid gap-4 md:grid-cols-2">
            <Link
              to="/admin/content-factory"
              className="rounded-xl border border-gray-200 bg-gray-50 p-4 hover:bg-gray-100 transition-colors"
            >
              <div className="text-sm font-semibold text-gray-900">Content Factory</div>
              <p className="mt-2 text-sm text-gray-500 text-pretty">
                公式作品の壁紙・feed・cover 制作フローを管理する admin 画面。
              </p>
            </Link>
            <a
              href="https://supabase.com/dashboard"
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-xl border border-gray-200 bg-gray-50 p-4 hover:bg-gray-100 transition-colors"
            >
              <div className="text-sm font-semibold text-gray-900">Supabase Dashboard</div>
              <p className="mt-2 text-sm text-gray-500 text-pretty">
                storage, bandwidth, jobs の状況を外部ダッシュボードで確認する。
              </p>
            </a>
          </div>
        </div>

        {statsLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-2 border-gray-300 border-t-indigo-500 rounded-full animate-spin" />
          </div>
        ) : error ? (
          <div className="bg-white rounded-xl shadow-sm border border-red-200 p-6 mb-6 text-center">
            <p className="text-red-600 mb-3">Failed to load stats.</p>
            <button
              onClick={() => refetch()}
              className="px-4 py-2 bg-gray-900 text-white text-sm rounded-lg hover:bg-gray-800 transition-colors"
            >
              Retry
            </button>
          </div>
        ) : (
          <>
            {/* Storage Usage */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <span className="material-symbols-outlined text-[20px]">database</span>
                Storage Usage
              </h2>
              <StorageBar
                label="Total Storage"
                used={totalStorageBytes}
                limit={SUPABASE_FREE_STORAGE_BYTES}
              />
              <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t border-gray-100">
                <div>
                  <div className="text-xs text-gray-500">User Images</div>
                  <div className="text-sm font-medium text-gray-900">
                    {formatBytes(stats?.userImagesBytes ?? 0)}
                    <span className="text-gray-400 ml-1">({stats?.totalUserImages ?? 0} files)</span>
                  </div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">Default Images</div>
                  <div className="text-sm font-medium text-gray-900">
                    {formatBytes(stats?.defaultImagesBytes ?? 0)}
                    <span className="text-gray-400 ml-1">({stats?.totalDefaultImages ?? 0} files)</span>
                  </div>
                </div>
              </div>
              <p className="text-xs text-gray-400 mt-4">
                Note: Does not include thumbnails. Bandwidth (2 GB/month limit) must be checked on the Supabase Dashboard.
              </p>
            </div>

            {/* Users */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <span className="material-symbols-outlined text-[20px]">group</span>
                Users
              </h2>
              <div className="grid grid-cols-2 gap-4">
                <StatCard label="Total Users" value={stats?.totalUsers ?? 0} />
                <StatCard label="Premium Users" value={stats?.premiumUsers ?? 0} />
              </div>
            </div>

            {/* Content */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <span className="material-symbols-outlined text-[20px]">dashboard</span>
                Content
              </h2>
              <div className="grid grid-cols-3 gap-4">
                <StatCard label="Banners" value={stats?.totalBanners ?? 0} />
                <StatCard label="Templates" value={stats?.totalTemplates ?? 0} />
                <StatCard label="Images" value={(stats?.totalUserImages ?? 0) + (stats?.totalDefaultImages ?? 0)} />
              </div>
            </div>

            {/* Free Plan Limits Reference */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <span className="material-symbols-outlined text-[20px]">info</span>
                Supabase Free Plan Limits
              </h2>
              <div className="text-sm text-gray-600 space-y-2">
                <div className="flex justify-between">
                  <span>Database</span><span className="font-medium">500 MB</span>
                </div>
                <div className="flex justify-between">
                  <span>Storage</span><span className="font-medium">1 GB</span>
                </div>
                <div className="flex justify-between">
                  <span>Bandwidth</span><span className="font-medium">2 GB / month</span>
                </div>
                <div className="flex justify-between">
                  <span>Edge Function Concurrency</span><span className="font-medium">2</span>
                </div>
                <div className="flex justify-between">
                  <span>MAU</span><span className="font-medium">50,000</span>
                </div>
              </div>
              <a
                href="https://supabase.com/dashboard"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 mt-4 text-sm text-blue-600 hover:text-blue-700"
              >
                Open Supabase Dashboard
                <span className="material-symbols-outlined text-[16px]">open_in_new</span>
              </a>
            </div>
          </>
        )}
      </div>
      <Footer />
    </div>
  );
}
