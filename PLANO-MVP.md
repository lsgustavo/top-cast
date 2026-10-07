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

### Etapa 1 — Plano e critérios de aceite

- [x] Registrar estado atual, escopo, limitações e etapas restantes neste arquivo.
- [x] Manter os passos externos separados do que pode ser implementado no código.
- [x] Commit próprio do plano.

### Etapa 2 — Credenciais TURN temporárias no signaling

- [ ] Adicionar geração de credenciais TURN REST temporárias compatíveis com
  Coturn, usando segredo somente no servidor.
- [ ] Validar e documentar as variáveis de ambiente necessárias; sem segredo
  configurado, manter apenas STUN e deixar explícita a limitação.
- [ ] Permitir solicitar configuração ICE apenas a um socket que já pertença a
  uma sala; limitar pedidos repetidos.
- [ ] Adicionar testes para URLs/configuração, assinatura e expiração das
  credenciais.
- [ ] Commit próprio após testes.

### Etapa 3 — Usar TURN/STUN no WebRTC

- [ ] Buscar a configuração ICE autenticada pela participação na sala antes de
  criar cada RTCPeerConnection.
- [ ] Aplicá-la em conexões host e convidados e preservar renegociação/restart
  ICE sem reutilizar configurações vazias por engano.
- [ ] Tratar indisponibilidade do serviço ICE com estado/erro explícito, sem
  simular sucesso.
- [ ] Cobrir as regras de seleção/configuração com testes e validar build.
- [ ] Commit próprio após validação.

### Etapa 4 — Estabilização de conexão e participantes

- [ ] Verificar que estados de participantes e conexões refletem conexões e
  desconexões reais, inclusive entrada/saída e falha WebRTC.
- [ ] Revisar reconexão do signaling, retorno do host com novo convite,
  reentrada de convidados e encerramento/expiração da sala.
- [ ] Corrigir os casos reproduzíveis e cobrir a lógica com testes.
- [ ] Commit próprio após validação.

### Etapa 5 — Testes de ponta a ponta e critérios de rede

- [ ] Adicionar o máximo de testes automatizados viáveis para criação/entrada,
  signaling autorizado, erro e encerramento.
- [ ] Executar `npm test` e `npm run build:windows`.
- [ ] Testar manualmente em dois computadores, em redes distintas, com TURN
  obrigatório (validar também a seleção relay no diagnóstico WebRTC).
- [ ] Registrar qualquer limitação reproduzível e corrigir antes de aceitar o
  MVP.
- [ ] Commit próprio para alterações automatizáveis. O teste em outra máquina é
  um gate manual e só pode ser marcado como feito após execução real.

### Etapa 6 — Build e distribuição Windows

- [ ] Garantir que o instalador use o endereço HTTPS/WSS do signaling publicado,
  sem URLs de desenvolvimento ou segredos do servidor embutidos.
- [ ] Gerar instalador e testar instalação, inicialização, desinstalação e
  compartilhamento em uma máquina Windows limpa.
- [ ] Definir assinatura de código e atualização automática como requisitos de
  distribuição pública; esses itens dependem de certificado/infraestrutura.
- [ ] Commit próprio para alterações de build/documentação; validar o artefato
  local sem afirmar validação em máquina que não foi testada.

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
