Analisei todo o código frontend do projeto e identifiquei a situação atual dos botões:

✅ **Situação atual encontrada:**
- **Não existe componente Button reutilizável** no projeto
- Todos os botões usam **estilos inline duplicados** em cada arquivo separadamente
- Existem **85 ocorrências de botões** distribuídas em 14 arquivos diferentes
- Todas as páginas duplicam a função `btnStyle()` localmente com código idêntico
- Não existe nenhum arquivo CSS global nem biblioteca UI instalada (apenas React puro)
- Atualmente os botões são: fundo sólido, sem bordas, sem ícones, sem efeitos hover/active

✅ **Arquivos que terão que ser modificados:**
1.  `/frontend/src/components/NavigationButtons.jsx`
2.  `/frontend/src/pages/Aliquotagem.jsx`
3.  `/frontend/src/pages/ConfirmarExtracao.jsx`
4.  `/frontend/src/pages/ConsultaAmostras.jsx`
5.  `/frontend/src/pages/ConsultarPCR.jsx`
6.  `/frontend/src/pages/ConsultarPlacas.jsx`
7.  `/frontend/src/pages/GalWs.jsx`
8.  `/frontend/src/pages/ImportCSV.jsx`
9.  `/frontend/src/pages/Login.jsx`
10. `/frontend/src/pages/MontarPCR.jsx`
11. `/frontend/src/pages/MontarPlaca.jsx`
12. `/frontend/src/pages/PlateEditor.jsx`
13. `/frontend/src/pages/PlacaPCREditor.jsx`
14. `/frontend/src/pages/Recebimento.jsx`
15. `/frontend/src/pages/RevisarResultados.jsx`

✅ **Plano de implementação recomendado:**
1.  Criar um componente `<Button />` global reutilizável com todos os estilos, variantes, ícones e efeitos
2.  Remover todas as funções `btnStyle()` duplicadas de todos os arquivos
3.  Substituir TODAS as tags `<button>` existentes pelo novo componente
4.  Manter 100% da funcionalidade existente, apenas alterando a aparência

Quando você fornecer as especificações de layout (cores, tamanhos, bordas, ícones, efeitos) eu posso implementar essa alteração completa. Para começar a implementação solicite que eu alterne para **Act mode**.
