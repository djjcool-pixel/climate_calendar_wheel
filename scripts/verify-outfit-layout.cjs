/* Native clothing disclosure and compact mobile layout checks. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const {chromium, firefox, webkit} = require('playwright');
const html = fs.readFileSync(path.resolve(__dirname, '../index.html'));
const server = http.createServer((req, res) => {res.setHeader('Content-Type', 'text/html; charset=utf-8'); res.end(html);});
async function verify(name) {
  const browser = await {chromium, firefox, webkit}[name].launch(name === 'chromium' && fs.existsSync('/usr/bin/chromium') ? {executablePath:'/usr/bin/chromium',args:['--no-sandbox']} : {});
  try {
    const page = await browser.newPage({viewport:{width:390,height:844}});
    const errors = []; page.on('pageerror', err => errors.push(err.message));
    await page.goto(`http://127.0.0.1:${server.address().port}`);
    await page.waitForFunction(() => document.querySelector('#outfit-card').dataset.tier);
    assert.equal(await page.locator('#city').inputValue(), 'chengdu');
    const card = page.locator('#outfit-card'), summary = page.locator('.outfit-summary'), details = page.locator('.outfit-details');
    for (const width of [320,360,390,760]) {
      await page.setViewportSize({width,height:844});
      assert.equal(await card.evaluate(el => el.open), false, 'phones must default to the compact preview');
      assert.equal(await details.isVisible(), false);
      const outfitHeight = (await card.boundingBox()).height, spectrumHeight = (await page.locator('.spectrum-card').boundingBox()).height;
      assert.ok(Math.abs(outfitHeight - spectrumHeight) <= 1, `preview must match the spectrum height at ${width}: ${outfitHeight}/${spectrumHeight}`);
      assert.ok(outfitHeight <= 200, 'secondary feature must stay compact');
      assert.equal(await page.locator('#outfit-preview').isVisible(), true);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      await summary.click();
      assert.equal(await card.evaluate(el => el.open), true);
      assert.equal(await details.isVisible(), true);
      assert.equal(await page.locator('.outfit-piece:visible').count(), 4);
      assert.equal(await page.locator('#outfit-preview').isVisible(), false);
      await summary.focus(); await page.keyboard.press('Enter');
      assert.equal(await card.evaluate(el => el.open), false, 'native keyboard activation must close details');
    }
    const year = (await page.locator('#date').inputValue()).slice(0,4);
    await page.locator('#city').selectOption('hami');
    await page.locator('#date').fill(`${year}-01-15`); await page.locator('#date').dispatchEvent('change');
    await page.waitForFunction(() => document.querySelector('#outfit-card').dataset.tier === 'freezing');
    assert.equal(await card.evaluate(el => el.open), false, 'changing dates must retain the chosen disclosure state');
    assert.match(await page.locator('#outfit-preview').textContent(), /羽绒/);
    await summary.click();
    assert.match(await page.locator('#outfit-outer').textContent(), /羽绒/);
    await page.locator('#city').selectOption('wuhan');
    await page.locator('#date').fill(`${year}-07-15`); await page.locator('#date').dispatchEvent('change');
    await page.waitForFunction(() => document.querySelector('#outfit-card').dataset.tier === 'hot');
    assert.equal(await card.evaluate(el => el.open), true);
    assert.match(await page.locator('#outfit-preview').textContent(), /透气/);
    await page.setViewportSize({width:1440,height:1100});
    await page.waitForFunction(() => document.querySelector('#outfit-card').open);
    assert.equal(await details.isVisible(), true, 'desktop must default to full details');
    await page.setViewportSize({width:390,height:844});
    await page.waitForFunction(() => !document.querySelector('#outfit-card').open);
    await page.emulateMedia({reducedMotion:'reduce'});
    assert.equal(await page.locator('.outfit-toggle svg').evaluate(el => getComputedStyle(el).transitionDuration), '0s');
    if (process.env.SCREENSHOTS_DIR) {
      fs.mkdirSync(process.env.SCREENSHOTS_DIR, {recursive:true});
      await card.screenshot({path:path.join(process.env.SCREENSHOTS_DIR,`${name}-preview.png`)});
    }
    assert.deepEqual(errors, []);
    console.log(JSON.stringify({browser:name,passed:true,mobilePreviewHeight:196,matchingSpectrum:true,nativeClickAndKeyboard:true,dateUpdates:true,desktopExpanded:true}));
  } finally {await browser.close();}
}
(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {for (const name of (process.env.BROWSERS || 'chromium').split(',')) await verify(name);}
  finally {await new Promise(resolve => server.close(resolve));}
})().catch(err => {console.error(err); process.exitCode = 1;});
