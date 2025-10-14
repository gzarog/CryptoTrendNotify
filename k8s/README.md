# Deploying CryptoTrendNotify to Rancher-managed Kubernetes

These manifests assume a Rancher-managed Kubernetes cluster with the [`local-path`](https://github.com/rancher/local-path-provisioner) storage class available (the default for Rancher Desktop and K3s). Adjust the resources, ingress, or storage class to match your environment.

If you are using Rancher Desktop and want a single command to build the images, load them into the Kubernetes runtime, and apply the manifests, run [`scripts/rancher-desktop-up.sh`](../scripts/rancher-desktop-up.sh). The script wraps the Rancher Desktop overlay described below and can auto-generate VAPID credentials when Node.js plus the local `web-push` dependency are available.

## Repository layout

- [`base/`](./base) – namespace, push server, and frontend manifests.
- [`overlays/rancher-desktop/`](./overlays/rancher-desktop) – kustomization that rewrites the image names to `cryptotrendnotify-*-local`, sets `imagePullPolicy: Never`, and narrows the frontend replica count to a single pod for local testing.

Use `kubectl apply -k k8s/base` for generic clusters that can pull images from your registry, or `kubectl apply -k k8s/overlays/rancher-desktop` when you have already loaded the local images into Rancher Desktop's container runtime.

## 1. Build and publish container images

Two images are required:

1. **Frontend** (`Dockerfile.frontend`) – builds the static Vite bundle and serves it through Nginx.
2. **Push server** (`Dockerfile.push-server`) – runs the Node.js backend that stores subscriptions and sends notifications.

```bash
# From the repository root
docker build -f Dockerfile.frontend -t ghcr.io/your-org/cryptotrendnotify-frontend:latest .
# Use your API endpoint at build time if it differs from the default push service name
docker build -f Dockerfile.frontend \
  --build-arg VITE_API_BASE_URL=https://push.example.com \
  -t ghcr.io/your-org/cryptotrendnotify-frontend:latest .

docker build -f Dockerfile.push-server -t ghcr.io/your-org/cryptotrendnotify-push-server:latest .

docker push ghcr.io/your-org/cryptotrendnotify-frontend:latest
docker push ghcr.io/your-org/cryptotrendnotify-push-server:latest
```

Replace `ghcr.io/your-org/...` with the registry and repository that Rancher can pull from.

When working entirely on Rancher Desktop you can skip the registry push by building the images locally and loading them into the `k8s.io` namespace:

```bash
nerdctl build -t cryptotrendnotify-frontend:local -f Dockerfile.frontend .
nerdctl build -t cryptotrendnotify-push-server:local -f Dockerfile.push-server .

nerdctl image save cryptotrendnotify-frontend:local | nerdctl --namespace k8s.io load
nerdctl image save cryptotrendnotify-push-server:local | nerdctl --namespace k8s.io load

kubectl apply -k k8s/overlays/rancher-desktop
```

## 2. Create the namespace

```bash
kubectl apply -f base/namespace.yaml
```

## 3. Store VAPID credentials as a secret

Generate a key pair if you do not already have one:

```bash
npx web-push generate-vapid-keys
```

Create the secret in the cluster (replace the placeholders with your values):

```bash
kubectl -n cryptotrendnotify create secret generic cryptotrendnotify-vapid \
  --from-literal=publicKey="<PUBLIC_KEY>" \
  --from-literal=privateKey="<PRIVATE_KEY>" \
  --from-literal=subject="mailto:you@example.com"
```

## 4. Apply the workloads

```bash
kubectl apply -f base/push-server.yaml
kubectl apply -f base/frontend.yaml
```

The push server deployment provisions a persistent volume claim to keep subscription data across pod restarts. Update the storage class or remove the claim if you use a different persistence strategy.

## 5. Expose the application

The included ingress publishes the frontend at `https://cryptotrendnotify.local`. Update the host, TLS settings, or annotations for your ingress controller. If you prefer Rancher Load Balancer services or Traefik, adjust the manifest accordingly.

The frontend bundle defaults to reaching the push server via the Kubernetes service DNS name `http://cryptotrendnotify-push-server.cryptotrendnotify.svc.cluster.local:4000`. If you expose the push API externally, rebuild the frontend image with `--build-arg VITE_API_BASE_URL=<external URL>` and update `PUSH_ALLOWED_ORIGIN` in the push server ConfigMap to the final domain of your frontend.
