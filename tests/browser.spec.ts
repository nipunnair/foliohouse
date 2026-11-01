import {test,expect} from '@playwright/test';
test('gallery filters, navigation and lightbox',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await expect(page.locator('.work-card').first()).toBeVisible();
 await page.getByRole('button',{name:'Studies',exact:true}).click();await expect(page.locator('.work-card:visible').first()).toBeVisible();
 await page.locator('.work-card:visible').first().click();await expect(page.locator('h1')).toBeVisible();
 await page.locator('#expand').click();await expect(page.locator('dialog')).toBeVisible();
 await page.keyboard.press('Escape');await expect(page.locator('dialog')).not.toBeVisible();
 expect(errors).toEqual([]);
});
test('desktop and phone images load without overflow',async({page})=>{
 for(const width of [1440,390]){
  await page.setViewportSize({width,height:950});await page.goto('/');
  await page.locator('footer').scrollIntoViewIfNeeded();await page.evaluate(()=>window.scrollTo(0,0));
  await expect.poll(()=>page.locator('img').evaluateAll(imgs=>imgs.every(i=>(i as HTMLImageElement).complete&&(i as HTMLImageElement).naturalWidth>0))).toBe(true);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:`test-results/home-${width}.png`,fullPage:true});
 }
});
test('public pages and assets resolve; originals are inaccessible',async({page,request})=>{
 await page.goto('/');
 const links=await page.locator('a[href]').evaluateAll(nodes=>[...new Set(nodes.map(n=>(n as HTMLAnchorElement).href))]);
 for(const link of links){const response=await request.get(link);expect(response.status(),link).toBe(200);}
 expect((await request.get('/.private/originals/')).status()).toBe(404);
 expect((await request.get('/content/site.yaml')).status()).toBe(404);
});
