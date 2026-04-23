/**
 * Example: Creating a Product with Full Validation
 * This demonstrates the complete form validation system for non-technical users
 */

'use client';

import React from 'react';
import { useFormValidation } from '@/lib/hooks/useFormValidation';
import { useUi } from '@/components/ui/AppProviders';
import {
  ValidatedInput,
  ValidatedSelect,
  ValidatedTextarea,
} from '@/components/ui/ValidatedInput';
import { UnsavedIndicator } from '@/components/ui/FormFieldError';
import { ValidationRules, ValidationPatterns } from '@/lib/validation';
import styles from './ExampleFormValidation.module.css';

/**
 * This component shows best practices for form validation:
 * 1. Required field validation with user-friendly messages
 * 2. Real-time validation feedback
 * 3. Unsaved changes indicator
 * 4. Success/error toast notifications
 * 5. Disabled save button when form is unchanged
 */
export function ExampleProductForm() {
  const { showToast } = useUi();
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  // Setup form validation
  const validation = useFormValidation({
    initialData: {
      productName: '',
      sku: '',
      category: '',
      price: '',
      quantity: '',
      description: '',
      vendorEmail: '',
    },
    rules: [
      // Required text fields
      ValidationRules.requiredText('productName', 'Product Name'),
      ValidationRules.requiredText('sku', 'SKU/Product Code'),

      // Required select
      ValidationRules.requiredSelect('category', 'Category'),

      // Number fields - custom rule with validation
      {
        field: 'price',
        label: 'Price',
        required: true,
        pattern: ValidationPatterns.number,
        customValidator: (value) => {
          if (!value) return 'Price is required';
          const num = parseFloat(value);
          if (isNaN(num) || num <= 0) return 'Price must be a positive number';
          return true;
        },
      },
      {
        field: 'quantity',
        label: 'Initial Quantity',
        required: true,
        pattern: /^\d+$/,
        customValidator: (value) => {
          if (!value) return 'Quantity is required';
          const num = parseInt(value);
          if (isNaN(num) || num < 0) return 'Quantity must be a whole number';
          return true;
        },
      },

      // Optional description with min length
      {
        field: 'description',
        label: 'Description',
        required: false,
        minLength: 10,
        customValidator: (value) => {
          if (!value) return true; // Optional field
          if (value.length < 10) return 'Description must be at least 10 characters';
          return true;
        },
      },

      // Optional email
      ValidationRules.optionalEmail('vendorEmail', 'Vendor Email'),
    ],
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate all fields before submission
    // If validation fails, a toast is shown automatically
    if (!validation.validateForm()) {
      return;
    }

    setIsSubmitting(true);
    try {
      // Simulate API call
      console.log('Submitting product:', validation.formData);

      // In real app, you'd call:
      // await createProduct(validation.formData);

      // Mark form as saved
      validation.markSaved();

      // Show success message
      showToast(
        'Product created successfully! It will appear in your inventory within a moment.',
        'success'
      );

      // Optional: Reset form for next product
      // validation.resetForm();
    } catch {
      showToast(
        'Failed to create product. Please check your information and try again.',
        'error'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1>Create New Product</h1>
        <p>Add a new product to your inventory system</p>
      </div>

      <form onSubmit={handleSubmit} className={styles.form}>
        {/* Unsaved indicator */}
        {!validation.isSaved && (
          <div className={styles.unsavedBanner}>
            <UnsavedIndicator />
            <span>You have unsaved changes in this form</span>
          </div>
        )}

        <fieldset className={styles.fieldset}>
          <legend className={styles.legend}>Basic Information</legend>

          {/* Product Name - Required Text */}
          <ValidatedInput
            label="Product Name"
            required
            value={validation.formData.productName}
            onChange={(e) =>
              validation.handleChange('productName', e.target.value)
            }
            error={validation.errors.productName}
            placeholder="e.g., Office Chair Executive"
            helperText="This is how the product appears in lists and searches"
          />

          {/* SKU - Required Text */}
          <ValidatedInput
            label="SKU / Product Code"
            required
            value={validation.formData.sku}
            onChange={(e) => validation.handleChange('sku', e.target.value)}
            error={validation.errors.sku}
            placeholder="e.g., OC-2024-001"
            helperText="Must be unique for each product variant"
          />

          {/* Category - Required Select */}
          <ValidatedSelect
            label="Category"
            required
            value={validation.formData.category}
            onChange={(e) => validation.handleChange('category', e.target.value)}
            error={validation.errors.category}
            options={[
              { value: '', label: '— Select a category —' },
              { value: 'furniture', label: 'Furniture & Fixtures' },
              { value: 'electronics', label: 'Electronics & IT' },
              { value: 'materials', label: 'Raw Materials' },
              { value: 'supplies', label: 'Office Supplies' },
            ]}
            helperText="Choose the category that best describes this product"
          />
        </fieldset>

        <fieldset className={styles.fieldset}>
          <legend className={styles.legend}>Pricing & Inventory</legend>

          {/* Price - Required Number with validation */}
          <ValidatedInput
            label="Price per Unit"
            type="number"
            required
            step="0.01"
            min="0"
            value={validation.formData.price}
            onChange={(e) => validation.handleChange('price', e.target.value)}
            error={validation.errors.price}
            placeholder="0.00"
            helperText="Enter the cost or selling price"
          />

          {/* Quantity - Required Integer */}
          <ValidatedInput
            label="Initial Stock Quantity"
            type="number"
            required
            min="0"
            step="1"
            value={validation.formData.quantity}
            onChange={(e) => validation.handleChange('quantity', e.target.value)}
            error={validation.errors.quantity}
            placeholder="0"
            helperText="How many units are available right now?"
          />
        </fieldset>

        <fieldset className={styles.fieldset}>
          <legend className={styles.legend}>Additional Details</legend>

          {/* Description - Optional but validated if provided */}
          <ValidatedTextarea
            label="Description"
            value={validation.formData.description}
            onChange={(e) =>
              validation.handleChange('description', e.target.value)
            }
            error={validation.errors.description}
            placeholder="Enter a detailed description of the product..."
            helperText="Optional, but helpful for other team members (minimum 10 characters if provided)"
          />

          {/* Vendor Email - Optional email validation */}
          <ValidatedInput
            label="Vendor Contact Email"
            type="email"
            value={validation.formData.vendorEmail}
            onChange={(e) =>
              validation.handleChange('vendorEmail', e.target.value)
            }
            error={validation.errors.vendorEmail}
            placeholder="vendor@example.com"
            helperText="Optional: We'll use this to send updates about the product"
          />
        </fieldset>

        {/* Form Actions */}
        <div className={styles.actions}>
          <button
            type="button"
            className={styles.secondaryBtn}
            onClick={() => validation.resetForm()}
            disabled={validation.isSaved || isSubmitting}
          >
            Clear Form
          </button>
          <button
            type="submit"
            className={styles.primaryBtn}
            disabled={validation.isSaved || isSubmitting}
          >
            {isSubmitting ? 'Creating Product...' : 'Create Product'}
          </button>
        </div>

        {/* Help text at bottom */}
        <div className={styles.helpText}>
          <strong>Note:</strong> Fields marked with <span className={styles.required}>*</span> are
          required. Your changes will be marked as "Unsaved" until you submit the form.
        </div>
      </form>
    </div>
  );
}

export default ExampleProductForm;
