PROTOCOLOS Y REGLAS CENTRALES DEL PROYECTO

METADATA

Alcance: GLOBAL (Aplica a cada interacción sin excepción).

Prioridad: CRÍTICA (Sobrescribe cualquier comportamiento por defecto).

Idioma: Español (Todos los planes y explicaciones deben ser en español).

Fecha del Stack: Enero 2026 (Últimos Estándares Estables).

1. MANDATO DE GESTIÓN DE PAQUETES (Context Aware)

Preferencia Absoluta: Siempre que sea técnicamente viable (ecosistema JS/TS), pnpm es la única opción aceptada por su superioridad en eficiencia.

Dieta de Dependencias: PROHIBIDO instalar librerías para tareas triviales que el lenguaje soporte nativamente en 2026 (ej: No usar moment.js si existe Temporal, no usar lodash si existe ESNext). Mantén el package.json ligero.

Node.js/JS: Usa pnpm EXCLUSIVAMENTE (Prohibido npm o yarn).

Python: Usa uv (Estándar 2026) o poetry.

Go: Usa go mod.

Rust: Usa cargo.

Verificación: Alerta si hay lockfiles mezclados.

2. PROTOCOLO "PLAN PRIMERO" (THINK BEFORE CODE)

Antes de escribir código, DEBES:

Analizar Documentación (DOCS FIRST): Lee docs/ (SRS, reglas) antes de nada.

Manejo de Vacíos: Si la info es ambigua, DETENTE, consulta y propón.

Identificar Casos Borde: (Nulls, Offline, Errores).

Definir "Terminado" (DoD): Criterios de cierre (Tests ok + Build ok).

Generar Plan de Implementación (En Español): Paso a paso detallado.

3. POLÍTICA DE "NO IMPROVISACIÓN"

Si tienes dudas: PAUSA.

Consulta: Presenta opciones contrastantes relevantes al contexto (ej: Estabilidad vs Innovación, o Solución Rápida vs Escalable). Espera confirmación.

4. ESTRATEGIA DE VALIDACIÓN PARANOICA (Seguridad)

Frontend: Validación estricta (Zod/Typescript).

Backend: Zero Trust. Revalida todo con DTOs.

DB: Constraints SQL (FK, NOT NULL).

5. MANEJO DE ERRORES ROBUSTO

Frontend: Toasts amigables + Botón "Reintentar". 0% Pantallas Blancas.

Backend: Log interno (Stack Trace) vs Mensaje seguro al cliente.

6. CORTE DE CONOCIMIENTO (2026)

Fecha: Enero 2026.

Stack: Últimas versiones estables del lenguaje detectado.

Prohibido: Prácticas obsoletas (ej: var, GOPATH, Python 2, Enzyme).

7. REQUISITO DE IDIOMA

Planes/Chat: ESPAÑOL.

Código: Inglés (Standard), Comentarios complejos en Español.

8. CÓDIGO LIMPIO & PRINCIPIOS

Regla del Boy Scout: Deja el archivo más limpio de lo que lo encontraste. Si entras a editar una función y ves variables mal nombradas o tipado any cerca, arréglalo también.

SOLID: Especial foco en SRP (Una función = Una tarea).

DRY: No repetir código; extraer a utilidades/hooks.

KISS: Solución simple > Solución astuta. Legibilidad ante todo.

9. QA MANDATE

Lógica nueva = Test nuevo obligatorio.

Cubrir Happy Path + 1 Caso de Error + 1 Caso Borde.

10. HIGIENE

Documentación Viva: Si cambias la lógica de una función, DEBES actualizar sus comentarios/JSDoc inmediatamente. Código nuevo con comentarios viejos es un bug.

Sin Basura: Prohibido dejar console.log de depuración, código comentado o imports sin usar.

Secretos: NUNCA hardcodees API Keys o Tokens. Usa .env.

Commits: Semánticos (feat:, fix:, chore:).