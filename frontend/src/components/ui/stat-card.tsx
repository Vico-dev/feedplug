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
        return "text-emerald-600";
      case "negative":
        return "text-red-500";
      default:
        return "text-neutral-500";
    }
  };

  const getProgressColor = () => {
    if (!progress) return "bg-neutral-900";
    switch (progress.color) {
      case "success":
        return "bg-emerald-500";
      case "warning":
        return "bg-amber-500";
      case "error":
        return "bg-red-500";
      default:
        return "bg-neutral-900";
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
      <Card className="h-full border-0 shadow-sm hover:shadow-lg transition-all duration-300 group">
        <CardContent className="p-6">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center space-x-3 mb-4">
                {Icon && (
                  <motion.div 
                    className="h-12 w-12 rounded-2xl bg-neutral-50 flex items-center justify-center group-hover:bg-neutral-100 transition-colors duration-200"
                    whileHover={{ scale: 1.05 }}
                    transition={{ duration: 0.2 }}
                  >
                    <Icon className="h-6 w-6 text-neutral-600" />
                  </motion.div>
                )}
                <div>
                  <p className="text-sm font-medium text-neutral-600 mb-1">{title}</p>
                  {description && (
                    <p className="text-xs text-neutral-500">{description}</p>
                  )}
                </div>
              </div>
              
              <div className="space-y-3">
                <motion.p 
                  className="text-3xl font-bold text-neutral-900 tracking-tight"
                  initial={{ scale: 0.8 }}
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
                    <span className="text-xs text-neutral-500">{change.period}</span>
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
              <div className="flex justify-between text-xs text-neutral-500 mb-2">
                <span>Progression</span>
                <span className="font-medium">{Math.round((progress.value / progress.max) * 100)}%</span>
              </div>
              <div className="w-full bg-neutral-100 rounded-full h-2 overflow-hidden">
                <motion.div
                  className={cn("h-full rounded-full", getProgressColor())}
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


