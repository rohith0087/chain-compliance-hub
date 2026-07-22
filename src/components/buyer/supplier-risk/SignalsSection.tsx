import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Newspaper, ShieldAlert, Globe, RefreshCw, Inbox, ExternalLink } from 'lucide-react';
import { SupplierRiskProfile } from './riskData';

// Renders a signal title as an external "verify source" link when a source URL
// was captured; otherwise plain text.
function SourceTitle({ title, url }: { title: string; url?: string }) {
  if (!url) return <>{title}</>;
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-start gap-1 text-primary hover:underline"
      title="Verify source (opens in a new tab)"
    >
      <span>{title}</span>
      <ExternalLink className="h-3 w-3 mt-0.5 flex-shrink-0" />
    </a>
  );
}

const severityColor = (s: string) => {
  if (s === 'Critical') return 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300';
  if (s === 'High') return 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300';
  if (s === 'Medium') return 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300';
  return 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300';
};

export function SignalsSection({ supplier }: { supplier: SupplierRiskProfile }) {
  const [showShimmer] = useState(true);

  return (
    <Card className="border-border/50 shadow-sm">
      <Tabs defaultValue="news">
        <div className="flex items-center justify-between px-4 pt-4 pb-0">
          <TabsList className="h-8">
            <TabsTrigger value="news" className="text-xs gap-1"><Newspaper className="h-3 w-3" /> News & Trade</TabsTrigger>
            <TabsTrigger value="recalls" className="text-xs gap-1"><ShieldAlert className="h-3 w-3" /> Recalls</TabsTrigger>
            <TabsTrigger value="web" className="text-xs gap-1"><Globe className="h-3 w-3" /> Web Presence</TabsTrigger>
          </TabsList>
          {showShimmer && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <RefreshCw className="h-3 w-3 animate-spin" /> Refreshing…
            </div>
          )}
        </div>

        <CardContent className="p-4 pt-3">
          {/* Shimmer loader */}
          {showShimmer && (
            <div className="flex gap-2 mb-3">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-3 w-20" />
            </div>
          )}

          <TabsContent value="news" className="mt-0">
            <ScrollArea className="h-[260px]">
              {supplier.news.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <Inbox className="h-10 w-10 mb-2 opacity-40" />
                  <p className="text-sm">No news found in last 30 days</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {supplier.news.map((n, i) => (
                    <div key={i} className="p-3 rounded-lg border border-border/50 bg-muted/20 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <h4 className="text-sm font-medium leading-tight"><SourceTitle title={n.headline} url={n.url} /></h4>
                        {n.riskImpact > 0 && (
                          <Badge variant="destructive" className="text-xs flex-shrink-0">+{n.riskImpact}</Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{n.source}</span>
                        <span>·</span>
                        <span>{n.timestamp}</span>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {n.tags.map(t => (
                          <Badge key={t} variant="outline" className="text-[10px] py-0">{t}</Badge>
                        ))}
                      </div>
                      <p className="text-xs text-muted-foreground italic">{n.reason}</p>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </TabsContent>

          <TabsContent value="recalls" className="mt-0">
            <ScrollArea className="h-[260px]">
              {supplier.recalls.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <Inbox className="h-10 w-10 mb-2 opacity-40" />
                  <p className="text-sm">No recalls or regulatory actions found</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {supplier.recalls.map((r, i) => (
                    <div key={i} className="p-3 rounded-lg border border-border/50 bg-muted/20 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <h4 className="text-sm font-medium"><SourceTitle title={r.eventType} url={r.url} /></h4>
                        <Badge className={`text-xs border-0 ${severityColor(r.severity)}`}>{r.severity}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">{r.product}</p>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span>{r.agency}</span>
                        <span>{r.date}</span>
                        <Badge variant={r.status === 'Open' ? 'destructive' : 'secondary'} className="text-[10px]">{r.status}</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </TabsContent>

          <TabsContent value="web" className="mt-0">
            <ScrollArea className="h-[260px]">
              <div className="space-y-3">
                {supplier.webSignals.map((w, i) => (
                  <div key={i} className="p-3 rounded-lg border border-border/50 bg-muted/20 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-medium"><SourceTitle title={w.title} url={w.url} /></h4>
                      <Badge variant="outline" className="text-xs">{w.confidence} confidence</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">{w.detail}</p>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </TabsContent>
        </CardContent>
      </Tabs>
    </Card>
  );
}
