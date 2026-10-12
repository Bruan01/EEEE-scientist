'use client'

import { BRAND_LOGO_SMALL_SRC } from '@/lib/constants/assets'

export default function HeroFooter() {
  return (
    <footer className="border-t border-black/5 bg-white/50 py-10">
      <div className="mx-auto w-full max-w-[90vw] px-6">
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <img
              src={BRAND_LOGO_SMALL_SRC}
              alt="DeepScientist"
              width={32}
              height={32}
              className="h-8 w-8 object-contain"
              loading="lazy"
              decoding="async"
              draggable={false}
            />
            <div>
              <div className="text-sm font-semibold text-[#2D2A26]">DeepScientist</div>
              <div className="text-xs text-[#7E8B97]">
                Autonomous AI research for scientific discovery.
              </div>
            </div>
          </div>
          <div className="text-xs text-[#9A948C]">© 2026 DeepScientist Research Lab</div>
        </div>
      </div>
    </footer>
  )
}
