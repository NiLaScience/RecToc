# Lessons Learned: Capacitor Firebase Plugin Integration

## Key Differences Between Capacitor Firebase Plugin and Web SDK

### API and Type Differences
- The Capacitor Firebase plugin has significantly different APIs and types compared to the web SDK
- Common web SDK methods like `getDocs`, `collection`, or `doc.data()` don't exist in the plugin
- The plugin uses string-based `reference` paths instead of collection/document objects
- Document data is directly available in `doc.data` property rather than through a `data()` method

## TypeScript Best Practices

### Type Safety
```typescript
// Import types directly from the plugin
import { 
  AddCollectionSnapshotListenerCallback,
  DocumentData 
} from '@capacitor-firebase/firestore';

// Use explicit type annotations for callbacks
const callback: AddCollectionSnapshotListenerCallback<DocumentData> = (event, error) => {
  // ...
};

// Handle null cases with type guards
if (!doc.data) return null;

// Use type predicates in filters
.filter((app): app is JobApplication => 
  app !== null &&
  app.candidateId === userId
)
```

### Async Pattern Handling
```typescript
// Store callback IDs for cleanup
let listenerCallbackId: string | undefined;

// Proper cleanup in callbacks
if (listenerCallbackId) {
  FirebaseFirestore.removeSnapshotListener({
    callbackId: listenerCallbackId
  });
}

// Wrap complex operations in Promises
return new Promise((resolve, reject) => {
  // Handle both success and error cases
  if (error) {
    reject(error);
    return;
  }
  resolve(data);
});
```

## Debugging Approach

### Iterative Problem Solving
1. Fix one type error at a time
2. Pay attention to exact error messages
3. Look up underlying types when using third-party libraries
4. Don't assume implementation details without checking documentation

### Important Considerations
- Read plugin documentation thoroughly before implementation
- Understand the differences between web and mobile SDKs
- Use TypeScript's type system to catch issues early
- Take an iterative approach to fixing type errors

## Key Takeaways

1. **Plugin-Specific Knowledge**: 
   - Always verify the exact API and types provided by the plugin
   - Don't assume web SDK patterns will work

2. **Type Safety**: 
   - Use explicit type annotations
   - Handle null cases properly
   - Leverage TypeScript's type system

3. **Async Patterns**: 
   - Clean up resources properly
   - Handle all error cases
   - Use Promises for complex operations

4. **Development Process**:
   - Take an iterative approach
   - Verify assumptions with documentation
   - Use TypeScript errors as a guide

These lessons are valuable when working with any Capacitor plugins or similar mobile-web bridge technologies.
