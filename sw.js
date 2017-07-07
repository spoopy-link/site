if (!Cache.prototype.add) {
  Cache.prototype.add = function add(request) {
    return this.addAll([request]);
  };
}

if (!Cache.prototype.addAll) {
  Cache.prototype.addAll = function addAll(requests) {
    var cache = this;

    // Since DOMExceptions are not constructable:
    function NetworkError(message) {
      this.name = 'NetworkError';
      this.code = 19;
      this.message = message;
    }
    NetworkError.prototype = Object.create(Error.prototype);

    return Promise.resolve().then(function() {
      if (arguments.length < 1) throw new TypeError();

      // Simulate sequence<(Request or USVString)> binding:
      var sequence = [];

      requests = requests.map((request) => {
        if (request instanceof Request) {
          return request;
        } else {
          return String(request); // may throw TypeError
        }
      });

      return Promise.all(
        requests.map((request) => {
          if (typeof request === 'string') {
            request = new Request(request);
          }

          var scheme = new URL(request.url).protocol;

          if (scheme !== 'http:' && scheme !== 'https:') {
            throw new NetworkError('Invalid scheme');
          }

          return fetch(request.clone());
        })
      );
    }).then((responses) =>
      // TODO: check that requests don't overwrite one another
      // (don't think this is possible to polyfill due to opaque responses)
       Promise.all(
        responses.map((response, i) => cache.put(requests[i], response))
      )).then(() => undefined);
  };
}

if (!CacheStorage.prototype.match) {
  // This is probably vulnerable to race conditions (removing caches etc)
  CacheStorage.prototype.match = function match(request, opts) {
    var caches = this;

    return this.keys().then((cacheNames) => {
      var match;

      return cacheNames.reduce((chain, cacheName) => chain.then(() => match || caches.open(cacheName).then((cache) => cache.match(request, opts)).then((response) => {
        match = response;
        return match;
      })), Promise.resolve());
    });
  };
}

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open('spoopy.link')
    .then((cache) => cache.addAll([
      '/',
      '/main.js',
      '/main.css',
      'https://s.gus.host/fira/FiraCode.css',
      'https://s.gus.host/fira/FiraCode-Medium.ttf',
      'https://s.gus.host/fira/FiraCode-Regular.ttf',
    ])));
});


self.addEventListener('fetch', (event) => {
  console.log('SW REQ', event.request.url);
  const res = caches.match(event.request)
    .then((r) => r || fetch(event.request))
    .catch(() => console.log('Failed to fetch', event.request.url));
  event.respondWith(res);
});
