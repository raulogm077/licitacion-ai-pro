import { useEffect, useState } from 'react';
import { PliegoVM } from '../../model/pliego-vm';
import { cn } from '../../../../lib/utils'; // Assuming utils exists here or standard place

interface StickySubnavProps {
    vm: PliegoVM;
}

export function StickySubnav({ vm }: StickySubnavProps) {
    const [activeSection, setActiveSection] = useState<string>('resumen');

    const scrollTo = (id: string) => {
        const element = document.getElementById(id);
        if (element) {
            // Offset for header (64px) + subnav (48px) + padding (24px) ≈ 140px
            const offset = 140;
            const bodyRect = document.body.getBoundingClientRect().top;
            const elementRect = element.getBoundingClientRect().top;
            const elementPosition = elementRect - bodyRect;
            const offsetPosition = elementPosition - offset;

            window.scrollTo({
                top: offsetPosition,
                behavior: 'smooth'
            });
            setActiveSection(id);
        }
    };

    // Spy on scroll to update active section
    useEffect(() => {
        const handleScroll = () => {
            const sections = vm.chapters.map(c => c.id);
            const scrollPosition = window.scrollY + 200; // Offset for detection

            for (const section of sections) {
                const element = document.getElementById(section);
                if (element && element.offsetTop <= scrollPosition) {
                    setActiveSection(section);
                }
            }
        };

        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, [vm.chapters]);

    return (
        <nav className="sticky top-16 z-30 bg-white/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 transition-all">
            <div className="max-w-[1100px] mx-auto px-6">
                <ul className="flex items-center gap-6 overflow-x-auto no-scrollbar h-12">
                    {vm.chapters.map(chapter => (
                        <li key={chapter.id} className="shrink-0">
                            <button
                                onClick={() => scrollTo(chapter.id)}
                                className={cn(
                                    "text-sm font-medium transition-colors relative py-3.5",
                                    activeSection === chapter.id
                                        ? "text-brand-600 dark:text-brand-400"
                                        : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
                                )}
                            >
                                {chapter.label}
                                {activeSection === chapter.id && (
                                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-brand-600 rounded-t-full" />
                                )}
                            </button>
                        </li>
                    ))}
                </ul>
            </div>
        </nav>
    );
}
