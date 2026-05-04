# BE-021 — Despliegue en producción (Railway)

**Riesgo:** alto. Desplegar a producción solo cuando **staging** lleve al menos **24 h** estable y las pruebas de humo pasen.

Este documento describe Railway como plataforma recomendada. La API ya expone `GET /health` (raíz del servicio, no bajo `/api/v1`).

## Resumen de criterios

| Criterio                            | Cómo se cumple                                                                                                            |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Railway (o Render)                  | Cuenta Railway + servicio conectado al repo GitHub                                                                        |
| Variables de producción             | Dashboard del servicio → **Variables** (no commitear secretos)                                                            |
| Dominio `api.huellitas.app` + HTTPS | Dominio personalizado en Railway + DNS en tu proveedor; certificado gestionado por Railway                                |
| Neon producción                     | `DATABASE_URL` = connection string del **branch** de producción en Neon                                                   |
| Auto-deploy en `push` a `main`      | Railway → **Settings** → despliegue desde rama `main` (o el flujo CI que dispare deploy)                                  |
| Health check                        | `healthcheckPath = "/health"` en `railway.toml` (validación en **despliegue**). Ver nota sobre pings periódicos más abajo |
| Zero-downtime                       | Railway realiza rollout comprobando el healthcheck antes de cortar tráfico al despliegue anterior                         |
| Logs                                | Railway → pestaña **Observability** / logs del servicio                                                                   |
| Rollback                            | Ver sección [Rollback](#rollback)                                                                                         |

## 1. Crear proyecto y servicio en Railway

1. Crea cuenta en [Railway](https://railway.app) y **New Project** → **Deploy from GitHub repo**.
2. Selecciona el repositorio `huellitas-api` (o el nombre real del monorepo).
3. Si el código está en subcarpeta, en Railway indica **Root Directory** = carpeta del API (p. ej. `huellitas-api`).
4. Railway detectará el `Dockerfile` gracias a `railway.toml` (`builder = DOCKERFILE`).

**Build / Start:** el contenedor ejecuta `node dist/index.js` (ver `Dockerfile` y `CMD`). Railway inyecta `PORT`; la app ya usa `process.env.PORT`.

## 2. Variables de entorno (producción)

Configúralas en **Variables** del servicio (valores reales, nunca en el repo).

Obligatorias / habituales (alineadas con `src/config/env.ts`):

| Variable                                    | Descripción                                                                                                                  |
| ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `NODE_ENV`                                  | `production`                                                                                                                 |
| `PORT`                                      | Suele inyectarlo Railway; si no, `3000`                                                                                      |
| `API_URL`                                   | URL pública base, p. ej. `https://api.huellitas.app`                                                                         |
| `DATABASE_URL`                              | URL de Neon — **rama de producción** (pooler recomendado si Neon lo ofrece)                                                  |
| `BETTER_AUTH_SECRET`                        | Secreto ≥ 32 caracteres (rotar si se filtra)                                                                                 |
| `BETTER_AUTH_URL`                           | URL pública de la API para auth, p. ej. `https://api.huellitas.app`                                                          |
| `TRUSTED_ORIGINS`                           | Orígenes permitidos (Better Auth / callbacks), separados por coma: web, staging, `https://api.huellitas.app` si aplica, etc. |
| `EXPO_APP_SCHEME`                           | Scheme de la app (p. ej. `huellitas`)                                                                                        |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | OAuth Google en producción                                                                                                   |
| `FIREBASE_*`                                | FCM en producción (`FIREBASE_PRIVATE_KEY` con saltos de línea reales en el dashboard)                                        |
| `R2_*` / `R2_PUBLIC_URL`                    | Cloudflare R2 producción                                                                                                     |
| `SENTRY_DSN`                                | Opcional; errores en producción                                                                                              |

Tras guardar variables, redeploy para que el contenedor las lea.

## 3. Dominio personalizado y HTTPS

1. En el servicio → **Settings** → **Networking** → **Custom Domain** → añade `api.huellitas.app`.
2. En tu DNS (Cloudflare, etc.) crea el registro que indique Railway (normalmente **CNAME** al target `*.up.railway.app` o el que muestre el panel).
3. Espera propagación DNS; Railway provisiona **HTTPS** (Let’s Encrypt) automáticamente.

## 4. Health check

- **Despliegue (Railway):** `railway.toml` define `healthcheckPath = "/health"`. Railway enviará peticiones durante el rollout hasta obtener **HTTP 200** (si la base responde, el JSON incluye `"status":"ok"`).
- **Probes cada 30 s en runtime:** el comportamiento exacto depende del plan y producto de Railway. Si necesitas un intervalo fijo de 30 s contra producción, suele usarse un **monitor externo** (p. ej. UptimeRobot, Checkly, Grafana Synthetic) apuntando a `https://api.huellitas.app/health`.

Prueba manual:

```bash
curl -fsS "https://api.huellitas.app/health"
```

Debe responder **200** y JSON con `"status":"ok"` cuando la base de datos esté accesible (si Neon cae, la API puede responder **503** con `"status":"degraded"` — es esperado).

## 5. Auto-deploy en `push` a `main`

En Railway: conecta el repo y deja la rama de despliegue en **`main`** (cada push dispara build + deploy). Opcional: enlaza con el job de **staging** del CI hasta validar el flujo.

## 6. Notificaciones (Slack / email)

- Railway: revisa **Project Settings** → integraciones / webhooks / notificaciones (según UI actual).
- Alternativa: webhook de GitHub en el repo (Actions o Deployments) hacia Slack.

## Rollback

1. Abre el proyecto en Railway → servicio **Deployments**.
2. Localiza un despliegue **previo** estable (commit / fecha).
3. Usa la acción **Rollback** o **Redeploy** de esa revisión (según la UI: “Rollback to this deployment”).
4. Verifica `GET /health` y un flujo crítico (login, un endpoint autenticado).

No hace falta tocar DNS; solo cambia la revisión en ejecución.

## Checklist post-deploy

- [ ] `curl https://api.huellitas.app/health` → 200 y `status: ok` (con DB arriba)
- [ ] Login / OAuth contra dominio de producción
- [ ] Subida a R2 (si aplica)
- [ ] Logs sin secretos (passwords, keys)
- [ ] Sentry recibe eventos (si está configurado)

## Referencias

- [Railway — Config as code](https://docs.railway.app/deploy/config-as-code)
- [Railway — Healthchecks](https://docs.railway.app/deploy/healthchecks)
- [Neon — Branches y connection strings](https://neon.tech/docs)
