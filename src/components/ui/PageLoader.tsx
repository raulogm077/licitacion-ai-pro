import { Loader2 } from 'lucide-react';

export const PageLoader = () => (
  <div className="flex justify-center items-center h-full min-h-[50vh]">
    <div className="flex flex-col items-center gap-4">
      <Loader2 className="w-8 h-8 text-brand-600 animate-spin" />
      <p className="text-sm text-slate-500">Cargando módulo...</p>
    </div>
  </div>
);
