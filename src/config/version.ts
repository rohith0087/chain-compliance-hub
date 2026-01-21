export const APP_VERSION = "1.2";

export interface ReleaseNote {
  version: string;
  date: string;
  title: string;
  highlights: string[];
}

export const RELEASE_NOTES: ReleaseNote[] = [
  {
    version: "1.2",
    date: "January 2026",
    title: "Navigation & Settings Improvements",
    highlights: [
      "Reorganized settings for easier access",
      "New user profile dropdown in header",
      "Company settings moved to Company Management",
      "Enhanced MFA security options"
    ]
  },
  {
    version: "1.1",
    date: "December 2025",
    title: "Multi-Factor Authentication",
    highlights: [
      "Added optional MFA support",
      "Enhanced security settings",
      "Branch-based permissions"
    ]
  },
  {
    version: "1.0",
    date: "November 2025",
    title: "Initial Release",
    highlights: [
      "Buyer & Supplier dashboards",
      "Document management system",
      "Onboarding pipeline",
      "Real-time messaging"
    ]
  }
];
