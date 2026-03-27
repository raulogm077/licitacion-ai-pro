import { createClient } from '@supabase/supabase-js';
import { env } from './src/config/env.js';
import dotenv from 'dotenv';
dotenv.config();

const URL = process.env.VITE_SUPABASE_URL || 'https://qsohtrvnlimymwdxiokm.supabase.co';
const KEY = process.env.VITE_SUPABASE_ANON_KEY || 'ey...';

const supabase = createClient(URL, KEY);

async function check() {
    // We will sign up a test user to get a fresh token
    const testEmail = 'script-test-' + Date.now() + '@example.com';
    const { data: authData, error: authError } = await supabase.auth.signUp({
        email: testEmail,
        password: 'Password123!',
    });
    
    if (authError) {
        console.error('Signup error:', authError);
        return;
    }
    
    const token = authData.session?.access_token;
    console.log('Got token. Length:', token?.length);
    
    // Call the edge function manually via fetch
    const functionUrl = `${URL}/functions/v1/analyze-with-agents`;
    console.log('Calling:', functionUrl);
    
    const res = await fetch(functionUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
            'apikey': KEY
        },
        body: JSON.stringify({ 
            pdfBase64: 'JVBERi0xLjQNCiUgPDFtdW1teT4NCg==', // Dummy pdf
            filename: 'test.pdf'
        })
    });
    
    console.log('Status:', res.status);
    const text = await res.text();
    console.log('Response:', text);
}

check();
