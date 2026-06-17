import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from './use-toast';
import { useAuth } from './useAuth';

export interface DocumentAssignment {
  id: string;
  document_upload_id: string;
  assigned_to: string;
  assigned_by: string;
  assignment_type: 'review' | 'approve' | 'qa_check' | 'final_sign_off';
  priority: 'low' | 'normal' | 'high' | 'urgent';
  due_date?: string;
  status: 'pending' | 'in_progress' | 'completed' | 'declined';
  notes?: string;
  completed_at?: string;
  created_at: string;
  document?: any;
  assignee?: any;
  assigner?: any;
}

export const useDocumentAssignments = () => {
  const [assignments, setAssignments] = useState<DocumentAssignment[]>([]);
  const [myAssignments, setMyAssignments] = useState<DocumentAssignment[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  const loadAssignments = async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('document_assignments')
        .select(`
          *,
          document:document_uploads!document_assignments_document_upload_id_fkey(
            *,
            request:document_requests!document_uploads_request_id_fkey(
              title,
              document_type
            )
          ),
          assignee:profiles!assigned_to(full_name, email),
          assigner:profiles!assigned_by(full_name, email)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setAssignments(data as any || []);
      setMyAssignments(data?.filter(a => a.assigned_to === user.id) as any || []);
    } catch (error: any) {
      console.error('Error loading assignments:', error);
      toast({
        title: 'Error',
        description: 'Failed to load assignments',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const createAssignment = async (assignment: Partial<DocumentAssignment>) => {
    if (!user) return null;

    try {
      const { data, error } = await supabase
        .from('document_assignments')
        .insert([{
          ...assignment,
          assigned_by: user.id
        } as any])
        .select()
        .single();

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Document assigned successfully'
      });

      await loadAssignments();
      return data;
    } catch (error: any) {
      console.error('Error creating assignment:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to assign document',
        variant: 'destructive'
      });
      return null;
    }
  };

  const updateAssignment = async (id: string, updates: Partial<DocumentAssignment>) => {
    try {
      const { error } = await supabase
        .from('document_assignments')
        .update(updates as any)
        .eq('id', id);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Assignment updated successfully'
      });

      await loadAssignments();
    } catch (error: any) {
      console.error('Error updating assignment:', error);
      toast({
        title: 'Error',
        description: 'Failed to update assignment',
        variant: 'destructive'
      });
    }
  };

  const completeAssignment = async (id: string, notes?: string) => {
    try {
      const { error } = await supabase
        .from('document_assignments')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          notes
        })
        .eq('id', id);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Assignment marked as complete'
      });

      await loadAssignments();
    } catch (error: any) {
      console.error('Error completing assignment:', error);
      toast({
        title: 'Error',
        description: 'Failed to complete assignment',
        variant: 'destructive'
      });
    }
  };

  useEffect(() => {
    loadAssignments();
  }, [user]);

  return {
    assignments,
    myAssignments,
    loading,
    createAssignment,
    updateAssignment,
    completeAssignment,
    refresh: loadAssignments
  };
};
