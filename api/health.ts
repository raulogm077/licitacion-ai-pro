import express from 'express';

const app = express();

// Health check endpoint
app.get('/api/health', (req, res) => {
    const health = {
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: process.env.NODE_ENV || 'development',
        version: process.env.npm_package_version || '1.0.0'
    };

    res.status(200).json(health);
});

// Readiness check (checks critical dependencies)
app.get('/api/ready', async (req, res) => {
    try {
        // Check Supabase connection
        const supabaseReady = process.env.VITE_SUPABASE_URL && process.env.VITE_SUPABASE_ANON_KEY;

        if (!supabaseReady) {
            throw new Error('Supabase not configured');
        }

        res.status(200).json({
            status: 'ready',
            timestamp: new Date().toISOString(),
            checks: {
                supabase: supabaseReady
            }
        });
    } catch (error) {
        res.status(503).json({
            status: 'not ready',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});

export default app;
