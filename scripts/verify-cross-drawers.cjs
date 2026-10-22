/* Native disclosure transitions and the source-to-target comparison journey. */
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium,firefox,webkit}=require('playwright');
const server=http.createServer((req,res)=>{res.setHeader('Content-Type','text/html;charset=utf-8');res.end(fs.readFileSync(path.resolve(__dirname,'../index.html')))});
const idle=async page=>{await page.evaluate(()=>new Promise(requestAnimationFrame));await page.waitForFunction(()=>!document.querySelector('.is-moving,.is-drawer-animating'))};
const done=(page,id)=>page.waitForFunction(id=>!document.getElementById(id).classList.contains('is-drawer-animating'),id);
const click=locator=>locator.evaluate(el=>el.click());
const strokes=page=>page.locator('.temperature-ring line').evaluateAll(els=>els.map(el=>[...el.attributes].map(a=>[a.name,a.value])));
async function drawer(page,id){
 const card=page.locator('#'+id),summary=card.locator(':scope > summary');
 const closed=(await card.boundingBox()).height;
 await click(summary);assert.equal(await summary.getAttribute('aria-expanded'),'true');
 assert.equal(await card.evaluate(el=>el.open),true);
 assert.ok(await card.evaluate(el=>el.getAnimations().some(a=>a.playState==='running')),'opening must animate');
 await page.waitForTimeout(60);const opening=(await card.boundingBox()).height;
 await done(page,id);const expanded=(await card.boundingBox()).height;
 assert.ok(opening>closed+1&&opening<expanded-1,'opening height must pass through an intermediate size');
 await click(summary);assert.equal(await summary.getAttribute('aria-expanded'),'false');
 assert.equal(await card.locator(':scope > div').last().evaluate(el=>el.inert),true,'closing content must leave keyboard navigation immediately');
 assert.ok(await card.evaluate(el=>el.getAnimations().some(a=>a.playState==='running')),'closing must animate');
 await page.waitForTimeout(60);const closing=(await card.boundingBox()).height;
 assert.ok(closing<expanded-1&&closing>closed+1,'closing must also have intermediate heights');
 await done(page,id);assert.equal(await card.evaluate(el=>el.open),false);
 assert.ok(Math.abs((await card.boundingBox()).height-closed)<=1,'closing must restore the natural preview height');
 // Reverse a transition twice before either destination is reached.
 await click(summary);await page.waitForTimeout(45);
 const reversal=await summary.evaluate(el=>{const card=el.parentElement,before=card.getBoundingClientRect().height;el.click();return Math.abs(card.getBoundingClientRect().height-before)});
 assert.ok(reversal<=1,'reversal must start at the current height: '+reversal);
 await page.waitForTimeout(45);await click(summary);await done(page,id);
 assert.equal(await card.evaluate(el=>el.open),true);assert.equal(await summary.getAttribute('aria-expanded'),'true');
 await summary.focus();await page.keyboard.press('Space');await done(page,id);
 assert.equal(await card.evaluate(el=>el.open),false,'native keyboard activation must retain the animated close');
}
async function check(name,url){
 const browser=await {chromium,firefox,webkit}[name].launch(name==='chromium'?{executablePath:'/usr/bin/chromium',args:['--no-sandbox']}:{});
 try{const page=await browser.newPage({viewport:{width:393,height:852}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(url);await page.waitForFunction(()=>document.querySelector('.center-date'));await page.waitForTimeout(900);
  assert.equal(await page.locator('#city').inputValue(),'chengdu');
  await drawer(page,'outfit-card');await drawer(page,'mapping-details');
  await click(page.locator('.outfit-summary'));await page.waitForTimeout(40);await page.setViewportSize({width:1440,height:1100});await idle(page);
  assert.equal(await page.locator('#outfit-card').evaluate(el=>el.open),true);assert.ok(await page.locator('#outfit-card').evaluate(el=>!el.style.height));
  await page.setViewportSize({width:393,height:852});await page.waitForFunction(()=>!document.querySelector('#outfit-card').open);await idle(page);assert.equal(await page.locator('#outfit-card').evaluate(el=>el.open),false);
  await page.emulateMedia({reducedMotion:'reduce'});await click(page.locator('.outfit-summary'));
  assert.equal(await page.locator('#outfit-card').evaluate(el=>el.open),true);assert.equal(await page.locator('.is-drawer-animating').count(),0);
  await click(page.locator('.outfit-summary'));assert.equal(await page.locator('#outfit-card').evaluate(el=>el.open),false);
  await click(page.locator('#mapping-details > summary'));await page.locator('#mode-cross').click();await idle(page);
  assert.equal(await page.locator('#city-route #target-city').count(),1,'both city choices must stay beside the main wheel');
  assert.equal(await page.locator('#target-city').isVisible(),true);
  assert.match(await page.locator('#legend-source-label').textContent(),/成都.*起点/);assert.match(await page.locator('#legend-target-label').textContent(),/东京.*目标/);
  assert.match(await page.locator('.orbit').textContent(),/成都.*起点/);assert.match(await page.locator('.center-sub').textContent(),/东京.*目标/);
  assert.match(await page.locator('#sidebar-match-text').textContent(),/目标.*东京/);assert.match(await page.locator('#wheel-instruction').textContent(),/外圈.*内圈/);
  await click(page.locator('#mapping-details > summary'));assert.equal(await page.locator('#target-city').isVisible(),true,'closing advanced options must not hide the target city');
  const date=await page.locator('#date').inputValue();await page.locator('#target-city').selectOption('hami');await idle(page);
  assert.equal(await page.locator('#date').inputValue(),date);assert.equal(await page.locator('#city').inputValue(),'chengdu');
  assert.match(await page.locator('.center-sub').textContent(),/哈密.*目标/);assert.match(await page.locator('#legend-target-label').textContent(),/哈密/);
  assert.match(await page.locator('#target-spectrum-current').textContent(),new RegExp(await page.locator('#sidebar-match-date').textContent()));
  await page.locator('#swap-cities').click();await idle(page);assert.equal(await page.locator('#city').inputValue(),'hami');assert.equal(await page.locator('#target-city').inputValue(),'chengdu');
  assert.match(await page.locator('#outfit-city').textContent(),/哈密.*起点/);
  await page.emulateMedia({reducedMotion:'no-preference'});
  const original=await strokes(page);await page.locator('#legend-target').click();
  await page.waitForFunction(()=>Number(getComputedStyle(document.querySelector('.source-ring')).opacity)<.3);
  assert.deepEqual(await strokes(page),original,'highlighting must preserve the temperature colours and geometry');
  await page.waitForFunction(()=>!document.querySelector('.focus-source,.focus-target'));
  for(const width of [320,360,393,760,768,1024,1440]){
   await page.setViewportSize({width,height:1100});await idle(page);
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),name+' must fit '+width);
   if(width<=760)assert.ok((await page.locator('#city-route').boundingBox()).height<=45,'city controls must remain on one row');
   const central=await page.locator('#wheel').evaluate(el=>['.orbit','.center-date','.center-num','.center-sub','.center-match-date','.center-match-num'].map(s=>{const b=el.querySelector(s).getBBox();return{top:b.y,bottom:b.y+b.height}}));for(let i=1;i<central.length;i++)assert.ok(central[i-1].bottom<=central[i].top+1,'cross-city centre labels must not overlap');
   const boxes=await page.locator('#city-route .city-display').evaluateAll(els=>els.map(el=>({width:el.clientWidth,content:el.scrollWidth})));
   assert.ok(boxes.every(b=>b.content<=b.width+1),'city names and role labels must fit');
  }
  // Hover/drag updates still reuse all ring nodes after the inner ring has been created.
  await page.setViewportSize({width:393,height:1000});await page.locator('#wheel').scrollIntoViewIfNeeded();
  await page.evaluate(()=>{window.addedCrossNodes=0;window.crossObserver=new MutationObserver(rs=>rs.forEach(r=>window.addedCrossNodes+=r.addedNodes.length));window.crossObserver.observe(document.querySelector('main'),{subtree:true,childList:true})});
  const box=await page.locator('.wheel-svg-wrap').boundingBox(),point=(day,radius)=>{const a=day/365*Math.PI*2;return{x:box.x+box.width*(.5+Math.sin(a)*radius/720),y:box.y+box.height*(.5-Math.cos(a)*radius/720)}};
  const previous=await page.locator('#date').inputValue(),inner=point(90,220);await page.mouse.click(inner.x,inner.y);await idle(page);assert.equal(await page.locator('#date').inputValue(),previous,'the target inner ring must not change the origin date');
  const a=point(90,270),b=point(170,270);await page.mouse.move(a.x,a.y);await page.mouse.down();await page.mouse.move(b.x,b.y,{steps:18});await page.mouse.up();await page.mouse.move(0,0);await idle(page);
  assert.equal(await page.locator('#wheel').getAttribute('aria-valuenow'),'171');assert.equal(await page.evaluate(()=>window.addedCrossNodes),0);await page.evaluate(()=>window.crossObserver.disconnect());
  await page.waitForFunction(()=>document.getAnimations().every(a=>a.playState!=='running'));assert.equal(await page.locator('.is-drawer-animating,.is-moving').count(),0);
  assert.deepEqual(errors,[]);
  if(process.env.SCREENSHOTS_DIR){fs.mkdirSync(process.env.SCREENSHOTS_DIR,{recursive:true});await page.evaluate(()=>scrollTo({top:0,behavior:'instant'}));await page.screenshot({path:path.join(process.env.SCREENSHOTS_DIR,name+'-cross.png'),fullPage:true})}
  console.log(JSON.stringify({browser:name,passed:true,drawerOpenAndClose:true,interruption:true,keyboard:true,reducedMotion:true,explicitTarget:true,cityControlsVisible:true,legendHighlight:true,bandUnchanged:true,dragNodesAdded:0}));
 }finally{await browser.close()}
}
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));try{for(const name of (process.env.BROWSERS||'chromium').split(','))await check(name,'http://127.0.0.1:'+server.address().port)}finally{await new Promise(r=>server.close(r))}})().catch(e=>{console.error(e);process.exitCode=1});
