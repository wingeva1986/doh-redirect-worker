import * as dnsPacket from 'dns-packet'
import { Buffer } from 'buffer'
import { connect } from 'cloudflare:sockets';

const DOH_ADDRESS = "https://dns.google/dns-query"
const DNS_ADDRESS = { hostname: "8.8.4.4", port: 53 };
const R404 = new Response(null, {status: 404});
const ECS_CODE = 'CLIENT_SUBNET';
const ECS_IP='182.239.127.137';//hkm data center


export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    let res = R404;
    const { method, headers, url } = request;
    let clientIp = ECS_IP || headers.get('CF-Connecting-IP');
    const sourcePrefixLength = clientIp.includes(':') ? 48 : 24;
    const searchParams = new URL(url).searchParams;

    if (method == 'GET' && searchParams.has('dns')) {
        const query_string = searchParams.get('dns')  
        if (query_string == "REDACTED"){
            return new Response('', {status: 200})
        }
        //dns packet
        const dnsMsg = dnsPacket.decode(Buffer.from(query_string, 'base64'))
        console.log(dnsMsg)
       
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
        const startTime2 = performance.now();
        const modifiedBody = dnsPacket.streamEncode(dnsMsg);//tcp encode
        
	const socket = connect(DNS_ADDRESS);
	const writer = socket.writable.getWriter();
	await writer.write(modifiedBody);

        /*// 创建一个新的ReadableStream，它将跳过原始流的前两个字节
	const modifiedStream = new ReadableStream({
	    async start(controller) {
	      const reader = socket.readable.getReader();
	      const { done, value } = await reader.read(); // 读取原始流中的第一个数据块
	      if (done) {
		controller.close();
		return;
	      }
	      // 假定原始流中第一个数据块包含了我们要跳过的两个字节，并且还有额外的数据
	      // 跳过前两个字节，并且将剩下的数据入队到新的流中
	      controller.enqueue(value.slice(2));
	      // 将原始流中剩下的数据复制到新的流，这是必要的，以防原始流中第一个数据块不包含全部数据
	      reader.releaseLock();
	      // 将原始流中剩下的数据复制到新的流
	      socket.readable.pipeTo(new WritableStream({
		write(chunk) {
		  controller.enqueue(chunk);
		},
		close() {
		  controller.close();
		},
		abort(err) {
		  controller.error(err);
		}
	      }));
	    }
	});*/
	 // 读取流
 const reader = socket.readable.getReader();
	    let chunks = []; // 存储数据块的数组
	    let receivedLength = 0; // 收集的数据长度
  while (true) {
    const { done, value } = await reader.read();
    
    if (done) {
      break;
    }
    
    chunks.push(value);
	  receivedLength += value.length;

  }

  // 合并所有的 `Uint8Array` chunks 到一个新的 Uint8Array
  let allChunks = new Uint8Array(receivedLength);
  let position = 0;
  for (let chunk of chunks) {
    allChunks.set(chunk, position);
    position += chunk.length;
  }
	res = new Response(allChunks.slice(2), { headers: { "Content-Type": "application/dns-message" } });
	const endTime2 = performance.now();
	console.log(`connect耗时: ${endTime2 - startTime2} 毫秒`);
	//ctx.waitUntil(socket.close());
       /*
       const startTime1 = performance.now();
       const modifiedBody1 = dnsPacket.encode(dnsMsg)
       const newRequest = new Request(DOH_ADDRESS, {
          body: modifiedBody1,
          headers: {
	      'content-type': 'application/dns-message',
	  },
          method: "POST",
        });
	
      
        
        res = await fetch(newRequest);
        const endTime1 = performance.now();
	console.log(`fetch耗时: ${endTime1 - startTime1} 毫秒`);
	if (res.ok) {
		try{
			  // Assume the response is a ReadableStream and needs to be read as ArrayBuffer
			  const responseBodyBuffer = await res.clone().arrayBuffer();
			  let dd= dnsPacket.decode(Buffer.from(responseBodyBuffer))
			  console.log(dd);
		  } catch (error) {
		    // Properly handle decoding errors here
		    console.error('Decoding error:', error.message);
		    // Respond with a proper error response to the user/client
		    //return new Response('Decoding error', {status: 500});
		  }
	}*/

    }
    return res;
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
	    

        //console.log(res.status)
    } 
    return res;
}
*/
