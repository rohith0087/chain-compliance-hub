# Help Center screenshots

Drop screenshots in this folder and they appear automatically in `/help` —
no code change needed. Until a file exists, the article shows a quiet
"Screenshot coming soon" placeholder instead of a broken image.

## Naming convention

```
public/help/<category-id>/<article-slug>-<n>.png
```

- `<category-id>` — the help category folder: `getting-started`, `documents`,
  `onboarding`, `compliance`, `notifications-alerts`, `account-security`
- `<article-slug>` — short kebab-case slug for the article
- `<n>` — 1, 2, 3… if an article has multiple screenshots
- PNG preferred (JPG also works — keep the extension in sync with the
  article's image reference in `src/components/help/helpContent.ts`)

## Screenshots currently referenced by articles

| File to upload | Shown in |
| --- | --- |
| `getting-started/navigate-dashboard-1.png` | How do I navigate the dashboard? |
| `documents/request-documents-1.png` | How do I request documents from suppliers? |
| `onboarding/onboarding-process-1.png` | How does the supplier onboarding process work? |
| `account-security/enable-mfa-1.png` | How do I enable two-factor authentication (MFA)? |

To add a screenshot to any other article, add a line to its answer in
`src/components/help/helpContent.ts`:

```
![Caption shown under the image](category-id/article-slug-1.png)
```

## Capture tips

- Capture at ~1400px wide, light theme, with test data only (no real
  customer names or emails).
- Crop to the relevant panel — full-desktop shots shrink too small to read.
