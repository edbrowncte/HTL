
export async function onRequestGet(context){
  const {env} = context;
  // Try KV
  if(env.HTL_KV){
    const data=await env.HTL_KV.get("GLOBAL", {type:"json"});
    if(data) return new Response(JSON.stringify(data), {headers:{"Content-Type":"application/json","Access-Control-Allow-Origin":"*"}});
  }
  return new Response(JSON.stringify({schedules:[], message:"Oracle warming up - KV not bound or empty"}), {headers:{"Content-Type":"application/json","Access-Control-Allow-Origin":"*"}});
}
