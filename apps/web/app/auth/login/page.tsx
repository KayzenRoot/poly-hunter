export const metadata = {
  title: "PolyHunter sign in",
};

/**
 * Minimal login shell (PH-M01-WO-002 scope: intentionally minimal, not M08).
 * The provider flow is started server-side by /api/auth/login.
 */
export default function LoginPage() {
  return (
    <main>
      <h1>PolyHunter sign in</h1>
      <p>
        <a href="/api/auth/login?returnTo=%2F">
          Entrar com o provedor de identidade
        </a>
      </p>
      <p>
        Autenticação depende de configuração do provedor; sem configuração, o
        login retorna indisponível (fail closed).
      </p>
    </main>
  );
}
