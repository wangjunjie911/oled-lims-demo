function msaNav(active) {
  var el = document.getElementById("msaNav");
  if (!el) return;
  el.innerHTML =
    '<details class="menu-mod" open><summary>MSA</summary>' +
    '<a class="menu-item' + (active === "grr" ? " active" : "") + '" href="index.html">GRR</a>' +
    '<a class="menu-item' + (active === "stab" ? " active" : "") + '" href="stab.html">稳定性</a>' +
    "</details>";
}

function toast(msg) {
  var el = document.getElementById("toast");
  if (!el) {
    el = document.createElement("div");
    el.id = "toast";
    el.className = "toast";
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.classList.add("show");
  clearTimeout(window.__t);
  window.__t = setTimeout(function () { el.classList.remove("show"); }, 2200);
}

function notExport() {
  toast("导出暂未开放");
  return false;
}

function applyRole() {
  var role = localStorage.getItem("grrRole") || "planner";
  var sel = document.getElementById("roleSel");
  if (sel) sel.value = role;
  document.body.setAttribute("data-role", role);
  document.querySelectorAll("[data-planner-only]").forEach(function (n) {
    n.style.display = role === "planner" ? "" : "none";
  });
  document.querySelectorAll("[data-appraiser-hide]").forEach(function (n) {
    if (role === "appraiser") n.textContent = "—";
  });
}

function setRole(v) {
  localStorage.setItem("grrRole", v);
  applyRole();
}

document.addEventListener("DOMContentLoaded", function () {
  msaNav(document.body.getAttribute("data-mod") || "grr");
  applyRole();
});
