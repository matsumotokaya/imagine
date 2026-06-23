import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useAdminStats } from '../hooks/useAdminStats';
import { SitePageLayout } from '../components/SitePageLayout';

const GB = 1024 * 1024 * 1024;
const MB = 1024 * 1024;
const SUPABASE_FREE_STORAGE_BYTES = 1 * GB; // 1 GB
const SUPABASE_FREE_DB_BYTES = 500 * MB; // 500 MB

const SUPABASE_PROJECT_REF = 'rgqduwojvylkulhyodqg';
const SUPABASE_PROJECT_URL = `https://supabase.com/dashboard/project/${SUPABASE_PROJECT_REF}`;

function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${units[i]}`;
}

function UsageBar({ label, used, limit, note }: { label: string; used: number; limit: number; note?: string }) {
  const ratio = limit > 0 ? (used / limit) * 100 : 0;
  const width = Math.min(ratio, 100);
  const over = ratio >= 100;
  const barColor = over
    ? 'bg-red-600'
    : ratio >= 80
      ? 'bg-red-500'
      : ratio >= 50
        ? 'bg-yellow-500'
        : 'bg-green-500';

  return (
    <div className="mb-4">
      <div className="flex justify-between items-baseline mb-1.5 gap-2">
        <span className="text-sm font-medium text-gray-700 flex items-center gap-2">
          {label}
          {over && (
            <span className="text-[10px] font-semibold text-white bg-red-600 px-1.5 py-0.5 rounded-full">
              OVER LIMIT
            </span>
          )}
        </span>
        <span className={`text-sm tabular-nums ${over ? 'text-red-600 font-semibold' : 'text-gray-500'}`}>
          {formatBytes(used)} / {formatBytes(limit)} ({ratio.toFixed(1)}%)
        </span>
      </div>
      <div className="w-full h-3 bg-gray-200 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${width}%` }} />
      </div>
      {note && <p className="text-xs text-gray-400 mt-1">{note}</p>}
    </div>
  );
}

function StatTile({ label, value, accent }: { label: string; value: number | string; accent?: boolean }) {
  return (
    <div className={`rounded-lg p-4 text-center ${accent ? 'bg-indigo-50 border border-indigo-100' : 'bg-gray-50'}`}>
      <div className={`font-bold ${accent ? 'text-3xl text-indigo-600' : 'text-2xl text-gray-900'}`}>{value}</div>
      <div className="text-xs text-gray-500 mt-1">{label}</div>
    </div>
  );
}

function Card({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
        <span className="material-symbols-outlined text-[20px]">{icon}</span>
        {title}
      </h2>
      {children}
    </div>
  );
}

function ResourceLink({
  name,
  desc,
  href,
  facts,
}: {
  name: string;
  desc: string;
  href: string;
  facts: string[];
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="block rounded-xl border border-gray-200 bg-gray-50 p-4 hover:bg-gray-100 transition-colors"
    >
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold text-gray-900">{name}</div>
        <span className="material-symbols-outlined text-[16px] text-gray-400">open_in_new</span>
      </div>
      <p className="mt-1 text-xs text-gray-500 text-pretty">{desc}</p>
      <ul className="mt-2 space-y-0.5">
        {facts.map((f) => (
          <li key={f} className="text-xs text-gray-600 flex gap-1.5">
            <span className="text-gray-400">•</span>
            <span>{f}</span>
          </li>
        ))}
      </ul>
    </a>
  );
}

export function AdminDashboard() {
  const { user, profile, loading } = useAuth();
  const { data: stats, isLoading: statsLoading, error, refetch } = useAdminStats(user?.id);

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-[#101010]">
        <div className="w-8 h-8 border-2 border-gray-300 border-t-indigo-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) return <Navigate to="/auth" replace />;
  if (profile?.role !== 'admin') return <Navigate to="/" replace />;

  // Library-table figures (from file_size columns; excludes thumbnails/derived assets).
  const libraryBytes = (stats?.userImagesBytes ?? 0) + (stats?.defaultImagesBytes ?? 0);
  // Real bucket usage (sum of storage.objects sizes); falls back to library figure until the RPC is extended.
  const hasRealStorage = (stats?.storageTotalBytes ?? 0) > 0;
  const storageUsedBytes = hasRealStorage ? stats!.storageTotalBytes : libraryBytes;
  const buckets = stats?.storageBuckets ?? [];
  const freeUsers = Math.max((stats?.totalUsers ?? 0) - (stats?.premiumUsers ?? 0), 0);

  return (
    <SitePageLayout maxWidthClassName="max-w-2xl" mainClassName="py-12 sm:px-6">
      <div>
        {/* Header - on the dark page background, so text must be light */}
        <div className="mb-6">
          <Link to="/" className="text-blue-400 hover:text-blue-300 mb-4 inline-block text-sm">
            &larr; Back to Home
          </Link>
          <h1 className="text-3xl font-bold text-white">Admin Dashboard</h1>
          <p className="text-sm text-gray-400 mt-1">リソース監視 / Supabase・Vercel・Cloudflare R2</p>
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
            {/* 1. Overview - aggregate metrics, Users most prominent */}
            <Card title="概要 (Overview)" icon="insights">
              <div className="mb-4">
                <StatTile label="Total Users" value={stats?.totalUsers ?? 0} accent />
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <StatTile label="Premium Users" value={stats?.premiumUsers ?? 0} />
                <StatTile label="Free Users" value={freeUsers} />
                <StatTile label="Templates" value={stats?.totalTemplates ?? 0} />
                <StatTile label="Banners" value={stats?.totalBanners ?? 0} />
                <StatTile
                  label="Library Images"
                  value={(stats?.totalUserImages ?? 0) + (stats?.totalDefaultImages ?? 0)}
                />
                <StatTile label="Storage Objects" value={stats?.storageTotalObjects ?? 0} />
              </div>
            </Card>

            {/* 2. Current plan */}
            <Card title="現在のプラン" icon="workspace_premium">
              <div className="flex items-center justify-between rounded-lg bg-gray-50 p-4">
                <div>
                  <div className="text-sm text-gray-500">Supabase</div>
                  <div className="text-lg font-bold text-gray-900">Free Plan</div>
                </div>
                <a
                  href={`${SUPABASE_PROJECT_URL}/settings/billing/subscription`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-blue-600 hover:text-blue-700 inline-flex items-center gap-1"
                >
                  プラン詳細
                  <span className="material-symbols-outlined text-[16px]">open_in_new</span>
                </a>
              </div>
              <div className="mt-4 text-sm text-gray-600 grid grid-cols-2 gap-x-6 gap-y-2">
                <div className="flex justify-between"><span>Storage</span><span className="font-medium">1 GB</span></div>
                <div className="flex justify-between"><span>Database</span><span className="font-medium">500 MB</span></div>
                <div className="flex justify-between"><span>Egress / Bandwidth</span><span className="font-medium">5 GB / 月 *</span></div>
                <div className="flex justify-between"><span>MAU</span><span className="font-medium">50,000</span></div>
              </div>
              <p className="text-xs text-gray-400 mt-3">
                * 無料プランの上限は変更されることがあります。最新値・実測は各ダッシュボードで確認してください。
              </p>
            </Card>

            {/* 3. Current resource status */}
            <Card title="現時点のリソース状況 (Supabase)" icon="database">
              <UsageBar
                label="Storage (実バケット使用量)"
                used={storageUsedBytes}
                limit={SUPABASE_FREE_STORAGE_BYTES}
                note={
                  hasRealStorage
                    ? 'storage.objects の実サイズ合計（サムネイル・fullres・production 成果物・孤立ファイルを含む）。'
                    : '※ get_admin_stats が未拡張のため、テーブルの file_size 合計（サムネ等を含まない概算）を表示中。'
                }
              />
              <UsageBar
                label="Database"
                used={stats?.dbSizeBytes ?? 0}
                limit={SUPABASE_FREE_DB_BYTES}
                note="pg_database_size による実測。"
              />

              {/* Per-bucket breakdown (real) */}
              {buckets.length > 0 && (
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <div className="text-xs font-semibold text-gray-500 mb-2">バケット別内訳（実測）</div>
                  <div className="space-y-1.5">
                    {buckets.map((b) => (
                      <div key={b.bucketId} className="flex justify-between text-sm">
                        <span className="text-gray-700">{b.bucketId}</span>
                        <span className="text-gray-900 font-medium tabular-nums">
                          {formatBytes(b.bytes)}
                          <span className="text-gray-400 ml-1">({b.objects} objects)</span>
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Library tables (tracked) vs actual */}
              <div className="mt-4 pt-4 border-t border-gray-100">
                <div className="text-xs font-semibold text-gray-500 mb-2">
                  ライブラリ・テーブル記録（DB行の file_size 合計）
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-xs text-gray-500">user_images</div>
                    <div className="text-sm font-medium text-gray-900">
                      {formatBytes(stats?.userImagesBytes ?? 0)}
                      <span className="text-gray-400 ml-1">({stats?.totalUserImages ?? 0} files)</span>
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">default_images</div>
                    <div className="text-sm font-medium text-gray-900">
                      {formatBytes(stats?.defaultImagesBytes ?? 0)}
                      <span className="text-gray-400 ml-1">({stats?.totalDefaultImages ?? 0} files)</span>
                    </div>
                  </div>
                </div>
                {hasRealStorage && libraryBytes > 0 && (
                  <p className="text-xs text-gray-400 mt-3 text-pretty">
                    テーブル記録 {formatBytes(libraryBytes)} と実バケット {formatBytes(storageUsedBytes)} の差は、
                    サムネイル・fullres・production 成果物・DB行のない孤立ファイルなどです。
                  </p>
                )}
              </div>
            </Card>

            {/* 4. External resources to monitor */}
            <Card title="監視すべき外部リソース" icon="travel_explore">
              <p className="text-sm text-gray-500 mb-4 text-pretty">
                実数をここで取得できないものは、確認先リンクを置いています。
              </p>
              <div className="grid gap-3">
                <ResourceLink
                  name="Supabase Dashboard"
                  desc="Storage / Database / Egress(Bandwidth) / MAU の実測・課金状況。"
                  href={`${SUPABASE_PROJECT_URL}/reports/storage`}
                  facts={[
                    'Storage 1 GB / Database 500 MB',
                    'Egress(帯域) は Reports → Usage で月間転送量を確認',
                    'MAU 50,000（Auth）',
                  ]}
                />
                <ResourceLink
                  name="Vercel"
                  desc="ホスティング。Image Optimization / Transformation と帯域・ビルドの無料枠。"
                  href="https://vercel.com/dashboard/usage"
                  facts={[
                    'Image Transformations に無料枠あり（超過で課金）→ feed 軽量サムネ対策と関連',
                    'Fast Data Transfer / Edge Requests の月間上限',
                    'Usage タブで当月消費を確認',
                  ]}
                />
                <ResourceLink
                  name="Cloudflare R2"
                  desc="The Club 壁紙の配信元（主に Gallery 側 whatif-ep.xyz のリソース）。"
                  href="https://dash.cloudflare.com/?to=/:account/r2"
                  facts={[
                    'ストレージ 10 GB/月 無料、egress 無料',
                    'Class A/B オペレーション数に無料枠',
                    'IMAGINE ではなく Gallery 配信に紐づく',
                  ]}
                />
              </div>
            </Card>

            {/* 5. Operations */}
            <Card title="Operations" icon="factory">
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
                <Link
                  to="/admin/cover-lab"
                  className="rounded-xl border border-gray-200 bg-gray-50 p-4 hover:bg-gray-100 transition-colors"
                >
                  <div className="text-sm font-semibold text-gray-900">Cover Lab</div>
                  <p className="mt-2 text-sm text-gray-500 text-pretty">
                    パッケージカバーのレイアウト調整プレビュー。
                  </p>
                </Link>
              </div>
            </Card>
          </>
        )}
      </div>
    </SitePageLayout>
  );
}
