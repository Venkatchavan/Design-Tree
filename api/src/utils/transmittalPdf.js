import PDFDocument from 'pdfkit';

export function sendTransmittalPdf(res, rows, filters = {}) {
  const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 24, bufferPages: true, info: { Title: 'DesignTree transmittal log' } });
  res.type('application/pdf');
  res.setHeader('Content-Disposition', 'attachment; filename="transmittal-log.pdf"');
  doc.pipe(res);
  const fields = [ ['Date',55], ['Project',112], ['Dept',38], ['Print',45], ['Document',50], ['Service',45], ['Team',62], ['TR no.',68], ['Qty',24], ['Sets',24], ['Total',28], ['Rev',26], ['Reason',116] ];
  const header = () => {
    doc.font('Helvetica-Bold').fontSize(15).text('DesignTree transmittal log',24,24);
    doc.font('Helvetica').fontSize(8).text(`Generated ${new Date().toISOString().slice(0,10)} | ${rows.length} entries`,24,47);
    const summary = Object.entries(filters).filter(([,v]) => v).map(([k,v]) => `${k}: ${v}`).join(' | ') || 'All permitted records';
    doc.text(summary,24,60,{width:780});
    let x=24; fields.forEach(([label,w]) => { doc.font('Helvetica-Bold').fontSize(7).text(label,x,86,{width:w-4});x+=w; });
    doc.moveTo(24,102).lineTo(817,102).strokeColor('#b9c7cf').stroke();
  };
  header();let y=109;
  for (const row of rows) {
    const values=[row.date ? new Date(row.date).toISOString().slice(0,10) : '',row.project?.name ?? row.projectName ?? '',row.dept ?? '',row.print ?? '',row.docType ?? '',row.service ?? '',row.team ?? '',row.trNo ?? '',row.qty ?? '',row.sets ?? '',row.total ?? '',row.rev ?? '',row.reason ?? ''];
    doc.font('Helvetica').fontSize(7);
    const height=Math.max(20,...values.map((v,i)=>doc.heightOfString(String(v),{width:fields[i][1]-5})+8));
    if(y+height>doc.page.height-42){doc.addPage();header();y=109;}
    let x=24;values.forEach((v,i)=>{doc.font('Helvetica').fontSize(7).fillColor('#172d3b').text(String(v),x,y,{width:fields[i][1]-5});x+=fields[i][1];});
    y+=height;doc.moveTo(24,y-4).lineTo(817,y-4).strokeColor('#e0e6ea').stroke();
  }
  if(!rows.length)doc.fontSize(11).text('No records match these filters.',24,115);
  const range=doc.bufferedPageRange();
  for(let i=0;i<range.count;i++){doc.switchToPage(i);doc.fontSize(8).text(`Page ${i+1} of ${range.count}`,24,doc.page.height-36,{width:780,align:'right',lineBreak:false});}
  doc.end();
}
