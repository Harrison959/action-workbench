import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  // Fresh browser contexts: never read or mutate the owner's real storage/cloud.
  await page.addInitScript(() => localStorage.setItem('action-cloud', JSON.stringify({url:'',key:''})));
});

test('navigation, old links and mobile layout remain usable', async ({ page }, info) => {
  const errors=[];
  page.on('pageerror', e=>errors.push(e.message));
  await page.goto('/');
  await expect(page.getByRole('heading',{name:'今日行动',exact:true})).toBeVisible();
  const nav=page.getByRole('navigation',{name:info.project.name==='mobile'?'手机导航':'主导航',exact:true});
  await expect(nav).toBeVisible();
  await expect(nav.locator('a,button')).toHaveCount(info.project.name==='mobile'?5:7);
  for (const route of ['projects','calendar','review','inbox','data','more','tasks','schedule','summary','plan','goals','income','sales','sleep','courses','english','fitness','guitar','emotion','settings']) {
    await page.goto('/#'+route);
    await expect(page.locator('main h1')).toBeVisible();
    await expect(page.getByText('页面暂时无法打开')).toHaveCount(0);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1),route+' overflows').toBe(true);
  }
  await page.goto('/#more');
  await page.getByRole('link',{name:/设置与同步/}).click();
  await expect(page).toHaveURL(/#settings$/);
  await page.goBack();
  await expect(page).toHaveURL(/#more$/);
  expect(errors).toEqual([]);
  await page.screenshot({path:'.qa/'+info.project.name+'-more.png',fullPage:true});
});

test('quick add persists tasks, inbox items and calendar events', async ({ page }, info) => {
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/');
  const add=()=>info.project.name==='mobile'?page.getByRole('navigation',{name:'手机导航'}).getByRole('button',{name:'添加'}):page.locator('.topbar').getByRole('button',{name:'添加'});
  await add().click();
  await page.getByRole('dialog').getByRole('button',{name:'新建任务',exact:true}).click();
  await page.getByLabel('具体做什么').fill('检查每天的记录');
  await page.getByRole('button',{name:'保存记录',exact:true}).click();
  await page.goto('/#tasks');
  await expect(page.getByText('检查每天的记录',{exact:true})).toBeVisible();
  await page.reload();
  await expect(page.getByText('检查每天的记录',{exact:true})).toBeVisible();
  await add().click();
  await page.getByRole('button',{name:'快速记录到收件箱'}).click();
  await page.getByLabel('想到什么？').fill('准备下周资料');
  await page.getByRole('button',{name:'保存记录',exact:true}).click();
  await page.goto('/#inbox');
  await expect(page.getByText('准备下周资料',{exact:true})).toBeVisible();
  await add().click();
  await page.getByRole('button',{name:'添加日程',exact:true}).click();
  const dialog=page.getByRole('dialog');
  await dialog.locator('input[name="title"]').fill('复习约定');
  await dialog.getByRole('button',{name:'保存记录',exact:true}).click();
  await expect(dialog).toHaveCount(0);
  await page.goto('/#calendar');
  await expect(page.getByText('复习约定',{exact:true})).toBeVisible();
  expect(errors).toEqual([]);
});
