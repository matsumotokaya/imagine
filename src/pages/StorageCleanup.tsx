import { useCallback, useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { getSupabase } from '../utils/supabase';
import { SitePageLayout } from '../components/SitePageLayout';

const USER_IMAGES_BUCKET = 'user-images';
const REMOVE_BATCH = 100;

function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${units[i]}`;
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

interface FullresItem {
  path: string;
  bytes: number;
  banner_id: string;
}
interface OrphanItem {
  path: string;
  bytes: number;
}
interface Candidates {
  fullres: FullresItem[];
  fullres_count: number;
  fullres_bytes: number;
  orphans: OrphanItem[];
  orphan_count: number;
  orphan_bytes: number;
}

type PurgeResult = { freed: number; deleted: number; failed: number } | null;

export function StorageCleanup() {
  const { user, profile, loading } = useAuth();
  const [data, setData] = useState<Candidates | null>(null);
  const [loadingData, setLoadingData] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<'fullres' | 'orphans' | null>(null);
  const [result, setResult] = useState<PurgeResult>(null);

  const fetchCandidates = useCallback(async () => {
    setLoadingData(true);
    setError(null);
    try {
      const supabase = await getSupabase();
      const { data: rpc, error: rpcError } = await supabase.rpc('get_storage_cleanup_candidates');
      if (rpcError) throw rpcError;
      const r = rpc as Record<string, unknown>;
      setData({
        fullres: (r.fullres as FullresItem[]) ?? [],
        fullres_count: Number(r.fullres_count ?? 0),
        fullres_bytes: Number(r.fullres_bytes ?? 0),
        orphans: (r.orphans as OrphanItem[]) ?? [],
        orphan_count: Number(r.orphan_count ?? 0),
        orphan_bytes: Number(r.orphan_bytes ?? 0),
      });
    } catch (e) {
      console.error('[StorageCleanup] failed to load candidates:', e);
      setError(e instanceof Error ? e.message : 'Failed to load candidates');
    } finally {
      setLoadingData(false);
    }
  }, []);

  useEffect(() => {
    if (profile?.role === 'admin') fetchCandidates();
  }, [profile?.role, fetchCandidates]);

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-[#101010]">
        <div className="w-8 h-8 border-2 border-gray-300 border-t-indigo-500 rounded-full animate-spin" />
      </div>
    );
  }
  if (!user) return <Navigate to="/auth" replace />;
  if (profile?.role !== 'admin') return <Navigate to="/" replace />;

  // Delete a list of storage object paths in batches. Returns deleted/failed/freed.
  const removeObjects = async (
    items: { path: string; bytes: number }[],
  ): Promise<{ deleted: number; failed: number; freed: number }> => {
    const supabase = await getSupabase();
    let deleted = 0;
    let failed = 0;
    let freed = 0;
    const byPath = new Map(items.map((it) => [it.path, it.bytes]));
    for (const group of chunk(items.map((it) => it.path), REMOVE_BATCH)) {
      const { data: removed, error: remErr } = await supabase.storage.from(USER_IMAGES_BUCKET).remove(group);
      if (remErr) {
        console.error('[StorageCleanup] remove batch error:', remErr);
        failed += group.length;
        continue;
      }
      const removedPaths = (removed ?? []).map((o) => o.name);
      deleted += removedPaths.length;
      failed += group.length - removedPaths.length;
      for (const p of removedPaths) freed += byPath.get(p) ?? 0;
    }
    return { deleted, failed, freed };
  };

  const purgeFullres = async () => {
    if (!data || data.fullres_count === 0) return;
    const ok = window.confirm(
      `fullres ダウンロードキャッシュ ${data.fullres_count} 件（${formatBytes(data.fullres_bytes)}）を削除します。\n` +
        `※ 該当バナーの一覧DLは、エディタで再保存するまで「ダウンロード不可」になります（再生成可能）。\n続行しますか？`,
    );
    if (!ok) return;

    setBusy('fullres');
    setResult(null);
    try {
      const supabase = await getSupabase();
      const res = await removeObjects(data.fullres);
      // Null out fullres_url for the affected banners so the manager reflects the purge.
      const bannerIds = [...new Set(data.fullres.map((f) => f.banner_id).filter(Boolean))];
      for (const ids of chunk(bannerIds, REMOVE_BATCH)) {
        const { error: updErr } = await supabase.from('banners').update({ fullres_url: null }).in('id', ids);
        if (updErr) console.error('[StorageCleanup] failed to null fullres_url:', updErr);
      }
      setResult({ freed: res.freed, deleted: res.deleted, failed: res.failed });
      await fetchCandidates();
    } catch (e) {
      console.error('[StorageCleanup] purge fullres failed:', e);
      setError(e instanceof Error ? e.message : 'Purge failed');
    } finally {
      setBusy(null);
    }
  };

  const purgeOrphans = async () => {
    if (!data || data.orphan_count === 0) return;
    const ok = window.confirm(
      `孤立ファイル ${data.orphan_count} 件（${formatBytes(data.orphan_bytes)}）を削除します。\n` +
        `どのテンプレート/バナーからも参照されていないファイルです。続行しますか？`,
    );
    if (!ok) return;

    setBusy('orphans');
    setResult(null);
    try {
      const res = await removeObjects(data.orphans);
      setResult({ freed: res.freed, deleted: res.deleted, failed: res.failed });
      await fetchCandidates();
    } catch (e) {
      console.error('[StorageCleanup] purge orphans failed:', e);
      setError(e instanceof Error ? e.message : 'Purge failed');
    } finally {
      setBusy(null);
    }
  };

  return (
    <SitePageLayout maxWidthClassName="max-w-2xl" mainClassName="py-12 sm:px-6">
      <div>
        <div className="mb-6">
          <Link to="/admin" className="text-blue-400 hover:text-blue-300 mb-4 inline-block text-sm">
            &larr; Admin Dashboard
          </Link>
          <h1 className="text-3xl font-bold text-white">Storage Cleanup</h1>
          <p className="text-sm text-gray-400 mt-1">user-images バケットの安全な容量削減（管理者専用）</p>
        </div>

        {result && (
          <div className="bg-white rounded-xl shadow-sm border border-green-200 p-4 mb-6">
            <p className="text-sm text-gray-800">
              削除 {result.deleted} 件・解放 <span className="font-semibold">{formatBytes(result.freed)}</span>
              {result.failed > 0 && <span className="text-red-600">（失敗 {result.failed} 件）</span>}
            </p>
          </div>
        )}

        {error && (
          <div className="bg-white rounded-xl shadow-sm border border-red-200 p-4 mb-6">
            <p className="text-sm text-red-600">{error}</p>
            <button
              onClick={fetchCandidates}
              className="mt-2 px-3 py-1.5 bg-gray-900 text-white text-xs rounded-lg hover:bg-gray-800"
            >
              Retry
            </button>
          </div>
        )}

        {loadingData ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-2 border-gray-300 border-t-indigo-500 rounded-full animate-spin" />
          </div>
        ) : (
          data && (
            <>
              {/* fullres cache */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-2 flex items-center gap-2">
                  <span className="material-symbols-outlined text-[20px]">cached</span>
                  fullres ダウンロードキャッシュ
                </h2>
                <p className="text-sm text-gray-500 text-pretty mb-4">
                  バナーのDL用書き出しPNG（再生成可能）。削除すると一覧のDLは再保存まで「ダウンロード不可」になります。
                </p>
                <div className="flex items-center justify-between rounded-lg bg-gray-50 p-4">
                  <div>
                    <div className="text-2xl font-bold text-gray-900">{formatBytes(data.fullres_bytes)}</div>
                    <div className="text-xs text-gray-500 mt-0.5">{data.fullres_count} files</div>
                  </div>
                  <button
                    onClick={purgeFullres}
                    disabled={busy !== null || data.fullres_count === 0}
                    className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center gap-1.5"
                  >
                    <span className="material-symbols-outlined text-[18px]">
                      {busy === 'fullres' ? 'hourglass_empty' : 'delete_sweep'}
                    </span>
                    {busy === 'fullres' ? '削除中…' : 'パージ'}
                  </button>
                </div>
              </div>

              {/* orphans */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-2 flex items-center gap-2">
                  <span className="material-symbols-outlined text-[20px]">scan_delete</span>
                  孤立ファイル
                </h2>
                <p className="text-sm text-gray-500 text-pretty mb-4">
                  user_images / banners / templates / production_outputs のどこからも参照されていないファイル（安全に削除可能）。
                </p>
                <div className="flex items-center justify-between rounded-lg bg-gray-50 p-4">
                  <div>
                    <div className="text-2xl font-bold text-gray-900">{formatBytes(data.orphan_bytes)}</div>
                    <div className="text-xs text-gray-500 mt-0.5">{data.orphan_count} files</div>
                  </div>
                  <button
                    onClick={purgeOrphans}
                    disabled={busy !== null || data.orphan_count === 0}
                    className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center gap-1.5"
                  >
                    <span className="material-symbols-outlined text-[18px]">
                      {busy === 'orphans' ? 'hourglass_empty' : 'delete_sweep'}
                    </span>
                    {busy === 'orphans' ? '削除中…' : 'パージ'}
                  </button>
                </div>
              </div>

              <p className="text-xs text-gray-500 text-pretty">
                削除は元に戻せません。fullres は再保存で、サムネは次回保存時に再生成されます。実行前に Admin Dashboard の
                Storage 使用量も確認してください。
              </p>
            </>
          )
        )}
      </div>
    </SitePageLayout>
  );
}
