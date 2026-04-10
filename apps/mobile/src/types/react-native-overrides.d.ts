// @types/react-native-overrides.d.ts
// =====================================================
// WORKAROUND: Fixes JSX type compatibility issues between React Native 0.76.x 
// and @types/react@18.2.x. React Native components are class-based but their
// type signatures don't perfectly match React's Component type expectations.
//
// This augmentation makes JSX.Element more permissive to allow RN components.
// Reference: https://github.com/facebook/react-native/issues/42748
// =====================================================

import type { ReactElement, ReactNode } from 'react';

// Override JSX namespace to accept React Native component types
declare global {
  namespace JSX {
    // Make Element more permissive to accept React Native class components
    interface Element extends ReactElement<any, any> {}
    
    // Allow any return type from components
    interface ElementClass {
      render(): ReactNode;
    }
    
    // Don't check props on intrinsic elements
    interface IntrinsicAttributes {}
  }
}

// Ensure this is treated as a module
export { };

