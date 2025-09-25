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
VAPID_PUBLIC_KEY=<your public key from the step above>
VAPID_PRIVATE_KEY=<your private key from the step above>
VAPID_SUBJECT=mailto:you@example.com   # optional but recommended
```

`VITE_API_BASE_URL` lets the frontend know where to reach the push API. Update it if you deploy the push server elsewhere. The `VAPID_*` variables are optional for quick local testing; without them the push server will create temporary keys on boot and print them to the console.

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
3. When a momentum alert fires, the client asks the backend to broadcast the notification. The backend sends the payload to every stored subscription via `web-push`. The service worker displays the alert even if the app is closed.

The service worker lives in `src/sw.ts` and handles precaching, runtime caching, `push`, and `notificationclick` events.

## Testing notifications locally

1. Start the push server and Vite dev server.
2. Load the app, enable notifications, and accept the browser permission prompt.
3. Watch the terminal logs for "Push notification server listening" to confirm the backend is running.
4. Trigger a momentum alert (or craft a `curl` request to `POST /api/push/notifications`) to verify the PWA receives pushes even while the tab is closed.
