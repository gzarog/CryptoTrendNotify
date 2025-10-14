# Deploying CryptoTrendNotify to Rancher-managed Kubernetes

These manifests assume a Rancher-managed Kubernetes cluster with the [`local-path`](https://github.com/rancher/local-path-provisioner) storage class available (the default for Rancher Desktop and K3s). Adjust the resources, ingress, or storage class to match your environment.

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

## 2. Create the namespace

```bash
kubectl apply -f namespace.yaml
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
kubectl apply -f push-server.yaml
kubectl apply -f frontend.yaml
```

The push server deployment provisions a persistent volume claim to keep subscription data across pod restarts. Update the storage class or remove the claim if you use a different persistence strategy.

## 5. Expose the application

The included ingress publishes the frontend at `https://cryptotrendnotify.local`. Update the host, TLS settings, or annotations for your ingress controller. If you prefer Rancher Load Balancer services or Traefik, adjust the manifest accordingly.

The frontend bundle defaults to reaching the push server via the Kubernetes service DNS name `http://cryptotrendnotify-push-server.cryptotrendnotify.svc.cluster.local:4000`. If you expose the push API externally, rebuild the frontend image with `--build-arg VITE_API_BASE_URL=<external URL>` and update `PUSH_ALLOWED_ORIGIN` in the push server ConfigMap to the final domain of your frontend.
