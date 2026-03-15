import { Badge } from '../../../components/ui/Badge';

interface TitleSlideProps {
    titulo: string;
    tags?: string[];
}

export function TitleSlide({ titulo, tags }: TitleSlideProps) {
    return (
        <section className="text-center py-20">
            <h1 className="text-5xl font-bold text-slate-900 dark:text-white mb-6">
                {titulo}
            </h1>
            <div className="flex flex-wrap justify-center gap-3">
                {tags && tags.map((tag, idx) => (
                    <Badge key={idx} variant="default" className="text-sm px-4 py-2">
                        {tag}
                    </Badge>
                ))}
            </div>
        </section>
    );
}
