
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/Card';
import { Badge } from '../../../components/ui/Badge';
import { Users, Tag as TagIcon } from 'lucide-react';
import { AnalyticsService } from '../../../services/analytics.service';
import { AnalyticsData } from '../../../types';

interface TopListsProps {
    analytics: AnalyticsData;
}

export const TopLists: React.FC<TopListsProps> = ({ analytics }) => {
    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Top Clientes */}
            {analytics.topClientes.length > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Users size={18} className="text-brand-600" />
                            Top Clientes
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-3">
                            {analytics.topClientes.map((cliente, idx) => (
                                <div key={idx} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
                                    <div>
                                        <p className="font-medium text-slate-900 dark:text-white">{cliente.cliente}</p>
                                        <p className="text-xs text-slate-500 dark:text-slate-400">
                                            {cliente.count} {cliente.count === 1 ? 'licitación' : 'licitaciones'}
                                        </p>
                                    </div>
                                    <div className="text-right">
                                        <p className="font-bold text-brand-600">
                                            {AnalyticsService.formatCurrency(cliente.total)}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Top Tags */}
            {analytics.topTags.length > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <TagIcon size={18} className="text-brand-600" />
                            Tags Más Usados
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex flex-wrap gap-2">
                            {analytics.topTags.map((tag, idx) => (
                                <Badge
                                    key={idx}
                                    variant="default"
                                    className="text-sm px-3 py-1.5 bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300"
                                >
                                    {tag.tag}
                                    <span className="ml-2 font-bold">{tag.count}</span>
                                </Badge>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
};
