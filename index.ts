import * as dnsPacket from 'node:dns-packet'
import { Buffer } from 'node:buffer'

const DOH_ADDRESS = "cloudflare-dns.com/dns-query"

export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url)
    const { pathname, search } = url

    if (pathname == "/") {
      return new Response(`200 OK`, { status: 200 })
    }

    if (request.method !== "GET" && request.method !== "POST") {
      return new Response(`Method ${request.method} not allowed.`, { status: 405 })
    }

    // Get the client's IP address from the request headers
    const clientIp = request.headers.get('CF-Connecting-IP')

    if (!clientIp) {
      throw new Error('Client IP not found in request headers')
    }

    // Determine the source prefix length based on the IP address type
    const sourcePrefixLength = clientIp.includes(':') ? 48 : 24

    // Parse the DNS packet from the request body
    const body = await request.clone().arrayBuffer()
    const dnsMsg = dnsPacket.decode(Buffer.from(body))

    // Create an EDNS Client Subnet option
    const ecsOption = {
      code: 'CLIENT_SUBNET',
      ip: clientIp,
      sourcePrefixLength: sourcePrefixLength,
      scopePrefixLength: 0
    }

    // Add the EDNS option to the DNS packet
    dnsMsg.additionals.push({
      type: 'OPT',
      name: '.',
      udpPayloadSize: 4096,
      options: [ecsOption]
    })

    // Enable DNSSEC by setting the DO flag
    dnsMsg.flags |= (1 << 15)

    // Encode the modified DNS packet back into the request body
    const modifiedBody = dnsPacket.encode(dnsMsg)

    const newURL = `https://${DOH_ADDRESS}`
    const newRequest = new Request(newURL, {
      body: modifiedBody,
      headers: request.headers,
      method: request.method,
      redirect: request.redirect
    })

    return await fetch(newRequest)
  },
}

/*
const dnsPacket = require('node:dns-packet')
const Buffer = require('node:buffer').Buffer
const connect = require('cloudflare:sockets').connect;

const DOH_ADDRESS = "https://dns.google/dns-query"
const DNS_ADDRESS = { hostname: "8.8.4.4", port: 53 };

const r404 = new Response(null, {status: 404});
const ECS_CODE = 'CLIENT_SUBNET';
const ECS_IP='182.239.127.137';//hkm data center

// developers.cloudflare.com/workers/runtime-apis/fetch-event/#syntax-module-worker
addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request))
})

async function handleRequest(request) {
    let res = r404;
    const { method, headers, url } = request
    let clientIp = ECS_IP || headers.get('CF-Connecting-IP');
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
        const dnsMsg = dnsPacket.decode(Buffer.from(query_string, 'base64'))
        //console.log(dnsMsg)
       
        const ecsOption = {
          code: ECS_CODE,
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

	const socket = connect(DNS_ADDRESS);
	const writer = socket.writable.getWriter();
	await writer.write(modifiedBody);
	res = new Response(socket.readable, { headers: { "Content-Type": "application/dns-message" } });
	    
       /* const newRequest = new Request(DOH_ADDRESS, {
          body: modifiedBody,
          headers: {
	      'content-type': 'application/dns-message',
	  },
          method: "POST",
        });
      
        
        res = await fetch(newRequest)*/
        //console.log(res.status)
    } 
    return res;
}
*/
