import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface PendingDocument {
  id: string;
  title: string;
  supplier_name: string;
  submitted_date: string;
  document_type: string;
  priority: 'high' | 'medium' | 'low';
  request_id: string;
}

export interface ExpiringDocument {
  id: string;
  title: string;
  supplier_name: string;
  expiration_date: string;
  days_until_expiry: number;
  file_name: string;
}

export interface OverdueDocument {
  id: string;
  title: string;
  supplier_name: string;
  due_date: string;
  days_overdue: number;
  status: string;
}

export interface ComplianceIssue {
  supplier_id: string;
  supplier_name: string;
  issue_type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  affected_documents: number;
  risk_score: number;
}

export interface DailyOverviewData {
  pendingApproval: {
    count: number;
    documents: PendingDocument[];
  };
  expiringDocuments: {
    next7Days: { count: number; documents: ExpiringDocument[] };
    next14Days: { count: number; documents: ExpiringDocument[] };
    next30Days: { count: number; documents: ExpiringDocument[] };
  };
  overdueDocuments: {
    count: number;
    documents: OverdueDocument[];
  };
  complianceIssues: {
    count: number;
    issues: ComplianceIssue[];
  };
  urgentRequests: {
    count: number;
    requests: any[];
  };
  dailyHealthScore: number;
}

export const useDailyOverview = (buyerId: string | null) => {
  const [data, setData] = useState<DailyOverviewData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (buyerId) {
      loadDailyOverview();
    }
  }, [buyerId]);

  const loadDailyOverview = async () => {
    if (!buyerId) return;
    
    try {
      setLoading(true);

      // Fetch all data in parallel
      const [
        pendingDocsData,
        expiringDocsData,
        overdueDocsData,
        complianceIssuesData,
        urgentRequestsData
      ] = await Promise.all([
        fetchPendingApprovals(buyerId),
        fetchExpiringDocuments(buyerId),
        fetchOverdueDocuments(buyerId),
        fetchComplianceIssues(buyerId),
        fetchUrgentRequests(buyerId)
      ]);

      // Calculate health score
      const healthScore = calculateHealthScore({
        pendingCount: pendingDocsData.count,
        expiringCount: expiringDocsData.next7Days.count,
        overdueCount: overdueDocsData.count,
        criticalIssues: complianceIssuesData.issues.filter(i => i.severity === 'critical').length,
        highIssues: complianceIssuesData.issues.filter(i => i.severity === 'high').length
      });

      setData({
        pendingApproval: pendingDocsData,
        expiringDocuments: expiringDocsData,
        overdueDocuments: overdueDocsData,
        complianceIssues: complianceIssuesData,
        urgentRequests: urgentRequestsData,
        dailyHealthScore: healthScore
      });
    } catch (error) {
      console.error('Error loading daily overview:', error);
    } finally {
      setLoading(false);
    }
  };

  return { data, loading, refresh: loadDailyOverview };
};

// Helper functions
async function fetchPendingApprovals(buyerId: string) {
  const { data, error } = await supabase
    .from('document_uploads')
    .select(`
      id,
      created_at,
      document_requests!inner(
        id,
        title,
        document_type,
        priority,
        supplier_id,
        suppliers(company_name)
      )
    `)
    .eq('document_requests.buyer_id', buyerId)
    .eq('status', 'pending_review')
    .order('created_at', { ascending: true })
    .limit(10);

  if (error) throw error;

  const documents: PendingDocument[] = (data || []).map((doc: any) => ({
    id: doc.id,
    title: doc.document_requests.title,
    supplier_name: doc.document_requests.suppliers?.company_name || 'Unknown',
    submitted_date: doc.created_at,
    document_type: doc.document_requests.document_type,
    priority: doc.document_requests.priority || 'medium',
    request_id: doc.document_requests.id
  }));

  return {
    count: documents.length,
    documents
  };
}

async function fetchExpiringDocuments(buyerId: string) {
  const now = new Date();
  const next7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const next14Days = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
  const next30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  const { data, error } = await supabase
    .from('document_uploads')
    .select(`
      id,
      expiration_date,
      file_name,
      document_requests!inner(
        title,
        supplier_id,
        suppliers(company_name)
      )
    `)
    .eq('document_requests.buyer_id', buyerId)
    .eq('status', 'approved')
    .not('expiration_date', 'is', null)
    .gte('expiration_date', now.toISOString())
    .lte('expiration_date', next30Days.toISOString())
    .order('expiration_date', { ascending: true });

  if (error) throw error;

  const allDocs = (data || []).map((doc: any) => {
    const expiryDate = new Date(doc.expiration_date);
    const daysUntil = Math.floor((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    
    return {
      id: doc.id,
      title: doc.document_requests.title,
      supplier_name: doc.document_requests.suppliers?.company_name || 'Unknown',
      expiration_date: doc.expiration_date,
      days_until_expiry: daysUntil,
      file_name: doc.file_name
    };
  });

  return {
    next7Days: {
      count: allDocs.filter(d => d.days_until_expiry <= 7).length,
      documents: allDocs.filter(d => d.days_until_expiry <= 7).slice(0, 5)
    },
    next14Days: {
      count: allDocs.filter(d => d.days_until_expiry > 7 && d.days_until_expiry <= 14).length,
      documents: allDocs.filter(d => d.days_until_expiry > 7 && d.days_until_expiry <= 14).slice(0, 5)
    },
    next30Days: {
      count: allDocs.filter(d => d.days_until_expiry > 14 && d.days_until_expiry <= 30).length,
      documents: allDocs.filter(d => d.days_until_expiry > 14 && d.days_until_expiry <= 30).slice(0, 5)
    }
  };
}

async function fetchOverdueDocuments(buyerId: string) {
  const now = new Date();
  
  const { data, error } = await supabase
    .from('document_requests')
    .select(`
      id,
      title,
      due_date,
      status,
      supplier_id,
      suppliers(company_name)
    `)
    .eq('buyer_id', buyerId)
    .lt('due_date', now.toISOString())
    .eq('status', 'pending')
    .order('due_date', { ascending: true })
    .limit(10);

  if (error) throw error;

  const documents: OverdueDocument[] = (data || []).map((doc: any) => {
    const dueDate = new Date(doc.due_date);
    const daysOverdue = Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
    
    return {
      id: doc.id,
      title: doc.title,
      supplier_name: doc.suppliers?.company_name || 'Unknown',
      due_date: doc.due_date,
      days_overdue: daysOverdue,
      status: doc.status
    };
  });

  return {
    count: documents.length,
    documents
  };
}

async function fetchComplianceIssues(buyerId: string) {
  const { data, error } = await supabase
    .from('supplier_performance_metrics')
    .select(`
      supplier_id,
      risk_level,
      risk_score,
      risk_factors,
      overdue_requests,
      expired_documents,
      rejected_requests,
      supplier:suppliers(company_name)
    `)
    .eq('buyer_id', buyerId)
    .in('risk_level', ['high', 'critical'])
    .order('risk_score', { ascending: false })
    .limit(10);

  if (error) throw error;

  const issues: ComplianceIssue[] = (data || []).map((metric: any) => {
    const issueTypes = [];
    if (metric.overdue_requests > 0) issueTypes.push(`${metric.overdue_requests} overdue requests`);
    if (metric.expired_documents > 0) issueTypes.push(`${metric.expired_documents} expired documents`);
    if (metric.rejected_requests > 0) issueTypes.push(`${metric.rejected_requests} rejected documents`);

    return {
      supplier_id: metric.supplier_id,
      supplier_name: metric.supplier?.company_name || 'Unknown',
      issue_type: issueTypes.join(', ') || 'Multiple issues',
      severity: metric.risk_level as 'low' | 'medium' | 'high' | 'critical',
      description: (metric.risk_factors || []).join(', ') || 'Compliance concerns detected',
      affected_documents: metric.overdue_requests + metric.expired_documents,
      risk_score: metric.risk_score || 0
    };
  });

  return {
    count: issues.length,
    issues
  };
}

async function fetchUrgentRequests(buyerId: string) {
  const { data, error } = await supabase
    .from('document_requests')
    .select(`
      id,
      title,
      due_date,
      status,
      priority,
      supplier_id,
      suppliers(company_name)
    `)
    .eq('buyer_id', buyerId)
    .eq('priority', 'high')
    .eq('status', 'pending')
    .order('due_date', { ascending: true })
    .limit(5);

  if (error) throw error;

  return {
    count: data?.length || 0,
    requests: data || []
  };
}

function calculateHealthScore(metrics: {
  pendingCount: number;
  expiringCount: number;
  overdueCount: number;
  criticalIssues: number;
  highIssues: number;
}): number {
  let score = 100;

  // Deduct for pending documents (1 point per document, max 20)
  score -= Math.min(metrics.pendingCount, 20);

  // Deduct for expiring documents (2 points per document, max 20)
  score -= Math.min(metrics.expiringCount * 2, 20);

  // Deduct for overdue documents (5 points per document, max 30)
  score -= Math.min(metrics.overdueCount * 5, 30);

  // Deduct for critical issues (10 points per issue, max 20)
  score -= Math.min(metrics.criticalIssues * 10, 20);

  // Deduct for high issues (5 points per issue, max 10)
  score -= Math.min(metrics.highIssues * 5, 10);

  return Math.max(0, score);
}
