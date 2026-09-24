# deus proxy server
A Node.js-based HTTP/HTTPS proxy server that provides secure and flexible proxy capabilities with user:password access control.

## Features

- Supports both HTTP and HTTPS traffic
- No traffic decryption
- Proxy functionality with user auth
- Every log line stamped in the timezone you choose, no dependencies
- Easy configuration via environment variables
- Lightweight and fast

## Requirements

- Node.js 22 or higher

## Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/IvanDeus/deus-proxy-server-js.git
   cd deus-proxy-server-js
   ```

2. Install dependencies (if any):
   ```bash
   npm install
   ```

## Configuration

Create a `.env` file in the root directory with the following variables. Choose proxy server port and allowed user to access proxy:

```env
PORT=3300
TIMEOUT=90000
AUTH_USER=ai-user
AUTH_PASS=ai-pass
LOG_TZ=Europe/Berlin
```

`LOG_TZ` is any IANA timezone name; see [Logging](#logging) for what it does.

| Variable    | Default           | Description                                   |
| ----------- | ----------------- | --------------------------------------------- |
| `PORT`      | `33000`           | Port the proxy listens on                     |
| `TIMEOUT`   | `90000`           | Per request/socket idle timeout in ms         |
| `AUTH_USER` | `ai-user-clipper` | Basic auth user name                          |
| `AUTH_PASS` | built-in fallback | Basic auth password — always set your own     |
| `LOG_TZ`    | `UTC`             | IANA timezone for log timestamps              |

## Usage

Start the proxy server:

```bash
node proxy.js
```

The proxy server will start on the configured port and only accept connections from the specified user.

## Logging

Every console line is prefixed with a timestamp in the zone you chose. Actual output
with `LOG_TZ=Asia/Tokyo`, while the host clock read `04:49 UTC`:

```
[2026-09-24 13:49:18] Authenticated HTTP/HTTPS proxy running on port 34125
[2026-09-24 13:49:18] IPv4 preferred with IPv6 fallback
[2026-09-24 13:49:20] [::ffff:127.0.0.1] Proxying HTTP request: GET http://example.com/
[2026-09-24 13:49:20] [::ffff:127.0.0.1] Auth failed for HTTP request
[2026-09-24 13:49:20] [::ffff:127.0.0.1] Proxying HTTPS request: CONNECT example.com:443
[2026-09-24 13:49:20] [::ffff:127.0.0.1] Successfully connected to example.com:443
```

- The startup line reports the zone that was applied. An unknown `LOG_TZ` falls back to
  the host timezone instead of refusing to start.
- Names come from your Node build; list them with
  `node -e "console.log(Intl.supportedValuesOf('timeZone'))"`
- Stamping lives in `logger.js`, which patches `log`, `info`, `warn`, `error` and
  `debug`. Require it once at startup, after `dotenv`, so `LOG_TZ` from `.env` is loaded:
  `require('./logger')`
- The stamps are written by the app itself, so they survive `pm2 logs`, `journald` and
  `> file` redirection even when the process manager adds no timestamp of its own.

## Production Mode with PM2
For production deployment, use PM2 to manage the proxy server:

```
# Start the proxy server with PM2
pm2 start proxy.js --name "deus-proxy"

# View process status
pm2 status

# View logs
pm2 logs deus-proxy

# Stop the proxy server
pm2 stop deus-proxy

# Restart the proxy server
pm2 restart deus-proxy

# Delete the proxy server from PM2
pm2 delete deus-proxy
```
## PM2 Process Management
```
# Save the current PM2 configuration
pm2 save

# Start PM2 on system boot
pm2 startup

# Monitor the proxy server
pm2 monit
```

2026 [ ivan deus ]
