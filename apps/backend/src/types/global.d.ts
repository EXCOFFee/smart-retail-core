/**
 * ============================================================================
 * SMART_RETAIL - Global Type Declarations
 * ============================================================================
 * Declaraciones de tipos globales para Node.js y extensiones de interfaces.
 * ============================================================================
 */

/**
 * Extensión de la interfaz ErrorConstructor para soportar captureStackTrace.
 * 
 * Por qué: TypeScript no incluye captureStackTrace por defecto ya que
 * es una extensión de V8/Node.js, no parte del estándar ECMAScript.
 */
interface ErrorConstructor {
  captureStackTrace(targetObject: object, constructorOpt?: Function): void;
}
