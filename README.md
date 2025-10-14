# CryptoTrendNotify

CryptoTrendNotify is a progressive web app (PWA) that surfaces crypto momentum insights with offline caching and install support. The application now ships with end-to-end push notifications so momentum alerts can be delivered even when the app is closed.

## Prerequisites

- Node.js 18+
- npm 9+

## Installation

```bash
npm install
```

## Generating VAPID keys

Web push notifications require a public/private VAPID key pair. For local development you can rely on the push server's auto-generated credentials (they are logged the first time you run it). For predictable keys across restarts—or for any production deployment—generate them explicitly with the `web-push` CLI (already installed as a dependency):

```bash
npx web-push generate-vapid-keys
```

This command prints a `publicKey` and `privateKey`. Store them securely—you will need both if you want to reuse subscriptions across server restarts or deploy outside your machine.

## Environment variables

Create a `.env.local` (or export shell variables) with the following values:

```
VITE_API_BASE_URL=http://localhost:4000
VITE_HEATMAP_API_URL=http://localhost:4000/api/heatmap/snapshots   # optional; defaults to VITE_API_BASE_URL
HEATMAP_SERVICE_URL=http://localhost:4000/api/heatmap/snapshots     # optional backend proxy target
VAPID_PUBLIC_KEY=<your public key from the step above>
VAPID_PRIVATE_KEY=<your private key from the step above>
VAPID_SUBJECT=mailto:you@example.com   # optional but recommended
```

`VITE_API_BASE_URL` lets the frontend know where to reach the push API. `VITE_HEATMAP_API_URL` overrides the default heatmap endpoint the dashboard queries (falls back to `VITE_API_BASE_URL` when omitted). The push server proxies heatmap traffic through `HEATMAP_SERVICE_URL`; leave it unset to use the built-in mock snapshots. The `VAPID_*` variables are optional for quick local testing; without them the push server will create temporary keys on boot and print them to the console.

## Available scripts

### Start the push server

The push server persists subscriptions and uses `web-push` to fan out notifications to every registered device.

```bash
npm run push:server
```

By default the server listens on port `4000`. You can customize it with environment variables:

- `PUSH_SERVER_PORT`: override the port (falls back to `PORT`).
- `PUSH_SUBSCRIPTIONS_FILE`: path to the JSON file that stores subscriptions (defaults to `server/data/push-subscriptions.json`).
- `PUSH_ALLOWED_ORIGIN`: value for the `Access-Control-Allow-Origin` header.
- `PUSH_ENABLE_MARKET_WATCH`: set to `false` to disable server-side market polling (enabled by default).
- `PUSH_MARKET_WATCH_INTERVAL_MS`: polling cadence in milliseconds (defaults to `60000`).
- `PUSH_WATCH_SYMBOLS`: comma-separated list of symbols to monitor (defaults to `DOGEUSDT,BTCUSDT,ETHUSDT,XRPUSDT,SOLUSDT`).

### Start the frontend

Run the Vite development server (in a separate terminal):

```bash
npm run dev
```

### Run both dev servers together

Use the helper script to run the push backend and Vite frontend in one terminal session:

```bash
npm run dev:full
```

The script spawns both `npm run push:server` and `npm run dev`, forwarding all logs to your console. Stop the stack with `Ctrl+C`—the script will shut down both processes.

### Build for production

```bash
npm run build
```

## Container images

Production deployments typically run the frontend and push server in separate containers. Two Dockerfiles are included:

- `Dockerfile.frontend` builds the Vite bundle and serves it with Nginx. Override the API endpoint at build time with `--build-arg VITE_API_BASE_URL=<push server URL>` if it differs from the default Kubernetes service name.
- `Dockerfile.push-server` bundles the Node.js push API. Mount `/app/server/data` to persist stored subscriptions.

Example builds:

```bash
# Build the static frontend bundle
docker build -f Dockerfile.frontend -t cryptotrendnotify-frontend:latest .

# Build the push notification backend
docker build -f Dockerfile.push-server -t cryptotrendnotify-push-server:latest .
```

## Run locally with Docker Compose

To spin up both services locally without installing Node.js, use the included Compose file:

```bash
docker compose up --build
```

The command builds both images, starts the push server on <http://localhost:4000>, and serves the frontend through Nginx on <http://localhost:8080>. Subscriptions are saved to a named Docker volume (`push-data`) so restarts do not wipe the stored browser registrations. Update the `docker-compose.yml` file with your own VAPID keys or additional environment variables if you need deterministic credentials.

## Deploying to Rancher/Kubernetes

Kubernetes manifests for Rancher-managed clusters live in [`k8s/`](./k8s). They provision:

- A namespace (`namespace.yaml`).
- The push server deployment, service, and persistent volume claim (`push-server.yaml`).
- The frontend deployment, service, and ingress (`frontend.yaml`).

Follow the detailed instructions in [`k8s/README.md`](./k8s/README.md) to publish your container images, create VAPID secrets, and apply the manifests.

## Push delivery flow

1. When users grant notification permission, the app calls the Push API to create a subscription and sends it to the backend.
2. The subscription is stored in `server/data/push-subscriptions.json` so pushes survive server restarts.
3. Server-side market watchers continuously poll Bybit even when the PWA is closed. When a momentum or moving-average trigger fires, the backend only broadcasts the notification to subscriptions whose saved filters match the symbol/pair so alerts respect the dashboard selections even if the app is closed. The service worker displays the alert even if the app is closed.

The service worker lives in `src/sw.ts` and handles precaching, runtime caching, `push`, and `notificationclick` events.

## Testing notifications locally

1. Start the push server and Vite dev server.
2. Load the app, enable notifications, and accept the browser permission prompt.
3. Watch the terminal logs for "Push notification server listening" to confirm the backend is running.
4. Trigger a momentum alert (or craft a `curl` request to `POST /api/push/notifications`) to verify the PWA receives pushes even while the tab is closed. With the watcher enabled, alerts will also arrive automatically once market conditions meet the thresholds.

## Server-driven alerts

The push backend mirrors the client-side alert logic so notifications continue flowing when no browsers are open:

- **Momentum alerts**: evaluates RSI and Stochastic RSI for 5m, 15m, 30m, and 60m intervals. Consecutive timeframe confirmations produce progressively higher-intensity alerts.
- **Moving-average crosses**: watches EMA 10/EMA 50, EMA 10/MA 200, and EMA 50/MA 200 pairs across all supported intervals.

The watcher polls Bybit every 60 seconds by default. Customize the cadence or symbols with the environment variables listed above.
