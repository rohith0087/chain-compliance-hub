import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { resolveStoragePath } from '@/utils/storagePath';
import { useToast } from '@/hooks/use-toast';
import {
  AlertTriangle,
  Check,
  Download,
  ExternalLink,
  FileText,
  Image as ImageIcon,
  Loader2,
  Maximize2,
  Minus,
  Plus,
  X,
} from 'lucide-react';
import { STATUS_BADGE_CONFIG } from './buyerReviewDesignSystem';
import EvidenceFieldsPanel from './EvidenceFieldsPanel';

type PreviewKind = 'image' | 'pdf' | 'office' | 'text' | 'unsupported';

interface PreviewUpload {
  file_path?: string | null;
  file_name?: string | null;
  mime_type?: string | null;
  file_size?: number | null;
}

interface DocumentPreviewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The latest document_uploads row: { file_path, file_name, mime_type, ... } */
  upload: PreviewUpload | null;
  /** Display title for the document (request title or file name) */
  title?: string;
  /** Document submission status, used for the header badge (pending/approved/...) */
  status?: string;
  /** Optional supplier label shown in the header subtitle */
  supplierName?: string;
  /** The document_requests id, needed for approve/decline */
  documentId?: string;
  /** When true, the doc is awaiting a buyer decision; show Approve / Reject. */
  canDecide?: boolean;
  /** True while the approve mutation for this doc is in flight. */
  approveBusy?: boolean;
  onApprove?: (documentId: string) => void | Promise<void>;
  onDecline?: (documentId: string) => void;
}

function getPreviewKind(fileName?: string | null, mimeType?: string | null): PreviewKind {
  const mime = (mimeType || '').toLowerCase();
  const name = (fileName || '').toLowerCase();
  if (mime.startsWith('image/') || /\.(png|jpe?g|gif|webp|bmp|svg|avif)$/.test(name)) return 'image';
  if (mime === 'application/pdf' || name.endsWith('.pdf')) return 'pdf';
  if (
    mime.includes('msword') || mime.includes('officedocument') ||
    mime === 'application/vnd.ms-excel' || mime === 'application/vnd.ms-powerpoint' ||
    /\.(docx?|xlsx?|pptx?)$/.test(name)
  ) return 'office';
  if (mime.startsWith('text/') || /\.(txt|csv|md|json|log)$/.test(name)) return 'text';
  return 'unsupported';
}

function formatBytes(size?: number | null): string {
  if (!size || size <= 0) return '';
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = size;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) { value /= 1024; unit += 1; }
  return `${value.toFixed(value < 10 && unit > 0 ? 1 : 0)} ${units[unit]}`;
}

/** Pan + zoom image viewer: +/- buttons, mouse-wheel zoom, drag-to-pan. */
function ZoomableImage({ src, alt }: { src: string; alt: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const dragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0, ox: 0, oy: 0 });

  const clampZoom = (z: number) => Math.min(6, Math.max(1, Math.round(z * 100) / 100));
  const applyZoom = useCallback((next: number) => {
    const z = clampZoom(next);
    setZoom(z);
    if (z === 1) setOffset({ x: 0, y: 0 });
  }, []);

  // Native wheel listener so we can preventDefault (React onWheel is passive).
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      setZoom((z) => {
        const next = clampZoom(z + (e.deltaY < 0 ? 0.25 : -0.25));
        if (next === 1) setOffset({ x: 0, y: 0 });
        return next;
      });
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  // Reset when the image source changes.
  useEffect(() => { setZoom(1); setOffset({ x: 0, y: 0 }); }, [src]);

  const onMouseDown = (e: React.MouseEvent) => {
    if (zoom <= 1) return;
    dragging.current = true;
    dragStart.current = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y };
  };
  const onMouseMove = (e: React.MouseEvent) => {
    if (!dragging.current) return;
    setOffset({
      x: dragStart.current.ox + (e.clientX - dragStart.current.x),
      y: dragStart.current.oy + (e.clientY - dragStart.current.y),
    });
  };
  const endDrag = () => { dragging.current = false; };

  return (
    <div className="relative h-full w-full overflow-hidden bg-[#F1F5F9]">
      <div
        ref={containerRef}
        className="flex h-full w-full items-center justify-center"
        style={{ cursor: zoom > 1 ? (dragging.current ? 'grabbing' : 'grab') : 'default' }}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={endDrag}
        onMouseLeave={endDrag}
        onDoubleClick={() => applyZoom(zoom > 1 ? 1 : 2)}
      >
        <img
          src={src}
          alt={alt}
          draggable={false}
          className="max-h-full max-w-full select-none rounded-[10px] object-contain shadow-sm transition-transform duration-75"
          style={{ transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})` }}
        />
      </div>
      {/* Zoom controls */}
      <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-[12px] border border-[#E5E7EB] bg-white/95 px-1.5 py-1 shadow-[0_8px_24px_rgba(16,24,40,0.16)] backdrop-blur">
        <Button size="icon" variant="ghost" className="h-8 w-8 rounded-[8px] text-[#374151] hover:bg-gray-100" onClick={() => applyZoom(zoom - 0.25)} disabled={zoom <= 1} title="Zoom out">
          <Minus className="h-4 w-4" />
        </Button>
        <span className="w-12 text-center text-[12px] font-semibold tabular-nums text-[#374151]">{Math.round(zoom * 100)}%</span>
        <Button size="icon" variant="ghost" className="h-8 w-8 rounded-[8px] text-[#374151] hover:bg-gray-100" onClick={() => applyZoom(zoom + 0.25)} disabled={zoom >= 6} title="Zoom in">
          <Plus className="h-4 w-4" />
        </Button>
        <div className="mx-0.5 h-5 w-px bg-[#E5E7EB]" />
        <Button size="icon" variant="ghost" className="h-8 w-8 rounded-[8px] text-[#374151] hover:bg-gray-100" onClick={() => applyZoom(1)} disabled={zoom === 1} title="Reset">
          <Maximize2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

export default function DocumentPreviewModal({
  open,
  onOpenChange,
  upload,
  title,
  status,
  supplierName,
  documentId,
  canDecide,
  approveBusy,
  onApprove,
  onDecline,
}: DocumentPreviewModalProps) {
  const { toast } = useToast();
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [officeLoaded, setOfficeLoaded] = useState(false);
  const [showEvidencePanel, setShowEvidencePanel] = useState(false);

  const fileName = upload?.file_name ?? undefined;
  const mimeType = upload?.mime_type ?? undefined;
  const previewKind = useMemo(() => getPreviewKind(fileName, mimeType), [fileName, mimeType]);
  const statusConfig = status ? STATUS_BADGE_CONFIG[status] : undefined;
  const showDecision = Boolean(canDecide && documentId && (onApprove || onDecline));
  const officeEmbedUrl = signedUrl
    ? `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(signedUrl)}`
    : null;
  const officeFullUrl = signedUrl
    ? `https://view.officeapps.live.com/op/view.aspx?src=${encodeURIComponent(signedUrl)}`
    : null;

  useEffect(() => { setShowEvidencePanel(false); }, [documentId]);

  useEffect(() => {
    if (!open || !upload?.file_path) { setSignedUrl(null); setError(null); return; }
    let active = true;
    const sign = async () => {
      setLoading(true); setError(null); setSignedUrl(null); setOfficeLoaded(false);
      try {
        const resolved = resolveStoragePath(upload.file_path);
        if (!resolved) throw new Error('Invalid file path');
        const { data, error: signErr } = await supabase.storage
          .from(resolved.bucket)
          .createSignedUrl(resolved.key, 3600);
        if (signErr) throw signErr;
        if (active) setSignedUrl(data?.signedUrl || null);
      } catch (e) {
        if (active) setError(e instanceof Error ? e.message : 'Unable to load document preview');
      } finally {
        if (active) setLoading(false);
      }
    };
    void sign();
    return () => { active = false; };
  }, [open, upload?.file_path]);

  const handleDownload = useCallback(async () => {
    if (!upload?.file_path) return;
    setDownloading(true);
    try {
      const resolved = resolveStoragePath(upload.file_path);
      if (!resolved) throw new Error('Invalid file path');
      const { data, error: dlErr } = await supabase.storage
        .from(resolved.bucket)
        .createSignedUrl(resolved.key, 120, { download: fileName || 'download' });
      if (dlErr || !data?.signedUrl) throw dlErr || new Error('Download failed');
      const a = window.document.createElement('a');
      a.href = data.signedUrl;
      a.download = fileName || 'download';
      window.document.body.appendChild(a);
      a.click();
      window.document.body.removeChild(a);
    } catch (e) {
      toast({ title: 'Download failed', description: e instanceof Error ? e.message : 'Could not download the file', variant: 'destructive' });
    } finally {
      setDownloading(false);
    }
  }, [upload?.file_path, fileName, toast]);

  const handleApprove = useCallback(async () => {
    if (!documentId || !onApprove) return;
    await onApprove(documentId);
    onOpenChange(false);
  }, [documentId, onApprove, onOpenChange]);

  const handleDecline = useCallback(() => {
    if (!documentId || !onDecline) return;
    onOpenChange(false);
    onDecline(documentId);
  }, [documentId, onDecline, onOpenChange]);

  const renderBody = () => {
    if (loading) {
      return (
        <div className="flex h-full flex-col items-center justify-center gap-3 text-[#6B7280]">
          <Loader2 className="h-6 w-6 animate-spin text-[#2563EB]" />
          <p className="text-sm">Preparing preview…</p>
        </div>
      );
    }
    if (error || !signedUrl) {
      return (
        <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center text-[#6B7280]">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-50">
            <AlertTriangle className="h-6 w-6 text-red-600" />
          </div>
          <p className="text-sm font-medium text-[#111827]">{error || 'No file available to preview'}</p>
          {upload?.file_path && (
            <Button variant="outline" className="rounded-[10px] border-[#E5E7EB]" onClick={() => void handleDownload()}>
              <Download className="mr-2 h-4 w-4" />Download instead
            </Button>
          )}
        </div>
      );
    }
    if (previewKind === 'image') {
      return <ZoomableImage src={signedUrl} alt={fileName || 'Document preview'} />;
    }
    if (previewKind === 'pdf') {
      return <iframe title={fileName || 'Document preview'} src={signedUrl} className="h-full w-full border-0 bg-[#F1F5F9]" />;
    }
    if (previewKind === 'office' && officeEmbedUrl) {
      return (
        <div className="relative h-full w-full bg-[#F1F5F9]">
          {!officeLoaded && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-[#6B7280]">
              <Loader2 className="h-6 w-6 animate-spin text-[#2563EB]" />
              <p className="text-sm">Loading document preview…</p>
            </div>
          )}
          <iframe
            key={officeEmbedUrl}
            title={fileName || 'Document preview'}
            src={officeEmbedUrl}
            className="h-full w-full border-0"
            onLoad={() => setOfficeLoaded(true)}
          />
          <div className="pointer-events-none absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full border border-[#E5E7EB] bg-white/95 px-3 py-1 text-[11px] text-[#6B7280] shadow-sm">
            Not rendering?
            {officeFullUrl && (
              <a href={officeFullUrl} target="_blank" rel="noreferrer" className="pointer-events-auto font-semibold text-[#2563EB] hover:underline">Open in new tab</a>
            )}
            <span>·</span>
            <button className="pointer-events-auto font-semibold text-[#2563EB] hover:underline" onClick={() => void handleDownload()}>Download</button>
          </div>
        </div>
      );
    }
    if (previewKind === 'text') {
      return <iframe title={fileName || 'Document preview'} src={signedUrl} className="h-full w-full border-0 bg-white" />;
    }
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center text-[#6B7280]">
        <div className="flex h-14 w-14 items-center justify-center rounded-[14px] bg-[#EEF2F7]">
          <FileText className="h-7 w-7 text-[#6B7280]" />
        </div>
        <p className="text-sm font-medium text-[#111827]">This file type can't be previewed inline.</p>
        <p className="text-xs text-[#6B7280]">{fileName}</p>
        <Button className="rounded-[10px] bg-[#2563EB] text-white hover:bg-[#1D4ED8]" onClick={() => void handleDownload()}>
          <Download className="mr-2 h-4 w-4" />Download to view
        </Button>
      </div>
    );
  };

  const HeaderIcon = previewKind === 'image' ? ImageIcon : FileText;
  const canOpenInTab = Boolean(signedUrl && (previewKind === 'pdf' || previewKind === 'image' || previewKind === 'text'));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={`${showEvidencePanel ? 'max-w-6xl' : 'max-w-5xl'} gap-0 overflow-hidden rounded-[16px] border border-[#E5E7EB] p-0 shadow-[0_20px_60px_rgba(16,24,40,0.18)] [&>button]:hidden`}>
        {/* Header */}
        <div className="flex items-center justify-between gap-3 border-b border-[#E5E7EB] bg-white px-5 py-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-[12px] bg-[#EEF2F7]">
              <HeaderIcon className="h-5 w-5 text-[#2563EB]" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-[15px] font-bold text-[#111827]">{title || fileName || 'Document'}</p>
              <p className="truncate text-[13px] text-[#6B7280]">
                {[supplierName, fileName, formatBytes(upload?.file_size)].filter(Boolean).join(' · ') || 'Preview'}
              </p>
            </div>
          </div>
          <div className="flex flex-shrink-0 items-center gap-2">
            {statusConfig && (
              <Badge className={`hidden items-center gap-1 rounded-full border px-2 py-0.5 text-[12px] font-medium md:inline-flex ${statusConfig.className}`}>
                <statusConfig.icon className="h-3 w-3" />{statusConfig.label}
              </Badge>
            )}
            {canOpenInTab && (
              <Button asChild variant="outline" size="sm" className="h-[36px] rounded-[10px] border-[#E5E7EB] px-3 font-semibold text-[#374151] hover:bg-gray-50">
                <a href={signedUrl!} target="_blank" rel="noreferrer"><ExternalLink className="mr-1.5 h-4 w-4" />Open</a>
              </Button>
            )}
            {showDecision ? (
              <>
                <Button
                  size="icon"
                  variant="outline"
                  className="h-[36px] w-[36px] flex-shrink-0 rounded-[10px] border-[#FCA5A5] bg-white text-[#DC2626] hover:bg-[#FEF2F2]"
                  onClick={handleDecline}
                  title="Reject"
                >
                  <X className="h-4 w-4" />
                </Button>
                <Button
                  size="icon"
                  className="h-[36px] w-[36px] flex-shrink-0 rounded-[10px] bg-[#10B981] text-white hover:bg-[#059669]"
                  disabled={approveBusy}
                  onClick={() => void handleApprove()}
                  title="Approve"
                >
                  {approveBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                </Button>
                <Button
                  size="icon"
                  variant="outline"
                  className="h-[36px] w-[36px] flex-shrink-0 rounded-[10px] border-[#E5E7EB] text-[#374151] hover:bg-gray-50"
                  disabled={downloading || !upload?.file_path}
                  onClick={() => void handleDownload()}
                  title="Download"
                >
                  {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                </Button>
              </>
            ) : (
              <Button
                size="sm"
                className="h-[36px] rounded-[10px] bg-[#10B981] px-3 font-semibold text-white hover:bg-[#059669]"
                disabled={downloading || !upload?.file_path}
                onClick={() => void handleDownload()}
              >
                {downloading ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Download className="mr-1.5 h-4 w-4" />}Download
              </Button>
            )}
            <Button
              size="icon"
              variant="ghost"
              className="h-[36px] w-[36px] rounded-[10px] text-[#6B7280] hover:bg-gray-100"
              onClick={() => onOpenChange(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Body */}
        <div className="flex h-[72vh] bg-[#F1F5F9]">
          <div className="min-w-0 flex-1">{renderBody()}</div>
          {open && documentId && (
            <EvidenceFieldsPanel documentId={documentId} onVisibilityChange={setShowEvidencePanel} />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
