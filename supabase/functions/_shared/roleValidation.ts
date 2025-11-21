import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

export type AppRole = 'buyer' | 'supplier' | 'admin' | 'super_admin' | 'company_admin';

export async function validateUserRole(
  supabaseClient: SupabaseClient,
  userId: string,
  requiredRole: AppRole
): Promise<boolean> {
  try {
    const { data, error } = await supabaseClient
      .rpc('has_role', {
        _user_id: userId,
        _role: requiredRole
      });

    if (error) {
      console.error('Error checking role:', error);
      return false;
    }

    return data === true;
  } catch (err) {
    console.error('Exception in validateUserRole:', err);
    return false;
  }
}

export async function requireRole(
  supabaseClient: SupabaseClient,
  userId: string,
  requiredRole: AppRole
): Promise<void> {
  const hasRole = await validateUserRole(supabaseClient, userId, requiredRole);
  
  if (!hasRole) {
    throw new Error(`Unauthorized: User does not have required role '${requiredRole}'`);
  }
}

export async function requireAnyRole(
  supabaseClient: SupabaseClient,
  userId: string,
  requiredRoles: AppRole[]
): Promise<void> {
  for (const role of requiredRoles) {
    const hasRole = await validateUserRole(supabaseClient, userId, role);
    if (hasRole) return;
  }
  
  throw new Error(`Unauthorized: User does not have any of the required roles: ${requiredRoles.join(', ')}`);
}
