import { useQuery, type QueryClient } from '@tanstack/react-query';
import { loadRecentProductionProjects } from '../utils/productionProjects';

export const productionProjectKeys = {
  all: ['production-projects'] as const,
  lists: () => [...productionProjectKeys.all, 'list'] as const,
  recent: (limit: number) => [...productionProjectKeys.lists(), 'recent', limit] as const,
};

export async function invalidateProductionProjectQueries(queryClient: QueryClient): Promise<void> {
  await queryClient.invalidateQueries({ queryKey: productionProjectKeys.lists() });
}

export function useRecentProductionProjects(limit = 48, enabled = true) {
  return useQuery({
    queryKey: productionProjectKeys.recent(limit),
    queryFn: async () => loadRecentProductionProjects(limit),
    enabled,
    staleTime: 5 * 60 * 1000,
    refetchOnMount: 'always',
    refetchOnWindowFocus: 'always',
  });
}
