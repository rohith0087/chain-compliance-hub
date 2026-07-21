import type { ReactNode } from 'react';

/**
 * UI catalogue for Composio integrations. Mirrors the backend registry in
 * supabase/functions/_shared/composioToolkits.ts — a toolkit shown here must
 * exist there, or Connect will fail server-side.
 *
 * Grouped by what the integration *does for the user*, not by vendor category,
 * so the page reads as capability rather than a list of logos.
 */

export type ComposioToolkitSlug = 'one_drive';

export interface ComposioCatalogEntry {
  slug: ComposioToolkitSlug;
  name: string;
  /** Plain-language statement of what connecting this lets the assistant do. */
  capability: string;
  group: string;
  /** True once the backend has an auth config and the tools are wired. */
  available: boolean;
  logo: ReactNode;
}

const tile = (bg: string, children: ReactNode) => (
  <div
    className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[10px]"
    style={{ background: bg }}
  >
    {children}
  </div>
);

export const COMPOSIO_CATALOG: ComposioCatalogEntry[] = [
  {
    slug: 'one_drive',
    name: 'OneDrive',
    capability: 'Let the assistant find and read supplier certificates stored in your OneDrive.',
    group: 'Document sources',
    available: true,
    logo: tile(
      '#0364B8',
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path
          d="M10.3 8.1a4.6 4.6 0 018.2 1.6 3.4 3.4 0 01-.5 6.8H7a3.7 3.7 0 01-.6-7.3 4 4 0 013.9-1.1z"
          fill="#fff"
        />
      </svg>,
    ),
  },
];

/** Toolkits we intend to support but haven't wired yet — shown as "coming soon". */
export const COMPOSIO_ROADMAP: { name: string; capability: string; group: string; logo: ReactNode }[] = [
  {
    name: 'SharePoint',
    capability: 'Read supplier documents from SharePoint document libraries.',
    group: 'Document sources',
    logo: tile('#038387', <span className="text-[11px] font-black text-white">SP</span>),
  },
  {
    name: 'Outlook',
    capability: 'Draft and send supplier follow-ups from your mailbox (with approval).',
    group: 'Supplier outreach',
    logo: tile('#0F6CBD', <span className="text-[13px] font-black text-white">O</span>),
  },
  {
    name: 'DocuSign',
    capability: 'Send quality agreements and spec sign-offs for signature.',
    group: 'Supplier outreach',
    logo: tile('#C9E500', <span className="text-[11px] font-black text-[#111]">DS</span>),
  },
];
