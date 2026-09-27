/*
Points every fetch at the local fixture server (test/golden/fixture-server.cjs), so no test reaches the internet. The library
(through get-title-at-url and is-an-image-url) fetches whatever links the markdown holds; this replaces globalThis.fetch with
a wrapper that records each URL, and sends the request to the fixture server with the URL it meant in an `x-fixture-url`
header, which the server routes by. Redirects are followed here, one request per hop as a real fetch makes them (at most 20,
then a failure as undici reports it), because the server's Location is relative to the URL it was asked for, not to its own
address. As fetch does, a URL with a user name or password, or a scheme other than http and https, fails without a request.
*/
export function installFetch(server) {
  const original = fetch;
  const state = {
    server,
    urls: [],
    restore() {
      globalThis.fetch = original;
    },
  };

  globalThis.fetch = async (input, init = {}) => {
    let url = new URL(input instanceof Request ? input.url : String(input));
    if (url.username || url.password) {
      throw new TypeError(`Request cannot be constructed from a URL that includes credentials: ${url.href}`);
    }

    for (let hops = 0; ; hops++) {
      if (url.protocol !== 'http:' && url.protocol !== 'https:') {
        throw new TypeError('fetch failed', {cause: new Error(`unsupported scheme ${url.protocol}`)});
      }

      // A fragment is never sent.
      url.hash = '';
      state.urls.push(url.href);
      const headers = new Headers(init.headers);
      headers.set('x-fixture-url', url.href);

      const response = await original(`${state.server.base}${url.pathname}${url.search}`, {...init, headers, redirect: 'manual'});
      const location = response.headers.get('location');
      if (location !== null && response.status >= 300 && response.status < 400 && (init.redirect ?? 'follow') === 'follow') {
        await response.body?.cancel();
        if (hops === 20) {
          throw new TypeError('fetch failed', {cause: new Error('redirect count exceeded')});
        }

        url = new URL(location, url);
        continue;
      }

      return response;
    }
  };

  return state;
}
