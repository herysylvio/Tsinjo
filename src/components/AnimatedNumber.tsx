import { useEffect, useRef } from 'react';
import { useMotionValue, useTransform, animate } from 'framer-motion';

interface AnimatedNumberProps {
  value: number;
  prefix?: string;
  suffix?: string;
  className?: string;
  duration?: number;
}

const AnimatedNumber = ({ value, prefix = '', suffix = '', className = '', duration = 1.2 }: AnimatedNumberProps) => {
  const motionValue = useMotionValue(0);
  const nodeRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const controls = animate(motionValue, value, {
      duration,
      ease: [0.25, 0.46, 0.45, 0.94],
      onUpdate: (v) => {
        if (nodeRef.current) {
          nodeRef.current.textContent = `${prefix}${Math.round(v).toLocaleString()}${suffix}`;
        }
      },
    });
    return controls.stop;
  }, [value, duration, motionValue, prefix, suffix]);

  return <span ref={nodeRef} className={className}>{prefix}0{suffix}</span>;
};

export default AnimatedNumber;
