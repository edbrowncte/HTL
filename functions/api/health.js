
export async function onRequestGet(context){
  return new Response(JSON.stringify({ok:true, time:Date.now(), source:"pages-functions"}), {headers:{"Content-Type":"application/json","Access-Control-Allow-Origin":"*"}});
}
