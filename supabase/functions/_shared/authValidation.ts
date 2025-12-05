import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0';

export interface AuthResult {
  user: any;
  profile: any;
  companyUser: any | null;
  buyerId: string | null;
  supplierId: string | null;
  role: string | null;
  isSuperAdmin: boolean;
  isPlatformAdmin: boolean;
}

export interface AuthError {
  status: number;
  message: string;
}

/**
 * Validates JWT and returns user context including company access
 */
export async function validateAuth(
  req: Request,
  supabase: ReturnType<typeof createClient>
): Promise<{ success: true; data: AuthResult } | { success: false; error: AuthError }> {
  const authHeader = req.headers.get('Authorization');
  
  if (!authHeader) {
    return {
      success: false,
      error: { status: 401, message: 'Missing authorization header' }
    };
  }

  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);

  if (authError || !user) {
    return {
      success: false,
      error: { status: 401, message: 'Invalid authentication' }
    };
  }

  // Get profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  // Get user roles
  const { data: userRoles } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id);

  const roles = userRoles?.map(r => r.role) || [];
  const isSuperAdmin = roles.includes('super_admin');
  const isPlatformAdmin = roles.includes('platform_admin');

  // Get company_users record (for team members)
  const { data: companyUser } = await supabase
    .from('company_users')
    .select('*')
    .eq('profile_id', user.id)
    .eq('status', 'active')
    .single();

  // Get buyer ID (either as owner or team member)
  let buyerId: string | null = null;
  if (companyUser?.company_type === 'buyer') {
    buyerId = companyUser.company_id;
  } else {
    const { data: buyer } = await supabase
      .from('buyers')
      .select('id')
      .eq('profile_id', user.id)
      .single();
    buyerId = buyer?.id || null;
  }

  // Get supplier ID (either as owner or team member)
  let supplierId: string | null = null;
  if (companyUser?.company_type === 'supplier') {
    supplierId = companyUser.company_id;
  } else {
    const { data: supplier } = await supabase
      .from('suppliers')
      .select('id')
      .eq('profile_id', user.id)
      .single();
    supplierId = supplier?.id || null;
  }

  return {
    success: true,
    data: {
      user,
      profile,
      companyUser,
      buyerId,
      supplierId,
      role: companyUser?.role || (roles.length > 0 ? roles[0] : null),
      isSuperAdmin,
      isPlatformAdmin
    }
  };
}

/**
 * Validates that user has access to a specific company
 */
export function validateCompanyAccess(
  auth: AuthResult,
  requestedCompanyId: string,
  companyType: 'buyer' | 'supplier'
): boolean {
  // Super admins and platform admins have access to all
  if (auth.isSuperAdmin || auth.isPlatformAdmin) {
    return true;
  }

  // Check if user owns or is a member of the company
  if (companyType === 'buyer') {
    return auth.buyerId === requestedCompanyId;
  } else {
    return auth.supplierId === requestedCompanyId;
  }
}

/**
 * Creates an error response with CORS headers
 */
export function createErrorResponse(
  message: string,
  status: number,
  corsHeaders: Record<string, string>
): Response {
  return new Response(
    JSON.stringify({ error: message }),
    { 
      status, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    }
  );
}
