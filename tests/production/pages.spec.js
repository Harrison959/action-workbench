import {test,expect} from '@playwright/test';

test('production assets and persisted project detail work under the GitHub Pages subpath',async({page})=>{
  const errors=[],missing=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('response',r=>{if(r.status()>=400&&r.url().startsWith('http://127.0.0.1:4176'))missing.push(r.url());});
  await page.addInitScript(()=>localStorage.setItem('action-cloud',JSON.stringify({url:'',key:''})));
  await page.goto('./#projects');
  await page.getByRole('button',{name:'新建项目',exact:true}).first().click();
  await page.getByLabel('项目名称').fill('部署验证');
  await page.getByLabel('完成结果').fill('子路径与刷新可用');
  await page.getByRole('button',{name:'创建项目',exact:true}).click();
  await expect(page).toHaveURL(/\/action-workbench\/#projects\//);
  await page.reload();
  await expect(page.getByRole('heading',{name:'部署验证',exact:true})).toBeVisible();
  await expect(page.locator('.brand img')).toBeVisible();
  expect(await page.locator('.brand img').evaluate(img=>img.complete&&img.naturalWidth>0)).toBe(true);
  await page.goto('./#summary');await expect(page.getByRole('heading',{name:'每日小结',exact:true})).toBeVisible();
  await page.goto('./#schedule');await expect(page.getByRole('heading',{name:'日程',exact:true})).toBeVisible();
  expect(errors).toEqual([]);expect(missing).toEqual([]);
});
