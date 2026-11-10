import re, csv, json
from domain.text import normalize_vi
from domain.ticker_linking import related_symbols as v2

U = [(r['symbol'], r['name']) for r in csv.DictReader(open('/mnt/user-data/uploads/FinSight/backend/scripts/seed_data/symbols.csv', encoding='utf-8'))]
U += [("VNM","Vinamilk"),("MSN","Masan Group"),("VIC","Vingroup"),("TCB","Techcombank"),("VPB","VPBank"),("STB","Sacombank"),("PLX","Petrolimex"),("VJC","Vietjet Air"),("PNJ","Phu Nhuan Jewelry"),("NVL","Novaland Group")]
U += [("CEO", "Công ty Cổ phần Tập đoàn C.E.O"), ("TRA", "Công ty Cổ phần Traphaco"),
      ("ZZA", "Công ty Cổ phần Đầu tư Tương Lai"), ("ZZB", "Công ty Cổ phần Lãi Suất Việt"),
      ("ZZC", "Công ty Cổ phần Thị Trường Mới")]  # ZZ*: synthetic stress names

def v0(text, syms):  # naive: case-insensitive ticker + last-two-words alias
    out=[]; n=normalize_vi(text)
    for c,name in syms:
        if re.search(rf"\b{c.lower()}\b", n): out.append(c); continue
        a=" ".join(normalize_vi(name).split()[-2:])
        if len(a)>=6 and a in n: out.append(c)
    return list(dict.fromkeys(out))

GEN={"AI","CEO","CFO","CTO","GDP","IPO","USD","EUR","ETF","FED","FTSE","PMP","PMW"}
SUF={"bat dong san","dau tu","duoc pham","ngan hang","tai chinh","thuong mai","xay dung","viet nam"}
def v1(text, syms):  # repository version before this fix
    found=[]; nt=normalize_vi(text)
    for c,name in syms:
        if c.upper() in GEN: continue
        if re.search(rf"(?<![A-Za-z0-9]){re.escape(c.upper())}(?![A-Za-z0-9])", text): found.append(c); continue
        if not name: continue
        nn=normalize_vi(name)
        if len(nn)>=6 and nn in nt: found.append(c); continue
        al=" ".join(nn.split()[-2:])
        if len(al)>=6 and al not in SUF and re.search(rf"(?<![a-z0-9]){re.escape(al)}(?![a-z0-9])", nt): found.append(c)
    return list(dict.fromkeys(found))


import random
D = json.load(open('dataset.json', encoding='utf-8'))
def kind(i): return {'R':'real','S':'slug','A':'audit' if int(i[1:])<=6 else 'constructed'}[i[0]]
def prf(rows):
    tp=sum(r[0] for r in rows); fp=sum(r[1] for r in rows); fn=sum(r[2] for r in rows)
    P=tp/(tp+fp) if tp+fp else 1.0; R=tp/(tp+fn) if tp+fn else 1.0; F=2*P*R/(P+R) if P+R else 0.0
    return tp,fp,fn,P,R,F
per={}; out={}
for name,f in [("v0",v0),("v1",v1),("v2",v2)]:
    rows=[]; errs=[]
    for d in D:
        p=set(f(d['text'],U)); g=set(d['gold'])
        rows.append((len(p&g),len(p-g),len(g-p),p==g,kind(d['id'])))
        if p!=g: errs.append((d['id'],sorted(p),sorted(g)))
    per[name]=rows
    tp,fp,fn,P,R,F=prf(rows)
    random.seed(42); bs=[]
    for _ in range(10000):
        smp=[random.choice(rows) for _ in rows]; bs.append(prf(smp)[3:])
    ci=lambda k: tuple(round(sorted(b[k] for b in bs)[int(q*10000)],3) for q in (0.025,0.975))
    out[name]=dict(TP=tp,FP=fp,FN=fn,P=round(P,3),P_CI=ci(0),R=round(R,3),R_CI=ci(1),F1=round(F,3),F1_CI=ci(2),exact=sum(r[3] for r in rows),
        noGoldFP=sum(1 for r,d in zip(rows,D) if not d['gold'] and r[1]>0))
    for k in ('real','slug','audit','constructed'):
        sub=[r for r in rows if r[4]==k]; t=prf(sub); out[name][k]=(len(sub),t[0],t[1],t[2],round(t[3],3),round(t[4],3),round(t[5],3),sum(r[3] for r in sub))
    print(name,out[name]); print('  errors',errs)
from math import comb
def mcnemar(a,b):
    b_=sum(1 for x,y in zip(per[a],per[b]) if x[3] and not y[3]); c=sum(1 for x,y in zip(per[a],per[b]) if not x[3] and y[3])
    n=b_+c; k=min(b_,c); p=min(1,2*sum(comb(n,i) for i in range(k+1))/2**n) if n else 1
    return b_,c,round(p,4)
print('N',len(D),'gold',sum(len(d['gold']) for d in D),'nogold',sum(1 for d in D if not d['gold']))
print('mcnemar v0-v2',mcnemar('v0','v2'),'v1-v2',mcnemar('v1','v2'),'v0-v1',mcnemar('v0','v1'))
