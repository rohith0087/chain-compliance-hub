import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { Resend } from 'https://esm.sh/resend@2.0.0';
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/corsHeaders.ts";

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const resendApiKey = Deno.env.get('RESEND_API_KEY')!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);
const resend = new Resend(resendApiKey);

interface CreateUserRequest {
  email: string;
  full_name: string;
  role: 'company_admin' | 'branch_manager' | 'document_manager' | 'approver' | 'viewer';
  company_id: string;
  company_type: 'buyer' | 'supplier';
  branch_id?: string;
  inviter_name?: string;
  company_name?: string;
  // Dual-role support
  also_grant_other_role?: boolean;
  other_company_id?: string;
  other_company_type?: 'buyer' | 'supplier';
  other_branch_id?: string;
  other_role?: 'company_admin' | 'branch_manager' | 'document_manager' | 'approver' | 'viewer';
  other_company_name?: string;
}

function generateSecurePassword(length: number = 16): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => chars[byte % chars.length]).join('');
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  const preflight = handleCorsPreflightRequest(req);
  if (preflight) return preflight;

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user: invitingUser }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !invitingUser) {
      throw new Error('Invalid authentication token');
    }

    const requestData: CreateUserRequest = await req.json();
    const { 
      email, full_name, role, company_id, company_type, branch_id, inviter_name, company_name,
      also_grant_other_role, other_company_id, other_company_type, other_branch_id, other_role, other_company_name
    } = requestData;

    console.log('Creating user:', { role, company_type, company_id, also_grant_other_role });

    // Validate required fields
    if (!email || !full_name || !role || !company_id || !company_type) {
      throw new Error('Missing required fields: email, full_name, role, company_id, company_type');
    }

    // Validate dual-role fields if enabled
    if (also_grant_other_role) {
      if (!other_company_id || !other_company_type || !other_role) {
        throw new Error('Dual-role enabled but missing other_company_id, other_company_type, or other_role');
      }
      if (other_company_type === company_type) {
        throw new Error('other_company_type must be different from primary company_type');
      }
    }

    // Determine roles for profile - include both if dual-role
    const rolesArray = also_grant_other_role && other_company_type
      ? [company_type, other_company_type]
      : [company_type];

    // Generate random secure password
    const randomPassword = generateSecurePassword(16);

    // Create auth user directly with admin API
    const { data: authData, error: createUserError } = await supabase.auth.admin.createUser({
      email,
      password: randomPassword,
      email_confirm: true, // Auto-confirm email
      user_metadata: {
        full_name,
        company_type,
        role,
        roles: rolesArray, // Pass all roles for trigger
      },
    });

    if (createUserError) {
      console.error('Error creating auth user:', createUserError);
      throw new Error(`Failed to create auth user: ${createUserError.message}`);
    }

    if (!authData.user) {
      throw new Error('Failed to create user account');
    }

    console.log('Auth user created:', authData.user.id);

    // Create profile record with all roles
    const { error: profileError } = await supabase
      .from('profiles')
      .insert({
        id: authData.user.id,
        email: email,
        full_name: full_name,
        roles: rolesArray,
      });

    if (profileError) {
      console.error('Error creating profile:', profileError);
      // Don't throw - continue with user creation
    }

    // Insert primary role into user_roles table
    const { error: roleError } = await supabase
      .from('user_roles')
      .insert({
        user_id: authData.user.id,
        role: company_type,
      });

    if (roleError) {
      console.error('Error creating user role:', roleError);
      // Don't throw - continue with user creation
    }

    // Insert secondary role if dual-role enabled
    if (also_grant_other_role && other_company_type) {
      const { error: otherRoleError } = await supabase
        .from('user_roles')
        .insert({
          user_id: authData.user.id,
          role: other_company_type,
        });

      if (otherRoleError) {
        console.error('Error creating secondary user role:', otherRoleError);
      }
    }

    // Insert primary company_users record
    const { data: companyUserData, error: companyUserError } = await supabase
      .from('company_users')
      .insert({
        profile_id: authData.user.id,
        company_id: company_id,
        company_type: company_type,
        role: role,
        branch_id: branch_id || null,
        invited_by: invitingUser.id,
        status: 'active',
        password_reset_required: true,
        joined_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (companyUserError) {
      console.error('Error creating company_users record:', companyUserError);
      throw new Error(`Failed to create company user record: ${companyUserError.message}`);
    }

    console.log('Primary company user created:', companyUserData?.id);

    // Insert secondary company_users record if dual-role enabled
    let otherCompanyUserData = null;
    if (also_grant_other_role && other_company_id && other_company_type && other_role) {
      const { data: otherData, error: otherCompanyUserError } = await supabase
        .from('company_users')
        .insert({
          profile_id: authData.user.id,
          company_id: other_company_id,
          company_type: other_company_type,
          role: other_role,
          branch_id: other_branch_id || null,
          invited_by: invitingUser.id,
          status: 'active',
          password_reset_required: true,
          joined_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (otherCompanyUserError) {
        console.error('Error creating secondary company_users record:', otherCompanyUserError);
        // Don't throw - primary creation succeeded
      } else {
        otherCompanyUserData = otherData;
        console.log('Secondary company user created:', otherCompanyUserData?.id);
      }
    }

    // Build email content
    const dualRoleInfo = also_grant_other_role && other_company_name
      ? `<p>You also have access to <strong>${other_company_name}</strong> as ${other_role?.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}.</p>`
      : '';

    const emailSubject = `Your ${company_name || 'ComplianceFlow'} Account Has Been Created`;
    const emailBody = `
      <h2>Welcome to ComplianceFlow!</h2>
      <p>Hi ${full_name},</p>
      <p>Your account has been created by ${inviter_name || 'an administrator'} at ${company_name || 'the company'}.</p>
      
      <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Role:</strong> ${role.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</p>
      </div>

      ${dualRoleInfo}

      <h3>Getting Started:</h3>
      <ol>
        <li>Visit: <a href="https://compliance.tracer2c.com/">https://compliance.tracer2c.com/</a></li>
        <li>Click "Forgot your password?" on the sign-in page</li>
        <li>Enter your email: <strong>${email}</strong></li>
        <li>Check your inbox for the password reset link</li>
        <li>Set your new password and sign in</li>
      </ol>

      <p>If you have any questions, please contact your administrator.</p>
      
      <p>Welcome to the team!</p>
      <hr>
      <p style="color: #666; font-size: 12px;">The ComplianceFlow Team</p>
    `;

    try {
      await resend.emails.send({
        from: 'Compliance Platform <no-reply@tracer2c.com>',
        to: [email],
        subject: emailSubject,
        html: emailBody,
      });
      console.log('Welcome email sent successfully');
    } catch (emailError) {
      console.error('Error sending email:', emailError);
      // Don't throw - user is created, email is not critical
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: also_grant_other_role 
          ? 'User created with dual-role access. They will receive an email with instructions.'
          : 'User created successfully. They will receive an email with instructions.',
        user: {
          id: authData.user.id,
          email: email,
          full_name: full_name,
        },
        company_users: companyUserData,
        other_company_users: otherCompanyUserData,
        dual_role: also_grant_other_role || false,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in create-company-user function:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'An unexpected error occurred',
      }),
      { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});