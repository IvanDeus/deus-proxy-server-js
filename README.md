# deus proxy server
A Node.js-based HTTP/HTTPS proxy server that provides secure and flexible proxy capabilities, supporting both authenticated (user:password) and completely anonymous modes.

## Features

- Supports both HTTP and HTTPS traffic
- No traffic decryption (true tunnel for HTTPS)
- Flexible access control: User:Password authentication OR completely anonymous mode
- **Anonymous Mode (`--anon`)**: Bypasses auth and strips client-identifying headers (e.g., `X-Forwarded-For`, `Via`, `X-Real-IP`) to prevent destination servers from tracing the original client
- Every log line stamped in the timezone you choose, no dependencies
- Per-request download size logged (bytes, KB, MB…), still no extra dependencies
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

Create a `.env` file in the root directory with the following variables. Choose the proxy server port and the allowed user to access the proxy:

```env
PORT=33000
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
| `AUTH_USER` | `ai-user-x`       | Basic auth user name *(ignored in `--anon` mode)* |
| `AUTH_PASS` | built-in fallback | Basic auth password — always set your own *(ignored in `--anon` mode)* |
| `LOG_TZ`    | `UTC`             | IANA timezone for log timestamps              |

> **Note:** When running with the `--anon` flag, `AUTH_USER` and `AUTH_PASS` are completely ignored, and the proxy acts as an open, anonymous relay.

## Usage

Start the proxy server in your desired mode:

```bash
# Standard authenticated mode (requires user:pass)
node proxy.js

# Anonymous mode (ignores credentials, strips identifying headers)
node proxy.js --anon
```

The proxy server will start on the configured port. In anonymous mode, a warning will be logged to remind you to ensure the server is properly firewalled if exposed to the public internet.

## Logging

Every console line is prefixed with a timestamp in the zone you chose. 

Example output with `LOG_TZ=Asia/Tokyo`, while the host clock read `04:49 UTC`:

**Authenticated Mode:**
```text
[2026-09-24 13:49:18] Authenticated HTTP/HTTPS proxy running on port 33000
[2026-09-24 13:49:18] IPv4 preferred with IPv6 fallback
[2026-09-24 13:49:20] [::ffff:127.0.0.1] Proxying HTTP request: GET http://example.com/
[2026-09-24 13:49:20] [::ffff:127.0.0.1] Auth failed for HTTP request
[2026-09-24 13:49:20] [::ffff:127.0.0.1] Proxying HTTPS request: CONNECT example.com:443
[2026-09-24 13:49:20] [::ffff:127.0.0.1] Successfully connected to example.com:443
[2026-10-09 06:11:41] [::ffff:127.0.0.1] GET http://example.com/ done: 195.31 KB downloaded
[2026-10-09 06:11:41] [::ffff:127.0.0.1] CONNECT example.com:443 done: 2.86 MB downloaded
```

Each finished request logs how much came down the wire. Bytes are counted on the
response stream, so an aborted transfer still reports what was actually pushed.
For HTTPS the proxy cannot see inside TLS, so the tunnel numbers include the
handshake and record overhead — use them for traffic volume, not page weight.

**Anonymous Mode (`--anon`):**
```text
[2026-09-24 13:49:18] ANONYMOUS (No Auth, Headers Stripped) HTTP/HTTPS proxy running on port 33000
[2026-09-24 13:49:18] IPv4 preferred with IPv6 fallback
[2026-09-24 13:49:18] ⚠️  WARNING: Running as an open anonymous proxy. Ensure this is intended and properly firewalled.
[2026-09-24 13:49:20] [::ffff:127.0.0.1] Proxying HTTP request: GET http://example.com/
```

## Production Mode with PM2
For production deployment, use PM2 to manage the proxy server. 

```bash
# Start the proxy server with PM2 (Authenticated)
pm2 start proxy.js --name "deus-proxy"

# Start the proxy server with PM2 (Anonymous Mode)
pm2 start proxy.js --name "deus-proxy-anon" -- --anon

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
```bash
# Save the current PM2 configuration
pm2 save

# Start PM2 on system boot
pm2 startup

# Monitor the proxy server
pm2 monit
```

2026 [ ivan deus ]
