#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
REPO_DIR="$(cd -- "$SCRIPT_DIR/.." && pwd -P)"
SSH_HOST="${SSH_HOST:-baphomet}"
DEPLOY_DIR="${DEPLOY_DIR:-apps/rdr2-map}"
ENV_FILE="${ENV_FILE:-.env.docker}"
DATASET_DIR="${DATASET_DIR:-}"
CONTAINER_ENGINE="${CONTAINER_ENGINE:-podman}"
IMAGE_ARCHIVE=""
DRY_RUN=0
readonly -a SSH_OPTIONS=(-o BatchMode=yes -o StrictHostKeyChecking=yes -o ConnectTimeout=10)

usage() {
  cat <<'HELP'
Usage: scripts/deploy.sh [--dry-run] [--dataset DIR] [--image-archive TAR]
Deploy RDR2 to a remote Docker or rootless Podman host.
Environment: SSH_HOST (baphomet), DEPLOY_DIR (apps/rdr2-map), ENV_FILE (.env.docker),
CONTAINER_ENGINE (podman or docker), DATASET_DIR (optional).
Dataset transfer never deletes remote files, excludes SQLite files, and import is an upsert.
HELP
}
die() { printf 'deploy: error: %s\n' "$*" >&2; exit 1; }
log() { printf 'deploy: %s\n' "$*"; }
shell_quote() { local value=${1-}; printf "'%s'" "${value//\'/\'\\\'\'}"; }
print_command() { local arg; printf 'deploy: dry-run:'; for arg in "$@"; do printf ' %s' "$(shell_quote "$arg")"; done; printf '\n'; }
run_command() { if ((DRY_RUN)); then print_command "$@"; else "$@"; fi; }
remote_command() {
  local command=$1
  if ((DRY_RUN)); then print_command ssh "${SSH_OPTIONS[@]}" "$SSH_HOST" "$command"
  else
    # shellcheck disable=SC2029 # the complete command is intentionally sent to the remote shell.
    ssh "${SSH_OPTIONS[@]}" "$SSH_HOST" "$command"
  fi
}
remote_target() { printf '%s:%s' "$SSH_HOST" "$1"; }
valid_ssh_host() { [[ $1 != -* && $1 =~ ^[A-Za-z0-9_.:@%:-]+$ ]]; }
valid_deploy_dir() {
  [[ $1 =~ ^[A-Za-z0-9_][A-Za-z0-9._/-]*$ && $1 != */ && $1 != *//* ]] || return 1
  local part
  local -a parts
  IFS=/ read -r -a parts <<< "$1"
  for part in "${parts[@]}"; do [[ $part != . && $part != .. ]] || return 1; done
}
resolve_repo_path() { if [[ $1 = /* ]]; then printf '%s\n' "$1"; else printf '%s/%s\n' "$REPO_DIR" "$1"; fi; }
check_file() { [[ -f $1 && -r $1 ]] || die "$2 is not a readable regular file: $1"; }
check_dataset() { [[ -d $1 && -r $1 ]] || die "dataset directory is not readable: $1"; check_file "$1/dataset.json" dataset.json; }
read_configuration() {
  local line key value
  local -A seen=()
  MAP_IMAGE=''; SERVER_DATA_DIR=''; COMPOSE_PROJECT_NAME=''; HTTP_PORT=''; BIND_HOST=''
  while IFS= read -r line || [[ -n $line ]]; do
    line=${line%$'\r'}
    [[ $line =~ ^[[:space:]]*(#.*)?$ ]] && continue
    [[ $line =~ ^([A-Z_]+)=(.*)$ ]] || die 'ENV_FILE requires literal KEY=value lines'
    key=${BASH_REMATCH[1]}; value=${BASH_REMATCH[2]}
    [[ ! ${seen[$key]+present} ]] || die "duplicate ENV_FILE key: $key"
    seen[$key]=1
    case $key in
      MAP_IMAGE|SERVER_DATA_DIR|COMPOSE_PROJECT_NAME|HTTP_PORT|BIND_HOST) printf -v "$key" '%s' "$value" ;;
      *) die "unsupported ENV_FILE key: $key" ;;
    esac
  done < "$LOCAL_ENV_FILE"
  [[ $MAP_IMAGE =~ ^[a-zA-Z0-9][a-zA-Z0-9._/:@-]*$ ]] || die 'ENV_FILE must define a literal MAP_IMAGE'
  [[ $COMPOSE_PROJECT_NAME =~ ^[a-z0-9][a-z0-9_-]*$ ]] || die 'invalid COMPOSE_PROJECT_NAME'
  [[ $HTTP_PORT =~ ^[1-9][0-9]{0,4}$ ]] || die 'invalid HTTP_PORT'
  ((HTTP_PORT <= 65535)) || die 'invalid HTTP_PORT'
  [[ $BIND_HOST =~ ^[a-zA-Z0-9][a-zA-Z0-9.:-]*$ ]] || die 'invalid BIND_HOST'
  DATA_SUBDIR=${SERVER_DATA_DIR#./}
  valid_deploy_dir "$DATA_SUBDIR" || die 'SERVER_DATA_DIR must be a safe relative directory'
  [[ $DATA_SUBDIR != import && $DATA_SUBDIR != import/* ]] || die 'data and import directories must be separate'
}
parse_args() {
  while (($#)); do
    case $1 in
      -h|--help) usage; exit 0 ;;
      --dry-run) DRY_RUN=1 ;;
      --dataset) (($# >= 2)) || die '--dataset requires a directory'; DATASET_DIR=$2; shift ;;
      --dataset=*) DATASET_DIR=${1#*=}; [[ -n $DATASET_DIR ]] || die '--dataset requires a directory' ;;
      --image-archive) (($# >= 2)) || die '--image-archive requires a file'; IMAGE_ARCHIVE=$2; shift ;;
      --image-archive=*) IMAGE_ARCHIVE=${1#*=}; [[ -n $IMAGE_ARCHIVE ]] || die '--image-archive requires a file' ;;
      *) die "unknown argument: $1" ;;
    esac
    shift
  done
}
parse_args "$@"
[[ $CONTAINER_ENGINE = podman || $CONTAINER_ENGINE = docker ]] || die 'CONTAINER_ENGINE must be podman or docker'
valid_ssh_host "$SSH_HOST" || die 'SSH_HOST contains unsupported characters'
valid_deploy_dir "$DEPLOY_DIR" || die 'DEPLOY_DIR must be a relative path below the remote home directory'
COMPOSE_FILE="$REPO_DIR/compose.yaml"
PODMAN_COMPOSE_FILE="$REPO_DIR/compose.podman.yaml"
LOCAL_ENV_FILE=$(resolve_repo_path "$ENV_FILE")
check_file "$COMPOSE_FILE" compose.yaml
check_file "$LOCAL_ENV_FILE" ENV_FILE
if [[ $CONTAINER_ENGINE = podman ]]; then check_file "$PODMAN_COMPOSE_FILE" compose.podman.yaml; fi
read_configuration
if [[ -n $DATASET_DIR ]]; then LOCAL_DATASET_DIR=$(resolve_repo_path "$DATASET_DIR"); check_dataset "$LOCAL_DATASET_DIR"; else LOCAL_DATASET_DIR=''; fi
if [[ -n $IMAGE_ARCHIVE ]]; then LOCAL_IMAGE_ARCHIVE=$(resolve_repo_path "$IMAGE_ARCHIVE"); check_file "$LOCAL_IMAGE_ARCHIVE" 'image archive'; else LOCAL_IMAGE_ARCHIVE=''; fi
if (( ! DRY_RUN )); then
  command -v ssh >/dev/null 2>&1 || die 'ssh is required'
  command -v scp >/dev/null 2>&1 || die 'scp is required'
  [[ -z $LOCAL_DATASET_DIR ]] || command -v rsync >/dev/null 2>&1 || die 'rsync is required with --dataset'
fi
if [[ $CONTAINER_ENGINE = podman ]]; then REMOTE_COMPOSE='podman-compose --env-file .env.docker -f compose.yaml -f compose.podman.yaml'; else REMOTE_COMPOSE='docker compose --env-file .env.docker -f compose.yaml'; fi
REMOTE_CD="cd -- $(shell_quote "$DEPLOY_DIR")"
log "checking SSH access to $SSH_HOST"; remote_command true || die 'SSH preflight failed; verify host key and SSH access'
log "checking remote $CONTAINER_ENGINE and Compose"
if [[ $CONTAINER_ENGINE = podman ]]; then
  # shellcheck disable=SC2016 # USER and Linger are evaluated on the remote host.
  remote_command 'test "$(podman info --format "{{.Host.Security.Rootless}}")" = true && podman-compose --version >/dev/null && systemctl --user show-environment >/dev/null && test "$(loginctl show-user "$USER" -p Linger --value)" = yes' || die 'Podman, podman-compose, user systemd and linger are required'
else remote_command 'docker info >/dev/null && docker compose version >/dev/null' || die 'Docker Engine and Compose are required'; fi
if [[ -n $LOCAL_DATASET_DIR ]]; then remote_command 'command -v rsync >/dev/null 2>&1' || die 'remote rsync is required with --dataset'; fi
log "creating deployment directories under ~/$DEPLOY_DIR"
remote_command "mkdir -p -- $(shell_quote "$DEPLOY_DIR") $(shell_quote "$DEPLOY_DIR/$DATA_SUBDIR") $(shell_quote "$DEPLOY_DIR/import")" || die 'remote directory bootstrap failed'
log 'copying Compose files and environment'
run_command scp "${SSH_OPTIONS[@]}" "$COMPOSE_FILE" "$(remote_target "$DEPLOY_DIR/compose.yaml")" || die 'compose.yaml transfer failed'
run_command scp "${SSH_OPTIONS[@]}" "$LOCAL_ENV_FILE" "$(remote_target "$DEPLOY_DIR/.env.docker")" || die '.env.docker transfer failed'
if [[ $CONTAINER_ENGINE = podman ]]; then run_command scp "${SSH_OPTIONS[@]}" "$PODMAN_COMPOSE_FILE" "$(remote_target "$DEPLOY_DIR/compose.podman.yaml")" || die 'Podman override transfer failed'; fi
if [[ -n $LOCAL_DATASET_DIR ]]; then
  log "copying dataset from $LOCAL_DATASET_DIR"
  run_command rsync -az -e 'ssh -o BatchMode=yes -o StrictHostKeyChecking=yes -o ConnectTimeout=10' --exclude='*.db' --exclude='*.db-*' --exclude='*.sqlite*' --exclude='*.sqlite3' --exclude='*.sqlite3-*' --safe-links --include='/dataset.json' --include='/icons/***' --include='/images/***' --include='/tiles/***' --exclude='*' "$LOCAL_DATASET_DIR/" "$(remote_target "$DEPLOY_DIR/import/")" || die 'dataset transfer failed'
fi
if [[ -n $LOCAL_IMAGE_ARCHIVE ]]; then
  log 'loading supplied image archive'
  if ((DRY_RUN)); then REMOTE_ARCHIVE='.rdr2-image.dry-run.tar'; else
    # shellcheck disable=SC2029 # mktemp is deliberately evaluated on the remote host.
    REMOTE_ARCHIVE=$(ssh "${SSH_OPTIONS[@]}" "$SSH_HOST" "$REMOTE_CD && mktemp .rdr2-image.XXXXXX.tar") || die 'remote temporary archive creation failed'
  fi
  [[ $REMOTE_ARCHIVE =~ ^\.rdr2-image\.[A-Za-z0-9-]+\.tar$ ]] || die 'invalid temporary archive path'
  run_command scp "${SSH_OPTIONS[@]}" "$LOCAL_IMAGE_ARCHIVE" "$(remote_target "$DEPLOY_DIR/$REMOTE_ARCHIVE")" || die 'image archive transfer failed'
  remote_command "$REMOTE_CD && $CONTAINER_ENGINE load -i $(shell_quote "$REMOTE_ARCHIVE") && rm -- $(shell_quote "$REMOTE_ARCHIVE") && $CONTAINER_ENGINE image inspect $(shell_quote "$MAP_IMAGE") >/dev/null" || die 'image load failed'
else log 'pulling map image'; remote_command "$REMOTE_CD && $REMOTE_COMPOSE pull map" || die 'image pull failed'; fi
log 'preparing persistent directories'
if [[ $CONTAINER_ENGINE = podman ]]; then
  remote_command "$REMOTE_CD && $REMOTE_COMPOSE run --rm -T map sh -ec $(shell_quote 'test -w /data || { echo "Data directory must be writable by the SSH user" >&2; exit 1; }')" || die 'Podman data directory is not writable'
else
  remote_command "$REMOTE_CD && $REMOTE_COMPOSE run --rm -T --user 0 map sh -ec $(shell_quote 'mkdir -p /data && chown -R 1000:1000 /data')" || die 'Docker directory ownership setup failed'
fi
if [[ -n $LOCAL_DATASET_DIR ]]; then
  log 'importing dataset while preserving existing database'
  remote_command "$REMOTE_CD && $REMOTE_COMPOSE run --rm -T -v ./import:/import:ro map node /app/backend/dist/backend/src/db/import.js /import/dataset.json --db /data/rdr2.db --data-root /data" || die 'dataset import failed'
fi
log 'starting map service'
if [[ $CONTAINER_ENGINE = podman ]]; then
  remote_command "$REMOTE_CD && $REMOTE_COMPOSE up -d --force-recreate map" || die 'service start failed'
  # shellcheck disable=SC2016 # loop substitutions and container are evaluated remotely.
  health_loop='for attempt in $(seq 1 30); do container=$('"$REMOTE_COMPOSE"' ps -q 2>/dev/null); if [ -n "$container" ] && podman healthcheck run "$container" >/dev/null 2>&1; then exit 0; fi; sleep 2; done; exit 1'
  remote_command "$REMOTE_CD && $health_loop" || die 'service health check failed'
  UNIT_NAME="map-${DEPLOY_DIR//\//-}.service"
  UNIT_CONTENT="[Unit]
Description=Local RDR2 map
After=network-online.target

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=%h/$DEPLOY_DIR
ExecStart=/usr/bin/env $REMOTE_COMPOSE up -d map
ExecStop=/usr/bin/env $REMOTE_COMPOSE stop map
TimeoutStartSec=120
TimeoutStopSec=60

[Install]
WantedBy=default.target"
  log "enabling user service $UNIT_NAME"
  # shellcheck disable=SC2016 # retain the literal variable for the remote shell.
  REMOTE_HOME='$HOME'
  remote_command "mkdir -p \"$REMOTE_HOME/.config/systemd/user\" && printf '%s\\n' $(shell_quote "$UNIT_CONTENT") > \"$REMOTE_HOME/.config/systemd/user/$UNIT_NAME\" && systemctl --user daemon-reload && systemctl --user enable --now $(shell_quote "$UNIT_NAME")" || die 'user service installation failed'
  remote_command "systemctl --user is-enabled $(shell_quote "$UNIT_NAME") && systemctl --user is-active $(shell_quote "$UNIT_NAME")" || die 'user service is not enabled and active'
  remote_command "$REMOTE_CD && $health_loop" || die 'health failed after enabling systemd'
else remote_command "$REMOTE_CD && $REMOTE_COMPOSE up -d --wait --wait-timeout 120 map" || die 'service start failed'; fi
if ((DRY_RUN)); then log 'dry-run complete; no files or services changed'; else log "deployment complete: $SSH_HOST:~/$DEPLOY_DIR"; fi
