import { env } from "../../../shared/config/env.js";
import type { Game } from "../../../modules/games/domain/game.js";
import type { AdminPayment, AdminStats, AdminUser } from "./admin-queries.js";

type Page = "jogos" | "pagamentos" | "usuarios";

export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#039;");
}

function money(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function date(value: Date): string {
  return new Date(value).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" });
}

function groupUrl(game: Game): string | undefined {
  const raw = String(game.telegramGroupId);

  return raw.startsWith("-100") ? `https://t.me/c/${raw.slice(4)}/1` : undefined;
}

function layout(active: Page, title: string, body: string): string {
  const nav = (page: Page, label: string) =>
    `<a href="/admin/${page}" class="${active === page ? "on" : ""}">${label}</a>`;

  return `<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)} · Painel</title>
<style>
:root{--bg:#0e1420;--panel:#161e2e;--line:#243049;--text:#e8edf6;--mute:#8a97b0;--green:#22c55e;--blue:#3b82f6}
*{box-sizing:border-box}body{margin:0;font-family:Inter,system-ui,Arial,sans-serif;background:var(--bg);color:var(--text)}
header{display:flex;align-items:center;gap:24px;padding:14px 24px;border-bottom:1px solid var(--line);background:var(--panel);position:sticky;top:0;z-index:5}
header b{font-size:18px}nav{display:flex;gap:6px}nav a{color:var(--mute);text-decoration:none;padding:8px 14px;border-radius:8px;font-weight:600}
nav a.on,nav a:hover{background:var(--line);color:var(--text)}
main{max-width:1100px;margin:0 auto;padding:24px 16px}
h1{font-size:24px;margin:0 0 16px}h2{font-size:17px;margin:0 0 12px}
.stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;margin-bottom:20px}
.stat{background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:14px}.stat span{color:var(--mute);font-size:12px}.stat b{display:block;font-size:22px;margin-top:4px}
.card{background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:18px;margin-bottom:16px}
label{display:block;font-size:13px;color:var(--mute);margin-bottom:5px;font-weight:600}
input{width:100%;padding:11px;background:var(--bg);color:var(--text);border:1px solid var(--line);border-radius:8px;font-size:15px}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px}
.btn{display:inline-block;border:0;border-radius:8px;padding:10px 14px;font-weight:700;cursor:pointer;text-decoration:none;font-size:14px;background:var(--green);color:#04210f}
.btn.alt{background:var(--line);color:var(--text)}.btn.blue{background:var(--blue);color:#fff}
.games{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:16px}
.gc{background:var(--panel);border:1px solid var(--line);border-radius:16px;padding:16px;display:flex;flex-direction:column;gap:14px;transition:transform .15s,border-color .15s}
.gc:hover{transform:translateY(-2px);border-color:#34456a}.gc-off{opacity:.65}
.gc-top{display:flex;justify-content:space-between;align-items:center}
.gc-price{font-weight:800;font-size:15px;background:var(--bg);padding:4px 10px;border-radius:99px}
.gc-match{display:flex;align-items:center;justify-content:center;gap:16px;padding:14px 8px;background:var(--bg);border-radius:12px}
.gc-team{display:flex;flex-direction:column;align-items:center;gap:8px;flex:1;min-width:0}
.gc-team span{font-size:13px;font-weight:700;text-align:center;overflow-wrap:anywhere}
.gc-team .logo{width:68px;height:68px;font-size:20px}
.gc-vs{color:var(--mute);font-weight:800;font-size:12px}
.gc-info{list-style:none;margin:0;padding:0;display:grid;gap:6px;font-size:13px;color:var(--mute)}
.gc-info i{font-style:normal;margin-right:8px}
.gc-actions{display:grid;gap:8px}.gc-actions form{display:contents}.gc-actions .btn{width:100%;text-align:center}
.btn.ghost-danger{background:transparent;color:#f87171;border:1px solid #7f1d1d}.btn.ghost-danger:hover{background:#7f1d1d;color:#fff}
.btn.sm{padding:6px 10px;font-size:12px}
.gc-obs{border-top:1px solid var(--line);padding-top:10px}.gc-obs summary{margin-top:0}
.gc-field{margin-top:10px}.gc-field label{margin-bottom:4px}.gc-field div{display:flex;gap:6px;align-items:center;flex-wrap:wrap}
.gc-field code{flex:1;min-width:0}
.match{display:flex;align-items:flex-start;justify-content:center;gap:14px;margin:6px 0 14px}
.logo{width:56px;height:56px;border-radius:50%;object-fit:contain;background:#fff;display:flex;align-items:center;justify-content:center;color:#111;font-weight:800;margin:0 auto}
.vs{color:var(--mute);font-weight:800;align-self:center}.team{text-align:center;font-size:12px;color:var(--mute);max-width:110px;margin-top:4px}
.meta{color:var(--mute);font-size:13px;margin-bottom:12px;text-align:center}
.actions{display:flex;flex-wrap:wrap;gap:8px;justify-content:center}
code{background:var(--bg);padding:3px 6px;border-radius:6px;font-size:12px;word-break:break-all}
.obs{margin-top:12px;font-size:12px;color:var(--mute)}
table{width:100%;border-collapse:collapse}th,td{padding:10px;border-bottom:1px solid var(--line);text-align:left;font-size:14px}th{color:var(--mute);font-size:12px}
.table{overflow-x:auto}
.tag{padding:3px 8px;border-radius:99px;font-size:12px;font-weight:700}.ok{background:#14532d;color:#86efac}.wait{background:#78350f;color:#fcd34d}.off{background:var(--line);color:var(--mute)}
details summary{cursor:pointer;color:var(--blue);font-weight:600;font-size:13px;margin-top:10px}
@media(max-width:700px){header{flex-direction:column;align-items:flex-start;gap:8px}}
</style></head>
<body>
<header><b>Painel Transmissões</b><nav>${nav("jogos", "Jogos")}${nav("pagamentos", "Pagamentos")}${nav("usuarios", "Usuários")}</nav></header>
<main>${body}</main>
<script>
document.addEventListener("click",function(e){var r=e.target.closest("[data-reveal]");if(r){var c=r.parentElement.querySelector(".secret");var show=c.textContent.indexOf("•")===0;c.textContent=show?c.dataset.secret:"••••••••••••";r.textContent=show?"Ocultar":"Mostrar";return}var b=e.target.closest("[data-copy]");if(!b)return;
navigator.clipboard.writeText(b.dataset.copy);var t=b.textContent;b.textContent="Copiado!";setTimeout(function(){b.textContent=t},1200)});
</script>
</body>`;
}

function statsCards(stats: AdminStats): string {
  const items: [string, string][] = [
    ["Receita confirmada", money(stats.confirmedRevenueCents)],
    ["Pagamentos confirmados", String(stats.confirmedPayments)],
    ["Pendentes", String(stats.pendingPayments)],
    ["Assinantes VIP ativos", String(stats.activeSubscriptions)],
    ["Jogos ativos", String(stats.activeGames)],
    ["Compradores", String(stats.buyers)]
  ];

  return `<div class="stats">${items.map(([l, v]) => `<div class="stat"><span>${l}</span><b>${v}</b></div>`).join("")}</div>`;
}

function logo(url: string | undefined, name: string): string {
  return url
    ? `<img class="logo" src="${escapeHtml(url)}" alt="${escapeHtml(name)}" referrerpolicy="no-referrer">`
    : `<div class="logo">${escapeHtml(name.trim().slice(0, 2).toUpperCase() || "?")}</div>`;
}

function splitTeams(title: string): [string, string] {
  const parts = title.split(/\s+(?:x|vs\.?)\s+/i);

  const [home, away] = parts;

  return parts.length === 2 && home !== undefined && away !== undefined ? [home, away] : [title, ""];
}

function gameCard(game: Game): string {
  const [home, away] = splitTeams(game.title);
  const url = groupUrl(game);
  const server = game.streamServerUrl ? escapeHtml(game.streamServerUrl) : "";
  const key = escapeHtml(game.streamKey ?? "");
  const groupGone = !!game.groupDeletedAt;
  const status = groupGone
    ? { cls: "off", label: "Encerrado" }
    : game.isActive
      ? { cls: "ok", label: "Ativo" }
      : { cls: "off", label: "Inativo" };
  const startsAt = game.startsAt
    ? new Date(game.startsAt).toLocaleString("pt-BR", {
      timeZone: "America/Sao_Paulo",
      weekday: "short",
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit"
    })
    : "Data a definir";
  const groupInfo = !game.autoCreatedGroup
    ? "Grupo próprio"
    : groupGone
      ? `Grupo excluído em ${date(game.groupDeletedAt!)}`
      : game.deleteAt
        ? `Grupo exclui em ${date(game.deleteAt)}`
        : "Grupo criado";
  const confirmText = `Excluir este jogo${game.autoCreatedGroup && !groupGone ? " e o grupo do Telegram (irreversível)" : ""}?`;

  return `<article class="gc${groupGone || !game.isActive ? " gc-off" : ""}">
<div class="gc-top"><span class="tag ${status.cls}">${status.label}</span><span class="gc-price">${money(game.amountCents)}</span></div>
<div class="gc-match">
<div class="gc-team">${logo(game.homeLogoUrl, home)}<span>${escapeHtml(home)}</span></div>
${away ? `<span class="gc-vs">VS</span><div class="gc-team">${logo(game.awayLogoUrl, away)}<span>${escapeHtml(away)}</span></div>` : ""}
</div>
<ul class="gc-info">
<li><i>🗓</i>${startsAt}</li>
<li><i>👥</i>${groupInfo}</li>
</ul>
<div class="gc-actions">
${url && !groupGone ? `<a class="btn blue" href="${url}" target="_blank" rel="noreferrer">Ir para o grupo</a>` : ""}
${groupGone ? "" : `<form method="POST" action="/admin/jogos/${game.id}/convite"><button class="btn alt">🔗 Link p/ amigos</button></form>`}
<form method="POST" action="/admin/jogos/${game.id}/excluir" onsubmit="return confirm('${confirmText}')"><button class="btn ghost-danger" title="Excluir jogo">🗑 Excluir</button></form>
</div>
${server && !groupGone ? `<details class="gc-obs"><summary>Credenciais do OBS</summary>
<div class="gc-field"><label>Servidor</label><div><code>${server}</code><button class="btn alt sm" type="button" data-copy="${server}">Copiar</button></div></div>
<div class="gc-field"><label>Chave de transmissão</label><div><code class="secret" data-secret="${key}">••••••••••••</code>
<button class="btn alt sm" type="button" data-reveal>Mostrar</button><button class="btn alt sm" type="button" data-copy="${key}">Copiar</button></div></div>
</details>` : ""}
</article>`;
}

export function renderGames(games: Game[], stats: AdminStats): string {
  return layout("jogos", "Jogos", `
<h1>Jogos</h1>${statsCards(stats)}
<div class="card"><h2>Novo jogo</h2>
<form method="POST" action="/admin/jogos"><div class="grid">
<div><label>Jogo (ex.: Flamengo x Bahia)</label><input name="title" required></div>
<div><label>Valor</label><input name="amount" value="${(env.PAYMENT_AMOUNT_CENTS / 100).toFixed(2).replace(".", ",")}" required></div>
<div><label>Data e hora</label><input name="startsAt" type="datetime-local"></div>
<div><label>Excluir grupo em (vazio = início + ${env.GAME_GROUP_TTL_HOURS}h)</label><input name="deleteAt" type="datetime-local"></div>
<div><label>Logo time da casa (URL)</label><input name="homeLogoUrl" type="url" placeholder="https://..."></div>
<div><label>Logo time visitante (URL)</label><input name="awayLogoUrl" type="url" placeholder="https://..."></div>
</div><p><button class="btn">Cadastrar jogo</button></p></form></div>
<div class="games">${games.length ? games.map(gameCard).join("") : "<p>Nenhum jogo cadastrado ainda.</p>"}</div>`);
}

export function renderInvite(game: Game, link: string): string {
  return layout("jogos", "Link de convite", `
<h1>Link para amigos</h1>
<div class="card"><h2>${escapeHtml(game.title)}</h2>
<p>Envie este link. Ele expira em 7 dias.</p>
<p><code>${escapeHtml(link)}</code></p>
<p><button class="btn" data-copy="${escapeHtml(link)}">Copiar link</button>
<a class="btn alt" href="/admin/jogos">Voltar</a></p></div>`);
}

export function renderPayments(payments: AdminPayment[], stats: AdminStats): string {
  const rows = payments.map((p) => `<tr>
<td>${date(p.createdAt)}</td><td>${p.telegramUserId}</td>
<td>${p.productType === "vip" ? "VIP mensal" : escapeHtml(p.gameTitle ?? "Jogo")}</td>
<td>${money(p.amountCents)}</td>
<td><span class="tag ${p.status === "confirmed" ? "ok" : "wait"}">${p.status === "confirmed" ? "Confirmado" : "Pendente"}</span></td>
<td>${p.confirmedAt ? date(p.confirmedAt) : "-"}</td></tr>`).join("");

  return layout("pagamentos", "Pagamentos", `<h1>Pagamentos</h1>${statsCards(stats)}
<div class="card table"><table><thead><tr><th>Criado</th><th>Usuário</th><th>Produto</th><th>Valor</th><th>Status</th><th>Confirmado</th></tr></thead>
<tbody>${rows || "<tr><td colspan=6>Nenhum pagamento.</td></tr>"}</tbody></table></div>`);
}

export function renderUsers(users: (AdminUser & { name?: string })[], stats: AdminStats): string {
  const rows = users.map((u) => `<tr>
<td>${u.name ? escapeHtml(u.name) : "-"}<br><small style="color:var(--mute)">${u.telegramUserId}</small></td>
<td>${u.paidCount}</td><td>${money(u.totalCents)}</td>
<td>${u.subscriptionExpiresAt ? `<span class="tag ${u.subscriptionActive ? "ok" : "off"}">${u.subscriptionActive ? "VIP ativo" : "VIP expirado"}</span><br><small>${date(u.subscriptionExpiresAt)}</small>` : "-"}</td>
<td>${date(u.lastActivityAt)}</td></tr>`).join("");

  return layout("usuarios", "Usuários", `<h1>Usuários</h1>${statsCards(stats)}
<div class="card table"><table><thead><tr><th>Usuário</th><th>Compras</th><th>Total gasto</th><th>Assinatura</th><th>Última atividade</th></tr></thead>
<tbody>${rows || "<tr><td colspan=5>Nenhum usuário ainda.</td></tr>"}</tbody></table></div>`);
}
