import fs from 'fs';
let content = fs.readFileSync('src/features/auth/__tests__/AuthFlow.test.tsx', 'utf8');

// I am trying to rewrite the tests so they match the exact new UI

const authFlowTests = `describe('Auth Validation Flow', () => {
    const mockSignInWithPassword = vi.fn();
    const mockSignUp = vi.fn();
    const mockSignOut = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
        const mockStore = {
            isAuthenticated: false,
            user: null,
            signInWithPassword: mockSignInWithPassword,
            signUp: mockSignUp,
            signOut: mockSignOut,
            signInWithMagicLink: vi.fn().mockResolvedValue({ success: true })
        };
        vi.mocked(AuthStore.useAuthStore).mockReturnValue(mockStore as unknown as any);
        AuthStore.useAuthStore.getState = vi.fn().mockReturnValue(mockStore);
    });

    it('should show login restrictions when unauthenticated', () => {
        render(
            <BrowserRouter>
                <HomePage />
            </BrowserRouter>
        );
        expect(screen.getByText(/Análisis inteligente de licitaciones/i)).toBeInTheDocument();
    });

    it('should open AuthModal with Password form', async () => {
        render(
            <BrowserRouter>
                <HomePage />
            </BrowserRouter>
        );

        // Upload a dummy file to trigger auth modal
        const fileInput = screen.getByLabelText(/Arrastra el pliego de licitación/i, { selector: 'input[type="file"]' });
        const file = new File(['dummy content'], 'test.pdf', { type: 'application/pdf' });

        fireEvent.change(fileInput, { target: { files: [file] } });

        expect(await screen.findByRole('heading', { name: 'Iniciar Sesión' })).toBeInTheDocument();
        expect(screen.getByPlaceholderText(/••••••••/)).toBeInTheDocument();
    });
`;

content = content.replace(/describe\('Auth Validation Flow', \(\) => \{[\s\S]*?it\('should call signInWithPassword on form submission', async \(\) => \{/m, authFlowTests + "\n    it('should call signInWithPassword on form submission', async () => {");

fs.writeFileSync('src/features/auth/__tests__/AuthFlow.test.tsx', content);
