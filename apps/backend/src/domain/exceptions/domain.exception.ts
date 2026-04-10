/**
 * ============================================================================
 * SMART_RETAIL - Domain Exception Base (Dominio Puro)
 * ============================================================================
 * Clase base para todas las excepciones del dominio.
 * 
 * ARQUITECTURA: Capa de DOMINIO 🟢
 * 
 * Por qué excepciones de dominio: Las excepciones del dominio expresan
 * violaciones a las reglas de negocio. Son diferentes de los errores
 * técnicos (ej: conexión perdida). Un filtro global las mapea a HTTP.
 * ============================================================================
 */

/**
 * Clase base abstracta para excepciones del dominio.
 * 
 * Todas las excepciones de negocio deben extender esta clase.
 * Esto permite identificarlas y manejarlas de forma consistente.
 */
export abstract class DomainException extends Error {
  /**
   * Código único de error para identificación programática.
   * Por qué: Permite al frontend mostrar mensajes localizados
   * basados en el código, sin depender del mensaje en inglés.
   */
  abstract readonly code: string;

  /**
   * Código HTTP sugerido para la respuesta.
   * Por qué: El filtro global usa esto para generar la respuesta HTTP.
   */
  abstract readonly httpStatus: number;

  /**
   * Datos adicionales para debugging.
   */
  readonly details: Record<string, unknown>;

  constructor(message: string, details: Record<string, unknown> = {}) {
    super(message);
    this.name = this.constructor.name;
    this.details = details;

    // Captura el stack trace correctamente en Node.js
    if (typeof Error.captureStackTrace === 'function') {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  /**
   * Serializa la excepción para logs y respuestas.
   */
  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      details: this.details,
    };
  }
}
