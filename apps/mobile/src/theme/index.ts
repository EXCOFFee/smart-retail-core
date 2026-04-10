/**
 * ============================================================================
 * SMART_RETAIL - Theme Configuration (SMART_RETAIL Slate Design System)
 * ============================================================================
 * Design tokens y constantes visuales de la aplicación.
 * Sincronizado con admin-web/src/styles/design-tokens.css
 * ============================================================================
 */

/**
 * Paleta de colores del sistema - SMART_RETAIL Slate
 * Minimalista, sofisticada, profesional
 */
export const colors = {
  // Primary brand colors - Deep Slate
  primary: '#0F172A',
  primaryLight: '#1E293B',
  primaryDark: '#020617',

  // Accent - Vibrant Indigo
  accent: '#6366F1',
  accentLight: '#818CF8',
  accentDark: '#4F46E5',

  // Secondary (alias for accent)
  secondary: '#6366F1',
  secondaryLight: '#818CF8',
  secondaryDark: '#4F46E5',

  // Semantic colors - Refined palette
  success: '#10B981',
  successLight: '#D1FAE5',
  successDark: '#047857',
  
  warning: '#F59E0B',
  warningLight: '#FEF3C7',
  warningDark: '#B45309',
  
  error: '#EF4444',
  errorLight: '#FEE2E2',
  errorDark: '#B91C1C',
  
  info: '#3B82F6',
  infoLight: '#DBEAFE',
  infoDark: '#1D4ED8',

  // Neutral colors - Clean backgrounds
  background: '#F8FAFC',
  backgroundSubtle: '#F1F5F9',
  surface: '#FFFFFF',
  inputBackground: '#F8FAFC',
  
  // Borders - Subtle separation
  border: '#E2E8F0',
  borderLight: '#F1F5F9',

  // Text colors - High readability
  text: '#0F172A',
  textSecondary: '#475569',
  textTertiary: '#94A3B8',
  placeholder: '#94A3B8',

  // Dark mode variants (for future use)
  dark: {
    background: '#0F172A',
    backgroundSubtle: '#1E293B',
    surface: '#1E293B',
    inputBackground: '#334155',
    border: '#334155',
    borderLight: '#475569',
    text: '#F8FAFC',
    textSecondary: '#CBD5E1',
    textTertiary: '#94A3B8',
  },
} as const;

/**
 * Espaciado consistente
 */
export const spacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

/**
 * Familias de fuentes con fallback a sistema.
 * 
 * ESTRATEGIA:
 * - Si Inter está disponible, se usa Inter
 * - Si no, el sistema usa la fuente nativa de cada plataforma:
 *   - iOS: San Francisco (System)
 *   - Android: Roboto
 * 
 * Para usar Inter, descarga las fuentes de:
 * https://fonts.google.com/specimen/Inter
 * y colócalas en apps/mobile/assets/fonts/
 */
import { Platform } from 'react-native';

const systemFontFamily = Platform.select({
  ios: 'System',
  android: 'Roboto',
  default: 'System',
});

/**
 * Tipografía con soporte para fallback a fuentes del sistema.
 * Usar getFontFamily() para obtener la fuente correcta dinámicamente.
 */
export const typography = {
  // Fuentes Inter personalizadas
  fontRegular: 'Inter-Regular',
  fontMedium: 'Inter-Medium',
  fontSemiBold: 'Inter-SemiBold',
  fontBold: 'Inter-Bold',
  
  // Fuentes del sistema como fallback
  systemFont: systemFontFamily,

  // Font sizes
  sizes: {
    xs: 10,
    sm: 12,
    base: 14,
    md: 16,
    lg: 18,
    xl: 20,
    xxl: 24,
    xxxl: 32,
  },
  
  // Font weights para usar con fuentes del sistema
  weights: {
    regular: '400' as const,
    medium: '500' as const,
    semiBold: '600' as const,
    bold: '700' as const,
  },
} as const;

/**
 * Helper para obtener la familia de fuente correcta.
 * Si useSystemFonts es true, retorna la fuente del sistema.
 * 
 * @param variant - Variante de fuente deseada
 * @param useSystemFonts - Si usar fuentes del sistema
 * @returns Familia de fuente a usar
 */
export function getFontFamily(
  variant: 'regular' | 'medium' | 'semiBold' | 'bold',
  useSystemFonts = false,
): string {
  if (useSystemFonts) {
    return typography.systemFont;
  }
  
  switch (variant) {
    case 'regular':
      return typography.fontRegular;
    case 'medium':
      return typography.fontMedium;
    case 'semiBold':
      return typography.fontSemiBold;
    case 'bold':
      return typography.fontBold;
    default:
      return typography.fontRegular;
  }
}

/**
 * Radii para bordes - SMART_RETAIL Slate
 */
export const radii = {
  sm: 6,
  md: 8,
  lg: 12,
  xl: 16,
  xxl: 24,
  full: 9999,
} as const;

/**
 * Sombras
 */
export const shadows = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
  },
} as const;
