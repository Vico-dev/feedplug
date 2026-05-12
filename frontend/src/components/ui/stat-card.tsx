import * as React from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { LucideIcon, TrendingUp, TrendingDown } from "lucide-react";

interface StatCardProps {
  title: string;
  value: string | number;
  change?: {
    value: string;
    type: "positive" | "negative" | "neutral";
    period: string;
  };
  icon?: LucideIcon;
  description?: string;
  className?: string;
  progress?: {
    value: number;
    max: number;
    color?: "primary" | "success" | "warning" | "error";
  };
  delay?: number;
}

export function StatCard({
  title,
  value,
  change,
  icon: Icon,
  description,
  className,
  progress,
  delay = 0,
}: StatCardProps) {
  const getChangeColor = () => {
    if (!change) return "";
    switch (change.type) {
      case "positive":
        return "text-success";
      case "negative":
        return "text-danger";
      default:
        return "text-ink-3";
    }
  };

  const getProgressColor = () => {
    if (!progress) return "bg-ink";
    switch (progress.color) {
      case "success":
        return "bg-success";
      case "warning":
        return "bg-warning";
      case "error":
        return "bg-danger";
      default:
        return "bg-steel";
    }
  };

  const ChangeIcon =
    !change ? null : change.type === "positive" ? TrendingUp : TrendingDown;

  return (
    <motion.div
      initial={{ y: 20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{
        duration: 0.5,
        delay,
        ease: [0.25, 0.46, 0.45, 0.94],
      }}
      whileHover={{ 
        y: -4,
        transition: { duration: 0.2 }
      }}
      className={cn("h-full", className)}
    >
      <Card className="h-full border border-line shadow-xs hover:shadow-md transition-shadow duration-base group bg-surface">
        <CardContent className="p-6">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center space-x-3 mb-4">
                {Icon && (
                  <motion.div
                    className="h-11 w-11 rounded-lg bg-paper-2 flex items-center justify-center group-hover:bg-paper-3 transition-colors duration-base"
                    whileHover={{ scale: 1.04 }}
                    transition={{ duration: 0.2 }}
                  >
                    <Icon className="h-5 w-5 text-ink-2" />
                  </motion.div>
                )}
                <div>
                  <p className="text-sm font-medium text-ink-3 mb-1">{title}</p>
                  {description && (
                    <p className="text-xs text-ink-4">{description}</p>
                  )}
                </div>
              </div>

              <div className="space-y-3">
                <motion.p
                  className="font-display text-3xl font-bold text-ink tracking-[-0.025em]"
                  initial={{ scale: 0.92 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: delay + 0.2, duration: 0.3 }}
                >
                  {value}
                </motion.p>

                {change && (
                  <motion.div
                    className="flex items-center space-x-2"
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: delay + 0.4, duration: 0.3 }}
                  >
                    {ChangeIcon && (
                      <ChangeIcon className={cn("h-4 w-4", getChangeColor())} />
                    )}
                    <span className={cn("text-sm font-semibold", getChangeColor())}>
                      {change.value}
                    </span>
                    <span className="text-xs text-ink-4">{change.period}</span>
                  </motion.div>
                )}
              </div>
            </div>
          </div>

          {progress && (
            <motion.div
              className="mt-6"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: delay + 0.6, duration: 0.3 }}
            >
              <div className="flex justify-between text-xs text-ink-3 mb-2">
                <span className="font-mono uppercase tracking-wider">Progression</span>
                <span className="font-mono">{Math.round((progress.value / progress.max) * 100)}%</span>
              </div>
              <div className="w-full bg-paper-2 rounded-pill h-1.5 overflow-hidden">
                <motion.div
                  className={cn("h-full rounded-pill", getProgressColor())}
                  initial={{ width: 0 }}
                  animate={{ width: `${(progress.value / progress.max) * 100}%` }}
                  transition={{ delay: delay + 0.8, duration: 0.8, ease: "easeOut" }}
                />
              </div>
            </motion.div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}


