# Aplicativo da Lavínia

Um app fofo para a Lavínia criar coisas no PC ou no tablet. Por enquanto ele faz **photo cards**.

## Photo cards

- Tamanho real de **5,4 × 8,6 cm**, com cantos arredondados (raio de 3 mm). Pode ser **em pé** ou **deitado**.
- A forma do card fica parada e a foto é enquadrada por baixo dela, como no Canva:
  - **Mover:** arrastar com o dedo ou com o mouse (ou as setas do teclado).
  - **Aumentar ou diminuir:** pinça com dois dedos, rodinha do mouse ou a barra "Tamanho".
  - **Inclinar:** girar os dois dedos, Shift + rodinha ou a barra "Inclinar" (ela "gruda" em 0° e 90°).
  - Botões para girar 90°, espelhar, encaixar de novo e trocar a cor de fundo.
- Três jeitos de colocar a foto: **escolher do aparelho**, **arrastar a imagem** para a tela ou **colar** (Ctrl+V no PC, ou o botão "Colar").
- A **folha A4** mostra onde cada card vai sair (9 por folha). Dá para escolher quantas cópias de cada card.
- "Preparar folha para imprimir" gera um **PDF A4 em 300 dpi** com marcas de corte em cada canto, uma linha fininha opcional em volta do card e uma régua de 5 cm no rodapé para conferir a medida.
  - Na hora de imprimir, escolha **tamanho real / 100%** (não "ajustar à página").
  - Cards deitados saem girados na folha; depois de recortados ficam iguais.
- Tudo fica guardado **no próprio aparelho** (o card que está sendo feito também), então dá para fechar e voltar depois. Cada aparelho tem a sua folha.

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
js/editor.js          editor com gestos (arrastar, pinça, rodinha)
js/card.js            medidas do card e desenho (o mesmo para tela e impressão)
js/pdf.js             montagem da folha A4 com marcas de corte
js/db.js              armazenamento no aparelho (IndexedDB)
js/image.js           abrir e reduzir fotos grandes
sw.js                 funcionamento sem internet
vendor/               jsPDF (licença MIT)
```

**Nova ferramenta:** crie `js/views/nome.js` exportando `mount(el)`, registre em `ROUTES` (`js/app.js`) e acrescente um item em `TOOLS` (`js/views/home.js`).

**Ao publicar mudanças:** aumente `VERSION` em `sw.js` para os aparelhos baixarem a versão nova.
