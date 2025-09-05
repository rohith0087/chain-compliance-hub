import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Upload, FileText, Send, Check, X, AlertCircle, Users } from 'lucide-react';
import { toast } from 'sonner';
import { useOnboardingRequests } from '@/hooks/useOnboardingRequests';

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
        await createOnboardingRequestFromDefaults(buyerId, email, '');
        success.push(email);
        toast.success(`Sent to ${email}`, { duration: 1000 });
      } catch (error) {
        console.error(`Failed to send to ${email}:`, error);
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

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="w-5 h-5 text-blue-500" />
            Bulk Supplier Onboarding
          </DialogTitle>
        </DialogHeader>

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
                  <Check className="w-5 h-5 text-green-500" />
                  Bulk Send Complete
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-green-500" />
                      <span className="font-medium text-green-700">
                        {results.success.length} Successful
                      </span>
                    </div>
                    {results.success.length > 0 && (
                      <div className="max-h-32 overflow-y-auto bg-green-50 p-2 rounded text-xs">
                        {results.success.map((email, i) => (
                          <div key={i} className="text-green-700">{email}</div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <X className="w-4 h-4 text-red-500" />
                      <span className="font-medium text-red-700">
                        {results.failed.length} Failed
                      </span>
                    </div>
                    {results.failed.length > 0 && (
                      <div className="max-h-32 overflow-y-auto bg-red-50 p-2 rounded text-xs">
                        {results.failed.map((email, i) => (
                          <div key={i} className="text-red-700">{email}</div>
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