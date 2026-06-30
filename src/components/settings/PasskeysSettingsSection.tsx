import { useState } from 'react';
import { startRegistration } from '@simplewebauthn/browser';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { KeyRound, Loader2, Plus, Trash2, Pencil, Check, X, ShieldCheck } from 'lucide-react';
import { usePasskeys } from '@/hooks/usePasskeys';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

const browserSupported =
  typeof window !== 'undefined' && !!window.PublicKeyCredential;

export const PasskeysSettingsSection = () => {
  const { passkeys, loading, fetchPasskeys, rename, remove } = usePasskeys();
  const { toast } = useToast();

  const [showAdd, setShowAdd] = useState(false);
  const [newNickname, setNewNickname] = useState('');
  const [registering, setRegistering] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const handleAdd = async () => {
    setRegistering(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not signed in');

      const beginRes = await supabase.functions.invoke('passkey-register-begin', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (beginRes.error || !beginRes.data) {
        throw new Error(beginRes.error?.message || 'Failed to start');
      }

      const attResp = await startRegistration({ optionsJSON: beginRes.data });

      const finishRes = await supabase.functions.invoke('passkey-register-finish', {
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: { response: attResp, nickname: newNickname || 'Passkey' },
      });
      if (finishRes.error || !finishRes.data?.verified) {
        throw new Error(finishRes.error?.message || 'Verification failed');
      }

      toast({ title: 'Passkey registered', description: 'You can now sign in with this passkey.' });
      setShowAdd(false);
      setNewNickname('');
      await fetchPasskeys();
    } catch (e: any) {
      if (e?.name === 'NotAllowedError') {
        // user cancelled
      } else {
        toast({
          title: 'Could not register passkey',
          description: e?.message ?? 'Unknown error',
          variant: 'destructive',
        });
      }
    } finally {
      setRegistering(false);
    }
  };

  const handleSaveRename = async (id: string) => {
    const { error } = await rename(id, editValue);
    if (error) {
      toast({ title: 'Rename failed', variant: 'destructive' });
    } else {
      toast({ title: 'Renamed' });
    }
    setEditingId(null);
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    const { error } = await remove(deleteId);
    setDeleting(false);
    setDeleteId(null);
    if (error) {
      toast({ title: 'Could not remove passkey', variant: 'destructive' });
    } else {
      toast({ title: 'Passkey removed' });
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-muted">
            <KeyRound className="w-5 h-5 text-muted-foreground" />
          </div>
          <div>
            <CardTitle className="text-lg">Passkeys</CardTitle>
            <CardDescription>
              Sign in with biometrics, your device PIN, or a security key.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {!browserSupported && (
          <Alert variant="destructive">
            <AlertDescription>
              Your browser does not support passkeys (WebAuthn).
            </AlertDescription>
          </Alert>
        )}

        {loading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : passkeys.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            You have no passkeys registered yet.
          </p>
        ) : (
          <div className="space-y-2">
            {passkeys.map((pk) => (
              <div key={pk.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50 gap-3">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <ShieldCheck className="w-5 h-5 text-muted-foreground shrink-0" />
                  <div className="min-w-0 flex-1">
                    {editingId === pk.id ? (
                      <div className="flex items-center gap-2">
                        <Input
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          className="h-8"
                          maxLength={60}
                          autoFocus
                        />
                        <Button size="sm" variant="ghost" onClick={() => handleSaveRename(pk.id)}>
                          <Check className="w-4 h-4" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium truncate">{pk.nickname}</p>
                          {pk.device_type === 'multiDevice' && (
                            <Badge variant="secondary" className="text-xs">Synced</Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Added {new Date(pk.created_at).toLocaleDateString()}
                          {pk.last_used_at && ` · Last used ${new Date(pk.last_used_at).toLocaleDateString()}`}
                        </p>
                      </>
                    )}
                  </div>
                </div>
                {editingId !== pk.id && (
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost" size="sm"
                      onClick={() => { setEditingId(pk.id); setEditValue(pk.nickname); }}
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost" size="sm"
                      className="text-destructive hover:text-destructive"
                      onClick={() => setDeleteId(pk.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {browserSupported && (
          <Button onClick={() => setShowAdd(true)} className="w-full" variant="outline">
            <Plus className="w-4 h-4 mr-2" />
            Add a passkey
          </Button>
        )}
      </CardContent>

      <Dialog open={showAdd} onOpenChange={(o) => { if (!registering) setShowAdd(o); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Register a new passkey</DialogTitle>
            <DialogDescription>
              Give this passkey a name so you can recognize it later (e.g. "MacBook Touch ID").
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="pk-nickname">Nickname</Label>
            <Input
              id="pk-nickname"
              value={newNickname}
              onChange={(e) => setNewNickname(e.target.value)}
              placeholder="e.g. MacBook Touch ID"
              maxLength={60}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdd(false)} disabled={registering}>
              Cancel
            </Button>
            <Button onClick={handleAdd} disabled={registering}>
              {registering ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Waiting for device…</>
              ) : 'Continue'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteId} onOpenChange={(o) => { if (!o) setDeleteId(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove this passkey?</DialogTitle>
            <DialogDescription>
              You won't be able to sign in with it anymore. You can register a new one at any time.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)} disabled={deleting}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Remove'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
};
