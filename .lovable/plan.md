## Contexto

El sheet `Rota 2026` ya es público. Tiene 3 pestañas:
- `04-10 MAY` (pasada)
- `11-17 MAY` (pasada)
- `18-24 MAY` (semana actual) ✅
- ❌ **`25-31 MAY` aún no existe** — la próxima semana todavía no está creada en el sheet

La implementación actual (`src/lib/rota-import.functions.ts`) tiene la rota del 18-24 hardcodeada. Voy a sustituirla por una versión que lea el sheet en vivo, para que cuando crees la pestaña de la próxima semana, solo tengas que pulsar el botón otra vez.

## Cambios

### 1. `src/lib/rota-import.functions.ts` — reescribir

- Descargar el sheet vía `https://docs.google.com/spreadsheets/d/{ID}/export?format=csv&gid={gid}` (no requiere OAuth porque es público).
- Parsear cada pestaña con un parser CSV ligero (sin dependencias nuevas).
- Detectar la sección de staff: empieza en la fila después de `CHECK INS` / con cabecera `Name | Monday X | ... | Sunday X`.
- Calcular `WEEK_START` desde la celda `B1` (`WEEK OF:`), no hardcoded.
- Mapear cada celda como antes (Breakfast → template, Off → null, vacío → skip).
- Reutilizar la lógica existente de `upsertVolunteer` / `upsertTemplate` / `upsertShifts`.

Aceptar un parámetro `weekTabs: string[]` (default: `["18-24 MAY"]`). Devolver resumen por pestaña.

### 2. `src/routes/app.admin.rota.tsx`

- El botón "Importar Sheet" abre un pequeño dialog con checkboxes de pestañas disponibles (las descubre llamando primero a una función ligera `listRotaTabs`).
- Por defecto marca solo la semana de la fecha mostrada.

### 3. Sin cambios de esquema

Sigue escribiendo en las tablas Hostack (`volunteers`, `shift_templates`, `shifts`) con la service-role key.

## Detalles técnicos

- ID del sheet: `1k7SwmRTv6qKljEfyjOBVOYkfQHed263ovFrP3gevbis`
- Para descubrir gids dinámicamente: parsear `/htmlview` o `/pubhtml`. Más simple: hardcodear el ID del sheet y dejar que el usuario elija pestaña por **nombre** — el endpoint `export?format=csv&sheet={nombre}` también funciona y evita lidiar con gids.
- Cabeceras de columnas: `Name | Monday DD | Tuesday DD | ... | Sunday DD`. Parseo flexible (trim, case-insensitive, ignora espacios sueltos).
- Mapa de turnos (igual que antes): Breakfast, Housekeeping, Laundry, Cottages, Maintenance, Special Task, Onboarding, Arrive. Variantes con número (`Maintenance 2`) se normalizan al template base. `Departure :´(`  → skip. `Off` → shift sin template.

## Fuera de alcance

- Próxima semana (25-31 MAY): no se puede migrar hasta que crees la pestaña. Una vez creada, abres el botón y la seleccionas.
- Sección Room Rota / Check-Ins / Family Dinners.
- Sync automático recurrente.
