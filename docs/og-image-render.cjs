const { chromium } = require('playwright');
const head = `<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="https://use.typekit.net/xse1zxg.css">
<style>
 *{margin:0;box-sizing:border-box} body{width:1200px;height:630px;overflow:hidden;font-family:"aktiv-grotesk-extended","aktiv-grotesk",Helvetica,Arial,sans-serif}
 .hb{font-weight:700} .sb{font-weight:500}
</style></head><body>`;
const designs = {
 A: `<div style="width:1200px;height:630px;background:#480016;display:flex;align-items:center;padding:0 70px;gap:20px">
   <div style="flex:1">
     <img src="/brand/fyxx-friday-logo-cream.svg" style="width:520px;display:block">
     <div class="hb" style="color:#F61D2F;font-size:68px;line-height:1;margin-top:34px;letter-spacing:.01em">NOVEMBER 27</div>
     <div class="sb" style="color:#F3EFEA;font-size:30px;margin-top:16px">One day only. Special offers. Best deals.</div>
   </div>
   <img src="/brand/fyxx-friday-bottles.webp" style="height:560px;display:block">
 </div>`,
 B: `<div style="width:1200px;height:630px;background:#F61D2F;display:flex;flex-direction:column;align-items:center;justify-content:center">
   <img src="/brand/fyxx-friday-logo-cream.svg" style="width:760px;display:block">
   <div class="hb" style="color:#FBF1E3;font-size:38px;margin-top:40px;letter-spacing:.05em">NOVEMBER 27 &nbsp;|&nbsp; SPECIAL OFFERS. BEST DEALS.</div>
 </div>`,
 C: `<div style="width:1200px;height:630px;background:#F3EFEA;display:flex;flex-direction:column;align-items:center;justify-content:center">
   <div style="display:flex;align-items:flex-end">
     <img src="/brand/fyxx-friday-logo-red.svg" style="width:560px;display:block">
     <img src="/brand/fyxx-friday-bottles.webp" style="height:400px;margin-left:-60px;display:block">
   </div>
   <div class="hb" style="color:#000;font-size:40px;margin-top:26px">Friday 27 November. One day only.</div>
 </div>`,
};
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1200, height: 630 } });
  for (const [k, body] of Object.entries(designs)) {
    const p = await ctx.newPage();
    // Served from the site's own address so the Adobe font kit allows it and /brand files load.
    await p.route('https://friday.myfyxx.com/__og-' + k, r => r.fulfill({ contentType: 'text/html', body: head + body + '</body></html>' }));
    await p.goto('https://friday.myfyxx.com/__og-' + k, { waitUntil: 'networkidle' });
    await p.evaluate(() => document.fonts.ready);
    const fonts = await p.evaluate(() => [document.fonts.check('700 40px "aktiv-grotesk-extended"'), document.fonts.check('700 40px "aktiv-grotesk"')]);
    await p.screenshot({ path: `og/og-${k}.png` });
    console.log(k, 'extended/regular font loaded:', fonts);
    await p.close();
  }
  await b.close();
})();
