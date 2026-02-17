import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import type { COASpec, COASchedule, COASubmission, COAAnalyteResult, COAMethodEquivalency, COAPolicySettings } from '@/components/buyer/coa/coaDemoData';

// ============ BUYER ID RESOLVER ============

export function useBuyerIdResolver() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['buyer-id', user?.id],
    queryFn: async () => {
      if (!user) return null;

      // Check team member first
      const { data: teamMember } = await supabase
        .from('company_users')
        .select('company_id, company_type')
        .eq('profile_id', user.id)
        .eq('company_type', 'buyer')
        .eq('status', 'active')
        .single();

      if (teamMember) {
        return teamMember.company_id;
      }

      // Owner path
      const { data: buyer } = await supabase
        .from('buyers')
        .select('id')
        .eq('profile_id', user.id)
        .single();

      return buyer?.id ?? null;
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
  });
}

// ============ COA SPECIFICATIONS ============

export function useCOASpecifications() {
  const { data: buyerId } = useBuyerIdResolver();
  const queryClient = useQueryClient();

  const specsQuery = useQuery({
    queryKey: ['coa-specifications', buyerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('coa_specifications')
        .select('*')
        .eq('buyer_id', buyerId!)
        .eq('is_active', true)
        .order('category', { ascending: true })
        .order('analyte_name', { ascending: true });
      if (error) throw error;
      return data as any[];
    },
    enabled: !!buyerId,
  });

  const addSpec = useMutation({
    mutationFn: async (spec: Partial<COASpec> & { buyer_id?: string }) => {
      const { data, error } = await supabase
        .from('coa_specifications')
        .insert({
          buyer_id: buyerId!,
          analyte_name: spec.analyte_name!,
          analyte_code: spec.analyte_code!,
          category: spec.category!,
          spec_min: spec.spec_min ?? null,
          spec_max: spec.spec_max ?? null,
          unit: spec.unit!,
          method: spec.method ?? null,
          acceptable_methods: spec.acceptable_methods ?? [],
          action_on_exceed: spec.action_on_exceed ?? 'flag',
          basis: spec.basis ?? null,
          is_active: true,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['coa-specifications', buyerId] });
      toast.success('Specification added');
    },
    onError: (e: Error) => toast.error(`Failed to add spec: ${e.message}`),
  });

  const loadTemplate = useMutation({
    mutationFn: async (specs: Array<{ analyte_name: string; analyte_code: string; category: string; spec_max: number; unit: string; method: string }>) => {
      const rows = specs.map(s => ({
        buyer_id: buyerId!,
        analyte_name: s.analyte_name,
        analyte_code: s.analyte_code,
        category: s.category,
        spec_min: null,
        spec_max: s.spec_max,
        unit: s.unit,
        method: s.method,
        acceptable_methods: [s.method],
        action_on_exceed: 'flag',
        basis: null,
        is_active: true,
      }));
      const { error } = await supabase.from('coa_specifications').insert(rows);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['coa-specifications', buyerId] });
      toast.success('Template loaded');
    },
    onError: (e: Error) => toast.error(`Failed to load template: ${e.message}`),
  });

  const deleteSpec = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('coa_specifications').update({ is_active: false }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['coa-specifications', buyerId] });
      toast.success('Specification removed');
    },
  });

  return { ...specsQuery, addSpec, loadTemplate, deleteSpec, buyerId };
}

// ============ COA SCHEDULES ============

export function useCOASchedules() {
  const { data: buyerId } = useBuyerIdResolver();
  const queryClient = useQueryClient();

  const schedulesQuery = useQuery({
    queryKey: ['coa-schedules', buyerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('coa_schedules')
        .select('*, suppliers(company_name)')
        .eq('buyer_id', buyerId!)
        .neq('status', 'cancelled')
        .order('next_due_date', { ascending: true });
      if (error) throw error;
      return (data || []).map((s: any) => ({
        ...s,
        supplier_name: s.suppliers?.company_name ?? 'Unknown',
      }));
    },
    enabled: !!buyerId,
  });

  const createSchedule = useMutation({
    mutationFn: async (schedule: {
      supplier_id: string;
      frequency: string;
      next_due_date: string;
      product_name?: string;
      grace_period_days?: number;
      auto_remind?: boolean;
      reminder_days_before?: number[];
      notes?: string;
      custom_interval_days?: number;
    }) => {
      const { data, error } = await supabase
        .from('coa_schedules')
        .insert({
          buyer_id: buyerId!,
          supplier_id: schedule.supplier_id,
          frequency: schedule.frequency,
          next_due_date: schedule.next_due_date,
          product_name: schedule.product_name ?? null,
          grace_period_days: schedule.grace_period_days ?? 3,
          auto_remind: schedule.auto_remind ?? true,
          reminder_days_before: schedule.reminder_days_before ?? [7, 3, 1],
          notes: schedule.notes ?? null,
          custom_interval_days: schedule.custom_interval_days ?? null,
          status: 'active',
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['coa-schedules', buyerId] });
      toast.success('Schedule created');
    },
    onError: (e: Error) => toast.error(`Failed to create schedule: ${e.message}`),
  });

  const updateScheduleStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from('coa_schedules').update({ status }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['coa-schedules', buyerId] });
      toast.success('Schedule updated');
    },
  });

  return { ...schedulesQuery, createSchedule, updateScheduleStatus, buyerId };
}

// ============ COA SUBMISSIONS ============

export function useCOASubmissions() {
  const { data: buyerId } = useBuyerIdResolver();

  return useQuery({
    queryKey: ['coa-submissions', buyerId],
    queryFn: async () => {
      const { data: submissions, error } = await supabase
        .from('coa_submissions')
        .select('*, suppliers(company_name), coa_analyte_results(*)')
        .eq('buyer_id', buyerId!)
        .order('submission_date', { ascending: false });
      if (error) throw error;

      return (submissions || []).map((sub: any) => ({
        id: sub.id,
        supplier_name: sub.suppliers?.company_name ?? 'Unknown',
        supplier_id: sub.supplier_id,
        lot_number: sub.lot_number,
        product_name: sub.product_name,
        submission_date: sub.submission_date,
        analysis_status: sub.analysis_status,
        overall_score: sub.overall_score,
        pass_fail: sub.pass_fail,
        flags_count: sub.flags_count,
        analyte_results: (sub.coa_analyte_results || []).map((r: any) => ({
          id: r.id,
          analyte_name: r.analyte_name,
          analyte_code: r.analyte_code,
          raw_value: r.raw_value,
          numeric_value: r.numeric_value,
          is_censored: r.is_censored,
          censored_type: r.censored_type,
          raw_unit: r.raw_unit,
          normalized_unit: r.normalized_unit,
          raw_method: r.raw_method,
          normalized_method: r.normalized_method,
          spec_min: r.spec_min,
          spec_max: r.spec_max,
          status: r.status,
          flag_reason: r.flag_reason,
          confidence: r.confidence,
          conversion_notes: r.conversion_notes,
        })) as COAAnalyteResult[],
      })) as COASubmission[];
    },
    enabled: !!buyerId,
  });
}

// ============ COA POLICY SETTINGS ============

export function useCOAPolicySettings() {
  const { data: buyerId } = useBuyerIdResolver();
  const queryClient = useQueryClient();

  const policyQuery = useQuery({
    queryKey: ['coa-policy', buyerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('coa_policy_settings')
        .select('*')
        .eq('buyer_id', buyerId!)
        .single();
      if (error && error.code !== 'PGRST116') throw error;
      if (!data) return null;
      return {
        within_spec_is_match: data.within_spec_is_match,
        censored_equivalent_is_match: data.censored_equivalent_is_match,
        require_basis_conversion: data.require_basis_conversion,
        flag_non_convertible_units: data.flag_non_convertible_units,
        auto_flag_unknown_analytes: data.auto_flag_unknown_analytes,
      } as COAPolicySettings;
    },
    enabled: !!buyerId,
  });

  const upsertPolicy = useMutation({
    mutationFn: async (policy: COAPolicySettings) => {
      const { error } = await supabase
        .from('coa_policy_settings')
        .upsert({
          buyer_id: buyerId!,
          ...policy,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'buyer_id' });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['coa-policy', buyerId] });
      toast.success('Policy updated');
    },
    onError: (e: Error) => toast.error(`Failed to update policy: ${e.message}`),
  });

  return { ...policyQuery, upsertPolicy, buyerId };
}

// ============ COA METHOD EQUIVALENCIES ============

export function useCOAMethodEquivalencies() {
  const { data: buyerId } = useBuyerIdResolver();
  const queryClient = useQueryClient();

  const eqQuery = useQuery({
    queryKey: ['coa-equivalencies', buyerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('coa_method_equivalencies')
        .select('*')
        .eq('buyer_id', buyerId!)
        .order('analyte_code');
      if (error) throw error;
      return (data || []) as (COAMethodEquivalency & { buyer_id: string })[];
    },
    enabled: !!buyerId,
  });

  const addEquivalency = useMutation({
    mutationFn: async (eq: Omit<COAMethodEquivalency, 'id'>) => {
      const { error } = await supabase.from('coa_method_equivalencies').insert({
        buyer_id: buyerId!,
        analyte_code: eq.analyte_code,
        method_a: eq.method_a,
        method_b: eq.method_b,
        rule_name: eq.rule_name,
        authority: eq.authority,
        is_active: eq.is_active,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['coa-equivalencies', buyerId] });
      toast.success('Equivalency added');
    },
  });

  const toggleEquivalency = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from('coa_method_equivalencies').update({ is_active }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['coa-equivalencies', buyerId] });
    },
  });

  const deleteEquivalency = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('coa_method_equivalencies').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['coa-equivalencies', buyerId] });
      toast.success('Equivalency removed');
    },
  });

  return { ...eqQuery, addEquivalency, toggleEquivalency, deleteEquivalency, buyerId };
}

// ============ COA OVERVIEW STATS ============

export function useCOAOverviewStats() {
  const { data: buyerId } = useBuyerIdResolver();

  return useQuery({
    queryKey: ['coa-overview-stats', buyerId],
    queryFn: async () => {
      const [subsResult, schedResult] = await Promise.all([
        supabase
          .from('coa_submissions')
          .select('overall_score, pass_fail, flags_count')
          .eq('buyer_id', buyerId!),
        supabase
          .from('coa_schedules')
          .select('status')
          .eq('buyer_id', buyerId!)
          .neq('status', 'cancelled'),
      ]);

      if (subsResult.error) throw subsResult.error;
      if (schedResult.error) throw schedResult.error;

      const subs = subsResult.data || [];
      const scheds = schedResult.data || [];
      const totalSubmissions = subs.length;

      return {
        totalSubmissions,
        passCount: subs.filter(s => s.pass_fail === 'pass').length,
        failCount: subs.filter(s => s.pass_fail === 'fail').length,
        flaggedCount: subs.reduce((acc, s) => acc + (s.flags_count || 0), 0),
        avgScore: totalSubmissions > 0 ? Math.round(subs.reduce((acc, s) => acc + (s.overall_score || 0), 0) / totalSubmissions) : 0,
        overdueSchedules: scheds.filter(s => s.status === 'overdue').length,
        upcomingSchedules: scheds.filter(s => s.status === 'active').length,
      };
    },
    enabled: !!buyerId,
  });
}

// ============ CONNECTED SUPPLIERS (for schedule creation) ============

export function useConnectedSuppliers() {
  const { data: buyerId } = useBuyerIdResolver();

  return useQuery({
    queryKey: ['connected-suppliers-for-coa', buyerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('buyer_supplier_connections')
        .select('supplier_id, suppliers(id, company_name)')
        .eq('buyer_id', buyerId!)
        .eq('status', 'approved');
      if (error) throw error;
      return (data || []).map((c: any) => ({
        id: c.suppliers?.id ?? c.supplier_id,
        company_name: c.suppliers?.company_name ?? 'Unknown',
      }));
    },
    enabled: !!buyerId,
  });
}
