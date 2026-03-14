// Fix framer-motion type compatibility with React 19
// The motion.div etc. components lose their HTML attribute types
// when framer-motion types conflict with React 19's ref types.
import 'framer-motion';

declare module 'framer-motion' {
  interface MotionProps {
    className?: string;
    initial?: any;
    animate?: any;
    exit?: any;
    transition?: any;
    variants?: any;
    whileHover?: any;
    whileTap?: any;
    whileInView?: any;
    viewport?: any;
    layout?: any;
    layoutId?: string;
    key?: any;
    style?: any;
    children?: React.ReactNode;
    onClick?: any;
    onMouseEnter?: any;
    onMouseLeave?: any;
    onHoverStart?: any;
    onHoverEnd?: any;
    drag?: any;
    dragConstraints?: any;
    role?: string;
    id?: string;
    tabIndex?: number;
    'aria-label'?: string;
    [key: string]: any;
  }

  // Allow motion components to accept any HTML props
  interface HTMLMotionProps<T> {
    [key: string]: any;
  }
}
