import { useLocation, useNavigate, Link } from "react-router-dom";
import { useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { FileSearch, ArrowLeft, LayoutDashboard } from "lucide-react";

// A page that failed its audit. Compliance-flavored 404.
const HEADLINES = [
  "This page failed its audit.",
  "404: Evidence not found.",
  "This route is missing its Certificate of Existence.",
  "We requested this page from three suppliers. Still overdue.",
  "Non-compliant URL. No documentation on file.",
  "This page's paperwork was never filed.",
  "We checked every framework. This one's out of scope.",
];

const NotFound = () => {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  const headline = useMemo(() => HEADLINES[Math.floor(Math.random() * HEADLINES.length)], []);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-lg animate-in fade-in slide-in-from-bottom-3 duration-500">
        {/* 404 + rubber stamp */}
        <div className="relative mb-8 flex justify-center">
          <span className="select-none text-[9rem] font-black leading-none tracking-tighter text-muted-foreground/15 sm:text-[11rem]">
            404
          </span>
          <div
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rotate-[-11deg] rounded-md border-[3px] border-dashed border-destructive/70 px-4 py-1.5"
            style={{ boxShadow: "0 1px 0 hsl(var(--destructive) / 0.15)" }}
          >
            <span className="text-lg font-extrabold uppercase tracking-widest text-destructive/80 sm:text-xl">
              Non-compliant
            </span>
          </div>
        </div>

        {/* Headline */}
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <FileSearch className="h-6 w-6 text-primary" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">{headline}</h1>
          <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
            The page you're looking for couldn't be located in any of our records.
          </p>
        </div>

        {/* Mock audit finding */}
        <div className="mx-auto mt-6 max-w-md rounded-xl border border-border bg-card p-4 text-left shadow-sm">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Audit finding</span>
            <span className="rounded-md bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
              Severity: Low
            </span>
          </div>
          <p className="text-sm text-foreground">
            Requested route{" "}
            <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-foreground">{location.pathname}</code>{" "}
            has no supporting documentation and could not be verified.
          </p>
          <p className="mt-1.5 text-xs text-muted-foreground">
            Remediation: return to a page that actually exists. This finding has been logged to the audit trail. 🔍
          </p>
        </div>

        {/* Actions */}
        <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Button asChild>
            <Link to="/dashboard"><LayoutDashboard className="mr-2 h-4 w-4" /> Return to Dashboard</Link>
          </Button>
          <Button variant="outline" onClick={() => navigate(-1)}>
            <ArrowLeft className="mr-2 h-4 w-4" /> File an appeal (go back)
          </Button>
        </div>
      </div>
    </div>
  );
};

export default NotFound;
