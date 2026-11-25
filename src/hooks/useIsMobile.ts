import { useMediaQuery } from './useMediaQuery';

// Phones and small tablets: below Tailwind's md breakpoint (768px).
const MOBILE_QUERY = '(max-width: 767px)';

export function useIsMobile() {
  return useMediaQuery(MOBILE_QUERY);
}
