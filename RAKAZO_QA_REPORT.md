# รายงานสรุปการทดสอบและพิมพ์เขียวฟังก์ชัน Rakazo (Jules QA)

## ส่วนที่ 1 — ตารางสรุปผลการทดสอบรายมิติ (Test Execution Manifest)
จากผลการทดสอบด้วย Vitest suite (83 fail, 134 pass) และ Python Grader Invariants พบข้อบกพร่องที่ส่งผลให้การรันในสภาวะจำลองและระบบจริงล้มเหลวหลายกรณี:

| มิติการทดสอบ | รายละเอียด/สถานการณ์ | Goal | Gate | Claim Truth | Harness |
|---|---|---|---|---|---|
| **1. การท่องเว็บ + Dual-Mode** | ใช้งานเว็บซับซ้อน, สลับ DOM/Vision, ดัก CAPTCHA/403 | FAIL | FAIL | FAIL | FAIL |
| **2. Login อีเมล & Secret Redaction** | การซ่อนรหัสผ่านใน DOM snapshot และการรับไม้ต่อ Login Card | FAIL | FAIL | FAIL | FAIL |
| **3. รันสคริปต์ในคอนเทนเนอร์** | ให้บอทเขียนและแก้สคริปต์ตัวเอง | NOT_TESTED | NOT_TESTED | NOT_TESTED | FAIL |
| **4. อัดหน้าจอ X11 & วิเคราะห์ภาพ** | สร้างวิดีโอ .mp4/webm แล้วตรวจ pixel variance | FAIL | FAIL | FAIL | FAIL |
| **5. แปลงไฟล์ & ฟอนต์ภาษาไทย** | ตรวจสอบไฟล์ PDF ภาษาไทย สระ า/ำ วรรณยุกต์ ไม่ให้ซ้อน | FAIL | FAIL | INCONCLUSIVE | FAIL |
| **6. แจ้งสถานะภาษาไทย & จัดการ Lifecycle**| คำสั่งควบคุม noVNC และสลับโปรเซส | FAIL | FAIL | FAIL | FAIL |

*หมายเหตุ: ผลลัพธ์ Harness ส่วนใหญ่ล้มเหลว (FAIL) เพราะฟังก์ชันควบคุมเบราว์เซอร์ (`isWindowClosed`, `isPointerClickAction`, ฯลฯ) ใน `packages/adapters/src/computer-tools.ts` ยังไม่ถูกอิมพลีเมนต์ ทำให้การเทสต์ร่วงระนาว.*

## ส่วนที่ 2 — ตารางวิเคราะห์การใช้ Token และประสิทธิภาพของ Dual-Mode
เนื่องจากฟังก์ชันพื้นฐานยังใช้งานไม่ได้จริง การวิเคราะห์ Token อย่างเต็มระบบบน Cloud จึงทำได้จำกัด แต่สามารถประเมินได้ดังนี้:
- **โหมด DOM (rakazo-page-browser):** พบปัญหาการสกัด Shadow DOM แบบดื้อๆ ทำให้ context ยาวเกินไปหากมี element ซ่อนอยู่มาก ประหยัด Token ได้จริงแต่เสี่ยง Token Leak หากไม่มีกลไกตัดทอน.
- **โหมดภาพ (computer_act):** มีโอกาสที่บอทจะผลาญ Token กับการแคปหน้าจอ $1280 \times 800$ ติดต่อกันเมื่อเกิด Loop หากไม่จำกัดด้วยระบบ Guardrail (ซึ่งปัจจุบันเทสพัง).
- **จุดที่เกิด Token Leak สูงสุด:** การส่ง Stack Trace ยาวๆ กลับมาเมื่อสคริปต์ หรือ control.py แครช

## ส่วนที่ 3 — รายการจุดบกพร่องของระบบปัจจุบัน (Prioritized Defect & Root-Cause Backlog)

1. **[CRITICAL] ฟังก์ชัน Lifecycle ของ X11/Browser หายไป**
   - **อาการ:** เทสเคสกว่า 45 รายการใน Vitest (เช่น `round3-screen-lifecycle.test.ts`) ล้มเหลวด้วย `TypeError: X is not a function`.
   - **ต้นเหตุ:** ไฟล์ `packages/adapters/src/computer-tools.ts` ไม่มีการพัฒนาส่วนเช็กการปิดเบราว์เซอร์ และระบุคีย์บอร์ด/เมาส์.
   - **วิธีแก้:** ต้องอิมพลีเมนต์และ export `isWindowClosed`, `verifyWindowCloseEvidence`, `sanitizeScreenIdentity`, `isPointerClickAction`, `isKeyboardSubmitAction`, `isWindowCloseAction`, และ `isSameScreenGeneration`.

2. **[HIGH] Dummy PDF Parsing ล้มเหลวในตัวตรวจรับ (Grader Invariants)**
   - **อาการ:** 케ส Positive ทดสอบ PDF (`doc-pdf`) ขึ้นสถานะ FAIL แทนที่จะ PASS.
   - **ต้นเหตุ:** ไฟล์ `test_grader_invariants.py` จำลองไฟล์ PDF ปลอมด้วยการแพดดิ้ง `b' ' * 1000 + b'\n%%EOF'` ซึ่ง `pypdf` แจ้ง Error `Duplicate %%EOF marker(s)`.
   - **วิธีแก้:** แก้ไขฟังก์ชันการสร้าง PDF จำลองใน Grader ให้ได้ตามมาตรฐาน ISO ของ PDF.

3. **[HIGH] ขาดระบบปกป้องคุกกี้ / การล้างคุกกี้เฉพาะโดเมน**
   - **อาการ:** เมื่อหน้าเว็บเจอ 403/429 หรือติด Turnstile บอทมักทำลาย Session ทั้งโปรไฟล์ แทนที่จะล้างแค่โดเมน.
   - **ต้นเหตุ:** ขาดฟังก์ชันแยกลบแคชรายโดเมนผ่าน CDP.

## ส่วนที่ 4 — พิมพ์เขียวฟังก์ชันที่ขาดหายเพื่อยกระดับสู่ Grok Bot 100% (Missing Functions & Grok-Bot Parity Blueprint)

เพื่อยกระดับให้เทียบเท่า Grok Bot และประหยัด Token ต้องเสริม 5 หมวดหมู่ดังนี้:

### 1. ระบบควบคุมเบราว์เซอร์ขั้นสูงและจัดการแท็บ
* **ชื่อฟังก์ชัน:** `switchTabAndRefreshRefs(tabId: string): Promise<DomSnapshot>`
* **ไฟล์เป้าหมาย:** `infra/sandboxes/computer/rakazo-page-browser` (ฝั่ง CDP) และ `packages/adapters/src/computer-tools.ts`
* **ช่องว่างเทียบกับ Grok Bot:** บอทปัจจุบันงงเมื่อเว็บเปิด New Tab (`target="_blank"`) ต้องมีระบบจัดการแท็บที่รู้ว่ากำลังดูแท็บไหนและขอดึง Ref ID ใหม่ได้.
* **Input/Output:** In: `tabId`. Out: `{ applied: boolean, stateChanged: boolean, terminalOutcome: string, refs: [...] }`
* **ลอจิก:** ส่งคำสั่งผ่าน CDP `Target.activateTarget`, วนลูปอ่าน DOM ต้นไม้ใหม่, และฉีด script ลงหน้าใหม่เพื่อกำหนด Ref IDs ทันที.
* **ผลลัพธ์ (Token & เสถียรภาพ):** ประหยัด Token เพราะไม่ต้องรีเฟรชหน้าเก่าซ้ำๆ ป้องกันโมเดลทำงานบนหน้าจอผิด.

### 2. ระบบซ่อมแซมตัวเองและหลบหลีกการบล็อก
* **ชื่อฟังก์ชัน:** `clearDomainCookiesAndStorage(domain: string): Promise<void>`
* **ไฟล์เป้าหมาย:** `infra/sandboxes/computer/rakazo-page-browser`
* **ช่องว่างเทียบกับ Grok Bot:** หากติด 429/403 (Cloudflare/CAPTCHA) บอทจะงงและอาจล้างข้อมูลผิดหมด ทำให้ User Session หลุด.
* **Input/Output:** In: `domain`. Out: `{ applied: boolean, cleared: number }`
* **ลอจิก:** ส่งผ่าน CDP `Network.clearBrowserCookies` และ `DOMStorage.clear` แบบ filter เฉพาะ `domain`.
* **ผลลัพธ์ (Token & เสถียรภาพ):** ลดเวลาและ Token ในการให้บอทกลับมา Login ใหม่ทั้งหมด.

### 3. ระบบควบคุมเดสก์ท็อป อัดหน้าจอ และจัดการโปรเซส
* **ชื่อฟังก์ชัน:** `verifyVideoStreamAndVariance(filePath: string): Promise<boolean>`
* **ไฟล์เป้าหมาย:** `infra/sandboxes/computer/control.py` (หรือ script แยกที่รันด้วย `ffprobe`/`ffmpeg`)
* **ช่องว่างเทียบกับ Grok Bot:** บอทอาจอัดวิดีโอจอดำจาก display ผิดตัว หรือหน้าจอค้างโดยที่ตัวระบบไม่รู้.
* **Input/Output:** In: `filePath` (เช่น `.mp4`). Out: `{ isValid: boolean, pixelVariance: number, duration: number }`
* **ลอจิก:** รัน `ffprobe` เช็กสตรีม, ใช้ `ffmpeg -vf "format=gray,scale=64:64"` ถอดเฟรมสุ่ม 3 จุดมาดูความแปรปรวน (Variance) ว่าเกินค่าต่ำสุด (ป้องกันสีเดียวทั้งจอ).
* **ผลลัพธ์ (Token & เสถียรภาพ):** การันตี Deliverable ให้ User มีคุณภาพ 100% ไม่ส่งงานไฟล์พัง.

### 4. ระบบแปลงไฟล์และตรวจสอบความสมบูรณ์ของเอกสาร
* **ชื่อฟังก์ชัน:** `verifyThaiPdfShaping(pdfPath: string): Promise<boolean>`
* **ไฟล์เป้าหมาย:** `packages/adapters/src/document-processor.ts` (หรือส่วนเกี่ยวข้องกับไฟล์/PDF)
* **ช่องว่างเทียบกับ Grok Bot:** เมื่อแปลงเอกสาร (เช่น HTML->PDF) อักขระไทยที่มีวรรณยุกต์ซ้อน (สระ า/ำ) มักแสดงผลกว้างผิดหรือทับกัน.
* **Input/Output:** In: `pdfPath`. Out: `{ isValid: boolean, fontEmbedded: boolean, shapingErrors: number }`
* **ลอจิก:** ใช้ไลบรารีสกัดฟอนต์ (เช่น pdf-lib/pypdf) ดู Flag ว่ามีการ Embed จริง และสกัด text layout มาดู width ว่าไม่ทับซ้อนกันผิดปกติ.
* **ผลลัพธ์ (Token & เสถียรภาพ):** ยืนยันผลลัพธ์ไฟล์ PDF ให้สมบูรณ์พร้อมใช้โดยมนุษย์.

### 5. ระบบสมองกลเลือกโมเดล และจัดการ Prompt
* **ชื่อฟังก์ชัน:** `pruneUnseenDomRefs(snapshot: DomSnapshot): DomSnapshot`
* **ไฟล์เป้าหมาย:** `packages/adapters/src/computer-tools.ts`
* **ช่องว่างเทียบกับ Grok Bot:** การส่ง DOM ใหญ่ๆ ไปให้โมเดลจีนจะทำให้ Token หมดเร็วและประสิทธิภาพตกลงมาก.
* **Input/Output:** In: `DomSnapshot`. Out: `DomSnapshot` (ขนาดเล็กลง)
* **ลอจิก:** กรอง element ที่ `isHidden`, นอก Viewport (ไกลกว่า 2 หน้าจอ), หรือไม่มี Role สำคัญทางการกระทำ (เช่น สปานตกแต่ง) ออกจากการแปลงเป็น `[e1a2b3c4]`.
* **ผลลัพธ์ (Token & เสถียรภาพ):** ลดปริมาณ Token ขาเข้าต่อลูปได้ถึง 40-60% เปิดทางให้ใช้โมเดลราคาถูกรันงานได้รวดเร็วและแม่นยำขึ้น.
