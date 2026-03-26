export default function AuthLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className="min-h-screen grid place-items-center px-4"
            style={{
                background: "radial-gradient(ellipse at top, #1a1f0a 0%, #0f0f0f 60%)",
            }}
        >
            <div className="w-full max-w-md">
                <div className="mb-8 text-center">
                    <h1 className="text-4xl" style={{ fontFamily: "var(--font-display)" }}>
                        Expensify
                    </h1>
                    <p className="text-text-muted text-sm mt-2">
                        Multi-tenant expense management
                    </p>
                </div>
                {children}
            </div>
        </div>
    );
}