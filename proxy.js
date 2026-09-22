// proxy.js
// Load environment variables from .env file
require('dotenv').config();

const http = require('http');
const https = require('https');
const url = require('url');
const net = require('net');
const dns = require('dns');

// Load variables from .env with fallback defaults using nullish coalescing (??)
const PORT = parseInt(process.env.PORT ?? '33000', 10);
const TIMEOUT = parseInt(process.env.TIMEOUT ?? '90000', 10);
const AUTH_USER = process.env.AUTH_USER ?? 'ai-user-clipper';
const AUTH_PASS = process.env.AUTH_PASS ?? '_iornhf7784hdhdbbbsssidddjooo';

// Prefer IPv4, fall back to IPv6
dns.setDefaultResultOrder('ipv4first');

function checkAuth(req) {
  const authHeader = req.headers['proxy-authorization'];
  if (!authHeader || !authHeader.startsWith('Basic ')) {
    return false;
  }

  try {
    const credentials = Buffer.from(authHeader.slice(6), 'base64').toString('utf8');
    const [user, pass] = credentials.split(':');
    return user === AUTH_USER && pass === AUTH_PASS;
  } catch (e) {
    return false;
  }
}

function sendAuthRequired(resOrSocket, isConnect = false) {
  const body = 'Proxy Authentication Required';
  if (isConnect) {
    // For CONNECT we must write raw HTTP response on the socket
    resOrSocket.write(
      'HTTP/1.1 407 Proxy Authentication Required\r\n' +
      'Proxy-Authenticate: Basic realm="Proxy"\r\n' +
      'Content-Length: ' + Buffer.byteLength(body) + '\r\n' +
      'Connection: close\r\n\r\n' +
      body
    );
    resOrSocket.end();
  } else {
    resOrSocket.writeHead(407, {
      'Proxy-Authenticate': 'Basic realm="Proxy"',
      'Content-Type': 'text/plain',
      'Content-Length': Buffer.byteLength(body),
      'Connection': 'close'
    });
    resOrSocket.end(body);
  }
}

function removeHopByHopHeaders(headers) {
  const hopByHop = [
    'connection', 'keep-alive', 'proxy-authenticate',
    'proxy-authorization', 'te', 'trailers',
    'transfer-encoding', 'upgrade'
  ];
  hopByHop.forEach(h => delete headers[h]);
}

const proxy = http.createServer();

// ---------- HTTP requests ----------
proxy.on('request', (clientReq, clientRes) => {
  const clientIp = clientReq.socket.remoteAddress || 'unknown';

  if (!checkAuth(clientReq)) {
    console.log(`[${clientIp}] Auth failed for HTTP request`);
    return sendAuthRequired(clientRes, false);
  }

  console.log(`[${clientIp}] Proxying HTTP request: ${clientReq.method} ${clientReq.url}`);

  const parsedUrl = url.parse(clientReq.url);
  const options = {
    hostname: parsedUrl.hostname,
    port: parsedUrl.port || 80,
    path: parsedUrl.path,
    method: clientReq.method,
    headers: { ...clientReq.headers },
    family: 4
  };

  options.headers.host = parsedUrl.host;
  delete options.headers['proxy-connection'];
  delete options.headers['connection'];
  delete options.headers['keep-alive'];
  delete options.headers['proxy-authorization']; // never forward auth

  const proxyReq = http.request(options, (proxyRes) => {
    removeHopByHopHeaders(proxyRes.headers);
    clientRes.writeHead(proxyRes.statusCode, proxyRes.headers);
    proxyRes.pipe(clientRes);
  });

  proxyReq.on('error', (err) => {
    console.error(`[${clientIp}] Proxy request error for ${parsedUrl.hostname}:`, err.code);

    if (err.code === 'ENOTFOUND' || err.code === 'EAI_FAIL') {
      console.log(`[${clientIp}] Retrying without IP family restriction...`);
      const fallbackOptions = { ...options };
      delete fallbackOptions.family;

      const fallbackReq = http.request(fallbackOptions, (fallbackRes) => {
        removeHopByHopHeaders(fallbackRes.headers);
        clientRes.writeHead(fallbackRes.statusCode, fallbackRes.headers);
        fallbackRes.pipe(clientRes);
      });

      fallbackReq.on('error', (fallbackErr) => {
        console.error(`[${clientIp}] Fallback request also failed:`, fallbackErr.code);
        clientRes.writeHead(500);
        clientRes.end('Proxy error: ' + fallbackErr.message);
      });

      clientReq.pipe(fallbackReq);
    } else {
      clientRes.writeHead(500);
      clientRes.end('Proxy error: ' + err.message);
    }
  });

  proxyReq.setTimeout(TIMEOUT, () => {
    console.log(`[${clientIp}] HTTP request timeout for: ${parsedUrl.hostname}`);
    proxyReq.destroy();
    clientRes.writeHead(504);
    clientRes.end('Gateway Timeout');
  });

  clientReq.pipe(proxyReq);
});

// ---------- HTTPS CONNECT ----------
proxy.on('connect', (clientReq, clientSocket, head) => {
  const clientIp = clientSocket.remoteAddress || 'unknown';
  let serverSocket = null;

  // Node hands CONNECT sockets over with no error listener of its own, so a
  // client that RSTs (e.g. after a 407) would crash the process uncaught.
  clientSocket.on('error', (err) => {
    console.error(`[${clientIp}] Client socket error:`, err.code);
    if (serverSocket) serverSocket.destroy();
    clientSocket.destroy();
  });

  if (!checkAuth(clientReq)) {
    console.log(`[${clientIp}] Auth failed for CONNECT request`);
    return sendAuthRequired(clientSocket, true);
  }

  console.log(`[${clientIp}] Proxying HTTPS request: CONNECT ${clientReq.url}`);

  const [hostname, port] = clientReq.url.split(':');
  const serverPort = parseInt(port) || 443;

  serverSocket = net.connect({
    host: hostname,
    port: serverPort,
    family: 4
  }, () => {
    console.log(`[${clientIp}] Successfully connected to ${hostname}:${serverPort}`);
    clientSocket.write('HTTP/1.1 200 Connection Established\r\n\r\n');
    serverSocket.write(head);
    serverSocket.pipe(clientSocket);
    clientSocket.pipe(serverSocket);
  });

  serverSocket.on('error', (err) => {
    console.error(`[${clientIp}] Server socket error for ${hostname}:`, err.code);

    if (err.code === 'ENOTFOUND' || err.code === 'EAI_FAIL') {
      console.log(`[${clientIp}] Retrying ${hostname} without IP family restriction...`);

      const fallbackSocket = net.connect({
        host: hostname,
        port: serverPort
      }, () => {
        console.log(`[${clientIp}] Fallback connection successful to ${hostname}`);
        clientSocket.write('HTTP/1.1 200 Connection Established\r\n\r\n');
        fallbackSocket.write(head);
        fallbackSocket.pipe(clientSocket);
        clientSocket.pipe(fallbackSocket);
      });

      fallbackSocket.on('error', (fallbackErr) => {
        console.error(`[${clientIp}] Fallback connection failed for ${hostname}:`, fallbackErr.code);
        clientSocket.end('HTTP/1.1 500 Connection Failed\r\n\r\n');
      });

      fallbackSocket.setTimeout(TIMEOUT, () => {
        console.log(`[${clientIp}] Fallback socket timeout for: ${hostname}`);
        fallbackSocket.destroy();
        clientSocket.end();
      });
    } else {
      clientSocket.end('HTTP/1.1 500 Connection Failed\r\n\r\n');
    }
  });

  serverSocket.setTimeout(TIMEOUT, () => {
    console.log(`[${clientIp}] Socket timeout for: ${hostname}`);
    serverSocket.destroy();
    clientSocket.end();
  });
});

proxy.on('error', (err) => {
  console.error('Proxy server error:', err);
});

proxy.listen(PORT, () => {
  console.log(`Authenticated HTTP/HTTPS proxy running on port ${PORT}`);
  console.log('IPv4 preferred with IPv6 fallback');
});

process.on('SIGINT', () => {
  console.log('\nShutting down proxy server...');
  proxy.close(() => {
    console.log('Proxy server closed');
    process.exit(0);
  });
});
