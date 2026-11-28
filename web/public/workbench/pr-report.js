// "Generate PDF" on the Peer Review dashboard (28 Nov 2026): the Structural Peer
// Review – Status Report (same layout as DesignTree_STR_PeerReview_Report), built
// from the DT Peer Review package picked above the dashboard.
(function () {
  var JSPDF = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
  var AUTOTABLE = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js';
  var C = { ink: [20, 34, 58], muted: [107, 122, 144], blue: [27, 79, 160], line: [201, 211, 225], head: [232, 240, 252], dt: [232, 240, 252], resp: [227, 244, 236], wait: [255, 243, 223], bad: [180, 35, 24], ok: [19, 115, 74] };

  function load(src, ready) {
    if (ready()) return Promise.resolve();
    return new Promise(function (res, rej) {
      var s = document.createElement('script'); s.src = src; s.onload = res;
      s.onerror = function () { rej(new Error('Could not load the PDF library')); };
      document.head.appendChild(s);
    });
  }
  var id = function (v) { return String((v && v._id) || v || ''); };
  var dmy = function (v) {
    if (!v) return '';
    var d = new Date(v); if (isNaN(d.getTime())) return '';
    return String(d.getDate()).padStart(2, '0') + '.' + String(d.getMonth() + 1).padStart(2, '0') + '.' + d.getFullYear();
  };
  // Standard PDF fonts cover WinAnsi only; map the common extras and drop the rest.
  var MAP = { '—': '-', '−': '-', '≤': '<=', '≥': '>=', '≈': '~', '×': 'x', '√': 'sqrt', '’': "'", '‘': "'", '“': '"', '”': '"', '…': '...', '³': '3', '₂': '2', '₃': '3' };
  var txt = function (v) {
    return String(v == null ? '' : v).replace(/[^\x00-\xff–•·]/g, function (ch) { return MAP[ch] != null ? MAP[ch] : ''; });
  };
  var person = function (e) { return e && typeof e === 'object' ? [e.firstName, e.middleName, e.lastName].filter(Boolean).join(' ') : ''; };
  var stamp = function (s) { return s && s.at ? txt((s.byName || '-') + ' · ' + dmy(s.at)) : '-'; };

  window.dtPeerReviewPdf = function (pkgId) {
    if (!pkgId) return Promise.reject(new Error('Pick a DT Peer Review project above the dashboard first.'));
    return Promise.all([
      fetch('/api/dt-peer-review/' + encodeURIComponent(pkgId), { credentials: 'same-origin' }).then(function (r) {
        return r.json().then(function (d) { if (!r.ok) throw new Error(d.message || 'Could not load the peer review package'); return d; });
      }),
      load(JSPDF, function () { return !!(window.jspdf && window.jspdf.jsPDF); }).then(function () {
        return load(AUTOTABLE, function () { return !!window.jspdf.jsPDF.API.autoTable; });
      }),
    ]).then(function (r) { build(r[0]); });
  };

  function build(data) {
    var item = data.item, s = data.summary;
    var doc = new window.jspdf.jsPDF({ unit: 'mm', format: 'a4' });
    var W = 210, M = 14, today = dmy(new Date());
    var proj = item.project || {};
    var y = 18;
    var table = function (opts) {
      doc.autoTable(Object.assign({
        startY: y, margin: { left: M, right: M, bottom: 16 }, theme: 'grid',
        styles: { font: 'helvetica', fontSize: 8.5, cellPadding: 1.6, textColor: C.ink, lineColor: C.line, lineWidth: 0.2, valign: 'top' },
        headStyles: { fillColor: C.head, textColor: C.blue, fontStyle: 'bold' },
      }, opts));
      y = doc.lastAutoTable.finalY + 4;
    };
    var room = function (h) { if (y + h > 280) { doc.addPage(); y = 18; } };
    var heading = function (t) { room(18); doc.setFont('helvetica', 'bold'); doc.setFontSize(12.5); doc.setTextColor.apply(doc, C.blue); doc.text(t, M, y + 4); y += 8; };
    var para = function (t, color, size) {
      doc.setFont('helvetica', 'normal'); doc.setFontSize(size || 8.5); doc.setTextColor.apply(doc, color || C.muted);
      var lines = doc.splitTextToSize(txt(t), W - 2 * M); room(lines.length * 4 + 2); doc.text(lines, M, y + 3); y += lines.length * 4 + 2;
    };

    // Title block
    doc.setFont('helvetica', 'bold'); doc.setFontSize(17); doc.setTextColor.apply(doc, C.ink);
    doc.text('Structural Peer Review – Status Report', M, y); y += 6;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor.apply(doc, C.muted);
    doc.text(txt([proj.name, item.deliverableStage, 'Report date ' + today].filter(Boolean).join(' · ')), M, y); y += 5;
    table({
      body: [['Project', proj.name], ['Location', item.location], ['Client', item.client], ['Principal Consultant', item.principalConsultant], ['Service', 'Structural (STR)'], ['Deliverable stage', item.deliverableStage], ['Peer review', 'DesignTree Service Consultants Pvt. Ltd.']].map(function (r) { return [r[0], txt(r[1] || '-')]; }),
      columnStyles: { 0: { cellWidth: 48, fontStyle: 'bold', fillColor: C.head, textColor: C.blue } },
    });
    para('Peer Review applies to Structural (STR) services only. Data taken from the DesignTree Structural Peer Review dashboard on ' + today + '.');

    // 1. Package status
    heading('1. Package status');
    var status = (s.status || '').replace(' — ', ' – ');
    para([status].concat(s.released ? ['Released by ' + stamp(s.released)] : s.blockers || []).join(' • '), s.released || !s.blocked ? C.ok : C.bad, 10);
    var ck = s.checklist, cm = s.comments;
    var tile = function (label, value, sub) { return { content: label.toUpperCase() + '\n' + value + '\n' + sub }; };
    table({
      body: [
        [tile('Master checklist', ck.pct + '%', ck.closed + ' of ' + ck.total + ' items closed'), tile('Stages signed off', s.signed + ' / ' + s.stages.length, txt('Current: ' + (s.current || '-'))), tile('Open comments', cm.open, cm.total + ' raised · ' + cm.closed + ' closed')],
        [tile('Average closure time', cm.avgClosureDays == null ? '-' : cm.avgClosureDays + ' days', 'Across ' + cm.closed + ' closed comment' + (cm.closed === 1 ? '' : 's')), tile('Overdue comments', cm.overdue, 'Past response target'), tile('Approvals', s.approvals.done + ' / ' + s.approvals.total, 'Approved or not applicable')],
      ],
      styles: { fontSize: 9, cellPadding: 2.4, textColor: C.ink, lineColor: C.line, lineWidth: 0.2 },
      columnStyles: { 0: { cellWidth: (W - 2 * M) / 3 }, 1: { cellWidth: (W - 2 * M) / 3 }, 2: { cellWidth: (W - 2 * M) / 3 } },
    });

    // 2. Review team
    heading('2. Review team');
    var team = item.reviewTeam || [];
    table({
      head: [['Role', 'Name', 'Employee ID']],
      body: team.length ? team.map(function (e) { return [txt(e.designation || 'Reviewer'), txt(person(e)), txt(e.empId || '-')]; }) : [['-', 'No review team allotted', '-']],
    });
    if (item.allottedBy && item.allottedBy.at) para('Allotted by ' + stamp(item.allottedBy) + '.');

    // 3. Review stage progress
    heading('3. Review stage progress');
    table({
      head: [['Stage', 'Description', 'Items closed', 'Open comments', 'Status']],
      body: s.stages.map(function (st) { return [st.code, txt(st.name), st.itemsClosed + ' / ' + st.items, String(st.openComments), txt(st.status) + (st.signedOff ? '\n' + stamp(st.signedOff) : '')]; }),
      columnStyles: { 0: { cellWidth: 14, fontStyle: 'bold' }, 2: { cellWidth: 22 }, 3: { cellWidth: 24 }, 4: { cellWidth: 46 } },
    });
    para('A stage can be marked complete only when all its checklist items are Verified or N.A. and it has no open comments, and only by the allotted review team.');

    // 4. Approval gate
    heading('4. Approval gate');
    table({
      head: [['Deliverable', 'Status', 'By / date']],
      body: (item.approvals || []).map(function (a) { return [txt(a.deliverable), txt(a.status), stamp(a.stamped)]; }),
      columnStyles: { 1: { cellWidth: 30 }, 2: { cellWidth: 52 } },
    });
    para('The package stays blocked while any review comment is open. Approvals and Released for Issue are by the Admin allotters, based on the review team’s findings.');

    // 5. Comments log
    heading('5. Comments log');
    para(cm.total + ' comments · ' + cm.open + ' open (' + cm.awaitingConsultant + ' awaiting consultant response, ' + cm.awaitingDt + ' awaiting DesignTree review) · ' + cm.closed + ' closed', C.ink);
    var body = [];
    (item.comments || []).forEach(function (c, n) {
      var rounds = c.rounds || [];
      var st = (s.commentStates || {})[id(c)] || {};
      var last = rounds[rounds.length - 1];
      var extra = st.open && last && last.response ? 1 : 0;
      var span = rounds.length + extra;
      rounds.forEach(function (r, i) {
        var dtText = i === 0 ? r.comment : ['COMMENT IS ' + String(r.verdict || '').toUpperCase(), r.comment].filter(Boolean).join(' ');
        var awaited = !r.response && i === rounds.length - 1 && r.verdict !== 'Closed';
        var resp = r.response || (r.verdict === 'Closed' ? '' : awaited ? 'Awaiting response from Principal Consultant' : '');
        var row = [];
        if (i === 0) row.push({ content: String(n + 1), rowSpan: span, styles: { fontStyle: 'bold' } }, { content: txt(c.document), rowSpan: span }, { content: txt(c.topic), rowSpan: span }, { content: txt(c.detail), rowSpan: span });
        row.push('R' + (i + 1), dmy(r.commentDate), { content: txt(dtText), styles: { fillColor: C.dt } }, dmy(r.responseDate), { content: txt(resp), styles: r.response ? { fillColor: C.resp } : awaited ? { fillColor: C.wait } : {} });
        body.push(row);
      });
      if (extra) body.push(['R' + (rounds.length + 1), '', { content: 'Awaiting DesignTree review of the response', styles: { fillColor: C.wait } }, '', '']);
    });
    if (!body.length) para('No review comments raised yet.');
    else table({
      head: [['#', 'Document', 'Topic', 'Page / Detail', 'Round', 'Comment Date', 'DT Comment / Question', 'Response Date', 'Response to Comment / Question']],
      body: body,
      styles: { fontSize: 6.8, cellPadding: 1.2, textColor: C.ink, lineColor: C.line, lineWidth: 0.2, valign: 'top', overflow: 'linebreak' },
      headStyles: { fillColor: C.head, textColor: C.blue, fontStyle: 'bold', fontSize: 6.8 },
      columnStyles: { 0: { cellWidth: 6 }, 1: { cellWidth: 22 }, 2: { cellWidth: 17 }, 3: { cellWidth: 17 }, 4: { cellWidth: 10 }, 5: { cellWidth: 15 }, 6: { cellWidth: 46 }, 7: { cellWidth: 15 }, 8: { cellWidth: 34 } },
    });
    para('Blue = DesignTree comment or review; green = Principal Consultant response; yellow = response awaited. Each round is a DesignTree comment followed by the consultant’s response; later DesignTree rounds state COMMENT IS OPEN or COMMENT IS CLOSED.');

    // 6. Master checklist
    heading('6. Master checklist');
    para(ck.pct + '% complete · ' + ck.verified + ' verified · ' + ck.inProgress + ' in progress · ' + ck.notStarted + ' not started' + (ck.na ? ' · ' + ck.na + ' N.A.' : ''), C.ink);
    table({
      head: [['Stage', 'Item', 'Status', 'Stamped by / date', 'Remarks']],
      body: (item.checklist || []).map(function (i) { return [i.stage, txt(i.item), txt(i.status), stamp(i.stamped), txt(i.remarks || '')]; }),
      columnStyles: { 0: { cellWidth: 14 }, 2: { cellWidth: 22 }, 3: { cellWidth: 50 }, 4: { cellWidth: 34 } },
    });

    // Footer on every page
    var pages = doc.getNumberOfPages();
    for (var p = 1; p <= pages; p++) {
      doc.setPage(p); doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor.apply(doc, C.muted);
      doc.text(txt('DesignTree Structural Peer Review · ' + (proj.name || '') + ' · ' + today), M, 290);
      doc.text('Page ' + p + ' of ' + pages, W - M, 290, { align: 'right' });
    }
    var d = new Date();
    var iso = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    doc.save('DesignTree_STR_PeerReview_Report_' + iso + '.pdf');
  }
})();
