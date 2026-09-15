// ==UserScript==
// @name         The West Beszerzés-követő
// @namespace    the-west-beszerzo-ingame
// @version      0.7.25
// @description  Termékbeszerzési feladatok követése a játékon belül: kinek, miből mennyit, mennyi van meg, hány munkaóra hátra, egy kattintással munkára küld, és a kész tételt a játék piacán is felajánlja.
// @author       smcZ
// @homepageURL  https://kiszamolja.github.io/the-west-kalkulator-inventorymanaged/
// @updateURL    https://kiszamolja.github.io/the-west-kalkulator-inventorymanaged/the-west-beszerzo.user.js
// @downloadURL  https://kiszamolja.github.io/the-west-kalkulator-inventorymanaged/the-west-beszerzo.user.js
// @match        https://*.the-west.hu/game.php*
// @match        https://*.the-west.net/game.php*
// @match        https://*.the-west.com/game.php*
// @match        https://*.the-west.de/game.php*
// @match        https://*.the-west.pl/game.php*
// @match        https://*.the-west.cz/game.php*
// @match        https://*.the-west.sk/game.php*
// @match        https://*.the-west.es/game.php*
// @match        https://*.the-west.fr/game.php*
// @match        https://*.the-west.it/game.php*
// @match        https://*.the-west.nl/game.php*
// @match        https://*.the-west.gr/game.php*
// @match        https://*.the-west.pt/game.php*
// @match        https://*.the-west.ro/game.php*
// @match        https://*.the-west.se/game.php*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_openInTab
// @run-at       document-idle
// ==/UserScript==

/* =======================================================================
   Beszerzés-követő - The West, játékbeli panel, 0.5.40

   ONALLO SCRIPT. A mesterség-kalkulátor panellel NEM közös: saját
   tárolókulcsok, saját gazdaelem (smcz-beszerzo-host). A kettő egymás
   mellett is futhat.

   Felepites (a panel termekbeszerzo-resze alapjan):
     · felso urlap: Kinek gyujtom / Targy / Darab / hozzaadas
     · szemelyenkent csoportositva, csoportonkent datummal
     · "+" a csoportnal: ugyanahhoz a szemelyhez uj tetel
     · "kell" mennyiseg kattintva, helyben szerkesztheto
     · "x" a tetel torlese
     · targymezo: 2 karaktertol javaslatlista, kezdodok elol, Enter/Tab
       a legfelsot valasztja es tovabblep a kovetkezo mezore

   A mi extrainkkal:
     · a meglevő készlet azonos termekeknel egy kozos keszletbol oszlik szet
     · "megvan" elohen a Bag-bol; keszultseg szazalekban
     · munkaora-jelzes; Munkara gomb a legjobb munka legkozelebbi pontjara
     · kesz tetel egy kattintassal piacra helyezheto: cimzett a megjegyzes,
       mennyiseg a feladatbol, feladatonkent szerkesztheto piaci egysegar
     · a fejlécben KI/BE kapcsolható automata feladás: KI állapotban csak
       kitölti az aukciós ablakot, BE állapotban a végső "Igen"-t is elküldi
     · rejtett gyorslista: a Tárgy mezőbe beillesztett
       `darab [item=azonosító]` lista Enterrel tömegesen felvihető
     · a terméknév nem indít piacra helyezést vagy gyártást; rámutatáskor
       az item játékbeli két ára jelenik meg

   Az egesz ablak fuggolegesen nagyithato (also fogo), a szelesseg fix.

   A feladatlista KEZI feljegyzes: ezt senki nem ellenorzi, a jatekbol
   nem jon. A "kinek", a "targy" es a "darab" a te adatod; a "megvan" meres.
   ======================================================================= */

(function () {
    "use strict";

    const VERZIO = "0.7.25";

    /* A fajlnev ALLANDO, nem tartalmaz verziot: igy a repoban mindig ugyanaz
       a fajl frissul, es a Tampermonkey kovetni tudja. A verzio csak a
       @version sorban es itt el. */
    const WEBOLDAL = "https://kiszamolja.github.io/the-west-kalkulator-inventorymanaged/";
    const FRISS_URL = WEBOLDAL + "the-west-beszerzo.user.js";

    /* Hattérben nezzuk, van-e ujabb. Nincs felugro ablak: a fejlecben
       jelenik meg egy kattinthato jelzes. */
    const FRISS_IDOKOZ = 6 * 60 * 60 * 1000;
    let ujVerzio = null;
    /* A TESZT-epito ide irja a belyeget. Kiadasi alakban ures. */
    const EPITES = "";

    /* -----------------------------------------------------------------
       JATEKELERES. Tampermonkey alatt a jatek globalisai az
       unsafeWindow-ban vannak. Mert: enelkul a Bag es tarsai nem
       latszanak a sandboxbol.
       ----------------------------------------------------------------- */
    function jatek() {
        const U = (typeof unsafeWindow !== "undefined") ? unsafeWindow : null;
        if (U && (U.Bag || U.JobsModel || U.Character)) return U;
        return window;
    }

    const CDN = "https://westhu.innogamescdn.com/images/";

    /* -----------------------------------------------------------------
       TAROLAS. GM-ben, sajat kulccsal.
       Adatmodell (a panel termekbeszerzoivel azonos):
         { kulcs, nev, id, db, mikor }
       ----------------------------------------------------------------- */
    const TAROLO = "smcz-beszerzo-feladatok";
    const BEALL_KULCS = "smcz-beszerzo-beall";
    const GOMB_POS = "smcz-beszerzo-gomb";

    function ujKulcs() { return String(Date.now()) + "-" + Math.random().toString(36).slice(2, 7); }
    function ma() { return new Date().toISOString().slice(0, 10); }

    let beszerzok = [];
    try {
        const b = JSON.parse(GM_getValue(TAROLO, "null"));
        if (Array.isArray(b)) {
            beszerzok = b.map(x => {
                if (!x) return null;
                /* uj alak */
                if (x.id != null && x.db != null) {
                    return { kulcs: x.kulcs || ujKulcs(), nev: String(x.nev || ""),
                             id: String(x.id), db: Number(x.db), mikor: x.mikor || ma(),
                             piacraKint: !!x.piacraKint,
                             piacraMennyiseg: Number(x.piacraMennyiseg) || 0,
                             piacraAr: Number(x.piacraAr) || 0,
                             piacraEgysegar: Number(x.piacraEgysegar) || 0,
                             piacraMinimumAr: Number(x.piacraMinimumAr) || 0,
                             piacraMikor: x.piacraMikor || "" };
                }
                /* regi 0.1.x alak: {i, q, k} */
                if (x.i != null && x.q != null) {
                    return { kulcs: ujKulcs(), nev: String(x.k || ""),
                             id: String(x.i), db: Number(x.q), mikor: ma(),
                             piacraKint: false, piacraMennyiseg: 0, piacraAr: 0,
                             piacraEgysegar: 0, piacraMinimumAr: 0, piacraMikor: "" };
                }
                return null;
            }).filter(x => x && x.id && x.db > 0);
        }
    } catch (e) { beszerzok = []; }

    function ment() {
        try { GM_setValue(TAROLO, JSON.stringify(beszerzok)); } catch (e) { /* nem baj */ }
    }

    let beall = {
        osszCsukva: false, magas: null, bal: null, fent: null, tema: "pult", csukott: {},
        szemelySzuro: [], csakHianyzo: false, automataPiac: false, ful: "beszerzok", keszlethezAd: false,
        piacCel: "vilag", piacNapok: 7
    };
    try {
        const b = JSON.parse(GM_getValue(BEALL_KULCS, "null"));
        if (b && typeof b === "object") beall = Object.assign(beall, b);
    } catch (e) { /* marad az alap */ }
    if (!["pult", "modern", "midnight"].includes(beall.tema)) beall.tema = "pult";
    if (!beall.csukott || typeof beall.csukott !== "object" || Array.isArray(beall.csukott)) beall.csukott = {};
    if (!Array.isArray(beall.szemelySzuro)) beall.szemelySzuro = [];
    if (typeof beall.csakHianyzo !== "boolean") beall.csakHianyzo = false;
    if (typeof beall.automataPiac !== "boolean") beall.automataPiac = false;
    if (beall.ful !== "piac") beall.ful = "beszerzok";
    if (typeof beall.keszlethezAd !== "boolean") beall.keszlethezAd = false;
    if (["vilag", "varos", "szovetseg"].indexOf(beall.piacCel) === -1) beall.piacCel = "vilag";
    beall.piacNapok = Math.max(1, Math.min(7, Math.floor(Number(beall.piacNapok) || 7)));
    function beallMent() {
        try { GM_setValue(BEALL_KULCS, JSON.stringify(beall)); } catch (e) { /* nem baj */ }
    }

    function csoportNevek() {
        const nevek = [];
        const latott = new Set();
        beszerzok.forEach(f => {
            const nev = String(f.nev || "");
            if (!latott.has(nev)) { latott.add(nev); nevek.push(nev); }
        });
        return nevek;
    }

    function csoportCsukottE(nev) {
        const k = String(nev || "");
        return Object.prototype.hasOwnProperty.call(beall.csukott, k) && !!beall.csukott[k];
    }

    function csoportMozgat(nev, irany) {
        const sorrend = csoportNevek();
        const index = sorrend.indexOf(String(nev || ""));
        const cel = index + Number(irany);
        if (index < 0 || cel < 0 || cel >= sorrend.length) return;
        [sorrend[index], sorrend[cel]] = [sorrend[cel], sorrend[index]];

        const uj = [];
        sorrend.forEach(k => beszerzok.forEach(f => {
            if (String(f.nev || "") === k) uj.push(f);
        }));
        beszerzok = uj;
        ment();
        rajzol();
    }

    const esc = s => String(s == null ? "" : s)
        .replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

    /* A játékból érkező név néhány kliensben UTF-8-ként érkezik, de
       latin-1-ként kerül szöveggé alakítva. Ez csak a megjelenítési példányt
       javítja; az azonosításhoz és a számoláshoz használt érték változatlan. */
    function kijelzoSzoveg(s) {
        const x = String(s == null ? "" : s);
        if (!/[\u00C3\u00C2\u00C5]/.test(x)) return x;
        const cp1252 = {
            "\u20AC": "\u0080", "\u201A": "\u0082", "\u0192": "\u0083", "\u201E": "\u0084",
            "\u2026": "\u0085", "\u2020": "\u0086", "\u2021": "\u0087", "\u02C6": "\u0088",
            "\u2030": "\u0089", "\u0160": "\u008A", "\u2039": "\u008B", "\u0152": "\u008C",
            "\u017D": "\u008E", "\u2018": "\u0091", "\u2019": "\u0092", "\u201C": "\u0093",
            "\u201D": "\u0094", "\u2022": "\u0095", "\u2013": "\u0096", "\u2014": "\u0097",
            "\u02DC": "\u0098", "\u2122": "\u0099", "\u0161": "\u009A", "\u203A": "\u009B",
            "\u0153": "\u009C", "\u017E": "\u009E", "\u0178": "\u009F"
        };
        const latin = x.replace(/[\u20AC\u201A\u0192\u201E\u2026\u2020\u2021\u02C6\u2030\u0160\u2039\u0152\u017D\u2018\u2019\u201C\u201D\u2022\u2013\u2014\u02DC\u2122\u0161\u203A\u0153\u017E\u0178]/g, c => cp1252[c]);
        try {
            const jav = decodeURIComponent(escape(latin));
            return jav.indexOf("\uFFFD") < 0 ? jav : x;
        } catch (e) { return x; }
    }

    const EK_KIVETEL = [[/ł/g, "l"], [/ß/g, "ss"], [/đ/g, "d"], [/ø/g, "o"]];
    function ekNelkul(t) {
        let x = String(t == null ? "" : t).toLowerCase();
        for (let i = 0; i < EK_KIVETEL.length; i++) x = x.replace(EK_KIVETEL[i][0], EK_KIVETEL[i][1]);
        return x.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    }

    /* -----------------------------------------------------------------
       NEV es IKON a jatekbol, futasidoben. (Merve mukodik: a nevek es
       az ikonok megjelennek. Ha valaha #id-t latnal, itt kell megnezni
       az ItemManager mezoit.)
       ----------------------------------------------------------------- */
    function itemObj(id) {
        try {
            const IM = jatek().ItemManager;
            if (IM && typeof IM.get === "function") return IM.get(Number(id)) || null;
        } catch (e) { /* nincs */ }
        return null;
    }
    function targyNev(id) {
        const it = itemObj(id);
        if (it) {
            const n = it.name || it.item_name
                || (typeof it.getName === "function" ? (() => { try { return it.getName(); } catch (e) { return null; } })() : null);
            if (n) return String(n);
        }
        return "#" + id;
    }
    function targyIkon(id) {
        const it = itemObj(id);
        const img = it && (it.image || it.item_image);
        if (img) {
            const nev = String(img);
            return nev.indexOf("http") === 0 ? nev : CDN + "items/" + nev;
        }
        return null;
    }

    /* KESZLET: hany darab van a taskaban, elohen. null = a Bag meg nem
       tolt be (ilyenkor "?" es nincs szazalek). */
    function keszlet(id) {
        try {
            const bag = jatek().Bag;
            if (!bag || typeof bag.getItemCount !== "function") return null;
            return Number(bag.getItemCount(Number(id))) || 0;
        } catch (e) { return null; }
    }

    /* -----------------------------------------------------------------
       MUNKAADATOK - a mesterseg-panelbol atvett, MERT fuggvenyek.
       ----------------------------------------------------------------- */
    const MUNKA_TABLA = {
        "2000000": 106, "2009000": 106, "2003000": 108, "2006000": 111
    };

    function munkaEsely(j, id) {
        try {
            const B = jatek().JobsModel;
            const be = B && B.Beans && B.Beans[j.id];
            const so = be && be.basis && be.basis.long && be.basis.long.yields;
            const t = (so || []).find(y => y && String(y.itemid) === String(id));
            if (t) {
                const p = Number(t.prop) || 0;
                const b = Number(t.probBonus) || 0;
                return { szazalek: p + b, rang: p + b };
            }
        } catch (e) { /* tartalek */ }
        try {
            const y = j.yields && j.yields[String(id)];
            if (y && typeof y.prop === "number") return { szazalek: null, rang: y.prop };
        } catch (e) { /* nincs */ }
        return { szazalek: null, rang: 0 };
    }

    function munkaForras(id) {
        const JL = jatek().JobList;
        if (!JL || typeof JL.getJobsByItemId !== "function") return null;

        let lista = [];
        try {
            const r = JL.getJobsByItemId(Number(id));
            lista = Array.isArray(r) ? r : (r && typeof r === "object" ? Object.values(r) : []);
        } catch (e) { lista = []; }
        lista = lista.filter(j => j && j.id != null && j.groupid != null);

        if (lista.length) {
            const sorok = lista.map(j => {
                const e = munkaEsely(j, id);
                return { munka: j, szazalek: e.szazalek, rang: e.rang };
            }).sort((a, b) => b.rang - a.rang);
            const szazalekos = sorok.every(s => s.szazalek != null);
            return { munkak: sorok.map(s => s.munka), sorok: sorok, szazalekos: szazalekos, eselyes: false };
        }

        const jid = MUNKA_TABLA[String(id)];
        if (jid == null) return null;
        let j = null;
        try { j = JL.getJobById(jid); } catch (e) { j = null; }
        if (!j || j.id == null || j.groupid == null) return null;
        return { munkak: [j], sorok: [{ munka: j, szazalek: null, rang: 0 }], szazalekos: false, eselyes: true };
    }

    function munkaElerheto(j) {
        if (!j || j.id == null) return null;
        try {
            const B = jatek().JobsModel;
            const be = B && B.Beans && B.Beans[j.id];
            if (be && typeof be.isVisible === "boolean") return be.isVisible;
        } catch (e) { /* nem tudjuk */ }
        return null;
    }

    function zsakbamacskaMunka(j) {
        try {
            if (!j) return false;
            const y = j.yields;
            const van = y && (Array.isArray(y) ? y.length : Object.keys(y).length);
            const r = j.randomyields;
            return !van && !!(r && r.length);
        } catch (e) { return false; }
    }

    function beansUres() {
        try {
            const JM = jatek().JobsModel;
            const B = JM && JM.Beans;
            return !B || Object.keys(B).length === 0;
        } catch (e) { return false; }
    }

    let oraKeresMikor = 0;
    function oraKeresHaKell() {
        const most = Date.now();
        if (most - oraKeresMikor < 60000) return;
        oraKeresMikor = most;
        try {
            const JM = jatek().JobsModel;
            if (JM && typeof JM.updateSkillPoints === "function") JM.updateSkillPoints();
        } catch (e) { /* marad a regi ertek */ }
        setTimeout(rajzolHaSzabad, 2600);
    }

    /* RUHACSERE-FIGYELO (a panelbol atvett minta). */
    function bonuszosCsere(v) {
        try {
            if (!v || (!v.added && !v.removed)) return true;
            const mind = [].concat(v.added || [], v.removed || []);
            if (!mind.length) return true;
            return mind.some(t => t && typeof t.hasItemBonus === "function" && t.hasItemBonus());
        } catch (e) { return true; }
    }

    let ruhaFigyelve = false;
    let ruhaOra = null, ruhaOra2 = null;
    function ruhaFigyelo() {
        if (ruhaFigyelve) return;
        try {
            const E = jatek().EventHandler;
            if (!E || typeof E.listen !== "function") return;
            E.listen("wear_changed", valtozas => {
                if (!host || !host.parentNode || host.hidden) return;
                if (ruhaOra) clearTimeout(ruhaOra);
                ruhaOra = setTimeout(() => { ruhaOra = null; rajzolHaSzabad(); }, 60);

                if (beall.orak === false || !bonuszosCsere(valtozas)) return;
                if (ruhaOra2) clearTimeout(ruhaOra2);
                ruhaOra2 = setTimeout(() => {
                    ruhaOra2 = null;
                    try {
                        const JM = jatek().JobsModel;
                        if (JM && typeof JM.updateSkillPoints === "function") JM.updateSkillPoints();
                    } catch (e) { /* marad a regi ertek */ }
                    setTimeout(rajzolHaSzabad, 2600);
                }, 120);
            });
            ruhaFigyelve = true;
        } catch (e) { /* enelkul is mukodik */ }
    }

    /* KESZLET-FIGYELO. A Bag nem minden kliensverzioban kuld kulon
       esemenyt minden talalt targy utan, ezert a lathato panel csak a
       kovetett targyak mennyiseget ellenorzi idoszakosan. Nem kuld kerest,
       es zarva teljesen leall. */
    let keszletFigyeloId = null;
    let keszletFigyeloKulcs = "";
    let keszletKiemeltIds = new Set();
    let keszletKiemelesId = null;
    function keszletAllapotKulcs() {
        const ids = [...new Set(beszerzok.map(x => String(x.id)))].sort();
        return ids.map(id => {
            let db = null;
            try { db = keszlet(id); } catch (e) { db = null; }
            return id + ":" + String(db);
        }).join("|");
    }
    function keszletFigyeloLeallit() {
        if (keszletFigyeloId != null) clearTimeout(keszletFigyeloId);
        keszletFigyeloId = null;
        keszletFigyeloKulcs = "";
    }
    function keszletKulcsTerkep(s) {
        const m = new Map();
        String(s || "").split("|").forEach(x => {
            const i = x.indexOf(":");
            if (i > 0) m.set(x.slice(0, i), x.slice(i + 1));
        });
        return m;
    }
    function keszletValtozasKiemel(ids) {
        ids.forEach(id => keszletKiemeltIds.add(String(id)));
        if (keszletKiemelesId != null) clearTimeout(keszletKiemelesId);
        keszletKiemelesId = setTimeout(() => {
            keszletKiemelesId = null;
            keszletKiemeltIds.clear();
            if (latszik && host && !host.hidden) rajzolHaSzabad();
        }, 1400);
    }
    function keszletFigyeloIndit() {
        if (keszletFigyeloId != null) return;
        keszletFigyeloKulcs = keszletAllapotKulcs();
        const ellenoriz = () => {
            keszletFigyeloId = null;
            if (!latszik || !host || host.hidden) return;
            const uj = keszletAllapotKulcs();
            if (uj !== keszletFigyeloKulcs) {
                const regiTerkep = keszletKulcsTerkep(keszletFigyeloKulcs);
                const ujTerkep = keszletKulcsTerkep(uj);
                const erintett = [...new Set([...regiTerkep.keys(), ...ujTerkep.keys()])]
                    .filter(id => regiTerkep.get(id) !== ujTerkep.get(id));
                keszletFigyeloKulcs = uj;
                if (erintett.length) keszletValtozasKiemel(erintett);
                rajzolHaSzabad();
            }
            keszletFigyeloId = setTimeout(ellenoriz, 1500);
        };
        keszletFigyeloId = setTimeout(ellenoriz, 1500);
    }

    /* MENNYI IDEIG KELL DOLGOZNI ERTE. { szoveg, orak }. */
    function oraInfo(id, hianyzo) {
        if (!(hianyzo > 0)) return { szoveg: "", orak: null };
        if (String(id) === "52499000") return { szoveg: "Union Pacific bolt", orak: null };

        const f = munkaForras(id);
        if (!f) return { szoveg: "", orak: null };
        if (f.eselyes) return { szoveg: "zsakbamacska", orak: null };

        const elso = f.sorok && f.sorok[0];
        if (!elso) return { szoveg: "", orak: null };

        if (elso.szazalek == null && zsakbamacskaMunka(elso.munka))
            return { szoveg: "zsakbamacska", orak: null };
        if (elso.szazalek == null) return { szoveg: "", orak: null };

        const mind = f.sorok || [];
        if (mind.length && mind.every(s => munkaElerheto(s.munka) === false))
            return { szoveg: "nem elerheto", orak: null };

        const garantalt = Math.floor(elso.szazalek / 100);
        if (garantalt < 1) return { szoveg: "kicsi az esely", orak: null };
        const n = Math.ceil(hianyzo / garantalt);
        return { szoveg: "meg " + n + " ora munka", orak: n };
    }

    function munkaNeve(id) {
        const f = munkaForras(id);
        const j = f && f.sorok && f.sorok[0] && f.sorok[0].munka;
        return j && j.name ? String(j.name) : "";
    }

    /* -----------------------------------------------------------------
       MUNKARA KULDES. Csak felhasznaloi kattintasra.
       ----------------------------------------------------------------- */
    let terkep = null;
    let munkaFut = false;

    function terkepet(kesz) {
        if (terkep) { kesz(true); return; }
        const A = jatek().Ajax;
        if (!A || typeof A.get !== "function") { kesz(false); return; }
        let egyszer = false;
        try {
            A.get("map", "get_minimap", {}, valasz => {
                if (egyszer) return;
                egyszer = true;
                if (valasz && !valasz.error && valasz.job_groups) { terkep = valasz; kesz(true); }
                else kesz(false);
            });
        } catch (e) { kesz(false); }
    }

    function legkozelebbi(sorok) {
        let hx, hy;
        try {
            const p = jatek().Character.position;
            hx = p.x; hy = p.y;
        } catch (e) { return null; }
        if (typeof hx !== "number" || typeof hy !== "number") return null;

        let i = 0;
        while (i < sorok.length) {
            let v = i;
            while (v < sorok.length && sorok[v].rang === sorok[i].rang) v++;

            let jo = null;
            for (let n = i; n < v; n++) {
                const j = sorok[n].munka;
                const pontok = (terkep && terkep.job_groups && terkep.job_groups[j.groupid]) || [];
                pontok.forEach(p => {
                    const x = p && p[0], y = p && p[1];
                    if (typeof x !== "number" || typeof y !== "number") return;
                    const d = (x - hx) * (x - hx) + (y - hy) * (y - hy);
                    if (!jo || d < jo.d) jo = { d: d, x: x, y: y, munka: j };
                });
            }
            if (jo) return jo;
            i = v;
        }
        return null;
    }

    function allapot(kulcs) {
        const m = gyoker && gyoker.getElementById("allapot");
        if (!m) return;
        const uzenetek = {
            terkep_hiba: "A terkep nem tolt be, probald ujra.",
            nincs_pont: "Erre a munkara nincs pont a terkeped kozeleben.",
            nincs_ablak: "A jatek munkaablaka most nem nyilt meg.",
            piac_varos: "Piacra tenni csak varosban lehet.",
            piac_nincs_ablak: "Nyisd meg a Piac → Targy eladasa ablakot, majd probald ujra.",
            piac_nincs_kesz: "Ez a feladat még nincs kész, ezért nem tettem piacra.",
            piac_nincs_targy: "Nem talaltam ezt a targyat az inventory keresőjével.",
            piac_inventory_api_nincs: "A játék inventory-keresője nem érhető el; nem próbáltam vakon másik mezőbe írni.",
            piac_nem_nyilt: "A targy megvan, de a jatek nem nyitotta meg a Targy elarverezese ablakot.",
            piac_nincs_mezo: "A piac aukcios ablakanak egy mezőjet nem talaltam.",
            piac_biztonsagi_leallas: "Nem azonosítottam biztosan az aukciós űrlapot; nem írtam másik ablakba.",
            piac_nincs_ar: "Nem talaltam meg a targy minimum eladasi arat; nem adtam fel az aukciot.",
            piac_ar_min: "A megadott piaci ár nem lehet a játék minimumára alatt.",
            piac_nincs_igen: "Nem talaltam az aukcio megerosito gombjat.",
            piac_nem_igazolt: "A piac nem igazolta egyertelmuen az aukcio letrehozasat; nem jeloltem kesznek.",
            piac_siker: "A tetel kikerult a piacra.",
            piac_elokeszitve: "Az aukciós ablak kitöltve; az Igen gombot te nyomd meg.",
            piac_auto_be: "Automata piacra rakás bekapcsolva.",
            piac_auto_ki: "Automata piacra rakás kikapcsolva.",
            piac_folyamat: "Piacra helyezes folyamatban…",
            piac_db_nulla: "Adj meg legalabb 1 darabot.",
            piac_db_sok: "Ennyi nincs a taskadban."
        };
        m.textContent = uzenetek[kulcs] || "";
        if (allapot._t) clearTimeout(allapot._t);
        allapot._t = setTimeout(() => { if (m) m.textContent = ""; }, 4000);
    }

    /* Dinamikus, rövid visszajelzés a rejtett gyorslistához. */
    function allapotSzoveg(szoveg) {
        const m = gyoker && gyoker.getElementById("allapot");
        if (!m) return;
        m.textContent = String(szoveg || "");
        if (allapot._t) clearTimeout(allapot._t);
        allapot._t = setTimeout(() => { if (m) m.textContent = ""; }, 5000);
    }

    /* -----------------------------------------------------------------
       PIACRA HELYEZES.

       A játék piactere nincs egységesen dokumentáltan kiexportálva, ezért
       itt szándékosan a játék saját látható felületén dolgozunk: az inventory
       saját keresőjével előhozzuk a feladat tárgyát, megnyitjuk a játék
       aukciós ablakát, kitöltjük a mezőket, majd csak akkor használjuk a
       játék saját "Igen" gombját, ha a fejlécbeli automata kapcsoló BE.
       Nincs közvetlen szerverhívás és nincs koordináta-alapú kattintás.
       A mezőkitöltés kizárólag a biztosan felismert "Tárgy elárverezése"
       modális gyökerén belül történhet. Ha egy kliensváltozatban valamelyik
       azonosító eltér, a funkció biztonságosan leáll, és nem jelöli piacra
       tettnek a feladatot.
       ----------------------------------------------------------------- */
    let piacFut = false;

    function piacNormal(s) {
        return ekNelkul(String(s == null ? "" : s)).replace(/\s+/g, " ").trim();
    }

    function jatekElemE(el) {
        if (!el || el.nodeType !== 1) return false;
        if (host && (el === host || (host.contains && host.contains(el)))) return false;
        try {
            const c = window.getComputedStyle(el);
            if (c.display === "none" || c.visibility === "hidden" || Number(c.opacity) === 0) return false;
            return !!el.getClientRects().length;
        } catch (e) { return false; }
    }

    function piacKattinthatoSzoveg(szoveg, pontos) {
        const q = piacNormal(szoveg);
        const jeloltek = [...document.querySelectorAll("a,button,[role=button],input[type=button],input[type=submit],li,[class*='tab'],[class*='Tab'],[class*='market'],[class*='Market'],[class*='piac'],[class*='Piac']")]
            .filter(jatekElemE)
            .map(el => ({ el, t: piacNormal(el.textContent || el.value || "") }))
            .filter(x => x.t && (pontos ? x.t === q : x.t.includes(q)))
            .sort((a, b) => {
                const ae = a.t === q ? 0 : 1, be = b.t === q ? 0 : 1;
                return ae - be || a.t.length - b.t.length;
            });
        return jeloltek[0] ? jeloltek[0].el : null;
    }

    function piacVarosbanE() {
        try {
            const C = jatek().Character;
            if (!C) return true;
            const fuggvenyek = ["isInTown", "isInCity", "inTown", "inCity", "isInSettlement"];
            for (const n of fuggvenyek) {
                if (typeof C[n] === "function") {
                    const v = C[n]();
                    if (typeof v === "boolean") return v;
                }
            }
            const mezok = ["inTown", "inCity", "isInTown", "isInCity", "inSettlement"];
            for (const n of mezok) if (typeof C[n] === "boolean") return C[n];
            return true; /* ha a kliens nem exportálja, a piac maga ellenőriz */
        } catch (e) { return true; }
    }

    function piacVarakozik(feltetel, ido) {
        const vege = Date.now() + (ido || 5000);
        return new Promise(resolve => {
            const ellenoriz = () => {
                let jo = false;
                try { jo = !!feltetel(); } catch (e) { jo = false; }
                if (jo || Date.now() >= vege) { resolve(jo); return; }
                setTimeout(ellenoriz, 80);
            };
            ellenoriz();
        });
    }

    function piacAukcioKeretTiltottE(el) {
        if (!el || el === document.body || el === document.documentElement) return true;
        if (host && (el === host || (host.contains && host.contains(el)))) return true;
        let n = el;
        for (let i = 0; n && i < 6; i++, n = n.parentElement) {
            const cls = piacNormal((n.id || "") + " " + (typeof n.className === "string" ? n.className : ""));
            /* Az aukciós modált ez a kliens esetenként az inventory ablak
               rétegén belül hozza létre. Az inventory-ős önmagában ezért nem
               kizáró ok; a kereső- és chatmező viszont továbbra is az. */
            if (/chat|chatbox|message|messages|searchbox|search-panel|kereso|kereső/.test(cls)) return true;
            if (i === 0 && /inventory|inventar|bag|tasch|rucksack/.test(cls)) return true;
        }
        return false;
    }

    function piacAukcioKeretBiztosE(root) {
        if (!root || !jatekElemE(root) || piacAukcioKeretTiltottE(root)) return false;
        const t = piacNormal(root.textContent || "");
        const kotelezo = ["targy elarverezese", "megjegyzes", "legkisebb licit", "azonnali vetelar", "mennyiseg"];
        if (!kotelezo.every(k => t.includes(k))) return false;
        const mezok = [...root.querySelectorAll("input,textarea")].filter(jatekElemE)
            .filter(el => !["hidden", "button", "submit", "reset"].includes(String(el.type || "").toLowerCase()));
        if (mezok.length < 4 || mezok.some(piacAukcioKeretTiltottE)) return false;
        const gombok = [...root.querySelectorAll("button,input[type=button],input[type=submit],a,[role=button],div.tw2gui_button")]
            .filter(jatekElemE)
            .map(el => piacNormal(el.textContent || el.value || ""));
        return gombok.includes("igen") && gombok.includes("nem");
    }

    function piacAukcioKeret() {
        const cimkek = [...document.querySelectorAll("body *")]
            .filter(jatekElemE)
            .filter(el => {
                const t = piacNormal(el.textContent || "");
                return t === "targy elarverezese" || (t.includes("targy elarverezese") && t.length <= 110);
            });
        const jeloltek = [];
        cimkek.forEach(cim => {
            let n = cim;
            for (let i = 0; n && i < 20; i++, n = n.parentElement) {
                if (!piacAukcioKeretBiztosE(n)) continue;
                const szovegHossz = piacNormal(n.textContent || "").length;
                /* A legkisebb teljes, érvényes modális gyökér kell. Egy tágabb
                   piac- vagy játékablakot nem választunk ki csak azért, mert
                   abban is látszanak az aukciós mezők. */
                jeloltek.push({ el: n, pont: szovegHossz + (i * 4) });
            }
        });
        jeloltek.sort((a, b) => a.pont - b.pont);
        return jeloltek[0] ? jeloltek[0].el : null;
    }

    function piacEladasAktiv() {
        const G = jatek();
        const M = G && G.MarketWindow;
        try {
            if (M && M.window && M.window.currentActiveTabId === "sell") return true;
            if (M && typeof M.showTab === "function") {
                M.showTab("sell");
                return true;
            }
        } catch (e) { /* marad a látható fül */ }

        const g = piacKattinthatoSzoveg("Targy eladasa", true);
        if (g) return piacKattint(g);
        return false;
    }

    /* A PIAC MEGNYITASA A JATEK SAJAT FUGGVENYEIVEL.

       Eddig a lathato feluleten kellett kattinthato szoveget keresni, ezert
       neked kellett eljutnod a varosig es a piacig. A jatek viszont a
       varosablak sajat HTML-jebe LEIRJA a piac megnyitasat, teljes
       parameterlistaval, peldaul:  MarketWindow.open(4506, 1, 'Blackangel')

       Ezt a szamot NEM talaljuk ki: a jatek irja le, mi csak elolvassuk.
       Ha barmelyik lepes nem sikerul, a folyamat megall es szol, nem
       talalgat tovabb. */
    function piacVarosHTML() {
        try {
            const d = jatek().TownWindow && jatek().TownWindow.DOM;
            if (!d) return "";
            return String(d.innerHTML || (d[0] && d[0].innerHTML) || "");
        } catch (e) { return ""; }
    }

    /* A varosablakbol kiolvasott MarketWindow.open parameterei. */
    function piacNyitoAdat() {
        const h = piacVarosHTML();
        if (!h) return null;
        const m = h.match(/MarketWindow\.open\(\s*(\d+)\s*,\s*(\d+)\s*,\s*['"]([^'"]*)['"]\s*\)/);
        if (!m) return null;
        return { id: Number(m[1]), stage: Number(m[2]), nev: String(m[3]) };
    }

    /* Varosablak megnyitasa a karakter sajat koordinatajaval. */
    function piacVarosablakNyit() {
        try {
            const G = jatek();
            const p = G.Character && G.Character.position;
            if (!G.TownWindow || typeof G.TownWindow.open !== "function" || !p) return false;
            G.TownWindow.open(p.x, p.y);
            return true;
        } catch (e) { return false; }
    }

    /* A piac ablak megnyitasa es az eladas fulre valtas. A fulazonosito
       MERT ertek: a jatek addTab hivasaibol a "Targy eladasa" fule "sell". */
    async function piacAblakSajatUton() {
        const G = jatek();
        if (!G.MarketWindow || typeof G.MarketWindow.open !== "function") return false;

        let adat = piacNyitoAdat();
        if (!adat) {
            if (!piacVarosablakNyit()) return false;
            await piacVarakozik(() => !!piacNyitoAdat(), 2500);
            adat = piacNyitoAdat();
        }
        if (!adat) return false;

        try {
            G.MarketWindow.open(adat.id, adat.stage, adat.nev);
        } catch (e) { return false; }

        await piacVarakozik(() => !!piacKattinthatoSzoveg("Targy eladasa", true) || !!piacAukcioKeret(), 2500);

        try {
            if (typeof G.MarketWindow.showTab === "function") G.MarketWindow.showTab("sell");
        } catch (e) { /* marad a kattintasos ut */ }

        await piacVarakozik(() => !!piacAukcioKeret() || !!piacEladasAktiv(), 1800);
        return true;
    }

    async function piacEladasAblak() {
        let keret = piacAukcioKeret();
        if (keret) return keret;

        /* Eloszor a jatek sajat fuggvenyeivel probaljuk. Ha nem sikerul,
           valtozatlanul mukodik a regi, lathato feluleten kattinto ut. */
        if (!piacKattinthatoSzoveg("Targy eladasa", true)) {
            await piacAblakSajatUton();
            keret = piacAukcioKeret();
            if (keret) return keret;
        }

        let g = piacKattinthatoSzoveg("Targy eladasa", true);
        if (g) {
            /* Ha a piac már látszik, ne kattintsunk rá újra: ez a játékban
               ablak-villanást és az inventory-kattintás elvesztését okozza. */
            piacEladasAktiv();
            await piacVarakozik(() => !!piacKattinthatoSzoveg("Targy eladasa", true) || !!piacAukcioKeret(), 900);
            keret = piacAukcioKeret();
            if (keret) return keret;
            return g;
        }

        g = piacKattinthatoSzoveg("Piac", true);
        if (g) {
            try { g.click(); } catch (e) { /* marad */ }
            await piacVarakozik(() => !!piacKattinthatoSzoveg("Targy eladasa", true) || !!piacAukcioKeret(), 2200);
            g = piacKattinthatoSzoveg("Targy eladasa", true);
            if (g) {
                piacEladasAktiv();
                await piacVarakozik(() => !!piacAukcioKeret(), 1800);
            }
        }
        return piacAukcioKeret() || piacKattinthatoSzoveg("Targy eladasa", true) || null;
    }

    function piacItemAzonosito(el, id) {
        const az = String(id);
        const attrs = ["data-item-id", "data-itemid", "data-item", "itemid", "item-id", "data-object-id"];
        for (const a of attrs) {
            const v = el.getAttribute && el.getAttribute(a);
            if (v != null && String(v) === az) return true;
        }
        return false;
    }

    function piacDomElem(v) {
        if (!v) return null;
        if (v.nodeType === 1) return v;
        if (v[0] && v[0].nodeType === 1) return v[0];
        return null;
    }

    function piacInventoryGyoker() {
        try {
            const I = jatek().Inventory;
            const sajat = [I && I.DOM, I && I.dom, I && I.element, I && I.container, I && I.root];
            for (const v of sajat) {
                const el = piacDomElem(v);
                if (el && el.querySelector) return el;
            }
        } catch (e) { /* a DOM-os keresés következik */ }

        const jeloltek = [...document.querySelectorAll(
            "[id*='inventory'],[id*='Inventory'],[id*='bag'],[id*='Bag']," +
            "[class*='inventory'],[class*='Inventory'],[class*='bag'],[class*='Bag']," +
            "[class*='rucksack'],[class*='Rucksack'],[class*='tasch'],[class*='Tasch']"
        )].filter(el => {
            if (host && (el === host || (host.contains && host.contains(el)))) return false;
            return jatekElemE(el) || [...el.querySelectorAll("input,button,[class*='item'],[class*='slot']")].some(jatekElemE);
        });
        jeloltek.sort((a, b) => (a.textContent || "").length - (b.textContent || "").length);
        return jeloltek[0] || null;
    }

    function piacInventoryAnyaE(el) {
        let n = el;
        for (let i = 0; n && i < 7; i++, n = n.parentElement) {
            const cls = piacNormal((n.id || "") + " " + (typeof n.className === "string" ? n.className : ""));
            if (/inventory|inventar|bag|tasch|rucksack|itemslot|item-slot/.test(cls)) return true;
        }
        return false;
    }

    function piacInventoryElem(id, nev) {
        const az = String(id), n = piacNormal(nev);
        const ikon = targyIkon(id);
        const ikonFajl = ikon ? String(ikon).split("/").pop().split("?")[0].toLowerCase() : "";
        const root = piacInventoryGyoker();
        const mind = root
            ? [...new Set([
                root,
                ...root.querySelectorAll("*"),
                ...[...document.querySelectorAll("body *")].filter(piacInventoryAnyaE)
            ])].filter(jatekElemE)
            : [...document.querySelectorAll("body *")].filter(el => jatekElemE(el) && piacInventoryAnyaE(el));
        const jeloltek = [];
        mind.forEach(el => {
            let pont = -Infinity;
            if (piacItemAzonosito(el, az)) pont = 1000;
            const cls = piacNormal((el.id || "") + " " + (el.className && typeof el.className === "string" ? el.className : ""));
            const targyOsztaly = /(?:^|[^0-9])item(?:[^0-9]|$)|slot/.test(cls);
            if (/inventory|inventar|bag|tasch|rucksack|itemslot|item-slot/.test(cls)) {
                pont = Math.max(pont, targyOsztaly ? 220 : 100);
            }
            if (targyOsztaly) pont = Math.max(pont, 180);
            const azReg = new RegExp("(?:^|[^0-9])" + az.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "(?:[^0-9]|$)");
            if (azReg.test(cls)) pont = Math.max(pont, 700);
            if (el.getAttribute && el.getAttribute("draggable") === "true") pont = Math.max(pont, 180);
            const src = el.getAttribute && el.getAttribute("src");
            if (src && azReg.test(src)) pont = Math.max(pont, 260);
            if (src && ikonFajl && String(src).toLowerCase().includes(ikonFajl)) pont = Math.max(pont, 900);
            const style = el.getAttribute && el.getAttribute("style");
            if (style && azReg.test(style)) pont = Math.max(pont, 420);
            const meta = ["alt", "title", "aria-label", "data-name", "data-item-name"]
                .map(a => el.getAttribute && el.getAttribute(a) || "").join(" ");
            const sajatSzoveg = piacNormal(el.textContent || "");
            if (n && (sajatSzoveg === n || piacNormal(meta) === n)) pont = Math.max(pont, 520);
            else if (n && sajatSzoveg.includes(n) && sajatSzoveg.length < 100) pont = Math.max(pont, 420);
            if (pont > -Infinity) {
                let k = el;
                for (let i = 0; i < 3 && k; i++, k = k.parentElement) {
                    const kc = piacNormal((k.id || "") + " " + (k.className && typeof k.className === "string" ? k.className : ""));
                    if (/inventory|inventar|bag|tasch|rucksack|itemslot|item-slot/.test(kc)) pont += 80;
                    if (/market|auction|auktion|piac/.test(kc)) pont -= 180;
                    if (/button|slot|item/.test(kc)) pont += 10;
                }
                jeloltek.push({ el, pont });
            }
        });
        jeloltek.sort((a, b) => b.pont - a.pont);
        if (!jeloltek.length) return null;
        let cel = jeloltek[0].el;
        const fel = cel.closest && cel.closest("button,a,[role=button],.item,.itemslot,.item-slot,.slot");
        if (fel && jatekElemE(fel)) cel = fel;
        return cel;
    }

    function piacBagTargy(id) {
        try {
            const B = jatek().Bag;
            if (!B || typeof B.getItemByItemId !== "function") return null;
            const probak = [Number(id), String(id)];
            for (const p of probak) {
                let item = null;
                try { item = B.getItemByItemId(p); } catch (e) { item = null; }
                if (item && item.obj) return item;
            }
        } catch (e) { /* a játék inventory-API-ja nem érhető el */ }
        return null;
    }

    /* 0.5.39: ha a piaci folyamat atirja a jatek inventory-kattintasat,
       a folyamat vegen vissza kell adni. Ugyanazzal az API-val adjuk
       vissza, amivel beallitottuk; ha a kliens nem exportalja, a nyers
       Inventory.click ertekre esunk vissza. */
    let piacRegiKattintas = null;
    function piacKattintasVissza() {
        const mentett = piacRegiKattintas;
        piacRegiKattintas = null;
        if (!mentett || !mentett.I) return;
        try {
            if (mentett.regi && typeof mentett.I.setClickHandler === "function") {
                mentett.I.setClickHandler(mentett.regi);
            } else {
                mentett.I.click = mentett.regi;
            }
        } catch (e) { /* a kliens nem engedi visszaallitani */ }
    }

    async function piacInventoryNatívKattint(id, item) {
        const G = jatek();
        const I = G && G.Inventory;
        const M = G && G.MarketWindow;
        if (!I) return false;

        /* A mérési parancs megmutatta, hogy ebben a kliensben az
           Inventory.clickHandler lefut, de a név szerint figyelt
           MarketWindow.onInventoryClick nem feltétlenül az aktuális
           callback. Először ezért pontosan azt a callbacket hívjuk meg,
           amelyet a játék az Inventory.click objektumban tárol. Ez ugyanaz
           az útvonal, amit a valódi inventory-kattintás használ. */
        try {
            const aktivKattintas = I.click;
            if (aktivKattintas && typeof aktivKattintas.callback === "function") {
                aktivKattintas.callback.apply(aktivKattintas.context || I, [item]);
                if (await piacVarakozik(() => !!piacAukcioKeret(), 1800)) return true;
            }
        } catch (e) { /* a kliens piaci callbackje nem hívható közvetlenül */ }

        /* Egyes kliensekben a piaci callback név szerint is elérhető, de nem
           kerül bele az Inventory.click objektumba. Ez csak tartalék útvonal. */
        try {
            if (M && typeof M.onInventoryClick === "function") {
                M.onInventoryClick.call(M, item);
                if (await piacVarakozik(() => !!piacAukcioKeret(), 1200)) return true;
            }
        } catch (e) { /* maradnak a további natív tartalékok */ }

        /* A natív Inventory-útvonalat továbbra is előkészítjük a régebbi
           kliensekhez, ahol a callback csak a clickHandleren keresztül
           működik. */
        let natívKezelő = false;
        try {
            if (typeof I.setClickHandler === "function" && M && typeof M.onInventoryClick === "function") {
                const beallitas = { callback: M.onInventoryClick, context: M };
                if (M.window) beallitas.window = M.window;
                if (!piacRegiKattintas) piacRegiKattintas = { I, regi: I.click };
                I.setClickHandler(beallitas);
                natívKezelő = true;
            }
        } catch (e) { /* a konkrét kliens nem exportálja ezt a módszert */ }

        if (natívKezelő && typeof I.clickHandler === "function") {
            try {
                const ME = (G && G.MouseEvent) || window.MouseEvent;
                const esemeny = typeof ME === "function"
                    ? new ME("click", { bubbles: true, cancelable: true, view: G || window })
                    : null;
                I.clickHandler.call(I, Number(id), esemeny);
                /* Ha az API már megnyitotta a modált, ne küldjünk még egy
                   kattintást ugyanarra a tárgyra. */
                if (await piacVarakozik(() => !!piacAukcioKeret(), 1000)) return true;
            } catch (e) { /* az exact DOM-elem a tartalék útvonal */ }
        }

        /* Tartalék a régebbi kliensekhez: a Bag-ból kapott konkrét
           InventoryItem.divMain elemre kattintunk, nem egy szöveg- vagy
           koordináta-alapú találatra. */
        const divMain = piacDomElem(item && item.divMain);
        if (divMain && jatekElemE(divMain) && piacInventoryKattint(divMain)) return true;

        /* Ha a kliensnek van clickHandlerje, de setClickHandlerje nincs, még
           mindig a játék saját item-ID alapú kattintási útvonala a legjobb
           tartalék; ez nem érintheti a chat vagy a TW_Calc mezőit. */
        if (typeof I.clickHandler === "function") {
            try {
                const ME = (G && G.MouseEvent) || window.MouseEvent;
                const esemeny = typeof ME === "function"
                    ? new ME("click", { bubbles: true, cancelable: true, view: G || window })
                    : null;
                I.clickHandler.call(I, Number(id), esemeny);
                return true;
            } catch (e) { /* nincs használható natív kattintási útvonal */ }
        }
        return false;
    }

    async function piacInventoryKeresessel(id, nev) {
        const G = jatek();
        const I = G && G.Inventory;
        const item = piacBagTargy(id);
        if (!I || typeof I.showSearchResult !== "function" || !item) return null;

        try {
            let nyitva = false;
            const wman = G && G.wman;
            if (wman && I.uid && typeof wman.getById === "function") nyitva = !!wman.getById(I.uid);
            const dom = piacDomElem(I.DOM);
            if (!nyitva && !(dom && jatekElemE(dom)) && typeof I.open === "function") I.open();

            /* Ez a játék natív inventory-útvonala: nem keresőmezőt választunk
               ki a DOM-ból, hanem az item ID-jához tartozó Bag-objektumot
               adjuk a natív keresési eredménylistának. Így a TW_Calc saját
               receptkeresője és a chat sem lehet célpont. */
            I.showSearchResult([item]);
        } catch (e) {
            return { api: true, kattintva: false };
        }

        const talalat = await piacVarakozik(() => {
            const divMain = piacDomElem(item && item.divMain);
            return !!(divMain && jatekElemE(divMain)) || !!piacInventoryElem(id, nev);
        }, 3500);
        const divMain = piacDomElem(item && item.divMain);
        const targy = divMain && jatekElemE(divMain) ? divMain : piacInventoryElem(id, nev);
        if (!talalat || !targy) return { api: true, kattintva: false };
        return { api: true, kattintva: await piacInventoryNatívKattint(id, item) };
    }

    function piacKattint(el) {
        if (!el) return false;
        try {
            if (typeof el.click === "function") el.click();
            else el.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window }));
            return true;
        } catch (e) { return false; }
    }

    function piacInventoryKattint(el) {
        if (!el) return false;
        try {
            /* Régi The-West kliensekben az inventory-kezelő mousedownra is
               figyelhet; ezért a tartalék DOM-útvonal teljes rövid egérsort
               küld, majd a natív clicket. Az Igen gombnál ezt nem használjuk,
               hogy egyetlen feladásból ne legyen dupla művelet. */
            const ev = (tipus) => {
                try {
                    const C = tipus.indexOf("pointer") === 0 && typeof PointerEvent === "function" ? PointerEvent : MouseEvent;
                    el.dispatchEvent(new C(tipus, { bubbles: true, cancelable: true, view: window, buttons: 1 }));
                } catch (e) { /* marad */ }
            };
            ev("pointerdown"); ev("mousedown"); ev("pointerup"); ev("mouseup");
            if (typeof el.click === "function") el.click();
            else el.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window }));
            return true;
        } catch (e) { return false; }
    }

    function piacMezoHelyiSzoveg(input, root) {
        const res = [];
        const latott = new Set();
        const add = (s) => {
            const t = piacNormal(s);
            if (t && !latott.has(t)) { latott.add(t); res.push(t); }
        };
        let n = input;
        for (let mely = 0; n && mely < 5; mely++) {
            const p = n.parentElement;
            if (!p) break;
            const gyerekek = [...p.childNodes];
            const index = gyerekek.findIndex(x => x === n || (x.nodeType === 1 && x.contains && x.contains(input)));
            if (index >= 0) {
                for (let i = Math.max(0, index - 3); i < index; i++) {
                    const x = gyerekek[i];
                    add(x.nodeType === 1 ? x.textContent : x.nodeValue);
                }
            }
            /* Ha egy kis mezőcsoport csak ezt az egy inputot tartalmazza,
               annak teljes szövege jó címkejelölt. A teljes aukciós keretet
               viszont szándékosan nem vesszük bele, mert abban egyszerre
               szerepel a licit és az azonnali vételár is. */
            const inputok = p.querySelectorAll ? p.querySelectorAll("input,textarea") : [];
            if (inputok.length <= 1 && (p.textContent || "").length < 160) add(p.textContent);
            n = p;
        }
        return res.join(" ");
    }

    function piacMezoPont(input, root, kulcsok, tiltottKulcsok) {
        let pont = 0;
        const attrs = ["name", "id", "class", "placeholder", "aria-label", "title"]
            .map(a => { try { return piacNormal(input.getAttribute(a)); } catch (e) { return ""; } }).join(" ");
        const helyi = piacMezoHelyiSzoveg(input, root);
        kulcsok.forEach(k => {
            if (attrs.includes(k)) pont += 80;
            if (helyi.includes(k)) pont += 100;
        });
        (tiltottKulcsok || []).forEach(k => {
            if (attrs.includes(k)) pont -= 180;
            if (helyi.includes(k)) pont -= 220;
        });
        let n = input;
        for (let i = 0; n && i < 5; i++, n = n.parentElement) {
            const t = piacNormal(n.textContent || "");
            if (t.length > 0 && t.length < 260) {
                kulcsok.forEach(k => { if (t.includes(k)) pont += Math.max(3, 12 - i * 3); });
            }
        }
        if (input.tagName === "TEXTAREA" && kulcsok.includes("megjegyzes")) pont += 30;
        return pont;
    }

    function piacMezo(root, kulcsok, tiltottKulcsok) {
        if (!root) return null;
        const megjegyzesMezo = (kulcsok || []).some(k => /megjegyzes|aukciohoz/.test(k));
        const mezok = [...root.querySelectorAll("input,textarea")]
            .filter(el => jatekElemE(el) && !["hidden", "button", "submit", "reset"].includes(String(el.type || "").toLowerCase()) && !el.disabled);

        /* A jelenlegi The-West aukciós ablak stabil, natív azonosítókat ad.
           Ezeket használjuk elsődlegesen, így a keresőmező vagy másik input
           nem kerülhet a kitöltés célpontjába. */
        const pontosId = megjegyzesMezo
            ? "auction_description"
            : (kulcsok || []).some(k => /azonnali/.test(k))
                ? "market_max_price"
                : (kulcsok || []).some(k => /arveresek/.test(k))
                    ? "market_sell_itemAuctions"
                : (kulcsok || []).some(k => /mennyiseg/.test(k))
                    ? "market_sell_itemStack"
                    : (kulcsok || []).some(k => /legkisebb licit|minimum licit/.test(k))
                        ? "market_min_bid"
                        : "";
        if (pontosId) {
            const pontos = root.querySelector("#" + pontosId);
            if (pontos && mezok.includes(pontos)) return pontos;
        }

        /* A megjegyzés az aukciós ablakban textarea, az ár- és darabmezők
           viszont inputok. Ezt a DOM-típust elsődleges szabályként használjuk,
           nem pontozzuk össze őket közös szülőszöveg alapján. */
        if (megjegyzesMezo) {
            const textarea = mezok.find(el => String(el.tagName || "").toUpperCase() === "TEXTAREA");
            if (textarea) return textarea;
        }
        const kereshetoMezok = !megjegyzesMezo
            ? mezok.filter(el => String(el.tagName || "").toUpperCase() === "INPUT")
            : mezok;
        if (!kereshetoMezok.length) return null;

        const azonnali = (kulcsok || []).some(k => /azonnali/.test(k));
        const jeloltek = mezok.map(el => ({
            el,
            pont: piacMezoPont(el, root, kulcsok, tiltottKulcsok),
            helyi: piacMezoHelyiSzoveg(el, root),
            attrs: ["name", "id", "class", "placeholder", "aria-label", "title"]
                .map(a => { try { return piacNormal(el.getAttribute(a)); } catch (e) { return ""; } }).join(" ")
        })).filter(x => kereshetoMezok.includes(x.el)).sort((a, b) => b.pont - a.pont);
        const tiltott = tiltottKulcsok || [];
        const legjobb = jeloltek.find(x => x.pont > 0 && !tiltott.some(k => x.helyi.includes(k)) &&
            (!azonnali || x.helyi.includes("azonnali") || x.attrs.includes("azonnali")));
        if (legjobb) return legjobb.el;

        /* Biztonsági útvonal a régi west.gui elrendezéshez: az árpárban a
           „Legkisebb licit” és az „Azonnali vételár” két egymás melletti
           mező, de a címke nem mindig kerül ugyanabba a DOM-ágba. Ilyenkor
           a minimum licitet kizárjuk, és a másik dolláros mezőt választjuk. */
        if (azonnali) {
            const arJeloltek = kereshetoMezok.filter(el => {
                const t = piacMezoHelyiSzoveg(el, root);
                return !/legkisebb licit|minimum licit|licit/.test(t) &&
                    !/mennyiseg|aukcio/.test(t) && /\$|ar|vetel/.test(t);
            });
            if (arJeloltek.length) return arJeloltek[arJeloltek.length - 1];

            /* Végső, determinisztikus tartalék a jelenlegi The-West űrlaphoz:
               a látható inputok sorrendje a két ármezővel kezdődik, majd a
               mennyiség és az árverések száma következik. A második input a
               vételár; a textarea már eleve ki van zárva. */
            if (kereshetoMezok.length >= 2) return kereshetoMezok[1];
        }
        return null;
    }

    /* A jatek sajat legordoloi (tw2gui_combobox) rejtett ertekmezot es kulon
       feliratot hasznalnak. MERT teny: a sima click() NEM allitja at oket,
       a teljes egersor viszont igen. Ezert nyitunk, majd a kivalasztott sorra
       elkuldjuk mind a negy esemenyt.

       A valasztas a FELIRAT szerint megy, nem sorszam szerint, igy akkor sem
       teved, ha a jatek megcsereli a sorrendet, vagy ha valamelyik lehetoseg
       hianyzik (peldaul nincs szovetseged).

       MERT ertekek: barkinek = 2, szovetseg = 1, varos = 0. A napoknal a
       felirat szama egyben az ertek. */
    function piacLegorduloAllit(azonosito, mintak, kesz) {
        const doboz = document.getElementById(azonosito);
        if (!doboz) return kesz(false);

        const ertekMezo = document.getElementById(azonosito + "_value");
        const gomb = doboz.querySelector(".tw2gui_combobox_btn");
        if (!gomb) return kesz(false);

        try { gomb.click(); } catch (e) { return kesz(false); }

        setTimeout(() => {
            const sorok = [...document.querySelectorAll(".tw2gui_groupframe_content_pane span")]
                .filter(x => piacNormal(x.textContent || "").length > 0);

            const cel = sorok.find(x => {
                const t = piacNormal(x.textContent || "");
                return mintak.some(m => t.includes(piacNormal(m)));
            });

            if (!cel) {
                try { gomb.click(); } catch (e) { /* zarjuk be */ }
                return kesz(false);
            }

            /* Az esemenyt a JATEK sajat ablakabol gyartjuk.
               MERT hiba volt: a Tampermonkey homokozojaban letrehozott
               MouseEvent mas osztaly, mint az oldale, ezert a jatek jQuery-je
               figyelmen kivul hagyta. A legordulo kinyilt, de a valasztas nem
               hajtodott vegre. Konzolbol ugyanez mukodott, mert ott az oldal
               sajat MouseEvent-je keszult. */
            const W = jatek();
            const EsemenyOsztaly = (W && W.MouseEvent) ? W.MouseEvent : MouseEvent;

            ["pointerdown", "mousedown", "mouseup", "click"].forEach(tip => {
                try {
                    cel.dispatchEvent(new EsemenyOsztaly(tip,
                        { bubbles: true, cancelable: true, view: W || window }));
                }
                catch (e) { /* megyunk tovabb */ }
            });

            setTimeout(() => {
                kesz(true, ertekMezo ? String(ertekMezo.value) : "");
            }, 220);
        }, 260);
    }

    function piacMezoFokusz(el) {
        if (!el) return;
        try {
            if (document.activeElement && document.activeElement !== el &&
                typeof document.activeElement.blur === "function") {
                document.activeElement.blur();
            }
        } catch (e) { /* marad */ }
        try {
            if (typeof el.focus === "function") el.focus({ preventScroll: true });
        } catch (e) {
            try { if (typeof el.focus === "function") el.focus(); } catch (e2) { /* marad */ }
        }
    }

    function piacMezoErtek(el, value) {
        if (!el) return;
        /* A játék inventory-keresője maradhat fókuszban a natív item-kattintás
           után. Minden egyes aukciós mező előtt visszavesszük a fókuszt. */
        piacMezoFokusz(el);
        try {
            const proto = Object.getPrototypeOf(el);
            const d = proto && Object.getOwnPropertyDescriptor(proto, "value");
            if (d && typeof d.set === "function") d.set.call(el, String(value));
            else el.value = String(value);
        } catch (e) { el.value = String(value); }
        ["input", "change", "keyup"].forEach(type => {
            try {
                const E = (jatek() && jatek().Event) || window.Event;
                el.dispatchEvent(new E(type, { bubbles: true, cancelable: true }));
            } catch (e) { /* marad */ }
        });
    }

    function piacArSzam(s) {
        const x = String(s || "").replace(/\s/g, "");
        if (!x) return 0;
        const normal = /\d{1,3}(?:\.\d{3})+$/.test(x) ? x.replace(/\./g, "") : x.replace(/,/g, ".");
        const n = Number(normal.replace(/[^0-9.\-]/g, ""));
        return Number.isFinite(n) ? n : 0;
    }

    /* A tárgy infóbuborékja két pénzértéket mutat. A játék kliensenként
       más néven teheti ezeket az ItemManager objektumba, ezért először a
       gyakori mezőneveket, utána a sekélyen beágyazott ármezőket olvassuk.
       A DOM-os tartalék csak akkor fut, ha tényleg szükség van rá; így a
       teljes feladatlista újrarajzolása nem jár teljes oldal-szkenneléssel. */
    function piacArak(id, root, nev, domTartalek) {
        let ar = 0, minimum = 0;
        const it = itemObj(id);
        const ertek = v => {
            let n = 0;
            try { n = Number(v); } catch (e) { n = 0; }
            return Number.isFinite(n) && n > 0 ? n : piacArSzam(v);
        };
        const olvas = (o, kulcsok) => {
            if (!o) return 0;
            for (const k of kulcsok) {
                let v = 0;
                try {
                    v = typeof o[k] === "function" ? o[k]() : o[k];
                    v = ertek(v);
                } catch (e) { v = 0; }
                if (v > 0) return v;
            }
            return 0;
        };
        const minimumKulcsok = [
            "minimumSellPrice", "minimum_sell_price", "minSellPrice", "min_sell_price",
            "sellPrice", "sell_price", "sellingPrice", "selling_price",
            "marketSellPrice", "market_sell_price", "getSellPrice", "getSellingPrice"
        ];
        const arKulcsok = [
            "price", "itemPrice", "item_price", "basePrice", "base_price",
            "buyPrice", "buy_price", "purchasePrice", "purchase_price",
            "shopPrice", "shop_price", "getPrice", "getBuyPrice", "getPurchasePrice",
            "value", "worth", "cost"
        ];
        if (it) {
            minimum = olvas(it, minimumKulcsok);
            ar = olvas(it, arKulcsok);

            const latott = new Set();
            const jar = (o, melyseg) => {
                if (!o || melyseg > 3 || typeof o !== "object" || latott.has(o)) return;
                latott.add(o);
                let kulcsok = [];
                try { kulcsok = Object.keys(o); } catch (e) { kulcsok = []; }
                kulcsok.forEach(k => {
                    let v = 0;
                    try { if (typeof o[k] !== "object" && typeof o[k] !== "function") v = ertek(o[k]); } catch (e) { v = 0; }
                    const q = piacNormal(k).replace(/[^a-z0-9]/g, "");
                    if (v > 0) {
                        const minKulcs = /minimum|minimal|minsell|sell|eladas|elad/.test(q) &&
                            /price|ar|cost|value|ertek/.test(q);
                        const arKulcs = /price|ar|cost|value|worth|buy|purchase|shop|base/.test(q) &&
                            !/minimum|minimal|minsell|sell|eladas|elad/.test(q);
                        if (minKulcs && !minimum) minimum = v;
                        else if (arKulcs && !ar) ar = v;
                    } else {
                        try { if (o[k] && typeof o[k] === "object") jar(o[k], melyseg + 1); } catch (e) { /* nem baj */ }
                    }
                });
            };
            jar(it, 0);
        }

        if (root) {
            const t = piacNormal(root.textContent || "");
            const m = t.match(/egysegar[^$€]{0,30}[$€]\s*([\d.,]+)/i);
            if (m && !(minimum > 0)) minimum = piacArSzam(m[1]);
        }

        if (domTartalek) {
            /* Tartalék: a kiválasztott tárgy információs buborékja több
               kliensben a két árat egymás után mutatja. */
            const q = piacNormal(nev);
            if (q) {
                const bub = [...document.querySelectorAll("body *")].filter(jatekElemE)
                    .filter(el => {
                        const cls = piacNormal((el.id || "") + " " + (el.className && typeof el.className === "string" ? el.className : ""));
                        const tx = piacNormal(el.textContent || "");
                        return tx.includes(q) && tx.length < 500 && /item|tooltip|popup|detail|targy/.test(cls);
                    });
                for (const el of bub) {
                    const penzek = [...(el.textContent || "").matchAll(/[$€]\s*([\d.,]+)/g)]
                        .map(x => piacArSzam(x[1])).filter(x => x > 0);
                    if (penzek.length >= 2) {
                        if (!(ar > 0)) ar = penzek[0];
                        if (!(minimum > 0)) minimum = penzek[penzek.length - 1];
                        break;
                    }
                    if (penzek.length === 1 && !(minimum > 0)) minimum = penzek[0];
                }
            }
        }
        return { ar: Math.round(ar || 0), minimum: Math.round(minimum || 0) };
    }

    function piacMinimumAr(id, root, nev) {
        return piacArak(id, root, nev, true).minimum;
    }

    function piacAlapAr(f, root) {
        if (f && Number(f.piacraMinimumAr) > 0) return Math.round(Number(f.piacraMinimumAr));
        return f ? piacArak(f.id, root, targyNev(f.id), !!root).minimum : 0;
    }

    function piacBeallitottAr(f, alap) {
        const v = f && Number(f.piacraEgysegar);
        return v > 0 ? Math.round(v) : Math.round(Number(alap) || 0);
    }

    function piacArMezoMent(f, value, ujrarajzol) {
        if (!f) return false;
        const alap = piacAlapAr(f);
        const v = piacArSzam(value);
        /* Üres vagy nulla érték visszaállítja a játék minimumát. */
        if (!(v > 0)) {
            f.piacraEgysegar = 0;
            if (ujrarajzol) { ment(); rajzol(); }
            else ment();
            return true;
        }
        if (alap > 0 && v < alap) {
            allapot("piac_ar_min");
            return false;
        }
        f.piacraEgysegar = Math.round(v);
        if (alap > 0) f.piacraMinimumAr = alap;
        if (ujrarajzol) { ment(); rajzol(); }
        else ment();
        return true;
    }

    function piacIgenGomb(root) {
        if (!root) return null;
        const jeloltek = [...root.querySelectorAll("button,input[type=button],input[type=submit],a,[role=button],div.tw2gui_button")]
            .filter(jatekElemE)
            .map(el => ({ el, t: piacNormal(el.textContent || el.value || "") }))
            .filter(x => x.t === "igen")
            .sort((a, b) => a.t.length - b.t.length);
        return jeloltek[0] ? jeloltek[0].el : null;
    }

    function piacSikerSzoveg() {
        const t = piacNormal(document.body && document.body.textContent || "");
        return /sikeresen|aukcio letrehozva|aukcio elhelyezve|eladasra kerult|ajanlat letrehozva/.test(t);
    }

    function piacMezoBiztosE(root, el) {
        return !!(root && el && root.contains(el) && jatekElemE(el) && !piacAukcioKeretTiltottE(el));
    }

    /* A masodik parameter a gomb, a harmadik a KESZLET MOD.
       Keszlet modban nincs feladat mogotte: a targyat, a darabszamot es a
       megjegyzest a Piac ful sora adja, ezert a feladathoz kotott reszek
       (keszultseg-ellenorzes, armezo a sor alatt, piacra-jelolés mentese)
       kimaradnak. A kozepso resz, vagyis maga a feladas, KOZOS. */
    async function piacraRak(f, elem, keszletMod) {
        if (!f || piacFut) return;
        if (!keszletMod) {
            const a = sorAdat(f, keszletElosztas());
            if (a.piacon) return;
            if (!a.kesz) { allapot("piac_nincs_kesz"); return; }
        }

        /* A sor alatti ármező értékét még a natív ablak megnyitása előtt
           eltesszük. Így a kattintás biztosan az adott feladathoz tartozó
           árat használja, nem egy másik input vagy egy korábbi állapot
           értékét. */
        const arMezo = !keszletMod && elem && elem.closest && elem.closest(".piac-csomag")
            ? elem.closest(".piac-csomag").querySelector("[data-piac-ar]") : null;
        if (arMezo) {
            const beirt = piacArSzam(arMezo.value);
            const eloAlap = piacAlapAr(f);
            if (eloAlap > 0 && beirt > 0 && beirt < eloAlap) {
                allapot("piac_ar_min");
                return;
            }
            f.piacraEgysegar = beirt > 0 ? Math.round(beirt) : 0;
            if (eloAlap > 0) f.piacraMinimumAr = eloAlap;
            ment();
        }

        piacFut = true;
        if (elem) elem.classList.add("var");
        allapot("piac_folyamat");
        try {
            if (!piacVarosbanE()) throw "piac_varos";
            /* Először a már látható piaci fület használjuk. Csak akkor
               nyitjuk/aktiváljuk, ha nincs a képernyőn; így nem villan fel a
               piac minden egyes feladatnál. */
            const marLatszik = !!piacKattinthatoSzoveg("Targy eladasa", true);
            if (!marLatszik) await piacEladasAblak();
            if (!piacEladasAktiv()) throw "piac_nincs_ablak";

            /* A készlet több száz tárgyat is tartalmazhat, miközben a játék
               csak az aktuális oldalt rajzolja ki. A játék saját inventory-
               keresőjét használjuk, és csak a keresés eredményét kattintjuk.
               A keresés eredménylistáját NEM állítjuk vissza: a kliens erre
               nincs mért, biztosan hívható útvonala. A táska szűrt nézete
               ezért a folyamat után is a feladat tárgyát mutatja, amíg a
               játékos maga nem törli a keresést. */
            const inventoryKereses = await piacInventoryKeresessel(f.id, targyNev(f.id));
            if (!inventoryKereses) throw "piac_inventory_api_nincs";
            if (!inventoryKereses.kattintva) throw "piac_nincs_targy";

            const megnyilt = await piacVarakozik(() => !!piacAukcioKeret(), 5000);
            if (!megnyilt) throw "piac_nem_nyilt";
            const keret = piacAukcioKeret();
            if (!piacAukcioKeretBiztosE(keret)) throw "piac_biztonsagi_leallas";

            const mennyiseg = Math.max(1, Math.floor(Number(f.db) || 0));
            const megjegyzes = piacMezo(keret, ["megjegyzes", "aukciohoz"]);
            const vetelar = piacMezo(keret, ["azonnali vetelar", "azonnali vetel"], ["legkisebb licit", "minimum licit", "licit"]);
            const dbmezo = piacMezo(keret, ["mennyiseg"]);
            const licit = piacMezo(keret, ["legkisebb licit", "minimum licit"]);
            /* Ket kulonbozo baj, ket kulonbozo uzenet: vagy nincs meg a mezo,
               vagy megvan, de nem biztos, hogy az aukcios ablake. */
            if (!megjegyzes || !vetelar || !dbmezo) throw "piac_nincs_mezo";
            if (!piacMezoBiztosE(keret, megjegyzes) || !piacMezoBiztosE(keret, vetelar) ||
                !piacMezoBiztosE(keret, dbmezo)) {
                throw "piac_biztonsagi_leallas";
            }
            /* A megjegyzés sima szöveg: a saját, eltárolt címzettnevet írjuk
               be, nem a csak megjelenítéshez javított változatot. */
            piacMezoErtek(megjegyzes, String(f.nev || ""));
            piacMezoErtek(dbmezo, mennyiseg);

            /* Keszlet modban a Piac ful adja a darabszamot es a tobbi
               beallitast. A legordulok csak akkor allnak at, ha a kert
               ertek eltér az alapertelmezestol, igy a szokasos eset
               egyetlen felesleges lepest sem csinal. */
            /* AZ IDOTARTAM ES A CELKOZONSEG KOZOS. Korabban csak a Piac fulrol
               inditott feladas allitotta oket, a fooldali gomb nem, ezert
               ugyanaz a muvelet mas eredmenyt adott attol fuggoen, honnan
               inditottad (1 nap es Vilag, szemben a 7 nappal). Most mindketto
               a beall.piacNapok es a beall.piacCel erteket hasznalja. */
            {
                const napok = Math.max(1, Math.min(7,
                    Math.floor(Number(keszletMod ? f.piacraNapok : beall.piacNapok) || 7)));
                if (napok !== 1) {
                    await new Promise(resolve => {
                        piacLegorduloAllit("market_days", [napok + " nap"], () => resolve());
                    });
                }

                const kulcs = String((keszletMod ? f.piacraCel : beall.piacCel) || "vilag");
                const cel = PIAC_CELOK.find(c => c.kulcs === kulcs);
                if (cel && cel.kulcs !== "vilag") {
                    await new Promise(resolve => {
                        piacLegorduloAllit("market_rights", [cel.minta], () => resolve());
                    });
                }
            }

            if (keszletMod) {
                /* Kulon megadott legkisebb licit. Ha nincs, a lenti kozos ag
                   dont: ugyanazon az aron kint a licit ures marad. */
                if (Number(f.piacraLicit) > 0 && licit && piacMezoBiztosE(keret, licit)) {
                    piacMezoErtek(licit, Math.round(Number(f.piacraLicit) * mennyiseg));
                }

                const aukciok = Math.max(1, Math.floor(Number(f.piacraAukciok) || 1));
                if (aukciok > 1) {
                    const amezo = piacMezo(keret, ["arveresek"]);
                    if (amezo && piacMezoBiztosE(keret, amezo)) piacMezoErtek(amezo, aukciok);
                }

            }
            /* A kliens egyes változatai csak a mennyiség után írják ki az
               egységárat az aukciós ablakba. */
            await new Promise(resolve => setTimeout(resolve, 80));
            const egysegar = piacMinimumAr(f.id, keret, targyNev(f.id));
            if (!(egysegar > 0)) throw "piac_nincs_ar";
            f.piacraMinimumAr = egysegar;
            const beallitottEgysegar = piacBeallitottAr(f, egysegar);
            if (!(beallitottEgysegar > 0)) throw "piac_nincs_ar";
            if (beallitottEgysegar < egysegar) throw "piac_ar_min";
            if (!(Number(f.piacraEgysegar) > 0)) f.piacraEgysegar = egysegar;
            const azonnali = Math.round(mennyiseg * beallitottEgysegar);
            piacMezoErtek(vetelar, azonnali);

            /* Minimumáras feladásnál a játék szerint nem kell licitet adni.
               Átírt, magasabb egységárnál a licit a játék minimuma × darab,
               az azonnali vételár pedig a feladatban megadott ár × darab. */
            const egysegarLicit = beallitottEgysegar > egysegar
                ? Math.round(mennyiseg * egysegar) : 0;
            if (licit) piacMezoErtek(licit, egysegarLicit > 0 ? egysegarLicit : "");

            /* Mielőtt az Igen gombhoz érünk, visszaolvassuk a három mezőt.
               Ez védi ki azt a hibát, amikor egy nyitott kereső vagy chat
               véletlenül megkapná az aukciós értéket. */
            const helyesMegjegyzes = String(megjegyzes.value || "") === String(f.nev || "");
            const helyesMennyiseg = piacArSzam(dbmezo.value) === mennyiseg;
            const helyesVetelar = piacArSzam(vetelar.value) === azonnali;
            const helyesLicit = !licit || (egysegarLicit > 0
                ? piacArSzam(licit.value) === egysegarLicit
                : String(licit.value || "").trim() === "");
            if (!piacAukcioKeretBiztosE(keret) || !helyesMegjegyzes || !helyesMennyiseg ||
                !helyesVetelar || !helyesLicit) throw "piac_biztonsagi_leallas";

            /* KI állapotban a folyamat itt szándékosan megáll. Az aukciós
               ablak és minden mező készen van, de a végső játékbeli
               megerősítést a felhasználó végzi el. */
            if (!beall.automataPiac) {
                ment();
                allapot("piac_elokeszitve");
                return;
            }

            const igen = piacIgenGomb(keret);
            if (!igen) throw "piac_nincs_igen";
            if (!piacKattint(igen)) throw "piac_nincs_igen";

            const bezart = await piacVarakozik(() => !piacAukcioKeret(), 2800);
            if (!bezart && !piacSikerSzoveg()) throw "piac_nem_igazolt";

            if (!keszletMod) {
                f.piacraKint = true;
                f.piacraMennyiseg = mennyiseg;
                f.piacraAr = azonnali;
                f.piacraMikor = ma();
                ment();
            }
            rajzol();
            allapot("piac_siker");
        } catch (hiba) {
            allapot(typeof hiba === "string" ? hiba : "piac_nem_igazolt");
        } finally {
            /* Barhogy ert veget a folyamat, a jatek inventory-kattintasat
               visszaadjuk, mielott a gombrol levennenk a varakozo jelzest. */
            piacKattintasVissza();
            piacFut = false;
            if (elem) elem.classList.remove("var");
        }
    }

    function munkaNyit(id, elem) {
        if (munkaFut) return;
        const f = munkaForras(id);
        if (!f) return;

        munkaFut = true;
        if (elem) elem.classList.add("var");
        const veg = hiba => {
            munkaFut = false;
            if (elem) elem.classList.remove("var");
            if (hiba) allapot(hiba);
        };

        terkepet(ok => {
            if (!ok) { veg("terkep_hiba"); return; }
            const cel = legkozelebbi(f.sorok);
            if (!cel) { veg("nincs_pont"); return; }
            const G = jatek();
            let sikerult = false;
            /* A gomb megnyomása előre emeli a saját panelünket. A munkaablak
               viszont a játék ablakkezelőjében nyílik meg, ezért előtte
               visszaengedjük a beszerzőt alaprétegre, hogy az új ablak
               ténylegesen elé kerüljön. */
            hatra();
            try {
                if (G.JobWindow && typeof G.JobWindow.open === "function") {
                    G.JobWindow.open(cel.munka.id, cel.x, cel.y);
                    sikerult = true;
                } else if (G.GameMap && G.GameMap.JobHandler &&
                           typeof G.GameMap.JobHandler.openJob === "function") {
                    G.GameMap.JobHandler.openJob(cel.munka.id, { x: cel.x, y: cel.y });
                    sikerult = true;
                }
            } catch (e) { sikerult = false; }
            if (sikerult) {
                /* Egyes kliensverziók a munkaablak rétegét csak a következő
                   körben állítják be; ekkor is maradjon mögötte a panel. */
                setTimeout(hatra, 0);
            }
            veg(sikerult ? null : "nincs_ablak");
        });
    }

    /* -----------------------------------------------------------------
       TETELLISTA es NEV-FELOLDAS a keresohoz.
       ----------------------------------------------------------------- */
    /* A recept kimenetei releváns termékek, de nem minden ilyen tárgy kerül
       be a Bag-be úgy, hogy az ItemManagerből egyértelműen látszódjon. Ezért
       a Crafting.recipes mellett a táskában lévő recept-tárgyakat is nézzük;
       a Bag többi eleme viszont nem bővíti a keresőt. */
    function receptTermekIds() {
        const ids = new Set();
        const addRecept = r => {
            if (r && r.craftitem != null) ids.add(String(r.craftitem));
        };
        try {
            const C = jatek().Crafting;
            if (C && C.recipes) Object.values(C.recipes).forEach(addRecept);
        } catch (e) { /* nincs betöltött receptlista */ }
        try {
            const bag = jatek().Bag;
            let receptIds = null;
            if (bag && typeof bag.getItemsIdsByType === "function") {
                const t = bag.getItemsIdsByType("recipe");
                if (Array.isArray(t)) receptIds = t;
            }
            if (!receptIds) receptIds = Object.keys((bag && bag.items_by_id) || {});
            receptIds.forEach(k => {
                const it = itemObj(k);
                if (it && String(it.type || "") === "recipe" && it.craftitem != null) addRecept(it);
            });
        } catch (e) { /* nincs */ }
        return ids;
    }

    function targyLista() {
        const ki = new Map();
        const add = id => {
            const s = String(id);
            if (ki.has(s)) return;
            const n = targyNev(s);
            if (n) ki.set(s, n);
        };
        try {
            const JM = jatek().JobsModel;
            const B = JM && JM.Beans;
            if (B) Object.keys(B).forEach(jid => {
                const y = B[jid] && B[jid].basis && B[jid].basis.long && B[jid].basis.long.yields;
                (y || []).forEach(t => { if (t && t.itemid != null) add(t.itemid); });
            });
        } catch (e) { /* nincs */ }
        receptTermekIds().forEach(add);
        Object.keys(MUNKA_TABLA).forEach(add);
        return [...ki.entries()]
            .map(([i, n]) => ({ i, n }))
            .sort((a, b) => a.n.localeCompare(b.n, "hu"));
    }
    const tetelNevek = () => targyLista().map(x => x.n);
    const beszerzoNevek = () => [...new Set(beszerzok.map(x => String(x.nev)))]
        .filter(Boolean).sort((a, b) => a.localeCompare(b, "hu"));

    /* Beirt nevbol azonosito. Elobb pontos egyezes, aztan kezdodok; 6-8
       szamjegyu beiras kozvetlen id. Ekezetre erzeketlen (a panel logikaja). */
    function nevbolId(nev) {
        const s = String(nev || "").trim();
        if (!s) return "";
        if (/^\d{6,8}$/.test(s)) return s;
        const beirt = ekNelkul(s);
        const lista = targyLista();
        const pontos = lista.find(x => ekNelkul(x.n) === beirt);
        if (pontos) return pontos.i;
        const kezd = lista.find(x => ekNelkul(x.n).startsWith(beirt));
        return kezd ? kezd.i : "";
    }

    /* -----------------------------------------------------------------
       AUTOCOMPLETE (a panel javasloElem-je). Kezdodok elol, max 6,
       2 karaktertol. Nyilak leptetnek, Enter valaszt es tovabblep,
       Tab a legfelsot valasztja es a bongeszo lep tovabb, Esc zar.
       ----------------------------------------------------------------- */
    function javasloElem(be, li, forras, utana, ikonok) {
        if (!be || !li || be.dataset.kotve) return;
        be.dataset.kotve = "1";
        let akt = -1;

        const zar = () => { li.hidden = true; li.innerHTML = ""; akt = -1; };
        const valaszt = sz => {
            be.value = sz;
            zar();
            if (utana) setTimeout(() => { try { utana.focus(); utana.select(); } catch (e) { /* nem baj */ } }, 0);
            else be.focus();
        };
        const nyit = () => {
            const q = ekNelkul((be.value || "").trim());
            if (q.length < 2) { zar(); return; }
            const nevek = forras();
            const ikonId = ikonok ? new Map(targyLista().map(x => [x.n, x.i])) : null;
            const mind = nevek.filter(x => ekNelkul(x).includes(q));
            const elol = mind.filter(x => ekNelkul(x).startsWith(q));
            const tal = elol.concat(mind.filter(x => !ekNelkul(x).startsWith(q))).slice(0, 6);
            if (!tal.length) { zar(); return; }
            li.innerHTML = tal.map((x, i) => {
                const id = ikonId && ikonId.get(x);
                const kep = id != null ? targyIkon(id) : null;
                const ikon = ikonok
                    ? (kep ? `<img class="jikon" src="${esc(kep)}" alt="">` : `<span class="jikon ures" aria-hidden="true"></span>`)
                    : "";
                return `<li data-jav="${esc(x)}"${i === 0 ? ' class="akt"' : ""}>${ikon}<span class="jnev">${esc(kijelzoSzoveg(x))}</span></li>`;
            }).join("");
            akt = 0;
            li.hidden = false;
        };

        be.addEventListener("input", nyit);
        be.addEventListener("blur", () => setTimeout(zar, 120));
        be.addEventListener("keydown", e => {
            if (li.hidden) return;
            const sorok = [...li.querySelectorAll("[data-jav]")];
            if (!sorok.length) return;
            if (e.key === "ArrowDown" || e.key === "ArrowUp") {
                e.preventDefault();
                akt = (akt + (e.key === "ArrowDown" ? 1 : sorok.length - 1)) % sorok.length;
                sorok.forEach((x, i) => x.classList.toggle("akt", i === akt));
            } else if (e.key === "Enter") {
                e.preventDefault();
                valaszt(sorok[Math.max(0, akt)].dataset.jav);
            } else if (e.key === "Tab") {
                /* a legfelsot bevalasztjuk, es hagyjuk a bongeszot tovabblepni */
                be.value = sorok[Math.max(0, akt)].dataset.jav;
                zar();
            } else if (e.key === "Escape") {
                e.preventDefault();
                e.stopPropagation();
                zar();
            }
        });
        li.addEventListener("mousedown", e => {
            const x = e.target.closest("[data-jav]");
            if (x) { e.preventDefault(); valaszt(x.dataset.jav); }
        });
    }

    /* -----------------------------------------------------------------
       SZAMITASOK.
       ----------------------------------------------------------------- */
    /* Azonos alapanyag több feladatnál ugyanabból a közös táskakészletből
       fogy. A lista sorrendje az elszámolási sorrend: az előrébb levő sor
       kapja meg először a közös készletet. Így ugyanaz a darab nem számolódik
       bele minden címzettnél külön-külön. */
    function keszletElosztas() {
        const csoportok = new Map();
        beszerzok.forEach(f => {
            const id = String(f.id);
            if (!csoportok.has(id)) {
                csoportok.set(id, { keszlet: keszlet(id), tetelek: [] });
            }
            csoportok.get(id).tetelek.push(f);
        });

        const eredmeny = new Map();
        csoportok.forEach(g => {
            const ismert = g.keszlet != null;
            let marad = ismert ? Math.max(0, Number(g.keszlet) || 0) : null;
            g.tetelek.forEach(f => {
                /* A piacra már kihelyezett mennyiség nem fogyasztja tovább a
                   jelenlegi táskakészletet. Ha csak részben került ki, a
                   hiányzó részhez viszont továbbra is rendelhetünk táskát. */
                const kint = piacraMennyiseg(f);
                const maradekKell = Math.max(0, f.db - kint);
                const hozzarendelve = ismert ? Math.min(maradekKell, marad) : null;
                if (ismert) marad -= hozzarendelve;
                eredmeny.set(String(f.kulcs), {
                    keszlet: g.keszlet,
                    hozzarendelve,
                    kozos: g.tetelek.length > 1
                });
            });
        });
        return eredmeny;
    }

    function piacraMennyiseg(f) {
        if (!f || !f.piacraKint) return 0;
        return Math.max(0, Math.floor(Number(f.piacraMennyiseg) || 0));
    }

    function sorAdat(f, elosztas) {
        const e = elosztas && elosztas.get(String(f.kulcs));
        const megvan = e ? e.keszlet : keszlet(f.id);
        const felosztva = e ? e.hozzarendelve : (megvan == null ? null : Math.min(f.db, megvan));
        const kint = piacraMennyiseg(f);
        const van = Math.min(f.db, kint + (felosztva == null ? 0 : felosztva));
        const hianyzo = Math.max(0, f.db - van);
        const szazalek = f.db > 0 ? Math.min(100, Math.round(van / f.db * 100)) : 0;
        const piacon = kint >= f.db && f.db > 0;
        const kesz = piacon || (megvan != null && van >= f.db);
        const oi = kesz ? { szoveg: "kesz", orak: null } : oraInfo(f.id, hianyzo);
        const vanMunka = !!munkaForras(f.id);
        return { megvan, van, hianyzo, szazalek, kesz, piacon, kint, oi, vanMunka,
                 kozos: !!(e && e.kozos), valtozott: keszletKiemeltIds.has(String(f.id)) };
    }

    function osszesites(elosztas) {
        const e = elosztas || keszletElosztas();
        let kellSum = 0, vanSum = 0, keszDb = 0, oraSum = 0, hianySum = 0;
        let dolgozniDb = 0, gyartottDb = 0;
        const szemely = new Map();   /* nev -> {kell, van} */
        const kozos = new Map();     /* id -> {id, kell, van, tetelDb} */
        const orakTetel = [];        /* {nev, id, ora, munkazhato} */
        beszerzok.forEach(f => {
            const a = sorAdat(f, e);
            kellSum += f.db;
            vanSum += Math.min(a.van, f.db);
            hianySum += a.hianyzo;
            if (a.kesz) keszDb++;
            else if (a.vanMunka) dolgozniDb++;
            else gyartottDb++;
            if (a.oi.orak != null) {
                oraSum += a.oi.orak;
                orakTetel.push({ nev: targyNev(f.id), id: String(f.id), ora: a.oi.orak,
                                 hiany: a.hianyzo, kell: f.db, van: a.van, munkazhato: a.vanMunka });
            }
            const k = String(f.nev || "(nincs nev)");
            if (!szemely.has(k)) szemely.set(k, { kell: 0, van: 0 });
            const s = szemely.get(k); s.kell += f.db; s.van += Math.min(a.van, f.db);
            if (!kozos.has(String(f.id))) kozos.set(String(f.id), { id: String(f.id), kell: 0, van: 0, tetelDb: 0 });
            const z = kozos.get(String(f.id));
            z.kell += f.db; z.van += Math.min(a.van, f.db); z.tetelDb++;
        });
        const szaz = kellSum > 0 ? Math.round(vanSum / kellSum * 100) : 0;
        const szemelyek = [...szemely.entries()].map(([nev, s]) => ({
            nev, van: s.van, kell: s.kell,
            szaz: s.kell > 0 ? Math.round(s.van / s.kell * 100) : 0
        }));
        const kozosAnyagok = [...kozos.values()]
            .filter(x => x.tetelDb > 1)
            .map(x => ({ id: x.id, nev: targyNev(x.id), kell: x.kell, van: x.van,
                         hiany: Math.max(0, x.kell - x.van), szaz: x.kell > 0 ? Math.round(x.van / x.kell * 100) : 0,
                         munkazhato: !!munkaForras(x.id) }))
            .sort((a, b) => b.hiany - a.hiany || b.kell - a.kell);
        orakTetel.sort((a, b) => b.ora - a.ora);
        return { keszDb, ossz: beszerzok.length, szaz, oraSum, hianySum, kellSum, vanSum,
                 dolgozniDb, gyartottDb, szemelyek, orakTetel, kozosAnyagok };
    }

    /* -----------------------------------------------------------------
       FELULET.
       ----------------------------------------------------------------- */
    let host = null, gyoker = null, latszik = false;

    /* 0.5.40: rejtett tömeges felvitel. A Map azért él a DOM-on kívül,
       mert a készletfigyelő újrarajzolhatja a teljes stage-et, miközben a
       felhasználó már beillesztette a listát, de még nem nyomott Entert. */
    const gyorsImportok = new Map();

    /* A launcher karaktere szandekosan szoveges Unicode-jel, nem SVG.
       A variation selector a szines emoji-megjelenitest kikapcsolja. */
    const LAUNCHER_JEL = "\u2692\uFE0E";

    const CSS = `
@import url("https://fonts.googleapis.com/css2?family=Alegreya+Sans:wght@400;500;600;700&family=Rye&display=swap&subset=latin-ext");
:host{ all:initial; }
:host{ position:fixed; top:80px; left:80px; z-index:20; display:block;
  --bg:#f3ebdd; --panel:#fbf6ec; --raised:#ede2cf; --line:#dccdb4;
    --ink:#2b2119; --dim:#6f5a41; --faint:#8b765c;
  --brass:#9a6a11; --green:#3d7a52; --rust:#a83a20;
  --fa:#5a3d1f; --fa2:#3a2713;
  --vart2:#2f6690; --fill:rgba(61,122,82,.13); }
:host([hidden]){ display:none; }

/* A keret most teljesen a script sajatja; nincs mogotte jatekbeli natív
   ablakbor, amely jobb oldali vagy also barna savot hagyhatna. */
:host([data-tema="modern"]){
  --bg:#edf2f5; --panel:#ffffff; --raised:#e5edf2; --line:#ced9e1;
  --ink:#17232e; --dim:#5f7180; --faint:#8796a1;
  --brass:#b87318; --green:#2d8a6a; --rust:#c84e32;
  --fa:#273b49; --fa2:#16232d; --fill:rgba(184,115,24,.14)
}
:host([data-tema="midnight"]){
  --bg:#101a23; --panel:#182733; --raised:#223746; --line:#3b5364;
  --ink:#edf3f6; --dim:#a6b8c4; --faint:#8297a5;
  --brass:#e7aa43; --green:#59c493; --rust:#ff8067;
  --fa:#0c1218; --fa2:#05080c; --fill:rgba(231,170,67,.16)
}

/* NATIV MOD: a jatek adja a keretet es a fejlecet, a sajatunkat elrejtjuk,
   a tartalom kitolti a natv ablakot. */
:host([data-nativ]){ position:static; display:block; width:100%; height:auto; z-index:auto }
/* A host továbbra is a tartalom természetes magasságát adja a méréshez.
   A teljes natív tartót viszont külön háttérréteg tölti ki, így nem marad
   jobb oldali vagy alsó natív pergamensáv. */
:host([data-nativ])::before{ content:""; position:absolute; inset:0; z-index:0;
  pointer-events:none; background:
    radial-gradient(120% 90% at 50% 0%, rgba(255,252,244,.38), rgba(214,196,163,.12) 70%,
      rgba(190,168,130,.18) 100%), #f0e6d1 }
:host([data-nativ]){ --dim:#4a3b28; --faint:#6b5940; --line:#b9a483 }
:host([data-nativ]) .frame{ position:relative; z-index:1; width:100%; max-width:none; height:auto;
  border:0; border-radius:0; box-shadow:none; background:transparent; overflow:visible }
:host([data-nativ]) .frame > *{ position:relative; z-index:1 }
:host([data-nativ]) .bar{ display:none }
:host([data-nativ]) .grip{ display:none }
:host([data-nativ]) .stage{ height:auto; overflow:visible; background:transparent; padding:10px 12px }
*{ box-sizing:border-box; margin:0; padding:0 }
[hidden]{ display:none !important }

.frame{ width:700px; max-width:96vw; display:flex; flex-direction:column;
  background:var(--bg); color:var(--ink); border:2px solid var(--fa); border-radius:11px;
  box-shadow:0 0 0 1px var(--fa2), 0 18px 46px rgba(0,0,0,.48); overflow:hidden;
  font-family:"Segoe UI","Alegreya Sans",system-ui,sans-serif; font-size:15px; line-height:1.4;
  font-weight:500; text-rendering:geometricPrecision; font-synthesis:none;
  -webkit-font-smoothing:auto }
button,input{ font-family:inherit; color:inherit; font-size:inherit }
:focus-visible{ outline:2px solid var(--brass); outline-offset:2px }

.bar{ position:relative; display:flex; align-items:center; gap:10px; padding:5px 6px 5px 12px;
  background:linear-gradient(180deg,#4a3218,#2e1f0f); border-bottom:1px solid var(--fa2);
  box-shadow:inset 0 1px 0 rgba(255,220,150,.16), inset 0 -2px 0 rgba(0,0,0,.22);
  touch-action:none; user-select:none; -webkit-user-select:none;
  cursor:grab; flex:0 0 auto }
.bar::after{ content:""; position:absolute; left:12px; right:12px; bottom:0; height:2px;
  background:linear-gradient(90deg,transparent,var(--brass),transparent); opacity:.75; pointer-events:none }
.bar.fog{ cursor:grabbing }
.mark{ display:inline-flex; align-items:center; gap:7px; font-family:"Rye",Georgia,serif; font-size:13px;
  color:#f0c574; white-space:nowrap; text-shadow:0 1px 0 rgba(0,0,0,.7) }
.mark-jel{ display:grid; place-items:center; width:23px; height:23px; border:1px solid #c8952a;
  border-radius:50%; color:#f0c574; font:700 16px/1 "Segoe UI Symbol","Noto Sans Symbols 2",sans-serif;
  text-shadow:none; box-shadow:inset 0 0 0 2px rgba(44,27,13,.45), 0 0 9px rgba(200,149,42,.22) }
.ver{ font-family:ui-monospace,"Cascadia Mono","Segoe UI Mono",Consolas,monospace; font-size:10px; color:#9c7c4e }
.zar{ margin-left:auto; background:rgba(0,0,0,.24); border:1px solid var(--fa2); border-radius:4px;
  width:26px; height:24px; cursor:pointer; line-height:1; font-size:13px; color:#c3a677; flex:0 0 auto }
.zar:hover{ color:#f0c574; border-color:#8a6330 }
.mini{ background:rgba(0,0,0,.24); border:1px solid var(--fa2); border-radius:4px;
  width:26px; height:24px; cursor:pointer; line-height:1; font-size:17px; color:#c3a677; flex:0 0 auto }
.mini:hover{ color:#f0c574; border-color:#8a6330 }
.ablak-vezerlok{ display:flex; align-items:center; gap:5px; margin-left:auto; flex:0 0 auto }
.ablak-vezerlok .zar{ margin-left:0 }
.live-dot{ width:7px; height:7px; flex:0 0 7px; border-radius:50%;
  background:var(--green); box-shadow:0 0 0 0 rgba(89,196,147,.55);
  animation:live-pulse 2.2s ease-out infinite }
.piac-auto{ display:flex; align-items:center; gap:6px; margin-left:auto; flex:0 0 auto;
  padding:3px 5px 3px 8px; border:1px solid rgba(240,197,116,.32); border-radius:6px;
  background:rgba(0,0,0,.16); color:#d9b77c; font-size:10px; line-height:1.1; white-space:nowrap }
.piac-auto-kapcs{ min-width:34px; height:21px; padding:2px 6px; border:1px solid rgba(240,197,116,.45);
  border-radius:999px; background:rgba(0,0,0,.22); color:#d9b77c; cursor:pointer; font:700 9px/1 "Segoe UI",sans-serif }
.piac-auto-kapcs:hover{ color:#fff0c8; border-color:#d6a94f }
.piac-auto-kapcs.on{ color:#2d1c0e; background:#e1af58; border-color:#f0c574 }

.temak{ display:flex; align-items:center; gap:4px; margin-left:auto }
.piac-auto + .temak{ margin-left:0 }
.piac-auto ~ .ablak-vezerlok{ margin-left:0 }
.tema-gomb{ border:1px solid rgba(240,197,116,.38); background:rgba(0,0,0,.2); color:#d9b77c;
  border-radius:999px; padding:3px 7px; cursor:pointer; font-size:10px; line-height:1.1;
  white-space:nowrap }
.tema-gomb:hover{ color:#fff0c8; border-color:#d6a94f }
.tema-gomb[aria-pressed="true"]{ color:#2d1c0e; background:#e1af58; border-color:#f0c574;
  box-shadow:0 0 0 1px rgba(255,235,176,.35), inset 0 1px 0 rgba(255,255,255,.32) }

:host([data-tema="modern"]) .frame{ border-color:#c8d3da; border-radius:16px;
  box-shadow:0 18px 48px rgba(25,45,60,.22) }
:host([data-tema="midnight"]) .frame{ border-color:#405668; border-radius:16px;
  box-shadow:0 18px 48px rgba(0,0,0,.58) }
:host([data-tema="modern"]) .bar,
:host([data-tema="midnight"]) .bar{ padding:11px 13px 11px 16px; background:var(--panel);
  border-bottom:1px solid var(--line); cursor:grab }
:host([data-tema="modern"]) .mark,
:host([data-tema="midnight"]) .mark{ font-family:"Alegreya Sans","Segoe UI",sans-serif;
  font-size:20px; letter-spacing:-.02em; text-shadow:none; color:var(--ink) }
    :host([data-tema="modern"]) .mark-jel,
    :host([data-tema="midnight"]) .mark-jel{ width:25px; height:25px; border-color:var(--brass); color:var(--brass);
      background:var(--raised); box-shadow:none }
    :host([data-tema="midnight"]) .gomb.munkab{ background:var(--brass); border-color:var(--brass); color:#17212a }
    :host([data-tema="midnight"]) .gomb.munkab:hover:not(:disabled){ background:#f3bd58; border-color:#f3bd58 }
:host([data-tema="modern"]) .ver,
:host([data-tema="midnight"]) .ver{ color:var(--faint) }
:host([data-tema="modern"]) .tema-gomb,
:host([data-tema="midnight"]) .tema-gomb{ color:var(--dim); border-color:var(--line); background:var(--raised) }
:host([data-tema="modern"]) .tema-gomb[aria-pressed="true"],
:host([data-tema="midnight"]) .tema-gomb[aria-pressed="true"]{ color:var(--panel);
  background:var(--brass); border-color:var(--brass); box-shadow:none }
:host([data-tema="modern"]) .piac-auto,
:host([data-tema="midnight"]) .piac-auto{ color:var(--dim); background:var(--raised); border-color:var(--line) }
:host([data-tema="modern"]) .piac-auto-kapcs,
:host([data-tema="midnight"]) .piac-auto-kapcs{ color:var(--dim); background:transparent; border-color:var(--line) }
:host([data-tema="modern"]) .piac-auto-kapcs.on,
:host([data-tema="midnight"]) .piac-auto-kapcs.on{ color:var(--panel); background:var(--brass); border-color:var(--brass) }
:host([data-tema="modern"]) .zar,
:host([data-tema="midnight"]) .zar{ color:var(--dim); border-color:var(--line); background:transparent }
:host([data-tema="modern"]) .zar:hover,
:host([data-tema="midnight"]) .zar:hover{ color:var(--ink); border-color:var(--brass) }
:host([data-tema="modern"]) .mini,
:host([data-tema="midnight"]) .mini{ color:var(--dim); border-color:var(--line); background:transparent }
:host([data-tema="modern"]) .mini:hover,
:host([data-tema="midnight"]) .mini:hover{ color:var(--ink); border-color:var(--brass) }

.stage{ padding:16px; overflow:auto; height:540px; min-height:360px; max-height:calc(100vh - 150px);
  scrollbar-color:var(--brass) var(--raised); scrollbar-width:thin }

.ujform .keszkapcs{ flex:0 0 auto; white-space:nowrap; border:1px solid var(--line);
  background:var(--raised); color:var(--dim); border-radius:5px; padding:6px 10px;
  font:inherit; font-size:12.5px; cursor:pointer }
.ujform .keszkapcs:hover{ border-color:var(--brass); color:var(--ink) }
.ujform .keszkapcs.aktiv{ border-color:var(--green); background:var(--fill); color:var(--green); font-weight:600 }

/* A torlo es a prioritast allito nyilak korabban egybeolvadtak. A torlo
   MINDIG voroses, sajat alattettel; a nyilak semlegesek maradnak. */
.bfej-eszkoz .btorol{ appearance:none; border:1px solid var(--rust); background:rgba(168,58,32,.10);
  color:var(--rust); border-radius:5px; cursor:pointer; font:inherit; font-size:11px;
  line-height:1; padding:3px 7px; margin-left:8px; font-weight:700 }
.bfej-eszkoz .btorol:hover{ background:var(--rust); color:#fff; border-color:var(--rust) }

.piacfej{ display:grid; grid-template-columns:minmax(0,1.4fr) minmax(0,0.9fr) auto; gap:8px; margin:0 0 6px }
.piaccel{ display:flex; border:1px solid var(--line); border-radius:5px; overflow:hidden }
.piaccel .pcel{ appearance:none; border:0; border-left:1px solid var(--line); background:var(--panel);
  color:var(--dim); font:inherit; font-size:12.5px; padding:6px 11px; cursor:pointer; white-space:nowrap }
.piaccel .pcel:first-child{ border-left:0 }
.piaccel .pcel:hover{ color:var(--ink) }
.piaccel .pcel.aktiv{ background:var(--fill); color:var(--green); font-weight:600 }
.piaccel-sug{ margin:0 0 10px }
.piacnapok{ display:flex; align-items:center; gap:4px; margin:0 0 6px; font-size:12px }
.piacnapok .pcimke{ color:var(--dim); margin-right:4px }
.piacnapok .pmagy{ color:var(--faint); margin-left:4px }
.piacnapok .pnap{ appearance:none; border:1px solid var(--line); background:var(--panel);
  color:var(--dim); border-radius:5px; width:26px; padding:3px 0; font:inherit; font-size:12px; cursor:pointer }
.piacnapok .pnap:hover{ border-color:var(--brass); color:var(--ink) }
.piacnapok .pnap.aktiv{ border-color:var(--green); background:var(--fill); color:var(--green); font-weight:600 }
.pkatvalaszto{ margin-left:auto; display:inline-flex; border:1px solid var(--line);
  border-radius:5px; overflow:hidden }
.pkatvalaszto .pkat{ appearance:none; border:0; border-left:1px solid var(--line);
  background:var(--panel); color:var(--dim); font:inherit; font-size:12px;
  padding:3px 10px; cursor:pointer; white-space:nowrap }
.pkatvalaszto .pkat:first-child{ border-left:0 }
.pkatvalaszto .pkat:hover{ color:var(--ink) }
.pkatvalaszto .pkat.aktiv{ background:var(--fill); color:var(--green); font-weight:600 }
.piacnapok{ flex-wrap:wrap }
/* FRISSITESJELZES. Nem az egesz ablak luktet, csak a gomb: a figyelem ott
   marad, ahol a teendo van, es kozben dolgozni is lehet a panelben. */
.bar .frissjel{ display:none; appearance:none; border:1px solid var(--green);
  background:var(--green); color:#fff; border-radius:6px; padding:6px 14px; margin-left:6px;
  font:inherit; font-size:12px; font-weight:700; cursor:pointer; white-space:nowrap;
  animation:frisslukt 1.6s ease-in-out infinite; transform-origin:center }
.bar .frissjel.lathato{ display:inline-block }
.bar .frissjel:hover{ background:#2f6140; animation:none; transform:scale(1.04) }
@keyframes frisslukt{
  0%, 100% { transform:scale(1) }
  50%      { transform:scale(1.06) }
}

/* AUTOMATA PIACRA RAKAS. Ez kockazatos allapot, mert a script magatol nyomja
   meg az Igen gombot, ezert az EGESZ fejlec atszinezodik. Nem mozog, tehat
   nem faraszto, viszont nem lehet elfelejteni. */
/* AUTOMATA PIACRA RAKAS - eros figyelmeztetes.

   Ez kockazatos allapot: a script magatol nyomja meg az Igen gombot az
   aukcios ablakban. Ezert nem eleg egy szinezett fejlec, az egesz panel
   korul FUTO piros keret megy, es a fejlec luktet.

   A temak sajat .bar szabalya erosebb volt az elozo valtozatnal, ezert
   maradt feher a hatter. Innentol :host szintu valasztoval mondjuk ki. */
:host .bar.automata,
:host([data-tema="pult"]) .bar.automata,
:host([data-tema="modern"]) .bar.automata,
:host([data-tema="midnight"]) .bar.automata{
  background:#a8341c }

/* A panel kore vastag, luktetó voros derenges. Korabban csikos "futo keret"
   volt, de az olcso hatast keltett; az elso luktetó valtozat viszont tul
   vekony es halvany volt, ezert a keret vastagabb es a feny erosebb. */
:host .frame.automata{
  animation:autoDereng 1.7s ease-in-out infinite }

@keyframes autoDereng{
  0%, 100% { box-shadow:0 0 0 5px rgba(168,52,28,.95), 0 0 22px rgba(200,60,30,.55) }
  50%      { box-shadow:0 0 0 9px rgba(212,72,42,.70), 0 0 46px rgba(255,90,50,.75) }
}

/* Voros alapon MINDEN felirat feher, es a csoportok kapnak egy sotet
   alatetet, kulonben a vilagos temak sajat szinei belevesznek. */
:host .bar.automata .mark, :host .bar.automata .mark span, :host .bar.automata .mark-jel,
:host .bar.automata .ver, :host .bar.automata .piac-auto > span,
:host .bar.automata .tema-gomb{ color:#fff }
:host .bar.automata .ver{ opacity:.8 }
:host .bar.automata .piac-auto{ background:rgba(0,0,0,.22); border-radius:6px; padding:2px 4px 2px 9px }
:host .bar.automata .tema-gomb{ border-color:rgba(255,255,255,.5); background:transparent }
:host .bar.automata .tema-gomb[aria-pressed="true"]{ background:rgba(255,255,255,.25); font-weight:700 }
:host .bar.automata .piac-auto-kapcs.on{ background:#fff; color:#a8341c;
  border-color:#fff; font-weight:800 }
:host .bar.automata .frissjel{ border-color:#fff }

.piacsor .preszlet{ grid-column:1 / -1; margin:8px 0 2px; padding-top:8px;
  border-top:1px dashed var(--line) }
.preszlet .psor, .preszlet .plicit{ display:flex; align-items:center; gap:9px; font-size:12px }
.preszlet .plicit{ margin-top:8px; padding:6px 9px; border:1px solid var(--line);
  border-radius:5px; cursor:pointer }
.preszlet .plicit.aktiv{ border-color:var(--brass); background:rgba(154,106,17,.08) }
.preszlet .pcimke{ color:var(--dim); flex:0 0 auto; white-space:nowrap }

/* A panel altalanos mezoszabalya teljes szelesseget adna, ezert itt
   MINDEN mezo meretet kimondunk. A jelolonegyzet emiatt nyult szet. */
.preszlet .paukcio, .preszlet .plicitar{
  flex:0 0 62px; width:62px; box-sizing:border-box; text-align:right;
  font:inherit; font-size:12px; padding:4px 6px; border:1px solid var(--line);
  border-radius:5px; background:var(--panel); color:var(--ink); margin:0 }
.preszlet .plicitbe{ flex:0 0 14px; width:14px; height:14px; margin:0; padding:0 }
.preszlet .paukcio.atirt, .preszlet .plicit.aktiv .plicitar{ border-color:var(--brass) }
.preszlet .pmagy{ color:var(--faint); flex:1 1 auto; white-space:nowrap;
  overflow:hidden; text-overflow:ellipsis }
.preszlet .possz{ flex:0 0 auto; color:var(--dim); white-space:nowrap }
.preszlet .pjel{ flex:0 0 auto; color:var(--rust); font-weight:700 }

.parnullaz{ appearance:none; width:100%; border:1px solid var(--line); background:var(--raised);
  color:var(--dim); border-radius:5px; padding:3px 0; font:inherit; font-size:11px; cursor:pointer }
.parnullaz:hover{ border-color:var(--brass); color:var(--ink) }
.parnullaz.elter{ border-color:var(--rust); color:var(--rust); background:rgba(168,58,32,.10) }
.piacmezo{ position:relative }
.piacmezo input{ width:100%; box-sizing:border-box; font:inherit; font-size:13.5px;
  border:1px solid var(--brass); border-radius:5px; padding:6px 26px 6px 9px;
  background:var(--panel); color:var(--ink) }
.piacmezo .torlo{ position:absolute; right:4px; top:50%; transform:translateY(-50%);
  appearance:none; border:0; background:transparent; color:var(--faint); cursor:pointer;
  font:inherit; font-size:14px; line-height:1; padding:2px 5px; border-radius:4px }
.piacmezo .torlo:hover{ color:var(--ink); background:var(--raised) }
.piacfejlec, .piacsor{ display:grid; align-items:center; gap:8px;
  grid-template-columns:34px minmax(0,1fr) 52px 66px 86px 84px 74px }
.piacsor .parwrap{ position:relative }
.piacsor .parjel{ position:absolute; right:-11px; top:50%; transform:translateY(-50%);
  color:var(--rust); font-weight:700; font-size:13px; line-height:1 }
.piacfejlec{ padding:0 10px 6px; font-size:11px; color:var(--faint); text-transform:none }
.parnullaz{ letter-spacing:.02em }
.piacfejlec .jobb, .piacsor .jobb{ text-align:right }
/* Csak a LISTA gorgul, a keresok, a napok es az oszlopnevek a helyukon
   maradnak. A magassagot futasidoben szamoljuk a panel meretebol. */
.piaclista{ border:1px solid var(--line); border-radius:8px; background:var(--panel);
  overflow-y:auto; overflow-x:hidden }
.piacsor{ padding:6px 10px; border-bottom:1px solid var(--line) }
.piacsor:last-child{ border-bottom:0 }
.piacsor img{ width:30px; height:30px; object-fit:contain; display:block }
.piacsor .pnev{ font-size:13px; color:var(--ink); overflow:hidden; text-overflow:ellipsis; white-space:nowrap }
.piacsor .pkeszlet{ font-size:12px; color:var(--dim) }
/* A szamok kijelolesekor a bongeszo athuzhatova tenne oket, es a szam
   atcsuszna a szomszedos mezobe. Ezert a huzast kikapcsoljuk. */
.piacsor input, .preszlet input{ -webkit-user-drag:none; user-drag:none }
.piacsor input{ width:100%; box-sizing:border-box; text-align:right; font:inherit; font-size:12px;
  padding:4px 6px; border:1px solid var(--line); border-radius:6px; background:var(--panel); color:var(--ink) }
.piacsor input.atirt{ border-color:var(--brass) }
.piacsor .pvetel{ font-size:13px; font-weight:600; color:var(--ink) }
.piacsor .pgomb{ appearance:none; font:inherit; font-size:12px; padding:5px 0; width:100%;
  border:1px solid var(--line); border-radius:6px; background:var(--raised); color:var(--ink); cursor:pointer }
.piacsor .pgomb:hover{ border-color:var(--brass) }
.piacsor.tiltott{ opacity:.55 }
.piacsor.valasztott{ background:var(--raised) }
.piacsor[data-pid]{ cursor:pointer }
.piacsor .ptiltva{ grid-column:span 4; text-align:right; font-size:11px; color:var(--faint) }
.piacures{ padding:14px 10px; font-size:13px; color:var(--dim) }

.fulsor{ display:flex; gap:0; margin:0 0 12px; border-bottom:1px solid var(--line) }
.fulsor .ful{ appearance:none; background:transparent; border:0; border-bottom:2px solid transparent;
  padding:7px 14px; font:inherit; font-size:13px; color:var(--dim); cursor:pointer; border-radius:0 }
.fulsor .ful:hover{ color:var(--ink) }
.fulsor .ful.aktiv{ color:var(--ink); font-weight:600; border-bottom-color:var(--brass) }

.ujform{ display:grid; grid-template-columns:minmax(0,1.15fr) minmax(0,1fr) 74px auto auto;
  gap:8px; align-items:center; margin-bottom:14px }
.ujform .jwrap{ position:relative; min-width:0 }
.ujform input{ width:100%; border:1px solid var(--brass); background:var(--panel); color:var(--ink);
  border-radius:5px; padding:6px 9px; font-size:13.5px }
.ujform .qmezo{ flex:0 0 74px; width:74px; text-align:right }
.ujform .add{ flex:0 0 auto; border:1px solid var(--brass); background:var(--brass); color:#fff;
  border-radius:5px; padding:6px 14px; font-size:13.5px; cursor:pointer; font-weight:600; white-space:nowrap }
.ujform .add:hover{ background:#7d560d }

.jwrap{ position:relative }
.jlista{ position:absolute; top:100%; left:0; right:0; z-index:5; margin-top:2px; list-style:none;
  background:var(--panel); border:1px solid var(--line); border-radius:5px; max-height:190px;
  overflow:auto; box-shadow:0 6px 16px rgba(0,0,0,.2) }
.jlista li{ display:flex; align-items:center; gap:8px; min-height:31px; padding:5px 9px; cursor:pointer; font-size:13.5px }
.jlista .jikon{ width:20px; height:20px; flex:0 0 20px; object-fit:contain; border:1px solid var(--line); border-radius:3px; background:var(--raised) }
.jlista .jikon.ures{ border-color:transparent; background:transparent }
.jlista .jnev{ min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap }
.jlista li:hover,.jlista li.akt{ background:var(--fill) }

/* OSSZESITO */
.dash{ border:1px solid var(--line); border-radius:8px; background:var(--panel);
  padding:12px 13px; margin-bottom:14px; box-shadow:inset 0 1px 0 #fff9ee }
:host([data-tema="modern"]) .dash,
:host([data-tema="midnight"]) .dash{ border-radius:12px; box-shadow:none }
.dash-fej{ display:flex; align-items:center; gap:10px; width:100%; background:none; border:0;
  cursor:pointer; text-align:left; padding:0; color:inherit; font:inherit }
.dash-fej .cim{ font-family:"Rye",Georgia,serif; font-size:14px; color:var(--rust) }
:host([data-tema="modern"]) .dash-fej .cim,
:host([data-tema="midnight"]) .dash-fej .cim{ font-family:"Alegreya Sans","Segoe UI",sans-serif;
  font-size:17px; font-weight:700; color:var(--ink) }
.dash-fej .osszefog{ margin-left:auto; font-family:"Segoe UI",system-ui,sans-serif; font-size:12px; font-weight:600;
  color:var(--dim); font-variant-numeric:tabular-nums }
.dash-fej .osszefog b{ color:var(--brass) }
.dash-fej .chev{ width:16px; text-align:center; color:var(--dim); transition:transform .15s }
.dash.zart .chev{ transform:rotate(-90deg) }
.dash.zart .dash-body{ display:none }
.dash-body{ margin-top:12px }
.hero{ display:grid; grid-template-columns:minmax(0,1.12fr) minmax(220px,1fr); gap:14px; align-items:stretch }
.hero-main{ display:flex; flex-direction:column; justify-content:center; min-width:0; padding:12px;
  border:1px solid var(--line); border-radius:9px;
  background:linear-gradient(135deg,rgba(255,255,255,.2),rgba(255,255,255,0));
  box-shadow:inset 0 1px 0 rgba(255,255,255,.22) }
.hero-line{ display:flex; align-items:baseline; justify-content:space-between; gap:12px }
.hero-kicker{ color:var(--dim); font-family:"Segoe UI",system-ui,sans-serif; font-size:10px; font-weight:700;
  letter-spacing:.1em; text-transform:uppercase }
.hero-percent{ color:var(--brass); font-family:ui-monospace,"Cascadia Mono","Segoe UI Mono",Consolas,monospace; font-size:32px; font-weight:700;
  line-height:1 }
.hero-track{ height:15px; overflow:hidden; margin-top:12px; border:1px solid var(--line);
  border-radius:8px; background:var(--raised) }
.hero-track i{ display:block; height:100%; border-radius:7px;
  background:linear-gradient(90deg,#d69d2d,var(--brass));
  transform-origin:left center; animation:fill-in .55s cubic-bezier(.22,.8,.3,1) both }
.hero-subline{ display:flex; justify-content:space-between; gap:8px; margin-top:8px; color:var(--dim);
  font-family:"Segoe UI",system-ui,sans-serif; font-size:11.5px; font-weight:600; font-variant-numeric:tabular-nums }
.hero-subline span:last-child{ text-align:right }
.medal{ display:none }
.kpik{ display:grid; grid-template-columns:1fr 1fr; gap:7px }
.kpi{ background:var(--raised); border:1px solid var(--line); border-radius:6px; padding:8px 9px;
  box-shadow:inset 0 1px 0 rgba(255,255,255,.18) }
:host([data-tema="modern"]) .kpi,
:host([data-tema="midnight"]) .kpi{ border-radius:9px }
.kpi .k{ font-family:"Segoe UI",system-ui,sans-serif; font-size:10px; font-weight:700; letter-spacing:.06em; color:var(--dim) }
.kpi .v{ font-family:ui-monospace,"Cascadia Mono","Segoe UI Mono",Consolas,monospace; font-size:17px; font-weight:700; color:var(--ink); margin-top:2px }
.kpi .v small{ font-size:11px; font-weight:400; color:var(--faint) }
.kpi.ora .v{ color:var(--brass) }
.kpi.hi .v{ color:var(--rust) }
.blokk-cim{ font-family:"Segoe UI",system-ui,sans-serif; font-size:10px; font-weight:700; letter-spacing:.1em; text-transform:uppercase;
  color:var(--dim); margin:13px 0 6px }
.psor{ display:grid; grid-template-columns:88px 1fr 40px; gap:8px; align-items:center; margin-bottom:5px;
  padding:2px 3px; border-radius:4px; cursor:pointer }
.psor:hover{ background:var(--fill) }
.psor:focus-visible{ outline:2px solid var(--brass); outline-offset:2px }
.psor .nev{ font-family:Georgia,serif; font-weight:600; font-size:13px; color:var(--rust); overflow:hidden; text-overflow:ellipsis; white-space:nowrap }
.psor .track{ height:11px; background:var(--raised); border-radius:6px; overflow:hidden; border:1px solid var(--line) }
.psor .track i{ display:block; height:100%; background:linear-gradient(180deg,#c8952a,#9a6a11);
  transform-origin:left center; animation:fill-in .5s cubic-bezier(.22,.8,.3,1) both }
.psor .track i.kesz{ background:linear-gradient(180deg,#5aa576,#3d7a52) }
.psor .pc{ font-family:ui-monospace,"Cascadia Mono","Segoe UI Mono",Consolas,monospace; font-size:11.5px; text-align:right; color:var(--ink) }
.psor .pc.kesz{ color:var(--green); font-weight:700 }
.hsor{ display:grid; grid-template-columns:120px 1fr 38px; gap:8px; align-items:center; margin-bottom:4px }
.hsor[data-munka]{ cursor:pointer }
.hsor[data-munka]:hover,.hsor[data-munka]:focus-visible{ background:var(--fill) }
.hsor-term{ display:flex; align-items:center; gap:5px; min-width:0; color:var(--ink) }
.hsor-term .hikon{ width:18px; height:18px; flex:0 0 18px; object-fit:contain; border-radius:3px }
.hsor-term i.hikon{ display:block }
.hsor-term .nev{ min-width:0; font-size:12px; color:var(--ink); overflow:hidden; text-overflow:ellipsis; white-space:nowrap }
.hsor-term.munkara-link{ cursor:pointer; color:var(--brass); font-weight:600 }
.hsor-term.munkara-link .nev{ color:var(--brass); font-weight:600 }
.hsor-term.munkara-link:hover .nev{ text-decoration:underline; color:var(--rust) }
.hsor-term.var,.ksor.var{ opacity:.6; cursor:progress }
.hsor .track{ height:9px; background:var(--raised); border-radius:5px; overflow:hidden; border:1px solid var(--line) }
.hsor .track i{ display:block; height:100%; background:repeating-linear-gradient(45deg,#a8791f,#a8791f 5px,#946711 5px,#946711 10px);
  transform-origin:left center; animation:fill-in .5s cubic-bezier(.22,.8,.3,1) both }
.hsor .ora{ font-family:ui-monospace,"Cascadia Mono","Segoe UI Mono",Consolas,monospace; font-size:11.5px; text-align:right; color:var(--brass); font-weight:700 }
.ksor{ display:grid; grid-template-columns:120px 1fr 76px; gap:8px; align-items:center; margin-bottom:5px;
  width:100%; padding:2px 3px; border:0; border-radius:4px; background:transparent; text-align:left; font:inherit }
.ksor.munkara-link{ cursor:pointer }
.ksor.munkara-link:hover{ background:var(--fill) }
.ksor.munkara-link:hover .knev{ color:var(--brass) }
.ksor .knev{ display:flex; align-items:center; gap:5px; min-width:0; color:var(--ink); font-size:12px }
.ksor .knev img{ width:18px; height:18px; flex:0 0 18px; object-fit:contain; border-radius:3px }
.ksor .knev i{ width:18px; height:18px; flex:0 0 18px; display:block }
.ksor .knev span{ overflow:hidden; text-overflow:ellipsis; white-space:nowrap }
.ksor .track{ height:9px; background:var(--raised); border-radius:5px; overflow:hidden; border:1px solid var(--line) }
.ksor .track i{ display:block; height:100%; border-radius:4px; background:linear-gradient(90deg,#d69d2d,var(--brass));
  transform-origin:left center; animation:fill-in .5s cubic-bezier(.22,.8,.3,1) both }
.ksor .track i.kesz{ background:linear-gradient(90deg,#5aa576,#3d7a52) }
.ksor .kdb{ font-family:ui-monospace,"Cascadia Mono","Segoe UI Mono",Consolas,monospace; font-size:11px;
  text-align:right; color:var(--dim); font-variant-numeric:tabular-nums; white-space:nowrap }
.ksor .kdb.hiany{ color:var(--rust); font-weight:700 }
.statusz{ margin-top:13px }
.statusz .sav{ display:flex; height:15px; border-radius:8px; overflow:hidden; border:1px solid var(--line) }
.statusz .sav .kesz{ background:var(--green); transform-origin:left center; animation:fill-in .5s cubic-bezier(.22,.8,.3,1) both }
.statusz .sav .dolg{ background:var(--brass); transform-origin:left center; animation:fill-in .5s cubic-bezier(.22,.8,.3,1) .04s both }
.statusz .sav .gyar{ background:#b7a07f; transform-origin:left center; animation:fill-in .5s cubic-bezier(.22,.8,.3,1) .08s both }
.statusz .jel{ display:flex; gap:14px; margin-top:6px; font-family:"Segoe UI",system-ui,sans-serif; font-size:11px;
  font-weight:600; color:var(--dim); flex-wrap:wrap }
.statusz .jel span{ display:inline-flex; align-items:center; gap:5px }
.statusz .jel i{ width:10px; height:10px; border-radius:2px; display:inline-block }

.bcsop{ margin-bottom:10px }
.bfej{ display:flex; align-items:center; gap:8px; padding:8px 0 5px; border-bottom:1px solid var(--line) }
.bfej b{ font-size:15px; color:var(--rust); font-family:Georgia,serif }
.prior-sorszam{ flex:0 0 auto; color:var(--faint); font-family:ui-monospace,"Cascadia Mono","Segoe UI Mono",Consolas,monospace;
  font-size:10px; font-weight:700; letter-spacing:.03em }
.bnevSzerk{ min-width:0; max-width:46%; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;
  border:0; padding:0; margin:0; background:transparent; color:var(--rust); font:600 15px Georgia,serif;
  cursor:text; text-align:left }
.bnevSzerk:hover{ color:var(--brass); text-decoration:underline; text-decoration-style:dotted; text-underline-offset:3px }
.bnevEdit{ min-width:70px; max-width:46%; border:1px solid var(--brass); border-radius:4px; background:var(--panel);
  color:var(--ink); font:600 15px Georgia,serif; padding:2px 5px; outline:none }
.bnevEdit:focus{ box-shadow:0 0 0 2px rgba(200,149,42,.22) }
.bcsuk{ width:20px; height:20px; padding:0; border:1px solid var(--line); border-radius:4px;
  background:transparent; color:var(--dim); cursor:pointer; font-size:14px; line-height:17px }
.bcsuk:hover{ color:var(--brass); border-color:var(--brass); background:var(--fill) }
.bplusz{ width:20px; height:20px; line-height:18px; text-align:center; border:1px solid var(--brass);
  background:transparent; color:var(--brass); border-radius:4px; cursor:pointer; font-size:14px; padding:0 }
.bplusz:hover{ background:var(--fill) }
.bfej-eszkoz{ margin-left:auto; display:flex; align-items:center; gap:4px }
.bmozgat{ width:20px; height:20px; padding:0; border:1px solid var(--line); border-radius:4px;
  background:transparent; color:var(--dim); cursor:pointer; font-size:12px; line-height:17px }
.bmozgat:hover:not(:disabled){ color:var(--brass); border-color:var(--brass); background:var(--fill) }
.bmozgat:disabled{ opacity:.28; cursor:default }
.bfej .datum{ margin-left:4px; font-family:ui-monospace,"Cascadia Mono","Segoe UI Mono",Consolas,monospace; font-size:11px; color:var(--faint) }
.bc-tartalom[hidden]{ display:none }
.csoport-eszkozok{ display:flex; align-items:center; justify-content:flex-end; gap:5px; padding:3px 0 1px; color:var(--faint); font-size:10px }
.csoport-eszkozok button{ border:1px solid var(--line); border-radius:4px; background:transparent; color:var(--dim);
  padding:3px 6px; font:inherit; cursor:pointer }
.csoport-eszkozok button:hover{ color:var(--brass); border-color:var(--brass); background:var(--fill) }
.szurobar{ display:flex; align-items:center; flex-wrap:wrap; gap:6px; margin:-4px 0 7px; position:relative; z-index:4 }
.szuro-menu{ position:relative; color:var(--dim); font-size:11px }
.szuro-menu summary{ list-style:none; cursor:pointer; border:1px solid var(--line); border-radius:5px;
  padding:4px 8px; background:var(--panel); color:var(--dim); white-space:nowrap }
.szuro-menu summary::-webkit-details-marker{ display:none }
.szuro-menu summary::after{ content:" ▾"; color:var(--faint) }
.szuro-menu[open] summary{ color:var(--brass); border-color:var(--brass) }
.szuro-panel{ position:absolute; top:calc(100% + 4px); left:0; min-width:190px; max-height:260px; overflow:auto;
  padding:5px; background:var(--panel); border:1px solid var(--line); border-radius:6px;
  box-shadow:0 7px 18px rgba(0,0,0,.25) }
.szuro-panel button{ display:block; width:100%; border:0; border-radius:4px; padding:5px 7px; background:transparent;
  color:var(--ink); cursor:pointer; text-align:left; font:inherit; white-space:nowrap; overflow:hidden; text-overflow:ellipsis }
.szuro-panel button:hover,.szuro-panel button.aktiv{ background:var(--fill); color:var(--brass); font-weight:700 }
.szuro-hiany{ border:1px solid var(--line); border-radius:5px; padding:4px 8px; background:transparent;
  color:var(--dim); cursor:pointer; font:inherit; font-size:11px }
.szuro-hiany:hover,.szuro-hiany.aktiv{ color:var(--rust); border-color:var(--rust); background:rgba(168,58,32,.08); font-weight:700 }

.bsor{ position:relative; display:grid; grid-template-columns:30px 1fr auto auto; align-items:center; gap:10px;
  margin-top:7px; padding:10px 8px 10px 11px; border:1px solid var(--line); border-radius:8px;
  background:rgba(255,255,255,.18); box-shadow:inset 0 1px 0 rgba(255,255,255,.18) }
.bsor::before{ content:""; position:absolute; left:0; top:8px; bottom:8px; width:3px; border-radius:0 3px 3px 0;
  background:var(--brass) }
.bsor.kesz::before{ background:var(--green) }
.bsor.gyartott::before{ background:#b7a07f }
.bsor.keszlet-friss{ animation:keszlet-friss 1.2s ease-out both }
:host([data-tema="modern"]) .bsor,
:host([data-tema="midnight"]) .bsor{ background:var(--panel); box-shadow:0 4px 12px rgba(0,0,0,.08) }
:host([data-tema="midnight"]) .bsor{ box-shadow:inset 0 1px 0 rgba(255,255,255,.06), 0 5px 14px rgba(0,0,0,.18) }
.bsor .kep{ width:30px; height:30px; border-radius:5px; background:var(--raised);
  border:1px solid var(--line); object-fit:contain }
.bsor .nevblokk{ min-width:0 }
.bsor .nev{ font-weight:600; font-size:14.5px }
.bsor .nev.itemArNev{ cursor:help; text-decoration:underline; text-decoration-style:dotted; text-underline-offset:3px }
.bsor .nev.itemArNev:hover,.bsor .nev.itemArNev:focus-visible{ color:var(--brass); outline:none }
.bsor .alsor{ font-size:12px; color:var(--faint); font-family:"Segoe UI",system-ui,sans-serif; font-weight:600;
  font-variant-numeric:tabular-nums; margin:1px 0 6px }
.bsor .alsor .ora{ color:var(--brass); font-weight:700 }
.bsor .alsor .ora.baj{ color:var(--rust) }
.bsor .alsor .ora.kesz{ color:var(--green) }
.csik{ position:relative; height:20px; background:var(--raised); border-radius:5px; overflow:hidden; border:1px solid var(--line) }
.csik i{ position:absolute; left:0; top:0; bottom:0; background:linear-gradient(180deg,#c8952a,#8f6210);
  transform-origin:left center; animation:fill-in .5s cubic-bezier(.22,.8,.3,1) both }
.csik i.kesz{ background:linear-gradient(180deg,#5aa576,#3d7a52) }
.csik .felirat{ position:absolute; inset:0; z-index:2; display:flex; align-items:center; justify-content:space-between;
  padding:0 8px; color:var(--ink); font-family:"Segoe UI",system-ui,sans-serif; font-size:12px; font-weight:700;
  font-variant-numeric:tabular-nums; text-shadow:none; pointer-events:none }
.csik .felirat span{ color:var(--ink); font-weight:700 }
/* A sötét alapfelirat végig látszik; a világos másolat csak a kitöltött
   aranyszakaszra van levágva. Így a jobb oldali szöveg sem úszik rá fehéren
   a világos üres sávra. */
.csik .felirat.vilagos{ z-index:3; color:#fff; clip-path:inset(0 calc(100% - var(--csik-fill, 0%)) 0 0) }
.csik .felirat.vilagos span{ color:#fff; text-shadow:0 1px 1px rgba(0,0,0,.45) }
.bsor .szo{ text-align:right; font-family:ui-monospace,"Cascadia Mono","Segoe UI Mono",Consolas,monospace; font-size:11.5px; color:var(--dim);
  white-space:nowrap; line-height:1.5 }
.bsor .szo b{ color:var(--ink) }
.bsor .szo .hi{ color:var(--rust) }
.bsor .szo .ok{ color:var(--green); font-weight:700 }
.bsor .muv{ display:flex; align-items:flex-start; gap:5px }
.piac-csomag{ display:flex; flex-direction:column; align-items:stretch; gap:4px; min-width:116px }
.piac-csomag .piacb{ width:100% }
.piac-arbox{ padding:4px 6px; border:1px solid var(--line); border-radius:5px; background:rgba(255,255,255,.2) }
.piac-arsor{ display:flex; align-items:center; justify-content:center; gap:3px; color:var(--dim); font-family:ui-monospace,"Cascadia Mono","Segoe UI Mono",Consolas,monospace; font-size:11px }
.piacArMezo{ width:58px; min-width:0; border:1px solid var(--brass); border-radius:4px; padding:2px 4px; background:var(--panel); color:var(--ink); font:inherit; font-weight:700; text-align:right; outline:none }
.piacArMezo:focus{ box-shadow:0 0 0 2px rgba(200,149,42,.22) }

.gomb{ border:1px solid var(--fa); background:var(--fa); color:#f2e4c4; border-radius:6px;
  padding:6px 11px; font-size:12.5px; cursor:pointer; white-space:nowrap }
.gomb:hover:not(:disabled){ background:#6b4a2b }
.gomb.var{ opacity:.6; cursor:progress }
.gomb.gyart{ background:transparent; color:#8a5a24; border:1.5px solid var(--brass); cursor:default }
.gomb.keszpill{ background:var(--green); border-color:var(--green); cursor:default }
.gomb.piacb{ background:var(--brass); border-color:var(--brass); color:#fff8e9 }
.gomb.piacb:hover:not(:disabled){ background:#bd8520; border-color:#bd8520 }
.gomb.piacpill{ background:var(--green); border-color:var(--green); color:#fff }
.bsor.piacon::before{ background:var(--green) }
.torol{ border:0; background:none; color:var(--faint); cursor:pointer; font-size:16px; padding:0 3px; line-height:1 }
    .torol:hover{ color:var(--rust) }

.kellSzerk{ border:0; padding:0; margin:0; background:transparent; color:var(--ink);
  font:inherit; font-weight:700; cursor:text; border-bottom:1px dotted transparent }
.kellSzerk:hover{ color:var(--brass); border-bottom-color:var(--brass) }
.kellEdit{ width:48px; box-sizing:border-box; border:1px solid var(--brass); border-radius:4px;
  background:var(--panel); color:var(--ink); font:inherit; font-weight:700; text-align:right;
  padding:2px 4px; outline:none }
.kellEdit:focus{ box-shadow:0 0 0 2px rgba(200,149,42,.22) }

.bujsor{ display:flex; gap:6px; align-items:center; padding:8px 2px 4px }
.bujsor .jwrap{ flex:1 1 auto }
.bujsor input{ width:100%; border:1px solid var(--brass); background:var(--panel); color:var(--ink);
  border-radius:5px; padding:5px 8px; font-size:13px }
.bujsor .bujDb{ flex:0 0 70px; width:70px; text-align:right }
.bujsor .bujOk{ flex:0 0 auto; border:1px solid var(--brass); background:transparent; color:var(--brass);
  border-radius:5px; padding:5px 11px; font-size:13px; cursor:pointer; white-space:nowrap }
.bujsor .bujOk:hover{ background:var(--fill) }

.ures{ color:var(--faint); font-style:italic; padding:12px 2px }
#allapot{ min-height:16px; margin-top:8px; font-size:12px; color:var(--rust); font-family:ui-monospace,"Cascadia Mono","Segoe UI Mono",Consolas,monospace }
.labj{ margin-top:8px; font-size:10.5px; color:var(--faint); font-style:italic }
.alairas{ margin:8px 0 1px; text-align:center; color:var(--faint); font-size:10.5px;
  font-style:italic; letter-spacing:.02em }
.alairas .sziv{ color:#d7473f; font-style:normal; font-size:13px; line-height:1; padding:0 2px }

:host([data-tema="modern"]) .stage,
:host([data-tema="midnight"]) .stage{ padding:18px }
:host([data-tema="modern"]) .ujform input,
:host([data-tema="modern"]) .bujsor input,
:host([data-tema="midnight"]) .ujform input,
:host([data-tema="midnight"]) .bujsor input{ border-radius:9px; padding-top:8px; padding-bottom:8px }
:host([data-tema="modern"]) .ujform .add,
:host([data-tema="midnight"]) .ujform .add{ border-radius:9px; padding-top:8px; padding-bottom:8px }
:host([data-tema="modern"]) .bfej,
:host([data-tema="midnight"]) .bfej{ padding-top:10px; padding-bottom:7px }
:host([data-tema="modern"]) .bfej b,
:host([data-tema="midnight"]) .bfej b{ font-family:"Alegreya Sans","Segoe UI",sans-serif; font-size:17px;
  color:var(--ink) }
:host([data-tema="modern"]) .bnevSzerk,
:host([data-tema="midnight"]) .bnevSzerk{ font-family:"Alegreya Sans","Segoe UI",sans-serif; font-size:17px; color:var(--ink) }
:host([data-tema="modern"]) .bplusz,
:host([data-tema="midnight"]) .bplusz{ border-radius:999px }
:host([data-tema="modern"]) .bsor,
:host([data-tema="midnight"]) .bsor{ padding-top:12px; padding-bottom:12px }
:host([data-tema="modern"]) .bsor .nev,
:host([data-tema="midnight"]) .bsor .nev{ font-size:15px }
:host([data-tema="modern"]) .gomb,
:host([data-tema="midnight"]) .gomb{ border-radius:9px; padding-left:12px; padding-right:12px }
:host([data-tema="modern"]) .grip{ background:var(--panel); border-top-color:var(--line) }
:host([data-tema="modern"]) .grip span{ background:var(--faint) }
:host([data-tema="midnight"]) .grip{ background:var(--panel); border-top-color:var(--line) }
:host([data-tema="midnight"]) .grip span{ background:var(--faint) }

@media (max-width:560px){
  .frame{ width:96vw }
  .bar{ gap:6px; padding-left:9px }
  .mark{ font-size:11px }
  .ver{ display:none }
  .temak{ gap:2px }
  .tema-gomb{ padding:3px 5px; font-size:9px }
  .stage{ padding:12px; min-height:320px }
  .ujform{ grid-template-columns:minmax(0,1fr) minmax(0,1fr); }
  .ujform .qmezo{ width:auto; text-align:left }
  .ujform .add{ width:100% }
  .hero{ grid-template-columns:1fr; gap:12px }
  .hero-subline{ flex-wrap:wrap }
  .hero-subline span:last-child{ text-align:left }
  .bsor{ grid-template-columns:30px minmax(0,1fr) auto; }
  .bsor .kep{ grid-column:1; grid-row:1 / span 2 }
  .bsor .nevblokk{ grid-column:2; grid-row:1 / span 2 }
  .bsor .szo{ grid-column:3; grid-row:1; font-size:10px }
  .bsor .muv{ grid-column:3; grid-row:2; justify-self:end }
}

.grip{ flex:0 0 auto; height:14px; cursor:ns-resize; display:flex; align-items:center; justify-content:center;
  touch-action:none; user-select:none; -webkit-user-select:none;
  background:linear-gradient(180deg,#3a2713,#2e1f0f); border-top:1px solid var(--fa2) }
.grip span{ width:40px; height:4px; border-radius:2px; background:#7a5a2f }
.grip:hover span{ background:#c8952a }

.bsor .kep.huzhato{ cursor:help }
.mbub{ position:absolute; z-index:60; max-width:300px; pointer-events:none;
  background:var(--panel); border:1px solid var(--fa); border-radius:6px; padding:8px 10px;
  box-shadow:0 8px 22px rgba(0,0,0,.4); color:var(--ink);
  font-family:"Segoe UI","Alegreya Sans",system-ui,sans-serif; font-size:13px;
  font-weight:500; line-height:1.45; text-rendering:geometricPrecision }
.mbub[hidden]{ display:none }
.mbub .cim{ font-family:ui-monospace,"Cascadia Mono","Segoe UI Mono",Consolas,monospace; font-size:10px; letter-spacing:.14em;
  text-transform:uppercase; color:var(--dim); margin-bottom:5px }
.mbub .msor{ display:grid; grid-template-columns:20px minmax(0,1fr) auto; gap:7px; align-items:center; padding:2px 0 }
.mbub .msor img{ width:20px; height:20px; object-fit:contain }
.mbub .msor i{ width:20px; height:20px; display:block }
.mbub .msor span{ min-width:0 }
.mbub .msor .db{ font-family:ui-monospace,"Cascadia Mono","Segoe UI Mono",Consolas,monospace; font-size:12px; color:var(--dim); text-align:right; white-space:nowrap }
.mbub .msor.jo{ color:var(--ink); font-weight:600 }
.mbub .msor.jo .db{ color:var(--green) }
.mbub .msor.zarva{ opacity:.7 }
.mbub .msor .zart{ font-size:10.5px; color:var(--rust); font-weight:600; white-space:nowrap }
.mbub .vonal{ border-top:1px solid var(--line); margin:6px 0 4px }
.mbub .lab{ font-size:11px; color:var(--faint); font-style:italic }

.pbub{ position:absolute; z-index:61; max-width:250px; pointer-events:none;
  background:var(--panel); border:1px solid var(--fa); border-radius:6px; padding:8px 10px;
  box-shadow:0 8px 22px rgba(0,0,0,.4); color:var(--ink);
  font-family:"Segoe UI","Alegreya Sans",system-ui,sans-serif; font-size:13px;
  font-weight:500; line-height:1.35; text-rendering:geometricPrecision }
.pbub[hidden]{ display:none }
.pbub .pcim{ display:flex; align-items:center; gap:7px; margin-bottom:2px; font-weight:700 }
.pbub .pcim img{ width:24px; height:24px; object-fit:contain; border-radius:3px }
.pbub .pcim i{ width:24px; height:24px; display:block }
.pbub .ptip{ color:var(--faint); font-size:10px; margin-bottom:7px }
.pbub .parak{ display:flex; align-items:flex-start; gap:16px; padding-top:6px; border-top:1px solid var(--line) }
.pbub .par{ display:grid; gap:1px; color:var(--green); font-family:ui-monospace,"Cascadia Mono","Segoe UI Mono",Consolas,monospace; font-size:13px; font-weight:800 }
.pbub .par.minimum{ color:var(--rust) }
.pbub .par small{ color:var(--faint); font-family:"Segoe UI",system-ui,sans-serif; font-size:10px; font-weight:500 }
.pbub .par.ismeretlen{ color:var(--faint); font-weight:500 }

@keyframes fill-in{ from{ transform:scaleX(0); opacity:.45 } to{ transform:scaleX(1); opacity:1 } }
@keyframes keszlet-friss{ 0%{ box-shadow:0 0 0 3px rgba(200,149,42,.78), inset 0 1px 0 rgba(255,255,255,.18) }
  100%{ box-shadow:inset 0 1px 0 rgba(255,255,255,.18) } }
@keyframes live-pulse{ 0%{ box-shadow:0 0 0 0 rgba(89,196,147,.55) }
  65%{ box-shadow:0 0 0 6px rgba(89,196,147,0) } 100%{ box-shadow:0 0 0 0 rgba(89,196,147,0) } }
@media (prefers-reduced-motion:reduce){
  .live-dot,.hero-track i,.psor .track i,.hsor .track i,.statusz .sav>div,.csik i,.bsor.keszlet-friss{ animation:none }
}

/* Pult téma, a designer 0.7.15a jelű átdolgozásából átvéve.
   Kizárólag megjelenés: a tárolás, események és ablakkezelés változatlan.
   A saját fakeret csak a nem natív ablakot érinti. */
:host([data-tema="pult"]){
  --bg:#ead7af; --panel:#f4e5c4; --raised:#dfc99c; --line:#b29665;
  --ink:#352719; --dim:#624b30; --faint:#765c3a;
  --brass:#80551e; --green:#355f36; --rust:#923b29;
  --fa:#58391e; --fa2:#302013; --fill:rgba(128,85,30,.12);
}
:host([data-tema="pult"]) .frame{
  font-family:Tahoma,Arial,sans-serif; font-weight:400; text-rendering:auto;
}
:host([data-tema="pult"]:not([data-nativ])) .frame{
  border:3px solid #493019; border-radius:3px;
  box-shadow:0 0 0 1px #ae8350,0 6px 18px #20130866;
}
:host([data-tema="pult"]) .bar:not(.automata){
  background:linear-gradient(180deg,#654325 0%,#4b301b 48%,#392414 100%);
  border-bottom:3px solid #ac8249; box-shadow:inset 0 1px 0 #a47b49;
}
:host([data-tema="pult"]) .bar{
  gap:7px; padding:7px 7px 7px 9px;
}
:host([data-tema="pult"]) .bar::after{
  display:none;
}
:host([data-tema="pult"]) .mark{
  font-family:Georgia,serif; font-weight:700; font-size:13px;
}
:host([data-tema="pult"]) .bar:not(.automata) .mark{
  padding:4px 6px; background:linear-gradient(#d5b375,#b28b4d);
  color:#352414; border:1px solid #24170d; border-radius:1px;
  box-shadow:inset 0 1px 0 #efdab1; text-shadow:0 1px #ead1a1;
}
:host([data-tema="pult"]) .mark-jel{
  width:18px; height:18px; border:0; border-radius:0;
  box-shadow:none; color:inherit;
}
:host([data-tema="pult"]) .bar:not(.automata) .ver{
  color:#e0c79a;
}
:host([data-tema="pult"]) :is(
  .tema-gomb,.piac-auto,.piac-auto-kapcs,.mini,.zar
){
  border-radius:2px;
}
:host([data-tema="pult"]) .tema-gomb[aria-pressed="true"]{
  box-shadow:inset 0 1px 0 #f3dfb3;
}
:host([data-tema="pult"]) .live-dot{
  animation:none; box-shadow:none;
}
:host([data-tema="pult"]:not([data-nativ])) .stage{
  background:radial-gradient(ellipse at 40% 10%,#fff8df70,transparent 75%),
    linear-gradient(90deg,#b9955224,transparent 3%,transparent 97%,#b9955224),
    var(--bg);
  padding:12px 14px;
}
:host([data-tema="pult"]) .fulsor{
  gap:4px; border-bottom:2px solid var(--line);
}
:host([data-tema="pult"]) .fulsor .ful{
  border:1px solid var(--line); border-bottom:0;
  border-radius:2px 2px 0 0;
  background:var(--raised); font-family:Georgia,serif; font-weight:700;
}
:host([data-tema="pult"]) .fulsor .ful.aktiv{
  background:var(--panel); color:var(--rust);
  box-shadow:inset 0 2px var(--brass);
}
:host([data-tema="pult"]) .dash{
  border:0; border-top:3px double var(--line);
  border-bottom:3px double var(--line);
  border-radius:0; background:transparent; box-shadow:none;
  padding:10px 0 12px;
}
:host([data-tema="pult"]) .dash-fej .cim{
  font-family:Georgia,serif; font-weight:700;
}
:host([data-tema="pult"]) .hero-main{
  border:0; border-right:1px solid var(--line); border-radius:0;
  background:transparent; box-shadow:none; padding:8px 12px 8px 0;
}
:host([data-tema="pult"]) .hero-percent{
  font-family:Georgia,serif; color:var(--ink);
}
:host([data-tema="pult"]) .kpi{
  border:0; border-bottom:1px solid var(--line); border-radius:0;
  background:transparent; box-shadow:none; padding:6px 5px;
}
:host([data-tema="pult"]) :is(
  .hero-track,.hero-track i,.track,.track i,.csik,.csik i
){
  border-radius:0;
}
:host([data-tema="pult"]) .hero-track{
  border:2px solid #8f7042; background:#d4bd8d; height:13px;
}
:host([data-tema="pult"]) .hero-track i{
  background:linear-gradient(#b3985c,#947239);
}
:host([data-tema="pult"]) .hsor .track i{
  background:#9a7946;
}
:host([data-tema="pult"]) .csik{
  background:#e5d5b1; border-color:#b29a6b;
}
:host([data-tema="pult"]) .csik i{
  background:linear-gradient(#ceb87f,#bea46b);
}
:host([data-tema="pult"]) .csik i.kesz{
  background:linear-gradient(#b6c39a,#9fb17e);
}
:host([data-tema="pult"]) .bfej{
  border-bottom:2px solid var(--line);
  background:linear-gradient(90deg,#cbb17b55,transparent);
  padding-left:6px;
}
:host([data-tema="pult"]) .bsor{
  margin-top:0; border:0; border-bottom:1px solid var(--line);
  border-radius:0; background:transparent; box-shadow:none;
  padding-top:10px; padding-bottom:10px;
}
:host([data-tema="pult"]) .bsor::before{
  width:2px; border-radius:0; top:12px; bottom:12px;
}
:host([data-tema="pult"]) .bsor:hover{
  background:var(--fill);
}
:host([data-tema="pult"]) .bsor .kep{
  border-radius:1px; border-color:#b39764; background:#eddbb5;
}
:host([data-tema="pult"]) :is(
  input,.gomb,.add,.bujOk,.bplusz,.pgomb,.parnullaz,
  .szuro-hiany,.szuro-menu summary,.szuro-panel,.jlista,
  .piaclista,.mbub,.pbub,.csoport-eszkozok button,.preszlet .plicit
){
  border-radius:2px;
}
:host([data-tema="pult"]) :is(
  .ujform input,.bujsor input,.piacmezo input,.piacsor input
){
  background:#f8edcf; border-color:#a58a59;
  box-shadow:inset 0 1px 2px #72522e22;
}
:host([data-tema="pult"]) :is(.gomb,.pgomb,.bplusz){
  background:linear-gradient(#eee0bd,#d2b780);
  border-color:#9f7c43; color:#43301c;
  box-shadow:inset 0 1px 0 #fff2d5;
}
:host([data-tema="pult"]) :is(.gomb.munkab,.ujform .add,.bujOk){
  background:linear-gradient(#916d3c,#674522);
  border-color:#4b321b; color:#fff3d8;
  box-shadow:inset 0 1px 0 #b89561;
}
:host([data-tema="pult"]) :is(.gomb.keszpill,.gomb.piacpill){
  background:#d8dfbc; border-color:var(--green);
  color:var(--green); box-shadow:none;
}
:host([data-tema="pult"]) .gomb.gyart{
  background:transparent; color:var(--dim);
  border-style:dashed; box-shadow:none;
}
:host([data-tema="pult"]) :is(
  .gomb,.pgomb,.bplusz,.ujform .add,.bujOk
):hover:not(:disabled){
  filter:brightness(1.09);
}
:host([data-tema="pult"]) .grip{
  background:linear-gradient(#644426,#412a17);
  border-top:2px solid #a17b45;
}
:host([data-tema="pult"]) .grip span{
  background:#c3a06a;
}


`;

    /* -----------------------------------------------------------------
       MUNKABUBOREK. Az ikonra (vagy a Munkara gombra) huzva listazza a
       munkakat, amikbol a targy szerezheto: nev, esely %, es ha nem
       elerheto, azt a % helyen jelzi. A legjobb (elso) sor kiemelve.
       A panel munkaBuborek-jebol atveve; a "nem elerheto" a mi meglevo,
       isVisible-alapu munkaElerheto-nkbol jon.
       ----------------------------------------------------------------- */
    const munkaKepUt = sn => CDN + "jobs/" + sn + ".png";

    function munkaBubSor(j, szazalek, jo) {
        const kep = j.shortname
            ? `<img src="${esc(munkaKepUt(j.shortname))}" alt="" loading="lazy" onerror="this.style.visibility='hidden'">`
            : `<i></i>`;
        const el = munkaElerheto(j);
        const jobb = el === false
            ? `<span class="zart">nem el\u00E9rhet\u0151</span>`
            : (szazalek == null ? "" : `<span class="db">${szazalek} %</span>`);
        return `<div class="msor${jo ? " jo" : ""}${el === false ? " zarva" : ""}">${kep}`
             + `<span>${esc(kijelzoSzoveg(String(j.name || "")))}</span>${jobb}</div>`;
    }

    function munkaBuborek(f) {
        if (f.eselyes) {
            const j = f.munkak[0];
            return `<div class="cim">Munka</div>` + munkaBubSor(j, null, false)
                 + `<div class="vonal"></div><div class="lab">zs\u00E1kbamacska: az es\u00E9ly nem ismert</div>`;
        }
        const sorok = f.sorok.map((s, i) =>
            munkaBubSor(s.munka, f.szazalekos ? s.szazalek : null, i === 0 && f.sorok.length > 1));
        return `<div class="cim">Munka</div>` + sorok.join("")
             + (f.sorok.length > 1
                 ? `<div class="vonal"></div><div class="lab">a legjobbat nyitja a Munk\u00E1ra gomb</div>`
                 : "");
    }

    /* A buborek a SHADOWROOT-ba kerul, nem a .frame-be: a keret
       overflow:hidden-je levagna, a host viszont position:fixed, tehat
        o a viszonyitasi pont es nem vag semmit. */
    let bubElem = null;
    function munkaBubMutat(elem, id) {
        const f = munkaForras(id);
        if (!f) return;
        if (!bubElem || !bubElem.isConnected) {
            bubElem = document.createElement("div");
            bubElem.className = "mbub";
            gyoker.appendChild(bubElem);
        }
        bubElem.innerHTML = munkaBuborek(f);
        bubElem.hidden = false;

        const kr = host.getBoundingClientRect();
        const er = elem.getBoundingClientRect();
        const br = bubElem.getBoundingClientRect();
        const hezag = 8;

        /* Elsodlegesen JOBBRA az ikon jobb szeletol; ha nem fer, balra. */
        let bal = (er.right - kr.left) + hezag;
        if (bal + br.width > kr.width - 6) {
            const balra = (er.left - kr.left) - br.width - hezag;
            bal = balra >= 6 ? balra : Math.max(6, kr.width - 6 - br.width);
        }
        /* Az ikon tetejehez igazodik, lefele no. */
        let fent = er.top - kr.top;
        if (fent + br.height > kr.height - 6) fent = Math.max(6, kr.height - 6 - br.height);
        if (fent < 6) fent = 6;

        bubElem.style.left = bal + "px";
        bubElem.style.top = fent + "px";
    }
    function munkaBubRejt() { if (bubElem) bubElem.hidden = true; }

    let arBubElem = null;
    function piacPenzKiiras(v) {
        return Number(v) > 0 ? "$" + Math.round(Number(v)).toLocaleString("hu-HU") : "-";
    }

    function piacArBuborek(id) {
        const nev = kijelzoSzoveg(targyNev(id));
        const arak = piacArak(id, null, nev, true);
        const kep = targyIkon(id);
        const kepHTML = kep
            ? "<img src=\"" + esc(kep) + "\" alt=\"\" loading=\"lazy\" onerror=\"this.style.visibility='hidden'\">"
            : "<i aria-hidden=\"true\"></i>";
        return "<div class=\"pcim\">" + kepHTML + "<span>" + esc(nev) + "</span></div>" +
          "<div class=\"ptip\">Termék · ár-információ</div>" +
          "<div class=\"parak\">" +
            "<span class=\"par" + (arak.ar > 0 ? "" : " ismeretlen") + "\">" + piacPenzKiiras(arak.ar) + "<small>ár</small></span>" +
            "<span class=\"par minimum" + (arak.minimum > 0 ? "" : " ismeretlen") + "\">" + piacPenzKiiras(arak.minimum) + "<small>minimum</small></span>" +
          "</div>";
    }

    function piacArBubMutat(elem, id) {
        if (!elem || !host || !gyoker) return;
        if (!arBubElem || !arBubElem.isConnected) {
            arBubElem = document.createElement("div");
            arBubElem.className = "pbub";
            gyoker.appendChild(arBubElem);
        }
        arBubElem.innerHTML = piacArBuborek(id);
        arBubElem.hidden = false;

        /* Ha a minimumárat csak a már megjelenített tárgybuborékból tudtuk
           kiolvasni, töltsük be rögtön az adott sor mezőjébe is. */
        const sor = elem.closest && elem.closest(".bsor");
        const arak = piacArak(id, null, targyNev(id), true);
        const arMezo = sor && sor.querySelector("[data-piac-ar]");
        if (arMezo && !(piacArSzam(arMezo.value) > 0) && arak.minimum > 0) arMezo.value = String(arak.minimum);

        const kr = host.getBoundingClientRect();
        const er = elem.getBoundingClientRect();
        const br = arBubElem.getBoundingClientRect();
        const hezag = 8;
        let bal = (er.right - kr.left) + hezag;
        if (bal + br.width > kr.width - 6) {
            const balra = (er.left - kr.left) - br.width - hezag;
            bal = balra >= 6 ? balra : Math.max(6, kr.width - 6 - br.width);
        }
        let fent = er.top - kr.top;
        if (fent + br.height > kr.height - 6) fent = Math.max(6, kr.height - 6 - br.height);
        if (fent < 6) fent = 6;
        arBubElem.style.left = bal + "px";
        arBubElem.style.top = fent + "px";
    }

    function piacArBubRejt() { if (arBubElem) arBubElem.hidden = true; }

    function oraKiiras(s) {
        const x = String(s == null ? "" : s);
        if (x === "zsakbamacska") return "zs\u00E1kbamacska";
        if (x === "kicsi az esely") return "kicsi az es\u00E9ly";
        const m = x.match(/^meg (\d+) ora munka$/);
        return m ? "m\u00E9g " + m[1] + " \u00F3ra munka" : x;
    }

    function statIconHTML(id, osztaly) {
        const kep = targyIkon(id);
        const c = osztaly ? ` class="${esc(osztaly)}"` : "";
        return kep
            ? `<img${c} src="${esc(kep)}" alt="" loading="lazy" onerror="this.style.visibility='hidden'">`
            : `<i${c} aria-hidden="true"></i>`;
    }

    function itemSorHTML(f, elosztas) {
        const a = sorAdat(f, elosztas);
        const kep = targyIkon(f.id);
        const nev = kijelzoSzoveg(targyNev(f.id));
        const munkaN = kijelzoSzoveg(munkaNeve(f.id));
        const also = munkaN ? "munka: " + esc(munkaN) : (a.vanMunka ? "" : "gy\u00E1rtott term\u00E9k");

        let oraC = "";
        if (a.piacon) oraC = `<span class="ora kesz">piacon</span>`;
        else if (a.oi.szoveg === "kesz") oraC = `<span class="ora kesz">k\u00E9sz</span>`;
        else if (a.oi.szoveg === "nem elerheto") oraC = `<span class="ora baj">nem el\u00E9rhet\u0151</span>`;
        else if (a.oi.szoveg) oraC = `<span class="ora">${esc(oraKiiras(a.oi.szoveg))}</span>`;
        const alsor = (also || oraC) ? `<div class="alsor">${also ? also + " &middot; " : ""}${oraC}</div>` : "";

        const ismert = a.megvan != null;
        const vanFelirat = a.kozos && ismert ? "Felosztva" : "Megvan";
        /* A csik feliratai. Bal: mennyi van meg. Jobb: szazalek + hianyzik. */
        let bal, jobb;
        if (a.piacon) { bal = `Piacon ${a.van}`; jobb = `100% k\u00E9sz &#10003;`; }
        else if (a.kesz) { bal = `${vanFelirat} ${a.van}`; jobb = `100% k\u00E9sz &#10003;`; }
        else if (!ismert) { bal = `Megvan ?`; jobb = `? %`; }
        else { bal = `${vanFelirat} ${a.van}`; jobb = `${a.szazalek}% &middot; hi\u00E1nyzik ${a.hianyzo}`; }
        /* A csik felirata ket retegu: az alap sotet, a kitoltott resz
           pontosan ugyanoda vagott vilagos masolatot kap. */
        const csikFill = Math.max(0, Math.min(100, Number(a.szazalek) || 0));

        const jobbSzo = a.piacon ? `<span class="ok">piacon</span>`
            : a.kesz ? `<span class="ok">k\u00E9sz</span>`
            : `<span class="hi">hi\u00E1nyzik ${ismert ? a.hianyzo : "?"}</span>`;

        const piacozhato = a.kesz && !a.piacon;
        const alapAr = piacAlapAr(f);
        const beallitottAr = piacBeallitottAr(f, alapAr);
        let gomb;
        if (a.piacon) gomb = `<button class="gomb keszpill piacpill" disabled>piacon &#10003;</button>`;
        else if (piacozhato) {
            const arValue = beallitottAr > 0 ? String(beallitottAr) : "";
            gomb = `<div class="piac-csomag">
              <button class="gomb piacb" data-piac="${esc(f.kulcs)}" title="A teljes mennyiség előkészítése a piacon">Piacra &#9656;</button>
              <div class="piac-arbox" title="Piaci egységár darabonként">
                <div class="piac-arsor"><span>$</span><input class="piacArMezo" data-piac-ar="${esc(f.kulcs)}" inputmode="decimal" value="${esc(arValue)}" aria-label="${esc(nev)} piaci egységára"><span>/db</span></div>
              </div>
            </div>`;
        }
        else if (a.vanMunka) gomb = `<button class="gomb munkab" data-munka="${esc(f.id)}">Munk\u00E1ra &#9656;</button>`;
        else gomb = `<button class="gomb gyart" disabled title="Nincs munka ehhez a term\u00E9khez">gy\u00E1rtott</button>`;

        /* A terméknév információs mező, nem műveleti gomb. A korábbi
           data-piac/role=button itt azt eredményezhette, hogy a névre
           kattintás piaci vagy gyártási műveletet indított. */
        const nevMezo = `<div class="nev itemArNev" data-piac-info="${esc(f.id)}" tabindex="0" title="Rámutatásra: a tárgy két ára">${esc(nev)}</div>`;

        const kepH = kep
            ? `<img class="kep${a.vanMunka ? " huzhato" : ""}"${a.vanMunka ? ` data-bubid="${esc(f.id)}"` : ""} src="${esc(kep)}" onerror="this.style.visibility='hidden'" alt="">`
            : `<span class="kep${a.vanMunka ? " huzhato" : ""}"${a.vanMunka ? ` data-bubid="${esc(f.id)}"` : ""}></span>`;

        const sorOsztaly = a.piacon ? "piacon" : (a.kesz ? "kesz" : (!a.vanMunka ? "gyartott" : "dolgozik"));
        const keszletMagyarazat = a.kozos && ismert
            ? ` title="Közös készlet: ${a.megvan} db; ehhez rendelve: ${a.van} db"`
            : "";
        return `<div class="bsor ${sorOsztaly}${a.valtozott ? " keszlet-friss" : ""}">
          ${kepH}
          <div class="nevblokk">${nevMezo}${alsor}
            <div class="csik" style="--csik-fill:${csikFill}%"><i class="${a.kesz ? "kesz" : ""}" style="width:${csikFill}%"></i>
              <div class="felirat"><span class="b">${bal}</span><span class="j">${jobb}</span></div>
              <div class="felirat vilagos" aria-hidden="true"><span class="b">${bal}</span><span class="j">${jobb}</span></div></div></div>
          <div class="szo"${keszletMagyarazat}><span>kell <button class="kellSzerk" data-bszerk="${esc(f.kulcs)}" title="Kell mennyiség szerkesztése">${f.db}</button></span><br>${jobbSzo}</div>
          <div class="muv">${gomb}
            <button class="torol" data-btorol="${esc(f.kulcs)}" title="T\u00F6rl\u00E9s" aria-label="T\u00F6rl\u00E9s">&times;</button></div>
        </div>`;
    }

    /* 0.5.39: A rajzol() a teljes listat ujraepiti, es a keszletfigyelo
       1,5 masodpercenkent hivhatja. A felulet allapotat ezert menteni kell,
       kulonben munka kozben kiesik a jatekos alol a beirt szoveg, a
       gorgetes es a kinyitott sorok. */
    function mezoAzonosito(el) {
        if (!el) return "";
        if (el.id) return "#" + el.id;
        const arKulcs = el.getAttribute && el.getAttribute("data-piac-ar");
        if (arKulcs) return "ar:" + arKulcs;
        const sor = el.closest ? el.closest(".bujsor") : null;
        if (sor) {
            const nev = String(sor.getAttribute("data-bujsor") || "");
            if (el.classList.contains("bujTargy")) return "bujTargy:" + nev;
            if (el.classList.contains("bujDb")) return "bujDb:" + nev;
        }
        return "";
    }

    function felszinAllapot(stage) {
        const a = { gorgetes: 0, mezok: [], bujsor: [], szuroNyitva: false };
        if (!stage) return a;
        a.gorgetes = stage.scrollTop || 0;
        const akt = gyoker && gyoker.activeElement;
        stage.querySelectorAll("input").forEach(el => {
            const azon = mezoAzonosito(el);
            if (!azon) return;
            let kezd = null, veg = null;
            try { kezd = el.selectionStart; veg = el.selectionEnd; } catch (e) { kezd = null; veg = null; }
            a.mezok.push({ azon, ertek: el.value, kezd, veg, fokusz: el === akt });
        });
        stage.querySelectorAll(".bujsor").forEach(el => {
            if (!el.hidden) a.bujsor.push(String(el.getAttribute("data-bujsor") || ""));
        });
        const d = stage.querySelector("details.szuro-menu");
        a.szuroNyitva = !!(d && d.open);
        return a;
    }

    function felszinVissza(stage, a) {
        if (!stage || !a) return;
        stage.querySelectorAll(".bujsor").forEach(el => {
            if (a.bujsor.indexOf(String(el.getAttribute("data-bujsor") || "")) >= 0) el.hidden = false;
        });
        const d = stage.querySelector("details.szuro-menu");
        if (d && a.szuroNyitva) d.open = true;

        let fokuszalt = null;
        stage.querySelectorAll("input").forEach(el => {
            const azon = mezoAzonosito(el);
            if (!azon) return;
            const m = a.mezok.find(x => x.azon === azon);
            if (!m) return;
            /* Az armezo erteke a mentett allapotbol rajzolodik ki, ezert azt
               csak akkor irjuk felul, ha epp abban gepel a jatekos. A felviteli
               urlap mezoi mogott nincs allapot, azok mindig visszaallnak. */
            if ((m.fokusz || azon.indexOf("ar:") !== 0) && el.value !== m.ertek) el.value = m.ertek;
            if (m.fokusz) fokuszalt = { el, m };
        });

        if (fokuszalt) {
            try {
                fokuszalt.el.focus({ preventScroll: true });
                if (fokuszalt.m.kezd != null && typeof fokuszalt.el.setSelectionRange === "function") {
                    fokuszalt.el.setSelectionRange(fokuszalt.m.kezd, fokuszalt.m.veg);
                }
            } catch (e) { /* nem baj */ }
        }
        /* A gorgetest a fokusz utan allitjuk vissza: a focus() maga is
           gorgethet, a preventScroll nem mindenhol hat. */
        stage.scrollTop = a.gorgetes;
    }

    /* Helyben szerkesztes kozben az automata ujrarajzolas a felig beirt
       erteket dobna el, mentes nelkul: a blur ilyenkor nem sul el. */
    function szerkesztesFolyikE() {
        return !!(gyoker && gyoker.querySelector(".kellEdit, .bnevEdit"));
    }
    /* A felviteli urlap mogott nincs mentett allapot, ezert a sikeres
       felvitel utan kezzel kell kiuriteni. */
    function urlapTorles() {
        if (!gyoker) return;
        gyorsImportok.clear();
        ["fNev", "fTargy", "fDb"].forEach(id => {
            const el = gyoker.getElementById(id);
            if (el) el.value = "";
        });
        gyoker.querySelectorAll(".bujTargy, .bujDb").forEach(el => { el.value = ""; });
        gyoker.querySelectorAll(".bujsor").forEach(el => { el.hidden = true; });
    }

    /* -----------------------------------------------------------------
       REJTETT GYORSLISTA.

       A normál Tárgy mező és a csoportok "+" sora ugyanazt a titkos
       beillesztési útvonalat használja. Csak olyan beillesztés aktiválja,
       amelyben szerepel az `item=` jelölés; a sima tárgynév-beillesztés és
       az autocomplete működése változatlan marad.
       ----------------------------------------------------------------- */
    function gyorsImportKulcs(input) {
        if (!input) return "";
        if (input.id === "fTargy") return "felso";
        const sor = input.closest && input.closest(".bujsor");
        return sor ? "plus:" + String(sor.getAttribute("data-bujsor") || "") : "";
    }

    function gyorsImportCimzett(input) {
        if (!input) return "";
        const sor = input.closest && input.closest(".bujsor");
        if (sor) return String(sor.getAttribute("data-bujsor") || "").trim();
        const fNev = gyoker && gyoker.getElementById("fNev");
        return fNev ? String(fNev.value || "").trim() : "";
    }

    function gyorsListaElemz(szoveg) {
        const forras = String(szoveg == null ? "" : szoveg).replace(/\u00A0/g, " ");
        /* Ettől lesz rejtett: egy hétköznapi tárgynév sosem kerül ebbe az
           ágba, csak a játékból kinyert [item=...] formátum. */
        if (!/\[\s*item\s*=/i.test(forras)) return null;

        const minta = /^\s*(\d+)\s*\[\s*item\s*=\s*(\d+)\s*\]\s*$/i;
        const sorok = [];
        const hibas = [];
        forras.split(/\r?\n/).forEach((sor, index) => {
            if (!sor.trim()) return;
            const talalat = sor.match(minta);
            if (!talalat) {
                hibas.push(index + 1);
                return;
            }
            const db = Number(talalat[1]);
            const id = Number(talalat[2]);
            if (!Number.isSafeInteger(db) || db <= 0 ||
                !Number.isSafeInteger(id) || id <= 0) {
                hibas.push(index + 1);
                return;
            }
            sorok.push({ db: db, id: String(id) });
        });

        return { sorok: sorok, hibas: hibas };
    }

    function gyorsImportJelzes(sorok) {
        return `${sorok.length} tétel beillesztve - Enter`;
    }

    function gyorsImportKotes(input) {
        if (!input || input.dataset.gyorsImportKotve) return;
        input.dataset.gyorsImportKotve = "1";

        const kulcs = () => gyorsImportKulcs(input);
        const mutat = () => {
            const p = gyorsImportok.get(kulcs());
            if (p && !input.value) {
                input.value = p.jelzes;
                input.dataset.gyorsImportAktiv = "1";
            }
        };
        mutat();

        input.addEventListener("paste", e => {
            const adat = e.clipboardData;
            const szoveg = adat ? adat.getData("text/plain") : "";
            const elemzett = gyorsListaElemz(szoveg);
            if (!elemzett) return;

            e.preventDefault();
            /* Ha a normál autocomplete-lista nyitva volt, az Entert annak
               átmeneti kezelője kaphatná meg a delegált gyorsimport előtt. */
            const lista = input.parentElement && input.parentElement.querySelector(".jlista");
            if (lista) { lista.hidden = true; lista.innerHTML = ""; }
            const k = kulcs();
            if (!k) return;

            if (!elemzett.sorok.length || elemzett.hibas.length) {
                gyorsImportok.delete(k);
                delete input.dataset.gyorsImportAktiv;
                const sorok = elemzett.hibas.join(", ");
                allapotSzoveg("A gyorslista hibás" + (sorok ? ": hibás sor(ok): " + sorok : ".") +
                    " Minta: 188 [item=757000]");
                return;
            }

            const p = {
                sorok: elemzett.sorok,
                cimzett: gyorsImportCimzett(input),
                jelzes: gyorsImportJelzes(elemzett.sorok)
            };
            gyorsImportok.set(k, p);
            input.value = p.jelzes;
            input.dataset.gyorsImportAktiv = "1";
            allapotSzoveg(`${p.sorok.length} tételes gyorslista felismerve - Enterrel rögzíthető.`);
        });

        /* Ha a felhasználó a beillesztett jelzésbe beleír, a függő listát
           elvetjük, és visszatérünk a normál egytételes felvitelhez. */
        input.addEventListener("input", () => {
            gyorsImportok.delete(kulcs());
            delete input.dataset.gyorsImportAktiv;
        });
    }

    function gyorsImportFelvitel(input) {
        const k = gyorsImportKulcs(input);
        const p = gyorsImportok.get(k);
        if (!p) return false;

        /* Egy autocomplete-választás programból is átírhatja a value-t, ezért
           csak a saját, változatlan gyorslista-jelzésünket fogadjuk el. */
        if (String(input.value || "") !== p.jelzes) {
            gyorsImportok.delete(k);
            return false;
        }

        const nev = gyorsImportCimzett(input);
        if (!nev) {
            allapotSzoveg("Előbb add meg, kinek gyűjtöd a tételeket.");
            return true;
        }
        if (input.id === "fTargy" && p.cimzett && p.cimzett !== nev) {
            allapotSzoveg(`A gyorslista a(z) ${p.cimzett} címzetthez készült. A biztonság kedvéért nem vittem fel.`);
            return true;
        }

        tomegesenFelvesz(nev, p.sorok);
        return true;
    }

    function tomegesenFelvesz(nev, sorok) {
        const n = String(nev || "").trim();
        if (!n || !Array.isArray(sorok) || !sorok.length) return false;

        sorok.forEach(x => {
            beszerzok.push({ kulcs: ujKulcs(), nev: n, id: String(x.id), db: igenySzam(x.id, x.db), mikor: ma(),
                             piacraKint: false, piacraMennyiseg: 0, piacraAr: 0,
                             piacraEgysegar: 0, piacraMinimumAr: 0, piacraMikor: "" });
        });
        ment();
        urlapTorles();
        rajzol();
        allapotSzoveg(`${sorok.length} feladat hozzáadva ${n} részére`
            + (beall.keszlethezAd ? ", a k\u00E9szleted hozz\u00E1adva." : "."));
        return true;
    }

    function rajzolHaSzabad() {
        if (szerkesztesFolyikE()) return;
        rajzol();
    }

    /* A ket ful kozos fejlece. Ugyanaz a stage-en belul all mindket
       nezetben, igy a meglevo felszinAllapot es felszinVissza valtozatlanul
       mukodik tovabb. */
    function fulSorHTML() {
        const p = beall.ful === "piac";
        return `
          <div class="fulsor" role="tablist">
            <button type="button" class="ful${p ? "" : " aktiv"}" data-ful="beszerzok" role="tab"
              aria-selected="${p ? "false" : "true"}">Beszerz\u0151k</button>
            <button type="button" class="ful${p ? " aktiv" : ""}" data-ful="piac" role="tab"
              aria-selected="${p ? "true" : "false"}">Piac</button>
          </div>`;
    }

    function fulKotes() {
        gyoker.querySelectorAll(".fulsor .ful").forEach(g => {
            g.addEventListener("click", () => {
                const uj = g.getAttribute("data-ful") === "piac" ? "piac" : "beszerzok";
                if (uj === beall.ful) return;
                beall.ful = uj;
                beallMent();
                rajzol();
            });
        });
    }

    /* A piac ful allapota. Nem kerul tarolba: a kereses es a beirt ertekek
       a munkamenet vegeig elnek, ahogy egy pultnal is. */
    /* A celkozonseg MERT ertekei: barkinek = 2, szovetseg = 1, varos = 0.
       Az idotartam alapertelmezese 7 nap, a felirat szama egyben az ertek. */
    const PIAC_CELOK = [
        { kulcs: "vilag", cimke: "Vil\u00E1g", minta: "eladas barkinek" },
        { kulcs: "varos", cimke: "V\u00E1ros", minta: "eladas csak a varos" },
        { kulcs: "szovetseg", cimke: "Sz\u00F6vets\u00E9g", minta: "eladas csak a szovetseg" }
    ];

    /* KATEGORIAK. MERT teny: a jatek tizenegy tipust hasznal. A "yield" a
       termek es alapanyag, a "recipe" a tekercs, a maradek kilenc a viselet
       (animal, belt, body, foot, head, left_arm, neck, pants, right_arm). */
    const PIAC_VISELET = ["animal", "belt", "body", "foot", "head",
                          "left_arm", "neck", "pants", "right_arm"];

    const PIAC_KATEGORIAK = [
        { kulcs: "mind", cimke: "Mind" },
        { kulcs: "termek", cimke: "Term\u00E9k" },
        { kulcs: "viselet", cimke: "Viselet" },
        { kulcs: "recept", cimke: "Recept" }
    ];

    function piacKategoria(tipus) {
        if (tipus === "yield") return "termek";
        if (tipus === "recipe") return "recept";
        if (PIAC_VISELET.indexOf(tipus) !== -1) return "viselet";
        return "egyeb";
    }

    const piacFul = { kereses: "", megjegyzes: "", db: {}, ar: {}, aukcio: {}, licit: {},
                      valasztott: null, kategoria: "mind" };

    /* A taska tartalma alapazonosito szerint, egy sor egy fajta targy. */
    function piacKeszlet() {
        const ki = [];
        try {
            const bag = jatek() && jatek().Bag;
            if (!bag || typeof bag.getItemsIdsByBaseItemIds !== "function") return ki;
            const csoportok = bag.getItemsIdsByBaseItemIds() || {};
            Object.keys(csoportok).forEach(alap => {
                const idk = csoportok[alap] || [];
                if (!idk.length) return;
                const id = idk[0];
                const it = itemObj(id);
                if (!it) return;
                ki.push({
                    id: id,
                    nev: targyNev(id),
                    ikon: targyIkon(id),
                    keszlet: Number(keszlet(id)) || 0,
                    ar: piacArak(id, null, targyNev(id), false).minimum,
                    adhato: it.auctionable !== false,
                    kat: piacKategoria(it.getType ? it.getType() : it.type)
                });
            });
        } catch (e) { /* ures lista */ }
        ki.sort((a, b) => String(a.nev).localeCompare(String(b.nev), "hu"));
        return ki;
    }

    /* A talalatok rendezese kereseskor: eloszor amik a keresett szoval
       KEZDODNEK, utana amik csak tartalmazzak. Kulonben a "bor" keresesre
       az abc miatt sok mas targy elozi meg magat a Bort. */
    function piacRendezoKulcs(sor, q) {
        const nev = sor.getAttribute("data-pnev") || "";
        if (!q) return 1;
        if (nev.indexOf(q) === 0) return 0;
        return 1;
    }

    /* A targyIkon nullt is adhat. Ures src helyett helykitolto negyzet,
       kulonben a bongeszo torott kep jelet rajzol. */
    function piacIkonHTML(t) {
        return t.ikon
            ? `<img src="${esc(t.ikon)}" alt="">`
            : `<span style="display:block;width:30px;height:30px"></span>`;
    }

    /* Van-e barmi az alapesettol elteroen beallitva. A vissza gomb ettol
       lesz halvany piros, hogy ranezesre lasd, ha nem a szokasos ut megy. */
    function piacVanElteres() {
        if (Object.keys(piacFul.ar).length) return true;
        if (Object.keys(piacFul.licit).some(k => piacFul.licit[k] && piacFul.licit[k].be)) return true;
        if (Object.keys(piacFul.aukcio).some(k => Number(piacFul.aukcio[k]) > 1)) return true;
        return false;
    }

    function piacSorHTML(t) {
        const azon = String(t.id);
        const db = piacFul.db[azon] != null ? piacFul.db[azon] : Math.min(t.keszlet, 1);

        /* A sajat ar mezo URESEN marad, amig te nem irsz bele. Uresen a
           jatek minimuma (az eladasi ar) ervenyes, tehat a 99 szazalekos
           eset egyetlen erintes nelkul helyes, es nem lehet veletlenul
           elrontani egy egesz oszlopot. */
        const sajat = piacFul.ar[azon];
        const sajatSzoveg = (sajat == null || sajat === "") ? "" : String(sajat);
        const ervenyes = sajatSzoveg !== "" ? Number(sajat) : Number(t.ar);
        const vetel = Math.round((Number(db) || 0) * (Number(ervenyes) || 0));

        if (!t.adhato) {
            return `
              <div class="piacsor tiltott" data-pnev="${esc(piacNormal(t.nev))}" data-pkat="${esc(t.kat)}">
                ${piacIkonHTML(t)}
                <div class="pnev" title="${esc(t.nev)}">${esc(t.nev)}</div>
                <div class="pkeszlet jobb">${t.keszlet}</div>
                <div class="ptiltva">nem tehet\u0151 piacra</div>
              </div>`;
        }

        return `
          <div class="piacsor" data-pid="${esc(azon)}" data-pnev="${esc(piacNormal(t.nev))}" data-pkat="${esc(t.kat)}"
               data-pmin="${esc(String(t.ar || 0))}" data-pkeszlet="${esc(String(t.keszlet || 0))}">
            ${piacIkonHTML(t)}
            <div class="pnev" title="${esc(t.nev)}">${esc(t.nev)}</div>
            <div class="pkeszlet jobb">${t.keszlet}</div>
            <div><input class="pdb" inputmode="numeric" value="${esc(String(db))}"
                 aria-label="Darab: ${esc(t.nev)}"></div>
            <div class="parwrap"><input class="par${sajatSzoveg ? " atirt" : ""}" inputmode="numeric"
                 value="${esc(sajatSzoveg)}" placeholder="${esc(String(t.ar || 0))}"
                 aria-label="Elad\u00E1si \u00E1r: ${esc(t.nev)}"><span class="parjel"
                 title="Saj\u00E1t \u00E1r, nem a j\u00E1t\u00E9k minimuma"${sajatSzoveg ? "" : " hidden"}>!</span></div>
            <div class="pvetel jobb">${vetel > 0 ? vetel.toLocaleString("hu-HU") : "-"}</div>
            <div><button type="button" class="pgomb">Piacra</button></div>
            ${piacReszletHTML(t, azon, db, ervenyes)}
          </div>`;
    }

    /* A kotegelt feladas es a licit csak akkor latszik, ha van ra ok:
       a kereses ezt a sort emelte ki, vagy mar allitottal rajta valamit.
       Igy a lista a szokasos esetben egysoros marad. */
    function piacReszletHTML(t, azon, db, ervenyes) {
        const aukciok = Math.max(1, Math.floor(Number(piacFul.aukcio[azon]) || 1));
        const sajatAr = piacFul.ar[azon];
        const arAtirt = !(sajatAr == null || sajatAr === "");
        /* A licit sav a reszletsavval egyutt latszik, nem csak atirt arnal:
           igy a megjegyzes gepelesekor rogton latod, hogy bepipalodott. */

        /* A sav mindig felepul, csak rejtve marad. Igy gepeles kozben elo tud
           jonni, es nem kell ujrarajzolni a sort, ami elvinne a fokuszt. */
        const rejtve = piacFul.valasztott !== azon && aukciok === 1 && !arAtirt;

        const ossz = aukciok * (Number(db) || 0);
        const marad = Math.max(0, (Number(t.keszlet) || 0) - ossz);
        const osszAr = Math.round(ossz * (Number(ervenyes) || 0));

        const licit = piacFul.licit[azon];
        const licitBe = licit != null ? !!licit.be : !!String(piacFul.megjegyzes || "").trim();
        const licitAr = (licit && licit.ar != null && licit.ar !== "") ? licit.ar : (t.ar || 0);

        return `
          <div class="preszlet"${rejtve ? " hidden" : ""}>
            <div class="psor">
              <span class="pcimke">\u00C1rver\u00E9sek</span>
              <input class="paukcio${aukciok > 1 ? " atirt" : ""}" inputmode="numeric"
                value="${esc(String(aukciok))}" aria-label="\u00C1rver\u00E9sek sz\u00E1ma">
              <span class="pmagy">${aukciok} &times; ${Number(db) || 0} = ${ossz} db, marad ${marad}</span>
              <span class="possz">\u00D6sszesen <b>${osszAr > 0 ? osszAr.toLocaleString("hu-HU") : "-"}</b></span>
            </div>
            <label class="plicit${licitBe ? " aktiv" : ""}">
              <input type="checkbox" class="plicitbe"${licitBe ? " checked" : ""}>
              <span class="pcimke">Licit\u00E1r</span>
              <input class="plicitar" inputmode="numeric" value="${esc(String(licitAr))}"
                aria-label="Legkisebb licit">
              <span class="pmagy">innen indul a licit</span>
              <span class="pjel"${licitBe ? "" : " hidden"}>!</span>
            </label>
          </div>`;
    }

    function piacFulHTML() {
        /* A lista egyszer epul fel, teljes egeszeben. A kereses csak
           elrejti a nem talalo sorokat, ezert gepeles kozben nem vesz el
           a fokusz es nem ugrik a kurzor. */
        const sorok = piacKeszlet().map(piacSorHTML).join("");

        return `
          <div class="piacfej">
            <div class="piacmezo">
              <input id="pKereses" autocomplete="off" spellcheck="false"
                placeholder="Keres\u00E9s a k\u00E9szletedben" value="${esc(piacFul.kereses)}">
              <button type="button" class="torlo" data-torol="pKereses"
                aria-label="Keres\u00E9s t\u00F6rl\u00E9se"${piacFul.kereses ? "" : " hidden"}>\u2715</button>
            </div>
            <div class="piacmezo">
              <input id="pMegjegyzes" autocomplete="off" spellcheck="false"
                placeholder="Megjegyz\u00E9s" value="${esc(piacFul.megjegyzes)}">
              <button type="button" class="torlo" data-torol="pMegjegyzes"
                aria-label="Megjegyz\u00E9s t\u00F6rl\u00E9se"${piacFul.megjegyzes ? "" : " hidden"}>\u2715</button>
            </div>
            <div class="piaccel" role="group" aria-label="Kinek hirdetj\u00FCk meg">
              ${PIAC_CELOK.map(c => `<button type="button" class="pcel${beall.piacCel === c.kulcs ? " aktiv" : ""}"
                data-pcel="${c.kulcs}" aria-pressed="${beall.piacCel === c.kulcs ? "true" : "false"}">${c.cimke}</button>`).join("")}
            </div>
          </div>
          <div class="piacnapok">
            <span class="pcimke">Az \u00E1rver\u00E9s id\u0151tartama</span>
            ${[1, 2, 3, 4, 5, 6, 7].map(n => `<button type="button" class="pnap${beall.piacNapok === n ? " aktiv" : ""}"
              data-pnap="${n}" aria-pressed="${beall.piacNapok === n ? "true" : "false"}">${n}</button>`).join("")}
            <span class="pmagy">nap</span>
            <span class="pkatvalaszto" role="group" aria-label="Kateg\u00F3ria">
              ${PIAC_KATEGORIAK.map(k => `<button type="button" class="pkat${piacFul.kategoria === k.kulcs ? " aktiv" : ""}"
                data-pkatv="${k.kulcs}" aria-pressed="${piacFul.kategoria === k.kulcs ? "true" : "false"}">${k.cimke}</button>`).join("")}
            </span>
          </div>
          <p class="labj piaccel-sug">V\u00E1ros \u00E9s Sz\u00F6vets\u00E9g csak akkor v\u00E1laszthat\u00F3,
            ha a j\u00E1t\u00E9k felaj\u00E1nlja; ha nincs, a Vil\u00E1g marad.</p>

          <div class="piacfejlec">
            <div></div><div>T\u00E1rgy</div><div class="jobb">K\u00E9szlet</div>
            <div class="jobb">Darab</div><div class="jobb">Elad\u00E1si \u00E1r</div>
            <div class="jobb">V\u00E9tel\u00E1r</div>
            <div><button type="button" id="pArNullaz" class="parnullaz${piacVanElteres() ? " elter" : ""}"
              title="Minden saj\u00E1t \u00E1r, k\u00F6teg \u00E9s licit t\u00F6rl\u00E9se">alap</button></div>
          </div>

          <div class="piaclista">${sorok}<div class="piacures" id="pUres"${sorok ? " hidden" : ""}>Nincs tal\u00E1lat a k\u00E9szletedben.</div></div>

          <div id="allapot"></div>
          <p class="labj">Az \u00E1r a j\u00E1t\u00E9k minimum egys\u00E9g\u00E1ra; \u00E1t\u00EDrhatod, de al\u00E1 nem mehetsz.</p>
          <div class="alairas" aria-label="Crafted with heart by smcZ">Crafted with <span class="sziv" aria-hidden="true">\u2665</span> by smcZ</div>
        `;
    }

    /* A Piac ful sorabol inditott feladas. A targyat, a darabszamot es a
       megjegyzest a sor adja; a feladas maga a kozos piacraRak. */
    function piacFulFeladas(t, elem) {
        if (piacFut) return;

        const azon = String(t.id);
        const db = Math.max(0, Math.floor(Number(piacFul.db[azon] != null ? piacFul.db[azon] : 0)));
        const sajat = piacFul.ar[azon];
        const ar = Math.max(0, Math.round(Number(
            (sajat == null || sajat === "") ? t.ar : sajat)));

        if (!(db > 0)) { allapot("piac_db_nulla"); return; }
        if (db > t.keszlet) { allapot("piac_db_sok"); return; }
        /* A minimum ala nem mehetunk. A beirt nulla sem ures mezo, ezert
           azt is ez fogja meg. */
        if (t.ar > 0 && ar < t.ar) { allapot("piac_ar_min"); return; }
        if (!(ar > 0)) { allapot("piac_ar_min"); return; }

        const aukciok = Math.max(1, Math.floor(Number(piacFul.aukcio[azon]) || 1));

        piacraRak({
            id: t.id,
            db: db,
            nev: String(piacFul.megjegyzes || ""),
            piacraEgysegar: ar > 0 ? ar : 0,
            piacraMinimumAr: t.ar > 0 ? t.ar : 0,
            piacraAukciok: aukciok,
            piacraLicit: (function () {
                const l = piacFul.licit[azon];
                if (!l || !l.be) return 0;
                const v = Math.round(Number(l.ar));
                return v > 0 ? v : 0;
            })(),
            piacraNapok: beall.piacNapok,
            piacraCel: beall.piacCel
        }, elem, true);
    }

    /* Elo szures ujrarajzolas nelkul. Az ekezeteket a piacNormal mar
       levette mindket oldalrol, tehat a "gyapju" es a "gyapju" egyarant
       talal. */
    /* Egy sor akkor mutatja a reszletsavot, ha kivalasztottad, vagy ha a
       kereses EGYETLEN sorra szukitett, vagy ha mar allitottal rajta valamit. */
    function piacReszletLathato(sor) {
        const azon = sor.getAttribute("data-pid");
        if (!azon) return false;
        if (piacFul.valasztott === azon) return true;
        if (piacFul.ar[azon] != null) return true;
        if (Number(piacFul.aukcio[azon]) > 1) return true;
        return false;
    }

    function piacReszletekFrissit() {
        gyoker.querySelectorAll(".piaclista .piacsor[data-pid]").forEach(sor => {
            const r = sor.querySelector(".preszlet");
            if (r) r.hidden = !piacReszletLathato(sor);
            sor.classList.toggle("valasztott", piacFul.valasztott === sor.getAttribute("data-pid"));
        });
    }

    function piacSzur() {
        const q = piacNormal(piacFul.kereses);
        let talalt = 0;
        let egyetlen = null;
        const lista = gyoker.querySelector(".piaclista");
        const sorok = [...gyoker.querySelectorAll(".piaclista .piacsor")];

        const kat = piacFul.kategoria;
        sorok.forEach(sor => {
            const nev = sor.getAttribute("data-pnev") || "";
            const jo = (!q || nev.includes(q)) &&
                (kat === "mind" || (sor.getAttribute("data-pkat") || "") === kat);
            sor.hidden = !jo;
            if (jo) { talalt++; if (sor.getAttribute("data-pid")) egyetlen = sor; }
        });

        /* Ujrarendezes: a kezdodo talalatok kerulnek elore. */
        if (lista && q) {
            const ures = gyoker.getElementById("pUres");
            sorok
                .slice()
                .sort((a, b) => (piacRendezoKulcs(a, q) - piacRendezoKulcs(b, q)))
                .forEach(sor => lista.insertBefore(sor, ures || null));
        }

        /* Ha a kereses EGYETLEN feladhato sorra szukitett, azt magatol
           kivalasztjuk, hogy ne kelljen kulon rakattintani. */
        if (q && talalt === 1 && egyetlen) {
            piacFul.valasztott = egyetlen.getAttribute("data-pid");
        }

        piacReszletekFrissit();

        const ures = gyoker.getElementById("pUres");
        if (ures) ures.hidden = talalt > 0;
    }

    /* A lista magassaga a panel meretebol jon, hogy a kereso, a napok es az
       oszlopnevek allva maradjanak, es csak a tetelek gorogjenek.

       KET hiba volt az elso valtozatban. Egyszer csak rajzolaskor szamolt,
       ezert a panel nyujtasa nem valtoztatta a listat. Masreszt rajzolas
       kozben a magassag meg nem allt be, ezert tul kicsire sikerult.
       Mindkettot a ResizeObserver oldja meg: a stage minden meretvaltozasara
       ujraszamolunk. */
    let piacMeretFigyelo = null;

    function piacListaMagassag() {
        try {
            const stage = gyoker.getElementById("stage");
            const lista = gyoker.querySelector(".piaclista");
            if (!stage || !lista) return;

            /* A lista alatt allo labjegyzet es alairas helye. */
            const also = 74;
            const h = stage.clientHeight - (lista.offsetTop - stage.offsetTop) - also;
            lista.style.maxHeight = Math.max(120, h) + "px";
        } catch (e) { /* marad a sajat magassaga */ }
    }

    function piacMeretFigyeloLeallit() {
        try { if (piacMeretFigyelo) piacMeretFigyelo.disconnect(); }
        catch (e) { /* nem baj */ }
        piacMeretFigyelo = null;
    }

    function piacMeretFigyeloIndit() {
        piacMeretFigyeloLeallit();
        try {
            const stage = gyoker.getElementById("stage");
            if (!stage || typeof ResizeObserver !== "function") return;
            piacMeretFigyelo = new ResizeObserver(() => {
                if (beall.ful !== "piac") { piacMeretFigyeloLeallit(); return; }
                piacListaMagassag();
            });
            piacMeretFigyelo.observe(stage);
        } catch (e) { /* enelkul is mukodik, csak nem koveti a nyujtast */ }
    }

    /* KESZLETFIGYELES A PIAC FULON.

       MERT teny (a mestersegkalkulatorbol atveve): nincs olyan jatekbeli
       esemeny, amire fel lehetne iratkozni. Az inventory_changed a
       bag_updated jelek ELOTT erkezik, tehat arra rajzolva elavult
       darabszamokat irnank ki. Ezert idoszakos ellenorzes megy.

       Ket utem van. Alapbol harom masodperc. Feladas utan viszont SURITUNK
       300 ezredmasodpercre, es amint a keszlet mozdul, frissitunk es
       visszaallunk. Igy nem kell varni a kovetkezo korre.

       Csak a szamot irjuk at, nem rajzolunk ujra, hogy a beirt ertekeid
       megmaradjanak. */
    const PIAC_ALAP_UTEM = 3000;
    const PIAC_SURU_UTEM = 300;
    const PIAC_SURU_KOR = 20;         /* 20 x 300 ms = 6 masodperc, ahogy a panelben */

    let piacKeszletOra = null;
    let piacSuritOra = null;

    function piacKeszletFigyeloLeallit() {
        if (piacKeszletOra != null) clearInterval(piacKeszletOra);
        piacKeszletOra = null;
        if (piacSuritOra != null) clearInterval(piacSuritOra);
        piacSuritOra = null;
    }

    /* A lathato sorok keszletebol kepzett ujjlenyomat. Ha nem valtozik,
       nem nyulunk semmihez. */
    function piacUjjlenyomat() {
        const ki = [];
        gyoker.querySelectorAll(".piaclista .piacsor[data-pid]").forEach(sor => {
            const azon = sor.getAttribute("data-pid");
            let db = null;
            try { db = keszlet(azon); } catch (e) { db = null; }
            ki.push(azon + ":" + String(db));
        });
        return ki.join("|");
    }

    function piacKeszletKiir() {
        gyoker.querySelectorAll(".piaclista .piacsor[data-pid]").forEach(sor => {
            const azon = sor.getAttribute("data-pid");
            const cella = sor.querySelector(".pkeszlet");
            if (!cella) return;
            let db = null;
            try { db = keszlet(azon); } catch (e) { db = null; }
            if (db == null) return;
            if (String(db) !== cella.textContent.trim()) {
                cella.textContent = String(db);
                sor.setAttribute("data-pkeszlet", String(db));
            }
        });
    }

    let piacVoltUjj = "";

    function piacKeszletFigyelo() {
        piacKeszletFigyeloLeallit();
        piacVoltUjj = piacUjjlenyomat();
        piacKeszletOra = setInterval(() => {
            if (!gyoker || beall.ful !== "piac") { piacKeszletFigyeloLeallit(); return; }
            const most = piacUjjlenyomat();
            if (most === piacVoltUjj) return;
            piacVoltUjj = most;
            piacKeszletKiir();
        }, PIAC_ALAP_UTEM);
    }

    /* Feladas utan suritunk. A dontest az ujjlenyomat hozza, nem egy
       kitalalt varakozas: ha a keszlet nem mozdul, nem irunk at semmit. */
    function piacKeszletSurit() {
        if (piacSuritOra != null) clearInterval(piacSuritOra);
        let hatra = PIAC_SURU_KOR;
        piacSuritOra = setInterval(() => {
            if (!gyoker || beall.ful !== "piac") {
                clearInterval(piacSuritOra);
                piacSuritOra = null;
                return;
            }
            const most = piacUjjlenyomat();
            if (most !== piacVoltUjj) {
                piacVoltUjj = most;
                piacKeszletKiir();
                clearInterval(piacSuritOra);
                piacSuritOra = null;
                return;
            }
            if (--hatra <= 0) {
                clearInterval(piacSuritOra);
                piacSuritOra = null;
            }
        }, PIAC_SURU_UTEM);
    }

    function piacKotes() {
        const k = gyoker.getElementById("pKereses");
        if (k) {
            k.addEventListener("input", () => { piacFul.kereses = k.value; piacSzur(); });
            k.addEventListener("keydown", e => { if (e.key === "Escape") { k.value = ""; piacFul.kereses = ""; piacSzur(); } });
        }
        const m = gyoker.getElementById("pMegjegyzes");
        if (m) m.addEventListener("input", () => {
            piacFul.megjegyzes = m.value;
            /* A licit alapbol akkor van bepipalva, ha van megjegyzes. Csak
               azokat allitjuk, amiket te nem kapcsoltal kezzel. */
            const kell = !!String(m.value || "").trim();
            gyoker.querySelectorAll(".piaclista .piacsor[data-pid]").forEach(sor => {
                const azon = sor.getAttribute("data-pid");
                const l = piacFul.licit[azon];
                if (l && l.kezi) return;
                const cb = sor.querySelector(".plicitbe");
                const doboz = sor.querySelector(".plicit");
                const jel = sor.querySelector(".pjel");
                if (!cb) return;
                cb.checked = kell;
                if (doboz) doboz.classList.toggle("aktiv", kell);
                if (jel) jel.hidden = !kell;
                piacFul.licit[azon] = {
                    be: kell,
                    ar: sor.querySelector(".plicitar") ? sor.querySelector(".plicitar").value : "",
                    kezi: false
                };
            });
            const vg = gyoker.getElementById("pArNullaz");
            if (vg) vg.classList.toggle("elter", piacVanElteres());
        });

        /* A megszokott kis X: kattintasra kiuriti a mezot, es csak akkor
           latszik, ha van mit torolni. */
        gyoker.querySelectorAll(".piacmezo .torlo").forEach(x => {
            const cel = gyoker.getElementById(x.getAttribute("data-torol"));
            if (!cel) return;
            const mutat = () => { x.hidden = !cel.value; };
            cel.addEventListener("input", mutat);
            x.addEventListener("click", () => {
                cel.value = "";
                if (cel.id === "pKereses") { piacFul.kereses = ""; piacSzur(); }
                else piacFul.megjegyzes = "";
                mutat();
                try { cel.focus(); } catch (e) { /* nem baj */ }
            });
        });

        gyoker.querySelectorAll("[data-pkatv]").forEach(g => {
            g.addEventListener("click", () => {
                piacFul.kategoria = g.getAttribute("data-pkatv") || "mind";
                gyoker.querySelectorAll("[data-pkatv]").forEach(x => {
                    const be = x.getAttribute("data-pkatv") === piacFul.kategoria;
                    x.classList.toggle("aktiv", be);
                    x.setAttribute("aria-pressed", be ? "true" : "false");
                });
                piacSzur();
            });
        });

        gyoker.querySelectorAll("[data-pnap]").forEach(g => {
            g.addEventListener("click", () => {
                beall.piacNapok = Math.max(1, Math.min(7, Number(g.getAttribute("data-pnap")) || 7));
                beallMent();
                gyoker.querySelectorAll("[data-pnap]").forEach(x => {
                    const be = Number(x.getAttribute("data-pnap")) === beall.piacNapok;
                    x.classList.toggle("aktiv", be);
                    x.setAttribute("aria-pressed", be ? "true" : "false");
                });
            });
        });

        gyoker.querySelectorAll("[data-pcel]").forEach(g => {
            g.addEventListener("click", () => {
                beall.piacCel = g.getAttribute("data-pcel");
                beallMent();
                rajzol();
            });
        });

        const nullaz = gyoker.getElementById("pArNullaz");
        if (nullaz) nullaz.addEventListener("click", () => {
            piacFul.ar = {};
            piacFul.licit = {};
            piacFul.aukcio = {};
            rajzol();
        });

        gyoker.querySelectorAll(".piacsor[data-pid]").forEach(sor => {
            const azon = sor.getAttribute("data-pid");
            const dbm = sor.querySelector(".pdb");
            const arm = sor.querySelector(".par");
            const vet = sor.querySelector(".pvetel");

            const minimum = Number(sor.getAttribute("data-pmin")) || 0;

            const frissit = () => {
                const db = Math.max(0, Math.floor(piacArSzam(dbm.value)));
                piacFul.db[azon] = db;

                const nyers = String(arm.value || "").trim();
                const jel = sor.querySelector(".parjel");
                if (nyers === "") {
                    delete piacFul.ar[azon];
                    arm.classList.remove("atirt");
                    if (jel) jel.hidden = true;
                } else {
                    piacFul.ar[azon] = Math.max(0, Math.round(piacArSzam(nyers)));
                    arm.classList.add("atirt");
                    if (jel) jel.hidden = false;
                }

                const ar = piacFul.ar[azon] != null ? piacFul.ar[azon] : minimum;
                const v = db * ar;
                vet.textContent = v > 0 ? v.toLocaleString("hu-HU") : "-";
                reszletFrissit();
            };

            /* A reszletsav szamai gepeles kozben kovetik a mezoket. Az egesz
               sort nem rajzoljuk ujra, mert akkor elveszne a fokusz. */
            function reszletFrissit() {
                const au = sor.querySelector(".paukcio");
                const magy = sor.querySelector(".pmagy");
                const ossz = sor.querySelector(".possz b");
                const reszlet = sor.querySelector(".preszlet");
                if (!au || !magy || !ossz) return;

                /* A sav gepeles kozben jelenik meg, nem elkattintaskor.
                   Az elem mar a DOM-ban van, csak a rejtettseget valtjuk. */
                if (reszlet) reszlet.hidden = !piacReszletLathato(sor);

                const aukciok = Math.max(1, Math.floor(piacArSzam(au.value) || 1));
                const db = Math.max(0, Math.floor(piacArSzam(dbm.value)));
                const ar = piacFul.ar[azon] != null ? piacFul.ar[azon] : minimum;
                const keszlet = Number(sor.getAttribute("data-pkeszlet")) || 0;

                const osszDb = aukciok * db;
                magy.textContent = aukciok + " \u00D7 " + db + " = " + osszDb +
                    " db, marad " + Math.max(0, keszlet - osszDb);
                const teljes = osszDb * ar;
                ossz.textContent = teljes > 0 ? teljes.toLocaleString("hu-HU") : "-";
                au.classList.toggle("atirt", aukciok > 1);
            }
            /* Belekattintaskor a teljes tartalom kijelolodik, igy nem kell
               torolgetni, mielott ujat irnal. */
            [dbm, arm].forEach(mezo => {
                if (!mezo) return;
                mezo.addEventListener("focus", () => { try { mezo.select(); } catch (e) { /* nem baj */ } });
                mezo.addEventListener("input", frissit);
            });

            /* A vissza gomb szinezese csak akkor valtozik, ha az elteres
               allapota valtozott, ezert azt eleg elkattintaskor frissiteni. */
            if (arm) arm.addEventListener("change", () => {
                const vg = gyoker.getElementById("pArNullaz");
                if (vg) vg.classList.toggle("elter", piacVanElteres());
            });

            const au = sor.querySelector(".paukcio");
            if (au) {
                au.addEventListener("focus", () => { try { au.select(); } catch (e) { /* nem baj */ } });
                au.addEventListener("input", () => {
                    piacFul.aukcio[azon] = Math.max(1, Math.floor(piacArSzam(au.value) || 1));
                    reszletFrissit();
                });
            }

            const lbe = sor.querySelector(".plicitbe");
            const lar = sor.querySelector(".plicitar");
            if (lbe || lar) {
                const licitMent = () => {
                    piacFul.licit[azon] = {
                        be: lbe ? !!lbe.checked : false,
                        ar: lar ? lar.value : "",
                        kezi: true
                    };
                    const doboz = sor.querySelector(".plicit");
                    if (doboz && lbe) doboz.classList.toggle("aktiv", lbe.checked);
                    const jel = sor.querySelector(".pjel");
                    if (jel && lbe) jel.hidden = !lbe.checked;
                    const vg = gyoker.getElementById("pArNullaz");
                    if (vg) vg.classList.toggle("elter", piacVanElteres());
                };
                if (lbe) lbe.addEventListener("change", licitMent);
                if (lar) {
                    lar.addEventListener("focus", () => { try { lar.select(); } catch (e) { /* nem baj */ } });
                    lar.addEventListener("input", licitMent);
                }
            }

            /* Kattintas a soron kivalasztja: ekkor jon elo a reszletsav.
               A mezoket es a gombot nem zavarjuk. */
            sor.addEventListener("click", e => {
                const c = e.target;
                if (c.closest("input, button, label, .preszlet")) return;
                piacFul.valasztott = (piacFul.valasztott === azon) ? null : azon;
                piacReszletekFrissit();
            });

            const gomb = sor.querySelector(".pgomb");
            if (gomb) gomb.addEventListener("click", () => {
                frissit();
                const t = piacKeszlet().filter(x => String(x.id) === azon)[0];
                if (t) piacFulFeladas(t, gomb);
                piacKeszletSurit();
            });
        });
    }

    /* A mar meglevo tetelek a csoport aljara kerulnek, mert azokkal nincs
       tobb dolgod. A tobbi a sajat sorrendjeben marad, hogy a felvitel
       sorrendje kovetheto legyen. */
    function rendezettTetelek(tetelek, elosztas) {
        return tetelek
            .map((x, i) => ({ x: x, i: i, kesz: !!sorAdat(x, elosztas).kesz }))
            .sort((a, b) => (a.kesz === b.kesz) ? (a.i - b.i) : (a.kesz ? 1 : -1))
            .map(r => r.x);
    }

    /* Igaz, ha az elso ujabb a masodiknal. Szamkent hasonlit, tehat a
       0.7.10 nagyobb, mint a 0.7.9. */
    function ujabbVerzio(a, b) {
        const x = String(a).split("."), y = String(b).split(".");
        for (let i = 0; i < Math.max(x.length, y.length); i++) {
            const xi = parseInt(x[i] || "0", 10), yi = parseInt(y[i] || "0", 10);
            if (isNaN(xi) || isNaN(yi)) return false;
            if (xi > yi) return true;
            if (xi < yi) return false;
        }
        return false;
    }

    /* A jelzes a FEJLECBEN ul, ami egyszer epul fel, nem minden rajzolasnal.
       Ezert a kotes kulon megy, egyszer, a rajzolas pedig csak az allapotat
       frissiti. Ha a kotes a rajzolasba kerulne, minden ujrarajzolas ujabb
       kattintaskezelot tenne ra. */
    function frissJelFrissit() {
        if (!gyoker) return;
        const fj = gyoker.getElementById("frissJel");
        if (!fj) return;
        if (ujVerzio) {
            fj.classList.add("lathato");
            fj.textContent = "\u25CF \u00DAj: " + ujVerzio;
            fj.title = "\u00DAj v\u00E1ltozat: " + ujVerzio + ". Kattints a friss\u00EDt\u00E9shez.";
        } else {
            fj.classList.remove("lathato");
        }
    }

    function frissJelKotes() {
        if (!gyoker) return;
        const fj = gyoker.getElementById("frissJel");
        if (!fj || fj.dataset.kotve) return;
        fj.dataset.kotve = "1";
        /* MERT hiba volt: a host-ra kotott pointerdown kezelo (ami a panelt
           elore hozza) elkapja az esemenyt, ezert a gombig mar nem jut el a
           click. A pointerdown viszont igen, meressel igazolva. */
        fj.addEventListener("pointerdown", e => { e.stopPropagation(); frissitestMegnyit(); });
    }

    /* A telepito megnyitasa.

       MERT hiba volt: a homokozobol hivott window.open nem jutott el a
       Tampermonkey telepitojeig. Ezert eloszor a GM_openInTab megy, ami
       kifejezetten erre valo, es csak utana esunk vissza a jatek sajat
       ablakanak window.open hivasara. */
    function frissitestMegnyit() {
        try {
            if (typeof GM_openInTab === "function") {
                GM_openInTab(FRISS_URL, { active: true });
                return;
            }
        } catch (e) { /* megyunk tovabb */ }

        try {
            const W = jatek();
            if (W && typeof W.open === "function") { W.open(FRISS_URL, "_blank"); return; }
        } catch (e) { /* megyunk tovabb */ }

        try { window.open(FRISS_URL, "_blank"); }
        catch (e) { /* nem sikerult */ }
    }

    function frissitestKeres() {
        try {
            fetch(FRISS_URL + "?v=" + Date.now(), { cache: "no-store" })
                .then(v => v.text())
                .then(szoveg => {
                    const m = szoveg.match(/@version\s+(\S+)/);
                    if (!m || !ujabbVerzio(m[1], VERZIO)) return;
                    ujVerzio = m[1];
                    frissJelFrissit();
                })
                .catch(() => { /* nem baj, legkozelebb ujra */ });
        } catch (e) { /* nem baj */ }
    }

    function rajzol() {
        if (!gyoker) return;
        const stage = gyoker.getElementById("stage");
        if (!stage) return;
        const felszin = felszinAllapot(stage);

        if (beall.ful === "piac") {
            stage.innerHTML = fulSorHTML() + piacFulHTML();
            fulKotes();
            piacKotes();
            piacSzur();
            piacListaMagassag();
            piacMeretFigyeloIndit();
            piacKeszletFigyelo();
            /* A rajzolas pillanataban a magassag meg nem biztos, hogy vegleges,
               ezert a kovetkezo kepkockan ujraszamolunk. */
            requestAnimationFrame(piacListaMagassag);
            alkalmazMagassag();
            if (host && host.hasAttribute("data-nativ")) nativMeret();
            felszinVissza(stage, felszin);
            return;
        }

        if (beall.orak !== false && beansUres()) oraKeresHaKell();

        const elosztas = keszletElosztas();
        const o = osszesites(elosztas);

        /* A kimutatás mindig az összes feladatból készül, a szűrő csak a
           részletes listát rövidíti. Így a közös készlet-elszámolás és az
           összkép nem változik attól, hogy éppen kit nézünk. */
        const teljesCsoportSorrend = csoportNevek();
        const aktivSzemelyek = new Set(
            (Array.isArray(beall.szemelySzuro) ? beall.szemelySzuro : [])
                .map(x => String(x))
                .filter(x => teljesCsoportSorrend.includes(x))
        );
        const lathatoFeladatok = beszerzok.filter(x => {
            const szemelyJo = !aktivSzemelyek.size || aktivSzemelyek.has(String(x.nev || ""));
            const hianyJo = !beall.csakHianyzo || !sorAdat(x, elosztas).kesz;
            return szemelyJo && hianyJo;
        });

        /* Csoportok név szerint, a felvitel/prioritási sorrendet tartva. */
        const csop = new Map();
        lathatoFeladatok.forEach(x => {
            const k = String(x.nev || "");
            if (!csop.has(k)) csop.set(k, []);
            csop.get(k).push(x);
        });

        const csoportSorrend = [...csop.keys()];
        let csoportHTML = "";
        csop.forEach((tetelek, nev) => {
            const utolso = tetelek.map(t => t.mikor || "").sort().pop() || "";
            const teljesIndex = teljesCsoportSorrend.indexOf(nev);
            const prioritas = teljesIndex + 1;
            const zart = csoportCsukottE(nev);
            csoportHTML += `<div class="bcsop" data-csoport-nev="${esc(nev)}">
              <div class="bfej">
                <button class="bcsuk" data-bcsuk="${esc(nev)}" aria-expanded="${zart ? "false" : "true"}"
                  title="Csoport ${zart ? "kinyitása" : "összecsukása"}">${zart ? "&#9656;" : "&#9662;"}</button>
                <span class="prior-sorszam" title="Elszámolási prioritás">#${prioritas > 0 ? prioritas : "?"}</span>
                <button class="bnevSzerk" data-bnev-szerk="${esc(nev)}" title="Címzett átnevezése">${esc(kijelzoSzoveg(nev || "(nincs n\u00E9v)"))}</button>
                <button class="bplusz" data-bplusz="${esc(nev)}" title="\u00DAj t\u00E9tel ehhez a szem\u00E9lyhez" aria-label="\u00DAj t\u00E9tel">+</button>
                <span class="bfej-eszkoz">
                  <button class="bmozgat" data-bmozgat="${esc(nev)}" data-irany="-1" title="Prioritás növelése; feljebb kerül" aria-label="Prioritás növelése"${teljesIndex <= 0 ? " disabled" : ""}>&#9650;</button>
                  <button class="bmozgat" data-bmozgat="${esc(nev)}" data-irany="1" title="Prioritás csökkentése; lejjebb kerül" aria-label="Prioritás csökkentése"${teljesIndex < 0 || teljesIndex === teljesCsoportSorrend.length - 1 ? " disabled" : ""}>&#9660;</button>
                  <button class="btorol" data-bszemely="${esc(nev)}"
                    title="A teljes beszerz\u00E9s t\u00F6rl\u00E9se" aria-label="Beszerz\u00E9s t\u00F6rl\u00E9se">&#10005;</button>
                  ${utolso ? `<span class="datum">${esc(utolso)}</span>` : ""}
                </span>
              </div>
              <div class="bc-tartalom"${zart ? " hidden" : ""}>`
              + rendezettTetelek(tetelek, elosztas).map(x => itemSorHTML(x, elosztas)).join("")
              + `<div class="bujsor" data-bujsor="${esc(nev)}" hidden>
                   <span class="jwrap"><input class="bujTargy" autocomplete="off" spellcheck="false" placeholder="T\u00E1rgy">
                     <ul class="jlista bujLista" hidden></ul></span>
                   <input class="bujDb" inputmode="numeric" placeholder="Darab">
                   <button class="bujOk">hozz\u00E1ad</button></div>`
              + `</div></div>`;
        });
        if (!csoportHTML) csoportHTML = `<p class="ures">${(aktivSzemelyek.size || beall.csakHianyzo)
            ? "Nincs a szűrésnek megfelelő feladat." : "Még nincs feladat. Vegyél fel egyet fent."}</p>`;
        const csoportEszkozHTML = csoportSorrend.length > 1 ? `
          <div class="csoport-eszkozok">
            <span>Csoportok:</span>
            <button data-bcsuk-all="open">mind nyit</button>
            <button data-bcsuk-all="close">mind zár</button>
          </div>` : "";
        /* A sav akkor is kell, ha csak EGY beszerzod van: a "csak hianyzo"
           ott is ertelmes, mert a mar meglevo teteleket elrejti. A szemely-
           valaszto viszont felesleges egyetlen nevnel, azt kulon rejtjuk. */
        const tobbSzemely = teljesCsoportSorrend.length > 1;
        const szuroHTML = (teljesCsoportSorrend.length >= 1 || beall.csakHianyzo) ? `
          <div class="szurobar" aria-label="Feladatlista szűrése">
            <details class="szuro-menu"${tobbSzemely ? "" : " hidden"}>
              <summary>${aktivSzemelyek.size ? `Személyek: ${aktivSzemelyek.size}/${teljesCsoportSorrend.length}` : "Személyek: mind"}</summary>
              <div class="szuro-panel">
                <button data-bszuro-mind class="${aktivSzemelyek.size ? "" : "aktiv"}">Minden személy</button>
                ${teljesCsoportSorrend.map(nev => `<button data-bszuro-szemely="${esc(nev)}" class="${aktivSzemelyek.has(nev) ? "aktiv" : ""}">${esc(kijelzoSzoveg(nev || "(nincs n\u00E9v)"))}</button>`).join("")}
              </div>
            </details>
            <button class="szuro-hiany${beall.csakHianyzo ? " aktiv" : ""}" data-bszuro-hiany>${beall.csakHianyzo ? "minden feladat" : "csak hiányzó"}</button>
          </div>` : "";

        /* Osszesito (osszecsukhato). Csak akkor, ha van tetel. */
        const maxO = (o.orakTetel[0] && o.orakTetel[0].ora) || 1;

        const dashHTML = beszerzok.length ? `
          <div class="dash${beall.osszCsukva ? " zart" : ""}" id="dash">
            <button class="dash-fej" data-mit="dash-toggle">
              <span class="cim">\u00D6sszes\u00EDt\u00E9s</span>
              <span class="osszefog"><b>${o.keszDb} / ${o.ossz} feladat k\u00E9sz</b> &middot; ${o.szaz}% k\u00E9szlet${o.oraSum > 0 ? " &middot; kb. " + o.oraSum + " munka\u00F3ra h\u00E1tra" : ""}</span>
              <span class="chev">&#9662;</span>
            </button>
            <div class="dash-body">
              <div class="hero">
                <div class="hero-main">
                  <div class="hero-line"><span class="hero-kicker">Teljes k\u00E9sz\u00FClts\u00E9g &middot; darab alapj\u00E1n</span><strong class="hero-percent">${o.szaz}%</strong></div>
                  <div class="hero-track"><i style="width:${Math.min(100, o.szaz)}%"></i></div>
                  <div class="hero-subline"><span>${o.vanSum} / ${o.kellSum} k\u00E9sz</span><span>${o.hianySum} db hi\u00E1nyzik${o.oraSum > 0 ? " &middot; kb. " + o.oraSum + " munka\u00F3ra" : ""}</span></div>
                </div>
                <div class="kpik">
                  <div class="kpi"><div class="k">MEGVAN / KELL</div><div class="v">${o.vanSum} <small>/ ${o.kellSum}</small></div></div>
                  <div class="kpi"><div class="k">K\u00C9SZ FELADAT</div><div class="v">${o.keszDb} <small>/ ${o.ossz}</small></div></div>
                  <div class="kpi ora"><div class="k">MUNKA\u00D3RA H\u00C1TRA</div><div class="v">${o.oraSum} <small>\u00F3ra</small></div></div>
                  <div class="kpi hi"><div class="k">HI\u00C1NYZIK \u00D6SSZ.</div><div class="v">${o.hianySum} <small>db</small></div></div>
                </div>
              </div>
              ${o.kozosAnyagok.length ? `<div class="blokk-cim">Közös alapanyagok</div>` + o.kozosAnyagok.slice(0, 6).map(x => {
                const ikon = statIconHTML(x.id, "kikon");
                const aria = `${x.nev}: ${x.van} / ${x.kell} db${x.munkazhato ? ", munka megnyitása" : ""}`;
                return `<div class="ksor${x.munkazhato ? " munkara-link" : ""}"${x.munkazhato ? ` data-munka="${esc(x.id)}" role="button" tabindex="0" aria-label="${esc(aria)}"` : ""}><span class="knev">${ikon}<span>${esc(kijelzoSzoveg(x.nev))}</span></span><span class="track"><i class="${x.szaz >= 100 ? "kesz" : ""}" style="width:${Math.min(100, x.szaz)}%"></i></span><span class="kdb${x.hiany ? " hiany" : ""}">${x.van} / ${x.kell}</span></div>`;
              }).join("") : ""}
              ${o.szemelyek.length ? `<div class="blokk-cim">K\u00E9sz\u00FClts\u00E9g szem\u00E9lyenk\u00E9nt</div>` + o.szemelyek.map(sz =>
                `<div class="psor" data-szemely="${esc(sz.nev)}" role="button" tabindex="0" aria-label="Ugrás ${esc(kijelzoSzoveg(sz.nev))} feladataihoz"><span class="nev">${esc(kijelzoSzoveg(sz.nev))}</span><span class="track"><i class="${sz.szaz >= 100 ? "kesz" : ""}" style="width:${Math.min(100, sz.szaz)}%"></i></span><span class="pc${sz.szaz >= 100 ? " kesz" : ""}">${sz.szaz}%</span></div>`
              ).join("") : ""}
              ${o.orakTetel.length ? `<div class="blokk-cim">Munkaóra-eloszlás (hol a legtöbb meló)</div>` + o.orakTetel.slice(0, 5).map(t => {
                const aria = `${t.nev}: ${t.ora} óra`;
                const link = t.munkazhato ? ` data-munka="${esc(t.id)}" role="button" tabindex="0" aria-label="${esc(aria)}"` : "";
                return `<div class="hsor"${link}><span class="hsor-term">${statIconHTML(t.id, "hikon")}<span class="nev">${esc(kijelzoSzoveg(t.nev))}</span></span><span class="track"><i style="width:${Math.round(t.ora / maxO * 100)}%"></i></span><span class="ora">${t.ora} ó</span></div>`;
              }).join("") : ""}
              <div class="statusz">
                <div class="blokk-cim" style="margin-top:0">Feladatok \u00E1llapota</div>
                <div class="sav">${o.keszDb ? `<div class="kesz" style="width:${Math.round(o.keszDb / o.ossz * 100)}%"></div>` : ""}${o.dolgozniDb ? `<div class="dolg" style="width:${Math.round(o.dolgozniDb / o.ossz * 100)}%"></div>` : ""}${o.gyartottDb ? `<div class="gyar" style="width:${Math.round(o.gyartottDb / o.ossz * 100)}%"></div>` : ""}</div>
                <div class="jel">
                  <span><i style="background:var(--green)"></i>K\u00E9sz ${o.keszDb}</span>
                  <span><i style="background:var(--brass)"></i>Dolgozni kell ${o.dolgozniDb}</span>
                  <span><i style="background:#b7a07f"></i>Gy\u00E1rtott ${o.gyartottDb}</span>
                </div>
              </div>
            </div>
          </div>` : "";

        stage.innerHTML = fulSorHTML() + `
          <div class="ujform">
            <span class="jwrap"><input id="fNev" autocomplete="off" spellcheck="false" placeholder="Kinek gy\u0171jt\u00F6m">
              <ul class="jlista" id="fNevLista" hidden></ul></span>
            <span class="jwrap"><input id="fTargy" autocomplete="off" spellcheck="false" placeholder="T\u00E1rgy">
              <ul class="jlista" id="fTargyLista" hidden></ul></span>
            <input id="fDb" class="qmezo" inputmode="numeric" placeholder="Darab">
            <button type="button" id="fKeszlethez" class="keszkapcs${beall.keszlethezAd ? " aktiv" : ""}"
              aria-pressed="${beall.keszlethezAd ? "true" : "false"}"
              title="Bekapcsolva a be\u00EDrt sz\u00E1mhoz hozz\u00E1adja a jelenlegi k\u00E9szletedet. Akkor kell, ha m\u00E1sik szkriptb\u0151l a HI\u00C1NYT m\u00E1solod \u00E1t, \u00E9s magadnak gy\u0171jtesz."
              >+ k\u00E9szlet</button>
            <button id="fAdd" class="add">Hozz\u00E1ad\u00E1s</button>
          </div>

          ${dashHTML}

          ${szuroHTML}

          <div class="csoportok">${csoportEszkozHTML}${csoportHTML}</div>

          <div id="allapot"></div>
          <p class="labj">A feladatlista a te feljegyz\u00E9sed. A \u201Emegvan\u201D a t\u00E1sk\u00E1b\u00F3l j\u00F6n, a munka\u00F3ra-becsl\u00E9s felszerel\u00E9st\u0151l f\u00FCgg.</p>
          <div class="alairas" aria-label="Crafted with heart by smcZ">Crafted with <span class="sziv" aria-hidden="true">♥</span> by smcZ</div>
        `;

        fulKotes();
        kotesek();
        alkalmazMagassag();
        if (host && host.hasAttribute("data-nativ")) nativMeret();
        felszinVissza(stage, felszin);
    }

    /* Uj tetel felvitele. nev + beirt targynev + darab. */
    /* A "k\u00E9szletem hozz\u00E1ad\u00E1sa" kapcsolo.

       Mas szkript a HIANYT adja: igeny minusz a te keszleted. Ez a szkript
       viszont a beirt szamot IGENYNEK veszi, es ujra levonja a keszletet,
       tehat ugyanaz a darab ketszer tunne el. Bekapcsolt allapotban ezert
       a beirt szamhoz hozzaadjuk a jelenlegi keszletedet, es igy a tarolt
       igeny lesz helyes.

       Masnak gyujtve kikapcsolva hagyod, mert ott nincs mit hozzaadni. */
    /* KOZOS PONT. Minden felvitel ezen megy at, az egyesevel felvitt
       tetel es a beillesztett gyorslista is. Korabban a tomeges ut sajat
       push-t hasznalt, ezert a kapcsolo ott nem ervenyesult. */
    function igenySzam(id, dbStr) {
        let db = Math.floor(Number(dbStr));
        if (!(db > 0)) return 0;
        if (beall.keszlethezAd) {
            const van = Number(keszlet(id));
            if (Number.isFinite(van) && van > 0) db += Math.floor(van);
        }
        return db;
    }

    function felvesz(nev, targyNevStr, dbStr) {
        const n = String(nev || "").trim();
        const id = nevbolId(targyNevStr);
        const db = igenySzam(id, dbStr);
        if (!n || !id || !(db > 0)) return false;
        beszerzok.push({ kulcs: ujKulcs(), nev: n, id: String(id), db: db, mikor: ma(),
                         piacraKint: false, piacraMennyiseg: 0, piacraAr: 0,
                         piacraEgysegar: 0, piacraMinimumAr: 0, piacraMikor: "" });
        ment();
        /* 0.5.39: az ujrarajzolas mar megorzi a beirt mezoket, ezert a
           felvitel utan itt kell kiuriteni oket, kulonben a most felvitt
           ertek visszakerulne az urlapba. A "+" sor ugyanugy becsukodik,
           mint korabban. */
        urlapTorles();
        rajzol();
        return true;
    }

    /* A "kell" mennyiség szerkesztése helyben. Enter/blur ment, Escape
       visszavon; a feladat kulcsa és a címzett változatlan marad. */
    function kellSzerkesztes(gomb) {
        const k = gomb && gomb.getAttribute("data-bszerk");
        const f = beszerzok.find(x => String(x.kulcs) === String(k));
        const szo = gomb && gomb.closest(".szo");
        if (!f || !szo || szo.querySelector(".kellEdit")) return;

        const input = document.createElement("input");
        input.className = "kellEdit";
        input.inputMode = "numeric";
        input.autocomplete = "off";
        input.value = String(f.db);
        input.setAttribute("aria-label", "Kell mennyiség");
        gomb.replaceWith(input);

        let lezart = false;
        const zar = mentse => {
            if (lezart) return;
            lezart = true;
            const uj = Math.floor(Number(input.value));
            if (mentse && Number.isFinite(uj) && uj > 0) {
                f.db = uj;
                ment();
            }
            rajzol();
        };
        input.addEventListener("keydown", e => {
            if (e.key === "Enter") { e.preventDefault(); zar(true); }
            else if (e.key === "Escape") { e.preventDefault(); zar(false); }
        });
        input.addEventListener("blur", () => zar(true));
        input.focus();
        input.select();
    }

    /* Címzett neve szerkeszthető a csoport fejlécében. A név nem a játékból
       jön, hanem a saját feladatlistánk része; átnevezéskor a szűrő- és a
       csoport-összecsukási beállítást is átvezetjük az új névre. */
    function nevSzerkesztes(gomb) {
        const regi = String(gomb && gomb.getAttribute("data-bnev-szerk") || "");
        const fej = gomb && gomb.closest(".bfej");
        if (!fej || fej.querySelector(".bnevEdit")) return;

        const input = document.createElement("input");
        input.className = "bnevEdit";
        input.type = "text";
        input.autocomplete = "off";
        input.maxLength = 80;
        input.value = kijelzoSzoveg(regi);
        input.setAttribute("aria-label", "Címzett neve");
        gomb.replaceWith(input);

        let lezart = false;
        const zar = mentse => {
            if (lezart) return;
            lezart = true;
            const uj = String(input.value || "").trim();
            if (mentse && uj && uj !== regi) {
                beszerzok.forEach(f => {
                    if (String(f.nev || "") === regi) f.nev = uj;
                });
                if (Array.isArray(beall.szemelySzuro)) {
                    beall.szemelySzuro = beall.szemelySzuro.map(x => String(x) === regi ? uj : String(x));
                }
                if (Object.prototype.hasOwnProperty.call(beall.csukott, regi)) {
                    const z = beall.csukott[regi];
                    delete beall.csukott[regi];
                    beall.csukott[uj] = z;
                }
                ment();
                beallMent();
            }
            rajzol();
        };
        input.addEventListener("keydown", e => {
            if (e.key === "Enter") { e.preventDefault(); zar(true); }
            else if (e.key === "Escape") { e.preventDefault(); zar(false); }
        });
        input.addEventListener("blur", () => zar(true));
        input.focus();
        input.select();
    }

    /* A személyenkénti összesítőből a részletes csoport fejlécéhez ugrik.
       Ha az aktuális szűrés éppen elrejtené ezt a személyt, csak a szükséges
       szűrőt oldjuk fel; a célcsoportot pedig kinyitjuk, hogy a kattintásnak
       mindig látható eredménye legyen. */
    function szemelyhezUgrik(nev) {
        const celNev = String(nev || "");
        if (!celNev || !gyoker) return;
        let ujrarajzol = false;

        if (Array.isArray(beall.szemelySzuro) && beall.szemelySzuro.length &&
            !beall.szemelySzuro.map(x => String(x)).includes(celNev)) {
            beall.szemelySzuro = [];
            ujrarajzol = true;
        }

        if (beall.csakHianyzo) {
            const elosztas = keszletElosztas();
            const vanLathato = beszerzok.some(f => String(f.nev || "") === celNev && !sorAdat(f, elosztas).kesz);
            if (!vanLathato) {
                beall.csakHianyzo = false;
                ujrarajzol = true;
            }
        }

        if (csoportCsukottE(celNev)) {
            beall.csukott[celNev] = false;
            ujrarajzol = true;
        }

        if (ujrarajzol) {
            beallMent();
            rajzol();
        }

        const ugrik = () => {
            const cel = [...gyoker.querySelectorAll(".bcsop")]
                .find(x => x.getAttribute("data-csoport-nev") === celNev);
            if (!cel || typeof cel.scrollIntoView !== "function") return;
            try { cel.scrollIntoView({ behavior: "smooth", block: "start" }); }
            catch (e) { cel.scrollIntoView(); }
        };
        if (typeof requestAnimationFrame === "function") requestAnimationFrame(ugrik);
        else setTimeout(ugrik, 0);
    }

    /* Per-render kotesek: autocomplete a felso urlapon es a "+" sorokon,
       plusz az Enter a darabszam-mezokben. A kattintasok es a szuro
       delegalva vannak (lasd esemenyek), ezek per-elem kotesek. */
    function kotesek() {
        const fNev = gyoker.getElementById("fNev");
        const fTargy = gyoker.getElementById("fTargy");
        const fDb = gyoker.getElementById("fDb");
        javasloElem(fNev, gyoker.getElementById("fNevLista"), beszerzoNevek, fTargy);
        javasloElem(fTargy, gyoker.getElementById("fTargyLista"), tetelNevek, fDb, true);
        gyorsImportKotes(fTargy);

        /* A teljes beszerzes torlese. Visszavonhatatlan, ezert ranezunk:
           a kerdesben ott a nev es a tetelek szama is. */
        const kk = gyoker.getElementById("fKeszlethez");
        if (kk) kk.addEventListener("click", () => {
            beall.keszlethezAd = !beall.keszlethezAd;
            beallMent();
            rajzol();
        });

        /* A teljes beszerzes torlese.

           A jelzo NEM data-btorol, mert azt a sorok sajat X gombja hasznalja.
           Az utkozes miatt egyetlen tetel torlese is kerdezett, pedig nem
           kellett volna. Megerosites sincs: a felesleges kerdes csak utban van. */
        gyoker.querySelectorAll("[data-bszemely]").forEach(g => {
            g.addEventListener("click", () => {
                const nev = g.getAttribute("data-bszemely") || "";
                beszerzok = beszerzok.filter(x => String(x.nev || "") !== String(nev));
                ment();
                rajzol();
            });
        });

        gyoker.querySelectorAll(".bujsor").forEach(sor => {
            const targy = sor.querySelector(".bujTargy");
            const lista = sor.querySelector(".bujLista");
            const dbm = sor.querySelector(".bujDb");
            javasloElem(targy, lista, tetelNevek, dbm, true);
            gyorsImportKotes(targy);
        });
    }

    /* -----------------------------------------------------------------
       DELEGALT ESEMENYEK. Egyszer kotve a gyokerre.
       ----------------------------------------------------------------- */
    function esemenyek() {
        /* Buborek: az ikonra (data-bubid) vagy a Munkara gombra (data-munka)
           huzva jelenik meg; kilepeskor eltunik; gorgeteskor is. */
        gyoker.addEventListener("mouseover", e => {
            const m = e.target.closest && e.target.closest("[data-munka],[data-bubid]");
            if (m) munkaBubMutat(m, m.dataset.munka || m.dataset.bubid);
        });
        gyoker.addEventListener("mouseout", e => {
            const m = e.target.closest && e.target.closest("[data-munka],[data-bubid]");
            if (!m) return;
            const ide = e.relatedTarget;
            if (ide && m.contains && m.contains(ide)) return;   /* csak az elemen belul mozog */
            munkaBubRejt();
        });
        gyoker.addEventListener("mouseover", e => {
            const p = e.target.closest && e.target.closest("[data-piac-info]");
            if (p) {
                munkaBubRejt();
                piacArBubMutat(p, p.getAttribute("data-piac-info"));
            }
        });
        gyoker.addEventListener("mouseout", e => {
            const p = e.target.closest && e.target.closest("[data-piac-info]");
            if (!p) return;
            const ide = e.relatedTarget;
            if (ide && p.contains && p.contains(ide)) return;
            piacArBubRejt();
        });
        gyoker.addEventListener("focusin", e => {
            const p = e.target.closest && e.target.closest("[data-piac-info]");
            if (p) piacArBubMutat(p, p.getAttribute("data-piac-info"));
        });
        gyoker.addEventListener("focusout", e => {
            const p = e.target.closest && e.target.closest("[data-piac-info]");
            if (p && (!e.relatedTarget || !p.contains(e.relatedTarget))) piacArBubRejt();
        });
        gyoker.addEventListener("scroll", munkaBubRejt, true);
        gyoker.addEventListener("scroll", piacArBubRejt, true);

        /* A Piacra gomb alatti egységár feladatonként mentődik. A mező
           változása nem indít sem piacot, sem gyártást; csak az adott
           feladat árstratégiáját módosítja. */
        gyoker.addEventListener("change", e => {
            const mező = e.target && e.target.closest && e.target.closest("[data-piac-ar]");
            if (!mező) return;
            const f = beszerzok.find(x => String(x.kulcs) === String(mező.getAttribute("data-piac-ar")));
            if (!f) return;
            const jo = piacArMezoMent(f, mező.value, true);
            if (!jo) {
                const alap = piacAlapAr(f);
                mező.value = piacBeallitottAr(f, alap) > 0 ? String(piacBeallitottAr(f, alap)) : "";
            }
        });

        gyoker.addEventListener("click", e => {
            const t = e.target.closest(
            "[data-tema],[data-piac-auto],[data-piac],[data-munka],[data-szemely],[data-btorol],[data-bplusz],[data-bszerk],[data-bnev-szerk],[data-bmozgat],[data-bcsuk],[data-bcsuk-all],[data-bszuro-hiany],[data-bszuro-mind],[data-bszuro-szemely],[data-mit=bezar],[data-mit=minimaliz],[data-mit=dash-toggle],#fAdd,.bujOk");
            if (!t) return;

            if (t.hasAttribute("data-piac-auto")) {
                beall.automataPiac = t.getAttribute("aria-pressed") !== "true";
                beallMent();
                t.setAttribute("aria-pressed", beall.automataPiac ? "true" : "false");
                t.classList.toggle("on", beall.automataPiac);
                t.textContent = beall.automataPiac ? "BE" : "KI";
                t.setAttribute("title", beall.automataPiac
                    ? "BE: a Piacra gomb után az Igen kattintást is elküldi."
                    : "KI: csak kitölti az aukciós ablakot; az Igen gombot te nyomod meg.");
                const sav = t.closest(".bar");
                if (sav) sav.classList.toggle("automata", beall.automataPiac);
                const keret = gyoker.querySelector(".frame");
                if (keret) keret.classList.toggle("automata", beall.automataPiac);
                allapot(beall.automataPiac ? "piac_auto_be" : "piac_auto_ki");
                return;
            }

            if (t.hasAttribute("data-tema")) {
                const tema = t.getAttribute("data-tema");
                if (["pult", "modern", "midnight"].includes(tema)) {
                    beall.tema = tema;
                    beallMent();
                    host.setAttribute("data-tema", tema);
                    gyoker.querySelectorAll(".tema-gomb").forEach(g =>
                        g.setAttribute("aria-pressed", g === t ? "true" : "false"));
                }
                return;
            }

            if (t.hasAttribute("data-piac")) {
                munkaBubRejt();
                piacArBubRejt();
                const f = beszerzok.find(x => String(x.kulcs) === String(t.getAttribute("data-piac")));
                if (f) piacraRak(f, t);
                return;
            }

            if (t.hasAttribute("data-munka")) { munkaBubRejt(); munkaNyit(t.getAttribute("data-munka"), t); return; }

            if (t.hasAttribute("data-szemely")) { szemelyhezUgrik(t.getAttribute("data-szemely")); return; }

            if (t.hasAttribute("data-bszerk")) { kellSzerkesztes(t); return; }

            if (t.hasAttribute("data-bnev-szerk")) { nevSzerkesztes(t); return; }

            if (t.hasAttribute("data-bszuro-hiany")) {
                beall.csakHianyzo = !beall.csakHianyzo;
                beallMent();
                rajzol();
                return;
            }

            if (t.hasAttribute("data-bszuro-mind")) {
                beall.szemelySzuro = [];
                beallMent();
                rajzol();
                return;
            }

            if (t.hasAttribute("data-bszuro-szemely")) {
                const nev = String(t.getAttribute("data-bszuro-szemely") || "");
                const nevek = csoportNevek();
                const most = new Set((Array.isArray(beall.szemelySzuro) ? beall.szemelySzuro : [])
                    .map(x => String(x)).filter(x => nevek.includes(x)));
                if (!most.size) {
                    beall.szemelySzuro = nev ? [nev] : [];
                } else {
                    if (most.has(nev)) most.delete(nev); else most.add(nev);
                    beall.szemelySzuro = most.size >= nevek.length ? [] : [...most];
                }
                beallMent();
                rajzol();
                return;
            }

            if (t.hasAttribute("data-bmozgat")) {
                csoportMozgat(t.getAttribute("data-bmozgat"), t.getAttribute("data-irany"));
                return;
            }

            if (t.hasAttribute("data-bcsuk-all")) {
                const mod = t.getAttribute("data-bcsuk-all");
                if (mod === "close") {
                    csoportNevek().forEach(nev => { beall.csukott[nev] = true; });
                } else {
                    beall.csukott = {};
                }
                beallMent();
                rajzol();
                return;
            }

            if (t.hasAttribute("data-bcsuk")) {
                const nev = t.getAttribute("data-bcsuk");
                const zart = !csoportCsukottE(nev);
                beall.csukott[nev] = zart;
                beallMent();
                const csoport = t.closest(".bcsop");
                const tartalom = csoport && csoport.querySelector(".bc-tartalom");
                if (tartalom) tartalom.hidden = zart;
                t.textContent = zart ? "\u25B6" : "\u25BE";
                t.setAttribute("aria-expanded", zart ? "false" : "true");
                t.setAttribute("title", "Csoport " + (zart ? "kinyit\u00E1sa" : "\u00F6sszecsuk\u00E1sa"));
                alkalmazMagassag();
                if (host && host.hasAttribute("data-nativ")) nativMeret();
                return;
            }

            if (t.hasAttribute("data-btorol")) {
                const k = t.getAttribute("data-btorol");
                beszerzok = beszerzok.filter(x => String(x.kulcs) !== k);
                ment(); rajzol(); return;
            }

            if (t.getAttribute("data-mit") === "dash-toggle") {
                beall.osszCsukva = !beall.osszCsukva;
                beallMent();
                const d = gyoker.getElementById("dash");
                if (d) d.classList.toggle("zart", beall.osszCsukva);   /* rerender nelkul */
                if (host && host.hasAttribute("data-nativ")) nativMeret();
                return;
            }

            if (t.getAttribute("data-mit") === "bezar" ||
                t.getAttribute("data-mit") === "minimaliz") { valt(false); return; }

            if (t.id === "fAdd") {
                const fNev = gyoker.getElementById("fNev");
                const fTargy = gyoker.getElementById("fTargy");
                const fDb = gyoker.getElementById("fDb");
                /* Ha a targymezoben felismert gyorslista all, a gomb ugyanazt
                   teszi, mint az Enter. Korabban csak az Enter rogzitette,
                   ami a gomb mellett kovetkezetlen volt. */
                if (gyorsImportFelvitel(fTargy)) return;
                felvesz(fNev.value, fTargy.value, fDb.value);
                return;
            }

            if (t.classList.contains("bujOk")) {
                const sor = t.closest(".bujsor");
                if (!sor) return;
                const bt = sor.querySelector(".bujTargy");
                if (gyorsImportFelvitel(bt)) return;
                felvesz(sor.dataset.bujsor, bt.value, sor.querySelector(".bujDb").value);
                return;
            }

            if (t.hasAttribute("data-bplusz")) {
                /* egyszerre egy "+" sor lehet nyitva; ujrarajzolas nelkul */
                const nev = t.getAttribute("data-bplusz");
                const csoport = t.closest(".bcsop");
                const tartalom = csoport && csoport.querySelector(".bc-tartalom");
                if (tartalom && tartalom.hidden) {
                    tartalom.hidden = false;
                    beall.csukott[nev] = false;
                    beallMent();
                    const kapcsolo = csoport.querySelector("[data-bcsuk]");
                    if (kapcsolo) {
                        kapcsolo.textContent = "\u25BE";
                        kapcsolo.setAttribute("aria-expanded", "true");
                        kapcsolo.setAttribute("title", "Csoport \u00F6sszecsuk\u00E1sa");
                    }
                }
                const sorok = [...gyoker.querySelectorAll(".bujsor")];
                const cel = sorok.find(s => s.dataset.bujsor === nev);
                const nyitva = cel && !cel.hidden;
                /* A "+" sor bezárása vagy másik sor megnyitása egy függő
                   gyorslistát is töröl, nehogy később váratlanul kerüljön
                   be a rossz címzetthez. */
                sorok.forEach(s => {
                    gyorsImportok.delete("plus:" + String(s.getAttribute("data-bujsor") || ""));
                    s.hidden = true;
                });
                if (cel && !nyitva) {
                    cel.hidden = false;
                    const targy = cel.querySelector(".bujTargy");
                    const dbm = cel.querySelector(".bujDb");
                    if (targy) targy.value = "";
                    if (dbm) dbm.value = "";
                    if (targy) targy.focus();
                }
                alkalmazMagassag();
                if (host && host.hasAttribute("data-nativ")) nativMeret();
                return;
            }
        });

        /* Enter a darabszam-mezokben visz fel; a targymezokben tovabblep.
           Ha az autocomplete mar kezelte az Entert (nyitott lista), a
           defaultPrevented igaz, es itt kihagyjuk. */
        gyoker.addEventListener("keydown", e => {
            if (e.key !== "Enter" && e.key !== " ") return;
            const kattinthato = e.target.closest && e.target.closest("[data-piac],[data-munka],[data-szemely]");
            if (kattinthato && kattinthato.getAttribute("role") === "button") {
                e.preventDefault();
                kattinthato.click();
                return;
            }
            if (e.key !== "Enter") return;
            if (e.defaultPrevented) return;
            const t = e.target;
            if (t.id === "fDb") {
                e.preventDefault();
                const b = gyoker.getElementById("fAdd"); if (b) b.click();
            } else if (t.id === "fNev") {
                e.preventDefault();
                const d = gyoker.getElementById("fTargy"); if (d) { d.focus(); d.select(); }
            } else if (t.classList.contains("bujDb")) {
                e.preventDefault();
                const sor = t.closest(".bujsor");
                if (sor) felvesz(sor.dataset.bujsor,
                    sor.querySelector(".bujTargy").value, sor.querySelector(".bujDb").value);
            } else if (t.id === "fTargy") {
                e.preventDefault();
                if (gyorsImportFelvitel(t)) return;
                const d = gyoker.getElementById("fDb"); if (d) { d.focus(); d.select(); }
            } else if (t.classList.contains("bujTargy")) {
                e.preventDefault();
                if (gyorsImportFelvitel(t)) return;
                const sor = t.closest(".bujsor");
                const d = sor && sor.querySelector(".bujDb"); if (d) { d.focus(); d.select(); }
            }
        });

        /* Esc zarja a nyitott "+" sort. */
        gyoker.addEventListener("keydown", e => {
            if (e.key !== "Escape") return;
            const nyitott = [...gyoker.querySelectorAll(".bujsor")].some(s => !s.hidden);
            if (nyitott) {
                gyoker.querySelectorAll(".bujsor").forEach(s => {
                    if (!s.hidden) gyorsImportok.delete("plus:" + String(s.getAttribute("data-bujsor") || ""));
                    s.hidden = true;
                });
            }
        });
    }

    /* -----------------------------------------------------------------
       ABLAK.
       ----------------------------------------------------------------- */
    function epit() {
        host = document.createElement("div");
        host.id = "smcz-beszerzo-host";
        host.hidden = true;
        host.setAttribute("data-tema", beall.tema);
        gyoker = host.attachShadow({ mode: "open" });

        const st = document.createElement("style");
        st.textContent = CSS;
        gyoker.appendChild(st);

        const frame = document.createElement("div");
        frame.className = "frame" + (beall.automataPiac ? " automata" : "");
        frame.innerHTML = `
          <div class="bar${beall.automataPiac ? " automata" : ""}">
            <span class="mark"><i class="mark-jel">\u2692\uFE0E</i><span>Beszerz\u00E9s-k\u00F6vet\u0151</span></span>
            <span class="ver">${esc(VERZIO)}${EPITES ? " &middot; " + esc(EPITES) : ""}</span>
            <button type="button" class="frissjel" id="frissJel" data-friss
              title="Kattints a friss\u00EDt\u00E9shez">&#9679; friss\u00EDt\u00E9s</button>
            <span class="live-dot" title="\u00C9l\u0151 k\u00E9szletfigyel\u00E9s" aria-label="\u00C9l\u0151 k\u00E9szletfigyel\u00E9s"></span>
            <div class="piac-auto" role="group" aria-label="Automata piacra rakás">
              <span>Automata piacra rakás</span>
              <button class="piac-auto-kapcs${beall.automataPiac ? " on" : ""}" type="button" data-piac-auto aria-pressed="${beall.automataPiac ? "true" : "false"}"
                title="BE: a Piacra gomb után az Igen kattintást is elküldi. KI: csak kitölti az aukciós ablakot.">${beall.automataPiac ? "BE" : "KI"}</button>
            </div>
            <div class="temak" role="group" aria-label="T\u00E9ma v\u00E1laszt\u00E1sa">
              <button class="tema-gomb" type="button" data-tema="pult" aria-pressed="${beall.tema === "pult" ? "true" : "false"}">Pult</button>
              <button class="tema-gomb" type="button" data-tema="modern" aria-pressed="${beall.tema === "modern" ? "true" : "false"}">Modern</button>
              <button class="tema-gomb" type="button" data-tema="midnight" aria-pressed="${beall.tema === "midnight" ? "true" : "false"}">\u00C9jf\u00E9li</button>
            </div>
            <div class="ablak-vezerlok" aria-label="Ablakvez\u00E9rl\u00E9s">
              <button class="mini" data-mit="minimaliz" title="T\u00E1lc\u00E1ra k\u00FCld\u00E9s" aria-label="T\u00E1lc\u00E1ra k\u00FCld\u00E9s">&minus;</button>
              <button class="zar" data-mit="bezar" title="Bez\u00E1r\u00E1s" aria-label="Bez\u00E1r\u00E1s">&times;</button>
            </div>
          </div>
          <div class="stage" id="stage"></div>
          <div class="grip" id="grip" title="Huzd a magassag allitasahoz"><span></span></div>
        `;
        gyoker.appendChild(frame);
        document.body.appendChild(host);

        frissJelKotes();
        frissJelFrissit();

        /* A jatek billentyuparancsai NE suljenek el gepeles kozben. */
        ["keydown", "keyup", "keypress"].forEach(t =>
            host.addEventListener(t, e => e.stopPropagation()));

        /* Barhol rakattintva a legfelso ablak fole jovunk. */
        host.addEventListener("pointerdown", elore, true);

        /* Ha JATEKABLAKRA kattintasz, visszaesunk az alap retegre, hogy az
           az ablak tenylegesen elenk kerulhessen.

           A jatek TERKEPERE vagy hatterere kattintva viszont NEM esunk
           hatra: ott nincs mi ele kerulne, es korabban emiatt csuszott a
           panel az osszes nyitott nativ ablak moge egyetlen terkepkattintastol.

           MERT ertekek: a nativ ablakok z-indexe 101-tol indul es felfele
           no, az elore() ezert a legmagasabb fole all be. */
        document.addEventListener("pointerdown", e => {
            if (!host || host.hidden) return;
            const ut = e.composedPath ? e.composedPath() : [];
            if (ut.indexOf(host) !== -1) return;

            let nativAblakra = false;
            try {
                const cel = e.target;
                nativAblakra = !!(cel && cel.closest &&
                    cel.closest('.tw2gui_window, [class*="tw2gui_window"]'));
            } catch (err) { nativAblakra = false; }

            /* A jatek a kattintott ablakot csak a sajat kezelese utan emeli
               a tetejere, ezert egy pillanattal kesobb szamolunk. */
            if (nativAblakra) setTimeout(hatra, 60);
        }, true);

        /* UJ nativ ablak nyitasakor is hatra kell lepnunk, kulonben a frissen
           nyitott ablak mogottunk jelenne meg.

           MERT teny: a jatek nem mindig ujonnan teszi be az ablakot a DOM-ba,
           ezert nem eleg az addedNodes figyelese. A nativ ablakok DARABSZAMAT
           nezzuk: ha nott, uj ablak nyilt. */
        let nativDb = document.querySelectorAll(".tw2gui_window").length;
        try {
            const figyelo = new MutationObserver(() => {
                if (!host || host.hidden) return;
                const most = document.querySelectorAll(".tw2gui_window").length;
                if (most > nativDb) setTimeout(hatra, 60);
                nativDb = most;
            });
            figyelo.observe(document.body, { childList: true, subtree: true });
        } catch (e) { /* enelkul is mukodik, csak kezzel kell elorehozni */ }

        huzas(frame.querySelector(".bar"));
        magassagFogo(frame.querySelector("#grip"));
        esemenyek();
        ruhaFigyelo();
        gombKi();
        telepitAblakKapcsolat();
    }

    function alkalmazMagassag() {
        const stage = gyoker && gyoker.getElementById("stage");
        /* Natv modban a natv ablak adja a meretet, a stage kitolti. */
        if (host && host.hasAttribute("data-nativ")) { if (stage) stage.style.height = ""; return; }
        if (stage && beall.magas) stage.style.height = beall.magas + "px";
    }

    /* ELORETER: alap retegszam alacsony, igy a jatek ablakai elenk
       kerulhetnek. Ha rank kattintanak, a legfelso ablak fole jovunk.
       (A panel elore()-jenek mintaja.) */
    /* A nativ ablakok legmagasabb retege. MERT ertekek: 101-tol indulnak es
       felfele nonek, a jatek a kattintott ablakot emeli a tetejere. */
    function nativMaxReteg() {
        let max = 100;
        try {
            document.querySelectorAll('[class*="window"],[class*="Window"]').forEach(el => {
                if (el === host) return;
                const z = parseInt(getComputedStyle(el).zIndex);
                if (!isNaN(z) && z > max) max = z;
            });
        } catch (e) { /* marad a 100 */ }
        return max;
    }

    function elore() {
        host.style.zIndex = String(Math.min(nativMaxReteg() + 1, 2000000));
    }

    /* Amikor mashova kattintasz (nem rank), visszaesunk az alap retegre,
       hogy ne uralkodjunk a jatek ablakai felett. Ez a lebego mod
       fokuszkezelese; a teljes, jatekba agyazott megoldas kesobb jon. */
    /* Hatrallepes: MINDEN nativ ablak ala.

       Ket megoldast probaltunk. Az elso az 1-es retegre allt, a masodik
       egyetlen reteggel a legfelso ala. A masodik MERVE rossznak bizonyult:
       ha harom ablak allt 101, 102 es 103 retegen, a panel a 102-re kerult,
       tehat a ket also ablak ala szorult, es ahol a panel takarta oket, mar
       rakattintani sem lehetett, igy elorehozni sem.

       Ezert a panel minden nativ ablak ala megy, es egyetlen rakattintassal
       jon elore. Ez a szokasos ablakkezeles, es kiszamithato marad.

       A terkepre vagy a hatterre kattintva viszont NEM lepunk hatra: ott
       nincs mi ele kerulne. */
    function hatra() {
        if (!host) return;
        host.style.zIndex = "1";
    }

    /* POZICIO: nyitaskor a MENTETT helyre all vissza; ha meg nincs mentve
       (elso nyitas), kozepre - nem a bal szelre. A szelesseg fix. */
    function allitPoz() {
        const vw = window.innerWidth, vh = window.innerHeight;
        const w = Math.min(780, vw * 0.96);
        let l = (beall.bal == null) ? Math.max(10, (vw - w) / 2) : beall.bal;
        let t = (beall.fent == null) ? 80 : beall.fent;
        l = Math.min(Math.max(0, l), Math.max(0, vw - w));
        t = Math.min(Math.max(0, t), Math.max(0, vh - 60));
        host.style.left = l + "px";
        host.style.top = t + "px";
        beall.bal = l; beall.fent = t;
    }

    /* -----------------------------------------------------------------
       NATIV ABLAK. Ahol letezik west.gui.Window (HU szerver: letezik),
       igazi jatekablakot hozunk letre, es abba tesszuk a tartalmunkat -
       igy a fejlecet, keretet, mozgatast ES a retegsorrendet a jatek
       kezeli (nincs tobbe "uralkodo" ablak). A panel skin-atvevo
       diszeit NEM emeljuk at: a natv ablak alap kerete pont megfelel.
       Ahol nincs west.gui.Window, marad a lebego mod.
       ----------------------------------------------------------------- */
    const ABLAK_ID = "smcz-beszerzo";
    const ABLAK_CIM = "Beszerz\u00E9s-k\u00F6vet\u0151";
    const HATTER = "#f0e6d1";   /* a content pane sajat, egyseges pergamen-hattere */
    let nativAblak = null, kozepKesz = false;

    function vanNativ() {
        try { return typeof jatek().west.gui.Window === "function"; } catch (e) { return false; }
    }

    /* A tartalomtarto lehet DOM-elem vagy jQuery-objektum is. */
    function tartalomTarto(abl) {
        const norm = x => (x && x.jquery ? x[0] : x);
        try { const c = norm(abl.getContentPane ? abl.getContentPane() : null); if (c && c.nodeType === 1) return c; } catch (e) { /* tovabb */ }
        try { const m = norm(abl.getMainDiv ? abl.getMainDiv() : null); if (m && m.nodeType === 1) return m; } catch (e) { /* tovabb */ }
        return null;
    }

    function nativNyitva() {
        try {
            const wm = jatek().wman;
            if (wm && wm.isWindowCreated) return !!wm.isWindowCreated(ABLAK_ID);
        } catch (e) { /* tovabb */ }
        return !!(nativAblak && host && document.contains(host) && !host.hidden);
    }

    function keszitNativ() {
        const W = jatek();
        const wm = W.wman;
        let abl = null, uj = false;

        try { if (wm && wm.isWindowCreated && wm.isWindowCreated(ABLAK_ID) && wm.getById) abl = wm.getById(ABLAK_ID); }
        catch (e) { /* tovabb */ }
        if (!abl) { try { if (wm && wm.open) { abl = wm.open(ABLAK_ID, ABLAK_CIM); uj = !!abl; } } catch (e) { /* tovabb */ } }
        if (!abl) { try { abl = new W.west.gui.Window(ABLAK_ID, ABLAK_CIM); uj = true; } catch (e) { return null; } }
        if (!abl) return null;
        nativAblak = abl;

        const hivd = (n, ...a) => { try { if (typeof abl[n] === "function") abl[n](...a); } catch (e) { /* nem baj */ } };
        hivd("setTitle", ABLAK_CIM);
        hivd("setResizeable", false);
        hivd("setMinSize", 560, 420);

        const tarto = tartalomTarto(abl);
        if (tarto) {
            try {
                tarto.style.padding = "0"; tarto.style.margin = "0"; tarto.style.overflow = "hidden";
                tarto.style.backgroundImage = "none";
                tarto.style.backgroundColor = HATTER;   /* egyseges hatter az EGESZ belso teruleten */
                if (getComputedStyle(tarto).position === "static") tarto.style.position = "relative";
            } catch (e) { /* nem baj */ }
            try { hivd("clearContentPane"); } catch (e) { /* nem baj */ }
            const t2 = tartalomTarto(abl) || tarto;
            try { t2.appendChild(host); }
            catch (e) { try { abl.appendToContentPane(host); } catch (e2) { return null; } }
        } else {
            try { abl.appendToContentPane(host); } catch (e) { return null; }
        }

        host.hidden = false;
        host.setAttribute("data-nativ", "1");
        host.style.zIndex = "auto";

        hivd("setSize", 600, 560);
        utolsoNativH = 560;
        hivd("doLayout");
        if (uj && !kozepKesz) { kozepKesz = true; hivd("center"); }
        hivd("bringToTop");
        nativHatter();
        rejtNativResize();
        rajzol();
        return abl;
    }

    function zarNativ() {
        try { const wm = jatek().wman; if (wm && wm.close) wm.close(ABLAK_ID); } catch (e) { /* tovabb */ }
        try { if (nativAblak && nativAblak.close) nativAblak.close(); } catch (e) { /* tovabb */ }
        nativAblak = null;
    }

    /* A natv ablak magassaga kovesse a tartalmat, hogy ne maradjon ures
       pergamen alul. Csak akkor meretez ujra, ha erdemben valtozott
       (igy ruhacsere/orafrissites nem ugral). */
    let utolsoNativH = 0;

    /* A natv ablak sajat pergamenje (tw2gui_window_inset, window2_bg) a sajat
       meleten marad, ezert kilatszik a mi lapunk szelen es meretezeskor ugral.
       A panel ezt az elemet nyujtja ki 100% 100%-kal; mi ugyanezt az elemet a
       SAJAT krem szinunkkel teritjuk be a keret belso szeleig, a kepet leveve,
       igy a teljes belso felulet egyseges es a natv pergamen eltunik. */
    function nativHatter() {
        if (!nativAblak) return;
        try {
            let fo = nativAblak.getMainDiv ? nativAblak.getMainDiv() : null;
            if (fo && fo.jquery) fo = fo[0];
            if (!fo || !fo.querySelector) return;
            const insetek = Array.prototype.slice.call(fo.querySelectorAll(".tw2gui_window_inset"));
            insetek.forEach(inset => {
                inset.style.backgroundImage = "none";
                inset.style.backgroundColor = HATTER;
                inset.style.backgroundSize = "100% 100%";
                inset.style.backgroundRepeat = "no-repeat";
            });
            /* A natív keret négy sarok-/oldalelemei nagy ablaknál ismétlődő
               képkockaként lóghatnak be a tartalom mellé. Ugyanazt a négy
               negyedre bontott illesztést használjuk, mint a panelben. */
            const negyzet = {
                tw2gui_bg_tl: "0% 0%", tw2gui_bg_tr: "100% 0%",
                tw2gui_bg_bl: "0% 100%", tw2gui_bg_br: "100% 100%"
            };
            Object.keys(negyzet).forEach(oszt => {
                const elemek = Array.prototype.slice.call(
                    fo.querySelectorAll(".tw2gui_window_border." + oszt)
                );
                elemek.forEach(el => {
                    el.style.backgroundRepeat = "no-repeat";
                    el.style.backgroundSize = "200% 200%";
                    el.style.backgroundPosition = negyzet[oszt];
                });
            });
        } catch (e) { /* nem baj */ }
    }

    /* A setResizeable(false) mellett egyes kliensverziok meghagyjak a natív
       jobb oldali átméretező/markoló réteget. Ez csak a saját ablak részfájában
       vizuálisan rejtőzik el; az ablak tartalma és a méretezési logika nem változik. */
    const NATIV_RESIZE_OSZTALYOK = [
        "tw2gui_window_resize", "tw2gui_window_resizer",
        "tw2gui_resize", "resizehandle", "tw2gui_window_sizer",
        "tw2gui_window_resize_handle"
    ];
    function rejtNativResize() {
        if (!nativAblak) return;
        try {
            let fo = nativAblak.getMainDiv ? nativAblak.getMainDiv() : null;
            if (fo && fo.jquery) fo = fo[0];
            if (!fo || !fo.querySelectorAll) return;
            NATIV_RESIZE_OSZTALYOK.forEach(oszt => {
                const elemek = Array.prototype.slice.call(fo.querySelectorAll("." + oszt));
                elemek.forEach(el => {
                    el.style.display = "none";
                    el.style.pointerEvents = "none";
                });
            });
        } catch (e) { /* nem baj */ }
    }

    function nativMeret() {
        if (!nativAblak || !host || !host.hasAttribute("data-nativ") || !gyoker) return;
        const frame = gyoker.querySelector(".frame");
        const tarto = tartalomTarto(nativAblak);
        if (!frame || !tarto) return;
        /* Ket kepkocka: a natv layout biztos elkeszul, mielott merunk. */
        requestAnimationFrame(() => requestAnimationFrame(() => {
            try {
                const tart = Math.max(frame.scrollHeight, frame.getBoundingClientRect().height); /* a TELJES tartalom */
                const belso = tarto.clientHeight || 0;                    /* a content pane belso magassaga */
                const keret = Math.max(30, (utolsoNativH || 560) - belso); /* fejlec + keret, MERVE nem becsulve */
                const maxH = Math.round(window.innerHeight * 0.94);
                const h = Math.max(160, Math.min(maxH, Math.round(tart + keret + 6)));
                if (Math.abs(h - utolsoNativH) < 8) {
                    rejtNativResize();
                    return;                                               /* apro valtozasra nem meretezunk */
                }
                utolsoNativH = h;
                if (nativAblak.setSize) nativAblak.setSize(600, h);
                if (nativAblak.doLayout) nativAblak.doLayout();
                nativHatter();   /* a meretezes utan ujra rateritjuk a sajat kremet */
                rejtNativResize();
            } catch (e) { /* nem baj */ }
        }));
    }

    function valt(be) {
        /* Saját keretes mód: a játéktól függetlenül ugyanazt a teljes,
           pontosan méretezett vizuális felületet használjuk. */
        latszik = !!be;
        if (host) host.hidden = !latszik;
      if (latszik) {
        if (!host.parentNode) document.body.appendChild(host);
        allitPoz();
        elore();
        rajzol();
        keszletFigyeloIndit();
      } else {
        keszletFigyeloLeallit();
        munkaBubRejt();
        piacArBubRejt();
      }
    }

    /* A saját keretes panel nem kerül be automatikusan a játék WindowManager
       listájába. Ettől a játék "összes bezárása" művelete különben nem tudna
       róla. Két, egymást kiegészítő hidat telepítünk:
         1) az egyértelműen close-all jellegű wman metódusokat,
         2) a játék látható, többnyelvű "összes/mind bezárása" gombját.
       Egyetlen ablak bezárását nem figyeljük, így más játékablak működését
       nem módosítjuk. */
    let ablakKapcsolatKesz = false;
    function globalisBezaroGomb(el) {
        if (!el || el === host || (host && host.contains && host.contains(el))) return false;
        const v = [];
        ["aria-label", "title", "data-action", "data-command", "data-cmd", "data-mit", "class"].forEach(a => {
            try { if (el.getAttribute) v.push(el.getAttribute(a) || ""); } catch (e) { /* nem baj */ }
        });
        try {
            if (el.tagName === "INPUT") v.push(el.value || "");
            else v.push(el.textContent || "");
        } catch (e) { /* nem baj */ }
        const s = v.join(" ").replace(/\s+/g, " ").trim();
        if (!s || s.length > 120) return false;
        const minden = /(?:all|alle|alles|mind|minden|osszes|összes|todos|wszyst|vse|vše|tüm|hepsi)/i;
        const bezar = /(?:close|bezar|bezár|schlie|cerr|zamkn|zavř|kapat)/i;
        return minden.test(s) && bezar.test(s);
    }

    function closeAllMetodus(nev) {
        const s = String(nev || "");
        return /(?:close|bezar|bezár|schlie|cerr|zamkn|zavř|kapat)/i.test(s) &&
               /(?:all|alle|alles|mind|minden|osszes|összes|todos|wszyst|vse|vše|tüm|hepsi)/i.test(s);
    }

    function telepitAblakKapcsolat() {
        if (ablakKapcsolatKesz) return;
        ablakKapcsolatKesz = true;

        try {
            const wm = jatek() && jatek().wman;
            const nevek = new Set();
            let p = wm;
            let szint = 0;
            while (p && szint++ < 4) {
                Reflect.ownKeys(p).forEach(k => { if (typeof k === "string") nevek.add(k); });
                p = Object.getPrototypeOf(p);
            }
            nevek.forEach(nev => {
                if (!closeAllMetodus(nev)) return;
                let fn = null;
                try { fn = wm[nev]; } catch (e) { fn = null; }
                if (typeof fn !== "function" || fn.__smczCloseAll) return;
                const csomagolt = function () {
                    try { return fn.apply(this, arguments); }
                    finally { if (latszik) valt(false); }
                };
                try {
                    Object.defineProperty(csomagolt, "__smczCloseAll", { value: true });
                    wm[nev] = csomagolt;
                } catch (e) { /* nem írható metódus: a DOM-híd még működik */ }
            });
        } catch (e) { /* a játék WindowManager-e kliensenként eltér */ }

        document.addEventListener("click", e => {
            if (!latszik || !host) return;
            const ut = e.composedPath ? e.composedPath() : [];
            if (ut.indexOf(host) !== -1) return;
            for (let i = 0; i < ut.length; i++) {
                const el = ut[i];
                if (!el || el.nodeType !== 1) continue;
                if (!globalisBezaroGomb(el)) continue;
                setTimeout(() => { if (latszik) valt(false); }, 0);
                return;
            }
        }, true);
    }

    /* Fejlecnel huzva mozgat. Pointer Events kell az erintokepernyos
       mozgatashoz is; a mousedown onmagaban telefonon nem eleg. */
    function huzas(bar) {
        let le = false, pid = null, ox = 0, oy = 0, sx = 0, sy = 0;
        const elenged = () => {
            if (!le) return;
            le = false; pid = null; bar.classList.remove("fog");
            const r = host.getBoundingClientRect();
            beall.bal = Math.round(r.left);
            beall.fent = Math.round(r.top);
            beallMent();
        };
        bar.addEventListener("pointerdown", e => {
            if (e.pointerType === "mouse" && e.button !== 0) return;
            if (e.target.closest(".zar,.mini,.tema-gomb,.piac-auto,.piac-auto-kapcs")) return;
            le = true; bar.classList.add("fog");
            pid = e.pointerId;
            const r = host.getBoundingClientRect();
            sx = r.left; sy = r.top; ox = e.clientX; oy = e.clientY;
            try { bar.setPointerCapture(e.pointerId); } catch (x) { /* nem baj */ }
            e.preventDefault();
        });
        window.addEventListener("pointermove", e => {
            if (!le || e.pointerId !== pid) return;
            host.style.left = Math.max(0, sx + (e.clientX - ox)) + "px";
            host.style.top = Math.max(0, sy + (e.clientY - oy)) + "px";
            e.preventDefault();
        }, { passive: false });
        window.addEventListener("pointerup", e => {
            if (e.pointerId === pid) elenged();
        });
        window.addEventListener("pointercancel", e => {
            if (e.pointerId === pid) elenged();
        });
    }

    /* Also fogo: a stage magassaga huzhato, a szelesseg fix. Erintessel is. */
    function magassagFogo(grip) {
        let le = false, pid = null, oy = 0, kezd = 0;
        const stage = () => gyoker.getElementById("stage");
        const elenged = () => {
            if (!le) return;
            le = false; pid = null;
            const s = stage();
            if (s) { beall.magas = Math.round(s.getBoundingClientRect().height); beallMent(); }
        };
        grip.addEventListener("pointerdown", e => {
            if (e.pointerType === "mouse" && e.button !== 0) return;
            const s = stage(); if (!s) return;
            le = true; pid = e.pointerId; oy = e.clientY; kezd = s.getBoundingClientRect().height;
            try { grip.setPointerCapture(e.pointerId); } catch (x) { /* nem baj */ }
            e.preventDefault();
        });
        window.addEventListener("pointermove", e => {
            if (!le || e.pointerId !== pid) return;
            const s = stage(); if (!s) return;
            const max = Math.max(200, window.innerHeight * 0.85);
            const uj = Math.min(max, Math.max(160, kezd + (e.clientY - oy)));
            s.style.height = uj + "px";
            e.preventDefault();
        }, { passive: false });
        window.addEventListener("pointerup", e => {
            if (e.pointerId === pid) elenged();
        });
        window.addEventListener("pointercancel", e => {
            if (e.pointerId === pid) elenged();
        });
    }

    /* Lebego beszerzes-launcher, huzhato, a pozicio GM-be mentve
       (a panel launcher-mintaja alapjan). */
    function gombKi() {
        if (document.getElementById("smcz-beszerzo-btn")) return;
        const b = document.createElement("button");
        b.id = "smcz-beszerzo-btn";
        b.type = "button";
        b.textContent = LAUNCHER_JEL;
        b.title = "Beszerz\u00E9s-k\u00F6vet\u0151";
        b.setAttribute("aria-label", "Beszerz\u00E9s-k\u00F6vet\u0151 megnyit\u00E1sa");

        let pos = { right: 2, top: 300 };
        try {
            const s = JSON.parse(GM_getValue(GOMB_POS, "null"));
            if (s && typeof s.top === "number") pos = s;
        } catch (e) { /* alap */ }

        b.style.cssText = [
            "position:fixed", "z-index:2147483001",
            "right:" + pos.right + "px", "top:" + pos.top + "px",
            "width:32px", "height:32px", "display:flex", "align-items:center", "justify-content:center",
            "background:#2f261d", "border:1px solid #b8863b", "border-radius:6px",
            "color:#d5a13a", "font:700 18px/1 \"Segoe UI Symbol\",\"Noto Sans Symbols 2\",sans-serif",
            "padding:0", "cursor:pointer", "user-select:none", "appearance:none",
            "box-shadow:0 1px 4px rgba(0,0,0,.6),0 0 0 rgba(213,161,58,0)"
        ].join(";");

        b.addEventListener("mouseenter", () => {
            b.style.boxShadow = "0 1px 5px rgba(0,0,0,.65),0 0 12px rgba(213,161,58,.38)";
            b.style.color = "#f2c45c";
        });
        b.addEventListener("mouseleave", () => {
            b.style.boxShadow = "0 1px 4px rgba(0,0,0,.6),0 0 0 rgba(213,161,58,0)";
            b.style.color = "#d5a13a";
        });

        let huz = false, mozgott = false, y0 = 0, x0 = 0, t0 = 0, r0 = 0;
        b.addEventListener("mousedown", e => {
            huz = true; mozgott = false;
            y0 = e.clientY; x0 = e.clientX;
            t0 = parseInt(b.style.top) || 0;
            r0 = parseInt(b.style.right) || 0;
            e.preventDefault();
        });
        document.addEventListener("mousemove", e => {
            if (!huz) return;
            const dy = e.clientY - y0, dx = e.clientX - x0;
            if (Math.abs(dy) > 3 || Math.abs(dx) > 3) mozgott = true;
            b.style.top = Math.max(0, t0 + dy) + "px";
            b.style.right = Math.max(0, r0 - dx) + "px";
        });
        document.addEventListener("mouseup", () => {
            if (!huz) return;
            huz = false;
            if (mozgott) {
                try {
                    GM_setValue(GOMB_POS, JSON.stringify({
                        top: parseInt(b.style.top) || 0,
                        right: parseInt(b.style.right) || 0
                    }));
                } catch (e) { /* nem baj */ }
            }
        });
        b.addEventListener("click", () => {
            if (mozgott) { mozgott = false; return; }
            const nyitva = latszik;
            valt(!nyitva);
        });

        document.body.appendChild(b);
    }

    /* -----------------------------------------------------------------
       INDITAS.
       ----------------------------------------------------------------- */
    function keszAJatek() {
        const G = jatek();
        return !!(G && (G.Bag || G.JobsModel));
    }
    let varo = 0;
    function indit() {
        if (keszAJatek() || varo > 40) {
            epit();
            /* Hattérben nezzuk, van-e ujabb valtozat. Nincs felugro ablak:
               a fejlecben jelenik meg egy kattinthato jelzes. */
            frissitestKeres();
            setInterval(frissitestKeres, FRISS_IDOKOZ);
            return;
        }
        varo++;
        setTimeout(indit, 500);
    }
    indit();
})();
