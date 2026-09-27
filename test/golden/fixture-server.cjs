'use strict';
// A local stand-in for every web page the markdown in the golden cases links to, so no recorded case and no test ever
// touches the internet.
//
// One HTTP server on 127.0.0.1 answers three ways, and all three reach the same routes:
// - As an HTTP proxy. The published 1.1.16 looks pages up through request 2.88 (in get-title-at-url 1.1.8 and
//   is-an-image-url 1.0.4), which honours HTTP_PROXY and HTTPS_PROXY. For an http:// link request sends the absolute URL
//   to the proxy (`GET http://host/path`); for an https:// link it sends CONNECT host:443, and the server hands the socket
//   to an in-process TLS server with a throwaway self-signed certificate (the capture turns verification off). Nothing is
//   ever forwarded anywhere.
// - Directly, with the original URL in an `x-fixture-url` header, for clients that cannot use a proxy (fetch in the tests
//   of 2.x points at `base` and names the URL it meant).
//
// A route is chosen by the path alone, whatever the host, so every client that can build the URL reaches it. SPECIAL lists
// the odd pages; any other path is an ordinary HTML page titled "Page <path>".
// Every request is logged: how it arrived, method, the full URL it was for, HTTP version and raw headers in order.

const http = require('node:http');
const https = require('node:https');
const zlib = require('node:zlib');

const html = title => `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title></head><body><p>Body text.</p></body></html>`;
const HTML = {'content-type': 'text/html; charset=utf-8'};
const PNG = Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d4944415478da63f8ffff3f0005fe02fea7d6a4bf0000000049454e44ae426082', 'hex');

// path -> [status, headers, body] or 'never'
const SPECIAL = {
  '/img': [200, {'content-type': 'image/png'}, PNG],
  '/img-upper': [200, {'content-type': 'IMAGE/PNG'}, PNG],
  '/img-svg': [200, {'content-type': 'image/svg+xml'}, '<svg xmlns="http://www.w3.org/2000/svg"/>'],
  '/404': [404, HTML, html('Not Found')],
  '/500': [500, HTML, html('Server Error')],
  '/410': [410, HTML, html('Gone')],
  '/redirect': [302, {location: '/redirected'}, ''],
  '/redirect-image': [302, {location: '/img'}, ''],
  '/loop': [302, {location: '/loop'}, ''],
  '/never': 'never',
  '/notitle': [200, HTML, '<!doctype html><html><head></head><body><p>No title.</p></body></html>'],
  '/empty-title': [200, HTML, html('')],
  '/space-title': [200, HTML, html('   ')],
  '/entities': [200, HTML, html('Tom &amp; Jerry &lt;3 &quot;quoted&quot; &#39;single&#39;')],
  '/brackets': [200, HTML, html('Array[0] (x) *star* _under_ `tick`')],
  '/dollar': [200, HTML, html('Cost $&amp; $1 $$ $\'')],
  '/pipe': [200, HTML, html('Name Part | Site Name')],
  '/dash': [200, HTML, html('Name Part - Site Name')],
  '/colon': [200, HTML, html('Site: Name After Colon')],
  '/heading': [200, HTML, '<!doctype html><html><head><title>Doc Title</title></head><body><article><h1>The Article Heading</h1></article></body></html>'],
  '/unicode': [200, HTML, html('Café – 😀 ünïcödé')],
  '/latin1': [200, {'content-type': 'text/html; charset=iso-8859-1'}, Buffer.concat([Buffer.from('<html><head><title>Caf'), Buffer.from([0xE9]), Buffer.from(' latin</title></head></html>')])],
  '/long': [200, HTML, html('L'.repeat(300))],
  '/newline': [200, HTML, html('First line\nsecond   line\r\nthird')],
  '/mustache': [200, HTML, html('{{url}} and {{{title}}} and {{source}}')],
  '/contains-url': [200, HTML, html('See http://www.example.com/page for more')],
  '/plain': [200, {'content-type': 'text/plain'}, '<title>Plain Text Title</title>'],
  '/json': [200, {'content-type': 'application/json'}, '{"title":"json"}'],
  '/no-content-type': [200, {}, html('No Content Type')],
  '/gzip': [200, {...HTML, 'content-encoding': 'gzip'}, zlib.gzipSync(html('Gzipped Title'))],
  '/big': [200, HTML, html('Big Page') + 'x'.repeat(2_000_000)],
  '/two-titles': [200, HTML, '<html><head><title>First</title><title>Second</title></head></html>'],
  '/svg-title': [200, HTML, '<html><body><svg><title>Svg Title</title></svg></body></html>'],
};

function originalUrl(request, via) {
  if (/^https?:\/\//i.test(request.url)) {
    return request.url;
  }

  if (via === 'https') {
    return `https://${request.headers.host}${request.url}`;
  }

  return request.headers['x-fixture-url'] ?? `http://${request.headers.host}${request.url}`;
}

function route(target, response, context) {
  let pathname;
  try {
    pathname = new URL(target).pathname;
  } catch {
    pathname = '/';
  }

  const special = SPECIAL[pathname];
  if (special === 'never') {
    context.hanging.add(response);
    return;
  }

  if (special) {
    const [status, headers, body] = special;
    response.writeHead(status, headers);
    response.end(body);
    return;
  }

  response.writeHead(200, HTML);
  response.end(html(`Page ${decodeURIComponent(pathname).replaceAll('<', '&lt;')}`));
}

// Options: {tls: {key, cert}} turns on the CONNECT proxy's TLS end; without it CONNECT is refused.
function start(options = {}) {
  const requests = [];
  const sockets = new Set();
  const context = {hanging: new Set()};
  let port = 0;

  const scrub = value => value.split(String(port)).join('{{port}}');
  const log = (request, via, url) => {
    requests.push({
      via,
      method: request.method,
      url: scrub(url),
      httpVersion: request.httpVersion,
      rawHeaders: request.rawHeaders.map(value => scrub(value)),
    });
  };

  const handler = via => (request, response) => {
    const url = originalUrl(request, via);
    log(request, via, url);
    route(url, response, context);
  };

  const server = http.createServer(handler('http'));
  const tlsServer = options.tls ? https.createServer({key: options.tls.key, cert: options.tls.cert}, handler('https')) : undefined;
  for (const each of [server, tlsServer].filter(Boolean)) {
    each.on('connection', socket => {
      sockets.add(socket);
      socket.on('close', () => sockets.delete(socket));
    });
  }

  server.on('connect', (request, socket, head) => {
    log(request, 'proxy', request.url);
    if (!tlsServer) {
      socket.end('HTTP/1.1 502 Bad Gateway\r\nContent-Length: 0\r\n\r\n');
      return;
    }

    socket.write('HTTP/1.1 200 Connection Established\r\n\r\n');
    if (head && head.length > 0) {
      socket.unshift(head);
    }

    tlsServer.emit('connection', socket);
  });

  return new Promise(resolve => {
    server.listen(0, '127.0.0.1', () => {
      port = server.address().port;
      resolve({
        port,
        base: `http://127.0.0.1:${port}`,
        proxy: `http://127.0.0.1:${port}`,
        requests,
        dropConnections() {
          for (const response of context.hanging) {
            response.destroy();
          }

          context.hanging.clear();
          for (const socket of sockets) {
            socket.destroy();
          }
        },
        close: () => new Promise(done => {
          for (const socket of sockets) {
            socket.destroy();
          }

          server.close(() => done());
        }),
      });
    });
  });
}

module.exports = {start, SPECIAL_PATHS: Object.keys(SPECIAL)};
