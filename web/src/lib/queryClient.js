import { MutationCache, QueryClient } from '@tanstack/react-query';
import { toast } from './toast.js';

// Global feedback for mutations (TanStack Query v5.104 passes the mutation 4th).
//  - A failed mutation with no onError of its own shows an error toast, unless
//    the page already displays that same message inline. Opt out entirely with
//    `meta: { silent: true }`.
//  - A successful mutation shows a success toast only if it asks for one with
//    `meta: { success: 'Saved' }` (or a function returning the text).
export const queryClient = new QueryClient({
  mutationCache: new MutationCache({
    onError: (error, _variables, _onMutateResult, mutation) => {
      if (mutation.options.onError || mutation.meta?.silent) return;
      if (error?.code === 'NETWORK_ERROR') return; // the offline screen already covers this
      const message = error?.message || 'Something went wrong. Please try again.';
      // Many pages render the error inline (without an onError). Give the page a
      // moment to paint, then toast only if the message is not already on screen.
      setTimeout(() => {
        if (!document.body.textContent.includes(message)) toast.error(message);
      }, 150);
    },
    onSuccess: (data, variables, _onMutateResult, mutation) => {
      const spec = mutation.meta?.success;
      const text = typeof spec === 'function' ? spec(data, variables) : spec;
      if (text) toast.success(text);
    },
  }),
});
