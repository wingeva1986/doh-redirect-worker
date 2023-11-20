// SPDX-License-Identifier: 0BSD

const doh = 'https://dns.google/dns-query'
const dohjson = 'https://dns.google/resolve'
const contype = 'application/dns-message'
const jstontype = 'application/dns-json'
const r404 = new Response(null, {status: 404});

// developers.cloudflare.com/workers/runtime-apis/fetch-event/#syntax-module-worker
export default {
    async fetch(r, env, ctx) {
        return handleRequest(r);
    },
};

async function handleRequest(request) {
    // when res is a Promise<Response>, it reduces billed wall-time
    // blog.cloudflare.com/workers-optimization-reduces-your-bill
 
    let res = r404;
    const { method, headers, url } = request
    //let clientIp =headers.get('CF-Connecting-IP');
    //const sourcePrefixLength = clientIp.includes(':') ? 48 : 24;
    const ecs = '&edns_client_subnet=221.179.3.0/24&ecs=221.179.3.0/24';//clientIp?`&edns_client_subnet=${clientIp}/${sourcePrefixLength}`:'';
    const searchParams = new URL(url).searchParams
    console.log(ecs)


    if (method == 'GET' && searchParams.has('dns')) {
        const query_string = searchParams.get('dns')
        //console.log('dns:'+query_string)         
        if (query_string == "REDACTED"){
            return new Response('', {status: 200})
        }
        /*const cacheKey = "http://dns.lan/"+query_string.substring(12);
        const cache = caches.default;
        const rCache = await cache.match(cacheKey);
        if (rCache){
            console.log('hit:'+cacheKey)
            console.log(rCache.body)
            return rCache;
        }*/
        res = await fetch(doh + '?dns=' + query_string+ecs, {
            method: 'GET',
            headers: {
                'Accept': contype,
            }
        });

        /*if (res.ok){
            //console.log('put:'+cacheKey)
            res = new Response(res.body, {
                headers: { 'Content-Type': contype,'Cache-Control':'public, max-age=500' },
                status: res.status,
                statusText: res.statusText,
              })

            //await cache.put(cacheKey, res.clone()); 
           
        }
        //console.log('normal')*/

    } else if (method === 'POST' && headers.get('content-type') === contype) {
        // streaming out the request body is optimal than awaiting on it
        const rostream = request.body;
        res = await fetch(doh, {
            method: 'POST',
            headers: {
                'Accept': contype,
                'Content-Type': contype,
            },
            body: rostream,
        });

    } else if (method === 'GET' && headers.get('Accept') === jstontype) {
        const search = new URL(url).search
        res = await fetch(dohjson + search + ecs, {
            method: 'GET',
            headers: {
                'Accept': jstontype,
            }
        });
        const secondCheck = res.clone().json();
        if (secondCheck['Status'] != 0) {
            // Some request name can't work with edns
            // "Status": 5 /* REFUSED */,
            res = await fetch(dohjson + search, {
                method: 'GET',
                headers: {
                    'Accept': jstontype,
                }
            });
        }

    }

    
 
    return res;
}
