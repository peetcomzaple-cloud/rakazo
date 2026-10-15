# Rakazo Architecture Execution Plan (Antigravity Lead Implementation)

วันที่: 15 ตุลาคม 2026
บทบาท: ผู้พัฒนาและผู้รวมงานหลัก (Lead Integrator & Implementer)
อ้างอิง: `01_ANTIGRAVITY_IMPLEMENT.md`, `02_JULES_INDEPENDENT_QA.md`, `03_JEV_TEST_PROTOCOL.md`, `RAKAZO_STRATEGY_PLAN.md`, `COMPONENT_DECISIONS.json`

---

## 1. Baseline & Environment Manifest

- **ระบบปฏิบัติการ & สเปกเซิร์ฟเวอร์:**
  - เครื่องทดสอบจริง: Oracle Cloud x86_64, 2 vCPU, RAM 11,496 MiB (ตรวจสอบจริง ไม่ใช้สมมติฐาน ARM64 24GB).
  - ผู้ใช้และสิทธิ์: `opc`, Docker containerised runtime (`rakazo-api-1`, `rakazo-worker-1`, `rakazo-web-1`, `rakazo-supervisor-1`, `rakazo-bot-*`, `rakazo-computer` viewer 16080).
  - Protected Boundaries: Port 80/443 ห้ามแตะ, NoVNC viewer บนพอร์ต 16080 และ `/opt/rakazo-computer/viewer` ห้ามแก้ไข, ไม่ bind chat 5173 สู่สาธารณะ.
- **Git Baseline & Local Changes:**
  - Branch: `main` (commit baseline: `dacfcbe5b0d560739c6e01086231b56f0f22a72b`).
  - Round 3 Verified Fixes (คงไว้):
    - `packages/adapters/src/computer-lifecycle.ts`: Dedicated/Team lease fence monotonicity (แก้ไข fence drop).
    - `packages/adapters/src/executor.ts`: Navigation & takeover strict verification (`lastWebActionVerified` based on `actRes.verified === true`, fresh target parsing).
    - `packages/adapters/src/document-renderer.ts`: PDF display math `$$` stripping fix, Thai fonts (DejaVuSans / NotoSansThai) 2D math layout baseline (SHA-256 `3bf8089c...`).
- **Cost & Budget Ledger Baseline:**
  - Accumulated Model Calls: 135 calls / \$0.13161910 USD (unknown = 0).
  - Current Policy: การทำ Phase 0–3 มุ่งเน้น Source coding, local fixtures, unit/contract/integration tests (0 paid calls). หากต้องทำ Live paid batch จะต้องเสนอ batch ขนาดเล็กและค่าใช้จ่ายประมาณการก่อนเริ่ม.

---

## 2. Component Decisions & Scope Matrix

| Component | เลเยอร์ | สถานะ | เหตุผล & สัญญาความปลอดภัย |
|---|---|---|---|
| **rakazo core** | ฐานผลิตภัณฑ์ | คงไว้ | รักษา chat, routines, memory, approvals, protected secret flow, artifacts และ supervisor |
| **BrowserProvider** (Playwright vs. agent-browser) | ตัวขับเว็บ | ปรับปรุงและผูกกับ sandbox | Spike เปรียบเทียบระหว่าง Playwright-based CDP adapter กับ agent-browser snapshot/AX tree; เชื่อมเข้า `ComputerBrowserProvider` โดยเคารพ monotonic fence, single browser owner (ไม่ฆ่า user browser, ไม่ wake browser เก่าเมื่อเปิด viewer) |
| **Structured Action Selector** | Decision Loop | นำเข้าหลัก | ให้ Chinese models (DeepSeek/Qwen) หรือ Deterministic selector เลือก action candidates จาก snapshot สด ตรวจ fresh ref/fence ก่อน dispatch และตรวจปลายทางหลัง action |
| **Jev Ultrafast** | Decision Adapter | ปลั๊กอินเสริม (Opt-in) | พัฒนา adapter conformance ตาม `03_JEV_TEST_PROTOCOL.md` (no-match, ambiguous, blocked, waiting input); หากไม่มี live Jev API key ให้ระบุ live Jev เป็น `NOT_TESTED` โดยไม่บล็อก core |
| **SearXNG Backend** | ค้นหาเว็บ | นำเข้า | เพิ่ม JSON backend ใน `WebSearchProvider` ควบคู่ DuckDuckGo HTML light path และ Readability fallback |
| **Pandoc + Typst vs. Document Renderer** | เอกสาร & รายงาน | รวมและคง interface | คง interface `render_document` เดิมที่ผ่าน Thai font shaping และ 2D math; ทดลอง Typst/Pandoc เทียบ baseline และคงความสมบูรณ์ของ PDF/Docx/Xlsx ห้ามคืน empty/placeholder bytes |
| **Other components** (Skyvern, Steel, Firecrawl, Camoufox, LiteLLM) | ภายนอก | DEFERRED | ยังไม่นำเข้าในชุดนี้เพื่อรักษา stability และ zero-regression บน Oracle 2-CPU VM |

---

## 3. Sequence & Milestones (ลำดับลงมือและเกณฑ์ผ่าน)

### ระยะ 0: Baseline และ Oracle Regression (Grader Zero-False-Positive)
- ตรวจสอบ `work/after-d-r4-20261014/grader-new-results.json` (10 negative cases ของ Codex R4).
- ปรับปรุง `evaluate_case` และ invariant harness ใน `test_grader_invariants.py` / `run-round3-live.py` ให้ reject ครบทั้ง 10 เคส (FAIL 100%, 0 False Positives).
- พิสูจน์ Positive cases เดิมยังคง PASS ครบถ้วน (ไม่ทำให้ grader กลายเป็น reject-all).

### ระยะ 1: Vertical Slice BrowserProvider Adapter
- พัฒนาโครงสร้าง BrowserProvider รองรับ AX tree, refs, element bounding boxes, frame/popup targets.
- Spike เปรียบเทียบ Playwright-based CDP path กับ agent-browser protocol บน fixture เดียวกัน (iframe, popup, stale ref, overlay, login).
- ยืนยัน Single-owner lifecycle: Stop/Take Control ยกเลิก pending actions ทันที; ไม่ wake browser ที่ถูกปิด; เคารพ monotonic fence.

### ระยะ 2: Decision Loop & Jev Protocol Conformance
- พัฒนา Candidate Selection loop: สร้าง dynamic candidate list จาก snapshot; รองรับ deterministic rule-based และ Chinese structured model prompt.
- พัฒนา Jev adapter ใน `packages/adapters/src/jev-adapter.ts` ตามข้อกำหนด `03_JEV_TEST_PROTOCOL.md` ครบ 14 invariant tests (J01–J14).
- Secret Safety Boundary: รหัสผ่านและ credentials ต้อง resolve ตอน runtime เท่านั้น; ห้ามส่ง plaintext secret ไปยัง selector หรือ Jev payload.

### ระยะ 3: Search, Reader & Document Engines
- พัฒนา `SearxngWebSearchProvider` ใน `packages/adapters/src/` รองรับ JSON output และ error recovery.
- ตรวจสอบ document renderer: ยืนยันการคงอยู่ของ DejaVuSans/NotoSansThai font embedding, math formulas (`$$` and fraction layout), multi-page wrap, และ dynamic table rendering.

### ระยะ 4: Antigravity Self-Test & Delivery Documentation
- รันชุด Antigravity Self-Test ครบทุกมิติ: Build, Driver fixtures, Lifecycle/Security, Provider/Cost, Documents, UI smoke.
- บันทึก `ANTIGRAVITY_SELF_TEST_RESULTS.md`, diff manifest, และ snapshot instructions สำหรับ Jules QA.
