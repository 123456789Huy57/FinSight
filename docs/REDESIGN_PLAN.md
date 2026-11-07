# FinSight – Kế hoạch giai đoạn 3: Frontend theo hướng đã chốt, rồi Backend

*Tài liệu cho agent thực thi (Claude Code, Codex hoặc agent khác). Mỗi task ghi rõ **model nên dùng**, **file cần đọc** và **tiêu chí xong**. Agent chỉ đọc mục 0–3 và đúng task đang làm, không đọc cả tài liệu, để tiết kiệm token.*

Ngày lập: 07/11/2026. Repo: `C:\Users\Huynguyen\Desktop\FinSight`. Nguồn thiết kế đã chốt: `D:\OneDrive\Downloads\Học kì 6\Phát triển web kinh doanh\Visual Studio Code\FinSight-Frontend` (sau đây gọi là **repo mẫu**).

---

## 0. Cách dùng tài liệu này

1. Mỗi phiên agent làm **một task** (ví dụ `FE-07`). Xong task thì commit, chạy `/clear`, rồi mới sang task sau.
2. Mở phiên bằng prompt mẫu ở mục 9, thay mã task vào. Prompt đó yêu cầu agent đọc mục 0–3 và task của nó, **không đọc thêm**.
3. Chọn model và effort theo cột "Model" của task (cách đổi model ở mục 3.3).
4. Gặp điểm mơ hồ: chọn phương án đơn giản nhất khớp với mục 2, ghi một dòng vào `docs/decisions.md`, rồi làm tiếp. Chỉ dừng lại hỏi khi phải xoá dữ liệu hoặc đổi phạm vi.

## 1. Mục tiêu và thứ tự

**Giai đoạn FE (làm trước):** đưa toàn bộ frontend của repo này về hướng thiết kế B đã chốt: nền sáng, font Be Vietnam Pro, bộ token màu, landing có biểu đồ giá ghim tin, bản đồ nhiệt. Đồng thời sửa mọi chỗ hứa sai ("thời gian thực", "AI"). Logic dữ liệu và API v1 hiện có **giữ nguyên**: chỉ đổi giao diện, chữ và cách hiển thị.

**Giai đoạn BE (làm sau khi FE xong):** thay giá CSV tổng hợp bằng một nguồn thật (mặc định DNSE), có giá điều chỉnh (adjusted close). Khi đó T+1/T+5 mới đo được thật.

**Ngoài phạm vi cả hai giai đoạn:** dark mode, đặt lệnh, đa ngôn ngữ, realtime streaming, mở rộng toàn thị trường.

## 2. Quyết định đã chốt (ràng buộc, không tự đổi)

### 2.1 Thiết kế (hướng B, "Dòng thời gian tin → giá")

| Hạng mục | Giá trị |
|---|---|
| Nền | Trang sáng `#ffffff`; trang dữ liệu nền `#f5f6f8` với panel trắng |
| Token màu | `--fs-ink #14161a`, `--fs-ink-2 #3b3f47`, `--fs-muted #6b7079`, `--fs-line #e6e8ec`, `--fs-surface #f5f6f8`, `--fs-paper #ffffff`, `--fs-signal #2f4bff`, `--fs-signal-soft #e9edff`, `--fs-up #12a150`, `--fs-down #d9343b`, `--fs-flat #a07a00` |
| Ý nghĩa màu | Xanh lá/đỏ/vàng **chỉ** dùng cho giá. `--fs-signal` **chỉ** dùng cho tin (chấm ghim, chip mã, link). Bản đồ nhiệt giữ bảng màu riêng trong `MarketHeatmap.tsx` |
| Font | Be Vietnam Pro 400/500/600 qua `@fontsource/be-vietnam-pro`. Mọi con số dùng `tabular-nums`. Không dùng font mono |
| Hình khối | Panel `rounded-xl`, viền `--fs-line`, không đổ bóng. Nút `rounded-lg`, cao 36–48px |
| Không dùng | Gradient trang trí, glow, frosted glass, chữ IN HOA cho nhãn, nhãn nhỏ trên tiêu đề, chuỗi nối bằng "·", mũi tên trong chữ nút |
| Chuyển động | Mỗi trang tối đa một chuyển động tự chạy; luôn tôn trọng `prefers-reduced-motion` |

Code tham chiếu trong repo mẫu (chép sang, không viết lại từ đầu):
`app/globals.css` (khối `FinSight tokens` và `Landing & chart`), `app/layout.tsx`, `app/page.tsx`, `components/Navbar.tsx`, `components/landing/NewsPriceChart.tsx`, `components/MarketHeatmap.tsx`, `lib/treemap.ts`, `app/dashboard/page.tsx` (component `Panel`, `MoverList`), `app/phuong-phap/page.tsx`.

### 2.2 Nội dung

- Không có chữ "thời gian thực", "realtime", "live" khi dữ liệu là EOD hoặc tổng hợp. Nhãn thời điểm dữ liệu lấy từ `dataMode` và `asOf` của API: `synthetic-demo` → "Dữ liệu minh hoạ"; `market-provider` → "Cuối ngày" hoặc "Trễ" theo hợp đồng.
- Không gọi là "AI" khi chưa chạy mô hình thật. Tên sản phẩm là **FinSight**, bỏ "FinSight AI". Sentiment gọi là "chấm điểm sắc thái".
- Không có khuyến nghị mua/bán. Chỉ báo kỹ thuật chỉ có nhãn mô tả trạng thái, kèm câu "không phải khuyến nghị đầu tư".
- Chữ tiếng Việt, câu ≤ 20 chữ, nút bắt đầu bằng động từ. Landing tuân theo bộ rule nội dung đã chốt: tối đa 6 khối, tổng ≤ 300 chữ ngoài phần demo.
- T+1/T+5 luôn kèm câu "biến động quan sát được, không khẳng định nhân quả". Khi trạng thái là `pending`, `insufficient_data` hoặc `overlapping_event` thì hiện lý do bằng chữ, không hiện số.

### 2.3 Kỹ thuật

- Giữ `lightweight-charts` cho biểu đồ nến ở trang mã (đã có, ghi lý do vào `decisions.md`). Đổi màu biểu đồ sang token.
- Mọi dữ liệu đi qua `frontend/lib/api.ts`. Không tạo mock mới trong page.
- Không đổi hợp đồng API v1. Thiếu trường nào cho giao diện mới thì ghi vào mục "Cần backend" của `docs/decisions.md`, giao diện tạm ẩn phần đó.

## 3. Chiến lược tiết kiệm token

### 3.1 Phân tầng model

| Tầng | Model, effort | Dùng cho | Không dùng cho |
|---|---|---|---|
| **A: suy nghĩ** | Opus 5.5, effort `high` | Thiết kế kiến trúc, quyết định khó, review cuối mỗi phase (một lần, có ảnh chụp), adapter nguồn giá, rà soát bảo mật | Gõ code theo spec đã rõ, sửa chữ, chạy lệnh |
| **B: làm việc** | Sonnet 5.5, effort `medium` | Viết và chuyển component, restyle trang theo spec, viết test, sửa lỗi build | Thay thế hàng loạt có bảng quy đổi sẵn |
| **C: cơ học** | Haiku 5.5, effort `low` | Thay mã màu theo bảng ở mục 7, sửa chữ theo danh sách, grep kiểm tra, chạy build/lint và tóm tắt lỗi, commit, cập nhật tài liệu | Bất cứ việc gì cần tự quyết định thiết kế |
| Fable 5.1 | Không dùng | Chỉ khi Opus `xhigh` đã thử mà vẫn bế tắc | |

Giá tham khảo theo [CloudInsight](https://cloudinsight.cc/en/blog/claude-opus-5-5-sonnet-5-5-guide) (bên thứ ba, cần kiểm lại trên trang của Anthropic), USD trên 1 triệu token input/output: Opus 5.5 $4/$20, Sonnet 5.5 $2/$10, Haiku 5.5 $0.10/$0.50 khi prompt ≤ 100K token. Tức là làm một việc bằng Haiku rẻ hơn Sonnet khoảng 20 lần, Sonnet rẻ hơn Opus khoảng 2 lần.

### 3.2 Quy tắc tiết kiệm

1. **Một task một phiên, `/clear` giữa các task.** Không để lịch sử phiên trước làm phình context.
2. **Chỉ đọc file trong cột "Đọc"** của task. Cần tìm thêm thì dùng `grep`/`rg` ra đúng dòng, không mở cả file lớn (`lib/api.ts` dài 583 dòng: chỉ đọc đoạn hàm cần dùng).
3. **Sửa bằng Edit theo đoạn**, không viết lại cả file trừ khi task ghi "viết lại".
4. **Ảnh chụp màn hình tốn nhiều token.** Chỉ chụp ở task QA và task review của tầng A. Chụp ở 1440×900 và 390×844, `deviceScaleFactor: 1`, `reducedMotion: 'reduce'`. Cắt ảnh thành từng phần cần xem thay vì đưa nguyên trang dài.
5. **Giữ `CLAUDE.md` ngắn và ổn định** (≤ 60 dòng). Nó được nạp vào mọi phiên, ngắn và ít đổi thì vừa rẻ vừa được cache tốt.
6. **Chạy lệnh dài, đọc kết quả ngắn:** `npm run build 2>&1 | tail -30`, `pytest -q 2>&1 | tail -20`.
7. **Tầng A không gõ code.** Opus viết spec hoặc review. Sonnet hoặc Haiku làm theo. Nếu Opus phải sửa thì chỉ sửa đoạn ngắn.
8. Báo cáo cuối task tối đa 10 dòng: đã làm gì, lệch gì, lệnh kiểm tra nào đã qua.

### 3.3 Cách đổi model trong Claude Code

Theo [hướng dẫn cấu hình model](https://dev.to/nixonperinchery/claude-code-model-config-aliases-opusplan-and-effort-mlc) (bài tổng hợp từ tài liệu chính thức):

- Trong phiên: `/model opus`, `/model sonnet`, `/model haiku`. Đổi mức suy nghĩ bằng `/effort low`, `/effort medium` hoặc `/effort high`.
- Lúc khởi động: `claude --model haiku`.
- `opusplan`: Opus lập kế hoạch ở plan mode, rồi tự chuyển sang Sonnet để làm. Dùng cho task có ghi "A→B".
- Subagent cố định model bằng frontmatter. Tạo 3 file trong `.claude/agents/` (task `FE-00` làm):

```markdown
---
name: mechanic
description: Việc cơ học theo bảng có sẵn: thay mã màu, sửa chữ, grep, chạy build/lint/test và tóm tắt lỗi, commit.
model: haiku
---
Chỉ làm đúng danh sách được giao. Không tự quyết định thiết kế. Báo cáo ≤ 10 dòng.
```

```markdown
---
name: builder
description: Viết hoặc restyle component/trang theo spec trong docs/REDESIGN_PLAN.md.
model: sonnet
---
Đọc mục 2 của docs/REDESIGN_PLAN.md và đúng task được giao. Dùng token --fs-*, không thêm mã hex. Chạy npm run lint và npm run build trước khi báo xong.
```

```markdown
---
name: reviewer
description: Review cuối phase: đối chiếu với mục 2, xem ảnh chụp, liệt kê lỗi P0/P1/P2.
model: opus
---
Chỉ review, không sửa code. Mỗi lỗi ghi file:dòng và cách sửa trong một câu.
```

Dùng Codex: chọn mức model tương ứng theo cùng ba tầng (mạnh nhất cho A, mức trung cho B, mức nhỏ và rẻ nhất cho C).

---

## 4. Giai đoạn FE

Ký hiệu model: **A** = Opus `high`, **B** = Sonnet `medium`, **C** = Haiku `low`, **A→B** = `opusplan`.

### Phase FE-0: Dọn nền (làm trước mọi thứ)

| Task | Việc | Model | Đọc | Xong khi |
|---|---|---|---|---|
| FE-00 | Tạo branch `redesign/phase-3`. Commit toàn bộ 117 file đang sửa thành một commit "snapshot: trạng thái Codex 07/11". Tạo 3 file agent ở mục 3.3. | C | `git status` | `git status` sạch; 3 file agent tồn tại |
| FE-01 | Viết lại `CLAUDE.md` ≤ 60 dòng: bỏ "Dark terminal-style", "vnstock 4.0.4", "deepseek"; thêm 1 đoạn trỏ tới `docs/REDESIGN_PLAN.md` mục 2; giữ phần "Quy tắc làm việc" và "Chạy local" (sửa thành Docker Compose theo README) | C | `CLAUDE.md`, `README.md` mục chạy | ≤ 60 dòng, không còn thông tin sai |
| FE-02 | Sửa chữ hứa sai. `app/layout.tsx`: title "FinSight", description "Đọc tin tài chính Việt Nam cạnh phản ứng giá cổ phiếu." Đổi mọi "FinSight AI" thành "FinSight", "Phân tích AI" thành "Giải thích", "Phân tích AI đầy đủ" thành "Xem giải thích đầy đủ", lời chào chatbot thành "Hỏi về một mã, ngành hoặc bản tin." Xoá mọi "thời gian thực". | C | `rg -n "AI\|thời gian thực\|realtime\|live" app components` | Lệnh rg trên chỉ còn tên biến và import, không còn chữ hiển thị |
| FE-03 | Ẩn `ChatWidget` và `ExplainPanel` khi backend báo chưa có `OPENROUTER_API_KEY`. Thêm trường `aiEnabled` vào `/api/v1/meta` nếu chưa có, nếu đã có thì dùng lại. Khi tắt thì không render nút. | B | `components/ai/*.tsx` (phần props), `app/api/meta/*`, `backend/main.py` (grep `meta`) | Không đặt key thì không thấy nút giải thích/chat; có key thì hiện |

### Phase FE-1: Hệ thiết kế

| Task | Việc | Model | Đọc | Xong khi |
|---|---|---|---|---|
| FE-10 | Cài `@fontsource/be-vietnam-pro`. Viết lại `app/globals.css`: giữ phần Tailwind/shadcn cần thiết, thêm khối token và khối `Landing & chart` của repo mẫu, đặt `--font-sans`, bỏ font mono và mọi biến màu tối. `app/layout.tsx`: import font, `colorScheme: 'light'`, `themeColor: '#ffffff'`, nền body `--fs-paper`. | B | `app/globals.css`, `app/layout.tsx`, 2 file tương ứng ở repo mẫu | Build qua; chữ hiển thị bằng Be Vietnam Pro (kiểm `getComputedStyle(document.body).fontFamily`) |
| FE-11 | Tạo `components/fs/`: `Panel`, `PageHeader` (tiêu đề + `DataNote`), `DataNote` (đọc `source`/`dataMode`/`asOf`, in đúng nhãn theo mục 2.2), `Change` (% có màu), `SymbolChip` (link `/stock/[symbol]`), `Segmented` (`role="tablist"`), `EmptyState`. Mỗi file ≤ 80 dòng. | B | `app/dashboard/page.tsx` của repo mẫu (Panel, MoverList); `lib/types.ts` | Có 7 component, mỗi cái được dùng ít nhất một lần ở FE-2/FE-3 |
| FE-12 | Viết lại `components/layout/TopNav.tsx` theo `Navbar.tsx` của repo mẫu: logo, menu Tổng quan, Cổ phiếu, Tin tức, Phương pháp; bên phải là ô tìm mã (giữ logic tìm hiện có) hoặc nút "Mở dashboard" khi ở landing. Tài khoản và Backtest chuyển vào menu "Thêm" hoặc biểu tượng tài khoản. Giữ `MarketStatusBadge` nhưng đổi chữ theo `dataMode`. | B | `components/layout/TopNav.tsx`, `Navbar.tsx` repo mẫu, `components/shared/MarketStatusBadge.tsx` | Menu dùng được bằng bàn phím; ở 390px không tràn ngang |
| FE-13 | Bỏ `components/layout/MarketTicker.tsx` khỏi layout (dải chữ chạy là chuyển động thứ hai, trái mục 2.1). Giữ file đến FE-50. | C | `app/layout.tsx`, grep `MarketTicker` | Không còn ticker trên trang |

### Phase FE-2: Landing và bản đồ nhiệt

| Task | Việc | Model | Đọc | Xong khi |
|---|---|---|---|---|
| FE-20 | Chép `lib/treemap.ts` và `components/MarketHeatmap.tsx` từ repo mẫu. Đổi nguồn dữ liệu sang `api.ts`: diện tích theo `marketCap` (thiếu thì theo giá trị giao dịch = giá × khối lượng; thiếu cả hai thì ghi "Cần backend" và dùng khối lượng); màu theo `percentChange`. Ô là link tới `/stock/[symbol]`. Nhãn "Dữ liệu minh hoạ" lấy từ `DataNote`. | B | 2 file repo mẫu, `lib/api.ts` (grep `getStocks\|stocks`), `lib/types.ts` | Bản đồ hiện đủ mã API trả về, nhóm theo ngành; bấm ô sang trang mã |
| FE-21 | Tổng quát hoá `NewsPriceChart` của repo mẫu thành `components/charts/PriceNewsChart.tsx`, nhận `series`, `pins`, `height`, `label`. Pin lấy từ tin có `reactions` của mã hoặc chỉ số. Pin có trạng thái không đo được thì vẽ chấm rỗng, dòng phản ứng ghi lý do. | B | `NewsPriceChart.tsx` repo mẫu, `lib/api.ts` (grep `news\|history`) | Vẽ được VN-Index từ API thật của backend; trạng thái `insufficient_data` hiện chữ, không hiện số |
| FE-22 | Viết lại `app/page.tsx` theo landing repo mẫu (6 khối: hero biểu đồ, bản đồ nhiệt, "Một bản tin, nhiều ngành", 3 tính năng, câu niềm tin, CTA). Bỏ `redirect('/dashboard')`. Dữ liệu từ API. Nếu toàn bộ phản ứng giá là không đo được (đang dùng CSV) thì hero dùng chuỗi minh hoạ `lib/demo-market.ts` chép từ repo mẫu, gắn nhãn "Ví dụ minh hoạ". | A→B | `app/page.tsx` repo mẫu, `FE-21` | ≤ 300 chữ ngoài demo; không có số giả mà không có nhãn |
| FE-23 | Chép `app/phuong-phap/page.tsx` từ repo mẫu; sửa nội dung cho khớp `backend/domain/event_study.py`: lợi nhuận bất thường so với VN-Index, phiên sự kiện là phiên đóng cửa đầu tiên sau giờ đăng, tin chồng lấn bị đánh dấu, sentiment là từ điển từ khoá. | B | `app/phuong-phap/page.tsx` repo mẫu, docstring `backend/domain/event_study.py` | Mọi câu trên trang đúng với code |

### Phase FE-3: Các trang dữ liệu (restyle, giữ logic)

Quy tắc chung cho FE-30 đến FE-35: **giữ nguyên hook, state, gọi API và xử lý loading/error/empty**; chỉ thay JSX và class. Dùng component `components/fs/`. Thay hex theo bảng mục 7.

| Task | Việc | Model | Đọc | Xong khi |
|---|---|---|---|---|
| FE-30 | `/dashboard`: hàng chỉ số, bản đồ nhiệt (FE-20), panel "Tin & phản ứng giá" là panel lớn nhất, độ rộng + ngành, top tăng/giảm, watchlist. Bố cục như `app/dashboard/page.tsx` repo mẫu. Restyle luôn `components/dashboard/*`. | B | `app/dashboard/page.tsx` (240 dòng), lần lượt từng file `components/dashboard/*` | 0 hex trong các file này; 390px không tràn |
| FE-31 | `/market`: bảng `<table>` thật, header bấm sắp xếp có `aria-sort`; trên mobile chỉ hiện Mã, Giá, %; bộ lọc dùng `Segmented`. | B | `app/market/page.tsx` (527 dòng; đọc phần JSX từ `return (`) | Như trên |
| FE-32 | `/news` và `components/news/NewsCard.tsx`: danh sách dạng hàng, chip mã dùng `SymbolChip`, cột "Phiên sau" và "5 phiên" hiện số hoặc lý do. | B | `app/news/page.tsx`, `NewsCard.tsx` | Như trên |
| FE-33 | `/stock/[symbol]`: đầu trang, biểu đồ nến (đổi màu nến sang `--fs-up`/`--fs-down`, marker tin màu `--fs-signal`), tin về mã, hiệu suất, chỉ báo (có câu miễn trừ), chỉ số tài chính, giới thiệu. | B | `app/stock/[symbol]/page.tsx` (566 dòng; đọc theo đoạn), `components/stock/CandlestickChart.tsx` | Như trên; không có chữ "Khuyến cáo" |
| FE-34 | `components/ai/ExplainPanel.tsx`, `ChatWidget.tsx`: restyle sang panel sáng, bỏ chữ "AI" hiển thị (FE-02). | C | 2 file, bảng mục 7 | 0 hex |
| FE-35 | `/account`, `/backtest`, `app/not-found.tsx`, `components/shared/*`: chỉ thay hex theo bảng và đổi class panel/nút. | C | từng file | 0 hex |

### Phase FE-4: Kiểm tra và dọn

| Task | Việc | Model | Đọc | Xong khi |
|---|---|---|---|---|
| FE-40 | Cài ESLint (config Next) và Vitest. `lint` chạy cả `tsc --noEmit` và `eslint`. Viết test: `treemap.ts` (tổng diện tích bằng khung, không ô nào tràn), `lib/format.ts`, nhãn `DataNote` cho 3 giá trị `dataMode`. | B | `package.json`, `lib/treemap.ts`, `lib/format.ts` | `npm run lint` và `npm test` xanh |
| FE-41 | Chạy kiểm tra mục 8, gom kết quả thành bảng. Chưa sửa gì. | C | không | Có bảng kết quả |
| FE-42 | Review phase: xem ảnh chụp 1440/390 của `/`, `/dashboard`, `/market`, `/news`, `/stock/HPG`; đối chiếu mục 2; xuất danh sách lỗi P0/P1/P2 dạng file:dòng. | A | Kết quả FE-41 và ảnh chụp | Có danh sách lỗi; P0 được giao lại cho B hoặc C |
| FE-43 | Sửa lỗi P0/P1 từ FE-42 (mỗi lỗi một commit). | B hoặc C theo loại lỗi | Đúng file:dòng trong danh sách | FE-41 chạy lại sạch |
| FE-50 | Xoá component không còn dùng (`MarketTicker`, các biến CSS màu tối, file trong `frontend/app/api/*` cũ nếu grep không còn caller). Cập nhật `README.md` mục giao diện và `docs/PROJECT_HANDOFF.md` mục 2–3. | C | grep caller | Build qua; không còn file mồ côi |

Ước lượng: khoảng 25 phiên; khoảng 70% số phiên dùng Sonnet, 25% dùng Haiku, 3 phiên dùng Opus (FE-22 phần lập kế hoạch, FE-42, và dự phòng).

---

## 5. Giai đoạn BE (bắt đầu khi FE-50 xong)

Mục tiêu: một nguồn giá thật, có giá điều chỉnh, đủ để T+1/T+5 đo được. Giữ CSV làm nguồn demo và CI.

| Task | Việc | Model | Xong khi |
|---|---|---|---|
| BE-00 | **Việc của bạn, không phải agent:** đăng ký DNSE OpenAPI; hỏi DNSE bằng văn bản về quyền lưu và hiển thị dữ liệu, độ trễ, quota, phí, lịch sử, giá điều chỉnh. Ghi câu trả lời vào `docs/decisions.md`. | Người | Có API key và câu trả lời bằng văn bản |
| BE-01 | Spec adapter DNSE: ánh xạ endpoint sang `MarketDataProvider`, đơn vị giá, timezone, phân trang, quota, retry; thiết kế fixture test. Không code. | A | `docs/dnse-adapter-spec.md` ≤ 2 trang |
| BE-02 | Code `backend/providers/dnse_provider.py` theo spec; thêm vào factory; thêm biến môi trường vào Settings, Compose, Render, `.env.example`. | B | Unit test với fixture qua, không cần mạng |
| BE-03 | Backfill 2 năm cho 15 mã + VN-Index dưới source mới; so 5 mã với website chính thức cùng ngày; ghi lệch nếu có. | B | Bảng so sánh trong `docs/decisions.md` |
| BE-04 | Giá điều chỉnh: lấy từ DNSE nếu có; nếu không, thiết kế bảng sự kiện quyền (cổ tức, chia tách) và cách tính. | A→B | `adjusted_close` có cho các mã đã backfill; test event study chạy trên dữ liệu thật ra số |
| BE-05 | Thêm `marketCap` và giá trị giao dịch vào `/api/v1/stocks` cho bản đồ nhiệt (mục "Cần backend" từ FE-20). | B | Bản đồ nhiệt dùng `marketCap` thật |
| BE-06 | Rà soát bảo mật trước khi deploy công khai: secrets, CORS, rate limit, quyền sở hữu dữ liệu theo user, log. | A | Danh sách P0 = 0 |
| BE-07 | Xoá endpoint legacy trong `backend/main.py` và `frontend/app/api/*` sau khi grep không còn caller. | C | Build và test xanh |

Quote trong phiên (intraday) và mở rộng toàn thị trường: chỉ làm khi BE-00 xác nhận quota và quyền, lập kế hoạch riêng.

## 6. Thứ tự thực hiện

```
FE-00 → FE-01 → FE-02 → FE-03
      → FE-10 → FE-11 → FE-12 → FE-13
      → FE-20 → FE-21 → FE-22 → FE-23
      → FE-30 … FE-35 (làm theo thứ tự, mỗi task một phiên)
      → FE-40 → FE-41 → FE-42 → FE-43 → FE-50
BE-00 (bạn làm song song từ bây giờ) → BE-01 → … → BE-07
```

## 7. Bảng quy đổi màu cũ sang token (cho task tầng C)

| Hex cũ | Số lần | Thay bằng |
|---|---|---|
| `#070d1a`, `#060c18`, `#071433` | 9 | nền trang: `var(--fs-surface)`; nền landing: `var(--fs-paper)` |
| `#0e1726`, `#0f1f3d`, `#12304a` | 78 | nền panel: `var(--fs-paper)` |
| `#1a2744`, `#1e3158` | 72 | viền: `var(--fs-line)`; nền hover: `var(--fs-surface)` |
| `#3d4f6b` | 40 | viền đậm: `var(--fs-line)`; chữ phụ: `var(--fs-muted)` |
| `#7a8ba8`, `#9baac0`, `#94a3b8` | 88 | chữ phụ: `var(--fs-muted)` |
| `#34d399` | 49 | `var(--fs-up)` |
| `#f87171` | 42 | `var(--fs-down)` |
| `#f59e0b`, `#fbbf24` | 47 | đứng giá: `var(--fs-flat)`; cảnh báo không phải giá: `var(--fs-ink-2)` |
| `#06b6d4`, `#4f8ef7` | 18 | link, tin, mã: `var(--fs-signal)` |
| `#052e16` | 2 | `var(--fs-signal-soft)` nếu là nền chip; nếu là nền tăng giá thì bỏ nền |
| Chữ trắng `text-white` trên nền tối cũ | | `text-[var(--fs-ink)]` |

Màu nào không có trong bảng: dừng lại, ghi vào báo cáo, không tự chọn.

## 8. Kiểm tra cho mỗi task và mỗi phase

Mỗi task:
- [ ] `npm run lint` và `npm run build` qua (`2>&1 | tail -30`)
- [ ] `rg -n "#[0-9a-fA-F]{6}" <file vừa sửa>` không ra kết quả (trừ `MarketHeatmap.tsx`)

Cuối phase (FE-41):
- [ ] Ở 390px: `document.documentElement.scrollWidth === 390` cho mọi trang
- [ ] Đi hết trang bằng Tab, thấy rõ focus
- [ ] `rg -n "thời gian thực|realtime|FinSight AI|Khuyến cáo|Phân tích AI" frontend/app frontend/components` không ra kết quả
- [ ] Cùng một mã có cùng giá và cùng % ở dashboard, `/market`, `/stock`
- [ ] Mọi trang có số liệu đều hiện `DataNote`
- [ ] Backend: `docker compose exec backend pytest -q` vẫn xanh (FE không được làm hỏng)

## 9. Prompt mẫu mở phiên

Tầng B và C:

```
Đọc docs/REDESIGN_PLAN.md mục 0–3 và task <MÃ TASK>. Không đọc mục khác.
Chỉ mở file trong cột "Đọc" của task; cần thêm thì grep ra đúng dòng.
Làm xong thì chạy kiểm tra mục 8 cho task, commit "<MÃ TASK>: <mô tả ngắn>", báo cáo ≤ 10 dòng.
```

Tầng A (review):

```
Đọc docs/REDESIGN_PLAN.md mục 2 và task <MÃ TASK>. Không sửa code.
Xem kết quả kiểm tra và ảnh chụp đã có. Liệt kê lỗi P0/P1/P2, mỗi lỗi ghi file:dòng, cách sửa một câu, và tầng model nên sửa (B hoặc C).
```

## 10. Câu hỏi mở (agent dùng mặc định nếu chưa có trả lời)

- Chat và giải thích bằng AI: mặc định ẩn khi chưa có key (FE-03). Có key rồi thì hiện, nhãn "Giải thích", không dùng chữ "AI".
- Tài khoản và Backtest: mặc định vẫn giữ trang, nhưng không đặt trên menu chính.
- Landing khi chưa có giá thật: mặc định hero dùng chuỗi minh hoạ có nhãn (FE-22).
- Nguồn giá thật: mặc định DNSE; đổi sang SSI nếu BE-00 cho kết quả tốt hơn.
