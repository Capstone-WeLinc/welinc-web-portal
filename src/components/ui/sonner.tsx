import type { CSSProperties } from "react"
import { Toaster as Sonner } from "sonner"

import { useIsMobile } from "@/hooks/useIsMobile"
import { MAX_TOASTS, SIGN_IN_TOASTER } from "@/lib/notify"
import { useSaveBarShown } from "@/components/ui/save-bar"

/*
  Suite spec 0016 AC-11: sonner only stacks and swipes; every toast is our own Toast (notify
  in lib/notify.ts). Bottom right from 768px up, top center below it, at most 3, 380px wide,
  in the toast layer (z 40). While a SaveBar shows they sit 88px higher.
*/
const toasterStyle = {
  "--width": "380px",
  zIndex: 40,
} as CSSProperties

function Toaster() {
  const isMobile = useIsMobile()
  const barShown = useSaveBarShown()
  return (
    <Sonner
      position={isMobile ? "top-center" : "bottom-right"}
      // The session warning never counts toward the 3 (suite spec 0019, AC-25)
      visibleToasts={MAX_TOASTS + 1}
      gap={8}
      offset={barShown ? 24 + 88 : 24}
      mobileOffset={8}
      style={toasterStyle}
      toastOptions={{ unstyled: true, className: "w-full" }}
    />
  )
}

/**
 * Suite spec 0019, AC-15: the sign in page's own Toaster, mounted inside the split's white side
 * only, top center over the form. The app's main Toaster keeps its place.
 */
function SignInToaster() {
  return (
    <Sonner
      id={SIGN_IN_TOASTER}
      position="top-center"
      visibleToasts={MAX_TOASTS}
      gap={8}
      offset={16}
      mobileOffset={8}
      style={toasterStyle}
      toastOptions={{ unstyled: true, className: "w-full" }}
    />
  )
}

export { SignInToaster, Toaster }
