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
  invitation_token?: string;
  joined_at?: string;
  created_at: string;
  updated_at: string;
  // Additional profile fields
  email?: string;
  full_name?: string;
  inviter_name?: string;
  invitation_expires_at?: string;
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

      // Restore previously selected branch from localStorage or use default
      if (branchesData && branchesData.length > 0) {
        const savedBranchId = localStorage.getItem('selectedBranchId');
        let branchToSet: CompanyBranch | null = null;

        // Try to find the saved branch
        if (savedBranchId) {
          branchToSet = branchesData.find(b => b.id === savedBranchId) as CompanyBranch || null;
          console.log('Restoring saved branch:', branchToSet?.branch_name);
        }

        // Fall back to Main Office or first branch if no saved selection
        if (!branchToSet) {
          branchToSet = branchesData.find(b => b.branch_name === 'Main Office') as CompanyBranch || branchesData[0] as CompanyBranch;
          console.log('Using default branch:', branchToSet?.branch_name);
        }

        setCurrentBranch(branchToSet);
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

      // Enhanced user data processing
      const enhancedUsers = await Promise.all(
        (usersData || []).map(async (user) => {
          if (user.status === 'pending') {
            // For pending users, get email from user_invitations using invitation_token
            const { data: invitationData } = await supabase
              .from('user_invitations')
              .select('email, expires_at, invited_by')
              .eq('token', user.invitation_token)
              .maybeSingle();

            // Get inviter data from invited_by UUID (prefer company_users.invited_by, fallback to invitation)
            let inviterData = null;
            const inviterId = user.invited_by || invitationData?.invited_by;
            
            if (inviterId) {
              const { data } = await supabase
                .from('profiles')
                .select('email, full_name')
                .eq('id', inviterId)
                .maybeSingle();
              inviterData = data;
            }

            return {
              ...user,
              email: invitationData?.email || 'Invitation data unavailable',
              full_name: `Pending invitation`,
              inviter_name: inviterData?.full_name || inviterData?.email || 'Unknown',
              invitation_expires_at: invitationData?.expires_at
            };
          } else {
            // For active users, get profile data
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
          }
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

  const deleteBranch = async (branchId: string) => {
    if (!user) {
      toast.error('You must be logged in to delete branches');
      return { error: 'Not authenticated' };
    }

    // Prevent deletion of Main Office
    const branch = branches.find(b => b.id === branchId);
    if (branch?.branch_name === 'Main Office') {
      toast.error('Cannot delete Main Office branch');
      return { error: 'Cannot delete main office' };
    }

    try {
      const { data, error } = await supabase.rpc('delete_branch_with_validation', {
        p_branch_id: branchId
      });

      if (error) {
        console.error('Error deleting branch:', error);
        toast.error('Failed to delete branch');
        return { error };
      }

      const result = data as { 
        success: boolean; 
        error?: string; 
        message: string; 
        action?: string;
      };

      if (!result.success) {
        toast.error(result.message);
        return { error: result.error };
      }

      // Update local state
      if (result.action === 'soft_delete') {
        setBranches(prev => prev.map(b => 
          b.id === branchId ? { ...b, status: 'inactive' as const } : b
        ));
        toast.warning(result.message);
      } else {
        setBranches(prev => prev.filter(b => b.id !== branchId));
        toast.success(result.message);
      }

      // Switch to another branch if current was deleted
      if (currentBranch?.id === branchId) {
        const mainOffice = branches.find(b => b.branch_name === 'Main Office');
        if (mainOffice) {
          setCurrentBranch(mainOffice);
        }
      }

      return { data: result, error: null };
    } catch (err) {
      console.error('Error in deleteBranch:', err);
      toast.error('Failed to delete branch');
      return { error: err };
    }
  };

  const removeUser = async (companyUserId: string, forceDelete: boolean = false) => {
    if (!user) {
      toast.error('You must be logged in to remove users');
      return { error: 'Not authenticated' };
    }

    try {
      const { data, error } = await supabase.rpc('remove_company_user', {
        p_company_user_id: companyUserId,
        p_force_delete: forceDelete
      });

      if (error) {
        console.error('Error removing user:', error);
        toast.error('Failed to remove user');
        return { error };
      }

      const result = data as {
        success: boolean;
        error?: string;
        message: string;
        action?: string;
        requires_confirmation?: boolean;
        pending_assignments?: number;
      };

      if (!result.success) {
        if (result.requires_confirmation) {
          return { error: result.error, data: result };
        }
        toast.error(result.message);
        return { error: result.error };
      }

      // Refresh users list
      await fetchCompanyUsers();
      
      if (result.action === 'deleted_invitation') {
        toast.success(result.message);
      } else {
        toast.warning(result.message);
      }

      return { data: result, error: null };
    } catch (err) {
      console.error('Error in removeUser:', err);
      toast.error('Failed to remove user');
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

      // Let edge function handle all database operations (no frontend pre-insertion)
      try {
        const response = await supabase.functions.invoke('send-user-invitation', {
          body: {
            recipientEmail: email,
            companyName: companyDetails?.company_name || 'Unknown Company',
            companyType: companyType,
            branchName: branchDetails?.branch_name || 'Unknown Branch',
            branchId: branchId,
            companyId: companyId,
            role: role,
            inviterName: currentUserProfile?.full_name || user.email || 'Team Administrator',
            inviterEmail: user.email || ''
          }
        });
        
        if (response.error) {
          throw new Error(response.error.message || 'Failed to send email');
        }
        
        // Handle different response types
        if (response.data?.userExists && response.data?.alreadyInCompany) {
          toast.error('User is already part of this company');
          return { error: 'User already in company' };
        } else if (response.data?.userExists && !response.data?.alreadyInCompany) {
          toast.success(`Existing user invited to join company!`);
        } else {
          toast.success(`New user account created and invitation sent!`);
        }
        
        console.log(`Invitation processed successfully for ${email} for ${role} role in branch ${branchDetails?.branch_name}`);
      } catch (emailError) {
        console.error('Error sending invitation email:', emailError);
        
        // Handle specific error messages
        if (emailError.message?.includes('already been registered') || emailError.message?.includes('User already exists')) {
          toast.error('This email is already registered. Please contact support.');
        } else if (emailError.message?.includes('already part of this company')) {
          toast.error('User is already part of this company');
          return { error: 'User already in company' };
        } else if (emailError.message?.includes('domain')) {
          toast.error(`Email delivery failed: Please verify your domain in Resend dashboard`);
        } else {
          toast.error(`Email delivery failed: ${emailError.message || 'Please check your email configuration'}`);
        }
        // Still show the invitation was created in the system for general errors
        if (!emailError.message?.includes('already')) {
          toast.info(`User invitation created for ${email} (manual follow-up may be needed)`);
        }
      }

      await fetchCompanyUsers(); // Refresh the users list
      return { data: null, error: null };
    } catch (err) {
      console.error('Error in inviteUserToBranch:', err);
      toast.error('Failed to send invitation');
      return { error: err };
    }
  };

  const resendInvitation = async (userEmail: string, branchId: string, role: string) => {
    if (!user || !companyId || !companyType) {
      toast.error('Missing required information to resend invitation');
      return { error: 'Missing required data' };
    }

    try {
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

      // Send invitation email
      const response = await supabase.functions.invoke('send-user-invitation', {
        body: {
          recipientEmail: userEmail,
          companyName: companyDetails?.company_name || 'Unknown Company',
          companyType: companyType,
          branchName: branchDetails?.branch_name || 'Unknown Branch',
          branchId: branchId,
          companyId: companyId,
          role: role,
          inviterName: currentUserProfile?.full_name || user.email || 'Team Administrator',
          inviterEmail: user.email || ''
        }
      });
      
      if (response.error) {
        throw new Error(response.error.message || 'Failed to send email');
      }
      
      // Handle different response types for resend
      if (response.data?.userExists && response.data?.alreadyInCompany) {
        toast.error('User is already part of this company');
        return { error: 'User already in company' };
      } else if (response.data?.userExists && !response.data?.alreadyInCompany) {
        toast.success(`Company invitation resent to ${userEmail}!`);
      } else {
        toast.success(`Invitation resent to ${userEmail}!`);
      }
      
      await fetchCompanyUsers(); // Refresh the users list
      return { data: response.data, error: null };
    } catch (err) {
      console.error('Error resending invitation:', err);
      toast.error('Failed to resend invitation');
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
    deleteBranch,
    removeUser,
    inviteUserToBranch,
    resendInvitation,
    switchBranch,
    refetch: () => {
      fetchBranches();
      fetchCompanyUsers();
    }
  };
};