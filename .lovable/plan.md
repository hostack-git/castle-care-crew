
## Estado actual de la pantalla de Rota

`/app/admin/rota` **ya existe y funciona** como un Google Sheet:

- Grid voluntarios (filas) × 7 días (columnas), navegable por semana.
- Cada celda es un dropdown con todos los `shift_templates` (Breakfast, Housekeeping, Cottages, Laundry, Maintenance, Special task, Onboarding, etc.) + "Off" + vacío.
- Colores por tipo de turno (igual que tu Sheet).
- Botón **Guardar semana** hace upsert/delete masivo de todos los cambios en la tabla `shifts` del backend Hostack.
- Botones "Semana anterior / Hoy / Semana siguiente".

Lo que **no** tiene todavía (existe en tu Sheet pero no en la pantalla):
- Sección **Room Rota** (Suite, East 1/2, Schoolroom, Riverview, Lochside, Corry, Gardeners, Stables) con estados To Clean / Check In / Staying / Free / Maintenance.
- Fila **Check-Ins** (responsable por día).
- Fila **Family Dinners** (pareja por día).

Esos tres bloques quedan **fuera de scope** de esta tarea (los abordamos en una segunda iteración si quieres). Esta tarea importa solo voluntarios + turnos, que es lo que pediste.

## Datos detectados en la hoja (semana del 18 may 2026, lun→dom)

**Voluntarios (16):** Pepe, Miguel, Nadia, Thais, Helena, Eva, Charlie, River, Molly, Lotte, Izzy, Blanche, Mike, Alexa, Roxana, Jorge.

**Tipos de turno usados:** Breakfast, Housekeeping, Laundry, Cottages, Maintenance, Special task, Onboarding, Arrive, Off, y una nota suelta "Departure :´(" para Nadia y Thais el miércoles (lo trato como `Off` + nota, porque "Departure" no es un turno operativo).

**Casos especiales detectados:**
- Nadia y Thais solo trabajan lun y mar; mié = Departure; jue–dom = vacío.
- Alexa empieza el jueves (Arrive); lun–mié = vacío.
- Celdas vacías = `– vacío` (no se inserta nada).

## Implementación

### 1. Script de migración (server function admin-only)
`src/lib/rota-import.functions.ts` — `importRotaFromCsv`:
- Recibe el CSV/JSON parseado de la semana (lo paso hardcodeado en este primer run para la semana del 18 may; la función queda lista para reusar).
- Protegida con `requireSupabaseAuth` + check `is_admin`.
- Usa `HOSTACK_SERVICE_ROLE_KEY` (ya existe como secreto) para escribir en Hostack saltándose RLS.
- Lógica:
  1. Carga `volunteers` activos y `shift_templates` de Hostack para la propiedad Torridonia.
  2. Para cada nombre del CSV, hace match por `name` (case-insensitive, trim). Si no existe, lo **crea** (`status='active'`, `property_id=TORRIDONIA_PROPERTY_ID`, `role_type` derivado del turno más frecuente).
  3. Para cada turno del CSV, busca el `shift_template` por nombre (con alias: "Special task" → template "Special Task", "Arrive" → "Arrival" si existe, "Onboarding", etc.). Si no existe, lo crea con `start_time/end_time` por defecto.
  4. Para cada celda (volunteer × día), hace upsert en `shifts` (clave `property_id+volunteer_id+shift_date`). "Off" = `shift_template_id=null, status='scheduled'`. Vacío = no toca.
  5. Devuelve resumen: voluntarios creados/encontrados, templates creados/encontrados, shifts insertados/actualizados.

### 2. Botón "Importar desde Sheet" en /app/admin/rota
Pequeño botón en el header (solo visible para admin) que llama a la server function y muestra el resultado en un toast + un dialog con el resumen. Idempotente: re-ejecutarlo no duplica nada.

### 3. Ejecución
Disparo la importación una vez al terminar la build, para la semana del 18 may. Te confirmo en chat el resumen exacto (cuántos voluntarios nuevos, cuántos shifts).

### Próxima semana (25 may)
La hoja solo expone una pestaña pública en este momento. Cuando publiques la próxima semana en el Sheet (o me digas el `gid`), corro el mismo botón apuntando a la nueva pestaña — sin cambios de código.

## Fuera de scope (para una segunda iteración, si confirmas)

- Sección Room Rota + Check-Ins + Family Dinners en la misma pantalla.
- Generación automática de `tasks` a partir del Room Rota (la migración SQL `weekly_rotas`/`rota_room_cells` ya está en la base por si lo quieres aprovechar después).
- Importación recurrente desde Google Sheets vía conector (requiere arreglar el acceso del conector de Google Sheets al proyecto).
