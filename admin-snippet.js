
// Add this to worker.js fetch handler for admin lengths upload (paste inside fetch function before return 404)
if(url.pathname==="/api/admin/lengths" && request.method==="POST"){
  const secret=url.searchParams.get("secret") || request.headers.get("x-cron-secret");
  if(secret !== env.CRON_SECRET) return new Response(JSON.stringify({error:"unauthorized"}), {status:401, headers});
  const data=await request.json();
  for(const [k,v] of Object.entries(data)){
    const length = typeof v==="number" ? v : v.length || v.optimalLength || 450;
    await env.LENGTHS_KV.put(k, JSON.stringify({optimalLength:length, length, updatedAt:Date.now()}));
  }
  return new Response(JSON.stringify({saved:Object.keys(data).length}), {headers});
}
