// Only complete, build-listed static responses may cross an encoding variant.
// CacheStorage contains Fetch-decoded bytes. Chromium audio adds an identity
// Accept-Encoding header, while cache.addAll stores a headerless request key.
export async function matchPrecached(cache,request,urls){
 if(request.method!=='GET'||!urls.has(request.url))return;
 const response=await cache.match(request);
 if(response)return response;
 const canonical=await cache.match(request.url,{ignoreVary:true});
 const vary=canonical?.headers.get('Vary')?.split(',').map(h=>h.trim().toLowerCase());
 if(canonical?.status===200&&['basic','default'].includes(canonical.type)&&vary?.every(h=>h==='accept-encoding'))return canonical;
 // Never bypass Origin, Cookie, Authorization, Accept-Language, or Vary: *.
}

export async function rangeResponse(response,range){
 const parts=/^bytes=(\d*)-(\d*)$/.exec(range??'');
 // Ignore malformed/unsupported ranges, including multipart; do not invent 206.
 if(!parts||(!parts[1]&&!parts[2]))return response;
 const data=await response.arrayBuffer(),length=data.byteLength;
 const start=parts[1]?Number(parts[1]):Math.max(0,length-Number(parts[2]));
 const end=parts[1]&&parts[2]?Math.min(Number(parts[2]),length-1):length-1;
 if(start>=length||start>end)return new Response(null,{status:416,headers:{'Content-Range':'bytes */'+length,'Content-Length':'0','Accept-Ranges':'bytes'}});
 return new Response(data.slice(start,end+1),{status:206,headers:{'Content-Type':response.headers.get('Content-Type')||'application/octet-stream','Content-Range':'bytes '+start+'-'+end+'/'+length,'Content-Length':String(end-start+1),'Accept-Ranges':'bytes'}});
}
