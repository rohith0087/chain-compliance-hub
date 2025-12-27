import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from "@/components/ui/sheet";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  Mail,
  Send,
  Copy,
  X,
  Loader2,
  CheckCircle,
  AlertCircle,
  User,
  Building,
  FileText,
  Calendar,
  Eye,
} from "lucide-react";

interface EmailRecipient {
  email: string;
  name: string;
  type: "primary" | "owner" | "admin";
  selected: boolean;
}

interface DocumentInfo {
  id: string;
  name: string;
  type: string;
  expiration_date?: string;
  status?: string;
}

interface EmailDraft {
  supplier_id: string;
  supplier_name: string;
  recipients: EmailRecipient[];
  subject: string;
  body: string;
  documents: DocumentInfo[];
}

interface ComplianceEmailComposerProps {
  drafts: EmailDraft[];
  actionType: string;
  buyerId: string;
  onClose: () => void;
  onSent?: (results: any) => void;
}

const ComplianceEmailComposer: React.FC<ComplianceEmailComposerProps> = ({
  drafts,
  actionType,
  buyerId,
  onClose,
  onSent,
}) => {
  const { toast } = useToast();
  const [editedDrafts, setEditedDrafts] = useState<EmailDraft[]>(
    drafts.map((d) => ({
      ...d,
      recipients: d.recipients.map((r) => ({ ...r, selected: true })),
    }))
  );
  const [activeTab, setActiveTab] = useState(drafts[0]?.supplier_id || "");
  const [isSending, setIsSending] = useState(false);
  const [sentSuppliers, setSentSuppliers] = useState<Set<string>>(new Set());
  const [isPreview, setIsPreview] = useState(false);

  const updateDraft = (supplierId: string, updates: Partial<EmailDraft>) => {
    setEditedDrafts((prev) =>
      prev.map((d) => (d.supplier_id === supplierId ? { ...d, ...updates } : d))
    );
  };

  const toggleRecipient = (supplierId: string, recipientEmail: string) => {
    setEditedDrafts((prev) =>
      prev.map((d) =>
        d.supplier_id === supplierId
          ? {
              ...d,
              recipients: d.recipients.map((r) =>
                r.email === recipientEmail ? { ...r, selected: !r.selected } : r
              ),
            }
          : d
      )
    );
  };

  const copyToClipboard = async (draft: EmailDraft) => {
    const text = `Subject: ${draft.subject}\n\n${draft.body}`;
    await navigator.clipboard.writeText(text);
    toast({
      title: "Copied to clipboard",
      description: "Email content copied successfully.",
    });
  };

  const sendEmail = async (draft: EmailDraft) => {
    const selectedRecipients = draft.recipients.filter((r) => r.selected);
    if (selectedRecipients.length === 0) {
      toast({
        title: "No recipients selected",
        description: "Please select at least one recipient.",
        variant: "destructive",
      });
      return;
    }

    setIsSending(true);
    console.log("[ComplianceEmailComposer] Starting email send for:", draft.supplier_name);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      console.log("[ComplianceEmailComposer] Current user:", user?.id);

      const payload = {
        emails: [
          {
            supplier_id: draft.supplier_id,
            supplier_name: draft.supplier_name,
            recipients: selectedRecipients.map((r) => ({
              email: r.email,
              name: r.name,
              type: r.type,
            })),
            subject: draft.subject,
            body: draft.body,
            action_type: actionType,
            document_ids: draft.documents.map((d) => d.id),
            buyer_id: buyerId,
            sender_user_id: user?.id,
          },
        ],
      };
      console.log("[ComplianceEmailComposer] Sending payload:", JSON.stringify(payload, null, 2));

      const { data, error } = await supabase.functions.invoke("send-compliance-followup", {
        body: payload,
      });

      console.log("[ComplianceEmailComposer] Response data:", data);
      console.log("[ComplianceEmailComposer] Response error:", error);

      if (error) {
        console.error("[ComplianceEmailComposer] Function error:", error);
        throw error;
      }

      if (!data || data.error) {
        console.error("[ComplianceEmailComposer] Data error:", data?.error);
        throw new Error(data?.error || "Unknown error from send function");
      }

      setSentSuppliers((prev) => new Set([...prev, draft.supplier_id]));
      toast({
        title: "Email sent successfully",
        description: `Sent ${data.total_emails_sent || 0} email(s) to ${draft.supplier_name}.`,
      });

      if (onSent) {
        onSent(data);
      }
    } catch (err: any) {
      console.error("[ComplianceEmailComposer] Failed to send email:", err);
      toast({
        title: "Failed to send email",
        description: err.message || "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSending(false);
    }
  };

  const sendAllEmails = async () => {
    setIsSending(true);
    const unsent = editedDrafts.filter((d) => !sentSuppliers.has(d.supplier_id));

    const { data: { user } } = await supabase.auth.getUser();
    const senderId = user?.id;

    const emailPayloads = unsent
      .map((draft) => {
        const selectedRecipients = draft.recipients.filter((r) => r.selected);
        if (selectedRecipients.length === 0) return null;

        return {
          supplier_id: draft.supplier_id,
          supplier_name: draft.supplier_name,
          recipients: selectedRecipients.map((r) => ({
            email: r.email,
            name: r.name,
            type: r.type,
          })),
          subject: draft.subject,
          body: draft.body,
          action_type: actionType,
          document_ids: draft.documents.map((d) => d.id),
          buyer_id: buyerId,
          sender_user_id: senderId,
        };
      })
      .filter(Boolean);

    if (emailPayloads.length === 0) {
      toast({
        title: "No emails to send",
        description: "All emails have been sent or no recipients selected.",
        variant: "destructive",
      });
      setIsSending(false);
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke("send-compliance-followup", {
        body: { emails: emailPayloads },
      });

      if (error) throw error;

      const sentIds = data.results
        .filter((r: any) => r.success)
        .map((r: any) => r.supplier_id);
      setSentSuppliers((prev) => new Set([...prev, ...sentIds]));

      toast({
        title: "Emails sent",
        description: `Successfully sent ${data.total_emails_sent} email(s) to ${data.total_suppliers} supplier(s).`,
      });

      if (data.failed_suppliers > 0) {
        toast({
          title: "Some emails failed",
          description: `${data.failed_suppliers} supplier(s) had delivery issues.`,
          variant: "destructive",
        });
      }

      if (onSent) {
        onSent(data);
      }
    } catch (err: any) {
      console.error("Failed to send emails:", err);
      toast({
        title: "Failed to send emails",
        description: err.message || "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSending(false);
    }
  };

  const getRecipientIcon = (type: string) => {
    switch (type) {
      case "owner":
        return <User className="w-3 h-3" />;
      case "admin":
        return <Building className="w-3 h-3" />;
      default:
        return <Mail className="w-3 h-3" />;
    }
  };

  const currentDraft = editedDrafts.find((d) => d.supplier_id === activeTab);
  const unsentCount = editedDrafts.filter((d) => !sentSuppliers.has(d.supplier_id)).length;

  return (
    <Sheet open onOpenChange={onClose}>
      <SheetContent side="right" className="w-full sm:max-w-2xl p-0 flex flex-col">
        <SheetHeader className="px-6 py-4 border-b">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Mail className="h-5 w-5 text-primary" />
              </div>
              <div>
                <SheetTitle>Compliance Follow-up Emails</SheetTitle>
                <SheetDescription>
                  {editedDrafts.length} supplier{editedDrafts.length > 1 ? "s" : ""} •{" "}
                  {actionType.replace(/_/g, " ")}
                </SheetDescription>
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </SheetHeader>

        <div className="flex-1 overflow-hidden flex flex-col">
          {editedDrafts.length > 1 && (
            <div className="border-b px-4 py-2">
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="w-full justify-start overflow-x-auto">
                  {editedDrafts.map((draft) => (
                    <TabsTrigger
                      key={draft.supplier_id}
                      value={draft.supplier_id}
                      className="relative"
                    >
                      {draft.supplier_name}
                      {sentSuppliers.has(draft.supplier_id) && (
                        <CheckCircle className="w-3 h-3 text-green-500 ml-1" />
                      )}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>
            </div>
          )}

          <ScrollArea className="flex-1 p-6">
            {currentDraft && (
              <div className="space-y-6">
                {/* Recipients */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Recipients</label>
                  <div className="flex flex-wrap gap-2">
                    {currentDraft.recipients.map((recipient) => (
                      <label
                        key={recipient.email}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-colors ${
                          recipient.selected
                            ? "bg-primary/10 border-primary"
                            : "bg-muted/50 border-border"
                        }`}
                      >
                        <Checkbox
                          checked={recipient.selected}
                          onCheckedChange={() =>
                            toggleRecipient(currentDraft.supplier_id, recipient.email)
                          }
                        />
                        {getRecipientIcon(recipient.type)}
                        <span className="text-sm">{recipient.name}</span>
                        <Badge variant="outline" className="text-xs">
                          {recipient.type}
                        </Badge>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Subject */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Subject</label>
                  <Input
                    value={currentDraft.subject}
                    onChange={(e) =>
                      updateDraft(currentDraft.supplier_id, { subject: e.target.value })
                    }
                    disabled={sentSuppliers.has(currentDraft.supplier_id)}
                  />
                </div>

                {/* Body */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium">Message</label>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setIsPreview(!isPreview)}
                      className="text-xs"
                    >
                      <Eye className="w-3 h-3 mr-1" />
                      {isPreview ? "Edit" : "Preview"}
                    </Button>
                  </div>
                  {isPreview ? (
                    <div
                      className="min-h-[200px] p-4 rounded-lg border bg-muted/30 prose prose-sm dark:prose-invert max-w-none"
                      dangerouslySetInnerHTML={{
                        __html: currentDraft.body
                          .replace(/\n/g, "<br/>")
                          .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
                          .replace(/• (.+)/g, "<li>$1</li>"),
                      }}
                    />
                  ) : (
                    <Textarea
                      value={currentDraft.body}
                      onChange={(e) =>
                        updateDraft(currentDraft.supplier_id, { body: e.target.value })
                      }
                      rows={10}
                      disabled={sentSuppliers.has(currentDraft.supplier_id)}
                      className="font-mono text-sm"
                    />
                  )}
                </div>

                {/* Documents */}
                {currentDraft.documents.length > 0 && (
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Referenced Documents</label>
                    <div className="grid gap-2">
                      {currentDraft.documents.map((doc) => (
                        <div
                          key={doc.id}
                          className="flex items-center gap-3 p-3 rounded-lg border bg-muted/30"
                        >
                          <FileText className="w-4 h-4 text-muted-foreground" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{doc.name}</p>
                            <p className="text-xs text-muted-foreground">{doc.type}</p>
                          </div>
                          {doc.expiration_date && (
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Calendar className="w-3 h-3" />
                              {new Date(doc.expiration_date).toLocaleDateString()}
                            </div>
                          )}
                          {doc.status && (
                            <Badge
                              variant={doc.status === "expired" ? "destructive" : "secondary"}
                              className="text-xs"
                            >
                              {doc.status}
                            </Badge>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Sent indicator */}
                {sentSuppliers.has(currentDraft.supplier_id) && (
                  <div className="flex items-center gap-2 p-4 rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800">
                    <CheckCircle className="w-5 h-5 text-green-600" />
                    <span className="text-sm text-green-700 dark:text-green-400">
                      Email sent successfully to {currentDraft.supplier_name}
                    </span>
                  </div>
                )}
              </div>
            )}
          </ScrollArea>
        </div>

        <SheetFooter className="px-6 py-4 border-t gap-2">
          <Button
            variant="outline"
            onClick={() => currentDraft && copyToClipboard(currentDraft)}
            disabled={!currentDraft}
          >
            <Copy className="w-4 h-4 mr-2" />
            Copy
          </Button>
          {currentDraft && !sentSuppliers.has(currentDraft.supplier_id) && (
            <Button
              onClick={() => sendEmail(currentDraft)}
              disabled={isSending}
            >
              {isSending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Send className="w-4 h-4 mr-2" />
              )}
              Send to {currentDraft.supplier_name}
            </Button>
          )}
          {editedDrafts.length > 1 && unsentCount > 0 && (
            <Button
              variant="default"
              onClick={sendAllEmails}
              disabled={isSending}
              className="bg-primary"
            >
              {isSending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Send className="w-4 h-4 mr-2" />
              )}
              Send All ({unsentCount})
            </Button>
          )}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
};

export default ComplianceEmailComposer;
