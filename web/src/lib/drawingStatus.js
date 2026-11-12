// Drawing status as the team lead sets it (Revise / Awaiting / Approved).
// A drawing nobody has decided on yet is a fresh submission waiting for the
// team lead, so it reads "Submitted" rather than blank.
export const DRAWING_SUBMITTED = 'Submitted';

// "Awaiting · Client"; legacy "Resubmit" rows read as Awaiting. '' when the lead has not decided.
export function drawingStatusLabel(d) {
  const s = d?.status === 'Resubmit' ? 'Awaiting' : d?.status;
  if (!s) return '';
  return s === 'Awaiting' && d?.awaitingOn ? `Awaiting · ${d.awaitingOn}` : s;
}

// Same, but an undecided drawing shows as Submitted.
export function drawingSubmissionLabel(d) {
  return drawingStatusLabel(d) || DRAWING_SUBMITTED;
}
