# Loading States - Design & Usage Guide

## Overview

A modern, professional loading state system with multiple components for different use cases. All loading states feature smooth animations and are fully responsive.

## Components

### 1. **LoadingPage** (Full Screen)
Complete loading screen with brand, spinner, message, and progress indication.

```typescript
import { LoadingPage } from '@/components/LoadingPage';

// Full screen (default)
<LoadingPage />

// Custom message
<LoadingPage message="Preparing your dashboard..." />

// Without brand
<LoadingPage showBrand={false} />

// Minimal (not fullscreen)
<LoadingPage fullscreen={false} />
```

**Features:**
- Animated spinner with 3 rotating rings
- Brand icon and app name
- Loading message with animated dots
- Progress bar animation
- Loading statistics
- Professional gradient background

### 2. **SkeletonLoader**
Placeholder for loading content (simulates text lines).

```typescript
import { SkeletonLoader } from '@/components/LoadingPage';

<div>
  <h2>Page Title</h2>
  <SkeletonLoader />
</div>
```

**Use for:**
- Text content
- Paragraphs
- Descriptions

### 3. **TableSkeletonLoader**
Placeholder for loading tables.

```typescript
import { TableSkeletonLoader } from '@/components/LoadingPage';

<table>
  <thead>...</thead>
  <tbody>
    <TableSkeletonLoader />
  </tbody>
</table>
```

**Use for:**
- Data tables
- Lists with columns
- Tabular data

### 4. **CardSkeletonLoader**
Placeholder for loading cards.

```typescript
import { CardSkeletonLoader } from '@/components/LoadingPage';

<div className="grid">
  <CardSkeletonLoader />
  <CardSkeletonLoader />
  <CardSkeletonLoader />
</div>
```

**Use for:**
- Product cards
- Dashboard cards
- Content cards

### 5. **MiniLoader**
Small inline loading indicator.

```typescript
import { MiniLoader } from '@/components/LoadingPage';

<button disabled>
  <MiniLoader /> Saving...
</button>
```

**Use for:**
- Button states
- Inline loading
- Small indicators

## Loading Animations

### Spinner
```
Three rotating rings with different speeds and opacity
- Ring 1: Fast rotation
- Ring 2: Medium rotation (reverse)
- Ring 3: Slow rotation
```

### Dots
```
Three dots that bounce up and down sequentially
- Creates a sense of progress
- Natural, friendly feel
```

### Progress Bar
```
Animated gradient that moves back and forth
- Shows continuous activity
- No definite end (suitable for unknown duration)
```

### Skeleton
```
Shimmer effect that moves across placeholder elements
- Mimics the shape of real content
- More sophisticated than simple spinners
```

## Integration Examples

### Full Page Load
```typescript
import { LoadingPage } from '@/components/LoadingPage';
import { useAuth } from '@/lib/AuthContext';

export function MyApp() {
  const { isLoading } = useAuth();

  if (isLoading) {
    return <LoadingPage />;
  }

  return <YourApp />;
}
```

### Data Table Load
```typescript
import { TableSkeletonLoader } from '@/components/LoadingPage';
import { useData } from '@/hooks/useData';

export function DataTable() {
  const { data, isLoading } = useData();

  return (
    <table>
      <thead>
        <tr>
          <th>Name</th>
          <th>Email</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody>
        {isLoading ? (
          <TableSkeletonLoader />
        ) : (
          data.map(item => (
            <tr key={item.id}>
              <td>{item.name}</td>
              <td>{item.email}</td>
              <td>{item.status}</td>
            </tr>
          ))
        )}
      </tbody>
    </table>
  );
}
```

### Card Grid Load
```typescript
import { CardSkeletonLoader } from '@/components/LoadingPage';

export function ProductGrid() {
  const { products, isLoading } = useProducts();

  return (
    <div className="grid">
      {isLoading ? (
        <>
          <CardSkeletonLoader />
          <CardSkeletonLoader />
          <CardSkeletonLoader />
        </>
      ) : (
        products.map(product => (
          <ProductCard key={product.id} product={product} />
        ))
      )}
    </div>
  );
}
```

### Button Action
```typescript
import { MiniLoader } from '@/components/LoadingPage';

export function SaveButton() {
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await save();
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <button onClick={handleSave} disabled={isSaving}>
      {isSaving ? (
        <>
          <MiniLoader /> Saving...
        </>
      ) : (
        'Save'
      )}
    </button>
  );
}
```

## Customization

### Custom Messages
```typescript
<LoadingPage message="Loading your inventory..." />
<LoadingPage message="Syncing data..." />
<LoadingPage message="Preparing workspace..." />
```

### Hiding Brand
```typescript
<LoadingPage showBrand={false} message="Loading..." />
```

### Minimal Version
```typescript
<LoadingPage fullscreen={false} />
```

## Animation Details

### Spinner
- **Duration:** 1s, 1.5s, 2s (per ring)
- **Style:** Smooth linear rotation
- **Effect:** Creates smooth, continuous motion

### Dots
- **Duration:** 1.4s total
- **Effect:** Bouncing animation
- **Delay:** Staggered (0s, 0.2s, 0.4s)

### Progress
- **Duration:** 2s per cycle
- **Style:** Gradient movement
- **Effect:** Continuous activity indicator

### Skeleton Shimmer
- **Duration:** 2s per cycle
- **Style:** Left-to-right movement
- **Effect:** Realistic content placeholder

## Accessibility

✅ **WCAG Compliant**
- Proper color contrast
- No flashing (safe for photosensitive users)
- Clear text labels
- Descriptive loading messages

✅ **Screen Reader Support**
- Semantic HTML
- Proper heading hierarchy
- Loading messages are visible

✅ **Dark Mode Support**
- Automatically adjusts skeleton colors
- Maintains contrast in dark mode
- Respects `prefers-color-scheme`

## Performance

✅ **Optimized**
- CSS animations (GPU accelerated)
- No JavaScript animation loops
- Minimal DOM elements
- Smooth 60fps animations

✅ **Bundle Size**
- Component: ~2KB (minified)
- Styles: ~4KB (minified)
- Total: ~6KB

## Browser Support

✅ Modern browsers:
- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## Best Practices

### Do ✅
- Use LoadingPage for full page loads
- Use skeleton loaders for partial content
- Provide context with custom messages
- Match loading state duration to actual load time
- Show skeleton shapes that match content

### Don't ❌
- Use LoadingPage for every small action
- Show loading state without message
- Use overly complex animations
- Change loading state too frequently
- Forget to handle error states after loading

## Common Patterns

### Conditional Rendering
```typescript
{isLoading ? <SkeletonLoader /> : <Content />}
```

### Suspense Boundary
```typescript
<Suspense fallback={<SkeletonLoader />}>
  <MyContent />
</Suspense>
```

### Combined with Error State
```typescript
{isLoading && <SkeletonLoader />}
{error && <ErrorMessage error={error} />}
{!isLoading && !error && <Content />}
```

### Staggered Skeleton
```typescript
{isLoading && (
  <>
    <CardSkeletonLoader />
    <CardSkeletonLoader />
    <CardSkeletonLoader />
  </>
)}
```

## Troubleshooting

### Animation doesn't play
- Check browser console for CSS errors
- Verify `prefers-reduced-motion` setting
- Ensure CSS file is imported

### Wrong colors in dark mode
- Add `@media (prefers-color-scheme: dark)` check
- Verify CSS variable definitions
- Check browser theme setting

### Skeleton doesn't match content
- Adjust width percentages
- Match height to actual content
- Add multiple skeleton lines for paragraphs

## Summary

The loading state system provides:
- ✅ Professional appearance
- ✅ Smooth animations
- ✅ Multiple components for different needs
- ✅ Responsive design
- ✅ Dark mode support
- ✅ Accessibility compliance
- ✅ Excellent performance

Use LoadingPage for full screens, skeleton loaders for partial content, and MiniLoader for inline actions!
