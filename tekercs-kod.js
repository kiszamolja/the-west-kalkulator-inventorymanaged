/* TEKERCSEK: hány recept-tekercs van a táskádban (a panel t54 jelzése).

   A tekercs a raktártól KÜLÖN él: ha a stock-ba kerülne, a Raktár fül
   tételszáma és a továbbküldött hivatkozás is megtelne vele.

   Három állapot van, és a különbség számít:
     null - nem tudjuk (kézi raktár, régi könyvjelző): SEMLEGES ikon, a
            buborékban nincs "Táskádban" sor. Hamis nullát nem mutatunk.
     {}   - tudjuk, és egy tekercsed sincs: minden ikon piros.
     {..} - tudjuk, mennyi van: zöld, ahol van, piros, ahol nincs.

   Honnan tudjuk, hogy a beolvasás tartalmazza a tekercseket? A könyvjelző és
   a másik eszközre küldött hivatkozás kimondja ("tk=1"). Az import szkript
   a táska TELJES tartalmát küldi, abban mindig van olyan tárgy is, ami se
   recept, se alapanyag, se tekercs - ebből ismerjük fel, a szkript
   módosítása nélkül. Ha egyik sem igaz, a tekercsadat ismeretlen marad. */
let tekercsek = null;
const TEKERCS_IDK = new Set(Object.keys(TEKERCS_ADAT));
function tekercsBeolvas(str, kimondva){
  const ujAlak = str.indexOf(".") >= 0 || str.indexOf("-") >= 0;
  const out = {};
  let teljesTaska = false;
  (ujAlak ? str.split(".") : str.split(",")).forEach(pair => {
    const m = pair.match(ujAlak ? /^(\d+)-(\d+)$/ : /^(\d+):(\d+)$/);
    if(!m) return;
    const id = m[1].length > 4 || Number(m[1]) < 100000 ? m[1] + "000" : m[1];
    if(TEKERCS_IDK.has(id)) out[id] = parseInt(m[2]);
    else if(!recipeMap.has(id) && !baseIds.includes(id)) teljesTaska = true;
  });
  return (kimondva || teljesTaska) ? out : null;
}
/* Egy termék tekercsei (a két közös terméknek négy van) és a darabszám. */
function termekTekercsei(id){
  const t = RECEPT_TEKERCS[String(id)];
  return t === undefined ? [] : [].concat(t).map(String);
}
function tekercsDb(id){
  if(tekercsek === null) return null;
  return termekTekercsei(id).reduce((a, x) => a + (Number(tekercsek[x]) || 0), 0);
}
/* Melyiket másoljuk: a birtokoltat, ha van, különben az elsőt. */
function masolandoTekercs(id){
  const l = termekTekercsei(id);
  return l.find(x => tekercsek && tekercsek[x] > 0) || l[0];
}
const TEKERCS_SVG = '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 3v4a1 1 0 0 0 1 1h4"/><path d="M17 21H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7l5 5v11a2 2 0 0 1-2 2z"/></svg>';
function tekercsIkon(r){
  const tk = masolandoTekercs(r.i);
  if(!tk) return "";
  const db = tekercsDb(r.i);
  const all = db === null ? "ismeretlen" : db > 0 ? "van" : "nincs";
  const cim = (db === null ? "" : db > 0 ? "A recept a táskádban van - " : "Nincs a táskádban - ")
    + "kattints a másoláshoz";
  return `<span class="tk ${all}" data-tk="${tk}" role="button" tabindex="0" title="${cim}" aria-label="${cim}">${TEKERCS_SVG}</span>`;
}
/* MÁSOLÁS a felső Kód/Szöveg váltó szerint: Kód állásban a tekercs
   [item=...] kódja (ez a játék chatjébe illeszthető), Szöveg állásban a
   tekercs neve, ahogy a játék hívja. A kattintás NEM választja ki a
   receptet: a lista elkapó fázisában állítjuk meg. */
async function tekercsMasol(ikon){
  const tk = ikon.dataset.tk;
  const szoveg = masolMod === "szoveg" ? (TEKERCS_ADAT[tk] || [""])[0] : `[item=${tk}]`;
  const ok = await copyText(szoveg);
  const regi = ikon.querySelector(".masolt");
  if(regi) regi.remove();
  const v = document.createElement("span");
  v.className = "masolt";
  v.textContent = ok ? "Másolva" : "Nem sikerült";
  ikon.appendChild(v);
  setTimeout(() => v.remove(), 1200);
}
$("rlist").addEventListener("click", e => {
  const ikon = e.target.closest && e.target.closest("[data-tk]");
  if(!ikon) return;
  e.preventDefault();
  e.stopPropagation();
  tekercsMasol(ikon);
}, true);
$("rlist").addEventListener("keydown", e => {
  if(e.key !== "Enter" && e.key !== " ") return;
  const ikon = e.target.closest && e.target.closest("[data-tk]");
  if(!ikon) return;
  e.preventDefault();
  e.stopPropagation();
  tekercsMasol(ikon);
}, true);
