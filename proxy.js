//proxy.js
const http = require('http');
const https = require('https');
const url = require('url');
const net = require('net');
const dns = require('dns');

const PORT = 33000;

// Set DNS to prefer IPv4 but fall back to IPv6
dns.setDefaultResultOrder('ipv4first');

// Create HTTP proxy server
const proxy = http.createServer();

proxy.on('request', (clientReq, clientRes) => {
  console.log(`Proxying HTTP request: ${clientReq.method} ${clientReq.url}`);
  
  const parsedUrl = url.parse(clientReq.url);
  
  const options = {
    hostname: parsedUrl.hostname,
    port: parsedUrl.port || 80,
    path: parsedUrl.path,
    method: clientReq.method,
    headers: { ...clientReq.headers },
    // Force IPv4 but allow fallback to IPv6
    family: 4
  };

  // Set the Host header to the original hostname
  options.headers.host = parsedUrl.host;

  // Remove connection headers that shouldn't be forwarded
  delete options.headers['proxy-connection'];
  delete options.headers['connection'];
  delete options.headers['keep-alive'];

  const proxyReq = http.request(options, (proxyRes) => {
    // Remove hop-by-hop headers
    removeHopByHopHeaders(proxyRes.headers);
    
    clientRes.writeHead(proxyRes.statusCode, proxyRes.headers);
    proxyRes.pipe(clientRes);
  });

  proxyReq.on('error', (err) => {
    console.error('Proxy request error for', parsedUrl.hostname, ':', err.code);
    
    // Try without family restriction if IPv4 fails
    if (err.code === 'ENOTFOUND' || err.code === 'EAI_FAIL') {
      console.log('Retrying without IP family restriction...');
      const fallbackOptions = { ...options };
      delete fallbackOptions.family;
      
      const fallbackReq = http.request(fallbackOptions, (fallbackRes) => {
        removeHopByHopHeaders(fallbackRes.headers);
        clientRes.writeHead(fallbackRes.statusCode, fallbackRes.headers);
        fallbackRes.pipe(clientRes);
      });
      
      fallbackReq.on('error', (fallbackErr) => {
        console.error('Fallback request also failed:', fallbackErr.code);
        clientRes.writeHead(500);
        clientRes.end('Proxy error: ' + fallbackErr.message);
      });
      
      clientReq.pipe(fallbackReq);
    } else {
      clientRes.writeHead(500);
      clientRes.end('Proxy error: ' + err.message);
    }
  });

  // Set timeout for HTTP requests
  proxyReq.setTimeout(10000, () => {
    console.log('HTTP request timeout for:', parsedUrl.hostname);
    proxyReq.destroy();
    clientRes.writeHead(504);
    clientRes.end('Gateway Timeout');
  });

  clientReq.pipe(proxyReq);
});

// Handle CONNECT method for HTTPS tunneling
proxy.on('connect', (clientReq, clientSocket, head) => {
  console.log(`Proxying HTTPS request: CONNECT ${clientReq.url}`);
  
  const [hostname, port] = clientReq.url.split(':');
  const serverPort = parseInt(port) || 443;

  // First try with IPv4 preference
  const serverSocket = net.connect({
    host: hostname,
    port: serverPort,
    family: 4 // Prefer IPv4
  }, () => {
    console.log(`Successfully connected to ${hostname}:${serverPort}`);
    clientSocket.write('HTTP/1.1 200 Connection Established\r\n\r\n');
    serverSocket.write(head);
    serverSocket.pipe(clientSocket);
    clientSocket.pipe(serverSocket);
  });

  serverSocket.on('error', (err) => {
    console.error(`Server socket error for ${hostname}:`, err.code);
    
    // If IPv4 fails, try with any IP family
    if (err.code === 'ENOTFOUND' || err.code === 'EAI_FAIL') {
      console.log(`Retrying ${hostname} without IP family restriction...`);
      
      const fallbackSocket = net.connect({
        host: hostname,
        port: serverPort
        // No family restriction - let OS decide
      }, () => {
        console.log(`Fallback connection successful to ${hostname}`);
        clientSocket.write('HTTP/1.1 200 Connection Established\r\n\r\n');
        fallbackSocket.write(head);
        fallbackSocket.pipe(clientSocket);
        clientSocket.pipe(fallbackSocket);
      });
      
      fallbackSocket.on('error', (fallbackErr) => {
        console.error(`Fallback connection failed for ${hostname}:`, fallbackErr.code);
        clientSocket.end('HTTP/1.1 500 Connection Failed\r\n\r\n');
      });
      
      // Set timeout for fallback connection
      fallbackSocket.setTimeout(10000, () => {
        console.log(`Fallback socket timeout for: ${hostname}`);
        fallbackSocket.destroy();
        clientSocket.end();
      });
    } else {
      clientSocket.end('HTTP/1.1 500 Connection Failed\r\n\r\n');
    }
  });

  clientSocket.on('error', (err) => {
    console.error('Client socket error:', err.code);
    serverSocket.end();
  });

  // Set shorter timeout (10 seconds instead of 30)
  serverSocket.setTimeout(10000, () => {
    console.log(`Socket timeout for: ${hostname}`);
    serverSocket.destroy();
    clientSocket.end();
  });
});

proxy.on('error', (err) => {
  console.error('Proxy server error:', err);
});

// Remove hop-by-hop headers
function removeHopByHopHeaders(headers) {
  const hopByHopHeaders = [
    'connection', 'keep-alive', 'proxy-authenticate',
    'proxy-authorization', 'te', 'trailers', 'transfer-encoding', 'upgrade'
  ];
  
  hopByHopHeaders.forEach(header => {
    delete headers[header];
  });
}

// Start the proxy server
proxy.listen(PORT, () => {
  console.log(`Anonymous HTTP/HTTPS proxy server running on port ${PORT}`);
  console.log('Supports both HTTP and HTTPS traffic');
  console.log('Using IPv4 preference with IPv6 fallback');
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down proxy server...');
  proxy.close(() => {
    console.log('Proxy server closed');
    process.exit(0);
  });
});
