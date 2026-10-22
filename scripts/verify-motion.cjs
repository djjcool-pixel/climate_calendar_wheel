/* Development-only browser checks. The shipped page has no runtime dependencies. */
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { chromium, firefox, webkit } = require('playwright');
const root = path.resolve(__dirname, '..');
const server = http.createServer((req, res) => {
  const file = path.join(root, req.url === '/' ? 'index.html' : req.url.split('?')[0]);
  if (!file.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
  fs.readFile(file, (err, data) => { res.writeHead(err ? 404 : 200, { 'Content-Type': 'text/html; charset=utf-8' }); res.end(err ? '' : data); });
});
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
async function settle(page) {
  await page.evaluate(() => new Promise(requestAnimationFrame));
  await page.waitForFunction(() => !document.querySelector('.is-moving'), {timeout: 10000});
}
const angle = page => page.locator('.dial-marker').first().getAttribute('transform').then(s => Number(s.match(/rotate\(([-\d.]+)/)[1]));
async function date(page, value) { await page.locator('#date').fill(value); await page.locator('#date').dispatchEvent('change'); await settle(page); }
async function point(page, day, radius = 280) {
  const r = await page.locator('.wheel-svg-wrap').boundingBox(), a = day / 365 * Math.PI * 2;
  return { x: r.x + r.width * (.5 + Math.sin(a) * radius / 720), y: r.y + r.height * (.5 - Math.cos(a) * radius / 720) };
}
async function verifyTouch(browser, url) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  try {
    await page.goto(url); await sleep(800);
    const cdp = await page.context().newCDPSession(page);
    const send = (type, p) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ ...p, id: 1 }] });
    const r = await page.locator('.wheel-svg-wrap').boundingBox(), center = { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    await send('touchStart', center);
    for (let i = 1; i <= 10; i++) { await send('touchMove', { x: center.x, y: center.y - i * 12 }); await sleep(20); }
    await send('touchEnd'); await sleep(500);
    assert.ok(await page.evaluate(() => scrollY > 40), 'center must permit native page scrolling');
    await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' })); await sleep(500);
    await send('touchStart', await point(page, 90));
    for (let i = 1; i <= 15; i++) { await send('touchMove', await point(page, 90 + i * 4)); await sleep(20); }
    await send('touchEnd'); await settle(page);
    assert.equal(await page.locator('#day-slider').inputValue(), '150', 'native touch must commit rather than be cancelled by pan recognition');
    assert.equal(await page.evaluate(() => scrollY), 0, 'ring drag must not scroll the page');
  } finally { await page.close(); }
}
async function verify(name, engine) {
  const launch = name === 'chromium' && fs.existsSync('/usr/bin/chromium') ? { executablePath: '/usr/bin/chromium', args: ['--no-sandbox'] } : {};
  const browser = await engine.launch(launch);
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.goto(`http://127.0.0.1:${server.address().port}`);
    await page.waitForFunction(() => document.querySelector('.dial-marker'));
    await sleep(900);
    assert.equal(await page.locator('#city').inputValue(), 'chengdu');
    assert.equal(await page.locator('#city-name').textContent(), '成都');
    assert.equal(await page.locator('#city option').count(), 9);
    assert.equal(await page.locator('#target-city option').count(), 9);
    const year = await page.locator('#date').inputValue().then(x => x.slice(0, 4));
    await date(page, `${year}-12-31`);
    const before = await angle(page);
    await page.locator('#next-day').click(); await settle(page);
    assert.equal(await page.locator('#date').inputValue(), `${year}-01-01`);
    const after = await angle(page);
    assert.ok(Math.abs(after - before) < 1.1, `year boundary must use the short arc: ${before} → ${after}; errors=${errors.join(',')}`);
    await page.evaluate(() => { for (let i = 0; i < 60; i++) document.querySelector('#next-day').click(); });
    await settle(page);
    assert.equal(await page.locator('#day-slider').inputValue(), '60', 'rapid clicks must retain every date change');
    await page.evaluate(() => {
      window.savedDial = [document.querySelector('.connection-path'), ...document.querySelectorAll('.dial-marker'), ...document.querySelectorAll('.tempbar')];
      window.dialAdded = 0;
      window.dialObserver = new MutationObserver(rs => { for (const r of rs) window.dialAdded += r.addedNodes.length; });
      window.dialObserver.observe(document.querySelector('#wheel'), { childList: true, subtree: true });
    });
    for (let i = 0; i < 90; i++) { const p = await point(page, i * 4); await page.mouse.move(p.x, p.y); }
    await page.mouse.move(0, 0); await settle(page);
    assert.equal(await page.evaluate(() => window.dialAdded), 0, 'hover must reuse both SVG elements and text nodes');
    assert.ok(await page.evaluate(() => window.savedDial.every(el => el.isConnected)), 'dial nodes must keep identity');
    const dragStart = await point(page, 90), dragEnd = await point(page, 170);
    await page.mouse.move(dragStart.x, dragStart.y); await page.mouse.down(); await page.mouse.move(dragEnd.x, dragEnd.y, { steps: 15 }); await sleep(80);
    assert.equal(await page.locator('#day-slider').inputValue(), '60', 'drag is preview-only before release');
    await page.mouse.up(); await settle(page);
    assert.equal(await page.locator('#day-slider').inputValue(), '170');
    assert.equal(await page.locator('#interaction-indicator').textContent(), '● 已选定');
    await page.mouse.down(); await page.mouse.move(dragStart.x, dragStart.y); await page.keyboard.press('Escape'); await page.mouse.up();
    await page.mouse.move(0, 0); await settle(page);
    assert.equal(await page.locator('#day-slider').inputValue(), '170', 'Escape cancels a drag');
    assert.equal(await page.locator('.dial-active').count(), 0);
    for (const [day, axis, sign] of [[0, 'y', -1], [90, 'x', 1], [182, 'y', 1], [274, 'x', -1]]) {
      const p = await point(page, day); await page.mouse.move(p.x, p.y); await page.mouse.down(); await settle(page);
      const face = await page.locator('.dial-surface').evaluate(el => {
        const m = new DOMMatrixReadOnly(getComputedStyle(el).transform);
        return { x: m.m41, y: m.m42, hasDepth: el.style.transform.includes('rotateX(') && el.style.transform.includes('rotateY(') };
      });
      assert.ok(face[axis] * sign > 1 && face.hasDepth, `dial must lean toward press direction ${day}`);
      await page.keyboard.press('Escape'); await page.mouse.up(); await page.mouse.move(0, 0); await settle(page);
      assert.equal(await page.locator('.dial-surface').evaluate(el => el.style.transform), 'none', 'release must return flat and drop the 3D transform');
    }
    await page.locator('#wheel').focus(); await page.keyboard.press('ArrowRight');
    await page.waitForFunction(() => document.querySelector('#wheel').getAttribute('aria-valuenow') === '172');
    assert.equal(await page.locator('#wheel').getAttribute('aria-valuenow'), '172');
    await page.locator('#return-today').click(); await settle(page);
    assert.equal(await page.locator('#date').inputValue(), await page.evaluate(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }));
    // Comparison DOM is lazy and remains stable once opened.
    assert.equal(await page.locator('#metric-grid > *').count(), 0);
    await page.locator('#mapping-details > summary').click(); await sleep(100);
    assert.equal(await page.locator('#metric-grid > *').count(), 15);
    await page.locator('#mode-cross').click(); await settle(page);
    assert.notEqual(await page.locator('#city').inputValue(), await page.locator('#target-city').inputValue());
    const source = await page.locator('#city').inputValue(), target = await page.locator('#target-city').inputValue();
    await page.locator('#swap-cities').click(); await sleep(100);
    assert.equal(await page.locator('#city').inputValue(), target); assert.equal(await page.locator('#target-city').inputValue(), source);
    await page.locator('[data-metric="high"]').click(); await page.locator('[data-algorithm="climate"]').click(); await settle(page);
    assert.equal(await page.locator('[data-metric="high"]').getAttribute('aria-pressed'), 'true');
    assert.ok(await page.locator('#match-diff').textContent().then(x => x.includes('综合气候')));
    assert.equal(await page.locator('.tempbar').count(), 730);
    for (const city of ['hami', 'kunming']) {
      await page.locator('#city').selectOption('chengdu');
      await page.locator('#target-city').selectOption(city); await settle(page);
      assert.equal(await page.locator('#target-city-name').textContent(), city === 'hami' ? '哈密' : '昆明');
      assert.ok(!/NaN|undefined/.test(await page.locator('.results').textContent()), `${city} comparison must contain valid values`);
      await page.locator('#swap-cities').click(); await settle(page);
      assert.equal(await page.locator('#city').inputValue(), city);
      assert.equal(await page.locator('#city-name').textContent(), city === 'hami' ? '哈密' : '昆明');
    }
    // Responsive checks include expanded cross-city settings.
    for (const width of [320, 360, 390, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 900 }); await sleep(80);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `horizontal overflow at ${width}`);
      for (const id of ['prev-day', 'next-day', 'return-today']) assert.ok((await page.locator('#' + id).boundingBox()).height >= 44, `${id} needs a 44px hit area`);
      for (const id of ['city', 'target-city']) {
        const fit = await page.locator('#' + id).evaluate(el => {
          const display = el.nextElementSibling, name = display.querySelector('.city-name'), english = display.querySelector('.city-en'), arrow = display.querySelector('.city-chevron');
          return { nameRight: name.getBoundingClientRect().right, arrowLeft: arrow.getBoundingClientRect().left, englishDisplay: getComputedStyle(english).display, nativeFont: getComputedStyle(el).fontSize, height: el.getBoundingClientRect().height };
        });
        assert.ok(fit.nameRight + 8 <= fit.arrowLeft, `${id} city name collides with its arrow at ${width}`);
        assert.equal(fit.nativeFont, '16px', 'native city picker must retain the iOS no-zoom font size');
        assert.equal(fit.height, 44);
        if (width <= 760) assert.equal(fit.englishDisplay, 'none', 'compact city label must omit the long English name');
      }
    }
    await page.setViewportSize({ width: 390, height: 844 }); await page.locator('#mode-same').click(); await page.locator('#city').selectOption('chengdu'); await page.locator('#mapping-details > summary').click();
    await page.evaluate(() => scrollTo(0, 0)); await sleep(900);
    if (process.env.SCREENSHOTS_DIR) { fs.mkdirSync(process.env.SCREENSHOTS_DIR, {recursive:true}); await page.screenshot({ path: path.join(process.env.SCREENSHOTS_DIR, `${name}-mobile.png`), fullPage: true }); }
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await date(page, `${year}-03-15`);
    const reducedPoint = await point(page, 90); await page.mouse.move(reducedPoint.x, reducedPoint.y); await page.mouse.down();
    await page.evaluate(() => new Promise(requestAnimationFrame));
    assert.equal(await page.locator('.dial-surface').evaluate(el => getComputedStyle(el).transform), 'none', 'reduced motion must disable face tilt');
    await page.keyboard.press('Escape'); await page.mouse.up(); await page.mouse.move(0, 0); await settle(page);
    assert.ok(Math.abs((await angle(page) % 360 + 360) % 360 - 73/365*360) < .02, 'reduced motion must snap to the exact selected date');
    assert.equal(await page.evaluate(() => document.getAnimations().filter(a => a.playState === 'running').length), 0, 'reduced motion must stop CSS animations');
    await page.emulateMedia({ reducedMotion: 'no-preference' }); await sleep(950);
    await page.waitForFunction(() => document.getAnimations().filter(a => a.playState === 'running').length === 0, {timeout: 5000});
    assert.equal(await page.evaluate(() => document.getAnimations().filter(a => a.playState === 'running').length), 0, 'idle dial must not run perpetual animations');
    assert.equal(await page.locator('.is-moving').count(), 0, 'motion loop must settle');
    assert.deepEqual(errors, []);
    if (name === 'chromium') await verifyTouch(browser, page.url());
    console.log(JSON.stringify({browser:name, passed:true, hoverNodesAdded:0, idleAnimations:0, widths:[320,360,390,768,1024,1440]}));
  } finally { await browser.close(); }
}
(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try { const selected = (process.env.BROWSERS || 'chromium').split(','); for (const name of selected) await verify(name, {chromium,firefox,webkit}[name]); }
  finally { await new Promise(resolve => server.close(resolve)); }
})().catch(err => { console.error(err); process.exitCode = 1; });
