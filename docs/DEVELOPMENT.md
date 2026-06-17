# Development Guide

## Current Priority

現時点の最優先は `機能追加` ではなく、`schema alignment` と `library normalization`。

現在のライブラリ前提:

- `default_images` = 公式素材とプレミアムライブラリの正規台帳
- `user_images` = private uploads

次セッションで再開する場合は、まず [RENEWAL_STATUS.md](./RENEWAL_STATUS.md) を読むこと。

## Canvas Architecture

### Component Hierarchy
```
BannerEditor.tsx          # State management, keyboard shortcuts, history
├── Canvas.tsx            # Konva Stage, element rendering, transformers
│   ├── ShapeRenderer    # Shape elements (rectangle, circle, etc.)
│   ├── TextRenderer     # Text elements
│   └── ImageRenderer    # Image elements
├── Sidebar.tsx          # Tool palette, layers panel
├── PropertyPanel.tsx    # Element property editors
└── BottomBar.tsx        # Zoom controls, export button
```

### Element Management

All elements are stored in a single `elements: CanvasElement[]` array.

#### Element Types
```typescript
type CanvasElement = TextElement | ShapeElement | ImageElement;

interface BaseElement {
  id: string;
  type: 'text' | 'shape' | 'image';
  x: number;
  y: number;
  rotation?: number;
  opacity?: number;
  locked?: boolean;
  visible?: boolean;

  // Shadow properties
  shadowEnabled?: boolean;
  shadowColor?: string;
  shadowBlur?: number;
  shadowOffsetX?: number;
  shadowOffsetY?: number;
  shadowOpacity?: number;
}
```

### Adding New Element Types

1. **Define interface** in `src/types/template.ts`:
```typescript
export interface NewElement extends BaseElement {
  type: 'newtype';
  customProperty: string;
}

export type CanvasElement = TextElement | ShapeElement | ImageElement | NewElement;
```

2. **Create renderer** in `src/components/canvas/NewRenderer.tsx`:
```typescript
export const NewRenderer = memo(({ element, onSelect, onUpdate, ... }) => {
  return <KonvaComponent {...element} />;
}, (prevProps, nextProps) => {
  // Memo comparison
});
```

3. **Add rendering logic** in `Canvas.tsx`:
```typescript
if (element.type === 'newtype') {
  return <NewRenderer key={element.id} element={element} />;
}
```

4. **Add creation handler** in `BannerEditor.tsx`:
```typescript
const handleAddNew = () => {
  const newElement: NewElement = { id: `new-${Date.now()}`, type: 'newtype', ... };
  elementOps.addElement(newElement);
};
```

## Multi-Selection System

### State Management
```typescript
// Changed from single ID to array
const [selectedElementIds, setSelectedElementIds] = useState<string[]>([]);
```

### Selection Handlers
- **Regular Click**: Select single element (deselect others)
- **Shift+Click**: Toggle element in/out of selection
- **Already-selected Click**: Preserve multi-selection (for multi-drag)

### Multi-Transform
Konva Transformer can handle multiple nodes simultaneously:
```typescript
<Transformer
  ref={multiTransformerRef}
  nodes={selectedNodes}
  enabledAnchors={['top-left', 'top-right', 'bottom-left', 'bottom-right']}
  keepRatio={true}
  onTransformEnd={handleMultiTransformEnd}
/>
```

## Zoom & Pan System

### Trackpad Pinch Implementation
Document-level event handlers (runs on mount, no containerRef dependency):
```typescript
useEffect(() => {
  const handleDocumentWheel = (e: WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      setZoom(prev => clamp(prev + delta));
    }
  };

  document.addEventListener('wheel', handleDocumentWheel, { passive: false });
  return () => document.removeEventListener('wheel', handleDocumentWheel);
}, []);
```

Safari gesture events for native pinch:
```typescript
document.addEventListener('gesturechange', (e) => {
  e.preventDefault();
  setZoom(prev => clamp(prev + delta * 100));
}, { passive: false });
```

## History Management

### Undo/Redo Stack
`useHistory` hook maintains a stack of element snapshots:
```typescript
const { saveToHistory, undo, redo, resetHistory } = useHistory();

// Save after element change
saveToHistory(elements);

// Restore previous state
const prevElements = undo();
if (prevElements) setElements(prevElements);
```

Max 50 entries, unified for all element types.

## Data Flow

### React Query Integration
```typescript
// Fetch banner data
const { data: bannerData } = useBanner(id);

// Update with optimistic UI
const updateBanner = useUpdateBanner(id);
updateBanner.mutate({ elements, canvasColor });

// Auto-save with debounce
const debouncedSave = useMemo(() =>
  debounce(() => performSave(false), 3000),
  [elements, canvasColor]
);
```

### Element Operations Hook
`useElementOperations` provides batch update utilities:
```typescript
const elementOps = useElementOperations({ setElements, saveToHistory });

// Update multiple elements
elementOps.updateElements(ids, (el) => ({ opacity: 0.5 }));

// Reorder layers
elementOps.bringToFront(ids);
elementOps.sendToBack(ids);
```

## Adding New Properties

Example: Adding shadow support to elements

1. **Type definition** (`src/types/template.ts`):
```typescript
interface BaseElement {
  shadowEnabled?: boolean;
  shadowBlur?: number;
  // ... other shadow props
}
```

2. **Renderer** (`ShapeRenderer.tsx`, `TextRenderer.tsx`, etc.):
```typescript
const commonProps = {
  shadowEnabled: shape.shadowEnabled ?? false,
  shadowBlur: shape.shadowBlur ?? 4,
  // ... pass to Konva component
};
```

3. **Property Panel UI** (`PropertyPanel.tsx`):
```typescript
<div className="mb-4 p-3 bg-[#2b2b2b] rounded-lg">
  <label>Shadow</label>
  <input type="checkbox" checked={element.shadowEnabled} />
  {element.shadowEnabled && (
    <input type="range" value={element.shadowBlur} />
  )}
</div>
```

4. **Handlers** (`BannerEditor.tsx`):
```typescript
const handleShadowBlurChange = (blur: number) => {
  elementOps.updateElements(selectedIds, () => ({ shadowBlur: blur }));
};
```

5. **i18n** (`src/i18n/locales/*/editor.json`):
```json
{
  "properties": {
    "shadow": "Shadow",
    "shadowBlur": "Blur"
  }
}
```

## Testing Locally

### Auth Setup
1. Create `.env.local` with Supabase credentials
2. Add `http://localhost:5173` to Supabase Auth → Redirect URLs
3. Restart dev server

### Guest Mode Testing
Access `/editor` without login to test guest banner (localStorage-based).

## Coding Conventions

- **English comments** in code (Japanese in markdown docs)
- **File naming**: PascalCase for components, camelCase for utilities
- **Component structure**: Props interface → Component → Memo export
- **State updates**: Use functional updates for async-safe state (`setZoom(prev => ...)`)

## Common Pitfalls

### Stale Closure in Event Handlers
❌ Wrong:
```typescript
useEffect(() => {
  const handler = () => setZoom(zoom + 10); // Captures old zoom
  document.addEventListener('wheel', handler);
}, [zoom]); // Re-registers on every zoom change
```

✅ Correct:
```typescript
useEffect(() => {
  const handler = () => setZoom(prev => prev + 10); // Always current
  document.addEventListener('wheel', handler);
}, []); // Runs once
```

### Element Update Timing
❌ Wrong:
```typescript
setElements([...elements, newElement]);
saveToHistory(elements); // Saves OLD state
```

✅ Correct:
```typescript
setElements(prev => {
  const newElements = [...prev, newElement];
  setTimeout(() => saveToHistory(newElements), 0);
  return newElements;
});
```

### Konva Node Position (Star/Circle)
Star and Circle use **center coordinates**, others use **top-left**:
```typescript
// Convert center to top-left for data storage
const logicalX = centerX - width / 2;
const logicalY = centerY - height / 2;
```
