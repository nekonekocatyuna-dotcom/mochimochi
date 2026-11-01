import React, { useEffect, useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { ArrowRight, ArrowUpRight, BookOpen, Check, ChevronDown, CircleHelp, RotateCcw, Search, Sparkles, Target, X, Bookmark, CheckCheck, GraduationCap } from 'lucide-react'
import material from './data/material.json'
import rawEnglishQuiz from './data/quiz-en.json'
import './style.css'
import PdfQuiz from './PdfQuiz'

type Question = typeof material[number]['questions'][number]
type Status = 'learned' | 'review'
type RecordEntry = { status?: Status; incorrect?: boolean }
type Progress = Record<string, RecordEntry>
type QuizItem = { question: Question; chapter: number; options: string[]; correct: number }
type Session = { items: QuizItem[]; answers: (number | null)[]; index: number; submitted: boolean; finished: boolean }
const STORE = 'om-notes-progress-v1'
const chapterNames = ['作業管理の基礎', '競争力・戦略・生産性', '需要予測', '製品・サービスの設計', '戦略的な能力計画']
const descriptions = ['財やサービスを生み出す仕組みと、サプライチェーンのつながりを学びましょう。', '競争優位を生む戦略と、生産性を高める考え方を学びましょう。', '不確実な未来に備える予測の手法と、その限界を学びましょう。', '顧客の声を価値に変える、製品・サービス設計を学びましょう。', '需要と供給をつなぐ、長期的な能力計画を学びましょう。']
const allQuestions = material.flatMap(c => c.questions.map(q => ({ question: q, chapter: c.id })))
const englishQuiz = rawEnglishQuiz as Record<string, { answer: string; distractors: string[] }>
function loadProgress(): Progress {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORE) || '{}')
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
    const validIds = new Set(allQuestions.map(x => x.question.id))
    return Object.fromEntries(Object.entries(parsed).filter(([id, v]) => validIds.has(id) && v && typeof v === 'object').map(([id, v]) => {
      const e = v as RecordEntry
      return [id, { status: e.status === 'learned' || e.status === 'review' ? e.status : undefined, incorrect: e.incorrect === true }]
    }))
  } catch { return {} }
}
function shuffled<T,>(input: T[]): T[] {
  const a = [...input]
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]] }
  return a
}
function App() {
  const [chapter, setChapter] = useState(1)
  const [view, setView] = useState<'textbook' | 'study' | 'quiz' | 'review'>('textbook')
  const [search, setSearch] = useState('')
  const [progress, setProgress] = useState<Progress>(loadProgress)
  const [storageError, setStorageError] = useState(false)
  const [scope, setScope] = useState('1')
  const [count, setCount] = useState('10')
  const [weakOnly, setWeakOnly] = useState(false)
  const [session, setSession] = useState<Session | null>(null)
  const learned = allQuestions.filter(x => progress[x.question.id]?.status === 'learned').length
  const isWeak = (id: string) => progress[id]?.status === 'review' || progress[id]?.incorrect === true
  const weakCount = allQuestions.filter(x => isWeak(x.question.id)).length
  const normalized = search.normalize('NFKC').toLocaleLowerCase().trim()
  const filtered = useMemo(() => {
    const base = view === 'review' ? allQuestions.filter(x => progress[x.question.id]?.status === 'review' || progress[x.question.id]?.incorrect) : normalized ? allQuestions : allQuestions.filter(x => x.chapter === chapter)
    return base.filter(x => Object.values(x.question).join(' ').normalize('NFKC').toLocaleLowerCase().includes(normalized))
  }, [chapter, view, normalized, progress])
  useEffect(() => {
    try { localStorage.setItem(STORE, JSON.stringify(progress)); setStorageError(false) } catch { setStorageError(true) }
  }, [progress])
  useEffect(() => {
    const listener = (e: StorageEvent) => { if (e.key === STORE) setProgress(loadProgress()) }
    window.addEventListener('storage', listener); return () => window.removeEventListener('storage', listener)
  }, [])
  function mark(id: string, status: Status) {
    setProgress(p => ({ ...p, [id]: { ...p[id], status: p[id]?.status === status ? undefined : status, ...(status === 'learned' ? { incorrect: false } : {}) } }))
  }
  function openView(v: typeof view) { setView(v); setSession(null); setSearch('') }
  function switchChapter(id: number) { if (view === 'review') setView('study'); setChapter(id); setScope(String(id)); setSearch(''); setSession(null) }
  const pool = allQuestions.filter(x => (scope === 'all' || x.chapter === Number(scope)) && (!weakOnly || isWeak(x.question.id)))
  function startQuiz() {
    const chosen = shuffled(pool).slice(0, count === 'all' ? pool.length : Number(count))
    // Shuffle a balanced set of correct positions. Every batch differs by at most one.
    const positions = shuffled(chosen.map((_, i) => i % 4))
    const items = chosen.map((x, i) => {
      const english = englishQuiz[x.question.id]
      const options = shuffled(english.distractors); options.splice(positions[i], 0, english.answer)
      return { ...x, options, correct: positions[i] }
    })
    setSession({ items, answers: items.map(() => null), index: 0, submitted: false, finished: false })
  }
  function grade() {
    if (!session) return
    const item = session.items[session.index]
    if (session.answers[session.index] === null) return
    const incorrect = session.answers[session.index] !== item.correct
    setProgress(p => ({ ...p, [item.question.id]: { ...p[item.question.id], incorrect, ...(incorrect ? { status: 'review' as Status } : {}) } }))
    setSession({ ...session, submitted: true })
  }
  function next() {
    if (!session) return
    if (session.index + 1 === session.items.length) setSession({ ...session, finished: true })
    else setSession({ ...session, index: session.index + 1, submitted: false })
  }
  return <>
    <header className="site-header"><div className="header-inner"><a className="brand" href="#" onClick={e => { e.preventDefault(); openView('textbook') }}><span className="brand-icon"><BookOpen size={22}/></span><span>OM <b>Notes</b><small>OPERATIONS MANAGEMENT</small></span></a><nav aria-label="メインナビゲーション">{([['textbook', '教科書クイズ', GraduationCap], ['study', '教材を読む', BookOpen], ['quiz', '小テスト', Target], ['review', '苦手を復習', Bookmark]] as const).map(([v, text, Icon]) => <button key={v} className={view === v ? 'nav-active' : ''} onClick={() => openView(v)}><Icon size={17}/><span>{text}</span>{v === 'review' && weakCount > 0 && <em>{weakCount}</em>}</button>)}</nav><div className="header-label"><span className="online-dot"/> あなたのペースで、少しずつ。</div></div></header>
    <main>
      <div hidden={view === 'textbook'}><section className="hero"><div className="hero-copy"><div className="eyebrow"><span className="tiny-line"/> YOUR PERSONAL STUDY SPACE</div><h1>理解を積み重ねて、<br/>知識を<span className="accent-underline">自分のものに。</span></h1><p>作業管理の基本から、戦略・予測・設計・能力計画まで。<br className="desktop-break"/>日英併記の教材と小テストで、一歩ずつ確かな理解へ。</p><div className="hero-tags"><span><BookOpen size={14}/> 全5章</span><i/><span>87のDiscussion問題</span><i/><span>日本語・English・繁體中文</span></div></div><aside className="overall-card"><div className="overall-top"><span><Sparkles size={16}/> あなたの学習記録</span><span className="muted">MY PROGRESS</span></div><div className="overall-body"><div className="progress-ring" style={{ '--progress': `${learned / 87 * 100}%` } as React.CSSProperties}><div><strong>{Math.round(learned / 87 * 100)}<small>%</small></strong><span>学習達成率</span></div></div><div className="overall-numbers"><div><span className="stat-dot green"/>覚えた<strong>{learned}<small> / 87 問</small></strong></div><div><span className="stat-dot amber"/>要復習<strong>{weakCount}<small> 問</small></strong></div></div></div><div className="overall-foot"><span className="online-dot"/> {storageError ? '保存できません。このブラウザの設定をご確認ください。' : '進捗はこのブラウザに自動保存されます'}</div></aside></section>
      <div className="section-bar"><div><span className="eyebrow">LEARNING PATH</span><h2>5つの章で、基礎をつかむ</h2></div><span className="path-note">小さな理解が、大きな自信に。</span></div>
      <div className="chapter-tabs" role="tablist" aria-label="章を選択">{material.map((c, i) => { const done = c.questions.filter(q => progress[q.id]?.status === 'learned').length; return <button role="tab" aria-selected={chapter === c.id} aria-controls="chapter-panel" id={`tab-${c.id}`} className={`chapter-tab ${chapter === c.id ? 'selected' : ''}`} key={c.id} onClick={() => switchChapter(c.id)}><div className="chapter-tab-top"><span>CHAPTER <b>0{c.id}</b></span>{chapter === c.id ? <span className="chapter-dot"/> : <ArrowUpRight size={15}/>}</div><strong>{chapterNames[i]}</strong><div className="tab-progress"><div style={{ width: `${done / c.questions.length * 100}%` }}/></div><div className="tab-count"><span>{done} / {c.questions.length} 問</span><span>{Math.round(done / c.questions.length * 100)}%</span></div></button> })}</div>
      </div><section className="workspace" id="chapter-panel" role={view === 'textbook' ? 'region' : 'tabpanel'} aria-label={view === 'textbook' ? '教科書PDFのクイズ' : undefined} aria-labelledby={view === 'textbook' ? undefined : `tab-${chapter}`}>
      {view === 'textbook' ? <PdfQuiz/> : view === 'quiz' ? <div className="quiz-layout"><div className="workspace-heading"><div><span className="eyebrow">CHECK YOUR UNDERSTANDING</span><h2>小テストで、理解を確かめる</h2></div><span className="tag purple">4択・正答は1つ</span></div>
        {!session ? <div className="quiz-setup"><div className="setup-icon"><Target size={30}/></div><h3>今日の学びを、力にしよう。</h3><p>英語の選択肢から、教材の学習用解答例に最も整合するものを選びます。<br/>複数の小問を含む設問は、要点の理解を確認します。</p><div className="setup-fields"><label>出題する章<select value={scope} onChange={e => setScope(e.target.value)}><option value="all">全章混合（CH1〜CH5）</option>{material.map(c => <option key={c.id} value={c.id}>CH{c.id} {chapterNames[c.id-1]}</option>)}</select></label><label>出題数<select value={count} onChange={e => setCount(e.target.value)}>{['5','10','20','all'].map(n => <option key={n} value={n}>{n === 'all' ? '全問' : `${n}問`}</option>)}</select></label></div><label className="checkbox-row"><input type="checkbox" checked={weakOnly} onChange={e => setWeakOnly(e.target.checked)}/> 苦手問題だけを出題する</label><div className="pool-info">対象 {pool.length}問 · 今回は {count === 'all' ? pool.length : Math.min(Number(count), pool.length)}問を出題{count !== 'all' && pool.length < Number(count) ? '（対象の全問）' : ''}</div><button className="primary large" onClick={startQuiz} disabled={!pool.length}>小テストを始める <ArrowRight size={18}/></button>{!pool.length && <p role="status">対象の問題がありません。教材で「要復習」を設定してください。</p>}<small className="setup-notice">英語の解答・選択肢は教材に基づく学習用の翻訳です。出版社公式の問題・解答ではありません。</small></div> : session.finished ? <div className="results"><div className="setup-icon"><GraduationCap size={34}/></div><span className="eyebrow">SESSION COMPLETE</span><h3>おつかれさまでした。</h3><p>振り返りが、次の理解につながります。</p><div className="score"><strong>{session.items.filter((x,i) => x.correct === session.answers[i]).length}</strong><span> / {session.items.length} 問正解</span><b>{Math.round(session.items.filter((x,i) => x.correct === session.answers[i]).length / session.items.length * 100)}点</b></div><p>誤答した問題は「苦手を復習」に保存しました。</p><div className="result-actions"><button className="primary" onClick={startQuiz}><RotateCcw size={17}/> 再挑戦する</button><button className="secondary" onClick={() => setSession(null)}>出題設定に戻る</button><button className="text-button" onClick={() => openView('review')}>苦手を復習する <ArrowRight size={17}/></button></div><div className="result-list">{session.items.map((x,i) => <details key={x.question.id}><summary><span className={session.answers[i] === x.correct ? 'correct-text' : 'incorrect-text'}>{session.answers[i] === x.correct ? '正解' : '不正解'}</span> CH{x.chapter} · Q{x.question.number}　{x.question.translation}</summary><div className="result-detail"><p>あなたの回答：<span lang="en">{x.options[session.answers[i]!]}</span></p><p><b>学習用解答例（英訳）：</b><span lang="en">{englishQuiz[x.question.id].answer}</span></p><p>{x.question.explanation}</p><p className="caution">選択式の注意点：{x.question.caution}</p></div></details>)}</div></div> : (() => { const item = session.items[session.index]; const answer = session.answers[session.index]; const correct = answer === item.correct; return <div className="quiz-running"><div className="quiz-meta"><span>QUESTION {String(session.index + 1).padStart(2,'0')} <span className="muted">/ {session.items.length}</span></span><button className="text-button" onClick={() => setSession(null)}>設定に戻る <X size={16}/></button></div><div className="quiz-progress"><div style={{width:`${(session.index + (session.submitted ? 1 : 0)) / session.items.length * 100}%`}}/></div><span className="tag">CH{item.chapter} · Q{item.question.number}</span><h3 lang="en" className="quiz-original">{item.question.original}</h3><p className="quiz-translation">{item.question.translation}</p><p className="quiz-instruction">英語の選択肢から、教材の学習用解答例に最も整合するものを1つ選んでください。</p><div className="options" lang="en">{item.options.map((o,i) => <button key={i} aria-pressed={answer === i} disabled={session.submitted} className={`option ${answer === i ? 'picked' : ''} ${session.submitted && i === item.correct ? 'correct' : ''} ${session.submitted && answer === i && !correct ? 'incorrect' : ''}`} onClick={() => { const answers=[...session.answers]; answers[session.index]=i; setSession({...session,answers}) }}><span>{'ABCD'[i]}</span><span>{o}</span>{session.submitted && i === item.correct && <Check size={20}/>}</button>)}</div>{session.submitted && <div role="status" className={`feedback ${correct ? 'success' : 'failure'}`}><h4>{correct ? '正解です！' : 'もう一度、要点を確認しましょう。'}</h4><p><b>正答：{'ABCD'[item.correct]} · 学習用解答例（英訳）</b></p><p className="quiz-answer" lang="en">{englishQuiz[item.question.id].answer}</p><p>{item.question.explanation}</p><div className="caution"><CircleHelp size={16}/><span>{item.question.caution}</span></div></div>}<div className="quiz-actions">{session.submitted ? <button className="primary" onClick={next}>{session.index + 1 === session.items.length ? '結果を見る' : '次の問題へ'}<ArrowRight size={17}/></button> : <button className="primary" disabled={answer === null} onClick={grade}>回答を採点する <Check size={17}/></button>}</div></div> })()}
      </div> : <>
        <div className="workspace-heading"><div><span className="eyebrow">{view === 'review' ? 'FOCUS ON YOUR NEXT STEP' : normalized ? 'SEARCH ALL CHAPTERS' : `CHAPTER 0${chapter} · DISCUSSION & REVIEW`}</span><h2>{view === 'review' ? '苦手を、ひとつずつ。' : normalized ? '全章から検索' : chapterNames[chapter-1]}</h2><p>{view === 'review' ? '「要復習」と小テストの誤答をまとめています。覚えた問題は復習リストから外れます。' : normalized ? '英語原文・日本語訳・解答・解説・繁體中文を検索します。' : descriptions[chapter-1]}</p></div><button className="secondary quiz-shortcut" onClick={() => {setScope(view === 'review' ? 'all' : String(chapter));setWeakOnly(view === 'review');openView('quiz')}}><Target size={17}/>{view === 'review' ? '苦手を小テスト' : 'この章を小テスト'}<ArrowRight size={16}/></button></div>
        <div className="study-tools"><label className="search-box"><Search size={18}/><input aria-label="キーワード検索" placeholder="キーワードで探す（全章から検索）" value={search} onChange={e => setSearch(e.target.value)}/>{search && <button aria-label="検索をクリア" onClick={() => setSearch('')}><X size={16}/></button>}<kbd>検索</kbd></label><span className="question-count">{filtered.length} 問<span>{normalized ? 'の検索結果' : 'の問題'}</span></span></div>
        <div className="study-content"><aside className="study-sidebar"><div className="sidebar-heading"><BookOpen size={16}/>{view === 'review' ? '復習リスト' : normalized ? '検索結果' : 'この章の問題'}<span>{filtered.length}</span></div><div className="question-index">{filtered.map(({question:q,chapter:c}) => <a href={`#${q.id}`} key={q.id}><span className={`index-number ${progress[q.id]?.status === 'learned' ? 'done' : ''}`}>{progress[q.id]?.status === 'learned' ? <Check size={12}/> : String(q.number).padStart(2,'0')}</span><span>{(normalized || view === 'review') && <small>CH{c} · </small>}{q.translation}</span>{isWeak(q.id) && <span className="weak-dot"/>}</a>)}</div><div className="sidebar-tip"><Sparkles size={17}/><p>まずは自分の言葉で。<br/><span>答えを見る前に、口頭で説明してみましょう。</span></p></div></aside><div className="question-cards">{filtered.length === 0 ? <div className="empty-state"><Search size={30}/><h3>{normalized ? '一致する問題がありません' : '復習する問題はまだありません'}</h3><p>{normalized ? '別のキーワードで検索してみてください。' : '教材の「要復習」ボタン、または小テストの誤答がここに表示されます。'}</p><button className="secondary" onClick={() => {setSearch(''); if(view === 'review') openView('study')}}>{normalized ? '検索をクリア' : '教材を読む'}</button></div> : filtered.map(({question:q,chapter:c}) => <QuestionCard key={q.id} question={q} chapter={c} entry={progress[q.id]} mark={mark}/>)}</div></div>
      </>}
      </section>
      <div className="learning-note"><div className="note-icon"><CircleHelp size={20}/></div><div><strong>この教材について</strong><p>教科書クイズは添付PDFに基づいて作成した学習用問題です。以前のDiscussion教材では英語原文と学習用解答例を区別して掲載しています。日本語訳・解答・解説・繁體中文記述例は学習用資料であり、出版社の公式解答ではありません。小テストは教材の要点を確認するために作成したものです。</p></div><a href={`${import.meta.env.BASE_URL}materials/codex_operations_ch1-5_full.md`} download>教材原本 <ArrowUpRight size={15}/></a></div>
    </main><footer><a className="footer-brand" href="#" onClick={e=>{e.preventDefault();window.scrollTo({top:0,behavior:'smooth'})}}>OM Notes <span>学びを、少しずつ。</span></a><span>Operations Management · Chapters 1–5</span><span><span className="online-dot"/> 外部API不要 · 進捗は端末内に保存</span></footer>
  </>
}
function QuestionCard({question:q,chapter,entry,mark}:{question:Question;chapter:number;entry?:RecordEntry;mark:(id:string,s:Status)=>void}) {
  const [open,setOpen]=useState(false)
  return <article className={`question-card ${entry?.status === 'learned' ? 'is-learned' : ''}`} id={q.id}><div className="card-top"><div className="question-label"><span>Q{String(q.number).padStart(2,'0')}</span><small>CHAPTER 0{chapter}</small></div>{entry?.status === 'learned' ? <span className="tag green-tag"><CheckCheck size={13}/>覚えた</span> : (entry?.status === 'review' || entry?.incorrect) ? <span className="tag amber-tag"><Bookmark size={13}/>要復習</span> : <span className="unread">未学習</span>}</div><div className="original-label">ORIGINAL QUESTION <span>英語原文</span></div><h3 lang="en" className="original-question">{q.original}</h3><div className="translation"><span>日本語訳</span><p>{q.translation}</p></div><div className="card-actions"><button className={`reveal ${open ? 'expanded' : ''}`} aria-expanded={open} aria-controls={`${q.id}-answer`} onClick={()=>setOpen(!open)}><BookOpen size={16}/>{open ? '解答・解説を閉じる' : '解答・解説をひらく'}<ChevronDown size={16}/></button><div className="status-actions"><button className={entry?.status === 'learned' ? 'active learned-button' : ''} aria-pressed={entry?.status === 'learned'} onClick={()=>mark(q.id,'learned')}><Check size={15}/>覚えた</button><button className={entry?.status === 'review' ? 'active review-button' : ''} aria-pressed={entry?.status === 'review'} onClick={()=>mark(q.id,'review')}><Bookmark size={14}/>要復習</button></div></div>{open && <div className="answer-panel" id={`${q.id}-answer`}><section><h4><span className="answer-number">01</span>模範解答 <span className="tag green-tag">学習用解答例</span></h4><p>{q.answer}</p></section><section><h4><span className="answer-number">02</span>詳しい解説・具体例</h4><p>{q.explanation}</p></section><section className="caution-block"><h4><CircleHelp size={16}/>選択式の注意点</h4><p>{q.caution}</p></section><section lang="zh-Hant"><h4><span className="answer-number">04</span>繁體中文・記述例</h4><p>{q.traditionalChinese}</p></section><small className="answer-disclaimer">学習用に作成された解答例です。出版社公式の解答ではありません。</small></div>}</article>
}

createRoot(document.getElementById('root')!).render(<React.StrictMode><App/></React.StrictMode>)
