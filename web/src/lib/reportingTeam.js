import { useQuery } from '@tanstack/react-query';
import { teamsApi } from './api.js';

// The signed-in person's saved reporting team (employee-list links).
export function useReportingTeam(enabled = true) {
  return useQuery({
    queryKey: ['director-directory', false, ''],
    queryFn: () => teamsApi.directory(false, ''),
    enabled,
    refetchInterval: 10000,
  });
}
