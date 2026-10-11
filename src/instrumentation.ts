// Roda uma vez quando o servidor sobe (não na compilação).
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  if (process.env.ADMIN_EMAIL) {
    const { garantirAdministradorComEspera } = await import('./lib/primeiro-admin');
    // Sem "await": o servidor começa a atender enquanto a conferência acontece ao fundo.
    void garantirAdministradorComEspera();
  }
  // Lembretes por e-mail das aulas ao vivo (24 horas e 1 hora antes).
  const { ligarLembretes } = await import('./lib/lembretes');
  ligarLembretes();
}
