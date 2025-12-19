import { Check, Circle } from "lucide-react";

const pipelineSteps = [
  { id: "input", label: "Input" },
  { id: "relevancy", label: "Relevancy" },
  { id: "action", label: "Action" },
  { id: "entity_tagging", label: "Entity Tagging" },
  { id: "confidence", label: "Confidence" },
  { id: "qa", label: "QA" },
];

interface WorkflowProgressProps {
  currentStep: string;
  compact?: boolean;
}

export function WorkflowProgress({ currentStep, compact = false }: WorkflowProgressProps) {
  const currentIndex = pipelineSteps.findIndex((s) => s.id === currentStep);

  return (
    <div
      className={`flex items-center ${compact ? "gap-1" : "gap-2"}`}
      data-testid="workflow-progress"
    >
      {pipelineSteps.map((step, index) => {
        const isCompleted = index < currentIndex;
        const isCurrent = index === currentIndex;
        const isPending = index > currentIndex;

        return (
          <div key={step.id} className="flex items-center">
            <div className="flex flex-col items-center">
              <div
                className={`flex items-center justify-center rounded-full transition-colors ${
                  compact ? "h-6 w-6" : "h-8 w-8"
                } ${
                  isCompleted
                    ? "bg-emerald-500 text-white"
                    : isCurrent
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {isCompleted ? (
                  <Check className={compact ? "h-3 w-3" : "h-4 w-4"} />
                ) : (
                  <Circle className={compact ? "h-3 w-3" : "h-4 w-4"} />
                )}
              </div>
              {!compact && (
                <span
                  className={`mt-1 text-xs ${
                    isCurrent
                      ? "font-medium text-primary"
                      : isCompleted
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-muted-foreground"
                  }`}
                >
                  {step.label}
                </span>
              )}
            </div>
            {index < pipelineSteps.length - 1 && (
              <div
                className={`${compact ? "w-4 h-0.5 mx-0.5" : "w-8 h-0.5 mx-1"} ${
                  isCompleted
                    ? "bg-emerald-500"
                    : "bg-muted"
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
