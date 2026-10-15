import { renderDocument } from '/app/packages/adapters/src/document-renderer.js';
import { writeFile } from 'node:fs/promises';

async function main() {
  const literal = await renderDocument({
    format: 'pdf',
    title: 'Literal delimiter regression',
    content: 'Amount \n\nEnd of document'
  });
  await writeFile('/tmp/math-unmatched-test.pdf', literal.bytes);
  console.log('Saved /tmp/math-unmatched-test.pdf (' + literal.bytes.length + ' bytes)');
}
main().catch(err => {
  console.error(err);
  process.exit(1);
});
