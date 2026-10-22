/* Sustained wardrobe transitions, not date-specific forecasts. */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const source=fs.readFileSync(path.resolve(__dirname,'../index.html'),'utf8').split("(()=>{'use strict';")[1].split('function svgEl(')[0];
const {CITIES,wardrobeDates,clothingAdvice,value}=new Function('document',source+';return{CITIES,wardrobeDates,clothingAdvice,value};')({getElementById:()=>({})});
let count=0;
for(const city of Object.keys(CITIES)){
 const markers=wardrobeDates(city);assert.ok(markers.length>0&&markers.length<=4);
 assert.equal(wardrobeDates(city),markers,'each city must reuse its cached transition scan');
 assert.equal(new Set(markers.map(m=>m.threshold+'|'+m.direction)).size,markers.length);
 for(const marker of markers){
  assert.ok(Number.isInteger(marker.day)&&marker.day>=0&&marker.day<365);
  for(let offset=-7;offset<7;offset++){
   const mean=value(city,'mean',(marker.day+offset+365)%365);
   const inNewLayer=marker.direction===1?mean>=marker.threshold:mean<marker.threshold;
   assert.equal(inNewLayer,offset>=0,'a cue must separate a week in the old clothing layer from a week in the new one');
  }
  const day=marker.day,mean=value(city,'mean',day),low=value(city,'low',day),high=value(city,'high',day);
  const advice=clothingAdvice({mean,low,high,humidity:50,rain:0});
  if(marker.threshold===24)assert.equal(['warm','hot'].includes(advice.id),marker.direction===1,'summer cues must agree with the clothing rule');
  if(marker.threshold===12)assert.equal(['freezing','cold','chilly'].includes(advice.id),marker.direction===-1,'warm outer-layer cues must agree with the clothing rule');
  count++;
 }
}
assert.ok(wardrobeDates('kunming').every(m=>m.threshold===12),'Kunming must not invent a summer threshold it never reaches');
assert.ok(wardrobeDates('guangzhou').every(m=>m.threshold===24),'Guangzhou must not invent a winter threshold it never reaches');
const morning=clothingAdvice({mean:20,low:7,high:27,humidity:50,rain:0});assert.match(morning.quick[1],/保暖/);
console.log(JSON.stringify({passed:true,cities:9,sustainedSeasonCues:count,cached:true,clothingAgreement:true}));
