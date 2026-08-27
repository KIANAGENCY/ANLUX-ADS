@AGENTS.md

# Notas del proyecto (persistentes)

## Despliegue en Vercel — `main` es la rama de producción

- **Causa raíz del fallo "No Next.js version detected" (27 ago 2026):** el repo se creó con un
  commit inicial en `main` que solo tenía `README.md` (sin `package.json` ni código). Todo el
  proyecto Next.js real se desarrolló en la rama `claude/anlux-ads-intelligence-mvp-8i7tfb`. Vercel
  apunta por defecto a `main`, así que no encontraba ningún `package.json` que leer.
- **Fix aplicado:** se fusionó `claude/anlux-ads-intelligence-mvp-8i7tfb` → `main` con
  **fast-forward puro** (main era ancestro directo, cero conflictos, cero pérdida de archivos —
  verificado con `git diff` entre ambas ramas antes y después) y se hizo push de `main` a GitHub.
  `main` ahora contiene el proyecto completo (`package.json` con `"next"` en `dependencies`,
  `src/app`, `src/lib`, etc.) en la raíz del repo.
- **Mantener sincronizado:** de aquí en adelante, cualquier trabajo nuevo debe llegar a `main`
  (vía merge o PR) para que Vercel lo despliegue. Si se sigue trabajando en una rama de feature
  aparte, recordar fusionarla a `main` antes de esperar que un deploy de Vercel la refleje.
