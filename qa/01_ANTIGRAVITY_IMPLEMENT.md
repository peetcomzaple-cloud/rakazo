# Antigravity: ลงมือปรับสถาปัตยกรรม Rakazo และพิสูจน์ผลก่อนส่งงาน

ผู้ใช้สั่งให้เริ่มลงมือแล้ว ให้คุณเป็นผู้พัฒนาและผู้รวมงานหลักของชุดนี้ ตรวจฐานปัจจุบัน ออกแบบรายละเอียดที่จำเป็น แล้วเขียน implementation และทดสอบจริงต่อในงานเดียว อย่าหยุดที่แผน/README/stub หรือถามยืนยันเริ่มงานซ้ำ การเพิ่มขั้นอนุมัติต้องมีเหตุจากสิทธิ์หรือข้อจำกัดที่ใช้จริง

## 1. อ่านและยืนยันฐาน

อ่านไฟล์ต่อไปนี้ตามลำดับ โดยใช้คำสั่งล่าสุดผู้ใช้เหนือเอกสารย้อนหลัง:
- C:\Users\User\Documents\Codex\2026-10-13\antigravity-chat-d-2-2\outputs\CODEX_REVIEWER_ANTIGRAVITY_PLAYBOOK.md
- C:\Users\User\Documents\Codex\2026-10-13\antigravity-chat-d-2-2\outputs\strategy-review-20261015\RAKAZO_STRATEGY_PLAN.md
- `SOURCE_REVIEW_COVERAGE.md` และ `COMPONENT_DECISIONS.json` ในโฟลเดอร์แผนเดียวกัน
- `02_JULES_INDEPENDENT_QA.md` และ `03_JEV_TEST_PROTOCOL.md` ในโฟลเดอร์เดียวกับพรอมป์นี้
- AGENTS.md และ handoff ที่เกี่ยวข้องใน checkout ที่ทำงานจริง

ตรวจ local dirty diff/untracked, active owners/jobs, source/server/API/worker/helper/image/package resolution ก่อนแก้ GitHub เก่าไม่ใช่ baseline runtime อย่า reset/clean/re-clone ทับงานเดิม หากมีงานอื่นเขียนไฟล์เดียวกันให้ใช้ checkout/snapshot ที่แยกหรือรับ ownership หลัง freeze ไม่แก้ชน

Oracle ที่ Codex ตรวจล่าสุดเป็น x86_64/2 CPU/RAM 11,496 MiB ต้องตรวจใหม่ ไม่ใช้สมมติฐาน ARM64/24 GB ใน PDF แผนมี source inventory 32 repos แต่ยังไม่ได้ audit ทุกไฟล์ ให้ตาม dependency closure ของส่วนที่จะใช้จริง ทั้ง lifecycle, callbacks, cancellation, secrets, usage, network, defaults และ license ไม่อ้างว่าอ่านครบจาก README

สร้าง `ARCHITECTURE_EXECUTION.md` แบบกระชับ ระบุ baseline/ขอบเขต/ไฟล์/ลำดับ/เกณฑ์ผ่าน แล้วลงมือระยะ 0 ต่อทันที ไม่ใช้เอกสารนี้แทน implementation

## 2. ผลิตภัณฑ์ที่ต้องได้

คง chat, routines, memory, approvals, protected secrets, artifacts และ supervisor ของ Rakazo แยก planner/decision/execution/verification ที่ boundary ที่จำเป็น ใช้ของเดิมก่อนสร้าง abstraction/state store ใหม่

งานที่ต้องพัฒนาและเชื่อมจริง:
1. BrowserProvider ที่ควบคุม browser/profile/display เดิมได้อย่างถูกต้อง เลือกจากผล spike ของ Playwright-based path กับ agent-browser ไม่ให้สอง driver เขียนจอเดียวกันพร้อมกัน
2. การเลือก action จาก candidates สด รองรับ deterministic และโมเดลจีนที่อนุญาต; Jev เป็น adapter เสริมที่เปิดใช้ชัดเจน ไม่เป็น hosted dependency บังคับของ core
3. การค้นหา/อ่านเว็บต่อผ่าน `WebSearchProvider`/`WebFetchProvider` เดิม เพิ่ม SearXNG JSON backend และ Reader fallback ที่จำเป็น พร้อมเลือกเส้นทางตามงาน
4. การสร้างเอกสารผ่าน engine ตาม format ทดลอง Pandoc/Typst เทียบของเดิมแล้วเชื่อม engine ที่ผ่านจริงกับ `render_document`/artifact UI โดยรักษารูปแบบหลักที่ผู้ใช้ต้องใช้
5. การคุมงบ/usage/retry ของทุก internal call, recover/no-progress และการตรวจผลทั้ง completion และ takeover ให้ครบ end-to-end

ไม่จำเป็นต้องติดตั้งครบ 32 โครงการ การตัดสินใจทุกตัวต้องมีเหตุผล use/reuse/defer/reject และหลักฐานก่อนเลือก ตัวเสริมอย่าง Skyvern/Steel/Firecrawl/Camoufox/LiteLLM/Vaultwarden/proxy รับเข้ามาเมื่อมีความต้องการและข้อได้เปรียบที่ตรวจได้ ไม่ใช้จำนวน dependencies เป็นตัวชี้วัดความก้าวหน้า

## 3. สัญญาที่ห้ามเสีย

- ผูก observation/action กับ computer/run/fence/session/target/frame/document generation ที่เกี่ยวข้อง ห้ามเลือกแท็บแรกหรือเดาจอจากชื่อ bot
- ผลแยก dispatch/application/outcome/failed-before-dispatch/uncertain; applied=true, URL เปลี่ยน, DONE หรือ run completed ไม่ใช่หลักฐานสำเร็จปลายทาง
- ตรวจ fence/สิทธิ์ก่อนทุก mutation รวม pending actions, connection ที่เปิดค้าง, library callbacks/watchdogs และการกระทำภายใน worker หลัง Stop/Take Control ต้องหมดอำนาจ input ของ worker เก่าจริง
- snapshot/ref ต้องมี freshness/coverage/truncation และขยาย scope ได้เมื่อเป้าหมายถูกตัดออก ไม่เพิ่ม element limit อย่างเดียวจน context ล้น
- รักษา approval/secret boundaries เดิม ค่า secret resolve ใน runtime ตาม origin/field; ไม่ผ่าน planner/selector/Jev/text helper/command-line/log/raw screenshots และไม่อ่าน credentials จริงจากประวัติมาทดลอง
- มี browser/profile owner หลักเพียงชุดเดียว adapter detach/close ต้องไม่ฆ่า user-owned browser, เปิด profile ใหม่เงียบ ๆ หรือปลุก browser ที่ผู้ใช้เพิ่งปิดเมื่อเปิด viewer
- recovery เปลี่ยนวิธีตามเหตุ: stale ก่อน dispatch อ่านใหม่, pending load รอสถานะที่เกี่ยวข้อง, popup ใช้ opener/target, wrong origin ไม่กรอกรหัส, uncertain หลัง dispatch ตรวจปลายทางก่อน ห้ามผ่อน success gate หรือ replay effects เพื่อให้บอตดูทำต่อเก่ง
- คง Stop/no-requeue/idempotency/loop guard และ session persistence ไม่สร้าง scheduler/chat/database ใหม่เพื่อเลี่ยงกลไกเดิม

## 4. ลำดับลงมือและเกณฑ์จบแต่ละช่วง

### ระยะ 0: baseline และ oracle
เก็บ manifest immutable ของ code/runtime/fixtures และผลก่อนแก้แบบประหยัด ตรวจ grader ปัจจุบันกับ real-schema positives และ negatives ใหม่ ต้องไม่ผ่าน URL substring ผิด origin, หลักฐานเก่า/คนละ run/fence, failed effect, artifact bytes เสีย หรือ transcript ที่ไม่มีที่มา ห้ามแก้ expected ย้อนหลังตามผลของ implementation

มี counterexamples ที่ Codex พิสูจน์กับ grader snapshot เดิมแล้วใน `work/after-d-r4-20261014/grader-new-results.json` ของ workspace นี้: 10 negatives ยังถูกนับ PASS ให้เก็บเป็น baseline และตรวจรุ่นใหม่ ไม่ถือว่าแพตช์ lifecycle/deploy ตรง hash แก้ oracle เหล่านี้แล้ว

### ระยะ 1: vertical slice ของตัวขับเว็บ
ทำ adapter ที่ใช้งานได้บน QA computer ที่ได้รับอนุญาตครบ navigate/snapshot/click/fill/select/frame/popup/screenshot/download/close/detach/Stop/takeover แล้วเทียบสองตัวเลือกด้วย fixtures และโมเดลเดียวกัน เลือกหนึ่งตัวเป็นค่าเริ่มต้นจากหลักฐาน เก็บอีกตัวเป็นการทดลองถ้ามีประโยชน์ ไม่ต้อง ship ทั้งสอง

เชื่อม UI → API → executor → provider → supervisor → actual browser → effects → goal gate ครบ ห้าม handoff เป็น library demo แยกที่ Rakazo ไม่เรียก

### ระยะ 2: decision loop ประหยัด
พัฒนาตาม protocol Jev ที่แนบ มี no-match/ambiguous/wait/blocked/need-input จริง ให้ planner จีนกำหนด subgoal และ selector เลือกจากสิ่งที่เห็น ตรวจ fresh refs/policy/fence ก่อน execute และตรวจปลายทางใหม่หลัง action ทุกครั้ง ไม่ใช้ confidence เป็น permission หรือ goal oracle

รองรับ Chinese selector โดยไม่ต้องมี Jev key; adapter Jev ใช้ได้เมื่อผู้ใช้เปิดและมีสิทธิ์/งบ/ข้อมูลที่อนุญาต หากยังไม่มี key ให้จบ adapter/conformance โดยระบุ live Jev NOT_TESTED ไม่ปลอมผลหรือหยุดงานส่วนอื่น

### ระยะ 3: search/read/docs
เพิ่ม SearXNG ผ่าน backend provider เดิม ตรวจ JSON format และ engine errors รักษา Readability เป็นเส้นทางเบา ให้ Reader ตามเรียกสำหรับกรณีที่จำเป็น ไม่เอา reader response มานับว่า interactive navigation สำเร็จ

ทดลองเอกสารด้วย Thai/English/สมการ/ตาราง/หลายหน้า/ช่องกรอกจริงตาม requirement คง interface เดิม ใช้ parser และ render อิสระตรวจครบ input/output พร้อม UI preview/download ห้ามแทน PDF ด้วย TXT หรือสร้าง placeholder bytes และคืน success

### ระยะ 4: integrate และทดสอบตนเอง
รวมตาม owner แบบ sequential ตรวจ package resolution/version/hash ทุก process รันทดสอบที่ระบุด้านล่าง แก้ root cause และสร้าง counterexample เพิ่มเองก่อน handoff ไม่รอ Codex ส่งข้อสอบทีละรอบ

รอบแก้ต้องบันทึก failure เดิมทุกครั้ง รักษา test oracle และขอบเขตงบ ถ้าชน blocker จริงให้รายงานสิ่งที่ทำต่อได้และสิ่งต้องใช้จากผู้ใช้แบบเจาะจง ไม่วน retry ซ้ำและไม่กล่าวว่าเสร็จทุกอย่าง

## 5. Antigravity ต้องทดสอบเองก่อนส่ง Jules

- Build/typecheck และ unit/contract/integration เฉพาะส่วนที่เปลี่ยน รวม safe failure/partial/unknown paths ไม่เขียนแต่เทสต์สะท้อนค่าคงที่ใน implementation
- Driver fixtures: duplicate labels, overlay, SPA rerender/stale ref, iframe, popup, dropdown/autocomplete, delayed load และ no-op; ต้องตรวจ state หลัง action จริง
- Lifecycle/security: consecutive dedicated/team runs, delayed stale command, Stop ระหว่าง pending action, Take Control/resume, viewer reconnect และ close บน computer identity เดียว; negative rejection ต้องไม่มี effect หลุด
- Provider/cost: empty/partial stream, timeout/cancel, retry accounting, unknown usage และ parallel reservation/limit ที่เกี่ยวข้อง ต้องไม่ retry tool effects หรือ fallback ไปโมเดลแพงนอก allowlist
- Documents: valid file ผ่าน independent parser, content completeness, font/shaping/math/page breaks, damaged/truncated bytes และไฟล์ที่ผิด requirement ต้องไม่ผ่าน
- UI smoke ของ A–D ผ่านหน้า Rakazo จริงเมื่อ integration พร้อม: navigation, protected card→submit→resume→auth, close→reconnect, document→preview/download ตรวจทั้ง artifacts และจอจริง ไม่ส่งคำสั่งผ่าน router/API แล้วเรียกว่า UI
- แยก local fixture/staging/native/backend/Oracle UI ให้ชัด ถ้าทดสอบบางส่วนไม่ได้ให้บอกช่องทางและข้อจำกัด ห้ามยกผล unit มาทดแทน acceptance

Antigravity ต้องทำ self-test ส่วนนี้ก่อนส่ง Jules; Jules ตรวจอิสระเพิ่มเติม ไม่ใช่ผู้รับงานที่ยังไม่ build หรือขาด basic smoke

## 6. โมเดล งบ และระบบจริง

ใช้โมเดลจีนที่ผู้ใช้มีและอนุญาตจาก shared settings ไม่เลือกโมเดลท็อปราคาแพงเป็นทางแก้ทั่วไป ไม่ใช้ default model/gateway ของ library โดยไม่ pin/allowlist ตรวจ text/vision/tool capabilities ของรุ่นจริง

นับ planner, selector/Jev, typing, vision, extract, retries และ nested worker ทุกครั้งด้วย ledger ที่ correlate กับ parent run ได้ ค่า unknown ไม่เป็นศูนย์ ตรวจ adapters ที่คืน usage=None และตั้ง retry owner ให้ชัด

เริ่มได้ทันทีสำหรับ source review, coding, offline tests และ UI fixtures ที่ไม่เรียก paid APIs ส่วน paid live suite ต้องมีวงเงิน/จำนวน calls/ขอบเขต batch ล่าสุดที่ยังใช้ได้ รายงานเก่าเคยเกิน 150 calls แล้ว ห้ามใช้เพดานเก่าเป็นวงเงินใหม่ รีเซ็ตยอด ซื้อเครดิต หรือเปลี่ยน key เอง หากขาดงบให้เตรียมทุกอย่างจน READY_FOR_LIVE_QA พร้อมเสนอ batch ที่เล็กและค่าใช้จ่ายประมาณการก่อนขอเฉพาะสิ่งที่ยังจำเป็น

deployment ให้ผู้รวมคนเดียว ใช้สิทธิ์ deploy เดิมเมื่อยังครอบคลุมจริงและเงื่อนไขพร้อม งานเกินสิทธิ์ต้องเตรียม diff/build/rollback ให้ตรวจได้ก่อนถาม ไม่ deploy เพื่อข้าม smoke หรือรักษาเครื่องที่พังด้วย global restart

ข้อห้ามเดิมยังมีผล: ไม่แตะเว็บอื่น/80/443, protected `/rakazo-computer`/`/opt/rakazo-computer`/16080, ไม่ bind chat5173 สาธารณะ, ไม่ล้าง profile/history/routines/user files, ไม่เปิด shell/approval/network ทั้งระบบ และไม่ dump secrets/view tokens

## 7. สิ่งส่งมอบ

เก็บรายงานใหม่แบบ versioned ใน outputs/strategy-implementation-results/ ของ workspace นี้ ไม่เขียนทับหลักฐาน Codex หรือรายงาน Jules:
1. `ARCHITECTURE_EXECUTION.md`: ปัญหา/decision/เหตุผลเลือก components/ขอบเขตที่เปลี่ยนและไม่รับมา
2. implementation diff + lockfiles/pinned versions/notices + baseline/runtime manifest และ rollback procedure ที่รักษาข้อมูลเดิม
3. `ANTIGRAVITY_SELF_TEST_RESULTS.md`: commands, channel/environment, expected/actual, failures/retries, cases ที่ไม่ตรวจ, evidence paths/hashes และค่าใช้จ่าย
4. snapshot/branch/commit ที่รวมไฟล์จำเป็นครบและ setup instructions ให้ Jules พร้อม QA docs/fixtures แบบ portable ไม่อ้าง Windows paths ที่ VM อ่านไม่ได้; เตรียม branch ให้ตรวจได้และส่งขึ้น remote เฉพาะเมื่อมีสิทธิ์จริง ไม่ส่ง .env/private traces หรือข้อมูล production
5. `LIVE_ACCEPTANCE_RESULTS.md` เมื่อมี live evidence จริงเท่านั้น: runId/time/computer/target/fence/model/version/outcome/artifact/download/ledger และ active soak 120 นาทีหลัง smoke ผ่าน

ห้ามสรุป Done ทั้งระบบจาก docs, stub, unit pass, DONE ของ Jev, completed ของ Rakazo หรือ smoke เว็บเดียว ต้องผ่าน requirement A–D และไม่มี blocker สำคัญที่ถูกซ่อน ห้ามอ้างเปอร์เซ็นต์เสถียรภาพ/Zero False Positive ทั่วไปจากชุดตัวอย่าง จำกัดข้อสรุปตาม coverage จริง
