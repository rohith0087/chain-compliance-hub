import {
  Rocket, FileCheck, UserCheck, BarChart3, Bell, Shield, type LucideIcon,
} from 'lucide-react';

// Help Center articles, written in the HelpRichText markup (see
// components/help/HelpRichText.tsx for the syntax). Screenshots live in
// /public/help/<category-id>/<slug>-<n>.png — see /public/help/README.md.

export interface HelpFAQ {
  question: string;
  answer: string;
}

export interface HelpCategory {
  id: string;
  name: string;
  icon: LucideIcon;
  faqs: HelpFAQ[];
}

export const faqCategories: HelpCategory[] = [
  {
    id: 'getting-started',
    name: 'Getting Started',
    icon: Rocket,
    faqs: [
      {
        question: 'How do I get a buyer or supplier account?',
        answer: `Access to TraceR2C is **by invitation**. Buyers are onboarded by the TraceR2C team — book a demo from **tracer2c.com** to get your organization set up. Suppliers join when a buyer invites them to connect or sends an onboarding request; the invitation email contains everything needed to activate the account.
> Note: There is no self-serve sign-up on the login page. If you received an invitation email, follow its link to activate your account.`,
      },
      {
        question: 'What is the difference between a buyer and supplier role?',
        answer: `**Buyers** collect and verify compliance documents from their supply chain. They request documents, manage supplier onboarding, and track compliance status.
**Suppliers** provide goods or services and submit compliance documentation to their buyers. They upload documents, respond to requests, and maintain compliance across multiple buyer relationships.`,
      },
      {
        question: 'How do I navigate the dashboard?',
        answer: `Your dashboard is your command center.
1. The left sidebar is your main navigation: [[documents]], [[library]], [[connections]], [[messages]], [[compliance]], and [[settings]].
2. The main area shows your key metrics — pending items, compliance score, and expiring documents. Every metric tile is clickable and jumps to the filtered view behind it.
3. Use the [[notifications]] bell in the header for recent activity, and [[search]] (or **⌘K**) to find anything quickly.
![The dashboard with sidebar navigation and metric tiles](getting-started/navigate-dashboard-1.png)`,
      },
      {
        question: 'How do I invite team members to my company?',
        answer: `1. Open [[settings]] and go to **Team Management**.
2. Select **Invite Team Member** and enter their email address.
3. Assign a role — **Admin**, **Manager**, or **Viewer** — to control their access level.
4. The invitee receives an email with instructions to join your company account.
> Tip: Start people on **Viewer** and raise their role later — it's easier than walking back access.`,
      },
      {
        question: 'How do I switch between buyer and supplier roles?',
        answer: `If your company operates as both a buyer and a supplier:
1. Select your **company name** at the top of the sidebar.
2. Choose the role you want to work in.
3. Your dashboard and available features update to match the selected role.`,
      },
      {
        question: 'How do I set up my company profile?',
        answer: `1. Open [[settings]] and select **Company Profile**.
2. Add your **company logo**, contact information, and industry category.
3. Save — your logo appears in the sidebar and on documents you share.
> Tip: A complete profile builds trust with trading partners and speeds up onboarding approvals.`,
      },
    ],
  },
  {
    id: 'documents',
    name: 'Documents',
    icon: FileCheck,
    faqs: [
      {
        question: 'How do I request documents from suppliers?',
        answer: `1. Select [[new-request]] from the sidebar (or any **New Request** button on the dashboard).
2. Pick the **entity type**, then choose documents — the **AI recommendation** strip suggests the common set for that entity, and **Apply suggestions** selects them in one click.
3. Choose recipients, set a **priority** and optional **due date**. The rail on the right keeps a live summary and can draft supplier instructions for you.
4. Review everything and select **Send** — suppliers are notified and can upload directly through their portal.
![Create Document Request with the AI recommendation strip](documents/request-documents-1.png)`,
      },
      {
        question: 'How do I upload compliance documents as a supplier?',
        answer: `1. Open [[documents]] — pending requests from your buyers are listed with a **Pending** status.
2. Select a request to view its details and any reference sample the buyer attached.
3. Drag & drop your file into the [[upload]] area, or browse to select it.
4. Add an **expiration date** if the document has one, then submit for review.
> Note: The buyer reviews your submission — you'll be notified when it's approved or if changes are needed.`,
      },
      {
        question: 'What document formats are supported?',
        answer: `Supported formats: **PDF, DOC, DOCX, XLS, XLSX, PNG, JPG, JPEG**.
> Tip: **PDF is recommended** for compliance documents — it preserves formatting and is accepted everywhere. Maximum file size is **25MB** per document.`,
      },
      {
        question: 'How do I renew an expiring document?',
        answer: `You'll be notified as documents approach expiry (typically **60, 30, and 7 days** before).
1. Open the expiring document from the notification, or find it under [[documents]] — expiring items are flagged on your dashboard.
2. Select [[renew]] and upload the new version.
3. The renewal goes through the normal approval flow; the current version stays active until the new one is approved.`,
      },
      {
        question: 'What do the different document statuses mean?',
        answer: `- **Pending** — requested, not yet uploaded.
- **Submitted** — uploaded and awaiting review.
- **Under Review** — currently being reviewed by the buyer.
- **Approved** — accepted; counts toward compliance.
- **Rejected** — not accepted; see the rejection notes, fix, and resubmit.
- **Expired** — past its validity date and needs renewal.`,
      },
      {
        question: 'How do I view and download documents?',
        answer: `1. Select any document in [[documents]] to open its detail view — most file types preview directly in the browser.
2. Use [[download]] to save a copy.
3. For bulk downloads, tick the checkboxes on multiple documents and choose **Download Selected**.`,
      },
      {
        question: 'How do I request multiple documents at once (bulk requests)?',
        answer: `Within one request you can select **as many document types as you need** — each recipient gets them as a single request.
To send the same requirements to **multiple suppliers**, add them all as recipients in step 2 of [[new-request]].
> Tip: Save a frequently used selection as a **Document Set** from the picker — next time it's one click.`,
      },
    ],
  },
  {
    id: 'onboarding',
    name: 'Supplier Onboarding',
    icon: UserCheck,
    faqs: [
      {
        question: 'How does the supplier onboarding process work?',
        answer: `Onboarding has three stages:
1. **Invitation** — you send an onboarding request listing the documents and information you require.
2. **Submission** — the supplier activates their account (if new) and submits the required documents and forms.
3. **Review** — you review submissions, request clarifications where needed, and approve once complete.
![Onboarding pipeline with request progress](onboarding/onboarding-process-1.png)`,
      },
      {
        question: 'How do I create an onboarding template for suppliers?',
        answer: `1. Open [[settings]] and go to **Onboarding Templates**.
2. Select **Create Template** and configure the documents, forms, and information you require.
3. Create different templates per supplier type — e.g. manufacturing, services, logistics — and reuse them for every new supplier of that type.`,
      },
      {
        question: 'What documents are typically required during onboarding?',
        answer: `Common requirements include:
- **Certificate of Insurance (COI)** and **W-9 Tax Form**
- **Business License** and company registration documents
- **Quality certifications** (ISO 9001, ISO 14001, …) and safety certifications
- **Banking information** and supplier questionnaires
Requirements are fully customizable per template to match your industry and risk profile.`,
      },
      {
        question: 'How do I track onboarding progress?',
        answer: `1. Open [[onboarding]] to see all active onboarding requests and their status.
2. Each request shows a **progress indicator** of completed vs. pending items.
3. Select a request for the item-by-item breakdown — you're notified when suppliers submit or when requests go overdue.`,
      },
      {
        question: 'How do I approve or reject a supplier onboarding request?',
        answer: `1. Open the onboarding request to review the submitted documents and information.
2. Approve items individually, or the entire request at once.
3. For rejections, provide **clear feedback** on what needs correcting — the supplier is notified and can resubmit.
> Note: Once every item is approved, the supplier relationship becomes active automatically.`,
      },
    ],
  },
  {
    id: 'compliance',
    name: 'Compliance & Expiry',
    icon: BarChart3,
    faqs: [
      {
        question: 'How does the compliance score work?',
        answer: `The score is the percentage of **required documents that are current and approved**. **100%** means everything is valid and up to date; the score drops as documents expire or go missing.
Scores are shown per supplier and as an aggregate across your whole supplier base under [[compliance]].`,
      },
      {
        question: 'What happens when a document expires?',
        answer: `1. The document's status changes to **Expired** and is flagged in red.
2. The supplier's **compliance score** drops accordingly.
3. Both parties are notified, and the supplier should upload a renewed version.
> Important: The expired document stays visible for reference, but it does not count toward compliance until a renewal is approved.`,
      },
      {
        question: 'How do I set up expiration reminders?',
        answer: `1. Open [[settings]] and go to **Notification Preferences**.
2. Default reminders fire at **60, 30, and 7 days** before expiry, and on the expiration date.
3. Customize the intervals and choose delivery via [[email]], in-app [[notifications]], or both.`,
      },
      {
        question: 'How do I view all expiring documents in one place?',
        answer: `Your dashboard's **Expiring soon** panel groups documents by urgency — already expired, 7 days, 30 days, 60 days — with a [[renew]] action on each row.
You can also filter [[documents]] to show only items expiring within a chosen window.`,
      },
      {
        question: 'What is the document attention panel on the dashboard?',
        answer: `The **Needs attention** panel surfaces what requires action today:
- **For review** — supplier submissions awaiting your approval.
- **Overdue** — requests past their due date, flagged in red.
> Tip: Work this panel top-down each morning — it's sorted by urgency so nothing falls through the cracks.`,
      },
    ],
  },
  {
    id: 'notifications-alerts',
    name: 'Notifications & Alerts',
    icon: Bell,
    faqs: [
      {
        question: 'How do I enable notification sounds?',
        answer: `1. Select the [[notifications]] bell in the header.
2. Toggle the [[sound]] speaker icon on or off.
When enabled you'll hear an audio alert for new notifications. The setting is saved in your browser and persists across sessions.`,
      },
      {
        question: 'What types of notifications will I receive?',
        answer: `You'll be notified about:
- New **document requests** and **submissions**
- **Approvals / rejections** and upcoming **expirations**
- **Overdue** documents and **onboarding** updates
- New [[messages]], team activity (admins), and system announcements
Each type can be enabled or disabled individually in [[settings]].`,
      },
      {
        question: 'How do I manage my notification preferences?',
        answer: `1. Open [[settings]] and go to **Notifications**.
2. Choose which events trigger alerts and your channels — [[email]], in-app, or both.
3. Set **quiet hours**, or switch to daily/weekly **digest emails** instead of individual alerts.`,
      },
      {
        question: 'How do I contact a buyer or supplier through the platform?',
        answer: `Use [[messages]] in the sidebar to communicate securely with trading partners.
1. Start a conversation from [[messages]], or select the message icon on any partner profile.
2. All communication is logged and linked to the relevant documents for a clean audit trail.`,
      },
    ],
  },
  {
    id: 'account-security',
    name: 'Account & Security',
    icon: Shield,
    faqs: [
      {
        question: 'How do I enable two-factor authentication (MFA)?',
        answer: `1. Open [[settings]] and go to [[security]].
2. Select **Enable Two-Factor Authentication** — you'll need an authenticator app such as Google Authenticator or Authy.
3. Scan the **QR code** with your app and enter the verification code to confirm.
4. Save your **backup recovery codes** somewhere secure.
> Important: Recovery codes are shown once. Store them in a password manager — they're your way back in if you lose your phone.
![Enabling two-factor authentication in Security settings](account-security/enable-mfa-1.png)`,
      },
      {
        question: 'How do I reset my password?',
        answer: `1. On the login page, select **Forgot your password?** and enter your email.
2. You'll receive a reset link valid for **1 hour**.
3. Create a new password meeting the requirements — minimum **8 characters** with uppercase, lowercase, a number, and a special character.
> Note: Already signed in? Change your password anytime under [[settings]] → [[security]].`,
      },
      {
        question: 'How do I update my profile information?',
        answer: `1. Select your **profile picture** in the top-right corner and choose **Profile**, or open [[settings]] → **My Profile**.
2. Update your name, email, phone number, or photo.
> Note: Some changes require re-verification for security.`,
      },
      {
        question: 'How do I manage company branches?',
        answer: `For organizations with multiple locations:
1. Open [[settings]] and go to [[branches]].
2. Add branches with their address and contact details.
3. Assign team members to specific branches and set **branch-specific document requirements**.`,
      },
      {
        question: 'How do I manage team member permissions?',
        answer: `1. Open [[settings]] and go to **Team Management**.
2. Select a team member to view and modify their role.
3. Available roles: **Admin** (full access), **Manager** (approve documents, manage suppliers), and **Viewer** (read-only). Custom roles with specific permission sets are also supported.`,
      },
    ],
  },
];
