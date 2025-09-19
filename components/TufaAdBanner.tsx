"use client";

import React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { Comfortaa } from "next/font/google";

const comfortaa = Comfortaa({ subsets: ["latin"], weight: ["500", "700"] });

type TufaAdBannerProps = {
  variant?: "narrow" | "large";
  className?: string;
  cycleMs?: number;
  messages?: string[];
};

const DEFAULT_MESSAGES: string[] = [
  "Boost your brand",
  "Generate content",
  "Plan your strategy",
  "Grow your business",
  "Schedule your posts",
  "Simplify marketing",
  "Scale your socials",
  "Manage campaigns",
  "Boost your brand",
  "Engage customers",
  "Streamline content",
  "Plan smarter",
  "Save time",
  "Maximise reach",
  "Boost your brand",
  "Build presence",
  "Strengthen strategy",
];

export default function TufaAdBanner({
  variant = "large",
  className,
  cycleMs = 3400,
  messages = DEFAULT_MESSAGES,
}: TufaAdBannerProps) {
  const [index, setIndex] = React.useState(0);
  const [closed, setClosed] = React.useState(false);

  React.useEffect(() => {
    if (messages.length <= 1) return;
    const id = setInterval(() => {
      setIndex((prev) => (prev + 1) % messages.length);
    }, cycleMs);
    return () => clearInterval(id);
  }, [cycleMs, messages.length]);

  if (variant === "narrow" && closed) return null;

  const isNarrow = variant === "narrow";

  const containerClasses = cn(
    "w-full bg-[#2f2538]", // background - 2f2538
    isNarrow ? "py-2 px-3" : "py-4 px-6",
    className
  );

  const textSizeClasses = isNarrow ? "text-sm sm:text-lg" : "text-sm sm:text-xl";
  const trackHeightClasses = isNarrow ? "h-6 sm:h-7" : "h-7 sm:h-8";
  const longestMessage = React.useMemo(
    () => messages.reduce((a, b) => (b.length > a.length ? b : a), ""),
    [messages]
  );

  return (
    <div className={containerClasses}>
      <a href="https://tufa.io" target="_blank" rel="noopener noreferrer" className="block">
        <div className="mx-auto">
          <div className="flex items-center justify-between gap-3">
            <div/>

            {/* Center: animated message + static "with Tufa" and subline stacked */}
            <div className="flex flex-col items-center">
              <div className={cn("flex items-center gap-1 sm:gap-2 mr-5", textSizeClasses)}>
                {/* Animated message */}
                <div className={cn("relative overflow-hidden leading-none", trackHeightClasses)}>
                  {/* Sizer keeps container width based on the longest message so absolute child is visible */}
                  <span className={cn("invisible whitespace-nowrap font-medium text-xl", comfortaa.className)}>
                    {longestMessage || messages[0]}
                  </span>
                  <AnimatePresence initial={false} mode="wait">
                    <motion.div
                      key={messages[index]}
                      initial={{ y: "100%", opacity: 0 }}
                      animate={{ y: "0%", opacity: 1 }}
                      exit={{ y: "-100%", opacity: 0 }}
                      transition={{ duration: 0.5, ease: [0.4, 0.0, 0.2, 1] }}
                      className={cn("absolute inset-0 flex items-center justify-end text-[#e8e0e3] whitespace-nowrap font-medium", comfortaa.className)}
                    >
                      {messages[index]}
                    </motion.div>
                  </AnimatePresence>
                </div>
                <span className={cn("text-[#e8e0e3] font-medium", comfortaa.className)}>with</span>
                <img src="/tufa.svg" alt="Tufa" className={cn(isNarrow ? "h-5 sm:h-7" : "h-5 sm:h-9", "w-auto mb-1")} />
              </div>
              {!isNarrow && (
                <div className={cn("my-4 text-center text-[#e8e0e3] font-medium", comfortaa.className)}>
                  Find out more about the smarter way to grow your business on social media.
                </div>
              )}
            </div>

            {/* Right: logo and optional close */}
            <div className="flex items-center gap-2">
              {isNarrow && (
                <button
                  type="button"
                  aria-label="Close"
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); setClosed(true); }}
                  className="ml-1 rounded text-[#e8e0e3] hover:text-white/80 focus:outline-none focus:ring-2 focus:ring-white/30 text-xl"
                >
                  ×
                </button>
              )}
            </div>
          </div>
        </div>
      </a>
    </div>
  );
}


