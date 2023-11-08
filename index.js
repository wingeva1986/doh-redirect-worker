const dnsPacket = require('dns-packet')
const Buffer = require('buffer').Buffer

const DOH_ADDRESS = "cloudflare-dns.com/dns-query"

addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request))
})

async function handleRequest(request) {
  const url = new URL(request.url)
  const { pathname, search } = url

  if (pathname == "/") {
    return new Response(`200 OK`, { status: 200 })
  }

  if (request.method !== "GET" && request.method !== "POST") {
    return new Response(`Method ${request.method} not allowed.`, { status: 405 })
  }

  const clientIp = request.headers.get('CF-Connecting-IP')

  if (!clientIp) {
    throw new Error('Client IP not found in request headers')
  }

  const sourcePrefixLength = clientIp.includes(':') ? 48 : 24

  const body = await request.clone().arrayBuffer()
  const dnsMsg = dnsPacket.decode(Buffer.from(body))

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
    headers: request.headers,
    method: request.method,
    redirect: request.redirect
  })

  return await fetch(newRequest)
}
