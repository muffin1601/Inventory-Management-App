# Form Validation - Quick Reference Card

## 🚀 Basic Form Setup

```typescript
// 1. Import
import { useFormValidation } from '@/lib/hooks/useFormValidation';
import { ValidatedInput, ValidatedSelect } from '@/components/ui/ValidatedInput';
import { ValidationRules } from '@/lib/validation';

// 2. Setup
const validation = useFormValidation({
  initialData: { name: '', email: '' },
  rules: [
    ValidationRules.requiredText('name', 'Name'),
    ValidationRules.requiredEmail('email', 'Email'),
  ]
});

// 3. Use in JSX
<ValidatedInput
  label="Name"
  required
  value={validation.formData.name}
  onChange={(e) => validation.handleChange('name', e.target.value)}
  error={validation.errors.name}
/>

// 4. Validate on submit
if (!validation.validateForm()) return;
```

## ✅ Validation Rules Quick Lookup

| Rule | Code | Description |
|------|------|-------------|
| Required Text | `ValidationRules.requiredText('field', 'Label')` | Text must not be empty |
| Required Email | `ValidationRules.requiredEmail('field', 'Label')` | Valid email required |
| Required Phone | `ValidationRules.requiredPhone('field', 'Label')` | Valid phone required |
| Required Number | `ValidationRules.requiredNumber('field', 'Label')` | Valid number required |
| Required Select | `ValidationRules.requiredSelect('field', 'Label')` | Must select an option |
| Optional Email | `ValidationRules.optionalEmail('field', 'Label')` | Email if provided must be valid |
| Optional Phone | `ValidationRules.optionalPhone('field', 'Label')` | Phone if provided must be valid |

## 🎯 Common Patterns

### Password with Requirements
```typescript
{
  field: 'password',
  label: 'Password',
  required: true,
  minLength: 8,
  customValidator: (value) => {
    if (!/[A-Z]/.test(value)) return 'Must include uppercase letter';
    if (!/\d/.test(value)) return 'Must include number';
    return true;
  }
}
```

### Conditional Required
```typescript
{
  field: 'gstNumber',
  label: 'GST Number',
  required: formData.userType === 'business',
  customValidator: (value) => {
    if (formData.userType !== 'business') return true;
    return /^\d{15}$/.test(value) ? true : 'Must be 15 digits';
  }
}
```

### Matching Fields
```typescript
{
  field: 'confirmPassword',
  label: 'Confirm Password',
  required: true,
  customValidator: (value) => {
    if (value !== formData.password) {
      return 'Passwords do not match';
    }
    return true;
  }
}
```

### Dependent Validation
```typescript
{
  field: 'endDate',
  label: 'End Date',
  customValidator: (value) => {
    if (!value) return true;
    if (new Date(value) <= new Date(formData.startDate)) {
      return 'End date must be after start date';
    }
    return true;
  }
}
```

## 🧩 Form Components

| Component | Props | Example |
|-----------|-------|---------|
| `ValidatedInput` | `label`, `required`, `value`, `onChange`, `error`, `type`, `placeholder`, `helperText` | `<ValidatedInput label="Email" type="email" required ... />` |
| `ValidatedSelect` | `label`, `required`, `value`, `onChange`, `error`, `options` | `<ValidatedSelect options={[...]} ... />` |
| `ValidatedTextarea` | `label`, `required`, `value`, `onChange`, `error`, `placeholder`, `helperText` | `<ValidatedTextarea ... />` |

## 📣 Toast Notifications

```typescript
const { showToast } = useUi();

// Success
showToast('Item created!', 'success');

// Error  
showToast('Failed to create item', 'error');

// Info
showToast('Please wait...', 'info');

// Multiple errors
showToast('Errors:\n• Field 1 required\n• Field 2 invalid', 'error');
```

## 🎨 Unsaved Indicator

```typescript
import { UnsavedIndicator } from '@/components/ui/FormFieldError';

{!validation.isSaved && <UnsavedIndicator />}
```

## 🔄 Form Actions

```typescript
// Get form data
const data = validation.formData;

// Handle field change
validation.handleChange('fieldName', value);

// Validate all fields
const isValid = validation.validateForm();

// Reset to initial state
validation.resetForm();

// Mark as saved after submission
validation.markSaved();

// Reset to specific data
validation.resetForm({ name: '', email: '' });
```

## 🧪 Testing Checklist

- [ ] Required fields show error if empty
- [ ] Error messages are clear and helpful
- [ ] Real-time validation works as typing
- [ ] Toast appears on form submission
- [ ] Unsaved indicator appears on change
- [ ] Submit button disabled when no changes
- [ ] Form can be cleared/reset
- [ ] Success message shows after API call
- [ ] Error message shows on API failure

## 🚨 Error Messages

Automatically formatted and shown to users:

```
"Email is required. Please enter your email address."
"Password must be at least 8 characters long."
"Email format is invalid. Please check and try again."
"Please fix the following issues:
• Email is required
• Password is too short
• Phone number is invalid"
```

## 🔍 Common Validation Patterns

```typescript
// Min length
minLength: 3,

// Max length
maxLength: 100,

// Regex pattern
pattern: /^\d{3}-\d{3}-\d{4}$/,

// Custom logic
customValidator: (value) => {
  if (condition) return 'Error message';
  return true;
}

// Multiple checks
customValidator: (value) => {
  if (!value) return 'Required';
  if (value.length < 5) return 'Too short';
  if (!isValid(value)) return 'Invalid format';
  return true;
}
```

## 📚 Full Documentation

- **Complete Guide:** `FORM_VALIDATION_GUIDE.md`
- **Implementation Roadmap:** `VALIDATION_IMPLEMENTATION_ROADMAP.md`
- **Working Example:** `src/components/examples/ExampleFormValidation.tsx`
- **Summary:** `VALIDATION_SYSTEM_SUMMARY.md`

---

**Pro Tips:**
- Use pre-built rules for common fields (email, phone, etc.)
- Write clear, user-friendly error messages
- Keep validation rules close to component for easy maintenance
- Test edge cases: empty, whitespace, special characters
- Use `customValidator` for business logic validation
