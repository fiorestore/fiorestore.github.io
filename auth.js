/* Fiore Store - login e permissões (carregado como PRIMEIRO script de cada página interna).
   - Sem login válido: manda para /login.html.
   - Junta o "token" de acesso em toda chamada ao servidor (Apps Script).
   - A proteção de verdade é no servidor: sem token válido ele não devolve nenhum dado. */
(function () {
  "use strict";
  var CHAVE = "fiore_token";
  var script = document.currentScript;
  var exigir = script ? (script.getAttribute("data-exigir") || "") : "";           // "dono" = só o dono
  var publicoSe = script ? (script.getAttribute("data-publico-se") || "") : "";    // parâmetro da URL que libera acesso do cliente (ex.: lt)
  var publico = script ? script.hasAttribute("data-publico") : false;

  function lerToken(t) {
    var p = String(t || "").split(".");
    if (p.length !== 3) return null;
    var exp = Number(p[1]);
    if (!exp || exp * 1000 < Date.now()) return null;
    return { papel: p[0], exp: exp };
  }

  var guardado = "";
  try { guardado = localStorage.getItem(CHAVE) || ""; } catch (e) {}
  var info = lerToken(guardado);

  var A = window.FIORE_AUTH = {
    token: info ? guardado : "",
    papel: info ? info.papel : "",
    sair: function () {
      try { localStorage.removeItem(CHAVE); } catch (e) {}
      A.irParaLogin();
    },
    irParaLogin: function () {
      var next = location.pathname + location.search;
      location.replace("/login.html?next=" + encodeURIComponent(next));
    }
  };

  var acessoCliente = !!publicoSe && !!new URLSearchParams(location.search).get(publicoSe);
  var liberado = publico || acessoCliente;

  // Quem não está logado vai para a tela de login
  if (!liberado && !A.token) { A.irParaLogin(); return; }
  // Funcionário não entra em páginas do dono
  if (!liberado && exigir === "dono" && A.papel !== "dono") { location.replace("/painel-funcionario.html"); return; }

  // Junta o token em toda chamada ao servidor e trata sessão vencida
  var fetchOriginal = window.fetch.bind(window);
  window.fetch = function (url, opts) {
    var u = typeof url === "string" ? url : (url && url.url) || "";
    if (u.indexOf("script.google.com/macros") < 0 || !A.token) return fetchOriginal(url, opts);
    opts = opts || {};
    var metodo = String(opts.method || "GET").toUpperCase();
    if (metodo === "POST") {
      try {
        var corpo = JSON.parse(opts.body);
        if (corpo && typeof corpo === "object" && !corpo.token) {
          corpo.token = A.token;
          opts = Object.assign({}, opts, { body: JSON.stringify(corpo) });
        }
      } catch (e) {}
    } else if (u.indexOf("token=") < 0) {
      u += (u.indexOf("?") < 0 ? "?" : "&") + "token=" + encodeURIComponent(A.token);
    }
    return fetchOriginal(u, opts).then(function (resp) {
      resp.clone().json().then(function (j) { if (j && j.semAcesso && !liberado) A.sair(); }).catch(function () {});
      return resp;
    });
  };
})();
