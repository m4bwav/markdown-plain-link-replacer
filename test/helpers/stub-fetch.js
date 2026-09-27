/*
A fetch that answers at once, in the process, for suites that check what the library finds and writes rather than how it
talks to a server. `answer(url)` returns {status, type, body} (defaults: 200, text/html, an empty page); every URL asked for is
recorded in `state.urls`. Nothing leaves the process.
*/
export function stubFetch(answer) {
  const original = fetch;
  const state = {
    urls: [],
    answer,
    restore() {
      globalThis.fetch = original;
    },
  };

  globalThis.fetch = async input => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    if (url.username || url.password) {
      throw new TypeError(`Request cannot be constructed from a URL that includes credentials: ${url.href}`);
    }

    url.hash = '';
    state.urls.push(url.href);
    const {status = 200, type = 'text/html; charset=utf-8', body = '<html></html>'} = state.answer(url) ?? {};
    return new Response(body, {status, headers: {'content-type': type}});
  };

  return state;
}

export const escapeHtml = text => text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');

// A page whose title get-title-at-url reads back as `title` (no separators in it, so nothing is cut).
export const pageTitled = title => ({body: `<!doctype html><html><head><title>${escapeHtml(title)}</title></head></html>`});
