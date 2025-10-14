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

## Running with Docker

The repository ships with a `Dockerfile` and `docker-compose.yml` so you can bring up the entire stack (Vite frontend and push server) with a single command—perfect for Docker Desktop or Rancher Desktop on Windows 11.

1. Build and start the containers:

   ```bash
   docker compose up -d --build
   ```

   The frontend will be available at http://localhost:5173 and the push API at http://localhost:4000.

2. Stop the stack when you're done:

   ```bash
   docker compose down
   ```

The compose file maps a named Docker volume (`push_data`) to `/app/server/data` so subscriptions survive container restarts. Adjust environment variables in `docker-compose.yml` if you need different ports, origins, or VAPID credentials.

### Troubleshooting Docker pulls on Windows

If `docker compose up --build` fails with an error similar to:

```
failed to resolve source metadata for docker.io/library/node:20-alpine: failed to do request: Head "https://registry-1.docker.io/v2/library/node/manifests/20-alpine": dial tcp: lookup registry-1.docker.io on 192.168.127.1:53: no such host
```

the Docker Desktop VM cannot resolve Docker Hub because its DNS forwarding is misconfigured. This typically happens after VPN/proxy changes or when Rancher Desktop is running alongside Docker Desktop.

Recommended fixes:

1. Open Docker Desktop → **Settings → Docker Engine** and add a DNS override, for example:

   ```json
   {
     "dns": ["8.8.8.8", "1.1.1.1"]
   }
   ```

   Save and restart Docker Desktop.

2. If you are using WSL 2 integration, run `wsl --shutdown` from PowerShell and reopen Docker Desktop so it regenerates the `/etc/resolv.conf` used inside containers.

3. Ensure only one container runtime (Docker Desktop or Rancher Desktop) is exposing the `docker` CLI at a time. Stopping Rancher Desktop before running Docker Desktop is often enough to restore DNS resolution.

After updating DNS, retry `docker compose up --build`; the `node:20-alpine` base image should download successfully.

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
