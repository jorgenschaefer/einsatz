/**
 * Eine leere einseitige PDF mit der angegebenen MediaBox (in pt), samt
 * korrekter xref-Tabelle – klein genug für Tests, egal wie groß die Seite ist.
 */
export function minimalPdf(widthPt: number, heightPt: number): Buffer {
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${widthPt} ${heightPt}] >>`,
  ];
  let body = "%PDF-1.4\n";
  const offsets: number[] = [];
  objects.forEach((object, index) => {
    offsets.push(body.length);
    body += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xrefOffset = body.length;
  const entries = offsets.map(
    (offset) => `${String(offset).padStart(10, "0")} 00000 n \n`,
  );
  body +=
    `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${entries.join("")}` +
    `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\n` +
    `startxref\n${xrefOffset}\n%%EOF\n`;
  return Buffer.from(body, "latin1");
}
