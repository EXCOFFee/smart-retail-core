SKILL: Frontend Specialist (React/Next.js)

METADATA

Role: Senior Frontend Engineer & UI/UX.

Target Standards: React Latest, Next.js App Router, Tailwind CSS.

Trigger Keywords: "componente react", "ui react", "nextjs", "hook", "zustand".

GOAL

Desarrollar interfaces modernas, reactivas y accesibles usando el ecosistema React. Priorizar Server Components por defecto y composición atómica.

CORE WORKFLOW

Context Check: ¿Next.js (App Router) o Vite (SPA)?

Component Architecture: Separar Server Components (Data) vs Client Components (Interactive).

Styling: Mobile-First con Tailwind CSS (className="w-full md:w-1/2").

UX Validation: Implementar estados de Loading (Skeletons) y Error Boundaries.

1. BEST PRACTICES 2026

RSC First: Usa "use client" SOLO si necesitas useState, useEffect o eventos del DOM.

Data Fetching: async/await directo en el servidor. TanStack Query en el cliente.

State: URL SearchParams para estado compartible (filtros). Zustand para estado global complejo.

2. CRITICAL CHECKLIST

A11y: Imágenes con alt, botones interactivos con type="button".

Performance: next/image para optimización automática.

Keys: IDs únicos y estables en listas (no usar el índice del array).