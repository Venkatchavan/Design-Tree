import { useQuery } from '@tanstack/react-query';
import { branchesApi } from './api.js';

// Strict dropdown source: active branches from the branch master.
export function useBranchOptions() {
  return useQuery({
    queryKey: ['branch-options'],
    queryFn: branchesApi.options,
    retry: false,
  });
}

export function branchOptionItems(data) {
  return data?.items ?? [];
}
