import { useState, useEffect } from 'react';
import { useSearchParams, Navigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { SidebarProvider } from '@/components/ui/sidebar';
import { BuyerSidebarLayout } from '@/components/buyer/BuyerSidebarLayout';
import { SupplierSidebarLayout } from '@/components/supplier/SupplierSidebarLayout';
import { CommunicationHub } from '@/components/communication/CommunicationHub';

const MessagesPage = () => {
  const { user, loading: authLoading } = useAuth();
  const [searchParams] = useSearchParams();
  const [companyInfo, setCompanyInfo] = useState<{
    id: string;
    type: 'buyer' | 'supplier';
    profile: any;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  // Get initial conversation params from URL
  const initialSupplierId = searchParams.get('supplier');
  const initialBuyerId = searchParams.get('buyer');

  useEffect(() => {
    const resolveCompany = async () => {
      if (!user) {
        setLoading(false);
        return;
      }

      try {
        // Check if user is a buyer (owner or team member)
        const { data: buyerTeamMember } = await supabase
          .from('company_users')
          .select('company_id')
          .eq('profile_id', user.id)
          .eq('company_type', 'buyer')
          .in('status', ['active', 'pending'])
          .maybeSingle();

        if (buyerTeamMember) {
          const { data: buyer } = await supabase
            .from('buyers')
            .select('*')
            .eq('id', buyerTeamMember.company_id)
            .single();
          
          if (buyer) {
            setCompanyInfo({ id: buyer.id, type: 'buyer', profile: buyer });
            setLoading(false);
            return;
          }
        }

        // Check if user is a buyer owner
        const { data: buyerOwner } = await supabase
          .from('buyers')
          .select('*')
          .eq('profile_id', user.id)
          .maybeSingle();

        if (buyerOwner) {
          setCompanyInfo({ id: buyerOwner.id, type: 'buyer', profile: buyerOwner });
          setLoading(false);
          return;
        }

        // Check if user is a supplier (team member)
        const { data: supplierTeamMember } = await supabase
          .from('company_users')
          .select('company_id')
          .eq('profile_id', user.id)
          .eq('company_type', 'supplier')
          .eq('status', 'active')
          .maybeSingle();

        if (supplierTeamMember) {
          const { data: supplier } = await supabase
            .from('suppliers')
            .select('*')
            .eq('id', supplierTeamMember.company_id)
            .single();
          
          if (supplier) {
            setCompanyInfo({ id: supplier.id, type: 'supplier', profile: supplier });
            setLoading(false);
            return;
          }
        }

        // Check if user is a supplier owner
        const { data: supplierOwner } = await supabase
          .from('suppliers')
          .select('*')
          .eq('profile_id', user.id)
          .maybeSingle();

        if (supplierOwner) {
          setCompanyInfo({ id: supplierOwner.id, type: 'supplier', profile: supplierOwner });
          setLoading(false);
          return;
        }

        // No company found
        setCompanyInfo(null);
      } catch (error) {
        console.error('Error resolving company:', error);
        setCompanyInfo(null);
      } finally {
        setLoading(false);
      }
    };

    resolveCompany();
  }, [user]);

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/" replace />;
  }

  if (!companyInfo) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-foreground">No Company Found</h2>
          <p className="text-muted-foreground mt-2">
            Please complete your company setup to access messages.
          </p>
        </div>
      </div>
    );
  }

  return (
    <SidebarProvider>
      <CommunicationHub
        companyId={companyInfo.id}
        companyType={companyInfo.type}
        initialSupplierId={initialSupplierId || undefined}
        initialBuyerId={initialBuyerId || undefined}
      />
    </SidebarProvider>
  );
};

export default MessagesPage;
