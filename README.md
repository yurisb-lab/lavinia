# Aplicativo da Lavínia

Um app fofo para a Lavínia criar coisas no PC ou no tablet. Por enquanto ele faz **photo cards**.

## Photo cards

- Tamanho real de **5,3 × 8,5 cm**, com cantos arredondados (raio de 3 mm). Pode ser **em pé** ou **deitado**.
- Um **pontilhado** mostra a linha de corte, na tela e na folha impressa.
- Cada card tem **frente** e **verso**. O verso só é impresso se tiver alguma coisa.
- **Desfazer** e **Refazer** valem para tudo (também com Ctrl+Z e Ctrl+Shift+Z).
- Tocar numa coisa do card escolhe ela: arrastar move, dois dedos (ou a rodinha) aumentam e giram.
  A bolinha roxa no canto de textos e adesivos também gira e aumenta. Textos e adesivos "grudam" no meio do card.

As ferramentas ficam em abas:

| Aba | O que faz |
| --- | --- |
| **Foto** | Escolher, colar ou arrastar a foto; tamanho, inclinar, girar, espelhar, encaixar e **tirar fundo**. |
| **Efeitos** | Filtros prontos (Vivo, Rosado, Sonho, Vintage, Preto e branco…), brilho, contraste e cor, e **contorno** em volta da foto (branco ou de outra cor), como figurinha. |
| **Texto** | Textos com 9 letras diferentes, tamanho, cor, contorno, sombra e alinhamento. |
| **Adesivos** | 19 desenhos (coração, laço, coroa, borboleta, fita adesiva…) que mudam de cor, e emojis. |
| **Fundo** | **Foto de fundo** atrás de tudo (escolher, colar ou arrastar; enquanto mexe nela, só o fundo se mexe), cor lisa (ou qualquer outra cor), degradês e estampas (bolinhas, corações, estrelinhas, listras, xadrez, quadriculado). |
| **Moldura** | Borda, Polaroid, borda dupla, costurinha, bolinhas, corações, xadrez e listras, na cor que quiser. |
| **Colagem** | De nenhuma até 4 fotos no mesmo card; cada uma se mexe dentro do seu espaço. |
| **Modelos** | Cards prontos (Polaroid, Idol, Aniversário, Figurinha, Verso fofo…): trocam fundo, moldura, textos e adesivos, e as fotos ficam. |
| **Camadas** | Lista do que tem no card, para escolher, trazer para a frente, mandar para trás ou apagar. |

**Tirar fundo:** apaga fundos de uma cor (ou quase), direto no aparelho e sem internet.
Ao tocar em "Tirar fundo", o app descobre sozinho a cor da borda da foto e apaga o fundo ligado a ela.
Tocar numa cor apaga aquela região. A barra "Força" apaga mais ou menos cores parecidas. A foto original fica guardada junto com o card.

**Folha A4:** mostra onde cada card vai sair (9 por folha) e quantas cópias de cada um.
"Preparar folha para imprimir" gera um **PDF A4 em 300 dpi** com o pontilhado de corte (opcional), marcas nos cantos e uma régua de 5 cm no rodapé.

- Na hora de imprimir, escolha **tamanho real / 100%** (não "ajustar à página").
- Cards deitados saem girados na folha; depois de recortados ficam iguais.
- Se algum card tiver verso, cada folha ganha uma página de verso logo depois, espelhada. Imprima **frente e verso virando pela borda comprida**.
  O verso sai 1 mm maior em volta, para não sobrar branco se a impressora deslocar um pouquinho.
- Tudo fica guardado **no próprio aparelho** (o card que está sendo feito também).
  Ao tocar em outro card da folha, o card aberto é **salvo sozinho** antes de trocar (se for novo, vai para a folha).
  "Começar outro card" e "Cancelar edição" mostram um aviso com **Desfazer**, caso tenha sido sem querer. Cards feitos nas versões anteriores (inclusive com foto de fundo) continuam abrindo.

## Como usar

É um site estático: não precisa instalar nada nem compilar. Para publicar:

**GitHub Pages:** no repositório, vá em *Settings → Pages*, em *Build and deployment* escolha *Deploy from a branch*, selecione o branch e a pasta `/ (root)` e salve. Em alguns minutos o endereço aparece nessa mesma página.

**Vercel ou Netlify:** importe o repositório; não tem comando de build, a pasta publicada é a raiz.

No **tablet**, abra o endereço e use "Adicionar à tela de início" (iPad: botão Compartilhar; Android: menu do Chrome). O app ganha ícone próprio e funciona até sem internet.

Para testar no computador: `python3 -m http.server` nesta pasta e abrir `http://localhost:8000`.

## Organização do código

```
index.html            estrutura da página
css/app.css           visual (cores, fontes, tamanhos)
js/app.js             navegação entre telas
js/views/home.js      tela inicial (lista das ferramentas)
js/views/photocards.js  tela de photo cards
js/views/pc-panels.js   abas de ferramentas (HTML de cada painel)
js/editor.js          editor com seleção e gestos (arrastar, pinça, rodinha, bolinha de girar)
js/card.js            medidas do card, molduras, colagens e formato dos dados
js/render.js          desenho do card (o mesmo para tela, miniatura e impressão)
js/fx.js              filtros, ajustes e contorno das fotos
js/stickers.js        adesivos desenhados e emojis
js/fonts.js           letras dos textos (arquivos em fonts/)
js/templates.js       modelos prontos
js/history.js         desfazer e refazer
js/pdf.js             montagem da folha A4 com pontilhado, marcas de corte e verso
js/db.js              armazenamento no aparelho (IndexedDB)
js/image.js           abrir e reduzir fotos grandes
js/bg-remover.js      tirar fundo (lado da tela)
js/bg-worker.js       tirar fundo (cálculo, roda separado para não travar)
sw.js                 funcionamento sem internet
vendor/               jsPDF (licença MIT)
fonts/                fontes (SIL Open Font License, veja fonts/LICENSE.txt)
```

**Nova ferramenta:** crie `js/views/nome.js` exportando `mount(el)`, registre em `ROUTES` (`js/app.js`) e acrescente um item em `TOOLS` (`js/views/home.js`).

**Ao publicar mudanças:** aumente `VERSION` em `sw.js` para os aparelhos baixarem a versão nova.
