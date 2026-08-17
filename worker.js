
// Cloudflare Worker - HTL Oracle - No Terminal Deploy - Dashboard Paste
// Handles 10ms limit by processing 1 pair per cron run, rotating through 28 pairs
// KV Bindings: HTL_KV (for schedules), LENGTHS_KV (for optimal lengths)

const PAIRS = ["AUDCAD","AUDCHF","AUDJPY","AUDNZD","AUDUSD","CADCHF","CADJPY","CHFJPY","EURAUD","EURCAD","EURCHF","EURGBP","EURJPY","EURNZD","EURUSD","GBPAUD","GBPCAD","GBPCHF","GBPJPY","GBPNZD","GBPUSD","NZDCAD","NZDCHF","NZDJPY","NZDUSD","USDCAD","USDCHF","USDJPY"];
const TFS = [{oanda:"M5",sec:300},{oanda:"M15",sec:900},{oanda:"M30",sec:1800},{oanda:"H1",sec:3600},{oanda:"H4",sec:14400}];

function pipSizePair(pair){ return pair.includes("JPY") ? 0.01 : 0.0001; }
function mean(arr){ return arr.length ? arr.reduce((s,v)=>s+v,0)/arr.length : 0; }
function htlCross(a,b,idx){
  if(!Number.isFinite(a[idx]) || !Number.isFinite(b[idx]) || !Number.isFinite(a[idx-1]) || !Number.isFinite(b[idx-1])) return 0;
  const prev = a[idx-1]-b[idx-1]; const curr = a[idx]-b[idx];
  if(prev <=0 && curr >0) return 1; if(prev >=0 && curr <0) return -1; return 0;
}
function computeHTLCore(candles, length){
  const n=candles.length; const closes=candles.map(c=>c.close); const hl2=candles.map(c=>(c.high+c.low)/2);
  function ema(arr, period){ const k=2/(period+1); const out=new Array(arr.length).fill(NaN); let prev=arr[0]; for(let i=0;i<arr.length;i++){ if(!Number.isFinite(arr[i])){out[i]=NaN; continue;} if(i===0) prev=arr[i]; else prev=arr[i]*k+prev*(1-k); out[i]=prev; } return out; }
  function sma(arr, period){ const out=new Array(arr.length).fill(NaN); for(let i=period-1;i<arr.length;i++){ let sum=0,cnt=0; for(let j=0;j<period;j++){ if(Number.isFinite(arr[i-j])){sum+=arr[i-j]; cnt++;}} if(cnt===period) out[i]=sum/period; } return out; }
  const upr=ema(closes,length); const ui=sma(hl2,Math.max(5,Math.floor(length/3))); const mui=ema(hl2,Math.max(10,Math.floor(length/2))); const iuz=sma(closes,Math.max(10,Math.floor(length/1.5))); const zui=ema(hl2,length*2);
  const anchors=[]; 
  for(let i=1;i<n;i++){ const c1=htlCross(hl2,upr,i); const c2=htlCross(mui,ui,i); const c3=htlCross(zui,iuz,i); const votes=(c1!==0?1:0)+(c2!==0?1:0)+(c3!==0?1:0); if(votes>=2){ const dir=(c1||c2||c3); if(dir!==0) anchors.push({index:i, price:candles[i].close, direction:dir}); } }
  return {anchors, closes, hl2, upr};
}

async function fetchOANDA(pair, granularity, count, token, env){
  const url=`https://api-fx${env==="live" ? "trade" : "practice"}.oanda.com/v3/instruments/${pair}/candles?granularity=${granularity}&count=${count}&price=M`;
  const res=await fetch(url,{headers:{Authorization:`Bearer ${token}`}});
  if(!res.ok) throw new Error(`OANDA ${pair} ${res.status}`);
  const json=await res.json();
  return json.candles.filter(c=>c.complete).map(c=>({time:c.time, open:parseFloat(c.mid.o), high:parseFloat(c.mid.h), low:parseFloat(c.mid.l), close:parseFloat(c.mid.c)}));
}

function computeSchedule(candles, htl, pair, tf){
  if(!htl.anchors.length) return null;
  const last=htl.anchors[htl.anchors.length-1]; const age=candles.length-1-last.index; const currentPrice=candles[candles.length-1].close;
  const durations=[]; for(let i=1;i<htl.anchors.length;i++) durations.push(htl.anchors[i].index-htl.anchors[i-1].index);
  const completion5=durations.length?durations.filter(d=>d<=age+5).length/durations.length:0;
  return {pair, timeframe:tf.oanda, length:450, currentPrice, currentEvent:last.direction>0?"High Anchor":"Low Anchor", location: currentPrice>candles[last.index].close?"Above Anchor":"Below Anchor", completion5, age, meanDur:mean(durations), events:htl.anchors.length};
}

export default {
  async fetch(request, env, ctx){
    const url=new URL(request.url);
    const headers={"Access-Control-Allow-Origin":"*","Content-Type":"application/json"};

    if(url.pathname==="/api/health"){
      return new Response(JSON.stringify({ok:true, time:Date.now(), pairs:PAIRS.length, kv: !!env.HTL_KV}), {headers});
    }

    if(url.pathname==="/api/global"){
      // Check NFT gate if wallet provided
      const wallet=url.searchParams.get("wallet") || request.headers.get("x-wallet-address");
      // For now allow all, add NFT check later via Alchemy API
      const globalData=await env.HTL_KV.get("GLOBAL", {type:"json"});
      if(!globalData) return new Response(JSON.stringify({schedules:[], eval:[], message:"Oracle warming up - cron runs every 5 min, 1 pair per run"}), {headers});
      return new Response(JSON.stringify(globalData), {headers});
    }

    if(url.pathname.startsWith("/api/htl/")){
      const pair=url.pathname.split("/").pop().toUpperCase();
      const data=await env.HTL_KV.get(pair, {type:"json"});
      if(!data) return new Response(JSON.stringify({error:"not found - wait for cron"}), {status:404, headers});
      return new Response(JSON.stringify(data), {headers});
    }

    if(url.pathname==="/api/lengths"){
      const all=[];
      for(const pair of PAIRS){ for(const tf of TFS){ const key=`${pair}_${tf.oanda}`; const val=await env.LENGTHS_KV.get(key, {type:"json"}); if(val) all.push({key, ...val}); } }
      return new Response(JSON.stringify(all), {headers});
    }

    if(url.pathname==="/api/trigger"){
      const secret=url.searchParams.get("secret") || request.headers.get("x-cron-secret");
      if(secret !== env.CRON_SECRET) return new Response(JSON.stringify({error:"unauthorized"}), {status:401, headers});
      // Run one pair immediately
      ctx.waitUntil(this.scheduled({cron:"*/5 * * * *"}, env, ctx));
      return new Response(JSON.stringify({triggered:true}), {headers});
    }

    // Serve landing page for frontend hosting
    if(url.pathname==="/" || url.pathname==="/index.html"){
      return new Response(`
        <h1>HTL Oracle - Cloudflare Worker - No Terminal</h1>
        <p>24/7 via Cron Triggers every 5 min - 1 pair per run to stay under 10ms free limit</p>
        <ul>
          <li><a href="/api/health">/api/health</a></li>
          <li><a href="/api/global">/api/global</a></li>
          <li><a href="/api/htl/EURUSD">/api/htl/EURUSD</a></li>
          <li><a href="/api/lengths">/api/lengths</a></li>
        </ul>
        <p>Frontend: Upload your Oanda-HTL-Complete-Eval-With-Admin-Length-Optimizer.html to Cloudflare Pages (drag & drop, no terminal)</p>
        <p>Set KV namespaces: HTL_KV and LENGTHS_KV in Worker Settings > Variables</p>
      `, {headers:{"Content-Type":"text/html"}});
    }

    return new Response("not found", {status:404});
  },

  async scheduled(event, env, ctx){
    console.log("Cron triggered", new Date().toISOString());
    // Rotate through pairs: use KV to track index
    let idx=await env.HTL_KV.get("ROTATION_IDX", {type:"json"});
    if(idx===null) idx=0;
    const pair=PAIRS[idx % PAIRS.length];
    const tf= {oanda:"M5", sec:300}; // Start with M5 only for 10ms limit, expand after you upgrade to $5 Workers Paid (50ms)

    try{
      // Get optimal length if exists
      const lengthKey=`${pair}_${tf.oanda}`;
      const lengthData=await env.LENGTHS_KV.get(lengthKey, {type:"json"});
      const length=lengthData ? (lengthData.optimalLength || lengthData.length || 450) : 450;

      const candles=await fetchOANDA(pair, tf.oanda, 5000, env.OANDA_TOKEN, env.OANDA_ENV||"practice");
      const htl=computeHTLCore(candles, length);
      const schedule=computeSchedule(candles, htl, pair, tf);
      if(schedule){
        await env.HTL_KV.put(pair, JSON.stringify({schedule, updatedAt: Date.now(), candles: candles.slice(-50)}));
        // Update GLOBAL aggregate
        let globalSchedules=[];
        for(const p of PAIRS){ const d=await env.HTL_KV.get(p, {type:"json"}); if(d && d.schedule) globalSchedules.push(d.schedule); }
        globalSchedules.sort((a,b)=> b.completion5 - a.completion5);
        await env.HTL_KV.put("GLOBAL", JSON.stringify({schedules:globalSchedules, eval:globalSchedules, updatedAt: Date.now()}));
        console.log(`✓ ${pair} L=${length} events=${schedule.events} age=${schedule.age}`);
      }
    }catch(e){
      console.error(`✗ ${pair}`, e.message);
    }

    // Increment rotation
    idx=(idx+1) % PAIRS.length;
    await env.HTL_KV.put("ROTATION_IDX", JSON.stringify(idx));
  }
}
