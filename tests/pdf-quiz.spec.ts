import {test,expect,type Page} from '@playwright/test'
import bank from '../src/data/pdf-quiz.json' with {type:'json'}
const KEY='om-notes-pdf-progress-v1'
async function current(page:Page){
 const text=await page.locator('.pdf-question-content .quiz-original').innerText()
 const q=bank.find(q=>q.question===text)
 expect(q).toBeTruthy(); return q!
}
async function choose(page:Page,wrong=false){
 const q=await current(page),options=page.locator('.pdf-running .option')
 const texts=await options.locator('span:nth-child(2)').allTextContents()
 const index=texts.indexOf(q.answer)
 expect(index).toBeGreaterThanOrEqual(0)
 await options.nth(wrong?(index+1)%4:index).click()
 await page.getByRole('button',{name:'回答を採点する',exact:true}).click()
 await expect(page.locator('.pdf-explanation')).toHaveText(q.explanation)
 await expect(page.locator('.pdf-explanation')).toHaveAttribute('lang','ja')
 await expect(page.locator('.pdf-running .pdf-source')).toContainText(`CH${q.chapter} PDF ${q.sourcePage}ページ`)
 await expect(page.locator('.pdf-running .quiz-answer')).toHaveText(q.answer)
 return {q,index}
}
async function exit(page:Page){
 await page.getByRole('button',{name:'クイズを終了'}).click()
 await page.getByRole('button',{name:'終了して設定に戻る'}).click()
}
test.beforeEach(async({page})=>{await page.goto('/')})
test('PDF quiz is the landing page and every chapter has its own section',async({page},info)=>{
 await page.screenshot({path:`test-results/${info.project.name}-pdf-overview.png`,fullPage:true})
 await expect(page.locator('.pdf-chapter')).toHaveCount(5)
 await expect(page.locator('.pdf-intro')).toContainText('全150問')
 for(let chapter=1;chapter<=5;chapter++){
  await page.locator('.pdf-chapter').nth(chapter-1).click()
  await expect(page.locator('.pdf-running .quiz-meta')).toContainText('/ 10')
  expect((await current(page)).chapter).toBe(chapter)
  await expect(page.getByRole('button',{name:'回答を採点する',exact:true})).toBeDisabled()
  expect(await page.locator('.pdf-question-content').innerText()).not.toMatch(/[\u3040-\u9fff]/)
  await choose(page)
  await exit(page)
 }
 await page.getByRole('button',{name:'教材を読む',exact:true}).click()
 await expect(page.locator('.question-card')).toHaveCount(17)
 await page.getByRole('button',{name:'教科書クイズ',exact:true}).click()
 await expect(page.locator('.pdf-chapter')).toHaveCount(5)
})
test('mixed 50 covers all five chapters equally, grades, retries only errors and saves progress',async({page})=>{
 test.setTimeout(120000)
 await page.getByRole('button',{name:'全章50問を始める'}).click()
 const ids=new Set<string>(),chapters=[0,0,0,0,0],positions=[0,0,0,0]
 let wrongId=''
 for(let i=0;i<50;i++){
  const {q,index}=await choose(page,i===0)
  expect(ids.has(q.id)).toBeFalsy();ids.add(q.id);chapters[q.chapter-1]++;positions[index]++
  if(i===0)wrongId=q.id
  await page.getByRole('button',{name:i===49?'結果を見る':'次の問題へ',exact:true}).click()
 }
 expect(chapters).toEqual([10,10,10,10,10])
 expect(Math.max(...positions)-Math.min(...positions)).toBeLessThanOrEqual(1)
 await expect(page.locator('.pdf-results .score')).toContainText('98点')
 await expect(page.locator('.pdf-results .result-list details')).toHaveCount(50)
 await page.locator('.pdf-results summary').first().click()
 await expect(page.locator('.pdf-results .result-detail').first()).toContainText(bank.find(q=>q.id===wrongId)!.explanation)
 await page.getByRole('button',{name:'今回の誤答だけ再挑戦'}).click()
 await expect(page.locator('.pdf-running .quiz-meta')).toContainText('/ 1')
 expect((await current(page)).id).toBe(wrongId)
 await choose(page)
 await page.getByRole('button',{name:'結果を見る',exact:true}).click()
 await expect(page.locator('.pdf-results .score')).toContainText('100点')
 await page.reload()
 const saved=await page.evaluate(k=>JSON.parse(localStorage.getItem(k)!),KEY)
 expect(Object.keys(saved)).toHaveLength(50)
 expect(saved[wrongId]).toEqual({attempts:2,correct:1,lastCorrect:true})
 await expect(page.locator('.pdf-stats>div').first()).toContainText('50')
})
test('all 150 PDF questions complete with English-only options, Japanese explanations and balanced answers',async({page})=>{
 test.setTimeout(180000)
 await page.getByLabel('教科書の出題数').selectOption('all')
 await page.getByRole('button',{name:'この設定で始める'}).click()
 const seen=new Set<string>(),chapters=[0,0,0,0,0],positions=[0,0,0,0]
 for(let i=0;i<150;i++){
  const q=await current(page)
  expect(seen.has(q.id)).toBeFalsy();seen.add(q.id);chapters[q.chapter-1]++
  expect(await page.locator('.pdf-question-content').innerText()).not.toMatch(/[\u3040-\u9fff]/)
  const texts=await page.locator('.pdf-running .option span:nth-child(2)').allTextContents()
  expect(new Set(texts).size).toBe(4)
  expect(texts.filter(t=>t===q.answer)).toHaveLength(1)
  const {index}=await choose(page);positions[index]++
  await page.getByRole('button',{name:i===149?'結果を見る':'次の問題へ',exact:true}).click()
 }
 expect(seen.size).toBe(150);expect(chapters).toEqual([30,30,30,30,30])
 expect(Math.max(...positions)-Math.min(...positions)).toBeLessThanOrEqual(1)
 await expect(page.locator('.pdf-results .score')).toContainText('100点')
 await expect(page.getByRole('button',{name:'今回の誤答だけ再挑戦'})).toBeDisabled()
 await page.getByRole('button',{name:'同じ問題で再挑戦'}).click()
 await expect(page.locator('.pdf-running .quiz-meta')).toContainText('/ 150')
})
test('custom sizes and chapter bounds work, and weak-only empty state prevents starting',async({page})=>{
 await page.getByLabel('直近で間違えた問題だけ').check()
 await expect(page.getByRole('button',{name:'この設定で始める'})).toBeDisabled()
 await page.getByLabel('直近で間違えた問題だけ').uncheck()
 for(const [scope,count,total] of [['all','5',5],['all','10',10],['all','20',20],['all','50',50],['2','all',30],['3','50',30]] as const){
  await page.getByLabel('教科書の出題範囲').selectOption(scope)
  await page.getByLabel('教科書の出題数').selectOption(count)
  await expect(page.locator('.pdf-custom .pool-info')).toContainText(`今回は ${total}問`)
  await page.getByRole('button',{name:'この設定で始める'}).click()
  await expect(page.locator('.pdf-running .quiz-meta')).toContainText(`/ ${total}`)
  await exit(page)
 }
})
test('weak-only uses saved PDF errors, and reset preserves Discussion progress',async({page})=>{
 await page.evaluate(({key})=>{
  localStorage.setItem(key,JSON.stringify({'pdf-ch2-q1':{attempts:1,correct:0,lastCorrect:false},'pdf-ch5-q1':{attempts:2,correct:2,lastCorrect:true}}))
  localStorage.setItem('om-notes-progress-v1',JSON.stringify({'ch1-q1':{status:'learned'}}))
 },{key:KEY})
 await page.reload()
 await page.getByLabel('直近で間違えた問題だけ').check()
 await page.getByRole('button',{name:'この設定で始める'}).click()
 expect((await current(page)).id).toBe('pdf-ch2-q1')
 await choose(page)
 await page.getByRole('button',{name:'結果を見る',exact:true}).click()
 await page.getByRole('button',{name:'章・出題数を選び直す'}).click()
 await page.locator('.pdf-about summary').click()
 await page.getByRole('button',{name:'教科書クイズの記録をリセット'}).click()
 await page.getByRole('button',{name:'キャンセル',exact:true}).click()
 let saved=await page.evaluate(k=>JSON.parse(localStorage.getItem(k)!),KEY)
 expect(Object.keys(saved)).toHaveLength(2)
 await page.getByRole('button',{name:'教科書クイズの記録をリセット'}).click()
 await page.getByRole('button',{name:'記録を削除する',exact:true}).click()
 saved=await page.evaluate(k=>JSON.parse(localStorage.getItem(k)!),KEY)
 expect(saved).toEqual({})
 await page.getByRole('button',{name:'教材を読む',exact:true}).click()
 await expect(page.locator('.question-card').first().getByRole('button',{name:'覚えた',exact:true})).toHaveAttribute('aria-pressed','true')
})
test('mobile widths, exit confirmation, malformed data and screenshots',async({page},info)=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message))
 for(const width of [320,375,390]){
  await page.setViewportSize({width,height:844})
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy()
 }
 await page.screenshot({path:`test-results/${info.project.name}-pdf-home.png`,fullPage:true})
 await page.getByRole('button',{name:'全章50問を始める'}).click()
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy()
 await choose(page,true)
 await page.screenshot({path:`test-results/${info.project.name}-pdf-feedback.png`,fullPage:true})
 await page.getByRole('button',{name:'クイズを終了'}).click()
 await page.getByRole('button',{name:'続ける',exact:true}).click()
 await expect(page.locator('.pdf-running')).toBeVisible()
 await exit(page)
 await page.evaluate(k=>localStorage.setItem(k,'{"pdf-ch1-q1":null,"bad":{},"pdf-ch2-q2":{"attempts":-1}}'),KEY)
 await page.reload()
 await expect(page.locator('.pdf-stats>div').first()).toContainText('0')
 expect(errors).toEqual([])
})
