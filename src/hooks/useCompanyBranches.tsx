import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

export interface CompanyBranch {
  id: string;
  company_id: string;
  company_type: 'buyer' | 'supplier';
  branch_name: string;
  location?: string;
  address?: string;
  phone?: string;
  email?: string;
  manager_id?: string;
  status: 'active' | 'inactive';
  created_at: string;
  updated_at: string;
}

export interface CompanyUser {
  id: string;
  profile_id: string;
  company_id: string;
  company_type: 'buyer' | 'supplier';
  branch_id?: string;
  role: string;
  status: 'active' | 'inactive' | 'pending';
  invited_by?: string;
  joined_at?: string;
  created_at: string;
  updated_at: string;
  // Additional profile fields
  email?: string;
  full_name?: string;
  inviter_name?: string;
}

export const useCompanyBranches = (companyId?: string, companyType?: 'buyer' | 'supplier') => {
  const [branches, setBranches] = useState<CompanyBranch[]>([]);
  const [companyUsers, setCompanyUsers] = useState<CompanyUser[]>([]);
  const [currentBranch, setCurrentBranch] = useState<CompanyBranch | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

  const fetchBranches = async () => {
    if (!companyId || !companyType) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const { data: branchesData, error: branchesError } = await supabase
        .from('company_branches')
        .select('*')
        .eq('company_id', companyId)
        .eq('company_type', companyType)
        .eq('status', 'active')
        .order('branch_name', { ascending: true });

      if (branchesError) {
        console.error('Error fetching branches:', branchesError);
        setError('Failed to load branches');
        return;
      }

      setBranches(branchesData as CompanyBranch[] || []);

      // Set default current branch to the first one or Main Office
      if (branchesData && branchesData.length > 0) {
        const mainBranch = branchesData.find(b => b.branch_name === 'Main Office') || branchesData[0];
        setCurrentBranch(mainBranch as CompanyBranch);
      }

    } catch (err) {
      console.error('Error in fetchBranches:', err);
      setError('Failed to load branches');
    } finally {
      setLoading(false);
    }
  };

  const fetchCompanyUsers = async () => {
    if (!companyId || !companyType) return;

    try {
      // First get company users
      const { data: usersData, error: usersError } = await supabase
        .from('company_users')
        .select('*')
        .eq('company_id', companyId)
        .eq('company_type', companyType)
        .order('joined_at', { ascending: false });

      if (usersError) {
        console.error('Error fetching company users:', usersError);
        return;
      }

      // Then get profile data for each user
      const enhancedUsers = await Promise.all(
        (usersData || []).map(async (user) => {
          // Get profile data
          const { data: profileData } = await supabase
            .from('profiles')
            .select('email, full_name')
            .eq('id', user.profile_id)
            .single();

          // Get inviter data if exists
          let inviterData = null;
          if (user.invited_by) {
            const { data } = await supabase
              .from('profiles')
              .select('email, full_name')
              .eq('id', user.invited_by)
              .single();
            inviterData = data;
          }

          return {
            ...user,
            email: profileData?.email || 'No email',
            full_name: profileData?.full_name || 'No name',
            inviter_name: inviterData?.full_name || inviterData?.email || 'Unknown'
          };
        })
      );

      setCompanyUsers(enhancedUsers as CompanyUser[]);
    } catch (err) {
      console.error('Error in fetchCompanyUsers:', err);
    }
  };

  const createBranch = async (branchData: Omit<CompanyBranch, 'id' | 'created_at' | 'updated_at'>) => {
    if (!user) {
      toast.error('You must be logged in to create branches');
      return { error: 'Not authenticated' };
    }

    try {
      const { data, error } = await supabase
        .from('company_branches')
        .insert([branchData])
        .select()
        .single();

      if (error) {
        console.error('Error creating branch:', error);
        toast.error('Failed to create branch');
        return { error };
      }

      setBranches(prev => [...prev, data as CompanyBranch]);
      toast.success('Branch created successfully');
      return { data, error: null };
    } catch (err) {
      console.error('Error in createBranch:', err);
      toast.error('Failed to create branch');
      return { error: err };
    }
  };

  const updateBranch = async (branchId: string, updates: Partial<CompanyBranch>) => {
    if (!user) {
      toast.error('You must be logged in to update branches');
      return { error: 'Not authenticated' };
    }

    try {
      const { data, error } = await supabase
        .from('company_branches')
        .update(updates)
        .eq('id', branchId)
        .select()
        .single();

      if (error) {
        console.error('Error updating branch:', error);
        toast.error('Failed to update branch');
        return { error };
      }

      setBranches(prev => prev.map(b => b.id === branchId ? data as CompanyBranch : b));
      if (currentBranch?.id === branchId) {
        setCurrentBranch(data as CompanyBranch);
      }
      toast.success('Branch updated successfully');
      return { data, error: null };
    } catch (err) {
      console.error('Error in updateBranch:', err);
      toast.error('Failed to update branch');
      return { error: err };
    }
  };

  const inviteUserToBranch = async (email: string, branchId: string, role: string) => {
    if (!user || !companyId || !companyType) {
      toast.error('Missing required information to send invitation');
      return { error: 'Missing required data' };
    }

    try {
      // First, check if a profile exists for this email
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('id, full_name')
        .eq('email', email)
        .single();

      // If profile exists, check if that specific user is already part of the same branch
      if (profileData && !profileError) {
        const { data: existingUser } = await supabase
          .from('company_users')
          .select('*')
          .eq('company_id', companyId)
          .eq('company_type', companyType)
          .eq('profile_id', profileData.id)
          .eq('branch_id', branchId)
          .single();

        if (existingUser) {
          console.log('User already exists in this branch, resending invitation');
          toast.info('User already invited to this branch - resending invitation email');
          // Continue to send email but don't create duplicate record
        }
      }

      // Get current user's profile and branch details for email
      const { data: currentUserProfile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', user.id)
        .single();

      const { data: branchDetails } = await supabase
        .from('company_branches')
        .select('branch_name')
        .eq('id', branchId)
        .single();

      const { data: companyDetails } = await supabase
        .from(companyType === 'buyer' ? 'buyers' : 'suppliers')
        .select('company_name')
        .eq('id', companyId)
        .single();

      // Create database record first (with duplicate handling)
      const invitationData = {
        company_id: companyId,
        company_type: companyType,
        branch_id: branchId,
        role: role as 'company_admin' | 'branch_manager' | 'document_manager' | 'viewer' | 'approver',
        status: 'pending' as const,
        invited_by: user.id,
        profile_id: profileData?.id || '00000000-0000-0000-0000-000000000000'
      };

      let isResendingInvite = false;
      const { error: insertError } = await supabase
        .from('company_users')
        .insert(invitationData);

      if (insertError) {
        // Check if it's a duplicate key constraint violation
        if (insertError.message?.includes('duplicate key') || insertError.code === '23505') {
          console.log('Duplicate invitation detected - this is a resend');
          isResendingInvite = true;
          // Continue to send email despite duplicate record
        } else {
          console.error('Error creating invitation record:', insertError);
          throw insertError;
        }
      }

      // Send invitation email
      try {
        const response = await supabase.functions.invoke('send-user-invitation', {
          body: {
            recipientEmail: email,
            companyName: companyDetails?.company_name || 'Unknown Company',
            companyType: companyType,
            branchName: branchDetails?.branch_name || 'Unknown Branch',
            role: role,
            inviterName: currentUserProfile?.full_name || user.email || 'Team Administrator',
            inviterEmail: user.email || '',
            signupUrl: `${window.location.origin}/auth`
          }
        });
        
        if (response.error) {
          throw new Error(response.error.message || 'Failed to send email');
        }
        
        const actionType = isResendingInvite ? 'resent' : 'sent';
        console.log(`Invitation ${actionType} successfully to ${email} for ${role} role in branch ${branchDetails?.branch_name}`);
        toast.success(`Invitation ${actionType} to ${email} for ${role} role`);
      } catch (emailError) {
        console.error('Error sending invitation email:', emailError);
        // Show specific error message for email delivery issues
        if (emailError.message?.includes('domain')) {
          toast.error(`Email delivery failed: Please verify your domain in Resend dashboard`);
        } else {
          toast.error(`Email delivery failed: ${emailError.message || 'Please check your email configuration'}`);
        }
        // Still show the invitation was created in the system
        toast.info(`User invitation created for ${email} (manual follow-up may be needed)`);
      }

      await fetchCompanyUsers(); // Refresh the users list
      return { data: invitationData, error: null };
    } catch (err) {
      console.error('Error in inviteUserToBranch:', err);
      toast.error('Failed to send invitation');
      return { error: err };
    }
  };

  const switchBranch = (branch: CompanyBranch) => {
    setCurrentBranch(branch);
    toast.success(`Switched to ${branch.branch_name}`);
  };

  useEffect(() => {
    fetchBranches();
    fetchCompanyUsers();
  }, [companyId, companyType]);

  return {
    branches,
    companyUsers,
    currentBranch,
    loading,
    error,
    createBranch,
    updateBranch,
    inviteUserToBranch,
    switchBranch,
    refetch: () => {
      fetchBranches();
      fetchCompanyUsers();
    }
  };
};