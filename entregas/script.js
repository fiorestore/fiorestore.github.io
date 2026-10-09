// Fiore Store — Entregas
// Vanilla JS, sem frameworks. Nenhum dado é salvo (sem localStorage, sem backend
// próprio) — tudo fica só na tela durante o atendimento. A única chamada de rede
// é para a API pública ViaCEP (consulta de endereço, sem autenticação).

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

  function buscarCep(digitosCep) {
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

        document.getElementById("rua").value = dados.logradouro || "";
        document.getElementById("bairro").value = dados.bairro || "";
        document.getElementById("cidade").value = dados.localidade || "";
        document.getElementById("estado").value = dados.uf || "";
        ["rua", "bairro", "cidade", "estado"].forEach(limparErroCampo);

        statusCepEl.textContent = "Endereço encontrado e preenchido automaticamente.";
        statusCepEl.className = "status-cep encontrado";
        anunciarStatus("Endereço encontrado e preenchido automaticamente.");

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
})();
