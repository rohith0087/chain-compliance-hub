import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { Resend } from 'https://esm.sh/resend@2.0.0';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const resendApiKey = Deno.env.get('RESEND_API_KEY')!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);
const resend = new Resend(resendApiKey);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CreateUserRequest {
  email: string;
  full_name: string;
  role: 'company_admin' | 'branch_manager' | 'document_manager' | 'approver' | 'viewer';
  company_id: string;
  company_type: 'buyer' | 'supplier';
  branch_id?: string;
  inviter_name?: string;
  company_name?: string;
}

function generateSecurePassword(length: number = 16): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => chars[byte % chars.length]).join('');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

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
    const { email, full_name, role, company_id, company_type, branch_id, inviter_name, company_name } = requestData;

    console.log('Creating user:', { email, role, company_type, company_id });

    // Validate required fields
    if (!email || !full_name || !role || !company_id || !company_type) {
      throw new Error('Missing required fields: email, full_name, role, company_id, company_type');
    }

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

    // Create profile record
    const { error: profileError } = await supabase
      .from('profiles')
      .insert({
        id: authData.user.id,
        email: email,
        full_name: full_name,
        roles: [company_type], // Set as buyer or supplier based on company type
      });

    if (profileError) {
      console.error('Error creating profile:', profileError);
      // Don't throw - continue with user creation
    }

    // Insert into user_roles table
    const { error: roleError } = await supabase
      .from('user_roles')
      .insert({
        user_id: authData.user.id,
        role: company_type, // buyer or supplier
      });

    if (roleError) {
      console.error('Error creating user role:', roleError);
      // Don't throw - continue with user creation
    }

    // Insert into company_users with password_reset_required = true
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

    console.log('Company user created:', companyUserData);

    // Send welcome email with password reset instructions
    const emailSubject = `Your ${company_name || 'ComplianceFlow'} Account Has Been Created`;
    const emailBody = `
      <h2>Welcome to ComplianceFlow!</h2>
      <p>Hi ${full_name},</p>
      <p>Your account has been created by ${inviter_name || 'an administrator'} at ${company_name || 'the company'}.</p>
      
      <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Role:</strong> ${role.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</p>
      </div>

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
      console.log('Welcome email sent to:', email);
    } catch (emailError) {
      console.error('Error sending email:', emailError);
      // Don't throw - user is created, email is not critical
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'User created successfully. They will receive an email with instructions.',
        user: {
          id: authData.user.id,
          email: email,
          full_name: full_name,
        },
        company_users: companyUserData,
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
