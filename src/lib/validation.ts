/**
 * Form Validation Utility
 * Provides user-friendly validation for form fields across the application
 */

export interface ValidationRule {
  field: string;
  label: string;
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  pattern?: RegExp;
  customValidator?: (value: any) => boolean | string;
}

export interface FormData {
  [key: string]: any;
}

/**
 * Validates form data against rules and shows user-friendly toast messages
 * @param data Form data to validate
 * @param rules Validation rules
 * @param showToast Toast function from UiContext
 * @returns true if all validations pass, false otherwise
 */
export function validateFormFields(
  data: FormData,
  rules: ValidationRule[],
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void
): boolean {
  const errors: string[] = [];

  for (const rule of rules) {
    const value = data[rule.field];

    // Check required fields
    if (rule.required) {
      if (!value || (typeof value === 'string' && value.trim() === '')) {
        errors.push(`${rule.label} is required. Please enter this information.`);
        continue;
      }
    }

    // Skip further validation if field is optional and empty
    if (!value || (typeof value === 'string' && value.trim() === '')) {
      continue;
    }

    // Check minimum length
    if (rule.minLength && typeof value === 'string' && value.length < rule.minLength) {
      errors.push(
        `${rule.label} must be at least ${rule.minLength} characters long.`
      );
    }

    // Check maximum length
    if (rule.maxLength && typeof value === 'string' && value.length > rule.maxLength) {
      errors.push(
        `${rule.label} cannot exceed ${rule.maxLength} characters.`
      );
    }

    // Check pattern (e.g., email, phone)
    if (rule.pattern && typeof value === 'string' && !rule.pattern.test(value)) {
      errors.push(`${rule.label} format is invalid. Please check and try again.`);
    }

    // Run custom validator
    if (rule.customValidator) {
      const validationResult = rule.customValidator(value);
      if (validationResult !== true) {
        const errorMessage = typeof validationResult === 'string'
          ? validationResult
          : `${rule.label} is invalid.`;
        errors.push(errorMessage);
      }
    }
  }

  // Show all errors as a single toast
  if (errors.length > 0) {
    const errorMessage =
      errors.length === 1
        ? errors[0]
        : `Please fix the following issues:\n${errors.map(e => `• ${e}`).join('\n')}`;

    showToast(errorMessage, 'error');
    return false;
  }

  return true;
}

/**
 * Validates a single field
 * @param fieldName Field name
 * @param value Field value
 * @param label User-friendly label
 * @param rules Validation rules to apply
 * @returns Error message or null if valid
 */
export function validateSingleField(
  fieldName: string,
  value: any,
  label: string,
  rules: ValidationRule[]
): string | null {
  const rule = rules.find(r => r.field === fieldName);
  if (!rule) return null;

  // Check required
  if (rule.required && (!value || (typeof value === 'string' && value.trim() === ''))) {
    return `${rule.label} is required`;
  }

  if (!value || (typeof value === 'string' && value.trim() === '')) {
    return null;
  }

  // Check min length
  if (rule.minLength && typeof value === 'string' && value.length < rule.minLength) {
    return `Must be at least ${rule.minLength} characters`;
  }

  // Check max length
  if (rule.maxLength && typeof value === 'string' && value.length > rule.maxLength) {
    return `Cannot exceed ${rule.maxLength} characters`;
  }

  // Check pattern
  if (rule.pattern && typeof value === 'string' && !rule.pattern.test(value)) {
    return `Invalid format`;
  }

  // Custom validator
  if (rule.customValidator) {
    const result = rule.customValidator(value);
    if (result !== true) {
      return typeof result === 'string' ? result : 'Invalid value';
    }
  }

  return null;
}

/**
 * Common validation patterns
 */
export const ValidationPatterns = {
  email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  phone: /^[\d\s\-\+\(\)]+$/,
  number: /^\d+(\.\d+)?$/,
  url: /^(https?:\/\/)?([\da-z\.-]+)\.([a-z\.]{2,6})([\/\w \.-]*)*\/?$/,
  alphanumeric: /^[a-zA-Z0-9]+$/,
};

/**
 * Validation rule presets
 */
export const ValidationRules = {
  requiredText: (fieldName: string, label: string): ValidationRule => ({
    field: fieldName,
    label,
    required: true,
    minLength: 1,
  }),

  requiredEmail: (fieldName: string, label: string): ValidationRule => ({
    field: fieldName,
    label,
    required: true,
    pattern: ValidationPatterns.email,
  }),

  requiredPhone: (fieldName: string, label: string): ValidationRule => ({
    field: fieldName,
    label,
    required: true,
    pattern: ValidationPatterns.phone,
  }),

  requiredNumber: (fieldName: string, label: string): ValidationRule => ({
    field: fieldName,
    label,
    required: true,
    pattern: ValidationPatterns.number,
  }),

  optionalEmail: (fieldName: string, label: string): ValidationRule => ({
    field: fieldName,
    label,
    required: false,
    pattern: ValidationPatterns.email,
  }),

  optionalPhone: (fieldName: string, label: string): ValidationRule => ({
    field: fieldName,
    label,
    required: false,
    pattern: ValidationPatterns.phone,
  }),

  requiredSelect: (fieldName: string, label: string): ValidationRule => ({
    field: fieldName,
    label,
    required: true,
    customValidator: (value) => {
      if (!value || value === '' || value === null || (Array.isArray(value) && value.length === 0)) {
        return false;
      }
      return true;
    },
  }),
};
