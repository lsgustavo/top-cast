Quero desenvolver do zero um aplicativo desktop para Windows de transmissão de tela, que posteriormente possa ser distribuído como um instalador ou arquivo `.exe`.

Estou começando com um repositório completamente vazio no VS Code. Quero que você atue como um engenheiro de software sênior e me ajude a desenvolver o projeto passo a passo, desde a criação da estrutura inicial até gerar uma versão final instalável.

## 1. Objetivo do aplicativo

O aplicativo deve ser simples, moderno e extremamente fácil de usar, com uma experiência semelhante ao Discord, porém focado exclusivamente em transmissão de tela.

A ideia principal é:

1. O usuário abre o aplicativo.
2. Escolhe entre:

   * **Criar uma sala**
   * **Entrar em uma sala**
3. O host cria uma sala e recebe um código de convite.
4. Outras pessoas entram utilizando esse código.
5. O host escolhe o que deseja transmitir:

   * Uma tela inteira/monitor
   * Uma janela/aplicativo específico
6. Os participantes assistem à transmissão em tempo real.
7. O host pode controlar a transmissão e encerrar a sala.

A sala deve suportar inicialmente de **1 a 10 participantes no máximo**, incluindo o host.

O código de convite deve expirar automaticamente após **24 horas**.

---

# 2. Stack tecnológica

Quero utilizar uma stack moderna, simples de manter e adequada para um aplicativo Electron.

Avalie e, se fizer sentido, utilize:

### Desktop

* Electron
* Electron Forge ou Electron Builder para gerar o instalador `.exe`

### Frontend

* React
* TypeScript
* Vite
* Tailwind CSS
* shadcn/ui

Use o shadcn/ui para criar componentes como:

* Buttons
* Dialogs
* Cards
* Inputs
* Dropdowns
* Tabs
* Toasts
* Tooltips
* Avatars
* Menus

A interface deve ter aparência semelhante à qualidade visual do Discord, mas **não deve copiar o Discord**.

Quero um design:

* Dark mode como padrão
* Moderno
* Minimalista
* Limpo
* Profissional
* Boa hierarquia visual
* Animações discretas
* Sem estética cyberpunk
* Sem excesso de gradientes
* Sem excesso de elementos decorativos

Não utilizar logotipo inicialmente. Onde normalmente existiria um logo, utilizar um ícone simples.

### Comunicação

Avalie a melhor arquitetura para transmissão em tempo real.

Minha preferência inicial é utilizar:

* WebRTC para transmissão de áudio/vídeo
* WebSocket ou Socket.IO para signaling
* STUN para conexão P2P
* TURN como fallback quando conexão P2P direta não for possível

Explique se essa arquitetura é adequada para 1 host + até 9 espectadores.

---

# 3. Funcionalidades principais

## Tela inicial

Ao abrir o aplicativo, mostrar uma interface extremamente simples:

**[ Criar sala ]**

**[ Entrar com código ]**

Também pode existir uma pequena área inferior com:

* versão do aplicativo
* configurações

Não quero uma tela inicial cheia de informações.

---

# 4. Criar sala

Ao clicar em "Criar sala":

O aplicativo deve:

1. Criar uma sala.
2. Gerar um código de convite aleatório.
3. Definir validade de 24 horas.
4. Mostrar o código para o host.
5. Permitir copiar o código.
6. Mostrar quantas pessoas estão conectadas.

Exemplo:

```text
Sua sala está pronta

AB7K-92PX

[ Copiar código ]

Participantes
● Você
○ Aguardando participantes...

[ Iniciar transmissão ]
```

O código deve ser suficientemente aleatório para impedir que alguém consiga adivinhar facilmente uma sala.

O servidor deve validar:

* existência da sala
* expiração
* quantidade máxima de participantes

---

# 5. Entrar em uma sala

Ao clicar em "Entrar com código":

Mostrar um campo:

```text
Código da sala

[ AB7K-92PX ]

[ Entrar ]
```

Se o código for inválido:

```text
Código inválido ou sala inexistente.
```

Se estiver expirado:

```text
Esta sala expirou.
```

Se estiver cheia:

```text
Esta sala já atingiu o limite de participantes.
```

Após entrar, o usuário deve ser levado para a tela da sala.

---

# 6. Transmissão de tela

O host deve poder escolher exatamente o que deseja transmitir.

Opções:

### Tela inteira

Mostrar os monitores disponíveis:

```text
Compartilhar tela

Monitor 1
[preview]

Monitor 2
[preview]
```

### Aplicativo/janela

Mostrar as janelas disponíveis:

```text
Aplicativos

Chrome
Discord
VS Code
Spotify
...
```

Utilizar as APIs adequadas do Electron/Chromium para captura de tela e janela.

A seleção deve ocorrer de maneira clara e simples.

---

# 7. Áudio

O áudio deve estar associado ao conteúdo que está sendo transmitido.

Se o usuário compartilhar:

```text
Chrome
```

deve ser possível transmitir o áudio produzido pelo Chrome.

Se compartilhar:

```text
VS Code
```

normalmente não haverá áudio.

Se compartilhar uma tela inteira, o aplicativo deve capturar o áudio do sistema conforme suportado pelo Windows/Electron.

---

# 8. Problema crítico: eco e duplicação de voz

Essa é uma das funcionalidades mais importantes do projeto.

Quando o usuário compartilhar a tela inteira, não quero que o áudio de aplicativos de comunicação seja retransmitido de forma duplicada.

Por exemplo:

O host está em uma chamada no:

* Discord
* TeamSpeak
* Skype
* Microsoft Teams
* Google Meet
* WhatsApp Desktop
* ou outro aplicativo de voz

Se alguém falar através desses aplicativos, essa voz não deve voltar para a transmissão simplesmente porque o áudio do aplicativo está sendo capturado pelo compartilhamento da tela.

Quero investigar e implementar a melhor solução tecnicamente possível para isso.

Analise cuidadosamente as limitações do Windows, Electron e Chromium.

Avalie estratégias como:

* captura seletiva de áudio por aplicação
* exclusão de determinados processos/janelas
* loopback de áudio
* captura de áudio da aplicação selecionada
* Windows Audio Session API (WASAPI)
* separação entre áudio do sistema e áudio de comunicação
* WebRTC audio tracks
* filtros de áudio
* controle de ganho
* echo cancellation
* noise suppression
* auto gain control

Não assuma que é possível simplesmente "remover o Discord" do áudio capturado pelo Electron.

Se existir uma limitação técnica da API padrão do Electron/Chromium, explique claramente.

Se for necessário utilizar um módulo nativo Windows, Rust, C++ ou outra tecnologia, apresente essa alternativa e explique a complexidade.

O objetivo é chegar à solução mais confiável possível.

---

# 9. Microfone

O aplicativo deve permitir que o usuário escolha se deseja transmitir o próprio microfone.

Por padrão:

**Microfone desligado.**

Possíveis controles:

🎙 Microfone

🔊 Áudio da transmissão

O usuário deve conseguir ativar/desativar ambos independentemente.

---

# 10. Interface durante a transmissão

Quero uma interface inspirada na organização do Discord, mas muito mais simples.

Exemplo conceitual:

```text
┌──────────────────────────────────────────────────────┐
│  [ícone]  Minha Sala                 5 participantes │
├───────────────┬──────────────────────────────────────┤
│               │                                      │
│ PARTICIPANTES │                                      │
│               │          TRANSMISSÃO                 │
│ ● Você        │                                      │
│ ● João        │          [ vídeo ]                   │
│ ● Maria       │                                      │
│ ● Pedro       │                                      │
│               │                                      │
├───────────────┴──────────────────────────────────────┤
│ 🎙  🔊  🖥  ⚙                       Encerrar         │
└──────────────────────────────────────────────────────┘
```

Quero que a área da transmissão seja o elemento visual principal.

---

# 11. Participantes

Mostrar:

* avatar/ícone
* nome
* status
* microfone ligado/desligado
* conexão

Exemplo:

```text
● João
🎙 ativo

● Maria
🔇 mutado
```

O host deve conseguir visualizar rapidamente quem está conectado.

---

# 12. Indicador de conexão

Adicionar um indicador simples:

🟢 Excelente

🟡 Instável

🔴 Problemas de conexão

Se possível, mostrar informações como:

* ping
* perda de pacotes
* bitrate
* FPS

Essas informações podem ficar escondidas em um menu "Informações".

---

# 13. Segurança

A arquitetura deve considerar:

* códigos de sala difíceis de adivinhar
* expiração automática dos códigos
* limite de participantes
* validação no servidor
* conexão WebRTC segura
* HTTPS/WSS em produção
* autenticação da sessão
* impedir que um usuário consiga entrar em uma sala sem código válido

Não quero implementar um sistema de contas/login inicialmente.

A experiência deve ser:

**abrir → criar/entrar → transmitir.**

---

# 14. Arquitetura

Antes de começar a programar, apresente uma arquitetura recomendada.

Quero separar claramente:

```text
Electron Main Process
        │
        ├── Windows / Desktop APIs
        ├── Screen Capture
        ├── Audio Capture
        └── IPC
               │
               ▼
        React Renderer
               │
               ├── UI
               ├── Room
               ├── Participants
               └── WebRTC
                       
        Backend / Signaling
               │
               ├── Rooms
               ├── Invite Codes
               ├── Participants
               └── WebRTC Signaling
```

Explique onde cada responsabilidade deve ficar.

Não colocar lógica sensível do Electron diretamente no React.

Utilizar IPC seguro entre renderer e main process.

---

# 15. Estrutura do projeto

Quero uma estrutura organizada e escalável, por exemplo:

```text
src/
├── main/
│   ├── main.ts
│   ├── ipc/
│   ├── windows/
│   └── services/
│
├── preload/
│   └── preload.ts
│
├── renderer/
│   ├── components/
│   ├── pages/
│   ├── features/
│   │   ├── room/
│   │   ├── streaming/
│   │   ├── participants/
│   │   └── settings/
│   ├── hooks/
│   ├── lib/
│   ├── stores/
│   └── App.tsx
│
└── shared/
    ├── types/
    └── constants/
```

Adapte a estrutura se existir uma arquitetura melhor.

---

# 16. Estado da aplicação

Escolha uma solução adequada para estado global.

Pode utilizar:

* Zustand

ou outra biblioteca caso exista uma alternativa melhor.

O estado deve incluir coisas como:

```text
currentRoom
currentUser
participants
isStreaming
selectedSource
microphoneEnabled
systemAudioEnabled
connectionStatus
```

---

# 17. Backend

Quero inicialmente manter o backend extremamente simples.

Ele precisa principalmente cuidar de:

* criar salas
* gerar códigos
* validar códigos
* expirar salas
* controlar participantes
* signaling WebRTC

Não quero banco de dados complexo inicialmente se não for necessário.

Avalie se podemos começar com:

* Node.js
* TypeScript
* Fastify ou Express
* WebSocket/Socket.IO
* memória para as salas

E depois adicionar Redis ou banco caso seja necessário.

---

# 18. TURN/STUN

Explique detalhadamente:

* por que STUN é necessário
* por que TURN pode ser necessário
* quando uma conexão P2P falha
* como configurar isso
* alternativas como Coturn

O sistema deve funcionar não apenas na mesma rede local.

Quero que usuários em redes diferentes consigam se conectar.

---

# 19. Performance

A transmissão deve priorizar:

* baixa latência
* estabilidade
* baixo consumo de CPU
* baixo consumo de memória

Inicialmente podemos trabalhar com:

* 720p
* 30 FPS

e posteriormente permitir:

* 1080p
* 60 FPS

Avalie bitrate adaptativo baseado na conexão.

Também quero considerar a possibilidade de reduzir automaticamente a qualidade quando a conexão estiver ruim.

---

# 20. UX

Quero que você proponha funcionalidades pequenas, mas importantes, que deixem o aplicativo realmente agradável de usar.

Por exemplo:

* lembrar último nome utilizado
* copiar código com um clique
* botão "Compartilhar código"
* confirmação antes de encerrar transmissão
* reconexão automática
* aviso quando alguém entra/sai
* estado de conexão
* preview antes de iniciar transmissão
* atalhos de teclado
* minimizar para bandeja
* iniciar transmissão rapidamente
* impedir múltiplas instâncias do aplicativo
* atualização automática do aplicativo
* tela de configurações simples
* escolha de qualidade
* escolha de FPS
* escolha de dispositivo de áudio
* controle de volume

Separe o que é:

**MVP**

de

**Melhorias futuras**

Não quero adicionar funcionalidades desnecessárias ao MVP.

---

# 21. Instalação e distribuição

O resultado final deve poder ser distribuído para outras pessoas.

Quero gerar:

```text
Setup.exe
```

ou outro instalador equivalente.

O usuário final não deve precisar instalar:

* Node.js
* npm
* Electron
* Python
* Visual Studio
* nenhuma dependência de desenvolvimento

Tudo deve estar empacotado no aplicativo.

Explique também como:

* gerar build de produção
* gerar instalador
* definir nome do aplicativo
* definir ícone
* versionamento
* atualização automática

---

# 22. Desenvolvimento passo a passo

Esta é uma parte extremamente importante.

Estou começando com um **repositório completamente vazio no VS Code**.

Não quero que você simplesmente jogue dezenas de arquivos e códigos de uma vez.

Quero desenvolver incrementalmente.

O processo deve ser:

### Etapa 1

Criar o projeto Electron + React + TypeScript + Vite.

### Etapa 2

Configurar Tailwind + shadcn/ui.

### Etapa 3

Criar a estrutura do projeto.

### Etapa 4

Criar a UI inicial.

### Etapa 5

Criar tela de criar sala.

### Etapa 6

Criar tela de entrar em sala.

### Etapa 7

Criar backend/signaling.

### Etapa 8

Implementar salas e códigos de convite.

### Etapa 9

Implementar WebRTC.

### Etapa 10

Implementar captura de tela.

### Etapa 11

Implementar áudio.

### Etapa 12

Resolver da melhor maneira possível a questão do áudio de aplicativos de comunicação/eco.

### Etapa 13

Implementar participantes.

### Etapa 14

Implementar reconexão e estados de conexão.

### Etapa 15

Testes.

### Etapa 16

Build Windows.

### Etapa 17

Gerar `.exe`.

### Etapa 18

Testar em dois computadores diferentes.

Em cada etapa:

1. Explique brevemente o objetivo.
2. Diga exatamente quais comandos devo executar no terminal do VS Code.
3. Diga quais arquivos serão criados/modificados.
4. Forneça o código completo dos arquivos necessários.
5. Explique onde cada código deve ser colocado.
6. Diga como executar o projeto.
7. Diga como testar.
8. Só avance para a próxima etapa depois que a etapa atual estiver funcionando.

Se ocorrer algum erro, pare o avanço e me ajude a corrigir o erro antes de continuar.

---

# 23. Regras importantes para o desenvolvimento

Não quero código desnecessariamente complexo.

Priorize:

* simplicidade
* manutenção
* segurança
* performance
* boas práticas
* TypeScript
* componentes reutilizáveis
* separação de responsabilidades

Evite abstrações desnecessárias.

Não instale bibliotecas apenas porque são populares.

Antes de adicionar uma dependência, explique:

* para que serve
* por que precisamos dela
* alternativas
* impacto no projeto

Quando uma tecnologia tiver limitações específicas no Electron/Windows, deixe isso explícito.

Não invente APIs ou funcionalidades que não existem.

Se uma determinada funcionalidade não puder ser implementada 100% usando Electron/Chromium, explique a limitação e apresente a alternativa tecnicamente viável.

---

# 24. Primeira tarefa

Não comece implementando tudo.

Primeiro faça uma análise da arquitetura completa do projeto.

Quero que você me diga:

1. Se Electron + React + TypeScript + Vite + Tailwind + shadcn/ui é uma boa escolha.
2. Qual biblioteca utilizar para componentes/UI.
3. Qual solução utilizar para WebRTC.
4. Qual solução utilizar para signaling.
5. Como implementar STUN/TURN.
6. Como implementar captura de tela.
7. Como implementar captura de áudio.
8. Quais são as limitações reais da captura de áudio no Windows/Electron.
9. Como lidar com o problema do Discord/Teams/Skype e vozes duplicadas.
10. Qual backend utilizar.
11. Qual solução utilizar para estado global.
12. Como empacotar o aplicativo em `.exe`.
13. Quais funcionalidades devem fazer parte do MVP.
14. Quais funcionalidades devem ficar para versões futuras.
15. Uma arquitetura de pastas recomendada.
16. Um roadmap de desenvolvimento.

Depois dessa análise, começaremos **somente pela Etapa 1**, criando o projeto a partir do repositório vazio.

Não pule etapas.
