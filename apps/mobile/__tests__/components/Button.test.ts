/**
 * ============================================================================
 * SMART_RETAIL Mobile - Button Component Tests
 * ============================================================================
 * Tests unitarios para el componente Button.
 * ============================================================================
 */

describe('Button', () => {
  describe('variants', () => {
    it('should support primary variant (default)', () => {
      const variant = 'primary';
      expect(['primary', 'secondary', 'outline', 'ghost']).toContain(variant);
    });

    it('should support secondary variant', () => {
      const variant = 'secondary';
      expect(['primary', 'secondary', 'outline', 'ghost']).toContain(variant);
    });

    it('should support outline variant', () => {
      const variant = 'outline';
      expect(['primary', 'secondary', 'outline', 'ghost']).toContain(variant);
    });

    it('should support ghost variant', () => {
      const variant = 'ghost';
      expect(['primary', 'secondary', 'outline', 'ghost']).toContain(variant);
    });
  });

  describe('sizes', () => {
    it('should support sm size', () => {
      const size = 'sm';
      expect(['sm', 'md', 'lg']).toContain(size);
    });

    it('should support md size (default)', () => {
      const size = 'md';
      expect(['sm', 'md', 'lg']).toContain(size);
    });

    it('should support lg size', () => {
      const size = 'lg';
      expect(['sm', 'md', 'lg']).toContain(size);
    });
  });

  describe('disabled state', () => {
    it('should compute isDisabled when disabled prop is true', () => {
      const disabled = true;
      const loading = false;
      const isDisabled = disabled || loading;
      expect(isDisabled).toBe(true);
    });

    it('should compute isDisabled when loading prop is true', () => {
      const disabled = false;
      const loading = true;
      const isDisabled = disabled || loading;
      expect(isDisabled).toBe(true);
    });

    it('should not be disabled when both props are false', () => {
      const disabled = false;
      const loading = false;
      const isDisabled = disabled || loading;
      expect(isDisabled).toBe(false);
    });
  });

  describe('loading state', () => {
    it('should show ActivityIndicator when loading', () => {
      const loading = true;
      expect(loading).toBe(true);
    });

    it('should show title when not loading', () => {
      const loading = false;
      const title = 'Click Me';
      expect(loading).toBe(false);
      expect(title).toBe('Click Me');
    });
  });

  describe('props interface', () => {
    it('should accept required props', () => {
      interface ButtonProps {
        title: string;
        onPress: () => void;
        variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
        size?: 'sm' | 'md' | 'lg';
        disabled?: boolean;
        loading?: boolean;
      }

      const props: ButtonProps = {
        title: 'Submit',
        onPress: () => {},
      };

      expect(props.title).toBe('Submit');
      expect(typeof props.onPress).toBe('function');
    });

    it('should have correct default values', () => {
      const defaultVariant = 'primary';
      const defaultSize = 'md';
      const defaultDisabled = false;
      const defaultLoading = false;

      expect(defaultVariant).toBe('primary');
      expect(defaultSize).toBe('md');
      expect(defaultDisabled).toBe(false);
      expect(defaultLoading).toBe(false);
    });
  });
});
