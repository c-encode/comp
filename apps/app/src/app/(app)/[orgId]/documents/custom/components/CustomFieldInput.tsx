'use client';

import { apiClient } from '@/lib/api-client';
import {
  Button,
  HStack,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Text,
  Textarea,
} from '@trycompai/design-system';
import { Close, Upload } from '@trycompai/design-system/icons';
import { useRef, useState } from 'react';
import { toast } from 'sonner';
import {
  CUSTOM_DOCUMENTS_BASE,
  unwrap,
  type CustomDocumentField,
  type CustomDocumentFile,
} from '../hooks/use-custom-documents';

async function fileToBase64(file: File): Promise<string> {
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      resolve(result.split(',')[1] ?? '');
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function isFileValue(value: unknown): value is CustomDocumentFile {
  return !!value && typeof value === 'object' && 'fileKey' in value && 'fileName' in value;
}

interface CustomFieldInputProps {
  organizationId: string;
  typeId: string;
  field: CustomDocumentField;
  id: string;
  value: unknown;
  onChange: (value: unknown) => void;
}

export function CustomFieldInput({
  organizationId,
  typeId,
  field,
  id,
  value,
  onChange,
}: CustomFieldInputProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const stringValue = typeof value === 'string' ? value : '';

  const handleFileSelected = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    try {
      const uploaded = unwrap(
        await apiClient.post<CustomDocumentFile>(
          `${CUSTOM_DOCUMENTS_BASE}/types/${typeId}/uploads`,
          {
            fileName: file.name,
            fileType: file.type || 'application/octet-stream',
            fileData: await fileToBase64(file),
          },
          organizationId,
        ),
      );
      onChange(uploaded);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Upload failed');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  switch (field.type) {
    case 'textarea':
      return <Textarea id={id} rows={4} value={stringValue} onChange={(e) => onChange(e.target.value)} />;
    case 'date':
      return <Input id={id} type="date" value={stringValue} onChange={(e) => onChange(e.target.value)} />;
    case 'select':
      return (
        <Select
          items={field.options ?? []}
          value={stringValue}
          onValueChange={(next) => onChange(next ?? '')}
        >
          <SelectTrigger id={id} aria-label={field.label}>
            <SelectValue placeholder="Choose an option" />
          </SelectTrigger>
          <SelectContent>
            {(field.options ?? []).map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    case 'file':
      return (
        <div className="flex flex-col gap-2">
          <input
            ref={fileInputRef}
            id={id}
            type="file"
            className="sr-only"
            aria-label={field.label}
            onChange={(e) => handleFileSelected(e.target.files?.[0])}
          />
          {isFileValue(value) ? (
            <HStack gap="2" align="center">
              <div className="min-w-0 truncate">
                <Text size="sm">{value.fileName}</Text>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={`Remove ${value.fileName}`}
                onClick={() => onChange(null)}
              >
                <Close size={16} />
              </Button>
            </HStack>
          ) : (
            <div>
              <Button
                type="button"
                variant="outline"
                loading={uploading}
                iconLeft={<Upload size={16} />}
                onClick={() => fileInputRef.current?.click()}
              >
                {uploading ? 'Uploading…' : 'Choose file'}
              </Button>
            </div>
          )}
        </div>
      );
    case 'text':
      return <Input id={id} value={stringValue} onChange={(e) => onChange(e.target.value)} />;
  }
}
