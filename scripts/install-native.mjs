import { execSync } from 'node:child_process';

if (process.platform === 'win32') {
  try {
    console.log('[top-cast] Windows detectado: compilando módulo nativo audio_loopback...');
    execSync('npx --no-install node-gyp rebuild', { stdio: 'inherit', shell: true });
  } catch (error) {
    console.warn(
      '[top-cast] Aviso: Não foi possível compilar o módulo nativo audio_loopback (opcional). ' +
      'A aplicação continuará funcionando utilizando o loopback padrão do sistema.',
      error instanceof Error ? error.message : error
    );
  }
} else {
  console.log('[top-cast] Plataforma não-Windows detectada (ex: Linux no Render). Pulando compilação de módulo nativo Windows.');
}
