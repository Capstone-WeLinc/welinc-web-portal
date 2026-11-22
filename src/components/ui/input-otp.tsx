import * as React from "react"
import { OTPInput, OTPInputContext } from "input-otp"
import { cn } from "@/lib/utils"

/**
 * Every portal code is digits only, but a code copied from an email often comes with spaces, a
 * line break or a label ("Code: 321 393"). input-otp drops a paste that fails `pattern` whole, so
 * keep only the digits first.
 */
export const digitsOnly = (pasted: string) => pasted.replace(/\D/g, "")

/**
 * shadcn `InputOTP` (new-york v4, radix), added by hand: the portal has no components.json.
 * One real input underneath (`input-otp`), drawn as slots. Pasting cleans the text with
 * `digitsOnly` unless a caller passes its own `pasteTransformer`.
 */
function InputOTP({
  className,
  containerClassName,
  pasteTransformer = digitsOnly,
  ...props
}: React.ComponentProps<typeof OTPInput> & {
  containerClassName?: string
}) {
  return (
    <OTPInput
      pasteTransformer={pasteTransformer}
      data-slot="input-otp"
      containerClassName={cn(
        "flex items-center gap-2 has-disabled:opacity-50",
        containerClassName
      )}
      className={cn("disabled:cursor-not-allowed", className)}
      {...props}
    />
  )
}

function InputOTPGroup({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="input-otp-group"
      className={cn("flex items-center gap-2", className)}
      {...props}
    />
  )
}

function InputOTPSlot({
  index,
  className,
  ...props
}: React.ComponentProps<"div"> & {
  index: number
}) {
  const inputOTPContext = React.useContext(OTPInputContext)
  const { char, hasFakeCaret, isActive } = inputOTPContext?.slots[index] ?? {}

  return (
    <div
      data-slot="input-otp-slot"
      data-active={isActive}
      className={cn(
        // Suite spec 0016 AC-7: each cell follows the input rules (its own box, the 2px navy edge when active)
        "relative flex size-11 items-center justify-center rounded-lg border border-input bg-card font-mono text-group font-medium transition-colors outline-none aria-invalid:border-error data-[active=true]:border-primary data-[active=true]:inset-ring-1 data-[active=true]:inset-ring-primary md:size-10",
        className
      )}
      {...props}
    >
      {char}
      {hasFakeCaret && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="h-4 w-px animate-caret-blink bg-foreground motion-reduce:animate-none" />
        </div>
      )}
    </div>
  )
}

export { InputOTP, InputOTPGroup, InputOTPSlot }
