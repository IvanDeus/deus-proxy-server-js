# deus proxy server
A Node.js-based anonymous HTTP/HTTPS proxy server that provides secure and flexible proxy capabilities with IP-based access control.

## Features

- Supports both HTTP and HTTPS traffic
- No traffic decryption 
- Anonymous proxy functionality
- IP-based access control through configurable whitelist
- Easy configuration via environment variables
- Lightweight and fast

## Requirements

- Node.js 22 or higher

## Installation

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd deus-proxy-server-js
   ```

2. Install dependencies (if any):
   ```bash
   npm install
   ```

## Configuration

Create a `.env` file in the root directory with the following variables. Choose proxy server port and allowed IPs to access proxy:

```env
PORT=33000
ALLOWED_IPS=52.167.144.238,52.167.144.*,192.168.1.*,10.0.0.0/24
```

### Configuration Options

- `PORT`: The port number on which the proxy server will listen (default: 33000)
- `ALLOWED_IPS`: Comma-separated list of IP addresses or IP ranges that are allowed to use the proxy. Supports:
  - Individual IPs: `192.168.1.100`
  - IP wildcards: `192.168.1.*`
  - CIDR notation: `10.0.0.0/24`

## Usage

Start the proxy server:

```bash
node proxy.js
```

The proxy server will start on the configured port and only accept connections from the specified allowed IP addresses.

## Production Mode with PM2
For production deployment, use PM2 to manage the proxy server:

```
# Start the proxy server with PM2
pm2 start proxy.js --name "deus-proxy"

# Start with specific environment file
pm2 start proxy.js --name "deus-proxy" --env production

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

[ivan deus] 2025
