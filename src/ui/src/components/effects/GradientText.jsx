'use client';

/**
 * GradientText Component - 渐变文字动画
 * 来自 react-bits
 * 使用场景: 主标题、重要文字、品牌名称
 */
import './GradientText.css';

export default function GradientText({
  children,
  className = '',
  colors = ['#0ea5e9', '#2563eb', '#0ea5e9'],
  animationSpeed = 6,
  showBorder = false
}) {
  const gradientStyle = {
    backgroundImage: `linear-gradient(to right, ${colors.join(', ')})`,
    animationDuration: `${animationSpeed}s`
  };

  return (
    <div className={`animated-gradient-text ${className}`}>
      {showBorder && <div className="gradient-overlay" style={gradientStyle}></div>}
      <div className="text-content" style={gradientStyle}>
        {children}
      </div>
    </div>
  );
}
