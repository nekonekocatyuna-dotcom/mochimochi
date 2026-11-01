"""Validate the authored quiz and, when available, its original PDF references."""
import argparse,hashlib,json,math,pathlib,re,subprocess
root=pathlib.Path(__file__).resolve().parents[1]
parser=argparse.ArgumentParser();parser.add_argument('--pdf-dir',type=pathlib.Path)
args=parser.parse_args()
bank=json.loads((root/'src/data/pdf-quiz.json').read_text())
sources=json.loads((root/'src/data/pdf-sources.json').read_text())
assert len(bank)==150
assert len({q['id'] for q in bank})==150
assert len({q['question'] for q in bank})==150
for chapter in range(1,6):
    qs=[q for q in bank if q['chapter']==chapter]
    assert [q['number'] for q in qs]==list(range(1,31))
for q in bank:
    choices=[q['answer'],*q['distractors']]
    assert len(choices)==len(set(choices))==4,q['id']
    assert all(isinstance(x,str) and x.strip() and x.isascii() for x in [q['question'],*choices]),q['id']
    assert re.search(r'[\u3040-\u9fff]',q['explanation']),q['id']
    source=next(s for s in sources if s['chapter']==q['chapter'])
    assert 1<=q['sourcePage']<=source['pages'],q['id']
# Independently recompute numerical answers; item wording states every needed assumption.
checks={
 'pdf-ch2-q17':(480/120,'4 units per labor-hour'),
 'pdf-ch2-q20':(12000/(3000+1000),'3.0'),
 'pdf-ch2-q21':((88-80)/80*100,'10%'),
 'pdf-ch3-q12':((40+50+60)/3,'50'),
 'pdf-ch3-q14':(40*.25+60*.75,'55'),
 'pdf-ch3-q16':(100+.25*(120-100),'105'),
 'pdf-ch3-q18':(20+3*4,'32'),
 'pdf-ch3-q20':(200*.8,'160'),
 'pdf-ch3-q21':(240/1.2,'200'),
 'pdf-ch3-q24':(90-100,'-10'),
 'pdf-ch3-q25':((2+4+6)/3,'4'),
 'pdf-ch3-q26':((2**2+(-4)**2)/(2-1),'20'),
 'pdf-ch3-q29':(20/5,'4'),
 'pdf-ch4-q26':(.9*.8,'0.72'),
 'pdf-ch4-q27':(1-(1-.9)*(1-.8),'0.98'),
 'pdf-ch4-q28':(round(math.exp(-100/100),3),'About 0.368'),
 'pdf-ch4-q29':(90/(90+10),'0.90'),
 'pdf-ch5-q4':(72/120*100,'60%'),
 'pdf-ch5-q5':(72/90*100,'80%'),
 'pdf-ch5-q9':(math.ceil(4500/2000),'3'),
 'pdf-ch5-q13':(min(40,25,35),'25 units per hour'),
 'pdf-ch5-q19':(1000/(20-10),'100 units'),
 'pdf-ch5-q20':(150*20-150*10-1000,'$500'),
 'pdf-ch5-q29':(100*.6+20*.4,'$68'),
}
for qid,(calculated,expected) in checks.items():
    q=next(q for q in bank if q['id']==qid)
    assert q['answer']==expected,(qid,q['answer'],expected)
    numeric=float(re.search(r'-?\d+(?:\.\d+)?',expected.replace(',','')).group())
    assert math.isclose(calculated,numeric,rel_tol=1e-9,abs_tol=1e-9),(qid,calculated,numeric)
if args.pdf_dir:
    for source in sources:
        matches=list(args.pdf_dir.rglob(source['fileName']))
        assert len(matches)==1,source['fileName']
        p=matches[0]
        assert hashlib.sha256(p.read_bytes()).hexdigest()==source['sha256'],p
        text=subprocess.check_output(['pdftotext','-layout',str(p),'-']).decode()
        pages=text.split('\f')
        assert len(pages)-1==source['pages']
        for q in bank:
            if q['chapter']==source['chapter']:
                assert q['sourceAnchor'].lower() in ' '.join(pages[q['sourcePage']-1].lower().split()),q['id']
    print('All 5 PDF hashes, 247 pages, and all 150 page references verified.')
print('150 unique questions, 30/chapter, English 4-option items, Japanese explanations, 24 calculation checks passed.')
