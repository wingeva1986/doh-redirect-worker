const dnsPacket = require('dns-packet')
const Buffer = require('buffer').Buffer

const DOH_ADDRESS = "dns.google/dns-query"

const r404 = new Response(null, {status: 404});

// developers.cloudflare.com/workers/runtime-apis/fetch-event/#syntax-module-worker
export default {
    async fetch(r, env, ctx) {
        return handleRequest(r);
    },
};

async function handleRequest(request) {
    let res = r404;
    const { method, headers, url } = request
    let clientIp =headers.get('CF-Connecting-IP');
    const sourcePrefixLength = clientIp.includes(':') ? 48 : 24;
    //const ecs = '&edns_client_subnet=221.179.3.0/24&ecs=221.179.3.0/24';//clientIp?`&edns_client_subnet=${clientIp}/${sourcePrefixLength}`:'';
    const searchParams = new URL(url).searchParams

    if (method == 'GET' && searchParams.has('dns')) {
        const query_string = searchParams.get('dns')  
        if (query_string == "REDACTED"){
            return new Response('', {status: 200})
        }
        //dns packet
        //const body = await request.clone().arrayBuffer()
        const dnsMsg = dnsPacket.decode(Buffer.atob(query_string))
      
        const ecsOption = {
          code: 'CLIENT_SUBNET',
          ip: clientIp,
          sourcePrefixLength: sourcePrefixLength,
          scopePrefixLength: 0
        }
      
        dnsMsg.additionals.push({
          type: 'OPT',
          name: '.',
          udpPayloadSize: 4096,
          options: [ecsOption]
        })
      
        dnsMsg.flags |= (1 << 15)
      
        const modifiedBody = dnsPacket.encode(dnsMsg)
      
        const newURL = `https://${DOH_ADDRESS}`
        const newRequest = new Request(newURL, {
          body: modifiedBody,
          headers: headers,
          method: "POST",
        })
        //
        res = await fetch(newRequest)
    } 
    return res;
}
