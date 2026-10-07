# Sala: participantes e controles

- O nome de exibição é guardado apenas no armazenamento local do app e enviado
  ao signaling ao criar/entrar. Não existe conta nem login.
- O servidor atribui um `socket.id` novo a cada conexão. A sala ativa e seus
  convites são mantidos em memória no processo de signaling.
- O avatar usa iniciais e uma cor estável calculada localmente a partir do nome;
  nenhum serviço externo recebe o nome do participante.
- A presença pode ser Disponível, Ausente ou Ocupado e é compartilhada com a sala.
- O host pode remover participantes. Se sua conexão cair inesperadamente, o
  servidor passa a função de host para o participante restante que entrou há
  mais tempo. O host que se reconectar volta como participante; se a sala já
  tiver terminado, o app tenta criar uma nova.
- `Ctrl+Shift+L` encerra a participação atual mesmo quando a janela está em
  segundo plano. O atalho é global e pode não ser registrado se outro app já o
  estiver usando.
- Uma notificação nativa é exibida quando alguém entra e a janela está
  minimizada. Sons discretos indicam mudanças de participantes.
- O contador de expiração é visual; o servidor continua sendo a autoridade e
  encerra a sala após 24 horas.
