import { LicitacionData } from '../types';

export const syncService = {
    async syncLicitacion(hash: string, fileName: string, data: LicitacionData) {
        try {
            const { collection, addDoc } = await import('firebase/firestore');
            const { db } = await import('./firebase');

            await addDoc(collection(db, 'licitaciones'), {
                ...data,
                fileName,
                hash,
                createdAt: new Date(),
                userId: 'anonymous'
            });
            console.log("Sincronizado con Firestore");
            return true;
        } catch (error) {
            console.warn("No se pudo sincronizar con la nube (posiblemente falta config o permisos):", error);
            return false;
        }
    }
};
