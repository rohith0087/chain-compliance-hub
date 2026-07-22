import React, { useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, X, Plus, Settings, Blocks, Plug, Zap } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface IntegrationsDirectoryModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const INTEGRATIONS = [
  {
    id: 'google-workspace',
    name: 'Google Workspace',
    description: 'Sync Google Calendar and Drive with TraceR2C.',
    connected: true,
    popular: '#1 popular',
    logo: (
      <div className="w-10 h-10 rounded-xl bg-card border shadow-sm flex items-center justify-center p-2">
        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M21.35 11.1H12.18V13.83H18.69C18.36 17.64 15.19 19.27 12.19 19.27C8.36 19.27 5 16.25 5 12C5 7.9 8.18 4.73 12.2 4.73C15.29 4.73 17.1 6.7 17.1 6.7L19 4.72C19 4.72 16.56 2 12.1 2C6.42 2 2.03 6.8 2.03 12C2.03 17.05 6.16 22 12.25 22C17.6 22 21.5 18.33 21.5 12.91C21.5 11.76 21.35 11.1 21.35 11.1Z" fill="#4285F4"/>
          <path d="M21.35 11.1H12.18V13.83H18.69C18.36 17.64 15.19 19.27 12.19 19.27C12.19 19.27 17.6 22 21.5 12.91C21.5 11.76 21.35 11.1 21.35 11.1Z" fill="#34A853"/>
          <path d="M2.03 12C2.03 17.05 6.16 22 12.25 22C12.25 22 8.36 19.27 5 16.25C5 12 2.03 12 2.03 12Z" fill="#FBBC05"/>
          <path d="M12.1 2C6.42 2 2.03 6.8 2.03 12C2.03 12 5 7.9 8.18 4.73C12.2 4.73 15.29 4.73 17.1 6.7L19 4.72C19 4.72 16.56 2 12.1 2Z" fill="#EA4335"/>
        </svg>
      </div>
    )
  },
  {
    id: 'microsoft-365',
    name: 'Microsoft 365',
    description: "Access your company's Outlook and OneDrive directly.",
    connected: false,
    popular: '#2 popular',
    logo: (
      <div className="w-10 h-10 rounded-xl bg-card border shadow-sm flex items-center justify-center p-2">
        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="2" y="2" width="9" height="9" fill="#F25022"/>
          <rect x="13" y="2" width="9" height="9" fill="#7FBA00"/>
          <rect x="2" y="13" width="9" height="9" fill="#00A4EF"/>
          <rect x="13" y="13" width="9" height="9" fill="#FFB900"/>
        </svg>
      </div>
    )
  },
  {
    id: 'whatsapp',
    name: 'WhatsApp Business',
    description: 'Send automated document request reminders to suppliers.',
    connected: false,
    new: true,
    logo: (
      <div className="w-10 h-10 rounded-xl bg-card border shadow-sm flex items-center justify-center p-1.5">
        <svg viewBox="0 0 24 24" fill="#25D366" xmlns="http://www.w3.org/2000/svg">
          <path d="M12.031 2C6.48 2 1.984 6.496 1.984 12.046c0 1.982.551 3.864 1.551 5.485L2 22l4.582-1.203c1.552.924 3.35 1.418 5.249 1.418h.004c5.551 0 10.047-4.496 10.047-10.047S17.586 2 12.031 2zm0 18.52h-.004c-1.674 0-3.315-.45-4.755-1.303l-.34-.202-3.535.928.946-3.447-.222-.352A8.34 8.34 0 013.67 12.046c0-4.636 3.774-8.41 8.41-8.41 4.636 0 8.41 3.774 8.41 8.41s-3.774 8.41-8.41 8.41zm4.619-6.311c-.253-.127-1.496-.739-1.728-.823-.232-.084-.401-.127-.569.127-.169.253-.654.823-.802.992-.148.169-.296.19-.549.063-.253-.127-1.069-.394-2.036-1.255-.753-.67-1.262-1.5-1.41-1.753-.148-.253-.016-.39.111-.517.114-.114.253-.296.38-.443.127-.148.169-.253.253-.422.084-.169.042-.317-.021-.443-.063-.127-.569-1.372-.78-1.879-.206-.494-.415-.427-.569-.434-.148-.007-.317-.007-.486-.007s-.443.063-.675.317c-.232.253-.886.865-.886 2.11s.907 2.448 1.034 2.617c.127.169 1.783 2.72 4.318 3.813 1.956.845 2.66.866 3.125.823.518-.048 1.496-.612 1.707-1.203.211-.591.211-1.097.148-1.203-.063-.106-.232-.169-.486-.296z"/>
        </svg>
      </div>
    )
  },
  {
    id: 'slack',
    name: 'Slack',
    description: 'Receive instant notifications for document uploads and AI analysis.',
    connected: false,
    popular: '#3 popular',
    logo: (
      <div className="w-10 h-10 rounded-xl bg-card border shadow-sm flex items-center justify-center p-1.5">
        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M5.56 16.58A2.52 2.52 0 103.04 19.1h2.52v-2.52zm1.26 0A2.52 2.52 0 109.34 19.1V12.8H6.82v3.78z" fill="#E01E5A"/>
          <path d="M7.42 5.56A2.52 2.52 0 104.9 3.04v2.52h2.52zm0 1.26A2.52 2.52 0 104.9 9.34h6.3V6.82H7.42z" fill="#36C5F0"/>
          <path d="M18.44 7.42A2.52 2.52 0 1020.96 4.9h-2.52v2.52zm-1.26 0A2.52 2.52 0 1014.66 4.9v6.3h2.52V7.42z" fill="#2EB67D"/>
          <path d="M16.58 18.44A2.52 2.52 0 1019.1 20.96v-2.52h-2.52zm0-1.26A2.52 2.52 0 1019.1 14.66h-6.3v2.52h3.78z" fill="#ECB22E"/>
        </svg>
      </div>
    )
  },
  {
    id: 'notion',
    name: 'Notion',
    description: 'Connect your Notion workspace to search and export audit reports.',
    connected: true,
    logo: (
      <div className="w-10 h-10 rounded-xl bg-card border shadow-sm flex items-center justify-center p-1.5">
        <svg viewBox="0 0 24 24" fill="black" xmlns="http://www.w3.org/2000/svg">
          <path d="M4.5 4v1h2v12h-2v1h15v-1h-2V5h2V4h-15zm4 1h5.5l3.5 12V5h1v14h-5L5 6v13h-1V5h4z"/>
        </svg>
      </div>
    )
  },
  {
    id: 'zoho',
    name: 'Zoho CRM',
    description: 'Push and pull CRM data and streamline audit reports.',
    connected: false,
    new: true,
    logo: (
      <div className="w-10 h-10 rounded-xl bg-card border shadow-sm flex items-center justify-center p-1.5">
        <svg viewBox="0 0 24 24" fill="#000000" xmlns="http://www.w3.org/2000/svg">
          <rect x="2" y="2" width="9" height="9" rx="2"/>
          <rect x="13" y="2" width="9" height="9" rx="2" fill="#E8303A"/>
          <rect x="2" y="13" width="9" height="9" rx="2" fill="#15993C"/>
          <rect x="13" y="13" width="9" height="9" rx="2" fill="#2562E8"/>
        </svg>
      </div>
    )
  },
];

export function IntegrationsDirectoryModal({ open, onOpenChange }: IntegrationsDirectoryModalProps) {
  const [search, setSearch] = useState('');

  const filteredIntegrations = INTEGRATIONS.filter(i => 
    i.name.toLowerCase().includes(search.toLowerCase()) || 
    i.description.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[1000px] h-[85vh] p-0 gap-0 overflow-hidden bg-muted flex flex-col border-none shadow-2xl rounded-2xl">
        
        {/* Header Area */}
        <div className="flex items-center justify-between px-6 py-4 border-b bg-card relative z-10 shrink-0">
          <h1 className="text-xl font-bold font-serif">Directory</h1>
          <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)} className="rounded-full hover:bg-muted w-8 h-8">
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Main Content Area */}
        <div className="flex flex-1 overflow-hidden">
          
          {/* Sidebar */}
          <div className="w-60 shrink-0 border-r bg-card p-4 hidden md:block">
            <nav className="space-y-1">
              <button className="flex items-center gap-3 w-full px-3 py-2 text-sm font-semibold text-foreground bg-muted rounded-lg transition-colors">
                <Blocks className="w-4 h-4" /> Connectors
              </button>
            </nav>
          </div>

          {/* Directory Grid */}
          <div className="flex-1 overflow-y-auto p-6 md:p-8 relative">
            <div className="max-w-4xl mx-auto space-y-6">
              
              {/* Search & Filters */}
              <div className="space-y-4">
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground/70" />
                  <Input 
                    placeholder="Search connectors..." 
                    className="pl-10 h-11 bg-card border-border shadow-sm rounded-xl focus-visible:ring-1 focus-visible:ring-primary/30"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>

                <div className="flex flex-wrap items-center justify-between gap-4">
                  <Badge variant="secondary" className="bg-muted/50 hover:bg-muted text-foreground/80 px-3 py-1 text-sm font-medium border-none">
                    TraceR2C & Partners
                  </Badge>
                  <div className="flex items-center gap-2">
                    <select className="h-9 px-3 rounded-lg border border-border bg-card text-sm text-muted-foreground outline-none hover:bg-muted">
                      <option>Filter by</option>
                      <option>Connected</option>
                      <option>New</option>
                    </select>
                    <select className="h-9 px-3 rounded-lg border border-border bg-card text-sm text-muted-foreground outline-none hover:bg-muted">
                      <option>Sort by</option>
                      <option>Popularity</option>
                      <option>A-Z</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredIntegrations.map((integration) => (
                  <div 
                    key={integration.id}
                    className="group bg-card border border-border rounded-2xl p-5 hover:border-border hover:shadow-md transition-all cursor-pointer flex flex-col h-full"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-4">
                        {integration.logo}
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold text-foreground">{integration.name}</h3>
                            {integration.new && (
                              <span className="text-micro font-bold text-danger bg-danger/10 px-1.5 py-0.5 rounded">New</span>
                            )}
                          </div>
                          {integration.popular && (
                            <div className="text-micro font-medium text-muted-foreground/70 mt-0.5">
                              {integration.popular}
                            </div>
                          )}
                        </div>
                      </div>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="w-8 h-8 rounded-full text-muted-foreground/70 hover:text-foreground hover:bg-muted"
                      >
                        {integration.connected ? <Settings className="w-4 h-4" /> : <Plus className="w-5 h-5" />}
                      </Button>
                    </div>
                    <p className="text-sm text-muted-foreground mt-auto pt-2">
                      {integration.description}
                    </p>
                  </div>
                ))}
              </div>

              {filteredIntegrations.length === 0 && (
                <div className="text-center py-12 text-muted-foreground">
                  No connectors found matching "{search}"
                </div>
              )}

            </div>
          </div>
        </div>

      </DialogContent>
    </Dialog>
  );
}
