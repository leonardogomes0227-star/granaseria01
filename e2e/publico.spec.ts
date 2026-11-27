import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('gs-painel-token', 'token-de-teste-do-e2e-123456');
    localStorage.setItem('gs-nome', 'Ana');
    localStorage.setItem('gs-sons', '0');
  });
});

test('páginas públicas têm título, FAQ e página de obrigado', async ({ page }) => {
  await page.goto('/faq');
  await expect(page).toHaveTitle(/Perguntas frequentes/);
  await expect(page.locator('summary')).toHaveCount(8);
  await page.goto('/obrigado');
  await expect(page.getByRole('heading', { name: 'Recebemos o seu pedido' })).toBeVisible();
  await page.goto('/esta-pagina-nao-existe');
  await expect(page.getByRole('heading', { name: 'Esse endereço não existe.' })).toBeVisible();
  await page.getByRole('link', { name: 'Voltar ao início' }).click();
  await expect(page).toHaveURL('/');
});

test('privacidade, termos e planos abrem', async ({ page }) => {
  await page.goto('/politica-de-privacidade');
  await expect(page.getByRole('heading', { name: 'Política de privacidade' })).toBeVisible();
  await expect(page.getByText('LGPD')).toBeVisible();
  await page.goto('/termos-de-uso');
  await expect(page.getByRole('heading', { name: 'Termos de uso' })).toBeVisible();
  await page.goto('/planos');
  await expect(page.getByRole('heading', { name: 'Planos' })).toBeVisible();
});

const TELAS = ['/lancamentos', '/pagar', '/plano/dividas', '/plano/orcamento', '/guardar', '/relatorios', '/perfil', '/dados', '/coach'];

test('telas do app abrem com o login local e têm um título', async ({ page }) => {
  for (const rota of TELAS) {
    await page.goto(rota);
    await expect(page.locator('h1, h2').first()).toBeVisible();
    const titulo = await page.title();
    expect(titulo.length, rota).toBeGreaterThan(5);
  }
});

test('atalho de busca e link de pular existem', async ({ page }) => {
  await page.goto('/perfil');
  await expect(page.getByRole('link', { name: 'Pular para o conteúdo' })).toBeAttached();
  await page.keyboard.press('Control+K');
  await expect(page.getByRole('dialog').or(page.locator('[role="search"], input[type="search"], input[placeholder]')).first()).toBeVisible();
});
