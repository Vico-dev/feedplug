import * as React from "react"
import { cn } from "@/lib/utils"

export interface StepperProps {
  steps: number;
  currentStep: number;
  className?: string;
}

const Stepper = React.forwardRef<HTMLDivElement, StepperProps>(
  ({ steps, currentStep, className }, ref) => {
    return (
      <div ref={ref} className={cn("flex gap-2", className)}>
        {Array.from({ length: steps }, (_, i) => i + 1).map((step) => (
          <div
            key={step}
            className={cn(
              "px-3 py-1.5 rounded-full border text-sm font-medium transition-colors",
              step === currentStep
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-background text-muted-foreground border"
            )}
          >
            Étape {step}
          </div>
        ))}
      </div>
    )
  }
)
Stepper.displayName = "Stepper"

export { Stepper }






