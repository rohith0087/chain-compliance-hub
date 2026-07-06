import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

// Single markdown renderer shared by every AI surface (/chat, the per-supplier
// workspace assistant, and the floating launcher) so formatting is identical
// everywhere — GFM tables, task lists, code, links — not fragmented per page.
export const markdownComponents = {
  table: (props: any) => (
    <div className="my-3 overflow-x-auto rounded-lg border border-border">
      <table className="w-full border-collapse text-sm" {...props} />
    </div>
  ),
  thead: (props: any) => <thead className="bg-muted/50" {...props} />,
  th: (props: any) => <th className="border-b border-border px-3 py-2 text-left font-semibold text-foreground" {...props} />,
  td: (props: any) => <td className="border-b border-border/60 px-3 py-2 align-top" {...props} />,
  a: (props: any) => <a className="text-primary underline underline-offset-2" target="_blank" rel="noopener noreferrer" {...props} />,
  code: ({ inline, ...props }: any) =>
    inline
      ? <code className="rounded bg-muted px-1 py-0.5 text-[0.85em]" {...props} />
      : <code className="block overflow-x-auto rounded-md bg-muted p-3 text-xs" {...props} />,
  ul: (props: any) => <ul className="my-2 list-disc space-y-1 pl-5" {...props} />,
  ol: (props: any) => <ol className="my-2 list-decimal space-y-1 pl-5" {...props} />,
};

export default function MarkdownMessage({ children, className }: { children: string; className?: string }) {
  return (
    <div className={`prose prose-sm dark:prose-invert max-w-none leading-relaxed text-muted-foreground prose-headings:text-foreground prose-strong:text-foreground ${className ?? ""}`}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>{children}</ReactMarkdown>
    </div>
  );
}
