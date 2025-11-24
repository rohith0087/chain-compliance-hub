import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0'

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
)

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface UserInvitationRequest {
  recipientEmail: string;
  companyName: string;
  companyType: string;
  branchName: string;
  branchId: string;
  companyId: string;
  role: string;
  inviterName: string;
  inviterEmail: string;
}

function generateSecurePassword(length: number = 12): string {
  const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
  let password = "";
  for (let i = 0; i < length; i++) {
    password += charset.charAt(Math.floor(Math.random() * charset.length));
  }
  return password;
}

async function generateInviteToken(): Promise<string> {
  const buffer = new Uint8Array(32);
  crypto.getRandomValues(buffer);
  return Array.from(buffer, byte => byte.toString(16).padStart(2, '0')).join('');
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { 
      recipientEmail, 
      companyName, 
      companyType,
      branchName,
      branchId,
      companyId,
      role, 
      inviterName, 
      inviterEmail
    }: UserInvitationRequest = await req.json();

    // Get the authenticated user from the JWT token
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: 'Not authenticated' }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user) {
      console.error('Error getting user from token:', userError);
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid authentication token' }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Use the authenticated user's ID as inviter
    const inviterId = user.id;
    console.log("Processing user invitation for:", recipientEmail, "by inviter:", inviterId);

    // Check if user already exists
    const { data: existingUser, error: userCheckError } = await supabase.auth.admin.listUsers();
    const userExists = existingUser?.users?.find(user => user.email === recipientEmail);

    if (userExists) {
      console.log("User already exists:", recipientEmail);
      
      // Check if user is already in this company
      const { data: existingCompanyUser } = await supabase
        .from('company_users')
        .select('*')
        .eq('profile_id', userExists.id)
        .eq('company_id', companyId)
        .eq('company_type', companyType)
        .single();

      if (existingCompanyUser) {
        return new Response(
          JSON.stringify({
            success: false,
            error: "User is already part of this company",
            userExists: true,
            alreadyInCompany: true
          }),
          {
            status: 400,
            headers: { "Content-Type": "application/json", ...corsHeaders }
          }
        );
      }

      // Add existing user to company
      const inviteToken = await generateInviteToken();
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);

      // Check for existing pending invitation (duplicate prevention)
      const { data: existingPendingInvitation } = await supabase
        .from('company_users')
        .select('id, invitation_token')
        .eq('profile_id', userExists.id)
        .eq('company_id', companyId)
        .eq('company_type', companyType)
        .eq('branch_id', branchId)
        .eq('status', 'pending')
        .single();

      let newInviteToken = inviteToken;
      
      if (existingPendingInvitation) {
        console.log('Found existing pending invitation - updating instead of creating duplicate');
        
        // Delete old invitation token if exists
        if (existingPendingInvitation.invitation_token) {
          await supabase
            .from('user_invitations')
            .delete()
            .eq('token', existingPendingInvitation.invitation_token);
        }
        
        // Generate new token for resend
        newInviteToken = await generateInviteToken();
      }

      // Store invitation for existing user FIRST (due to foreign key constraint)
      const tempPassword = generateSecurePassword(); // Generate even for existing users (required by schema)
      const { error: inviteError } = await supabase
        .from('user_invitations')
        .insert({
          token: newInviteToken,
          user_id: userExists.id,
          email: recipientEmail,
          company_id: companyId,
          company_type: companyType,
          branch_id: branchId,
          role: role,
          invited_by: inviterId,
          expires_at: expiresAt.toISOString(),
          temp_password: tempPassword // Schema requires temp_password to be NOT NULL
        });

      if (inviteError) {
        console.error('Error creating user_invitations record:', inviteError);
        throw new Error(`Failed to create invitation: ${inviteError.message}`);
      }

      if (existingPendingInvitation) {
        // Update existing company_users record
        const { error: updateError } = await supabase
          .from('company_users')
          .update({
            invitation_token: newInviteToken,
            invited_by: inviterId,
            updated_at: new Date().toISOString()
          })
          .eq('id', existingPendingInvitation.id);

        if (updateError) {
          console.error('Error updating company_users record:', updateError);
          // Rollback: delete the invitation we just created
          await supabase.from('user_invitations').delete().eq('token', newInviteToken);
          throw new Error(`Failed to update invitation: ${updateError.message}`);
        }
      } else {
        // Create new company_users record for existing user
        const { error: companyUserError } = await supabase
          .from('company_users')
          .insert({
            profile_id: userExists.id,
            company_id: companyId,
            company_type: companyType,
            branch_id: branchId,
            role: role,
            status: 'pending',
            invitation_token: newInviteToken,
            invited_by: inviterId
          });

        if (companyUserError) {
          console.error('Error creating company_users record:', companyUserError);
          // Rollback: delete the invitation we just created
          await supabase.from('user_invitations').delete().eq('token', newInviteToken);
          throw new Error(`Failed to add user to company: ${companyUserError.message}`);
        }
      }

      // Send different email for existing users
      const baseUrl = "https://chain-compliance-hub.lovable.app";
      const roleDisplayName = role.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
      const joinUrl = `${baseUrl}/invite/${newInviteToken}`;

      const htmlContent = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Join ${companyName} - Company Invitation</title>
          </head>
          <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px; text-align: center; margin-bottom: 30px;">
              <h1 style="color: white; margin: 0; font-size: 28px;">You're Invited to Join ${companyName}!</h1>
              <p style="color: white; margin: 10px 0 0 0; font-size: 16px;">A new opportunity awaits</p>
            </div>
            
            <div style="background: #f8f9fa; padding: 25px; border-radius: 8px; margin-bottom: 25px;">
              <h2 style="color: #333; margin-top: 0;">Invitation Details</h2>
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 8px 0; font-weight: 600; color: #555;">Company:</td>
                  <td style="padding: 8px 0;">${companyName}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; font-weight: 600; color: #555;">Branch:</td>
                  <td style="padding: 8px 0;">${branchName}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; font-weight: 600; color: #555;">Role:</td>
                  <td style="padding: 8px 0;">${roleDisplayName}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; font-weight: 600; color: #555;">Invited by:</td>
                  <td style="padding: 8px 0;">${inviterName}</td>
                </tr>
              </table>
            </div>

            <div style="text-align: center; margin: 30px 0;">
              <a href="${joinUrl}" 
                 style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);">
                🏢 Accept Invitation & Join Company
              </a>
              <br>
              <small style="color: #666; font-size: 12px;">This link expires in 7 days</small>
            </div>

            <div style="background: #e3f2fd; padding: 20px; border-radius: 8px; border-left: 4px solid #2196f3;">
              <h3 style="color: #1976d2; margin-top: 0;">What's next:</h3>
              <ol style="margin: 0; padding-left: 20px; color: #1976d2;">
                <li>Click "Accept Invitation & Join Company" above</li>
                <li>Sign in with your existing account credentials</li>
                <li>Complete the setup process</li>
                <li>Start collaborating with your new team!</li>
              </ol>
            </div>

            <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; font-size: 14px; color: #666;">
              <p><strong>Need help?</strong> Contact ${inviterName} at ${inviterEmail}</p>
              <p style="margin-bottom: 0;">This invitation was sent to ${recipientEmail}.</p>
            </div>
          </body>
        </html>
      `;

      const emailResponse = await resend.emails.send({
        from: "Compliance Platform <no-reply@tracer2c.com>",
        to: [recipientEmail],
        subject: `Join ${companyName} - Company Invitation`,
        html: htmlContent,
      });

      if (emailResponse.error) {
        console.error("Failed to send company invitation:", emailResponse.error);
        return new Response(
          JSON.stringify({
            success: false,
            error: "Failed to send invitation email"
          }),
          {
            status: 500,
            headers: { "Content-Type": "application/json", ...corsHeaders }
          }
        );
      }

      return new Response(
        JSON.stringify({
          success: true,
          messageId: emailResponse.data?.id,
          userId: userExists.id,
          message: "Existing user invited to join company",
          userExists: true,
          alreadyInCompany: false
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders }
        }
      );
    }

    // User doesn't exist, create new account
    const tempPassword = generateSecurePassword(16);
    const inviteToken = await generateInviteToken();
    const baseUrl = "https://chain-compliance-hub.lovable.app";

    // Create user account in Supabase Auth
    const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
      email: recipientEmail,
      password: tempPassword,
      email_confirm: true,
      user_metadata: {
        full_name: recipientEmail.split('@')[0], // temporary name
        company_name: companyName,
        invited_by: inviterName,
        requires_password_reset: true,
        invite_token: inviteToken,
        company_id: companyId,
        company_type: companyType,
        branch_id: branchId,
        role: role
      }
    });

    if (authError) {
      console.error('Error creating user account:', authError);
      throw new Error(`Failed to create user account: ${authError.message}`);
    }

    console.log('User account created successfully:', authUser.user.id);

    // Create profile record
    const { error: profileError } = await supabase
      .from('profiles')
      .insert({
        id: authUser.user.id,
        email: recipientEmail,
        full_name: recipientEmail.split('@')[0], // Will be updated on first login
        roles: ['supplier'] // Default role, will be updated based on company
      });

    if (profileError) {
      console.error('Error creating profile:', profileError);
      throw new Error(`Failed to create profile: ${profileError.message}`);
    }

    // Store invitation details for later verification
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days expiry

    // Insert into user_invitations FIRST (due to foreign key constraint)
    const { error: inviteError } = await supabase
      .from('user_invitations')
      .insert({
        token: inviteToken,
        user_id: authUser.user.id,
        email: recipientEmail,
        company_id: companyId,
        company_type: companyType,
        branch_id: branchId,
        role: role,
        invited_by: inviterId,
        expires_at: expiresAt.toISOString(),
        temp_password: tempPassword
      });

    if (inviteError) {
      console.error('Error storing invitation details:', inviteError);
      throw new Error(`Failed to create invitation: ${inviteError.message}`);
    }

    // Create company_users record for new user
    const { error: companyUserError } = await supabase
      .from('company_users')
      .insert({
        profile_id: authUser.user.id,
        company_id: companyId,
        company_type: companyType,
        branch_id: branchId,
        role: role,
        status: 'pending',
        invitation_token: inviteToken,
        invited_by: inviterId
      });

    if (companyUserError) {
      console.error('Error creating company_users record:', companyUserError);
      // Rollback: delete the auth user and invitation
      await supabase.auth.admin.deleteUser(authUser.user.id);
      await supabase.from('user_invitations').delete().eq('token', inviteToken);
      throw new Error(`Failed to create company user: ${companyUserError.message}`);
    }

    const roleDisplayName = role.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    const companyTypeDisplay = companyType === 'buyer' ? 'Buyer Company' : 'Supplier Company';
    const inviteUrl = `${baseUrl}/invite/${inviteToken}`;

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Welcome to ${companyName} - Set Up Your Account</title>
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px; text-align: center; margin-bottom: 30px;">
            <h1 style="color: white; margin: 0; font-size: 28px;">Welcome to ${companyName}!</h1>
            <p style="color: white; margin: 10px 0 0 0; font-size: 16px;">Your account is ready - just set up your password</p>
          </div>
          
          <div style="background: #f8f9fa; padding: 25px; border-radius: 8px; margin-bottom: 25px;">
            <h2 style="color: #333; margin-top: 0;">Your Account Details</h2>
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; font-weight: 600; color: #555;">Email:</td>
                <td style="padding: 8px 0;">${recipientEmail}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; font-weight: 600; color: #555;">Company:</td>
                <td style="padding: 8px 0;">${companyName}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; font-weight: 600; color: #555;">Branch:</td>
                <td style="padding: 8px 0;">${branchName}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; font-weight: 600; color: #555;">Role:</td>
                <td style="padding: 8px 0;">${roleDisplayName}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; font-weight: 600; color: #555;">Invited by:</td>
                <td style="padding: 8px 0;">${inviterName}</td>
              </tr>
            </table>
          </div>

          <div style="background: #fff3cd; padding: 20px; border-radius: 8px; border-left: 4px solid #ffc107; margin-bottom: 25px;">
            <h3 style="color: #856404; margin-top: 0; font-size: 16px;">🔑 Your Temporary Password</h3>
            <p style="color: #856404; margin: 10px 0;">For security, here's your temporary password:</p>
            <div style="background: white; padding: 15px; border-radius: 6px; font-family: monospace; font-size: 14px; color: #333; border: 2px dashed #ffc107; text-align: center; letter-spacing: 1px;">
              <strong>${tempPassword}</strong>
            </div>
            <p style="color: #856404; margin: 10px 0 0 0; font-size: 14px;"><em>You'll be asked to change this when you first log in.</em></p>
          </div>

          <div style="text-align: center; margin: 30px 0;">
            <a href="${inviteUrl}" 
               style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4); margin-bottom: 10px;">
              🚀 Set Up Your Account Now
            </a>
            <br>
            <small style="color: #666; font-size: 12px;">This link expires in 7 days</small>
          </div>

          <div style="background: #e3f2fd; padding: 20px; border-radius: 8px; border-left: 4px solid #2196f3;">
            <h3 style="color: #1976d2; margin-top: 0;">What happens next:</h3>
            <ol style="margin: 0; padding-left: 20px; color: #1976d2;">
              <li>Click "Set Up Your Account Now" above</li>
              <li>Sign in with your email and temporary password</li>
              <li>Create a new secure password</li>
              <li>Complete your profile information</li>
              <li>Start working with your team!</li>
            </ol>
          </div>

          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; font-size: 14px; color: #666;">
            <p><strong>Need help?</strong> Contact ${inviterName} at ${inviterEmail}</p>
            <p style="margin-bottom: 0;">This invitation was sent to ${recipientEmail}. If you didn't expect this invitation, please contact the sender.</p>
          </div>
        </body>
      </html>
    `;

    const fromAddress = "Compliance Platform <no-reply@tracer2c.com>";
    const subject = `Welcome to ${companyName} - Your Account is Ready!`;

    console.log(
      JSON.stringify(
        {
          action: "sending_user_account_setup",
          from: fromAddress,
          to: recipientEmail,
          subject: subject,
          inviteToken: inviteToken,
          hasAccount: true
        },
        null,
        2,
      ),
    );

    const emailResponse = await resend.emails.send({
      from: fromAddress,
      to: [recipientEmail],
      subject: subject,
      html: htmlContent,
    });

    // Resend returns either { data: { id }, error: null } or { data: null, error: {...} }
    if (emailResponse.error || !emailResponse.data?.id) {
      console.error(
        "Failed to send user invitation via Resend:",
        JSON.stringify(emailResponse, null, 2),
      );
      return new Response(
        JSON.stringify({
          success: false,
          error: emailResponse.error?.error || "Failed to send invitation email",
          errorDetails: emailResponse.error || null,
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        },
      );
    }

    console.log(
      JSON.stringify(
        {
          action: "user_account_created_and_invited",
          messageId: emailResponse.data.id,
          userId: authUser.user.id,
          to: recipientEmail,
          from: fromAddress,
          inviteToken: inviteToken,
          tempPasswordGenerated: true
        },
        null,
        2,
      ),
    );

    return new Response(
      JSON.stringify({
        success: true,
        messageId: emailResponse.data.id,
        userId: authUser.user.id,
        inviteToken: inviteToken,
        message: "User account created and invitation sent successfully",
        userExists: false,
        alreadyInCompany: false
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      },
    );
  } catch (error: any) {
    console.error("Error sending user invitation:", error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message || "Failed to send invitation email" 
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);