/**
 * ValidatedInput Component
 * A form input with built-in validation display and error handling
 */

import React from 'react';
import { FormFieldError } from './FormFieldError';
import styles from './ValidatedInput.module.css';

export interface ValidatedInputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  required?: boolean;
  isSaved?: boolean;
  helperText?: string;
  containerClassName?: string;
  inputClassName?: string;
}

export const ValidatedInput = React.forwardRef<
  HTMLInputElement,
  ValidatedInputProps
>(
  (
    {
      label,
      error,
      required,
      isSaved = true,
      helperText,
      containerClassName,
      inputClassName,
      className,
      ...props
    },
    ref
  ) => {
    return (
      <div className={`${styles.container} ${containerClassName || ''}`}>
        {label && (
          <label className={styles.label}>
            {label}
            {required && <span className={styles.required}>*</span>}
          </label>
        )}
        <input
          ref={ref}
          className={`${styles.input} ${error ? styles.inputError : ''} ${
            inputClassName || ''
          } ${className || ''}`}
          {...props}
        />
        {error && (
          <FormFieldError error={error} required={required} isSaved={isSaved} />
        )}
        {helperText && !error && (
          <div className={styles.helperText}>{helperText}</div>
        )}
      </div>
    );
  }
);

ValidatedInput.displayName = 'ValidatedInput';

/**
 * ValidatedSelect Component
 * A select with built-in validation display
 */
export interface ValidatedSelectProps
  extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  required?: boolean;
  isSaved?: boolean;
  helperText?: string;
  options: Array<{ value: string; label: string }>;
  containerClassName?: string;
  selectClassName?: string;
}

export const ValidatedSelect = React.forwardRef<
  HTMLSelectElement,
  ValidatedSelectProps
>(
  (
    {
      label,
      error,
      required,
      isSaved = true,
      helperText,
      options,
      containerClassName,
      selectClassName,
      className,
      ...props
    },
    ref
  ) => {
    return (
      <div className={`${styles.container} ${containerClassName || ''}`}>
        {label && (
          <label className={styles.label}>
            {label}
            {required && <span className={styles.required}>*</span>}
          </label>
        )}
        <select
          ref={ref}
          className={`${styles.select} ${error ? styles.inputError : ''} ${
            selectClassName || ''
          } ${className || ''}`}
          {...props}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        {error && (
          <FormFieldError error={error} required={required} isSaved={isSaved} />
        )}
        {helperText && !error && (
          <div className={styles.helperText}>{helperText}</div>
        )}
      </div>
    );
  }
);

ValidatedSelect.displayName = 'ValidatedSelect';

/**
 * ValidatedTextarea Component
 * A textarea with built-in validation display
 */
export interface ValidatedTextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  required?: boolean;
  isSaved?: boolean;
  helperText?: string;
  containerClassName?: string;
  textareaClassName?: string;
}

export const ValidatedTextarea = React.forwardRef<
  HTMLTextAreaElement,
  ValidatedTextareaProps
>(
  (
    {
      label,
      error,
      required,
      isSaved = true,
      helperText,
      containerClassName,
      textareaClassName,
      className,
      ...props
    },
    ref
  ) => {
    return (
      <div className={`${styles.container} ${containerClassName || ''}`}>
        {label && (
          <label className={styles.label}>
            {label}
            {required && <span className={styles.required}>*</span>}
          </label>
        )}
        <textarea
          ref={ref}
          className={`${styles.textarea} ${error ? styles.inputError : ''} ${
            textareaClassName || ''
          } ${className || ''}`}
          {...props}
        />
        {error && (
          <FormFieldError error={error} required={required} isSaved={isSaved} />
        )}
        {helperText && !error && (
          <div className={styles.helperText}>{helperText}</div>
        )}
      </div>
    );
  }
);

ValidatedTextarea.displayName = 'ValidatedTextarea';
