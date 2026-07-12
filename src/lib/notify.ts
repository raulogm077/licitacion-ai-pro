import { toast } from 'sonner';

/**
 * Single notification entry point for the app. Replaces the ad-hoc inline
 * banners so success/error/info feedback is consistent and non-blocking.
 */
export const notify = {
    success: (message: string, description?: string) => toast.success(message, { description }),
    error: (message: string, description?: string) => toast.error(message, { description }),
    info: (message: string, description?: string) => toast(message, { description }),
    warning: (message: string, description?: string) => toast.warning(message, { description }),
};
