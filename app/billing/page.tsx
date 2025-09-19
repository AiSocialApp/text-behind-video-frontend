'use client'

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

const ENTITLEMENT_RANK: Record<string, number> = { free: 0, starter: 1, pro: 2 };

export default function BillingReturnPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { profile, refreshProfile } = useAuth();
  const initialEntitlementRef = useRef<string | undefined>(profile?.entitlement);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const before = initialEntitlementRef.current;
      const me = await refreshProfile();
      if (cancelled) return;
      const after = me?.entitlement;
      if (before && after && before !== after) {
        const dir = (ENTITLEMENT_RANK[after] ?? 0) > (ENTITLEMENT_RANK[before] ?? 0) ? 'upgraded' : 'downgraded';
        toast({
          title: `You have been ${dir}`,
          description: `Your plan is now ${after[0].toUpperCase()}${after.slice(1)}`,
        });
      }
      router.replace('/app');
    })();
    return () => { cancelled = true; };
  }, [router, refreshProfile, toast]);

  return (
    <div className="min-h-[60vh] flex items-center justify-center text-sm text-muted-foreground">
      Updating your account...
    </div>
  );
}


