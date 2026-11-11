import { useQuery } from '@tanstack/react-query';
import { bootstrapApi, workEntriesApi } from './api.js';
import { isAttendanceExemptRole } from './session.js';

// Hours the signed-in employee has already logged on `date` (own hours plus any
// "other project" hours). The server adds these to the entry being submitted
// when it checks the 8h extra-hours rule, so the form has to count them too —
// otherwise the reason box stays hidden while the server still asks for it.
export function useLoggedHours(date) {
  const bootstrapQ = useQuery({ queryKey: ['bootstrap'], queryFn: bootstrapApi });
  const mineQ = useQuery({
    queryKey: ['my-work-entries'],
    queryFn: () => workEntriesApi.list({ mine: true }),
  });
  if (isAttendanceExemptRole(bootstrapQ.data?.role?.key)) return 0;
  return (mineQ.data?.items ?? [])
    .filter((e) => String(e.date ?? '').slice(0, 10) === date)
    .reduce(
      (sum, e) => sum + (Number(e.hours) || 0) + (e.otherHours ?? []).reduce((s, o) => s + (Number(o.hours) || 0), 0),
      0,
    );
}
