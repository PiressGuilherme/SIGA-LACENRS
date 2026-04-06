# SIGA-LACENRS
LIMS direcionado ao recebimento e processamento de amostras de HPV.

#Baixar data.csv o gal
Entrar no gal com suas credenciais.
Acessar pasta consultas -> Consultar Exames.
Digitar no campo exame HPV e selecionar o primeiro.
Selecionar o período de início e fim de 1 mês.
desbarcar caixa de exame cancelado.
Filtrar
Levar o mouse até qualquer cabeçalho e clicar na seta para baixo que surgirá.
levar o mouse até colunas e selecionar em adição as seguintes colunas: Cod. Exame, Num.Interno, Nome Social.
Gerar arquivo csv na parte inferior da tela onde diz Exportar listagem.





---------------------------------------

Modelo Selecionável:

Haiku (3.5/4.0): É o "econômico". Use para tarefas simples: explicar um erro de sintaxe, renomear variáveis ou gerar testes unitários básicos. Ele consome até 90% menos tokens que o Opus.

Sonnet: O equilíbrio ideal. É o padrão para a maioria das tarefas de codificação pesada.

Opus (4.6): O "SUV" de luxo. Use apenas quando estiver travado em um bug de lógica complexa ou arquitetura. Ele "bebe" tokens e reduz drasticamente seu limite de mensagens na janela de 5h.

Thinking (Modo de Pensamento):

Quando ativado, o Claude gera um "rascunho mental" interno antes de responder.

Impacto: Cada palavra que ele "pensa" conta como token de saída. Se você pedir algo simples com o Thinking ligado, está jogando tokens no lixo. Desative-o para tarefas rotineiras.

Effort (Esforço/Reasoning):

Define quanto tempo o modelo deve "raciocinar" sobre o problema.

Baixo Esforço: Respostas diretas. Ótimo para economizar.

Alto Esforço: Gera cadeias de pensamento longas. Use apenas se o código for intrincado, pois o custo de contexto sobe exponencialmente.

2. Estratégias Práticas para a Janela de 5h
O limite de 5 horas começa a contar a partir da primeira mensagem. Se você mandar um "Oi" às 08:00, sua sessão vai até às 13:00, independentemente de você estar usando ou não.

O Truque do "Dummy Prompt": Se você sabe que vai codar pesado das 14h às 18h, mande uma mensagem curta ("ping") às 11h. Isso faz com que sua primeira sessão expire às 16h, liberando uma nova cota cheia exatamente quando você ainda está no meio do trabalho.

Comando /compact ou Novo Chat: À medida que a conversa cresce, o Claude reenvia todo o histórico a cada nova mensagem. Se o chat ficou longo, use o comando /compact (se disponível na sua ferramenta) ou inicie um novo chat referenciando apenas os arquivos necessários.

Use o .claudeignore ou .cursorignore: Evite que a IA leia pastas pesadas como node_modules, dist ou build. Se ela indexar esses arquivos desnecessariamente, cada prompt enviará milhares de tokens inúteis de contexto.





PROMPT PARA CONTINUAR: 




Estou retomando uma tarefa que foi interrompida por limite de tokens, você tinha os seguintes passos:

Criar parser.py — parse CFX CSV + lógica IBMP(Feito)

Atualizar models.py — adicionar recalcular_resultado_final(Feito)

Atualizar serializers.py — adicionar ResultadoAmostraDetalheSerializer

Reescrever views.py — viewsets com importar, confirmar, liberar, repetição

Atualizar urls.py — registrar viewsets + URL da página

Criar template revisao.html + wiring Django/Vite/URLs

Criar frontend ResultadosRevisao.jsx + entry resultados.jsx

Executar migrate + testar importação no container



Prompt anterior com instruções desta etapa de desenvolvimento:

Vamos trabalahar especificamene na fase 6 agora. Para isso, vou te instruir quanto aos critérios IBMP. Veja também o exemplo em csv do output do sequenciador agora presente na pasta do projeto chamado HPV1303261_lims. Perceba que este nome do CSV segue uma lógica com HPV sempre fixo sequido da data (130326) e o número da placa 1.

Instruções IBMP:

1. Validação da Corrida (Controles)Para que os resultados da placa sejam válidos, os controles da reação devem atender estritamente aos seguintes critérios:Controle Positivo (CP): Deve obrigatoriamente apresentar amplificação nos 4 alvos analisados (HPV-16, HPV-18, HPV AR e CI). O valor de Ct para estes alvos deve ser Ct ≤ 25.Controle Negativo (CN): Não deve apresentar nenhum sinal de amplificação para os alvos de HPV. O Controle Interno (CI) deve amplificar com um valor de Ct ≤ 25.Se o CP ou o CN não apresentarem o comportamento esperado descrito acima, o ensaio inteiro é considerado inválido.2. Critérios de Avaliação das AmostrasA análise de cada amostra baseia-se na leitura conjugada do Controle Interno (CI) e das curvas de detecção viral:Amostra Negativa: Caracterizada pela ausência de amplificação para qualquer alvo de HPV. É obrigatório que o Controle Interno apresente amplificação com Ct ≤ 33 para validar a negatividade da amostra.Amostra Positiva: Caracterizada por apresentar curva de perfil típico de amplificação para pelo menos um dos alvos de HPV, com Ct ≤ 40. Um resultado positivo é válido independentemente de o Controle Interno ter amplificado ou não.Amostra Inválida: Ocorre quando não há amplificação para os alvos de HPV e o Controle Interno também não amplifica (ou amplifica com Ct > 33).3. Matriz de Interpretação de ResultadosCom base nas regras de positividade e negatividade, os laudos finais devem ser reportados segundo as seguintes combinações:HPV não detectável: Nenhum alvo viral amplificado e presença de CI válido (+).HPV-16 detectável: Amplificação exclusiva do alvo HPV-16 (+), independente do CI (+/-).HPV-18 detectável: Amplificação exclusiva do alvo HPV-18 (+), independente do CI (+/-).HPV AR detectável*: Amplificação exclusiva do alvo HPV AR (+), independente do CI (+/-). (Nota: A sigla AR refere-se aos genótipos de alto risco 31, 33, 35, 39, 45, 51, 52, 56, 58, 59, 66 e 68 ).Infecções Múltiplas:HPV-18 e HPV AR detectáveis*: Amplificação dos alvos HPV-18 (+) e HPV AR (+).HPV-16 e HPV AR detectáveis*: Amplificação dos alvos HPV-16 (+) e HPV AR (+).HPV-16 e HPV-18 detectáveis: Amplificação dos alvos HPV-16 (+) e HPV-18 (+).HPV-16, HPV-18 e HPV AR detectáveis*: Amplificação simultânea dos três alvos virais (+).4. Procedimentos para Casos InválidosAmostras invalidadas (sem amplificação viral e com falha no CI) devem ser testadas novamente a partir da etapa de qPCR.Caso a amostra permaneça com Ct > 33 para o Controle Interno, o processo deve ser repetido desde a etapa de extração do DNA.Se mesmo após a nova extração o resultado se mantiver, a amostra deve ser liberada com o status de "inconclusivo".



------Anotações------
-Exames cancelados entram no db?
-Arrumar a tag de aliquota ja feita ✅
-#PLACA: Fix placement de amostras e Controle (default G-H 12) -!!!Não permitir salvamento de placa SEM CONTROLE ✅
-#PLACA: Reconhecimento e flag de duplicatas ✅
-#PLACA: Alterar nome PACIENTE (não aparecer) e Fluxo de adição de amostras vertical (atualmente cada amostra é adicionada horizontalmente)✅


Confirmar login antes de qualquer modulo (melhorar)

arrumar satus de pcr ✅

adicionar botão de confirmar todos na revisão de resultados


protocolos de anonimizar dados


Voltar ao inicio após importação


Edição placa pós salvar >> revisar

opção de repetir amostras >> revisar


Cód. Exame => Requisição  ✅


Formato pdf placas


# IMPORTANTE: refomular sistema de login e autenticação de ações: o registro do log hoje é feito pelo login e não pela autenticação de etapa que estamos implementando, isso deve ser revisto e bem documentado para que as ações feitas sejam registradas no nome do usuário que foi autenticado para cada modulo/ação e não pelo que fez o login inicial. Talvez fazer login por laboratório e depois os logs internos pelo código do crachá (id funcional)

