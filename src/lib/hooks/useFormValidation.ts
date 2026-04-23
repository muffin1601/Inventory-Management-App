/**
 * useFormValidation Hook
 * Simplifies form validation with user-friendly error messages
 */

'use client';

import { useState, useCallback } from 'react';
import { useUi } from '@/components/ui/AppProviders';
import {
  validateFormFields,
  validateSingleField,
  ValidationRule,
  FormData,
} from '../validation';

export interface UseFormValidationOptions {
  initialData?: FormData;
  rules?: ValidationRule[];
}

export function useFormValidation(options: UseFormValidationOptions = {}) {
  const { showToast } = useUi();
  const [formData, setFormData] = useState<FormData>(options.initialData || {});
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [isSaved, setIsSaved] = useState(true);

  const handleChange = useCallback(
    (fieldName: string, value: any) => {
      setFormData((prev) => ({
        ...prev,
        [fieldName]: value,
      }));
      setIsSaved(false);

      // Real-time validation for single field
      if (options.rules) {
        const error = validateSingleField(fieldName, value, fieldName, options.rules);
        setErrors((prev) => ({
          ...prev,
          [fieldName]: error || '',
        }));
      }
    },
    [options.rules]
  );

  const validateForm = useCallback(() => {
    if (!options.rules || options.rules.length === 0) {
      return true;
    }

    return validateFormFields(formData, options.rules, showToast);
  }, [formData, options.rules, showToast]);

  const resetForm = useCallback((newData?: FormData) => {
    setFormData(newData || options.initialData || {});
    setErrors({});
    setIsSaved(true);
  }, [options.initialData]);

  const markSaved = useCallback(() => {
    setIsSaved(true);
  }, []);

  return {
    formData,
    errors,
    isSaved,
    handleChange,
    validateForm,
    resetForm,
    markSaved,
    setFormData,
  };
}
