/**
 * ============================================================================
 * SMART_RETAIL - Commitlint Configuration
 * ============================================================================
 * Configura commitlint para forzar mensajes de commit convencionales.
 * Cumple con QA Mandate: "convenciones estrictas de commits"
 * 
 * Formato: <type>(<scope>): <description>
 * Ejemplo: feat(api): add stock adjustment endpoint
 * ============================================================================
 */

module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    // Tipos permitidos
    'type-enum': [
      2, // Error level
      'always',
      [
        'feat',     // Nueva funcionalidad
        'fix',      // Corrección de bug
        'docs',     // Documentación
        'style',    // Formateo, sin cambios de código
        'refactor', // Refactorización de código
        'perf',     // Mejoras de rendimiento
        'test',     // Agregar o modificar tests
        'build',    // Cambios en build o dependencias
        'ci',       // Cambios en CI/CD
        'chore',    // Tareas de mantenimiento
        'revert',   // Revertir commits
      ],
    ],
    // Tipo es obligatorio
    'type-empty': [2, 'never'],
    // Subject (descripción) es obligatorio
    'subject-empty': [2, 'never'],
    // Subject no termina en punto
    'subject-full-stop': [2, 'never', '.'],
    // Subject en minúsculas
    'subject-case': [2, 'always', 'lower-case'],
    // Máximo 100 caracteres en el header
    'header-max-length': [2, 'always', 100],
    // Body opcional pero si existe, separado por línea en blanco
    'body-leading-blank': [2, 'always'],
    // Footer opcional pero si existe, separado por línea en blanco
    'footer-leading-blank': [2, 'always'],
  },
};
