/* ==========================================================================
   CONFIGURAÇÃO: troque só estes valores. Tudo aqui é PÚBLICO (front-end):
   nunca coloque chaves secretas, tokens ou senhas neste arquivo.
   ========================================================================== */

// URL que recebe o lead via POST (JSON): webhook do CRM, Make, Zapier, Formspree...
// Vazio ou com falha = o lead segue pelo WhatsApp com os dados preenchidos.
const FORM_ENDPOINT = '';

// Alguns webhooks (ex.: Zapier) recusam o "preflight" CORS de application/json.
// Se o envio falhar só por CORS, mude para true: o corpo continua sendo JSON,
// mas vai com Content-Type text/plain (sem preflight).
const FORM_SEND_AS_TEXT = false;

// WhatsApp do atendimento: DDI + DDD + número, só dígitos. Ex.: '5547999999999'
const WHATSAPP_NUMBER = '';

// Mensagem pré-preenchida dos botões de WhatsApp
const WHATSAPP_MSG = 'Olá! Tenho interesse no Yachthouse by Pininfarina e gostaria de receber a tabela e as plantas.';

// Google Maps > Compartilhar > Incorporar um mapa > copie só a URL do src do iframe
const MAP_EMBED_URL = 'https://www.google.com/maps?q=Av.+Normando+Tedesco,+1400+-+Barra+Sul,+Balne%C3%A1rio+Cambori%C3%BA+-+SC&output=embed';

const FORM_TIMEOUT_MS = 8000;
const EMPREENDIMENTO = 'Yachthouse by Pininfarina';

/* ========================================================================== */

(function () {
  'use strict';

  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));

  /* ---------- Tracking (Meta Pixel / Google Tag) ---------- */
  // Eventos: PageView, Lead, WhatsAppClick. Instale os snippets base no <head>
  // (já estão lá, comentados) e descomente as linhas abaixo.
  function track(evento, dados = {}) {
    // Meta Pixel
    // if (window.fbq) {
    //   if (evento === 'PageView') fbq('track', 'PageView');
    //   if (evento === 'Lead') fbq('track', 'Lead', { content_name: EMPREENDIMENTO, ...dados });
    //   if (evento === 'WhatsAppClick') fbq('trackCustom', 'WhatsAppClick', { content_name: EMPREENDIMENTO, ...dados });
    // }

    // Google Tag (GA4 / Google Ads)
    // if (window.gtag) {
    //   if (evento === 'Lead') gtag('event', 'generate_lead', { item_name: EMPREENDIMENTO, ...dados });
    //   if (evento === 'WhatsAppClick') gtag('event', 'whatsapp_click', { item_name: EMPREENDIMENTO, ...dados });
    //   // Conversão do Google Ads: gtag('event', 'conversion', { send_to: 'AW-XXXXXXX/XXXXXXXX' });
    // }

    // dataLayer (pronto para Google Tag Manager; não faz chamada externa sozinho)
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({ event: evento, empreendimento: EMPREENDIMENTO, ...dados });
  }

  track('PageView');

  /* ---------- WhatsApp ---------- */
  function waUrl(texto) {
    const numero = WHATSAPP_NUMBER.replace(/\D/g, '');
    return `https://wa.me/${numero}?text=${encodeURIComponent(texto)}`;
  }

  function openWhatsApp(texto) {
    const win = window.open(waUrl(texto), '_blank');
    if (win) win.opener = null;
    return Boolean(win);
  }

  $$('[data-whatsapp]').forEach((link) => {
    link.href = waUrl(WHATSAPP_MSG);
    link.target = '_blank';
    link.rel = 'noopener';
    link.addEventListener('click', () => track('WhatsAppClick', { origem: link.dataset.origem || '' }));
  });

  /* ---------- UTMs ---------- */
  const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content'];
  const utms = {};
  const params = new URLSearchParams(window.location.search);
  UTM_KEYS.forEach((key) => {
    let valor = params.get(key) || '';
    try {
      if (valor) sessionStorage.setItem(key, valor);
      else valor = sessionStorage.getItem(key) || '';
    } catch (e) { /* storage bloqueado: segue só com a query string */ }
    utms[key] = valor.slice(0, 200);
  });
  $$('.lead-form').forEach((form) => {
    UTM_KEYS.forEach((key) => {
      const campo = form.elements[key];
      if (campo) campo.value = utms[key];
    });
  });

  /* ---------- Máscara de telefone ---------- */
  function maskPhone(valor) {
    if (valor.trim().startsWith('+')) {
      return '+' + valor.replace(/[^\d ]/g, '').slice(0, 20); // número internacional: sem máscara BR
    }
    const d = valor.replace(/\D/g, '').slice(0, 11);
    if (d.length <= 2) return d.length ? `(${d}` : '';
    if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
    if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
    return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  }

  $$('[data-mask="phone"]').forEach((input) => {
    input.addEventListener('input', () => {
      const fim = input.selectionStart === input.value.length;
      input.value = maskPhone(input.value);
      if (fim) input.setSelectionRange(input.value.length, input.value.length);
    });
  });

  /* ---------- Validação ---------- */
  const REGRAS = {
    nome: (v) => v.trim().length >= 2 || 'Informe seu nome.',
    whatsapp: (v) => {
      const d = v.replace(/\D/g, '');
      if (v.trim().startsWith('+')) return (d.length >= 8 && d.length <= 15) || 'Informe o número com código do país, por exemplo +1 305 555 0100.';
      return (d.length === 10 || d.length === 11) || 'Informe o WhatsApp com DDD, por exemplo (47) 99999-9999.';
    },
    email: (v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim()) || 'Informe um e-mail válido, por exemplo nome@empresa.com.',
    consentimento: (_, el) => el.checked || 'Marque a autorização para receber o contato.',
  };

  function validarCampo(el) {
    const regra = REGRAS[el.name];
    if (!regra) return true;
    const resultado = regra(el.value, el);
    const erro = document.getElementById(el.getAttribute('aria-describedby'));
    const ok = resultado === true;
    el.setAttribute('aria-invalid', ok ? 'false' : 'true');
    if (erro) erro.textContent = ok ? '' : resultado;
    return ok;
  }

  /* ---------- Envio ---------- */
  async function postLead(lead) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FORM_TIMEOUT_MS);
    try {
      const res = await fetch(FORM_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': FORM_SEND_AS_TEXT ? 'text/plain;charset=UTF-8' : 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(lead),
        signal: controller.signal,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
    } finally {
      clearTimeout(timer);
    }
  }

  function mensagemWhatsAppLead(lead) {
    return [
      `Olá! Tenho interesse no ${EMPREENDIMENTO}.`,
      `Pedido: ${lead.interesse}`,
      `Nome: ${lead.nome}`,
      `E-mail: ${lead.email}`,
      `WhatsApp: ${lead.whatsapp}`,
    ].join('\n');
  }

  function escapeHtml(s) {
    return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  // viaWhatsApp: o lead segue pelo WhatsApp. abriu: a janela do WhatsApp abriu (pop-up não bloqueado)
  function mostrarSucesso(form, lead, viaWhatsApp, abriu = true) {
    const status = $('.form-status', form);
    const primeiroNome = escapeHtml(lead.nome.trim().split(/\s+/)[0]);
    const link = escapeHtml(waUrl(mensagemWhatsAppLead(lead)));

    status.innerHTML = viaWhatsApp
      ? `<h3 tabindex="-1">Falta só um passo, ${primeiroNome}.</h3>
         <p>${abriu ? 'Abrimos o WhatsApp com seus dados. Envie a mensagem' : 'Toque no botão abaixo e envie a mensagem que já está pronta'} para receber a tabela e as plantas do ${EMPREENDIMENTO}.</p>
         <a class="btn btn-primary btn-block wa-fallback" href="${link}" target="_blank" rel="noopener">Enviar pelo WhatsApp</a>`
      : `<h3 tabindex="-1">Recebemos seus dados, ${primeiroNome}.</h3>
         <p>Um especialista da Mercatto vai chamar você no WhatsApp ${escapeHtml(lead.whatsapp)} para enviar a tabela e as plantas do ${EMPREENDIMENTO}.</p>
         <p><a href="${link}" target="_blank" rel="noopener">Prefere adiantar? Fale agora pelo WhatsApp.</a></p>`;

    form.classList.add('is-sent');
    $('h3', status).focus();
  }

  $$('.lead-form').forEach((form) => {
    const campos = $$('input[name="nome"], input[name="whatsapp"], input[name="email"], input[name="consentimento"]', form);

    campos.forEach((el) => {
      el.addEventListener('blur', () => { if (el.value || el.dataset.touched) validarCampo(el); });
      el.addEventListener('input', () => {
        el.dataset.touched = '1';
        if (el.getAttribute('aria-invalid') === 'true') validarCampo(el);
      });
      el.addEventListener('change', () => { if (el.type === 'checkbox') validarCampo(el); });
    });

    form.addEventListener('submit', async (ev) => {
      ev.preventDefault();
      if (form.dataset.sending) return;

      const invalidos = campos.filter((el) => !validarCampo(el));
      if (invalidos.length) { invalidos[0].focus(); return; }

      // Honeypot: robôs preenchem o campo oculto "empresa"
      if (form.elements.empresa && form.elements.empresa.value) { form.classList.add('is-sent'); return; }

      const lead = {
        empreendimento: EMPREENDIMENTO,
        nome: form.elements.nome.value.trim(),
        whatsapp: form.elements.whatsapp.value.trim(),
        email: form.elements.email.value.trim(),
        consentimento_lgpd: true,
        interesse: form.dataset.titulo || 'Receber tabela e plantas',
        origem: form.dataset.origem || '',
        ...utms,
        pagina: window.location.href.split('#')[0],
        referrer: document.referrer,
        enviado_em: new Date().toISOString(),
      };

      // Sem endpoint: abre o WhatsApp ainda dentro do clique (evita bloqueio de pop-up)
      if (!FORM_ENDPOINT) {
        const abriu = openWhatsApp(mensagemWhatsAppLead(lead));
        track('Lead', { origem: lead.origem, canal: 'whatsapp' });
        mostrarSucesso(form, lead, true, abriu);
        return;
      }

      const botao = $('button[type="submit"]', form);
      const rotulo = botao.textContent;
      form.dataset.sending = '1';
      botao.disabled = true;
      botao.textContent = 'Enviando…';

      try {
        await postLead(lead);
        track('Lead', { origem: lead.origem, canal: 'formulario' });
        mostrarSucesso(form, lead, false);
      } catch (err) {
        // Falhou (rede, CORS, timeout): o lead não se perde, segue pelo WhatsApp
        // (fora do clique, o navegador pode bloquear o pop-up; o botão da mensagem cobre esse caso)
        const abriu = openWhatsApp(mensagemWhatsAppLead(lead));
        track('Lead', { origem: lead.origem, canal: 'whatsapp-fallback' });
        mostrarSucesso(form, lead, true, abriu);
      } finally {
        delete form.dataset.sending;
        botao.disabled = false;
        botao.textContent = rotulo;
      }
    });
  });

  /* ---------- Diálogos (formulário e lightbox) ---------- */
  let ultimoGatilho = null;

  function abrirDialogo(dialog, gatilho) {
    ultimoGatilho = gatilho || document.activeElement;
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.setAttribute('open', '');
    document.body.classList.add('has-dialog');
  }

  $$('dialog').forEach((dialog) => {
    dialog.addEventListener('close', () => {
      document.body.classList.remove('has-dialog');
      if (ultimoGatilho && document.contains(ultimoGatilho)) ultimoGatilho.focus();
    });
    // Clique fora do conteúdo (no backdrop) fecha
    dialog.addEventListener('click', (ev) => { if (ev.target === dialog) dialog.close(); });
  });

  $$('[data-close-dialog]').forEach((btn) => {
    btn.addEventListener('click', () => { const d = btn.closest('dialog'); if (d) d.close(); });
  });

  const formDialog = $('#form-dialog');
  const formModal = $('.lead-form', formDialog);

  $$('[data-open-form]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const titulo = btn.dataset.titulo || 'Receber tabela e plantas';
      $('#m-titulo').textContent = titulo;
      $('[data-submit-label]', formModal).textContent = titulo;
      formModal.dataset.origem = btn.dataset.origem || 'modal';
      formModal.dataset.titulo = titulo;
      if (formModal.classList.contains('is-sent')) {
        formModal.classList.remove('is-sent');
        $('.form-status', formModal).innerHTML = '';
      }
      abrirDialogo(formDialog, btn);
      setTimeout(() => formModal.elements.nome.focus(), 50);
    });
  });

  // Os formulários fixos (hero e final) também levam o "interesse" no lead
  $$('.lead-form:not([data-titulo])').forEach((f) => { if (f !== formModal) f.dataset.titulo = 'Receber tabela e plantas'; });

  /* ---------- Lightbox (galeria e fotos de cada unidade) ---------- */
  const lightbox = $('#lightbox');
  const stage = $('.lb-stage', lightbox);
  const legenda = $('.lb-caption', lightbox);
  let lista = [];
  let atual = 0;

  function mostrarItem(i) {
    atual = (i + lista.length) % lista.length;
    const item = lista[atual];
    const img = new Image();
    img.src = item.src;
    img.alt = item.alt;
    img.decoding = 'async';
    stage.replaceChildren(img);
    legenda.textContent = `${item.alt}  (${atual + 1} de ${lista.length})`;
  }

  function abrirLightbox(itens, i, gatilho) {
    lista = itens;
    mostrarItem(i);
    abrirDialogo(lightbox, gatilho);
  }

  const galeria = $$('.gallery-item').map((el) => ({ src: el.dataset.full, alt: el.dataset.alt || '' }));
  $$('.gallery-item').forEach((el, i) => el.addEventListener('click', () => abrirLightbox(galeria, i, el)));

  // Cada card de unidade abre só as fotos daquela unidade (data-fotos + data-legendas)
  $$('.unit-media').forEach((el) => {
    const legendas = (el.dataset.legendas || '').split('|');
    const fotos = el.dataset.fotos.split(',').map((base, k) => ({
      src: `assets/${base}-1600.webp`,
      alt: `${el.dataset.unidade}: ${legendas[k] || 'foto ' + (k + 1)}`,
    }));
    el.addEventListener('click', () => abrirLightbox(fotos, 0, el));
  });

  $('.lb-prev', lightbox).addEventListener('click', () => mostrarItem(atual - 1));
  $('.lb-next', lightbox).addEventListener('click', () => mostrarItem(atual + 1));
  lightbox.addEventListener('keydown', (ev) => {
    if (ev.key === 'ArrowLeft') mostrarItem(atual - 1);
    if (ev.key === 'ArrowRight') mostrarItem(atual + 1);
  });

  let toqueX = null;
  stage.addEventListener('pointerdown', (ev) => { toqueX = ev.clientX; });
  stage.addEventListener('pointerup', (ev) => {
    if (toqueX === null) return;
    const dx = ev.clientX - toqueX;
    if (Math.abs(dx) > 50) mostrarItem(atual + (dx < 0 ? 1 : -1));
    toqueX = null;
  });

  /* ---------- Abas de plantas ---------- */
  const abas = $$('[role="tab"]');
  function selecionarAba(aba, foco) {
    abas.forEach((a) => {
      const ativa = a === aba;
      a.setAttribute('aria-selected', String(ativa));
      a.tabIndex = ativa ? 0 : -1;
      document.getElementById(a.getAttribute('aria-controls')).hidden = !ativa;
    });
    if (foco) aba.focus();
  }
  abas.forEach((aba, i) => {
    aba.addEventListener('click', () => selecionarAba(aba));
    aba.addEventListener('keydown', (ev) => {
      const mapa = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: abas.length - 1 };
      if (!(ev.key in mapa)) return;
      ev.preventDefault();
      selecionarAba(abas[(mapa[ev.key] + abas.length) % abas.length], true);
    });
  });

  /* ---------- Mapa (carrega só no clique) ---------- */
  const botaoMapa = $('[data-load-map]');
  if (botaoMapa) {
    botaoMapa.addEventListener('click', () => {
      const mapa = $('#mapa');
      if (!MAP_EMBED_URL) {
        if (!$('.map-msg', mapa)) {
          const msg = document.createElement('p');
          msg.className = 'map-msg';
          msg.innerHTML = '<span class="pf">[PREENCHER: MAP_EMBED_URL no script.js]</span>';
          mapa.appendChild(msg);
        }
        return;
      }
      const iframe = document.createElement('iframe');
      iframe.src = MAP_EMBED_URL;
      iframe.title = 'Mapa da localização do Yachthouse';
      iframe.loading = 'lazy';
      iframe.referrerPolicy = 'no-referrer-when-downgrade';
      iframe.allowFullscreen = true;
      mapa.appendChild(iframe);
      $('.map-overlay', mapa).remove();
    });
  }

  /* ---------- Revelação suave no scroll ---------- */
  const revelaveis = $$('.reveal');
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entradas) => {
      entradas.forEach((e) => {
        if (e.isIntersecting) { e.target.classList.add('is-visible'); io.unobserve(e.target); }
      });
    }, { rootMargin: '0px 0px -8% 0px' });
    revelaveis.forEach((el) => io.observe(el));
  } else {
    revelaveis.forEach((el) => el.classList.add('is-visible'));
  }
})();
