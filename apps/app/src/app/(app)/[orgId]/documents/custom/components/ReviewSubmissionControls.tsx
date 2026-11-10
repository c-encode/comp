'use client';

import { apiClient } from '@/lib/api-client';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button, Card, CardContent, Field, FieldError, FieldLabel, HStack, Textarea } from '@trycompai/design-system';
import { Controller, useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { mutate } from 'swr';
import { z } from 'zod';
import { CUSTOM_DOCUMENTS_BASE, submissionKey, submissionsKey, unwrap } from '../hooks/use-custom-documents';

const reviewFormSchema = z.object({ reason: z.string().max(2000) });
type ReviewFormValues = z.infer<typeof reviewFormSchema>;

interface ReviewSubmissionControlsProps {
  organizationId: string;
  typeId: string;
  submissionId: string;
}

export function ReviewSubmissionControls({ organizationId, typeId, submissionId }: ReviewSubmissionControlsProps) {
  const {
    control,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ReviewFormValues>({ resolver: zodResolver(reviewFormSchema), defaultValues: { reason: '' } });

  const review = (action: 'approved' | 'rejected') =>
    handleSubmit(async ({ reason }) => {
      const trimmed = reason.trim();
      if (action === 'rejected' && !trimmed) {
        setError('reason', { message: 'Give a reason when rejecting' });
        return;
      }
      try {
        unwrap(
          await apiClient.patch(
            `${CUSTOM_DOCUMENTS_BASE}/types/${typeId}/submissions/${submissionId}/review`,
            { action, ...(trimmed ? { reason: trimmed } : {}) },
            organizationId,
          ),
        );
        await Promise.all([
          mutate(submissionKey({ organizationId, typeId, submissionId })),
          mutate(submissionsKey({ organizationId, typeId })),
        ]);
        toast.success(action === 'approved' ? 'Record approved' : 'Record rejected');
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Could not review the record');
      }
    });

  return (
    <Card>
      <CardContent>
        <div className="flex flex-col gap-3">
          <Field>
            <FieldLabel htmlFor="review-reason">Review note (required to reject)</FieldLabel>
            <Controller
              control={control}
              name="reason"
              render={({ field: { ref: _ref, ...field } }) => <Textarea {...field} id="review-reason" rows={2} />}
            />
            <FieldError>{errors.reason?.message}</FieldError>
          </Field>
          <HStack gap="2" justify="end" wrap="wrap">
            <Button variant="outline" loading={isSubmitting} onClick={review('rejected')}>
              Reject
            </Button>
            <Button loading={isSubmitting} onClick={review('approved')}>
              Approve
            </Button>
          </HStack>
        </div>
      </CardContent>
    </Card>
  );
}
