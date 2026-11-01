import { expect, test, type Page } from '@playwright/test'
import material from '../src/data/material.json' with { type: 'json' }
const all = material.flatMap(c => c.questions)
async function quizSetup(page: Page, count = '5', scope = '1') {
  await page.getByRole('button', { name: '小テスト', exact: true }).click()
  await page.getByLabel('出題する章').selectOption(scope)
  await page.getByLabel('出題数').selectOption(count)
  await page.getByRole('button', { name: '小テストを始める' }).click()
}
function currentQuestion(page: Page) {
  return page.locator('.quiz-original').innerText().then(original => all.find(q => q.original === original)!)
}
test.beforeEach(async ({ page }) => { await page.goto('/') })
test('all chapters show exact original, translation and all four collapsible fields', async ({ page }) => {
  for (const c of material) {
    await page.getByRole('tab').nth(c.id - 1).click()
    const cards = page.locator('.question-card')
    await expect(cards).toHaveCount(c.questions.length)
    for (let i=0;i<c.questions.length;i++) {
      const card=cards.nth(i), q=c.questions[i]
      await expect(card.locator('.original-question')).toHaveText(q.original)
      await expect(card.locator('.translation p')).toHaveText(q.translation)
    }
    const card=cards.first()
    await expect(card.locator('.answer-panel')).toHaveCount(0)
    await card.getByRole('button', { name: '解答・解説をひらく' }).click()
    const fields=card.locator('.answer-panel section p')
    await expect(fields).toHaveText([c.questions[0].answer,c.questions[0].explanation,c.questions[0].caution,c.questions[0].traditionalChinese])
    await card.getByRole('button', { name: '解答・解説を閉じる' }).click()
    await expect(card.locator('.answer-panel')).toHaveCount(0)
  }
})
test('learned and review persist after reload and update chapter progress', async ({ page }) => {
  const card=page.locator('.question-card').first()
  await card.getByRole('button', {name:'覚えた',exact:true}).click()
  await expect(page.getByRole('tab').first()).toContainText('1 / 17 問')
  await page.reload()
  await expect(card.getByRole('button',{name:'覚えた',exact:true})).toHaveAttribute('aria-pressed','true')
  await card.getByRole('button',{name:'要復習',exact:true}).click()
  await page.reload()
  await expect(card.getByRole('button',{name:'要復習',exact:true})).toHaveAttribute('aria-pressed','true')
  await page.getByRole('button',{name:/苦手を復習/}).click()
  await expect(page.locator('.question-card')).toHaveCount(1)
  await card.getByRole('button',{name:'覚えた',exact:true}).click()
  await expect(page.locator('.question-card')).toHaveCount(0)
  await expect(page.getByText('復習する問題はまだありません')).toBeVisible()
})
test('searches all chapters in English, Japanese and traditional Chinese; clears and handles no results', async ({ page }) => {
  const search=page.getByRole('textbox',{name:'キーワード検索'})
  for (const term of ['Forecast','サプライチェーン','產能']) {
    await search.fill(term)
    const expected=all.filter(q=>Object.values(q).join(' ').normalize('NFKC').toLocaleLowerCase().includes(term.normalize('NFKC').toLocaleLowerCase()))
    await expect(page.locator('.question-card')).toHaveCount(expected.length)
    expect(expected.length).toBeGreaterThan(0)
  }
  await search.fill('no_such_keyword_92341')
  await expect(page.getByText('一致する問題がありません')).toBeVisible()
  await page.getByRole('button',{name:'検索をクリア'}).first().click()
  await expect(page.locator('.question-card')).toHaveCount(17)
})
test('5-question quiz grades, explains errors, scores, stores weak items and retries', async ({ page }) => {
  await quizSetup(page)
  await expect(page.getByRole('button',{name:'回答を採点する'})).toBeDisabled()
  let firstWrong=''
  const positions:number[]=[]
  for(let i=0;i<5;i++) {
    const q=await currentQuestion(page)
    expect(q).toBeTruthy()
    const options=page.locator('.option')
    await expect(options).toHaveCount(4)
    const texts=await options.locator('span:nth-child(2)').allTextContents()
    const correctIndex=texts.indexOf(q.answer)
    expect(correctIndex).toBeGreaterThanOrEqual(0)
    positions.push(correctIndex)
    if(i===0) { firstWrong=q.id; await options.nth((correctIndex+1)%4).click() }
    else await options.nth(correctIndex).click()
    await page.getByRole('button',{name:'回答を採点する'}).click()
    await expect(page.locator('.feedback')).toContainText(q.explanation)
    await expect(page.locator('.feedback')).toContainText(q.caution)
    await expect(options.nth(correctIndex)).toHaveClass(/correct/)
    await page.getByRole('button',{name:i===4?'結果を見る':'次の問題へ'}).click()
  }
  const counts=[0,1,2,3].map(p=>positions.filter(x=>x===p).length)
  expect(Math.max(...counts)-Math.min(...counts)).toBeLessThanOrEqual(1)
  await expect(page.locator('.score')).toContainText('80点')
  await expect(page.locator('.result-list details')).toHaveCount(5)
  await page.locator('.result-list summary').first().click()
  await expect(page.locator('.result-detail').first()).toBeVisible()
  await page.getByRole('button',{name:'再挑戦する'}).click()
  await expect(page.locator('.quiz-original')).toBeVisible()
  await page.reload()
  await page.getByRole('button',{name:/苦手を復習/}).click()
  await expect(page.locator('.question-card')).toHaveCount(1)
  await expect(page.locator('.question-card')).toHaveAttribute('id',firstWrong)
})
test('mixed quizzes support 10,20,all and chapter pool bounds; review quiz handles empty pool', async ({ page }) => {
  await page.getByRole('button',{name:'小テスト',exact:true}).click()
  await page.getByLabel('苦手問題だけを出題する').check()
  await expect(page.getByRole('button',{name:'小テストを始める'})).toBeDisabled()
  await page.getByLabel('苦手問題だけを出題する').uncheck()
  for (const [scope,count,total] of [['all','10',10],['all','20',20],['all','all',87],['2','20',15],['3','all',19]] as const) {
    await page.getByLabel('出題する章').selectOption(scope)
    await page.getByLabel('出題数').selectOption(count)
    await expect(page.locator('.pool-info')).toContainText(`今回は ${total}問`)
    await page.getByRole('button',{name:'小テストを始める'}).click()
    await expect(page.locator('.quiz-meta')).toContainText(`/ ${total}`)
    await page.getByRole('button',{name:'設定に戻る'}).click()
  }
})
test('weak-only quiz contains marked questions only', async ({ page }) => {
  await page.locator('.question-card').first().getByRole('button',{name:'要復習',exact:true}).click()
  await page.getByRole('tab').nth(2).click()
  await page.locator('.question-card').first().getByRole('button',{name:'要復習',exact:true}).click()
  await page.getByRole('button',{name:/苦手を復習/}).click()
  await page.getByRole('button',{name:'苦手を小テスト'}).click()
  await expect(page.getByLabel('苦手問題だけを出題する')).toBeChecked()
  await page.getByLabel('出題数').selectOption('all')
  await page.getByRole('button',{name:'小テストを始める'}).click()
  const ids=[]
  for(let i=0;i<2;i++) {
    const q=await currentQuestion(page);ids.push(q.id)
    const options=page.locator('.option'); const texts=await options.locator('span:nth-child(2)').allTextContents()
    await options.nth(texts.indexOf(q.answer)).click()
    await page.getByRole('button',{name:'回答を採点する'}).click()
    await page.getByRole('button',{name:i===1?'結果を見る':'次の問題へ'}).click()
  }
  expect(ids.sort()).toEqual(['ch1-q1','ch3-q1'])
})
test('layout has no viewport overflow and all controls work at mobile width', async ({ page },testInfo) => {
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message))
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy()
  await page.screenshot({path:`test-results/${testInfo.project.name}-overview.png`,fullPage:false})
  await page.getByRole('tab').last().click()
  await expect(page.locator('.question-card')).toHaveCount(17)
  await page.locator('.question-card').first().getByRole('button',{name:'解答・解説をひらく'}).click()
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy()
  await expect(page.locator('[lang="zh-Hant"]').first()).toContainText(material[4].questions[0].traditionalChinese)
  await page.screenshot({path:`test-results/${testInfo.project.name}-study.png`,fullPage:false})
  await quizSetup(page,'5','5')
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy()
  await page.screenshot({path:`test-results/${testInfo.project.name}-quiz.png`,fullPage:true})
  expect(errors).toEqual([])
})
test('corrupt saved progress is recovered safely', async ({page})=>{
  await page.evaluate(()=>localStorage.setItem('om-notes-progress-v1','{"ch1-q1":null,"unknown":{},"ch2-q1":{"status":"fake"}}'))
  await page.reload()
  await expect(page.locator('.question-card')).toHaveCount(17)
  await expect(page.getByRole('tab').first()).toContainText('0 / 17 問')
})
test('all 87 quiz questions have one source answer, no duplicates and balanced correct positions', async ({page})=>{
  test.setTimeout(180000)
  await quizSetup(page,'all','all')
  const seen=new Set<string>(),positions=[0,0,0,0]
  for(let i=0;i<87;i++) {
    const q=await currentQuestion(page)
    expect(q).toBeTruthy();expect(seen.has(q.id)).toBeFalsy();seen.add(q.id)
    const options=page.locator('.option')
    const texts=await options.locator('span:nth-child(2)').allTextContents()
    expect(texts).toHaveLength(4);expect(new Set(texts).size).toBe(4)
    expect(texts.filter(t=>t===q.answer)).toHaveLength(1)
    const correct=texts.indexOf(q.answer);positions[correct]++
    await options.nth(correct).click()
    await page.getByRole('button',{name:'回答を採点する'}).click()
    await expect(page.locator('.feedback')).toContainText(q.explanation)
    await page.getByRole('button',{name:i===86?'結果を見る':'次の問題へ'}).click()
  }
  expect(seen.size).toBe(87)
  expect(Math.max(...positions)-Math.min(...positions)).toBeLessThanOrEqual(1)
  await expect(page.locator('.score')).toContainText('100点')
})

test('narrow 320px and 375px layouts fit the viewport', async ({page})=>{
  for(const width of [320,375]) {
    await page.setViewportSize({width,height:844})
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy()
    await page.locator('.question-card').first().getByRole('button',{name:'解答・解説をひらく'}).click()
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy()
    await page.locator('.question-card').first().getByRole('button',{name:'解答・解説を閉じる'}).click()
  }
})
