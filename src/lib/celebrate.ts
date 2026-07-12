/**
 * Fires the analysis-completed celebration: a short, brand-colored confetti
 * burst. Loads `canvas-confetti` on demand (keeps it out of the main bundle)
 * and no-ops when the user prefers reduced motion.
 */
export async function celebrateAnalysisComplete(): Promise<void> {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const { default: confetti } = await import('canvas-confetti');
    const colors = ['#6366f1', '#8b5cf6', '#d946ef', '#a5b4fc'];

    confetti({ particleCount: 80, spread: 70, origin: { x: 0.5, y: 0.35 }, colors, disableForReducedMotion: true });
    setTimeout(() => {
        confetti({ particleCount: 40, angle: 60, spread: 55, origin: { x: 0, y: 0.6 }, colors });
        confetti({ particleCount: 40, angle: 120, spread: 55, origin: { x: 1, y: 0.6 }, colors });
    }, 250);
}
