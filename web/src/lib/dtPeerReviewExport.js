import * as XLSX from 'xlsx';
import { exportRows } from './dtPeerReviewStats.js';

// Download a DT Peer Review comment log as an Excel workbook.
export function exportComments(comments, name) {
  const ws = XLSX.utils.json_to_sheet(exportRows(comments));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Comments');
  XLSX.writeFile(wb, `${name}.xlsx`);
}
