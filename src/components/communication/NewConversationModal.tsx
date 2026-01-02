import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { CompanyLogo } from '@/components/ui/CompanyLogo';
import { Search, MessageSquare, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface Company {
  id: string;
  company_name: string;
  company_logo_url?: string | null;
  industry?: string | null;
}

interface NewConversationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId: string;
  companyType: 'buyer' | 'supplier';
  onSelectCompany: (companyId: string) => void;
}

export function NewConversationModal({
  open,
  onOpenChange,
  companyId,
  companyType,
  onSelectCompany
}: NewConversationModalProps) {
  const [search, setSearch] = useState('');
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (open) {
      fetchConnectedCompanies();
    }
  }, [open, companyId, companyType]);

  const fetchConnectedCompanies = async () => {
    setLoading(true);
    try {
      if (companyType === 'buyer') {
        // Fetch connected suppliers for this buyer
        const { data, error } = await supabase
          .from('buyer_supplier_connections')
          .select(`
            supplier_id,
            suppliers:supplier_id (
              id,
              company_name,
              company_logo_url,
              industry
            )
          `)
          .eq('buyer_id', companyId)
          .eq('status', 'approved');

        if (error) throw error;
        
        const suppliers = (data || [])
          .map(d => d.suppliers as Company | null)
          .filter((s): s is Company => s !== null && s.id !== undefined);
        setCompanies(suppliers);
      } else {
        // Fetch connected buyers for this supplier
        const { data, error } = await supabase
          .from('buyer_supplier_connections')
          .select(`
            buyer_id,
            buyers:buyer_id (
              id,
              company_name,
              company_logo_url,
              industry
            )
          `)
          .eq('supplier_id', companyId)
          .eq('status', 'approved');

        if (error) throw error;
        
        const buyers = (data || [])
          .map(d => d.buyers as Company | null)
          .filter((b): b is Company => b !== null && b.id !== undefined);
        setCompanies(buyers);
      }
    } catch (error) {
      console.error('Error fetching companies:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredCompanies = companies.filter(company => {
    if (!search) return true;
    return company.company_name?.toLowerCase().includes(search.toLowerCase()) ||
           company.industry?.toLowerCase().includes(search.toLowerCase());
  });

  const handleSelectCompany = (company: Company) => {
    onSelectCompany(company.id);
    onOpenChange(false);
    setSearch('');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New Conversation</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={`Search ${companyType === 'buyer' ? 'suppliers' : 'buyers'}...`}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          <ScrollArea className="h-[300px]">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : filteredCompanies.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                <MessageSquare className="h-10 w-10 text-muted-foreground/50 mb-3" />
                <p className="text-sm text-muted-foreground">
                  {search 
                    ? 'No companies found' 
                    : `No connected ${companyType === 'buyer' ? 'suppliers' : 'buyers'} yet`
                  }
                </p>
                <p className="text-xs text-muted-foreground/70 mt-1">
                  {!search && `Connect with ${companyType === 'buyer' ? 'suppliers' : 'buyers'} first to message them`}
                </p>
              </div>
            ) : (
              <div className="space-y-1">
                {filteredCompanies.map(company => (
                  <Button
                    key={company.id}
                    variant="ghost"
                    className="w-full justify-start h-auto py-3 px-3"
                    onClick={() => handleSelectCompany(company)}
                  >
                    <div className="flex items-center gap-3 w-full">
                      <CompanyLogo
                        logoUrl={company.company_logo_url}
                        companyName={company.company_name}
                        size="sm"
                      />
                      <div className="flex-1 text-left">
                        <p className="font-medium text-sm">{company.company_name}</p>
                        {company.industry && (
                          <p className="text-xs text-muted-foreground">{company.industry}</p>
                        )}
                      </div>
                      <MessageSquare className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </Button>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
}
