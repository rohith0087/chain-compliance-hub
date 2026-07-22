import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Upload, FileText, Send, Check, X, AlertCircle, Users, Copy, Eye, EyeOff, Info } from 'lucide-react';
import { toast } from 'sonner';
import { useOnboardingRequests } from '@/hooks/useOnboardingRequests';
import { supabase } from '@/integrations/supabase/client';

interface BulkInviteModalProps {
  isOpen: boolean;
  onClose: () => void;
  buyerId: string;
  buyerProfile: {
    company_name: string;
    contact_email: string;
    industry?: string;
  };
}

export const BulkInviteModal = ({ 
  isOpen, 
  onClose, 
  buyerId, 
  buyerProfile 
}: BulkInviteModalProps) => {
  const [emailText, setEmailText] = useState('');
  const [csvData, setCsvData] = useState<string[][]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<{ success: string[], failed: string[] }>({ success: [], failed: [] });
  const [showResults, setShowResults] = useState(false);
  const [showId, setShowId] = useState(false);
  const [copied, setCopied] = useState(false);
  
  const { createOnboardingRequestFromDefaults } = useOnboardingRequests();

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const rows = text.split('\n').map(row => row.split(',').map(cell => cell.trim()));
      setCsvData(rows);
      
      // Extract emails and set them in the textarea
      const emails = rows
        .map(row => row[0]) // Assume first column is email
        .filter(email => email && email.includes('@'))
        .join(', ');
      setEmailText(emails);
      
      toast.success(`Loaded ${emails.split(', ').length} email addresses from CSV`);
    };
    reader.readAsText(file);
  };

  const handleBulkSend = async () => {
    const emailList = emailText
      .split(/[,\n]/)
      .map(email => email.trim())
      .filter(email => email && email.includes('@'));

    if (emailList.length === 0) {
      toast.error('Please enter valid email addresses');
      return;
    }

    if (emailList.length > 50) {
      toast.error('Maximum 50 invitations per batch');
      return;
    }

    setIsProcessing(true);
    setProgress(0);
    setResults({ success: [], failed: [] });
    setShowResults(false);

    const success: string[] = [];
    const failed: string[] = [];

    for (let i = 0; i < emailList.length; i++) {
      const email = emailList[i];
      try {
        // Create onboarding request with status='invited'
        await createOnboardingRequestFromDefaults(buyerId, email, '', '', undefined);
        
        // Send email invitation
        const { error: emailError } = await supabase.functions.invoke(
          'send-supplier-invitation',
          {
            body: {
              emails: [email],
              subject: `Invitation to Connect - ${buyerProfile.company_name}`,
              customMessage: '',
              buyerData: {
                name: buyerProfile.contact_email.split('@')[0], // Fallback name
                company: buyerProfile.company_name,
                email: buyerProfile.contact_email,
                industry: buyerProfile.industry || 'General',
                buyerId: buyerId
              }
            }
          }
        );
        
        if (emailError) {
          console.error(`Failed to send email to ${email}:`, emailError);
          failed.push(email);
        } else {
          success.push(email);
          toast.success(`Sent to ${email}`, { duration: 1000 });
        }
      } catch (error) {
        console.error(`Failed to process ${email}:`, error);
        failed.push(email);
      }
      
      setProgress(((i + 1) / emailList.length) * 100);
      
      // Small delay to prevent overwhelming the system
      if (i < emailList.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    setResults({ success, failed });
    setShowResults(true);
    setIsProcessing(false);

    if (success.length > 0) {
      toast.success(`Bulk onboarding completed! ${success.length} invitations sent.`);
    }
  };

  const handleReset = () => {
    setEmailText('');
    setCsvData([]);
    setProgress(0);
    setResults({ success: [], failed: [] });
    setShowResults(false);
  };

  const emailCount = emailText
    .split(/[,\n]/)
    .map(email => email.trim())
    .filter(email => email && email.includes('@')).length;

  const maskedId = buyerId.replace(/(.{4})(.*)(.{4})/, '$1****$3');

  const handleCopyId = async () => {
    try {
      await navigator.clipboard.writeText(buyerId);
      setCopied(true);
      toast.success('Buyer ID copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast.error('Failed to copy to clipboard');
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" />
            Bulk Supplier Onboarding
          </DialogTitle>
        </DialogHeader>

        {/* Buyer ID Card */}
        <Card className="bg-primary/5 border-primary/20">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <div className="w-6 h-6 bg-primary rounded-full flex items-center justify-center">
                  <span className="text-primary-foreground text-xs font-bold">ID</span>
                </div>
                Your Buyer ID
              </CardTitle>
              <Badge variant="secondary" className="bg-primary/15 text-primary">
                Unique Identifier
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-background rounded-lg border border-border">
              <div className="flex items-center gap-3">
                <code className="font-mono text-lg font-semibold tracking-wider">
                  {showId ? buyerId : maskedId}
                </code>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowId(!showId)}
                  className="h-6 w-6 p-0"
                >
                  {showId ? (
                    <EyeOff className="h-3 w-3" />
                  ) : (
                    <Eye className="h-3 w-3" />
                  )}
                </Button>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopyId}
                className="gap-2"
              >
                {copied ? (
                  <>
                    <Check className="h-3 w-3" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="h-3 w-3" />
                    Copy
                  </>
                )}
              </Button>
            </div>
            
            <div className="bg-primary/10 p-3 rounded-lg border border-primary/20">
              <div className="flex items-start gap-2">
                <Info className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                <div className="text-sm text-primary">
                  <p className="font-medium mb-1">Share this ID with suppliers to connect</p>
                  <p className="text-primary">
                    Suppliers can use this unique ID to send you connection requests directly. 
                    This makes it easier for trusted suppliers to connect with your company.
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {!showResults ? (
          <Tabs defaultValue="manual" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="manual" className="flex items-center gap-2">
                <FileText className="w-4 h-4" />
                Manual Entry
              </TabsTrigger>
              <TabsTrigger value="upload" className="flex items-center gap-2">
                <Upload className="w-4 h-4" />
                CSV Upload
              </TabsTrigger>
            </TabsList>

            <TabsContent value="manual" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Enter Email Addresses</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <label className="text-sm font-medium">Email Addresses</label>
                    <Textarea
                      placeholder="supplier1@company.com, supplier2@company.com&#10;supplier3@company.com"
                      value={emailText}
                      onChange={(e) => setEmailText(e.target.value)}
                      rows={10}
                      className="mt-1 font-mono text-sm"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Separate emails with commas or new lines. Maximum 50 per batch.
                    </p>
                  </div>

                  {emailCount > 0 && (
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">
                        {emailCount} email{emailCount !== 1 ? 's' : ''} detected
                      </Badge>
                      {emailCount > 50 && (
                        <Badge variant="destructive">
                          <AlertCircle className="w-3 h-3 mr-1" />
                          Too many emails
                        </Badge>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="upload" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Upload CSV File</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <label className="text-sm font-medium">Select CSV File</label>
                    <input
                      type="file"
                      accept=".csv"
                      onChange={handleFileUpload}
                      className="mt-1 block w-full text-sm text-muted-foreground file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      CSV should have email addresses in the first column
                    </p>
                  </div>

                  {csvData.length > 0 && (
                    <div className="space-y-2">
                      <Badge variant="secondary">
                        {csvData.length} rows loaded
                      </Badge>
                      <div className="max-h-32 overflow-y-auto bg-muted p-2 rounded text-xs font-mono">
                        {csvData.slice(0, 5).map((row, i) => (
                          <div key={i}>{row.join(', ')}</div>
                        ))}
                        {csvData.length > 5 && <div>... and {csvData.length - 5} more rows</div>}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <div className="flex items-center justify-between pt-4">
              <div className="text-sm text-muted-foreground">
                Each invitation will include your industry-specific defaults
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={handleReset}>
                  Reset
                </Button>
                <Button 
                  onClick={handleBulkSend} 
                  disabled={isProcessing || emailCount === 0 || emailCount > 50}
                  className="flex items-center gap-2"
                >
                  {isProcessing ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      Send {emailCount} Invitation{emailCount !== 1 ? 's' : ''}
                    </>
                  )}
                </Button>
              </div>
            </div>

            {isProcessing && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Sending invitations...</span>
                  <span>{Math.round(progress)}%</span>
                </div>
                <Progress value={progress} className="w-full" />
              </div>
            )}
          </Tabs>
        ) : (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Check className="w-5 h-5 text-success" />
                  Bulk Send Complete
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-success" />
                      <span className="font-medium text-success">
                        {results.success.length} Successful
                      </span>
                    </div>
                    {results.success.length > 0 && (
                      <div className="max-h-32 overflow-y-auto bg-success/10 p-2 rounded text-xs">
                        {results.success.map((email, i) => (
                          <div key={i} className="text-success">{email}</div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <X className="w-4 h-4 text-danger" />
                      <span className="font-medium text-danger">
                        {results.failed.length} Failed
                      </span>
                    </div>
                    {results.failed.length > 0 && (
                      <div className="max-h-32 overflow-y-auto bg-danger/10 p-2 rounded text-xs">
                        {results.failed.map((email, i) => (
                          <div key={i} className="text-danger">{email}</div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button variant="outline" onClick={handleReset}>
                    Send More
                  </Button>
                  <Button onClick={onClose}>
                    Done
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};