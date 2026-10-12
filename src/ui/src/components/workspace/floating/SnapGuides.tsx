"use client";

import { motion, AnimatePresence } from "framer-motion";
import type { SnapGuide } from "@/lib/stores/floating-panels";

interface SnapGuidesProps {
  guides: SnapGuide[];
}

export function SnapGuides({ guides }: SnapGuidesProps) {
  return (
    <AnimatePresence>
      {guides.map((guide, index) => (
        <motion.div
          key={`${guide.type}-${guide.position}-${index}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.1 }}
          className="fixed pointer-events-none z-[9999]"
          style={
            guide.type === "vertical"
              ? {
                  left: guide.position,
                  top: guide.start,
                  width: 2,
                  height: guide.end - guide.start,
                  background:
                    "linear-gradient(to bottom, transparent, #6366f1, transparent)",
                }
              : {
                  left: guide.start,
                  top: guide.position,
                  width: guide.end - guide.start,
                  height: 2,
                  background:
                    "linear-gradient(to right, transparent, #6366f1, transparent)",
                }
          }
        />
      ))}
    </AnimatePresence>
  );
}
