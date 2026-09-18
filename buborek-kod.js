/* RECEPT-BUBORÉK (a panel t55-t56 buborékja, a weboldal adataival).

   A receptsorra húzott egérre nyílik, ugyanabban a dobozban és ugyanazzal az
   elhelyezéssel, mint a munkalap ikonjának hatásbuboréka. A KÉT BUBORÉK
   UGYANAZT AZ ELEMET HASZNÁLJA, ezért az osztályt minden megjelenítéskor ki
   kell mondani (a hbubNyit is kimondja).

   Érintőképernyőn nem nyílik: ott a koppintás a receptet választja, és a
   munkalap ugyanezt megmutatja. Ezért figyeljük a pointerType-ot.

   Minden sor mért vagy a felhasználótól kapott adatból jön:
     - a tekercs neve és az árak a TEKERCS_ADAT-ból (a játékban mérve),
     - a megtanultság és a karakter a beolvasásból,
     - a "Neked" szint a beírt vagy beolvasott szintből.
   Amit nem tudunk, az nem jelenik meg - hamis sort nem írunk ki. */
function receptTekercs(r){
  const t = RECEPT_TEKERCS[String(r.i)];
  return Array.isArray(t) ? t[0] : t;
}
function receptBuborek(r){
  if(!r) return "";
  const ta = TEKERCS_ADAT[String(receptTekercs(r))];
  const ps = profIds(r.p), min = minLvl(r);
  const adott = x => levels[x] !== undefined && levels[x] !== "";
  /* Melyik mesterség szintjét mutassuk "Neked"-ként: a beolvasott karakterét,
     ha a recept az övé, különben az elsőt, amihez szint van beírva. */
  const sajatP = (char && char.prof && ps.includes(char.prof)) ? char.prof : ps.find(adott);
  const sajatSzint = sajatP !== undefined && adott(sajatP) ? Number(levels[sajatP]) : null;
  const keves = sajatSzint !== null && sajatSzint < min;

  let h = `<div class="rb-nev">${mesc(r.n)}</div>`;
  /* A tekercsnév 23 esetben maga is "Recept"-tel kezdődik ("Recept: Torta
     sütés"), ott a címke megduplázná: "Recept: Recept: ...". MÉRVE a
     valódi böngészőben, a Halászlén. */
  if(ta) h += `<div class="rb-recept">${/^Recept/.test(ta[0]) ? "" : "Recept: "}<b>${mesc(ta[0])}</b></div>`;
  if(learned && learned.includes(r.i)) h += `<div class="hsor rb-megt">Megtanulva</div>`;
  h += `<div class="hsor${keves ? " rb-hiany" : ""}">Igényel: ${mesc(profLabel(r.p))} ${min}</div>`;
  if(sajatSzint !== null){
    const meg = min - sajatSzint;
    h += `<div class="hsor">Neked: ${mesc(profOf(sajatP))} ${sajatSzint}`
       + (meg > 0 ? ` <span class="rb-hiany">· még ${meg} szint</span>` : "") + `</div>`;
  }
  if(ta){
    h += `<div class="rb-extra">vétel $${ta[1]} · eladás $${ta[2]} · `
       + (ta[3] ? "Árverezhető" : "Nem árverezhető") + " · "
       + (ta[4] ? "Fejleszthető" : "Nem fejleszthető") + `</div>`;
  }
  return h;
}
let rbubGomb = null;
function receptBubNyit(gomb){
  const r = recipeMap.get(gomb.dataset.pick);
  const t = receptBuborek(r);
  if(!t) return;
  const b = hbubDoboz();
  b.className = "hbub rbub";
  b.innerHTML = t;
  b.style.visibility = "hidden";
  b.classList.add("mutat");
  hbubHelyre(gomb);
  b.style.visibility = "";
  rbubGomb = gomb;
}
function receptBubZar(){
  if(rbubGomb){ rbubGomb = null; hbubZar(); }
}
/* Delegálva, egyszer: a lista minden rajzoláskor újraépül, a tartály marad. */
$("rlist").addEventListener("pointerover", e => {
  if(e.pointerType && e.pointerType !== "mouse") return;
  const g = e.target.closest && e.target.closest("[data-pick]");
  if(!g || g === rbubGomb) return;
  receptBubNyit(g);
});
$("rlist").addEventListener("pointerout", e => {
  const g = e.target.closest && e.target.closest("[data-pick]");
  if(!g || g !== rbubGomb) return;
  if(e.relatedTarget && g.contains(e.relatedTarget)) return;
  receptBubZar();
});
