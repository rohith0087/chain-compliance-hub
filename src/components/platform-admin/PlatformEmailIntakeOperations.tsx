/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect,useState } from 'react';
import { AlertTriangle,Inbox,Loader2,RefreshCw,ShieldAlert } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Card,CardContent,CardHeader,CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

export function PlatformEmailIntakeOperations(){
  const db=supabase as any;const {toast}=useToast();const [loading,setLoading]=useState(true);const [messages,setMessages]=useState<any[]>([]);const [jobs,setJobs]=useState<any[]>([]);const [alerts,setAlerts]=useState<any[]>([]);
  const load=async()=>{setLoading(true);try{const [m,j,a]=await Promise.all([
    db.from('inbound_email_messages').select('id,normalized_sender,subject,status,match_result,quarantine_reason,received_at').or('candidate_buyer_id.is.null,status.in.(quarantined,failed)').order('received_at',{ascending:false}).limit(100),
    db.from('inbound_processing_jobs').select('id,message_id,status,attempts,last_error,created_at').in('status',['retry','failed','dead_letter']).order('created_at',{ascending:false}).limit(100),
    db.from('inbound_operational_alerts').select('*').in('status',['open','acknowledged']).order('last_seen_at',{ascending:false}),
  ]);if(m.error||j.error||a.error)throw m.error||j.error||a.error;setMessages(m.data||[]);setJobs(j.data||[]);setAlerts(a.data||[]);}catch(error:any){toast({title:'Email operations unavailable',description:error.message,variant:'destructive'});}finally{setLoading(false);}};
  // The platform queue is loaded once on entry and refreshed explicitly.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(()=>{void load();},[]);
  if(loading)return <div className="flex min-h-72 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin"/></div>;
  return <div className="space-y-6"><div className="flex items-center justify-between"><div><h1 className="text-2xl font-semibold">Email Intake Operations</h1><p className="text-sm text-muted-foreground">Unknown senders, processing failures and security alerts.</p></div><Button variant="outline" onClick={()=>void load()}><RefreshCw className="mr-2 h-4 w-4"/>Refresh</Button></div>
    <div className="grid gap-4 md:grid-cols-3"><Card><CardHeader><CardTitle className="text-sm">Quarantined</CardTitle></CardHeader><CardContent className="text-3xl font-semibold">{messages.length}</CardContent></Card><Card><CardHeader><CardTitle className="text-sm">Failed jobs</CardTitle></CardHeader><CardContent className="text-3xl font-semibold">{jobs.length}</CardContent></Card><Card><CardHeader><CardTitle className="text-sm">Open alerts</CardTitle></CardHeader><CardContent className="text-3xl font-semibold">{alerts.length}</CardContent></Card></div>
    {!!alerts.length&&<Card className="border-amber-300"><CardHeader><CardTitle className="flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-amber-600"/>Operational alerts</CardTitle></CardHeader><CardContent className="space-y-2">{alerts.map(alert=><div key={alert.id} className="flex items-center justify-between rounded-md border p-3"><div><p className="font-medium">{alert.alert_key}</p><p className="text-xs text-muted-foreground">{new Date(alert.last_seen_at).toLocaleString()}</p></div><Badge variant={alert.severity==='critical'?'destructive':'secondary'}>{alert.severity}</Badge></div>)}</CardContent></Card>}
    <Card><CardHeader><CardTitle className="flex items-center gap-2"><Inbox className="h-5 w-5"/>Unknown and quarantined messages</CardTitle></CardHeader><CardContent className="space-y-2">{!messages.length?<p className="text-sm text-muted-foreground">No quarantined messages.</p>:messages.map(message=><div key={message.id} className="rounded-md border p-3"><div className="flex items-start justify-between gap-3"><div><p className="font-medium">{message.subject||'(No subject)'}</p><p className="text-sm text-muted-foreground">{message.normalized_sender} · {new Date(message.received_at).toLocaleString()}</p></div><Badge variant="outline">{message.match_result}</Badge></div><p className="mt-2 flex items-center gap-1 text-xs text-amber-700"><ShieldAlert className="h-3 w-3"/>{message.quarantine_reason||'Restricted platform quarantine'}</p></div>)}</CardContent></Card>
    {!!jobs.length&&<Card><CardHeader><CardTitle>Failed processing jobs</CardTitle></CardHeader><CardContent className="space-y-2">{jobs.map(job=><div key={job.id} className="rounded-md border p-3"><div className="flex justify-between"><span className="font-medium">{job.status}</span><Badge variant="destructive">attempt {job.attempts}</Badge></div><p className="mt-1 text-xs text-muted-foreground">{job.last_error||'No error detail'}</p></div>)}</CardContent></Card>}
  </div>;
}
