import * as React from "react"
import { XIcon } from "lucide-react"
import { Dialog as SheetPrimitive } from "radix-ui"
import { cn } from "@/lib/utils"

function Sheet({ ...props }: React.ComponentProps<typeof SheetPrimitive.Root>) {
  return <SheetPrimitive.Root data-slot="sheet" {...props} />
}

function SheetTrigger({ ...props }: React.ComponentProps<typeof SheetPrimitive.Trigger>) {
  return <SheetPrimitive.Trigger data-slot="sheet-trigger" {...props} />
}

function SheetClose({ ...props }: React.ComponentProps<typeof SheetPrimitive.Close>) {
  return <SheetPrimitive.Close data-slot="sheet-close" {...props} />
}

function SheetOverlay({ className, ...props }: React.ComponentProps<typeof SheetPrimitive.Overlay>) {
  return (
    <SheetPrimitive.Overlay
      data-slot="sheet-overlay"
      className={cn(
        "fixed inset-0 z-60 bg-foreground/50 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:duration-(--duration-sheet) data-[state=open]:ease-enter data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:duration-(--duration-sheet-out) data-[state=closed]:ease-exit",
        className
      )}
      {...props}
    />
  )
}

/** design.md: sheets on phones, `shadow-dialog`, the sheet motion tokens. The Close button takes the text color. */
function SheetContent({
  className,
  children,
  side = "left",
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Content> & { side?: "left" | "right" }) {
  return (
    <SheetPrimitive.Portal data-slot="sheet-portal">
      <SheetOverlay />
      <SheetPrimitive.Content
        data-slot="sheet-content"
        className={cn(
          // Suite spec 0016 AC-5 and AC-10: shadow-dialog, slides in over --duration-sheet, out in two thirds of it (a fade only with reduced motion)
          "fixed inset-y-0 z-60 flex h-dvh w-72 flex-col bg-card text-card-foreground shadow-dialog data-[state=open]:animate-in data-[state=open]:duration-(--duration-sheet) data-[state=open]:ease-enter data-[state=closed]:animate-out data-[state=closed]:duration-(--duration-sheet-out) data-[state=closed]:ease-exit",
          side === "left"
            ? "left-0 rounded-r-3xl data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left"
            : "right-0 rounded-l-3xl data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right",
          className
        )}
        {...props}
      >
        {children}
        <SheetPrimitive.Close
          aria-label="Close"
          className="absolute top-2.5 right-2 inline-flex size-11 items-center justify-center rounded-lg opacity-70 transition-opacity hover:opacity-100 focus-visible:ring-2 focus-visible:ring-current focus-visible:outline-hidden [&_svg]:size-5"
        >
          <XIcon aria-hidden="true" />
        </SheetPrimitive.Close>
      </SheetPrimitive.Content>
    </SheetPrimitive.Portal>
  )
}

function SheetTitle({ className, ...props }: React.ComponentProps<typeof SheetPrimitive.Title>) {
  return <SheetPrimitive.Title data-slot="sheet-title" className={cn("text-subheading", className)} {...props} />
}

function SheetDescription({ className, ...props }: React.ComponentProps<typeof SheetPrimitive.Description>) {
  return (
    <SheetPrimitive.Description
      data-slot="sheet-description"
      className={cn("text-body text-muted-foreground", className)}
      {...props}
    />
  )
}

export { Sheet, SheetClose, SheetContent, SheetDescription, SheetOverlay, SheetTitle, SheetTrigger }
