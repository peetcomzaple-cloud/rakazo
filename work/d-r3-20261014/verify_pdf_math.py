import pypdf

reader = pypdf.PdfReader('/home/opc/rakazo/work/d-r3-20261014/math-display-test.pdf')
txt = reader.pages[0].extract_text()
print('Extracted text:\n---')
print(txt)
print('---')
assert '' not in txt, 'Error: delimiter  leaked into text'
print('Assertion passed: NO  leaked in PDF text!')
assert '' in txt, 'Error:  currency missing'
print('Assertion passed:  currency preserved!')
