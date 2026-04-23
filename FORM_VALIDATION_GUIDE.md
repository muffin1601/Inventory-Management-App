# Form Validation & Error Handling Guide

This guide explains how to implement user-friendly form validation and error handling across the application.

## Overview

The validation system provides:
- **User-friendly error messages** - Non-technical users understand what's missing
- **Real-time validation** - Errors show as users type
- **Toast notifications** - Centralized error/success feedback
- **Unsaved indicator** - Shows when forms have unsaved changes
- **Inline error display** - Errors appear right below the field

## Quick Start

### 1. Import the validation hook and components

```typescript
import { useFormValidation } from '@/lib/hooks/useFormValidation';
import { ValidatedInput, ValidatedSelect, ValidatedTextarea } from '@/components/ui/ValidatedInput';
import { UnsavedIndicator } from '@/components/ui/FormFieldError';
import { ValidationRules } from '@/lib/validation';
```

### 2. Set up validation rules in your form component

```typescript
'use client';

import { useFormValidation } from '@/lib/hooks/useFormValidation';
import { ValidationRules } from '@/lib/validation';
import { ValidatedInput, ValidatedSelect } from '@/components/ui/ValidatedInput';
import { UnsavedIndicator } from '@/components/ui/FormFieldError';

export function CreateUserForm() {
  const validation = useFormValidation({
    initialData: {
      name: '',
      email: '',
      phone: '',
      role: '',
    },
    rules: [
      ValidationRules.requiredText('name', 'Full Name'),
      ValidationRules.requiredEmail('email', 'Email Address'),
      ValidationRules.requiredPhone('phone', 'Phone Number'),
      ValidationRules.requiredSelect('role', 'User Role'),
    ],
  });

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();

        // Validate before submission
        if (!validation.validateForm()) {
          return; // Form has errors, toast was shown automatically
        }

        try {
          // Submit form
          const response = await createUser(validation.formData);
          validation.markSaved();
          showToast('User created successfully!', 'success');
        } catch (error) {
          showToast('Failed to create user', 'error');
        }
      }}
    >
      {/* Unsaved indicator in form header */}
      {!validation.isSaved && <UnsavedIndicator />}

      {/* Form fields with validation */}
      <ValidatedInput
        label="Full Name"
        required
        value={validation.formData.name}
        onChange={(e) => validation.handleChange('name', e.target.value)}
        error={validation.errors.name}
        placeholder="Enter full name"
      />

      <ValidatedInput
        label="Email Address"
        type="email"
        required
        value={validation.formData.email}
        onChange={(e) => validation.handleChange('email', e.target.value)}
        error={validation.errors.email}
        placeholder="user@example.com"
      />

      <ValidatedInput
        label="Phone Number"
        required
        value={validation.formData.phone}
        onChange={(e) => validation.handleChange('phone', e.target.value)}
        error={validation.errors.phone}
        placeholder="+1 (555) 123-4567"
      />

      <ValidatedSelect
        label="User Role"
        required
        value={validation.formData.role}
        onChange={(e) => validation.handleChange('role', e.target.value)}
        error={validation.errors.role}
        options={[
          { value: '', label: 'Select a role...' },
          { value: 'admin', label: 'Administrator' },
          { value: 'manager', label: 'Manager' },
          { value: 'user', label: 'User' },
        ]}
      />

      <button type="submit" disabled={!validation.isSaved}>
        Create User
      </button>
    </form>
  );
}
```

## Available Validation Rules

### Pre-built Rules

```typescript
import { ValidationRules } from '@/lib/validation';

// Text fields (required)
ValidationRules.requiredText('fieldName', 'Field Label')

// Email fields
ValidationRules.requiredEmail('fieldName', 'Field Label')
ValidationRules.optionalEmail('fieldName', 'Field Label')

// Phone fields
ValidationRules.requiredPhone('fieldName', 'Field Label')
ValidationRules.optionalPhone('fieldName', 'Field Label')

// Number fields
ValidationRules.requiredNumber('fieldName', 'Field Label')

// Select/Dropdown fields
ValidationRules.requiredSelect('fieldName', 'Field Label')
```

### Custom Validation Rules

```typescript
import { ValidationRule } from '@/lib/validation';

const rules: ValidationRule[] = [
  {
    field: 'password',
    label: 'Password',
    required: true,
    minLength: 8,
    pattern: /^(?=.*[A-Z])(?=.*\d)/,
    customValidator: (value) => {
      if (value.includes('password')) {
        return 'Password cannot contain the word "password"';
      }
      return true;
    },
  },
];
```

## Toast Notifications

### Using the Toast System

```typescript
import { useUi } from '@/components/ui/AppProviders';

export function MyComponent() {
  const { showToast } = useUi();

  return (
    <button
      onClick={() => {
        try {
          // Do something
          showToast('Success! Changes saved.', 'success');
        } catch (error) {
          showToast('Error: Something went wrong', 'error');
        }
      }}
    >
      Save
    </button>
  );
}
```

### Toast Types

- `success` - Green toast for successful operations
- `error` - Red toast for errors and validation failures
- `info` - Default toast for informational messages

### Multi-line Error Messages

The toast system automatically handles multi-line error messages:

```typescript
showToast('Please fix the following issues:\n• Email is required\n• Password is too short', 'error');
```

## Form Components

### ValidatedInput

```typescript
<ValidatedInput
  label="Email"
  type="email"
  required
  value={formData.email}
  onChange={(e) => handleChange('email', e.target.value)}
  error={errors.email}
  placeholder="Enter email"
  helperText="We'll never share your email"
/>
```

### ValidatedSelect

```typescript
<ValidatedSelect
  label="Category"
  required
  value={formData.category}
  onChange={(e) => handleChange('category', e.target.value)}
  error={errors.category}
  options={[
    { value: '', label: 'Select a category...' },
    { value: 'electronics', label: 'Electronics' },
    { value: 'clothing', label: 'Clothing' },
  ]}
/>
```

### ValidatedTextarea

```typescript
<ValidatedTextarea
  label="Description"
  required
  value={formData.description}
  onChange={(e) => handleChange('description', e.target.value)}
  error={errors.description}
  placeholder="Enter description"
  helperText="Maximum 500 characters"
/>
```

## Implementation Checklist

When adding validation to a form:

- [ ] Import validation utilities
- [ ] Define validation rules for all required fields
- [ ] Use `useFormValidation` hook to set up form state
- [ ] Add validation rules array to hook config
- [ ] Replace form inputs with `ValidatedInput`/`ValidatedSelect`/`ValidatedTextarea`
- [ ] Add `onChange={handleChange}` to inputs
- [ ] Pass `error` prop from validation errors
- [ ] Call `validation.validateForm()` before submission
- [ ] Add `UnsavedIndicator` to show unsaved changes
- [ ] Call `validation.markSaved()` after successful submission
- [ ] Show success/error toast after API calls

## Example: Complete Form with All Features

```typescript
'use client';

import { useState } from 'react';
import { useFormValidation } from '@/lib/hooks/useFormValidation';
import { useUi } from '@/components/ui/AppProviders';
import { ValidatedInput, ValidatedSelect, ValidatedTextarea } from '@/components/ui/ValidatedInput';
import { UnsavedIndicator } from '@/components/ui/FormFieldError';
import { ValidationRules } from '@/lib/validation';

export function CreateProductForm() {
  const { showToast } = useUi();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const validation = useFormValidation({
    initialData: {
      name: '',
      sku: '',
      category: '',
      price: '',
      description: '',
    },
    rules: [
      ValidationRules.requiredText('name', 'Product Name'),
      ValidationRules.requiredText('sku', 'SKU'),
      ValidationRules.requiredSelect('category', 'Category'),
      ValidationRules.requiredNumber('price', 'Price'),
      {
        field: 'description',
        label: 'Description',
        minLength: 10,
      },
    ],
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validation.validateForm()) {
      return;
    }

    setIsSubmitting(true);
    try {
      // Call API
      await createProduct(validation.formData);
      validation.markSaved();
      validation.resetForm();
      showToast('Product created successfully!', 'success');
    } catch (error) {
      showToast('Failed to create product. Please try again.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <div className="formHeader">
        <h2>Create Product</h2>
        {!validation.isSaved && <UnsavedIndicator />}
      </div>

      <ValidatedInput
        label="Product Name"
        required
        value={validation.formData.name}
        onChange={(e) => validation.handleChange('name', e.target.value)}
        error={validation.errors.name}
        placeholder="e.g., Office Chair"
      />

      <ValidatedInput
        label="SKU"
        required
        value={validation.formData.sku}
        onChange={(e) => validation.handleChange('sku', e.target.value)}
        error={validation.errors.sku}
        placeholder="e.g., OC-001"
      />

      <ValidatedSelect
        label="Category"
        required
        value={validation.formData.category}
        onChange={(e) => validation.handleChange('category', e.target.value)}
        error={validation.errors.category}
        options={[
          { value: '', label: 'Select a category...' },
          { value: 'furniture', label: 'Furniture' },
          { value: 'electronics', label: 'Electronics' },
        ]}
      />

      <ValidatedInput
        label="Price"
        type="number"
        required
        value={validation.formData.price}
        onChange={(e) => validation.handleChange('price', e.target.value)}
        error={validation.errors.price}
        placeholder="0.00"
      />

      <ValidatedTextarea
        label="Description"
        value={validation.formData.description}
        onChange={(e) => validation.handleChange('description', e.target.value)}
        error={validation.errors.description}
        placeholder="Enter product description..."
        helperText="Minimum 10 characters"
      />

      <button type="submit" disabled={isSubmitting || !validation.isSaved}>
        {isSubmitting ? 'Creating...' : 'Create Product'}
      </button>
    </form>
  );
}
```

## Benefits for Non-Technical Users

1. **Clear error messages** - Users see exactly what's wrong: "Email is required. Please enter your email address."
2. **Real-time feedback** - Errors appear immediately as they type
3. **Visual indicators** - Red highlighting and error icons make problems obvious
4. **Unsaved indicator** - Yellow badge shows when form has unsaved changes
5. **Toast notifications** - Large, visible messages confirm success or explain failures
6. **No confusion** - Users know exactly what to do to fix issues

## Summary

The validation system makes forms:
- More user-friendly
- Easier to debug for developers
- Consistent across the application
- Accessible and clear for non-technical users
