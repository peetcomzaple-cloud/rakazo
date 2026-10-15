from pathlib import Path
p = Path('/home/opc/rakazo/work/round3-acceptance/run-round3-live.py')
c = p.read_text(encoding='utf-8')
old_prompt = "ไม่ต้องใช้ write_file หรือบันทึกผ่าน shell"
new_prompt = "ไม่ต้องใช้ write_file หรือบันทึกผ่าน shell กรุณาร่างตารางงบประมาณ เช็กบ็อกซ์ และสูตรคำนวณ แล้วเรียกเครื่องมือ render_document ทันที"
c = c.replace(old_prompt, new_prompt)
p.write_text(c, encoding='utf-8')
print('Prompt updated successfully')
