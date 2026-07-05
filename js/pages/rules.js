/** Página estática com regras e termos da plataforma. */
export async function renderRules(main) {
  main.innerHTML = `
    <div class="container-wide" style="padding:2rem 1rem 3rem;max-width:48rem">
      <a href="#/" style="display:inline-block;margin-bottom:1.5rem;font-size:0.875rem;color:var(--text-secondary)">← Voltar para as lojas</a>
      <div style="padding:2rem;border:1px solid var(--border);border-radius:var(--radius-xl);background:var(--surface)">
        <h1 style="font-size:1.75rem;margin-bottom:1rem">Regras da Plataforma</h1>

        <section style="margin-bottom:1.5rem">
          <h2 style="font-size:1.125rem;margin-bottom:0.5rem">1. Sobre o MaredeVendas</h2>
          <p style="color:var(--text-secondary);font-size:0.9375rem">Marketplace local que conecta clientes a lojas da região. Pedidos são finalizados via WhatsApp — não há pagamento in-app.</p>
        </section>

        <section style="margin-bottom:1.5rem">
          <h2 style="font-size:1.125rem;margin-bottom:0.5rem">2. Clientes</h2>
          <ul style="color:var(--text-secondary);font-size:0.9375rem;padding-left:1.25rem;display:flex;flex-direction:column;gap:0.375rem">
            <li>Não é obrigatório criar conta para comprar.</li>
            <li>Conta gratuita permite favoritar lojas e pré-preencher dados no checkout.</li>
            <li>Combine entrega e pagamento diretamente com a loja no WhatsApp.</li>
          </ul>
        </section>

        <section style="margin-bottom:1.5rem">
          <h2 style="font-size:1.125rem;margin-bottom:0.5rem">3. Lojistas</h2>
          <ul style="color:var(--text-secondary);font-size:0.9375rem;padding-left:1.25rem;display:flex;flex-direction:column;gap:0.375rem">
            <li>Cadastro sujeito à aprovação do administrador.</li>
            <li>Informações da loja devem ser verdadeiras e atualizadas.</li>
            <li>Produtos com preço e estoque corretos.</li>
            <li>WhatsApp deve estar ativo para receber pedidos.</li>
          </ul>
        </section>

        <section>
          <h2 style="font-size:1.125rem;margin-bottom:0.5rem">4. Conduta</h2>
          <p style="color:var(--text-secondary);font-size:0.9375rem">Conteúdo ilegal, discriminatório ou enganoso será removido. Lojas podem ser bloqueadas em caso de violação.</p>
        </section>
      </div>
    </div>
  `
}