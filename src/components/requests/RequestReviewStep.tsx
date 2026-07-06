import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { FileText, Users, Flag, CalendarIcon, MessageSquare, Paperclip, Sparkles, Send } from 'lucide-react';
import { format, differenceInDays } from 'date-fns';
import { ComplianceDocument } from './ComplianceDocuments';
import SampleDocumentUpload from './SampleDocumentUpload';
import { Button } from '@/components/ui/button';

interface RequestReviewStepProps {
  selectedDocuments: ComplianceDocument[];
  formData: {
    suppliers: string[];
    priority: string;
    dueDate: string;
    notes: string;
  };
  buyerId?: string;
  sampleDocument: SampleDocumentSelection;
  setSampleDocument: (sample: SampleDocumentSelection) => void;
}

interface LibraryDocumentSelection {
  id: string;
  document_name: string;
  file_path: string;
  file_size: number | null;
  mime_type: string | null;
  category: string | null;
}

interface SampleDocumentSelection {
  file?: File;
  libraryDoc?: LibraryDocumentSelection;
  source: 'device' | 'library' | null;
}

const RequestReviewStep = ({
  selectedDocuments,
  formData,
  buyerId,
  sampleDocument,
  setSampleDocument
}: RequestReviewStepProps) => {
  
  const daysUntilDue = formData.dueDate ? differenceInDays(new Date(formData.dueDate), new Date()) : null;

  return (
    <div className="flex flex-col space-y-5 max-w-5xl mx-auto pb-4">
      
      {/* Header */}
      <div>
        <h2 className="text-[22px] font-bold text-foreground">Review & Send Request</h2>
        <p className="text-[14px] text-muted-foreground">Review the request details before sending it to suppliers.</p>
      </div>

      {/* Selected Documents */}
      <Card className="border-border rounded-[16px] shadow-sm overflow-hidden">
        <div className="p-4 border-b border-border flex items-center justify-between bg-card">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-md bg-primary/10">
              <FileText className="h-4 w-4 text-primary" />
            </div>
            <h3 className="font-bold text-[15px] text-foreground">Selected Documents</h3>
          </div>
          <Badge className="bg-primary/10 text-primary hover:bg-primary/10 border-0 px-3 py-1 font-semibold rounded-[8px]">
            {selectedDocuments.length} selected
          </Badge>
        </div>
        <CardContent className="p-4 bg-card">
          <div className="flex flex-wrap gap-3">
            {selectedDocuments.map(doc => (
              <Badge 
                key={doc.id} 
                variant="secondary" 
                className="flex items-center gap-1.5 bg-primary/10 text-primary hover:bg-primary/10 border border-primary/30 shadow-sm px-4 py-2 rounded-[8px]"
              >
                <FileText className="h-4 w-4" />
                <span className="font-semibold text-[14px]">{doc.title}</span>
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Recipients & Details */}
      <Card className="border-border rounded-[16px] shadow-sm overflow-hidden">
        <div className="p-4 border-b border-border flex items-center gap-2 bg-card">
          <div className="p-1.5 rounded-md bg-primary/10">
            <Users className="h-4 w-4 text-primary" />
          </div>
          <h3 className="font-bold text-[15px] text-foreground">Recipients & Details</h3>
        </div>
        <CardContent className="p-0 bg-card">
          <div className="flex flex-col sm:flex-row divide-y sm:divide-y-0 sm:divide-x divide-[#E4E7EC]">
            
            <div className="flex-1 p-5 space-y-1">
              <div className="flex items-center gap-1.5 text-muted-foreground mb-2">
                <Users className="w-4 h-4" />
                <span className="text-[13px] font-medium">Suppliers</span>
              </div>
              <div className="text-[14px] font-bold text-foreground">
                {formData.suppliers.length} selected
              </div>
            </div>

            <div className="flex-1 p-5 space-y-1">
              <div className="flex items-center gap-1.5 text-muted-foreground mb-2">
                <Flag className="w-4 h-4" />
                <span className="text-[13px] font-medium">Priority</span>
              </div>
              <div className="flex items-center gap-2 text-[14px] font-bold text-foreground capitalize">
                {formData.priority === 'low' && <span className="h-2 w-2 rounded-full bg-slate-400" />}
                {formData.priority === 'medium' && <span className="h-2 w-2 rounded-full bg-orange-500" />}
                {formData.priority === 'high' && <span className="h-2 w-2 rounded-full bg-amber-500" />}
                {formData.priority === 'urgent' && <span className="h-2 w-2 rounded-full bg-red-500" />}
                {formData.priority}
              </div>
            </div>

            <div className="flex-1 p-5 space-y-1">
              <div className="flex items-center gap-1.5 text-muted-foreground mb-2">
                <CalendarIcon className="w-4 h-4" />
                <span className="text-[13px] font-medium">Due Date</span>
              </div>
              <div className="text-[14px] font-bold text-foreground">
                {formData.dueDate ? format(new Date(formData.dueDate), "MMM d, yyyy") : 'Not set'}
              </div>
            </div>

            <div className="flex-[1.5] p-5 space-y-1">
              <div className="flex items-center gap-1.5 text-muted-foreground mb-2">
                <MessageSquare className="w-4 h-4" />
                <span className="text-[13px] font-medium">Notes</span>
              </div>
              <div className="text-[13px] text-foreground/80 font-medium line-clamp-2">
                {formData.notes || "No additional notes provided."}
              </div>
            </div>

          </div>
        </CardContent>
      </Card>

      {/* Reference Sample */}
      <Card className="border-border rounded-[16px] shadow-sm overflow-hidden">
        <div className="p-4 border-b border-border flex items-center gap-2 bg-card">
          <div className="p-1.5 rounded-md bg-orange-500/15">
            <Paperclip className="h-4 w-4 text-orange-500" />
          </div>
          <h3 className="font-bold text-[15px] text-foreground">Reference Sample <span className="text-muted-foreground/70 font-normal">(Optional)</span></h3>
        </div>
        <CardContent className="p-5 bg-card">
          {buyerId && (
            <SampleDocumentUpload
              buyerId={buyerId}
              currentSample={sampleDocument}
              onSampleChange={setSampleDocument}
            />
          )}
        </CardContent>
      </Card>

      {/* AI Preview */}
      <Card className="ai-card border-0 shadow-none">
        <CardContent className="p-5">
          <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-primary" />
                <h3 className="font-bold text-[15px] text-foreground">AI Preview</h3>
                <Badge className="bg-primary/15 text-primary hover:bg-primary/15 border-0 px-2 py-0.5 text-[10px] rounded-[6px]">BETA</Badge>
              </div>
              <p className="text-[14px] text-foreground/80 max-w-2xl leading-relaxed">
                You are about to request <span className="font-bold">{selectedDocuments.length} compliance documents</span> from <span className="font-bold">{formData.suppliers.length} suppliers</span>. 
                This request is <span className="font-bold">{formData.priority} priority</span> 
                {daysUntilDue ? ` and due in ${daysUntilDue} days` : ' with no due date'}.
              </p>
              <p className="text-[14px] text-foreground/80">
                <strong>Suggested message:</strong> Please upload the latest valid certificates with clearly visible scopes and expiration dates.
              </p>
            </div>
            
            <div className="flex items-center gap-2 shrink-0">
              <Button variant="outline" className="bg-card border-primary/25 text-primary hover:bg-primary/10 rounded-[8px] h-9 text-[13px] font-semibold">
                <Sparkles className="w-3.5 h-3.5 mr-2" />
                Regenerate Message
              </Button>
              <Button variant="outline" className="bg-card border-primary/25 text-foreground/80 hover:bg-muted rounded-[8px] h-9 text-[13px] font-semibold">
                <FileText className="w-3.5 h-3.5 mr-2" />
                Copy Summary
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

    </div>
  );
};

export default RequestReviewStep;
