import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Download, Copy, AlertTriangle, Check, Shield } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface RecoveryCodesDisplayProps {
  codes: string[];
  onConfirm: () => void;
}

export const RecoveryCodesDisplay = ({ codes, onConfirm }: RecoveryCodesDisplayProps) => {
  const [confirmed, setConfirmed] = useState(false);
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const handleCopy = async () => {
    const text = codes.join('\n');
    await navigator.clipboard.writeText(text);
    setCopied(true);
    toast({
      title: "Copied",
      description: "Recovery codes copied to clipboard",
    });
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const text = `MFA Recovery Codes\n==================\nGenerated: ${new Date().toLocaleString()}\n\nKeep these codes in a safe place. Each code can only be used once.\n\n${codes.map((code, i) => `${i + 1}. ${code}`).join('\n')}\n\n⚠️ If you lose access to your authenticator app, use one of these codes to sign in.`;
    
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'mfa-recovery-codes.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast({
      title: "Downloaded",
      description: "Recovery codes saved to file",
    });
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-background via-background to-muted/30 overflow-y-auto">
      <Card className="w-full max-w-lg border-0 shadow-xl max-h-[85vh] flex flex-col">
        <CardHeader className="text-center pb-2 flex-shrink-0">
          <div className="w-16 h-16 mx-auto mb-4 bg-amber-500/10 rounded-full flex items-center justify-center">
            <Shield className="w-8 h-8 text-amber-500" />
          </div>
          <CardTitle className="text-2xl">Save Your Recovery Codes</CardTitle>
          <CardDescription>
            These codes will let you access your account if you lose your authenticator device
          </CardDescription>
        </CardHeader>

        <ScrollArea className="flex-1 overflow-y-auto">
          <CardContent className="space-y-6">
            <Alert className="border-amber-500/50 bg-amber-500/10">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              <AlertDescription className="text-amber-700 dark:text-amber-400">
                <strong>Important:</strong> Save these codes now. You won't be able to see them again!
              </AlertDescription>
            </Alert>

            <div className="grid grid-cols-2 gap-2 p-4 bg-muted/50 rounded-lg font-mono text-sm">
              {codes.map((code, index) => (
                <div key={index} className="p-2 bg-background rounded border text-center">
                  {code}
                </div>
              ))}
            </div>

            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={handleCopy}>
                {copied ? <Check className="w-4 h-4 mr-2" /> : <Copy className="w-4 h-4 mr-2" />}
                {copied ? 'Copied!' : 'Copy All'}
              </Button>
              <Button variant="outline" className="flex-1" onClick={handleDownload}>
                <Download className="w-4 h-4 mr-2" />
                Download
              </Button>
            </div>

            <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/30">
              <Checkbox
                id="confirm-saved"
                checked={confirmed}
                onCheckedChange={(checked) => setConfirmed(checked === true)}
              />
              <label htmlFor="confirm-saved" className="text-sm text-muted-foreground cursor-pointer">
                I have saved these recovery codes in a safe place. I understand that each code can only be used once.
              </label>
            </div>

            <Button 
              onClick={onConfirm} 
              disabled={!confirmed}
              className="w-full h-12 text-base font-semibold"
            >
              Continue to Dashboard
            </Button>

            <p className="text-xs text-center text-muted-foreground">
              You can regenerate recovery codes anytime from Settings → Account → Two-Factor Authentication
            </p>
          </CardContent>
        </ScrollArea>
      </Card>
    </div>
  );
};
