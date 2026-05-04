# Runbook operativo — Huellitas API

Documentación operativa para incidentes, base de datos y despliegue. Mantener actualizado cuando cambien proveedor o planes.

---

## BE-022 — Copias de seguridad Neon y restauración (PITR)

### Contexto

Neon combina **historial de restauración (restore window)** con **instant restore / point-in-time restore (PITR)** y, según plan y consola, **snapshots** (manual o programados en planes de pago). La fuente de verdad es la documentación oficial:

- [Backup & restore](https://neon.tech/docs/guides/backup-restore)
- [Restore window](https://neon.tech/docs/introduction/restore-window)
- [Instant restore / ramas raíz](https://neon.tech/docs/introduction/branch-restore)
- [CLI `branches restore`](https://neon.tech/docs/reference/cli-branches#restore)

### 1. Verificar que los backups / PITR están activos

1. Entra en [Neon Console](https://console.neon.tech) → proyecto **Huellitas** (o el nombre real).
2. Revisa el plan del proyecto (**Settings** / facturación): el **restore window** (ventana de historial para PITR) y los límites de **snapshots** dependen del plan.
3. Abre **Backup & restore** (en la consola puede aparecer como vista mejorada “Enhanced”; si no, la página de **Restore** / historial de la rama).
4. Confirma que puedes:
   - Ver el selector de **fecha y hora** dentro de la ventana de restauración del proyecto.
   - (Si aplica al plan) Ver o configurar **snapshots programados** en planes de pago (no disponible en todos los planes; ver notas en la [guía de backup](https://neon.tech/docs/guides/backup-restore)).

**Nota:** Neon no expone un “toggle” único de “auto-backups on/off” como un VPS clásico: la recuperación se basa en el **historial dentro del restore window** y en **snapshots** según producto/plan. Lo que debe quedar **verificado** es: plan adecuado, ventana de restauración suficiente para el RTO/RPO del negocio, y que el equipo sabe usar la consola/CLI de restore.

### 2. Retención (qué documentar y revisar cada trimestre)

| Concepto           | Qué revisar                                                                                                                                                                                                                                        |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Restore window** | Duración máxima hacia atrás desde la que se puede hacer PITR en una rama raíz. Depende del **plan de Neon**; valores típicos van de **1 a 30 días** según documentación de “restore window”. Comprueba el valor actual en la consola del proyecto. |
| **Snapshots**      | Límites: p. ej. manual snapshot count según plan (la doc indica diferencias Free vs paid). Los snapshots programados en paid tienen reglas propias.                                                                                                |
| **Cumplimiento**   | Si el negocio exige retención > ventana Neon, añadir **export periódico** (`pg_dump` / snapshot lógico) a almacenamiento externo (S3, etc.) fuera de este runbook mínimo.                                                                          |

Enlace: [Restore window (Neon)](https://neon.tech/docs/introduction/restore-window).

### 3. Procedimiento: restauración point-in-time (consola)

**Importante:** el **instant restore** a un instante anterior en el **historial de la misma rama raíz** está pensado para ramas **raíz** (p. ej. `production`). Las ramas hijas tienen reglas distintas; consulta la doc antes de actuar sobre `main`/`production`.

1. Neon Console → proyecto → **Branches** → selecciona la rama **raíz** a restaurar (p. ej. `production`).
2. **Backup & restore** → **Instantly restore** (o flujo equivalente en la UI actual).
3. Elige **fecha y hora** (RFC 3339 mental: hora UTC) **dentro** del restore window.
4. Opcional: **Preview data** (tablas, consultas de solo lectura, diff de esquema) para validar el punto elegido.
5. Confirma **Restore**. Neon suele crear una **rama de respaldo** con el estado anterior (nombre tipo `…_old_…`) para poder revertir la operación; localízala en **Branches**.

### 4. Procedimiento: restauración con Neon CLI (opcional)

Requiere API key / CLI configurada. Ejemplo orientativo (ajusta nombres de rama y timestamp):

```bash
neon branches restore <rama_destino> ^self@2025-01-15T12:00:00Z --preserve-under-name <rama_backup_previo>
```

Documentación: [Neon CLI — branches restore](https://neon.tech/docs/reference/cli-branches#restore).

### 5. Prueba de restauración (rama de test / dev) — obligatoria al menos una vez

Objetivo: demostrar que el equipo puede restaurar **sin tocar producción**.

**Opción A — Restaurar solo una rama de desarrollo a un instante pasado**

1. Crea o usa una rama **no productiva** (p. ej. `restore-test`) creada desde `development` o desde `production` en un momento conocido.
2. En esa rama, inserta un registro de prueba identificable (p. ej. fila en una tabla de test).
3. Anota el tiempo \(T1\) (UTC).
4. Espera unos minutos; inserta otro cambio (tiempo \(T2\)).
5. En **Backup & restore**, restaura la rama `restore-test` al instante **entre T1 y T2** (o justo después de T1).
6. Verifica que los datos coinciden con el estado esperado y que existe rama/backup `_old_` si la UI lo indica.
7. Documenta en un ticket interno: fecha, operador, rama, timestamp usado, resultado (OK/FAIL).

**Opción B — Nueva rama desde un punto en el tiempo (workflow “branch from history”)**

Si la consola permite crear una rama nueva anclada a un timestamp del historial de otra rama, úsala para clonar estado en `restore-verify-YYYYMMDD` y conectar una `DATABASE_URL` de **solo lectura** o entorno aislado para validar datos. (Los nombres exactos del asistente pueden variar; seguir la UI y la doc de **Branching**.)

### 6. Post-restore en producción (checklist)

- [ ] `DATABASE_URL` en Railway (u otro host) apunta a la rama correcta si cambiaste de rama.
- [ ] Migraciones: Neon restaura **datos + esquema** al punto elegido; valida que el código desplegado sea compatible con ese esquema.
- [ ] `curl https://api.huellitas.app/health` → `200` y `"status":"ok"` (o staging primero).
- [ ] Smoke test: login, un endpoint crítico, cola/jobs si existen.

### 7. Alertas ante fallos de backup / disponibilidad

Neon no siempre ofrece un correo único “backup failed” como en servidores con `pg_dump` cron. Configura **defensa en profundidad**:

1. **Neon**
   - Revisa en la consola si hay **notificaciones**, **estado del proyecto** o integraciones (según plan: soporte, facturación, límites de almacenamiento).
   - Suscríbete a actualizaciones del [Neon status](https://neonstatus.com/) o página de estado que use tu organización.

2. **Snapshots programados (si el plan los tiene)**
   - Tras configurar un schedule, revisa periódicamente que las ejecuciones aparezcan en la UI de **Backup & restore**.

3. **Monitor externo (recomendado)**
   - Alertas si `GET /health` deja de ser `200` o si la latencia de DB supera umbral (herramientas tipo UptimeRobot, Checkly, Datadog, etc.).
   - Opcional: job diario que ejecute `SELECT 1` contra `DATABASE_URL` de producción desde un runner seguro y notifique a Slack.

4. **Organización**
   - Definir en Slack un canal `#alerts-db` y webhook para estos monitores.

### 8. Contactos y enlaces rápidos

| Recurso                  | URL / acción                                       |
| ------------------------ | -------------------------------------------------- |
| Neon Console             | https://console.neon.tech                          |
| Doc backup & restore     | https://neon.tech/docs/guides/backup-restore       |
| Doc restore window       | https://neon.tech/docs/introduction/restore-window |
| Despliegue API (Railway) | Ver `docs/deployment-railway-production.md`        |

---

## BE-023 — Monitorización de producción (Sentry, uptime, baselines)

### 1. Sentry: alertas por errores (email / Slack)

**Requisitos:** `SENTRY_DSN` configurado en Railway (producción). El backend ya inicializa Sentry en `src/config/sentry.ts` (`sendDefaultPii: false`, `tracesSampleRate: 0.1`).

1. [Sentry](https://sentry.io) → organización → proyecto **Huellitas API** (o el nombre real) → entorno **production**.
2. **Settings → Alerts** (o **Issues → Create Alert** según UI):
   - Crear regla tipo **Issues** / **errors**: disparar cuando haya **nuevo issue** o **regresión**, con filtro `environment:production` y severidad razonable (p. ej. alertar en la **primera aparición** de un error no visto o cuando el volumen supere umbral).
3. **Destinos de notificación:**
   - **Email:** **Settings → Notifications** (usuario) y/o **Team notifications**; añadir el correo del **on-call**.
   - **Slack:** **Settings → Integrations → Slack** → instalar en workspace → en la regla de alerta elegir acción **Send a Slack notification** al canal `#alerts-api` (o el acordado).
4. Revisar **Issue grouping** y **Inbound filters** (opcional) para ignorar ruido conocido sin ocultar fallos reales.
5. **Prueba:** desde staging o un entorno de prueba, provoca un error controlado (endpoint de test que lance) y confirma que llega alerta a email/Slack.

Documentación: [Sentry — Alerts](https://docs.sentry.io/product/alerts/), [Slack](https://docs.sentry.io/product/integrations/notification-incidents/slack/).

### 2. UptimeRobot: `GET /health` cada 5 minutos + email ante caída

**Plan free:** permite intervalos de comprobación de **5 minutos** en monitores HTTP(S) (adecuado para este criterio).

1. Cuenta en [UptimeRobot](https://uptimerobot.com) → **Add New Monitor**.
2. Tipo: **HTTPS** (o HTTP si solo tuvierais HTTP).
3. **Friendly name:** `Huellitas API — production health`.
4. **URL:** `https://api.huellitas.app/health`
5. **Monitoring interval:** **5 minutes**.
6. Criterio de “up” (según lo que permita el monitor):
   - Esperado: código HTTP **200** y cuerpo JSON con `"status":"ok"` cuando la base responde. Si UptimeRobot en free solo comprueba status code, deja **200** como umbral y revisa ocasionalmente el cuerpo con `curl` manual o un segundo monitor “keyword” si el plan lo permite (palabra clave `ok` en el body).
7. **Alert contacts:** añade **email** del on-call (y SMS/push si lo tenéis contratado).
8. Opcional: segundo monitor contra `https://api.huellitas.app/` (info API) con menor prioridad.

### 3. Baseline de rendimiento (p95) con `autocannon`

Medir desde una máquina de confianza (no commitear tokens). Instalación puntual sin fijar dependencia en el repo:

```bash
npx --yes autocannon@7 -c 10 -d 30 -m GET https://api.huellitas.app/health
```

Para endpoints que requieran auth, pasar cabecera (sustituir token y URL):

```bash
npx --yes autocannon@7 -c 10 -d 30 -m GET -H "Authorization: Bearer <JWT>" "https://api.huellitas.app/api/v1/users/me"
```

Interpretación: al final del informe, anotar **p95** (y opcionalmente p99 / mean) de **latency** y **requests/sec**. Repetir en ventana de bajo tráfico y documentar fecha/hora UTC.

#### Tabla de baseline (rellenar tras cada medición trimestral o post-release mayor)

| Endpoint                      | Método | Concurrencia / duración       | p95 latencia (ms) | RPS | Fecha (UTC) | Notas |
| ----------------------------- | ------ | ----------------------------- | ----------------- | --- | ----------- | ----- |
| `/health`                     | GET    | `-c 10 -d 30`                 |                   |     |             |       |
| `/api/v1/users/me`            | GET    | idem + Bearer                 |                   |     |             |       |
| `/api/v1/lost-reports/nearby` | GET    | idem + query `lat,lng,radius` |                   |     |             |       |

Si el p95 **empeora de forma sostenida** (>2× respecto al baseline sin cambio funcional esperado): revisar Neon (plan, conexiones), Railway (CPU/mem), índices PostGIS y logs de queries lentas (`DB_SLOW_QUERY_MS` en la API).

### 4. Runbook: caída del health check (UptimeRobot / usuarios)

**Síntoma:** monitor en rojo, `GET /health` ≠ 200 o timeout; usuarios reportan API caída.

1. **Confirmar** desde fuera: `curl -i https://api.huellitas.app/health` (y si aplica `https://api.huellitas.app/`).
2. **Railway:** servicio → **Deployments / Logs** — ¿restarts en bucle? ¿OOM? ¿error al arrancar (`Invalid environment variables`)?
3. **Neon:** consola → estado del proyecto / conectividad — si `/health` devuelve **503** con `"status":"degraded"`, el proceso Node está vivo pero **no conecta a la base** → revisar `DATABASE_URL`, límites de conexión, incidente Neon.
4. **Mitigación rápida:** si un despliegue reciente rompió el arranque → **rollback** al despliegue anterior (ver `docs/deployment-railway-production.md`).
5. **Comunicación:** mensaje en Slack al canal de incidentes; abrir ticket con timeline y enlaces a logs/Sentry.
6. **Post-incidente:** actualizar esta tabla de baseline si el tráfico o la infra cambiaron; añadir entrada en la tabla de cambios al final de este documento.

### 5. Runbook: pico de alertas en Sentry

**Síntoma:** muchos issues nuevos o un issue con event count muy alto en pocos minutos.

1. Abrir el **issue** principal en Sentry → revisar **stack trace**, `release`, `environment`, tags (`requestId`, `userId` si existen).
2. **Clasificar:**
   - **Despliegue reciente:** correlacionar con hora del deploy en Railway → considerar rollback.
   - **Dependencia externa:** Neon, R2, FCM, Google OAuth → revisar status pages y latencias.
   - **Ataque / abuso:** picos 429, IPs repetidas → revisar rate limits y WAF/proxy si existiera.
3. **Silenciar con criterio:** usar **mute** o ajustar la regla solo tras identificar ruido benigno (no silenciar sin causa).
4. **Corregir:** PR hotfix → merge a `main` → deploy; verificar caída de volumen en Sentry en las siguientes horas.
5. Si hay **PII o secretos** en el evento: rotar credenciales y revisar qué se envía a Sentry (el proyecto usa `sendDefaultPii: false`; no registrar cuerpos completos en breadcrumbs).

### 6. Enlaces útiles

| Recurso          | URL                                    |
| ---------------- | -------------------------------------- |
| Sentry           | https://sentry.io                      |
| UptimeRobot      | https://uptimerobot.com                |
| autocannon (npm) | https://github.com/mcollina/autocannon |

---

## Cambios en este documento

| Fecha      | Cambio                                                                              |
| ---------- | ----------------------------------------------------------------------------------- |
| (rellenar) | BE-022: sección Neon backups + PITR + prueba en rama + alertas                      |
| (rellenar) | BE-023: Sentry + UptimeRobot + baselines autocannon + runbook health / Sentry spike |
