// Fiore Store — Entregas
// Vanilla JS, sem frameworks. Fluxo principal: as entregas marcadas no contrato
// aparecem prontas para enviar ao motoboy pelo WhatsApp. O formulário manual não
// salva nada. Único dado guardado no aparelho: o WhatsApp do motoboy (localStorage).
// Rede: ViaCEP (bairro/endereço) e o backend da loja (Apps Script) para listar as
// entregas marcadas no contrato e marcá-las como enviadas.

(function () {
  "use strict";

  var form = document.getElementById("formEntrega");
  var secaoFormulario = document.getElementById("secaoFormulario");
  var secaoConfirmacao = document.getElementById("secaoConfirmacao");
  var secaoResultado = document.getElementById("secaoResultado");
  var statusRegion = document.getElementById("statusRegion");
  var erroRegion = document.getElementById("erroRegion");
  var statusCepEl = document.getElementById("status-cep");

  var CAMPOS_OBRIGATORIOS = ["nome", "telefone", "cep", "rua", "numero", "bairro", "cidade", "estado"];
  var CAMPOS_OPCIONAIS = ["complemento", "referencia", "pedido", "observacoes"];
  var TODOS_CAMPOS = CAMPOS_OBRIGATORIOS.concat(CAMPOS_OPCIONAIS);

  if (new URLSearchParams(location.search).get("painel") === "funcionario") {
    document.getElementById("backlink").href = "https://fiorestore.github.io/painel-funcionario.html";
  }

  var WEBAPP_URL = "https://script.google.com/macros/s/AKfycbw22fQo18s_OSnF8zBUGagKBoAk-5b0bymc2XCPcusiaE-IRb2nFfyZsB31ywvqeV5RBA/exec";
  var SENHA = "TROQUE_PARA_UMA_SENHA_SUA";

  function api(params) {
    var qs = new URLSearchParams(Object.assign({ senha: SENHA }, params));
    return fetch(WEBAPP_URL + "?" + qs.toString()).then(function (r) { return r.json(); });
  }

  var enviando = false;
  var buscandoCep = false;
  var dadosAtuais = null;

  // ---------- util ----------

  function anunciarStatus(msg) { statusRegion.textContent = msg; }
  function anunciarErro(msg) { erroRegion.textContent = msg; }
  function limparAnuncios() { statusRegion.textContent = ""; erroRegion.textContent = ""; }

  function contemHtmlOuScript(valor) {
    return /[<>]/.test(valor);
  }

  function mostrarErroCampo(id, msg) {
    var erroEl = document.getElementById("erro-" + id);
    var campoEl = document.getElementById(id);
    if (erroEl) erroEl.textContent = msg || "";
    if (campoEl) {
      if (msg) campoEl.setAttribute("aria-invalid", "true");
      else campoEl.removeAttribute("aria-invalid");
    }
  }

  function limparErroCampo(id) { mostrarErroCampo(id, ""); }

  // ---------- máscaras ----------

  function maskCep(valor) {
    var digitos = valor.replace(/\D/g, "").slice(0, 8);
    if (digitos.length > 5) return digitos.slice(0, 5) + "-" + digitos.slice(5);
    return digitos;
  }

  function maskTelefone(valor) {
    var digitos = valor.replace(/\D/g, "").slice(0, 11);
    var ddd = digitos.slice(0, 2);
    var resto = digitos.slice(2);
    var saida = "";
    if (ddd) saida += "(" + ddd;
    if (ddd.length === 2) saida += ") ";
    if (resto.length > 4) {
      saida += resto.slice(0, resto.length - 4) + "-" + resto.slice(-4);
    } else {
      saida += resto;
    }
    return saida;
  }

  // ---------- validação ----------

  function validarCampo(id, valorBruto) {
    var valor = valorBruto == null ? "" : valorBruto;

    if (TODOS_CAMPOS.indexOf(id) !== -1 && id !== "estado" && contemHtmlOuScript(valor)) {
      return "Não use os símbolos < ou > neste campo.";
    }

    switch (id) {
      case "nome":
        return valor.trim() ? "" : "Informe o nome completo.";
      case "telefone": {
        var digitos = valor.replace(/\D/g, "");
        if (!digitos) return "Informe o telefone/WhatsApp.";
        if (digitos.length < 10 || digitos.length > 11) return "Telefone inválido. Use o DDD + número.";
        return "";
      }
      case "cep": {
        var d = valor.replace(/\D/g, "");
        if (!d) return "Informe o CEP.";
        if (d.length !== 8) return "O CEP deve ter 8 números.";
        return "";
      }
      case "rua":
        return valor.trim() ? "" : "Informe a rua.";
      case "numero":
        return valor.trim() ? "" : "Informe o número do imóvel.";
      case "bairro":
        return valor.trim() ? "" : "Informe o bairro.";
      case "cidade":
        return valor.trim() ? "" : "Informe a cidade.";
      case "estado":
        return valor ? "" : "Selecione o estado.";
      default:
        return "";
    }
  }

  // ---------- ViaCEP ----------

  function buscarCep(digitosCep, soVazios) {
    if (buscandoCep) return;
    buscandoCep = true;

    statusCepEl.textContent = "Buscando endereço…";
    statusCepEl.className = "status-cep carregando";
    anunciarStatus("Buscando endereço pelo CEP…");

    fetch("https://viacep.com.br/ws/" + digitosCep + "/json/")
      .then(function (r) { return r.json(); })
      .then(function (dados) {
        if (dados.erro) {
          statusCepEl.textContent = "CEP não encontrado. Confira o número ou preencha o endereço manualmente.";
          statusCepEl.className = "status-cep nao-encontrado";
          anunciarStatus("CEP não encontrado. Preencha o endereço manualmente.");
          return;
        }

        // soVazios: ao preencher a partir de uma entrega, não sobrescreve o que já veio do contrato
        function preencher(id, valor) {
          var el = document.getElementById(id);
          if (!soVazios || !el.value.trim()) el.value = valor || "";
        }
        preencher("rua", dados.logradouro);
        preencher("bairro", dados.bairro);
        preencher("cidade", dados.localidade);
        preencher("estado", dados.uf);
        ["rua", "bairro", "cidade", "estado"].forEach(limparErroCampo);

        statusCepEl.textContent = "Endereço encontrado e preenchido automaticamente.";
        statusCepEl.className = "status-cep encontrado";
        anunciarStatus("Endereço encontrado e preenchido automaticamente.");

        if (soVazios) return;
        if (!dados.logradouro) {
          document.getElementById("rua").focus();
        } else {
          document.getElementById("numero").focus();
        }
      })
      .catch(function () {
        statusCepEl.textContent = "Não foi possível consultar o CEP agora. Preencha o endereço manualmente.";
        statusCepEl.className = "status-cep nao-encontrado";
        anunciarErro("Erro ao consultar o CEP. Preencha o endereço manualmente.");
      })
      .finally(function () {
        buscandoCep = false;
      });
  }

  // ---------- eventos dos campos ----------

  document.getElementById("cep").addEventListener("input", function (e) {
    e.target.value = maskCep(e.target.value);
    var digitos = e.target.value.replace(/\D/g, "");
    if (digitos.length === 8) {
      buscarCep(digitos);
    } else {
      statusCepEl.textContent = "";
      statusCepEl.className = "status-cep";
    }
  });

  document.getElementById("telefone").addEventListener("input", function (e) {
    e.target.value = maskTelefone(e.target.value);
  });

  TODOS_CAMPOS.forEach(function (id) {
    var el = document.getElementById(id);
    if (!el) return;
    el.addEventListener("blur", function () {
      mostrarErroCampo(id, validarCampo(id, el.value));
    });
  });

  // ---------- coleta e formatação ----------

  function coletarDados() {
    return {
      nome: document.getElementById("nome").value.trim(),
      telefone: document.getElementById("telefone").value.trim(),
      cep: document.getElementById("cep").value.trim(),
      rua: document.getElementById("rua").value.trim(),
      numero: document.getElementById("numero").value.trim(),
      complemento: document.getElementById("complemento").value.trim(),
      bairro: document.getElementById("bairro").value.trim(),
      cidade: document.getElementById("cidade").value.trim(),
      estado: document.getElementById("estado").value,
      referencia: document.getElementById("referencia").value.trim(),
      pedido: document.getElementById("pedido").value.trim(),
      observacoes: document.getElementById("observacoes").value.trim()
    };
  }

  function enderecoCompleto(d) {
    var partes = [d.rua + ", " + d.numero];
    if (d.complemento) partes.push(d.complemento);
    partes.push(d.bairro);
    partes.push(d.cidade + " - " + d.estado);
    partes.push("CEP " + d.cep);
    return partes.join(", ");
  }

  function montarMensagem(d) {
    return [
      "NOVA ENTREGA - FIORE STORE",
      "",
      "Cliente: " + d.nome,
      "Telefone: " + d.telefone,
      "Pedido: " + (d.pedido || "—"),
      "Endereço: " + d.rua + ", " + d.numero,
      "Complemento: " + (d.complemento || "—"),
      "Bairro: " + d.bairro,
      "Cidade/UF: " + d.cidade + " - " + d.estado,
      "CEP: " + d.cep,
      "Referência: " + (d.referencia || "—"),
      "Observações: " + (d.observacoes || "—")
    ].join("\n");
  }

  // ---------- seção 1 → 2 (revisar) ----------

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    if (enviando) return;
    enviando = true;

    var btn = document.getElementById("btnRevisar");
    btn.disabled = true;
    btn.textContent = "Verificando...";
    limparAnuncios();

    var valido = true;
    var primeiroInvalido = null;

    TODOS_CAMPOS.forEach(function (id) {
      var el = document.getElementById(id);
      var msg = validarCampo(id, el.value);
      mostrarErroCampo(id, msg);
      if (msg && !primeiroInvalido) primeiroInvalido = el;
      if (msg) valido = false;
    });

    // Pequeno atraso proposital: evita a sensação de clique duplo e dá tempo
    // de o estado "Verificando..." ser percebido antes de trocar de tela.
    setTimeout(function () {
      btn.disabled = false;
      btn.textContent = "Revisar dados";
      enviando = false;

      if (!valido) {
        anunciarErro("Existem campos obrigatórios não preenchidos corretamente.");
        if (primeiroInvalido) primeiroInvalido.focus();
        return;
      }

      mostrarConfirmacao();
    }, 250);
  });

  function mostrarConfirmacao() {
    var d = coletarDados();
    dadosAtuais = d;

    var linhas = [
      ["Nome", d.nome],
      ["Telefone", d.telefone],
      ["Endereço", d.rua + ", " + d.numero],
      ["Complemento", d.complemento || "—"],
      ["Bairro", d.bairro],
      ["Cidade/UF", d.cidade + " - " + d.estado],
      ["CEP", d.cep],
      ["Referência", d.referencia || "—"],
      ["Pedido", d.pedido || "—"],
      ["Observações", d.observacoes || "—"]
    ];

    var resumo = document.getElementById("resumoConfirmacao");
    resumo.innerHTML = "";
    linhas.forEach(function (par) {
      var linha = document.createElement("div");
      linha.className = "linha-resumo";
      var dt = document.createElement("dt");
      dt.textContent = par[0];
      var dd = document.createElement("dd");
      dd.textContent = par[1]; // textContent: nunca interpreta HTML/scripts
      linha.appendChild(dt);
      linha.appendChild(dd);
      resumo.appendChild(linha);
    });

    document.getElementById("consentimento").checked = false;
    limparErroCampo("consentimento");

    secaoFormulario.hidden = true;
    secaoConfirmacao.hidden = false;
    secaoResultado.hidden = true;
    secaoConfirmacao.scrollIntoView({ behavior: "smooth", block: "start" });
    anunciarStatus("Revise os dados antes de confirmar a entrega.");
  }

  // ---------- seção 2: corrigir / confirmar ----------

  document.getElementById("btnCorrigir").addEventListener("click", function () {
    secaoConfirmacao.hidden = true;
    secaoFormulario.hidden = false;
    secaoFormulario.scrollIntoView({ behavior: "smooth", block: "start" });
  });

  document.getElementById("btnConfirmar").addEventListener("click", function () {
    var chk = document.getElementById("consentimento");
    if (!chk.checked) {
      mostrarErroCampo("consentimento", "É necessário autorizar o uso dos dados para confirmar a entrega.");
      anunciarErro("É necessário marcar a autorização antes de confirmar.");
      chk.focus();
      return;
    }
    limparErroCampo("consentimento");
    gerarResultado(dadosAtuais);
  });

  // ---------- seção 3: resultado ----------

  function gerarResultado(d) {
    var mensagem = montarMensagem(d);
    document.getElementById("cartaoEntrega").textContent = mensagem;

    var endereco = enderecoCompleto(d);
    document.getElementById("linkMaps").href = "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(endereco);
    document.getElementById("linkWaze").href = "https://waze.com/ul?q=" + encodeURIComponent(endereco) + "&navigate=yes";
    document.getElementById("linkWhats").href = "https://wa.me/?text=" + encodeURIComponent(mensagem);

    secaoConfirmacao.hidden = true;
    secaoResultado.hidden = false;
    secaoResultado.scrollIntoView({ behavior: "smooth", block: "start" });
    anunciarStatus("Entrega confirmada. Use os botões abaixo para despachar.");
  }

  document.getElementById("btnCopiar").addEventListener("click", function () {
    var texto = document.getElementById("cartaoEntrega").textContent;
    var btn = this;
    navigator.clipboard.writeText(texto).then(function () {
      var original = btn.textContent;
      btn.textContent = "✅ Copiado!";
      anunciarStatus("Dados da entrega copiados para a área de transferência.");
      setTimeout(function () { btn.textContent = original; }, 1800);
    }).catch(function () {
      anunciarErro("Não foi possível copiar automaticamente. Selecione o texto e copie manualmente.");
    });
  });

  document.getElementById("btnNova").addEventListener("click", function () {
    form.reset();
    TODOS_CAMPOS.forEach(limparErroCampo);
    limparErroCampo("consentimento");
    statusCepEl.textContent = "";
    statusCepEl.className = "status-cep";
    dadosAtuais = null;

    secaoResultado.hidden = true;
    secaoConfirmacao.hidden = true;
    secaoFormulario.hidden = false;
    limparAnuncios();
    document.getElementById("nome").focus();
  });

  // ---------- entregas marcadas no contrato: mensagem pronta pro motoboy ----------

  var CHAVE_MOTOBOY = "fiore_motoboy_whats";
  var motoboyEl = document.getElementById("motoboy");
  var cartoes = [];
  var bairroPorCep = {};

  try { motoboyEl.value = localStorage.getItem(CHAVE_MOTOBOY) || ""; } catch (err) { /* sem armazenamento: só não lembra o número */ }

  function cepDigitos(v) {
    var d = String(v || "").replace(/\D/g, "");
    return d.length === 7 ? "0" + d : d;
  }

  function mensagemEntrega(e) {
    var linhas = [
      "NOVA ENTREGA - FIORE STORE",
      "",
      "Cliente: " + (e.nome || ""),
      "Telefone: " + (e.telefone || ""),
      "Pedido: " + (e.produto || "—"),
      "Endereço: " + (e.endereco || "")
    ];
    if (e.complemento) linhas.push("Complemento: " + e.complemento);
    var bairro = bairroPorCep[cepDigitos(e.cep)];
    if (bairro) linhas.push("Bairro: " + bairro);
    linhas.push("Cidade: " + (e.cidade || ""));
    var cep = cepDigitos(e.cep);
    if (cep) linhas.push("CEP: " + maskCep(cep));
    return linhas.join("\n");
  }

  function linkWhatsMotoboy(texto) {
    var num = motoboyEl.value.replace(/\D/g, "");
    if (num && num.length <= 11) num = "55" + num;
    return "https://wa.me/" + num + "?text=" + encodeURIComponent(texto);
  }

  function atualizarCartoes() {
    cartoes.forEach(function (c) {
      var texto = mensagemEntrega(c.e);
      c.pre.textContent = texto;
      c.whats.href = linkWhatsMotoboy(texto);
      c.texto = texto;
    });
  }

  motoboyEl.addEventListener("input", function () {
    motoboyEl.value = maskTelefone(motoboyEl.value);
    try { localStorage.setItem(CHAVE_MOTOBOY, motoboyEl.value); } catch (err) { /* ignora */ }
    atualizarCartoes();
  });

  function buscarBairro(cep) {
    if (cep.length !== 8 || Object.prototype.hasOwnProperty.call(bairroPorCep, cep)) return;
    bairroPorCep[cep] = "";
    fetch("https://viacep.com.br/ws/" + cep + "/json/")
      .then(function (r) { return r.json(); })
      .then(function (d) { if (!d.erro && d.bairro) { bairroPorCep[cep] = d.bairro; atualizarCartoes(); } })
      .catch(function () { /* sem bairro: a mensagem segue sem essa linha */ });
  }

  function marcarEnviada(id) {
    return api({ action: "entrega_status", id: id, status: "despachada" })
      .then(carregarPendentes)
      .catch(function () { anunciarErro("Não foi possível atualizar agora. Tente de novo."); });
  }

  function renderPendentes(lista) {
    var alvo = document.getElementById("listaPendentes");
    alvo.innerHTML = "";
    cartoes = [];
    document.getElementById("semPendentes").hidden = lista.length > 0;

    lista.forEach(function (e) {
      var card = document.createElement("div");
      card.className = "pendente";

      var nome = document.createElement("div");
      nome.className = "pendente-nome";
      nome.textContent = e.nome || "(sem nome)";

      var pre = document.createElement("pre");
      pre.className = "pendente-msg";

      var acoes = document.createElement("div");
      acoes.className = "pendente-acoes";

      var whats = document.createElement("a");
      whats.className = "btn btn-whats";
      whats.target = "_blank";
      whats.rel = "noopener";
      whats.textContent = "📲 Enviar no WhatsApp";

      var btnCopiar = document.createElement("button");
      btnCopiar.type = "button";
      btnCopiar.className = "btn btn-secundario";
      btnCopiar.textContent = "📋 Copiar";

      var btnEnviei = document.createElement("button");
      btnEnviei.type = "button";
      btnEnviei.className = "btn btn-ghost";
      btnEnviei.textContent = "✓ Já enviei";

      var cartao = { e: e, pre: pre, whats: whats, texto: "" };
      whats.addEventListener("click", function () { btnEnviei.className = "btn btn-principal"; });
      btnCopiar.addEventListener("click", function () {
        navigator.clipboard.writeText(cartao.texto).then(function () {
          btnCopiar.textContent = "✅ Copiado!";
          setTimeout(function () { btnCopiar.textContent = "📋 Copiar"; }, 1800);
        }).catch(function () { anunciarErro("Não foi possível copiar. Use o botão do WhatsApp."); });
      });
      btnEnviei.addEventListener("click", function () {
        if (!window.confirm("Tirar a entrega de " + (e.nome || "este cliente") + " da lista?")) return;
        marcarEnviada(e.id);
      });

      acoes.appendChild(whats);
      acoes.appendChild(btnCopiar);
      acoes.appendChild(btnEnviei);
      card.appendChild(nome);
      card.appendChild(pre);
      card.appendChild(acoes);
      alvo.appendChild(card);

      cartoes.push(cartao);
      buscarBairro(cepDigitos(e.cep));
    });
    atualizarCartoes();
  }

  function carregarPendentes() {
    var btn = document.getElementById("btnAtualizar");
    btn.disabled = true;
    return api({ action: "entregas_listar" }).then(function (res) {
      if (!res.ok) throw new Error("falha");
      var pendentes = (res.entregas || []).filter(function (e) { return e.status === "pendente"; })
        .sort(function (a, b) { return (Number(b.criadoEm) || 0) - (Number(a.criadoEm) || 0); });
      renderPendentes(pendentes);
    }).catch(function () {
      anunciarErro("Não foi possível carregar as entregas agora. Toque em Atualizar.");
    }).then(function () { btn.disabled = false; });
  }

  document.getElementById("btnAtualizar").addEventListener("click", function () { limparAnuncios(); carregarPendentes(); });
  document.addEventListener("visibilitychange", function () { if (!document.hidden) carregarPendentes(); });

  document.getElementById("btnManual").addEventListener("click", function () {
    secaoFormulario.hidden = !secaoFormulario.hidden;
    if (!secaoFormulario.hidden) {
      secaoFormulario.scrollIntoView({ behavior: "smooth", block: "start" });
      document.getElementById("nome").focus();
    }
  });

  carregarPendentes();
})();
