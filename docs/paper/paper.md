---
title: "Computational Thinking in Financial News Analytics: Designing, Debugging and Evaluating a News-to-Ticker Linking Algorithm for the FinSight Platform"
---

**Nguyen Quang Huy**

*Faculty of Information Systems, University of Economics and Law*

*Vietnam National University, Ho Chi Minh City, Vietnam*

*November 2026*

# ABSTRACT

**Purpose.** This study applies the components of computational thinking (decomposition, pattern recognition, abstraction, algorithm design, and evaluation) to one component of FinSight, a web platform that shows Vietnamese financial news next to the observed price reaction of the stocks the news concerns. The component decides which listed tickers an article is about. In production it linked a headline about Nvidia to three unrelated Vietnamese tickers (CEO, LAI and TRA).

**Design/Methodology/Approach.** The study follows the Design Science Research Methodology (Peffers et al., 2007). Three versions of the linking algorithm were compared on a hand-labelled set of 76 items: 60 real headlines from Vietnamese news sites (48 with diacritics, 12 as accent-stripped URL slugs) and 16 audit or constructed cases, against a universe of 30 symbols. Performance was measured at link level with precision, recall and F1, with 95% bootstrap confidence intervals (10,000 resamples), and compared at item level with exact McNemar tests.

**Findings.** The redesigned algorithm (v2) produced one false link out of 43 predicted links, against 10 of 52 for a naive baseline (v0) and 4 of 43 for the version deployed before the fix (v1). Precision was 0.977 (95% CI 0.921–1.000) for v2, 0.907 (0.810–0.979) for v1 and 0.808 (0.672–0.932) for v0. Recall was 0.808 for v2 and v0 and 0.750 for v1. On the 48 real headlines with diacritics, v2 produced no false link. The item-level difference between v1 and v2 (7 items fixed, 1 broken) did not reach conventional significance (exact McNemar p = 0.070). Most remaining misses involve company names of five characters or fewer, which v2 refuses to treat as evidence.

**Originality/Value.** The study uses a real production failure, not a classroom exercise, as the object of computational thinking. It contributes a labelled evaluation set, an evaluation script with fixed random seed, seven regression tests and an idempotent command for repairing stored links. It also documents the trade-off between false links and missed links in a financial setting, where a false link presents wrong information as fact.

**Keywords:** *computational thinking; design science research; entity linking; financial news; event study; Vietnamese stock market*

# 1. Introduction

Individual investors in Vietnam read market news mainly through online newspapers and through trading platforms that place a news feed beside the price board. Fireant, Vietstock and the platforms of the large brokerages follow this model. The model has a weak point that is easy to miss. When a platform attaches a ticker to an article, the reader assumes that the article concerns that company. Barber and Odean (2008) show that individual investors are net buyers of stocks that are in the news, because attention limits the set of stocks they consider. Engelberg and Parsons (2011) and Fang and Peress (2009) give further evidence that media coverage itself changes trading and returns. A ticker shown next to the wrong article can therefore move attention toward a company that the article never mentioned.

FinSight is a student project built around this problem. Its stated goal is narrow: the reader sees a financial news item and, beside it, the price movement of the related stocks in the following sessions. The movement is measured as abnormal return relative to the VN-Index over one session (T+1) and five sessions (T+5), following the event-study method (MacKinlay, 1997). The platform describes these figures as observed movements and does not claim that the news caused them. It gives no buy or sell recommendations. The design depends on one earlier step that the reader never sees: deciding which tickers an article concerns. If this step fails, the event study is computed for the wrong company, and the price chart, the reaction figures and the sector table all present the error as data.

The failure that motivated this study appeared on the FinSight news page. The headline *"Vụ bê bối của CEO Jensen Huang đặt tương lai Nvidia vào thế khó"* (a scandal involving chief executive Jensen Huang puts Nvidia's future in a difficult position) was linked to the tickers CEO, LAI and TRA, and through them to the real estate, construction and pharmaceutical sectors. The article concerns a United States chip maker. None of the three Vietnamese companies appears in it. Inspection of the code showed three separate causes. The job title "CEO" matched the ticker of C.E.O Group. The word *"tương lai"* (future) matched a fragment of a company name. A fragment of another word matched TRA. No automated test caught any of this; the error was found by reading the news page.

A failure like this is good material for a course on computational thinking. Wing (2006, 2008) describes computational thinking as a way of solving problems that draws on concepts from computer science, with abstraction and automation at its centre. Reviews of the field by Grover and Pea (2013) and Shute et al. (2017) find broad agreement on a core set of practices: decomposing a problem, recognising patterns, abstracting away irrelevant detail, designing an algorithm, and testing and debugging the result. Most published examples of these practices come from school classrooms and short programming tasks. A production defect in a data pipeline needs all of the practices at once, and its outcome can be measured.

The study addresses three research questions:

> RQ1: How can the components of computational thinking structure the diagnosis and redesign of a news-to-ticker linking algorithm for Vietnamese financial news?
>
> RQ2: Which recurring patterns explain the false links produced by earlier versions of the algorithm?
>
> RQ3: How does the redesigned algorithm perform against a naive baseline and against the previously deployed version, in terms of false links, missed links and exact item-level agreement with human labels?

The main contribution is a worked account of computational thinking applied to a real software defect, in which each practice can be traced to a line of code and a number in the results. The evaluation reports confidence intervals and paired tests rather than point estimates alone, and everything needed to repeat it (the labelled data, the script, the regression tests and the repair command) is stored with the project.

Section 2 reviews the literature on computational thinking, event studies, financial text analysis and entity linking. Section 3 describes the research design, the FinSight pipeline, the algorithm versions and the evaluation procedure. Section 4 reports the results. Section 5 discusses them against the research questions, and Section 6 concludes with implications and limitations.

# 2. Theoretical Framework

## 2.1. Computational Thinking

Wing (2006) introduced computational thinking as a skill for everyone, comparable to reading and arithmetic, and later described its essence as abstraction: deciding which details of a problem to keep and building layers of models that a machine can execute (Wing, 2008). Brennan and Resnick (2012) proposed a framework with three dimensions. Computational concepts are the ideas programmers use, such as sequences, conditionals and data. Computational practices are the ways they work, including incremental development, testing and debugging, reuse, and abstraction and modularisation. Computational perspectives are the views people form about themselves and the world through computing. Grover and Pea (2013) reviewed definitions used in K–12 research and listed abstraction and pattern generalisation, systematic processing of information, algorithmic notions of flow of control, structured problem decomposition, and debugging and systematic error detection among the accepted elements. Shute et al. (2017) reviewed the literature and proposed six facets: decomposition, abstraction, algorithm design, debugging, iteration and generalisation.

Denning (2017) criticised definitions that treat computational thinking as a general problem-solving attitude detached from computation. He argued that the term should refer to designing computations that do useful work and that can be checked. This study adopts that position and uses the facets of Shute et al. (2017) as an analytical frame. Each facet is linked to a decision in the FinSight pipeline that can be inspected in code and measured in the evaluation.

## 2.2. Event Studies and the Assignment of Events to Firms

An event study measures the effect of an event on the value of a firm by comparing the observed return around the event with a normal return expected without it (Fama et al., 1969; MacKinlay, 1997). Brown and Warner (1985) showed with simulations on daily data that simple market-adjusted and market-model approaches detect abnormal performance well. FinSight uses a market-adjusted model: the abnormal return of a stock on a day is its return minus the return of the VN-Index on that day. The event day is the first trading close after the article's publication time, and articles whose windows overlap with another article about the same stock are flagged.

Two conditions must hold before any of this is meaningful. The event must be dated correctly, and it must be assigned to the correct firm. The literature discusses the first condition at length. The second is usually assumed, because large-sample studies draw on commercial news databases that already index articles by firm. A platform that collects public RSS feeds has no such identifiers and must infer the firm from the text. An error at this stage cannot be detected by the event-study calculation, which will return a well-formed abnormal return for whichever ticker it receives.

## 2.3. Text Analysis of Financial News

Tetlock (2007) showed that pessimistic tone in a Wall Street Journal column predicts downward pressure on market prices followed by reversion. Loughran and McDonald (2011) found that almost three quarters of the words classified as negative by the Harvard General Inquirer dictionary are not negative in a financial context, and built word lists for financial documents. The surveys by Kearney and Liu (2014) and Xing et al. (2018) cover dictionary methods, machine learning and natural-language-based forecasting. Both surveys treat the link between a document and a firm as an input to the analysis rather than as a problem to solve.

Vietnamese text adds two difficulties. Vietnamese is written in a Latin script with diacritics, and the same syllable without diacritics can correspond to several different words. RSS feeds, URL slugs and search queries often drop the diacritics. Vietnamese words are also mostly one or two syllables long, so short strings collide with ordinary words more often than in English. Pre-trained language models such as PhoBERT (Nguyen & Nguyen, 2020) handle Vietnamese text much better than earlier tools, but they require labelled training data that a student project rarely has.

## 2.4. Named Entity Recognition and Entity Linking

Finding which company an article mentions combines named entity recognition, which locates mentions of entities in text, with entity linking, which maps each mention to an entry in a knowledge base (Nadeau & Sekine, 2007; Shen et al., 2015). Shen et al. (2015) divide entity linking into three modules: candidate entity generation, candidate ranking, and prediction of unlinkable mentions. The third module matters here. A large share of financial news mentions no listed Vietnamese company at all, and the correct output for such an article is an empty set.

Rule-based linkers match surface strings, such as tickers and company names, against a dictionary of known entities. They need no training data and every decision can be explained, but they fail when a surface string is ambiguous. Precision and recall measure the two kinds of error (Manning et al., 2008). Precision is the share of predicted links that are correct. Recall is the share of correct links that the system finds. In a financial information product the two errors have different costs. A missed link means that a relevant article does not appear on a stock's page. A false link places an unrelated article on that page and attaches a measured price reaction to it. Given the evidence on attention and trading reviewed in Section 1, the second error is more harmful. This asymmetry underlies the design principle adopted in this study, stated in the project's audit brief as "not sure, no link".

# 3. Methodology

## 3.1. Research Design

The study follows the Design Science Research Methodology (DSRM) of Peffers et al. (2007), within the design-science paradigm described by Hevner et al. (2004). DSRM has six activities. Problem identification used the production failure described in Section 1 and the project's internal audit brief. The objective was defined as an algorithm that never links a ticker without textual evidence, measured mainly by precision and secondarily by recall. Design and development produced the redesigned algorithm (v2), its regression tests and a repair command. Demonstration ran the algorithm on the evaluation set. Evaluation compared v2 with two earlier versions using the statistics described in Section 3.6. This paper is the communication activity.

Hevner et al. (2004) require that a design artefact be evaluated rigorously and that the evaluation method suit the artefact. For a classification component with a known correct answer for each input, a labelled test set with standard retrieval metrics is the conventional choice (Manning et al., 2008). Because the test set is small, the study adds bootstrap confidence intervals and paired tests rather than reporting point estimates alone.

## 3.2. The FinSight Pipeline and Its Decomposition

FinSight has a Python backend (FastAPI, SQLAlchemy and PostgreSQL), a scheduled worker that runs the ingestion jobs, and a Next.js frontend. Following the decomposition practice, the news pipeline is divided into five stages. Each stage has a defined input and output and can be tested separately. Table 1 lists the stages.

*Table 1. Decomposition of the FinSight news pipeline*

| Stage | Input | Output | Technique |
|---|---|---|---|
| 1. Ingest | RSS feeds (VnExpress, VnEconomy) | Article records with canonical URL, publish time and story hash | Feed parsing; URL canonicalisation; duplicate detection by hash |
| 2. Classify | Title and summary | Category and sentiment score | Keyword rules; lexicon-based sentiment |
| 3. Link | Title, summary and the list of active symbols | Set of related tickers | Rule-based entity linking (studied here) |
| 4. Measure | Linked ticker, publish time, daily prices | Abnormal return at T+1 and T+5 with a status code | Market-adjusted event study against VN-Index |
| 5. Present | Outputs of stages 1–4 | News list, stock page, sector table | Next.js frontend with data-mode labels |

The decomposition shows how errors travel through the pipeline. Stage 2 errors affect one field of one article. Stage 3 errors create a record in the `news_symbols` table, which Stage 4 then uses to compute and store an event study, which Stage 5 displays on the stock page. A single false link therefore produces wrong data in three tables and two pages. This is the reason Stage 3 was chosen as the subject of the study.

Figures 1 to 3 show the deployed platform (finsight-free.onrender.com) on 10 November 2026. The landing page (Figure 1) states the product idea in one line and illustrates it with a VN-Index chart on which news items are pinned and the next-session reaction is drawn in colour. The chart is labelled *Ví dụ minh hoạ* (illustrative example) because it uses hand-picked events. The market overview (Figure 2) combines index cards, a heat map of the 200 most traded symbols grouped by sector, market breadth, and a table titled *Tin & phản ứng giá* (news and price reaction) in which each article carries its linked tickers. The stock page (Figure 3) shows the HPG candlestick chart, the quote time and source, and a profile panel that prints *Chưa có dữ liệu* (no data yet) where a field is missing instead of a placeholder value. Every ticker chip on these pages is an output of Stage 3.

![Figure 1. Landing page of the deployed FinSight platform, 10 November 2026.](fig1_home.png){width=6.2in}

![Figure 2. Market overview page with the sector heat map and the news-and-reaction table.](fig2_dashboard.png){width=6.2in}

![Figure 3. Stock page for HPG with the candlestick chart, data source note and profile fields.](fig3_stock.png){width=6.2in}



## 3.3. Pattern Recognition: Causes of False Links

The production example, the audit brief and the existing tests were examined to find recurring causes. Five patterns were identified, four in the algorithm and one in the data workflow.

The first pattern is upper-case words that are not tickers. Job titles and economic abbreviations such as CEO, AI, GDP, USD, ETF and CPI appear in upper case, and some of them, CEO among them, are also valid tickers on Vietnamese exchanges. Case-sensitive matching alone cannot separate them.

The second pattern is case-insensitive matching. If the text is lower-cased and stripped of diacritics before matching, ordinary syllables collide with tickers. The verb *"trả"* (to pay) becomes *"tra"*, which matches TRA.

The third pattern is name fragments that are ordinary phrases. The deployed version used the last two words of a company's name as an alias. A name that ends in *"Tương Lai"* produces the alias *"tuong lai"* (future). A name that ends in *"Thị Trường Mới"* produces *"truong moi"*, which also occurs inside the common phrase *"tăng trưởng mới"* (new growth).

The fourth pattern is generic sector words. Legal names often contain words such as *"xây dựng"* (construction), *"dược phẩm"* (pharmaceuticals) or *"bất động sản"* (real estate). Matching on these words links any article about a sector to an arbitrary firm in it.

The fifth pattern concerns stored data. The ingestion job removed a stale link only when the same article appeared again in the RSS feed. Articles that had left the feed kept the links assigned by older versions of the algorithm, together with the event studies computed from them.

## 3.4. Abstraction and Algorithm Design

The central abstraction in v2 is the *core name* of a company: the part of its name that identifies it among listed companies. The core name is computed in three steps. The name is converted to lower case and stripped of diacritics, using the project's existing normalisation function. Punctuation is removed, so that "C.E.O" becomes "ceo". Legal-form words (*công ty cổ phần*, *tổng công ty*, *tập đoàn*, *TMCP*, *JSC*, *Group*, *Corporation*) and generic sector words (*đầu tư*, *xây dựng*, *thương mại*, *bất động sản*, *ngân hàng*, *Việt Nam* and others) are then deleted as whole words. For example, *"Công ty Cổ phần Tập đoàn Hòa Phát"* reduces to *"hoa phat"*, and *"Ngân hàng TMCP Ngoại thương Việt Nam"* reduces to *"ngoai thuong"*.

The decision rule of v2 accepts two kinds of evidence and returns an empty set when neither is present:

```
for each (ticker, name) in active symbols:
    if ticker is in GENERIC_TOKENS (CEO, AI, GDP, USD, CPI, ...):
        skip
    if the original text contains the ticker in upper case,
       bounded by non-alphanumeric characters:
        link and continue
    core = core_name(name)
    if length(core) >= 6
       and core is not in COMMON_PHRASES
       and the normalised text contains core as whole words:
        link
return the linked tickers in order of first match
```

Two lists hold the domain knowledge explicitly. `GENERIC_TOKENS` contains upper-case abbreviations that appear in news but should never be read as tickers. `COMMON_PHRASES` contains core names that are ordinary Vietnamese phrases, such as *"tuong lai"*, *"phat trien"* and *"thanh cong"*. The minimum length of six characters for a core name was set before the evaluation, following the threshold already used in the deployed code. Section 4.4 examines the effect of other values.

Two smaller changes support the algorithm. The function was moved from the ingestion job into a separate module, `domain/ticker_linking.py`, which has no database dependency and can be tested in isolation. The ingestion job now calls this module. A repair command, `scripts/relink_news.py`, applies the current rule to every stored article. It runs in dry-run mode by default and prints each link it would add or remove, with the number of event studies that would be deleted. It writes to the database only when called with `--apply`. Running it a second time after `--apply` reports no changes, so it can be run safely after every future change to the rule.

## 3.5. Algorithm Versions Compared

Three versions were evaluated on the same data. Version v0 is a naive baseline that reproduces the conditions behind the production failure: it matches tickers without regard to case after removing diacritics, and it uses the last two words of each name as an alias with no filtering. Version v1 is the code deployed before this study. It matches tickers case-sensitively, skips 13 generic tokens, ignores eight generic suffixes, and keeps the last-two-words alias. Version v2 is the algorithm described in Section 3.4. The code for v0 and v1 is included in the evaluation script so that the comparison can be repeated.

## 3.6. Evaluation Data, Labelling and Statistics

The evaluation set has 76 items in four subsets (Table 2). Real headlines were collected in November 2026 through web searches on Vietnamese business news sites. Twelve real headlines were available only as URL slugs, in which diacritics and upper case have been removed. They were kept because text without diacritics occurs in real feeds. The six audit items are the test cases required by the project's audit brief, including the original Nvidia headline. The ten constructed items test specific patterns from Section 3.3, such as job titles next to a ticker, lower-case tickers and articles that name two companies.

*Table 2. Composition of the evaluation set*

| Subset | Items | Items with no gold link | Gold links | Main sources |
|---|---|---|---|---|
| Real headlines | 48 | 23 | 31 | mekongasean.vn, nhadautu.vn, theinvestor.vn, vnbusiness.vn, baomoi.com, cafef.vn |
| Real URL slugs | 12 | 5 | 9 | vneconomy.vn, baodautu.vn, doanhnhan.baophapluat.vn |
| Audit cases | 6 | 5 | 1 | Project audit brief |
| Constructed cases | 10 | 2 | 11 | Written for this study |
| Total | 76 | 35 | 52 | |

*Note.* Counts of items with no gold link are computed from the data set and include headlines about companies outside the symbol universe.

The symbol universe has 30 entries (Table 3). Fifteen are the symbols of FinSight's demonstration data. Ten widely traded tickers were added so that the real headlines mention companies inside the universe. CEO and TRA were added because they appeared in the production failure. Three synthetic entries (ZZA, ZZB and ZZC) have names ending in common phrases. They act as stress tests for the third pattern and are reported as synthetic throughout.

*Table 3. Symbol universe used in the evaluation*

| Group | Tickers | Count |
|---|---|---|
| FinSight demo data | VCB, ACB, MBB, BID, FPT, CMG, SSI, VRE, DXG, PVD, POW, GAS, HPG, SAB, KDC | 15 |
| Added real tickers | VNM, MSN, VIC, TCB, VPB, STB, PLX, VJC, PNJ, NVL | 10 |
| Tickers from the production failure | CEO, TRA | 2 |
| Synthetic stress entries | ZZA (Tương Lai), ZZB (Lãi Suất Việt), ZZC (Thị Trường Mới) | 3 |

Each item was labelled with the set of tickers it concerns, under one written guideline: a ticker is correct only if the text names the company, its common brand name or its ticker. Sector words, parent-company inference and general market references do not count. Under this guideline, *"Masan Consumer muốn lên HoSE"* has no gold link, because Masan Consumer is a subsidiary that is not in the universe, while *"Nhóm Vingroup bị chốt lời"* is linked to VIC, because the company is named. Labels were assigned by a single annotator, which is discussed as a limitation in Section 6.3.

Performance was computed at link level. A predicted link that appears in the gold set is a true positive (TP), a predicted link that does not is a false positive (FP), and a gold link that is not predicted is a false negative (FN). Precision is TP/(TP+FP), recall is TP/(TP+FN) and F1 is their harmonic mean (Manning et al., 2008). An item is counted as exact when the predicted set equals the gold set. Confidence intervals of 95% were computed with the percentile bootstrap (Efron & Tibshirani, 1993), resampling the 76 items with replacement 10,000 times with random seed 42. Versions were compared on item-level exactness with the exact (binomial) McNemar test (McNemar, 1947), which Dietterich (1998) recommends for comparing two classifiers on one test set. All computations are in `eval_linking.py`, and the data are in `linking_eval_dataset.json`.

# 4. Results

## 4.1. Overall Performance

Table 4 reports the main results. The redesigned algorithm produced one false link, compared with ten for the naive baseline and four for the deployed version. Its precision was 0.977. The lower bound of its 95% confidence interval (0.921) is above the point estimate of v1 (0.907). Recall did not change between v0 and v2 (0.808 in both) and was lowest for v1 (0.750). F1 was 0.884 for v2, 0.821 for v1 and 0.808 for v0, with overlapping intervals.

*Table 4. Link-level performance on the full evaluation set (76 items, 52 gold links)*

| Version | TP | FP | FN | Precision [95% CI] | Recall [95% CI] | F1 [95% CI] | Exact items |
|---|---|---|---|---|---|---|---|
| v0 naive baseline | 42 | 10 | 10 | 0.808 [0.672, 0.932] | 0.808 [0.696, 0.906] | 0.808 [0.707, 0.889] | 59/76 |
| v1 deployed before fix | 39 | 4 | 13 | 0.907 [0.810, 0.979] | 0.750 [0.625, 0.860] | 0.821 [0.725, 0.897] | 59/76 |
| v2 redesigned | 42 | 1 | 10 | 0.977 [0.921, 1.000] | 0.808 [0.700, 0.909] | 0.884 [0.811, 0.945] | 65/76 |

*Note.* TP, FP and FN are counts of links. Confidence intervals are percentile bootstrap intervals over items (10,000 resamples, seed 42).

Another way to read the precision result is by items that should have no link. Of the 35 items with an empty gold set, v0 attached at least one ticker to 4, v1 to 3 and v2 to 1. For a reader of the news page, these are the cases in which an article appears on the page of a stock it does not mention.

## 4.2. Results by Subset

Table 5 breaks the results down by subset. On the 48 real headlines with diacritics, v2 produced no false link (26 TP, 0 FP, 5 FN). On the 12 slugs it also produced no false link but missed two links, both caused by the ticker VNM written in lower case in the slug. On the six audit cases v2 matched the gold labels exactly, while v0 and v1 each got two items wrong. The constructed cases were the hardest subset for all versions, which is expected, since they were written to test the weak points of each rule.

*Table 5. Results by subset*

| Subset (items) | Version | TP | FP | FN | Precision | Recall | F1 | Exact |
|---|---|---|---|---|---|---|---|---|
| Real headlines (48) | v0 | 25 | 2 | 6 | 0.926 | 0.806 | 0.862 | 40 |
| | v1 | 25 | 1 | 6 | 0.962 | 0.806 | 0.877 | 41 |
| | v2 | 26 | 0 | 5 | 1.000 | 0.839 | 0.912 | 43 |
| Real URL slugs (12) | v0 | 8 | 1 | 1 | 0.889 | 0.889 | 0.889 | 10 |
| | v1 | 6 | 1 | 3 | 0.857 | 0.667 | 0.750 | 8 |
| | v2 | 7 | 0 | 2 | 1.000 | 0.778 | 0.875 | 10 |
| Audit cases (6) | v0 | 0 | 2 | 1 | 0.000 | 0.000 | 0.000 | 4 |
| | v1 | 0 | 1 | 1 | 0.000 | 0.000 | 0.000 | 4 |
| | v2 | 1 | 0 | 0 | 1.000 | 1.000 | 1.000 | 6 |
| Constructed (10) | v0 | 9 | 5 | 2 | 0.643 | 0.818 | 0.720 | 5 |
| | v1 | 8 | 1 | 3 | 0.889 | 0.727 | 0.800 | 6 |
| | v2 | 8 | 1 | 3 | 0.889 | 0.727 | 0.800 | 6 |

The slug subset is the only one in which v0 had higher recall than v2. Case-insensitive matching in v0 recovers lower-case tickers in slugs, such as *"vnm chot danh sach hop co dong"*. The same mechanism produces the false link to TRA in the real headline *"DXG báo lãi giảm 98%, hơn 9.000 tỷ đồng người mua trả tiền trước"*, where *"trả"* becomes *"tra"*.

## 4.3. Paired Comparison

Table 6 compares the versions on item-level exactness. Between v1 and v2, seven items moved from wrong to exact and one moved from exact to wrong. The exact McNemar test gives p = 0.070, so the improvement does not reach the 0.05 level on this sample. The comparison of v0 and v2 gives ten items improved and four worsened (p = 0.180). Versions v0 and v1 have the same number of exact items, with three gains and three losses.

*Table 6. Exact McNemar tests on item-level exactness*

| Comparison | Exact only under first version | Exact only under second version | p (two-sided, exact) |
|---|---|---|---|
| v0 vs v1 | 3 | 3 | 1.000 |
| v0 vs v2 | 4 | 10 | 0.180 |
| v1 vs v2 | 1 | 7 | 0.070 |

The single item that v1 handled correctly and v2 did not is the constructed sentence A14, *"Kido Group đặt mục tiêu lợi nhuận cao hơn, Vincom Retail mở thêm trung tâm"*. Version v1 matched KDC through the two-word alias *"kido group"*, while v2 reduces the name to *"kido"*, which is shorter than its threshold. Of the seven items that v2 fixed, four (A01, S03, R19 and S01) are explained by the removal of the last-two-words alias or by the core-name abstraction, two (A02 and A09) by matching names stripped of legal forms, and one (R28) by matching *"Novaland"* once *"Group"* is removed.

## 4.4. Sensitivity to the Core-Name Length Threshold

The minimum core-name length was fixed at six characters before evaluation. Table 7 shows, as a post hoc analysis on the same data, how the results change with other thresholds. Lowering the threshold to four characters raises recall from 0.808 to 0.923 and F1 from 0.884 to 0.932, because short names such as *"masan"*, *"kido"* and *"bidv"* become usable. It also triples the number of false links, from one to three. Raising the threshold to seven lowers recall to 0.769 without reducing false links further.

*Table 7. Post hoc sensitivity of v2 to the minimum core-name length*

| Minimum length | TP | FP | FN | Precision | Recall | F1 | Exact items |
|---|---|---|---|---|---|---|---|
| 3 | 48 | 3 | 4 | 0.941 | 0.923 | 0.932 | 69 |
| 4 | 48 | 3 | 4 | 0.941 | 0.923 | 0.932 | 69 |
| 5 | 46 | 3 | 6 | 0.939 | 0.885 | 0.911 | 67 |
| 6 (used) | 42 | 1 | 10 | 0.977 | 0.808 | 0.884 | 65 |
| 7 | 40 | 1 | 12 | 0.976 | 0.769 | 0.860 | 63 |
| 8 | 40 | 1 | 12 | 0.976 | 0.769 | 0.860 | 63 |

These figures were not used to choose the threshold. Choosing four on the basis of Table 7 would fit the rule to its own test set, and the 76 items are too few to estimate how the extra false links would grow across the full market of listed companies. Section 5.4 proposes an alternative that recovers short names without lowering the threshold.

## 4.5. Error Analysis

Table 8 lists representative errors and the pattern that explains each one. The numbering of patterns follows Section 3.3.

*Table 8. Representative errors*

| Item | Text (shortened) | v0 | v1 | v2 | Gold | Cause |
|---|---|---|---|---|---|---|
| A01 | "...CEO Jensen Huang đặt tương lai Nvidia..." | CEO, ZZA | ZZA | none | none | Patterns 1 and 3 |
| R19 | "Lãnh đạo Vinamilk ... chu kỳ tăng trưởng mới" | VNM, ZZC | VNM, ZZC | VNM | VNM | Pattern 3 |
| R17 | "DXG báo lãi giảm 98% ... người mua trả tiền trước" | DXG, TRA | DXG | DXG | DXG | Pattern 2 |
| S03 | "...lợi nhuận đột biến trong tương lai" | ZZA | ZZA | none | none | Pattern 3 |
| A13 | "Thị trường mới nổi hút dòng vốn ngoại..." | GAS, ZZC | ZZC | ZZC | none | Pattern 3, phrase not listed |
| R26 | "ĐHĐCĐ Masan: Mục tiêu lợi nhuận gấp đôi..." | none | none | none | MSN | Core name of 5 characters |
| R41 | "Nhóm Vingroup bị chốt lời, cổ phiếu Vietjet tăng trần..." | VIC | VIC | VIC | VIC, VJC | Brand differs from name "Vietjet Air" |
| S09 | "vnm chot danh sach hop co dong..." | VNM | none | none | VNM | Lower-case ticker in slug |

Item R19 is a real headline about Vinamilk. Both v0 and v1 also linked it to the synthetic company ZZC, because the alias *"truong moi"* occurs inside *"tăng trưởng mới"*. The case shows that the third pattern is not limited to constructed examples: ordinary business vocabulary is enough to trigger it once the universe contains a company whose name ends in a common phrase. The full Vietnamese market contains many such names, so the effect in production is likely to be larger than in this 30-symbol universe.

The ten links that v2 still misses fall into three groups. Seven involve core names that are too short (*"masan"* four times, and *"kido"*, *"bidv"* and *"ceo"* once each). Two involve the ticker VNM written in lower case in a slug. One involves a brand that differs from the stored name (*"Vietjet"* against *"Vietjet Air"*). The single false link of v2 (A13) comes from a common phrase, *"thị trường mới"*, that is not on the `COMMON_PHRASES` list. A hand-written list cannot cover every phrase in the language, and this item shows the limit of that approach.

The screenshots of the live site, taken before v2 and the repair command were deployed, show that the errors measured in this section also occur in production. In Figure 2, the first row of the news table is the Nvidia headline, and it still carries the chip PGB, a Vietnamese bank. In Figure 4, the panel *Mã được nhắc đến* (most mentioned tickers) ranks USD first with nine mentions; USD is a currency code that v2 places on its generic-token list. The first article in Figure 4, about foreign ETFs, is linked to ILC, a training and employment company that the headline and summary do not mention, and its impact note repeats a sentence about chip demand that belongs to the Nvidia story. The second article names GMD, REE and VJC in its headline but is tagged DID. The page alone does not reveal how each of these links was created. All of them are of the kind that v2 refuses to produce, and all of them stay in the database until the repair command removes them.

![Figure 4. News page of the deployed platform before the fix: the most-mentioned panel counts USD as a ticker, and the first article is linked to an unrelated company.](fig4_news.png){width=6.2in}



## 4.6. Regression Tests

The patterns in Section 3.3 were encoded as seven automated tests in `tests/test_ticker_linking.py`, all of which pass. The tests check that the Nvidia headline produces no link; that *"tương lai"* produces no link; that sector words produce no link; that *"Hòa Phát công bố kết quả kinh doanh"* is linked to HPG; that standalone upper-case tickers are found; that tickers embedded in longer words or written in lower case are ignored; and that the core-name function removes legal forms correctly. The existing tests in `tests/test_news_service.py`, which call the linking function through the ingestion job, are unchanged. Any later edit that brings back one of the patterns will fail these tests before it reaches production.

# 5. Discussion

## 5.1. Computational Thinking Applied to a Production Defect (RQ1)

Each facet in the framework of Shute et al. (2017) can be matched to a step in this study. Decomposition into five stages (Table 1) located the defect in Stage 3 and showed why a defect there costs more than one in Stage 2. Pattern recognition turned one wrong headline into five general causes, so that the fix addressed classes of input rather than a single string. Abstraction produced the core-name concept, which separates the identifying part of a company name from legal and sector words. Algorithm design expressed the decision as two forms of evidence and a default of no link. Debugging and evaluation took the form of a labelled data set, statistical comparison and regression tests, which together show whether the change helped and guard against regression.

Two things stood out for teaching. One is that the facets were used in a loop. The error analysis in Section 4.5 is pattern recognition applied again to the output of the new algorithm, and it produced the proposals in Section 5.4. Shute et al. (2017) list iteration as a separate facet, and the case supports treating it as the connection between the others. The other relates to Denning's (2017) argument that computational thinking should be judged by the computations it produces. In this case the computation was judged by a number that a non-programmer can understand: how many articles appear on the page of a company they do not mention.

## 5.2. Why the False Links Occurred (RQ2)

The four algorithmic patterns share one cause: the earlier versions treated similarity between strings as evidence that the text refers to a company. An upper-case abbreviation, a folded syllable, an everyday phrase and a sector word all resemble company identifiers in form while carrying no information about a particular firm. The redesign responded by limiting evidence to two forms that are hard to produce by accident: a ticker written exactly as a ticker, or the distinctive part of a company name written as whole words.

The fifth pattern, stale links in the database, is an operational consequence of the same defect. The ingestion job only reconsidered articles that were still in the RSS feed. Correcting the algorithm without repairing stored data would have left the wrong links visible on older articles. The repair command addresses this, and its dry-run mode allows the number of affected records to be reviewed before any deletion, as the audit brief requires.

## 5.3. Trade-off Between False Links and Missed Links (RQ3)

The redesigned algorithm reduced false links from four to one compared with the deployed version and from ten to one compared with the naive baseline, while recall stayed at the baseline level. The confidence intervals in Table 4 and the McNemar tests in Table 6 qualify this result. With 76 items, the difference between v1 and v2 in exact items (59 against 65) has p = 0.070, and the precision intervals of v1 and v2 overlap. The evidence supports the direction of the improvement more firmly than its size. A larger labelled sample would be needed to estimate the size with useful precision.

The sensitivity analysis in Table 7 shows the trade-off directly. Accepting short core names would recover six missed links and add two false links. Whether this is worth it depends on the relative cost of the two errors. Section 2.4 argued that a false link costs more on a financial news platform, because attention to a stock affects trading (Barber & Odean, 2008; Engelberg & Parsons, 2011). The study therefore keeps the threshold at six and treats the missed links as a separate problem with a different solution.

## 5.4. Limits of Rule-Based Linking and Possible Extensions

Three extensions follow from the error analysis. A curated alias table for each listed company, containing its brand names and common short forms (for example *"Masan"* for MSN, *"BIDV"* for BID, *"Vietjet"* for VJC), would recover most of the missed links without lowering the threshold for every company. Such a table can be reviewed by a person, and every entry is a deliberate decision. Matching lower-case tickers could be allowed in one narrow context, when the source is a URL slug and the token appears next to a word such as *"co phieu"* (stock). A statistical named entity recogniser trained on Vietnamese financial text, for example a fine-tuned PhoBERT model (Nguyen & Nguyen, 2020), could replace the hand-written `COMMON_PHRASES` list by learning which contexts indicate a company. In all three cases, the evidence rule of v2 could remain as a final check before a link is stored.

# 6. Conclusion

## 6.1. Summary of Findings and Contributions

This study applied the facets of computational thinking to a defect in FinSight, a platform that relates Vietnamese financial news to stock price reactions. Decomposition located the defect in the linking stage. Pattern recognition identified four algorithmic causes and one data-workflow cause. Abstraction produced the core-name concept, and algorithm design produced a rule that links a ticker only on explicit evidence. On 76 labelled items, the redesigned algorithm made one false link against four for the deployed version and ten for a naive baseline, with precision of 0.977 (95% CI 0.921–1.000) and recall of 0.808. On the 48 real headlines with diacritics it made no false link. The item-level gain over the deployed version was not statistically significant at the 0.05 level (p = 0.070). The study releases the data set, the evaluation script, seven regression tests and an idempotent repair command.

## 6.2. Practical Implications

For developers of financial information platforms in Vietnam, the case shows that entity linking needs its own evaluation. Every figure that the platform derives from an article, including sentiment, abnormal return and sector impact, inherits the linking decision, and the event-study calculation cannot detect a wrong ticker. Platforms that collect public feeds without vendor identifiers should keep a labelled test set for this step and report its precision. Articles without a confident link can be shown as general market news, which is accurate, rather than attached to a stock. Repairs to the linking rule should be followed by a review of stored links, since data written by an earlier rule remains visible until it is corrected.

For teaching, a real defect with a measurable cost may work better than a short programming exercise. Students have a concrete reason to break the problem down and to test their fix, and the teacher can grade the result by its effect on users rather than by whether the code runs.

## 6.3. Limitations and Future Research

Five limitations affect the interpretation of the results. First, the evaluation set is small. With 76 items and 52 gold links, the confidence intervals are wide and the paired test lacks the power to confirm a difference of the observed size. Labelling a further 300 to 500 stored articles would narrow the intervals considerably. Second, one annotator assigned all labels, so inter-annotator agreement could not be measured. A second annotator working from the written guideline, with Cohen's kappa reported, would show how stable the gold labels are, particularly for subsidiaries and company groups. Third, the symbol universe has 30 entries, while the Vietnamese market lists well over a thousand securities on HOSE, HNX and UPCoM. Collisions between names and ordinary phrases will be more frequent at full scale, and the three synthetic entries only approximate this. Running the evaluation against the full listing is the most direct way to measure the effect. Fourth, the real headlines were collected through web search rather than sampled from FinSight's own database. They may differ from the RSS text the system processes, which includes summaries as well as titles. Fifth, the evaluation used the demonstration symbol list and did not measure T+1 and T+5 reactions. The deployed site now reads end-of-day prices through vnstock (Figure 3), but recent articles still show *Chưa đủ dữ liệu* and the prices are not adjusted for dividends or splits, so this study makes no claim about the predictive value of news for prices.

The screenshots also show that the impact notes and the forecast box are generated after linking and can repeat text from an unrelated article; that module should be limited to linked tickers and its percentage relabelled as a reference value until it is backtested. Future work should run the repair command on the production database and report how many stored links it removes, extend the evaluation to the full listing with a second annotator, and compare the rule-based algorithm with an alias table and with a fine-tuned PhoBERT recogniser on the same data.

# References

Barber, B. M., & Odean, T. (2008). All that glitters: The effect of attention and news on the buying behavior of individual and institutional investors. *The Review of Financial Studies, 21*(2), 785–818. https://doi.org/10.1093/rfs/hhm079

Brennan, K., & Resnick, M. (2012). New frameworks for studying and assessing the development of computational thinking. In *Proceedings of the 2012 Annual Meeting of the American Educational Research Association*. Vancouver, Canada.

Brown, S. J., & Warner, J. B. (1985). Using daily stock returns: The case of event studies. *Journal of Financial Economics, 14*(1), 3–31. https://doi.org/10.1016/0304-405X(85)90042-X

Denning, P. J. (2017). Remaining trouble spots with computational thinking. *Communications of the ACM, 60*(6), 33–39. https://doi.org/10.1145/2998438

Dietterich, T. G. (1998). Approximate statistical tests for comparing supervised classification learning algorithms. *Neural Computation, 10*(7), 1895–1923. https://doi.org/10.1162/089976698300017197

Efron, B., & Tibshirani, R. J. (1993). *An introduction to the bootstrap*. Chapman & Hall.

Engelberg, J. E., & Parsons, C. A. (2011). The causal impact of media in financial markets. *The Journal of Finance, 66*(1), 67–97.

Fama, E. F., Fisher, L., Jensen, M. C., & Roll, R. (1969). The adjustment of stock prices to new information. *International Economic Review, 10*(1), 1–21. https://doi.org/10.2307/2525569

Fang, L., & Peress, J. (2009). Media coverage and the cross-section of stock returns. *The Journal of Finance, 64*(5), 2023–2052.

Grover, S., & Pea, R. (2013). Computational thinking in K–12: A review of the state of the field. *Educational Researcher, 42*(1), 38–43. https://doi.org/10.3102/0013189X12463051

Hevner, A. R., March, S. T., Park, J., & Ram, S. (2004). Design science in information systems research. *MIS Quarterly, 28*(1), 75–105. https://doi.org/10.2307/25148625

Kearney, C., & Liu, S. (2014). Textual sentiment in finance: A survey of methods and models. *International Review of Financial Analysis, 33*, 171–185. https://doi.org/10.1016/j.irfa.2014.02.006

Loughran, T., & McDonald, B. (2011). When is a liability not a liability? Textual analysis, dictionaries, and 10-Ks. *The Journal of Finance, 66*(1), 35–65. https://doi.org/10.1111/j.1540-6261.2010.01625.x

MacKinlay, A. C. (1997). Event studies in economics and finance. *Journal of Economic Literature, 35*(1), 13–39.

Manning, C. D., Raghavan, P., & Schütze, H. (2008). *Introduction to information retrieval*. Cambridge University Press.

McNemar, Q. (1947). Note on the sampling error of the difference between correlated proportions or percentages. *Psychometrika, 12*(2), 153–157. https://doi.org/10.1007/BF02295996

Nadeau, D., & Sekine, S. (2007). A survey of named entity recognition and classification. *Lingvisticae Investigationes, 30*(1), 3–26. https://doi.org/10.1075/li.30.1.03nad

Nguyen, D. Q., & Nguyen, A. T. (2020). PhoBERT: Pre-trained language models for Vietnamese. In *Findings of the Association for Computational Linguistics: EMNLP 2020* (pp. 1037–1042). Association for Computational Linguistics.

Peffers, K., Tuunanen, T., Rothenberger, M. A., & Chatterjee, S. (2007). A design science research methodology for information systems research. *Journal of Management Information Systems, 24*(3), 45–77. https://doi.org/10.2753/MIS0742-1222240302

Shen, W., Wang, J., & Han, J. (2015). Entity linking with a knowledge base: Issues, techniques, and solutions. *IEEE Transactions on Knowledge and Data Engineering, 27*(2), 443–460.

Shute, V. J., Sun, C., & Asbell-Clarke, J. (2017). Demystifying computational thinking. *Educational Research Review, 22*, 142–158. https://doi.org/10.1016/j.edurev.2017.09.003

Tetlock, P. C. (2007). Giving content to investor sentiment: The role of media in the stock market. *The Journal of Finance, 62*(3), 1139–1168. https://doi.org/10.1111/j.1540-6261.2007.01232.x

Wing, J. M. (2006). Computational thinking. *Communications of the ACM, 49*(3), 33–35. https://doi.org/10.1145/1118178.1118215

Wing, J. M. (2008). Computational thinking and thinking about computing. *Philosophical Transactions of the Royal Society A, 366*(1881), 3717–3725. https://doi.org/10.1098/rsta.2008.0118

Xing, F. Z., Cambria, E., & Welsch, R. E. (2018). Natural language based financial forecasting: A survey. *Artificial Intelligence Review, 50*(1), 49–73. https://doi.org/10.1007/s10462-017-9588-9
