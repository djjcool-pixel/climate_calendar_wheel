/* Icons, optional peripheral hints and untouched temperature strokes across browser engines. */
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium,firefox,webkit}=require('playwright');
const html=fs.readFileSync(path.resolve(__dirname,'../index.html'));
const server=http.createServer((req,res)=>{res.setHeader('Content-Type','text/html;charset=utf-8');res.end(html)});
const dates=page=>page.locator('.wardrobe-marks').evaluate(root=>getComputedStyle(root).display==='none'?[]:[...root.children].filter(el=>getComputedStyle(el).display!=='none').map(el=>Number(el.dataset.day)));
const band=page=>page.locator('.temperature-ring').first().locator('line').evaluateAll(els=>els.map(el=>[...el.attributes].map(a=>[a.name,a.value])));
const selected=page=>page.locator('#wheel').getAttribute('aria-valuenow').then(v=>Number(v)-1);
async function settle(page){await page.evaluate(()=>new Promise(requestAnimationFrame));await page.waitForFunction(()=>!document.querySelector('.is-moving'))}
async function clickDay(page,day,radius){await page.locator('#wheel').scrollIntoViewIfNeeded();const r=await page.locator('.wheel-svg-wrap').boundingBox(),a=day/365*Math.PI*2;await page.mouse.click(r.x+r.width*(.5+Math.sin(a)*radius/720),r.y+r.height*(.5-Math.cos(a)*radius/720));await page.mouse.move(0,0);await settle(page)}
async function check(name){
 const browser=await {chromium,firefox,webkit}[name].launch(name==='chromium'&&fs.existsSync('/usr/bin/chromium')?{executablePath:'/usr/bin/chromium',args:['--no-sandbox']}:{});
 try{const page=await browser.newPage({viewport:{width:393,height:852}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:'+server.address().port);await page.waitForFunction(()=>document.querySelector('#outfit-card').dataset.tier);
  assert.equal(await page.locator('#city').inputValue(),'chengdu');
  assert.equal(await page.locator('body > .shell').count(),1,'icon definitions must not change the page structure');
  assert.equal(await page.locator('.source-pill').count(),0);
  assert.equal(await page.locator('.mapping-summary strong').textContent(),'高级功能');
  assert.equal(await page.locator('#outfit-preview .outfit-quick-item:visible').count(),4);
  assert.equal(await page.locator('#outfit-preview use').evaluateAll(els=>new Set(els.map(el=>el.getAttribute('href'))).size),4,'all four garments need their own icon');
  assert.ok(await page.locator('#outfit-preview').evaluate(el=>!el.textContent.includes('—')));
  assert.equal(await page.locator('.outfit-piece:visible').count(),0);
  await page.locator('.outfit-summary').click();assert.equal(await page.locator('#outfit-preview').isVisible(),false);assert.equal(await page.locator('.outfit-piece:visible').count(),4);await page.locator('.outfit-summary').click();
  assert.equal((await dates(page)).length,4);
  const original=await band(page),day=await selected(page),toggle=page.getByRole('button',{name:'换季参考',exact:true});
  await toggle.click();await page.waitForFunction(()=>document.querySelector('#wardrobe-toggle').getAttribute('aria-pressed')==='false');
  assert.equal((await dates(page)).length,0);assert.equal(await page.locator('.wardrobe-marks').evaluate(el=>getComputedStyle(el).display),'none');assert.equal(await page.locator('#wardrobe-legend').isVisible(),false);assert.equal(await selected(page),day);assert.deepEqual(await band(page),original,'hiding hints must leave every light-band stroke unchanged');
  await toggle.focus();await page.keyboard.press('Enter');await page.waitForFunction(()=>document.querySelector('#wardrobe-toggle').getAttribute('aria-pressed')==='true');
  const initial=await dates(page);assert.equal(initial.length,4);
  await page.evaluate(()=>{window.addedWardrobeNodes=0;window.wardrobeObserver=new MutationObserver(rs=>rs.forEach(r=>window.addedWardrobeNodes+=r.addedNodes.length));window.wardrobeObserver.observe(document.querySelector('#wheel'),{subtree:true,childList:true})});
  await clickDay(page,initial[0]+3,292);assert.equal(await selected(page),initial[0],'outer cue arcs must snap a tap to the suggested date');
  assert.equal(await page.locator('.wardrobe-mark.is-near:visible').count(),1);
  assert.match(await page.locator('.orbit').textContent(),/春秋/);
  await clickDay(page,initial[0]+3,280);assert.equal(await selected(page),initial[0]+3,'the existing coloured band must retain precise date selection');
  const dial=await page.locator('.wheel-svg-wrap').boundingBox(),point=day=>({x:dial.x+dial.width*(.5+Math.sin(day/365*Math.PI*2)*292/720),y:dial.y+dial.height*(.5-Math.cos(day/365*Math.PI*2)*292/720)}),start=point(initial[0]+3),away=point(initial[0]+20);
  await page.mouse.move(start.x,start.y);await page.mouse.down();await page.mouse.move(away.x,away.y,{steps:6});await page.mouse.move(start.x,start.y,{steps:6});await page.mouse.up();await page.mouse.move(0,0);await settle(page);
  assert.equal(await selected(page),initial[0]+3,'dragging around a cue must remain precise even when it returns to its starting point');
  await page.locator('[data-metric="high"]').click();await settle(page);assert.deepEqual(await dates(page),initial,'clothing cues must use mean temperature independently of comparison metrics');
  await page.locator('[data-metric="mean"]').click();await settle(page);assert.deepEqual(await band(page),original);
  assert.equal(await page.evaluate(()=>window.addedWardrobeNodes),0,'hints, pulses and text must reuse existing SVG nodes');
  await page.evaluate(()=>window.wardrobeObserver.disconnect());
  await page.locator('#city').selectOption('kunming');await settle(page);assert.equal((await dates(page)).length,2);assert.ok(await page.locator('.wardrobe-mark').evaluateAll(els=>els.filter(el=>getComputedStyle(el).display!=='none').every(el=>el.dataset.threshold==='12')));
  await page.locator('#city').selectOption('guangzhou');await settle(page);assert.equal((await dates(page)).length,2);assert.ok(await page.locator('.wardrobe-mark').evaluateAll(els=>els.filter(el=>getComputedStyle(el).display!=='none').every(el=>el.dataset.threshold==='24')));
  await page.locator('#city').selectOption('chengdu');await settle(page);
  await page.emulateMedia({reducedMotion:'reduce'});await clickDay(page,initial[1],292);assert.equal(await selected(page),initial[1]);assert.equal(await page.locator('.wardrobe-mark.is-near .season-ping').evaluate(el=>getComputedStyle(el).animationName),'none');
  for(const width of [320,360,393,760,768,1440]){
   await page.setViewportSize({width,height:1100});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
   assert.ok((await toggle.boundingBox()).height>=44);
   assert.ok(await page.locator('.wheel-legend').evaluate(el=>el.scrollWidth<=el.clientWidth+1));
   const boxes=await page.locator('#wheel').evaluate(el=>['.orbit','.center-date','.center-num','.center-sub','.center-match-date','.center-match-num'].map(selector=>{const b=el.querySelector(selector).getBBox();return{top:b.y,bottom:b.y+b.height}}));
   for(let i=1;i<boxes.length;i++)assert.ok(boxes[i-1].bottom<=boxes[i].top+1,`${name}: central text must stay separated at ${width}`);
  }
  await page.emulateMedia({reducedMotion:'no-preference'});await page.setViewportSize({width:393,height:600});await page.evaluate(()=>scrollTo(0,document.documentElement.scrollHeight));
  await page.waitForFunction(()=>!document.querySelector('.wardrobe-marks').classList.contains('is-visible'));
  assert.ok(await page.locator('.season-ping').evaluateAll(els=>els.every(el=>getComputedStyle(el).animationName==='none')),'offscreen cues must stop their pulse animation');
  await page.setViewportSize({width:393,height:852});await page.locator('#mapping-details > summary').click();await page.locator('#mode-cross').click();await settle(page);assert.equal(await page.locator('.center-hanger').evaluate(el=>getComputedStyle(el).display),'none');assert.match(await page.locator('.orbit').textContent(),/成都.*东京/);assert.equal(await page.locator('.tempbar').count(),730);
  await page.locator('#mode-same').click();await page.locator('#mapping-details > summary').click();await page.locator('#return-today').click();await settle(page);
  await page.emulateMedia({reducedMotion:'no-preference'});await page.waitForFunction(()=>document.getAnimations().every(a=>a.playState!=='running'));
  assert.equal(await page.locator('.is-moving').count(),0);
  if(process.env.SCREENSHOTS_DIR){fs.mkdirSync(process.env.SCREENSHOTS_DIR,{recursive:true});await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:path.join(process.env.SCREENSHOTS_DIR,name+'-wardrobe.png'),fullPage:true})}
  assert.deepEqual(errors,[]);console.log(JSON.stringify({browser:name,passed:true,quickIcons:4,optionalHints:true,bandUnchanged:true,preciseBandSelection:true,reducedMotion:true,nodeReuse:true}));
 }finally{await browser.close()}
}
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));try{for(const name of (process.env.BROWSERS||'chromium').split(','))await check(name)}finally{await new Promise(r=>server.close(r))}})().catch(e=>{console.error(e);process.exitCode=1});
