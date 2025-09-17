import React, { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { AppApi } from '@/lib/api';
import { Button } from '@/components/ui/button';

const AssetsView: React.FC = () => {
  const { tokens } = useAuth();
  const [assets, setAssets] = useState<Record<string, any>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const PAGE_SIZE = 20;

  const loadAssets = async (reset = false) => {
    const accessToken = tokens.accessToken || '';
    if (!accessToken) return;
    const safeTokens = {
      accessToken: tokens.accessToken || '',
      refreshToken: tokens.refreshToken || '',
      expires: tokens.expires,
      idToken: tokens.idToken || ''
    };

    setIsLoading(true);
    try {
      const nextPage = reset ? 1 : page;
      const res = await AppApi.listAssets(safeTokens, { page: nextPage, limit: PAGE_SIZE });
      const newAssets = res.assets || {};
      if (reset) {
        setAssets(newAssets);
      } else {
        setAssets((prev) => ({ ...prev, ...newAssets }));
      }
      const returnedCount = Object.keys(newAssets).length;
      setHasMore(returnedCount === PAGE_SIZE);
      setPage(nextPage + 1);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAssets(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tokens.accessToken]);

  const items = Object.values(assets) as any[];

  return (
    <div className="w-full h-[calc(100vh-10rem)] p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">Your assets</h3>
        <Button variant="secondary" onClick={() => loadAssets(true)} disabled={isLoading}>{isLoading ? 'Refreshing…' : 'Refresh'}</Button>
      </div>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">No assets yet.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((a) => (
            <div key={a.id} className="border border-border rounded-md p-3 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <div className="text-sm font-medium truncate">{a.id}</div>
                <div className="text-xs px-2 py-0.5 rounded-full border">{a.media_type}</div>
              </div>
              <div className="text-xs text-muted-foreground">Status: {a.status}</div>
              {a.media_type === 'IMAGE' && a.url && (
                <img crossOrigin="anonymous" src={a.url} alt="Image asset" className="w-full rounded border max-h-300" />
              )}
              {a.media_type === 'VIDEO' && a.thumb_url && (
                <img crossOrigin="anonymous" src={a.thumb_url} alt="Video thumbnail" className="rounded border max-h-[300px] object-contain" />
              )}
              {a.url ? (
                <div className="flex gap-2 items-center">
                  <a href={a.url} target="_blank" rel="noreferrer">
                    <Button size="sm">Download</Button>
                  </a>
                </div>
              ) : (
                <div className="text-xs text-muted-foreground">Not ready</div>
              )}
            </div>
          ))}
        </div>
      )}
      {items.length > 0 && hasMore && (
        <div className="flex justify-center mt-4">
          <Button onClick={() => loadAssets(false)} disabled={isLoading}>{isLoading ? 'Loading…' : 'Load more'}</Button>
        </div>
      )}
    </div>
  );
};

export default AssetsView;