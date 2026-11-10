'use client';

import {
  Button,
  Card,
  CardContent,
  Checkbox,
  Field,
  FieldError,
  FieldLabel,
  HStack,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Stack,
  Text,
  Textarea,
} from '@trycompai/design-system';
import { Add, ArrowDown, ArrowUp, TrashCan } from '@trycompai/design-system/icons';
import { Controller, useFieldArray, useWatch, type Control, type FieldErrors } from 'react-hook-form';
import {
  emptyField,
  FIELD_TYPE_OPTIONS,
  type DocumentTypeFormValues,
} from '../lib/document-type-form-schema';

interface FieldBuilderProps {
  control: Control<DocumentTypeFormValues>;
  errors: FieldErrors<DocumentTypeFormValues>;
}

export function FieldBuilder({ control, errors }: FieldBuilderProps) {
  const { fields, append, remove, move } = useFieldArray({ control, name: 'fields' });
  const watched = useWatch({ control, name: 'fields' });

  return (
    <Stack gap="3">
      <div>
        <Text weight="semibold">Fields</Text>
        <Text size="sm" variant="muted">
          Every record also gets a document date. Field keys are fixed once saved, so renaming a
          label keeps past records intact.
        </Text>
      </div>

      {fields.map((item, index) => {
        const fieldErrors = errors.fields?.[index];
        const isSelect = watched?.[index]?.type === 'select';
        const savedKey = watched?.[index]?.key;
        return (
          <Card key={item.id}>
            <CardContent>
              <div className="flex flex-col gap-3">
                <div className="grid gap-3 md:grid-cols-[1fr_180px]">
                  <Field>
                    <FieldLabel htmlFor={`field-${index}-label`}>Label</FieldLabel>
                    <Controller
                      control={control}
                      name={`fields.${index}.label`}
                      render={({ field: { ref: _ref, ...field } }) => (
                        <Input {...field} id={`field-${index}-label`} placeholder="e.g. Diagram file" />
                      )}
                    />
                    <FieldError>{fieldErrors?.label?.message}</FieldError>
                  </Field>
                  <Field>
                    <FieldLabel>Type</FieldLabel>
                    <Controller
                      control={control}
                      name={`fields.${index}.type`}
                      render={({ field }) => (
                        <Select
                          items={FIELD_TYPE_OPTIONS}
                          value={field.value}
                          onValueChange={(value) => value && field.onChange(value)}
                        >
                          <SelectTrigger aria-label={`Field ${index + 1} type`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {FIELD_TYPE_OPTIONS.map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    />
                  </Field>
                </div>

                <Field>
                  <FieldLabel htmlFor={`field-${index}-description`}>Help text (optional)</FieldLabel>
                  <Controller
                    control={control}
                    name={`fields.${index}.description`}
                    render={({ field: { ref: _ref, ...field } }) => (
                      <Input {...field} id={`field-${index}-description`} placeholder="Shown under the field" />
                    )}
                  />
                </Field>

                {isSelect && (
                  <Field>
                    <FieldLabel htmlFor={`field-${index}-options`}>Options, one per line</FieldLabel>
                    <Controller
                      control={control}
                      name={`fields.${index}.optionsText`}
                      render={({ field: { ref: _ref, ...field } }) => (
                        <Textarea {...field} id={`field-${index}-options`} rows={3} />
                      )}
                    />
                    <FieldError>{fieldErrors?.optionsText?.message}</FieldError>
                  </Field>
                )}

                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Controller
                    control={control}
                    name={`fields.${index}.required`}
                    render={({ field }) => (
                      <label className="flex items-center gap-2 text-sm">
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={(checked) => field.onChange(checked === true)}
                        />
                        Required
                      </label>
                    )}
                  />
                  <HStack gap="1">
                    {savedKey && (
                      <Text size="xs" variant="muted">
                        key: {savedKey}
                      </Text>
                    )}
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Move field up"
                      disabled={index === 0}
                      onClick={() => move(index, index - 1)}
                    >
                      <ArrowUp size={16} />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Move field down"
                      disabled={index === fields.length - 1}
                      onClick={() => move(index, index + 1)}
                    >
                      <ArrowDown size={16} />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Remove field ${index + 1}`}
                      disabled={fields.length === 1}
                      onClick={() => remove(index)}
                    >
                      <TrashCan size={16} />
                    </Button>
                  </HStack>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}

      {typeof errors.fields?.message === 'string' && <FieldError>{errors.fields.message}</FieldError>}

      <div>
        <Button
          type="button"
          variant="outline"
          iconLeft={<Add size={16} />}
          onClick={() => append(emptyField())}
          disabled={fields.length >= 40}
        >
          Add field
        </Button>
      </div>
    </Stack>
  );
}
