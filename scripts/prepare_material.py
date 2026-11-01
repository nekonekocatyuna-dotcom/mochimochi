"""Parse the preserved source; never paraphrase any of its six fields."""
import pathlib,re,json,sys,hashlib
root=pathlib.Path(__file__).resolve().parents[1]
source=root/'public/materials/codex_operations_ch1-5_full.md'
s=source.read_text(encoding='utf-8')
parts=re.split(r'^# 第(\d)章｜(.+)$',s,flags=re.M)
labels=['Original Question（教科書原文）','日本語訳（問題）','模範解答（日本語）','詳しい解説・具体例','選択式の注意点','繁體中文・記述例']
keys=['original','translation','answer','explanation','caution','traditionalChinese']
chapters=[]
for i in range(1,len(parts),3):
    chapter={'id':int(parts[i]),'title':parts[i+1],'questions':[]}
    blocks=re.split(r'^## Q(\d+)\s*$',parts[i+2],flags=re.M)
    for j in range(1,len(blocks),2):
        fields=re.split(r'^\*\*(.+?)\*\*\s*$',blocks[j+1],flags=re.M)
        values={fields[k]:re.sub(r'\n---\s*$','',fields[k+1]).strip() for k in range(1,len(fields),2)}
        assert set(values)==set(labels),(i,j,values.keys())
        assert all(values.values())
        q={'id':f'ch{chapter["id"]}-q{blocks[j]}','number':int(blocks[j])}
        q.update({k:values[l] for k,l in zip(keys,labels)})
        chapter['questions'].append(q)
    assert [q['number'] for q in chapter['questions']]==list(range(1,len(chapter['questions'])+1))
    chapters.append(chapter)
assert [len(c['questions']) for c in chapters]==[17,15,19,19,17]
target=root/'src/data/material.json'
if '--check' in sys.argv:
    assert json.loads(target.read_text())==chapters,'Generated material differs from source'
    distractors=json.loads((root/'src/data/distractors.json').read_text())
    english=json.loads((root/'src/data/quiz-en.json').read_text())
    assert set(english)=={q['id'] for c in chapters for q in c['questions']}
    for qid, item in english.items():
        choices=[item['answer'],*item['distractors']]
        assert len(choices)==len(set(choices))==4,qid
        assert all(isinstance(x,str) and x.strip() and x.isascii() for x in choices),qid
    assert set(distractors)=={q['id'] for c in chapters for q in c['questions']}
    for c in chapters:
        for q in c['questions']:
            choices=[q['answer'],*distractors[q['id']]]
            assert len(choices)==len(set(choices))==4,q['id']
else:
    target.write_text(json.dumps(chapters,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print('Material verified: CH1=17 CH2=15 CH3=19 CH4=19 CH5=17; 87 questions × 6 nonempty fields.')
print('Source SHA-256:',hashlib.sha256(source.read_bytes()).hexdigest())
