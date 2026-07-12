import { useEffect, useRef, useState, type ReactNode } from 'react';
import { LazyMotion, animate, domAnimation, m, useReducedMotion, type Variants } from 'motion/react';

/**
 * App-level motion provider. Loads the animation feature bundle lazily (so the
 * `m` components stay tree-shakeable) and routes `reducedMotion` to the user's
 * OS preference, matching the CSS guard in `index.css`.
 */
export function MotionProvider({ children }: { children: ReactNode }) {
    return (
        <LazyMotion features={domAnimation} strict>
            {children}
        </LazyMotion>
    );
}

const fadeVariants: Variants = {
    hidden: { opacity: 0, y: 8 },
    show: { opacity: 1, y: 0 },
};

type FadeInProps = {
    children: ReactNode;
    /** Delay in seconds before the entrance plays. */
    delay?: number;
    className?: string;
};

/** Single element that fades and lifts into place on mount. */
export function FadeIn({ children, delay = 0, className }: FadeInProps) {
    const reduce = useReducedMotion();
    return (
        <m.div
            className={className}
            variants={fadeVariants}
            initial={reduce ? false : 'hidden'}
            animate="show"
            transition={{ duration: 0.5, delay, ease: [0.22, 1, 0.36, 1] }}
        >
            {children}
        </m.div>
    );
}

type StaggerProps = {
    children: ReactNode;
    /** Seconds between each child's entrance. */
    stagger?: number;
    className?: string;
};

/** Container that reveals its `StaggerItem` children one after another. */
export function Stagger({ children, stagger = 0.08, className }: StaggerProps) {
    const reduce = useReducedMotion();
    return (
        <m.div
            className={className}
            initial={reduce ? false : 'hidden'}
            animate="show"
            variants={{ show: { transition: { staggerChildren: reduce ? 0 : stagger } } }}
        >
            {children}
        </m.div>
    );
}

/** Child of `Stagger`; inherits the container's reveal timing. */
export function StaggerItem({ children, className }: { children: ReactNode; className?: string }) {
    return (
        <m.div className={className} variants={fadeVariants} transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}>
            {children}
        </m.div>
    );
}

type CountUpProps = {
    /** Final numeric value to reach. */
    value: number;
    /** Turns the intermediate number into display text (e.g. currency). */
    format: (value: number) => string;
    className?: string;
};

/** Animates a number from 0 to `value` on mount; static when motion is reduced. */
export function CountUp({ value, format, className }: CountUpProps) {
    const reduce = useReducedMotion();
    const [display, setDisplay] = useState(() => (reduce ? format(value) : format(0)));
    const formatRef = useRef(format);
    formatRef.current = format;

    useEffect(() => {
        if (reduce) {
            setDisplay(formatRef.current(value));
            return;
        }
        const controls = animate(0, value, {
            duration: 1,
            ease: [0.22, 1, 0.36, 1],
            onUpdate: (latest) => setDisplay(formatRef.current(latest)),
        });
        return () => controls.stop();
    }, [value, reduce]);

    return <span className={className}>{display}</span>;
}
