import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.0";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/corsHeaders.ts";
import { validateSystemSecret, systemAuthErrorResponse } from "../_shared/systemAuth.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const resendApiKey = Deno.env.get("RESEND_API_KEY");

function differenceInDays(dateA: Date, dateB: Date): number {
  return Math.floor((dateA.getTime() - dateB.getTime()) / (1000 * 60 * 60 * 24));
}

function advanceDate(fromDate: string, frequency: string, customDays: number | null): string {
  const d = new Date(fromDate);
  switch (frequency) {
    case "weekly": d.setDate(d.getDate() + 7); break;
    case "monthly": d.setMonth(d.getMonth() + 1); break;
    case "quarterly": d.setMonth(d.getMonth() + 3); break;
    case "custom": d.setDate(d.getDate() + (customDays || 30)); break;
    default: d.setMonth(d.getMonth() + 1); break;
  }
  return d.toISOString().split("T")[0];
}

async function sendEmail(to: string, subject: string, html: string) {
  if (!resendApiKey) {
    console.log(`[SKIP EMAIL] No RESEND_API_KEY. Would send to ${to}: ${subject}`);
    return;
  }
  try {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${resendApiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "Tracer2C Compliance <notifications@tracer2c.com>",
        to: [to],
        subject,
        html,
      }),
    });
  } catch (e) {
    console.error("Email send failed:", e);
  }
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  const preflight = handleCorsPreflightRequest(req);
  if (preflight) return preflight;

  // Validate system secret for cron invocations
  if (!validateSystemSecret(req)) {
    return systemAuthErrorResponse(corsHeaders);
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const today = new Date();
    const todayStr = today.toISOString().split("T")[0];

    // Fetch all active schedules
    const { data: schedules, error: schedErr } = await supabase
      .from("coa_schedules")
      .select("*, suppliers(company_name, contact_email), buyers(company_name, contact_email)")
      .in("status", ["active", "overdue"]);

    if (schedErr) throw new Error(`Failed to fetch schedules: ${schedErr.message}`);
    if (!schedules || schedules.length === 0) {
      return new Response(JSON.stringify({ message: "No active schedules" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    let reminders = 0;
    let overdueFlags = 0;
    let advanced = 0;

    for (const schedule of schedules) {
      const dueDate = new Date(schedule.next_due_date);
      const daysUntilDue = differenceInDays(dueDate, today);
      const supplierEmail = (schedule.suppliers as any)?.contact_email;
      const supplierName = (schedule.suppliers as any)?.company_name || "Supplier";
      const buyerEmail = (schedule.buyers as any)?.contact_email;
      const buyerName = (schedule.buyers as any)?.company_name || "Buyer";

      // Check if a submission exists after the last due date
      const { data: recentSub } = await supabase
        .from("coa_submissions")
        .select("id, submission_date")
        .eq("buyer_id", schedule.buyer_id)
        .eq("supplier_id", schedule.supplier_id)
        .gte("submission_date", schedule.last_submitted_date || "2000-01-01")
        .order("submission_date", { ascending: false })
        .limit(1);

      if (recentSub && recentSub.length > 0) {
        const subDate = new Date(recentSub[0].submission_date);
        if (subDate >= new Date(schedule.last_submitted_date || "2000-01-01") && subDate > new Date(schedule.next_due_date).getTime() - 86400000 * 30 ? new Date(0) : new Date(schedule.next_due_date)) {
          // Submission received - advance the schedule
          const newDueDate = advanceDate(schedule.next_due_date, schedule.frequency, schedule.custom_interval_days);
          await supabase.from("coa_schedules").update({
            next_due_date: newDueDate,
            last_submitted_date: subDate.toISOString().split("T")[0],
            status: "active",
          }).eq("id", schedule.id);
          advanced++;
          continue;
        }
      }

      // Send reminders
      if (schedule.auto_remind && daysUntilDue > 0 && supplierEmail) {
        const reminderDays: number[] = schedule.reminder_days_before || [7, 3, 1];
        if (reminderDays.includes(daysUntilDue)) {
          await sendEmail(
            supplierEmail,
            `COA Submission Reminder - Due in ${daysUntilDue} day(s)`,
            `<p>Hello ${supplierName},</p>
            <p>This is a reminder that your Certificate of Analysis (COA) for <strong>${schedule.product_name || "your product"}</strong> is due on <strong>${schedule.next_due_date}</strong> (${daysUntilDue} day(s) from now).</p>
            <p>Please upload your COA through the Tracer2C platform.</p>
            <p>Thank you,<br/>${buyerName} via Tracer2C</p>`
          );
          reminders++;
        }
      }

      // Check for overdue
      if (daysUntilDue < -(schedule.grace_period_days || 3) && schedule.status !== "overdue") {
        await supabase.from("coa_schedules").update({ status: "overdue" }).eq("id", schedule.id);
        overdueFlags++;

        // Notify buyer
        if (buyerEmail) {
          await sendEmail(
            buyerEmail,
            `COA Overdue - ${supplierName}`,
            `<p>Hello ${buyerName},</p>
            <p>The COA submission from <strong>${supplierName}</strong> for <strong>${schedule.product_name || "their product"}</strong> is now overdue. It was due on <strong>${schedule.next_due_date}</strong>.</p>
            <p>Please follow up with the supplier or take appropriate action.</p>
            <p>Tracer2C Compliance</p>`
          );
        }

        // Create in-app notification
        try {
          await supabase.from("notifications").insert({
            user_id: schedule.buyer_id, // This may need to map to a profile_id
            type: "coa_overdue",
            title: `COA Overdue: ${supplierName}`,
            message: `The COA for ${schedule.product_name || "product"} from ${supplierName} is overdue (was due ${schedule.next_due_date}).`,
            read: false,
          });
        } catch {
          // notifications table may not exist yet, ignore
        }
      }
    }

    return new Response(JSON.stringify({
      success: true,
      processed: schedules.length,
      reminders_sent: reminders,
      overdue_flagged: overdueFlags,
      schedules_advanced: advanced,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (error) {
    console.error("COA schedule reminder error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
