// Roda uma vez quando o servidor sobe (não na compilação).
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  if (!process.env.ADMIN_EMAIL) return;
  const { garantirAdministradorComEspera } = await import('./lib/primeiro-admin');
  // Sem "await": o servidor começa a atender enquanto a conferência acontece ao fundo.
  void garantirAdministradorComEspera();
}
