#!/usr/bin/env bash
set -euo pipefail

NAMESPACE="${NAMESPACE:-cryptotrendnotify}"
SECRET_NAME="${SECRET_NAME:-cryptotrendnotify-vapid}"
FRONTEND_IMAGE="${FRONTEND_IMAGE:-cryptotrendnotify-frontend:local}"
PUSH_IMAGE="${PUSH_IMAGE:-cryptotrendnotify-push-server:local}"
KUSTOMIZE_DIR="${KUSTOMIZE_DIR:-k8s/overlays/rancher-desktop}"
VITE_API_BASE_URL_DEFAULT="http://cryptotrendnotify-push-server.${NAMESPACE}.svc.cluster.local:4000"
VITE_API_BASE_URL="${VITE_API_BASE_URL:-$VITE_API_BASE_URL_DEFAULT}"

command_exists() {
  command -v "$1" >/dev/null 2>&1
}

require_cmd() {
  if ! command_exists "$1"; then
    echo "Error: $1 is required but was not found in PATH." >&2
    exit 1
  fi
}

require_cmd kubectl

if command_exists nerdctl; then
  OCI_CLI="nerdctl"
else
  require_cmd docker
  OCI_CLI="docker"
fi

build_image() {
  local dockerfile=$1
  local image=$2
  shift 2
  local extra_args=("$@")
  echo "\n>>> Building ${image} from ${dockerfile}" >&2
  if [ "$OCI_CLI" = "nerdctl" ]; then
    nerdctl build -t "$image" -f "$dockerfile" "${extra_args[@]}" .
  else
    docker build -t "$image" -f "$dockerfile" "${extra_args[@]}" .
  fi
}

build_image Dockerfile.frontend "$FRONTEND_IMAGE" --build-arg "VITE_API_BASE_URL=$VITE_API_BASE_URL"
build_image Dockerfile.push-server "$PUSH_IMAGE"

if command_exists nerdctl; then
  echo "\n>>> Loading images into the kubernetes runtime" >&2
  for image in "$FRONTEND_IMAGE" "$PUSH_IMAGE"; do
    nerdctl image save "$image" | nerdctl --namespace k8s.io load
  done
elif command_exists ctr; then
  echo "\n>>> Loading images into containerd" >&2
  for image in "$FRONTEND_IMAGE" "$PUSH_IMAGE"; do
    docker save "$image" | ctr -n k8s.io images import -
  done
else
  echo "Warning: could not locate nerdctl or ctr to load images into Kubernetes. Ensure your cluster can pull $FRONTEND_IMAGE and $PUSH_IMAGE." >&2
fi

echo "\n>>> Applying Kubernetes manifests" >&2
kubectl apply -k "$KUSTOMIZE_DIR"

echo "\n>>> Ensuring VAPID secret exists" >&2
if kubectl -n "$NAMESPACE" get secret "$SECRET_NAME" >/dev/null 2>&1; then
  echo "Secret ${SECRET_NAME} already present; leaving it untouched." >&2
else
  if [[ -n "${VAPID_PUBLIC_KEY:-}" && -n "${VAPID_PRIVATE_KEY:-}" ]]; then
    PUBLIC_KEY=$VAPID_PUBLIC_KEY
    PRIVATE_KEY=$VAPID_PRIVATE_KEY
    SUBJECT=${VAPID_SUBJECT:-"mailto:you@example.com"}
  elif command_exists node && node -e "require.resolve('web-push')" >/dev/null 2>&1; then
    VAPID_OUTPUT=$(node --input-type=module - <<'NODE'
import webPush from 'web-push';
const { publicKey, privateKey } = webPush.generateVAPIDKeys();
console.log(publicKey);
console.log(privateKey);
NODE
)
    PUBLIC_KEY=$(printf '%s' "$VAPID_OUTPUT" | sed -n '1p')
    PRIVATE_KEY=$(printf '%s' "$VAPID_OUTPUT" | sed -n '2p')
    SUBJECT="mailto:you@example.com"
  else
    echo "Error: no VAPID secret found and Node.js is unavailable to auto-generate keys." >&2
    echo "Set VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY env vars or create the secret manually:" >&2
    echo "  kubectl -n ${NAMESPACE} create secret generic ${SECRET_NAME} --from-literal=publicKey=... --from-literal=privateKey=... --from-literal=subject=mailto:you@example.com" >&2
    exit 1
  fi

  kubectl -n "$NAMESPACE" create secret generic "$SECRET_NAME" \
    --from-literal=publicKey="$PUBLIC_KEY" \
    --from-literal=privateKey="$PRIVATE_KEY" \
    --from-literal=subject="${SUBJECT:-mailto:you@example.com}" \
    --dry-run=client -o yaml | kubectl apply -f -
  echo "Created ${SECRET_NAME} secret with generated VAPID keys." >&2
fi

echo "\nCryptoTrendNotify is deploying to Rancher Desktop. Use 'kubectl -n ${NAMESPACE} get pods' to monitor status." >&2
