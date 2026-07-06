import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Sparkles, ArrowRight, ListTodo } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/hooks/useAuth';

interface AuditorDashboardPanelProps {
  buyerId?: string;
  onNavigateToTab: (tab: string) => void;
}

type TabFilter = 'all' | 'week' | 'blocked' | 'ready';

export function AuditorDashboardPanel({ buyerId, onNavigateToTab }: AuditorDashboardPanelProps) {
  const [activeTab, setActiveTab] = useState<TabFilter>('all');
  const { profile } = useAuth();

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };
  
  const firstName = profile?.full_name?.split(' ')[0] || 'Auditor';

  const rows = [
    {
      id: 1,
      state: 'blocked week',
      dot: 'bg-red-600 shadow-[0_0_0_4px_#FDECEC]',
      clientName: 'Himalaya Foods',
      tag: { text: '2 docs overdue', color: 'text-red-600 bg-red-50' },
      sub: 'Physical audit · Pharma',
      dueLab: 'Due',
      dueVal: 'Tomorrow',
      dueUrgent: true,
      docsCount: '3 / 5',
      docsPct: '60%',
      docsColor: 'bg-red-600',
      actionText: 'Chase documents',
      actionType: 'primary',
      preCheck: '62%',
      nudge: {
        text: (
          <>
            <b>2 documents are 3 days overdue.</b> I can draft a follow-up to the supplier and flag the 2 missing items against their GMP checklist.
          </>
        ),
        yesText: 'Draft follow-up'
      }
    },
    {
      id: 2,
      state: 'blocked week',
      dot: 'bg-amber-500 shadow-[0_0_0_4px_#FEF3E2]',
      clientName: 'Spice Mills Pvt Ltd',
      tag: { text: '1 doc pending', color: 'text-amber-700 bg-amber-50' },
      sub: 'Physical audit · Food & Beverage',
      dueLab: 'Due',
      dueVal: 'Friday',
      dueUrgent: false,
      docsCount: '4 / 5',
      docsPct: '80%',
      docsColor: 'bg-blue-600',
      actionText: 'Review documents',
      actionType: 'ghost',
      preCheck: '88%',
      nudge: null
    },
    {
      id: 3,
      state: 'ready',
      dot: 'bg-green-600 shadow-[0_0_0_4px_#E9F8EF]',
      clientName: 'Coastal Seafood Exports',
      tag: { text: 'Ready to finalize', color: 'text-green-700 bg-green-50' },
      sub: 'Desk audit · Seafood',
      dueLab: 'Due',
      dueVal: 'Next Monday',
      dueUrgent: false,
      docsCount: '5 / 5',
      docsPct: '100%',
      docsColor: 'bg-green-600',
      actionText: 'Run desk audit check',
      actionType: 'primary',
      preCheck: '91%',
      nudge: null
    },
    {
      id: 4,
      state: 'ready',
      dot: 'bg-green-600 shadow-[0_0_0_4px_#E9F8EF]',
      clientName: 'Organic Farms India',
      tag: { text: 'Ready to finalize', color: 'text-green-700 bg-green-50' },
      sub: 'Desk audit · Agriculture',
      dueLab: 'Due',
      dueVal: 'In 2 weeks',
      dueUrgent: false,
      docsCount: '5 / 5',
      docsPct: '100%',
      docsColor: 'bg-green-600',
      actionText: 'Run desk audit check',
      actionType: 'primary',
      preCheck: '95%',
      nudge: null
    },
    {
      id: 5,
      state: 'blocked',
      dot: 'bg-blue-600 shadow-[0_0_0_4px_#EFF4FF]',
      clientName: 'Green Valley Dairy',
      tag: { text: 'Waiting on supplier', color: 'text-blue-700 bg-blue-50' },
      sub: 'Desk audit · Dairy',
      dueLab: 'Due',
      dueVal: 'In 3 weeks',
      dueUrgent: false,
      docsCount: '2 / 5',
      docsPct: '40%',
      docsColor: 'bg-amber-500',
      actionText: 'Send reminder',
      actionType: 'ghost',
      preCheck: '40%',
      nudge: null
    }
  ];

  const filteredRows = rows.filter(r => activeTab === 'all' || r.state.includes(activeTab));

  return (
    <div className="w-full max-w-[1180px] mx-auto py-6">
      
      {/* Greeting */}
      <div className="mb-6">
        <h1 className="text-[27px] font-extrabold text-foreground tracking-tight">{getGreeting()}, {firstName}</h1>
        <p className="text-[15px] text-muted-foreground mt-1">Here's everything on your plate, ordered by what needs you first.</p>
      </div>

      {/* Global AI Strip */}
      <div className="bg-gradient-to-b from-card to-slate-50 border border-border rounded-2xl p-4 flex flex-col md:flex-row md:items-center gap-4 shadow-sm mb-6">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 shrink-0 flex items-center justify-center shadow-[0_4px_12px_rgba(37,99,235,0.28)]">
          <Sparkles className="w-5 h-5 text-white" />
        </div>
        <div className="text-[14.5px] text-foreground/80 leading-relaxed flex-1">
          <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-blue-700 border border-blue-200 bg-card rounded-full px-2.5 py-0.5 mr-2 align-text-bottom">
            <Sparkles className="w-3 h-3" /> AI Briefing
          </span>
          <b className="text-foreground font-semibold">2 audits this week.</b> Himalaya Foods is overdue on 2 documents and due tomorrow — your most urgent item.
          Spice Mills needs 1 more doc before Friday. <b className="text-foreground font-semibold">3 audits are ready to finalize.</b>
        </div>
        <button className="shrink-0 border border-border bg-card text-foreground/80 font-semibold text-[13px] rounded-xl px-4 py-2 hover:bg-muted transition-colors whitespace-nowrap w-full md:w-auto">
          Ask the assistant
        </button>
      </div>

      {/* Counts / Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        
        <div className="bg-card border border-border rounded-2xl p-4 shadow-sm hover:shadow-md hover:-translate-y-[1px] transition-all cursor-pointer">
          <div className="text-[12.5px] text-muted-foreground font-medium flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-blue-600" /> Audits this week
          </div>
          <div className="text-[30px] font-extrabold text-foreground mt-2 leading-none tracking-tight">2</div>
          <div className="text-[12px] text-muted-foreground/70 mt-1.5">Himalaya · Spice Mills</div>
        </div>

        <div className="bg-card border border-border rounded-2xl p-4 shadow-sm hover:shadow-md hover:-translate-y-[1px] transition-all cursor-pointer">
          <div className="text-[12.5px] text-muted-foreground font-medium flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-amber-500" /> Documents pending
          </div>
          <div className="text-[30px] font-extrabold text-foreground mt-2 leading-none tracking-tight">6</div>
          <div className="text-[12px] text-muted-foreground/70 mt-1.5">across 3 clients</div>
        </div>

        <div className="bg-card border border-border rounded-2xl p-4 shadow-sm hover:shadow-md hover:-translate-y-[1px] transition-all cursor-pointer">
          <div className="text-[12.5px] text-muted-foreground font-medium flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-600" /> Ready to finalize
          </div>
          <div className="text-[30px] font-extrabold text-green-600 mt-2 leading-none tracking-tight">3</div>
          <div className="text-[12px] text-muted-foreground/70 mt-1.5">all docs received</div>
        </div>

        <div className="bg-gradient-to-b from-card to-[#fffafa] border border-[#F6D5D5] rounded-2xl p-4 shadow-sm hover:shadow-md hover:-translate-y-[1px] transition-all cursor-pointer">
          <div className="text-[12.5px] text-muted-foreground font-medium flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-red-600" /> Needs attention
          </div>
          <div className="text-[30px] font-extrabold text-foreground mt-2 leading-none tracking-tight">2</div>
          <div className="text-[12px] text-muted-foreground/70 mt-1.5">overdue or blocked</div>
        </div>

      </div>

      {/* Worklist Header */}
      <div className="flex flex-col md:flex-row md:items-center gap-4 mb-4">
        <h2 className="text-[17px] font-bold text-foreground flex items-center gap-2">
          <ListTodo className="w-5 h-5 text-muted-foreground" />
          Needs your attention
        </h2>
        <div className="md:ml-auto flex gap-1 bg-muted p-1 rounded-xl overflow-x-auto">
          {[
            { id: 'all', label: 'All' },
            { id: 'week', label: 'This week' },
            { id: 'blocked', label: 'Blocked' },
            { id: 'ready', label: 'Ready' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as TabFilter)}
              className={`text-[13px] font-semibold px-3.5 py-1.5 rounded-lg whitespace-nowrap transition-all ${
                activeTab === tab.id 
                  ? 'bg-card text-foreground shadow-sm' 
                  : 'text-muted-foreground hover:text-foreground/80'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Worklist Rows */}
      <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden flex flex-col">
        <AnimatePresence initial={false}>
          {filteredRows.map((row, index) => (
            <motion.div
              key={row.id}
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className={`border-b border-border last:border-0 hover:bg-card transition-colors`}
            >
              <div className="grid grid-cols-1 md:grid-cols-[18px_1fr_150px_188px_132px] items-center gap-4 md:gap-[18px] p-4 md:px-5 md:py-[17px]">
                
                {/* 1. Dot */}
                <div className="hidden md:block">
                  <div className={`w-[11px] h-[11px] rounded-full ${row.dot}`} />
                </div>

                {/* 2. Client Info */}
                <div className="flex flex-col">
                  <div className="flex items-center gap-2 md:hidden mb-2">
                    <div className={`w-[11px] h-[11px] rounded-full ${row.dot}`} />
                    <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Status</span>
                  </div>
                  <div className="text-[15px] font-bold text-foreground">{row.clientName}</div>
                  <div className="text-[12.5px] text-muted-foreground mt-1 flex flex-wrap items-center gap-1.5">
                    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-md ${row.tag.color}`}>
                      {row.tag.text}
                    </span>
                    <span className="opacity-50">·</span>
                    {row.sub}
                  </div>
                </div>

                {/* 3. Due Date */}
                <div className="flex flex-col">
                  <span className="text-[11.5px] text-muted-foreground/70 font-medium">{row.dueLab}</span>
                  <span className={`font-semibold mt-0.5 ${row.dueUrgent ? 'text-red-600' : 'text-foreground/80'}`}>
                    {row.dueVal}
                  </span>
                </div>

                {/* 4. Docs Progress */}
                <div className="flex flex-col gap-1.5">
                  <div className="flex justify-between text-[12px] text-muted-foreground font-medium">
                    <span>Documents</span>
                    <b className="text-foreground/80 font-semibold">{row.docsCount}</b>
                  </div>
                  <div className="h-[7px] bg-muted rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${row.docsColor}`} style={{ width: row.docsPct }} />
                  </div>
                </div>

                {/* 5. Actions */}
                <div className="flex flex-col items-end gap-[7px] md:w-full">
                  <button 
                    className={`w-full border rounded-xl font-semibold text-[13px] px-3 py-2 text-center transition-colors ${
                      row.actionType === 'primary' 
                        ? 'bg-blue-600 text-white border-transparent hover:bg-blue-700'
                        : 'bg-card text-foreground/80 border-border hover:bg-muted'
                    }`}
                  >
                    {row.actionText}
                  </button>
                  <div className="text-[11.5px] text-muted-foreground font-medium flex items-center gap-1">
                    AI pre-check <b className="text-foreground/80 font-bold">{row.preCheck}</b>
                  </div>
                </div>

                {/* 6. Inline Nudge (if exists) */}
                {row.nudge && (
                  <div className="md:col-start-2 md:col-span-4 mt-2 md:mt-1 bg-blue-50/50 border border-blue-100 rounded-xl p-3 flex flex-col md:flex-row md:items-center gap-3">
                    <div className="w-[26px] h-[26px] rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 shrink-0 flex items-center justify-center shadow-sm">
                      <Sparkles className="w-3.5 h-3.5 text-white" />
                    </div>
                    <div className="text-[13px] text-blue-900 leading-[1.45] flex-1">
                      {row.nudge.text}
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <button className="bg-blue-600 hover:bg-blue-700 text-white font-semibold text-[12.5px] rounded-lg px-3 py-1.5 transition-colors">
                        {row.nudge.yesText}
                      </button>
                      <button className="bg-card border border-blue-200 text-blue-700 font-semibold text-[12.5px] rounded-lg px-3 py-1.5 hover:bg-blue-50 transition-colors">
                        Dismiss
                      </button>
                    </div>
                  </div>
                )}
                
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
        {filteredRows.length === 0 && (
          <div className="p-8 text-center text-muted-foreground text-sm">
            No audits found for this filter.
          </div>
        )}
      </div>

    </div>
  );
}
