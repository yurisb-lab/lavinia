// Minha turma: entrar ou criar uma turma, e o feed com os cards de todo mundo.
// Rotas: "#/turma" (minhas turmas), "#/turma?c=CÓDIGO" (convite) e "#/turma?g=id" (abrir uma turma).

import { icon } from '../icons.js';
import { toast } from '../toast.js';
import { db } from '../db.js';
import { openModal } from '../modal.js';
import { cardSize, formatInfo } from '../card.js';
import {
  cloudEnabled,
  AVATARS,
  COLORS,
  SECRET,
  SECRET_LEN,
  REACTIONS,
  POST_DAYS,
  avatarOf,
  colorOf,
  inviteUrl,
  parseInvite,
  errorText,
  errorCode,
  myGroups,
  groupByInvite,
  createGroup,
  joinGroup,
  loginMember,
  leaveGroup,
  setMySecret,
  groupMembers,
  approveMember,
  removeMember,
  setMemberSecret,
  setMemberOwner,
  newInvite,
  groupFeed,
  react,
  deletePost,
  setForTrade,
  fetchModel,
  markSeen,
  agoText,
  leftText,
} from '../group.js';

export const title = 'Minha turma';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const ava = (m, cls = '') => `<span class="ava ${cls}" style="--ava:${colorOf(m)}" aria-hidden="true">${avatarOf(m)}</span>`;
const secretEmojis = (code) => code.split('-').map((i) => SECRET[+i]).join(' ');

// ---------- peças reutilizadas ----------

// Senha de figurinhas: toca 3 figurinhas em sequência. onDone(código, emojis).
function mountSecret(el, { onDone, label = 'Toque 3 figurinhas, na ordem' }) {
  let picked = [];
  el.innerHTML = `
    <div class="secret">
      <p class="secret__label">${esc(label)}</p>
      <div class="secret__slots" aria-live="polite" data-slots></div>
      <div class="secret__grid" role="group" aria-label="Figurinhas da senha">
        ${SECRET.map((e, i) => `<button type="button" class="secret__btn" data-s="${i}" aria-label="Figurinha ${i + 1}">${e}</button>`).join('')}
      </div>
      <button type="button" class="link-btn" data-s-back>${icon('undo', { size: 18 })}Apagar a última</button>
    </div>`;
  const slots = el.querySelector('[data-slots]');
  function draw() {
    slots.innerHTML = Array.from({ length: SECRET_LEN }, (_, i) => `<span class="secret__slot${picked[i] != null ? ' is-on' : ''}">${picked[i] != null ? SECRET[picked[i]] : ''}</span>`).join('');
    el.querySelector('[data-s-back]').disabled = !picked.length;
  }
  el.addEventListener('click', (e) => {
    const b = e.target.closest('[data-s], [data-s-back]');
    if (!b || b.disabled) return;
    if (b.hasAttribute('data-s-back')) picked.pop();
    else if (picked.length < SECRET_LEN) picked.push(+b.dataset.s);
    draw();
    if (picked.length === SECRET_LEN) {
      const code = picked.join('-');
      setTimeout(() => onDone(code, secretEmojis(code)), 180);
    }
  });
  draw();
  return {
    reset() {
      picked = [];
      draw();
    },
  };
}

// Escolher a senha duas vezes (para não esquecer). onDone(código).
function chooseSecret(el, { onDone, intro = '' }) {
  let first = null;
  function step1() {
    el.innerHTML = `${intro}<div data-sp></div>`;
    mountSecret(el.querySelector('[data-sp]'), {
      label: 'Escolha 3 figurinhas para ser a sua senha',
      onDone: (code) => {
        first = code;
        step2();
      },
    });
  }
  function step2() {
    el.innerHTML = `<p class="modal__text turma__big">Agora toque de novo nas mesmas 3, na mesma ordem.</p><div data-sp></div>
      <button type="button" class="link-btn" data-restart>${icon('undo', { size: 18 })}Escolher outras</button>`;
    const sp = mountSecret(el.querySelector('[data-sp]'), {
      label: 'Repita a senha',
      onDone: (code) => {
        if (code !== first) {
          toast('Não ficou igual. Tente de novo.', { kind: 'error' });
          sp.reset();
          return;
        }
        onDone(code);
      },
    });
    el.querySelector('[data-restart]').addEventListener('click', step1);
  }
  step1();
}

// Nome e avatar. Devolve { get() } com { name, avatar, color }.
function profileFields(el, { name = '', avatar = 0, color = 0, nameLabel = 'Seu nome' } = {}) {
  let a = avatar;
  let c = color;
  el.innerHTML = `
    <label class="field">
      <span class="field__label">${esc(nameLabel)}</span>
      <input type="text" class="field__input" maxlength="24" autocomplete="off" data-name value="${esc(name)}">
      <span class="field__hint">Só o primeiro nome ou um apelido.</span>
    </label>
    <div class="field">
      <span class="field__label">Seu bichinho</span>
      <div class="ava-grid" data-avas>${AVATARS.map((e, i) => `<button type="button" class="ava-pick" data-a="${i}" aria-pressed="${i === a}" aria-label="Bichinho ${i + 1}">${e}</button>`).join('')}</div>
      <div class="ava-colors" data-colors>${COLORS.map((col, i) => `<button type="button" class="swatch" data-c="${i}" aria-pressed="${i === c}" aria-label="Cor ${i + 1}" style="--sw:${col}"></button>`).join('')}</div>
    </div>`;
  const paint = () => {
    el.querySelectorAll('[data-a]').forEach((b) => {
      b.setAttribute('aria-pressed', String(+b.dataset.a === a));
      b.style.setProperty('--ava', COLORS[c]);
    });
    el.querySelectorAll('[data-c]').forEach((b) => b.setAttribute('aria-pressed', String(+b.dataset.c === c)));
  };
  el.addEventListener('click', (e) => {
    const b = e.target.closest('[data-a], [data-c]');
    if (!b) return;
    if (b.dataset.a != null) a = +b.dataset.a;
    else c = +b.dataset.c;
    paint();
  });
  paint();
  return {
    get: () => ({ name: el.querySelector('[data-name]').value.trim().replace(/\s+/g, ' '), avatar: a, color: c }),
    focus: () => el.querySelector('[data-name]').focus(),
  };
}

function busyBtn(btn, text) {
  btn.disabled = true;
  btn.classList.add('is-busy');
  const span = btn.querySelector('span');
  const old = span ? span.textContent : '';
  if (span && text) span.textContent = text;
  return () => {
    btn.disabled = false;
    btn.classList.remove('is-busy');
    if (span) span.textContent = old;
  };
}

async function shareInvite(group) {
  const url = inviteUrl(group.invite);
  const text = `Vem pra minha turma "${group.name}" no Aplicativo da Lavínia! Abra o link: ${url}`;
  if (navigator.share) {
    try {
      await navigator.share({ title: 'Minha turma', text });
      return;
    } catch (err) {
      if (err && err.name === 'AbortError') return;
    }
  }
  try {
    await navigator.clipboard.writeText(url);
    toast('Link copiado! Cole no WhatsApp ou na mensagem.');
  } catch (_) {
    toast('Não consegui copiar. Toque em "Turma" para ver o link.', { kind: 'error' });
  }
}

// ---------- tela ----------
export async function mount(root) {
  root.innerHTML = `<section class="turma" data-body></section>`;
  const body = root.querySelector('[data-body]');
  let alive = true;
  let groups = [];
  let current = null; // turma aberta
  let members = [];
  let posts = [];
  let filter = 'all'; // all | trade | mine | m:<id>
  const flipped = new Set();
  let refreshTimer = 0;

  const params = new URLSearchParams(location.hash.split('?')[1] || '');
  if ([...params.keys()].length) window.history.replaceState(null, '', '#/turma');
  const wantInvite = parseInvite(params.get('c'));
  const wantGroup = params.get('g');

  function screen(html, keepScroll = false) {
    clearInterval(refreshTimer);
    const y = window.scrollY;
    body.innerHTML = html;
    window.scrollTo(0, keepScroll ? y : 0);
  }

  function message(titleText, text, { retry, extra = '' } = {}) {
    screen(`
      <div class="turma__box turma__box--center">
        <h1 class="lib__title">${esc(titleText)}</h1>
        <p class="lib__sub">${text}</p>
        <div class="turma__row">
          ${retry ? `<button type="button" class="btn btn--primary" data-retry>${icon('rotate', { size: 22 })}Tentar de novo</button>` : ''}
          ${extra}
        </div>
      </div>`);
    if (retry) body.querySelector('[data-retry]').addEventListener('click', retry);
  }

  function loading(text = 'Abrindo a turma…') {
    screen(`<div class="turma__box turma__box--center"><p class="turma__loading">${icon('sparkle', { size: 28, fill: true })}${esc(text)}</p></div>`);
  }

  if (!cloudEnabled) {
    message('Minha turma', 'A turma precisa da nuvem ligada. Peça para um adulto configurar o endereço do Supabase em <code>js/cloud-config.js</code>.');
    return () => {};
  }

  // ---------- começo ----------
  async function start() {
    loading();
    try {
      groups = await myGroups();
    } catch (err) {
      console.error(err);
      const text = errorCode(err) ? errorText(err) : 'Não consegui falar com a nuvem. Confira a internet e tente de novo.';
      return message('Sem conexão', esc(text), { retry: start });
    }
    if (!alive) return;
    if (wantInvite) return openInvite(wantInvite);
    if (!groups.length) return welcome();
    const saved = await db.getMeta('groupCurrent').catch(() => null);
    const g = groups.find((x) => x.id === wantGroup) || groups.find((x) => x.id === saved) || groups[0];
    openGroup(g);
  }

  function welcome() {
    screen(`
      <div class="turma__hello">
        <h1 class="lib__title">Minha turma</h1>
        <p class="lib__sub">Um mural só da sua turma (amigas da escola, primas, família) para mostrar os cards que você faz, ganhar coraçõezinhos e combinar trocas. Só entra quem recebe o convite, e quem cuida da turma aprova cada pessoa.</p>
      </div>
      <div class="turma__choices">
        <div class="turma__box">
          <h2 class="lib__h2">${icon('heart', { size: 24, fill: true })} Tenho um convite</h2>
          <p class="modal__text">Abra o link que mandaram para você, ou cole ele aqui.</p>
          <label class="field">
            <span class="field__label">Link ou código do convite</span>
            <input type="text" class="field__input" autocomplete="off" autocapitalize="characters" placeholder="ex.: K7P2QX9M" data-code>
          </label>
          <button type="button" class="btn btn--primary btn--wide" data-act="go-invite"><span>Entrar na turma</span></button>
        </div>
        <div class="turma__box">
          <h2 class="lib__h2">${icon('users', { size: 24 })} Criar uma turma</h2>
          <p class="modal__text">Quem cria a turma <strong>cuida dela</strong>: aceita quem pede para entrar e pode apagar posts. O ideal é um adulto criar, no próprio celular, e mandar o convite para as crianças.</p>
          <button type="button" class="btn btn--soft btn--wide" data-act="create">${icon('plus', { size: 22 })}<span>Criar uma turma</span></button>
        </div>
      </div>
      ${groups.length ? `<button type="button" class="link-btn" data-act="back">${icon('arrowLeft', { size: 18 })}Voltar para a minha turma</button>` : ''}`);
    const input = body.querySelector('[data-code]');
    const go = () => {
      const code = parseInvite(input.value);
      if (!code) {
        toast('Esse código não parece certo. Ele tem 8 letras e números.', { kind: 'error' });
        return input.focus();
      }
      openInvite(code);
    };
    body.querySelector('[data-act="go-invite"]').addEventListener('click', go);
    input.addEventListener('keydown', (e) => e.key === 'Enter' && go());
    body.querySelector('[data-act="create"]').addEventListener('click', createScreen);
    const back = body.querySelector('[data-act="back"]');
    if (back) back.addEventListener('click', () => openGroup(current || groups[0]));
  }

  function createScreen() {
    screen(`
      <div class="turma__box turma__box--form">
        <button type="button" class="link-btn" data-back>${icon('arrowLeft', { size: 18 })}Voltar</button>
        <h1 class="lib__title">Criar uma turma</h1>
        <div data-step></div>
      </div>`);
    body.querySelector('[data-back]').addEventListener('click', () => (groups.length ? openGroup(current || groups[0]) : welcome()));
    const step = body.querySelector('[data-step]');
    step.innerHTML = `
      <label class="field">
        <span class="field__label">Nome da turma</span>
        <input type="text" class="field__input" maxlength="40" autocomplete="off" placeholder="ex.: Amigas do 5º B" data-gname>
      </label>
      <div data-prof></div>
      <button type="button" class="btn btn--primary btn--wide" data-next><span>Continuar</span></button>`;
    const prof = profileFields(step.querySelector('[data-prof]'), { nameLabel: 'Seu nome (de quem cuida da turma)' });
    step.querySelector('[data-gname]').focus();
    step.querySelector('[data-next]').addEventListener('click', () => {
      const gname = step.querySelector('[data-gname]').value.trim();
      const p = prof.get();
      if (!gname) return toast('Dê um nome para a turma.', { kind: 'error' });
      if (!p.name) return toast('Escreva o seu nome.', { kind: 'error' }), prof.focus();
      chooseSecret(step, {
        intro: `<p class="modal__text">Com a senha de figurinhas você entra como <strong>${esc(p.name)}</strong> em outro aparelho. Guarde bem!</p>`,
        onDone: async (secret) => {
          loading('Criando a turma…');
          try {
            const r = await createGroup({ group: gname, ...p, secret });
            groups = await myGroups();
            const g = groups.find((x) => x.id === r.group_id);
            toast('Turma criada! Agora chame as amigas.');
            openGroup(g, { invite: true });
          } catch (err) {
            console.error(err);
            message('Não deu certo', esc(errorText(err)), { retry: createScreen });
          }
        },
      });
    });
  }

  // ---------- convite ----------
  async function openInvite(code) {
    loading('Abrindo o convite…');
    let info;
    try {
      info = await groupByInvite(code);
    } catch (err) {
      return message('Sem conexão', esc(errorText(err)), { retry: () => openInvite(code) });
    }
    if (!alive) return;
    if (!info) {
      return message('Convite não encontrado', 'Esse convite não vale mais ou foi digitado errado. Peça um link novo para quem cuida da turma.', {
        extra: `<button type="button" class="btn btn--soft" data-home>${icon('arrowLeft', { size: 20 })}Voltar</button>`,
      }), body.querySelector('[data-home]').addEventListener('click', () => (groups.length ? openGroup(groups[0]) : welcome()));
    }
    const mine = groups.find((g) => g.id === info.id);
    if (mine) return openGroup(mine);
    inviteScreen(code, info);
  }

  function inviteScreen(code, info) {
    screen(`
      <div class="turma__box turma__box--form">
        <p class="turma__kicker">Convite para a turma</p>
        <h1 class="lib__title">${esc(info.name)}</h1>
        ${
          info.members.length
            ? `<div class="turma__faces">${info.members.slice(0, 12).map((m) => ava(m)).join('')}${info.members.length > 12 ? `<span class="turma__more">+${info.members.length - 12}</span>` : ''}</div>`
            : ''
        }
        <div class="turma__choices turma__choices--tight">
          <button type="button" class="btn btn--primary" data-new>${icon('sparkle', { size: 22, fill: true })}Sou nova aqui</button>
          <button type="button" class="btn btn--soft" data-old ${info.members.length ? '' : 'disabled'}>${icon('heart', { size: 22 })}Já sou da turma</button>
        </div>
        <p class="print-tip">"Já sou da turma" é para entrar como você mesma em outro aparelho, com a sua senha de figurinhas.</p>
      </div>`);
    body.querySelector('[data-new]').addEventListener('click', () => newMemberScreen(code, info));
    body.querySelector('[data-old]').addEventListener('click', () => loginScreen(code, info));
  }

  function newMemberScreen(code, info) {
    screen(`
      <div class="turma__box turma__box--form">
        <button type="button" class="link-btn" data-back>${icon('arrowLeft', { size: 18 })}Voltar</button>
        <p class="turma__kicker">Entrar na turma</p>
        <h1 class="lib__title">${esc(info.name)}</h1>
        <div data-step></div>
      </div>`);
    body.querySelector('[data-back]').addEventListener('click', () => inviteScreen(code, info));
    const step = body.querySelector('[data-step]');
    step.innerHTML = `<div data-prof></div><button type="button" class="btn btn--primary btn--wide" data-next><span>Continuar</span></button>`;
    const prof = profileFields(step.querySelector('[data-prof]'));
    prof.focus();
    step.querySelector('[data-next]').addEventListener('click', () => {
      const p = prof.get();
      if (!p.name) return toast('Escreva o seu nome.', { kind: 'error' }), prof.focus();
      if (info.members.some((m) => m.name.toLowerCase() === p.name.toLowerCase())) {
        return toast('Já tem alguém com esse nome na turma. Ponha mais uma letra ou o sobrenome.', { kind: 'error' }), prof.focus();
      }
      chooseSecret(step, {
        intro: `<p class="modal__text">Com a senha de figurinhas você entra como <strong>${esc(p.name)}</strong> em outro aparelho e vê tudo o que já postou. Guarde bem!</p>`,
        onDone: async (secret) => {
          loading('Mandando o pedido…');
          try {
            await joinGroup({ invite: code, ...p, secret });
            groups = await myGroups();
            openGroup(groups.find((g) => g.id === info.id));
          } catch (err) {
            console.error(err);
            message('Não deu certo', esc(errorText(err)), { retry: () => newMemberScreen(code, info) });
          }
        },
      });
    });
  }

  function loginScreen(code, info, chosen = null) {
    screen(`
      <div class="turma__box turma__box--form">
        <button type="button" class="link-btn" data-back>${icon('arrowLeft', { size: 18 })}Voltar</button>
        <p class="turma__kicker">${esc(info.name)}</p>
        <h1 class="lib__title">${chosen ? `Oi, ${esc(chosen.name)}!` : 'Quem é você?'}</h1>
        <div data-step></div>
      </div>`);
    body.querySelector('[data-back]').addEventListener('click', () => (chosen ? loginScreen(code, info) : inviteScreen(code, info)));
    const step = body.querySelector('[data-step]');
    if (!chosen) {
      step.innerHTML = `<div class="who-grid">${info.members
        .map((m) => `<button type="button" class="who" data-m="${m.id}">${ava(m, 'ava--lg')}<span>${esc(m.name)}</span></button>`)
        .join('')}</div>`;
      step.addEventListener('click', (e) => {
        const b = e.target.closest('[data-m]');
        if (b) loginScreen(code, info, info.members.find((m) => m.id === b.dataset.m));
      });
      return;
    }
    step.innerHTML = `<div data-sp></div><p class="modal__status" data-status></p>
      <p class="print-tip">Esqueceu a senha? Peça para quem cuida da turma trocar ela para você.</p>`;
    const status = step.querySelector('[data-status]');
    const sp = mountSecret(step.querySelector('[data-sp]'), {
      label: 'Toque a sua senha de figurinhas',
      onDone: async (secret) => {
        status.textContent = 'Conferindo…';
        try {
          const r = await loginMember(code, chosen.id, secret);
          if (r && r.ok) {
            groups = await myGroups();
            toast(`Que bom te ver, ${chosen.name}!`);
            return openGroup(groups.find((g) => g.id === info.id));
          }
          sp.reset();
          if (r && r.locked_minutes) {
            const min = r.locked_minutes;
            status.textContent = `Muitas tentativas. Espere ${min >= 60 ? `${Math.round(min / 60)} h` : `${min} min`} ou peça para quem cuida da turma trocar a sua senha.`;
          } else {
            status.textContent = `Não é essa. ${r && r.tries_left === 1 ? 'Falta 1 tentativa' : `Faltam ${r ? r.tries_left : '?'} tentativas`} antes de travar um pouquinho.`;
          }
        } catch (err) {
          sp.reset();
          status.textContent = errorText(err);
        }
      },
    });
  }

  // ---------- turma aberta ----------
  async function openGroup(g, { invite = false } = {}) {
    if (!g) return welcome();
    current = g;
    flipped.clear();
    filter = 'all';
    db.setMeta('groupCurrent', g.id).catch(() => {});
    if (g.me.status !== 'active') return pendingScreen(g);
    loading();
    try {
      await loadFeed();
    } catch (err) {
      console.error(err);
      return message('Sem conexão', esc(errorText(err)), { retry: () => openGroup(g) });
    }
    if (!alive) return;
    feedScreen();
    markSeen(g.id);
    if (invite) manage(true);
  }

  function pendingScreen(g) {
    screen(`
      <div class="turma__box turma__box--center">
        ${ava(g.me, 'ava--xl')}
        <h1 class="lib__title">Pedido enviado!</h1>
        <p class="lib__sub">Quando quem cuida da turma <strong>${esc(g.name)}</strong> aceitar, os cards de todo mundo aparecem aqui.</p>
        <div class="turma__row">
          <button type="button" class="btn btn--primary" data-check>${icon('rotate', { size: 22 })}<span>Ver se já aceitaram</span></button>
          <button type="button" class="btn btn--soft" data-cancel>Desistir</button>
        </div>
        ${groups.length > 1 ? `<button type="button" class="link-btn" data-other>${icon('arrowLeft', { size: 18 })}Ir para outra turma</button>` : ''}
      </div>`);
    const checkBtn = body.querySelector('[data-check]');
    checkBtn.addEventListener('click', async () => {
      const done = busyBtn(checkBtn, 'Vendo…');
      try {
        groups = await myGroups();
        const fresh = groups.find((x) => x.id === g.id);
        if (!fresh) return toast('O pedido não foi aceito. Peça um convite novo.', { kind: 'error' }), welcome();
        if (fresh.me.status === 'active') {
          toast('Aceitaram! Bem-vinda à turma!');
          return openGroup(fresh);
        }
        toast('Ainda não aceitaram. Tente daqui a pouco.');
      } catch (err) {
        toast(errorText(err), { kind: 'error' });
      } finally {
        if (body.contains(checkBtn)) done();
      }
    });
    body.querySelector('[data-cancel]').addEventListener('click', async () => {
      try {
        await leaveGroup(g.id);
      } catch (_) {}
      start();
    });
    const other = body.querySelector('[data-other]');
    if (other) other.addEventListener('click', () => openGroup(groups.find((x) => x.id !== g.id)));
  }

  async function loadFeed() {
    const [m, p] = await Promise.all([groupMembers(current.id), groupFeed(current.id)]);
    members = m;
    posts = p;
  }

  const meId = () => current.me.id;
  const isOwner = () => !!current.me.is_owner;
  const memberById = (id) => members.find((m) => m.id === id) || { name: 'Alguém', avatar: 0, color: 0 };

  function shownPosts() {
    if (filter === 'trade') return posts.filter((p) => p.forTrade);
    if (filter === 'mine') return posts.filter((p) => p.memberId === meId());
    if (filter.startsWith('m:')) return posts.filter((p) => p.memberId === filter.slice(2));
    return posts;
  }

  function feedScreen(keepScroll = false) {
    const active = members.filter((m) => m.status === 'active');
    const pending = isOwner() ? members.filter((m) => m.status === 'pending') : [];
    screen(`
      <div class="turma__head">
        <div>
          <p class="turma__kicker">Minha turma</p>
          <h1 class="lib__title">${esc(current.name)}</h1>
        </div>
        <div class="turma__headacts">
          <button type="button" class="btn btn--primary btn--sm" data-act="invite">${icon('upload', { size: 20 })}Chamar amigas</button>
          <button type="button" class="btn btn--soft btn--sm" data-act="manage">${icon('users', { size: 20 })}Turma</button>
          <a class="btn btn--soft btn--sm" href="#/photo-cards">${icon('plus', { size: 20 })}Fazer um card</a>
        </div>
      </div>
      ${
        groups.length > 1
          ? `<div class="chips turma__groups" role="group" aria-label="Minhas turmas">${groups
              .map((g) => `<button type="button" class="font-chip font-chip--sm" data-group="${g.id}" aria-pressed="${g.id === current.id}">${esc(g.name)}${g.me.status !== 'active' ? ' <span class="chip-n">esperando</span>' : ''}</button>`)
              .join('')}<button type="button" class="font-chip font-chip--sm font-chip--add" data-act="other">${icon('plus', { size: 16 })} Outra turma</button></div>`
          : ''
      }
      ${
        pending.length
          ? `<div class="turma__requests">
              <h2 class="lib__h2">${pending.length === 1 ? 'Um pedido para entrar' : `${pending.length} pedidos para entrar`}</h2>
              ${pending
                .map(
                  (m) => `<div class="req">${ava(m)}<strong>${esc(m.name)}</strong>
                  <button type="button" class="btn btn--primary btn--sm" data-approve="${m.id}">${icon('check', { size: 18 })}Aceitar</button>
                  <button type="button" class="btn btn--soft btn--sm" data-reject="${m.id}">Recusar</button></div>`
                )
                .join('')}
              <p class="print-tip">Só aceite quem você conhece de verdade.</p>
            </div>`
          : ''
      }
      <div class="turma__people" role="group" aria-label="Pessoas da turma">
        ${active
          .map((m) => `<button type="button" class="who who--sm" data-filter="m:${m.id}" aria-pressed="${filter === 'm:' + m.id}">${ava(m)}<span>${esc(m.id === meId() ? 'Eu' : m.name)}</span></button>`)
          .join('')}
      </div>
      <div class="binder__bar">
        <div class="chips" role="group" aria-label="Mostrar" data-filters></div>
        <button type="button" class="link-btn" data-act="refresh">${icon('rotate', { size: 18 })}Atualizar</button>
      </div>
      <div class="feed" data-feed></div>`, keepScroll);
    renderFeed();
    refreshTimer = setInterval(() => document.visibilityState === 'visible' && refresh(true), 90_000);
  }

  function chip(id, label, n) {
    return `<button type="button" class="font-chip font-chip--sm" data-filter="${id}" aria-pressed="${filter === id}">${label}${n != null ? ` <span class="chip-n">${n}</span>` : ''}</button>`;
  }

  function renderFeed() {
    const f = body.querySelector('[data-filters]');
    if (!f) return;
    const who = filter.startsWith('m:') ? memberById(filter.slice(2)) : null;
    f.innerHTML = [
      chip('all', 'Tudo', posts.length),
      chip('trade', 'Pra trocar', posts.filter((p) => p.forTrade).length),
      chip('mine', 'Meus posts', posts.filter((p) => p.memberId === meId()).length),
      who && filter.slice(2) !== meId() ? chip(filter, `${avatarOf(who)} ${esc(who.name)}`, shownPosts().length) : '',
    ].join('');
    body.querySelectorAll('.turma__people [data-filter]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.filter === filter)));

    const list = shownPosts();
    const feed = body.querySelector('[data-feed]');
    if (!list.length) {
      const empty =
        filter === 'mine'
          ? 'Você ainda não postou nada. Abra um card e toque em <strong>Mostrar pra turma</strong>.'
          : filter === 'trade'
            ? 'Ninguém marcou card para trocar agora.'
            : filter.startsWith('m:')
              ? 'Essa pessoa não postou nada nos últimos 30 dias.'
              : 'Ninguém postou ainda. Faça um card e toque em <strong>Mostrar pra turma</strong>!';
      feed.innerHTML = `<p class="card-list__empty">${empty}</p>`;
      return;
    }
    feed.innerHTML = list.map(postHtml).join('');
  }

  function postHtml(p) {
    const m = memberById(p.memberId);
    const mine = p.memberId === meId();
    const { w, h } = cardSize({ format: p.format, orientation: p.orientation });
    const back = flipped.has(p.id) && p.back;
    const count = (id) => p.reactions.filter((r) => r.emoji === id).length;
    const minePressed = (id) => p.reactions.some((r) => r.emoji === id && r.member_id === meId());
    return `
      <article class="post">
        <header class="post__head">
          ${ava(m)}
          <span class="post__who"><strong>${esc(mine ? 'Eu' : m.name)}</strong><small>${agoText(p.at)} · ${leftText(p.daysLeft)}</small></span>
          ${p.forTrade ? '<span class="tag tag--trade">pra trocar</span>' : ''}
        </header>
        <div class="post__img" style="aspect-ratio:${w}/${h}">
          <img src="${back ? p.back : p.front}" alt="${esc(formatInfo(p.format).name)} de ${esc(m.name)}${back ? ', verso' : ''}" loading="lazy" draggable="false">
          ${p.hasBack ? `<button type="button" class="post__flip round-btn" data-flip="${p.id}" aria-label="${back ? 'Ver a frente' : 'Ver o verso'}" title="${back ? 'Ver a frente' : 'Ver o verso'}">${icon('flipCard', { size: 20 })}</button>` : ''}
        </div>
        <div class="post__reacts">
          ${REACTIONS.map(
            (r) => `<button type="button" class="react" data-react="${r.id}" data-post="${p.id}" aria-pressed="${minePressed(r.id)}" aria-label="${r.name}" title="${r.name}"><span>${r.emoji}</span>${count(r.id) ? `<b>${count(r.id)}</b>` : ''}</button>`
          ).join('')}
        </div>
        <div class="post__acts">
          ${p.canCopy && !mine ? `<button type="button" class="btn btn--soft btn--sm" data-copy="${p.id}">${icon('copy', { size: 18 })}<span>Quero um igual</span></button>` : ''}
          ${mine ? `<button type="button" class="link-btn" data-trade="${p.id}">${icon(p.forTrade ? 'close' : 'heart', { size: 18 })}${p.forTrade ? 'Não tenho mais pra trocar' : 'Tenho pra trocar'}</button>` : ''}
          ${mine || isOwner() ? `<button type="button" class="link-btn link-btn--danger" data-del="${p.id}">${icon('trash', { size: 18 })}Apagar</button>` : ''}
        </div>
      </article>`;
  }

  async function refresh(quiet = false) {
    if (!current || current.me.status !== 'active') return;
    try {
      const fresh = await myGroups();
      groups = fresh;
      const g = fresh.find((x) => x.id === current.id);
      if (!g) {
        toast('Você não está mais nessa turma.', { kind: 'error' });
        return start();
      }
      current = g;
      await loadFeed();
      if (!alive) return;
      feedScreen(true);
      markSeen(current.id);
      if (!quiet) toast('Atualizado!');
    } catch (err) {
      if (!quiet) toast(errorText(err), { kind: 'error' });
    }
  }

  async function toggleReact(btn) {
    const p = posts.find((x) => x.id === btn.dataset.post);
    if (!p) return;
    const emoji = btn.dataset.react;
    const on = !p.reactions.some((r) => r.emoji === emoji && r.member_id === meId());
    const before = p.reactions.slice();
    p.reactions = on ? [...p.reactions, { member_id: meId(), emoji }] : p.reactions.filter((r) => !(r.emoji === emoji && r.member_id === meId()));
    renderFeed();
    try {
      await react(p.id, meId(), emoji, on);
    } catch (err) {
      p.reactions = before;
      renderFeed();
      toast(errorText(err), { kind: 'error' });
    }
  }

  async function copyModel(btn) {
    const done = busyBtn(btn, 'Abrindo…');
    try {
      const design = await fetchModel(current.id, btn.dataset.copy);
      if (!design) throw new Error('modelo inválido');
      await db.setMeta('pendingModel', design);
      location.hash = '#/photo-cards?model=1';
    } catch (err) {
      console.error(err);
      done();
      toast('Não consegui abrir esse modelo.', { kind: 'error' });
    }
  }

  async function removePost(btn) {
    if (!btn.dataset.sure) {
      btn.dataset.sure = '1';
      btn.lastChild.textContent = 'Toque de novo para apagar';
      return;
    }
    const id = btn.dataset.del;
    try {
      await deletePost(id);
      posts = posts.filter((p) => p.id !== id);
      renderFeed();
      toast('Post apagado.');
    } catch (err) {
      toast(errorText(err), { kind: 'error' });
    }
  }

  async function toggleTrade(btn) {
    const p = posts.find((x) => x.id === btn.dataset.trade);
    if (!p) return;
    try {
      await setForTrade(p.id, !p.forTrade);
      p.forTrade = !p.forTrade;
      renderFeed();
      toast(p.forTrade ? 'Marcado: tenho pra trocar!' : 'Desmarcado.');
    } catch (err) {
      toast(errorText(err), { kind: 'error' });
    }
  }

  async function answerRequest(id, accept, btn) {
    btn.disabled = true;
    try {
      if (accept) await approveMember(id);
      else await removeMember(id);
      const m = memberById(id);
      toast(accept ? `${m.name} entrou na turma!` : 'Pedido recusado.');
      await loadFeed();
      if (alive) feedScreen(true);
    } catch (err) {
      btn.disabled = false;
      toast(errorText(err), { kind: 'error' });
    }
  }

  // ---------- janelinha "Turma" ----------
  function manage(justCreated = false) {
    const g = current;
    const owner = isOwner();
    const list = members.filter((m) => m.status === 'active');
    openModal({
      title: g.name,
      html: `
        <div class="manage">
          <section class="manage__sec">
            <h3 class="manage__h">${icon('upload', { size: 20 })} Convite</h3>
            ${justCreated ? '<p class="modal__text">Mande este link para quem você quer na turma. Quando a pessoa pedir para entrar, aparece um aviso aqui no feed para você aceitar.</p>' : '<p class="modal__text">Quem abrir este link pode pedir para entrar. Quem cuida da turma aceita.</p>'}
            <input type="text" class="field__input" readonly value="${esc(inviteUrl(g.invite))}" data-link aria-label="Link do convite">
            <div class="turma__row">
              <button type="button" class="btn btn--primary btn--sm" data-m="share">${icon('upload', { size: 18 })}Mandar o convite</button>
              ${owner ? `<button type="button" class="btn btn--soft btn--sm" data-m="new-invite">${icon('rotate', { size: 18 })}<span>Fazer link novo</span></button>` : ''}
            </div>
            ${owner ? '<p class="print-tip">Link novo: o antigo para de funcionar (quem já está na turma continua).</p>' : ''}
          </section>
          <section class="manage__sec">
            <h3 class="manage__h">${icon('users', { size: 20 })} Pessoas (${list.length})</h3>
            <ul class="people">
              ${list
                .map(
                  (m) => `<li class="person">
                  ${ava(m)}<span class="person__name"><strong>${esc(m.name)}</strong>${m.is_owner ? '<span class="tag">cuida da turma</span>' : ''}${m.id === g.me.id ? '<span class="tag tag--sheet">eu</span>' : ''}</span>
                  ${
                    owner && m.id !== g.me.id
                      ? `<span class="person__acts">
                        <button type="button" class="link-btn" data-m="secret" data-id="${m.id}">${icon('sparkle', { size: 16 })}Nova senha</button>
                        <button type="button" class="link-btn" data-m="owner" data-id="${m.id}">${icon(m.is_owner ? 'close' : 'check', { size: 16 })}${m.is_owner ? 'Não cuida mais' : 'Cuidar da turma'}</button>
                        <button type="button" class="link-btn link-btn--danger" data-m="remove" data-id="${m.id}">${icon('trash', { size: 16 })}<span>Tirar</span></button>
                      </span>`
                      : ''
                  }
                </li>`
                )
                .join('')}
            </ul>
          </section>
          <section class="manage__sec">
            <h3 class="manage__h">${ava(g.me)} Eu: ${esc(g.me.name)}</h3>
            <div class="turma__row">
              <button type="button" class="btn btn--soft btn--sm" data-m="my-secret">${icon('sparkle', { size: 18 })}Trocar minha senha</button>
              <button type="button" class="btn btn--soft btn--sm" data-m="other">${icon('plus', { size: 18 })}Entrar em outra turma</button>
            </div>
            <button type="button" class="link-btn link-btn--danger" data-m="leave">${icon('arrowLeft', { size: 18 })}<span>Sair da turma neste aparelho</span></button>
            <p class="print-tip">Para voltar depois, abra o convite, toque em "Já sou da turma" e use a sua senha de figurinhas.</p>
          </section>
        </div>`,
      onMount(mb, close) {
        mb.addEventListener('click', async (e) => {
          const b = e.target.closest('[data-m]');
          if (!b || b.disabled) return;
          const what = b.dataset.m;
          const m = b.dataset.id ? memberById(b.dataset.id) : null;
          try {
            if (what === 'share') return shareInvite(g);
            if (what === 'new-invite') {
              if (!b.dataset.sure) {
                b.dataset.sure = '1';
                b.querySelector('span').textContent = 'Toque de novo para trocar';
                return;
              }
              const code = await newInvite(g.id);
              g.invite = code;
              mb.querySelector('[data-link]').value = inviteUrl(code);
              delete b.dataset.sure;
              b.querySelector('span').textContent = 'Fazer link novo';
              return toast('Link novo pronto. O antigo não funciona mais.');
            }
            if (what === 'owner') {
              await setMemberOwner(m.id, !m.is_owner);
              close();
              await loadFeed();
              if (alive) feedScreen(true);
              return toast(m.is_owner ? `${m.name} não cuida mais da turma.` : `${m.name} agora também cuida da turma.`);
            }
            if (what === 'remove') {
              if (!b.dataset.sure) {
                b.dataset.sure = '1';
                b.querySelector('span').textContent = 'Toque de novo (os posts saem junto)';
                return;
              }
              await removeMember(m.id);
              close();
              await loadFeed();
              if (alive) feedScreen(true);
              return toast(`${m.name} saiu da turma.`);
            }
            if (what === 'secret') {
              close();
              return secretModal(`Senha nova para ${m.name}`, `Escolha a senha nova de ${esc(m.name)} e conte só para ela.`, async (code) => {
                await setMemberSecret(m.id, code);
                toast(`A senha nova de ${m.name} é ${secretEmojis(code)}`, { duration: 12000 });
              });
            }
            if (what === 'my-secret') {
              close();
              return secretModal('Trocar minha senha', 'Escolha a sua senha nova de figurinhas.', async (code) => {
                await setMySecret(g.id, code);
                toast(`Senha trocada! A nova é ${secretEmojis(code)}`, { duration: 9000 });
              });
            }
            if (what === 'other') {
              close();
              return welcome();
            }
            if (what === 'leave') {
              if (!b.dataset.sure) {
                b.dataset.sure = '1';
                b.querySelector('span').textContent = 'Toque de novo para sair';
                return;
              }
              await leaveGroup(g.id);
              close();
              toast('Você saiu da turma neste aparelho.');
              return start();
            }
          } catch (err) {
            console.error(err);
            toast(errorText(err), { kind: 'error' });
          }
        });
      },
    });
  }

  function secretModal(titleText, text, save) {
    openModal({
      title: titleText,
      html: `<p class="modal__text">${text}</p><div data-sec></div>`,
      onMount(mb, close) {
        chooseSecret(mb.querySelector('[data-sec]'), {
          onDone: async (code) => {
            try {
              await save(code);
              close();
            } catch (err) {
              toast(errorText(err), { kind: 'error' });
            }
          },
        });
      },
    });
  }

  // ---------- cliques do feed ----------
  body.addEventListener('click', (e) => {
    const t = e.target.closest('button');
    if (!t || !body.contains(t) || t.disabled || !current) return;
    const ds = t.dataset;
    if (ds.react) return toggleReact(t);
    if (ds.flip) {
      if (flipped.has(ds.flip)) flipped.delete(ds.flip);
      else flipped.add(ds.flip);
      return renderFeed();
    }
    if (ds.copy) return copyModel(t);
    if (ds.del) return removePost(t);
    if (ds.trade) return toggleTrade(t);
    if (ds.approve) return answerRequest(ds.approve, true, t);
    if (ds.reject) return answerRequest(ds.reject, false, t);
    if (ds.filter) {
      filter = filter === ds.filter && ds.filter.startsWith('m:') ? 'all' : ds.filter;
      if (filter === 'm:' + meId()) filter = 'mine';
      return renderFeed();
    }
    if (ds.group) return openGroup(groups.find((g) => g.id === ds.group));
    if (ds.act === 'invite') return shareInvite(current);
    if (ds.act === 'manage') return manage();
    if (ds.act === 'refresh') return refresh();
    if (ds.act === 'other') return welcome();
  });

  function onVisible() {
    if (document.visibilityState === 'visible' && body.querySelector('[data-feed]')) refresh(true);
  }
  document.addEventListener('visibilitychange', onVisible);

  await start();
  return () => {
    alive = false;
    clearInterval(refreshTimer);
    document.removeEventListener('visibilitychange', onVisible);
  };
}
