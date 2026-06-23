/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export function useOrganizationFeature(featureKey:string,organizationId?:string,organizationType:'buyer'|'supplier'='buyer'){
  const [enabled,setEnabled]=useState(false);const [loading,setLoading]=useState(Boolean(organizationId));
  useEffect(()=>{let active=true;if(!organizationId){setEnabled(false);setLoading(false);return()=>{active=false;};}
    const load=async()=>{setLoading(true);const client=supabase as any;const [{data:flag,error:flagError},{data:override,error:overrideError}]=await Promise.all([
      client.from('feature_flags').select('default_enabled').eq('key',featureKey).maybeSingle(),
      client.from('organization_feature_flags').select('enabled,expires_at').eq('organization_id',organizationId).eq('organization_type',organizationType).eq('feature_key',featureKey).maybeSingle(),
    ]);if(!active)return;if(flagError||overrideError)setEnabled(false);else if(override&&(!override.expires_at||new Date(override.expires_at)>new Date()))setEnabled(override.enabled===true);else setEnabled(flag?.default_enabled===true);setLoading(false);};
    void load();return()=>{active=false;};
  },[featureKey,organizationId,organizationType]);return{enabled,loading};
}
