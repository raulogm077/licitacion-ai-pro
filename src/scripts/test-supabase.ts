import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

// Load environment variables from .env file
config();

/**
 * Diagnostic script to verify Supabase connectivity and RLS policies.
 * 
 * Run with: npx tsx src/scripts/test-supabase.ts
 */

interface TestResult {
    test: string;
    passed: boolean;
    details?: string;
    error?: string;
}

async function testSupabase() {
    console.log('🔍 SUPABASE DIAGNOSTIC SCRIPT\n');
    console.log('='.repeat(50) + '\n');

    const results: TestResult[] = [];

    // 1. Verify environment variables
    console.log('📋 Step 1: Checking environment variables...');
    const supabaseUrl = process.env.VITE_SUPABASE_URL;
    const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
        results.push({
            test: 'Environment Variables',
            passed: false,
            error: 'Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY'
        });
        console.error('   ❌ Missing environment variables\n');
        printResults(results);
        process.exit(1);
    }

    console.log('   ✅ Environment variables found');
    console.log(`   📍 URL: ${supabaseUrl}`);
    console.log(`   🔑 Anon Key: ${supabaseAnonKey.substring(0, 20)}...\n`);

    results.push({
        test: 'Environment Variables',
        passed: true,
        details: 'All required variables present'
    });

    // 2. Initialize Supabase client
    console.log('📋 Step 2: Initializing Supabase client...');
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
            persistSession: false,
            autoRefreshToken: false
        }
    });
    console.log('   ✅ Client initialized\n');

    results.push({
        test: 'Client Initialization',
        passed: true
    });

    // 3. Test database connectivity
    console.log('📋 Step 3: Testing database connectivity...');
    try {
        const { data, error } = await supabase
            .from('licitaciones')
            .select('count', { count: 'exact', head: true });

        if (error) {
            throw error;
        }

        console.log('   ✅ Successfully connected to database');
        console.log(`   📊 Current record count: ${data || 0}\n`);

        results.push({
            test: 'Database Connectivity',
            passed: true,
            details: `Connected successfully. Records: ${data || 0}`
        });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
        console.error('   ❌ Database connection failed');
        console.error(`   Error: ${error.message}\n`);

        results.push({
            test: 'Database Connectivity',
            passed: false,
            error: error.message
        });
    }

    // 4. Test authentication status
    console.log('📋 Step 4: Checking authentication status...');
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
        console.log('   ⚠️  No authenticated user (using anon key)');
        console.log('   ℹ️  This means RLS policies requiring auth.uid() will block writes\n');

        results.push({
            test: 'Authentication Status',
            passed: true,
            details: 'No user authenticated (anon mode)'
        });
    } else {
        console.log(`   ✅ Authenticated as: ${user.email}`);
        console.log(`   👤 User ID: ${user.id}\n`);

        results.push({
            test: 'Authentication Status',
            passed: true,
            details: `Authenticated as ${user.email}`
        });
    }

    // 5. Test write permissions (this is the critical test)
    console.log('📋 Step 5: Testing write permissions...');
    const testData = {
        hash: `test-${Date.now()}`,
        file_name: 'diagnostic-test.pdf',
        data: {
            datosGenerales: {
                titulo: 'Test Diagnostic',
                presupuesto: 1000,
                moneda: 'EUR',
                plazoEjecucionMeses: 12,
                cpv: [],
                organoContratacion: 'Test'
            },
            criteriosAdjudicacion: {
                subjetivos: [],
                objetivos: []
            },
            restriccionesYRiesgos: {
                killCriteria: [],
                riesgos: [],
                penalizaciones: []
            }
        }
    };

    try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if (!(global as any).window) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (global as any).window = undefined;
        }
        const { data: insertedData, error: insertError } = await supabase
            .from('licitaciones')
            .insert([testData])
            .select()
            .single();

        if (insertError) {
            throw insertError;
        }

        console.log('   ✅ Successfully inserted test record');
        console.log(`   📝 Record ID: ${insertedData.id}\n`);

        results.push({
            test: 'Write Permissions',
            passed: true,
            details: `Successfully inserted record ${insertedData.id}`
        });

        // Clean up test record
        console.log('📋 Step 6: Cleaning up test record...');
        const { error: deleteError } = await supabase
            .from('licitaciones')
            .delete()
            .eq('id', insertedData.id);

        if (deleteError) {
            console.log(`   ⚠️  Could not delete test record: ${deleteError.message}`);
        } else {
            console.log('   ✅ Successfully deleted test record\n');
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
        console.error('   ❌ Write operation failed');
        console.error(`   Error: ${error.message}`);
        console.error(`   Code: ${error.code}`);
        console.error(`   Details: ${error.details}\n`);

        results.push({
            test: 'Write Permissions',
            passed: false,
            error: `${error.code}: ${error.message} - ${error.details || 'No details'}`
        });

        // Provide more diagnostic info for common errors
        if (error.code === '42501' || error.message.includes('policy')) {
            console.log('   🔍 DIAGNOSIS:');
            console.log('   This is an RLS policy violation.');
            console.log('   The table requires auth.uid() but no user is authenticated.');
            console.log('   \n   SOLUTIONS:');
            console.log('   1. Implement user authentication in your app');
            console.log('   2. Temporarily disable RLS for testing:');
            console.log('      ALTER TABLE public.licitaciones DISABLE ROW LEVEL SECURITY;');
            console.log('   3. Create a policy that allows anon insertions (NOT RECOMMENDED for production)\n');
        }
    }

    // Print summary
    printResults(results);

    // Exit with appropriate code
    const allPassed = results.every(r => r.passed);
    process.exit(allPassed ? 0 : 1);
}

function printResults(results: TestResult[]) {
    console.log('\n' + '='.repeat(50));
    console.log('📊 DIAGNOSTIC SUMMARY');
    console.log('='.repeat(50) + '\n');

    results.forEach((result, index) => {
        const status = result.passed ? '✅ PASSED' : '❌ FAILED';
        console.log(`${index + 1}. ${result.test}: ${status}`);

        if (result.details) {
            console.log(`   └─ ${result.details}`);
        }

        if (result.error) {
            console.log(`   └─ Error: ${result.error}`);
        }

        console.log('');
    });

    const passedCount = results.filter(r => r.passed).length;
    const totalCount = results.length;
    const successRate = ((passedCount / totalCount) * 100).toFixed(0);

    console.log(`Overall: ${passedCount}/${totalCount} tests passed (${successRate}%)\n`);

    if (passedCount === totalCount) {
        console.log('🎉 All diagnostics passed!\n');
    } else {
        console.log('⚠️  Some diagnostics failed. See details above.\n');
    }
}

// Run the diagnostic
testSupabase().catch((err) => {
    console.error('Fatal error:', err);
    process.exit(1);
});
