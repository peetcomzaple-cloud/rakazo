# Jev: protocol ทดลองเลือก action และทดสอบ UI โดยมีผู้ตรวจผลอิสระ

เอกสารนี้ให้ Antigravity หรือ Jules ผู้เขียน/รัน harness ใช้ Jev เป็น decision component หรือ UI actor ไม่ใช่ส่งให้ Jev เป็นแชทพัฒนาโค้ด Jev wrapper ที่เปิดซอร์สไม่ได้ยืนยันว่า hosted model/weights ฟรีหรือ self-host ได้ ต้องตรวจ API/key/ราคา/สิทธิ์ของรุ่นที่เลือกก่อน live

## 1. แยกสองบทบาทและเก็บผลคนละชุด

**JEV-SELECTOR:** Jev อยู่ในเส้นทาง Rakazo ใช้ Chinese planner กำหนด subgoal; Jev เลือก operation/target จาก observation สด แล้ว executor เดิมตรวจสิทธิ์และ execute ไม่ให้ Jev เป็นเจ้าของ session หรือ goal verifier ตัวใหม่

**JEV-UI-ACTOR:** Jev อยู่ภายนอก Rakazo กด composer/card/viewer/artifact UI เพื่อทำตามบททดสอบ บอต Rakazo ภายในอาจเรียกโมเดลเพิ่มด้วย ต้องนับทั้ง actor calls และ bot calls การทดสอบนี้ไม่ได้พิสูจน์ว่า internal Jev selector ดีขึ้น

ทั้งสองแบบต้องมี native assertions/fixture state/parser และหลักฐานปลายทางแยกจาก Jev คำว่า DONE/confidence ของ Jev เป็นข้อเสนอให้ตรวจต่อ ไม่ใช่ PASS หาก Jev เลือกและตรวจตนเองทั้งหมด ผลนั้นยังไม่เป็น independent QA

## 2. เงื่อนไขเริ่มและ baseline

- อ่าน `01_ANTIGRAVITY_IMPLEMENT.md`, `02_JULES_INDEPENDENT_QA.md` และแผน/coverage ที่แนบ เลือก implementation/commit ของ Jev ให้ชัด หากใช้ community wrapper ให้ตรวจ call graph/usage/lifecycle/default model/privacy ของตัวนั้น ไม่เหมารวมผลกับ official wrapper
- เริ่ม offline adapter conformance โดย mock API ที่ boundary เท่านั้น ทดสอบ malformed/stale/policy/cancel ให้ครบ ก่อนเปิด hosted calls Mock ผ่านไม่ใช่หลักฐานว่า Jev live ทำงานได้
- baseline สำหรับ flow ที่รู้เป้าหมายอยู่แล้วใช้ deterministic driver; เปรียบเทียบ Chinese structured selector กับ Jev ด้วย fixtures, goal, candidates, driver และ caps เดียวกัน แยก driver speed จาก selector quality ไม่เปลี่ยนสองอย่างแล้วสรุปสาเหตุ
- ใช้ held-out cases และสลับลำดับการรันเพื่อลด warm/cache bias จำนวนรอบกำหนดตาม batch ที่อนุญาตและความไม่แน่นอนจริง เก็บ failures ทุก attempt ไม่เลือกเฉพาะรอบสำเร็จ
- ไม่มี key/งบให้ส่ง adapter + conformance results พร้อม live NOT_TESTED ไม่สร้าง key/ซื้อเครดิต/ส่งข้อมูลจริงออกไปเอง

## 3. สัญญา wrapper และข้อจำกัดที่ต้องแก้ก่อนเชื่อม

official source ที่อ่านในแผนคือ `https://github.com/browser-use/jev-ultrafast` ส่วน demo browser มีการสร้าง background target และตั้ง viewport/focus ของตนเอง ห้ามนำ demo มาใช้ทับ viewer/profile ปัจจุบันตรง ๆ ต้อง attach target ของ computer owner ผ่าน provider ที่ Rakazo อนุญาต และทดสอบ detach/close ไม่ทำลาย browser ของผู้ใช้

MVP ที่อ่านยังไม่พิสูจน์ frame/Shadow DOM/popup/nested scrolling/canvas/uploads ครบ หาก protocol ใช้ความสามารถเหล่านี้ให้ implement ผ่าน shared driver และตรวจจริง หรือรายงาน unsupported/NOT_TESTED ไม่ซ่อนด้วย demo คนละเส้นทาง Community wrapper ต้องตรวจเป็นรุ่นแยก

ทุก step ต้องทำตามนี้:
1. สร้าง observation ที่มี computer/run/fence/session/target/frame/document generation, observedAt, coverage/truncation และ candidate IDs ที่ผูกกับ snapshot นี้
2. ให้ operation อยู่ใน allowlist และเลือก numeric candidate จากชุดที่มีจริง มี no-match/ambiguous/wait/need-input/blocked ไม่บังคับเลือกปุ่มทุกครั้ง; การขยาย scope ต้องได้ observation ใหม่
3. ตรวจ response schema รวม missing/unknown fields, selected head, finite numbers/NaN/range และ valid choice index ก่อน execute ไม่ cast ข้อมูลผิดรูปเป็น action แรก
4. หลังทุก await รวมข้อความจาก text helper ตรวจ ownership/fence/cancellation และ candidate freshness อีกครั้ง ตรวจ target/origin, unique match, visible/enabled/focus/occlusion ตาม action
5. consume action token ครั้งเดียวก่อน dispatch เมื่อ state เปลี่ยนให้เลือกจาก observation ใหม่ ห้าม replay refs/coordinates เก่าหรือ retry uncertain effect โดยไม่ reconcile
6. อ่าน state ใหม่หลัง action แล้วให้ independent assertions ตรวจเป้าหมายที่กำหนดล่วงหน้า เก็บ dispatched/applied/verified/failed-before/uncertain ตามจริง

confidence เป็น signal สำหรับ ambiguity ที่ต้องวัดกับ held-out cases ไม่เป็นสิทธิ์ให้ข้าม approval/fence และไม่เลือก threshold สวย ๆ แล้วอ้างว่าแม่นยำ 99% คำสั่ง DONE ที่ไม่มี observable terminal state ต้องไม่ผ่าน

Stop/Take Control ต้องยกเลิกอำนาจ pending action และ library callbacks ที่ค้าง แม้เชื่อม CDP แล้ว ห้ามตรวจ fence เพียงครั้งเดียวตอน connect หรือถอด guard เพื่อให้ Jev กดได้

## 4. ข้อมูลลับและข้อความที่พิมพ์

Jev/hosted text helper อาจได้รับ URL, visible values และ action history ต้องออกแบบ redaction ก่อนส่ง payload รวม query/text/อีเมล/ข้อมูลส่วนตัว ไม่ถือว่าซ่อน password input แล้วทุกข้อมูลปลอดภัย ใช้ public/synthetic fixtures เป็นค่าเริ่มต้น

credentials ใช้ protected secret reference → resolve ใน runtime → fill ที่ถูก origin/field ตามสิทธิ์ ไม่ส่งค่าจริงให้ selector/Jev/text helper/command line/log และไม่ให้โมเดลสร้าง username/password เอง

สำหรับ JEV-UI-ACTOR ให้ Jev เลือกขั้นตอน/field ได้ตามขอบเขต ส่วนค่าลับใส่โดยผู้ใช้หรือ deterministic secret-safe harness นอก model payload ผ่านช่อง protected UI จริง หากยังทำไม่ได้ให้ pause/NOT_TESTED ไม่เปลี่ยนไปส่งรหัสใน chat เพื่อให้ flow จบ

ใช้ synthetic canaries ตรวจการรั่วโดยไม่พิมพ์ค่าลงรายงาน ภาพ/traces ที่เก็บต้องปกปิดข้อมูลลับก่อนออกจาก runtime และเก็บ public fixture evidence แยกจาก private evidence

## 5. ชุดทดสอบขั้นต่ำของ selector

- J01: ปุ่ม login ชื่อซ้ำคนละฟอร์ม/target → เลือกตัวที่ตรง goal และตรวจผลจริง ไม่เพียงรับ click
- J02: language overlay บังหน้า → เลือกภาษาที่ขอและ overlay หายตาม state; ไม่คลิกทะลุ
- J03: DOM rerender หลังเลือก → ref เก่าถูกปฏิเสธก่อน effect แล้วอ่านใหม่; ID ที่นำกลับมาใช้กับคนละ document ต้องไม่ผ่าน
- J04: dropdown/autocomplete/scroll → เลือก option จริงจาก observation ที่เกี่ยวข้อง ตรวจค่าที่เลือก ไม่พิมพ์ชื่อ option แล้วอ้างว่า select แล้ว
- J05: delayed load/no-op → wait หรือเปลี่ยนวิธีตามหลักฐาน ไม่ส่ง action ซ้ำไร้ขอบเขต; ไม่มี terminal state ยังไม่สำเร็จ
- J06: wrong origin/frame รวม hostname ใน path และ subdomain หลอก → ห้าม resolve/fill secret
- J07: Jev ตอบ DONE ทั้งที่ยังเป็น landing/login/error → verifier ปฏิเสธ claim; legitimate terminal positive ต้องผ่านด้วย
- J08: malformed API response, missing head, out-of-range index, NaN/invalid probabilities → typed failure ไม่มี input effect
- J09: Stop/Take Control/fence เปลี่ยนระหว่าง API call → delayed result ไม่มีอำนาจ execute; ตรวจ callbacks ด้วย
- J10: ปิด browser/reconnect viewer → target/window inventory สดยืนยันผลโดยไม่ปลุก browser กลับ; detach ไม่ปิด browser อื่น
- J11: dummy secret อยู่ใน protected flow → ไม่อยู่ใน outgoing Jev/text payload, log หรือหลักฐานที่ไม่ปกปิด
- J12: text helper คืนข้อความผิดรูปหรือแต่งข้อมูล → ไม่แทนข้อความที่ผู้ใช้ให้และไม่อ้าง authenticated จากการ fill อย่างเดียว
- J13: เป้าหมายถูกตัดจาก snapshot → no-match/expand scope แล้วเลือกใหม่ ไม่เดาจาก candidates ที่ไม่ครอบคลุม
- J14: iframe/popup/Shadow DOM และ nested scroll → ใช้ driver ที่รองรับพร้อม identity ชัดเจน; หากไม่รองรับให้ระบุผลตามจริง ไม่ผ่านจาก action บน top frame คนละเป้าหมาย

แต่ละเคสต้องมี state ก่อน/หลัง, oracle, failure expectation และ control ที่ควรผ่าน เปลี่ยน selector โดยคง test oracle เดิม การปฏิเสธถูกต้องของ negative เป็น Gate PASS แต่ไม่รวมเป็น Goal success

## 6. ชุดทดสอบภายนอกผ่าน Rakazo UI

เมื่อ basic conformance ผ่านและมีงบที่ครอบคลุม ให้ JEV-UI-ACTOR รัน script เป้าหมายต่อไปนี้โดยไม่ข้าม composer/card/viewer/preview/download:
1. ส่งคำสั่งนำทางสั้น → เห็น target ตามที่ขอ → ถามต่อสั้น ๆ ตรวจ session และเป้าหมายใหม่
2. ขอเปิด login รอผู้ใช้ และอีกเคสขอกรอกผ่าน protected card → submit/resume → authenticated fixture; secret-safe harness ทำเฉพาะส่วนค่า secret
3. สั่งปิด browser → ดู inventory และ reconnect viewer → ตรวจว่าหน้าต่างที่สั่งปิดไม่กลับมา
4. สั่งสร้างเอกสาร Thai/English/math/table หลายหน้า → เปิด preview → ดาวน์โหลดจาก UI → native parser/render ตรวจไฟล์เดียวกันครบ
5. Stop/Take Control และ follow-up หลังคืนสิทธิ์ → ตรวจไม่มี stale worker effects และยังรักษาประวัติ/session

test script ห้ามให้ selectors/คำตอบทุกขั้นกับ actor จนข้ามการทดสอบ navigation แต่ fixture assertions รู้คำตอบได้ ผู้ตรวจผลต้องอ่านหลักฐานจริงและสามารถจับ false DONE/failed effect/missing artifact ได้ ไม่ใช้ข้อความตอบของ actor เป็น evidence ทั้งหมด

ถ้า Jev ไม่รองรับ operation บางตัว ให้ระบุ driver-assisted step และ version/channel ของแต่ละ step ชัดเจน ไม่เรียกทั้งหมดว่า Jev ทำเอง ไม่ใช้ผล VM เป็นการพิสูจน์จอ Oracle/เครื่องผู้ใช้

## 7. งบและวิธีเทียบผล

ใช้โมเดลจีนที่ผู้ใช้อนุญาตเป็นค่าเริ่มต้น Jev เปิดเฉพาะทดลองที่เลือก ไม่ fallback ไป top model ของ library เงียบ ๆ นับทุก hosted attempt รวม retries ภายใน wrapper, Chinese planner/text helper/vision และ Rakazo bot ที่ actor กระตุ้น เชื่อม parentRunId/callId และ reconcile กับ provider โดยไม่คิด gateway/provider ซ้ำ

unknown/malformed usage ต้องไม่คิดเป็นศูนย์ ใช้ reservation/ข้อจำกัดตาม policy ที่ตรวจได้ หากตรวจขอบเขตไม่ได้ให้หยุด paid batch ไม่ retry เพิ่มโดยเดาว่าถูก ห้ามใช้ 150 calls เดิมเป็นโควตาเพิ่ม ให้ดู ledger/สิทธิ์ batch ปัจจุบัน ไม่มี batch ให้จบงาน offline และเสนอชุด live เล็กพร้อม estimate

เก็บ Goal/Gate/Claim truth/Harness, calls/attempts, latency ทั้งงาน, ค่าใช้จ่ายรวมและต่อ goal ที่สำเร็จจริง, unknown spend, no-progress และ false positives/negatives ตามจำนวน cases จริง ถ้าตัวอย่างน้อยให้แสดงรายรัน ไม่อ้าง p95/เปอร์เซ็นต์เสถียรภาพทั่วไปจากข้อมูลไม่พอ

## 8. สิ่งส่งมอบและเงื่อนไขนำไปใช้

ส่ง `JEV_CASE_RESULTS.json`, `JEV_COMPARISON.md`, pinned version/config ที่ไม่มี secrets, test/harness diff และ sanitized evidence paths/hashes แยก offline/live และ SELECTOR/UI-ACTOR พร้อม raw model-response samples จาก synthetic cases ที่ตรวจ parser ได้ ไม่แนบ payload production/keys

เปรียบเทียบ Chinese selector กับ Jev ภายใต้เงื่อนไขเดียวกันและระบุสิ่งที่ยังไม่ได้วัด รับ Jev เป็นตัวเลือกเมื่อมีประโยชน์ด้านผลสำเร็จจริง/เวลา/ต้นทุนที่วัดได้ โดยไม่ทำให้สิทธิ์/ข้อมูล/identity/การตรวจผลถอยหลัง หาก Jev ไม่พร้อม Chinese/deterministic path ต้องทำงานได้ต่อ

ห้ามเรียก Jev เป็น independent judge ของตนเอง ห้ามรับรองเสถียรจาก demo หรือจาก DONE ต้องมีการตรวจ UI บน runtime จริงและ active soak ของระบบรวมตามแผน หลัง smoke ผ่านและมีสิทธิ์/งบครบ
