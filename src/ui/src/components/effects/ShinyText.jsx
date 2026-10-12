'use client';

/**
 * ShinyText Component - 光泽扫过文字效果
 * 来自 react-bits,轻量级纯CSS实现
 * 使用场景: 主标题、重要标签、按钮文字
 */
import React from 'react';
import './ShinyText.css';

function ShinyText({
  text,
  disabled = false,
  speed = 3,
  className = '',
  as = 'span' // 允许自定义标签
}) {
  const animationDuration = `${speed}s`;
  const Component = as;

  return (
    <Component
      className={`shiny-text ${disabled ? 'shiny-text-disabled' : ''} ${className}`}
      style={{
        animationDuration: animationDuration
      }}
    >
      {text}
    </Component>
  );
}

export default ShinyText;
