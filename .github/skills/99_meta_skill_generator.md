PROTOCOLOS Y REGLAS CENTRALES DEL PROYECTO

METADATA

Alcance: GLOBAL (Aplica a cada interacción sin excepción).

Prioridad: CRÍTICA (Sobrescribe cualquier comportamiento por defecto).

Idioma: Español (Todos los planes y explicaciones deben ser en español).

Fecha del Stack: Enero 2026 (Últimos Estándares Estables).

1. MANDATO DE GESTIÓN DE PAQUETES

REGLA: NUNCA uses npm.

ACCIÓN: Usa siempre pnpm para la gestión de dependencias.

VERIFICACIÓN: Si ves un package-lock.json, sugiere eliminarlo a favor de pnpm-lock.yaml.

2. PROTOCOLO "PLAN PRIMERO" (THINK BEFORE CODE)

Antes de escribir código, DEBES:

Analizar Documentación (DOCS FIRST): Lee docs/ (SRS, reglas) antes de nada.

Manejo de Vacíos: Si la info es ambigua, DETENTE, consulta y propón.

Identificar Casos Borde: (Nulls, Offline, Errores).

Definir "Terminado" (DoD): Criterios de cierre (Tests ok + Build ok).

Generar Plan de Implementación (En Español): Paso a paso detallado.

3. POLÍTICA DE "NO IMPROVISACIÓN"

Si tienes dudas: PAUSA.

Presenta opciones: Conservadora vs Moderna. Espera confirmación.

4. ESTRATEGIA DE VALIDACIÓN PARANOICA (Seguridad)

Frontend: Validación estricta (Zod/Typescript).

Backend: Zero Trust. Revalida todo con DTOs.

DB: Constraints SQL (FK, NOT NULL).

5. MANEJO DE ERRORES ROBUSTO

Frontend: Toasts amigables + Botón "Reintentar". 0% Pantallas Blancas.

Backend: Log interno (Stack Trace) vs Mensaje seguro al cliente.

6. CORTE DE CONOCIMIENTO (2026)

Stack: Next.js App Router, Angular (Zoneless), Python 3.12+, Node LTS.

Prohibido: Prácticas obsoletas (var, ng modules, class components).

7. REQUISITO DE IDIOMA

Planes/Chat: ESPAÑOL.

Código: Inglés (Standard), Comentarios complejos en Español.

8. CÓDIGO LIMPIO & PRINCIPIOS

SOLID: Especial foco en SRP (Una función = Una tarea).

DRY: No repetir código; extraer a utilidades/hooks.

KISS: Solución simple > Solución astuta. Legibilidad ante todo.

9. QA MANDATE

Lógica nueva = Test nuevo obligatorio.

Cubrir Happy Path + 1 Caso de Error + 1 Caso Borde.

10. HIGIENE

Sin console.log basura.

Secretos en .env.

Commits semánticos (feat:, fix:).