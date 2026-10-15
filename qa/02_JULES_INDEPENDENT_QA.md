# Jules: ตรวจ Rakazo อิสระจากผู้พัฒนาและทดสอบผ่านเว็บจริง

คุณเป็นผู้ตรวจอิสระของสถาปัตยกรรม Rakazo ชุดใหม่ Antigravity เป็นผู้พัฒนา/รวมแพตช์ งานคุณคือหาสิ่งที่ยังพัง ตรวจความจริงของผลสำเร็จ และส่ง reproducer ที่ทำซ้ำได้ ใช้โควตา Jules ช่วยลดภาระผู้ตรวจ แต่ไม่ถือว่าค่า model API ของ Rakazo ฟรี

## 1. เริ่มจากรุ่นที่ถูกต้อง

รับ snapshot/branch/commit และ setup instructions จาก Antigravity ที่ผ่าน build และ basic self-test แล้ว ต้องรวมแพตช์ที่กำลังตรวจครบ GitHub เก่าที่ไม่มีแพตช์ runtime ใช้แทนไม่ได้ ถ้าขาดไฟล์ให้ระบุ SETUP_BLOCKED พร้อมรายการที่ขาด ไม่ตรวจรุ่นเก่าแล้วรับรองรุ่นใหม่

Jules VM ต้องเข้าถึง branch/repository ล่าสุดและ QA docs/fixtures ที่แนบครบ path `C:\Users\User\...` ในเอกสารต้นทางเป็นตำแหน่งฝั่งผู้ใช้ ไม่ใช่ path ที่ VM อ่านได้ หากยังมีแค่ไฟล์ local ให้แจ้งสิ่งที่ต้องนำเข้า ไม่เดาว่า clone GitHub เก่าคือ snapshot นี้

อ่าน AGENTS.md, `01_ANTIGRAVITY_IMPLEMENT.md`, `03_JEV_TEST_PROTOCOL.md`, แผน `RAKAZO_STRATEGY_PLAN.md` และ `ANTIGRAVITY_SELF_TEST_RESULTS.md` ที่แนบมา บันทึก commit, dirty patch hash ถ้ามี, lockfile, OS/architecture, runtime/tool versions, image digests, enabled flags และ models ที่เกี่ยวข้องใน manifest หนึ่งชุด

ใช้ clean VM/staging และข้อมูลสังเคราะห์ ไม่อ่าน credentials จริงจาก chat/.env/private traces ไม่เปิด production สาธารณะหรือขอ full tailnet credentials เพื่อให้ทดสอบสะดวก Oracle ผ่าน Tailscale ไม่ได้เข้าถึงได้อัตโนมัติ หากมีสิทธิ์เข้าถึงจริงให้ใช้เฉพาะขอบเขตที่ระบุ

setup script ต้อง install/prepare แล้วจบ ไม่ใส่ dev server/watch process ค้างใน setup สามารถให้ test job เริ่ม server ของตนเองแบบมี readiness/deadline และ cleanup process ที่ตนเริ่มได้ ตรวจข้อจำกัด environment จริงก่อน ไม่กล่าวว่ารัน UI ได้เพียงเพราะมี Playwright ติดตั้ง

ค่าเริ่มต้นให้เพิ่ม tests/harness และรายงานบั๊ก ไม่แก้ product code หรือเปลี่ยน expected ให้เป็นเขียวเอง หากผู้ใช้มอบหมายให้แก้ด้วยภายหลัง ให้แยก product patch กับ independent tests และเก็บผลก่อนแก้ไว้ ไม่แก้ไฟล์หลักที่ Antigravity กำลังเขียน

## 2. ลำดับที่ต้องทำ

1. รัน build/typecheck และชุด regression/contract เดิมที่เกี่ยวข้องจาก snapshot นี้ เก็บ failures ทั้งหมดก่อน rerun
2. ตรวจ oracle ด้วย positives จาก schema จริงและ negatives ใหม่ของคุณ ก่อนเชื่อคะแนนของ suite ห้ามนำ boolean ที่ implementation ประกาศมาเป็นข้อพิสูจน์เพียงอย่างเดียว
3. สร้าง held-out cases ของตนจากข้อกำหนดด้านล่าง ไม่คัดลอกแต่ตัวอย่างที่ผู้พัฒนาเห็นแล้ว ใช้ fixture ที่เปลี่ยนภาษา/ลำดับ/DOM/เวลา/target ได้โดยยังมีคำตอบที่ตรวจได้
4. รัน UI staging ของ Rakazo จาก snapshot เดียวกันเมื่อพร้อม ส่งคำสั่งผ่าน composer/card/viewer/artifact UI จริง API ใช้เตรียม fixture หรืออ่านหลักฐานประกอบได้ แต่ API dispatch ไม่ใช่ UI acceptance
5. ถ้ามีสิทธิ์และงบ live ปัจจุบัน จึงรันชุด live ที่แก้ความไม่แน่นอน ส่วน Jev ใช้ protocol แยก ไม่มี key/งบให้จบ offline conformance และบันทึก Jev live NOT_TESTED

ผู้ทดสอบต้องมี oracle ที่รู้คำตอบนอกโมเดล เช่น fixture server state, fresh browser/window inventory, DOM บน origin/frame ที่ถูก, independent file parser และภาพ render อย่าใช้คำว่า DONE, run completed, tool applied หรือข้อความตอบของ Rakazo เป็นตัวให้ PASS

## 3. ชุดตรวจที่ต้องครอบคลุม

### Q1 — การนำทางและเลือกเป้าหมาย
- ปุ่มชื่อซ้ำ คนละฟอร์ม/แท็บ/frame, ปุ่มถูกบัง/disabled, language overlay, dropdown/autocomplete, SPA rerender และ stale ref
- popup/new tab ต้องใช้ opener/target ถูก; iframe และ target ที่อยู่นอก snapshot ต้องขยาย scope ไม่เดาคลิก
- delayed load, no-op click และ false DONE ต้องตรวจจาก state ใหม่ ไม่เพิ่ม retries วนจนหมดงบ
- มี held-out site/fixture ที่ไม่อยู่ใน self-test และคำสั่งภาษาไทยสั้นตามผู้ใช้ ไม่ให้ URL ปลายทาง/selector/ขั้นตอนทุกก้าวจนช่วยบอตเกินจริง

### Q2 — ช่องกรอกข้อมูลลับและ session
- แยกคำสั่ง “เปิดหน้าล็อกอินรอผมกรอก” กับ “กรอก/ล็อกอินให้” ตามสิทธิ์ที่ให้จริง
- protected card ต้องแสดงใน UI → ผู้ทดสอบใส่ synthetic credentials → submit → run เดิม resume → กรอก origin/field ที่ถูก → authenticated indicator ที่ server ตรวจได้ → follow-up ใช้ session ต่อได้
- wrong origin, `legit.example.evil`, URL ที่เอา legit hostname ไปไว้ใน path, frame ผิด และ stale card ต้องไม่กรอกรหัส/ไม่หลุดไป chat/model/log/command line
- ใช้ canary ที่สร้างเฉพาะ test ตรวจการรั่วใน payload/log/artifacts โดยไม่พิมพ์ค่าจริงลงรายงาน ไม่ส่งค่าลับให้ Jev/text helper เพื่อพิมพ์

### Q3 — ปิด browser และสิทธิ์ควบคุมจอ
- ปิดบน computer/profile/target ที่ระบุ ตรวจ native browser targets และ window inventory สดที่เชื่อถือได้ ไม่ใช้ภาพว่าง/รายการที่อ่านไม่สำเร็จแทน closed
- reconnect/reopen viewer แล้ว browser เดิมต้องไม่ฟื้นเอง และ detach/shutdown ต้องไม่ฆ่า browser อื่นของผู้ใช้
- ทดสอบ dedicated/team และ consecutive runs ตามที่ environment รองรับ ถ้าไม่มี team/Oracle ให้ระบุส่วนนี้ NOT_TESTED ไม่ใช้ dedicated VM แทนจอจริง
- Stop/Take Control ระหว่าง pending action, delayed stale command, stale fence และ approval resume ต้องไม่มี mutation จาก worker ที่หมดสิทธิ์ รวม callback ภายใน library

### Q4 — เอกสารและไฟล์ที่ผู้ใช้ดาวน์โหลด
- สั่งสร้างผ่าน Rakazo UI แล้วเปิด preview/download จาก UI ตรวจ bytes ของไฟล์ที่ดาวน์โหลดจริงด้วย parser อิสระ ไม่ตรวจไฟล์คนละชิ้นหรือเชื่อ extension/size/hash อย่างเดียว
- Thai/English, วรรณยุกต์/สระ, Unicode copy/paste, fonts ที่ฝังและ shaping, สมการเศษส่วน/ราก/ตัวห้อย, ตาราง, long lines, หลายหน้า และเนื้อหาต้น/กลาง/ท้ายต้องครบ
- render ตรวจทุกหน้าของชุดรับรองที่มีขนาดจำกัด ระบุหน้าที่ตรวจด้วยตา หากยังมีแต่ automated checks ให้บอก ไม่อ้างว่า visual QA ครบโดยไม่ได้เห็นภาพ
- หากประกาศ interactive form ให้ตรวจ fields/value round-trip; ถ้าเป็นแบบฟอร์มพิมพ์กระดาษให้ตรวจตาม requirement นั้น ไม่ถือว่าทุก PDF ต้องเป็น interactive
- negative files: truncated/damaged bytes, missing sections, wrong artifact association, missing font/render dependency และ placeholder output ต้องไม่รับรองเป็นไฟล์สำเร็จ

### Q5 — Search/provider/cost และการฟื้นตัว
- Search JSON: zero results, engine failures, timeout, malformed response ต้องแยกได้ Reader ที่อ่านหน้าได้ไม่พิสูจน์ว่าทำ interactive navigation สำเร็จ
- SSRF/redirect/private endpoint ให้ทดสอบด้วย controlled fixture ไม่ยิงบริการภายในจริงที่ไม่อยู่ใน scope ไม่เปิด private endpoint ทั้งระบบเพื่อให้ผ่าน
- empty/partial stream, first-token/stream-idle timeout, cancel, uncertain effect และ reconnect ต้องรักษาสิทธิ์และไม่ทำ side effects ซ้ำ
- ใช้โมเดลจีนจาก allowlist ที่ผู้ใช้อนุญาต รวม selector/vision/text helper/worker ห้าม fallback แพงเงียบ ๆ ค่า usage หาย/malformed ต้อง unknown พร้อม reservation หรือ block ตาม policy ไม่เป็นศูนย์
- ทุก API attempt รวม internal retries ต้อง correlate กับ parent run ได้ ตรวจ nested retries/parallel reservations ไม่ขยายจำนวน calls หรือข้าม budget เมื่อ gateway/worker ขัดข้อง; ไม่เพิ่มเพดานเพื่อให้ suite จบ

## 4. ตรวจ grader ด้วยการหักล้าง

ใช้ทั้ง runtime-schema positive ที่ผ่านจริง และ mutation ใหม่อย่างน้อยหนึ่งตัวต่อ boundary ที่เปลี่ยน รวม wrong run/computer/target/origin/fence, old/future evidence, failed read ที่คืน empty inventory, evidence ขัดแย้ง และ artifact ที่เปิดไม่ได้ ตรวจว่าตัวที่ควรผ่านยังผ่านด้วย ไม่ทำ grader ที่ reject ทุกอย่าง

แยกผลต่อ case เป็น:
- Goal: เป้าหมายผู้ใช้สำเร็จ/ไม่สำเร็จ/ไม่ทราบ
- Gate: การรับรองหรือปฏิเสธของระบบตรงหลักฐานหรือไม่
- Claim truth: ข้อความ progress/final ตรงสิ่งที่เกิดหรือไม่
- Harness: setup/oracle/assertions ใช้ได้หรือไม่

Negative ที่ระบบปฏิเสธถูกอาจเป็น test PASS แต่ Goal ไม่ได้สำเร็จ ห้ามรวมเป็น navigation success หาก harness พังหรือหลักฐานขาดให้ INCONCLUSIVE/NOT_TESTED ไม่ผ่านโดยปริยาย “zero false positive” รายงานได้เฉพาะชุด/รุ่น/ช่วงที่ทดสอบ ไม่รับประกันทั่วไป

## 5. Live UI และ active soak

ก่อน paid calls อ่าน ledger ปัจจุบันและขอบเขต batch ที่ยังใช้ได้ เพดาน QA 150 calls เก่าเคยถูกใช้เกินแล้ว ไม่ถือว่าเริ่มแชท/วันใหม่ได้เพิ่ม หากยังไม่มีสิทธิ์ที่ครอบคลุม ให้ทำส่วน offline/UI fixtures ที่ไม่เรียก paid API ให้ครบและส่ง READY_FOR_LIVE_QA พร้อม batch/calls/ค่าใช้จ่ายประมาณการที่เล็กที่สุด

เมื่อมีสิทธิ์ ให้มีผู้รัน paid live suite หนึ่งรายในเวลาเดียวกัน ไม่แย่ง computer/profile กับ Antigravity/Codex ตรวจ A–D ผ่าน UI smoke ก่อน หากมี critical failure ให้เก็บหลักฐานและส่งแก้ก่อน soak

active soak 120 นาทีต้องมีงานจริงต่อเนื่องตามช่วงเวลาและวงเงินที่อนุญาต: navigation, follow-up, protected input, Stop/Take Control, reconnect, close, create/preview/download files รวมช่วงพักตามผู้ใช้ ไม่นับ sleep/เปิดทิ้งไว้/list_files ซ้ำเป็นหลักฐานเสถียร ถ้า environment จบก่อนให้รายงานเวลาที่รันจริงและเหตุ ไม่อ้างว่าเทียบเท่า 2 ชั่วโมง

ผล Jules VM/staging ไม่แทน Oracle screen/profile/lease และการตรวจจากจอผู้ใช้ ต้องระบุ acceptance บน runtime จริงที่ยังเหลือให้ Codex/ผู้ใช้ตรวจ บอกความต่างของ build/environment ชัดเจน ยังไม่มีหลักฐานว่า Jules ให้คุณภาพเท่ากับผู้ตรวจอื่นในงานนี้

## 6. สิ่งส่งมอบ

เก็บ versioned folder ของ Jules แยกจาก baseline/หลักฐาน Antigravity/Codex:
1. `JULES_QA_RESULTS.md`: manifest, commands, coverage, expected/actual, failures ครั้งแรกและหลังแก้, ข้อจำกัดและข้อค้าง
2. `case-results.json`: case ID, channel/environment, Goal/Gate/Claim/Harness, model/version, run/time/computer/target/fence ตามที่เกี่ยวข้อง, attempts, cost/unknown usage และ evidence paths/hashes
3. `failures/`: minimal reproducer, sanitized screenshots/traces, artifact samples ที่ไม่เป็นความลับ, test patches และคำสั่งทำซ้ำ
4. `FIX_REQUESTS_FOR_ANTIGRAVITY.md`: bug ตามผลกระทบพร้อม boundary/ตำแหน่งที่เกี่ยวข้อง สิ่งพิสูจน์กับสมมติฐานแยกกัน ไม่เขียนว่าแก้แล้วถ้ายังไม่ได้ทดสอบรุ่นแก้
5. ผล Jev ตาม protocol แยก selector ภายในจาก UI actor ภายนอก พร้อมรายการที่ไม่ได้รัน

ไม่ส่งข้อความ/สร้าง task/เผยแพร่ข้อมูลไปบริการอื่นอัตโนมัติ ส่งไฟล์และสรุปให้ผู้ใช้ส่งต่อ ไม่ซ่อน failures/retries ไม่ล้าง profile/history หรือแก้ success gate เพื่อให้เขียว
