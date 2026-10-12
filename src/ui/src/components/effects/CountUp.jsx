'use client';

/**
 * CountUp Component - 数字滚动动画
 * 来自 react-bits,使用 framer-motion
 * 使用场景: 统计数字、任务计数、Token使用量
 *
 * 注意: 需要先安装 framer-motion
 * npm install framer-motion
 */
import { useEffect, useRef } from 'react';
import { useInView, useMotionValue, useSpring } from 'framer-motion';

export default function CountUp({
  to,
  from = 0,
  direction = 'up',
  delay = 0,
  duration = 1.5, // 降低默认时长,更敏捷
  className = '',
  startWhen = true,
  separator = ',', // 默认使用千分位分隔符
  onStart = undefined,
  onEnd = undefined
}) {
  const ref = useRef(null);
  const motionValue = useMotionValue(direction === 'down' ? to : from);

  // 根据duration调整弹簧参数
  const damping = 20 + 40 * (1 / duration);
  const stiffness = 100 * (1 / duration);

  const springValue = useSpring(motionValue, {
    damping,
    stiffness
  });

  const isInView = useInView(ref, { once: true, margin: '0px' });

  // 获取小数位数
  const getDecimalPlaces = num => {
    const str = num.toString();
    if (str.includes('.')) {
      const decimals = str.split('.')[1];
      if (parseInt(decimals) !== 0) {
        return decimals.length;
      }
    }
    return 0;
  };

  const maxDecimals = Math.max(getDecimalPlaces(from), getDecimalPlaces(to));

  // 初始化显示
  useEffect(() => {
    if (ref.current) {
      ref.current.textContent = String(direction === 'down' ? to : from);
    }
  }, [from, to, direction]);

  // 触发动画
  useEffect(() => {
    if (isInView && startWhen) {
      if (typeof onStart === 'function') onStart();

      const timeoutId = setTimeout(() => {
        motionValue.set(direction === 'down' ? from : to);
      }, delay * 1000);

      const durationTimeoutId = setTimeout(
        () => {
          if (typeof onEnd === 'function') onEnd();
        },
        delay * 1000 + duration * 1000
      );

      return () => {
        clearTimeout(timeoutId);
        clearTimeout(durationTimeoutId);
      };
    }
  }, [isInView, startWhen, motionValue, direction, from, to, delay, onStart, onEnd, duration]);

  // 更新显示
  useEffect(() => {
    const unsubscribe = springValue.on('change', latest => {
      if (ref.current) {
        const hasDecimals = maxDecimals > 0;

        const options = {
          useGrouping: !!separator,
          minimumFractionDigits: hasDecimals ? maxDecimals : 0,
          maximumFractionDigits: hasDecimals ? maxDecimals : 0
        };

        const formattedNumber = Intl.NumberFormat('en-US', options).format(latest);
        ref.current.textContent = separator ? formattedNumber.replace(/,/g, separator) : formattedNumber;
      }
    });

    return () => unsubscribe();
  }, [springValue, separator, maxDecimals]);

  return <span className={className} ref={ref} />;
}

/**
 * 使用示例:
 *
 * import CountUp from './components/CountUp';
 *
 * // 基础用法
 * <CountUp to={12345} />
 *
 * // 带千分位
 * <CountUp to={stats.total_tokens} separator="," duration={2} />
 *
 * // 倒计时
 * <CountUp from={100} to={0} direction="down" />
 *
 * // 小数
 * <CountUp to={98.5} from={0} />
 */
