import { useState, type ReactNode } from 'react';
import {
  Home, FileCheck, FileText, ListChecks, Users, UserCheck, UserCog,
  MessageSquare, BarChart3, Settings, Bell, Search, Upload, Download,
  Plus, RefreshCw, Shield, Share2, Building2, Mail, KeyRound, Volume2,
  Info, Lightbulb, AlertTriangle, ImageIcon, type LucideIcon,
} from 'lucide-react';

// ─────────────────────────────────────────────────────────────────────────────
// Microsoft-Learn-style rich text for the Help Center.
//
// Answers are written in a tiny line-based markup:
//   **bold**                      → emphasized UI/product terms
//   [[icon-key]]                  → inline chip with the app's real nav icon
//   [[icon-key|Custom label]]     → same, custom label
//   1. / 2. / …                   → numbered step list
//   - item                        → bullet list
//   > Note: …  > Tip: …  > Important: …   → callout boxes
//   ![Caption](category/file.png) → screenshot from /public/help/… (hidden
//                                    gracefully until the image is uploaded)
// ─────────────────────────────────────────────────────────────────────────────

/** Keys map 1:1 to the icons used in the actual sidebar / header, so a step
 *  like “open [[documents]]” shows the exact icon the user must look for. */
export const HELP_ICONS: Record<string, { icon: LucideIcon; label: string }> = {
  overview:      { icon: Home,           label: 'Overview' },
  documents:     { icon: FileCheck,      label: 'Documents' },
  library:       { icon: FileText,       label: 'Document Library' },
  requests:      { icon: ListChecks,     label: 'Requests' },
  'new-request': { icon: Plus,           label: 'New Request' },
  suppliers:     { icon: Users,          label: 'Suppliers' },
  connections:   { icon: Users,          label: 'Buyer Connections' },
  onboarding:    { icon: UserCheck,      label: 'Onboarding' },
  contacts:      { icon: UserCog,        label: 'Contact Management' },
  messages:      { icon: MessageSquare,  label: 'Messages' },
  compliance:    { icon: BarChart3,      label: 'Compliance' },
  evidence:      { icon: Share2,         label: 'Evidence Sharing' },
  settings:      { icon: Settings,       label: 'Settings' },
  branches:      { icon: Building2,      label: 'Branches' },
  security:      { icon: Shield,         label: 'Security' },
  mfa:           { icon: KeyRound,       label: 'Two-Factor Authentication' },
  notifications: { icon: Bell,           label: 'Notifications' },
  sound:         { icon: Volume2,        label: 'Sound' },
  search:        { icon: Search,         label: 'Search' },
  upload:        { icon: Upload,         label: 'Upload' },
  download:      { icon: Download,       label: 'Download' },
  renew:         { icon: RefreshCw,      label: 'Renew' },
  email:         { icon: Mail,           label: 'Email' },
};

/** Inline chip that mirrors how the element looks in the app chrome. */
const IconChip = ({ ikey, label }: { ikey: string; label?: string }) => {
  const entry = HELP_ICONS[ikey];
  if (!entry) return <strong className="font-semibold text-foreground">{label ?? ikey}</strong>;
  const Icon = entry.icon;
  return (
    <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-md border border-border bg-muted/60 px-1.5 py-0.5 align-middle text-[0.85em] font-medium text-foreground">
      <Icon className="h-3.5 w-3.5 text-primary" />
      {label ?? entry.label}
    </span>
  );
};

/** Parses `**bold**` and `[[icon]]` / `[[icon|Label]]` inside one line. */
const renderInline = (text: string): ReactNode[] => {
  const parts = text.split(/(\*\*[^*]+\*\*|\[\[[^\]]+\]\])/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i} className="font-semibold text-foreground">{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith('[[') && part.endsWith(']]')) {
      const body = part.slice(2, -2);
      const [ikey, label] = body.split('|');
      return <IconChip key={i} ikey={ikey.trim()} label={label?.trim()} />;
    }
    return part;
  });
};

const CALLOUTS: Record<string, { icon: LucideIcon; cls: string; iconCls: string }> = {
  note:      { icon: Info,          cls: 'border-primary/30 bg-primary/[0.06]',  iconCls: 'text-primary' },
  tip:       { icon: Lightbulb,     cls: 'border-success/30 bg-success/[0.06]',  iconCls: 'text-success' },
  important: { icon: AlertTriangle, cls: 'border-warning/40 bg-warning/[0.08]',  iconCls: 'text-warning' },
};

/** Screenshot slot: renders nothing visible-broken while the image hasn't
 *  been uploaded yet — it swaps in automatically once the file exists. */
const HelpImage = ({ src, caption }: { src: string; caption: string }) => {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <div className="my-3 flex items-center gap-2 rounded-lg border border-dashed border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground/70">
        <ImageIcon className="h-3.5 w-3.5 shrink-0" />
        Screenshot coming soon — {caption}
      </div>
    );
  }
  return (
    <figure className="my-3 overflow-hidden rounded-lg border border-border shadow-sm">
      <img
        src={`/help/${src}`}
        alt={caption}
        loading="lazy"
        className="w-full bg-background"
        onError={() => setFailed(true)}
      />
      <figcaption className="border-t border-border bg-muted/40 px-3 py-1.5 text-xs text-muted-foreground">
        {caption}
      </figcaption>
    </figure>
  );
};

type Block =
  | { kind: 'p'; text: string }
  | { kind: 'ol' | 'ul'; items: string[] }
  | { kind: 'callout'; tone: keyof typeof CALLOUTS; text: string }
  | { kind: 'image'; src: string; caption: string };

const parseBlocks = (markup: string): Block[] => {
  const blocks: Block[] = [];
  for (const raw of markup.split('\n')) {
    const line = raw.trim();
    if (!line) continue;

    const img = line.match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
    if (img) { blocks.push({ kind: 'image', caption: img[1], src: img[2] }); continue; }

    const callout = line.match(/^>\s*(Note|Tip|Important):\s*(.*)$/i);
    if (callout) {
      blocks.push({ kind: 'callout', tone: callout[1].toLowerCase() as keyof typeof CALLOUTS, text: callout[2] });
      continue;
    }

    const step = line.match(/^\d+\.\s+(.*)$/);
    if (step) {
      const last = blocks[blocks.length - 1];
      if (last?.kind === 'ol') last.items.push(step[1]);
      else blocks.push({ kind: 'ol', items: [step[1]] });
      continue;
    }

    const bullet = line.match(/^-\s+(.*)$/);
    if (bullet) {
      const last = blocks[blocks.length - 1];
      if (last?.kind === 'ul') last.items.push(bullet[1]);
      else blocks.push({ kind: 'ul', items: [bullet[1]] });
      continue;
    }

    blocks.push({ kind: 'p', text: line });
  }
  return blocks;
};

/** Strips markup so the help search matches what the user actually reads. */
export const helpPlainText = (markup: string): string =>
  markup
    .replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, '$2')
    .replace(/\[\[([^\]]+)\]\]/g, (_, key: string) => HELP_ICONS[key.trim()]?.label ?? key)
    .replace(/\*\*/g, '')
    .replace(/^!\[([^\]]*)\]\([^)]+\)$/gm, '$1')
    .replace(/^>\s*(Note|Tip|Important):/gim, '');

export const HelpRichText = ({ content }: { content: string }) => (
  <div className="space-y-3 text-[0.925rem] leading-relaxed text-muted-foreground">
    {parseBlocks(content).map((block, i) => {
      switch (block.kind) {
        case 'p':
          return <p key={i}>{renderInline(block.text)}</p>;
        case 'ol':
          return (
            <ol key={i} className="space-y-2.5">
              {block.items.map((item, j) => (
                <li key={j} className="flex gap-3">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-semibold text-primary">
                    {j + 1}
                  </span>
                  <span className="min-w-0">{renderInline(item)}</span>
                </li>
              ))}
            </ol>
          );
        case 'ul':
          return (
            <ul key={i} className="space-y-1.5">
              {block.items.map((item, j) => (
                <li key={j} className="flex gap-2.5">
                  <span className="mt-[9px] h-1 w-1 shrink-0 rounded-full bg-primary" />
                  <span className="min-w-0">{renderInline(item)}</span>
                </li>
              ))}
            </ul>
          );
        case 'callout': {
          const { icon: Icon, cls, iconCls } = CALLOUTS[block.tone];
          return (
            <div key={i} className={`flex gap-2.5 rounded-lg border px-3 py-2.5 ${cls}`}>
              <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${iconCls}`} />
              <p className="min-w-0">
                <span className="mr-1 font-semibold capitalize text-foreground">{block.tone}:</span>
                {renderInline(block.text)}
              </p>
            </div>
          );
        }
        case 'image':
          return <HelpImage key={i} src={block.src} caption={block.caption} />;
      }
    })}
  </div>
);
