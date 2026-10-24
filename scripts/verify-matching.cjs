/* Compare the numeric optimizer with the original lookup-based scorer and tie rules. */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const source=fs.readFileSync(path.resolve(__dirname,'../index.html'),'utf8').split("(()=>{'use strict';")[1].split('// Simple, local wardrobe rules:')[0];
const {CITIES,state,matchDate,matchCache,value,trend,circularDist,normalizedRain}=new Function('document',source+';return{CITIES,state,matchDate,matchCache,value,trend,circularDist,normalizedRain};')({getElementById:()=>({})});
function reference(day){
 const from=state.source,to=state.mode==='same'?from:state.target,sourceTrend=Math.sign(trend(from,day));let best=null;
 for(let candidate=0;candidate<365;candidate++){
  if(state.mode==='same'){
   if(circularDist(day,candidate)<42)continue;
   const slope=Math.sign(trend(to,candidate));if(sourceTrend&&slope&&sourceTrend===slope)continue;
  }
  const temp=Math.abs(value(from,state.metric,day)-value(to,state.metric,candidate));
  const delta=key=>Math.abs(value(from,key,day)-value(to,key,candidate));
  const score=state.algorithm==='temp'?temp:Math.sqrt(.50*(temp/2.5)**2+.13*(delta('mean')/3)**2+.10*(delta('high')/4)**2+.10*(delta('low')/4)**2+.10*(delta('humidity')/13)**2+.07*(Math.abs(normalizedRain(from,day)-normalizedRain(to,candidate))/3)**2);
  const tie=state.mode==='same'?-circularDist(day,candidate):((Math.sign(trend(to,candidate))!==sourceTrend?1:0)*366+circularDist(day,candidate));
  if(!best||score<best.score-.015||(Math.abs(score-best.score)<=.015&&tie<best.tie))best={index:candidate,score,tie};
 }
 return best?best.index:(day+182)%365;
}
let cases=0,configurations=0;
for(const mode of ['same','cross'])for(const from of Object.keys(CITIES))for(const to of mode==='same'?['tokyo']:Object.keys(CITIES).filter(city=>city!==from))for(const metric of ['mean','high','low'])for(const algorithm of ['temp','climate']){
 Object.assign(state,{mode,source:from,target:to,metric,algorithm});
 for(let day=0;day<365;day++){assert.equal(matchDate(day),reference(day),[mode,from,to,metric,algorithm,day].join('/'));cases++}
 assert.equal(matchDate(100),reference(100),'cached and first-pass answers must agree');assert.ok(matchCache.size<=16);configurations++;
}
console.log(JSON.stringify({passed:true,configurations,cityDateCases:cases,exactNumericEquivalence:true,boundedCache:true}));
