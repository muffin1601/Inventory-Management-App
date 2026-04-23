/**
 * FormFieldError Component
 * Displays inline validation errors below form fields
 */

import React from 'react';
import styles from './FormFieldError.module.css';
import { AlertCircle } from 'lucide-react';

export interface FormFieldErrorProps {
  error?: string;
  required?: boolean;
  isSaved?: boolean;
  label?: string;
}

export function FormFieldError({
  error,
  required,
  isSaved,
  label,
}: FormFieldErrorProps) {
  if (!error && (!required || isSaved)) {
    return null;
  }

  return (
    <div className={styles.errorContainer}>
      <AlertCircle size={14} className={styles.errorIcon} />
      <span className={styles.errorText}>
        {error || (required && !isSaved ? `${label} is required` : '')}
      </span>
    </div>
  );
}

export function UnsavedIndicator() {
  return (
    <div className={styles.unsavedBadge} title="Form has unsaved changes">
      ⚠ Unsaved
    </div>
  );
}
