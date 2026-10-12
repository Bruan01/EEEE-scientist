"use client";

import { motion } from "framer-motion";
import { Sun } from "lucide-react";
import { useThemeStore } from "@/lib/stores/theme";
import { useEffect, useState } from "react";

export function ThemeToggle() {
  const { initTheme } = useThemeStore();
  const [mounted, setMounted] = useState(false);

  // Ensure component is mounted before rendering to avoid hydration mismatch
  useEffect(() => {
    setMounted(true);
    initTheme();
  }, [initTheme]);

  // Prevent hydration mismatch by not rendering until mounted
  if (!mounted) {
    return (
      <button
        className="p-2 rounded-soft-md bg-soft-bg-surface transition-all duration-200"
        aria-label="Toggle theme"
      >
        <div className="w-5 h-5" />
      </button>
    );
  }

  return (
    <motion.button
      onClick={() => undefined}
      className="p-2 rounded-soft-md bg-soft-bg-surface shadow-soft-sm hover:shadow-soft-md transition-all duration-200"
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      aria-label="Light theme"
      title="Light theme"
    >
      <motion.div
        initial={false}
        animate={{ rotate: 0 }}
        transition={{ type: "spring", stiffness: 200, damping: 10 }}
      >
        <Sun className="w-5 h-5 text-soft-text-primary" />
      </motion.div>
    </motion.button>
  );
}

/**
 * Theme toggle with dropdown for system option
 */
export function ThemeToggleDropdown() {
  const { theme, setTheme, initTheme } = useThemeStore();
  const [mounted, setMounted] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    setMounted(true);
    initTheme();
  }, [initTheme]);

  if (!mounted) {
    return (
      <button
        className="p-2 rounded-soft-md bg-soft-bg-surface"
        aria-label="Toggle theme"
      >
        <div className="w-5 h-5" />
      </button>
    );
  }

  const options = [{ value: "light", label: "Light", icon: Sun }] as const;

  return (
    <div className="relative">
      <motion.button
        onClick={() => setIsOpen(!isOpen)}
        className="p-2 rounded-soft-md bg-soft-bg-surface shadow-soft-sm hover:shadow-soft-md transition-all duration-200"
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        aria-label="Theme options"
        aria-expanded={isOpen}
        aria-haspopup="menu"
      >
        <motion.div
          initial={false}
          animate={{ rotate: 0 }}
          transition={{ type: "spring", stiffness: 200, damping: 10 }}
        >
          <Sun className="w-5 h-5 text-soft-text-primary" />
        </motion.div>
      </motion.button>

      {isOpen && (
        <>
          {/* Backdrop to close dropdown */}
          <div
            className="fixed inset-0 z-[10001]"
            onClick={() => setIsOpen(false)}
          />
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute right-0 mt-2 w-40 py-2 bg-soft-bg-surface rounded-soft-md shadow-soft-lg z-[10002]"
            role="menu"
          >
            {options.map(({ value, label, icon: Icon }) => (
              <button
                key={value}
                onClick={() => {
                  setTheme(value);
                  setIsOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-4 py-2 text-sm transition-colors ${
                  theme === value
                    ? "text-soft-accent bg-soft-bg-elevated"
                    : "text-soft-text-primary hover:bg-soft-bg-elevated"
                }`}
                role="menuitem"
              >
                <Icon className="w-4 h-4" />
                {label}
              </button>
            ))}
          </motion.div>
        </>
      )}
    </div>
  );
}
