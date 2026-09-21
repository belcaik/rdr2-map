# Despliegue LAN de RDR2 Map

Esta guía instala RDR2 Map como una aplicación separada en un homeserver. Una
imagen sirve la SPA, la API y los medios desde el mismo origen; SQLite y los
medios viven en un volumen persistente. El scraper y los datos extraídos no
forman parte de la imagen. La instalación predeterminada usa el alias SSH
`baphomet`, Podman rootless, `apps/rdr2-map`, el puerto LAN `8081` y el proyecto
Compose `rdr2-map`.

La aplicación no tiene autenticación. Expón el puerto solo a una LAN de
confianza y aplica las reglas de firewall del homeserver. El alias `baphomet`
es del cliente SSH: el teléfono debe usar una IP LAN o un DNS local estable.

## Criterios verificables

Una instalación está lista cuando se cumplen todos estos puntos:

1. El preflight confirma el servidor correcto, Podman sin `sudo`, Compose,
   `rsync`, `Linger` y espacio suficiente; no se reinicia el homeserver.
2. `docker compose ... config` o `podman-compose ... config` valida el proyecto
   y muestra un solo puerto publicado, `rdr2-map`, la imagen elegida y `/data`.
3. La imagen arranca como usuario no root, `/api/health` devuelve 200 y el
   healthcheck real del motor aparece `healthy`.
4. La importación de un dataset RDR2 deja iconos, fotos y tiles locales
   disponibles; una segunda importación conserva el progreso existente.
5. La UI, un recurso estático, un medio, `/api/health` y una ruta inexistente
   se comprueban desde la LAN. La ruta inexistente devuelve 404 y no HTML de la
   SPA.
6. Recrear el contenedor y reiniciar la unidad de usuario no pierde DB, medios
   ni progreso. Se registra la diferencia entre reiniciar la unidad y reiniciar
   el servidor.

## Parámetros

Copiar el ejemplo y editarlo localmente:

```bash
cp .env.docker.example .env.docker
```

`.env.docker` está ignorado por Git. Mantener estos valores separados de los de
GTA:

| Variable | Valor inicial | Uso |
| --- | --- | --- |
| `SSH_HOST` | `baphomet` | Alias SSH del homeserver |
| `DEPLOY_DIR` | `apps/rdr2-map` | Ruta relativa al home remoto |
| `CONTAINER_ENGINE` | `podman` | `docker` también está soportado |
| `COMPOSE_PROJECT_NAME` | `rdr2-map` | Nombre aislado del proyecto |
| `MAP_IMAGE` | `localhost/rdr2-map:local` | Durante la prueba con tar; después una etiqueta GHCR completa |
| `BIND_HOST` | `0.0.0.0` | Interfaz publicada; restringirla si procede |
| `HTTP_PORT` | `8081` | Puerto LAN, libre de GTA (`8080`) |
| `SERVER_DATA_DIR` | `./data` | DB y medios persistentes |
| `ENV_FILE` | `.env.docker` | Configuración local ignorada por Git |
| `DATASET_DIR` | vacío | Dataset local opcional para importar |

`SSH_HOST`, `DEPLOY_DIR`, `CONTAINER_ENGINE`, `ENV_FILE` y `DATASET_DIR` son
variables del script. El archivo `.env.docker` contiene exactamente las cinco
claves del ejemplo, con valores literales `KEY=value` sin comillas,
interpolación ni comandos. `SERVER_DATA_DIR` debe ser una ruta relativa segura
bajo `DEPLOY_DIR`, distinta de `import/`; no se aceptan segmentos `..`.
El script exige dependencias antes de crear carpetas; instalar `rsync` normalmente
en el cliente y servidor si falta. No depende de copiar binarios entre equipos.

El contenedor escucha en `3001`. La aplicación usa `HOST=0.0.0.0`,
`PORT=3001`, `DATA_ROOT=/data`, `DB_PATH=/data/rdr2.db` y las rutas de assets
configuradas por Compose. Cambiar `HTTP_PORT` no requiere recompilar la imagen.
El frontend usa URLs relativas, por lo que ningún cliente configura un host API.

Antes de transferir, verificar la configuración renderizada:

```bash
docker compose --env-file .env.docker -f compose.yaml config
podman-compose --env-file .env.docker -f compose.yaml -f compose.podman.yaml config
```

## Preflight SSH y servidor

Ejecutar estas comprobaciones de solo lectura. La clave SSH debe estar ya
verificada; se conserva `StrictHostKeyChecking=yes` y `BatchMode`:

```bash
command -v ssh scp rsync
ssh -o BatchMode=yes -o StrictHostKeyChecking=yes -o ConnectTimeout=10 baphomet \
  'uname -m; podman --version; podman-compose --version; command -v rsync'
ssh -o BatchMode=yes -o StrictHostKeyChecking=yes baphomet \
  'podman info; podman ps; ss -ltn; df -h /home'
ssh -o BatchMode=yes -o StrictHostKeyChecking=yes baphomet \
  'loginctl show-user "$USER" -p Linger; systemctl --user show-environment'
```

Confirmar que `8081` no está escuchando y que hay espacio para la imagen, el
dataset y los medios importados. Si `Linger=no`, un administrador debe ejecutar
una vez `loginctl enable-linger USUARIO_SSH`; no se solicita una contraseña por
SSH. El disco cifrado del servidor todavía requiere desbloqueo manual después
de un apagado: linger no sustituye ese paso.

La clave no se reemplaza ante `Host key verification failed`. Comparar la
huella por un canal confiable y registrar la clave de forma interactiva antes
de volver a ejecutar el script.

## Construcción local y primer despliegue

La ruta local permite probar sin esperar a GHCR. Usar un dataset sintético o
una extracción RDR2 validada; no incluir DB personal, credenciales ni medios en
Git. La imagen debe contener exactamente la etiqueta escrita en `.env.docker`:

```bash
cp .env.docker.example .env.docker
# MAP_IMAGE=localhost/rdr2-map:local, HTTP_PORT=8081, SERVER_DATA_DIR=./data
docker build -t localhost/rdr2-map:local .
docker save -o /tmp/rdr2-map.tar localhost/rdr2-map:local

SSH_HOST=baphomet DEPLOY_DIR=apps/rdr2-map CONTAINER_ENGINE=podman \
  ./scripts/deploy.sh --dry-run --image-archive /tmp/rdr2-map.tar \
  --dataset /ruta/al/dataset-rdr2
SSH_HOST=baphomet DEPLOY_DIR=apps/rdr2-map CONTAINER_ENGINE=podman \
  ./scripts/deploy.sh --image-archive /tmp/rdr2-map.tar \
  --dataset /ruta/al/dataset-rdr2
```

`--dry-run` no conecta ni modifica archivos; debe indicar explícitamente que es
una simulación. El script valida `SSH_HOST`, `DEPLOY_DIR`, `ENV_FILE`,
`CONTAINER_ENGINE` y `DATASET_DIR`, copia Compose y la configuración, transfiere
el manifiesto y sus medios con rutas relativas sin `--delete`, carga el tar,
importa antes de iniciar y espera la salud real del contenedor. Excluye DB,
WAL y SHM del dataset transferido para no copiar una SQLite viva.

Para actualizar sin datos nuevos, omitir `--dataset`. Mientras la imagen sea
local, conservar `--image-archive`; sin él, el script intentará `pull`.
`--help` documenta todas las opciones. La importación compilada es:

```bash
node /app/backend/dist/backend/src/db/import.js \
  /import/dataset.json --db /data/rdr2.db --data-root /data
```

El importer valida el dataset y los medios antes de mutar SQLite y hace upsert:
los puntos ausentes de una captura parcial siguen activos y el progreso no se
reinicia. Migrar una DB existente exige una copia consistente mediante SQLite,
con la aplicación detenida; nunca copiar solo una DB viva con `scp` o `rsync`.

Los tiles existentes se administran aparte: el importer importa iconos y fotos,
pero no instala tiles. Desde el checkout local, después de crear la instalación:

```bash
rsync -a -e 'ssh -o BatchMode=yes -o StrictHostKeyChecking=yes -o ConnectTimeout=10' \
  rdr2_extractor/data/tiles/ baphomet:apps/rdr2-map/data/tiles/
```

Adaptar el destino si cambian `DEPLOY_DIR` o `SERVER_DATA_DIR`. No usar
`--delete`; `TILES_DIR=/data/tiles` conserva la disposición `zoom_Z/X_Y.jpg`.
El dataset transferido contiene solo `dataset.json`, `icons/`, `images/` y
`tiles/` si existen; las capturas y DB se excluyen. Un directorio `tiles/` bajo
`import/` no sustituye la copia al directorio persistente.

## Operación Podman y Docker

Podman rootless usa el override que conserva el UID/GID del usuario SSH:

```bash
podman-compose --env-file .env.docker -f compose.yaml -f compose.podman.yaml \
  up -d --force-recreate map
podman-compose --env-file .env.docker -f compose.yaml -f compose.podman.yaml ps
podman-compose --env-file .env.docker -f compose.yaml -f compose.podman.yaml \
  logs --tail=100 map
```

`podman-compose` 1.0.6 requiere esperar el healthcheck del motor; un `curl`
manual por sí solo no acredita que la configuración del healthcheck funcione.
El script hace hasta 30 comprobaciones de `podman healthcheck run` con pausa
acotada. Docker Compose usa `up -d --wait --wait-timeout 120`:

```bash
docker compose --env-file .env.docker up -d --wait --wait-timeout 120
docker compose --env-file .env.docker ps
```

En ambos motores el proceso es no root, el volumen `/data` debe ser escribible
por UID 1000 y `restart: unless-stopped` protege el proceso del contenedor.
En Podman, `keep-id:uid=1000,gid=1000` mantiene la propiedad del usuario SSH
sin `chown` recursivo; véase [Podman 4.9.3](https://docs.podman.io/en/v4.9.3/markdown/podman-run.1.html).
En Docker el script prepara `/data` como root para UID 1000 y luego ejecuta el
servicio como `node`; `import/` conserva su dueño SSH. Si se opera Compose
manualmente en Docker, preparar antes el volumen:

```bash
mkdir -p data
docker compose --env-file .env.docker run --rm -T --user 0 map \
  sh -c 'chown -R 1000:1000 /data'
```

No ejecutar `system prune`, `down -v` ni limpiezas globales.

## Unidad de usuario y reinicio

El despliegue instala `map-apps-rdr2-map.service` bajo
`~/.config/systemd/user/`, con `WorkingDirectory=%h/apps/rdr2-map` y
`podman-compose ... up -d map`. Comprobar ambos estados:

```bash
systemctl --user is-enabled map-apps-rdr2-map.service
systemctl --user is-active map-apps-rdr2-map.service
systemctl --user status map-apps-rdr2-map.service --no-pager
# Reiniciar solo RDR2 para la prueba de persistencia:
systemctl --user restart map-apps-rdr2-map.service
podman-compose --env-file .env.docker -f compose.yaml -f compose.podman.yaml ps
```

La unidad `Type=oneshot` no monitoriza la salud continuamente; el contenedor
conserva su política de reinicio. Para probar persistencia, marcar un punto,
reiniciar solo la unidad, comprobar `/api/health` y el punto, recrear el
contenedor y comprobar de nuevo. Esto no equivale a probar un reinicio del
homeserver.

## GHCR sin coste en la configuración actual

El repositorio debe ser público para esta estrategia. CI se omite si el
repositorio es privado. En un PR se construye y verifica sin login ni push; un
push a `main` o una ejecución manual autorizada desde la rama por defecto puede
publicar `ghcr.io/<owner>/<repo>:latest` y
`ghcr.io/<owner>/<repo>:sha-<SHA completo>`. La referencia se normaliza a
minúsculas. Los workflows usan runners estándar `ubuntu-24.04`, sin artifacts ni
caches de Actions, y el job publicador es el único con `packages: write`.

Por defecto se publica `linux/amd64`. La ejecución manual puede solicitar
`linux/amd64,linux/arm64`; una publicación automática posterior vuelve a AMD64,
por lo que un homeserver ARM debe repetir la ejecución multi-arquitectura o
definir una política estable antes de actualizar.

Tras autorizar la publicación:

1. Abrir el PR y revisar CI y el build de imagen.
2. Integrar en `main` o ejecutar manualmente desde `main`.
3. En GitHub Packages, cambiar el paquete a **Public** si GHCR lo creó privado.
4. Verificar pull anónimo con un `DOCKER_CONFIG` temporal vacío y la etiqueta
   SHA completa.
5. Fijar esa referencia en `.env.docker`; para identidad estricta, usar el
   digest publicado en vez de una etiqueta mutable.

Política comprobada el 2026-09-21: los runners estándar son gratuitos para
repositorios públicos y el almacenamiento/tráfico de GHCR es actualmente gratuito.
Las acciones están fijadas a commits comprobados en sus repositorios oficiales;
Buildx, QEMU y setup-node tienen sus caches automáticos desactivados, además de
`DOCKER_BUILD_RECORD_UPLOAD=false`. GitHub describe la facturación de [Actions](https://docs.github.com/en/billing/concepts/product-billing/github-actions)
y [Packages](https://docs.github.com/en/billing/concepts/product-billing/github-packages).
La política vigente y la gratuidad dependen de visibilidad, límites y cambios
futuros; esta guía no promete precios futuros. No se publican DB, capturas,
medios ni secretos.

## Backups, restauración y rollback

Detener la unidad antes del backup y conservar configuración e imagen además de
todo `SERVER_DATA_DIR`:

```bash
systemctl --user stop map-apps-rdr2-map.service
tar -C "$HOME/apps/rdr2-map" -czf /ruta/backup/rdr2-map-$(date +%Y%m%d-%H%M%S).tgz \
  data .env.docker compose.yaml compose.podman.yaml
systemctl --user start map-apps-rdr2-map.service
```

El archivo debe incluir `rdr2.db`, cualquier `rdr2.db-wal`/`rdr2.db-shm`,
iconos, fotos y tiles. Probar una restauración en otro directorio y con otro
`COMPOSE_PROJECT_NAME`, nunca sobre la instalación activa; comprobar salud,
medios y progreso antes de considerarla válida.

Para Docker, sustituir `systemctl --user stop/start` por
`docker compose --env-file .env.docker stop/start map`. Si cambió
`SERVER_DATA_DIR`, respaldar ese directorio, no asumir `data/`. Guardar también
`podman image inspect "$MAP_IMAGE"` (o `docker image inspect`) y conservar el tar
si la imagen solo existe localmente.

Ejemplo de restauración aislada en el servidor, manteniendo la instalación activa:

```bash
mkdir -p "$HOME/apps/rdr2-restore-check"
tar -xzf /ruta/backup/rdr2-map-FECHA.tgz -C "$HOME/apps/rdr2-restore-check"
cd "$HOME/apps/rdr2-restore-check"
# Editar la copia de .env.docker: COMPOSE_PROJECT_NAME=rdr2-restore-check,
# BIND_HOST=127.0.0.1 y HTTP_PORT=18081; conservar MAP_IMAGE y SERVER_DATA_DIR.
podman-compose --env-file .env.docker -f compose.yaml -f compose.podman.yaml up -d map
podman healthcheck run "$(podman-compose --env-file .env.docker -f compose.yaml -f compose.podman.yaml ps -q)"
curl -fsS http://127.0.0.1:18081/api/progress
# Comparar también el contenido de medios con el backup antes de retirar la prueba.
podman-compose --env-file .env.docker -f compose.yaml -f compose.podman.yaml stop map
```

Para rollback de código, cambiar `MAP_IMAGE` a la etiqueta SHA anterior y
ejecutar el despliegue sin `--dataset`. Si hubo cambios de esquema, restaurar
un backup compatible antes de arrancar. Un rollback de imagen no deshace una
importación de datos.

## Comprobación final

Desde un equipo de la LAN comprobar `http://IP_O_DNS_LOCAL:8081/` y:

```bash
curl -fsS http://IP_O_DNS_LOCAL:8081/api/health
curl -i http://IP_O_DNS_LOCAL:8081/assets/no-existe.js
curl -fsS http://IP_O_DNS_LOCAL:8081/api/markers/categories
```

Abrir la UI en escritorio y viewport móvil; verificar mapa, filtros, galería,
iconos, fotos y tiles. Revisar la consola del navegador y que no haya peticiones
externas inesperadas. Confirmar propietario/permisos de la DB y el healthcheck
real de Podman. Comprobar que GTA sigue en `8080` y saludable sin modificar sus
contenedores, datos ni marcas.
