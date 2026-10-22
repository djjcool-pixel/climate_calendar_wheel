/* Real native range gestures, cancellation, keyboard and touch scrolling. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const {chromium,firefox,webkit} = require('playwright');
const html = fs.readFileSync(path.resolve(__dirname,'../index.html'));
const server = http.createServer((req,res) => {res.setHeader('Content-Type','text/html; charset=utf-8');res.end(html);});
const selected = page => page.locator('#wheel').getAttribute('aria-valuenow').then(x => Number(x)-1);
async function settle(page) {
  await page.evaluate(() => new Promise(requestAnimationFrame));
  await page.waitForFunction(() => !document.querySelector('.is-moving'));
}
async function point(page, fraction) {
  const el = page.locator('#spectrum-slider'); await el.scrollIntoViewIfNeeded();
  const r = await el.boundingBox(); return {x:r.x+11+(r.width-22)*fraction,y:r.y+r.height/2};
}
async function check(name,url) {
  const browser = await {chromium,firefox,webkit}[name].launch(name==='chromium' && fs.existsSync('/usr/bin/chromium') ? {executablePath:'/usr/bin/chromium',args:['--no-sandbox']} : {});
  try {
    const page = await browser.newPage({viewport:{width:390,height:844}});
    const errors=[]; page.on('pageerror',e=>errors.push(e.message));
    await page.goto(url); await page.waitForFunction(()=>document.querySelector('#outfit-card').dataset.tier);
    assert.equal(await page.locator('#open-mapping, #day-slider, .wheel-navigation').count(),0);
    assert.equal(await page.locator('#outfit-mean, #outfit-low, #outfit-high, #outfit-badge').count(),0);
    assert.ok(await page.evaluate(()=>!!(document.querySelector('.spectrum-card').compareDocumentPosition(document.querySelector('#outfit-card')) & Node.DOCUMENT_POSITION_FOLLOWING)));
    assert.equal(await page.locator('#spectrum-slider').getAttribute('type'),'range');
    assert.ok((await page.locator('#spectrum-slider').boundingBox()).height>=44);
    const dayBefore = await selected(page), clothesBefore = await page.locator('#outfit-card').textContent();
    await page.evaluate(()=>{window.added=0;window.observer=new MutationObserver(records=>records.forEach(r=>window.added+=r.addedNodes.length));window.observer.observe(document.querySelector('main'),{subtree:true,childList:true})});
    const start=await point(page,.12), end=await point(page,.83);
    await page.mouse.move(start.x,start.y);await page.mouse.down();await page.mouse.move(end.x,end.y,{steps:45});
    await page.waitForFunction(()=>document.querySelector('#interaction-indicator').textContent.includes('预览'));
    const fractional=Number(await page.locator('#spectrum-slider').inputValue());
    assert.ok(Math.abs(fractional-364*.83)<1,`${name} must follow the pointer continuously: ${fractional}`);
    assert.ok(Math.abs(fractional-Math.round(fractional))>.01,'native thumb must preserve sub-day positions while dragging');
    assert.equal(await selected(page),dayBefore,'preview must not commit before release');
    assert.equal(await page.locator('#outfit-card').textContent(),clothesBefore,'wardrobe work must wait for release');
    await page.mouse.up();await settle(page);
    assert.equal(await selected(page),Math.round(fractional));
    assert.equal(Number(await page.locator('#spectrum-slider').inputValue()),Math.round(fractional),'release must not rewind the thumb toward the old wheel position');
    assert.equal(await page.evaluate(()=>window.added),0,'drag and confirmation must reuse nodes');
    // Cancellation restores the committed date, even after further movement and release.
    const committed=await selected(page), a=await point(page,committed/364), z=await point(page,.2);
    await page.mouse.move(a.x,a.y);await page.mouse.down();await page.mouse.move(z.x,z.y,{steps:12});
    await page.keyboard.press('Escape');await page.mouse.move(z.x+12,z.y);await page.mouse.up();await settle(page);
    assert.equal(await selected(page),committed,'Escape must cancel the entire gesture');
    assert.equal(await page.locator('.is-scrubbing').count(),0);
    const input=page.locator('#spectrum-slider');await input.focus();
    await page.keyboard.press('Home');await settle(page);assert.equal(await selected(page),0);
    await page.keyboard.press('ArrowLeft');await settle(page);assert.equal(await selected(page),0);
    await page.keyboard.press('End');await settle(page);assert.equal(await selected(page),364);
    await page.keyboard.press('ArrowRight');await settle(page);assert.equal(await selected(page),364);
    await page.keyboard.press('ArrowLeft');await settle(page);assert.equal(await selected(page),363);
    const mid=await point(page,.5);await page.mouse.click(mid.x,mid.y);await settle(page);assert.ok(Math.abs(await selected(page)-182)<=1);
    const drag=await point(page,.5), box=await input.boundingBox();
    await page.mouse.move(drag.x,drag.y);await page.mouse.down();await page.mouse.move(box.x-10,drag.y,{steps:15});await page.mouse.up();await settle(page);assert.equal(await selected(page),0,'capture must clamp and commit outside the track');
    await page.locator('#mapping-details > summary').click();await page.locator('#mode-cross').click();await settle(page);
    const beforeCross=await selected(page), p=await point(page,.7);await page.mouse.click(p.x,p.y);await settle(page);
    assert.notEqual(await selected(page),beforeCross);assert.ok(!/NaN|undefined/.test(await page.locator('#spectrum-current').textContent()));
    await page.emulateMedia({reducedMotion:'reduce'});await input.focus();await page.keyboard.press('Home');await settle(page);assert.equal(await selected(page),0);
    assert.deepEqual(errors,[]);
    if(name==='chromium')await checkTouch(browser,url);
    console.log(JSON.stringify({browser:name,passed:true,nativeContinuousDrag:true,cancelAndCapture:true,keyboardBounds:true,dragNodesAdded:0}));
  } finally {await browser.close();}
}
async function checkTouch(browser,url) {
  const page=await browser.newPage({viewport:{width:390,height:844},hasTouch:true,isMobile:true});
  try {
    await page.goto(url);await page.waitForFunction(()=>document.querySelector('#outfit-card').dataset.tier);
    const cdp=await page.context().newCDPSession(page);
    const touch=(type,p)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:type==='touchEnd'?[]:[{...p,id:1}]});
    const start=await point(page,.15),end=await point(page,.85),scrollBefore=await page.evaluate(()=>scrollY),dayBefore=await selected(page);
    await touch('touchStart',start);
    for(let i=1;i<=24;i++)await touch('touchMove',{x:start.x+(end.x-start.x)*i/24,y:start.y});
    assert.equal(await selected(page),dayBefore);
    assert.ok(Number(await page.locator('#spectrum-slider').inputValue())>300,'native touch must drag the slider');
    await touch('touchEnd');await settle(page);
    assert.ok(await selected(page)>300);assert.equal(await page.evaluate(()=>scrollY),scrollBefore,'horizontal slider drag must not scroll');
    // The 48px slider owns its gesture; the rest of the card remains a page scroll surface.
    const dateBefore=await selected(page),heading=await page.locator('#spectrum-title').boundingBox(),center={x:heading.x+30,y:heading.y+heading.height/2};
    await touch('touchStart',center);
    for(let i=1;i<=10;i++)await touch('touchMove',{x:center.x,y:center.y+i*12});
    await touch('touchEnd');await settle(page);
    await page.waitForFunction(before=>scrollY<before-30,scrollBefore);
    assert.equal(await selected(page),dateBefore,'scrolling around the slider must retain the chosen date');
  } finally {await page.close();}
}
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));try{for(const name of (process.env.BROWSERS||'chromium').split(','))await check(name,`http://127.0.0.1:${server.address().port}`)}finally{await new Promise(r=>server.close(r))}})().catch(e=>{console.error(e);process.exitCode=1});
