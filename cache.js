addEventListener('fetch', event => {
    const {request} = event
    return event.respondWith(handleRequest(request, event));
});

async function handleRequest(request, evnt) {
    const doh = '@@@上游地址@@@'
    const contype = 'application/dns-message'
    const {method, headers, url} = request
    const {host, searchParams} = new URL(url)
    const cache = caches.default;

    if (method == 'GET' && searchParams.has('dns')) {
        const query_string = searchParams.get('dns')
        if (query_string == "REDACTED"){
            return new Response('', {status: 200})
        }

        const cacheKey = new URL("http://dns.lan/" + query_string)
        let response = await cache.match(cacheKey);

        if (!response) {
            response = await QuerySource(doh, 'GET', contype, query_string);
            response = new Response(response.body, response);
            evnt.waitUntil(cache.put(cacheKey, response.clone()))
        }
        return response
    } else if (method == 'POST' && headers.get('content-type') == 'application/dns-message') {
        const body = await request.arrayBuffer()
        const cacheKey = new URL("http://dns.lan/" + body)
        let response = await cache.match(cacheKey);

        if (!response) {
            response = await QuerySource(doh, 'POST', contype, body)
            response = new Response(response.body, response);
            evnt.waitUntil(cache.put(cacheKey, response.clone()))
        }
        return response
    }

    return new Response('', {status: 410})
}

async function QuerySource(addr, method, contype, queryParmas) {
    if (method == 'GET') {
        return await fetch(addr + '?dns=' + queryParmas, {
            method: 'GET',
            headers: {
                'Accept': contype,
            }
        });
    } else if (method == 'POST') {
        return await fetch(addr, {
            method: 'POST',
            headers: {
                'Accept': contype,
                'Content-Type': contype,
            },
            body: queryParmas
        });
    }
}
