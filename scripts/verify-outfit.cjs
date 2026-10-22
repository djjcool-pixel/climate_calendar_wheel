/* Exercise local clothing rules against all shipped climate data. No browser required. */
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const html = fs.readFileSync(path.resolve(__dirname, '../index.html'), 'utf8');
const source = html.split("(()=>{'use strict';")[1].split('function svgEl(')[0];
const {CITIES, value, idxToDate, clothingAdvice} = new Function('document', source + ';return {CITIES,value,idxToDate,clothingAdvice};')({getElementById: () => ({})});
let cases = 0;
for (const [city, data] of Object.entries(CITIES)) {
  for (let day = 0; day < 365; day++) {
    const month = idxToDate(day).monthIndex;
    const climate = {mean:value(city,'mean',day), low:value(city,'low',day), high:value(city,'high',day), humidity:data.humidity[month], rain:data.rain[month]};
    assert.ok(Object.values(climate).every(Number.isFinite), `${city}/${day} needs finite climate inputs`);
    const advice = clothingAdvice(climate);
    assert.equal(advice.items.length, 4);
    assert.equal(advice.quick.length, 4);
    assert.ok(advice.quick.every(text => text.length > 0 && text.length <= 4), 'icon captions must remain short and meaningful');
    assert.ok([advice.label, ...advice.items, advice.layer, advice.extra].every(text => typeof text === 'string' && text.length > 0 && !/NaN|undefined/.test(text)));
    if (climate.rain >= 100) assert.match(advice.extra, /该月降水/, 'monthly rain must not be presented as a daily forecast');
    if (climate.low < 5) assert.match(advice.layer, /保暖/);
    cases++;
  }
}
const mild = {mean:20,low:16,high:25,humidity:50,rain:30};
const ordinary = clothingAdvice(mild), coldMorning = clothingAdvice({...mild,low:7});
assert.notEqual(coldMorning.items[1], ordinary.items[1], 'cold mornings must add a warmer outer layer even on a mild day');
assert.match(coldMorning.layer, /分层穿/);
assert.match(clothingAdvice({...mild,mean:-8,low:-14,high:-2}).items[1], /羽绒/);
assert.match(clothingAdvice({...mild,mean:30,low:26,high:34}).items[0], /透气/);
console.log(JSON.stringify({passed:true,cityDateCases:cases,coldMorningLayering:true,monthlyRainWording:true}));
