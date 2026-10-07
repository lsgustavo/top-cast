# Plano para completar o MVP do TopCast

Este documento transforma o roadmap inicial em etapas verificáveis, considerando
o código que já existe. O objetivo é completar um MVP utilizável para transmissão
de tela entre computadores Windows, sem incluir funcionalidades futuras que não
são necessárias para validar o produto.

## Estado atual

Já existem:

- aplicativo Electron com interface React, TypeScript e Tailwind;
- fluxos para criar e entrar em salas;
- signaling Socket.IO e salas em memória com convites de 24 horas e limite de
  dez participantes;
- conexões WebRTC host-para-participantes, captura de tela/janela, microfone
  opcional e captura opcional do áudio de saída do Windows;
- reconexão básica, testes unitários do serviço de salas e validação de payloads;
- build Windows NSIS e instalador gerável por script.

Isso é uma base funcional, mas não comprova funcionamento confiável entre redes
nem distribuição pronta para usuários.

## Escopo do MVP

### Incluído

- criar/entrar/sair de uma sala privada de até dez pessoas;
- transmitir a tela ou uma janela a até nove espectadores;
- vídeo inicial até 720p/30 FPS;
- microfone desligado por padrão e áudio do sistema opcional;
- comunicação entre redes diferentes usando signaling publicado em HTTPS/WSS e
  TURN configurado;
- mensagens compreensíveis para falhas de conexão e captura;
- testes automatizados das regras críticas e validação manual entre computadores;
- instalador Windows funcional, com instruções para configuração e distribuição.

### Limite conhecido de áudio

O MVP **não promete excluir Discord, Teams, Skype ou outros processos** do áudio
capturado. A captura padrão de loopback do Electron representa a saída geral do
Windows; selecionar uma janela não isola o áudio dela. O áudio do sistema deve
continuar desligado por padrão/opt-in e explicar que pode incluir chamadas.

Captura seletiva por processo via WASAPI exigiria um componente nativo,
identificação confiável dos processos e sincronização de áudio/vídeo. Isso fica
fora do MVP até que uma etapa própria de pesquisa e prototipação seja aprovada.

## Etapas e critérios de conclusão

Cada etapa de implementação deve ser validada antes de ser considerada concluída
e receber um commit próprio. Não incluir mudanças preexistentes ou arquivos
alheios ao escopo nesses commits.

## Funcionalidades incrementais solicitadas

- [x] Atualizar serviço para sala global única, convite de seis caracteres,
  estado global em tempo real, expulsão e transferência de host em desconexão.
- [x] Solicitar nome de exibição na tela inicial e refletir disponibilidade
  global no botão de criar sala.
- [x] Adicionar timer de expiração, toast de cópia, badges de host/usuário,
  avatar gerado localmente e presença com cores/status.
- [x] Adicionar sons sutis de entrada/saída.
- [x] Adicionar atalho global Ctrl+Shift+L e notificação nativa quando o app
  está minimizado.
- [x] Cobrir as regras de sala, expulsão, sucessão, contagem regressiva,
  mudanças de participantes e fluxo real de signaling com testes.
- [x] Registrar os controles e limites em [docs/room-controls.md](./docs/room-controls.md).
- [x] Commits isolados para cada grupo de funcionalidades.

### Etapa 1 — Plano e critérios de aceite

- [x] Registrar estado atual, escopo, limitações e etapas restantes neste arquivo.
- [x] Manter os passos externos separados do que pode ser implementado no código.
- [x] Commit próprio do plano.

### Etapa 2 — Credenciais TURN temporárias no signaling

- [x] Adicionar geração de credenciais TURN REST temporárias compatíveis com
  Coturn, usando segredo somente no servidor.
- [x] Validar e documentar as variáveis de ambiente necessárias; sem segredo
  configurado, manter apenas STUN e deixar explícita a limitação.
- [x] Permitir solicitar configuração ICE apenas a um socket que já pertença a
  uma sala; limitar pedidos repetidos.
- [x] Adicionar testes para URLs/configuração, assinatura e expiração das
  credenciais.
- [x] Commit próprio após testes (`036f5dc`).

### Etapa 3 — Usar TURN/STUN no WebRTC

- [x] Buscar a configuração ICE autenticada pela participação na sala antes de
  criar cada RTCPeerConnection.
- [x] Aplicá-la em conexões host e convidados e preservar renegociação/restart
  ICE sem reutilizar configurações vazias por engano.
- [x] Tratar indisponibilidade do serviço ICE com estado/erro explícito, sem
  simular sucesso.
- [x] Cobrir as regras de seleção/configuração com testes e validar build.
- [x] Commit próprio após validação (`b05bafb`).

### Etapa 4 — Estabilização de conexão e participantes

- [x] Verificar que estados de participantes e conexões refletem conexões e
  desconexões reais, inclusive entrada/saída e falha WebRTC.
- [x] Revisar reconexão do signaling, retorno do host com novo convite,
  reentrada de convidados e encerramento/expiração da sala.
- [x] Corrigir os casos reproduzíveis e cobrir a lógica com testes.
- [x] Commit próprio após validação (`98d3251`).

### Etapa 5 — Testes de ponta a ponta e critérios de rede

- [x] Adicionar o máximo de testes automatizados viáveis para criação/entrada,
  signaling autorizado, erro e encerramento.
- [x] Adicionar `npm run test:signaling-smoke`, que valida com clientes Socket.IO
  reais o fluxo de sala, autorização, configuração ICE e encerramento.
- [x] Executar `npm test` (20 testes passaram) e `npm run build:windows`.
- [x] Executar o smoke test local com TURN_URLS e uma chave de teste
  (valida geração de credenciais, não conectividade com um relay real).
- [ ] Testar manualmente em dois computadores, em redes distintas, com TURN
  obrigatório (validar também a seleção relay no diagnóstico WebRTC).
- [ ] Registrar qualquer limitação reproduzível e corrigir antes de aceitar o
  MVP.
- [x] Commit próprio para alterações automatizáveis (`2f228f4`). O teste em
  outra máquina é um gate manual e só pode ser marcado como feito após execução
  real.

### Etapa 6 — Build e distribuição Windows

- [x] Garantir que o instalador exija um endereço HTTPS do signaling em vez de
  usar o localhost padrão.
- [x] Verificar que a configuração ausente ou HTTP/loopback é recusada antes
  de empacotar.
- [ ] Configurar o endereço HTTPS/WSS real do signaling publicado,
  sem URLs de desenvolvimento ou segredos do servidor embutidos.
- [ ] Gerar o instalador atualizado usando o endereço real e testar instalação,
  inicialização, desinstalação e compartilhamento em uma máquina Windows limpa.
- [ ] Definir assinatura de código e atualização automática como requisitos de
  distribuição pública; esses itens dependem de certificado/infraestrutura.
- [x] Commit próprio para o bloqueio seguro de builds sem configuração de
  produção.

## Variáveis e infraestrutura de produção

O deploy de produção deve fornecer, no mínimo:

- `SIGNALING_HOST` e `SIGNALING_PORT` para o serviço Socket.IO/Fastify;
- proxy TLS que publique signaling como HTTPS/WSS;
- `TURN_URLS` com URLs TURN/TURNS acessíveis pelos clientes;
- `TURN_SHARED_SECRET` guardado somente no servidor e compartilhado com Coturn;
- regras de firewall e monitoramento para signaling e TURN.

As credenciais temporárias devem ser derivadas no servidor pelo mecanismo REST
do Coturn; a chave compartilhada nunca deve ser incluída no renderer, no
instalador ou no repositório. O operador deve validar portas UDP/TCP e teste de
relay a partir de redes externas. O signaling atual mantém salas em memória:
reiniciar o processo encerra as salas; persistência/alta disponibilidade não
fazem parte do MVP.

## Fora do MVP

- contas, login, banco de dados persistente e escalabilidade horizontal;
- captura seletiva/exclusão de áudio por aplicação;
- 1080p/60 FPS, bitrate adaptativo avançado e métricas detalhadas de qualidade;
- chat, gravação, lista de amigos, overlay, bandeja e atalhos configuráveis;
- atualização automática e instalador assinado, até que haja infraestrutura e
  certificado configurados.

## Comandos de validação

```powershell
npm test
npm run build:windows
npm run build:installer
```

`npm run build:windows` verifica os artefatos de compilação. A geração do
instalador não substitui a instalação e o teste em outro computador.
