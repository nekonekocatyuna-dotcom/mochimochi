import { useEffect, useState } from 'react'
import { ArrowRight, ArrowUpRight, BookOpen, Check, ChevronLeft, GraduationCap, RotateCcw, Target, X } from 'lucide-react'
import bank from './data/pdf-quiz.json'
import sources from './data/pdf-sources.json'

type Question = typeof bank[number]
type Saved = Record<string, { attempts: number; correct: number; lastCorrect: boolean }>
type Item = { question: Question; options: string[]; correctIndex: number }
type Session = { items: Item[]; answers: (number | null)[]; index: number; graded: boolean; finished: boolean }
const STORAGE = 'om-notes-pdf-progress-v1'
const titles = ['作業管理の基礎', '競争力・戦略・生産性', '需要予測', '製品設計・信頼性', '能力計画・意思決定']
function load(): Saved {
  try {
    const data = JSON.parse(localStorage.getItem(STORAGE) || '{}')
    if (!data || typeof data !== 'object' || Array.isArray(data)) return {}
    const valid = new Set(bank.map(q => q.id))
    return Object.fromEntries(Object.entries(data).filter(([id, entry]) => {
      if (!valid.has(id) || !entry || typeof entry !== 'object') return false
      const e = entry as Saved[string]
      return Number.isInteger(e.attempts) && e.attempts > 0 && Number.isInteger(e.correct) && e.correct >= 0 && e.correct <= e.attempts && typeof e.lastCorrect === 'boolean'
    })) as Saved
  } catch { return {} }
}
function shuffle<T,>(input: T[]) {
  const result = [...input]
  for (let i = result.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [result[i], result[j]] = [result[j], result[i]] }
  return result
}
// Round-robin across shuffled chapters gives each chapter 10 items in a mixed 50-question session.
function selectQuestions(pool: Question[], size: number, mixed: boolean) {
  if (!mixed) return shuffle(pool).slice(0, size)
  const groups = shuffle([1, 2, 3, 4, 5]).map(ch => shuffle(pool.filter(q => q.chapter === ch)))
  const picked: Question[] = []
  while (picked.length < size && groups.some(g => g.length)) {
    for (const group of groups) {
      if (picked.length >= size) break
      const q = group.pop()
      if (q) picked.push(q)
    }
  }
  return shuffle(picked)
}

export default function PdfQuiz() {
  const [scope, setScope] = useState('all')
  const [count, setCount] = useState('50')
  const [weakOnly, setWeakOnly] = useState(false)
  const [saved, setSaved] = useState<Saved>(load)
  const [saveError, setSaveError] = useState(false)
  const [session, setSession] = useState<Session | null>(null)
  const [confirmExit, setConfirmExit] = useState(false)
  const [confirmReset, setConfirmReset] = useState(false)
  const weakIds = new Set(Object.keys(saved).filter(id => !saved[id].lastCorrect))
  const learned = Object.values(saved).filter(e => e.lastCorrect).length
  const answered = Object.keys(saved).length
  useEffect(() => {
    try { localStorage.setItem(STORAGE, JSON.stringify(saved)); setSaveError(false) } catch { setSaveError(true) }
  }, [saved])
  useEffect(() => {
    const listener = (e: StorageEvent) => { if (e.key === STORAGE) setSaved(load()) }
    window.addEventListener('storage', listener)
    return () => window.removeEventListener('storage', listener)
  }, [])
  const poolFor = (chapter: string, weak: boolean) => bank.filter(q => (chapter === 'all' || q.chapter === Number(chapter)) && (!weak || weakIds.has(q.id)))
  const pool = poolFor(scope, weakOnly)
  const amount = count === 'all' ? pool.length : Math.min(Number(count), pool.length)
  function scrollToQuiz() { requestAnimationFrame(() => document.getElementById('pdf-session')?.scrollIntoView({ block: 'start', behavior: 'instant' })) }
  function start(chapter = scope, requested = count, weak = weakOnly, questions?: Question[]) {
    const eligible = questions || poolFor(chapter, weak)
    const size = requested === 'all' ? eligible.length : Math.min(Number(requested), eligible.length)
    if (!size) return
    const chosen = selectQuestions(eligible, size, chapter === 'all')
    const positions = shuffle(chosen.map((_, i) => i % 4))
    const items = chosen.map((question, i) => {
      const options = shuffle(question.distractors)
      options.splice(positions[i], 0, question.answer)
      return { question, options, correctIndex: positions[i] }
    })
    setScope(chapter); setCount(requested); setWeakOnly(weak)
    setSession({ items, answers: items.map(() => null), index: 0, graded: false, finished: false })
    setConfirmExit(false); scrollToQuiz()
  }
  function grade() {
    if (!session || session.graded) return
    const item = session.items[session.index], selected = session.answers[session.index]
    if (selected === null) return
    const correct = selected === item.correctIndex
    setSaved(prev => ({ ...prev, [item.question.id]: { attempts: (prev[item.question.id]?.attempts || 0) + 1, correct: (prev[item.question.id]?.correct || 0) + Number(correct), lastCorrect: correct } }))
    setSession({ ...session, graded: true })
  }
  function next() {
    if (!session || !session.graded) return
    if (session.index === session.items.length - 1) setSession({ ...session, finished: true })
    else setSession({ ...session, index: session.index + 1, graded: false })
    scrollToQuiz()
  }
  function exit() { setSession(null); setConfirmExit(false); scrollToQuiz() }
  const source = (q: Question) => `参照：添付CH${q.chapter} PDF ${q.sourcePage}ページ（PDF先頭を1ページ目として数えています）`
  const stats = <div className="pdf-stats" aria-label="教科書クイズの学習記録"><div><strong>{answered}<small> / 150</small></strong><span>回答済み</span></div><div><strong>{learned}</strong><span>直近で正解</span></div><div><strong>{weakIds.size}</strong><span>復習したい問題</span></div><span className="pdf-save-status" role="status">{saveError ? '進捗を保存できません。ブラウザ設定を確認してください。' : 'このブラウザに自動保存'}</span></div>
  return <div className="pdf-shell">
    <div className="pdf-intro"><div className="eyebrow">TEXTBOOK PRACTICE · CHAPTERS 1–5</div><h1>教科書を読んだら、<br/><span className="accent-underline">英語で理解を深める。</span></h1><p>添付の教科書PDFに基づく、全150問。<br/>問題と選択肢は英語。答えた後は、日本語の解説で理解を深めます。</p><div className="hero-tags"><span><BookOpen size={14}/> 5章 × 30問</span><i/><span>計算・応用問題も収録</span><i/><span>出版社非公式の学習用問題</span></div></div>
    {stats}
    <div id="pdf-session" className="pdf-session">
    {!session ? <>
      <div className="pdf-section-title"><div><span className="eyebrow">CHAPTER PRACTICE</span><h2>章ごとに、じっくり。</h2></div><span>各章30問からランダムに10問</span></div>
      <div className="pdf-chapters">{sources.map(s => {
        const correct = bank.filter(q => q.chapter === s.chapter && saved[q.id]?.lastCorrect).length
        return <button className="pdf-chapter" key={s.chapter} onClick={() => start(String(s.chapter), '10', false)} aria-label={`CH${s.chapter} ${titles[s.chapter - 1]} 10問を始める`}><span className="eyebrow">CHAPTER 0{s.chapter}<ArrowUpRight size={15}/></span><h3>{titles[s.chapter - 1]}</h3><p>30問 · PDF {s.pages}ページ</p><div className="tab-progress"><div style={{ width: `${correct / 30 * 100}%` }}/></div><span className="pdf-chapter-bottom">直近で正解 {correct} / 30 <ArrowRight size={16}/></span></button>
      })}</div>
      <div className="pdf-mixed"><div><span className="eyebrow">THE 50-QUESTION CHALLENGE</span><h2>全5章から、50問に挑戦。</h2><p>各章から10問ずつ。順番も選択肢も毎回シャッフルします。</p></div><button className="primary" onClick={() => start('all', '50', false)}>全章50問を始める <ArrowRight size={18}/></button></div>
      <div className="pdf-custom"><div className="pdf-section-title"><div><span className="eyebrow">MAKE IT YOURS</span><h2>出題をカスタマイズ</h2></div><Target size={22}/></div><div className="setup-fields"><label>教科書の出題範囲<select value={scope} onChange={e => setScope(e.target.value)}><option value="all">全章混合（CH1〜CH5）</option>{titles.map((t, i) => <option key={t} value={i + 1}>CH{i + 1} {t}</option>)}</select></label><label>教科書の出題数<select value={count} onChange={e => setCount(e.target.value)}>{['5', '10', '20', '50', 'all'].map(n => <option key={n} value={n}>{n === 'all' ? '全問' : `${n}問`}</option>)}</select></label></div><label className="checkbox-row"><input type="checkbox" checked={weakOnly} onChange={e => setWeakOnly(e.target.checked)}/> 直近で間違えた問題だけ</label><p className="pool-info">対象 {pool.length}問 · 今回は {amount}問を出題{count !== 'all' && pool.length < Number(count) ? '（対象の全問）' : ''}</p><button className="primary large" disabled={!pool.length} onClick={() => start()}>この設定で始める <ArrowRight size={17}/></button>{!pool.length && <p className="pdf-empty" role="status">対象の問題はありません。クイズで間違えた問題が自動でここに集まります。</p>}</div>
      <details className="pdf-about"><summary>教材・出題範囲と学習記録について</summary><p>アップロードされた5章のPDFを基に新しく作成した学習用の選択問題です。原文の試験問題や出版社公式の問題・解答ではありません。原本PDFはサイトに公開していません。</p><p>CH4の信頼性、CH5の意思決定理論の補足も含みます。計算問題の数値は練習用に設定しています。CH3のMSE計算問題は、このPDFの式（3-16）の分母 n − 1 を明記して使用しています。</p><p>直近の回答が不正解の問題を復習対象にします。正解すると復習対象から外れます。以前のDiscussion教材の進捗とは別に保存します。</p><button className="text-button" onClick={() => setConfirmReset(true)}>教科書クイズの記録をリセット</button>{confirmReset && <div className="pdf-inline-confirm" role="alert"><p>教科書クイズの学習記録だけを削除しますか？</p><button className="secondary" onClick={() => setConfirmReset(false)}>キャンセル</button><button className="secondary" onClick={() => { setSaved({}); setConfirmReset(false) }}>記録を削除する</button></div>}</details>
    </> : session.finished ? (() => {
      const correct = session.items.filter((item, i) => item.correctIndex === session.answers[i]).length
      const wrong = session.items.filter((item, i) => item.correctIndex !== session.answers[i]).map(item => item.question)
      return <div className="results pdf-results"><div className="setup-icon"><GraduationCap size={34}/></div><span className="eyebrow">PRACTICE COMPLETE</span><h2>おつかれさまでした。</h2><div className="score"><strong>{correct}</strong><span> / {session.items.length} 問正解</span><b>{Math.round(correct / session.items.length * 100)}点</b></div><p>間違えた問題は復習対象に保存しました。下の各問題から解説を確認できます。</p><div className="pdf-chapter-results">{titles.map((title, i) => {
        const items = session.items.map((item, index) => ({ item, index })).filter(x => x.item.question.chapter === i + 1)
        if (!items.length) return null
        return <span key={title}>CH{i + 1}：{items.filter(x => x.item.correctIndex === session.answers[x.index]).length} / {items.length} 正解</span>
      })}</div><div className="result-actions"><button className="primary" onClick={() => start(scope, 'all', false, session.items.map(x => x.question))}><RotateCcw size={17}/>同じ問題で再挑戦</button><button className="secondary" disabled={!wrong.length} onClick={() => start('all', 'all', false, wrong)}>今回の誤答だけ再挑戦</button><button className="text-button" onClick={exit}><ChevronLeft size={16}/>章・出題数を選び直す</button></div><div className="result-list">{session.items.map((item, i) => <details key={item.question.id}><summary><span className={item.correctIndex === session.answers[i] ? 'correct-text' : 'incorrect-text'}>{item.correctIndex === session.answers[i] ? '正解' : '不正解'}</span> CH{item.question.chapter} · Q{item.question.number} <span lang="en" className="pdf-result-question">{item.question.question}</span></summary><div className="result-detail"><p>あなたの回答：<span lang="en">{item.options[session.answers[i]!]}</span></p><p>正答：<span lang="en">{item.question.answer}</span></p><p lang="ja">{item.question.explanation}</p><p className="pdf-source">{source(item.question)}</p></div></details>)}</div></div>
    })() : (() => {
      const item = session.items[session.index], q = item.question, selected = session.answers[session.index], correct = selected === item.correctIndex
      return <div className="quiz-running pdf-running"><div className="quiz-meta"><span>QUESTION {String(session.index + 1).padStart(2, '0')} / {session.items.length}</span><button className="text-button" onClick={() => setConfirmExit(true)}>クイズを終了 <X size={16}/></button></div>{confirmExit && <div className="pdf-inline-confirm" role="alert"><p>回答済みの学習記録は保存されています。クイズを終了しますか？</p><button className="secondary" onClick={() => setConfirmExit(false)}>続ける</button><button className="secondary" onClick={exit}>終了して設定に戻る</button></div>}<div className="quiz-progress"><div style={{ width: `${(session.index + Number(session.graded)) / session.items.length * 100}%` }}/></div><span className="tag">CH{q.chapter} · <span lang="en">{q.topic}</span></span><div className="pdf-question-content" lang="en"><h2 className="quiz-original">{q.question}</h2><p className="pdf-instruction">Choose the one best answer.</p><div className="options" lang="en">{item.options.map((option, i) => <button key={i} className={`option ${selected === i ? 'picked' : ''} ${session.graded && i === item.correctIndex ? 'correct' : ''} ${session.graded && selected === i && !correct ? 'incorrect' : ''}`} aria-pressed={selected === i} disabled={session.graded} onClick={() => { const answers = [...session.answers]; answers[session.index] = i; setSession({ ...session, answers }) }}><span>{'ABCD'[i]}</span><span>{option}</span>{session.graded && i === item.correctIndex && <Check size={19}/>}</button>)}</div></div>{session.graded && <div role="status" className={`feedback ${correct ? 'success' : 'failure'}`}><h3>{correct ? '正解です！' : '解説で確認しましょう。'}</h3><p>正答：<b>{'ABCD'[item.correctIndex]}</b></p><p className="quiz-answer" lang="en">{q.answer}</p><p className="pdf-explanation" lang="ja">{q.explanation}</p><p className="pdf-source">{source(q)}</p><small>教科書に基づく学習用解説です。出版社公式の解答ではありません。</small></div>}<div className="quiz-actions">{session.graded ? <button className="primary" onClick={next}>{session.index === session.items.length - 1 ? '結果を見る' : '次の問題へ'}<ArrowRight size={17}/></button> : <button className="primary" disabled={selected === null} onClick={grade}>回答を採点する<Check size={17}/></button>}</div></div>
    })()}
    </div>
  </div>
}
