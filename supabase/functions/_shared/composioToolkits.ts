/**
 * The toolkit registry: which Composio toolkits we support, their auth config,
 * and the exact tools the agent may call.
 *
 * TWO RULES, both learned the hard way during the spike:
 *
 * 1. Allowlist individual tools, never whole toolkits. `one_drive` has 83 tools
 *    including ONE_DRIVE_DELETE_ITEM_PERMANENTLY; `slack` has 167 including
 *    SLACK_DELETE_CHANNEL. A toolkit-level grant hands the agent all of them.
 *
 * 2. Curate from each tool's DESCRIPTION, not its name. A regex over tool slugs
 *    was tried and wrongly classified SHARE_POINT_RECYCLE_FILE (a delete),
 *    ONE_DRIVE_CHECKOUT_ITEM (locks the file for everyone else) and
 *    WORKBOOK_SORT_RANGE as read-only. The `scopes` array is misleading too --
 *    it lists scopes that PERMIT the call, so read-only tools often show
 *    Files.ReadWrite. Only the description is authoritative.
 *
 * The same list is pinned on the Composio auth config via
 * `restrict_to_following_tools`, so Composio's own server rejects anything else.
 * Keeping both means a mistake in one layer is still caught by the other.
 */

export type ToolkitSlug = 'one_drive';

export interface ToolkitConfig {
  /** Composio auth config id, created once via POST /auth_configs. */
  authConfigId: string;
  label: string;
  /** Shown in the UI: what connecting this actually enables. */
  capability: string;
  /** Tools the agent may call. Verified read-only unless `writeTools` says otherwise. */
  readTools: string[];
  /** Tools that mutate the third party. Every one requires explicit approval. */
  writeTools: string[];
}

export const TOOLKITS: Record<ToolkitSlug, ToolkitConfig> = {
  one_drive: {
    authConfigId: 'ac_DcD6zkTsfvIW',
    label: 'OneDrive',
    capability: 'Lets the assistant find and read supplier certificates stored in your OneDrive.',
    readTools: [
      'ONE_DRIVE_LIST_DRIVES',
      'ONE_DRIVE_LIST_FOLDER_CHILDREN',
      'ONE_DRIVE_SEARCH_DRIVE_ITEMS',
      'ONE_DRIVE_GET_ITEM',
      'ONE_DRIVE_DOWNLOAD_FILE',
      'ONE_DRIVE_DOWNLOAD_FILE_BY_PATH',
    ],
    // Slice 2 is read-only on purpose: it proves auth, execution and audit
    // without needing the approval gate.
    writeTools: [],
  },
};

/**
 * Namespaced Composio identity.
 *
 * `user:` is a person's own connection — the default, and what the agent acts
 * as. `org:` is reserved for shared workspace connections used by system
 * notifications, which have no acting user. The prefix makes the two
 * impossible to confuse: a buyer id can never be mistaken for a profile id.
 */
export function composioUserId(profileId: string): string {
  return `user:${profileId}`;
}

export function composioOrgId(buyerId: string): string {
  return `org:${buyerId}`;
}

/** True if the tool is allowed for this toolkit at all. */
export function isAllowedTool(toolkit: ToolkitSlug, tool: string): boolean {
  const config = TOOLKITS[toolkit];
  if (!config) return false;
  return config.readTools.includes(tool) || config.writeTools.includes(tool);
}

/** True if the tool mutates the third party and therefore needs approval. */
export function isWriteTool(toolkit: ToolkitSlug, tool: string): boolean {
  return TOOLKITS[toolkit]?.writeTools.includes(tool) ?? false;
}
