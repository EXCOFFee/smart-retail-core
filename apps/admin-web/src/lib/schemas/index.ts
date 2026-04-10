/**
 * ============================================================================
 * SMART_RETAIL Admin Web - Zod Validation Schemas
 * ============================================================================
 * Esquemas de validación para formularios usando Zod + @hookform/resolvers.
 * Cumple con 00_Instrucciones.md §4: "Frontend: Validación estricta (Zod/Typescript)"
 * ============================================================================
 */

import { z } from 'zod';

// ═══════════════════════════════════════════════════════════════════════════
// AUTH SCHEMAS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Schema de login
 */
export const loginSchema = z.object({
  email: z
    .string()
    .min(1, 'El correo es requerido')
    .email('Correo inválido'),
  password: z
    .string()
    .min(1, 'La contraseña es requerida')
    .min(6, 'Mínimo 6 caracteres'),
});

export type LoginFormData = z.infer<typeof loginSchema>;

// ═══════════════════════════════════════════════════════════════════════════
// PRODUCT SCHEMAS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Schema para crear/editar producto
 * 
 * Por qué priceInCents: SRS Regla 8 prohíbe floats para dinero.
 * Usamos centavos como enteros.
 */
export const productSchema = z.object({
  name: z
    .string()
    .min(1, 'El nombre es requerido')
    .max(100, 'Máximo 100 caracteres'),
  description: z
    .string()
    .max(500, 'Máximo 500 caracteres')
    .optional(),
  sku: z
    .string()
    .min(1, 'El SKU es requerido')
    .max(50, 'Máximo 50 caracteres')
    .regex(/^[A-Z0-9-]+$/i, 'Solo letras, números y guiones'),
  barcode: z
    .string()
    .max(50, 'Máximo 50 caracteres')
    .optional(),
  priceInCents: z
    .number({ message: 'El precio es requerido' })
    .int('Debe ser un número entero (centavos)')
    .min(0, 'El precio no puede ser negativo'),
  stockQuantity: z
    .number({ message: 'El stock es requerido' })
    .int('Debe ser un número entero')
    .min(0, 'El stock no puede ser negativo'),
  minStockAlert: z
    .number()
    .int()
    .min(0)
    .optional(),
  categoryId: z
    .string()
    .uuid('ID de categoría inválido')
    .optional(),
  locationId: z
    .string()
    .uuid('ID de ubicación requerido'),
  isActive: z.boolean().default(true),
});

export type ProductFormData = z.infer<typeof productSchema>;

// ═══════════════════════════════════════════════════════════════════════════
// DEVICE SCHEMAS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Schema para registrar/editar dispositivo
 */
export const deviceSchema = z.object({
  name: z
    .string()
    .min(1, 'El nombre es requerido')
    .max(100, 'Máximo 100 caracteres'),
  serialNumber: z
    .string()
    .min(1, 'El número de serie es requerido')
    .max(100, 'Máximo 100 caracteres'),
  type: z.enum(['KIOSK', 'TABLET', 'GATE'], {
    message: 'El tipo es requerido',
  }),
  locationId: z
    .string()
    .uuid('ID de ubicación requerido'),
  firmwareVersion: z
    .string()
    .max(50, 'Máximo 50 caracteres')
    .optional(),
});

export type DeviceFormData = z.infer<typeof deviceSchema>;

// ═══════════════════════════════════════════════════════════════════════════
// USER SCHEMAS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Schema para crear usuario
 */
export const createUserSchema = z.object({
  email: z
    .string()
    .min(1, 'El correo es requerido')
    .email('Correo inválido'),
  name: z
    .string()
    .min(1, 'El nombre es requerido')
    .max(100, 'Máximo 100 caracteres'),
  password: z
    .string()
    .min(8, 'Mínimo 8 caracteres')
    .regex(/[A-Z]/, 'Debe contener al menos una mayúscula')
    .regex(/[a-z]/, 'Debe contener al menos una minúscula')
    .regex(/[0-9]/, 'Debe contener al menos un número'),
  role: z.enum(['ADMIN', 'OPERATOR', 'VIEWER'], {
    message: 'El rol es requerido',
  }),
  locationId: z
    .string()
    .uuid('ID de ubicación requerido')
    .optional(),
});

export type CreateUserFormData = z.infer<typeof createUserSchema>;

/**
 * Schema para editar usuario (password opcional)
 */
export const updateUserSchema = createUserSchema.partial({ password: true });

export type UpdateUserFormData = z.infer<typeof updateUserSchema>;

// ═══════════════════════════════════════════════════════════════════════════
// TRANSACTION FILTERS SCHEMA
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Schema para filtros de transacciones
 */
export const transactionFiltersSchema = z.object({
  startDate: z.date().optional(),
  endDate: z.date().optional(),
  status: z.enum(['PENDING', 'PAID', 'FAILED', 'REFUNDED']).optional(),
  deviceId: z.string().uuid().optional(),
  userId: z.string().uuid().optional(),
  minAmount: z.number().int().min(0).optional(),
  maxAmount: z.number().int().min(0).optional(),
}).refine(
  (data) => {
    if (data.startDate && data.endDate) {
      return data.startDate <= data.endDate;
    }
    return true;
  },
  { message: 'La fecha inicial debe ser anterior a la final', path: ['endDate'] }
);

export type TransactionFiltersFormData = z.infer<typeof transactionFiltersSchema>;

// ═══════════════════════════════════════════════════════════════════════════
// STOCK ADJUSTMENT SCHEMA
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Schema para ajuste manual de stock
 */
export const stockAdjustmentSchema = z.object({
  productId: z
    .string()
    .uuid('ID de producto requerido'),
  quantity: z
    .number({ message: 'La cantidad es requerida' })
    .int('Debe ser un número entero')
    .refine((val) => val !== 0, 'La cantidad no puede ser cero'),
  reason: z
    .string()
    .min(1, 'El motivo es requerido')
    .max(200, 'Máximo 200 caracteres'),
  type: z.enum(['INCREMENT', 'DECREMENT', 'SET'], {
    message: 'El tipo de ajuste es requerido',
  }),
});

export type StockAdjustmentFormData = z.infer<typeof stockAdjustmentSchema>;
