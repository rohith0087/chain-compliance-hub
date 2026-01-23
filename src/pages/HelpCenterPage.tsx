import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Headphones, 
  Phone, 
  Mail, 
  MessageCircle, 
  Search, 
  ArrowLeft,
  ChevronRight,
  ExternalLink
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';

interface FAQ {
  question: string;
  answer: string;
}

interface FAQCategory {
  id: string;
  name: string;
  icon: string;
  faqs: FAQ[];
}

const faqCategories: FAQCategory[] = [
  {
    id: 'getting-started',
    name: 'Getting Started',
    icon: '🚀',
    faqs: [
      {
        question: 'How do I create a buyer or supplier account?',
        answer: 'To create an account, click "Sign Up" on the login page. You\'ll be asked to provide your company details and choose whether you\'re registering as a Buyer (requesting compliance documents) or a Supplier (providing compliance documents). Complete the registration form with your company information, and you\'ll receive a verification email to activate your account.'
      },
      {
        question: 'What is the difference between a buyer and supplier role?',
        answer: 'Buyers are companies that need to collect and verify compliance documents from their supply chain partners. They can request documents, manage supplier onboarding, and track compliance status. Suppliers are companies that provide goods or services and need to submit compliance documentation to their buyers. They upload documents, respond to requests, and maintain their compliance status across multiple buyer relationships.'
      },
      {
        question: 'How do I navigate the dashboard?',
        answer: 'Your dashboard is your command center. The left sidebar provides access to all main features: Documents, Suppliers/Buyers, Onboarding, Messages, and Settings. The main dashboard shows key metrics like compliance scores, pending actions, and expiring documents. Use the notification bell to see recent activity and the search bar to quickly find specific items.'
      },
      {
        question: 'How do I invite team members to my company?',
        answer: 'Go to Settings > Team Management. Click "Invite Team Member" and enter their email address. You can assign roles like Admin, Manager, or Viewer to control their access level. The invited person will receive an email with instructions to join your company account.'
      },
      {
        question: 'How do I switch between buyer and supplier roles?',
        answer: 'If your company operates as both a buyer and supplier, you can switch roles using the role selector in the sidebar. Click your company name at the top of the sidebar and select the role you want to use. Your dashboard and available features will update accordingly.'
      },
      {
        question: 'How do I set up my company profile?',
        answer: 'Navigate to Settings > Company Profile. Here you can add your company logo, update contact information, set your industry category, and configure company-wide preferences. A complete profile helps build trust with your trading partners and ensures smooth communication.'
      }
    ]
  },
  {
    id: 'document-management',
    name: 'Document Management',
    icon: '📄',
    faqs: [
      {
        question: 'How do I request documents from suppliers?',
        answer: 'Go to the Documents section and click "New Request". Select the supplier, choose the document type (e.g., Certificate of Insurance, Quality Certification), set a due date, and add any specific instructions. The supplier will receive a notification and can upload the requested document directly through their portal.'
      },
      {
        question: 'How do I upload compliance documents as a supplier?',
        answer: 'Navigate to your Documents section where you\'ll see pending requests from your buyers. Click on a request to view details, then use the upload area to drag and drop your document or browse to select it. Supported formats include PDF, DOC, DOCX, and common image formats. Add an expiration date if applicable and submit for review.'
      },
      {
        question: 'What document formats are supported?',
        answer: 'We support PDF, DOC, DOCX, XLS, XLSX, PNG, JPG, and JPEG formats. PDF is recommended for most compliance documents as it preserves formatting and is widely accepted. Maximum file size is 25MB per document.'
      },
      {
        question: 'How do I renew an expiring document?',
        answer: 'You\'ll receive notifications as documents approach their expiration date (typically 60, 30, and 7 days before). Click on the expiring document notification or find it in your Documents list, then click "Upload New Version". The new document will go through the approval process while the current version remains active until approved.'
      },
      {
        question: 'What do the different document statuses mean?',
        answer: 'Pending: Document has been requested but not yet uploaded. Submitted: Document uploaded and awaiting review. Under Review: Currently being reviewed by the buyer. Approved: Document accepted and compliance verified. Rejected: Document not accepted (see rejection notes for details). Expired: Document past its validity date and needs renewal.'
      },
      {
        question: 'How do I view and download documents?',
        answer: 'Click on any document in your Documents list to open the detail view. You can preview most document types directly in the browser. Use the download button to save a copy to your device. For bulk downloads, select multiple documents using the checkboxes and click "Download Selected".'
      },
      {
        question: 'How do I request multiple documents at once (bulk requests)?',
        answer: 'When creating a new request, you can add multiple document types to a single request. Alternatively, use the "Bulk Request" feature to send the same document requirements to multiple suppliers simultaneously. This is especially useful during initial onboarding or annual renewal periods.'
      }
    ]
  },
  {
    id: 'supplier-onboarding',
    name: 'Supplier Onboarding',
    icon: '🤝',
    faqs: [
      {
        question: 'How does the supplier onboarding process work?',
        answer: 'The onboarding process has three stages: 1) Invitation - You send an onboarding request with required documents and information. 2) Submission - The supplier creates an account (if new) and submits all required documents and completes any forms. 3) Review - You review submissions, request any clarifications, and approve the supplier once all requirements are met.'
      },
      {
        question: 'How do I create an onboarding template for suppliers?',
        answer: 'Go to Settings > Onboarding Templates. Click "Create Template" and configure the documents, forms, and information you require from new suppliers. You can create different templates for different supplier types (e.g., manufacturing, services, logistics). Templates can be reused for efficient onboarding of multiple suppliers.'
      },
      {
        question: 'What documents are typically required during onboarding?',
        answer: 'Common onboarding documents include: Certificate of Insurance (COI), W-9 Tax Form, Business License, Quality Certifications (ISO, etc.), Safety Certifications, Banking Information, Company Registration Documents, and Supplier Questionnaires. You can customize requirements based on your industry and compliance needs.'
      },
      {
        question: 'How do I track onboarding progress?',
        answer: 'The Onboarding section shows all active onboarding requests with their current status. Each request displays a progress indicator showing completed vs. pending items. Click on any request to see detailed status of each required document and form. You\'ll receive notifications when suppliers submit items or if requests become overdue.'
      },
      {
        question: 'How do I approve or reject a supplier onboarding request?',
        answer: 'Open the onboarding request to review all submitted documents and information. You can approve individual items or the entire request. For rejections, provide clear feedback explaining what needs to be corrected. The supplier will be notified and can make corrections and resubmit. Once all items are approved, the supplier relationship becomes active.'
      }
    ]
  },
  {
    id: 'compliance-expiration',
    name: 'Compliance & Expiration',
    icon: '✅',
    faqs: [
      {
        question: 'How does the compliance score work?',
        answer: 'The compliance score is calculated based on the percentage of required documents that are current and approved. A score of 100% means all required documents are valid and up-to-date. The score decreases when documents expire or are missing. Scores are shown for individual suppliers and as an aggregate across your entire supplier base.'
      },
      {
        question: 'What happens when a document expires?',
        answer: 'When a document expires: 1) The document status changes to "Expired" and is highlighted in red. 2) The supplier\'s compliance score is affected. 3) Both parties receive notifications. 4) The supplier should upload a renewed version. Until a new version is approved, the expired document remains visible for reference but doesn\'t count toward compliance.'
      },
      {
        question: 'How do I set up expiration reminders?',
        answer: 'Go to Settings > Notification Preferences to configure when you receive expiration alerts. Default reminders are sent at 60 days, 30 days, 7 days, and on the expiration date. You can customize these intervals and choose to receive reminders via email, in-app notifications, or both.'
      },
      {
        question: 'How do I view all expiring documents in one place?',
        answer: 'Your dashboard includes an Expiry Panel that categorizes documents by urgency: Already Expired, Expiring in 7 days, Expiring in 30 days, and Expiring in 60 days. Click on any category to see the full list. You can also use filters in the Documents section to show only documents expiring within a specific timeframe.'
      },
      {
        question: 'What is the document attention panel on the dashboard?',
        answer: 'The Attention Panel highlights documents requiring immediate action. "For Review" shows documents submitted by suppliers awaiting your approval. "Overdue" shows document requests past their due date. This panel helps you prioritize your daily compliance management tasks and ensures nothing falls through the cracks.'
      }
    ]
  },
  {
    id: 'notifications-alerts',
    name: 'Notifications & Alerts',
    icon: '🔔',
    faqs: [
      {
        question: 'How do I enable notification sounds?',
        answer: 'Click the notification bell icon in the header, then click the sound/speaker icon to toggle notification sounds on or off. When enabled, you\'ll hear an audio alert for new notifications. This setting is saved to your browser and persists across sessions.'
      },
      {
        question: 'What types of notifications will I receive?',
        answer: 'You\'ll receive notifications for: New document requests, Document submissions, Document approvals/rejections, Upcoming expirations, Overdue documents, Onboarding updates, New messages, Team activity (for admins), and System announcements. Each type can be individually enabled or disabled in Settings.'
      },
      {
        question: 'How do I manage my notification preferences?',
        answer: 'Go to Settings > Notifications to customize your preferences. You can choose which events trigger notifications, select your preferred channels (email and/or in-app), set quiet hours when you don\'t want to be disturbed, and configure digest emails for daily or weekly summaries instead of individual alerts.'
      },
      {
        question: 'How do I contact a buyer or supplier through the platform?',
        answer: 'Use the Messages feature in the sidebar to communicate securely with your trading partners. You can start a new conversation from the Messages section or click the message icon on any supplier/buyer profile. All communications are logged and associated with relevant documents for easy reference and audit trails.'
      }
    ]
  },
  {
    id: 'account-security',
    name: 'Account & Security',
    icon: '🔐',
    faqs: [
      {
        question: 'How do I enable two-factor authentication (MFA)?',
        answer: 'Go to Settings > Security and click "Enable Two-Factor Authentication". You\'ll need an authenticator app like Google Authenticator or Authy. Scan the QR code with your app, enter the verification code to confirm, and save your backup recovery codes in a secure location. MFA adds an extra layer of protection to your account.'
      },
      {
        question: 'How do I reset my password?',
        answer: 'Click "Forgot Password" on the login page and enter your email address. You\'ll receive a password reset link valid for 1 hour. Click the link and create a new password meeting our security requirements (minimum 8 characters, including uppercase, lowercase, number, and special character). If you\'re logged in, you can change your password in Settings > Security.'
      },
      {
        question: 'How do I update my profile information?',
        answer: 'Click your profile picture or name in the top right corner and select "Profile" or go to Settings > My Profile. Here you can update your name, email, phone number, profile photo, and notification preferences. Some changes may require verification for security purposes.'
      },
      {
        question: 'How do I manage company branches?',
        answer: 'If your organization has multiple locations, go to Settings > Branches. You can add new branches with their address and contact information, assign team members to specific branches, and set branch-specific document requirements. Branch management helps organize your compliance operations across multiple locations.'
      },
      {
        question: 'How do I manage team member permissions?',
        answer: 'Go to Settings > Team Management. Click on any team member to view and modify their role and permissions. Available roles include: Admin (full access), Manager (can approve documents and manage suppliers), and Viewer (read-only access). You can also create custom roles with specific permission sets tailored to your organization\'s needs.'
      }
    ]
  }
];

export default function HelpCenterPage() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const filteredFAQs = useMemo(() => {
    if (!searchQuery.trim() && !selectedCategory) {
      return faqCategories;
    }

    const query = searchQuery.toLowerCase().trim();
    
    return faqCategories
      .filter(category => !selectedCategory || category.id === selectedCategory)
      .map(category => ({
        ...category,
        faqs: category.faqs.filter(
          faq =>
            faq.question.toLowerCase().includes(query) ||
            faq.answer.toLowerCase().includes(query)
        )
      }))
      .filter(category => category.faqs.length > 0);
  }, [searchQuery, selectedCategory]);

  const totalFAQs = faqCategories.reduce((sum, cat) => sum + cat.faqs.length, 0);

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <div className="bg-gradient-to-br from-primary via-primary/90 to-primary/80 text-primary-foreground">
        <div className="container mx-auto px-4 py-12">
          {/* Back Button */}
          <Button
            variant="ghost"
            className="mb-6 text-primary-foreground/80 hover:text-primary-foreground hover:bg-white/10"
            onClick={() => navigate(-1)}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>

          <div className="max-w-3xl mx-auto text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-white/20 mb-6">
              <Headphones className="h-8 w-8" />
            </div>
            <h1 className="text-4xl font-bold mb-4">Help Center</h1>
            <p className="text-lg text-primary-foreground/80 mb-8">
              Find answers, guides, and 24/7 support for your compliance operations
            </p>

            {/* Search Bar */}
            <div className="relative max-w-xl mx-auto">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search help articles, documents, compliance, onboarding..."
                className="pl-12 h-14 text-base bg-white text-foreground border-0 shadow-lg"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-12">
        {/* 24/7 Support Hotline */}
        <Card className="mb-8 border-2 border-primary/20 bg-gradient-to-r from-primary/5 to-transparent">
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="flex items-center justify-center w-14 h-14 rounded-full bg-primary/10">
                  <Phone className="h-7 w-7 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground font-medium">24/7 Support Hotline</p>
                  <p className="text-2xl font-bold text-foreground">+1 (769) 303-6507</p>
                </div>
              </div>
              <Button size="lg" asChild>
                <a href="tel:+17693036507" className="gap-2">
                  <Phone className="h-4 w-4" />
                  Call Now
                </a>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Contact Options Grid */}
        <div className="grid md:grid-cols-3 gap-6 mb-12">
          <Card className="hover:shadow-lg transition-shadow">
            <CardContent className="p-6 text-center">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary/10 mb-4">
                <Phone className="h-6 w-6 text-primary" />
              </div>
              <h3 className="font-semibold text-lg mb-2">Phone Support</h3>
              <p className="text-sm text-muted-foreground mb-4">Available 24/7 for urgent issues</p>
              <Button variant="outline" className="w-full" asChild>
                <a href="tel:+17693036507">Call Support</a>
              </Button>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow">
            <CardContent className="p-6 text-center">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary/10 mb-4">
                <Mail className="h-6 w-6 text-primary" />
              </div>
              <h3 className="font-semibold text-lg mb-2">Email Us</h3>
              <p className="text-sm text-muted-foreground mb-4">Response within 24 hours</p>
              <Button variant="outline" className="w-full" asChild>
                <a href="mailto:support@tracer2c.com">Send Email</a>
              </Button>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow">
            <CardContent className="p-6 text-center">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary/10 mb-4">
                <MessageCircle className="h-6 w-6 text-primary" />
              </div>
              <h3 className="font-semibold text-lg mb-2">Live Chat</h3>
              <p className="text-sm text-muted-foreground mb-4">Chat with our support team</p>
              <Button variant="outline" className="w-full">
                Start Chat
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* FAQ Section */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold">Frequently Asked Questions</h2>
            <Badge variant="secondary" className="text-sm">
              {totalFAQs} articles
            </Badge>
          </div>

          {/* Category Pills */}
          <div className="flex flex-wrap gap-2 mb-8">
            <Button
              variant={selectedCategory === null ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedCategory(null)}
              className="rounded-full"
            >
              All
              <Badge variant="secondary" className="ml-2 bg-white/20">
                {totalFAQs}
              </Badge>
            </Button>
            {faqCategories.map((category) => (
              <Button
                key={category.id}
                variant={selectedCategory === category.id ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedCategory(category.id)}
                className="rounded-full"
              >
                <span className="mr-1">{category.icon}</span>
                {category.name}
                <Badge variant="secondary" className="ml-2 bg-white/20">
                  {category.faqs.length}
                </Badge>
              </Button>
            ))}
          </div>

          {/* FAQ Accordions */}
          {filteredFAQs.length > 0 ? (
            <div className="space-y-6">
              {filteredFAQs.map((category) => (
                <Card key={category.id}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <span>{category.icon}</span>
                      {category.name}
                      <Badge variant="outline" className="ml-auto">
                        {category.faqs.length} questions
                      </Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Accordion type="single" collapsible className="w-full">
                      {category.faqs.map((faq, index) => (
                        <AccordionItem key={index} value={`${category.id}-${index}`}>
                          <AccordionTrigger className="text-left hover:no-underline">
                            <span className="flex items-center gap-2">
                              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200" />
                              {faq.question}
                            </span>
                          </AccordionTrigger>
                          <AccordionContent className="text-muted-foreground pl-6">
                            {faq.answer}
                          </AccordionContent>
                        </AccordionItem>
                      ))}
                    </Accordion>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="p-12 text-center">
              <Search className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No results found</h3>
              <p className="text-muted-foreground mb-6">
                We couldn't find any articles matching "{searchQuery}"
              </p>
              <div className="flex justify-center gap-4">
                <Button variant="outline" onClick={() => setSearchQuery('')}>
                  Clear Search
                </Button>
                <Button asChild>
                  <a href="tel:+17693036507">
                    <Phone className="h-4 w-4 mr-2" />
                    Call Support
                  </a>
                </Button>
              </div>
            </Card>
          )}
        </div>

        {/* Bottom CTA */}
        <Card className="bg-gradient-to-r from-primary/5 via-primary/10 to-primary/5 border-primary/20">
          <CardContent className="p-8 text-center">
            <h3 className="text-xl font-bold mb-2">Can't find what you need?</h3>
            <p className="text-muted-foreground mb-6">
              Our team is here to help 24/7. Reach out through any channel.
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <Button variant="outline" asChild>
                <a href="mailto:support@tracer2c.com" className="gap-2">
                  <Mail className="h-4 w-4" />
                  Email Support
                </a>
              </Button>
              <Button asChild>
                <a href="tel:+17693036507" className="gap-2">
                  <Phone className="h-4 w-4" />
                  Call +1 (769) 303-6507
                </a>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
