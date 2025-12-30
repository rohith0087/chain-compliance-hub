import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Upload, X, Image } from 'lucide-react';

interface LogoUploadWidgetProps {
  currentLogoUrl?: string;
  onLogoUpdate: (url: string | null) => void;
  embedded?: boolean;
}

export const LogoUploadWidget: React.FC<LogoUploadWidgetProps> = ({
  currentLogoUrl,
  onLogoUpdate,
  embedded = false,
}) => {
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(currentLogoUrl || null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const { user } = useAuth();

  const uploadLogo = async (file: File) => {
    if (!user) return;

    try {
      setUploading(true);

      // Validate file type
      const allowedTypes = ['image/jpeg', 'image/png', 'image/svg+xml', 'image/webp'];
      if (!allowedTypes.includes(file.type)) {
        throw new Error('Please upload a valid image file (JPEG, PNG, SVG, or WebP)');
      }

      // Validate file size (5MB)
      if (file.size > 5 * 1024 * 1024) {
        throw new Error('File size must be less than 5MB');
      }

      // Create file path with timestamp to avoid caching issues
      const fileExt = file.name.split('.').pop();
      const timestamp = Date.now();
      const fileName = `${user.id}/logo-${timestamp}.${fileExt}`;

      // Delete existing logo if it exists
      if (currentLogoUrl) {
        try {
          // Extract the old file path from the URL
          const urlParts = currentLogoUrl.split('/');
          const oldFileName = urlParts[urlParts.length - 1];
          const oldPath = `${user.id}/${oldFileName}`;
          
          await supabase.storage
            .from('company-logos')
            .remove([oldPath]);
        } catch (error) {
          console.warn('Failed to delete old logo:', error);
        }
      }

      // Upload new logo
      const { error: uploadError, data } = await supabase.storage
        .from('company-logos')
        .upload(fileName, file, {
          upsert: true,
        });

      if (uploadError) throw uploadError;

      // Get public URL with cache busting
      const { data: { publicUrl } } = supabase.storage
        .from('company-logos')
        .getPublicUrl(fileName);

      const newLogoUrl = `${publicUrl}?t=${timestamp}`;
      setPreviewUrl(newLogoUrl);
      onLogoUpdate(newLogoUrl);

      toast({
        title: "Success",
        description: "Logo uploaded successfully",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to upload logo",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const removeLogo = async () => {
    if (!user || !currentLogoUrl) return;

    try {
      setUploading(true);

      // Extract the file path from the URL
      const urlParts = currentLogoUrl.split('/');
      const fileName = urlParts[urlParts.length - 1].split('?')[0]; // Remove query parameters
      if (fileName) {
        const filePath = `${user.id}/${fileName}`;
        const { error } = await supabase.storage
          .from('company-logos')
          .remove([filePath]);

        if (error) throw error;
      }

      setPreviewUrl(null);
      onLogoUpdate(null);

      toast({
        title: "Success",
        description: "Logo removed successfully",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to remove logo",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      uploadLogo(file);
    }
  };

  const content = (
    <div className={embedded ? "flex items-start gap-4" : "flex flex-col items-center space-y-4"}>
      {previewUrl ? (
        <div className="relative flex-shrink-0">
          <img
            src={previewUrl}
            alt="Company logo"
            className="h-24 w-24 object-contain rounded border"
          />
          <Button
            size="sm"
            variant="destructive"
            className="absolute -top-2 -right-2 h-6 w-6 rounded-full p-0"
            onClick={removeLogo}
            disabled={uploading}
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      ) : (
        <div className="flex h-24 w-24 items-center justify-center rounded border border-dashed border-muted-foreground/25 flex-shrink-0">
          <Image className="h-8 w-8 text-muted-foreground" />
        </div>
      )}

      <div className={embedded ? "flex flex-col gap-2" : "flex flex-col items-center space-y-2"}>
        <Button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          variant="outline"
          size={embedded ? "sm" : "default"}
        >
          <Upload className="mr-2 h-4 w-4" />
          {uploading ? "Uploading..." : previewUrl ? "Change Logo" : "Upload Logo"}
        </Button>

        <p className={`text-sm text-muted-foreground ${embedded ? "" : "text-center"}`}>
          Supported: JPEG, PNG, SVG, WebP. Max 5MB.
        </p>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/svg+xml,image/webp"
        onChange={handleFileSelect}
        className="hidden"
      />
    </div>
  );

  if (embedded) {
    return content;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Company Logo</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {content}
      </CardContent>
    </Card>
  );
};