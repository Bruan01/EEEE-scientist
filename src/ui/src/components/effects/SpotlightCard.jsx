'use client';

/**
 * SpotlightCard Component - 跟随鼠标的聚光灯效果
 * 来自 react-bits,纯CSS+少量JS实现
 * 使用场景: 任务卡片、统计卡片、重要内容区域
 */
import React, { useRef } from 'react';
import './SpotlightCard.css';

function SpotlightCard({
  children,
  className = '',
  spotlightColor = 'rgba(14, 165, 233, 0.15)', // 品牌色聚光灯
  disabled = false
}) {
  const divRef = useRef(null);

  const handleMouseMove = (e) => {
    if (!divRef.current || disabled) return;

    const rect = divRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    divRef.current.style.setProperty('--mouse-x', `${x}px`);
    divRef.current.style.setProperty('--mouse-y', `${y}px`);
    divRef.current.style.setProperty('--spotlight-color', spotlightColor);
  };

  return (
    <div
      ref={divRef}
      onMouseMove={handleMouseMove}
      className={`spotlight-card ${disabled ? 'spotlight-disabled' : ''} ${className}`}
    >
      {children}
    </div>
  );
}

export default SpotlightCard;

/**
 * 使用示例:
 *
 * // 基础用法
 * <SpotlightCard>
 *   <div className="task-card">任务内容</div>
 * </SpotlightCard>
 *
 * // 自定义颜色
 * <SpotlightCard spotlightColor="rgba(124, 58, 237, 0.2)">
 *   <StatsCard {...props} />
 * </SpotlightCard>
 *
 * // 禁用效果
 * <SpotlightCard disabled={isMobile}>
 *   <div>内容</div>
 * </SpotlightCard>
 */
