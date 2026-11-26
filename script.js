/* =====================================================================
   AURA - lógica do chat
   ---------------------------------------------------------------------
   1. CONFIGURAÇÃO
   2. >>> getAIResponse() <<<  ÚNICO lugar onde você conecta a API da IA
   3. Estado e armazenamento (localStorage)
   4. Interface (renderização)
   5. Ações (nova conversa, abrir, apagar, enviar)
   ===================================================================== */

/* ---------- 1. CONFIGURAÇÃO ---------- */
const CONFIG = {
    storageKey: 'aura.conversas.v1',
    // Quando tiver o seu backend, coloque a URL aqui (ex.: 'http://localhost:3000/api/chat')
    apiUrl: '',
  };
  
  /* ---------- 2. INTEGRAÇÃO COM A IA ----------
     Recebe o histórico completo da conversa no formato:
       [{ role: 'user' | 'assistant', content: 'texto' }, ...]
     Deve devolver o TEXTO da resposta (string).
     Se lançar um erro (throw), o chat mostra uma mensagem de erro.
  
     IMPORTANTE: nunca coloque a chave da API aqui no front-end, pois qualquer
     pessoa conseguiria vê-la. Crie um backend simples que guarda a chave e
     repasse as mensagens para ele.
  ------------------------------------------------------------------- */
  async function getAIResponse(messages) {
    // ===== MODO DEMONSTRAÇÃO (apague quando conectar a API) =====
    if (!CONFIG.apiUrl) {
      await new Promise((r) => setTimeout(r, 1000));
      return 'Esta é uma resposta de exemplo. Conecte o chat à sua API em getAIResponse() no arquivo script.js para receber respostas reais.';
    }
  
    // ===== EXEMPLO COM BACKEND PRÓPRIO =====
    const resposta = await fetch(CONFIG.apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages }),
    });
  
    if (!resposta.ok) throw new Error('Erro ' + resposta.status);
  
    const dados = await resposta.json();
    return dados.reply; // ajuste para o formato que o seu backend devolver
  }
  
  /* ---------- 3. ESTADO E ARMAZENAMENTO ---------- */
  let conversas = carregar(); // [{ id, title, messages, updatedAt }]
  let ativaId = null;         // null = tela vazia (nova conversa)
  let ocupado = false;        // true enquanto aguarda a IA
  
  function carregar() {
    try {
      return JSON.parse(localStorage.getItem(CONFIG.storageKey)) || [];
    } catch {
      return [];
    }
  }
  
  function salvar() {
    try {
      localStorage.setItem(CONFIG.storageKey, JSON.stringify(conversas));
    } catch (e) {
      console.warn('Não foi possível salvar as conversas.', e);
    }
  }
  
  const conversaAtiva = () => conversas.find((c) => c.id === ativaId) || null;
  
  /* ---------- 4. INTERFACE ---------- */
  const $ = (id) => document.getElementById(id);
  const el = {
    sidebar: $('sidebar'),
    backdrop: $('backdrop'),
    btnMenu: $('btn-menu'),
    btnNova: $('btn-nova'),
    lista: $('lista-conversas'),
    listaVazia: $('lista-vazia'),
    titulo: $('titulo-chat'),
    area: $('mensagens'),
    vazio: $('vazio'),
    thread: $('thread'),
    form: $('form-chat'),
    input: $('mensagem'),
    enviar: $('btn-enviar'),
  };
  
  function criar(tag, classe, texto) {
    const n = document.createElement(tag);
    if (classe) n.className = classe;
    if (texto !== undefined) n.textContent = texto; // textContent evita injeção de HTML
    return n;
  }
  
  function criarMensagem(msg) {
    if (msg.role === 'user') {
      const art = criar('article', 'msg msg--user');
      art.append(criar('p', 'msg__text', msg.content));
      return art;
    }
  
    const art = criar('article', 'msg msg--ai' + (msg.error ? ' msg--error' : ''));
    const avatar = criar('span', 'avatar avatar--ai');
    avatar.setAttribute('aria-hidden', 'true');
  
    const conteudo = criar('div', 'msg__content');
    conteudo.append(criar('p', 'msg__text', msg.content));
  
    if (!msg.error) {
      const acoes = criar('div', 'msg__actions');
      const copiar = criar('button', 'btn-icon', 'Copiar');
      copiar.type = 'button';
      copiar.addEventListener('click', async () => {
        try {
          await navigator.clipboard.writeText(msg.content);
          copiar.textContent = 'Copiado!';
          setTimeout(() => (copiar.textContent = 'Copiar'), 1500);
        } catch {
          copiar.textContent = 'Falhou';
        }
      });
      acoes.append(copiar);
      conteudo.append(acoes);
    }
  
    art.append(avatar, conteudo);
    return art;
  }
  
  function criarDigitando() {
    const art = criar('article', 'msg msg--ai');
    art.id = 'digitando';
    const avatar = criar('span', 'avatar avatar--ai');
    avatar.setAttribute('aria-hidden', 'true');
    const conteudo = criar('div', 'msg__content');
    const pontos = criar('div', 'typing');
    pontos.setAttribute('role', 'status');
    pontos.setAttribute('aria-label', 'A IA está escrevendo');
    pontos.append(criar('span'), criar('span'), criar('span'));
    conteudo.append(pontos);
    art.append(avatar, conteudo);
    return art;
  }
  
  function rolarParaFim() {
    el.area.scrollTop = el.area.scrollHeight;
  }
  
  function renderLista() {
    el.lista.replaceChildren();
    const ordenadas = [...conversas].sort((a, b) => b.updatedAt - a.updatedAt);
    el.listaVazia.hidden = ordenadas.length > 0;
  
    ordenadas.forEach((c) => {
      const li = criar('li', 'chat-item' + (c.id === ativaId ? ' is-active' : ''));
  
      const abrir = criar('button', 'chat-link', c.title);
      abrir.type = 'button';
      abrir.title = c.title;
      if (c.id === ativaId) abrir.setAttribute('aria-current', 'true');
      abrir.addEventListener('click', () => abrirConversa(c.id));
  
      const apagar = criar('button', 'chat-del');
      apagar.type = 'button';
      apagar.setAttribute('aria-label', 'Apagar conversa: ' + c.title);
      apagar.innerHTML =
        '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14"/></svg>';
      apagar.addEventListener('click', () => apagarConversa(c.id));
  
      li.append(abrir, apagar);
      el.lista.append(li);
    });
  }
  
  function renderConversa() {
    const c = conversaAtiva();
    const temMensagens = c && c.messages.length > 0;
  
    el.vazio.hidden = temMensagens;
    el.thread.hidden = !temMensagens;
    el.titulo.textContent = c ? c.title : 'Nova conversa';
  
    el.thread.replaceChildren();
    if (temMensagens) c.messages.forEach((m) => el.thread.append(criarMensagem(m)));
    rolarParaFim();
  }
  
  function renderTudo() {
    renderLista();
    renderConversa();
  }
  
  function definirOcupado(valor) {
    ocupado = valor;
    el.enviar.disabled = valor;
  }
  
  /* Menu lateral no celular */
  function abrirMenu(abrir) {
    el.sidebar.classList.toggle('is-open', abrir);
    el.backdrop.hidden = !abrir;
    el.btnMenu.setAttribute('aria-expanded', String(abrir));
  }
  
  /* ---------- 5. AÇÕES ---------- */
  function novaConversa() {
    ativaId = null;
    renderTudo();
    abrirMenu(false);
    el.input.focus();
  }
  
  function abrirConversa(id) {
    ativaId = id;
    renderTudo();
    abrirMenu(false);
    el.input.focus();
  }
  
  function apagarConversa(id) {
    const c = conversas.find((x) => x.id === id);
    if (!c || !confirm('Apagar a conversa "' + c.title + '"?')) return;
    conversas = conversas.filter((x) => x.id !== id);
    if (ativaId === id) ativaId = null;
    salvar();
    renderTudo();
  }
  
  async function enviarMensagem(texto) {
    texto = texto.trim();
    if (!texto || ocupado) return;
  
    // Cria a conversa na primeira mensagem
    let c = conversaAtiva();
    if (!c) {
      c = {
        id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
        title: texto.length > 40 ? texto.slice(0, 40) + '…' : texto,
        messages: [],
        updatedAt: Date.now(),
      };
      conversas.push(c);
      ativaId = c.id;
    }
  
    c.messages.push({ role: 'user', content: texto });
    c.updatedAt = Date.now();
    salvar();
    renderTudo();
  
    definirOcupado(true);
    el.thread.append(criarDigitando());
    rolarParaFim();
  
    try {
      // Envia só role e content (sem campos extras como "error")
      const historico = c.messages
        .filter((m) => !m.error)
        .map(({ role, content }) => ({ role, content }));
      const resposta = await getAIResponse(historico);
      c.messages.push({ role: 'assistant', content: resposta });
    } catch (erro) {
      console.error(erro);
      c.messages.push({
        role: 'assistant',
        content: 'Não consegui obter a resposta. Verifique sua conexão e tente de novo.',
        error: true,
      });
    }
  
    c.updatedAt = Date.now();
    salvar();
    definirOcupado(false);
  
    // Só redesenha se o usuário ainda estiver nessa conversa
    if (ativaId === c.id) renderTudo(); else renderLista();
    el.input.focus();
  }
  
  /* ---------- Eventos ---------- */
  el.form.addEventListener('submit', (e) => {
    e.preventDefault();
    const texto = el.input.value;
    el.input.value = '';
    el.input.style.height = 'auto';
    enviarMensagem(texto);
  });
  
  // Enter envia, Shift+Enter quebra linha
  el.input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
      e.preventDefault();
      el.form.requestSubmit();
    }
  });
  
  // Campo cresce conforme o texto
  el.input.addEventListener('input', () => {
    el.input.style.height = 'auto';
    el.input.style.height = Math.min(el.input.scrollHeight, 180) + 'px';
  });
  
  // Sugestões da tela vazia
  document.querySelectorAll('.chip').forEach((chip) =>
    chip.addEventListener('click', () => enviarMensagem(chip.textContent))
  );
  
  el.btnNova.addEventListener('click', novaConversa);
  el.btnMenu.addEventListener('click', () => abrirMenu(true));
  el.backdrop.addEventListener('click', () => abrirMenu(false));
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') abrirMenu(false);
  });
  
  /* ---------- Início: sempre abre na tela vazia ---------- */
  renderTudo();