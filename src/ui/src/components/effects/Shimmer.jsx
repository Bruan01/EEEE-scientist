'use client';

import './Shimmer.css';

const Shimmer = ({
  children,
  className = '',
  duration = '3s',
  color = 'rgba(255, 255, 255, 0.3)',
  angle = '45deg',
  width = '30%'
}) => {
  return (
    <div
      className={`shimmer-container ${className}`}
      style={{
        '--shimmer-duration': duration,
        '--shimmer-color': color,
        '--shimmer-angle': angle,
        '--shimmer-width': width
      }}
    >
      {children}
      <div className="shimmer-effect" />
    </div>
  );
};

export default Shimmer;
