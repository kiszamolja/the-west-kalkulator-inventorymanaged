// ==UserScript==
// @name         The West Kereskedőpult
// @namespace    the-west-beszerzo-ingame
// @version      1.0.0
// @description  Gyűjtés és piac a játékon belül: kinek, miből mennyit gyűjtesz, és egy helyen adhatsz el, vehetsz és vehetsz át a játék piacán.
// @author       smcZ
// @homepageURL  https://kiszamolja.github.io/the-west-kalkulator-inventorymanaged/
// @updateURL    https://kiszamolja.github.io/the-west-kalkulator-inventorymanaged/the-west-kereskedopult.user.js
// @downloadURL  https://kiszamolja.github.io/the-west-kalkulator-inventorymanaged/the-west-kereskedopult.user.js
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
// @grant        GM_xmlhttpRequest
// @connect      kiszamolja.github.io
// @run-at       document-idle
// ==/UserScript==

/* =======================================================================
   Kereskedőpult (korábban Beszerzés-követő) - The West, játékbeli panel, 0.5.40

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
     · kesz tetel egy kattintassal az Eladas ful feladasi savjaba kerul:
       cimzett a megjegyzes, mennyiseg a feladatbol, a sor egysegara
       halvanyan javasolt ar; a feladas ket kattintas
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

    const VERZIO = "1.0.0";

    /* A fajlnev ALLANDO, nem tartalmaz verziot: igy a repoban mindig ugyanaz
       a fajl frissul, es a Tampermonkey kovetni tudja. A verzio csak a
       @version sorban es itt el. */
    const WEBOLDAL = "https://kiszamolja.github.io/the-west-kalkulator-inventorymanaged/";
    const FRISS_URL = WEBOLDAL + "the-west-kereskedopult.user.js";

    /* Hattérben nezzuk, van-e ujabb. Nincs felugro ablak: a fejlecben
       jelenik meg egy kattinthato jelzes. */
    const FRISS_IDOKOZ = 6 * 60 * 60 * 1000;
    /* t56: a frissites a jatek sajat ablakaban szol, naponta legfeljebb
       egyszer (a mestersegkalkulator bevalt utja, a felhasznalo dontese:
       csak ez az egy jelzes kell). A nap a tarolt kulcsban el. */
    const FRISS_NAP_KULCS = "smcz-beszerzo-frissites-nap";
    /* A TESZT-epito true-ra allitja: a fejlecben megjelenik egy proba gomb,
       ami a frissitesablakot mutatja, szerverhivas nelkul. Kiadasban false. */
    const FRISS_PROBA = false;

    /* A KIADAS VALTOZASAI. Ezt olvassa ki a MAR TELEPITETT regi valtozat a
       letoltott uj fajlbol, es ezt mutatja a frissitesablakban. Minden eles
       kiadas elott a felhasznaloval egyeztetve irjuk (a javaslat tole
       fuggetlenul nem kerul ki). Legfeljebb 3-5 rovid sor; egyszeru idezojel
       es visszaper ne legyen benne, mert a kiolvasas JSON-kent olvassa.
       A ket jelolo sor nem valtozhat. */
    /* VALTOZASOK KEZDETE */
    const VALTOZASOK = [
        "V\u00e9teli k\u00e9r\u00e9sek: felad\u00e1s, a saj\u00e1t k\u00e9r\u00e9seid, m\u00e1sok k\u00e9r\u00e9seinek teljes\u00edt\u00e9se azonnal vagy aj\u00e1nlattal.",
        "Az \u00c1tv\u00e9tel h\u00e1rom n\u00e9zetre bomlik: V\u00e1s\u00e1rl\u00e1saim, Elad\u00e1saim, V\u00e9teli k\u00e9r\u00e9seim; a j\u00e1t\u00e9k saj\u00e1t \u00e1tv\u00e9tele ut\u00e1n mag\u00e1t\u00f3l friss\u00fcl.",
        "Az Elad\u00e1s gyorsabban t\u00f6lt, ABC vagy legut\u00f3bbi sorrendben, a minimum\u00e1r a teljes mennyis\u00e9gre figyel.",
        "A visszajelz\u0151 sorok: a z\u00f6ld 3 m\u00e1sodperc m\u00falva elt\u0171nik, a piros marad."
    ];
    /* VALTOZASOK VEGE */
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

    /* t58: A FELADATLISTA KARAKTERENKENT ES VILAGONKENT KULON. A kulcs a
       TAROLO, a vilag (location.host) es a jatekos azonositoja
       (Character.playerId). MERT: a playerId szam, a Character-en olvashato.
       A konkret ertekek NEM kerulnek a forrasba, a kod futas kozben olvassa
       oket. Amig az azonosito nincs meg, a lista nem toltodik be es nem
       mentodik, igy nem kerulhet gazdatlan kulcs ala.
       A t57-ig kozos lista (a TAROLO sajat kulcsa) nem torlodik: az elso
       karakter, akinek meg nincs sajat listaja, EGYSZER atveszi, a
       jelzo miatt a masodik mar nem. */
    let beszerzok = [];
    let tarKulcsAkt = null;
    const ATVETEL_KULCS = TAROLO + "-atveve";

    function tarKulcs() {
        try {
            const id = Number(jatek().Character && jatek().Character.playerId);
            const h = String(location.host || "").toLowerCase();
            if (!(id > 0) || !h) return null;
            return TAROLO + ":" + h + ":" + id;
        } catch (e) { return null; }
    }

    function feladatokOlvas(nyers) {
        let ki = [];
        try {
            const b = JSON.parse(nyers);
            if (Array.isArray(b)) {
                ki = b.map(x => {
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
        } catch (e) { ki = []; }
        return ki;
    }

    /* Igaz, ha a betoltes megtortent (az azonosito megvan). */
    function feladatokBetolt() {
        const k = tarKulcs();
        if (!k) return false;
        /* Ami az azonosito megjotte elott kerult a listara, azt nem viszi el
           a kesoi betoltes: a betoltott lista vegere kerul, es mentodik. */
        const fuggo = tarKulcsAkt ? [] : beszerzok.slice();
        tarKulcsAkt = k;
        let nyers = null;
        try { nyers = GM_getValue(k, null); } catch (e) { nyers = null; }
        if (nyers == null) {
            let regi = null, atveve = "";
            try { regi = GM_getValue(TAROLO, null); atveve = GM_getValue(ATVETEL_KULCS, ""); } catch (e) { regi = null; }
            if (regi != null && !atveve) {
                nyers = regi;
                try { GM_setValue(ATVETEL_KULCS, "1"); GM_setValue(k, regi); } catch (e) { /* nem baj */ }
            }
        }
        beszerzok = nyers == null ? [] : feladatokOlvas(nyers);
        if (fuggo.length) {
            const van = new Set(beszerzok.map(x => String(x.kulcs)));
            fuggo.forEach(x => { if (!van.has(String(x.kulcs))) beszerzok.push(x); });
            ment();
        }
        return true;
    }

    function ment() {
        gyartTervUrit();
        if (!tarKulcsAkt) return;
        try { GM_setValue(tarKulcsAkt, JSON.stringify(beszerzok)); } catch (e) { /* nem baj */ }
    }

    /* A FULAK listaja. Uj ful egyetlen sor. A kulcs kerul a tarolba
       (beall.ful), ezert a "piac" kulcs marad, hiaba Eladas a felirata:
       igy a mentett beallitas nem vesz el. A "kesz: false" ful egyelore
       csak helyorzot mutat. */
    const FULAK = [
        { kulcs: "beszerzok", cimke: "Gy\u0171jt\u00E9s", kesz: true },
        { kulcs: "piac", cimke: "Elad\u00E1s", kesz: true },
        { kulcs: "vetel", cimke: "V\u00E9tel", kesz: false },
        { kulcs: "atvetel", cimke: "\u00C1tv\u00E9tel", kesz: true }
    ];
    function fulLetezik(k) { return FULAK.some(f => f.kulcs === k); }

    /* NEZETEK egy fulon belul. Ful kulcsa -> nezetek listaja. Ahol nincs
       bejegyzes, ott nincs kapcsolosor. A valasztott nezet a beall.nezet
       objektumba kerul, fulenkent. */
    const NEZETEK = {
        /* Az Atvetel ket, a natív ablakhoz hasonloan kulon kezelt fajtaja
           (t22). A nev azt mondja meg, kinek a teteleit veszed at. */
        atvetel: [
            { kulcs: "vasarlasaim", cimke: "V\u00E1s\u00E1rl\u00E1saim", kesz: true },
            { kulcs: "eladasaim", cimke: "Elad\u00E1saim", kesz: true },
            { kulcs: "kereseim", cimke: "V\u00E9teli k\u00E9r\u00E9seim", kesz: true }
        ],
        piac: [
            { kulcs: "keszletem", cimke: "K\u00E9szletem", kesz: true },
            { kulcs: "ajanlataim", cimke: "Aj\u00E1nlataim", kesz: true },
            { kulcs: "kerelmek", cimke: "M\u00E1sok k\u00E9r\u00E9sei", kesz: true }
        ],
        vetel: [
            { kulcs: "kinalat", cimke: "K\u00EDn\u00E1lat", kesz: true },
            { kulcs: "licitjeim", cimke: "Licitjeim", kesz: true },
            { kulcs: "megfigyeles", cimke: "Megfigyel\u00E9s", kesz: true },
            { kulcs: "kereseim", cimke: "K\u00E9r\u00E9seim", kesz: true }
        ]
    };

    let beall = {
        osszCsukva: false, magas: null, bal: null, fent: null, tema: "pult", csukott: {},
        szemelySzuro: [], csakHianyzo: false, ful: "beszerzok", keszlethezAd: false,
        nezet: {}, eladNapok: 1, eladJog: 2
    };
    try {
        const b = JSON.parse(GM_getValue(BEALL_KULCS, "null"));
        if (b && typeof b === "object") beall = Object.assign(beall, b);
    } catch (e) { /* marad az alap */ }
    /* t34: egyetlen tema maradt, a Pult. A regi ertekek ide esnek vissza. */
    beall.tema = "pult";
    if (!beall.csukott || typeof beall.csukott !== "object" || Array.isArray(beall.csukott)) beall.csukott = {};
    if (!Array.isArray(beall.szemelySzuro)) beall.szemelySzuro = [];
    if (typeof beall.csakHianyzo !== "boolean") beall.csakHianyzo = false;
    /* A regi automata kapcsolo (0.7.x) megszunt, a mentett erteket eldobjuk. */
    delete beall.automataPiac;
    if (!fulLetezik(beall.ful)) beall.ful = "beszerzok";
    if (!beall.nezet || typeof beall.nezet !== "object" || Array.isArray(beall.nezet)) beall.nezet = {};
    Object.keys(NEZETEK).forEach(fk => {
        if (!NEZETEK[fk].some(n => n.kulcs === beall.nezet[fk])) beall.nezet[fk] = NEZETEK[fk][0].kulcs;
    });
    if (typeof beall.keszlethezAd !== "boolean") beall.keszlethezAd = false;
    /* A regi Eladas ful beallitasai (t19-ig), mar nem hasznalja semmi. */
    delete beall.piacCel;
    delete beall.piacNapok;
    /* Az uj Eladas ful: az utoljara hasznalt napok (elsore 1) es lathatosag
       (2 barki, 1 szovetseg, 0 varos; elsore 2). */
    beall.eladNapok = Math.max(1, Math.min(7, Math.floor(Number(beall.eladNapok) || 1)));
    if ([0, 1, 2].indexOf(Number(beall.eladJog)) === -1) beall.eladJog = 2;
    beall.eladJog = Number(beall.eladJog);
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
    /* t75: a rajzolas soran igaz lesz, ha egy munkabol jovo sornak
       nincs hozama a Beans-ben; a zart panelnel tortent ruhacsere pedig
       megjelolve var a kovetkezo rajzolasig. */
    let oraHozamHianyzott = false;
    let ruhaCsereZartan = false;
    function oraKeresMost() {
        oraKeresMikor = Date.now();
        try {
            const JM = jatek().JobsModel;
            if (JM && typeof JM.updateSkillPoints === "function") JM.updateSkillPoints();
        } catch (e) { /* marad a regi ertek */ }
        setTimeout(rajzolHaSzabad, 2600);
    }
    /* Onmukodo kereses: percenkent legfeljebb egyszer, hogy ha a jatek
       frissites utan sem ad hozamot, ne ismetelje vegtelenul. */
    function oraKeresHaKell() {
        if (Date.now() - oraKeresMikor < 60000) return;
        oraKeresMost();
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
                if (!host || !host.parentNode || host.hidden) {
                    if (beall.orak !== false && bonuszosCsere(valtozas)) ruhaCsereZartan = true;
                    return;
                }
                if (ruhaOra) clearTimeout(ruhaOra);
                ruhaOra = setTimeout(() => { ruhaOra = null; rajzolHaSzabad(); }, 60);

                if (beall.orak === false || !bonuszosCsere(valtozas)) return;
                if (ruhaOra2) clearTimeout(ruhaOra2);
                ruhaOra2 = setTimeout(() => {
                    ruhaOra2 = null;
                    ruhaCsereZartan = false;
                    oraKeresMost();
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
    /* t78 JAVITAS (MrA, 2026-09-27): a figyelo csak a feladatok sajat
       targyait nezte, a recept-fa hozzavaloit nem (a fa a t64-ben jott), ezert
       munkabol kapott Cukor utan nem frissult a panel. Most a feladatok TELJES
       receptlancat is figyeli, minden szinten, akkor is, ha a fa epp nem
       bomlik ki alattuk. Csak a bongeszoben olvas (Bag), kerest nem kuld.
       A lanc a feladatlista valtozasakor szamolodik ujra.
       Regi: const ids = [...new Set(beszerzok.map(x => String(x.id)))].sort(); */
    let lancFigyeltKulcs = null, lancFigyeltIds = [];
    function figyeltIds() {
        const sajat = [...new Set(beszerzok.map(x => String(x.id)))].sort();
        const kulcs = sajat.join(",");
        if (kulcs !== lancFigyeltKulcs) {
            const osszes = new Set(sajat);
            const bejar = id => {
                const r = GYART_MAP.get(String(id));
                if (!r || !Array.isArray(r.g)) return;
                r.g.forEach(([aid]) => {
                    const k = String(aid);
                    if (osszes.has(k)) return;
                    osszes.add(k);
                    bejar(k);
                });
            };
            sajat.forEach(bejar);
            lancFigyeltKulcs = kulcs;
            lancFigyeltIds = [...osszes].sort();
        }
        return lancFigyeltIds;
    }
    function keszletAllapotKulcs() {
        const ids = figyeltIds();
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
        /* t75: a munka megvan a JobList-ben, de a JobsModel.Beans-ben
           nincs hozza hozam. Ilyenkor a jatek adata hianyzik vagy elavult
           (a fejleszto latta: hosszabb szallodai ido utan nem volt
           munkaora), ezert a rajzolas vegen frissitest kerunk. */
        if (elso.szazalek == null) { oraHozamHianyzott = true; return { szoveg: "", orak: null }; }

        const mind = f.sorok || [];
        if (mind.length && mind.every(s => munkaElerheto(s.munka) === false))
            return { szoveg: "nem elerheto", orak: null };

        const garantalt = Math.floor(elso.szazalek / 100);
        if (garantalt < 1) return { szoveg: "kicsi az esely", orak: null };
        const n = Math.ceil(hianyzo / garantalt);
        return { szoveg: "meg " + n + " ora munka", orak: n };
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

    /* t79: a panel minden visszajelzo soranak kozos szabalya. A zold 3 mp
       utan eltunik; a piros marad, amig a kovetkezo uzenet le nem csereli;
       az atmeneti sor (a vegen harom pont, pl. "K\u00FCld\u00E9s\u2026") nem tunik el
       magatol; uj uzenet ujrainditja az idozitot. A torles csak akkor
       tortenik meg, ha kozben nem jott masik uzenet (torol ellenorzi). */
    const UZENET_ZOLD_MP = 3000;
    const uzenetOrak = {};
    function uzenetIdozit(kulcs, szoveg, hiba, torol) {
        if (uzenetOrak[kulcs]) { clearTimeout(uzenetOrak[kulcs]); uzenetOrak[kulcs] = null; }
        if (!szoveg || hiba || /\u2026$/.test(szoveg)) return;
        uzenetOrak[kulcs] = setTimeout(() => { uzenetOrak[kulcs] = null; torol(szoveg); }, UZENET_ZOLD_MP);
    }

    /* A Gyujtes ful sora (t79): allapotban el, igy egy ujrarajzolas sem
       torli; a hiba piros, minden mas zold. */
    const allapotUzenet = { szoveg: "", hiba: false };
    function allapotHTML() {
        return `<div id="allapot"${allapotUzenet.szoveg && !allapotUzenet.hiba ? ' class="aok"' : ""}>${esc(allapotUzenet.szoveg)}</div>`;
    }
    function allapotKiir(szoveg, hiba) {
        allapotUzenet.szoveg = String(szoveg || "");
        allapotUzenet.hiba = !!hiba;
        const m = gyoker && gyoker.getElementById("allapot");
        if (m) {
            m.textContent = allapotUzenet.szoveg;
            m.classList.toggle("aok", !!allapotUzenet.szoveg && !allapotUzenet.hiba);
        }
        uzenetIdozit("allapot", allapotUzenet.szoveg, allapotUzenet.hiba, sz => {
            if (allapotUzenet.szoveg === sz) allapotKiir("", false);
        });
    }

    function allapot(kulcs) {
        const uzenetek = {
            terkep_hiba: "A terkep nem tolt be, probald ujra.",
            nincs_pont: "Erre a munkara nincs pont a terkeped kozeleben.",
            nincs_ablak: "A jatek munkaablaka most nem nyilt meg.",
            piac_nincs_kesz: "Ez a feladat még nincs kész, ezért nem tettem piacra.",
            piac_ar_min: "A megadott piaci ár nem lehet a játék minimuma alatt.",
            piac_nincs_targy: "Nem találom ezt a tárgyat a táskádban.",
            piac_nem_adhato: "Ez a tárgy nem adható el a piacon."
        };
        /* Mind hiba vagy akadaly: piros, marad. */
        allapotKiir(uzenetek[kulcs] || "", true);
    }

    /* Dinamikus, rövid visszajelzés a Gyujtes fulon. hiba: piros, marad. */
    function allapotSzoveg(szoveg, hiba) {
        allapotKiir(szoveg, hiba);
    }


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

            /* t54: a boltnak nem eladhato, de arverezheto targy piaci
               minimuma a vetelar fele, lefele kerekitve.
               MERVE (2026-09-21, jatekbeli buborekok): ahol sellable:
               false es auctionable: true (Vaquero, J. Cortina, Ron ladaja),
               a sell_price 0, a natív buborek pedig kulon ikonnal a
               vetelar felet irja ki ($250 az 500-as vetelarbol, a 12 eves
               Whiskeynel $31 a 62-bol). Ahol a bolt is veszi (Carl, Michael
               ladaja), ott ket nyil all: $500 / $250. Ahol egyik sem (2022-es
               Unnepi lada), ott nincs ar. A fejleszto kozlese: a Vaquero
               ladaja 249-ert nem adhato fel, 250-ert igen, ez fix.
               A kerekites iranya paratlan arnal a piacon nincs merve; a
               lefele kerekites a bolti arbol kovetkezik (Gabona: vetelar 3,
               a buborekban eladasi ar $1). */
            if (!(minimum > 0) && it.sellable === false && it.auctionable !== false) {
                const vetel = Number(it.price) || 0;
                if (vetel > 1) minimum = Math.floor(vetel / 2);
            }
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
    function targyLista() {
        const ki = new Map();
        /* t55: a keresoben csak MUNKABOL TALALHATO targy van: a munkak
           hozamai (JobsModel) es a kezzel felvett munka-tabla. A gyartott
           termekek (a 222-es nevsor es a jatek receptlistaja) kikerultek,
           mert a panel a beszerzesre figyel, gyartas nincs benne, es a
           gyartott termek a keresoben csak zavart okozott (a felhasznalo
           dontese, 2026-09-22; a pelda a Ragodohany volt). Ami gyarthato,
           de munkabol is talalhato, az a hozamok kozott marad. */
        const add = (id, tartalekNev) => {
            const s = String(id);
            if (ki.has(s)) return;
            let n = targyNev(s);
            /* A targyNev "#azonosito"-t ad, ha a jatek nem ismeri a targyat;
               a recepttablabol viszont tudjuk a nevet. */
            if ((!n || n.charAt(0) === "#") && tartalekNev) n = tartalekNev;
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
        /* t64: a gyarthato termekek visszakerultek a keresobe, hogy a
           receptfat fel lehessen venni feladatnak. */
        RECIPES.forEach(r => add(r.i, r.n));
        Object.keys(MUNKA_TABLA).forEach(id => add(id));
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
       AUTOCOMPLETE (a panel javasloElem-je). Harom szint: a nevvel kezdodo,
       a SZOKEZDO talalat, vegul a szo belsejeben levo; max 8,
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
            /* A "vas" beirasra az Olvasztott vas kimaradt, mert a nev
               belsejeben levo talalatok abc-sorrendben jottek, es a hatos
               korlatot mas nevek (Olvasztott olom, Lovassagi szablya) toltottek
               ki. Ezert a SZOKEZDO talalat elorebb kerul, mint a szo belseje. */
            const mind = nevek.filter(x => ekNelkul(x).includes(q));
            const elol = [], szoKezdo = [], belso = [];
            mind.forEach(x => {
                const n = ekNelkul(x);
                if (n.startsWith(q)) { elol.push(x); return; }
                if (n.split(/[^a-z0-9]+/).some(sz => sz.startsWith(q))) { szoKezdo.push(x); return; }
                belso.push(x);
            });
            const tal = elol.concat(szoKezdo, belso).slice(0, 8);
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

    /* =================================================================
       RECEPTADATOK, atveve a mestersegkalkulatorbol (the-west-panel 1.2.6).
       Ott mert es ellenorzott: 222 termek, alapanyag-darabszammal; egy
       gyartas 1 darabot ad; a t mezo a zarolas masodperce (26 termek).
       A kereso is ebbol veszi a gyarthato termekek neveit.
       ================================================================= */
const RECIPES = [
/* --- 1. Tábori szakács --- */
{i:"1856000",n:"Egy kancsó víz",p:1,l:"0/50/100",g:[["766000",1],["741000",1]]},
{i:"1940000",n:"Egy szelet torta",p:1,l:"0/100/100",g:[["745000",1],["703000",1],["706000",1]]},
{i:"1855000",n:"Faszén",p:1,l:"0/50/100",g:[["711000",1],["716000",1]]},
{i:"1862000",n:"Kukoricaliszt",p:1,l:"0/50/100",g:[["748000",1],["716000",1]]},
{i:"1941000",n:"Paradicsompüré",p:1,l:"0/10/10",g:[["716000",1],["793000",1]]},
{i:"54824000",n:"Lapos kenyér",p:1,l:"150/225/300",g:[["745000",4],["766000",7],["722000",2],["1859000",2]]},
{i:"1942000",n:"Paradicsomszósz",p:1,l:"10/20/20",g:[["1941000",1]]},
{i:"1943000",n:"Sült bab",p:1,l:"20/40/40",g:[["1942000",1],["746000",1]]},
{i:"53340000",t:604800,n:"15. születésnapi torta",p:[1,2,3,4],l:"50/100/150",g:[["53336000",1],["53337000",1],["53338000",1],["53339000",1]]},
{i:"52504000",n:"Desszert dekoráció",p:1,l:"50/100/150",g:[["792000",1],["766000",1],["1708000",2],["703000",4],["748000",3]]},
{i:"1864000",n:"Lekvár",p:1,l:"50/100/100",g:[["1811000",2],["1855000",1],["703000",2]]},
{i:"52518000",t:86400,n:"Pohárdesszert",p:[1,2,3,4],l:"50/100/150",g:[["52499000",1],["52505000",1],["52504000",1],["52501000",1],["52500000",1]]},
{i:"1863000",n:"Szalonnás bab",p:1,l:"50/100/100",g:[["746000",1],["700000",1],["1855000",1],["1859000",1]]},
{i:"53336000",n:"Tortalap",p:1,l:"50/100/150",g:[["766000",6],["745000",3],["703000",2],["792000",1]]},
{i:"52029000",n:"Vaj",p:1,l:"50/100/150",g:[["2432000",1]]},
{i:"1865000",n:"Maláta",p:1,l:"100/150/200",g:[["703000",1],["701000",1],["1856000",1]]},
{i:"1867000",n:"Pácolt steak",p:1,l:"100/150/200",g:[["710000",1],["1821000",1],["1826000",1]]},
{i:"1866000",n:"Tészta",p:1,l:"100/150/200",g:[["745000",1],["1856000",1]]},
{i:"52868000",n:"Édesítőszer",p:1,l:"100/150/200",g:[["766000",6],["703000",2],["791000",2]]},
{i:"1870000",n:"Hal alaplé",p:1,l:"150/225/300",g:[["705000",1],["717000",1],["1815000",1]]},
{i:"1868000",n:"Likőr",p:1,l:"150/225/300",g:[["792000",2],["1857000",1],["1811000",1]]},
{i:"1869000",n:"Torta",p:1,l:"150/225/300",g:[["706000",1],["1866000",2]]},
{i:"1872000",n:"Halászlé",p:1,l:"250/300/300",g:[["1941000",1],["1870000",1]]},
{i:"1871000",n:"Sült pulyka",p:1,l:"250/300/300",g:[["709000",1],["706000",2],["1855000",1],["791000",1]]},
{i:"1873000",n:"Zöldséges táska",p:1,l:"250/300/300",g:[["1810000",1],["1808000",1],["1866000",1]]},
{i:"53938000",n:"Cowboy pörkölt",p:1,l:"300/350/400",g:[["1874000",1],["1943000",2],["1808000",1],["2445000",1]]},
{i:"1874000",n:"Darálthús",p:1,l:"300/350/400",g:[["700000",2],["1858000",1],["1860000",1]]},
{i:"54379000",n:"Tüzes víz",p:1,l:"300/350/400",g:[["701000",6],["1811000",6],["1808000",3],["778000",1],["1856000",2]]},
{i:"1876000",n:"Füstölő",p:1,l:"350/425/500",g:[["702000",4],["1822000",1],["706000",2]]},
{i:"2516000",n:"Kukoricaropogós",p:1,l:"350/425/500",g:[["1862000",2],["2450000",2],["2432000",2]]},
{i:"1875000",n:"Szárított tőkehal",p:1,l:"350/425/500",g:[["705000",1],["795000",1]]},
{i:"1877000",n:"Szósz",p:1,l:"350/425/500",g:[["1941000",1],["1810000",1]]},
{i:"1878000",n:"Egy újságpapírba csomagolt hal.",p:1,l:"400/500/500",g:[["717000",4],["712000",4],["744000",2]]},
{i:"2736000",n:"Kaktuszlé",p:1,l:"450/475/500",g:[["1858000",1],["703000",2],["791000",2],["1856000",1]]},
{i:"1879000",n:"Úri vacsora",p:1,l:"450/500/500",g:[["719000",2],["1708000",3],["744000",1]]},
{i:"2518000",n:"Grog",p:1,l:"500/525/550",g:[["1865000",2],["2456000",2],["1826000",1],["2526000",1]]},
{i:"2517000",n:"Rágógumi",p:1,l:"500/525/550",g:[["1875000",1],["1980000",1],["2447000",1]]},
{i:"1980000",n:"Szárított hús",p:1,l:"500/525/550",g:[["700000",6],["710000",4],["1821000",4],["1708000",6]]},
{i:"1981000",n:"Gulyás",p:1,l:"525/550/575",g:[["1867000",1],["1941000",1],["721000",1],["778000",1]]},
{i:"2737000",n:"Méz",p:1,l:"550/575/600",g:[["2735000",1],["1835000",1]]},
{i:"1982000",n:"Oldalas",p:1,l:"550/575/600",g:[["710000",4],["1877000",4],["1855000",4]]},
{i:"2001000",n:"A legtüzesebb chili a vadnyugaton",p:1,l:"600/625/650",g:[["2000000",1],["1999000",4],["1874000",7],["721000",5]]},
{i:"1999000",t:604800,n:"Babkonzerv",p:1,l:"600/625/650",g:[["746000",7],["1902000",3],["716000",12],["721000",12],["747000",5]]},
{i:"2738000",n:"Mézbor",p:1,l:"600/650/699",g:[["2737000",2],["1856000",1],["2432000",2],["1862000",1]]},
{i:"51581000",t:345600,n:"Castello sajt",p:1,l:"650/700/750",g:[["2432000",6],["1708000",6],["2737000",2],["2447000",1]]},
{i:"52503000",t:345600,n:"Francia reggeli",p:1,l:"750/800/849",g:[["2162000",4],["2450000",2],["1811000",4],["745000",4]]},
{i:"51576000",n:"Koktél",p:1,l:"700/725/750",g:[["2456000",10],["2447000",5],["1834000",4],["2458000",1],["2736000",1],["1888000",1]]},
{i:"51580000",n:"Trágya",p:1,l:"700/750/800",g:[["1860000",10],["1809000",5],["1873000",1],["1943000",2],["1862000",1],["1866000",1],["797000",1]]},
{i:"51578000",n:"Bányász burger",p:1,l:"750/775/800",g:[["1855000",10],["710000",1],["1980000",3],["1866000",2],["1877000",4]]},
{i:"51579000",t:604800,n:"Gyümölcskoktél",p:1,l:"750/788/825",g:[["791000",4],["2737000",2],["1811000",10],["1865000",2],["2432000",1]]},
{i:"51577000",n:"Egy csomag ízesített rágógumi",p:1,l:"775/800/825",g:[["793000",2],["1811000",2],["2517000",1],["1825000",1],["1808000",2],["791000",2]]},
{i:"54599000",t:345600,n:"A tábori szakács emlékei",p:1,l:"825/850/875",g:[["52943000",2],["52936000",1],["2458000",3],["2454000",4],["2450000",3]]},
{i:"54488000",n:"Fehér tál",p:1,l:"850/875/900",g:[["1865000",2],["52951000",5],["52969000",3],["52964000",2]]},
{i:"54475000",t:604800,n:"Téli élelmiszerkészletek",p:1,l:"875/900/925",g:[["52933000",2],["2447000",2],["1810000",2],["52967000",2],["52965000",4],["1859000",2]]},
{i:"54476000",n:"Fűszeres kenyér",p:1,l:"900/925/950",g:[["52932000",3],["52933000",2],["52967000",2],["1902000",1],["52946000",2],["52950000",2],["1862000",2]]},
{i:"54532000",n:"Forró ital",p:1,l:"925/950/975",g:[["52967000",2],["52941000",4],["2456000",4],["2447000",3],["1826000",5]]},
{i:"54474000",n:"Szarvasgombás saláta",p:1,l:"950/975/999",g:[["52961000",2],["52932000",3],["52933000",3],["52946000",4],["1942000",2]]},
/* --- 2. Sarlatán --- */
{i:"1939000",n:"Füstszűrős cigaretta",p:2,l:"0/100/100",g:[["702000",1],["743000",1],["721000",1]]},
{i:"1880000",n:"Gyanta",p:2,l:"0/50/100",g:[["742000",1],["741000",1]]},
{i:"1881000",n:"Kén",p:2,l:"0/50/100",g:[["1818000",1]]},
{i:"1944000",n:"Nyers pirit",p:2,l:"0/10/10",g:[["708000",1]]},
{i:"1861000",n:"Tűzgyújtó szett",p:2,l:"0/50/100",g:[["708000",1],["716000",1],["704000",1]]},
{i:"54827000",n:"Gyógyszeres üveg",p:2,l:"150/225/300",g:[["741000",3],["792000",2],["1811000",4],["1941000",2]]},
{i:"1945000",n:"Pirit lemez",p:2,l:"10/20/20",g:[["1944000",1]]},
{i:"1946000",n:"Amulett",p:2,l:"20/40/40",g:[["1945000",1],["757000",1]]},
{i:"52028000",n:"Citrus kivonat",p:2,l:"50/100/150",g:[["791000",2],["792000",1]]},
{i:"1883000",n:"Fájdalomcsillapító",p:2,l:"50/100/100",g:[["1816000",1],["1861000",2]]},
{i:"1882000",n:"Kefe",p:2,l:"50/100/100",g:[["752000",1],["757000",1],["715000",1]]},
{i:"52505000",n:"Piros gyümölcslé",p:2,l:"50/100/150",g:[["1708000",2],["706000",2],["791000",1],["1811000",1],["2162000",3]]},
{i:"53337000",n:"Ételfesték",p:2,l:"50/100/150",g:[["792000",1],["748000",1],["1811000",3],["1825000",2]]},
{i:"52869000",n:"Gyümölcslé",p:2,l:"100/150/200",g:[["766000",3],["1811000",4],["706000",2]]},
{i:"1884000",n:"Kénsav",p:2,l:"100/150/200",g:[["1809000",1],["1881000",1]]},
{i:"1886000",n:"Petróleum",p:2,l:"100/150/200",g:[["752000",1],["1809000",1],["1944000",1]]},
{i:"1885000",n:"Tinta",p:2,l:"100/150/200",g:[["1825000",1],["1708000",1]]},
{i:"1887000",n:"Bálvány",p:2,l:"150/225/300",g:[["718000",2],["1944000",2],["1861000",1]]},
{i:"1889000",n:"Házipálinka",p:2,l:"150/225/300",g:[["1808000",3],["703000",2],["1861000",1],["701000",4]]},
{i:"1888000",n:"Párlat",p:2,l:"150/225/300",g:[["752000",1],["711000",3],["1857000",1]]},
{i:"1892000",n:"Gyümölcslikőr",p:2,l:"250/300/300",g:[["792000",1],["791000",5],["1860000",1]]},
{i:"1891000",n:"Rágódohány",p:2,l:"250/300/300",g:[["702000",1],["711000",2],["1880000",1]]},
{i:"1890000",n:"Tea",p:2,l:"250/300/300",g:[["706000",3],["1856000",1]]},
{i:"1893000",n:"Elem",p:2,l:"300/350/400",g:[["767000",1],["791000",2]]},
{i:"54382000",n:"Hadi orvosság",p:2,l:"300/350/400",g:[["712000",3],["764000",1],["771000",2],["792000",2],["1882000",2]]},
{i:"53941000",n:"Modern orvosság",p:2,l:"300/350/400",g:[["790000",1],["2450000",1],["2456000",1],["1884000",1],["1895000",1]]},
{i:"2525000",n:"Eltűnő tinta",p:2,l:"350/425/500",g:[["1885000",1],["1896000",1],["2444000",1]]},
{i:"1895000",n:"Gyógynövénylikőr",p:2,l:"350/425/500",g:[["1814000",1],["766000",1]]},
{i:"1894000",n:"Lúg",p:2,l:"350/425/500",g:[["711000",3],["766000",1],["1855000",1],["1944000",1]]},
{i:"1896000",n:"Papír",p:2,l:"350/425/500",g:[["744000",5],["1856000",1]]},
{i:"1897000",n:"Körző",p:2,l:"400/500/500",g:[["795000",3],["749000",2]]},
{i:"2730000",n:"Lenrost",p:2,l:"450/475/500",g:[["1882000",1],["766000",2],["1809000",2],["784000",3]]},
{i:"1898000",n:"Rózsavíz",p:2,l:"450/500/500",g:[["1835000",2],["1708000",2]]},
{i:"2526000",n:"Világító lőszer",p:2,l:"450/475/500",g:[["1884000",3],["1886000",2],["1821000",3],["2446000",3]]},
{i:"1983000",n:"Kígyóolaj",p:2,l:"500/525/550",g:[["1820000",1],["1894000",1],["1818000",1]]},
{i:"2527000",n:"Potencianövelő",p:2,l:"500/525/550",g:[["1889000",1],["2455000",2],["1812000",1],["2517000",1]]},
{i:"1984000",n:"Hajnövesztő szer",p:2,l:"525/550/575",g:[["1893000",1],["1886000",1],["1824000",1]]},
{i:"2731000",n:"Gyógyító baba",p:2,l:"550/575/600",g:[["1880000",1],["1897000",1],["1917000",2],["2730000",1]]},
{i:"1985000",n:"Különleges likőr",p:2,l:"550/575/600",g:[["1889000",1],["1895000",1],["741000",1]]},
{i:"2002000",t:604800,n:"Izzó keverék",p:2,l:"600/625/650",g:[["1983000",1],["1876000",3],["1814000",2],["752000",3]]},
{i:"2004000",n:"Legendás ellenanyag",p:2,l:"600/625/650",g:[["2003000",1],["2002000",4],["721000",4],["1895000",5]]},
{i:"2732000",n:"Szellemzene",p:2,l:"600/650/699",g:[["2436000",4],["1833000",1],["2525000",2],["1888000",1],["2730000",1]]},
{i:"51599000",n:"Álomcsapda",p:2,l:"650/700/750",g:[["757000",10],["1813000",3],["712000",1],["1917000",1],["767000",1]]},
{i:"51598000",t:345600,n:"Behozatali adóigazolás",p:2,l:"700/750/800",g:[["2443000",3],["2458000",1],["1923000",1],["1896000",1],["2525000",1]]},
{i:"51594000",n:"Csodaszer",p:2,l:"700/725/750",g:[["2162000",10],["2450000",2],["2432000",2],["2731000",1],["1895000",1],["1889000",1]]},
{i:"52506000",t:345600,n:"Lázcsillapító",p:2,l:"750/800/849",g:[["2432000",1],["1826000",1],["2456000",2],["2447000",1]]},
{i:"51596000",n:"Erős sav és lúg",p:2,l:"750/775/800",g:[["1884000",10],["1894000",10],["1821000",10],["794000",4],["766000",10]]},
{i:"51597000",t:604800,n:"Orvosság kínok ellen",p:2,l:"750/788/825",g:[["1876000",2],["702000",5],["2730000",1],["751000",1]]},
{i:"51595000",n:"Fém koponya",p:2,l:"775/800/825",g:[["2452000",3],["725000",5],["1827000",3],["1945000",5],["789000",4]]},
{i:"54601000",t:345600,n:"A sarlatán emlékei",p:2,l:"825/850/875",g:[["52958000",6],["52946000",3],["52932000",1],["2456000",2],["2432000",3],["733000",1]]},
{i:"54490000",n:"Kocsmai itallap",p:2,l:"850/875/900",g:[["1886000",2],["52946000",5],["52950000",2],["778000",3]]},
{i:"54480000",t:604800,n:"Méhviasz gyertya",p:2,l:"875/900/925",g:[["52959000",15],["52965000",3],["52967000",2],["52972000",2],["1930000",2]]},
{i:"54482000",n:"Tűzszerész készlet",p:2,l:"900/925/950",g:[["1986000",1],["1861000",2],["52974000",2],["52953000",3],["52956000",3],["52963000",2],["2456000",3]]},
{i:"54534000",n:"Fűszerkeverék",p:2,l:"925/950/975",g:[["2447000",2],["52932000",2],["52961000",1],["52942000",1],["52939000",2]]},
{i:"54481000",n:"Gyógyászati paróka",p:2,l:"950/975/999",g:[["52947000",3],["1883000",2],["52959000",8],["52941000",2],["52936000",4]]},
/* --- 3. Kovács --- */
{i:"1947000",n:"Grafit",p:3,l:"0/10/10",g:[["721000",1]]},
{i:"1858000",n:"Kés",p:3,l:"0/50/100",g:[["747000",1],["1899000",1],["716000",1]]},
{i:"1938000",n:"Megélezett fegyver",p:3,l:"0/100/100",g:[["716000",1],["704000",2]]},
{i:"1899000",n:"Olvasztott vas",p:3,l:"0/50/100",g:[["790000",1],["711000",1]]},
{i:"1859000",n:"Serpenyő",p:3,l:"0/50/100",g:[["790000",1],["747000",1]]},
{i:"54825000",n:"Horgászhorog",p:3,l:"150/225/300",g:[["790000",3],["2433000",3],["782000",1],["1917000",2]]},
{i:"1948000",n:"Grafitpor",p:3,l:"10/20/20",g:[["1947000",1]]},
{i:"1949000",n:"Grafit kenőanyag",p:3,l:"20/40/40",g:[["1948000",1],["707000",1]]},
{i:"53338000",n:"15. Születésnapi torta beszúró",p:3,l:"50/100/150",g:[["725000",1],["761000",1],["767000",2],["790000",2]]},
{i:"1900000",n:"Bajonett",p:3,l:"50/100/100",g:[["704000",3],["712000",1],["1858000",1]]},
{i:"52500000",n:"Egy szívószál és egy desszertes kanál",p:3,l:"50/100/150",g:[["747000",2],["790000",2],["711000",1],["766000",1]]},
{i:"1901000",n:"Kősúly",p:3,l:"50/100/100",g:[["716000",2],["1899000",1]]},
{i:"52027000",n:"Sütőforma",p:3,l:"50/100/150",g:[["778000",1],["747000",2]]},
{i:"1902000",n:"Acél",p:3,l:"100/150/200",g:[["721000",1],["1899000",1]]},
{i:"1903000",n:"Olvasztott ólom",p:3,l:"100/150/200",g:[["1827000",1],["1855000",1]]},
{i:"52871000",n:"Palackdugó",p:3,l:"100/150/200",g:[["747000",1],["790000",2],["711000",4],["1807000",1]]},
{i:"1904000",n:"Üllő",p:3,l:"100/150/200",g:[["1947000",1],["1902000",1],["1861000",1]]},
{i:"1906000",n:"Puha márvány",p:3,l:"150/225/300",g:[["720000",1],["1880000",1]]},
{i:"1907000",n:"Szegecs",p:3,l:"150/225/300",g:[["784000",3],["747000",1]]},
{i:"1905000",n:"Ólomfigura",p:3,l:"150/225/300",g:[["711000",3],["1827000",1],["1855000",1]]},
{i:"1910000",n:"Fegyverlánc",p:3,l:"250/300/300",g:[["767000",2],["763000",1]]},
{i:"1908000",n:"Kardmarkolat",p:3,l:"250/300/300",g:[["739000",2],["714000",2]]},
{i:"1909000",n:"Vizes rongy",p:3,l:"250/300/300",g:[["707000",2],["767000",2],["766000",1]]},
{i:"54380000",n:"Dekor kaktusz",p:3,l:"300/350/400",g:[["747000",2],["790000",2],["756000",1],["1904000",2]]},
{i:"53939000",n:"Fém bögre",p:3,l:"300/350/400",g:[["1902000",2],["761000",2],["2433000",2]]},
{i:"1911000",n:"Markolat",p:3,l:"300/350/400",g:[["711000",1],["742000",1],["784000",1],["1880000",1]]},
{i:"2522000",n:"A Nyugati",p:3,l:"350/425/500",g:[["1912000",1],["2430000",1]]},
{i:"1913000",n:"Acélpenge",p:3,l:"350/425/500",g:[["761000",1],["721000",2],["1902000",1]]},
{i:"1914000",n:"Fegyver díszítés",p:3,l:"350/425/500",g:[["1791000",1]]},
{i:"1912000",n:"Revolver öntőforma",p:3,l:"350/425/500",g:[["747000",1],["721000",2],["1947000",2],["1899000",1]]},
{i:"1915000",n:"Zárt geoda",p:3,l:"400/500/500",g:[["716000",1],["742000",1],["761000",1]]},
{i:"2523000",n:"Bicska",p:3,l:"450/475/500",g:[["1914000",1],["2445000",1]]},
{i:"1916000",n:"Polírozó kő",p:3,l:"450/500/500",g:[["716000",1],["752000",2],["724000",1]]},
{i:"2733000",n:"Üveg",p:3,l:"450/475/500",g:[["1903000",1],["1906000",1],["720000",1],["1855000",1]]},
{i:"1989000",n:"Rozsdamentes csavarok",p:3,l:"500/525/550",g:[["1903000",1],["1899000",1],["1902000",1]]},
{i:"2524000",n:"Wells Fargo nyereg",p:3,l:"500/525/550",g:[["1911000",1],["2439000",1],["2520000",1]]},
{i:"1990000",n:"Laposüveg",p:3,l:"525/550/575",g:[["725000",1],["1904000",1]]},
{i:"1991000",n:"Modern páncélzat",p:3,l:"550/575/600",g:[["1899000",1],["1907000",1],["1904000",2]]},
{i:"2735000",n:"Mézprés",p:3,l:"550/575/600",g:[["711000",3],["790000",1],["1911000",2],["747000",1]]},
{i:"2010000",n:"Arany zenedoboz",p:3,l:"600/625/650",g:[["2009000",1],["2008000",4],["728000",4],["767000",5]]},
{i:"2734000",n:"Lámpás",p:3,l:"600/650/699",g:[["2733000",3],["1914000",2],["784000",1],["1899000",2]]},
{i:"2008000",t:604800,n:"Órásmester szerszámai",p:3,l:"600/625/650",g:[["765000",2],["1925000",2],["1913000",2],["739000",3],["1989000",1]]},
{i:"51593000",t:345600,n:"Lovassági szablya",p:3,l:"650/700/750",g:[["1913000",2],["1911000",1],["1855000",4]]},
{i:"51592000",n:"Kereső",p:3,l:"700/750/800",g:[["2733000",1],["711000",2],["1880000",1],["1907000",2],["1902000",1],["2453000",1]]},
{i:"52497000",t:345600,n:"Mesteri sarkantyúk",p:3,l:"750/800/849",g:[["2433000",1],["2442000",1],["790000",2],["747000",1]]},
{i:"51588000",n:"Rejtett bomba",p:3,l:"700/725/750",g:[["1832000",5],["2437000",2],["2451000",5],["737000",10],["2739000",1],["1915000",1]]},
{i:"51591000",t:604800,n:"Edzett acél",p:3,l:"750/788/825",g:[["1904000",1],["1902000",3],["761000",2],["1856000",4],["1855000",5]]},
{i:"51590000",n:"Fejlesztett szerszámkészlet",p:3,l:"750/775/800",g:[["1989000",3],["1913000",3],["1907000",3],["756000",2],["2433000",4]]},
{i:"51589000",n:"Szabó próbabábúja",p:3,l:"775/800/825",g:[["1905000",1],["712000",6],["715000",6],["2445000",3],["2435000",3]]},
{i:"54598000",t:345600,n:"A kovács emlékei",p:3,l:"825/850/875",g:[["2433000",3],["1827000",6],["1813000",2],["790000",3],["725000",1]]},
{i:"54487000",n:"Kovács üllője",p:3,l:"850/875/900",g:[["1904000",2],["52967000",2],["52954000",5],["761000",3]]},
{i:"54472000",t:604800,n:"Állatok nagy atlasza",p:3,l:"875/900/925",g:[["52934000",2],["52971000",2],["52975000",15],["1885000",2],["1813000",2]]},
{i:"54473000",n:"Játék pisztoly",p:3,l:"900/925/950",g:[["52938000",2],["52970000",4],["52939000",2],["52935000",1],["1893000",1],["2446000",2],["1914000",2]]},
{i:"54531000",n:"Vödör",p:3,l:"925/950/975",g:[["52954000",6],["52949000",2],["52937000",3],["2457000",2],["2433000",4]]},
{i:"54471000",n:"Pót alkatrészek",p:3,l:"950/975/999",g:[["52953000",4],["1907000",2],["52949000",3],["52958000",6],["52970000",4],["52964000",2]]},
/* --- 4. Istállómester --- */
{i:"1917000",n:"Bőrszíj",p:4,l:"0/50/100",g:[["1950000",1],["765000",1]]},
{i:"1950000",n:"Cserzett bőr",p:4,l:"0/10/10",g:[["712000",1]]},
{i:"1857000",n:"Kulacs",p:4,l:"0/50/100",g:[["740000",1],["714000",1]]},
{i:"1937000",n:"Táska",p:4,l:"0/100/100",g:[["707000",2],["704000",1]]},
{i:"1860000",n:"Vágódeszka",p:4,l:"0/50/100",g:[["711000",1]]},
{i:"54826000",n:"Késvédő tok",p:4,l:"150/225/300",g:[["747000",3],["739000",2],["724000",2],["1880000",2]]},
{i:"1951000",n:"Bőrtáska",p:4,l:"10/20/20",g:[["1950000",1]]},
{i:"1952000",n:"Takarmányos táska",p:4,l:"20/40/40",g:[["1951000",1],["701000",1]]},
{i:"52501000",n:"Egy fából készült tortaállvány",p:4,l:"50/100/150",g:[["711000",2],["784000",1],["747000",1],["742000",1]]},
{i:"52030000",n:"Fa habverő ",p:4,l:"50/100/150",g:[["711000",3],["767000",2]]},
{i:"1918000",n:"Patkolt pata",p:4,l:"50/100/100",g:[["754000",1],["784000",2],["747000",1]]},
{i:"1919000",n:"Takarmány",p:4,l:"50/100/100",g:[["701000",3],["1809000",3],["766000",3],["706000",2]]},
{i:"53339000",n:"Torta dekorációk",p:4,l:"50/100/150",g:[["754000",3],["712000",2],["704000",3],["708000",2]]},
{i:"1922000",n:"Bőrborítás",p:4,l:"100/150/200",g:[["1820000",1],["1880000",1]]},
{i:"1920000",n:"Csupasz nyereg",p:4,l:"100/150/200",g:[["787000",1],["1858000",1]]},
{i:"52870000",n:"Palackfedél",p:4,l:"100/150/200",g:[["712000",2],["707000",2],["756000",1]]},
{i:"1921000",n:"Töltőanyag",p:4,l:"100/150/200",g:[["707000",2],["704000",4],["701000",4]]},
{i:"1924000",n:"Beállítatlan iránytű",p:4,l:"150/225/300",g:[["766000",1],["784000",1]]},
{i:"1923000",n:"Billogvas",p:4,l:"150/225/300",g:[["790000",1],["721000",2],["1809000",2],["1861000",1]]},
{i:"1925000",n:"Kengyel",p:4,l:"150/225/300",g:[["790000",1],["761000",1],["1917000",1]]},
{i:"1928000",n:"Hálózsák",p:4,l:"250/300/300",g:[["1809000",3],["715000",1],["1824000",2]]},
{i:"1927000",n:"Kantár",p:4,l:"250/300/300",g:[["749000",2],["767000",1],["1860000",1]]},
{i:"1926000",n:"Sarkantyú",p:4,l:"250/300/300",g:[["739000",3],["789000",1],["742000",1]]},
{i:"54381000",n:"Bőrláda",p:4,l:"300/350/400",g:[["712000",3],["742000",1],["739000",2],["711000",8],["1922000",2]]},
{i:"1929000",n:"Lótakaró",p:4,l:"300/350/400",g:[["724000",1],["714000",1],["1858000",1]]},
{i:"53940000",n:"Nyeregülés",p:4,l:"300/350/400",g:[["1922000",1],["1917000",1],["2445000",1]]},
{i:"1930000",n:"Díszítő szegecsek",p:4,l:"350/425/500",g:[["720000",1],["1827000",1],["725000",1]]},
{i:"1931000",n:"Szekér darab",p:4,l:"350/425/500",g:[["711000",3],["784000",2],["747000",1]]},
{i:"1932000",n:"Szekérkerék",p:4,l:"350/425/500",g:[["790000",2],["711000",3],["784000",1]]},
{i:"2519000",n:"Versenykocsi",p:4,l:"350/425/500",g:[["1931000",1],["1932000",1],["2457000",1]]},
{i:"1933000",n:"Célzóvíz",p:4,l:"400/500/500",g:[["1708000",2],["794000",1],["1857000",1]]},
{i:"2739000",n:"Jegyzettömb",p:4,l:"450/475/500",g:[["1922000",1],["1896000",1]]},
{i:"2520000",n:"Megjavított nyereg",p:4,l:"450/475/500",g:[["1920000",1],["1922000",1],["752000",1],["2433000",3]]},
{i:"1934000",n:"Nyeregkápa",p:4,l:"450/500/500",g:[["720000",2],["1880000",1]]},
{i:"1986000",n:"Finom bőrzsír",p:4,l:"500/525/550",g:[["752000",1],["1814000",1],["791000",1]]},
{i:"2521000",n:"Kárpit",p:4,l:"500/525/550",g:[["1929000",1],["2435000",2],["1825000",1],["2523000",1]]},
{i:"1987000",n:"Erős gyeplő",p:4,l:"525/550/575",g:[["1917000",1],["1930000",1]]},
{i:"1988000",n:"Tartós pisztolytáska",p:4,l:"550/575/600",g:[["1950000",1],["1921000",1],["1922000",1]]},
{i:"2740000",n:"Utazókocsi",p:4,l:"550/575/600",g:[["1932000",2],["1931000",1],["2730000",1]]},
{i:"2741000",n:"Lőszeröv",p:4,l:"600/650/699",g:[["1950000",2],["2433000",1],["2446000",1],["1986000",1]]},
{i:"2005000",t:604800,n:"Pehelykönnyű bőr",p:4,l:"600/625/650",g:[["1986000",1],["1894000",3],["1950000",5],["1922000",3]]},
{i:"2007000",n:"Pony expressz lószerszámok",p:4,l:"600/625/650",g:[["2006000",1],["2005000",4],["1930000",5],["724000",6]]},
{i:"51587000",t:345600,n:"Bőrkabát",p:4,l:"650/700/750",g:[["715000",2],["724000",2],["1824000",3],["1922000",4]]},
{i:"52502000",t:345600,n:"Bőr nyeregtáska",p:4,l:"750/800/849",g:[["2445000",1],["1824000",2],["2457000",1]]},
{i:"51582000",n:"Maria Roalstad postakocsija",p:4,l:"700/725/750",g:[["2163000",10],["779000",1],["2740000",1],["1921000",1],["1986000",1],["1907000",1]]},
{i:"51586000",n:"Páncél a hátasnak",p:4,l:"700/750/800",g:[["1991000",1],["1929000",3]]},
{i:"51584000",n:"Szövetdoboz",p:4,l:"750/775/800",g:[["1929000",3],["1922000",3],["1950000",3],["1824000",8],["2455000",10]]},
{i:"51585000",t:604800,n:"Öv szíjakkal",p:4,l:"750/788/825",g:[["1917000",3],["2005000",1],["1907000",1],["761000",1]]},
{i:"51583000",n:"A The West zenéje",p:4,l:"775/800/825",g:[["1813000",3],["2436000",5],["2739000",2],["1885000",3]]},
{i:"54600000",t:345600,n:"Az istállómester emlékei",p:4,l:"825/850/875",g:[["1820000",2],["2453000",2],["2455000",3],["2442000",3],["52934000",1]]},
{i:"54489000",n:"Csomag vászonképpel",p:4,l:"850/875/900",g:[["1922000",2],["52964000",5],["52952000",3],["52936000",2]]},
{i:"54477000",t:604800,n:"Lófelszerelés",p:4,l:"875/900/925",g:[["52952000",2],["2457000",2],["52963000",5],["52945000",2],["52942000",2],["52935000",1]]},
{i:"54478000",n:"Kengyelbőr",p:4,l:"900/925/950",g:[["52937000",1],["52941000",2],["52935000",1],["1877000",1],["747000",1],["2453000",2],["1951000",2]]},
{i:"54533000",n:"Fonal",p:4,l:"925/950/975",g:[["52975000",6],["52971000",2],["52958000",5],["2431000",2],["2445000",2]]},
{i:"54479000",n:"Mobil sátor",p:4,l:"950/975/999",g:[["52962000",5],["52966000",4],["52942000",3],["1917000",2],["2730000",2]]}
];

const RECEPT_TEKERCS = {
  "1855000":20000000,"1856000":20002000,"1857000":20060000,"1858000":20042000,"1859000":20040000,"1860000":20062000,
  "1861000":20020000,"1862000":20001000,"1863000":20003000,"1864000":20004000,"1865000":20005000,"1866000":20006000,
  "1867000":20007000,"1868000":20008000,"1869000":20009000,"1870000":20010000,"1871000":20011000,"1872000":20012000,
  "1873000":20013000,"1874000":20014000,"1875000":20015000,"1876000":20016000,"1877000":20017000,"1878000":20018000,
  "1879000":20019000,"1880000":20022000,"1881000":20021000,"1882000":20023000,"1883000":20024000,"1884000":20025000,
  "1885000":20026000,"1886000":20027000,"1887000":20028000,"1888000":20029000,"1889000":20030000,"1890000":20031000,
  "1891000":20032000,"1892000":20033000,"1893000":20034000,"1894000":20035000,"1895000":20036000,"1896000":20037000,
  "1897000":20038000,"1898000":20039000,"1899000":20041000,"1900000":20043000,"1901000":20044000,"1902000":20045000,
  "1903000":20046000,"1904000":20047000,"1905000":20048000,"1906000":20049000,"1907000":20050000,"1908000":20051000,
  "1909000":20052000,"1910000":20053000,"1911000":20054000,"1912000":20055000,"1913000":20056000,"1914000":20057000,
  "1915000":20058000,"1916000":20059000,"1917000":20061000,"1918000":20063000,"1919000":20064000,"1920000":20065000,
  "1921000":20066000,"1922000":20067000,"1923000":20068000,"1924000":20069000,"1925000":20070000,"1926000":20071000,
  "1927000":20072000,"1928000":20073000,"1929000":20074000,"1930000":20075000,"1931000":20076000,"1932000":20077000,
  "1933000":20078000,"1934000":20079000,"1937000":20080000,"1938000":20082000,"1939000":20081000,"1940000":20083000,
  "1941000":20084000,"1942000":20085000,"1943000":20086000,"1944000":20087000,"1945000":20088000,"1946000":20089000,
  "1947000":20090000,"1948000":20091000,"1949000":20092000,"1950000":20093000,"1951000":20094000,"1952000":20095000,
  "1980000":20096000,"1981000":20097000,"1982000":20098000,"1983000":20101000,"1984000":20102000,"1985000":20103000,
  "1986000":20106000,"1987000":20107000,"1988000":20108000,"1989000":20111000,"1990000":20112000,"1991000":20113000,
  "1999000":20099000,"2001000":20100000,"2002000":20104000,"2004000":20105000,"2005000":20109000,"2007000":20110000,
  "2008000":20114000,"2010000":20115000,"2516000":20116000,"2517000":20120000,"2518000":20124000,"2519000":20117000,
  "2520000":20121000,"2521000":20125000,"2522000":20118000,"2523000":20122000,"2524000":20126000,"2525000":20119000,
  "2526000":20123000,"2527000":20127000,"2730000":20128000,"2731000":20129000,"2732000":20130000,"2733000":20131000,
  "2734000":20133000,"2735000":20132000,"2736000":20134000,"2737000":20135000,"2738000":20136000,"2739000":20137000,
  "2740000":20138000,"2741000":20139000,"51576000":51617000,"51577000":51618000,"51578000":51619000,"51579000":51620000,
  "51580000":51621000,"51581000":51622000,"51582000":51623000,"51583000":51624000,"51584000":51625000,"51585000":51626000,
  "51586000":51627000,"51587000":51628000,"51588000":51629000,"51589000":51630000,"51590000":51631000,"51591000":51632000,
  "51592000":51633000,"51593000":51634000,"51594000":51635000,"51595000":51636000,"51596000":51637000,"51597000":51638000,
  "51598000":51639000,"51599000":51640000,"52027000":52034000,"52028000":52032000,"52029000":52031000,"52030000":52033000,
  "52497000":52526000,"52500000":52517000,"52501000":52516000,"52502000":52525000,"52503000":52524000,"52504000":52515000,
  "52505000":52514000,"52506000":52523000,"52518000":[52522000,52521000,52519000,52520000],"52868000":52875000,"52869000":52876000,"52870000":52877000,
  "52871000":52878000,"53336000":53342000,"53337000":53343000,"53338000":53344000,"53339000":53345000,"53340000":[53346000,53347000,53348000,53349000],
  "53938000":53942000,"53939000":53943000,"53940000":53944000,"53941000":53945000,"54379000":54383000,"54380000":54384000,
  "54381000":54385000,"54382000":54386000,"54471000":54515000,"54472000":54512000,"54473000":54513000,"54474000":54520000,
  "54475000":54517000,"54476000":54518000,"54477000":54522000,"54478000":54523000,"54479000":54525000,"54480000":54527000,
  "54481000":54530000,"54482000":54528000,"54487000":54511000,"54488000":54516000,"54489000":54521000,"54490000":54526000,
  "54531000":54514000,"54532000":54519000,"54533000":54524000,"54534000":54529000,"54598000":54622000,"54599000":54623000,
  "54600000":54624000,"54601000":54625000,"54824000":54830000,"54825000":54831000,"54826000":54832000,"54827000":54833000
};

    /* =================================================================
       GYARTHATO FELADATOK (t43).

       A receptadatok a mestersegkalkulatorbol jonnek at (RECIPES es
       RECEPT_TEKERCS, 222 termek). Ott mar mert es ellenorzott adat:
         · g: [[alapanyag azonosito, darab], ...] egy gyartasra,
         · egy gyartas MINDIG 1 darab termeket ad,
         · t: zarolas masodpercben, csak 26 terméknel van ilyen,
         · p: mesterseg (1 Tabori szakacs, 2 Sarlatan, 3 Kovacs,
              4 Istallomester), lehet tomb a kozos termekeknel.

       A fa CSAK a karakter sajat mestersegenek TANULT receptjein nyilik
       (a fejleszto dontese). Teljes melysegben megy: a koztes termek
       (pl. Acel) maga is gyarthato, es a sajat alapanyagaira bomlik.
       ================================================================= */

    const GYART_MAP = new Map(RECIPES.map(r => [String(r.i), r]));

    function gyartProfIds(p) {
        return Array.isArray(p) ? p.map(Number) : [Number(p)];
    }
    /* A mesterseg neve a Kinalat mestersegszurojenek mert neveibol. */
    function gyartMestersegNev(p) {
        const lista = mestersegLista();
        return gyartProfIds(p).map(id => {
            const m = lista.find(x => x.id === id);
            return m ? m.nev : "";
        }).filter(Boolean).join(", ");
    }
    function gyartSajatProf() {
        try { return Number(jatek().Character.professionId) || 0; } catch (e) { return 0; }
    }
    /* A megtanult receptek halmaza a jatek Crafting.recipes objektumabol:
       a tanultsag jele a last_craft mezo LETEZESE (a kalkulator merese).
       Ha a lista ures (jellemzoen a TW-Calc irja felul), nem tudunk rola
       semmit, es nem nyitunk fat. */
    function gyartMegtanult() {
        const ki = new Set();
        try {
            const C = jatek().Crafting;
            if (!C || !C.recipes) return ki;
            Object.keys(C.recipes).forEach(k => {
                const r = C.recipes[k];
                if (r && Object.prototype.hasOwnProperty.call(r, "last_craft") && r.craftitem)
                    ki.add(String(r.craftitem));
            });
        } catch (e) { /* ures marad */ }
        return ki;
    }
    /* A recept-tekercs azonositoja a startCraft-hoz. Elsokent a jatek sajat
       adata, tartalekban a mert tabla. */
    function gyartReceptAzon(termekId) {
        try {
            const C = jatek().Crafting;
            if (C && C.recipes) {
                const k = Object.keys(C.recipes).find(x => {
                    const r = C.recipes[x];
                    return r && String(r.craftitem) === String(termekId);
                });
                if (k) {
                    const r = C.recipes[k];
                    const rid = Number(r.item_id || k);
                    if (rid) return rid;
                }
            }
        } catch (e) { /* jon a tartalek */ }
        const t = RECEPT_TEKERCS[String(termekId)];
        return t ? Number(t) : 0;
    }
    /* Zarolas: a last_craft ERTEKE a hatralevo ido, de pillanatfelvetel.
       Visszaszamolni nem merunk (a kalkulator merese), csak azt mondjuk
       meg, hogy zarolva van-e. */
    function gyartZarolva(termekId) {
        try {
            const C = jatek().Crafting;
            if (!C || !C.recipes) return false;
            return Object.keys(C.recipes).some(k => {
                const r = C.recipes[k];
                return r && String(r.craftitem) === String(termekId)
                    && typeof r.last_craft === "number" && r.last_craft > 0;
            });
        } catch (e) { return false; }
    }
    /* A recept szintje a tablabol (l: "min/kozep/max"), es hogy a
       mesterseg-szinted eleri-e. */
    function gyartSzintInfo(termekId) {
        const r = GYART_MAP.get(String(termekId));
        const min = r && r.l ? Number(String(r.l).split("/")[0]) : NaN;
        let sajat = 0;
        try { sajat = Number(jatek().Character.professionSkill) || 0; } catch (e) { sajat = 0; }
        return { min: isFinite(min) ? min : null, sajat, eleri: !isFinite(min) || sajat >= min };
    }
    function gyartSzintHTML(termekId) {
        const sz = gyartSzintInfo(termekId);
        if (sz.min == null) return "";
        return sz.eleri ? ` &middot; ${sz.min}. szint`
            : ` &middot; <span class="kvhiba">${sz.min}. szint kell, n\u00E1lad ${sz.sajat}</span>`;
    }
    function gyartTekercsNev(termekId) {
        const rid = gyartReceptAzon(termekId);
        return rid ? targyNev(rid) : "";
    }

    /* -----------------------------------------------------------------
       A TERV. Vegigmegy a feladatokon a lista sorrendjeben (ez az
       elszamolasi sorrend, ugyanaz, mint a keszletElosztasnal), es a kozos
       taskakeszletet fogyasztva epiti fel minden gyarthato feladat fajat.
       Visszateres: Map(feladatkulcs -> gyoker csomopont).

       Csomopont: { id, nev, kell, van, hianyzo, gyarthato, tanult, zarolt,
                    gyartasDb, alanyagok: [csomopont], vanMunka, oi, melyseg }
       ----------------------------------------------------------------- */
    function gyartTerv() {
        const terv = new Map();
        const prof = gyartSajatProf();
        const tanultak = gyartMegtanult();
        /* t56: a fa MINDEN gyarthato termeknel felepul, a fejleszto dontese
           szerint (Lotakaro-mockup, 2026-09-22):
             · mas mesterseg termeke: a hozzavalok kinyilnak, de a termekre
               nincs Gyartas (azt mas gyartja, te csak gyujtesz);
             · sajat mesterseg, tanult recept: kinyilik, Gyartas gombbal;
             · sajat mesterseg, nem tanult: nem nyilik, "recept kell";
             · sajat mesterseg, de a tanult lista meg ures (a Mesterseg ablak
               betolteseig): t57 ota ez is KINYILIK, mert a hozzavalok a
               tablabol ismertek, csak a tanultsag nem (a fejleszto kerese,
               Istallomesterkent tesztelve). A Gyartas gomb elobb betolti a
               listat, de csak akkor, ha az alapanyagbol legalabb egy
               gyartas kijon; kulonben tiltott, es kerest sem kuld. */
        const listaVan = tanultak.size > 0;

        /* A taskakeszlet masolata, amit a feladatok sorban fogyasztanak. */
        const maradek = new Map();
        const keszletbol = id => {
            const k = String(id);
            if (!maradek.has(k)) {
                const v = keszlet(k);
                maradek.set(k, v == null ? 0 : Math.max(0, Number(v) || 0));
            }
            return maradek.get(k);
        };
        const elvesz = (id, mennyi) => {
            const k = String(id);
            const van = Math.min(keszletbol(k), Math.max(0, mennyi));
            maradek.set(k, keszletbol(k) - van);
            return van;
        };

        const csomo = (id, kell, melyseg, ut) => {
            const r = GYART_MAP.get(String(id));
            const sajat = !!(r && gyartProfIds(r.p).indexOf(prof) !== -1);
            const tanult = tanultak.has(String(id));
            const van = elvesz(id, kell);
            const hianyzo = Math.max(0, kell - van);
            const node = {
                id: String(id), nev: targyNev(id), kell, van, hianyzo,
                gyarthato: !!(r && sajat), tanult, zarolt: false,
                gyartasDb: 0, alanyagok: [], melyseg,
                vanMunka: !!munkaForras(id), oi: oraInfo(id, hianyzo),
                tekercs: "", masProf: r && !sajat ? gyartMestersegNev(r.p) : "",
                nincsLista: !!(r && sajat && !listaVan)
            };
            if (!r) return node;
            const kinyit = () => {
                if (hianyzo <= 0) return;
                /* Korvedelem: ugyanaz a termek nem nyilhat ki ketszer egy agon. */
                if (ut.indexOf(String(id)) !== -1) return;
                const ujUt = ut.concat(String(id));
                r.g.forEach(([gid, db]) => {
                    node.alanyagok.push(csomo(gid, hianyzo * Number(db), melyseg + 1, ujUt));
                });
            };
            if (!sajat) { kinyit(); return node; }
            if (!listaVan) { node.gyartasDb = hianyzo; kinyit(); return node; }
            if (!tanult) {
                /* t66: a nem tanult sajat recept is lebomlik, hogy lasd, mit
                   gyujts hozza (sokan elore gyujtenek, mire szintet lepnek);
                   a Gyartas gomb viszont tiltott marad. */
                node.tekercs = gyartTekercsNev(id);
                kinyit();
                return node;
            }
            node.zarolt = gyartZarolva(id);
            /* Egy gyartas egy darabot ad, tehat ennyi gyartas kell. */
            node.gyartasDb = hianyzo;
            kinyit();
            return node;
        };

        beszerzok.forEach(f => {
            const kint = piacraMennyiseg(f);
            const kellMost = Math.max(0, f.db - kint);
            /* t65: minden feladat kap csomopontot, a nem gyarthato is, mert a
               termek sora is ebbol a prioritasos elosztasbol szamol. */
            const gyoker = csomo(f.id, kellMost, 0, []);
            gyoker.cimzett = String(f.nev || "");
            gyartOsszevon(gyoker);
            terv.set(String(f.kulcs), gyoker);
        });
        return terv;
    }

    /* Ugyanaz a nyersanyag tobb agban is elofordulhat. Ilyenkor EGY sorba
       vonjuk ossze a fa tetejen, es a sor alatt megmondjuk, melyik agba
       mennyi megy. Az egy agban szereplo nyersanyag marad a helyen. */
    function gyartOsszevon(gyoker) {
        const elo = new Map();
        const jar = n => n.alanyagok.forEach(a => {
            if (a.alanyagok.length) { jar(a); return; }
            if (!elo.has(a.id)) elo.set(a.id, []);
            elo.get(a.id).push({ szulo: n, node: a });
        });
        jar(gyoker);
        elo.forEach((lista, id) => {
            if (lista.length < 2) return;
            const ossz = Object.assign({}, lista[0].node);
            ossz.kell = lista.reduce((n, x) => n + x.node.kell, 0);
            ossz.van = lista.reduce((n, x) => n + x.node.van, 0);
            ossz.hianyzo = lista.reduce((n, x) => n + x.node.hianyzo, 0);
            ossz.melyseg = 1;
            ossz.oi = oraInfo(id, ossz.hianyzo);
            ossz.forras = lista.map(x => ({ nev: x.szulo.nev, kell: x.node.kell }));
            let hova = -1;
            lista.forEach(x => {
                const i = x.szulo.alanyagok.indexOf(x.node);
                if (x.szulo === gyoker && hova < 0) hova = i;
                if (i >= 0) x.szulo.alanyagok.splice(i, 1);
            });
            if (hova >= 0) gyoker.alanyagok.splice(hova, 0, ossz);
            else gyoker.alanyagok.push(ossz);
        });
    }

    /* A fa LEVELEI: amit tenyleg gyujteni kell (nem gyarthato, vagy
       gyarthato de nem tanult). Az Osszesites es a Mit gyujts ezekkel
       dolgozik, mert a termekre nem lehet munkara menni. */
    function gyartLevelek(node, ki) {
        const lista = ki || [];
        if (!node) return lista;
        if (!node.alanyagok.length) {
            if (node.hianyzo > 0) lista.push(node);
            return lista;
        }
        node.alanyagok.forEach(x => gyartLevelek(x, lista));
        return lista;
    }

    /* Hany darabot lehet MOST legyartani (t58).

       A t43-t57 csak a kozvetlen alapanyagokat nezte, azzal a feltetelezessel,
       hogy a jatek nem gyart lancban. Ez NEM volt merve, es tevesnek bizonyult:
       a fejleszto szerint a mestersegkalkulator a Kest akkor is gyartja, ha az
       Olvasztott vasat elobb le kell gyartani, mert mindketto a sajat
       mestersege. A kalkulator 1.2.6 kijon() es maxDbAltalanos() fuggvenyet
       vettuk at: egy adott darabszamra vegigjatsszuk a teljes lebontast egy
       keszletmasolaton, es ahol a sajat, megtanult, szinttel elert recepted
       hianyzik, azt tovabb bontjuk. A legnagyobb meg kijovo darabszamot
       kettos keresessel talaljuk meg.

       Ket elteres a kalkulatortol, mindketto a Beszerzo szabalyaibol:
         · ha a tanult lista meg ures, a tanultsagot nem kerjuk szamon
           (a Gyartas gomb elobb betolti; a kalkulator is inkabb szamot mutat,
           mint hogy elrejtse);
         · a szam a feladat hianyzo darabszamanal nem lehet tobb.

       A keszlet a TELJES taska, nem a feladatok kozti elosztas: a szerver is
       a teljes taskabol gyart. A cel sajat darabjai nem szamitanak bele. */
    function gyartMagadGyartod(r, tanultak) {
        const prof = gyartSajatProf();
        if (!r || !prof || gyartProfIds(r.p).indexOf(prof) === -1) return false;
        const sz = gyartSzintInfo(r.i);
        if (!sz.eleri) return false;
        if (tanultak.size && !tanultak.has(String(r.i))) return false;
        return true;
    }
    function gyartKijon(id, n, tanultak) {
        const k = {};
        const van = mit => {
            if (!(mit in k)) { const v = keszlet(mit); k[mit] = v == null ? 0 : Math.max(0, Number(v) || 0); }
            return k[mit];
        };
        k[String(id)] = 0;      /* a cel sajat darabjai soha nem szamitanak bele */
        const jar = (mit, mennyi, ut) => {
            if (mennyi <= 0) return true;
            const megvan = Math.min(van(mit), mennyi);
            k[mit] = van(mit) - megvan;
            const marad = mennyi - megvan;
            if (marad === 0) return true;
            const r = GYART_MAP.get(String(mit));
            /* nincs recept, nem te gyartod, vagy korkoros: itt elakad */
            if (!r || ut.indexOf(String(mit)) !== -1) return false;
            if (ut.length && !gyartMagadGyartod(r, tanultak)) return false;
            return r.g.every(([gid, q]) => jar(String(gid), Number(q) * marad, ut.concat(String(mit))));
        };
        return jar(String(id), n, []);
    }
    function gyartMaxDb(id, tanultak) {
        if (!gyartKijon(id, 1, tanultak)) return 0;
        let also = 1, felso = 2;
        while (felso <= 9999 && gyartKijon(id, felso, tanultak)) { also = felso; felso *= 2; }
        felso = Math.min(felso, 9999);
        while (also < felso) {
            const kozep = Math.ceil((also + felso) / 2);
            if (gyartKijon(id, kozep, tanultak)) also = kozep; else felso = kozep - 1;
        }
        return also;
    }
    function gyartMennyiMegy(node) {
        if (!node || (!node.tanult && !node.nincsLista) || !node.gyartasDb) return 0;
        const r = GYART_MAP.get(node.id);
        if (!r || !gyartSzintInfo(node.id).eleri) return 0;
        return Math.max(0, Math.min(node.gyartasDb, gyartMaxDb(node.id, gyartMegtanult())));
    }

    /* -----------------------------------------------------------------
       A FA KIRAJZOLASA. A sorok ugyanazt a racsot hasznaljak, mint a
       feladatsorok, csak behuzva (gyfa, m2).
       ----------------------------------------------------------------- */
    function gyartSorHTML(node, gyoker) {
        const kesz = node.hianyzo <= 0;
        const szaz = node.kell > 0 ? Math.min(100, Math.round(node.van / node.kell * 100)) : 0;
        const bal = `Megvan ${node.van}`;
        const jobb = kesz ? `100% k\u00E9sz &#10003;` : `${szaz}% &middot; hi\u00E1nyzik ${node.hianyzo}`;
        const jobbSzo = kesz ? `<span class="ok">megvan</span>` : `<span class="hi">hi\u00E1nyzik ${node.hianyzo}</span>`;
        const kep = targyIkon(node.id);
        const kepH = kep
            ? `<img class="kep${node.vanMunka ? " huzhato" : ""}"${node.vanMunka ? ` data-bubid="${esc(node.id)}"` : ""} src="${esc(kep)}" alt="">`
            : `<span class="kep"></span>`;
        let also = "";
        /* Mas mesterseg fajaban a sajat recepted kulon jelet kap. */
        const sajatJel = gyoker && gyoker.masProf ? "a te mesters\u00E9ged" : "gy\u00E1rthat\u00F3";
        if (node.masProf) {
            also = `<span class="gyjelh">m\u00E1s mesters\u00E9g</span> &middot; ${esc(node.masProf)}`;
        } else if (node.gyarthato && node.nincsLista) {
            also = `<span class="gyjel">${sajatJel}</span>`
                + (gyartMennyiMegy(node) > 0 ? ` &middot; a Gy\u00E1rt\u00E1s gomb bet\u00F6lti a receptjeidet` : "");
        } else if (node.gyarthato && !node.tanult) {
            also = `<span class="gyjelh">recept kell</span>${node.tekercs ? " &middot; " + esc(node.tekercs) : ""}${gyartSzintHTML(node.id)}`;
        } else if (node.gyarthato) {
            also = `<span class="gyjel">${sajatJel}</span>`;
            if (node.zarolt) also += ` &middot; <span class="kvhiba">z\u00E1rolva</span>`;
        } else if (!kesz && node.oi && node.oi.orak != null) {
            also = `kb. ${node.oi.orak} munka\u00F3ra h\u00E1tra`;
        } else if (!kesz && node.oi && node.oi.szoveg && node.oi.szoveg !== "kesz") {
            /* t76: a fa sora is kiirja, amit a feladatsor: nem elerheto,
               kicsi az esely, zsakbamacska, Union Pacific bolt; ugyanazzal
               a szoveggel es szinnel (a fejleszto kerese). */
            also = node.oi.szoveg === "nem elerheto"
                ? `<span class="ora baj">nem el\u00E9rhet\u0151</span>`
                : `<span class="ora">${esc(oraKiiras(node.oi.szoveg))}</span>`;
        }
        if (node.forras && node.forras.length > 1) {
            const bontas = node.forras.map(x => `${esc(x.nev)} ${x.kell}`).join(", ");
            also = (also ? also + " &middot; " : "") + "ebb\u0151l " + bontas;
        }
        let gomb = "";
        if (kesz && gyoker && gyoker.masProf && node !== gyoker) {
            /* A vegterméket mas gyartja: a kesz hozzavalot eladhatod neki. */
            gomb = `<div class="piac-csomag"><button class="gomb piacb" data-fa-piac="${esc(node.id)}"
                data-fa-db="${node.kell}" data-fa-cimzett="${esc(gyoker.cimzett || "")}"
                title="Megnyit\u00E1s az Elad\u00E1s f\u00FCl\u00F6n, a faban szereplo mennyis\u00E9ggel">Piacra &#9656;</button></div>`;
        }
        else if (kesz) gomb = "";
        else if (node.gyarthato && node.nincsLista) gomb = gyartBetoltoGomb(node);
        else if (node.gyarthato && !node.tanult) gomb = `<button class="gomb gyart" disabled title="A recept nincs meg.">Gy\u00E1rt\u00E1s &#9656;</button>`;
        else if (node.gyarthato && node.tanult) {
            const megy = gyartMennyiMegy(node);
            gomb = megy > 0 && !node.zarolt
                ? `<button class="gomb munkab" data-gyart="${esc(node.id)}" data-gyart-db="${megy}">Gy\u00E1rt\u00E1s (${megy}) &#9656;</button>`
                : `<button class="gomb gyart" disabled title="${esc(node.zarolt ? "A recept z\u00E1rolva van." : "Nincs el\u00E9g alapanyag.")}">Gy\u00E1rt\u00E1s &#9656;</button>`;
        } else if (node.vanMunka) {
            gomb = `<button class="gomb munkab" data-munka="${esc(node.id)}">Munk\u00E1ra &#9656;</button>`;
        }
        const sorOsztaly = kesz ? "kesz" : (node.gyarthato ? "gyartott" : (node.vanMunka ? "dolgozik" : "gyartott"));
        return `
          <div class="bsor gysor ${sorOsztaly}${node.melyseg > 1 ? " m2" : ""}">
            ${kepH}
            <div class="nevblokk"><div class="nev">${esc(node.nev)}</div>
              ${also ? `<div class="alsor">${also}</div>` : ""}
              <div class="csik" style="--csik-fill:${szaz}%"><i class="${kesz ? "kesz" : ""}" style="width:${szaz}%"></i>
                <div class="felirat"><span class="b">${bal}</span><span class="j">${jobb}</span></div>
                <div class="felirat vilagos" aria-hidden="true"><span class="b">${bal}</span><span class="j">${jobb}</span></div></div></div>
            <div class="szo"><span>kell <b>${node.kell}</b></span><br>${jobbSzo}</div>
            <div class="muv">${gomb}</div>
          </div>`;
    }

    /* A tanult lista meg ures. Ha az alapanyagbol legalabb egy gyartas
       kijon, a gomb betolti a receptjeidet (egy keres a szervernek);
       ha nem, tiltott, es nem is kuld kerest. */
    function gyartBetoltoGomb(node) {
        const megy = gyartMennyiMegy(node);
        if (megy <= 0) return `<button class="gomb gyart" disabled title="Nincs el\u00E9g alapanyag.">Gy\u00E1rt\u00E1s &#9656;</button>`;
        return `<button class="gomb munkab" data-gyart-betolt="${esc(node.id)}" title="${esc("El\u0151bb bet\u00F6lti a receptjeidet a Mesters\u00E9g ablakb\u00F3l (egy k\u00E9r\u00E9s a szervernek).")}">Gy\u00E1rt\u00E1s (${megy}) &#9656;</button>`;
    }

    function gyartAgHTML(node, gyoker) {
        return node.alanyagok.map(a =>
            gyartSorHTML(a, gyoker) + (a.alanyagok.length ? `<div class="m2">${gyartAgHTML(a, gyoker)}</div>` : "")
        ).join("");
    }

    /* A fa alatti osszegzes: mi hianyzik meg a nyersanyagokbol, mennyi
       munkaora, es milyen sorrendben gyartod a sajat koztes termekeidet. */
    function gyartOsszegzoHTML(node) {
        const hiany = gyartLevelek(node).filter(x => !GYART_MAP.has(x.id));
        const ora = hiany.reduce((n, x) => n + (x.oi && x.oi.orak != null ? x.oi.orak : 0), 0);
        /* A sajat, tanult koztes termekek a melyebbtol a magasabb fele. */
        const sorrend = [];
        const jar = n => {
            n.alanyagok.forEach(jar);
            if (n !== node && n.gyarthato && (n.tanult || n.nincsLista) && n.hianyzo > 0) sorrend.push(n.nev);
        };
        jar(node);
        const reszek = [];
        if (hiany.length) reszek.push(`<div class="gylab"><span class="gyszam">M\u00E9g gy\u0171jtend\u0151:</span>
            <span>${hiany.map(x => `${esc(x.nev)} ${x.hianyzo}`).join(", ")}${ora ? ` &middot; kb. ${ora} munka\u00F3ra` : ""}</span></div>`);
        if (sorrend.length) {
            /* MERVE (2026-09-22): a jatek lancban gyart, egy startCraft a
               hianyzo sajat koztes targyat is elkesziti. Ha tehat a felso
               soron el a Gyartas, a felsorolas nem teendo, hanem tajekoztatas.
               Ha a felso recept nincs meg vagy a szint keves, a koztes
               targyakat egyesevel kell gyartani, ott marad a sorrend. */
            const magatolMegy = node.gyarthato && (node.tanult || node.nincsLista) && gyartMennyiMegy(node) > 0;
            reszek.push(magatolMegy
                ? `<div class="gylab"><span>A gy\u00E1rt\u00E1s a hi\u00E1nyz\u00F3 k\u00F6ztes t\u00E1rgyakat is elk\u00E9sz\u00EDti: ${sorrend.map(esc).join(", ")}.</span></div>`
                : `<div class="gylab"><span>Ut\u00E1na te gy\u00E1rtod: ${sorrend.map(esc).join(", majd ")}.</span></div>`);
        }
        if (node.masProf) reszek.push(`<div class="gylab"><span>A v\u00E9gterm\u00E9ket egy ${esc(node.masProf)} k\u00E9sz\u00EDti el.</span></div>`);
        return reszek.join("");
    }

    function gyartFaHTML(f, terv) {
        const node = terv && terv.get(String(f.kulcs));
        if (!node || node.hianyzo <= 0 || !node.alanyagok.length) return "";
        if (node.masProf) {
            /* Mas mesterseg termeke: csak a hozzavalok, Gyartas nelkul. */
            const nyers = [];
            const jar = n => n.alanyagok.forEach(a => { if (a.alanyagok.length) jar(a); else if (!GYART_MAP.has(a.id)) nyers.push(a); });
            jar(node);
            const megvan = nyers.filter(x => x.hianyzo <= 0).length;
            return `<div class="gyfa">
                <div class="gysor-cim">Hozz\u00E1val\u00F3k: ${node.hianyzo} ${esc(node.nev)} &middot; <b>${megvan} / ${nyers.length} nyersanyag megvan</b></div>
                ${gyartAgHTML(node, node)}
                ${gyartOsszegzoHTML(node)}
              </div>`;
        }
        if (!node.gyarthato) return "";
        /* t74: a "Egy gyartas: 1 ...", "Az alapanyag N gyartasra eleg" es a
           zarolas-sor kikerult (a fejleszto dontese): a darabszam a gombon,
           a hiany es a zarolas a gomb buborekaban es a soron latszik. */
        return `<div class="gyfa">
            <div class="gysor-cim">Ehhez kell (a hi\u00E1nyz\u00F3 ${node.hianyzo} darabra)</div>
            ${gyartAgHTML(node, node)}
            ${gyartOsszegzoHTML(node)}
          </div>`;
    }

    /* -----------------------------------------------------------------
       GYARTAS INDITASA. A jatek sajat gyartasat inditjuk, sajat halozati
       hivast nem irunk. A kaput a kalkulatortol vettuk at: a
       CharacterWindow.progressCrafting nelkul a startCraft visszahivasa
       elszall, miutan a keres mar elment.
       ----------------------------------------------------------------- */
    let gyartKuldes = false;

    /* -----------------------------------------------------------------
       A MESTERSEG ABLAK BETOLTESE (t55), a kalkulator mert eljarasaval.

       A tanult receptek listaja (Crafting.recipes) es a gyartashoz kello
       CharacterWindow.progressCrafting csak a Mesterseg ablak betoltesekor
       all elo (MERVE: friss oldalbetoltes utan egyik sincs meg). A
       fejleszto dontese (2026-09-22): a betoltest a Gyartas gomb inditja,
       ha a lista meg ures; elso korben az ablak felvillanasaval. Hogy
       lathatatlanna teheto-e, azt kulon merjuk.

       A betoltes EGY kerest kuld a szervernek (game.php?window=crafting).

       A kalkulator meresei, amikre ez epul:
         · egyetlen toggleOpen("crafting") felepiti az ablakot es feltolti a
           Crafting.recipes-t; showTab-ot nem szabad melle hivni;
         · a progressCrafting mar 300 ms-nal letezik, az ablak csak 473-nal
           all ossze, ezert a RECEPTEKRE varunk, nem a progressCrafting-ra;
         · a zaras ELLENORZOTT: a .character-crafting elem offsetParent-je
           mondja meg, latszik-e meg, es a toggleOpen valtogat, tehat csak
           akkor hivjuk ujra, ha az ablak tenyleg nyitva van.
       ----------------------------------------------------------------- */
    let gyartBetoltFut = false;

    function mestersegLatszik() {
        try {
            const D = (jatek() && jatek().document) || document;
            const e = D.querySelector(".character-crafting");
            return !!(e && e.offsetParent);
        } catch (e) { return false; }
    }
    function mestersegReceptDb() {
        try {
            const C = jatek().Crafting;
            return C && C.recipes ? Object.keys(C.recipes).length : 0;
        } catch (e) { return 0; }
    }
    function mestersegZar(probal, kesz) {
        if (!mestersegLatszik() || probal <= 0) { kesz(); return; }
        try { jatek().CharacterWindow.toggleOpen("crafting"); }
        catch (e) { /* nyitva marad, nem tragedia */ }
        setTimeout(() => mestersegZar(probal - 1, kesz), 250);
    }

    function gyartBetolt(kesz) {
        if (gyartBetoltFut) return;
        const CW = jatek().CharacterWindow;
        if (!CW || typeof CW.toggleOpen !== "function") {
            allapotSzoveg("A Mesters\u00E9g ablak innen nem nyithat\u00F3 meg.", true);
            return;
        }
        if (mestersegReceptDb() > 0 && CW.progressCrafting) { kesz(true); return; }
        gyartBetoltFut = true;
        allapotSzoveg("Receptek bet\u00F6lt\u00E9se a Mesters\u00E9g ablakb\u00F3l\u2026");
        try { CW.toggleOpen("crafting"); }
        catch (e) {
            gyartBetoltFut = false;
            allapotSzoveg("A Mesters\u00E9g ablak megnyit\u00E1sa nem siker\u00FClt.", true);
            return;
        }
        /* 40 x 100 ms felso korlat, utana 3 x 100 ms rahagyas. */
        let hatra = 40, rahagyas = 3, megvan = false;
        const varo = setInterval(() => {
            if (!megvan) {
                if (mestersegReceptDb() > 0) { megvan = true; return; }
                if (--hatra > 0) return;
            } else if (rahagyas > 0) { rahagyas--; return; }
            clearInterval(varo);
            /* Akkor is zarunk, ha nem jott meg semmi: MI nyitottuk ki. */
            mestersegZar(3, () => {
                gyartBetoltFut = false;
                allapotSzoveg(megvan
                    ? "Receptek bet\u00F6ltve. Most m\u00E1r l\u00E1tszik, mit tudsz gy\u00E1rtani."
                    : "A receptek nem j\u00F6ttek meg n\u00E9gy m\u00E1sodpercen bel\u00FCl.", !megvan);
                kesz(megvan);
            });
        }, 100);
    }

    function gyartIndit(termekId, db, gomb) {
        if (gyartKuldes) return;
        const J = jatek();
        const C = J.Crafting;
        const CW = J.CharacterWindow;
        const hiba = sz => { allapotSzoveg(sz, true); };
        if (!C || typeof C.startCraft !== "function") { hiba("A j\u00E1t\u00E9k gy\u00E1rt\u00E1sa nem \u00E9rhet\u0151 el."); return; }
        if (!CW || !CW.progressCrafting) {
            gyartBetolt(ok => {
                rajzol();
                if (ok) allapotSzoveg("Receptek bet\u00F6ltve. Nyomd meg \u00FAjra a Gy\u00E1rt\u00E1s gombot.");
            });
            return;
        }
        if (!gyartMegtanult().has(String(termekId))) { hiba("Ezt a receptet nem tanultad meg."); return; }
        if (gyartZarolva(termekId)) { hiba("A recept z\u00E1rolva van."); return; }
        const rid = gyartReceptAzon(termekId);
        if (!rid) { hiba("Nem tal\u00E1lom a recept azonos\u00EDt\u00F3j\u00E1t."); return; }
        const n = Math.max(1, Math.floor(Number(db) || 0));
        gyartKuldes = true;
        if (gomb) gomb.disabled = true;
        try { C.startCraft(rid, n); }
        catch (e) {
            gyartKuldes = false;
            hiba("A gy\u00E1rt\u00E1s h\u00EDv\u00E1sa kiv\u00E9telt dobott: " + (e && e.message ? e.message : e));
            return;
        }
        allapotSzoveg(`Gy\u00E1rt\u00E1s elind\u00EDtva: ${n} ${targyNev(termekId)}. A j\u00E1t\u00E9k jelzi az eredm\u00E9nyt.`, false);
        /* A keszletfigyelo ugyis ujrarajzol, ha valtozik a taska. */
        setTimeout(() => { gyartKuldes = false; rajzol(); }, 1500);
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

    /* t65: a termek sora ugyanabbol a PRIORITASOS elosztasbol szamol, mint a
       receptfa es a Gyartas gomb (a fejleszto dontese, 2026-09-23). A regi
       elosztas csak a termeket nezte, a fa viszont azt is, hogy ugyanaz a
       targy egy feljebb allo feladat HOZZAVALOJA. Ezert allhatott egy soron
       ket szam ("hianyzik 1" fent, "51" a faban). A terv a beszerzok
       sorrendjeben oszt, tehat a csoportok prioritasa dont. */
    /* A terv egy kirajzolason belul valtozatlan, ezert egyszer szamoljuk ki. */
    let gyartTervGyorsitott = null;
    function gyartTervMost() {
        if (!gyartTervGyorsitott) gyartTervGyorsitott = gyartTerv();
        return gyartTervGyorsitott;
    }
    function gyartTervUrit() { gyartTervGyorsitott = null; }

    function sorAdat(f, elosztas, terv) {
        const t = terv || gyartTervMost();
        const e = elosztas && elosztas.get(String(f.kulcs));
        const g = t && t.get(String(f.kulcs));
        const megvan = g ? (g.van + g.hianyzo > 0 ? g.van : keszlet(f.id)) : (e ? e.keszlet : keszlet(f.id));
        const felosztva = g ? g.van
            : (e ? e.hozzarendelve : (megvan == null ? null : Math.min(f.db, megvan)));
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

    function osszesites(elosztas, terv) {
        const e = elosztas || keszletElosztas();
        /* A gyarthato feladat termekere nem lehet munkara menni, ezert a Kozos
           alapanyagok es a Munkaora-eloszlas a RECEPT leveleit szamolja. */
        const t = terv || gyartTerv();
        let kellSum = 0, vanSum = 0, keszDb = 0, oraSum = 0, hianySum = 0;
        let dolgozniDb = 0, gyartottDb = 0;
        const szemely = new Map();   /* nev -> {kell, van} */
        const kozos = new Map();     /* id -> {id, kell, van, tetelDb} */
        const orakTetel = [];        /* {nev, id, ora, munkazhato} */
        beszerzok.forEach(f => {
            const a = sorAdat(f, e, t);
            kellSum += f.db;
            vanSum += Math.min(a.van, f.db);
            hianySum += a.hianyzo;
            if (a.kesz) keszDb++;
            else if (a.vanMunka) dolgozniDb++;
            else gyartottDb++;
            const fa = t.get(String(f.kulcs));
            const levelek = fa && fa.alanyagok.length ? gyartLevelek(fa) : null;
            if (levelek && levelek.length) {
                levelek.forEach(lev => {
                    if (lev.oi && lev.oi.orak != null) {
                        oraSum += lev.oi.orak;
                        orakTetel.push({ nev: lev.nev, id: lev.id, ora: lev.oi.orak,
                                         hiany: lev.hianyzo, kell: lev.kell, van: lev.van, munkazhato: lev.vanMunka });
                    }
                });
            } else if (a.oi.orak != null) {
                oraSum += a.oi.orak;
                orakTetel.push({ nev: targyNev(f.id), id: String(f.id), ora: a.oi.orak,
                                 hiany: a.hianyzo, kell: f.db, van: a.van, munkazhato: a.vanMunka });
            }
            const k = String(f.nev || "(nincs nev)");
            if (!szemely.has(k)) szemely.set(k, { kell: 0, van: 0 });
            const s = szemely.get(k); s.kell += f.db; s.van += Math.min(a.van, f.db);
            const anyagok = levelek && levelek.length
                ? levelek.map(lev => ({ id: lev.id, kell: lev.kell, van: lev.van }))
                : [{ id: String(f.id), kell: f.db, van: Math.min(a.van, f.db) }];
            anyagok.forEach(x => {
                if (!kozos.has(x.id)) kozos.set(x.id, { id: x.id, kell: 0, van: 0, tetelDb: 0 });
                const z = kozos.get(x.id);
                z.kell += x.kell; z.van += Math.min(x.van, x.kell); z.tetelDb++;
            });
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

/* A keret teljesen a script sajatja; nincs mogotte jatekbeli ablakbor. */
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
.mini, .ujra, .mindzar{ background:rgba(0,0,0,.24); border:1px solid var(--fa2); border-radius:4px;
  width:26px; height:24px; cursor:pointer; line-height:1; font-size:17px; color:#c3a677; flex:0 0 auto }
.mini:hover, .ujra:hover, .mindzar:hover{ color:#f0c574; border-color:#8a6330 }
.ablak-vezerlok{ display:flex; align-items:center; gap:5px; margin-left:auto; flex:0 0 auto }
.ablak-vezerlok .zar{ margin-left:0 }
.live-dot{ width:7px; height:7px; flex:0 0 7px; border-radius:50%;
  background:var(--green); box-shadow:0 0 0 0 rgba(89,196,147,.55);
  animation:live-pulse 2.2s ease-out infinite }

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
.pkatvalaszto{ margin-left:auto; display:inline-flex; border:1px solid var(--line);
  border-radius:5px; overflow:hidden }
.pkatvalaszto .pkat{ appearance:none; border:0; border-left:1px solid var(--line);
  background:var(--panel); color:var(--dim); font:inherit; font-size:12px;
  padding:3px 10px; cursor:pointer; white-space:nowrap }
.pkatvalaszto .pkat:first-child{ border-left:0 }
.pkatvalaszto .pkat:hover{ color:var(--ink) }
.pkatvalaszto .pkat.aktiv{ background:var(--fill); color:var(--green); font-weight:600 }
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
.piacmezo{ position:relative }
.piacmezo input{ width:100%; box-sizing:border-box; font:inherit; font-size:13.5px;
  border:1px solid var(--brass); border-radius:5px; padding:6px 26px 6px 9px;
  background:var(--panel); color:var(--ink) }
.piacmezo .torlo{ position:absolute; right:4px; top:50%; transform:translateY(-50%);
  appearance:none; border:0; background:transparent; color:var(--faint); cursor:pointer;
  font:inherit; font-size:14px; line-height:1; padding:2px 5px; border-radius:4px }
.piacmezo .torlo:hover{ color:var(--ink); background:var(--raised) }
/* A fejlec es a lista szelessege csak akkor egyezik, ha a fejlec is
   fenntartja a gorgetosav helyet (a lista kerete miatt +1 px oldalanta).
   A lista is mindig fenntartja, kulonben rovid listanal elcsuszna. */
.kfej2{ overflow:hidden; scrollbar-gutter:stable }
#kinalatLista, #licitLista{ scrollbar-gutter:stable }
.piacures{ padding:14px 10px; font-size:13px; color:var(--dim) }

.fulsor{ display:flex; gap:0; margin:0 0 12px; border-bottom:1px solid var(--line) }
.fulsor .ful{ appearance:none; background:transparent; border:0; border-bottom:2px solid transparent;
  padding:7px 14px; font:inherit; font-size:13px; color:var(--dim); cursor:pointer; border-radius:0 }
.fulsor .ful:hover{ color:var(--ink) }
/* Negy fulnel szuk panelen se torjon sort: a sor inkabb vizszintesen gorog. */
.fulsor{ overflow-x:auto; scrollbar-width:none }
.fulsor .ful{ white-space:nowrap; flex:0 0 auto }
.nezetsor{ margin:-4px 0 10px }
.nezetsor .pkatvalaszto{ margin-left:0 }
.kinalat-fej{ display:flex; align-items:center; gap:8px; flex-wrap:wrap }
.kinalat-fej .piacmezo{ flex:1 1 160px; min-width:120px }
.kinalat-fej .pkatvalaszto{ margin-left:0 }
.kinalat-fej .gomb{ flex:0 0 auto }
.kallapot{ margin:6px 0 8px; font-size:12px; color:var(--dim) }
.kallapotsor{ display:flex; align-items:center; gap:4px 10px; flex-wrap:wrap; margin:6px 0 8px }
.kallapotsor .kallapot{ margin:0; flex:1 1 220px; min-width:0 }
.kallapotsor .kmester{ margin-left:auto }
.kallapotsor .kmester[hidden]{ display:none }
/* Arak szine (t20): az egysegar csak tajekoztat, az azonnali ar az, amit
   fizetsz, a licit futo arveres, a csillagos a sajat vezeto licit. */
.kegy{ color:var(--dim); font-size:11.5px }
.kazon{ color:var(--ink); font-weight:700 }
.klic{ color:var(--brass); font-weight:600 }
.kvez{ color:var(--green); font-weight:700 }
.kfej2, .ksor2{ display:grid; align-items:center; gap:6px;
  grid-template-columns:30px minmax(0,1fr) 60px 62px 62px 48px 158px }
.kfej2{ padding:0 11px 4px }
.kfej2 .krend{ appearance:none; background:transparent; border:0; padding:2px 0; font:inherit;
  font-size:11px; color:var(--faint); text-align:left; cursor:pointer; white-space:nowrap }
.kfej2 .krend.jobb{ text-align:right }
.kfej2 .krend:hover, .kfej2 .krend.aktiv{ color:var(--ink) }
.kfej2 .krend.aktiv{ font-weight:600 }
.kinalatlista{ border:1px solid var(--line); border-radius:8px; background:var(--panel);
  overflow-y:auto; overflow-x:hidden }
.ksor2{ padding:5px 10px; border-bottom:1px solid var(--line); font-size:12.5px; color:var(--ink) }
.ksor2:last-child{ border-bottom:0 }
.ksor2[hidden]{ display:none }
.ksor2 img, .ksor2 .kikon{ width:28px; height:28px; object-fit:contain; display:block }
.ksor2 .jobb{ text-align:right; white-space:nowrap }
.ksor2 .halvany{ color:var(--faint) }
.ksor2 .knev2{ overflow:hidden; text-overflow:ellipsis; white-space:nowrap }
.ksor2 .kdb{ color:var(--dim) }
.ksor2 .khely{ display:flex; flex-direction:column; min-width:0; line-height:1.25 }
.ksor2 .khely span{ overflow:hidden; text-overflow:ellipsis; white-space:nowrap }
.ksor2 .kvaros{ font-size:11px; color:var(--dim) }
.ksor2{ cursor:pointer }
.ksor2.valasztott{ background:var(--raised) }
.kvsav{ padding:10px 10px 12px 48px; border-bottom:1px solid var(--line); background:var(--raised); cursor:default }
.kvdobozok{ display:grid; grid-template-columns:repeat(auto-fit, minmax(200px, 1fr)); gap:10px }
.kvdoboz{ border:1px solid var(--line); border-radius:6px; background:var(--panel); padding:8px 10px }
.kvdoboz h4{ margin:0 0 4px; font-size:13px; color:var(--ink) }
.kvar{ font-size:18px; font-weight:600; color:var(--ink) }
.kvsor{ margin-top:4px; font-size:12px; color:var(--dim) }
.kvbe{ display:flex; align-items:center; gap:6px; flex-wrap:wrap }
.kvbe input{ width:96px !important; flex:0 0 auto; text-align:right; font:inherit; font-size:13px }
.kvgomb{ margin-top:8px }
.kvgomb[disabled]{ opacity:.5; cursor:not-allowed }
.kvgomb.kvbiztos{ background:var(--rust); border-color:var(--rust) }
.kvlab{ margin-top:8px; font-size:11px; color:var(--faint) }
.kvuzenet{ margin:-4px 0 8px; font-size:12px; font-weight:600; color:var(--green) }
.kvuzenet:empty{ display:none }
.kvhiba{ color:var(--rust) !important }
.lfej, .lsor{ grid-template-columns:30px minmax(0,1fr) 72px 62px 48px 158px }
/* t35: Megfigyeles. Mint a Licitjeim, de a vegen a levetel gombja. */
.ffej, .fsor{ grid-template-columns:30px minmax(0,1fr) 62px 62px 48px 158px 96px }
.lsor{ cursor:default }
.llab{ display:flex; align-items:center; gap:10px; margin-top:8px; flex-wrap:wrap }
.llab .labj{ flex:1 1 200px }
.atvlista{ padding:6px }
.acs{ border:1px solid var(--line); border-radius:6px; margin-bottom:8px; overflow:hidden; background:var(--panel) }
.acs:last-child{ margin-bottom:0 }
.ach{ display:flex; align-items:center; gap:8px; padding:6px 10px; background:var(--raised);
  border-bottom:1px solid var(--line); font-size:13px; color:var(--ink) }
.acim{ font-size:11px; color:var(--faint) }
.njel{ font-size:11px; font-weight:600 }
.apenzcs{ font-size:12px }
.apenz{ font-size:12px; color:var(--dim); white-space:nowrap }
.aitt{ font-size:11px; padding:1px 7px; border-radius:999px; background:var(--fill); color:var(--green); font-weight:600 }
.asor{ display:grid; grid-template-columns:28px minmax(0,1fr) 84px 100px 100px; gap:6px; align-items:center;
  padding:5px 10px; border-bottom:1px solid var(--line); font-size:12.5px; color:var(--ink) }
.asor:last-child{ border-bottom:0 }
.asor img, .asor .kikon{ width:26px; height:26px; object-fit:contain; display:block }
.asor .jobb{ text-align:right }
.asor .knev2, .asor .aelado{ overflow:hidden; text-overflow:ellipsis; white-space:nowrap; min-width:0 }
.asor .aar{ text-align:right; white-space:nowrap }
/* Megjegyzes jele: sarga karika felkialtojellel, mindig fix helyen az
   elado neve elott. Megjegyzes nelkul a helye uresen marad, igy a nev
   sosem mozdul el. A szoveget a jatek sajat buboreka mutatja. */
.mjel, .mjel-ures{ display:inline-block; width:15px; height:15px; margin-right:5px; vertical-align:-2px; flex:0 0 15px }
.mjel{ border-radius:50%; background:#e0a526; border:1px solid #8a5d0c; box-sizing:border-box;
  color:#2b1d05; font:700 11px/13px Arial,sans-serif; text-align:center; cursor:help; overflow:visible !important }
.agomb{ padding:3px 8px; font-size:12px }
.agomb.kvbiztos, .gomb.kvbiztos{ background:var(--rust); border-color:var(--rust) }
.kinalat .gomb[disabled]{ opacity:.45; cursor:not-allowed; filter:grayscale(.6) }
.nlink{ cursor:pointer; text-decoration:underline dotted; text-underline-offset:2px }
.nlink:hover{ color:var(--brass) }
/* A nev es a varos elott mindig ott all a megjegyzesjel helye
   (15 px + 5 px), a fejlec felirata ehhez igazodik. */
.knevhely{ padding-left:20px; min-width:0; white-space:nowrap; overflow:hidden }
.kfej2 .knevhely .krend{ display:inline }
.kfej2 .krend.knevhely{ padding-left:20px }
.kelv{ font-size:11px; color:var(--faint); margin-right:4px }
.olink.kvbiztos{ color:#fff; background:var(--rust); border-radius:3px; padding:0 4px; text-decoration:none }
.fulsor .ful.aktiv{ color:var(--ink); font-weight:600; border-bottom-color:var(--brass) }
/* UJ ELADAS FUL (t15) */
.ehely{ display:flex; align-items:center; gap:8px; margin:0 0 8px; font-size:13px; color:var(--ink) }
.ehelybal{ flex:1 1 auto; min-width:0 }
.ehely .halvany{ color:var(--faint) }
.efej, .esor{ grid-template-columns:30px minmax(0,1fr) 54px 84px 86px; gap:8px }
.esor .eertek{ text-align:right; white-space:nowrap; color:var(--dim) }
.esor .eertek.nincs{ color:var(--faint); font-size:11px }
.esor.tiltott{ opacity:.55; cursor:default }
#eladLista, #ajanlatLista{ scrollbar-gutter:stable }
.esav{ padding:10px 12px 12px 48px }
.emezok{ display:flex; flex-wrap:wrap; align-items:center; gap:6px 14px; margin:0 0 8px }
.emz{ display:inline-flex; align-items:center; gap:5px; font-size:12.5px; color:var(--dim); white-space:nowrap }
.esav input{ width:72px; box-sizing:border-box; text-align:right; font:inherit; font-size:12.5px;
  padding:3px 6px; border:1px solid var(--line); border-radius:5px; background:var(--panel); color:var(--ink); margin:0 }
.esav input.rovid{ width:42px }
.esav{ position:relative }
.esav .ealap{ position:absolute; right:12px; top:10px }
.esav .emezok:first-of-type{ padding-right:64px }
.edollar{ color:var(--dim) }
.edollar.aktiv{ cursor:pointer; text-decoration:underline dotted; text-underline-offset:2px; color:var(--ink) }
.edollar.aktiv:hover{ color:var(--brass) }
.ejel{ display:inline-block; width:8px; height:8px; margin-left:7px; border-radius:50%;
  background:#e0a526; border:1px solid #8a5d0c; vertical-align:1px; cursor:help }
/* A temak sajat .gomb szabalya erosebb, ezert itt kimondjuk. */
:host .ehely .gomb.emind, :host([data-tema]) .ehely .gomb.emind{
  color:var(--rust) !important; border-color:var(--rust) !important; background:rgba(168,58,32,.12) !important;
  background-image:none !important; box-shadow:none !important }
.ehely .emind[hidden]{ display:none }
.esav input{ -webkit-user-drag:none; user-drag:none }
.esav input::placeholder{ color:var(--faint); opacity:.55; font-style:italic }
.esav .pkatvalaszto{ margin-left:0 }
.esav .pkat.etilt{ opacity:.45; cursor:not-allowed }
.eszeles{ display:flex; width:100%; margin:0 0 6px }
.eszeles input{ flex:1 1 auto; width:auto; text-align:left }
.ehiba{ font-size:12px; min-height:0 }
.ehiba:empty{ display:none }
.elab{ display:flex; align-items:center; justify-content:space-between; gap:10px; flex-wrap:wrap;
  margin-top:6px; font-size:12.5px; color:var(--ink) }
.elab .halvany{ color:var(--faint) }
.egombok{ display:flex; gap:6px; margin-left:auto }
.ofej, .osor{ display:grid; grid-template-columns:28px minmax(0,1fr) 66px 66px 50px 100px 100px; gap:6px; align-items:center }
/* t24: a tetelnev csonkul, a darabszam es a cimke mindig latszik. */
.knev2.kn{ display:flex; align-items:baseline; gap:4px }
.knev2.kn .knn{ overflow:hidden; text-overflow:ellipsis; white-space:nowrap; min-width:0 }
.knev2.kn .kdb, .knev2.kn .acim{ flex:none; white-space:nowrap }
.ofej{ padding:0 18px 4px; font-size:11px; color:var(--faint); overflow:hidden; scrollbar-gutter:stable }
.ofej .jobb{ text-align:right }
.osor{ padding:5px 10px; border-bottom:1px solid var(--line); font-size:12.5px; color:var(--ink) }
.osor:last-child{ border-bottom:0 }
.osor img, .osor .kikon{ width:26px; height:26px; object-fit:contain; display:block }
.osor .jobb{ text-align:right; white-space:nowrap }
.osor .halvany{ color:var(--faint) }
.osor .knev2, .osor .aelado{ overflow:hidden; text-overflow:ellipsis; white-space:nowrap; min-width:0 }
.osor .kdb{ color:var(--dim) }
/* A tavoli visszavonas felirata ket sorban fer ki a gomboszlopban. */
.osor .agomb{ white-space:nowrap }
.osor .agomb.ket{ white-space:normal; line-height:1.15; padding-top:2px; padding-bottom:2px }

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
.dash-fej{ display:flex; align-items:center; gap:10px; width:100%; background:none; border:0;
  cursor:pointer; text-align:left; padding:0; color:inherit; font:inherit }
.dash-fej .cim{ font-family:"Rye",Georgia,serif; font-size:14px; color:var(--rust) }
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
.kpik{ display:grid; grid-template-columns:1fr 1fr; gap:7px }
.kpi{ background:var(--raised); border:1px solid var(--line); border-radius:6px; padding:8px 9px;
  box-shadow:inset 0 1px 0 rgba(255,255,255,.18) }
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

.bsor{ position:relative; display:grid; grid-template-columns:30px minmax(0,1fr) 95px 139px; align-items:center; gap:10px;
  margin-top:7px; padding:10px 8px 10px 11px; border:1px solid var(--line); border-radius:8px;
  background:rgba(255,255,255,.18); box-shadow:inset 0 1px 0 rgba(255,255,255,.18) }
.bsor::before{ content:""; position:absolute; left:0; top:8px; bottom:8px; width:3px; border-radius:0 3px 3px 0;
  background:var(--brass) }
.bsor.kesz::before{ background:var(--green) }
.bsor.gyartott::before{ background:#b7a07f }
.bsor.keszlet-friss{ animation:keszlet-friss 1.2s ease-out both }
.bsor .kep{ width:30px; height:30px; border-radius:5px; background:var(--raised);
  border:1px solid var(--line); object-fit:contain }
.bsor .nevblokk{ min-width:0 }
.bsor .nev{ font-weight:600; font-size:14.5px }
.bsor .itemArNev{ display:inline-block; max-width:100%; vertical-align:top; overflow:hidden; text-overflow:ellipsis;
  cursor:help; text-decoration:underline; text-decoration-style:dotted; text-underline-offset:3px }
.bsor .itemArNev:hover,.bsor .itemArNev:focus-visible{ color:var(--brass); outline:none }
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
.bsor .muv{ display:flex; align-items:flex-start; justify-content:flex-end; gap:5px }
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
#allapot.aok{ color:var(--green) }
#allapot{ min-height:16px; margin-top:8px; font-size:12px; color:var(--rust); font-family:ui-monospace,"Cascadia Mono","Segoe UI Mono",Consolas,monospace }
.labj{ margin-top:8px; font-size:10.5px; color:var(--faint); font-style:italic }
.alairas{ margin:8px 0 1px; text-align:center; color:var(--faint); font-size:10.5px;
  font-style:italic; letter-spacing:.02em }
.alairas .sziv{ color:#d7473f; font-style:normal; font-size:13px; line-height:1; padding:0 2px }

@media (max-width:560px){
  .frame{ width:96vw }
  .bar{ gap:6px; padding-left:9px }
  .mark{ font-size:11px }
  .ver{ display:none }
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
.mbub .hbnev{ font-weight:700 }
.mbub .hbido{ font-family:ui-monospace,"Cascadia Mono","Segoe UI Mono",Consolas,monospace; font-size:13px; color:var(--ink) }

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
:host([data-tema="pult"]) .frame{
  border:3px solid #493019; border-radius:3px;
  box-shadow:0 0 0 1px #ae8350,0 6px 18px #20130866;
}
:host([data-tema="pult"]) .frame .bar{
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
:host([data-tema="pult"]) .frame .bar .mark{
  padding:4px 6px; background:linear-gradient(#d5b375,#b28b4d);
  color:#352414; border:1px solid #24170d; border-radius:1px;
  box-shadow:inset 0 1px 0 #efdab1; text-shadow:0 1px #ead1a1;
}
:host([data-tema="pult"]) .mark-jel{
  width:18px; height:18px; border:0; border-radius:0;
  box-shadow:none; color:inherit;
}
:host([data-tema="pult"]) .frame .bar .ver{
  color:#e0c79a;
} .ujra, .mindzar, .mini, .zar
){
  border-radius:2px;
}
:host([data-tema="pult"]) .live-dot{
  animation:none; box-shadow:none;
}
:host([data-tema="pult"]) .stage{
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
  input, .gomb, .add, .bujOk, .bplusz, .szuro-hiany, .szuro-menu summary, .szuro-panel, .jlista, .mbub, .pbub, .csoport-eszkozok button
){
  border-radius:2px;
}
:host([data-tema="pult"]) :is(
  .ujform input, .bujsor input, .piacmezo input
){
  background:#f8edcf; border-color:#a58a59;
  box-shadow:inset 0 1px 2px #72522e22;
}
:host([data-tema="pult"]) :is(.gomb, .bplusz){
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
  .gomb, .bplusz, .ujform .add, .bujOk
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


/* t27: a mert jatekfeluletekre epulo Pult tema. Csak megjelenes. */
:host([data-tema="pult"]){
 --bg:#e6d8b6; --panel:#eee3c8; --raised:#d7c6a1; --line:#9b845e;
 --ink:#211b12; --dim:#51432d; --faint:#66563b; --brass:#705020;
 --green:#35552c; --rust:#872e20; --fill:rgba(108,76,29,.13);
 --tw-paper:url("data:image/jpeg;base64,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");
--tw-border:url("data:image/png;base64,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");
--tw-title:url("data:image/png;base64,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");
--tw-tab:url("data:image/png;base64,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");
--tw-tab-active:url("data:image/png;base64,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");
--tw-controls:url("data:image/png;base64,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");
--tw-table:url("data:image/png;base64,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");
--tw-thead:url("data:image/jpeg;base64,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");
--tw-row:url("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAoAAAAdCAYAAACT4f2eAAAAGXRFWHRTb2Z0d2FyZQBBZG9iZSBJbWFnZVJlYWR5ccllPAAAAHtJREFUeNpinNYQ/JaBCMDy/9+/c0h8RpwKgfgFsQqfEGU1ED8F4v9QPjoNA//RTWTEQYNNfIfFBHTACFL4lljPfCLWM1+IVfgTj29RFP4lVuEfYq3+S4xCJgYiwVBQyCLAy0mUQkYtFXGGUUAxYGRmZs7Gk6ng2RYgwADjVxuqqbpdAwAAAABJRU5ErkJggg==");
--tw-button:url("data:image/png;base64,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");
--tw-button-middle:url("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABIAAAAkCAYAAACE7WrnAAAEuUlEQVR4XuWVS28jRRDHyz09mfH4MXbiTIZEiWJlg9g3sKsFJMSBx40LaE8IiQtw3W+AECcOHLjxBZA4IXFA+w0QaA8rWMECyi7ZTeSs47zszHg8D8+Yf417hBVpL9wQLf1U3V1d/66u6bbp/9kM0ASOYgFUnxZQ+urW22cdEiyBlgo0+oMBO5Krz58PH2/vHaHPDIEAJbZnhSRoI9BVQjVQBtSw7QgmgK8Puwc6ncOhx0JMabNZnhVaV6x4SeLUdN2GLRZEGJ9izNk8AY/BXyHJmFipYRKFU5E6eA5sgFXgqDlLCYVgGIbU42zANthS2ZGEo1jVImD+U1wXLntGKAZ91R8BDxyrekXiGfQQbDQ4aEpjxaQm5uZVnRZcYKLfgGVc+DZMqr/Syqm+uSaEvLZMtHNM1tp8vnN1MKKaXZ6KzjWFXTG0SlEjMAGx1bTmF+zKodp4Hnhy5bxNzZPA4COsri9WYWtHg2E1OAnqCGDBotimEgoOul4F/hr8ZQiaWK8JTNIwSs1fdxLj+9t75u6jgzklyoEGAiwGfZ7PNwQmYvI+RHT4NcJZqU20Cd55q0mfvHdRfH1zmX4EOxj7qEEKm142aQT7BPW4C/vtDZM+R/8DcB2+urCml0IIk7TuiMSDh5neiYnRBhhXLEGTmqBqlXRfyy+fjrFur5pafqO9TCw5QoqXL+j06prQ2o7gvnZuQ2gIFrxIq+IIQUb7vYxSn6h7SBr6LCYW52KtMc54XS4oUTByIo8W3ZqGswp8JXHRtbivkWq85rctj9bGmcaZQlzrIRmnKeRik0rxSUbyzi8Dai8JQmAewA1fgoqWfwzQbmnw12hFva3iwbIfJSB546rNIvzliJS9vxPRei1lYc60EM8F8JVmN5mwXW/rJcm7M3p9o/CXktOHdH+f6BFuKmpBB/EchIMJhPNAd/VKqWHbYsG+K1Rmmix2cOtELIDxBMLphSWiI9NAbWK6uGnQflih7a0uoT7jytYPGULGIC0Zcxk2SyWp1t29l+KIGXbNIMZppwTt1667cno01GXJ5YzEH392s55HLJYC2t7PMvrs3WW69Ya9CXsTfAq+wfjORy/qHdgA4xSXlC/lGHYf8z/D/x3mvwAfov8S5pry3k971JcidWpewhlAPa02zeTCmpUgQ54zpgX3QvbjYyTW9M2NkVnEc/BPJET43Ml2QLkQrkK06BohRDgwghWwBLEYJsZ9QrA36vw+GOFbxHaZ47xYolhUoTjCjQ3wDAL1ugNk5qOvg0kPPQc/MLjxp9g0eNCjIa+DyNDXKKK9LBbd3ZAe7mQhRDiDEQugkCziI9D3fRpkIQ0g5mMzny2ezrDuiBFE8qypZU4kobmtPPAUDADvOoCIwT7eAI+SkDkfve8n8oR8v4/xKQUhx5z6J+FEVt0qa2VK5JjBwspQWKLX9TnYKpfLVEtKsZdOvMhPj4jKx73d0fHM5hN57dKzpFrxQ24XtaFLeeomoH6QRDBD0AOHzDg66hdvrnT7y49ppjnF/xpoAfvM35EPOHgfPAa7QDCl91+/TLNNiThKqDojVGR0BA6QTUcaC2nD0vOM6CmtrjK7BF5QXAHnwAL9iyZBWWHQf6r9DcrwOuw9367OAAAAAElFTkSuQmCC");
}
:host([data-tema="pult"]) .frame{
 font-family:Arial,Verdana,sans-serif;font-size:13px;line-height:1.35;
 background:#e6d8b6 var(--tw-paper) center top / 100% auto repeat-y;
}
:host([data-tema="pult"]) .frame{
 position:relative;border-style:solid;border-color:transparent;border-width:27px 14px 13px;
 border-image:var(--tw-border) 35 16 16 16 / 27px 14px 13px stretch;
 border-radius:0;box-shadow:0 8px 22px #0008;overflow:visible;
}
:host([data-tema="pult"]) .frame .bar{
 display:grid;grid-template-columns:1fr auto;gap:0;min-height:66px;
 padding:23px 8px 0;margin:-17px -6px 0;background:transparent;border:0;box-shadow:none;
}
:host([data-tema="pult"]) .frame .bar .mark{
 grid-column:1 / -1;grid-row:2;justify-content:center;width:100%;min-height:43px;
 padding:4px 7px 8px;border:0;border-radius:0;box-shadow:none;
 background:var(--tw-title) center / 100% 100% no-repeat;
 color:#ffe7b1;font-family:"Times New Roman",serif;font-size:26.6667px;font-weight:700;
 line-height:1.15;text-shadow:0 1px 1px #241008;
}
:host([data-tema="pult"]) .mark-jel{display:none}
:host([data-tema="pult"]) .frame .bar .ver{
 position:absolute;left:7px;top:3px;font:10px Arial,sans-serif;color:#d2c196;
}
:host([data-tema="pult"]) .live-dot{position:absolute;left:96px;top:7px;width:5px;height:5px;animation:none;box-shadow:none}
/* t60: a TESZT frissites-proba gombja a felso savban, a verzio mellett, a
   racson kivul. A t56-t59-ben a Pult racsa sajat, teljes szelessegu sort
   nyitott neki, a fejlec megnott es letakarta a fulsort. */
:host([data-tema="pult"]) .frame .bar .frissjel{
 position:absolute;left:108px;top:1px;margin:0;padding:1px 8px;border-radius:3px;
 font:700 10px/14px Arial,sans-serif;animation:none;transform:none;
}
:host([data-tema="pult"]) .ablak-vezerlok{position:absolute;right:1px;top:0;display:flex;gap:2px}
:host([data-tema="pult"]) :is(.ujra,.mindzar,.mini,.zar){
 width:20px;height:20px;border:0;border-radius:0;font-size:0;color:transparent;
 background-image:var(--tw-controls);background-repeat:no-repeat;background-size:80px 40px;
}
/* t38: az elso ikon a jatek sajat gombsavjaban az "Ablak frissitese". */
:host([data-tema="pult"]) .ujra{background-position:0 -20px}
/* A gombsav masodik ikonja: "Az osszes nyitott ablak bezarasa". */
:host([data-tema="pult"]) .mindzar{background-position:-20px -20px}
:host([data-tema="pult"]) .mini{background-position:-40px -20px}
:host([data-tema="pult"]) .zar{background-position:-60px -20px}
:host([data-tema="pult"]) :is(.ujra,.mindzar,.mini,.zar):hover{filter:brightness(1.2)}
:host([data-tema="pult"]) .stage{padding:0 8px 12px;background:transparent}
:host([data-tema="pult"]) .fulsor{
 align-items:end;gap:2px;min-height:35px;margin:0 0 10px;padding:0 0 2px;border-bottom:1px solid #806b45;
}
:host([data-tema="pult"]) .fulsor .ful{
 min-height:23px;padding:4px 15px 5px;border:0;border-radius:0;
 border-image:none;background:var(--tw-tab) center / 100% 100% no-repeat;
 color:#c4b392;font:700 11px Arial,Verdana,sans-serif;box-shadow:none;
}
:host([data-tema="pult"]) .fulsor .ful.aktiv{
 min-height:33px;padding-top:7px;background-image:var(--tw-tab-active);font-size:13.3333px;
 color:#e8d9b1;box-shadow:none;
}
:host([data-tema="pult"]) .fulsor .ful:hover{color:#fff0c5;filter:brightness(1.12)}
:host([data-tema="pult"]) :is(.hero-kicker,.hero-subline,.kpi .k,.kpi .v,.blokk-cim,.psor .nev,.psor .pc,.hsor .ora,.ksor .kdb,.bsor .alsor,.bsor .szo,.csik span,.piac-arsor,.dash-fej .osszefog,.statusz .jel,.bfej .datum,.prior-sorszam,#allapot,.mbub,.pbub,.mbub .db,.pbub .par){font-family:Arial,Verdana,sans-serif}
:host([data-tema="pult"]) :is(.blokk-cim,.hero-kicker,.kpi .k){letter-spacing:0;text-transform:none;font-size:11px}
:host([data-tema="pult"]) :is(.bfej b,.dash-fej .cim){font-family:Arial,Verdana,sans-serif;font-size:13px;font-weight:700}
:host([data-tema="pult"]) :is(.dash,.kinalatlista,.mbub,.pbub){
 border:9px solid transparent;border-image:var(--tw-table) 12 / 9px stretch;
 border-radius:0;background:var(--tw-paper) center top / 100% auto repeat-y;box-shadow:none;
}
:host([data-tema="pult"]) .dash{padding:3px 7px 8px;margin-bottom:12px}
:host([data-tema="pult"]) .dash-fej{padding:4px 0;border-bottom:1px solid #a18b65}
:host([data-tema="pult"]) .dash-body{margin-top:8px}
:host([data-tema="pult"]) .hero{gap:10px}
:host([data-tema="pult"]) .hero-main{padding:4px 10px 4px 0}
:host([data-tema="pult"]) .hero-percent{font:700 24px Arial,sans-serif}
:host([data-tema="pult"]) .hero-track{margin-top:7px;height:12px;border:1px solid #816b41}
:host([data-tema="pult"]) .hero-subline{font-size:11px;font-weight:400}
:host([data-tema="pult"]) .kpi{padding:3px 5px}
:host([data-tema="pult"]) .kpi .v{font-size:14px}
:host([data-tema="pult"]) :is(.track,.track i,.sav,.sav>div){border-radius:0}
:host([data-tema="pult"]) .track{background:#c9b688;border:1px solid #9e8658}
:host([data-tema="pult"]) .track i{background:linear-gradient(#b59b57,#8e702e)}
:host([data-tema="pult"]) .track i.kesz{background:#5a713c}
:host([data-tema="pult"]) .bfej{
 background:var(--tw-thead) center top / auto 56px repeat-x;border:1px solid #8f7a51;
 padding:5px 6px;min-height:31px;color:#312417;
}
:host([data-tema="pult"]) .bfej b{color:#312417}
:host([data-tema="pult"]) .bsor{
 min-height:59px;padding:8px 6px 8px 9px;gap:8px;
 background:var(--tw-row) center bottom / auto 100% repeat-x;
 border-bottom:1px solid #ae9d78;box-shadow:none;
}
:host([data-tema="pult"]) .bsor:hover{background-color:#cbb988}
:host([data-tema="pult"]) .bsor .nev{font-size:13px;font-weight:700}
:host([data-tema="pult"]) .bsor .kep{border:0;background:transparent;object-fit:contain}
:host([data-tema="pult"]) .csik{height:18px;border:1px solid #a38b57;background:#e8d9b4}
:host([data-tema="pult"]) .csik .felirat{font-size:11px;color:#241d12;text-shadow:none}
:host([data-tema="pult"]) :is(.psor,.ksor,.hsor){min-height:24px}
:host([data-tema="pult"]) :is(.psor .nev,.psor .pc){color:#302619}
:host([data-tema="pult"]) :is(.asor,.osor,.ksor2){
 min-height:31px;padding-top:3px;padding-bottom:3px;border:0;border-radius:0;
 background:var(--tw-row) center top / auto 100% repeat-x;font-size:12px;
}
:host([data-tema="pult"]) :is(.asor,.osor,.ksor2):hover{background-color:#cebb8f}
:host([data-tema="pult"]) .ach{
 background:var(--tw-thead) center top repeat-x;border-bottom:1px solid #927d54;
 color:#332515;padding:5px 7px;font-size:12px;
}
:host([data-tema="pult"]) :is(.aitt,.kvdoboz,.kvsav,.pkatvalaszto,.pkat,.jlista,.szuro-panel){border-radius:0}
:host([data-tema="pult"]) :is(.gomb,.ujform .add,.bujOk,.bplusz){
 border:5px solid transparent;border-image:var(--tw-button) 6 / 5px stretch;
 background:#4b321b var(--tw-button-middle) center / auto 100% repeat-x;
 color:#f5e6c2;box-shadow:none;border-radius:0;padding:3px 8px;
 font-family:Arial,Verdana,sans-serif;font-size:12px;line-height:1.2;text-shadow:0 1px #23150c;
}
:host([data-tema="pult"]) :is(.gomb.munkab,.gomb.piacb,.ujform .add,.bujOk){background:#4b321b var(--tw-button-middle) center / auto 100% repeat-x;color:#f5e6c2;border-color:transparent;box-shadow:none}
:host([data-tema="pult"]) .bplusz{padding:0 3px;min-width:22px}
:host([data-tema="pult"]) :is(.gomb.keszpill,.gomb.piacpill){background:#d8dfbc;color:#35552c;border:1px solid #87946a;text-shadow:none;padding:6px 10px}
:host([data-tema="pult"]) .gomb.gyart{background:transparent;color:#69502b;border:1px dashed #927c4e;text-shadow:none}
:host([data-tema="pult"]) :is(.gomb,.ujform .add,.bujOk,.bplusz):hover:not(:disabled){filter:brightness(1.15)}
:host([data-tema="pult"]) :is(.gomb.kvbiztos,.agomb.kvbiztos){background:#762719;color:#fff0dd}
:host([data-tema="pult"]) :is(.ujform input,.bujsor input,.piacmezo input,.esav input){
 background:#eee9d9;border:1px solid #886f45;border-radius:1px;
 box-shadow:inset 0 1px 4px #50341675,0 1px #fff7dd;color:#241d14;font-family:Arial,Verdana,sans-serif;
}
:host([data-tema="pult"]) :is(button,input,summary):focus-visible{outline:2px solid #805a24;outline-offset:2px}
:host([data-tema="pult"]) :is(.jlista,.szuro-panel){background:#efe3c6 var(--tw-paper) center top / 100% auto repeat-y}
:host([data-tema="pult"]) .grip{height:15px;background:transparent;border-top:1px solid #a28b5d;margin:0 8px}
:host([data-tema="pult"]) .grip span{background:#826844;border:1px solid #d4c49e;height:5px;width:44px}
:host([data-tema="pult"]) .alairas{font-family:Arial,sans-serif}
@media(max-width:560px){
 :host([data-tema="pult"]) .frame .bar .mark{font-size:20px}
 :host([data-tema="pult"]) .frame .bar .ver{display:none}
 :host([data-tema="pult"]) .live-dot{left:8px}
 :host([data-tema="pult"]) .fulsor .ful{padding-left:10px;padding-right:10px}
 :host([data-tema="pult"]) .bsor{gap:5px}
}

:host([data-tema="pult"]) .csik .felirat.vilagos{display:none}

:host([data-tema="pult"]) .acs{border:0;border-bottom:1px solid #9b845e;border-radius:0;background:transparent;margin-bottom:8px}
/* A pergamen nem ismetli meg a sotet kepperemet magas ablakban. */
:host([data-tema="pult"]) .frame{background-size:100% 100%;background-repeat:no-repeat;background-clip:padding-box}
:host([data-tema="pult"]) :is(.dash,.kinalatlista,.mbub,.pbub){background-size:100% 100%;background-repeat:no-repeat;background-clip:padding-box}
:host([data-tema="pult"]) .bnevSzerk{font-family:Arial,Verdana,sans-serif;color:#312417;font-size:13px}

/* t28: belso tavolsagok, eles pergamen, lapos sorok, also fulek. */
:host([data-tema="pult"]){--tw-paper-tile:url("data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHhtbG5zOnhsaW5rPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5L3hsaW5rIiB3aWR0aD0iMTI4MCIgaGVpZ2h0PSI2MDAiPjxkZWZzPjxnIGlkPSJ0aWxlIj48c3ZnIHdpZHRoPSI2NDAiIGhlaWdodD0iMzAwIiB2aWV3Qm94PSI0MCA2MCA2NDAgMzAwIj48aW1hZ2Ugd2lkdGg9IjcyMSIgaGVpZ2h0PSI0MjAiIHhsaW5rOmhyZWY9ImRhdGE6aW1hZ2UvanBlZztiYXNlNjQsLzlqLzRBQVFTa1pKUmdBQkFRRUFTQUJJQUFELzJ3QkRBQW9IQndnSEJnb0lDQWdMQ2dvTERoZ1FEZzBORGgwVkZoRVlJeDhsSkNJZklpRW1LemN2SmlrMEtTRWlNRUV4TkRrN1BqNCtKUzVFU1VNOFNEYzlQanYvMndCREFRb0xDdzRORGh3UUVCdzdLQ0lvT3pzN096czdPenM3T3pzN096czdPenM3T3pzN096czdPenM3T3pzN096czdPenM3T3pzN096czdPenM3T3pzN096di93Z0FSQ0FHa0F0RURBU0lBQWhFQkF4RUIvOFFBR2dBQUF3RUJBUUVBQUFBQUFBQUFBQUFBQUFFQ0F3WUVCZi9FQUJjQkFRRUJBUUFBQUFBQUFBQUFBQUFBQUFBQkF3TC8yZ0FNQXdFQUFoQURFQUFBQWVaNmJtdW13MSt2YXZQdXFSZVc1a2J6MUpZek5pU291UnhaYkdrcVJVckZHaUlLQXVhTG1vcWlTRU5BMVpBMk5waW01QWFCcGpFQ2k1Qk1CcWpNcFJWVFZEQ2tKaXVXaXVXV2xWQXdKWUpDSElTMUxrVjUzQW1xY3RRbWlWVFNsOFBHZGZ5T25QemhtK1gwT201bnE4ZGZvV25uMVFGamFvVnBraVJhVEdnQmpKblZtVHRFTUNRSW1oSmFrS2FkQXdtZ0VEaENDNEpLcUJhUkthSk5XcFlEUW13a2JCb0dDR2hGa3NHTUtnclF6RW96UzZHUVdwQ2lGR2lnTlZBV2todUtVU3pqNS9NZE55dWsrZVViNC9XKzc4UDd1RzMxNlR6cnBGbFRVMHdCRkJuU0NxUWFDWXdRNUVLU1lHQTNJaXBBNmhscE1Za05vRk5RcXBBMHdtNW9hb0lLQUJrdFRGdVdNRlRFQTBEWUFKZ3FRaWdndVNWWVEyeUNrU3FVcVlBTUFZUm50a3Z5UGlmZCtKM1BuQ05zL1Iwbks5VG4xOWR4V2ZXaExUUVRvQ2hBRXEwQ2RFM0FhcUtRUWhLbExKU1FFeG9RMHFHMDZKcFFuRkR6dVJVMHFFRGJTVXhrc1lJU29ZSUdNUURUUk1WVUFKdWhDWU1ZczdRcHNKS1FrMHFuU1lUWUpYSklOVFBYT1g1UE9kSnltblBsTXpmTDM5UHpQU1k2ZllxYno2YzI3RTBoNlphQ0FLU2t1V2lpV0lVbWhGSVZBTWtGU29GcEFxUU5xU2liSWJaSlFHZTBFVzNFelpTS1FCSXhBbU1sa3kwTjJBMlNBTUFHZ2JLcE5sa0t5V0dJSkdTVVJJTUdBb3RMTkloVGFsK1Z5dlZjdnBQbGdiNCszcHVXNmJIWDdkNGFaOTd1WGVXQVoySUtpak1wb3AweUxtcHRLalNUSzBpNUVNbGxXbVhMVkJVeEJhSnBvQk10d3dSSlFnYmxsSUNWVURRRGFaSkpHbFJkTVRwQWtLVENwWlRSVklReHlDWVNxVXBPa0VYR2tTcm1oWE1TeFNxWE12aDQvc3VKMDU4WWpmUDNkTnpQUzQ2ZlR1YXk3MHZLdXVka2tsd3JJcVdyb3FoREl6MlJGd3hLcVFsaG10SWpWb29UazBxS0lZRkRaRHFRYUNKdk9BVFc3bXJBQVVVRXE0R01FV0V1a0RkV1FXR1pySW1VS3BvQUtTWUljd2s1bHRKaVZJWk5BcVJDcFN6TlJ6ZkR4L1ZjcnBQbmdiNWUzb2ViNkxIVDdaNWZSajNzbEhVOURnc05mUHZTbHFMZURQU1pUVzhLQXZOR2s1cXZUT1JKcVpzMWZsbzJ2TFFweXlVd0xsMVNsSnBMVXFnbmxiSGJONWxtczVzMElvYVJZRWhkUlVVQ3RwelNVUTZKcFJRa055eHBxZ1NoeUpVZ2lnSUVLcXFHVTVZSVVxejF4NXZ5ZVc2ZmxkT2ZHSTN5OS9RYzMxR092cDlNN1o5cGFYWVZWV2ViVzBUT2daQlFtbU5NTTNRWmxVZWRlaEdWM2FaVnFWRnRraklrcEEyQXdvQkdaYzhxYWRSRm9rR1cwNmNDUXBVRG14eFVsV2dTZFVpa1NGUkxvb20wU0JCbnFsekt6aTBVSmdUYVkwNUJOU3psdGh6MTgvaytzNC9UbnhnYjVlbnJPVTZ2THY2R3MxbDNUVldhTlBxSnpaSmNHYkhDYlFKeXRKTkJPRm9XaVp0MEtvZGJLYkpDUnpjUVhMRzA2VGxna0ZKaG1yUkphQmtqaTVSc29LVkV6WVVJcDFMR0NBbHhSRlZTbGphQlRVUVN4WmJVVTg2R0FDcVpRRkJuY3pyNS9FOXp4R25QaUdiNWV6cU9WNmZIVDZ1bVd1ZmRDTE5hejA2aVlrMGxNaEZyTk5wTTFLbzBFeldreXl5cVlOSnBCT3MwRTB4WjJDZElxV0NRaVJnMmtJYUdtQ0dFMHhGU0tzbWh0TVUxSTNORFJRbFNBQUdnQUFtb0FwU3BWSW0zQUowbFNpVTU1c3hXYzY4bkhkYnlHblBqRWI1ZW5wdWM2ZkxUNm1pZU9sQ3JybGE1M1lxQ3dxUWJ6c3RKaWxzS2tDYWt0S2dUQlZRTlZOaUtpRXdWeTJLZ0pta1NEQk1FTUUwMHBOa2c2UXdITkZ4U0dnSkxrcHBpRXdhQVRReVdySXRCT1I1M0VVSlN1cENoTXpUbm16bnBNdnl1UzYzbGRlZkNNMno5ZlU4cDF1T24xYW1zdXhsZFFHN0pCZ0FGVFZqVFFWbmRBQ0pxcFpMa2xxeTBPd0JEbHBaYlVqYXUxelNTWjBTNWpVQWtOb3NCT0c0b2JsMHhBcWlpa0EybUEwTnd4cG9RQUlBcVFZZ3FXaERJa2Nxd0lhRUthSllqU09iODdrZXc0elRueUNOOC9SMkhKZFpscDlYU0x5Nml0Sm9yTzdKYWtzbGhjVlpRQ1NERzVZRFE1YUZwblpiaXFZNUNhVU9LQnRWUWdHZ0ptNGhKelRBbEJpS2dFd29BQk1LQUZTQ3BiRTJnUWhweURpNGFDMEVSU0N3QUFhaUcxS3dDVmN5d211Yjg3aWUyNDNYbnhETnMvVjFITGRibjM5alhPOCt0SmpReXBoTTZCbFRRM04yRGJTVlVxRXNxYUJScG1sVWdvVmxEZFFVaVNnbG9nWUFCVXhjUUpsb21EUUkzTktBaGdJTUJvWU1CVWdhRUNBY3VSdE9CTktBckcwU3RwMFRSSkl4Uk5RbFV5ekdtY2ZINWJxdVQwbmpBMno5SFljajEyZmYyc3Q2ejZ5c2tZNUkyeTBoSk1kUmZVYlFKVkpBd2RUUXBxUmlvb1FtbFoxVktrSk5FdE9LVFFrU09XeVFWVkxrWXFCcWhNUlFnSExHMERCRHFXQ2FFREpWVEsyZ2FFQXdUSFlBQTBRMGhRQ0dpWlpqVEtQbGNoMS9KYWMrTURiajFkWnlYWFo5L2NJeXo2OU1WUUVURnlxVUhLVmNYMUd3c1V0U3pVTXBnUzJ4VW1pbWtKeTExSmRqUUVzSXBFMGtFQWdKcEJJcXNHRlN4T2FHTkN0TUV3Qk1HbU9XRXNCSm9rRkxRbWpBcFVnWW5BTkFnQnk1UkNsU3ZPUGo4bDJISGFjK1FEYlBidWVKN2JMVDZGUldmZWhLU2FLVlBLeHBsanVhc29SWWswQ3RTeU1Dd3BERVFCSlFveG9JQUpaU0VJVEJFaUhNQTNRMkRWSW1tQ2FDaWFvUVEwTVRHSmlBUUpWSUpzUUVESFFGQ0dnQWhUVWlFYzJrcFdvZWZOODNCOTF4R25Qa0EzejM3UGpPeHk3K3BwbGVYYmFhMUZSWTZHRGJzZDU2MlFXckRPODFvWWt0Z3hnSmdnb2x0QU1JSEFWRktDRUJBME1rdENWQUF3Q2dUUWxhRTB3cEFBQXdFbUFBSlVFakJBRGFCdWFDYWtBSVV1WldCQ204NVNXcGZuOFYyM0U2YytZRGZMZnNPUjZiTFQ2M295OU9XZ0NSTkZPNG9xbGRubjJic1puUXBkRVVBM0xzb21oTkE2UU1LSkdpSTB6QUJXbUloZ2t3cE5BTUVtQlVzYUFZTVFBRENhRURsZ0lHbUNhQUhJS2tBd0dNRTBJVGhSYWxTRkRsektTNGw4WEVkanlPblBrQTN6MzZybGVxejcrNHBySHZRVEFBblhMYXk3bXVvWjZJbTA2R2toTmhuU2NKdDFOQURhUXBNYWFxTTdtV1FBQUFRSmlMVFEzSU5BRlN4c2t0SmdJcWdJUUlhRU1tZ0JpRXdHZ0FFd0c1WTB3UTBUTkhObFVvbWFVc1JlZlBYeXVUNnJsTnMvT0J0bnYxdko5YmxwOVhXTHkwdVdJbk5MR2sxWlZSWFhOVm5yVFVzVTNJMkNKVm11alRSb2t0RFFwTUVRRVVsa0pHTkRFd0JGQUNZVWhrRG14QWhnaW1GQ0ZEa1E1dUJ0b0FBRXhvWUFEUUEwd0hJQ1lsVXlpYzhqTzVsenoxejU2K1p5WFg4anJ4NVFOODkrdzQzc011L3I2UVphV21pYVFVNWQ1b1IxSzB5czBjMVFOSkZLaHBnb0dVQUtwQ3FobzAwU21MRWF3SnpheTB3UURBQlVoTUJYSWxPUVpMS1JtYUtoWWJCQUpTWUthbFJnQXFRYUJpQmd4SUFCSzBPRk5MbE1Ybk9sbmNjWDUvRzloeHUzR0lHK1cvVWN4MVdlbjNhSGpvcHJNcVVGTWk4M2VPM1UwSUIzblk2a05HaXhwVVNNRURKUUE0azFCQ2FZU3d5dElhRU5wcTNJbEpBT1dOcGdOQWdHNUMwMEFBbklVVEswUzBwT1NpV055eGdBQUFnYlJLbkpEa0lVYVo4OVJscGx6Zms4djFQTGI4ZVlEYkxick9TNnpQVDcybVdtT2l6dVNBcEZOS3g2WnZxYVZJUFRORnVLTmlHVTVkak1nMk05Q1p1U2N0UUxRQ2FSSnlTNWFzUU9XQ2FZd0FZeE5BMEFJQmdpbkxHbklKb1NLRTFRRFJOQURBWTBJRU1tb0JDaUNBQ1ZUY2MzUEhmRG0vSzVYcStTMzR4QTJ5MjZqbFB2Y2Q5YS9tM2pwNzgvSWoyVjRMVDFMeUhVOXo4SWZRUEFKN3ErZFZ2MGp3QjlDL2wwZlJmemtuMEQ1OUgwSytXejZNK0VQYS9uaDlGL05ENlM4RW50WHowZlJQQUh1cndNOXg0UTkwK09UNkI0R2U1K0ZudGZnWjdUNTdQZXZGSjczNEE5NjhMTnRmRUh1UENqM3Y1N3M5MWVCbjBGNFE5NjhTUGMvbmtmUVBudGZmSGprK2d2RUh0UENqM1A1OVMrNDhEajNUNDVsOVdPSG41dms1ZjdIeE44NEExNFBjRWV5dzQ3UUFNRVFBbUEwQk5BVUFOQVVnUVFLTUFBUUFCQU1BbEFBQzBBZ0FDQlNnQUJBQlJBQUNOQURBU0FBQVlVQURBQkFEQUFJQUFBQkFEQVFDa2dHWUw1UEVIWElCMVAvL0VBQ3dRQUFFQ0JBVUVBZ0lEQVFFQUFBQUFBQUVBRVFJUUV5QURCQ0V3TVJJelFFRUZVQ00wSWpKZ0pCVC8yZ0FJQVFFQUFRVUN3Vmt3K0doc3UwL2ZyU1hFaFpvaGM3YkhxWEcyYkJQMTRBbjd1elhZeFJvc0ZaSCtuRXduUk9rUE15RU5BeVpNbVpIV1RKdEplN1hsenQ2M3NtbWJmWGdjeUUydnp2NitNTkZseXl5WXNkcGpiWkFMbmFFbVFGcnpmY05yM0N4MDZkUE4wNmRPblRwNU9ubTZ6dXVGbUM0VURBWk5xRTJ2ZTVreWE1dkJmeW5zZlllMG9yTWE0V0lRWVdXRXNsRm9MblR1dmRnMndqTVdlcGxQWTY2a0wzSGlzbTNTczJXdzhUaFlFUVdUR2x6cm03aTgydHUrOXMzQ1lQbEZab2ZqeFlnenJBMVdSN1V4SnBpNTk3alpLRnc4TVhIWUs5ek15czMyTVhRT3NHSmw4ZWZ4VEd3YkNnWlBKOW84WEc3MzYrb1BHZC9XeFl0RmdMSS8wZWVzdlVPNE56aVhzcmlZbHJieFkrMGZMSWRaM3NZN3NzdVdXU242RW5VTVQyT25UeUVuVHk5VDEyUjRodDlQNFhPMW5nK0RtQzRXQ3NrMU1URWlFTkxDaHd2ZXExUmNwckhlWW0wenB0bmJLSGpGRGF6WWZMNG8wV0U2eWZhZFE3WE1pdFcxc0JLZWVxQXRLRW1tTHhzdmFQSFBOMmE3R0k3TEFXVUFvdG9FNkJud0U2RXVRZ2lVNmhlUlhDMEthVG9UZlY1aE5KcitVTkxXM1drUEl6Ui9CaS8xV0FXV1Q3Y2h3OW5LOWl6MmluMWw2bjdteUUzUXZLOUJEWUhqZXR3ck45bkdPaXdWa3Y2aVRyMmloeWpNUExnVDlMcTBzRzI5cldQZUQ0cHVlNHl6djYrTndzTHFXU2NRQ1BWNWV3aU5CeTZPc3VvcDExNmRTNms2RVFsMUYrb0tvRjFoRFZFNkNKeUkzUUtjWHV0VjY5RlBJemVRa0VWNmtKZ29wMDZkUE43emJ6TnJTb3VNNzJNWHFsZ0xLajhjTUljQkJOcUUyZ0Vtc1pOSmwweTFYVENqaGdMbzE2VXk2WEhRRTFyVEFuNmtKbmdjTmNKQ1JRdGFUSmswallVMjdGeG05Y0RHYnBXRXNwMlliQk16UFBUYTBtY01qSnRSWWRkb0loQzBXbmI5WEZOY0xSZEZ4ajY0T0p3c09KbGxQMXdKaWZ1WlFSRnpTZFJJTzBnWG43azhuOEJ5aDVBTExxMmlzY2ZpamllRllTeW5ZaHU5ek11Ym5rT1BUSnBEUkErTSs4TnhwUHRZL2F4T0ZncktkbUZGQ1FrOW51MWswdmZDZWJCTm9udWI2WTcrT2Z3NHY5VmhMSmRtRXJreUY0WE5qTmExdlAwaDJTZWtiaFJXYlA4QXo0bkN3eXkrUEw0ZTE3czkzY3BwTW1rM21uYTkrQVpaNHRsc1NLV0NzaDIwVjYyQW5rTHdXWHQ3dmYwQjU4Zk85akZsZ2xaRS9oQ09xRzRKTmVPZGtXSDdITi9yNHAwV0VzajJFMjY2RXh1SDdqTmRqRTRXR3NoK3Vua0wvYy9mbmpiZnpjMTJJM1pZU3lHdUF5QVJoWEV5aFAzUFQ3RStQbXkyWHhPRmhGbDhjYlcxNVVRMEVLYmVhVG9lWVBQTXMvRTJEaW1XRXZqZXlCcVYxU2RGQ3h0OGZlRlo3c1luQ3czWHhmWWZXUHFlRWFUaHNHdy8rQ01zOSt2RzhzSmZHdU1CZzVZeWFVVUxpRU50anhQZmx0NGJvNnJQRDhHSndzSXI0ekVIUzY0UmtKRXJtOG8ydEprZnYva0krbkF4VExEWHgwQUdDbzRtSTFFaVZBN2JicDlCci9nczdCMTRFZkNnZFpUVEx5ZVJDYmZIK0N4dFlJM2xockxIOFBJRWpMMXdoL2ppc1grc2NvRms0bnl3a1puWUNQMmI2K0ptRDA0VVhDZ0t5ZjZvNUp0RmpvVEtmWC9DK3N4Mm96b29HV1JQL1BGRWhyRHNQL0lXRkNaM0Q5dm1OTUtJQmxockpQRmhDSFVTTnpJd3kxZEdGTm9MTmRvL2Nac3RnWW5DZ1h4eC9GRW5hNFdQcmEyeTFoKzFNaXM5cGdSeWdMTDR6dEVybVQyRGl4dkNQZ2lYdjZJb3JQZnJ4bDVRTDQ5di9PaGI3bTloUSt0SGtGRlp2OWVPV0dzaDJCdGV3bmt6Z0R4QjlpVVZtZXhId29Ga1AxOXB0ZU5odkFid251SGllNW1SV1o3TVhDaEsrT0w1YTBwMDhndUVGN20xanB2b0craHpoYkFpTW9GOFpGL0cwM2o3Ri9IS2RaNkpzQ09XR3ZqUitLOGxBc2hQaVl0OXByWGE4ekd5UHBpaXM1Mkk1UUw0M3N6Tm52Mko4ekRybWZxeHB4RFViSSt2S0t6bllqbEN2ak96TTJoRG1UaWI2QlF6SzFXdHJQY2ZGZnppaXM3K3ZFWlFMNDJMOGFlN3BRQVJzZENUb0ZPblRwMENBRTZkT25UMk9qYWZDaU1hQkxQNVJVU3pzZjRZcFFsbGtZaENxcmlycFVDcWhWUXF5cWg2b1ZVS3NBYW9WVUtzcXdWWUt1cTZyQlZnampoREdDckJWbFdWWUtzRldDcmhWZ3E2cmhWZ3F5cmhWd3F3VlpWZ3F3VlVLc0ZXVllLc0ZXQ3JCVmdxd1ZZS3NGV0NyQlZncXdWWUtzRldDckJWUXF5ckJWZ3F3VllLc0ZXQ3JCVmdxd1ZZS3NGV0NyaFZWV0NyQlZncXdWY0tzRlhDckJWZ3F3UnhsRmpMTng5VUpNOE1rQVJ4S3BFcWtTcVJLcEV1dUpkY1M2NGwxbGRjU3FSS3BFdXVKVklsVWlWV0pWSWtNU0pWSWxVaVZTSlZJbFVpVlNKVklsVWlWU0pWSWxVaVZTSlZJbFVpVlNKVklsVWlWU0pWSWxVaVZTSlZJbFVpVlNKVklsVWlWU0pWSWxVaVZTSlZJbFVpVlNKVklsVWlWU0pWSWxVaVZTSlZJbFVpVlNKVklsVWlWU0pWSWxVaVZTSlZJbFVpVlNKVklsVWlWU0pWSWxVaVZTSlZJbFVpVlNKVklsVWlWU0pWSWxVaVZTSlZJa1k0bEdYbi84UUFHaEVCQVFFQkFRRUJBQUFBQUFBQUFBQUFBbEFRQVFBUk1QL2FBQWdCQXdFQlB3RXpGaGhmUHlXY21MRE1XR1lzTXhZWml3ekZobDg4c014WVppd3pGaG1MRE1XR1lzNU1XY21MRE1XR1lzTXhZWml3ekZobVBETWVHWThQWmYzeTdRLy94QUFkRVFBQ0F3RUJBUUVCQUFBQUFBQUFBQUFDRUFBRFVCRUJNU0V3LzlvQUNBRUNBUUUvQVR6QVI0UFoyZG5mNEFpekFSNWxhUE1CSG1BanpBUjVmc0JIbCt5dEhtVm84eXRIbUFqekFSNWxhTE1CRm1Wb3N3RWVaV2p6SzBlWldqeksvaVBNcVZtWlVqeksvaVA1bVZmRWZrNU9UazVpY25KeWNsZm40dmN6eGYvRUFDb1FBQUFFQlFNRkFBRUZBQUFBQUFBQUFBQUJBakVRRVNBaFlEQkFjVUZRVVdHQlVoSXljb0toLzlvQUNBRUJBQVkvQXVnTFdlSHVocWJDL2ZWY0RwRXk4SHJIQzJEcTkwS1BwaTl1aDBKTXNYVUxRWUdnM0xGNWRURFJVcjMydWZiSitJTkErZGVXaExZUzdnY1dtRHRLK0xtR01vcUxyUEZ6b1dyRjUrRGowSDNWZkNsOERwQ3hUQlcxTFFiVHVMZDlWd0xwbHMyd2RmRkI4NHV1TGhYT0xtSGhZS00vTmI2UnhrWTlSc0hZTjMwNUM4by9ZTlQrM1ZtWU93dC9zR2hZKytxb0xaeXdNd3JpaE8ybVdBcTRvVHNieHRnYXVLQzJ0aGZBVmNVZmNJbWV1dWhYT0xtT3NWYzdpWGZ6b2JyaTZxQ3hkZkVXQll1dmdOSDdpNnFGbGkvSjBIemk2bzJCei9LRnNWVklYaWY4dG5iQkZVS1I0T2NMNHJMOHFQMWZsRzlGOFFWNm9SeFMrSkhRampGem9UaTZqOVVKbHNKWU9yaWhPTHE0bzlUeGRWQitqRmhmRlRvVnppNWg0dDF4ZFU2Q3hkWEZDY1hWeFI5eGRYRkNrK0R4ZVhrNkRQeWVMblIvYlZuaFNxUHVoYkQxQm9tbWQ1Nk0rNFdGOTZaZWFEUHlIcmVodys5ZlVlRHhmUmZaOFVFSEQ2RGh3OEhEaHc0Y1BGNE9IRGh3NGNPSEQwT0hEaHc4WGk0Y09IZzlEaHc0Y09IRGh3NGNPSERodzRjT0hEaHc0Y09IZzhIRGg2di94QUFvRUFBQ0FnTUFBZ01BQWdNQkFRRUJBQUFBQVJFaEVERkJVV0VnY1lHUm9UQ3gwY0hoOFBILzJnQUlBUUVBQVQ4aFZQOEE2SGFVUzlFVitpUXlLRm82TlVUZUZXSEpvbVVxNlMyU20vOEFRcllkYUVMcnRtZ3BmQk9Cd29KbC9RNjZkRC9RdUFsQitqWTEvSS9LTTMrR3hSSkFsWkF4RGZvZzBGYXJoQzJWQndSQnc2VnNuUXFYNkpFVWJ5YUlRUnpDSmlqY01qeCs0Y1llSG9ra2J5bkJ1TVNkR2ZaL2JDbHYrRmhaNVA0U3VBZ3RTTFVuOENBN1FtMjNFZElZMHhhR3RNUndmM0pzS3dTTjZGdTJFUzYvK0U2cEcwekltMlBvODNBMTBWRUNoQ20rbWphK2gwanB0RFd6Z2Y4QUFrbExuWkhCS2ZzalpNY0pqaEU5Tk10ZXlHT0VZMUZEVXNhL2dsMUR3NElMK3k1cy9vNVl4eUR3ZUtGcnlhTnFZTmkwYkdMWHJEOURaUE1maVJrcFBBazVISjZPN05Hc01jeWhvK2doaTAvckNtdGp0NmJhTHFoWDZGQkNnMGhxaDA5ZjNsakZIMzlsRmNOYU5JZHpSc0oyeDBnVmFHcFdJWFJibmhQOEUxaWJKZEh2M2hBeDBPVVNTZVRHNUpudWhCUDBOOUV4djBTU1BWRXdzT0grQy9zWlIwU3czaDA4RGRhT0hCTWQ0U1NUa2gra0NTYm9ZOU5IdU5KOENreCtiSUVvMnlid21odENRMkpvdzkyZnhIc2hDSWpaRjRLOUQwSmRHTWxDRHI5eHY5eEJKbjA0VXcxSlpvM05raDZQMDNvUkpQbEd4Ymthb2doK0JvMVEzQkVrSGdjRVRWM2hzbGVjUVJpSGlCaVU0NXNtRmpna1FTUDdKd21pdUUrQmlaME1rYkd5U2NaK0REME5BZmdwUi9wUHdSai9BSUp0NHorUEpNbkVpWklTYkR1Q0dvWlpKTm5vTDZKeHcvOEFSMHZSUkpFNk5MeVFWa0M5a1IwZmRRaS9Jc0o0VE8wVDVHSlFUWTlaT0MxTEpQRFEwM29pSElsSktSQWZ0SElORXlPa0lkZG9aSG9WTTJ4NjJiSG8zb2lScCtKTkVEVU9UUVNiR2w0STZSSkNlRjdFb2VFZXNOVGpYZHNJcGIraFhnUVYwS2NDM0E1UlpCR0c0MnorUmZvS2ZBNGFOTFlqN0pXN0U1UjZJSko4RTRSSXZZclB6OXcvMlgwV3VrNHQ0WFNmUktRM1JFOFpvZHc0NlJZVkhORUVReEVlQ0MyeHI3Z2l2SitHaGpESFpRSWJ4dzJvSXpBeVBKS2gvd0RoQjlrV2FPNDB6L3d0ZktwdkczVFE1VSt3bG9wZjJWbDh5WXNUL2dUc2FoRU5qWXlIMW5SOU1hTmhLU0YvSnpQdVNEcWhzU1J1RVRDOGk4ajM2OGtRSThrMVR5MjBpU3RNOVlKSVZPTTlvYndvY3lMRWpYdkN3dkpSQ2s1aFFiR1h3VG81d2tjMWhQWkVFZUNLT2tJcmhETjBvMkxoa1dkR2p3RW9IckJmNnlkcTU1SkhrUG95UjhyYVkxSWxwQ1JRUnBDdlpDSmcyUkFnaHVDRW5PcEhkZEtZWkxleHN6L3dZbkVPNUpFeE1jVEVFaWVpMUZaZUd6UnhSV0VrMW82TnVEd1JLUDVDd2NEVkQxU0hlRXVzYmhuSkV4dUdKZGdaQkJOME4wS2hJYll5Umo5RFBRdWNMZU5Fd3laVWpmaFNkTzRma1lrTzhGR3hPaVQrMGVKelNHc09reEowVndROTZIYlg2V2tNU2IxQTd4bzRTL0ExTkRrbW9JOGNIL0JON05CTnpvbTMvUkJNWVg5bjRSTitCcWhmUXJKOEQraGZ3SUVjUERTS0tpSy85SWt4TFpGUkJFSVhvcVNTSmptRytqd3U2Tm9kY0pJL2tmOEEvYzBGaFdqN0ZOa2tDV09FYkl4OWpHZEg5Q3ZjRnliMGhya0VHeEQ2VmZCcGFiYVNPakMydEVmWTNCMGlWSXZZMDJPZGpnalE3N0pSU1JzZjlDblQySjM2Rzhrd3JITGtTYkNsUFk0ZEJWc2JibnlUY0UvUTB6NzJhRVBlaFVqZTQraCtoR3IyYkZiZU5jb3JhUTdHVWhNbnBCT0dTU28zaHl4R214Rkd6NkdQNkVVZWlhSG9XcEVMTWVoNkhSSjNXRXAyTW1SQlIwc1k4TWxFQjR6RTZNTFAvUXFlN1lvSitSUmxJckVsamVQR3lxcVRvU2FiL3BwS1lvVzlIQlE0Um9XNW4rUk5hUTVycFk2K2h6TkV1SWdkOW9VS2NPVkQxREdra1QwUS9ZcWI4RWl0d2JGaHJwMG9SUUsxaTRFWDlESUhKN0ovc3FVRXVrMkk0UHdleFA4QUJhbzF3Mk5DMGg3VjQwaVI0ZEtzUHdmVExUSExleDE4R2JJZ0t2OEFwaGlwV1FkNkpSWTA5d253Nk1na1R1RGtpZDNRdjdCcCtCb2M3R3A2ZkJxRnVtSmI0SlBvMUhObmlEYndUMW0vSjJVV21ScUtRVldML3dCR2lteUdHSE1scGlUMGlHV1BVRDNvMnRrd1dndWQ0NFVxSWtXaUlzOW1nM0lremhNbW1HWG9XNEhWRVltaDdvNlhzNUx3MFJXSXd4TzRST0tKaDQ2TWsvdHh0UmhKNkhrbDladzRhMGNlU3lHZXlaZERhRGQrVDZmb3pnYVRXaEwwQ1RKdjM2R2Jpc1gvQU1NVFVkRlNTeTFZMWlVUTVOdW9YMlgwU2diQmVrakhQazlrTkNQY2o5TTZXOE9GUW1lQlZ2SFNCb2RDSTROQ1ExUDRSVXNoOVBXRjk0Y290b1VVTk5GaUxQVUVEM2hxc1AxaDdvZ1ZNNk5XUDNockR4QThWSGtLMG1KUTZhdDJrcERwY09qRmJRblJLTzZsa3dnaUdzK3hLMkp3UkwzUW85QnVObEZJbStoTDh5Ylh0QzlxWjJVTnJUSHNjd2hJV29QMFNsYkZZV3FaZjJOdzlIa1FnandTUFpRaGl4WXFsTEdLSVY0YncxeVJhR2FGczRRUm9nOUVVUjVJT0RGclBCamsySWtiNlR0b25Fa2srUm5kNDRYaHJDQ1kzQ2lDZUdQeUhoVXlHUk1pU0JYdHNYMk1vR1VoUXY4QXBBU1NlaCtpVGVocWhhRDdHMSttNEYvQWRMeUxvVDZvMnRFc2FuZ2lpR04rQk9YMmlYSW5ZMVZqVmJGczRKdUJ2ckVqS0xaUDhFeWlGRVdmUXRZTml0WTRlc25CR2tiUXNhUDBlRWl6cHdZeWVZYlE2R2cvZ1FueUNTK0NzS0pIdjRhU2ZaNU1TMEp3anhkcitsUTU4QmJraFgyU29FL3VRaXhMYTZOQ2FmOEFTQTBDbHBqUXE2SjYyaVRrMFc4alNySVhMSWlUMmh6SHZ5SlR5cVE2RUpMeVZTclFxdHg2SGg0UXVXakdzNDJma25RdUpZNmhnbWh0RGhpZUU0NktTWWdoTFRET0tLYVFxMldRcmV4dGVTL1NVcDhscmdiayt4YlRISVdwRS8wZU5qSmdUTUdnL0lWTmtHYkRkYkpVN0hvVDdKUTRHMGlmWTJob0s4bWhQd1Rab05Ka1NLMVBFazVieFcrMVE3S2Y5V0lkSXBwYllVYmFGZlloY2RFNlppZjJPRGZSYk1DL0dHaU9FRmlQQlFwaUI3YUhPSE5vYWY0eHJ0SWtsSG84RStCS3JKNEZGMG9zaDVTTkVWWFVKRHN0bDdleVBJMHRRS0NCU0ZWbFlLOG5CcVRGaW90c2hZNENLcVFrazFvbXlWQTlqMUFsV05QSkxGc2daSW9naEFsai9jUzdHcUVSQ0tkUU1RanMyUnpXSW9nZE1VTWVOWWJOdENmaEtFWS9RaG91a1FSMFNsQzg0UnVTUFJKSENPaXR0R3VDWnVqVHY4STlpWHNpeHk2UFMreHBNRXJTc2RyaVpNY1ZrbWpuN0l4OUZSVkNYaEMrb0YwSnNtVGdrL0pGWVd5RDlHbStHeUMzMktzUEZGK2kzcytpVDdOTkNSN0ZJcTROblJJNk5Ub1VvZ1FKWFdPQzBLUktSd1F5Qm9aMm1hQzdPRjRJUFE1Sk5uTXJxR29lUjl1Rkp0b2kyZVNac2lLTnF5andteVdIYXNTaGpYOFl0QW1GWHNXSmh3YVBIUndiYUZRbW1Yb1NXMlJRNklwbHdWcnJLbVNkNk42SklnZEhWbTJ4Yk5ONFkvVmk4SVl2UndZN1I2T245QzNocXRrMnRFdW9UZW5oYUdJUTBKa3ppQjBjb1RKdk9zTWZuSDRXSlE0TzFYbkQvc3VDZGZIaHFJVmZZbUNXOFE4RHdEUzJPWHdTaENFOEt3dGpWbWkxb1RUc2pySDRXNmdUaFFGMGZHMk5WUDhBQVNablNGVFZtbXlJMjlGRWlXOFhJNFJDYUdsb1M0SmNnOUxPdWpjaSs4TTZSNHhGa0xFRWZnaUV4WWFFdGk4Q09QRWpkQ0QwUVdlc095YUhyTHFDRFBzMkhaQ3pyREhvZmsvdGlIT0dTMk1hV3lVb2w1UDAwV0tjRTVkamVUVXNVeWJJS1Q5aWtVYmNrTWFqYW1OSnZMb3RCMlVkYzBkQ1FoSnB3TGdzdDhFUFp6MkppQ0w5RFhCVVBRc2ZwSXRaUTlDVTBJanFJYVFrZElzNE9QSk5raVIrajJzTFpOd1RKM0V4UjBuQ0JiRzM0SXFTTzdJV0dTT3pSSXh0a1gzaGxEQ3Q2VWovQUxURUUwTFp6RjhFdzlZV0xiWWpJR29INVZpVXUwZWdnaUIxN05zaCtrTzU4aitpbmFQOUgwcEVKckNwRGNHNElJaCtEeVNtUHdNWWxpYlBlTzRnZ1hnMElzVXJDeEExZWhVNndvRmVFUndlOGVoa0tEWXhiZFdOc2F4d1VIRGFnakxvYUdNUVJMZ3JWazhlTTM5SFFMM0ZzWXA3aVdKMFBlRm9rb05rT0RoRkU5RGIwUW9pU0tHbXJraWhDMkd3bFdpMnhRUWxLakpLeEdqc0hhd3hqeE5mRkNYQ1Bqb1dveE4vQitpUWtUaFdpZURoZlpzZHcycEhhdGZCd2NLT3huZzlqNWcwZER0YUpGcFB2RzJoWmxLVWZZbHJ3eEJJNlIvSW5jRHhNRHRsa1NPRE9CcE1YdGtOZXhiR29KbENFRTBJTjB4MFdvOEZ6SnZZMEhReGpWQ1JIUi9RMUtFdC9EZUUreGhZMlJoaVZ5VFZEME1WNGhSWWtwektoQk1Jb2NDZyt6Z2svSWl5VU1hU0pKSmpFOEc2UFE5akhSTi9laWNXc0lXeG42RDMyVVFKQ0ZQU01JMjhLRHB3c1pLSkVxdjRJTk1oYjZhME1GZU9IckRpVGZDRzJoUVd3eG9zalNLK09xOFlXeWZoM0dzUENHaGV5Ukg2TTRkeFB3Nklad1pOa1RtUmpzWXhpUlROQ25naytCWXU2eEtmMGRVaFN0NGs1QjNOQ2ljVmljUkE0MlNXWlIyelE5aVM4QytqOEYwaGJORUtTRVNMb2xRbFdJeEUwTmV4L1h4NmV4ZXgyVEdXVGxNUjZJd3RuZldHL2hQdzVlR2JXSDhaeDR3OUYxRkg0NFo4a052VWJvV3hKTURFZUZZMGxZbWlSZVM5RGh5eERZU2xGTldhb1JvYmxVVEl0MnhPVXljUEV5anBVR2hXS3N2UXNQUGNkR2JQRWVjem5nOUNkZkFrYVBSQ3c4STdteEhNb2RFNG5ER3gvd0JqMVdDYlpIRXVFNFBEQ1loSk5EUWtocEd2ckplTUViWWlJYUxrWGttWGhxaVkvUnVoYjBJVTU0Y0xpaFNXM1lpY0liT0RIaHFNSmVjZEk4Q0djTHpId1NqRVo5ZHdReXpXUGZ3WWo2K2ZCb2hKanMvSmsxaE1IdW1rMVpySEIzd29GU3hyaWh5Vmp0SXFKc1IwZ2F4TUNkNGFuVEVyR21TRWxEOGxFU0VtZXlNVm9pY0liK0xFUGFHTFpKMFR4d1dZakNNTENRdC9CNGV4RUNKSnlzY3pBa1JtS3dkS1NKU1ZJa21VWSt5Ukh6M09qbWhvRWpwVXo3R21ob1Ewb2FaYklGWVFzeldoMTlIMWovUXpiSk5xaGFLNDNoNngrRWl0RWZCNndqYnpPRmlTL2g5RWl4T1pPWTVoMmJ5L2lzOStQQnM1WjRDZEJmSlBIaElSK1JMUTR3RlpORjFuL3dCUS9iRnNmc1pwN2tsTkROSWs5NFF6U3dseG10YUVrd0xGY0lGVE40V1hub3ZSSThOakg0TklUUDB1VHVlNGtUd243eXRTYkVMS1dKT1lqREhtQkdzVDhIT0ZoRzlIK3g2UlhSZm1FYklBdXNLdzFab0gwTjI5bjBNajBKUWJqUkl4Q3hGNFkyK0NlaUtZVmZ3Tnc3eE1INXZFQ0U4UGVHTVdHVFpURFFrTVRHU1cyYnh6NUxZMG1RUVF5SkVzMFFPOE5DR2R3L2ozNXNjRXlWOVFOaldxRmF3Z1k1M2dVbkNGYVdIaEprdHNhaHVDbVVKN0hva1FzTGVDU0pRNG1SK1pPU1JLS0VPUkoraUVTUmhmQm5SWWVPb2tUOGtuY3JNME1RNXgwOW5SL0NUcEVrVUllR1Q4K21zOCtPeHFpRkFtVHRvUklzZTdnZUgydzJ0SmRHVjlKcGdRa1QzaFBxeEpRbEd4NVdXY05QSGo1RWlEYlFkOTQyaTFSQ2dTRTdOL0N2OEFFM0RKZmduNE1SQXZtdmkvZzJUVkN2NEptOGNJR1BDeE1ESG85aXNpTDJ4UlRnV0pJbE9wSVVHaEUwTjdnUk01Z1dXUVFLdUZmaFA4RFVjd3pZejh3dlB3WXNQTFdIaHZ3SjRqTFh5VCtDcHY0ZHc4b2pDMExFZkJ2RFpJamVHTmxINVFrTGM0U1VXWG9PQWJ5SjNUR2FwQ25SVlJMa2FWbEVPU1lzbVNlQzBMSzM4WUlFaUNQaDNDSHZFNGVzUFlsQkFrTFp6Q1dOZXlhK0MwUEUramh6RXlYODFoSGZnOE84WGh1UnZCdjREWE9hK0ZCS0lFb0lTb3hJem1oSnBrWVdKSVR3VFRQSW5pQlZtTCtFWmZ4ZWpmQjBUV0dSamVibjRNWkJ2RGpFWVdPQ05PTXdiSmJXeGl3dm5QdzFqdERvYlRHcFJJZk1xTHgrbmdyWEJ3bGV4TEUwZHdUeEZGSFpCbEZObmd5Q1VmV040aWZqR1VQRHdtVDhZSW9qRUdzVFlvR0lqS1JCT09tdDQ0Y3g5NFNzZUdMSytYUGkvNk5td2lqOWlUakNOczBrS0R4YjlDUU5vU2hRUGVFVE9oWGhXSm15YW9rc3QyUTIwTVRJc0ZZOExDSUlzZ2VFTmZDQjFSUG9XR0pVUWEwTk1YZ1RzcjROTEwwTDJhTmxRT010UHlhNlhscWpXdmhlYnd5OEk1alF6K2JDbE0xVVhESVVwR21LQ3dvbkNRaEswemdwZW1IVHVoN0JNU3lSTVdJMExDZndvVzNpU002Y3REWndtamV4WjVoSEJlWG5ReWhuTThKSitHbGlQOFBNUEQwSjdURzBhWTlESkQ2SVpYTllvOXNKMGorUW5RN0Y0d2s4RWpsWWNBczhQd2ZRaExoRGswZCtDdFB3UWk5alg3OGRrTHlTVVJGaWVaL1JNUjNFbDU1OEp4Uk9iRmhmTGYrSkI2bkJuN2NHdVBPZ1pOa3pKb29WSStCa1B5YUpFeVVTaHBONU9pVGVGWGNUWldZcktJelpPZVpXaGxQUXhMTTNRL3MwckVpU2JMTzVoWVpQd1o5SHI0VGxNUlB4MzhHSWFHNU5KaVU2eEh3UlVoYVJlaU8rbERTTzRqeVpKSWh3TjRrZUZJeWFsZEZpRFZDMWhrMlNNV1dONFlzS3lDamhYZ2hsSVc4cmVGV2ZHRmV5TU00TFl4NFNiTm5NOStNWTRUaVNzY3hzZERWckNMaFRDSVJyRUQrMDNnbW96TjRWOEhvVG9rcnF5YlVsbVJJNmhBVEFuT0U1ZWhFNGFFeEN3eHVjdk1FVFZIQmljRXJEM2o2RWQrTlNUQ09Za1loNlBRa1JCcEU1ZnhqSERSYkk1bHJERVBZa2lONkZFNncvUWsvc0xlaEtNTnN1Y0wrQmFKVUNjMmhJOXYwVWRGSis4VFk5RWlSQ0hhY0tXL1FoL0ZqV0dOREhvMHpzL01mUkpjbXNMNkZvMmNKclpKUE1aTk1VemhubUx6aldJK0R2NEpZNEkzZUVKV2M3NTRIaWNHeHY4QVJMMXpQdXhGNUlLT05zWDErRXNsVEE1blJGaktDSGc5VFpwZjRLZUxON050OEVFajZ3NE1VdC9GRTRlSFpBMWVKa2o0UFVwQzBKVVA0WG1NcmdqeGptVWhML0ZzZ2ZvNGZwekRjWTFsK2hqb2VyRXRpVmQvYzdGdVNDZFVSUWtOaTJLbmhOZUNmQzJMNk45aURuME1OenBpZGRGQWpXT2tKdVlHdmVIOEpFeGs1ZGxwNGJFOGV5RG1heWlOK3hRUDBmWm9XSGlTSlpvYndlT2ZKYStQUGtoaitqeUhTU2JuYWxtMENQS0dFZlE2Ry9adEhvNFFTTFo4RzFZMDRaRGpZclJJaWZCN0NoSW1SSnlkR3BFSGxKQjNEa2JOekZrRW9lNUp3UXowME1UaENibkMwYkZsQm9uRWtubzRRZEc2UDBzbjRSUitrMy9qZVc2RlNLSGo2aUp6clZvZE5ZWDBiZnNLemFIWitDZUQvd0JpR2ZHQkduTURhLzZUQzhNYVQySG9sd0pIakpoRGc1WkloTms1ZmdYR0ZRazB6MGFHTm5NUUk5bGlaOUVZdlhNUkE4czNqNkZoWmV4L0RlRjVPRVJvUytVRlluemhyREdJZG9lWWhLMWg0NUkxNmk0bXlhbzJyd2hiT2VUME54c1dtemhMS2ZncDl3TnlPVWxleXNEVFpvYmtpS0pjUk5mN0pucWlTVU1mMk9nOUc4eU1qdUo2VE9HbEk2WGttcCtFay9EWTRpOE54cENIS0pKeTd3anBHSStUR3hXOGNIOFlrYUtZc3Rka2kyV0dFOFJKa3FOaVNMMk8xUTNlSFJGZXphU1JwSXphRkVjS1FsN0lVcElUWkM4UWlDVllKem9ocy84QTFIZzhBbFBwQWJHb2l2YkVsRGVhL3NhU1NSaTBVRTZKTjVUdkgxalR4SlA2VXliSmtsb1dmZmdqdXVqOGlmQkpPRTFpY3lTSmlHMWhWalJLSldKb1dHelVaUnNRcHR0Q0h5RXJkc1I0S0V2WEJMNmV3VTJ4cjVKSkVrbExVVFIwRDhoa2p3S0VpR3RXTkdKMnVIbFpBMmpiVHM3MFJlb2dTK1J6SGlhUGNld2cweUhXTHlEOHcxUWdYbElpSGs5aDdEM0ZHeUE5d3ZJTHpIdlBjVmJMOW51UGNlNDkyQkowcUM4aDdzYUhrOWd2SWV3OXg3ajNIdXhHN292TWU0OWcvSUpaMlhiSDVqM0h1UFllNDloN3ozRDh3anlLallqM1dSSm1NbVFzRjdqMkhzUGNQekh1RzE3THB5QTl3Z0xLV1p3M3ZQWU9NTHppbncxK1dEenRtQitROWg3QmZBYmFzZTg5bUY3RDNmRmJaZWZHOXg3RDNZemcvd0E0SklMYlliQmY0TnNOdG41TUQyWndjZzloQzJQbEx6Ly8yZ0FNQXdFQUFnQURBQUFBRU5oTnlrT0w5L0h3NDE4MEQ4NCttdEZiaW01MzQ3dHZxYjJZWDJXclc0ZjdtbTg2WWJiWkhMb3VHREdQdC96VGJYK3g5TjRqbDRvVHNvbnRoQTdyRXBnVThYR1lBVkk4MkVvc1VFc25JK0lhZWJWZGFNV2FXZVNjNThhZEdiZkxoMlEvVHJvdzRRTUVqRTh1ckFVRUF5Zmk4djAwZHFsVVBBVzAycENGdjdUYVN3Mnp3Nkh4dGROckFBY1dZYUdUdWptQjc2WVJCUmI4QkVBMU1EVFlRdFlxaGhzc2VxS0s2U3pENGtBMG5CN25LSHp4Tjg2M3ZqUHM5Mmp2TmJucHowaitrdDlUelhieVp0T3RNN3ZvenFWYVgyOGxFa0ZNeFV5ZWI5K2dpdjBNbm1EQUlEa1pNVGFtTkU0a0VHQmZIak1sMDh4NEwyNzBpTE40UjcycjZWZms1QlNudmRhNEYzSC9BUE1CZkNVZTFZbjRmODlJajNxSUpJMFQ5cExHMkhlUFBCeU1uclhnOEZzczVDQi9oQTloZTJwSlYrWmdJV1A5SCtWT2VCY3pOOXFTR3VmVGhoYWhCU0hzcnB5eVI1RHdCY0RxNXpaOUpMSTVnZ3hZS0RraFc0elgza0huRjRYR3ZvYkxQeHdoQ0YzQlNrR1ZLeHR5V1BiNDVBNVdLR1YxTGtpMWhiYVVQUk9KMGxzSXRPa0VWd2dRK1F3bHduWC9BT3V4aUxFeTZyaFFTQ0pHY3BlaWVaRmc3UUZBcUt4N0xGSnBzdmlPU3BSaDFkamN5RjQrdU9Bbis5SmRGM2JyMzM3Wm16VHgxUkg5ZXpEVnB0aDlXMjZCRFFPUmxIaUJ3aXd5Z3BPZUhOZFR1Z3lYamJTM1J2ckIvUThGWWszei9MakQ5UkxTRm1vYkVSVVZHK1FXNnc3TGRxK2w2MXFiRjJWZk9iYk5SWlZoUHJqSG43eG1LaXloOXZZOEVoUCtFQ1NyMEh0eDZkaUdQWCtCQVhNdkx6TjVzb0NMU2ErUzl4cWJsaEwzSm9NVjcvbUNIUSs1SkIxNnUwUkpRUlJNQTRGM2RrVW1pSUthYTIvOUZMOUlVejllTW1lK3VEeUVVeGlwQXh0eFJabHZsb3R0RnAxSTdIN3Z2VEN6RGo1OTVwMW5XL0hHSy9QUXZFdWlWQ2lHdHhsbnl1UmNUclJSRHQvYTdXMmpxZkgvQUJVWlFTend1NDNUdnRDY3cyNHNqTmNhK2JvMXdVNncvd0NzOGUrZGR2d0s5c2tOdTl1Z1pZSG9Qc0kvL3dDMFRTNmh3Y2doMFRPM0hQWFByUFBmaFRMdlAwK0ZnUjU3L1ZjdjI1MERKNEsrT3NrRUQzckUxMU5OTGluanFESytPU3lxdHZQUGlFRlhRb1p2UDZOY3NmVTd1K2tNSWNueEp0eUpkRDc0c2s2eUhmQ0hEdkgzOVYzVC9FTlJQb1JSOUN1VE9aay9rNG94K3RGcS9lejdEQW9nanJzSGJaRlRqNVlSRkhieW9FazhBcEx5ZThHbmd6WVJVYnh5cmdFbzdwbm84bUc4cG5LVnh5b2VXT2FxdXR4WlZ2S3lhdG85aDlSQTloaGYraStDaUNEZStEZmpqamVmZmVpZmllakQvakRqZkQvL0FINHczdy9uWUhnUC84UUFIeEVBQXdBREFRRUJBUUVCQUFBQUFBQUFBQUVSRUNBd01VQlFJVUZSLzlvQUNBRURBUUUvRUN4OTN6ZUowUWp4ai9nZkdFeWxyQ0VJUWhDRUlRaENFd2hDRUlRaEJJL2xQSGxiVFo4N2xhVXBTbEtVcGNYS3liK0lmeDNXNjNTbEx1aHluaEQ1VEsydnpvOFBOajdVZk40dlJDUEdQOGpIc3Q0VFNFNXduRkNQR0g4dzBUU0M2M0x4ZmdRai9lUEFtTmx6ZEg4VDF1RUxaY1ZTNnY3bGhhekhwY1hEZ3VyMW5SQ3ovd0FqSHhlaSt0QzBXUGpTNzM2Rm90bDBldDBYU2w3clFmNUN3dDE0ZXZwTnI4Nnd0RjRtR1BDSHd2eFBxVFI1cFJsKzljZC9pcmhzYjVMNkZoQzMyUHYvQURsT2FFSTk3WG1kWmw3VG9oQ3o5NVkveFVJV1hzZVhpRCttOFVJUjZ4N0hoai9HUWoxaURLaWpZMlVwU2xLaTRxTG1vcUtVL21ibWxLVXBTbHhTbEtVb21RV2VGK1k4Zi8vRUFCOFJBQU1CQUFJREFRRUJBQUFBQUFBQUFBQUJFUkFnTVRCQVVDRkJVZi9hQUFnQkFnRUJQeEFvWEorb2k1L1M4bUxIajMvb1hGY3FVdTBwU2xLVXBTbEtVcFM4UXBSTXBTaloreW45aTQzMVZ5aENFNXM2WW5ZdkJjbm9yaE5heVpPREVJZG1MaXZCT0UyWk9jMkVJVFZreG44YlF1VDlSYi9lYkZqeDhOQzVQTzhmS1krVUlRaE9MMml4NHo5NTFlTFhpWS9CQ1kvSTE0THJ4MVhDa0piT0NIa0pxeGtFc1hsWjFpeGpPaCt1RlpDVHlMakNjWjRweGZCUWhjb1R6VDBXTWV1ckVMYnIxWlBkWXpyaS9na0x3UWs5NTQ5OVJJZ3ZJL2JZOWYySmNWOE40enJ4dlY4Smp4blRhNElYR2ZBWk0ybVhVTFo0MzZqSGpHL1huVVhCQ3gvQVl4alA3enFMZ2lGK0N4akdkYzY4RUlmd21NWTl1dkJDRVg0TEdNWjB6cHFGa1F2Z01ZeGpFL0huWGd0V05pNUwyR01ZK2RMaE5wZkRmVFl4ajBvaWloTUlRakl5TWpJeU1qSXlNaklSa1pHUmtaQ01qSVJrWkNFSVFoQ01qSVJrWlJRMkc1RDZCLy9FQUNjUUFRQURBUUFDQWdJQ0FnTUJBUUFBQUFFQUVTRXhRVkZoY1lHUkVLR3h3ZEhoOFBFZy85b0FDQUVCQUFFL0VPb2grQkJndzVLMjRYd1VGdVRtYStJSnd5N1E3eHJ4RnF4NWdIdE9HYTlpR1VYbmlhUFJ2ektUdlBVclBaeHJJTzhHNk5QV0tPRkYxYkdnQ3M0eVZWVUM5Qjc4d1dqRHEzeEMzUUN1WXNRd292djNGWW9CZUpWU3B0UURzS1cxNEhiZ0ZyQkkrZnhDTHNiMkZOblJ1NFNlYSt2ajFLV0ZnYXhGMHBPUUFhUlMzTkVOSGtwcEJvVHgwdC9VWEtCdDJtS21yTFVkM1VEUW5Uc0tLcWpmYm1uYmZUc3BTZ3EvMUNVMjM1SllLcTN4RzRBTnJyRW85Zk1MWmdXRERnTjgvTVFDa211RjVueEZSanQrWXUzZXlxUm42aFFXNy8xRkZQcWJVb2dUcEFNejJJQzQ4Z3ZJTm0welR5TTQ4ZytXSTFqenlUUkFQdVdjYWRsVzBMVHpDKzJ2dnpGRE5jL2MwYlVvUk9kanV3M3hVc0pRM3J6S0x1c0lxWFZWNGx0SjBxV0c4bWhubnNzYU1YWUw4VENtZnVWS2JWZW9pazIrd1JQeHlPaWdwaXFPWEZYdUsyNE1SeUg0UVlWSzNHZVlnMVBtZ25WVGhTbzdBRnZ0QjF3dkN1dzZMdTNrT2hpY2xyRkYrSmVsZGRZa1d3Qzl6M09BSFo2dVlhVUhxQUZQeGNzcmgrWUFLM0JkYmI4bFgrNEVMMCs0b2lyVjBIL3Z1ZG9zOXdiTmFkUEVwRnkrK0xmRXRkc00zMUE1VVZ0OEo0QlVRUVJwSFZBR3ErMzM5d0tlMnVTOHFWZlh0VGh4bzZmMUhSRFJsTnFwOXh1cGE4cFJTOFpVRkczcDlUcUVEOVhBanFVOFZHZFQrVUJmaExEV0I2elJoTmxMRmx1RkJmVCtvM2VSR3JhMlZZbEMvd0JSQSs1VldMN3V5aHhmeE1wS2dHQ1RrSDJmMUxkcjBvbURSY0JIVTl3QVM2NXdKaWpLbk82UzlsVFVINFFCZUJMR3NPemlvYStZS29lZkJGVUxOOHNOVXVCV1JBUWpUYWxtOWZsRzZPTlFVRGk0ZVZvVkg1VmhYSlZpdkhmbWRJaW54S2ZLRkRRYTlUazZiaUJnL2lWYVZ0eDgxeVdCQndoWEY0ZDhRVUZ0K2Q1RjRlMzZnRll0dklWbEJtV0FZU3dGNXUxRkZGclRaYjBtUVlPZVlackI2ZnVWT2htOFgvRjdBL01PdXpBZko1bWxBYTdPTmVXa3dUaDFoNXhWOHl3SkFMNVgxTUR3L3BBcTN4Nmx0VjZsQ3N5VW9VR3BpbWg3RmhLdytvZ0FGYmtQa3Y4QXpBRUxxdlB1ZU1OamV5Y1BjQTBOMXp4UEllZHprdTBSUjIvRUxEajRxSlhpMzVsbWduZldPU2hWVlEyQktlVG56TFFlc2JXQURoQlRRejBCYm5tTmwzZm1jbXZxSGlzOTNBaSs0S21yZ3c5dmJnbTBPOElBb29hOFJLU0RLbFVuNllOaDZRRGpYcEJYZ1B4S1dIWWxYRklha0ZXRzNQa3YzTW9ieDdGZFZqNlQzUS9LV0JYd3FVbG1FTGR1bDhzeFBsL2NFMjl1QTBUSG1HY0Y4UHVYZ2NmaUh3Z0lybitwaFJLRjY5NUxGbFl6Tkt3TzNLSGd5NHRQRXVIQ2hIVy9YWlVhTVBHeDZjRW9zcTQwTHpDTFA2VFFMZ0FMdmZjMGJMNlZMSFdvZzBWZDlqYjZNYk9ubitvTnBVMVRTcFFLYXU5Z3A0cDlta01DRjgzL0FBdE5hOEgvQURFaEdydDZwa3NISUpCKzBvOElkQ0tWVXNQRXJrWU5RVlJVeWRnODVPTFVDVUFkK1ljblI1NWx4V20vY2RQcERTMTh4clEzVDF5ZUN2QkI1YmR6d0FjalIxUFI5UVZMTzcySXQwWjd1ZEZZNUg0Y3k1YU81ZllacFk4d29Hc2NLaVNuZmlLWmdML1U3UmZiR3B5L2ozQlhTVW0vRUZYb3grSmRxYk1pcEFyZk1SNHZZT3FkMldmS0tXVi9jRkhrZjRsQkR4MlVWK2ZETUh0Z2tCZHZ4QVZOMVh4TitMK3BZVmxQQ290SDM3aWozSU40RDh5eTZwL0VVNUxYNDlxUnF1M25xNXlhd2g5YVFhVzJsWmNGRitEOVI3cDU1Y2ZWWnhIWTljZWlwWU90WStXV20wNTh5dllpNFhVUVg1WHpMV0EvY1dOS2pGU0NEMlQ1SkgzZHlLckxWN25kZUJlK1prVzBFQ240ZUluRFMvaU5qSG5pQ05xdnFlMTMvVU5ZYTVoRGRwV3lpdWo4eXlBTmtTOFBmOVM3L3dBUzhxQVpFUWpWYkJRMkNhK29TL3B2NHlRQzFmQ1d1cW5JQkhmSjdpTFRudU1JTmwvUGlaVUhDR1cxNDZjbDF5bE9SUUlqV2VvSmVmWVJJQTA5cDRSTEM4NHZtRnJ0N3l1VGdCV0ZzZHF5NVJDMlBpcHZ5K0xJZUZiN20xbmg3RnF5UWJ2WHd0OFJDUFIyV2xMRDFrNnBiZlVEeG8rZkVBVytvcUxXUHpBRU41WUV5NDc2N0FqVWoyNHdwUzgrSmVqaDlST0tvVis0NnZVUGNzeGgyNEk4YUR6QW9FSy91Qk0wZUpqZmp6bkk1S2FoU3V2cWlJUXJ0MWNXeENuMS93QnhWalE1eXBkQTFMQWc0Q1p3Z1dWYS9GYktNRjN0eWdlZll3YWQzNzh5am1iRzF1LzVua2dYNXJzc0RiS1h3d3VDYXY4QXFVcFRrb0grNEVYWGVRY28xRThxNzVBTFFxODVOVy9tcFFGTlZIWWJHK0oxMXVCYUdQSlZBc1g1STlGLzRuRStDVVZzZjl4RjVkUzF4YjBTVVcrZlpCVUxjL0RLblZlTGxQYk9FcnBPeXhSM25KK0VyM0NKQUpuN2plbEdhUzNkL011MHArNGhXTEdGOW1Db0RqaUwvUDhBVUpUNEtXay84MUFUZXh0a0x0TDVUUUQvQUxnSU1MVjhncHBxbHVvV2ZGbkQ1aHJYdllJSmZKNFJYOXlsRjRUUGlMUVUrMll4TGFCZmp6TGxmVVR5UHFQYUR2dnhBTEl1V0JlWk9BamZ4TEtOVi9pQ0NyMWpURTdQSEZKNThTNFp6ckUzUUI5OWpnM2d4RkxRcm5xSXhkdFpFYkRRYkNrRzk4TEFYUUNtK29EVTE1b2liaWZsQ3EzWDB3YmJ1NytlU3dOQTl5bEtyOWtIVHZ5UTh2OEFLTE44bjNMbHovcUlhZFBMSzBINGE1SFZpMGM3QkFyaStPWEJwOE8xQTRVTCtJUFp2MFM3cGltdVQydHVQNG5ZUnZDcFMrdGxQaUFRY1Y2bnNmWUdRUWF3ZGcwSjlLdVVVUnUvRXR0UElyZitwN05MZnFaV3Qxd2xYUVI5dmp5NXBodGVvZHBQM0N1SENWVDVkSVViUnM5YktIYnNyaEVzS2FENWlIS3U0Q3FidnhVdFhsWHVJVUg0Z3BubXZkeWhLUm5rSWFEbnFJdHA1R3kzaFA3bFc4TjZ5c0RaN3lBU2w3OFJvYWQ4MVBGMy93QlFxMm5zVE01NWlWYkJ5UFJjSXRQSCs0WExLSHIrSlNCZmtwQThCOTErQ05UYlBjeW9zdDJ1eE1EcDFKYUszYW5EWkNtdzJPUU5YSzl5anB2cnhCUUF3ZVltNmZVVHZ6QXRhSHhFdWp0cTFIUVVHajEySWFMejFBbThQbUtqZkNQWWREekVVME45a1RVNTh5cjEvU0lSU3RscFlvVVdzSXJ0QkFBRFZlcDZWanNOK1FjcjRuUzZRWXNnT2xqdHNIYTZQRmNJQThENmg0Y2NtMmhqMTJJQkp3RlhlRmVJUEF0UlF1aFY4U09tdjY4eEJiN3A4UVp3S01adDl0aTEzSGxYUEMxMTFZaFE0UHFXRDQ5cktUdHoxRnZyVUtMZmZReEg3OVE4RTZkcUQ1WHl4RUx5dkYrWlpOcUNuNGxLTFcvcU5oTHFXQnNjN0E0clBtTjMzTDhRVXFncklDdmlVcmI5M0s2Ulo4eExPdDJjTG9ZMDVjRExHdmM4dXZVTEs1OTNMdTB2a0tnYXA3RlhRcjhURkZ5VmluTHFObms5eWdCNWZ0Z0NlQzlHTTNLOHp4VWExTVNOQ3ExWElpais0THFwbE1BbmtMNzVNQWZ0Z2V1VnJEaWNseWxXOFhWNlFsVkhoTDNQdWlZK3RSL3FWUlkyYlRDTFlwcDdVcXNIejVsWFJ1YUpablFnY3BSZ0t1ZlVBTVVIdWRNK2RnSXhwdjRsa2JpK3NpSUFOZUk2NzdveVdVYTAvcVhnMXB6c0JhZ2ZjUXNCNjh3eGJEMUtBRGIvQUVRZFVNL3RBQ2diOUUzdy9SR2ptY3F1eFhUelpDbU9QZVRVVXRaVjVONFJkRGVXWEc0bS9ETnJOdGErNHRDUnhnbzd2eEw5NjMyWENOK3B1S3BaWUlIMlRiaTJvdE4xaDJJN3JiOHhMQU9kOTNGMGc0YXh6VVM4d2dKcnZ6NWd2QSs4NUV4bEE5MUhYb3ZvdWFkYkNGVkcxYStxSXEwQzlJbmxpN3QzNGphRlh5NTBPdkkvWXZxRU8zdlc0R25pUFVGcVBqVEk0eGxMTHo2OHp6QUp5SmYxRURPMXMrU2oyVFZnZW9IRzYrSWY5S21yMVR4VVM3ajNDK2VodVhLb3M5UFVDdEtIekZEUHg2aThVNllWTFEyMFJzUGZPK0lnVldSdzBvMDBRTFJlL1VWRGJ3cE94YXQvVUFIa3J5V1V1d3JRSTJXK2YxT2xsZk53Mi9COHl0NFlXQnBkSTlmSnl6L1V0ajh4WHpHRENoRjdTUUhYZVZBRkxSdmVzdGFVcXdyc0FzYlhZb2x0dGRJRVhYNHVXcW8rbDZ3QXR5bVhuY05MbWtwMWpSWjErNVlKaStYRnBUNWcwOHZOOFJvS05IWDNQT25wRUxvRHllNTVqZy91SzdGczZGTHczc2JYVVA4QWFWQVU3aVFBUkd2Y2VOZGZtYlhLcHlOaFFMNmZNZXdLNllhaDU0cUlDdWpIWlFGVmtBZ0FudU5XbkVYVEJ3RGJjUUtoZCtLRHNRUVcwODl2eEIydXE3RmpjREs5eTlCWUc4eUFRQVdYY3FMVmpDM1FBUFVyTXIxbUhvKzJlYkRzQUJSS3V2a2lXR0ZzY1lnTUhoUUV0UnMxMkFvdytwUnBNOHJnVkZGdDB3S0dpVlpodnRpQmRmREtWeXlzZ0EyT2VvRk0rQzRVRmVFU3NGRVJaMWFqZW5YODhsUlFYTUx5SU5YNjdCSlo1dG5tVzlXaEVMb2FldXhlMjJzaURwdzdCaGRqNUp0VUxLOXd0Z2ZMWWxBQVZSVWFXQ3czUEVGV0c1MkVmNUxsclNMNEhNL00wQW41aVZGY3kyQ0E2SDl6QkVDRDd2OEE2akFyK1Y3L0FBRFViOVFXb29XOXcvOEFzVERtZkVOUjBZRVNqdmlHMVZyM1o2VnpiYWdKWWdMcnlob2piRjZPZGcwdXpJQnhvK0VDR3JXOWRDZEdGbXl6ZG5RN0xHZzBjdWZSbktsTnYwTElwQ1B4RmVhV1llR0xVQ01OaTVTcUFlMktvQzdQTTB3SUJWNjE0Y2c0TkFTcVV2UDdpRWEremV4dWtKWFNWQkNyOXg2VjhsTlgwZk1RNFh4NGxPTGZ1QXNZZk1FUjYxTE1XMU9qb2ZFQ0tVUHFFc3I5eWcydmdJSjU4ZW85SjdnU3gycTlCSDRScXl6cnlwVGpsZk1iR3Q3d2xQaytXZjNYSmczUGlCUEpYcUpLZFBwbHV1L0pOTkducWNZZWNuQlYzTmp4ZUh4RklCWDJoWUIvVXVxRzNzQlpjdnhEeGNxWExhOGdzZmJCZTF5SG5haTAxVjk0ZGxFMmo2bGpqUFZSSTFvY2pYdHI4VFVyMUhCOE02Sys3dVVIUEg2Z0J0eDVVeWlYM3NiclZoZTFHdktWWkdxTm1rUXZmM0wzaEhLVWlIM0VxTTF5WGdXaWJYeC91VWdSUjVteCtLZk1FeFFRc2pBdXFzMnJqekJwYXIxQVZ2RnlvdEprQlRWNUJ0dFZLSHlFY3ErL0VzVGxuekxLOXpKUTEraVVac1hYRG42aFpmbzl6QzZ2di9uNGg1RHRWQTZOOWx0QkVkQkQxckErSlVXczhuZm1Wd1E4cUdYMzkxS253RFRVS0I1WEQ0LzVqQVFkeVhMUkxiZTNHQUQwM3o3Z3lhdkNBSGtjL1V3Q2grNEFwZmRURVdGZHFOQm9CZ0xHbC9FS2xiWEJoamNmTXRnenRSV3dOdC9xSjA4ZTRORytmaU1Cb2cyVzhmQ1FvNzVmSk1BTHZ4TmlxVjRZQ2xxeEI0YkFnV3QxNmpac2ZTQzI3M2wxTEExUWZVc3hhdm16UUFDMTRsa0N0OHBhbFZkL3FKU1lIcUJkSytvQkNwbktpVW9LWDJjajBMdnNnSzFwdHlzT2FLUG1JbTFUbVFlVDd1WFk5T3c4c2lYbHVlNWpBTEtsTktQaUxkMVkzQzBUVTh5MTI5bnJkeENpNVRSckx2dlpxOFZCNEZoQjd1dTlsV0RWVkEwOHY5U3BzQjlUVDNMckh4Nmx0OHVHc1hMOVJwRDE4UkdLOHQrSXd6WXJIdy9nbUI4RzRBbzNKOU41TENnTnZ2aUZxbFhNd1hXQWpUT1QyZlg2bGpMblhjOFI1M3g2Z2wxbzc5VEJEV0RhcHI5dzBDbVVFOFJEbWk3dDdMbHE5VUhKaXA4RGxSVlFkcXJaMFdnd0ttMEpYaEkxME4rRlpGRmRHTndxVm95bUtXbHM5YkFGcUR4QUJqcGwrSmdBSGdSQmc4UUE4bmtGR1dMQWVIV0JacWc5UVdCdXU5bDNqamVGUUdnenk1RGpoR3lYaVkxTFFXQjhlcHFYZnZZT2h2ZkRIWGcrNTdnbnNnMkdBNFN1RnV2TEY0cmVzc0FSWGc5UnNBN3N4KzJPeHR0czJmNml0WWZjTEN6VHRWQlg0ZUNmQlZac1lVdmVWRVUrQ1oxWGZFQlFHajFGckdPaGpVNWZOZkVGZ011QktFcjFFRHBxQ1RIUWcwR1ZjQUR6dllMS0RrQncwMXoyUnA3VkZVSlQ2bUdWMDdOT0RuSlFzL2dqaFZVOUppdm52eE9IMy9VclExYXltMHR2MUtsVzB1UjViWHhCeGVMalJ0WGt3WFI5UkdpRDVTM093MW1NRHpGNE15OER4YzJDN0dFSWVWMi9NcVdXajVsQVAySU9rdHJzUHNSWTFTZlVGYUsrZmlNS2VlWTRMVjh2RVdJWTl4b0tJc0lxTjc4UldBS2VtVVhNUDZscFZDbWZLQTBrRlVSUUNxM0QzVThDWHZYZ2lJbmowWEhRbzlmY1ZLVTlucVgyRksyVTF1TjlsT3l3OGovVVNncEVxbzkyNENJV3RFcWcwUGt1VUJ3UFhJZ2hvK1kzRHlRV0hvOWtwUXQ5a1FZdFBtYzcwakFxazhlNEdWdVpVRDNVMi9VUlh2ZkVTRnUrSWhmbjVpbGdVK29VYjhLbUNGNTR5Qm9VSDFHbDVaTExLL0VzQldIek9GVzJKWWpsOFpZV0gyeERhd2ZFZUdBTFR2cVZXQXBqUlNpSmtEd3dPU25rS0htNVFTdWNnOUZmdWFYUm00ais1c3RkamE4UEFrd2c2UU5EMzU5UnpIdGVJOUh5ZUpWcFRudUJwQUhtNHV0cnoxT1ZuUE04cng1WkM2UHhjVHdPZTVTaXIyQUFSbHowZVhibWg5MUtwV3NnV3lwUy9tS08vdVVyOCtaVkd5a0RxRXVpcXJQNDhVUHhjdHB2SjQ1a0VQS2dkaTJyNGJFMHl2S2gwRFhsOFI3V2lYRWl5aDhTenJCcGNBQWQ3VXRnVStleENpL0dxbGpaS2NDc2dlbXUxQm9DK1l3V0JpcUdFcUZsNlNvc3F0eU1TNWJGN0JOUlE1RkxsYk0vK3dLc2RHemtSTUZWNVpZQUFRb0ltd2FQeHlkeDFtdXdvQUJFTUJaMXVVbDJ5dThpWEFzTWJpV1U5VlVVTlBFeGREMjRaZVBoaWZYUDB5Z0FyU1dWcDc3bDhLRDhlWS9RK0tnYXZrdldPZTRncGo3bDFGbnFKZXRIcXBWTmM4TVcxSzlFU3FSKzhnZDhrMDBXbnNzTFUrdk1QbDdsd1czc3NLOGo3UG9xTjFBenNMTnZqK3BUcmZWeDMwKy9VQXF5WEFBUFdWVUhYd2dhUEdSb3Foc3BiWkNBQnVCbGVXTmlIekRLWmZ1NVNoTzlpVjIxOVR1NzMzNGxnMnBUM3lWbEMvaVcvd0JqczhyY05tZGZHNnhmbEkxTVNJV3RYMldML3FWankvekRMQmZ6TzMzZHVvbHUzRzJyT1M4ODNFaXhZVEFmeVNub0ZIdTVzSXBaUHVyZ2lVbmpoeVVpd3Vyci9Nc2JvcnNSdXFTNGVKaXBRL0NBZGhSOHhGQ2kwTitwMFVYejZRVXpMZVBtTUt4OGNnYThiL3VYRUd2bU9Zd1NxakVkWWJ2bU4wVWZwMlhGcXdjWEdJcEIzcENnUW9lYmpvS3Q4Y2xONjN3cDJORVZVS3E3djVqWVduYkw4UVRvMWVtTU5JTjliMktQWnZ6QWRYT01aeWgra3NGQ0s3NmxLRm9nUG85M0FVTkZKNG5nUWNCNDh5aDkvRUd6dlhJUW8rZk1iV3A0NzZob2RPa2NyVmZic1JzZDh1eXpBMTZQRWFncW9ORkxyNmlxbmwyV3dNcVhLZ1AxRWFPbll0R2tkcFZrUURINWk4OWY1bHBzMmwyK096ZStaZWovQUZLMDM2cUd4cytiamJYRDVpdE1hbkxDMGJibVZ5QXJYTDFnaVBpTFRVdDh3VnRmTy9NS0RYUGJ0ekRyZGtWSFdxNWMxU2ZuSUxYdTRERkxxdVJ0TTYwMU9RTC9BREd4enJrc05QSCs1WTZGTlhIRFhicllJMm5ld0xLZGlWL0pyVVdIVEpZaHY5eHQ1bjNFZHV2eDRnY0ZHUEZGZWRqRGthdnRnQnBhOWMvZ1VkZmdNRFNteTYwVVJrcWpSbjZoS3piZG5qT0VvRjBqeW80S3FqYWNxSlBYeEFMQ05mVXFKQUk5MkdpZy9xRUJWMTI1UVZSNnlBcVdmQ0VybzlmVXNIQ2VQTEc2a28xNDdjSDZkUG1WVVNyc1UyVUZvb21ZN2FSZXNscFFHdDJQMUZMNUZQckx3SWtHMk9xMCtYYWlxcjVLdm54RUF2UTNoRmxUU0tZUGliQ1J1VitwZ0xhbGwrSUttd3l2ek9zYmZxS3gzUFhKY3J0UUtjc2lsRFo5UVVsbElpbEZ2K3A0c2J4UWdUV2UxalVpMGxDTWZaRVVMTDljbHphTmNxTDhKTFdlSGlhclBPUUJzcGZxRnh2MGlSUkZlSDFPQUY4bCtKVERZZHlOcHFuaUt4dTZneGFzN01RdFhpYktLeGFXWTgrSWpBaU1zYmIvQUlsUFI5UWdGVWVtRHFpTWFpMTJybXFnQXRYN2xBSXN3R0twd0hFaFRQMmpRQy9VdFQvMVFBQkFmTEswRCsvaU1kOFByc0tuaStXelhlZTE0aVVxN0RkZzFZdHZQbVV0dmRoVnZucjRoeHQ4RTl3U3ErY2xEZG5zcFdsVDdsQzYwT3dzWGVNd2J1L3VBTjkvMUZUcTRlSmJZUGlHTVBuTThBbE1kMnhwNW5aMXFkeEJzUENNQnVQTDRnS2tyeGN1TGdhUkhUbXBVNnNzN0tRQStiNURXNG5uUTB4T09UQ2VIK0dOVzNjMGhrMjM1dnRTeDhFYlNCRWFMNmlEU3crUFVKb0JQSG1PVzhBcDlRU3JNb3IxR3RhSUwvNURoVWJTSHBLaGswcThnRFVtMzNNMm1MaXRRV1FMZmRITDBEdWYvSWxuQnhIaE1sS3ZuM0hwYUJ4T3dPeHNmcUJMMjZPL0VERzBRVXgrNWVMZFlOcFJSQXEwODlSOEtoSUMyTUs0UzY3S0MzeDQ3TGpBSHIzRURhcVVHR3hEMEZhY2xhQVAxRDI3OU10b0w3bGpmSjBHVFZBeFBFVGg5cmN3TjIrTUlXU3QyMi9QcUtYcmx4Z1ZoQkUxM3RrVU50Wkw1YUV3TDJtRENzLzNIQVp1UzN6Yk9hRWlPcmdoYnM2VEFoU2ZFVlFaNHlObEorUGNMRVk4MzZocDczd3k1SFQvQUZEb0xpaUdzNWNBVU1QbVZYUmErWVVIYjlSQVpYUEJEMHVudTdLaWx5bEplTCtpVmpoWHFVWk9lQ0x5OG56UnBaWXZ4REpSbDMvTWVnYzhmeHM0dmdJcTk3citiZ0ZYVmJBaXgxZkgxRER3L1hZU2lDZlVhcUFjWkZXQjQvY04xeEJZTlV3MHA0Nzl3Q1dLMlh5YlZqd3dFb3Z5WEJvVUF0V2ZNUjBzK2E4eE9LK0tpcmJWZFl5NU5FbzJYTHJhMUd5N2RsUzhOYzFsbmc4d0k0ZDJrQzJtZUhZbFl2N1I3cjZQaVpyUXl1aXZKeUI0YzI1VEZsbVN5NVNmM0cxTFZ6dktMNG1oYlQ1SUJmTC9BQkRhdGFQVWNDUE96d3RGK0liVlh5OXdiV1dvd0luNmRocFdmbUZIRUxqcFA4eTdGdTk4U3kzVnRpTkEwcTVZUGxDdDNWSE1saUhON0VncjhwWnZzbktUWUdSRGg1L2NWdU5nV3ZmaVVXVGJ4OXhxeC9ETFJXakxsd0FDdStTS1BEdmlVcm9xUnhlVUd6U3FZbXRnVHZuQ1dDM2s4QW14dTYyVk9jNUd4cGNHcTZFMERYWTVaTlAxTEZGdE9TbUZ6NGcyK2tuUjVYK29sdGFhWUEyd3h2N09FYkxlU3pDL2NkZmtpQWZjWkJiVmtJNnRXK21wZXEwYThuWitZcXY2aGNJdFVEcjl4TFFOeHdDSG0yQnhhZVR6RGFlSGFncGhtWGZpSTN6NWxIWlZjZ282WGZxWXRsZjM5enpqZEtUL0FITFVpcDZTT3dBMDFZajVQNFRSeXEyejNCQjNMNHhPaTdPejVMeUhncUYxaENQbCtvbGIxOHpkYUhjamtBNFEwWWhDTkcvUHpCQWNCWVF0citMZ3FlMk5Rc0t0UGNFMk5XOWlXeitwbm5UNmhiMy9BQkZWYjEvVEU5dWU1UXhpWDV0ZnJrSHB4OXdZY0h5UWdmNk9SMGVGaEhPdk1SS0xWUzRCNHJZVXFwcUZsQ3ZjVjZGSlFpR3JpVFJkRXZEWlkyaDdqV1FZOHhOY0xLMWltaXZtRy83bmdmRVZYL1VDb1dCY3FxWGU4alVjeC9NQzZGdnhDaW9YVGdmTWMrZnNqcFZxSDlSU2o1N2NDdE5ndUNCbnFiZHgxcjlNcERHNVliSExnc3BleGRSMnVWT1phanpGK1F4aUtGNkR5eW1oOHM2dUJwOG4rSlpmcHlXbEhZM1dOZVpoaDl6MWNVTGVDVXRSZHhseDZQR1FnS2g1S2x6SnU5ZkUwWjRjUEdzekRVZEIxN1BFV3N1dm1QU01sRHpyRjhQN2xuQXdnYU41TEFWdm1JNDNPRUo1RDZqSWNmbnhFR3ZEbWRaVmw1blNacFRaUnFvalF5b1MydkQyVkhGV2RoSzdRbytabkJLZGdTQ1hkNjhtVU5YTk9zclRST05ISURvM2RjNUd5Z0QrMHNTdDIwOFJ4VFhsK29CVitmRTJqbVFvTk4rYWhVNkIyL01SaW40blFmbHVCWFNGbUZIbGdZaTdYaUxRMG9lNEtLMHJLR3ZPMTRsU3VoWXJkVlVGWi9jUUtkSHpEOUVDL05rZWtWNjFLOU9mTXhDOU9RVmN4NGxndk1sRW81RGJZOTZRMHJsTXZHMmk4bS9rZXhsdU9rdUNOMzg5ZzBoL1VLci9BSWkzZkVaQjhUMnExRmk4bDBzeFA3Z2hwOGVZV3VvRktLVkVEUVNWK0hpTkEwNUZiQ2tLOHhDeDQrWjVHN0hBbCtvTlhRcVhQajZua2ZNY3ZFUkhEOHhwTnY4QTVtQ05NKzM2bmdqb2pmOEE0c21GeTEydjR1clZaTnpvS1YrWUpjK1lFUTBWS0cxUDNIcWVFWWFSYytmRXNSTFpHb3hYSitCVHZxWG1lSlNjRlBuMUZLMVg0akxxcUR6QUdWMUxhalN6dGVZMlZ5bHA3bGc4RlNyQ3BNZ0ZJNlJSUjBONUxXWGpYR0FXdzNVc283NlI4empXeGxTcEUyMTVpbEduMlIrZ0RPRml6L0VLRGNwZlQvRUdmQjdoZEQ1OFNnRGg3U3lxM2ZxRnJjb21NTndRYUlGTjhaY1JkdzFvNTZsbzZ4TE4vQ2NVT3pDMUh6TGZINWxVbEhqek9sZWt2WXVvWU9zdlpVS1RucVd0d3VPQWlNUTRoOHg5a3VwVzJXUUtyZm5JVnF2bzh5clF5L01MWFZQek9sWFRPRlFyUjRSejQ5c0JZWDhTM0R6Y3ZsQUxqbmRSQ3kvTVNnR09RU25pb29IUlBGeldSby80bnRidmhBRndEN093cDgzUmhRWC9BUEpwUmRwRjYwT3l1VzhtbnhGcDhSVmR5SkZZWXU4U00zLzFVU1EyaC9DbXErNmppR3diZHNnMktWY3Z6RTBEQXh3bzJIUitVUXJjWVVIYnFhcFpzL0hpWVczT3lnMnV4UDAyUVFLNjhxTkNQcWlvbkQxVXVObi9BQ2xSWUt5Z29WdldZSzkvbUlBOGpQSFRvemEyN2VIeExXZ1MyRU5tYjRtMjJoNGplY093ZHNWSHVadjFJMUZWY1JYNElFdm5zYXhmT3dkaTZyMUFtVmU1TUo0Zk1GTGQ5eWpRZnFCVS9TNG15dmY3bWo1WmhuNmxINEo0NnNxNy93QlJLYkJoUHNuZVo1QzZnN1NtSzVleGJUR29qVGJQaUw4TGtRQ2pmeFBKMlg5ZmNTMTRsUDJSMWtUVDlwaUFTakN4ZlJNRnNRbm1ya0Y0Si96RWFzUExpYVZBWGVOeHE5YXcyMHZKWmpvVFJuWjBXWDdsQklhdHE2OFNuekE0TGtCeGNpaFZkZkVLL3dEZXhCc2RJcXJ4Zm1IQXhXa2FTMGkzbHhIaDU1TEM5OVN5elpla1ZxVjlrTTBNN2ZmNHNiOXBEeW1ZdnpJMFRsRHNzVlRYb1BNc0doOUVMcUZ0TkZRTWpzUUJyYTllWXIwZG10ZGxFOXpsUlVDcnJmRTZxdFBFTmxTNkFTRkF1NnhTVU5kbW5COFNyVHlSVHFjQklESWd2Y2xVYTFKU2dTdk5SWGxyMTJVNERYdVZCYlBxWUlmRnkwNDJJVzNVZkViNTRUa1ZWcjlRS1d2d1E0RmpSc3ErNWQ0V0VSYjVrcWZjRjA1ZitKcHN2Nmd0NGE1R0dqZFl4U3FuYmVEUGo5UVdXNUNIVy9jWGZ4T0ZFcnhXRW9zWGhQajA0c0tHZVkvQXNLQ3A1WExnang2ZXBZb05mOFJWTzE3WVZWYStwNFJEWlJ2YkloV3o2bDBVK1piVnk0bEFkK29xTDJLK2llQmVRdnZJanl1dG5ralhoaUlVZXV6QnF4R09ZL2lvcldsTDVoUkhWYytaYmg0WUpXRlhMWGJpVjhqKzU2b2g0Z3ZYOHhqUzQ3U3dnbUZMaFZtVHlseEpZdFV0VzF4K3B3MVk2UFBtSWFORFQ1anNOclIrV0VkWW9yUEZRc2M0eVdCRi9NNmM1TFBFQVBjRmpkYitwaWEvZmlEVTZleGx2RVNDKzlZb3RIdjdoc0tHbnc5Z1F0RWVmY05WdCtZYUt1bkxsclhFS2dCcTY3Q3BySGFnNkVwdWVKZ0YyRHo3bFhkaTBGb1N6L2dsWHY4QW96UHVlSnhWbEhEektBQXQzVThKU3ZNYWhYN1BjMVdnbEcrcjR6cTJWcytSbjl3dHlteUd1bEUrOWxGck9RQUw1VXNFWGxxbUpYeE83RFkzUzFoTVFSdDNFbGU5Z1V6ZlVVYWVFT28xWWhBNUFjQ09tMmZFTkdzV0poZ1N6OFNpdGdnOFdCZ0ZENWdNZk1vZ25tNGVXM1VTV3daWTVqNmppL3BDMjlveTNiWWdYTFg3alEzVHhPVjNCZEI5enFIMUY3WmtzbGVGL3FVeFZmTVZOSmNmTDFrdXowaW5oc1dEMUExUitHSnQrcGdPMmYzRXIvazkvd0FJNGRpSzBCNUdwN1l6NWFLWHNyWXByNTVGVXF3OHMyNGZpSHNVWEtlK0lLTWhlakVBbms5TVV4VUZCVFpjdEZwNDVFQXRjOEVOS0t2K0k0c09Oa09CdCs1VGFGbCtaMEJTRzFBRVVlVFhEWUxyeVI4RmEvMUJmRDVaVlU3WEl2TDdCZVBQWU4ydStHNVRUdWNuUlRheTdXVUYyK3dvVFZlNHVydmZFVGlySWhmdEpVY2NtRlVsZWZjV0ZiVWIrTCs1ZHMvY0s0eWd5ZWNsWldRUVZ5M1dEdllxODJLNWVUQ2c4eXB0MFV3MFdRNzNzUGxDbXIvTVNxR25tNGNLN0FuSDhSblg5U3gxc0NYL0FJaUt6MXNRVWRlcGxvNzZpTFoyK3p5Mk9QdUQvTXUxV0h4R25JZmhYSXZDN05wWktxeGN1NWV3dG9sRVBLaTJ3MDdIZzl6M1dXVDhuWjFjOGJXb0xhN1V1TkdZRStTQ3dIRCtGNFBzc1ZGRFJyN2dtaXg5L0VFdWNwYWpEN1pBQUh6NVlXeU5jS3NnNkxnNjVuSTFaZTVBNjhrU1ZzTUF4dnpGRG5QY3NyUDNLK0Y3RVMvS1FzOEIwdUtkS011V1JjcnhEUSsvQkVMV29KVkdrcDh3ZU9WK29Rd0I1KzQvUW9nRmJyMU1HSTNVcFlpTUtQSkZMSmI2SlRkbHppalJXTXlCK1pRS2VUSzdIeU4rNDZGc1RZTloyWFBoWG1KRE1lNDh1YnY5UXpPTUhzUThtcGhpOWVNYW1LQ0F3Yk9BSkxPU3d5b3FDbHE1ZXlqc3ZLOCs1YWxOekJPU2xaQzBvWEJEc3UyM0phbTVjRk1RcXZxQUR2bVdDMUx2dklwaDRnQzZOaHZqa1Zwc3BsdDNlMTVsMEFQd3h2RG9kaGF2NTVGZmdoejVnQTVjMDA0N1BXeTI2NFBZbExRaEVPZVRQdVZybjFFd1ZzVGdmL0p2QnlVNlZxR0ZuR0kvd1BQMjR2c0gwYk8yb2NHNGhEUTc3aThsbng3ampXMGYzQ25yY0ZFdjYrb3lKcWpzUmU4aUhTWU5YTTRaZHdMR3pndHRTMU5WQlI4RVVOVFBFd0FGZkVReU9URG5tQ08zOXdXYkpCRkViT1hLYlN2VUlCdTNzb05HM0VHdDg1QlhtNm1YajJMby91S0tOTGphalRYWlpTalBMNm1OblBNTkt2ZmN1OUdxbm5XM3NWVzdGamJFNzZZbFkwc3VueDlSMzBnaGhyN2d2V3N1NTZpb0cxaGpkaEtYZUp3SHpQUHpHZ2x3WHkvZ2hxTGQ4cWFhbUtFYW1RNlJtMEwzN2xOSzloQlJ5WHdtVEV4TUZIU0ZWbU1WT1AzRnR1ODlFb21YYzBvUWJ1NVlrMFhSWXhiYjVtOWVHNFZZSHFPSGZ6QlphZkgzTU9YZkkwNktIOVRXb0tpMzRtVnkxZ3NzaVZUakZndy9KenNDTVV0OGpxY1B2K0M3OUowZHB2OEFjWUY5UEU5VHV2M0FRNFBJVFVjTGdrcXFweW9CSWQ3OEVQV1BoY1kvbVpTa3VLSEpiYXpsUjNYb2lHTGR5aGV5akNyNTh6SktvREc0TTZkL1VFTmxlSlZMbmRnYVhuWWhvRzhFYXFlWFpZOWpveE9GZDdDT2hBc0tHSnZ2SlRaTytDQTJVUjlTeDVQcVVHTk1wU3NJS0FDQXExN0ZUUW10OXdMcTVUL3lsbnh5ZGNxSis1WSsvRUJyekF2RTI2cnZaV2lyOHgwMHBneHZ2aUs5cVlkZndSZmhZWldlWmRwTTJYZnlzcSttK29ENWxENmJncnBUQThnZUNOelIxZmd6RXR5c2xTMnUrSlZzNWMwVVM4UGMwUEsvRXJTaDJmaHBnVjV6L0VUVFd5eDIvVVJxaDNzR2pTWFQvaU9yRGVReHRsK0kvZ3VWQ2ZoNFI4eGtOQVhzWlo1cVAzQVcrZndZV1grWVRjc2djdEc1bE52YWdVam01QjFVRGhSY1VpUXZ5c2dFeFNBOFcrSlI0R3RKazZGeEJ4ckFWVlFESkVDUUZxb05GWFI4eHFRZmxuY3NkcmErcFRMUm4vQys0QTducU5BM3oxQU5aWTZ4UTBjbHhyODVPaTZDSUQ4bzJ0OGtydm5JRktmVEd5aHVvZCtwMXlKYlJjWEl0NGthOTNIQmxlWExlWGsybDVjUm4rb2xZenJJWDB5eGduNWdEYURMZVRPMzJJc2FDYWV1UkhRanIyb0tpZVg4U2pUTjJJWDZPeHJZdkR3eXN1NHR1dDlRVHhFdm9FdDM5Unhrb1AxT3F1S3UvVXZqRHl0TnppNy9BRkx1aGFsOEVxanR4TER4VVFNRTh6NVI3OWRpV0RYTmx2TGUzUEpUWXl4NWpvMU12QWZNR2dWWHovQXQvWVNBVW9ua2ZCRWI0T0VxMlVvYzhNVU5FME5xTm5YZjZpSEcrNFY1c0lrdTJBT2wzRVFIbm1JVm9sQ2dkdmY5UUZuaDhSS0loVnhENWdkanRmbDVnRmpvcTVxRmVPeEZxakJOR1M4UG1VL3FLOFB4Y0ZtelRzRDU0dzdybnFGWThSQW1sdjZsaFFHejZpbHFrSlpkTEJIcUFnYjVoMTJYWENwclZiR3Iza3JxTmtDeUpTc3g1R2lOUzlzN0VhVWg3aC9jeDJZSlMrYllYVmtkRHpOc0FjN0ZEUkJxc3FtZE81NmcyWDVPd2JjU21JdDN4RnZINXVLdFV3UEtvYUxGYnpmcVBnRlR4WHFjTHFMSjMvVTVMRVBSQlNuc2VWQUM0MzJvZzJxby9tQUZaY2RpS3MxRFVBRDBSTFRBc3VaSHZRQlhqalpLQlJLOEhQNDBMSDJTemdOSGh3aGNLd3dmaytDR2hYV3JwR2djT1Y3aHRKeDl4Z0lQN21VUXZyNEpwRE0yRExjT3dkVUZwei9pVTFyZkVBbmZFcWd1SmZicGxOMkpiUkJYeWVrTWtLaExDZ20rNVpRTmo1Z1dwQmZtTkgzRmkvaUNVcHBnKzM4eEtTOUs1RXZKaWwvVWNiVWkyOS83bW00NzQ0K1lBODFNTTRVc0Vhc1JsRTFzaUw2bjRLNUtIMTl4NXhzS1UvdU50SUtaWUV1MHpKclNpZzc1dVZiZDE4UkFNSjUrcFpiNHVhVVJlME11dDh4WFpEeVdZVEQ3bXR2OVFxcUUrcG15eDE3NGw3ZG5KUXZ5UjlKZG8zVENuSDdnZ3haWGlVYWMyQTIrQ0pRN2JjNDdBNURoR1g0anFvbk5oaDdqcDl3ZmhCNWVTM0lneGl1RFp5eGVMK2lXN0RRbG1kSlhoNTRmd2hqT3hQUStDSzZBUHFNdjBsSVVheklRTG5tSWV5R01xUlUrWlNkQXcrWVdSNGhaZ0F2YmlBQnUvZnVKVE9UYnB3bG5YSW03T2tscEI4RFV3VlZmTWJwaXp5d1d6clF1Qms3blpncjIvWFlOOHRnSnFMaWk3NGhMWDA3RlhjbHZOSUFWZlo4bkprb05aWHpPaW9xd0xsQ0RseWtSUytRUUxyNGhyNmdCOVJOTUpkaXozTExCQjArSUFLZ04xNmhRSWxpakt0cDJVVVZIbVFCOVRXRFNBMG4zRUQ4UGlVU2p4SDNaRGx5YVNydnpVcnpLR3UyOWdOenM2ZnFBK0s4ekE1RUEzRlpjR0EvdVUyQ1FwY2dEMlZveTdEVVdvNldTL2ZpYmNQdkRrQ20ySmJSb3FNb0o0S2xqSlJpaVdmeVFCYjlmd3hWVEYzN2p3ai84bnBVOCs0c1MzNmxjZThoYkQ5TE5nZUltZjNLV05wQUZkZk1MQUJ5YW0ycFlRdW9lL3dDb3IxNjdLZHZrQVh6NUpVNFA4eGdlQTRSUXl5VkJYZkVickcvbjFLaG1mV3dEZnRkc1dqSTFXWThnQnc3NWpwVjNzZEJXUXpMbDJJeS9IdWJLVWptdVFlU2Q3VmZFVGNXamZjVlBCVHNiY1RzeXBGa2NXRVc2SDVubXpaZHRPZW9QM0RFcllxbko0Y0pxaWFYcEFBcXAwK2ZVcE5maUF0UUZxVWZkRXRvc2czejh3dXluSmJndzhrMmREMU1VOXkwQTZOVDQ4eGZOUzJiTHFZUU9iSEQxc0s4c05BSmRJdUdxWjh4SGI1UFQxTXZKZjdocHZJbU1MczlnTkZ2NWxOS3V1N0cxbEhMTzNGb3prL01RYW8rSmVBcGIrRENWTFdkSGlFYUtZSzl3TDdlUmlDK1ZBbDhlVUxCVThpaXcrUFVacitVVnQrUFU2Z1NuRVRZN05sTmFiOFMxQXVwVldVT3VYa3B6S3AvcVZhVnAyaVVTaFpxNXdFeDQzazhqU213QUxmR3hzRWRZSlVmdHFPaXFaVU51d0NnNUErUlVxMzhRTnQvRVMyNGdiZUhtRjk4VHkreUx2TmpacUdSVlB1WlJaRXBVbDgrcFRmeEdhdFV5QzkvU0tBYVpZN2N0RVkxdmxpVmh6VTdQWS91V3JlenRQVCtLTDkvRXFodUZMWHFYdThsRGtGY3JQRVJsS1hBdE41TFY4eTd6ejRqZ3hBcExZbVVTdkRUeEVhL1pCemFDZVQxSDZsbk9FRHA2U2xlN0VlR1dyNGc4djRxZFRqM1l1N0c3L3dCUkNFOXdnVjdtTmQ5UWhwamY1cy82anNEYlBQOEFBdXJnZzdOYi9PeElLamNBTjBwN2g2ZThpdXlIdVdyc0R3U2dGVlVZRjJQMUtkWFBQYmd5MTV5SjlWRzFFM0lHN0RuMUJMdmlhRnE3bUFZT2R5QVRDdmh3alcyNkdiUEl4OEVhMGU5bG0rTGx2ZjFMTldEOE1HYnN3dXJCa0NtMzhUaXpHdkV0VTJ2aVcrSnJ6VEZuYmhzcFVhb2ZNcDVmMU1HVVUzQUhHR2RTQzFTMzNFdXFoUTA5OFFKWTRNQ2dYK3BUejI5bHQ3ZnhLcEY1OHh0OHRUekwybzRvREVIL0FERzF1NWhrNjk3QllOZ3pVdlplZk1zRjduZm1MZk4vVWQ3QWE3QVZFR2hGekpScEJLUE1NZW9HVFBNRzk4RW9INW41bEVlcFhmVUExeVdmaUxEN21hMUsrTFUvcURRSUgrTEg2bFJCQkpvK0lMdFh4SUNVaFA4QUVBcDA1S1NrdnI4d0NrMjlXTG9OK1BNck43cnhjb1BtZERKUWNoVnFxK0lkTkI4Ui9HOFE2SG1QWVAzUE12M0tVMGMyTlZUZHUxVTBhVXp4VVBTTDVSamh5M3RWRzZERzRnalFUd1h5Vk1BWWVEeUFjSWk4Q1lEZGdaYkgyT3hiQnVhMnY2Z29ic1YrWTZEY1cyMXlkYTNGWFc4aWFBWk9HWlUxZGVIS2xvYU5pR2p5eDIrWjRnWFVSNjVLdmtwVDNFSHoyTkdyVXc2TmZVZGRzWjgzRXM3MlZ4MzNPQ1h5djNBWmpaV25JYlM1Z1hseksvUElOTWQ5UlhZN2M4Wkx3b2pyVEVMb21ubFZET09UNWZpVnhPYzJwL3VMYmZrbi9qTVA0dUNHejZjbDN6WmdHRmVOZS9UTGEzZXdGMXl5QkRUVHl2OEFISFEvTWN5bFI3NUdKV2pVR2wxMklzTjh5eXJybklJcEsrcFNuSG1HQ3FneDJhZkd5bGFRWEpRSzR4MWQrcGlyUDNLR2prNkpNdnhDQnNpUGF0T1V4VmNyUGNJRTFmY3hwZlVQakNBczJreTdZSU9RdDJZMnFsWjhRb2RJZlVCTnJzZlRMdCs0WitlUlV2Wkxwbjlwd0NkTW5pNExQY3QzOXlxMTVLUUlsVmhCYjJOcGo4U3JLeXZNRnFwdDVDNnU3K0lQaW9jOXlsYWNoNVlGZG1lNGhaNStJQUhObWxzVWZVR3JDSjllWW1OOGl1aG9ya0IxbnlObFVOd1BSQkRHTkR4YzRnbzFsSG1VV0FYTDhmbUhjNUNoZDdHTm0zSEhKMGlwZXhYeCs0bmdrc3JEWDNQVDhwUmVWaEZjcis1WUh4WkZVQUorR283dFkvbitDTjJZUEZaSDVOd3lqdVg5eWllbmg2bEYrYjh4N3lJY2ZiS3ZpS3JLdjdsdWhyTzNaS2VFb1piY0VqRE5uLzFFd1NycFI3bDBJQ1dYNW1QRU9WT21vWGVSby94RXpkZ2I2aVBxVnRIbWNSdXV6aGNEVFpCWFkrcm1SZ3RWTGRxbzJzcS9VdjMwbGpZSFp4dTdaZkE4K1llZDRlb3B0MkZkWjU1emt4OXdBRkxkNlExLzdqK2c4UUpWOHptaHlJUnQ4U2p1Y25ubVMyN3NQaUErZk11NVpzeGRuN1psNWRTMEZRUkt1ekcxY2lsZzhRS3Q1VGtxNjgzNWw0K0VIZlAvQUJBc2gvM0JmWnJ0WCtaUlQxRjZsbjRsL1A0bkh1NGMxWlMzcytPekxyMURsUmFWN0xQeEN6eDlTeTBqek4rb2F0NkNlRitHTFpWNWtZb0UyczdrQWRhSGorRE1YK1lsYW9vRDl4UXpWOE9tSFlBN25ZVmp4T214ZG85d0pya0hyd21CNGZKRGxkZzU1TWNwcTMzQ0ltQjJMYTNST2Q3QlVmOEF5TmhjRG54S1ZBdXRpeDZXRlNwWUxOcnhGang4VDFtM1d4V1RQWElMYmdFbnpGUzNEekJSWFdWVHhxZkk5NU90NThRYzU5U2twS3VOSEpRU01SMHNvUFIrSm9wdjlTbWdENmlwcHV5YUgzQkY3RDZJZ3dxQUViYkxrcG5pNWhXZVFEdnhHdWR1VXI3OVRqTnJzb29EKzRac1Y4TUtsNEh4TXBSbHhScHlXS2RnOUtpTldhUWRvYWpISUI2MTVxVmg4eGFTN0lJOGl0ajhRNkJCWmNGOVFWQzY3QlJtdmp4S1c5bWJyWVFlZmNTM3ZpZnBSMktnbHN3V25tVnE3cUszZWZ1eUVLVS9mOEVWSHpMMTV5dmNTb2I5TUlBdXM1S085MzNBQzJDekNiK29oYSt4dFN2Nmo0Yzl3aEdBSTg4U2t4MWxncUVDM1ZzU1VvTlNHa1hVWUxyblk5NzA1S2pDcW1qc1E3SHAvVUc5N0s0cG45cTJGaHNHd05aNDNzU3Y5VHZ6VVhnL2R3YllmaUtiZmp4RGhObE8zeVY0aDdZZ1d3OVRRdE94YnczVUtXTHlZclcrcC9TUCtJS0hQekVLYWw3QXZiMkllOGptSFdXdWlVdkg2WnExN0pTcUtpb0phZStKcWdhZ0FtL3pBVnJveE95aDZ5WXI1aWtvZ241amhzZmZialliaEZ6TmdMbWxucU5rS2Z0Z1VWQnB6ekJEM0RYNFkzV0ZzM3JzTk9WUGxzVlB4RnIvQURQTU04eGhYaDlSOGlhYkY2YmZJMm13dnlUbnc1L2JDRFZjL2l0NytxbU8raFJUNGlpaVB1QWFGY2pROHIrNEFWNjRRVmpzYkQwekF0Zk1hQmtSL3dCeW5oTG90eDlSa1BtL3FiTmNZQmRoT3pQa1FRRVY4UmIxenhBcTMrcFJhTThUd0Vpb2hiL3RLdjRQaVV6elVwWVlkMWlDVkVwcW9WV3V5NWJ5Z0hhK0VIMlZING03MUl2TmpRUzZsMUZydng0bHJBTCtmRUNuejZZYWNmRTk5Wkd1d1JiTCs1M3VvcVJJdGVZdFdyczY3QkNkbW16SmRaTlRIOXdIN1MydE4vaXhYWEkwNS9jczg5bDlYRWVESm84djNGMUJ4aG9pRzBXdm1WKzRxeno3aGQzY3F5VlpWZk1OVS96QXpaUjVXeFE4VG1ubWRvcU5HeC9PeHVVb1oySUQxcmtBTnFBTzJrS0FidkNCRFhUdnpLOU94eS9NcDhHdlg4RXQrNnJsc25BMTZJaWpvODlqRWVoc0NpbTQwS3IvQUtoM3UvTXZadGU1ZU9lZW9jY05RSzdrT1Y5amNIbVdsSUR6S29QZ2lMVGlnaUZFNnhNNVVBcmZEWVU5OGVaaFpBUmZtQUJEM0VOcXBnNVRsejByOFJmRVZXdVIrSjFsbXhaN1lvMnF1QzFHcXo5eStIekZ5MWk1bUVzV00rb0V2b1g0bUdNcnNzZ0cxNmhtRGZ1TDB2ekROOWU0SlRUN21LUDJoZkl3MXYxT0dUUlh6Rk5DVUN2N2xIdGtQZldDT25Uc1Uxb0dJRFYvbUxPeFNWbDl1Q1h0eE1jY2l0RXhXN09PRmhaZEsyTHluelBMYnNORGNqcWdnUGZNWFdpV0tPQkZUY2JaVXluMUN4ZHlPdjFPUEk0b095eUpHdzNJbGNMdmhFQ3pBajBQZm1EeDROL016UEQxWDhDMjIvRXVGbS9FZitJOWJGaHlVRnNYYTM4UmEwNmtSVDUvMUdnM0ZPMWU4aHdDSzNicUZxTDhUQlNXRUtVM1JMQ3B2aW9LZ0NOSGk2bEE5UUxqUkxnVmJwRTFTcHN0NC91Rk9zZENVL0UxanoyQldFNnp4R3NDUWcyeVhjYjcyTkRVVnVxWXdMbGxKcEd6a3RmSjlvaS9OUldhOGVZK0ZSQVpudWU3WmNCRGEzMUVFcHlORFczS2VGUmR6WnJpWjhRZFZBSDI3TGhGeU84TytaVlhSOTNFdFhBOE1xcUxJTmNWNmxEWWoyWTlGU3h0NGVSV3N0SUJOUDZtdVlqQzJyNGpyZVFYRjVmNmo0Snp6TGZhQmJlakxhc1l0eCs0WDF4WS9FOFJGNjloOS8xQ3VQY3RpOGkyMk9TblhmOEFVVFRzZjhSNjJWVzNuektmbDh4WHgvcmtTNXF2N214ZCttVUNqeEdyYmgzQ1B3Znd4ZG9mY1FGNzJmY3BUbkdJcFJYeEtwcXNqbmlxaGEvZk1CUzNwd2pBK0I1bERYOVM3amtMRkgvMkd2SFhjaUFqZk1iZVVYVVV2Z21ncFBVVkpRSGdJeHBXRFUxR2lLOW9yQnVCUHIxSG81UGk4bEQ5ekoyVXZaNkhaa1QySjRRTTg3RVAxTnd4ejh3YzdFQ3NmSVhaWUIveEZaeUFMVTJGUmZKbGdjbUFIL2NlMWRMTC93Q1VHcmZJUEN2NGdXYTNOQ3BTdi9NN2hVUmNjOHp5UGN5bkxsMWsxeEw4eGZmUDFINy9BQjh4SndUVjlueE1NOFJzalFVMU1IWUxWVG9HRTZ6SmRWV3dhODNBOHZQVWJXcXVvWTEwZ0NHOG0yQ1g1V3k4UEVNZFE5ZjZsWDJ0Z0Y3Y3l2UDNGb3NDTDIzd1FKeitJbGpoNmhEd1ZSWHFIeHkxUmhwT1M0VjRMNm5rUzJOKzRyMVE1OFNvVnlOcFc4eUJ3YnYrb0lSNzZ6UzdiOXdnSllQVVhrV1FEajh5OG9Tdk92YVhLSFE3c0dyVktDL1VxVWpwTEVKeGlPY0lGQitqa2JEUDdsNWFIVTRBMlV2NmdsUzhnaTFWVDVNbXFMbjlER2wzeEFyVUM1bEFkOVhNZko1VXhKbmZQaVYvY2FGTjBNYXg4T1ZNVStlL0V1ekUwNTA3RjZJSElmbGZJSzR6cS9Uekc2Y2pqdklVMGxMVng1aFh1M0dqb2xhMlZVcmJQRXBWNWZxZVIrb2dKUlBYbjFBVXEyK016ZnQ4UjM3OFhIMk1ndHBWU251Y2I4MVBwOFFYejRuay93QVQ0ajZTNWgyQXJQZ05qWktVdmg0anFEVENmSThSUnlTbndpdjZpV2JGRG40aVdycTE4UW5vWEtMUXR0Y3pBTmo3K0lVRmdhL2Y4SDIvaERYNEQyN0s5LzdJVUdKdFFEelM0WFFnS1BtQ3B6ZmNvSHFucEF0WXEvUG1GdmdlTGhOZGUzdUZnSzlYMk5jYlYzS2dXUEFWRVhDWjhSQnU1UzNFc2ZIbU4xaVh6MzZpdVA4QWNBRnNmRXByTWlQdkpkYjRsM28zVWZGanJJTm5zbUhzd0xsRm5ZL0NaSEwrcGRmajRqUUpMRzNmams4RHljYnEyZDFCK3BZWUY4QzF2M0FnNWJ2ZU02SFlnZlV1emYzRTByeEgzZXdFZC9jSGc4bm12Y2RDM1VBRGdRTTEydXBOVlBaWUF4V1JGTDhzQnQ4ZWV5aThPZW8yTytaWWVhaVUyenhmcU80MStacHdsT2JQT1BQY3BXQjd5VzBieWNGOXdZT0w5eTNPdmlBMjhNUkx1MXhhQkI1NVRrcVlKZm1DZWw5ZkVzK2o3anlPaFBYMDJQZGFTRjZSK1NVdXJEYmx2MXBtUXFSL0YvRDNseEhXQVBnbi9VOVdscW9jZ3FJRHdyS2pXWGRqTUpmSjRnamV0OUpWaXVMNDlSRFZMUE1hV2ZBOUVxMFlyMUhONEROZ29FQ2g3aTlwOTBFVkRSNkp1dWdlNHFWZHZZeTg1UGsvaVpkTGpMTWV1a1dPZ3dYV2o2bDIxZmprNm8vTXEvTUs3ZFQ5azZncGtkYkRqUDdocGNKNEVxS3NySGtIQjdLUytSUGI5eTBmSy9NSzlxZXkxK2lkb2Y4QTJhWHQvRWF5eUZIdXdxKzdFRC9tS3U2UTZCdW5XSzNUTTdMWFhVTHEvTDFMUnUrbzdqalVDbERYNHVWWjVONUtITXZ5d09rQ21sdnFVdVdSQ3RKK28vTmNnMjcrNFBTenl5enpzTU9Nb3Z0ekFCMjU2Q3BkNTVscGFmVXRyamNhemQ4VkZQbDl3TnNqc1cxOEJCQUxLWDNGSHJURWcwMkR5VUwvQUZOMVFQTEZlR200QTAxVHlWZ1BBTytZczAvcitCV3lpUUVDK2NNbUY3aGF5cXhYTGl1TUlkRnZKdHJYcVBnSVY0Nk1FcGVlNEZUencrWjJHbmg4eThWTGYxRXRmVFh0U3luS2NpUVZUeWVTQTZYUmtWdUQxRFRaTGNLZ1JhZmZxSUYxeU10ZWZNYU9LYjlSQXB6eXhGM1YvYzFoVjZqcTdxSzBPLzhBTUwwL2NGS0tyMUFSU1hDMlhoL3FXbjE4U2w0WEFBR0pvT0hpNDJNOHlucVdyczBVa1I1SHROQlZXekFEOVRzZE9XeDFVaWZUWWx1d05iaDdqZmlhZmozR21PemdySjFYK29vTGFseTFoZFJxM2wvSkJ2VDh0U3luWmdFWDh3cFNPK29CVHg0bDB2UkZEN2pLM2FYQkd2OEFNS1h2NGlBWVM5NElDbTc4VHd0czdvNUx0aGRJZnVjZmM1M0lLSHg3bXJuaUlXYnZkZzczUEVYVGI4UWJvajZSSzh3RC9DNE1DTFIrWjFmQU9YS1c0aGNWV1VxTW9LeFBXMUt3WG54L0NMbG43cUROL3dBbmdqb2dOVnNLQ2dQVUt1NzZtZzZUM0NpMitabXRDRzFTMzl3MHEwT2pBb2NIL01VV0lPZWo1am1ocXVibFRUVGxrQytUMHhIQzBSYWgzL1U1YUJ4bHFTbitabExIekxGdFMrbEdOS1hLTUk2VkM0a2lEVTNRNHhqcHUrVkRZMSt2aUJUZkkxVjFLMTh3VEtucmY0aEpSU3dhcFd4cjV5VWMvVlJ0Ymo0bEM2Z09YenNYT1B1ZTE2U3RybjFMdGc5b1dlUHFBNVB1TGRaWXVjOHhDODM2aXJ4S05iTHkwdXZpTnJGakhma252clVvQnpleFZ5ZHphOXBBUFRFR2RoUTZqVVU1NDhWN2hRMVZ3MVdMenNRUFZ4QTJOdVhqL0VOREI1bW54S2JmbVVpLzRuTDcrWmVXUFBGVFhMYXVPTnZJdE5qOTV5VUdGeDNiZ1YxTHlCWlVTRlkvRW9OSnRlbzE5eVVXeS9rbFRSNEg5a1ExNGR1LzRYeS9ScVcyN1pMZFlROVlIcjVoWmlXLy9aRWREWFBxQXBwMkFORkgzRVVZRDM2ZytRTjg5eDlBdDhuRWhhdnRSVWtCMmxsRUorVXV4U3ZXbzFvVVY2SlVLdnZpTENIcEM0YmJjcmtXbHRYaUIydmRZdHdlb1YyZThqWndWcFY4UUt0Q3VLOGhsL043aG5sVHlPM3lPLzhBaVV1OFZBVml6MlRLOUQxTFBMbnFXNEpIc3NhbXNCc280bHA0bFFhVitZVlhOOFZFZWpYbGc4R055Q1BBc0YvZnpDdzdLYnUvM0JlbzIzeWVvWGZLSmJWWjlUbmtXK0VmQXlXVVI2bG42SW9MRzJzOFF3dGJKNUtPVFJsWkFKNkdjT2xlb3Q2QkJibFFEZzErSXF1amtBYlFKenF4QjhaQTJRSzh4ZCtJSVBaZVVkOHk3WFpieC9pVWJFZjdJcFZBY2pXQTA5Ukx6OWVvVlhJdGNDb0YvY1NKNys0bEFwWHFOOE1mNmhwNFFuaWd6M3BHby9JYi9oaHlKcnNZK1JNL3hHM3g0K29mYXFmcVVTMnZrYkp4Q2RwZ2dKY0ZMdW9KWE5lOVNITlRXRytQbVdPWGxYSmtFdTlvdi9NU3dmUVp3S3Erd0MwdWVDc2luQjVqc3NJK0xoZ1VSeGw2THJYM0JlMEJ6WmJRb1gxbHBkK3ZtYXUyOHBqU0VhZnFBQmFnejZlSTJWZk9URnBUNEowUXF2RUt1MUExTVBpRGxpVkVYckxGbHlrQjUyMEpHVlRIbXBTblRzWW11U3A2U2xHNi93QnlvaTJzNVVwZzBMd3YxTExDNmh2bEFsaXZoelpadEdRUkFSTEtxOTl5L0pkKzJYYlloOVNoVzFLK3kzdnhMNmM4TXRTMENVWENlUlZQOVJKUUY4RVN4RHhFVWJGVFpWb1ZIMy9tQmU1TEx5R0paZmE4endyc3laZDNVYStqNWdhNzJCeTdxSXU4L3dDSlF4aWlzL3M3TDMxTEtMclBKNVp3aFZiS0ZQTVFaN2lJN3p4VUs2UEVSc3FvQ2xMTnVOekk5aTlqcHY4QUZxVlpGYTMwUlVxeC93QkkwSG5SMjRDMWwxTDh3NmxUMUUxZjd3TldKY1lUelVGQlZQSzlTeEFqMnpJT3ZBeFpzUzN6TlNXUHVKZ0Y5cEt5MEZnS3JMKytSQ0ZmTzVHUzBBOFgyVlRRdDI1ZHh4dnNDRW9HYlFQbHNLcWVGWGV4ZTJBeldYYVRaQldzdjM0aWhpbGpUTDRhZUdhTVllcy9NRStYNWwzS3I4eTdidCs0anJWZk1RVWcrb09kUDMyVzAxR1ZkS1MvVy81aStmNVJ5VFgvQUxSc3VuM2NFVlQ5eGZqK0dHay9BdUs2L3ZIb3NRVXZ2MFQ2SDNHMGV2aVdISDNjMi8wWTVLcDhSTGhOZmovaVhxZHhZcC9hZUd0RWZWL2NwOHc4L0hraDZSQ1c2OGZ1Rk9tTi9FNEJobHpCbmlWdk1vT0g2ajJ1VGhETlNvbVZjL3JMZTU5U2w1L011ZWErNCtqeVhHVFNIdkYrSDdsdkRURXZpSTdiVCtTa3hBbm4wS3Y1UDZYM0dpYVVpQTl6U1hnRkN1UHRSOXFEZGtLVW9JNmxpWC9BS2FtTUMxMy9BRmdkMUl4VVVMazhIK09BL1lmYWhES2Z4Q3p1ZTZsbWYvTW0vd0RGaitBQ3l1UDRCcW5XKy81aktmOEFqUG1UZitBSVAvZy93UDhBelA0Zi9tUWd3clQ1MGFvNWZ3bTdyK0lmL2lBVGZyK1FQbGZ5QVlQblRELzhnQWZ5bzMveERYRk5VTWJvaFFQOGYvL1oiLz48L3N2Zz48L2c+PC9kZWZzPjx1c2UgeGxpbms6aHJlZj0iI3RpbGUiLz48dXNlIHhsaW5rOmhyZWY9IiN0aWxlIiB0cmFuc2Zvcm09InRyYW5zbGF0ZSgxMjgwIDApIHNjYWxlKC0xIDEpIi8+PHVzZSB4bGluazpocmVmPSIjdGlsZSIgdHJhbnNmb3JtPSJ0cmFuc2xhdGUoMCA2MDApIHNjYWxlKDEgLTEpIi8+PHVzZSB4bGluazpocmVmPSIjdGlsZSIgdHJhbnNmb3JtPSJ0cmFuc2xhdGUoMTI4MCA2MDApIHNjYWxlKC0xIC0xKSIvPjwvc3ZnPg==");}
:host([data-tema="pult"]) .frame,
:host([data-tema="pult"]) :is(.dash,.kinalatlista,.mbub,.pbub,.jlista,.szuro-panel){
 background-image:var(--tw-paper-tile);background-size:1280px 600px;
 background-repeat:repeat;background-position:center top;background-clip:padding-box;
}
:host([data-tema="pult"]) .dash{padding:10px 14px 12px;min-width:0}
:host([data-tema="pult"]) .dash-fej{gap:10px;align-items:flex-start}
:host([data-tema="pult"]) .dash-fej .cim{flex:0 0 auto}
:host([data-tema="pult"]) .dash-fej .osszefog{min-width:0;white-space:normal;text-align:right;overflow-wrap:anywhere}
:host([data-tema="pult"]) .dash-fej .chev{flex:0 0 16px}
:host([data-tema="pult"]) :is(.dash-body,.hero,.hero-main,.kpik,.kpi,.statusz){min-width:0;max-width:100%}
:host([data-tema="pult"]) .hero{grid-template-columns:minmax(0,1.12fr) minmax(0,1fr)}
:host([data-tema="pult"]) .hero-subline{flex-wrap:wrap}
:host([data-tema="pult"]) .hsor{grid-template-columns:minmax(90px,120px) minmax(0,1fr) 52px;gap:10px}
:host([data-tema="pult"]) .hsor .ora{white-space:nowrap;text-align:right;min-width:0}
:host([data-tema="pult"]) .psor{grid-template-columns:88px minmax(0,1fr) 44px}
:host([data-tema="pult"]) .ksor{grid-template-columns:minmax(90px,1fr) minmax(0,1fr) auto}
:host([data-tema="pult"]) :is(.hsor,.psor,.ksor){width:100%;min-width:0}
:host([data-tema="pult"]) .bsor{
 background:rgba(255,248,225,.17);box-shadow:none;border-bottom:1px solid #ad9870;
}
:host([data-tema="pult"]) .bsor:hover{background:rgba(137,107,48,.14)}
:host([data-tema="pult"]) .nezetsor{margin:0 0 12px;min-width:0}
:host([data-tema="pult"]) .nezetsor .pkatvalaszto{
 display:flex;align-items:flex-end;flex-wrap:wrap;gap:3px;border:0;border-radius:0;
 overflow:visible;background:transparent;
}
:host([data-tema="pult"]) .nezetsor .pkat{
 flex:0 1 auto;min-width:0;min-height:25px;padding:5px 13px;border:0;border-radius:0;
 background:var(--tw-tab) center / 100% 100% no-repeat;color:#c4b392;
 font:700 11px/1.25 Arial,Verdana,sans-serif;box-shadow:none;
}
:host([data-tema="pult"]) .nezetsor .pkat.aktiv{
 min-height:30px;padding-top:7px;background-image:var(--tw-tab-active);color:#e8d9b1;
}
:host([data-tema="pult"]) .nezetsor .pkat:hover{color:#fff0c5;filter:brightness(1.12)}
:host([data-tema="pult"]) .nezetsor .njel{color:inherit}
@media(max-width:560px){
 :host([data-tema="pult"]) .dash{padding:8px}
 :host([data-tema="pult"]) .hero{grid-template-columns:minmax(0,1fr)}
 :host([data-tema="pult"]) .hsor{grid-template-columns:minmax(70px,100px) minmax(0,1fr) 44px;gap:6px}
}

/* t29: minden listanezet, gorgetosav, keszletkapcsolo es alnezetek. */
:host([data-tema="pult"]){--tw-scroll:url("data:image/png;base64,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");}
:host([data-tema="pult"]) :is(.asor,.osor,.ksor2){
 background:rgba(255,248,225,.13);box-shadow:none;border-bottom:1px solid #ad9870;
}
:host([data-tema="pult"]) :is(.asor,.osor,.ksor2):nth-child(even){background:rgba(123,94,43,.065)}
:host([data-tema="pult"]) :is(.asor,.osor,.ksor2):hover{background:rgba(137,107,48,.14)}
:host([data-tema="pult"]) .ksor2.valasztott{background:rgba(137,107,48,.22)}
:host([data-tema="pult"]) .ach{
 background:rgba(140,112,55,.16);box-shadow:none;border-bottom:1px solid #9b845e;
}
:host([data-tema="pult"]) :is(.stage,.kinalatlista,.jlista,.szuro-panel){
 scrollbar-width:auto;scrollbar-color:auto;
}
:host([data-tema="pult"]) :is(.stage,.kinalatlista,.jlista,.szuro-panel)::-webkit-scrollbar{width:15px;height:15px}
:host([data-tema="pult"]) :is(.stage,.kinalatlista,.jlista,.szuro-panel)::-webkit-scrollbar-track{
 background:#4e3924 var(--tw-scroll) -30px 0 / 60px 30px repeat-y;
}
:host([data-tema="pult"]) :is(.stage,.kinalatlista,.jlista,.szuro-panel)::-webkit-scrollbar-thumb{
 min-height:30px;border-top:2px solid #947d53;border-bottom:2px solid #382416;border-radius:0;
 background:#846841 var(--tw-scroll) -45px 0 / 60px 30px repeat-y;
}
:host([data-tema="pult"]) :is(.stage,.kinalatlista,.jlista,.szuro-panel)::-webkit-scrollbar-thumb:hover{background-color:#a38953;filter:brightness(1.15)}
:host([data-tema="pult"]) :is(.stage,.kinalatlista,.jlista,.szuro-panel)::-webkit-scrollbar-button{display:none}
:host([data-tema="pult"]) :is(.stage,.kinalatlista,.jlista,.szuro-panel)::-webkit-scrollbar-button:vertical:decrement:start{
 display:block;height:15px;background:var(--tw-scroll) 0 0 / 60px 30px no-repeat;
}
:host([data-tema="pult"]) :is(.stage,.kinalatlista,.jlista,.szuro-panel)::-webkit-scrollbar-button:vertical:increment:end{
 display:block;height:15px;background:var(--tw-scroll) 0 -15px / 60px 30px no-repeat;
}
:host([data-tema="pult"]) .ujform .keszkapcs{
 border:5px solid transparent;border-image:var(--tw-button) 6 / 5px stretch;border-radius:0;
 background:#4b321b var(--tw-button-middle) center / auto 100% repeat-x;
 color:#f5e6c2;font:12px/1.2 Arial,Verdana,sans-serif;padding:3px 8px;
 text-shadow:0 1px #23150c;box-shadow:none;
}
:host([data-tema="pult"]) .ujform .keszkapcs:hover{filter:brightness(1.15)}
:host([data-tema="pult"]) .ujform .keszkapcs.aktiv{
 background:#d5d9b4;color:#2f4b25;font-weight:700;text-shadow:none;
 box-shadow:inset 0 0 0 1px #657548;
}
:host([data-tema="pult"]) .nezetsor{margin:0 0 12px;padding:0 2px 5px;border-bottom:1px solid #ac9974}
:host([data-tema="pult"]) .nezetsor .pkatvalaszto{gap:5px;align-items:center}
:host([data-tema="pult"]) .nezetsor .pkat{
 min-height:24px;padding:4px 10px;border:1px solid transparent;
 background:transparent;color:#645131;font-size:11px;font-weight:400;
}
:host([data-tema="pult"]) .nezetsor .pkat.aktiv{
 min-height:24px;padding:4px 10px;background:rgba(119,85,31,.16);
 border:1px solid #9e8453;color:#3a2915;font-weight:700;
}
:host([data-tema="pult"]) .nezetsor .pkat:hover{background:rgba(119,85,31,.11);color:#3a2915;filter:none}

/* t45: a nezetvalto gombok latszodjanak gombnak (a felhasznalo kerese).
   Halvany hattér es keret mar alapallapotban is, a hover ennel erosebb.
   A zold osszeg a gombon ugyanaz a zold, mint a listakban. */
:host([data-tema="pult"]) .nezetsor .pkat{
 background:rgba(119,85,31,.06);border:1px solid rgba(119,85,31,.22);border-radius:3px;
}
:host([data-tema="pult"]) .nezetsor .pkat.aktiv{border-color:#9e8453}
:host([data-tema="pult"]) .nezetsor .njel.kvez{color:var(--green)}

/* t46: a taska erteke a hely soraban, sajat buborekkal. */
.etaska{ flex:0 0 auto; font-size:12px; color:var(--faint); white-space:nowrap; cursor:help;
  text-decoration:underline dotted; text-underline-offset:2px }
.etaska b{ color:var(--dim); font-weight:600 }

/* t30: teljes fulvegek, a lenyitott muveleti reszek egysegesitese. */
:host([data-tema="pult"]) .fulsor{gap:4px;padding-top:2px;min-height:37px}
:host([data-tema="pult"]) .fulsor .ful{
 height:23px;min-height:23px;padding:3px 2px 4px;
 border-style:solid;border-color:transparent;border-width:0 24px 0 18px;
 border-image-source:var(--tw-tab);border-image-slice:0 24 0 18 fill;
 border-image-width:0 24px 0 18px;border-image-outset:0;border-image-repeat:stretch;
 background:none;line-height:16px;box-shadow:none;
}
:host([data-tema="pult"]) .fulsor .ful.aktiv{
 height:33px;min-height:33px;padding:6px 2px 8px;
 border-image-source:var(--tw-tab-active);background:none;line-height:19px;
}
:host([data-tema="pult"]) :is(.kvsav,.esav){
 margin:0;padding:12px 14px 14px;border-bottom:1px solid #9b845e;
 background:#e8ddbf var(--tw-paper-tile) center top / 1280px 600px repeat;
 box-shadow:none;min-width:0;
}
:host([data-tema="pult"]) .kvdoboz{
 border:1px solid #a48d62;border-radius:0;background:rgba(255,248,225,.2);
 padding:12px;box-shadow:none;min-width:0;
}
:host([data-tema="pult"]) .kvdobozok{grid-template-columns:repeat(auto-fit,minmax(min(200px,100%),1fr))}
:host([data-tema="pult"]) .kvdoboz h4{padding-bottom:5px;margin-bottom:7px;border-bottom:1px solid #b9a780;color:#3c2e1a}
:host([data-tema="pult"]) .kvbe input{
 background:#eee9d9;border:1px solid #886f45;border-radius:1px;
 box-shadow:inset 0 1px 4px #50341675,0 1px #fff7dd;color:#241d14;
 font-family:Arial,Verdana,sans-serif;padding:4px 6px;
}
:host([data-tema="pult"]) .esav .pkatvalaszto{
 border:1px solid #a48d62;border-radius:0;background:rgba(255,248,225,.18);
}
:host([data-tema="pult"]) .esav .pkat{
 background:transparent;color:#51432d;border-left:1px solid #baa783;
}
:host([data-tema="pult"]) .esav .pkat:first-child{border-left:0}
:host([data-tema="pult"]) .esav .pkat.aktiv{background:rgba(119,85,31,.18);color:#30230e;box-shadow:inset 0 -2px #8a703f}
:host([data-tema="pult"]) .esav .pkat:not(.etilt):hover{background:rgba(119,85,31,.1)}
:host([data-tema="pult"]) :is(.kvlab,.elab){color:#51432d;line-height:1.4}
@media(max-width:560px){
 :host([data-tema="pult"]) .fulsor .ful{padding-left:0;padding-right:0;font-size:10px}
 :host([data-tema="pult"]) .fulsor .ful.aktiv{font-size:12px}
 :host([data-tema="pult"]) :is(.kvsav,.esav){padding-left:8px;padding-right:8px}
}

/* t31: szorosabb fofulek, kisebb oldalso ures ter. */
:host([data-tema="pult"]) .fulsor{gap:0}
:host([data-tema="pult"]) .fulsor .ful{
 border-width:0 14px 0 12px;border-image-width:0 14px 0 12px;
 padding-left:0;padding-right:0;
}

/* t32: a kapott mintahoz igazitott megjegyzesikon. */
:host([data-tema="pult"]) :is(.mjel,.mjel-ures){
 width:11px;height:11px;flex-basis:11px;margin-right:4px;vertical-align:-1px;
}
:host([data-tema="pult"]) .mjel{
 position:relative;border:1px solid #92701b;border-radius:50%;
 background:radial-gradient(circle at 32% 24%,#fff3a1 0%,#e7c84d 35%,#c79c1c 64%,#9b7413 100%);
 box-shadow:inset 0 0 0 1px #efda7770,0 1px 1px #5a421b55;
 color:#4d390a;font-size:0;line-height:9px;text-shadow:none;
}
:host([data-tema="pult"]) .mjel::before{
 content:"i";display:block;font:bold 10px/9px Georgia,"Times New Roman",serif;
 text-align:center;text-shadow:0 1px #fff1a060;
}
:host([data-tema="pult"]) .knevhely,
:host([data-tema="pult"]) .kfej2 .krend.knevhely{padding-left:15px}

/* t33: kitoltes a keret belso szeleig, megjegyzesjel igazitas. */
:host([data-tema="pult"]) .kinalatlista.atvlista{padding:0}

/* t64: GYARTHATO FELADAT FAJA a Gyujtes fulon. Csak hozzaadunk, a meglevo
   .bsor alapszabalyokhoz nem nyulunk. */
.gyfa{ margin:0 0 10px 15px; border-left:2px solid var(--line); padding-left:8px }
.gyfa .bsor{ padding-top:4px; padding-bottom:4px }
.gyfa .m2{ margin-left:16px; border-left:1px dotted var(--line); padding-left:8px }
.gysor-cim{ font-size:11px; color:var(--faint); margin:2px 0 4px }
.gylab{ display:flex; align-items:center; gap:10px; flex-wrap:wrap; margin:4px 0 2px; font-size:12px; color:var(--dim) }
.gylab .gyszam{ color:var(--ink); font-weight:600 }
.gyjel{ font-size:10.5px; padding:0 6px; border-radius:999px; background:rgba(154,106,17,.16); color:var(--brass); font-weight:600; white-space:nowrap }
.priorcimke{ font-size:11px; color:var(--faint); letter-spacing:.02em; margin-right:2px; white-space:nowrap }
.pbub .pkeszlet{ margin-top:7px; padding-top:6px; border-top:1px solid var(--line); font-size:11px; color:var(--dim) }
.pbub .pkeszlet b{ color:var(--ink) }

/* t68: erosebb kontraszt a csoportfejlecben es a fa alatti sorokban
   (a fejleszto kerese: a betuk es ikonok halvanyak voltak). A piros
   torles marad a legerosebb elem. */
:host([data-tema="pult"]) .bfej .bcsuk,
:host([data-tema="pult"]) .bfej .bmozgat{ color:#5b4527; border-color:#a68a5f }
:host([data-tema="pult"]) .bfej .prior-sorszam{ color:#5b4527; font-weight:700 }
:host([data-tema="pult"]) .bfej .priorcimke{ color:#5b4527 }
:host([data-tema="pult"]) .bfej .datum{ color:#5b4527 }
:host([data-tema="pult"]) .gyfa .gysor-cim,
:host([data-tema="pult"]) .gyfa .gylab{ color:#4a3b28 }
:host([data-tema="pult"]) .gyfa .gylab .gyszam{ color:#2b2119 }
.gyjelh{ font-size:10.5px; padding:0 6px; border-radius:999px; background:rgba(168,58,32,.14); color:var(--rust); font-weight:600; white-space:nowrap }

/* t42: MASOK KERESEI. A Kinalat sora plusz egy "Nalam" oszlop. A meglevo
   alapszabalyokat nem nevezzuk at, csak uj osztalyt teszunk melle. */
.mkfej2, .mksor{ display:grid; align-items:center; gap:6px;
  grid-template-columns:30px minmax(0,1fr) 44px 60px 62px 48px 150px }
.mksor .mnalam{ text-align:right; white-space:nowrap }
.mksor .mnalam.van{ color:var(--green); font-weight:700 }
.fsor .fkerjel, .lsor .fkerjel{ font-size:10.5px; padding:0 6px; margin-left:5px; border-radius:999px;
  background:rgba(47,102,144,.14); color:var(--vart2); font-weight:600; white-space:nowrap }
:host([data-tema="pult"]) .mjel{top:2px}

/* t53: a teglalap arnyeka helyett a lathato keret konturja vet arnyekot.
   A t52 kulon hatter- es keretretegei visszavonva. */
:host([data-tema="pult"]) .frame{
 box-shadow:none;
 filter:drop-shadow(0 6px 8px rgba(0,0,0,.45));
}

/* t71: jovahagyott nativ csoportsav, csak megjelenes. */
:host([data-tema="pult"]) .bfej :is(.bcsuk,.bplusz,.bmozgat,.btorol){
 width:22px;min-width:22px;height:20px;flex:0 0 22px;padding:0;
 display:inline-flex;align-items:center;justify-content:center;box-sizing:border-box;
 border:3px solid transparent;border-image:var(--tw-button) 6 / 3px stretch;
 background:#4b321b var(--tw-button-middle) center / auto 100% repeat-x;
 color:#f5e6c2;font-family:Arial,sans-serif;font-size:11px;font-weight:bold;line-height:1;
 border-radius:0;box-shadow:none;text-shadow:0 1px #23150c;
}
:host([data-tema="pult"]) .bfej .bplusz{font-size:15px}
:host([data-tema="pult"]) .bfej .btorol{color:#efa98e;font-size:16px}
:host([data-tema="pult"]) .bfej .bmozgat:disabled{opacity:.5;filter:grayscale(.6);color:#d5c6a3}
:host([data-tema="pult"]) .bfej .priorcimke{font-weight:400}
:host([data-tema="pult"]) .bfej .bmozgat:disabled{background:#4b321b var(--tw-button-middle) center / auto 100% repeat-x;border-color:transparent}

:host([data-tema="pult"]) .bfej .bnevSzerk{font-size:14px;line-height:18px}
:host([data-tema="pult"]) .bfej .prior-sorszam{font-size:11px;line-height:18px}
:host([data-tema="pult"]) .bfej .priorcimke{font-size:12px;line-height:18px}
:host([data-tema="pult"]) .bfej .datum{font-size:11px;line-height:18px}

:host([data-tema="pult"]) .bfej :is(.prior-sorszam,.priorcimke,.datum){color:#382510}
:host([data-tema="pult"]) .bfej :is(.bcsuk,.bplusz,.bmozgat,.btorol):hover:not(:disabled){
 background:#4b321b var(--tw-button-middle) center / auto 100% repeat-x;
 border-color:transparent;color:#fff1ce;filter:brightness(1.16);
}
:host([data-tema="pult"]) .bfej .btorol:hover{color:#ffc1aa}
:host([data-tema="pult"]) .bfej :is(.bcsuk,.bplusz,.bmozgat,.btorol):focus-visible{
 outline:2px solid #503515;outline-offset:2px;
}

/* t80: Vetel / Kereseim */
.krkereso{ margin:2px 0 8px }
.krallapot{ flex:1 1 0; min-width:0; white-space:normal; overflow-wrap:anywhere }
.krkereso .jlista{ max-height:260px; overflow:auto }
.krsav{ padding-left:12px; margin:0 0 8px }
.krsav-cim{ font-weight:700; margin:0 0 8px; display:flex; gap:10px; align-items:baseline; flex-wrap:wrap; color:var(--ink) }
.krsav-cim .halvany{ font-weight:400 }
.krpenz{ display:block; font-size:11px; color:var(--dim); margin-top:2px }
.krpenz:empty{ display:none }
/* t82: Eladas / Keszletem: varos a nezetsorban, sorrend gombpar */
.nezetsor.nsflex{ display:flex; align-items:center; justify-content:space-between; gap:8px; flex-wrap:wrap }
.nsvaros{ margin-left:auto; font-size:12px; color:var(--dim) }
.ehely .esorrend{ margin:0 }
/* t83: "keresre" jel az Atvetel / Eladasaim nezetben */
.kerjel{ display:inline-block; margin-left:5px; padding:0 5px; font-size:10px; line-height:15px; border:1px solid #87946a;
  color:var(--green); background:rgba(216,223,188,.6); border-radius:2px; vertical-align:1px; flex:none; white-space:nowrap }
/* t86: futo ajanlatok csoportja a Licitjeimben, ajanlat a Kereseimben */
.lach{ display:flex; align-items:center; gap:8px }
.kall{ font-size:11.5px; color:var(--dim); line-height:1.25 }
.krsor .aelado{ white-space:normal }
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
        bubMutat(elem, munkaBuborek(f));
    }
    /* t26: ugyanez a buborek szolgal ki mas tartalmat is (odaut). */
    function bubMutat(elem, html) {
        if (!bubElem || !bubElem.isConnected) {
            bubElem = document.createElement("div");
            bubElem.className = "mbub";
            gyoker.appendChild(bubElem);
        }
        bubElem.innerHTML = html;
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

    /* -----------------------------------------------------------------
       TARGYBUBOREK a piaci listakban (Kinalat, Licitjeim, Atvetel).
       A jatek SAJAT tetelbuboreka. Mert (konzol, t12): a jatek kozos
       egerfigyeloje a Shadow DOM miatt csak a gazdaelemet latja, de a
       gazdaelemre kotott buborekot megjeleniti. Ezert amikor az eger egy
       ikonra er, a gazdaelemre az adott targy ItemPopup-jat kotjuk
       (bindTo = $(el).addMousePopup(popup)), amikor elhagyja, levesszuk
       (removeMousePopup). Ikonrol ikonra valtas is mukodik (mert).
       ----------------------------------------------------------------- */
    const targyBubTar = new Map();
    let targyBubAktiv = null;
    let egerX = null, egerY = null;

    /* Ujrarajzolas utan az eger alatt uj elem all; ha ikon, visszarakjuk,
       hogy a buborek ne tunjon el mozgatas nelkul. */
    function targyBubRajzolUtan() {
        targyBubLe();
        if (egerX == null || !gyoker || typeof gyoker.elementFromPoint !== "function") return;
        requestAnimationFrame(() => {
            try {
                if (egerX == null || !latszik) return;
                const el = gyoker.elementFromPoint(egerX, egerY);
                const m = el && el.closest && el.closest("[data-megj]");
                if (m) { megjBubFel(m.getAttribute("data-megj")); return; }
                const i = el && el.closest && el.closest("[data-iid]");
                if (i) targyBubFel(i.getAttribute("data-iid"));
            } catch (e) { /* nem baj */ }
        });
    }

    function megjJelHTML(megj) {
        return megj
            ? `<span class="mjel" data-megj="${esc(megj)}" aria-label="Megjegyz\u00E9s: ${esc(megj)}">!</span>`
            : `<span class="mjel-ures" aria-hidden="true"></span>`;
    }

    /* A megjegyzest ugyanugy a gazdaelemre kotott jatekbuborek mutatja,
       mint a targyat; itt a szoveg egy sima MousePopup. */
    function megjBubFel(szoveg) {
        const kulcs = "m:" + szoveg;
        if (targyBubAktiv === kulcs || !host) return;
        targyBubLe();
        try {
            const J = jatek();
            const jq = J.jQuery || J.$;
            if (typeof J.MousePopup !== "function" || !jq) return;
            jq(host).addMousePopup(new J.MousePopup(esc(szoveg)));
            targyBubAktiv = kulcs;
        } catch (e) { targyBubAktiv = null; }
    }

    function targyBubIkonHTML(itemId, kep) {
        const a = ` data-iid="${esc(String(itemId))}"`;
        return kep
            ? `<img src="${esc(kep)}" alt=""${a}>`
            : `<span class="kikon" aria-hidden="true"${a}></span>`;
    }

    function targyBubLe() {
        if (targyBubAktiv == null || !host) return;
        targyBubAktiv = null;
        try {
            const J = jatek();
            const jq = J.jQuery || J.$;
            if (jq) jq(host).removeMousePopup();
        } catch (e) { /* nem baj */ }
    }

    function targyBubFel(itemId) {
        const kulcs = String(itemId);
        if (targyBubAktiv === kulcs || !host) return;
        targyBubLe();
        try {
            const J = jatek();
            if (typeof J.ItemPopup !== "function") return;
            let pop = targyBubTar.get(kulcs);
            if (!pop) {
                const it = itemObj(kulcs);
                if (!it) return;
                pop = new J.ItemPopup(it);
                /* A tar ne nojon a vegtelensegig. */
                if (targyBubTar.size > 300) targyBubTar.clear();
                targyBubTar.set(kulcs, pop);
            }
            pop.bindTo(host);
            targyBubAktiv = kulcs;
        } catch (e) { targyBubAktiv = null; }
    }

    let arBubElem = null;
    function piacPenzKiiras(v) {
        return Number(v) > 0 ? "$" + Math.round(Number(v)).toLocaleString("hu-HU") : "-";
    }

    /* t72: a buborekban a TELJES taska darabszama is latszik (a fejleszto
       kerese, a 4. mockup-valtozat). Ez nem a feladathoz rendelt mennyiseg:
       a soron az all, itt az osszes darab. Ha a taska meg nem olvashato,
       a sor kimarad. */
    function piacKeszletSor(id) {
        const db = keszlet(id);
        if (db == null) return "";
        return "<div class=\"pkeszlet\">A t\u00E1sk\u00E1dban: <b>" + kinalatSzam(db) + " db</b></div>";
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
          "</div>" + piacKeszletSor(id);
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
        /* t76: a feladatsor is a fa megfogalmazasat hasznalja (a fejleszto
           jovahagyasaval; korabban "meg N ora munka"). */
        const m = x.match(/^meg (\d+) ora munka$/);
        return m ? "kb. " + m[1] + " munka\u00F3ra h\u00E1tra" : x;
    }

    function statIconHTML(id, osztaly) {
        const kep = targyIkon(id);
        const c = osztaly ? ` class="${esc(osztaly)}"` : "";
        return kep
            ? `<img${c} src="${esc(kep)}" alt="" loading="lazy" onerror="this.style.visibility='hidden'">`
            : `<i${c} aria-hidden="true"></i>`;
    }

    function itemSorHTML(f, elosztas, terv) {
        const a = sorAdat(f, elosztas, terv);
        a.gy = terv ? terv.get(String(f.kulcs)) : null;
        const kep = targyIkon(f.id);
        const nev = kijelzoSzoveg(targyNev(f.id));
        /* A munka nevet az ikon buboreka mutatja, a sorba nem irjuk ki. */
        const also = a.vanMunka || (a.gy && (a.gy.gyarthato || a.gy.masProf)) ? "" : "gy\u00E1rtott term\u00E9k";

        let oraC = "";
        if (a.piacon) oraC = `<span class="ora kesz">piacon</span>`;
        else if (a.oi.szoveg === "kesz") oraC = `<span class="ora kesz">k\u00E9sz</span>`;
        else if (a.oi.szoveg === "nem elerheto") oraC = `<span class="ora baj">nem el\u00E9rhet\u0151</span>`;
        else if (a.oi.szoveg) oraC = `<span class="ora">${esc(oraKiiras(a.oi.szoveg))}</span>`;
        /* A gyarthato termek jele es a recept allapota. */
        let gyC = "";
        if (a.gy && a.gy.gyarthato && a.gy.nincsLista) {
            gyC = `<span class="gyjel">gy\u00E1rthat\u00F3</span>`
                + (gyartMennyiMegy(a.gy) > 0 ? ` &middot; a Gy\u00E1rt\u00E1s gomb bet\u00F6lti a receptjeidet` : "");
        } else if (a.gy && a.gy.gyarthato) {
            gyC = a.gy.tanult
                ? `<span class="gyjel">gy\u00E1rthat\u00F3</span>`
                : `<span class="gyjelh">recept kell</span>${a.gy.tekercs ? " &middot; " + esc(a.gy.tekercs) : ""}${gyartSzintHTML(a.gy.id)}`;
            if (a.gy.tanult && a.gy.zarolt) gyC += ` &middot; <span class="kvhiba">z\u00E1rolva</span>`;
        } else if (a.gy && a.gy.masProf) {
            const mindMegvan = a.gy.alanyagok.length && a.gy.alanyagok.every(x => x.hianyzo <= 0);
            gyC = `<span class="gyjelh">m\u00E1s mesters\u00E9g</span> &middot; `
                + (a.gy.hianyzo <= 0 ? "megvan"
                   : mindMegvan ? `<b>minden hozz\u00E1val\u00F3 megvan</b>, \u00E1tadhat\u00F3: ${esc(a.gy.masProf)}`
                   : `${esc(a.gy.masProf)} gy\u00E1rtja &middot; a hozz\u00E1val\u00F3kat te gy\u0171jt\u00F6d`);
        }
        const alsor = (gyC || also || oraC) ? `<div class="alsor">${gyC ? gyC + (also || oraC ? " &middot; " : "") : ""}${also ? also + " &middot; " : ""}${oraC}</div>` : "";

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
              <button class="gomb piacb" data-piac="${esc(f.kulcs)}" title="Megnyitás az Eladás fülön, a feladat mennyiségével és címzettjével">Piacra &#9656;</button>
              <div class="piac-arbox" title="Piaci egységár darabonként">
                <div class="piac-arsor"><span>$</span><input class="piacArMezo" data-piac-ar="${esc(f.kulcs)}" inputmode="decimal" value="${esc(arValue)}" aria-label="${esc(nev)} piaci egységára"><span>/db</span></div>
              </div>
            </div>`;
        }
        else if (a.vanMunka) gomb = `<button class="gomb munkab" data-munka="${esc(f.id)}">Munk\u00E1ra &#9656;</button>`;
        else if (a.gy && a.gy.masProf) gomb = "";
        else if (a.gy && a.gy.gyarthato && a.gy.nincsLista) gomb = gyartBetoltoGomb(a.gy);
        else if (a.gy && a.gy.gyarthato && !a.gy.tanult) gomb = `<button class="gomb gyart" disabled title="A recept nincs meg.">Gy\u00E1rt\u00E1s &#9656;</button>`;
        else if (a.gy && a.gy.gyarthato && a.gy.tanult) {
            const megy = gyartMennyiMegy(a.gy);
            gomb = megy > 0 && !a.gy.zarolt
                ? `<button class="gomb munkab" data-gyart="${esc(f.id)}" data-gyart-db="${megy}">Gy\u00E1rt\u00E1s (${megy}) &#9656;</button>`
                : `<button class="gomb gyart" disabled title="${esc(a.gy.zarolt ? "A recept z\u00E1rolva van." : "Nincs el\u00E9g alapanyag.")}">Gy\u00E1rt\u00E1s &#9656;</button>`;
        }
        else gomb = `<button class="gomb gyart" disabled title="Nincs munka ehhez a term\u00E9khez">gy\u00E1rtott</button>`;

        /* A terméknév információs mező, nem műveleti gomb. A korábbi
           data-piac/role=button itt azt eredményezhette, hogy a névre
           kattintás piaci vagy gyártási műveletet indított. */
        /* t73: a buborek csak a NEVRE mutatva jojjon elo, ne az egesz soron.
           A nev eddig blokkszintu div volt, tehat a sor teljes szelesseget
           elfoglalta, es a nev melletti ures hely is elinditotta. Most a
           szoveg sajat, soron belüli elemben all, igy a buborek a nev vegenel
           nyilik. */
        const nevMezo = `<div class="nev"><span class="itemArNev" data-piac-info="${esc(f.id)}" tabindex="0"
          title="R\u00E1mutat\u00E1sra: a t\u00E1rgy k\u00E9t \u00E1ra">${esc(nev)}</span></div>`;

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
        /* t81: a Kereseim mezoi (kr...) a sajat allapotukbol rajzolodnak;
           a visszairas a regi szoveget hozta vissza a keresobe. */
        if (el.id && el.id.indexOf("kr") === 0) return "";
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
        if (!gyoker) return false;
        /* Az Eladas feladasi savjaban gepeles kozben sem rajzolunk ujra. */
        if (beall.ful === "piac" && eladSavFokuszban()) return true;
        if (beall.ful === "vetel" && kerSavFokuszban()) return true;
        return !!gyoker.querySelector(".kellEdit, .bnevEdit");
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
                    " Minta: 188 [item=757000]", true);
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
            allapotSzoveg("Előbb add meg, kinek gyűjtöd a tételeket.", true);
            return true;
        }
        if (input.id === "fTargy" && p.cimzett && p.cimzett !== nev) {
            allapotSzoveg(`A gyorslista a(z) ${p.cimzett} címzetthez készült. A biztonság kedvéért nem vittem fel.`, true);
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

    /* A fulek kozos fejlece, a FULAK listabol. Ugyanaz a stage-en belul all
       minden nezetben, igy a meglevo felszinAllapot es felszinVissza
       valtozatlanul mukodik tovabb. */
    /* t34: az alairas minden fulon ott van, nem csak a Beszerzoken. */
    const ALAIRAS_HTML = `<div class="alairas" aria-label="Crafted with heart by smcZ">Crafted with <span class="sziv" aria-hidden="true">♥</span> by smcZ</div>`;

    function fulSorHTML() {
        return `
          <div class="fulsor" role="tablist">${FULAK.map(f => {
              const a = f.kulcs === beall.ful;
              return `
            <button type="button" class="ful${a ? " aktiv" : ""}" data-ful="${f.kulcs}" role="tab"
              aria-selected="${a ? "true" : "false"}">${f.cimke}</button>`;
          }).join("")}
          </div>`;
    }

    /* A fulon beluli nezetkapcsolo. Az Eladas ful kategoriagombjainak
       megjeleneset hasznalja (pkatvalaszto), igy mindharom temaban
       ugyanugy nez ki. */
    function aktNezet() {
        const lista = NEZETEK[beall.ful];
        if (!lista) return null;
        return lista.find(n => n.kulcs === beall.nezet[beall.ful]) || lista[0];
    }

    function nezetSorHTML() {
        const lista = NEZETEK[beall.ful];
        if (!lista) return "";
        const akt = aktNezet();
        const varos = beall.ful === "piac" && akt.kulcs === "keszletem";
        return `
          <div class="nezetsor${varos ? " nsflex" : ""}">
            <span class="pkatvalaszto" role="group" aria-label="N\u00E9zet">${lista.map(n => {
                const a = n.kulcs === akt.kulcs;
                return `<button type="button" class="pkat${a ? " aktiv" : ""}" data-nezet="${n.kulcs}"
                aria-pressed="${a ? "true" : "false"}">${n.cimke}${nezetJel(beall.ful, n.kulcs)}</button>`;
            }).join("")}</span>${varos ? `
            <span class="nsvaros" id="eladVaros">${eladVarosHTML()}</span>` : ""}
          </div>`;
    }

    /* Kis jel a nezetgombon: hol var atveheto tetel. Semmit nem vesz at. */
    function nezetJel(ful, kulcs) {
        if (ful === "vetel" && kulcs === "kereseim") {
            const n = kerek.allapot === "kesz" ? kerFutoSorok().length : 0;
            return n ? ` <span class="njel">(${n})</span>` : "";
        }
        if (ful !== "atvetel") return "";
        const t = atvetelTetelek(kulcs);
        if (!t.length) return "";
        if (kulcs === "eladasaim") {
            const p = t.filter(atvPenzE).reduce((n, x) => n + atvOsszeg(x), 0);
            if (p > 0) return ` <span class="njel kvez">+${kinalatSzam(p)} $</span>`;
        }
        return ` <span class="njel">(${t.length})</span>`;
    }

    function nezetKotes() {
        gyoker.querySelectorAll(".nezetsor [data-nezet]").forEach(g => {
            g.addEventListener("click", () => {
                const lista = NEZETEK[beall.ful];
                const k = g.getAttribute("data-nezet");
                if (!lista || !lista.some(n => n.kulcs === k)) return;
                if (beall.nezet[beall.ful] === k) return;
                beall.nezet[beall.ful] = k;
                /* A Licitjeim es az Atvetel nezetei kozos uzenetsort hasznalnak;
                   nezetvaltaskor a masik nezet uzenete ne maradjon kint. */
                licitNezet.uzenet = "";
                licitNezet.uzenetHiba = false;
                beallMent();
                nyitasFrissit();
                rajzol();
            });
        });
    }

    /* -----------------------------------------------------------------
       VETEL / KINALAT - LETOLTES (t4).
       MERT tenyek (2026-09-15, lehallgato):
         building_market / search, a natív ablak pontos parameterei;
         reszletenkent 31 sor, az elso nav "first" page 1, a tobbi
         nav "next" es eggyel nagyobb page; a vegen next: false.
       Csak olvas, penzt nem kolt. Egyszerre egy hivas megy, a reszletek
       kozott KINALAT_SZUNET szunettel. Az ismetlodo sorokat a
       market_offer_id SZOVEGKENT szuri, mert a fetch_bids szovegkent,
       a search szamkent adja.
       ----------------------------------------------------------------- */
    /* 100 ms: a fejleszto dontese (2026-09-15), kesobb vissza kell kerdezni,
       elfogadja-e. A 300 ms-os valtozat 12 reszletnel 4,0 mp volt. */
    const KINALAT_SZUNET = 100;
    const KINALAT_MAX_RESZLET = 50;
    const KINALAT_IDOKORLAT = 15000;

    const kinalat = {
        allapot: "ures",   /* ures | tolt | kesz | hiba | csonka */
        sorok: [],
        reszlet: 0,
        dupla: 0,
        uzenet: "",
        kezd: 0,
        veg: 0,
        futas: 0,
        ido: 0,           /* a LATHATO lista ideje, a lejarat ehhez merve */
        tolIdo: 0,        /* a legutobb letoltott reszlet ideje */
        regi: null        /* rendezett nezetnel frissites kozben ez latszik */
    };

    /* A nezet allapota. Nem kerul tarolba, a munkamenet vegeig el. */
    const kinalatNezet = { kereses: "", kategoria: "mind", rendez: null, irany: 1, fuggo: false,
                           valasztott: null, mesterseg: null };

    /* MESTERSEGSZURO A RECEPTEKHEZ (t20).
       MERT (2026-09-16, konzol): ItemManager.getAll() 8752 targy, ebbol
       228 recept; a receptben profession (nev), profession_id, min_level.
       profession_id 1 Tabori szakacs, 2 Sarlatan, 3 Kovacs, 4 Istallomester,
       mindegyiknek 57 receptje, min_level 0-950; mesterseg nelkuli recept nincs.
       A felirat a jatek sajat profession szovegebol jon; ha nem olvashato,
       a mert nevek allnak. */
    const MESTERSEG_TARTALEK = { 1: "T\u00E1bori szak\u00E1cs", 2: "Sarlat\u00E1n", 3: "Kov\u00E1cs", 4: "Ist\u00E1ll\u00F3mester" };
    let mestersegNevek = null;
    function mestersegLista() {
        if (!mestersegNevek) {
            const m = Object.assign({}, MESTERSEG_TARTALEK);
            try {
                const all = jatek().ItemManager.getAll() || {};
                Object.keys(all).forEach(k => {
                    const x = all[k];
                    if (x && x.type === "recipe" && m[x.profession_id] && x.profession) m[x.profession_id] = String(x.profession);
                });
                mestersegNevek = m;
            } catch (e) { return Object.keys(m).map(id => ({ id: Number(id), nev: m[id] })); }
        }
        return Object.keys(mestersegNevek).map(id => ({ id: Number(id), nev: mestersegNevek[id] }));
    }
    function receptAdat(itemId) {
        const it = itemObj(itemId);
        if (!it || (it.getType ? it.getType() : it.type) !== "recipe") return null;
        return { mes: Number(it.profession_id) || 0, szint: Number(it.min_level) };
    }
    /* A szint szerinti sorrend akkor el, ha Recept nezetben mesterseg van
       kivalasztva es a fejlecben nincs mas rendezes. */
    function kinalatSzintRend() {
        return !kinalatNezet.rendez && kinalatNezet.kategoria === "recept" && !!kinalatNezet.mesterseg;
    }
    function kinalatRendAktiv() {
        return !!kinalatNezet.rendez || kinalatSzintRend();
    }

    function kinalatParam(oldal) {
        return {
            pattern: "", nav: oldal === 1 ? "first" : "next", page: oldal,
            sort: "bid", order: "asc", type: "",
            level_range_min: "0", level_range_max: "",
            usable: false, has_effect: false, visibility: 2,
            direction_sell: true, direction_buy: false
        };
    }

    function kinalatAllapotSzoveg() {
        const k = kinalat;
        const mp = k.veg && k.kezd ? ((k.veg - k.kezd) / 1000).toFixed(1).replace(".", ",") : "";
        const dupla = `Kisz\u0171rt ism\u00E9tl\u0151d\u00E9s: ${k.dupla}.`;
        switch (k.allapot) {
            case "tolt":
                return (kinalatRendAktiv()
                    ? (k.regi ? "(Az el\u0151z\u0151 lista l\u00E1tszik, az \u00FAj a v\u00E9g\u00E9n cser\u00E9l\u0151dik.) "
                              : "(A rendez\u00E9s a bet\u00F6lt\u00E9s v\u00E9g\u00E9n \u00E1ll be.) ")
                    : "") + `Bet\u00F6lt\u00E9s: ${k.reszlet + 1}. r\u00E9szlet, eddig ${k.sorok.length} aj\u00E1nlat\u2026`;
            case "kesz":
                return `K\u00E9sz: ${k.sorok.length} aj\u00E1nlat, ${k.reszlet} r\u00E9szlet, ${mp} mp. ${dupla}`;
            case "csonka":
                return `Meg\u00E1llt ${k.reszlet} r\u00E9szletn\u00E9l, a lista NEM teljes (${k.sorok.length} aj\u00E1nlat). ${dupla}`;
            case "hiba":
                return `Hiba a ${k.reszlet + 1}. r\u00E9szletn\u00E9l: ${k.uzenet}`
                    + (k.sorok.length ? ` Addig ${k.sorok.length} aj\u00E1nlat j\u00F6tt le.` : "");
            default:
                return "M\u00E9g nincs let\u00F6ltve.";
        }
    }

    /* Csak az allapotsort irja at, ha latszik. Betoltes kozben nem rajzolunk
       ujra mindent, hogy a panel ne ugraljon. */
    function kinalatKiir() {
        const el = gyoker && gyoker.getElementById("kinalatAllapot");
        if (el) el.textContent = kinalatAllapotSzoveg();
    }

    /* A vegen NEM rajzolunk ujra mindent: a keresomezoben allo kurzor es a
       gorgetes maradjon. Csak az allapotsor, a gomb, es ha kozben rendezest
       kertek, a lista torzse frissul. */
    function kinalatVege(futas) {
        if (futas !== kinalat.futas) return;
        kinalat.veg = Date.now();
        if (kinalat.regi) {
            kinalat.regi = null;
            kinalat.ido = kinalat.tolIdo || kinalat.ido;
            kinalatNezet.fuggo = true;
        }
        kinalatKiir();
        const g = gyoker && gyoker.querySelector("[data-kinalat-friss]");
        if (g) g.disabled = false;
        if (kinalatNezet.fuggo) {
            kinalatNezet.fuggo = false;
            kinalatListaUjra();
        }
        kinalatUresJelzes();
    }

    function kinalatTolt() {
        if (kinalat.allapot === "tolt") return;
        const A = jatek().Ajax;
        const futas = ++kinalat.futas;
        kinalat.allapot = "tolt";
        /* Rendezett nezetnel az uj lista csak a vegen rendezheto, ezert
           addig a regi marad lathato, hogy ne legyen ures a panel. */
        kinalat.regi = kinalatRendAktiv() && kinalat.sorok.length ? kinalat.sorok : null;
        kinalat.sorok = [];
        kinalat.reszlet = 0;
        kinalat.dupla = 0;
        kinalat.uzenet = "";
        kinalat.kezd = Date.now();
        kinalat.veg = 0;
        const lattam = new Set();

        if (!A || typeof A.remoteCall !== "function") {
            kinalat.allapot = "hiba";
            kinalat.uzenet = "a j\u00E1t\u00E9k Ajax.remoteCall h\u00EDv\u00E1sa nem \u00E9rhet\u0151 el.";
            kinalatVege(futas);
            return;
        }

        function kovetkezo(oldal) {
            if (futas !== kinalat.futas) return;
            if (oldal > KINALAT_MAX_RESZLET) {
                kinalat.allapot = "csonka";
                kinalatVege(futas);
                return;
            }
            let megjott = false;
            const ora = setTimeout(() => {
                if (megjott || futas !== kinalat.futas) return;
                megjott = true;
                kinalat.allapot = "hiba";
                kinalat.uzenet = "nem j\u00F6tt v\u00E1lasz " + (KINALAT_IDOKORLAT / 1000) + " m\u00E1sodpercen bel\u00FCl.";
                kinalatVege(futas);
            }, KINALAT_IDOKORLAT);

            try {
                A.remoteCall("building_market", "search", kinalatParam(oldal), valasz => {
                    if (megjott || futas !== kinalat.futas) return;
                    megjott = true;
                    clearTimeout(ora);
                    const msg = valasz && valasz.msg;
                    if (!valasz || valasz.error || !msg || !Array.isArray(msg.search_result)) {
                        kinalat.allapot = "hiba";
                        kinalat.uzenet = (valasz && typeof valasz.msg === "string" && valasz.msg)
                            || "v\u00E1ratlan v\u00E1lasz a szervert\u0151l.";
                        kinalatVege(futas);
                        return;
                    }
                    kinalat.reszlet = oldal;
                    kinalat.tolIdo = Date.now();
                    if (!kinalat.regi) kinalat.ido = kinalat.tolIdo;
                    const ujak = [];
                    msg.search_result.forEach(sor => {
                        const kulcs = String(sor && sor.market_offer_id);
                        if (lattam.has(kulcs)) { kinalat.dupla++; return; }
                        lattam.add(kulcs);
                        kinalat.sorok.push(sor);
                        ujak.push(sor);
                    });
                    kinalatHozzafuz(ujak);
                    if (msg.next) {
                        kinalatKiir();
                        setTimeout(() => kovetkezo(oldal + 1), KINALAT_SZUNET);
                    } else {
                        kinalat.allapot = "kesz";
                        kinalatVege(futas);
                    }
                });
            } catch (e) {
                if (megjott) return;
                megjott = true;
                clearTimeout(ora);
                kinalat.allapot = "hiba";
                kinalat.uzenet = "a h\u00EDv\u00E1s kiv\u00E9telt dobott: " + (e && e.message ? e.message : e);
                kinalatVege(futas);
            }
        }

        kinalatKiir();
        kovetkezo(1);
    }

    /* KINALAT LISTA (t5).
       Egysegar = azonnali ar / darab; ha nincs azonnali ar, a licit.
       Az alap sorrend a szervere (nincs nyil a fejlecen). A fejlecre
       kattintva: novekvo, csokkeno, vissza az alapra. */
    function kinalatEgysegAr(s) {
        const db = Math.max(1, Number(s.item_count) || 1);
        const ar = s.max_price != null ? Number(s.max_price) : kinalatLicit(s);
        return ar != null && isFinite(ar) ? ar / db : null;
    }
    function kinalatLicit(s) {
        if (s.current_bid != null) return Number(s.current_bid);
        if (s.auction_price != null) return Number(s.auction_price);
        return null;
    }
    /* Hatralevo masodperc, az utolso reszlet idejehez merve. */
    /* A megfigyelt sorok ideje a sajat lekereshez merodik (t36). */
    function figyeloSorE(s) { return figyelo.sorok.indexOf(s) >= 0; }
    function kinalatHatra(s) {
        const alap = Number(s.auction_ends_in);
        if (!isFinite(alap)) return null;
        const alapIdo = figyeloSorE(s) ? figyelo.ido : kinalat.ido;
        return alap - (Date.now() - (alapIdo || Date.now())) / 1000;
    }
    /* MERT (2026-09-15): GameMap.calcWayTime(honnan, hova) ket {x, y}
       pontot var, masodpercet ad; 1072,9 = a jatekban 00:17:52. */
    function kinalatOdaut(s) {
        try {
            const J = jatek();
            const p = J.Character && J.Character.position;
            if (!p || !J.GameMap || typeof J.GameMap.calcWayTime !== "function") return null;
            const t = J.GameMap.calcWayTime(p, { x: Number(s.market_town_x), y: Number(s.market_town_y) });
            return isFinite(t) ? t : null;
        } catch (e) { return null; }
    }
    function kinalatSzam(v) {
        return v != null && isFinite(v) ? Math.round(v).toLocaleString("hu-HU") : "-";
    }
    function kinalatIdo(mp) {
        if (mp == null) return "-";
        if (mp <= 0) return "lej\u00E1rt";
        const n = Math.floor(mp / 86400), o = Math.floor(mp % 86400 / 3600), p = Math.floor(mp % 3600 / 60);
        if (n > 0) return `${n}n ${o}\u00F3`;
        if (o > 0) return `${o}\u00F3 ${String(p).padStart(2, "0")}p`;
        return `${Math.max(1, p)}p`;
    }

    /* Teljes ido a nativ ablak modjara: oo:pp:mm, 0 oranal pp:mm. A
       calcWayTime tortet ad, a jatek lefele kerekit (1072,9 -> 17:52). */
    function teljesIdo(mp) {
        if (mp == null || !isFinite(mp)) return "-";
        const t = Math.max(0, Math.floor(mp));
        const o = Math.floor(t / 3600), p = Math.floor(t % 3600 / 60), m = t % 60;
        const k = n => String(n).padStart(2, "0");
        return (o > 0 ? k(o) + ":" : "") + k(p) + ":" + k(m);
    }

    const KINALAT_OSZLOPOK = [
        { kulcs: "nev", cimke: "T\u00E1rgy", jobb: false },
        { kulcs: "egyseg", cimke: "Egys\u00E9g\u00E1r", jobb: true },
        { kulcs: "azonnal", cimke: "Azonnal", jobb: true },
        { kulcs: "licit", cimke: "Licit", jobb: true },
        { kulcs: "lejar", cimke: "Lej\u00E1r", jobb: true },
        { kulcs: "elado", cimke: "Elad\u00F3", jobb: false, csoport: "nevhely" },
        { kulcs: "hely", cimke: "hely", jobb: false, csoport: "nevhely" }
    ];

    function kinalatRendezoErtek(s, kulcs) {
        switch (kulcs) {
            case "nev": return piacNormal(targyNev(s.item_id));
            case "egyseg": return kinalatEgysegAr(s);
            case "azonnal": return s.max_price != null ? Number(s.max_price) : null;
            case "licit": return kinalatLicit(s);
            case "lejar": return Number(s.auction_end_date);
            case "elado": return piacNormal(s.seller_name || "");
            case "hely": return kinalatOdaut(s);
            default: return null;
        }
    }

    function kinalatRendezett() {
        const k = kinalatNezet.rendez;
        const forras = kinalat.regi || kinalat.sorok;
        if (!k && kinalatSzintRend()) {
            /* Mesterseg szerint: szint novekvo, azonos szinten abc. */
            return forras
                .map((s, i) => { const r = receptAdat(s.item_id); return { s, i, sz: r && isFinite(r.szint) ? r.szint : Infinity, n: piacNormal(targyNev(s.item_id)) }; })
                .sort((a, b) => (a.sz - b.sz) || a.n.localeCompare(b.n, "hu") || (a.i - b.i))
                .map(x => x.s);
        }
        if (!k) return forras;
        const ir = kinalatNezet.irany;
        return forras
            .map((s, i) => ({ s, i, v: kinalatRendezoErtek(s, k) }))
            .sort((a, b) => {
                /* Ures ertek mindig a vegere, iranytol fuggetlenul. */
                const au = a.v == null || a.v === "", bu = b.v == null || b.v === "";
                if (au !== bu) return au ? 1 : -1;
                let d = 0;
                if (!au) d = typeof a.v === "string" ? a.v.localeCompare(b.v, "hu") : a.v - b.v;
                return d ? d * ir : a.i - b.i;
            })
            .map(x => x.s);
    }

    function kinalatLathatoE(s) {
        const q = piacNormal(kinalatNezet.kereses);
        if (q && !piacNormal(targyNev(s.item_id)).includes(q)) return false;
        if (kinalatNezet.kategoria !== "mind") {
            const it = itemObj(s.item_id);
            const tipus = it ? (it.getType ? it.getType() : it.type) : "";
            if (piacKategoria(tipus) !== kinalatNezet.kategoria) return false;
            if (kinalatNezet.kategoria === "recept" && kinalatNezet.mesterseg) {
                const r = receptAdat(s.item_id);
                if (!r || r.mes !== kinalatNezet.mesterseg) return false;
            }
        }
        return true;
    }

    function kinalatSorHTML(s) {
        const it = itemObj(s.item_id);
        const tipus = it ? (it.getType ? it.getType() : it.type) : "";
        const nev = targyNev(s.item_id);
        const kep = targyIkon(s.item_id);
        const db = Number(s.item_count) || 1;
        const odaut = kinalatOdaut(s);
        const megj = s.description ? String(s.description) : "";
        return `
          <div class="ksor2${kinalatNezet.valasztott === String(s.market_offer_id) ? " valasztott" : ""}"
            data-kid="${esc(s.market_offer_id)}" data-knev="${esc(piacNormal(nev))}" data-kkat="${esc(piacKategoria(tipus))}"
            data-kmes="${esc(String((receptAdat(s.item_id) || {}).mes || ""))}"
            ${kinalatLathatoE(s) ? "" : "hidden"}>
            ${targyBubIkonHTML(s.item_id, kep)}
            <div class="knev2 kn"><span class="knn">${esc(nev)}</span>${db > 1 ? `<span class="kdb">&times;${db}</span>` : ""}</div>
            <div class="jobb kegy">${kinalatSzam(kinalatEgysegAr(s))}</div>
            <div class="jobb kazon">${kinalatSzam(s.max_price)}</div>
            <div class="jobb${kinalatLicit(s) == null ? " halvany" : (s.is_highest_bidder ? " kvez" : " klic")}"${s.is_highest_bidder ? ' title="Te vezetsz"' : ""}>${s.is_highest_bidder ? "&#9733; " : ""}${kinalatSzam(kinalatLicit(s))}</div>
            <div class="jobb">${esc(kinalatIdo(kinalatHatra(s)))}</div>
            <div class="khely"><span>${megjJelHTML(megj)}${jatekosLinkHTML(s.seller_name, s.seller_player_id)}</span>
              <span class="kvaros">${megjJelHTML("")}${varosLinkHTML(s.market_town_name, s.market_town_x, s.market_town_y, odaut)}${odaut != null ? " &middot; " + (odaut > 0 ? odautLinkHTML(kinalatIdo(odaut), s.market_town_id, s.market_town_x, s.market_town_y, s.market_town_name, odaut) : "itt vagy") : ""}</span></div>
          </div>`;
    }

    /* Az utolso oszlop ket rendezheto felirat: az elado neve es a hely
       (odaut). A felirat a nev elejehez igazodik, a megjegyzesjel moge. */
    function kinalatFejlecHTML() {
        const gomb = o => {
            const a = kinalatNezet.rendez === o.kulcs;
            const nyil = a ? (kinalatNezet.irany > 0 ? " \u25B2" : " \u25BC") : "";
            return `<button type="button" class="krend${o.jobb ? " jobb" : ""}${a ? " aktiv" : ""}"
                  data-krend="${o.kulcs}">${o.cimke}${nyil}</button>`;
        };
        return `<div class="kfej2">
            <div></div>${KINALAT_OSZLOPOK.filter(o => !o.csoport).map(gomb).join("")}
            <div class="knevhely">${KINALAT_OSZLOPOK.filter(o => o.csoport === "nevhely").map(gomb).join(`<span class="kelv">,</span>`)}</div>
          </div>`;
    }

    /* Uj reszlet erkezett. Alap sorrendnel a lista aljara fuzzuk, ez a
       szerver sorrendje. Rendezett nezetnel a vegen rendezunk ujra, hogy a
       sorok ne mozogjanak gorgetes kozben. */
    function kinalatHozzafuz(ujak) {
        const lista = gyoker && gyoker.getElementById("kinalatLista");
        if (!lista || !ujak.length) return;
        if (kinalatRendAktiv()) { kinalatNezet.fuggo = true; return; }
        lista.insertAdjacentHTML("beforeend", ujak.map(kinalatSorHTML).join(""));
        kinalatUresJelzes();
    }

    function kinalatListaUjra() {
        const lista = gyoker && gyoker.getElementById("kinalatLista");
        if (!lista) return;
        const fent = lista.scrollTop;
        lista.innerHTML = kinalatRendezett().map(kinalatSorHTML).join("");
        kinalatSavFrissit();
        lista.scrollTop = fent;
        const fej = gyoker.querySelector(".kfej2");
        if (fej) { fej.outerHTML = kinalatFejlecHTML(); kinalatFejlecKotes(); }
        kinalatUresJelzes();
    }

    /* Szures ujrarajzolas nelkul, hogy a keresomezo foksza maradjon. */
    function kinalatSzur() {
        const q = piacNormal(kinalatNezet.kereses);
        const kat = kinalatNezet.kategoria;
        const mes = kat === "recept" && kinalatNezet.mesterseg ? String(kinalatNezet.mesterseg) : "";
        gyoker.querySelectorAll("#kinalatLista .ksor2").forEach(sor => {
            const jo = (!q || (sor.getAttribute("data-knev") || "").includes(q))
                && (kat === "mind" || sor.getAttribute("data-kkat") === kat)
                && (!mes || sor.getAttribute("data-kmes") === mes);
            sor.hidden = !jo;
        });
        if (kinalatNezet.valasztott) kinalatSavFrissit();
        kinalatUresJelzes();
    }

    function kinalatUresJelzes() {
        const ures = gyoker && gyoker.getElementById("kinalatUres");
        if (!ures) return;
        const van = !!gyoker.querySelector("#kinalatLista .ksor2:not([hidden])");
        ures.hidden = van || kinalat.allapot === "tolt" && !kinalat.sorok.length;
        ures.textContent = kinalat.sorok.length
            ? "Nincs a sz\u0171r\u00E9snek megfelel\u0151 aj\u00E1nlat."
            : (kinalat.allapot === "tolt" ? "" : "Nincs aj\u00E1nlat.");
    }


    /* -----------------------------------------------------------------
       VASARLAS A KINALATBOL (t7). EZ KOLT PENZT.
       MERT (atadas): building_market / bid
         { bidtype: 0, bid, market_offer_id, direction: "SELL" }
         valasz msg.instantBuy (true = megvette), msg.money, msg.deposit.
       A FEJLESZTO kozlese (2026-09-15): nincs licitlepcso, 1 $ is eleg;
       a fizetes elobb keszpenzbol, utana bankbol megy; sajat ajanlatra
       licitalni nem lehet.
       MERT (konzol): Character.money es Character.deposit a ket osszeg;
       a jatek a hibat MessageError, a sikert MessageSuccess ablakkal
       jelzi, a szerver hibaszoveget a msg adja.
       Semmi nem megy ki automatikusan: minden kuldes ket kattintas.
       ----------------------------------------------------------------- */
    let kinalatKuldes = false;

    function kinalatSorKeres(id) {
        return kinalat.sorok.find(x => String(x.market_offer_id) === String(id))
            || (kinalat.regi || []).find(x => String(x.market_offer_id) === String(id))
            || figyelo.sorok.find(x => String(x.market_offer_id) === String(id)) || null;
    }

    function kinalatPenz() {
        try {
            const C = jatek().Character;
            return { kp: Math.max(0, Number(C.money) || 0), bank: Math.max(0, Number(C.deposit) || 0) };
        } catch (e) { return { kp: 0, bank: 0 }; }
    }

    function kinalatMinLicit(s) {
        if (s.current_bid != null) return Math.floor(Number(s.current_bid)) + 1;
        if (s.auction_price != null) return Math.ceil(Number(s.auction_price));
        return null;
    }
    function kinalatMaxLicit(s) {
        return s.max_price != null ? Math.floor(Number(s.max_price)) - 1 : Infinity;
    }

    /* A fedezet szovege egy osszegre. Elobb keszpenz, utana bank. */
    function kinalatFedezet(osszeg) {
        const p = kinalatPenz();
        if (!(osszeg > 0)) return { jo: false, szoveg: "" };
        if (osszeg > p.kp + p.bank) return { jo: false, szoveg: "Kevés a pénz." };
        const bankbol = Math.max(0, osszeg - p.kp);
        return { jo: true, szoveg: bankbol > 0 ? `Ebből ${kinalatSzam(bankbol)} $ a bankból.` : "Kézpénzből." };
    }

    function kinalatSavHTML(s) {
        const hatra = kinalatHatra(s);
        const p = kinalatPenz();
        const penz = `Pénzed: ${kinalatSzam(p.kp)} $ kézben, ${kinalatSzam(p.bank)} $ bankban.`;
        if (hatra != null && hatra <= 0) {
            return `<div class="kvsav" id="kinalatSav"><p class="kvhiba">Az ajánlat lejárt, nem vásárolható.</p></div>`;
        }
        const hely = esc(s.market_town_name);
        const azonnal = s.max_price != null ? (() => {
            const f = kinalatFedezet(Number(s.max_price));
            return `
              <div class="kvdoboz">
                <h4>Azonnali vétel</h4>
                <div class="kvar">${kinalatSzam(s.max_price)} $</div>
                <div class="kvsor">A tárgy rögtön a tiéd, ${hely} piacán veheted át.</div>
                <div class="kvsor${f.jo ? "" : " kvhiba"}">${esc(f.szoveg)}</div>
                <button type="button" class="gomb kvgomb" data-kvvesz ${f.jo ? "" : "disabled"}>Megveszem ${kinalatSzam(s.max_price)} $-ért</button>
              </div>`;
        })() : "";
        const min = kinalatMinLicit(s);
        const max = kinalatMaxLicit(s);
        let licit = "";
        if (min != null && min <= max) {
            const jelen = s.current_bid != null
                ? `Jelenlegi licit: ${kinalatSzam(s.current_bid)} $${s.is_highest_bidder ? " (te vezetsz)" : ""}`
                : `Még nincs licit, kezdő licit: ${kinalatSzam(s.auction_price)} $`;
            licit = `
              <div class="kvdoboz">
                <h4>Licit</h4>
                <div class="kvsor">${jelen}</div>
                <div class="kvsor kvbe"><input type="text" inputmode="numeric" autocomplete="off" id="kvLicit" value="${kinalatSzam(min)}"> $
                  <span>legalább ${kinalatSzam(min)}${isFinite(max) ? `, legfeljebb ${kinalatSzam(max)}` : ""}</span></div>
                <div class="kvsor" id="kvLicitFedezet"></div>
                <button type="button" class="gomb kvgomb" data-kvlicit>Licitálok</button>
              </div>`;
        } else if (min != null) {
            licit = `<div class="kvdoboz"><h4>Licit</h4><div class="kvsor">A licit elérte az azonnali árat, már csak megvenni lehet.</div></div>`;
        }
        return `
          <div class="kvsav" id="kinalatSav">
            <div class="kvdobozok">${azonnal}${licit}</div>
            <div class="kvlab">${penz} Minden küldés két kattintás.
              ${figyeloSorE(s) ? "" : `<button type="button" class="gomb" data-kvfigyel style="margin-left:6px">Megfigyelem</button>`}</div>
          </div>`;
    }

    /* A mezo szoveges, hogy ezres tagolassal latszodjon (t36); olvasaskor
       a tagolas kikerul. */
    function licitErtek(be) {
        const nyers = String(be.value || "").replace(/[\s\u00A0\u202F]/g, "");
        return nyers === "" ? NaN : Number(nyers);
    }
    /* Gepeles kozben ujratagol, a kurzort a beirt szamjegyek szamahoz
       igazitva, hogy szerkesztes kozben ne ugorjon a vegere. */
    function licitMezoTagol(be) {
        const elotte = String(be.value || "");
        const hol = be.selectionStart == null ? elotte.length : be.selectionStart;
        const jegyek = elotte.slice(0, hol).replace(/\D/g, "").length;
        const szam = elotte.replace(/\D/g, "");
        const uj = szam === "" ? "" : kinalatSzam(Number(szam));
        if (uj === elotte) return;
        be.value = uj;
        let db = 0, i = 0;
        for (; i < uj.length && db < jegyek; i++) if (/\d/.test(uj[i])) db++;
        try { be.setSelectionRange(i, i); } catch (e) { /* nem baj */ }
    }
    function kinalatLicitEllenoriz(s, visszaallit) {
        const be = gyoker.getElementById("kvLicit");
        const cel = gyoker.getElementById("kvLicitFedezet");
        const gomb = gyoker.querySelector("[data-kvlicit]");
        if (!be || !gomb) return null;
        const v = licitErtek(be);
        const min = kinalatMinLicit(s), max = kinalatMaxLicit(s);
        let hiba = "";
        if (!Number.isInteger(v)) hiba = "Egész összeget írj.";
        else if (v < min) hiba = `Alacsony licit összeg, legalább ${kinalatSzam(min)} $.`;
        else if (v > max) hiba = `Ennyiért már megveheted azonnal (${kinalatSzam(s.max_price)} $).`;
        const f = hiba ? { jo: false, szoveg: hiba } : kinalatFedezet(v);
        if (cel) { cel.textContent = f.szoveg; cel.classList.toggle("kvhiba", !f.jo); }
        gomb.disabled = !f.jo || kinalatKuldes;
        /* Az osszeg valtozasa utan ujra meg kell erositeni. */
        if (visszaallit) kinalatMegerositesVissza(gomb);
        return f.jo ? v : null;
    }

    /* Ket lepes: az elso kattintas csak megerositest ker. */
    function kinalatMegerositesVissza(gomb) {
        if (!gomb || !gomb.dataset.eredeti) return;
        clearTimeout(Number(gomb.dataset.ora));
        gomb.textContent = gomb.dataset.eredeti;
        delete gomb.dataset.eredeti;
        gomb.classList.remove("kvbiztos");
    }
    function kinalatMegerosit(gomb, szoveg) {
        if (gomb.dataset.eredeti) { kinalatMegerositesVissza(gomb); return true; }
        gomb.dataset.eredeti = gomb.textContent;
        gomb.textContent = szoveg;
        gomb.classList.add("kvbiztos");
        gomb.dataset.ora = String(setTimeout(() => kinalatMegerositesVissza(gomb), 6000));
        return false;
    }

    /* t79: a kozos szabaly (uzenetIdozit); a mulo jelzes mar nem szamit. */
    function kinalatUzenet(szoveg, hiba, mulo, nativ) {
        kinalatNezet.uzenet = szoveg;
        kinalatNezet.uzenetHiba = !!hiba;
        const el = gyoker && gyoker.getElementById("kvUzenet");
        if (el) { el.textContent = szoveg; el.classList.toggle("kvhiba", !!hiba); }
        /* t85: a 3 mp-es torles natív ablak nelkul (nativ: false); a t79
           ota ez egy ures "Sikeres" ablakot nyitott minden vasarlas utan. */
        uzenetIdozit("kinalat", szoveg, hiba, sz => { if (kinalatNezet.uzenet === sz) kinalatUzenet("", false, false, false); });
        if (szoveg === "Küldés…" || !szoveg || nativ === false) return;
        try {
            const J = jatek();
            const Oszt = hiba ? J.MessageError : J.MessageSuccess;
            if (typeof Oszt === "function") new Oszt(szoveg).show();
        } catch (e) { /* a panel uzenete eleg */ }
    }

    function kinalatKuld(s, osszeg, azonnali) {
        if (kinalatKuldes) return;
        const A = jatek().Ajax;
        if (!A || typeof A.remoteCall !== "function") { kinalatUzenet("A játék hívása nem érhető el.", true); return; }
        /* Utolso ellenorzes kozvetlenul kuldes elott. */
        const f = kinalatFedezet(osszeg);
        if (!f.jo) { kinalatUzenet(f.szoveg || "Érvénytelen összeg.", true); return; }
        if (azonnali && osszeg !== Number(s.max_price)) { kinalatUzenet("Az azonnali ár megváltozott.", true); return; }
        if (!azonnali && (osszeg < kinalatMinLicit(s) || osszeg > kinalatMaxLicit(s))) {
            kinalatUzenet("Alacsony licit összeg.", true); return;
        }
        kinalatKuldes = true;
        gyoker.querySelectorAll("#kinalatSav .kvgomb").forEach(g => { g.disabled = true; });
        kinalatUzenet("Küldés…", false);
        const vege = () => {
            kinalatKuldes = false;
            const sav = gyoker && gyoker.getElementById("kinalatSav");
            if (sav && kinalatNezet.valasztott) kinalatSavFrissit();
        };
        try {
            A.remoteCall("building_market", "bid",
                { bidtype: 0, bid: osszeg, market_offer_id: s.market_offer_id, direction: "SELL" },
                valasz => {
                    const msg = valasz && valasz.msg;
                    if (!valasz || valasz.error) {
                        kinalatUzenet((valasz && typeof valasz.msg === "string" && valasz.msg) || "A szerver elutasította.", true);
                        vege();
                        return;
                    }
                    try {
                        const C = jatek().Character;
                        if (msg && msg.money != null && typeof C.setMoney === "function") C.setMoney(msg.money);
                        if (msg && msg.deposit != null && typeof C.setDeposit === "function") C.setDeposit(msg.deposit);
                    } catch (e) { /* a penz kijelzese a kovetkezo frissitesig regi marad */ }
                    const nev = targyNev(s.item_id);
                    if (licitek.allapot !== "tolt") licitek.allapot = "ures";
                    if (msg && msg.instantBuy) {
                        kinalat.sorok = kinalat.sorok.filter(x => x !== s);
                        if (kinalat.regi) kinalat.regi = kinalat.regi.filter(x => x !== s);
                        figyelo.sorok = figyelo.sorok.filter(x => x !== s);
                        kinalatNezet.valasztott = null;
                        const sor = kinalatSorElem(s.market_offer_id);
                        if (sor) sor.remove();
                        const sav = gyoker.getElementById("kinalatSav");
                        if (sav) sav.remove();
                        kinalatUzenet(`Megvetted: ${nev}, ${kinalatSzam(osszeg)} $. Átvétel: ${s.market_town_name}.`, false);
                        kinalatUresJelzes();
                    } else {
                        s.current_bid = osszeg;
                        s.is_highest_bidder = true;
                        const sor = kinalatSorElem(s.market_offer_id);
                        /* A megfigyelt listaban mas a sor szerkezete, es a
                           Leveszem gombot ujra kell kotni a csere utan. */
                        if (sor && sor.classList.contains("fsor")) {
                            sor.outerHTML = figyeloSorHTML(s);
                            const uj = kinalatSorElem(s.market_offer_id);
                            const g = uj && uj.querySelector("[data-fig-le]");
                            if (g) g.addEventListener("click", () => {
                                if (figyeloKuldes) return;
                                if (!kinalatMegerosit(g, "Biztos?")) return;
                                figyeloLevesz(g.getAttribute("data-fig-le"));
                            });
                            if (uj) uj.classList.add("valasztott");
                        } else if (sor) sor.outerHTML = kinalatSorHTML(s);
                        kinalatUzenet(`Licitáltál: ${nev}, ${kinalatSzam(osszeg)} $.`, false);
                    }
                    vege();
                });
        } catch (e) {
            kinalatUzenet("A hívás kivételt dobott: " + (e && e.message ? e.message : e), true);
            vege();
        }
    }

    function kinalatSorElem(id) {
        const k = String(id);
        return [...gyoker.querySelectorAll("#kinalatLista .ksor2, #figyeloLista .ksor2")].find(x => x.getAttribute("data-kid") === k) || null;
    }

    function kinalatSavFrissit() {
        const regi = gyoker.getElementById("kinalatSav");
        if (regi) regi.remove();
        const id = kinalatNezet.valasztott;
        gyoker.querySelectorAll("#kinalatLista .ksor2.valasztott, #figyeloLista .ksor2.valasztott").forEach(x => x.classList.remove("valasztott"));
        if (!id) return;
        const sor = kinalatSorElem(id);
        const s = kinalatSorKeres(id);
        if (!sor || !s || sor.hidden) { kinalatNezet.valasztott = null; return; }
        sor.classList.add("valasztott");
        sor.insertAdjacentHTML("afterend", kinalatSavHTML(s));
        const sav = gyoker.getElementById("kinalatSav");
        const be = gyoker.getElementById("kvLicit");
        if (be) {
            be.addEventListener("input", () => { licitMezoTagol(be); kinalatLicitEllenoriz(s, true); });
            kinalatLicitEllenoriz(s, true);
        }
        const vesz = sav.querySelector("[data-kvvesz]");
        if (vesz) vesz.addEventListener("click", () => {
            if (vesz.disabled || kinalatKuldes) return;
            if (!kinalatMegerosit(vesz, `Biztos? Megveszem ${kinalatSzam(s.max_price)} $-ért`)) return;
            kinalatKuld(s, Number(s.max_price), true);
        });
        const lic = sav.querySelector("[data-kvlicit]");
        if (lic) lic.addEventListener("click", () => {
            if (lic.disabled || kinalatKuldes) return;
            const v = kinalatLicitEllenoriz(s, false);
            if (v == null) return;
            if (!kinalatMegerosit(lic, `Biztos? Licitálok ${kinalatSzam(v)} $-t`)) return;
            kinalatKuld(s, v, false);
        });
        const fig = sav.querySelector("[data-kvfigyel]");
        if (fig) fig.addEventListener("click", () => {
            if (fig.disabled || kinalatKuldes) return;
            /* A savon minden kuldes ket kattintas, ez sem kivetel. */
            if (!kinalatMegerosit(fig, "Biztos?")) return;
            figyeloFelvesz(String(s.market_offer_id), fig);
        });
        /* Kattintas a savon belul ne csukja be. */
        sav.addEventListener("click", e => e.stopPropagation());
    }

    function kinalatListaKotes() {
        const lista = gyoker.getElementById("kinalatLista");
        if (!lista || lista.dataset.kotve) return;
        lista.dataset.kotve = "1";
        lista.addEventListener("click", e => {
            const sor = e.target.closest && e.target.closest(".ksor2");
            if (!sor || kinalatKuldes) return;
            const id = sor.getAttribute("data-kid");
            kinalatNezet.valasztott = kinalatNezet.valasztott === id ? null : id;
            kinalatSavFrissit();
        });
    }

    function kinalatHTML() {
        return `
          <div class="kinalat">
            <div class="kinalat-fej">
              <div class="piacmezo">
                <input id="kKereses" autocomplete="off" spellcheck="false"
                  placeholder="T\u00E1rgy neve" value="${esc(kinalatNezet.kereses)}">
                <button type="button" class="torlo" data-ktorol
                  aria-label="Keres\u00E9s t\u00F6rl\u00E9se"${kinalatNezet.kereses ? "" : " hidden"}>\u2715</button>
              </div>
              <span class="pkatvalaszto" role="group" aria-label="T\u00EDpus">
                ${PIAC_KATEGORIAK.map(k => `<button type="button" class="pkat${kinalatNezet.kategoria === k.kulcs ? " aktiv" : ""}"
                  data-kkatv="${k.kulcs}" aria-pressed="${kinalatNezet.kategoria === k.kulcs ? "true" : "false"}">${k.cimke}</button>`).join("")}
              </span>
              <button type="button" class="gomb" data-kinalat-friss
                ${kinalat.allapot === "tolt" ? "disabled" : ""}>Friss\u00EDt\u00E9s</button>
            </div>
            <div class="kallapotsor">
              <div class="kallapot" id="kinalatAllapot">${esc(kinalatAllapotSzoveg())}</div>
              <span class="pkatvalaszto kmester" role="group" aria-label="Mesters\u00E9g"${kinalatNezet.kategoria === "recept" ? "" : " hidden"}>
                ${mestersegLista().map(m => {
                    const a = kinalatNezet.mesterseg === m.id;
                    return `<button type="button" class="pkat${a ? " aktiv" : ""}" data-kmes="${m.id}" aria-pressed="${a ? "true" : "false"}">${esc(m.nev)}</button>`;
                }).join("")}
              </span>
            </div>
            <div class="kvuzenet${kinalatNezet.uzenetHiba ? " kvhiba" : ""}" id="kvUzenet" role="status">${esc(kinalatNezet.uzenet || "")}</div>
            ${kinalatFejlecHTML()}
            <div class="kinalatlista" id="kinalatLista">${kinalatRendezett().map(kinalatSorHTML).join("")}</div>
            <p class="ures" id="kinalatUres" hidden></p>
          </div>`;
    }

    function kinalatFejlecKotes() {
        gyoker.querySelectorAll(".kfej2 [data-krend]").forEach(g => {
            g.addEventListener("click", () => {
                const k = g.getAttribute("data-krend");
                if (kinalatNezet.rendez !== k) { kinalatNezet.rendez = k; kinalatNezet.irany = 1; }
                else if (kinalatNezet.irany > 0) kinalatNezet.irany = -1;
                else { kinalatNezet.rendez = null; kinalatNezet.irany = 1; }
                if (kinalat.allapot === "tolt") {
                    kinalatNezet.fuggo = true;
                    if (!kinalatRendAktiv() && kinalat.regi) {
                        /* Alapra valtott: a regi lista helyett az uj sorok
                           latszanak, es innen mar hozzafuzunk. */
                        kinalat.regi = null;
                        kinalat.ido = kinalat.tolIdo || kinalat.ido;
                        kinalatNezet.fuggo = false;
                        kinalatListaUjra();
                        kinalatKiir();
                        return;
                    }
                    const fej = gyoker.querySelector(".kfej2");
                    if (fej) { fej.outerHTML = kinalatFejlecHTML(); kinalatFejlecKotes(); }
                    kinalatKiir();
                    return;
                }
                kinalatListaUjra();
            });
        });
    }

    function kinalatMesterFrissit() {
        const g = gyoker && gyoker.querySelector(".kmester");
        if (!g) return;
        g.hidden = kinalatNezet.kategoria !== "recept";
        g.querySelectorAll("[data-kmes]").forEach(x => {
            const a = Number(x.getAttribute("data-kmes")) === kinalatNezet.mesterseg;
            x.classList.toggle("aktiv", a);
            x.setAttribute("aria-pressed", a ? "true" : "false");
        });
    }

    /* A szint szerinti sorrend be- vagy kikapcsolt. Betoltes kozben a
       fejlec-rendezes mintajara: a vegen all be. */
    function kinalatSorrendValtozott() {
        if (kinalat.allapot === "tolt") {
            kinalatNezet.fuggo = true;
            if (!kinalatRendAktiv() && kinalat.regi) {
                kinalat.regi = null;
                kinalat.ido = kinalat.tolIdo || kinalat.ido;
                kinalatNezet.fuggo = false;
                kinalatListaUjra();
            } else kinalatSzur();
            kinalatKiir();
            return;
        }
        kinalatListaUjra();
    }

    function kinalatKotes() {
        const g = gyoker.querySelector("[data-kinalat-friss]");
        if (g) g.addEventListener("click", () => {
            if (kinalat.allapot === "tolt") return;
            kinalat.allapot = "ures";
            kinalatTolt();
            rajzol();
        });
        const be = gyoker.getElementById("kKereses");
        const torlo = gyoker.querySelector("[data-ktorol]");
        if (be) be.addEventListener("input", () => {
            kinalatNezet.kereses = be.value;
            if (torlo) torlo.hidden = !be.value;
            kinalatSzur();
        });
        if (torlo) torlo.addEventListener("click", () => {
            kinalatNezet.kereses = "";
            if (be) { be.value = ""; be.focus(); }
            torlo.hidden = true;
            kinalatSzur();
        });
        gyoker.querySelectorAll("[data-kkatv]").forEach(b => {
            b.addEventListener("click", () => {
                const voltSzint = kinalatSzintRend();
                kinalatNezet.kategoria = b.getAttribute("data-kkatv");
                /* A Receptbol kilepve a mesterseg is torlodik. */
                if (kinalatNezet.kategoria !== "recept") kinalatNezet.mesterseg = null;
                gyoker.querySelectorAll("[data-kkatv]").forEach(x => {
                    const a = x === b;
                    x.classList.toggle("aktiv", a);
                    x.setAttribute("aria-pressed", a ? "true" : "false");
                });
                kinalatMesterFrissit();
                if (voltSzint !== kinalatSzintRend()) kinalatSorrendValtozott();
                else kinalatSzur();
            });
        });
        gyoker.querySelectorAll(".kmester [data-kmes]").forEach(b => {
            b.addEventListener("click", () => {
                const id = Number(b.getAttribute("data-kmes"));
                kinalatNezet.mesterseg = kinalatNezet.mesterseg === id ? null : id;
                kinalatMesterFrissit();
                kinalatSorrendValtozott();
            });
        });
        kinalatFejlecKotes();
        kinalatListaKotes();
        kinalatSavFrissit();
        kinalatUresJelzes();
    }

    /* Csak a lista gorgul. A magassag a panel meretebol jon, ugyanugy,
       mint az Eladas fulon. */
    function kinalatListaMagassag() {
        try {
            const stage = gyoker.getElementById("stage");
            const lista = gyoker.getElementById("kinalatLista");
            if (!stage || !lista) return;
            const also = 40;
            const h = stage.clientHeight - (lista.offsetTop - stage.offsetTop) - also;
            lista.style.maxHeight = Math.max(120, h) + "px";
        } catch (e) { /* marad a sajat magassaga */ }
    }



    /* -----------------------------------------------------------------
       MASOK KERESEI (t42). Elado ful, "kerelmek" nezet: mas jatekosok
       veteli keresei, amikre te adhatsz el.

       MERT (2026-09-20, konzol): building_market / search a Kinalat
       parametereivel, de direction_sell: false es direction_buy: true.
       A valasz ugyanaz az alak: msg.search_result es msg.next; 13 sor
       jott egy reszletben. A sorokban 20 mezo, es VAN direction: "BUY".
       A seller_* mezok itt a keresre valojaban a KERO adatai.

       FORRAS (natív bid, 2026-09-20): a kuldes
         bid { bidtype: 0, bid, market_offer_id, direction: "BUY" }.
       Ez MEG NINCS BEKAPCSOLVA: a piac szerveroldalon all, a valaszt
       nem tudtuk merni, ezert a sav gombjai tiltva vannak.
       ----------------------------------------------------------------- */
    const kerelmek = {
        allapot: "ures",   /* ures | tolt | kesz | hiba | csonka */
        sorok: [], reszlet: 0, dupla: 0, uzenet: "", kezd: 0, veg: 0, futas: 0, ido: 0
    };
    const kerelemNezet = { kereses: "", kategoria: "mind", rendez: null, irany: 1,
                           valasztott: null, nalam: false, uzenet: "", uzenetHiba: false };

    const KERELEM_OSZLOPOK = [
        { kulcs: "nev", cimke: "T\u00E1rgy", jobb: false },
        { kulcs: "nalam", cimke: "N\u00E1lam", jobb: true },
        { kulcs: "azonnal", cimke: "Azonnal", jobb: true },
        { kulcs: "ajanlat", cimke: "Aj\u00E1nlat", jobb: true },
        { kulcs: "lejar", cimke: "Lej\u00E1r", jobb: true },
        { kulcs: "kero", cimke: "K\u00E9r\u0151", jobb: false, csoport: "nevhely" },
        { kulcs: "hely", cimke: "hely", jobb: false, csoport: "nevhely" }
    ];

    function kerelemParam(oldal) {
        return {
            pattern: "", nav: oldal === 1 ? "first" : "next", page: oldal,
            sort: "bid", order: "asc", type: "",
            level_range_min: "0", level_range_max: "",
            usable: false, has_effect: false, visibility: 2,
            direction_sell: false, direction_buy: true
        };
    }

    function sajatJatekosE(id) {
        try { const sajat = Number(jatek().Character.playerId); return sajat > 0 && Number(id) === sajat; }
        catch (e) { return false; }
    }
    function kerelemHatra(s) {
        const alap = Number(s.auction_ends_in);
        if (!isFinite(alap)) return null;
        return alap - (Date.now() - (kerelmek.ido || Date.now())) / 1000;
    }
    /* Hany darab van a taskadban ebbol a targybol. null = a Bag meg nem
       tolt be, ilyenkor "?" all a cellaban. */
    function kerelemNalam(s) {
        const v = keszlet(s.item_id);
        return v == null ? null : Number(v) || 0;
    }
    function kerelemEleg(s) {
        const v = kerelemNalam(s);
        return v != null && v >= (Number(s.item_count) || 1);
    }
    /* A kero azonnali ara az egesz tetelre szol, mint a Kinalatban. */
    function kerelemAjanlat(s) {
        return s.current_bid != null ? Number(s.current_bid) : null;
    }

    function kerelemAllapotSzoveg() {
        const k = kerelmek;
        const mp = k.veg && k.kezd ? ((k.veg - k.kezd) / 1000).toFixed(1).replace(".", ",") : "";
        switch (k.allapot) {
            case "tolt": return `Bet\u00F6lt\u00E9s: ${k.reszlet + 1}. r\u00E9szlet, eddig ${k.sorok.length} k\u00E9r\u00E9s\u2026`;
            case "kesz": return `${k.sorok.length} k\u00E9r\u00E9s, ${k.reszlet} r\u00E9szletben, ${mp} mp.`;
            case "csonka": return `Megszak\u00EDtva ${KINALAT_MAX_RESZLET} r\u00E9szlet ut\u00E1n, ${k.sorok.length} k\u00E9r\u00E9s.`;
            case "hiba": return "Hiba: " + k.uzenet;
            default: return "M\u00E9g nincs let\u00F6ltve.";
        }
    }
    function kerelemKiir() {
        const el = gyoker && gyoker.getElementById("kerelemAllapot");
        if (el) el.textContent = kerelemAllapotSzoveg();
        const g = gyoker && gyoker.querySelector("[data-kerelem-friss]");
        if (g) g.disabled = kerelmek.allapot === "tolt";
    }

    function kerelemTolt() {
        if (kerelmek.allapot === "tolt") return;
        const A = jatek().Ajax;
        const futas = ++kerelmek.futas;
        kerelmek.allapot = "tolt";
        kerelmek.sorok = [];
        kerelmek.reszlet = 0;
        kerelmek.dupla = 0;
        kerelmek.uzenet = "";
        kerelmek.kezd = Date.now();
        kerelmek.veg = 0;
        const lattam = new Set();

        const vege = () => {
            if (futas !== kerelmek.futas) return;
            kerelmek.veg = Date.now();
            kerelemKiir();
            kerelemListaUjra();
        };

        if (!A || typeof A.remoteCall !== "function") {
            kerelmek.allapot = "hiba";
            kerelmek.uzenet = "a j\u00E1t\u00E9k Ajax.remoteCall h\u00EDv\u00E1sa nem \u00E9rhet\u0151 el.";
            vege();
            return;
        }

        function kovetkezo(oldal) {
            if (futas !== kerelmek.futas) return;
            if (oldal > KINALAT_MAX_RESZLET) { kerelmek.allapot = "csonka"; vege(); return; }
            let megjott = false;
            const ora = setTimeout(() => {
                if (megjott || futas !== kerelmek.futas) return;
                megjott = true;
                kerelmek.allapot = "hiba";
                kerelmek.uzenet = "nem j\u00F6tt v\u00E1lasz " + (KINALAT_IDOKORLAT / 1000) + " m\u00E1sodpercen bel\u00FCl.";
                vege();
            }, KINALAT_IDOKORLAT);
            try {
                A.remoteCall("building_market", "search", kerelemParam(oldal), valasz => {
                    if (megjott || futas !== kerelmek.futas) return;
                    megjott = true;
                    clearTimeout(ora);
                    const msg = valasz && valasz.msg;
                    if (!valasz || valasz.error || !msg || !Array.isArray(msg.search_result)) {
                        kerelmek.allapot = "hiba";
                        kerelmek.uzenet = (valasz && typeof valasz.msg === "string" && valasz.msg)
                            || "v\u00E1ratlan v\u00E1lasz a szervert\u0151l.";
                        vege();
                        return;
                    }
                    kerelmek.reszlet = oldal;
                    kerelmek.ido = Date.now();
                    msg.search_result.forEach(sor => {
                        const kulcs = String(sor && sor.market_offer_id);
                        if (lattam.has(kulcs)) { kerelmek.dupla++; return; }
                        lattam.add(kulcs);
                        /* t84 (C): a sajat keres a Kereseim nezetben van
                           (MERVE: a kereses a sajatot is visszaadja). */
                        if (sajatJatekosE(sor && sor.seller_player_id)) return;
                        kerelmek.sorok.push(sor);
                    });
                    if (msg.next) {
                        kerelemKiir();
                        kerelemListaUjra();
                        setTimeout(() => kovetkezo(oldal + 1), KINALAT_SZUNET);
                    } else {
                        kerelmek.allapot = "kesz";
                        vege();
                    }
                });
            } catch (e) {
                if (megjott) return;
                megjott = true;
                clearTimeout(ora);
                kerelmek.allapot = "hiba";
                kerelmek.uzenet = "a h\u00EDv\u00E1s kiv\u00E9telt dobott: " + (e && e.message ? e.message : e);
                vege();
            }
        }
        kerelemKiir();
        kovetkezo(1);
    }

    function kerelemLathatoE(s) {
        const q = piacNormal(kerelemNezet.kereses);
        if (q && !piacNormal(targyNev(s.item_id)).includes(q)) return false;
        if (kerelemNezet.kategoria !== "mind") {
            const it = itemObj(s.item_id);
            const tipus = it ? (it.getType ? it.getType() : it.type) : "";
            if (piacKategoria(tipus) !== kerelemNezet.kategoria) return false;
        }
        if (kerelemNezet.nalam && !kerelemEleg(s)) return false;
        return true;
    }

    function kerelemRendezoErtek(s, kulcs) {
        switch (kulcs) {
            case "nev": return piacNormal(targyNev(s.item_id));
            case "nalam": return kerelemNalam(s);
            case "azonnal": return s.max_price != null ? Number(s.max_price) : null;
            case "ajanlat": return kerelemAjanlat(s) != null ? kerelemAjanlat(s) : (s.auction_price != null ? Number(s.auction_price) : null);
            case "lejar": return Number(s.auction_end_date);
            case "kero": return piacNormal(s.seller_name || "");
            case "hely": return kinalatOdaut(s);
            default: return null;
        }
    }
    function kerelemRendezett() {
        const sorok = kerelmek.sorok.filter(kerelemLathatoE);
        const k = kerelemNezet.rendez;
        if (!k) return sorok;
        const ir = kerelemNezet.irany;
        return sorok
            .map((s, i) => ({ s, i, v: kerelemRendezoErtek(s, k) }))
            .sort((a, b) => {
                const au = a.v == null || a.v === "", bu = b.v == null || b.v === "";
                if (au !== bu) return au ? 1 : -1;
                let d = 0;
                if (!au) d = typeof a.v === "string" ? a.v.localeCompare(b.v, "hu") : a.v - b.v;
                return d ? d * ir : a.i - b.i;
            })
            .map(x => x.s);
    }

    function kerelemSorHTML(s) {
        const db = Number(s.item_count) || 1;
        const nalam = kerelemNalam(s);
        const odaut = kinalatOdaut(s);
        const megj = s.description ? String(s.description) : "";
        const ajanlat = kerelemAjanlat(s);
        const id = esc(String(s.market_offer_id));
        return `
          <div class="ksor2 mksor${kerelemNezet.valasztott === String(s.market_offer_id) ? " valasztott" : ""}" data-mkid="${id}">
            ${targyBubIkonHTML(s.item_id, targyIkon(s.item_id))}
            <div class="knev2 kn"><span class="knn">${esc(targyNev(s.item_id))}</span>${db > 1 ? `<span class="kdb">&times;${db}</span>` : ""}</div>
            <div class="mnalam${kerelemEleg(s) ? " van" : " halvany"}">${nalam == null ? "?" : kinalatSzam(nalam)}</div>
            <div class="jobb kazon">${kinalatSzam(s.max_price)}</div>
            <div class="jobb${ajanlat == null ? " halvany" : (s.is_highest_bidder ? " kvez" : " klic")}"${s.is_highest_bidder ? ' title="A te aj\u00E1nlatod a legjobb"' : (ajanlat == null ? ' title="Fels\u0151 \u00E1r"' : "")}>${s.is_highest_bidder ? "&#9733; " : ""}${kinalatSzam(ajanlat != null ? ajanlat : s.auction_price)}</div>
            <div class="jobb">${esc(kinalatIdo(kerelemHatra(s)))}</div>
            <div class="khely"><span>${megjJelHTML(megj)}${jatekosLinkHTML(s.seller_name, s.seller_player_id)}</span>
              <span class="kvaros">${megjJelHTML("")}${varosLinkHTML(s.market_town_name, s.market_town_x, s.market_town_y, odaut)}${odaut != null ? " &middot; " + (odaut > 0 ? odautLinkHTML(kinalatIdo(odaut), s.market_town_id, s.market_town_x, s.market_town_y, s.market_town_name, odaut) : "itt vagy") : ""}</span></div>
          </div>`;
    }

    function kerelemFejlecHTML() {
        const gomb = o => {
            const a = kerelemNezet.rendez === o.kulcs;
            const nyil = a ? (kerelemNezet.irany > 0 ? " \u25B2" : " \u25BC") : "";
            return `<button type="button" class="krend${o.jobb ? " jobb" : ""}${a ? " aktiv" : ""}"
                  data-mkrend="${o.kulcs}">${o.cimke}${nyil}</button>`;
        };
        return `<div class="kfej2 mkfej2">
            <div></div>${KERELEM_OSZLOPOK.filter(o => !o.csoport).map(gomb).join("")}
            <div class="knevhely">${KERELEM_OSZLOPOK.filter(o => o.csoport === "nevhely").map(gomb).join(`<span class="kelv">,</span>`)}</div>
          </div>`;
    }

    /* t83: az azonnali eladas el; t86: az Ajanlat is (MERVE 2026-10-08). */
    function kerelemSavHTML(s) {
        const hatra = kerelemHatra(s);
        if (hatra != null && hatra <= 0) {
            return `<div class="kvsav" id="kerelemSav"><p class="kvhiba">A k\u00E9r\u00E9s lej\u00E1rt.</p></div>`;
        }
        const db = Number(s.item_count) || 1;
        const nalam = kerelemNalam(s);
        const eleg = kerelemEleg(s);
        const hely = esc(s.market_town_name);
        const keszletSor = nalam == null
            ? `<div class="kvsor">A t\u00E1skád tartalma most nem olvashat\u00F3.</div>`
            : `<div class="kvsor${eleg ? "" : " kvhiba"}">N\u00E1lad ${kinalatSzam(nalam)} db van, ${kinalatSzam(db)} db kell.</div>`;
        const azonnal = s.max_price != null ? `
              <div class="kvdoboz">
                <h4>Azonnali elad\u00E1s</h4>
                <div class="kvar">${kinalatSzam(s.max_price)} $</div>
                <div class="kvsor">A k\u00E9r\u00E9s r\u00F6gt\u00F6n teljes\u00FCl, a p\u00E9nz ${hely} piac\u00E1n v\u00E1r.</div>
                ${keszletSor}
                <button type="button" class="gomb kvgomb" data-mkelad="${esc(String(s.market_offer_id))}"${eleg && !kerelemKuldes ? "" : " disabled"}>Eladom ${kinalatSzam(s.max_price)} $-\u00E9rt</button>
              </div>` : "";
        const also = s.max_price != null ? Math.floor(Number(s.max_price)) + 1 : null;
        const felso = s.current_bid != null
            ? Math.max(0, Math.floor(Number(s.current_bid)) - 1)
            : (s.auction_price != null ? Math.floor(Number(s.auction_price)) : null);
        const jelen = s.current_bid != null
            ? `Legjobb aj\u00E1nlat: ${kinalatSzam(s.current_bid)} $${s.is_highest_bidder ? " (a ti\u00E9d)" : ""}`
            : `M\u00E9g nincs aj\u00E1nlat, fels\u0151 \u00E1r: ${kinalatSzam(s.auction_price)} $`;
        const ajanlat = felso == null ? "" : `
              <div class="kvdoboz">
                <h4>Aj\u00E1nlat</h4>
                <div class="kvsor">${jelen}</div>
                <div class="kvsor kvbe"><input type="text" inputmode="numeric" autocomplete="off" id="mkAjanlat" value="${kinalatSzam(felso)}"
                  data-also="${also != null ? also : 1}" data-felso="${felso}"> $
                  <span>${also != null ? `legal\u00E1bb ${kinalatSzam(also)}, ` : ""}legfeljebb ${kinalatSzam(felso)}</span></div>
                <div class="kvsor">Ford\u00EDtott \u00E1rver\u00E9s: az nyer, aki a legkevesebbet k\u00E9ri. A t\u00E1rgy r\u00F6gt\u00F6n kiker\u00FCl a t\u00E1sk\u00E1db\u00F3l.</div>
                <button type="button" class="gomb kvgomb" data-mkajanlat="${esc(String(s.market_offer_id))}"${eleg && !kerelemKuldes && felso >= (also != null ? also : 1) ? "" : " disabled"}>Aj\u00E1nlatot teszek</button>
              </div>`;
        return `
          <div class="kvsav" id="kerelemSav">
            <div class="kvdobozok">${azonnal}${ajanlat}</div>
            <div class="kvlab">Azonnali elad\u00E1sn\u00E1l a p\u00E9nz r\u00F6gt\u00F6n a k\u00E9r\u00E9s piac\u00E1n v\u00E1r. Aj\u00E1nlatn\u00E1l a lej\u00E1ratkor a legolcs\u00F3bb aj\u00E1nlat nyer; a fut\u00F3 aj\u00E1nlataidat a V\u00E9tel / Licitjeim n\u00E9zetben l\u00E1tod. A p\u00E9nzt az \u00C1tv\u00E9tel / Elad\u00E1saim n\u00E9zetben veszed fel, \u201Ek\u00E9r\u00E9sre\u201D jellel; d\u00EDj nincs.</div>
          </div>`;
    }

    function kerelemSavFrissit() {
        const regi = gyoker.getElementById("kerelemSav");
        if (regi) regi.remove();
        gyoker.querySelectorAll("#kerelemLista .mksor.valasztott").forEach(x => x.classList.remove("valasztott"));
        const id = kerelemNezet.valasztott;
        if (!id) return;
        const sor = [...gyoker.querySelectorAll("#kerelemLista .mksor")].find(x => x.getAttribute("data-mkid") === String(id));
        const s = kerelmek.sorok.find(x => String(x.market_offer_id) === String(id));
        if (!sor || !s) { kerelemNezet.valasztott = null; return; }
        sor.classList.add("valasztott");
        sor.insertAdjacentHTML("afterend", kerelemSavHTML(s));
        const sav = gyoker.getElementById("kerelemSav");
        if (sav) sav.addEventListener("click", e => e.stopPropagation());
        const ab = sav && sav.querySelector("#mkAjanlat");
        const ag = sav && sav.querySelector("[data-mkajanlat]");
        const ajErtek = () => {
            const v = eladSzam(ab ? ab.value : "");
            const also = Number(ab && ab.dataset.also) || 1, felso = Number(ab && ab.dataset.felso) || 0;
            return v != null && !isNaN(v) && v >= also && v <= felso ? v : null;
        };
        if (ab && ag) {
            const allit = () => {
                kinalatMegerositesVissza(ag);
                const s0 = kerelmek.sorok.find(x => String(x.market_offer_id) === String(ag.getAttribute("data-mkajanlat")));
                ag.disabled = kerelemKuldes || ajErtek() == null || !(s0 && kerelemEleg(s0));
            };
            ab.addEventListener("input", allit);
            ab.addEventListener("focus", () => { try { ab.select(); } catch (e) { /* nem baj */ } });
            ag.addEventListener("click", () => {
                const v = ajErtek();
                if (ag.disabled || kerelemKuldes || v == null) return;
                if (!kinalatMegerosit(ag, `Biztos? Aj\u00E1nlat ${kinalatSzam(v)} $`)) return;
                kerelemElad(ag.getAttribute("data-mkajanlat"), v);
            });
        }
        const eg = sav && sav.querySelector("[data-mkelad]");
        if (eg) eg.addEventListener("click", () => {
            if (eg.disabled || kerelemKuldes) return;
            if (!kinalatMegerosit(eg, "Biztos?")) return;
            kerelemElad(eg.getAttribute("data-mkelad"));
        });
    }
    /* t83: eladas mas veteli keresere, azonnali aron. MERVE (2.2):
       bid { bidtype: 0, bid, market_offer_id, direction: "BUY" } ->
       msg.instantBuy; a targy rogton kikerul, a penz a keres piacan var
       (fetch_bids BUY sor). Mas varosbol is mukodott. */
    let kerelemKuldes = false;
    function kerelemElad(id, ajanlat) {
        const J = jatek(), A = J.Ajax;
        const s = kerelmek.sorok.find(x => String(x.market_offer_id) === String(id));
        if (kerelemKuldes || !s) return;
        if (!A || typeof A.remoteCall !== "function") { eladUzenet("A j\u00E1t\u00E9k h\u00EDv\u00E1sa nem \u00E9rhet\u0151 el.", true, false); return; }
        if (!kerelemEleg(s)) { eladUzenet("Nincs n\u00E1lad el\u00E9g ebb\u0151l a t\u00E1rgyb\u00F3l.", true, false); return; }
        const nev = `${targyNev(s.item_id)}${Number(s.item_count) > 1 ? " \u00D7" + s.item_count : ""}`;
        kerelemKuldes = true;
        eladUzenet("K\u00FCld\u00E9s\u2026", false, false);
        const vege = () => {
            kerelemKuldes = false;
            try { const E = J.EventHandler; if (E && typeof E.signal === "function") E.signal("inventory_changed"); } catch (e) { /* nem baj */ }
            if (licitek.allapot !== "tolt") licitek.allapot = "ures";
            rajzolHaSzabad();
        };
        try {
            const osszeg = ajanlat != null ? Number(ajanlat) : Number(s.max_price);
            A.remoteCall("building_market", "bid", { bidtype: 0, bid: osszeg, market_offer_id: s.market_offer_id, direction: "BUY" }, valasz => {
                const msg = valasz && valasz.msg;
                if (!valasz || valasz.error || !msg || typeof msg !== "object") {
                    eladUzenet((valasz && typeof valasz.msg === "string" && valasz.msg) || "A szerver elutas\u00EDtotta.", true, true);
                } else if (msg.instantBuy === false) {
                    /* Ajanlat: a keres fut tovabb, a sor a mienk. */
                    s.current_bid = osszeg;
                    s.is_highest_bidder = true;
                    kerelemNezet.valasztott = null;
                    eladUzenet(`Aj\u00E1nlatot tett\u00E9l: ${nev}, ${kinalatSzam(osszeg)} $.`, false, false);
                } else {
                    kerelmek.sorok = kerelmek.sorok.filter(x => String(x.market_offer_id) !== String(id));
                    kerelemNezet.valasztott = null;
                    eladUzenet(`Eladva: ${nev}, ${kinalatSzam(osszeg)} $. A p\u00E9nz ${s.market_town_name} piac\u00E1n v\u00E1r (\u00C1tv\u00E9tel / Elad\u00E1saim).`, false, false);
                }
                vege();
            });
        } catch (e) {
            eladUzenet("A h\u00EDv\u00E1s kiv\u00E9telt dobott: " + (e && e.message ? e.message : e), true, false);
            vege();
        }
    }

    function kerelemUresJelzes() {
        const ures = gyoker && gyoker.getElementById("kerelemUres");
        if (!ures) return;
        const van = !!gyoker.querySelector("#kerelemLista .mksor");
        ures.hidden = van || (kerelmek.allapot === "tolt" && !kerelmek.sorok.length);
        ures.textContent = kerelmek.sorok.length
            ? "Nincs a sz\u0171r\u00E9snek megfelel\u0151 k\u00E9r\u00E9s."
            : (kerelmek.allapot === "tolt" ? "" : "Nincs veteli k\u00E9r\u00E9s a piacon.");
    }

    function kerelemListaUjra() {
        const lista = gyoker && gyoker.getElementById("kerelemLista");
        if (!lista) return;
        const fent = lista.scrollTop;
        lista.innerHTML = kerelemRendezett().map(kerelemSorHTML).join("");
        kerelemSavFrissit();
        lista.scrollTop = fent;
        const fej = gyoker.querySelector(".mkfej2");
        if (fej) { fej.outerHTML = kerelemFejlecHTML(); kerelemFejlecKotes(); }
        kerelemUresJelzes();
    }

    function kerelemHTML() {
        return `
          <div class="kinalat">
            <div class="kinalat-fej">
              <div class="piacmezo">
                <input id="mkKereses" autocomplete="off" spellcheck="false"
                  placeholder="T\u00E1rgy neve" value="${esc(kerelemNezet.kereses)}">
                <button type="button" class="torlo" data-mktorol
                  aria-label="Keres\u00E9s t\u00F6rl\u00E9se"${kerelemNezet.kereses ? "" : " hidden"}>\u2715</button>
              </div>
              <span class="pkatvalaszto" role="group" aria-label="T\u00EDpus">
                ${PIAC_KATEGORIAK.map(k => `<button type="button" class="pkat${kerelemNezet.kategoria === k.kulcs ? " aktiv" : ""}"
                  data-mkkat="${k.kulcs}" aria-pressed="${kerelemNezet.kategoria === k.kulcs ? "true" : "false"}">${k.cimke}</button>`).join("")}
              </span>
              <span class="pkatvalaszto" role="group" aria-label="Sz\u0171r\u00E9s a k\u00E9szletedre">
                <button type="button" class="pkat${kerelemNezet.nalam ? " aktiv" : ""}" data-mknalam
                  aria-pressed="${kerelemNezet.nalam ? "true" : "false"}"
                  title="Csak azok a k\u00E9r\u00E9sek, amikhez van el\u00E9g t\u00E1rgyad">N\u00E1lam van</button>
              </span>
              <button type="button" class="gomb" data-kerelem-friss
                ${kerelmek.allapot === "tolt" ? "disabled" : ""}>Friss\u00EDt\u00E9s</button>
            </div>
            <div class="kallapotsor">
              <div class="kallapot" id="kerelemAllapot">${esc(kerelemAllapotSzoveg())}</div>
            </div>
            ${eladUzenetHTML()}
            ${kerelemFejlecHTML()}
            <div class="kinalatlista" id="kerelemLista">${kerelemRendezett().map(kerelemSorHTML).join("")}</div>
            <p class="ures" id="kerelemUres" hidden></p>
            <p class="labj">M\u00E1sok v\u00E9teli k\u00E9r\u00E9sei. A sorra kattintva ny\u00EDlik az elad\u00E1si s\u00E1v.
              A ${"\u2605"} azt a sort jel\u00F6li, ahol a te aj\u00E1nlatod a legjobb.</p>
          </div>`;
    }

    function kerelemFejlecKotes() {
        gyoker.querySelectorAll(".mkfej2 [data-mkrend]").forEach(g => {
            g.addEventListener("click", () => {
                const k = g.getAttribute("data-mkrend");
                if (kerelemNezet.rendez !== k) { kerelemNezet.rendez = k; kerelemNezet.irany = 1; }
                else if (kerelemNezet.irany > 0) kerelemNezet.irany = -1;
                else { kerelemNezet.rendez = null; kerelemNezet.irany = 1; }
                kerelemListaUjra();
            });
        });
    }

    function kerelemKotes() {
        const g = gyoker.querySelector("[data-kerelem-friss]");
        if (g) g.addEventListener("click", () => {
            if (kerelmek.allapot === "tolt") return;
            kerelemNezet.valasztott = null;
            kerelmek.allapot = "ures";
            kerelemTolt();
            kerelemKiir();
        });
        const be = gyoker.getElementById("mkKereses");
        const torlo = gyoker.querySelector("[data-mktorol]");
        if (be) be.addEventListener("input", () => {
            kerelemNezet.kereses = be.value;
            if (torlo) torlo.hidden = !be.value;
            kerelemListaUjra();
        });
        if (torlo) torlo.addEventListener("click", () => {
            kerelemNezet.kereses = "";
            if (be) { be.value = ""; be.focus(); }
            torlo.hidden = true;
            kerelemListaUjra();
        });
        gyoker.querySelectorAll("[data-mkkat]").forEach(b => {
            b.addEventListener("click", () => {
                kerelemNezet.kategoria = b.getAttribute("data-mkkat");
                gyoker.querySelectorAll("[data-mkkat]").forEach(x => {
                    const a = x === b;
                    x.classList.toggle("aktiv", a);
                    x.setAttribute("aria-pressed", a ? "true" : "false");
                });
                kerelemListaUjra();
            });
        });
        const n = gyoker.querySelector("[data-mknalam]");
        if (n) n.addEventListener("click", () => {
            kerelemNezet.nalam = !kerelemNezet.nalam;
            n.classList.toggle("aktiv", kerelemNezet.nalam);
            n.setAttribute("aria-pressed", kerelemNezet.nalam ? "true" : "false");
            kerelemListaUjra();
        });
        const lista = gyoker.getElementById("kerelemLista");
        if (lista && !lista.dataset.kotve) {
            lista.dataset.kotve = "1";
            lista.addEventListener("click", e => {
                if (!e.target.closest) return;
                if (e.target.closest("#kerelemSav")) return;
                const sor = e.target.closest(".mksor");
                if (!sor) return;
                const id = sor.getAttribute("data-mkid");
                kerelemNezet.valasztott = kerelemNezet.valasztott === id ? null : id;
                kerelemSavFrissit();
            });
        }
        kerelemFejlecKotes();
        kerelemSavFrissit();
        kerelemUresJelzes();
    }

    /* A hely (odaut) percenkenti frissitese ugyanugy, mint a Kinalatban:
       csak a hely cellat csereljuk, a nyitott sav marad. */
    function kerelemHelyFrissit() {
        const lista = gyoker && gyoker.getElementById("kerelemLista");
        if (!lista) return;
        const map = new Map(kerelmek.sorok.map(x => [String(x.market_offer_id), x]));
        lista.querySelectorAll(".mksor[data-mkid]").forEach(sor => {
            const s = map.get(sor.getAttribute("data-mkid"));
            const cella = sor.querySelector(".khely .kvaros");
            if (!s || !cella) return;
            const odaut = kinalatOdaut(s);
            cella.innerHTML = megjJelHTML("") + varosLinkHTML(s.market_town_name, s.market_town_x, s.market_town_y, odaut)
                + (odaut != null ? " &middot; " + (odaut > 0 ? odautLinkHTML(kinalatIdo(odaut), s.market_town_id, s.market_town_x, s.market_town_y, s.market_town_name, odaut) : "itt vagy") : "");
        });
    }

    /* -----------------------------------------------------------------
       LICITJEIM ES ATVETEL (t8).
       MERT (2026-09-16):
         building_market / fetch_bids {} -> msg.search_result, egy hivas.
         A sorokban NINCS is_highest_bidder; a tullicitalt sor eltunik
         (fejleszto kozlese), tehat minden futo sor vezeto licit.
         ATVEHETO = current_bid >= max_price (azonnal megvett) VAGY lejart.
         A natív ablak atveteli ikonja pontosan erre a 7 sorra illett.
         A fetched_item mindig false volt, arra NEM epitunk.
         building_market / fetch { market_offer_id } -> msg.succesfull
           (igy, elirva), msg.money = az uj keszpenz.
         building_market / fetch_town_bids {} -> { msg: szoveg, cash, deposit }
           CSAK a jelenlegi varosban.
         Tavoli kezbesites aranyrogert, a jatek sajat ablakaval:
           Premium.confirmUse("marketdelivery all <townId> bids", ...)
           az arat a get_foreign_town_bids_price adja (Ajax.get).
         A <townId> a MarketWindow.townId: ujratoltes utan 0, a piac
         megnyitasa utan annak a varosnak az azonositoja, bezaras utan is
         megmarad.
         Varosban allsz, ha a Character.position egyezik a piac
         market_town_x / market_town_y ertekevel (mert: Fekete Gyongy).
       ----------------------------------------------------------------- */
    const licitek = { allapot: "ures", sorok: [], ido: 0, uzenet: "", futas: 0 };
    let licitKuldes = false;
    const licitNezet = { uzenet: "", uzenetHiba: false };

    /* t42: a fetch_bids soraiban VAN direction (merve 2026-09-20; a mai
       10 sor mind SELL). A BUY sor a mas veteli keresere tett ajanlatod,
       abbol a natív prepareData szerint PENZ jar, nem targy. A Licitjeim
       es a Vasarlasaim ezert csak a SELL sorokkal dolgozik; a BUY sorok
       helye az Atvetel / Eladasaim lesz, a piaci meresek utan. */
    function licitVetelE(s) { return String((s && s.direction) || "SELL") !== "BUY"; }
    /* t86: veteli keres (BUY) sora teljesult-e. MERVE (2026-10-08, ket
       karakter): az ajanlat (bid > azonnali ar) instantBuy: false, a sor
       current_bid-del fut tovabb; teljesult az azonnali aron eladott
       (current_bid <= max_price), a lejart sor pedig, ha volt ajanlat. A
       natív lista ugyanigy szinezi (zold / piros). hatra: a hatralevo
       masodperc a sajat listank letoltese ota. */
    function buyTeljesultE(s, hatra) {
        if (!s || s.current_bid == null) return false;
        if (s.max_price != null && Number(s.current_bid) <= Number(s.max_price)) return true;
        return hatra != null && hatra <= 0;
    }
    function buyFutoAjanlatE(s) { return !licitVetelE(s) && !buyTeljesultE(s, licitHatra(s)); }
    function buyKerPenzE(s) { return !licitVetelE(s) && buyTeljesultE(s, licitHatra(s)); }
    function licitVeteliSorok() { return licitek.sorok.filter(licitVetelE); }

    function licitHatra(s) {
        const alap = Number(s.auction_ends_in);
        if (!isFinite(alap)) return null;
        return alap - (Date.now() - (licitek.ido || Date.now())) / 1000;
    }
    function licitAtveheto(s) {
        if (s.current_bid != null && s.max_price != null && Number(s.current_bid) >= Number(s.max_price)) return true;
        const h = licitHatra(s);
        return h != null && h <= 0;
    }
    function itteniVarosE(s) {
        try {
            const p = jatek().Character.position;
            return Number(p.x) === Number(s.market_town_x) && Number(p.y) === Number(s.market_town_y);
        } catch (e) { return false; }
    }
    function piacVarosId() {
        try { return Number(jatek().MarketWindow.townId) || 0; } catch (e) { return 0; }
    }
    /* MERT (2026-09-16): a MarketWindow.open a townId-t csak eltarolja,
       a szervertol nem kerdez. A kezbesites ezt a szamot kuldi. Ha nincs
       megnyitott piac (0), annak a varosnak a szamat adjuk, ahol a targy
       all: ez biztosan letezo piac. */
    function kezbesitesVaros(tartalek) {
        return piacVarosId() || Number(tartalek) || 0;
    }
    const KEZB_CIM = "Piaci kézbesítés";
    const KEZB_EGY = "Nem tartózkodsz a helyszínen, hogy átvedd az árut, vagy a pénzt, de néhány aranyrögért cserébe kényelmesen kézbesítik részedre. Szeretnéd?";
    const KEZB_MIND = "Még mindig van néhány árud a piacokon. Néhány aranyrögért cserébe kényelmesen kézbesítik részedre. Szeretnéd?";

    /* MERT (natív Licitalas ful): az odaut idejere kattintva
       TownWindow.open(x, y), az elado nevere PlayerProfileWindow.open(id).
       Egyik sem kolt es nem szakit meg munkat, ezert egy kattintas. */
    /* t26: ha megkapja az odaut masodperceit, a szo sajat buborekot kap
       a pontos idovel; enelkul a regi bongeszo-cimke marad. */
    function varosLinkHTML(nev, x, y, odautMp) {
        const bub = odautMp == null ? ""
            : ` data-helybub="varos" data-hb-nev="${esc(nev)}" data-hb-ido="${esc(odautPontos(odautMp))}"`;
        return `<span class="nlink" data-tw-x="${esc(x)}" data-tw-y="${esc(y)}"${bub ? "" : ' title="Város megnyitása"'}${bub}>${esc(nev)}</span>`;
    }
    function jatekosLinkHTML(nev, id) {
        if (!id) return esc(nev || "Törölt");
        return `<span class="nlink" data-pp="${esc(id)}" title="Profil megnyitása">${esc(nev || "Törölt")}</span>`;
    }
    /* MERT (2026-09-16, natív seta gomb): TaskQueue.add egyetlen walk
       feladattal, post = { unitId: <varosazonosito>, type: "town" }.
       A TaskWalk(unitId, type, x, y) forrasa ugyanezt kesziti.
       A seta valodi muvelet (feladatsorba kerul), ezert ket kattintas. */
    function odautLinkHTML(szoveg, varosId, x, y, bubNev, bubMp) {
        if (!varosId) return esc(szoveg);
        const bub = bubMp == null ? ""
            : ` data-helybub="odaut" data-hb-nev="${esc(bubNev)}" data-hb-ido="${esc(odautPontos(bubMp))}"`;
        return `<span class="nlink olink" data-seta="${esc(varosId)}" data-seta-x="${esc(x)}" data-seta-y="${esc(y)}"${bub ? "" : ' title="Indulás ide (két kattintás)"'}${bub}>${esc(szoveg)}</span>`;
    }
    /* A listakban a hely szuk, ezert ott rovid ido all; a pontos ertek a
       buborekban. Ora, perc, masodperc, nap felett nappal. */
    function odautPontos(mp) {
        if (mp == null || !isFinite(mp)) return "-";
        const t = Math.max(0, Math.floor(mp));
        const n = Math.floor(t / 86400), o = Math.floor(t % 86400 / 3600), pp = Math.floor(t % 3600 / 60), m = t % 60;
        const k = v => String(v).padStart(2, "0");
        if (n > 0) return `${n}n ${k(o)}\u00F3 ${k(pp)}p ${k(m)}mp`;
        if (o > 0) return `${o}\u00F3 ${k(pp)}p ${k(m)}mp`;
        if (pp > 0) return `${pp}p ${k(m)}mp`;
        return `${m}mp`;
    }
    function helyBubHTML(elem) {
        const nev = elem.getAttribute("data-hb-nev") || "";
        const ido = elem.getAttribute("data-hb-ido") || "-";
        const tipp = elem.getAttribute("data-helybub") === "varos"
            ? "Kattints: v\u00E1ros megnyit\u00E1sa" : "K\u00E9t kattint\u00E1s: indul\u00E1s ide";
        return `<div class="cim">Oda\u00FAt</div><div class="hbnev">${esc(nev)}</div>`
            + `<div class="hbido">${esc(ido)}</div><div class="vonal"></div><div class="lab">${tipp}</div>`;
    }
    function setaIndit(el) {
        const J = jatek();
        if (!kinalatMegerosit(el, "Biztos? Indulás")) return;
        try {
            if (typeof J.TaskWalk !== "function" || !J.TaskQueue || typeof J.TaskQueue.add !== "function") {
                throw new Error("a játék séta-hívása nem érhető el");
            }
            J.TaskQueue.add(new J.TaskWalk(Number(el.getAttribute("data-seta")), "town",
                Number(el.getAttribute("data-seta-x")), Number(el.getAttribute("data-seta-y"))));
        } catch (err) {
            try { if (typeof J.MessageError === "function") new J.MessageError("Az indulás nem sikerült: " + err.message).show(); }
            catch (e) { /* nem baj */ }
        }
    }

    function nevKattintasKotes() {
        const stage = gyoker && gyoker.getElementById("stage");
        if (!stage || stage.dataset.nevkotve) return;
        stage.dataset.nevkotve = "1";
        stage.addEventListener("click", e => {
            const el = e.target.closest && e.target.closest("[data-tw-x], [data-pp], [data-seta]");
            if (!el) return;
            e.stopPropagation();
            if (el.hasAttribute("data-seta")) { setaIndit(el); return; }
            try {
                const J = jatek();
                if (el.hasAttribute("data-pp")) {
                    if (J.PlayerProfileWindow) J.PlayerProfileWindow.open(Number(el.getAttribute("data-pp")));
                } else if (J.TownWindow) {
                    J.TownWindow.open(Number(el.getAttribute("data-tw-x")), Number(el.getAttribute("data-tw-y")));
                }
            } catch (err) { /* a jatek ablaka nem nyilt meg */ }
        }, true);
    }

    function kezbesitesElerheto() {
        try { return !!(jatek().Premium && jatek().Premium.buyable && jatek().Premium.buyable.marketdelivery); }
        catch (e) { return false; }
    }

    function licitTolt() {
        if (licitek.allapot === "tolt") return;
        const A = jatek().Ajax;
        const futas = ++licitek.futas;
        licitek.allapot = "tolt";
        licitek.uzenet = "";
        const vege = () => { if (futas === licitek.futas && (beall.ful === "atvetel" || (beall.ful === "vetel" && beall.nezet.vetel === "licitjeim"))) rajzolHaSzabad(); };
        if (!A || typeof A.remoteCall !== "function") {
            licitek.allapot = "hiba"; licitek.uzenet = "A játék hívása nem érhető el."; vege(); return;
        }
        let megjott = false;
        const ora = setTimeout(() => {
            if (megjott || futas !== licitek.futas) return;
            megjott = true;
            licitek.allapot = "hiba"; licitek.uzenet = "Nem jött válasz 15 másodpercen belül."; vege();
        }, 15000);
        try {
            A.remoteCall("building_market", "fetch_bids", {}, valasz => {
                if (megjott || futas !== licitek.futas) return;
                megjott = true; clearTimeout(ora);
                const msg = valasz && valasz.msg;
                if (!valasz || valasz.error || !msg || !Array.isArray(msg.search_result)) {
                    licitek.allapot = "hiba";
                    licitek.uzenet = (valasz && typeof valasz.msg === "string" && valasz.msg) || "Váratlan válasz a szervertől.";
                } else {
                    licitek.sorok = msg.search_result.slice();
                    licitek.ido = Date.now();
                    licitek.allapot = "kesz";
                }
                vege();
            });
        } catch (e) {
            megjott = true; clearTimeout(ora);
            licitek.allapot = "hiba"; licitek.uzenet = "A hívás kivételt dobott: " + (e && e.message ? e.message : e); vege();
        }
    }

    function licitAllapotSzoveg() {
        if (licitek.allapot === "tolt") return "Betöltés…";
        if (licitek.allapot === "hiba") return "Hiba: " + licitek.uzenet;
        if (licitek.allapot === "ures") return "Még nincs letöltve.";
        const mp = Math.round((Date.now() - licitek.ido) / 1000);
        return mp < 60 ? "Betöltve most." : `Betöltve ${kinalatIdo(mp)} ezelőtt.`;
    }

    function licitUzenet(szoveg, hiba, nativ) {
        licitNezet.uzenet = szoveg;
        licitNezet.uzenetHiba = !!hiba;
        const el = gyoker && gyoker.getElementById("lvUzenet");
        if (el) { el.textContent = szoveg; el.classList.toggle("kvhiba", !!hiba); }
        uzenetIdozit("licit", szoveg, hiba, sz => { if (licitNezet.uzenet === sz) licitUzenet("", false, false); });
        if (!nativ || !szoveg) return;
        try {
            const J = jatek();
            const Oszt = hiba ? J.MessageError : J.MessageSuccess;
            if (typeof Oszt === "function") new Oszt(szoveg).show();
        } catch (e) { /* a panel uzenete eleg */ }
    }

    function licitFejHTML(extra) {
        return `
          <div class="kinalat-fej">
            <span class="kallapot" style="flex:1 1 auto;margin:0">${esc(licitAllapotSzoveg())}</span>
            ${extra || ""}
            <button type="button" class="gomb" data-licit-friss ${licitek.allapot === "tolt" ? "disabled" : ""}>Frissítés</button>
          </div>
          <div class="kvuzenet${licitNezet.uzenetHiba ? " kvhiba" : ""}" id="lvUzenet" role="status" style="margin-top:6px">${esc(licitNezet.uzenet)}</div>`;
    }

    function licitFrissKotes() {
        const g = gyoker.querySelector("[data-licit-friss]");
        if (g) g.addEventListener("click", () => {
            if (licitek.allapot === "tolt") return;
            licitek.allapot = "ures";
            licitTolt();
            if (beall.ful === "atvetel" && ajanlatok.allapot !== "tolt") {
                ajanlatok.allapot = "ures";
                ajanlatTolt();
            }
            rajzol();
        });
    }

    /* --- LICITJEIM --- */
    /* -----------------------------------------------------------------
       MEGFIGYELES (t35). A jatek sajat "Megfigyelt arveresek" listaja.
       MERVE (2026-09-20, konzol): get_watchlist {} -> msg TOMB (ures
       listanal 0 elem). A sor mezoi a Kinalat keresesenek mezoi, plusz
       seller_town_name: seller_name, seller_player_id, seller_town_name,
       market_town_id, market_town_name, market_town_x, market_town_y,
       market_offer_id, item_id, item_count, description, auction_price,
       max_price, current_bid, auction_end_date, auction_ends_in.
       Nincs benne, hogy te licitaltal-e ra. Felvetel: to_watchlist
       { offer_id }, levetel: delete_from_watchlist { offer_id }; a
       valasz msg-je szoveg. Mindketto merve ugyanakkor.
       ----------------------------------------------------------------- */
    const figyelo = { allapot: "ures", sorok: [], ido: 0, uzenet: "", uzenetHiba: false, futas: 0 };
    let figyeloKuldes = false;

    function figyeloAllapotSzoveg() {
        if (figyelo.allapot === "tolt") return "Bet\u00F6lt\u00E9s\u2026";
        if (figyelo.allapot === "hiba") return figyelo.uzenet || "Hiba.";
        if (figyelo.allapot !== "kesz") return "";
        const db = figyelo.sorok.length;
        return db ? `${db} megfigyelt \u00E1rver\u00E9s.` : "Nem figyelsz meg egy \u00E1rver\u00E9st sem.";
    }
    function figyeloHatra(s) {
        const alap = Number(s.auction_ends_in);
        if (!isFinite(alap)) return null;
        return alap - (Date.now() - (figyelo.ido || Date.now())) / 1000;
    }
    /* t79: a kozos szabaly (uzenetIdozit); a mulo jelzes mar nem szamit. */
    function figyeloUzenet(szoveg, hiba, mulo) {
        figyelo.uzenet = szoveg;
        figyelo.uzenetHiba = !!hiba;
        const el = gyoker && gyoker.getElementById("fvUzenet");
        if (el) { el.textContent = szoveg; el.classList.toggle("kvhiba", !!hiba); }
        uzenetIdozit("figyelo", szoveg, hiba, sz => { if (figyelo.uzenet === sz) figyeloUzenet("", false); });
    }
    function figyeloTolt() {
        if (figyelo.allapot === "tolt") return;
        const A = jatek().Ajax;
        const futas = ++figyelo.futas;
        figyelo.allapot = "tolt";
        const vege = () => { if (futas === figyelo.futas && beall.ful === "vetel" && beall.nezet.vetel === "megfigyeles") rajzolHaSzabad(); };
        if (!A || typeof A.remoteCall !== "function") {
            figyelo.allapot = "hiba"; figyelo.uzenet = "A j\u00E1t\u00E9k h\u00EDv\u00E1sa nem \u00E9rhet\u0151 el."; vege(); return;
        }
        let megjott = false;
        const ora = setTimeout(() => {
            if (megjott || futas !== figyelo.futas) return;
            megjott = true;
            figyelo.allapot = "hiba"; figyelo.uzenet = "Nem j\u00F6tt v\u00E1lasz 15 m\u00E1sodpercen bel\u00FCl."; vege();
        }, 15000);
        try {
            A.remoteCall("building_market", "get_watchlist", {}, valasz => {
                if (megjott || futas !== figyelo.futas) return;
                megjott = true; clearTimeout(ora);
                const msg = valasz && valasz.msg;
                if (!valasz || valasz.error || !Array.isArray(msg)) {
                    figyelo.allapot = "hiba";
                    figyelo.uzenet = (valasz && typeof valasz.msg === "string" && valasz.msg) || "V\u00E1ratlan v\u00E1lasz a szervert\u0151l.";
                } else {
                    figyelo.sorok = msg.slice();
                    figyelo.ido = Date.now();
                    figyelo.allapot = "kesz";
                }
                vege();
            });
        } catch (e) {
            megjott = true; clearTimeout(ora);
            figyelo.allapot = "hiba"; figyelo.uzenet = "A h\u00EDv\u00E1s kiv\u00E9telt dobott: " + (e && e.message ? e.message : e); vege();
        }
    }
    /* A sor ugyanaz a szerkezet, mint a Kinalatban, ezert data-kid: a
       valasztas es a vasarlasi sav ugyanazt a kodot hasznalja (t36). */
    function figyeloSorHTML(s) {
                const kep = targyIkon(s.item_id);
                const db = Number(s.item_count) || 1;
                const odaut = kinalatOdaut(s);
                const megj = s.description ? String(s.description) : "";
                const hatra = figyeloHatra(s);
                /* t42: a megfigyelesi listaba a jatek sajat ablakabol veteli
                   keres is bekerulhet. Arra a Kinalat SELL iranyu sava nem
                   mehet, ezert csak jeloljuk, es nem nyitunk savot. */
                const keresE = String((s && s.direction) || "SELL") === "BUY";
                const id = esc(String(s.market_offer_id));
                return `
              <div class="ksor2 fsor${keresE ? " fkeres" : ""}" data-kid="${id}"${keresE ? " data-fkeres=\"1\"" : ""}>
                ${targyBubIkonHTML(s.item_id, kep)}
                <div class="knev2 kn"><span class="knn">${esc(targyNev(s.item_id))}</span>${db > 1 ? `<span class="kdb">&times;${db}</span>` : ""}${keresE ? `<span class="fkerjel">v\u00E9teli k\u00E9r\u00E9s</span>` : ""}</div>
                <div class="jobb">${kinalatSzam(s.current_bid != null ? s.current_bid : s.auction_price)}</div>
                <div class="jobb kazon">${kinalatSzam(s.max_price)}</div>
                <div class="jobb">${esc(hatra != null && hatra <= 0 ? "lej\u00E1rt" : kinalatIdo(hatra))}</div>
                <div class="khely"><span>${megjJelHTML(megj)}${jatekosLinkHTML(s.seller_name, s.seller_player_id)}</span>
                  <span class="kvaros">${megjJelHTML("")}${varosLinkHTML(s.market_town_name, s.market_town_x, s.market_town_y, odaut)}${odaut != null ? " &middot; " + (odaut > 0 ? odautLinkHTML(kinalatIdo(odaut), s.market_town_id, s.market_town_x, s.market_town_y, s.market_town_name, odaut) : "itt vagy") : ""}</span></div>
                <div class="jobb"><button type="button" class="gomb agomb" data-fig-le="${id}">Leveszem</button></div>
              </div>`;
    }
    function megfigyelesHTML() {
        const sorok = figyelo.sorok.slice()
            .sort((a, b) => Number(a.auction_end_date) - Number(b.auction_end_date))
            .map(figyeloSorHTML).join("");
        const ures = figyelo.allapot === "kesz" && !figyelo.sorok.length
            ? `<p class="ures">Nem figyelsz meg egy \u00E1rver\u00E9st sem. A K\u00EDn\u00E1latban egy sorra kattintva veheted fel.</p>` : "";
        return `
          <div class="kinalat">
            <div class="kinalat-fej">
              <span class="kallapot" style="flex:1 1 auto;margin:0">${esc(figyeloAllapotSzoveg())}</span>
              <button type="button" class="gomb" data-fig-friss ${figyelo.allapot === "tolt" ? "disabled" : ""}>Friss\u00EDt\u00E9s</button>
            </div>
            <div class="kvuzenet${figyelo.uzenetHiba ? " kvhiba" : ""}" id="fvUzenet" role="status" style="margin-top:6px">${esc(figyelo.allapot === "hiba" ? "" : figyelo.uzenet)}</div>
            <div class="kfej2 ffej"><div></div><div class="krend">T\u00E1rgy</div><div class="krend jobb">Licit</div>
              <div class="krend jobb">Azonnal</div><div class="krend jobb">Lej\u00E1r</div><div class="krend knevhely">Elad\u00F3, hely</div><div></div></div>
            <div class="kinalatlista" id="figyeloLista">${sorok}</div>
            ${ures}
            <p class="labj">Ez a j\u00E1t\u00E9k saj\u00E1t megfigyel\u00E9si list\u00E1ja, ugyanaz l\u00E1tszik a Piac ablak Megfigyel\u00E9s f\u00FCl\u00E9n. A lev\u00E9tel k\u00E9t kattint\u00E1s.</p>
          </div>`;
    }
    function megfigyelesKotes() {
        const f = gyoker.querySelector("[data-fig-friss]");
        if (f) f.addEventListener("click", () => {
            if (figyelo.allapot === "tolt") return;
            figyeloUzenet("", false);
            figyelo.allapot = "ures";
            figyeloTolt();
            rajzolHaSzabad();
        });
        const lista = gyoker.getElementById("figyeloLista");
        if (lista && !lista.dataset.kotve) {
            lista.dataset.kotve = "1";
            lista.addEventListener("click", e => {
                if (!e.target.closest) return;
                if (e.target.closest("[data-fig-le]") || e.target.closest("#kinalatSav")) return;
                const sor = e.target.closest(".ksor2");
                if (!sor || kinalatKuldes) return;
                if (sor.getAttribute("data-fkeres")) {
                    figyeloUzenet("Ez egy v\u00E9teli k\u00E9r\u00E9s. Elad\u00E1s az Elad\u00E1s f\u00FCl M\u00E1sok k\u00E9r\u00E9sei n\u00E9zet\u00E9ben lesz.", false, true);
                    return;
                }
                const id = sor.getAttribute("data-kid");
                kinalatNezet.valasztott = kinalatNezet.valasztott === id ? null : id;
                kinalatSavFrissit();
            });
        }
        gyoker.querySelectorAll("[data-fig-le]").forEach(g => {
            g.addEventListener("click", () => {
                if (figyeloKuldes) return;
                if (!kinalatMegerosit(g, "Biztos?")) return;
                figyeloLevesz(g.getAttribute("data-fig-le"));
            });
        });
    }
    function figyeloLevesz(id) {
        const A = jatek().Ajax;
        if (!A || typeof A.remoteCall !== "function") { figyeloUzenet("A j\u00E1t\u00E9k h\u00EDv\u00E1sa nem \u00E9rhet\u0151 el.", true); return; }
        figyeloKuldes = true;
        figyeloUzenet("K\u00FCld\u00E9s\u2026", false);
        try {
            A.remoteCall("building_market", "delete_from_watchlist", { offer_id: id }, valasz => {
                figyeloKuldes = false;
                if (!valasz || valasz.error) {
                    figyeloUzenet((valasz && typeof valasz.msg === "string" && valasz.msg) || "A lev\u00E9tel nem siker\u00FClt.", true);
                } else {
                    figyelo.sorok = figyelo.sorok.filter(x => String(x.market_offer_id) !== String(id));
                    figyeloUzenet(typeof valasz.msg === "string" && valasz.msg ? valasz.msg : "Lev\u00E9ve a megfigyel\u00E9sr\u0151l.", false, true);
                }
                rajzolHaSzabad();
            });
        } catch (e) {
            figyeloKuldes = false;
            figyeloUzenet("A h\u00EDv\u00E1s kiv\u00E9telt dobott: " + (e && e.message ? e.message : e), true);
        }
    }
    /* Felvetel a Kinalat savjabol. A lista nem toltodik ujra itt, csak
       elavultnak jeloljuk: a Megfigyeles nezetre valtva jon le frissen. */
    function figyeloFelvesz(id, gomb) {
        const A = jatek().Ajax;
        if (!A || typeof A.remoteCall !== "function") { kinalatUzenet("A j\u00E1t\u00E9k h\u00EDv\u00E1sa nem \u00E9rhet\u0151 el.", true); return; }
        if (gomb) gomb.disabled = true;
        kinalatUzenet("K\u00FCld\u00E9s\u2026", false);
        try {
            A.remoteCall("building_market", "to_watchlist", { offer_id: id }, valasz => {
                if (gomb) gomb.disabled = false;
                if (!valasz || valasz.error) {
                    kinalatUzenet((valasz && typeof valasz.msg === "string" && valasz.msg) || "A felv\u00E9tel nem siker\u00FClt.", true);
                } else {
                    kinalatUzenet(typeof valasz.msg === "string" && valasz.msg ? valasz.msg : "Felv\u00E9ve a megfigyel\u00E9sre.", false, true);
                    figyelo.allapot = "ures";
                }
            });
        } catch (e) {
            if (gomb) gomb.disabled = false;
            kinalatUzenet("A h\u00EDv\u00E1s kiv\u00E9telt dobott: " + (e && e.message ? e.message : e), true);
        }
    }

    /* -----------------------------------------------------------------
       VETEL / KERESEIM (t80): sajat veteli keresek es uj keres feladasa.
       MERVE (2026-10-07, MERES-veteli-keresek.md):
         building_market / get_own_buy_offers { town_id } -> msg: [sorok];
           MINDEN piac kereset adja, barmelyik varos szamaval kerdezve
           (3453-ban feladott kerest a 4432 szamaval is visszaadta).
         putup + direction: "BUY", bidtype 0 keszpenz / 1 bank, auctioncount
           szovegkent ("1"); a licit nagyobb az azonnalinal (a jatek
           ellenorzi, szerver nem kap kerest). Levonas: a nagyobbik ar + dij.
         Minimum: ugyanaz, mint az eladase (eladMinimum), a TELJES arra:
           ar >= minimum x mennyiseg; a szerver ellenorzi, a natív urlap csak
           reszben (tobb darabnal felfele kerekitett egysegarral).
         Varoson kivul: expresssell (aranyrog), a jatek sajat ablakaval.
         offtake { offer_id, direction: "BUY" }: a piac varosaban ingyen,
           mashonnan "marketdelivery <id> <varos> offtake" (aranyrog).
         A futo keres nincs a fetch_offers es a fetch_bids listajaban.
         A teljesult keres (bidder kitoltve) helye az Atvetel (2. kor).
       ----------------------------------------------------------------- */
    const kerek = { allapot: "ures", sorok: [], ido: 0, uzenet: "", uzenetHiba: false, futas: 0 };
    const kerNezet = { kereses: "", valasztott: null, mezok: {}, megjegyzes: "", javAkt: 0 };
    let kerKuldes = false;
    const KER_LICIT_HIBA = "Az árverési árnak magasabbnak kell lennie az azonnali vételárnál.";
    const KER_MIN_HIBA = "A tárgy aukciós ára alacsonyabb a megengedett minimumnál.";
    const KER_PENZ_HIBA = "Nincs elég pénz ehhez a forráshoz.";
    const KER_EXPRESS_CIM = "Expressz kézbesítés";
    const KER_EXPRESS_SZOVEG = "Nem tartózkodsz piac közelében, ahol feltehetnéd az árut, de néhány aranyrögért cserébe ez innen is megoldható. Szeretnéd feltenni innen az ajánlatot?";

    function kerNapok() {
        const n = Number(beall.kerNapok);
        return n >= 1 && n <= 7 ? n : 1;
    }
    /* Barmelyik ervenyes varosszam jo (merve), ezert ami eppen ismert.
       t81 (A): az utoljara ismert szamot karakterenkent es vilagonkent
       eltaroljuk, igy varoson kivul, piacnyitas nelkul is van mivel kerdezni. */
    function kerVarosId() {
        const most = (eladHely.allapot === "kesz" && eladHely.townId > 0) ? eladHely.townId
            : (piacVarosId() || eladVarosTag() || 0);
        const k = tarKulcs();
        if (!beall.kerVarosok || typeof beall.kerVarosok !== "object" || Array.isArray(beall.kerVarosok)) beall.kerVarosok = {};
        if (most > 0) {
            if (k && beall.kerVarosok[k] !== most) { beall.kerVarosok[k] = most; beallMent(); }
            return most;
        }
        return (k && Number(beall.kerVarosok[k])) || 0;
    }
    /* Ha a lista varos hijan allt meg, es kozben ismertte valt egy varos
       (piacnyitas, varosba lepes), magatol ujratolt: egy keres, egyszer. */
    function kerVarosVarakozik() {
        if (kerek.allapot !== "hiba" || !kerek.nincsVaros) return;
        if (beall.ful !== "vetel" || beall.nezet.vetel !== "kereseim") return;
        if (!kerVarosId()) return;
        kerek.allapot = "ures";
        kerek.nincsVaros = false;
        kerTolt();
        rajzolHaSzabad();
    }
    /* t86: futo = nem teljesult (az ajanlatos keres is futo). A
       fetched_item a vevo, a fetched_money az elado atvetele (MERVE
       2026-10-08; a t83-as "bidder kitoltve = teljesult" teves volt). */
    function kerFutoE(s) {
        return !!s && !buyTeljesultE(s, kerHatra(s)) && !kerLejartE(s);
    }
    function kerTeljesultE(s) {
        return !!s && buyTeljesultE(s, kerHatra(s)) && !s.fetched_item;
    }
    /* t87: lejart, nem teljesult keres (MERVE 2026-10-08, 40393): a sor a
       get_own_buy_offers-ben marad (current_bid null, hatra <= 0); az ar
       fetch-csel jon vissza (max_price, a dij nem), utana a sor eltunik. */
    function kerLejartE(s) {
        if (!s || s.current_bid != null || s.fetched_item) return false;
        const h = kerHatra(s);
        return h != null && h <= 0;
    }
    function kerAtvehetoE(s) { return kerTeljesultE(s) || kerLejartE(s); }
    function kerFutoSorok() {
        return kerek.sorok.filter(kerFutoE);
    }
    function kerUzenet(szoveg, hiba) {
        kerek.uzenet = szoveg;
        kerek.uzenetHiba = !!hiba;
        const el = gyoker && gyoker.getElementById("krUzenet");
        if (el) { el.textContent = szoveg; el.classList.toggle("kvhiba", !!hiba); }
        uzenetIdozit("keres", szoveg, hiba, sz => { if (kerek.uzenet === sz) kerUzenet("", false); });
    }
    function kerTolt() {
        if (kerek.allapot === "tolt") return;
        const A = jatek().Ajax;
        const futas = ++kerek.futas;
        const vege = () => {
            if (futas !== kerek.futas) return;
            if ((beall.ful === "vetel" && beall.nezet.vetel === "kereseim") || beall.ful === "atvetel") rajzolHaSzabad();
        };
        const vid = kerVarosId();
        /* A hely meg jon: a valasza utan (eladHelyTolt) indul. */
        if (!vid && eladHely.allapot === "tolt") return;
        kerek.allapot = "tolt";
        if (!A || typeof A.remoteCall !== "function") {
            kerek.allapot = "hiba"; kerek.hibaSz = "A játék hívása nem érhető el."; vege(); return;
        }
        kerek.nincsVaros = false;
        if (!vid) {
            kerek.allapot = "hiba"; kerek.nincsVaros = true;
            kerek.hibaSz = "Nincs célváros: nyiss meg egyszer egy piacot, vagy állj városba."; vege(); return;
        }
        let megjott = false;
        const ora = setTimeout(() => {
            if (megjott || futas !== kerek.futas) return;
            megjott = true;
            kerek.allapot = "hiba"; kerek.hibaSz = "Nem jött válasz 15 másodpercen belül."; vege();
        }, 15000);
        try {
            A.remoteCall("building_market", "get_own_buy_offers", { town_id: vid }, valasz => {
                if (megjott || futas !== kerek.futas) return;
                megjott = true; clearTimeout(ora);
                const msg = valasz && valasz.msg;
                if (!valasz || valasz.error || !Array.isArray(msg)) {
                    kerek.allapot = "hiba";
                    kerek.hibaSz = (valasz && typeof valasz.msg === "string" && valasz.msg) || "Váratlan válasz a szervertől.";
                } else {
                    kerek.sorok = msg.slice();
                    kerek.ido = Date.now();
                    kerek.allapot = "kesz";
                }
                vege();
            });
        } catch (e) {
            megjott = true; clearTimeout(ora);
            kerek.allapot = "hiba"; kerek.hibaSz = "A hívás kivételt dobott: " + (e && e.message ? e.message : e); vege();
        }
    }
    function kerHatra(s) {
        const alap = Number(s.auction_ends_in);
        if (!isFinite(alap)) return null;
        return alap - (Date.now() - (kerek.ido || Date.now())) / 1000;
    }
    function kerCsoportok() {
        const m = new Map();
        kerFutoSorok().forEach(s => {
            const k = String(s.market_town_id);
            if (!m.has(k)) m.set(k, { id: k, nev: s.market_town_name, x: s.market_town_x, y: s.market_town_y,
                                      itt: itteniVarosE(s), odaut: kinalatOdaut(s), sorok: [] });
            m.get(k).sorok.push(s);
        });
        m.forEach(c => c.sorok.sort((a, b) => Number(a.auction_end_date) - Number(b.auction_end_date)));
        return [...m.values()].sort((a, b) => (b.itt - a.itt) || ((a.odaut ?? Infinity) - (b.odaut ?? Infinity)));
    }
    function kerSor(id) {
        return kerek.sorok.find(s => String(s.market_offer_id) === String(id)) || null;
    }

    /* --- Uj keres: kereso. Minden arverezheto alaptargy (az ItemManager
       alapazonositoi, ezredre kerek szamok). --- */
    let kerTargyLista = null;
    function kerTargyak() {
        if (kerTargyLista) return kerTargyLista;
        const ki = [];
        try {
            const IM = jatek().ItemManager;
            const mind = IM && typeof IM.getAll === "function" ? IM.getAll() : null;
            if (mind) Object.keys(mind).forEach(k => {
                const it = mind[k];
                const id = Number(it && (it.item_id != null ? it.item_id : k));
                if (!it || !(id > 0) || id % 1000 !== 0 || it.auctionable === false) return;
                const nev = String(it.name || "");
                if (!nev) return;
                ki.push({ id: String(id), nev: nev, n: piacNormal(nev) });
            });
        } catch (e) { /* ures marad */ }
        if (ki.length) kerTargyLista = ki;
        return ki;
    }
    function kerJavaslatok(q) {
        const n = piacNormal(q);
        if (!n) return [];
        const kezd = [], szokezd = [], benne = [];
        kerTargyak().forEach(t => {
            const i = t.n.indexOf(n);
            if (i < 0) return;
            if (i === 0) kezd.push(t);
            else if (t.n[i - 1] === " " || t.n[i - 1] === "-") szokezd.push(t);
            else benne.push(t);
        });
        const r = (a, b) => a.nev.localeCompare(b.nev, "hu");
        return kezd.sort(r).concat(szokezd.sort(r), benne.sort(r)).slice(0, 8);
    }

    /* --- A feladosav --- */
    function kerMezok(id) {
        if (!kerNezet.mezok[id]) kerNezet.mezok[id] = { licit: "", azonnali: "", menny: "1" };
        return kerNezet.mezok[id];
    }
    function kerMennySzam(id) {
        const m = eladSzam(kerMezok(id).menny);
        return m != null && !isNaN(m) ? m : 1;
    }
    function kerMinOssz(id) {
        const min = eladMinimum(id);
        return min > 0 ? min * kerMennySzam(id) : 0;
    }
    /* A natív sorrend: elobb a licit > azonnali, utana a minimum. */
    function kerErtekel(id) {
        const m = kerMezok(id);
        const licit = eladSzam(m.licit), azonnali = eladSzam(m.azonnali), menny = eladSzam(m.menny);
        const ki = { licit, azonnali, menny, napok: kerNapok(), hiba: "", ar: null };
        if ((licit != null && isNaN(licit)) || (azonnali != null && isNaN(azonnali))) { ki.hiba = "Az ár pozitív egész szám legyen."; return ki; }
        if (menny == null || isNaN(menny)) { ki.hiba = "A mennyiség pozitív egész szám legyen."; return ki; }
        if (licit == null && azonnali == null) { ki.hiba = ELAD_NINCS_AR; ki.ures = true; return ki; }
        if (licit != null && azonnali != null && licit <= azonnali) { ki.hiba = KER_LICIT_HIBA; return ki; }
        const min = eladMinimum(id) * menny;
        if (min > 0 && ((licit != null && licit < min) || (azonnali != null && azonnali < min))) { ki.hiba = KER_MIN_HIBA; return ki; }
        ki.ar = Math.max(licit || 0, azonnali || 0);
        return ki;
    }
    /* Vetelnel a nagyobbik arbol (merve, 26 pont); az arveresek szama 1. */
    function kerDij(e, cel) {
        if (!cel || !cel.mehet || !(cel.szint > 0) || e.hiba || !(e.ar > 0)) return null;
        let max = 10;
        try { max = Number(jatek().MarketWindow.maxstage) || 10; } catch (x) { max = 10; }
        const alap = Math.floor(e.ar * 0.02 * max + e.napok * 3);
        return Math.ceil(alap / cel.szint * (cel.townId === eladVarosTag() ? 1 : 2));
    }
    function kerPenz() {
        try {
            const C = jatek().Character;
            return { keszpenz: Number(C.money) || 0, bank: Number(C.deposit) || 0 };
        } catch (e) { return { keszpenz: 0, bank: 0 }; }
    }
    function kerSavHTML(id) {
        const m = kerMezok(id);
        const ph = kerMinOssz(id);
        const phSz = ph > 0 ? ` placeholder="${ph}"` : "";
        const min = eladMinimum(id);
        const taska = Number(keszlet(id)) || 0;
        const napok = kerNapok();
        return `
          <div class="kvsav esav krsav" id="kerSav">
            <div class="krsav-cim">${esc(targyNev(id))} <span class="halvany">Táskádban: ${kinalatSzam(taska)} db${min > 0 ? ` · a játék minimuma ${kinalatSzam(min)} $/db` : ""}</span></div>
            <div class="emezok">
              <span class="emz">Legnagyobb licit <input id="krLicit" inputmode="numeric" autocomplete="off" aria-label="Legnagyobb licit" value="${esc(m.licit)}"${phSz}> ${`<span class="edollar" data-krdollar="krLicit" title="A halvány szám beírása">$</span>`}</span>
              <span class="emz">Azonnali vételár <input id="krAzonnali" inputmode="numeric" autocomplete="off" aria-label="Azonnali vételár" value="${esc(m.azonnali)}"${phSz}> ${`<span class="edollar" data-krdollar="krAzonnali" title="A halvány szám beírása">$</span>`}</span>
              <label class="emz">Mennyiség <input id="krMenny" class="rovid" inputmode="numeric" autocomplete="off" value="${esc(m.menny)}"></label>
            </div>
            <div class="emezok">
              <span class="emz">Időtartam
                <span class="pkatvalaszto" role="group" aria-label="Időtartam">${[1, 2, 3, 4, 5, 6, 7].map(n =>
                  `<button type="button" class="pkat${napok === n ? " aktiv" : ""}" data-krnap="${n}" aria-pressed="${napok === n ? "true" : "false"}">${n}</button>`).join("")}</span> nap</span>
            </div>
            <label class="emz eszeles">Megjegyzés a vásárláshoz <input id="krMegj" autocomplete="off" spellcheck="false" value="${esc(kerNezet.megjegyzes)}"></label>
            <div class="kvhiba ehiba" id="krHiba"></div>
            <div class="elab">
              <span><span id="krOssz"></span><span class="krpenz" id="krPenz"></span></span>
              <span class="egombok">
                <button type="button" class="gomb agomb" data-krmegse>Mégse</button>
                <button type="button" class="gomb" data-krfizet="0">Készpénz</button>
                <button type="button" class="gomb" data-krfizet="1">Bankszámla</button>
              </span>
            </div>
            <div class="kvlab" id="krInfo"></div>
          </div>`;
    }
    function kerSavSzamol() {
        const sav = gyoker && gyoker.getElementById("kerSav");
        const id = kerNezet.valasztott;
        if (!sav || !id) return;
        const e = kerErtekel(id);
        const cel = eladCel();
        const dij = kerDij(e, cel);
        const p = kerPenz();
        const hibaEl = gyoker.getElementById("krHiba");
        const ossz = gyoker.getElementById("krOssz");
        const penz = gyoker.getElementById("krPenz");
        const info = gyoker.getElementById("krInfo");
        if (hibaEl) hibaEl.textContent = e.ures ? "" : e.hiba;
        if (ossz) {
            if (e.ures) ossz.innerHTML = `<span class="halvany">${ELAD_NINCS_AR}</span>`;
            else if (e.hiba) ossz.innerHTML = "";
            else {
                const dijSz = !cel.mehet ? "-" : (cel.helyben ? (dij != null ? `kb. <b>${kinalatSzam(dij)} $</b>` : "-") : "nem ismert");
                ossz.innerHTML = `Levonás most: <b>${kinalatSzam(e.ar)} $</b> + díj ${dijSz}` +
                    (dij != null ? ` = <b>${kinalatSzam(e.ar + dij)} $</b>` : "");
            }
        }
        if (penz) penz.textContent = `Készpénz: ${kinalatSzam(p.keszpenz)} $ · Bankszámla: ${kinalatSzam(p.bank)} $`;
        if (info) {
            const min = eladMinimum(id);
            const n = kerMennySzam(id);
            const minSz = min > 0 ? `A minimum a teljes árra vonatkozik${n > 1 ? `: ${n} db esetén ${kinalatSzam(min * n)} $` : ""}.` : "";
            const celSz = !cel.mehet ? cel.ok
                : (cel.helyben ? "" : `Aranyrögért, a játék saját ablakával. Cél: ${cel.celSzoveg}.`);
            info.textContent = [minSz, "A licitnek nagyobbnak kell lennie az azonnali vételárnál.",
                "Visszavonáskor az ár készpénzbe jön vissza, a díj elvész.", celSz].filter(Boolean).join(" ");
            info.classList.toggle("kvhiba", !cel.mehet);
        }
        const kell = e.ar != null ? e.ar + (dij || 0) : 0;
        sav.querySelectorAll("[data-krfizet]").forEach(g => {
            const bank = g.getAttribute("data-krfizet") === "1";
            const felirat = (bank ? "Bankszámla" : "Készpénz") + (cel.mehet && !cel.helyben ? " aranyrögért" : "");
            if (!g.dataset.eredeti && g.textContent !== felirat) g.textContent = felirat;
            const nincs = !e.hiba && kell > (bank ? p.bank : p.keszpenz);
            g.disabled = kerKuldes || !!e.hiba || !cel.mehet || nincs;
            g.title = e.hiba || (!cel.mehet ? cel.ok : (nincs ? KER_PENZ_HIBA : ""));
        });
    }
    function kerDollarFrissit() {
        if (!gyoker) return;
        gyoker.querySelectorAll("#kerSav [data-krdollar]").forEach(d => {
            const f = gyoker.getElementById(d.getAttribute("data-krdollar"));
            d.classList.toggle("aktiv", !!(f && f.value.trim() === "" && f.placeholder));
        });
    }
    function kerSavFokuszban() {
        /* Csak beviteli mezo: a gombra kattintas utan rajzolhatunk. */
        const a = gyoker && gyoker.activeElement;
        return !!(a && a.tagName === "INPUT" && a.closest && (a.closest("#kerSav") || a.id === "krKereses"));
    }
    function kerSavKotes() {
        const sav = gyoker.getElementById("kerSav");
        const id = kerNezet.valasztott;
        if (!sav || !id) return;
        const visszaGombok = () => sav.querySelectorAll("[data-krfizet]").forEach(g => kinalatMegerositesVissza(g));
        const mezo = (azon, kulcs) => {
            const el = gyoker.getElementById(azon);
            if (!el) return;
            el.addEventListener("focus", () => { try { el.select(); } catch (e) { /* nem baj */ } });
            el.addEventListener("dragstart", e => e.preventDefault());
            el.addEventListener("drop", e => e.preventDefault());
            el.addEventListener("input", () => {
                if (kulcs === "megj") kerNezet.megjegyzes = el.value;
                else {
                    const mz = kerMezok(id);
                    mz[kulcs] = el.value;
                    if (kulcs === "licit" || kulcs === "azonnali") delete mz[kulcs + "Dollar"];
                }
                if (kulcs === "menny") {
                    const v = kerMinOssz(id);
                    const mz = kerMezok(id);
                    [["krLicit", "licit"], ["krAzonnali", "azonnali"]].forEach(([a, k]) => {
                        const f = gyoker.getElementById(a);
                        if (f) { if (v > 0) f.placeholder = String(v); else f.removeAttribute("placeholder"); }
                        if (mz[k + "Dollar"] && v > 0) { mz[k] = String(v); if (f) f.value = String(v); }
                    });
                }
                visszaGombok();
                kerDollarFrissit();
                kerSavSzamol();
            });
        };
        mezo("krLicit", "licit");
        mezo("krAzonnali", "azonnali");
        mezo("krMenny", "menny");
        mezo("krMegj", "megj");
        sav.querySelectorAll("[data-krdollar]").forEach(d => d.addEventListener("click", () => {
            if (!d.classList.contains("aktiv")) return;
            const f = gyoker.getElementById(d.getAttribute("data-krdollar"));
            if (!f || f.value.trim() !== "" || !f.placeholder) return;
            f.value = f.placeholder;
            f.dispatchEvent(new Event("input", { bubbles: true }));
            kerMezok(id)[(f.id === "krLicit" ? "licit" : "azonnali") + "Dollar"] = true;
        }));
        sav.querySelectorAll("[data-krnap]").forEach(g => g.addEventListener("click", () => {
            beall.kerNapok = Number(g.getAttribute("data-krnap")) || 1;
            beallMent();
            sav.querySelectorAll("[data-krnap]").forEach(x => {
                const a = x === g;
                x.classList.toggle("aktiv", a);
                x.setAttribute("aria-pressed", a ? "true" : "false");
            });
            visszaGombok();
            kerSavSzamol();
        }));
        const megse = sav.querySelector("[data-krmegse]");
        if (megse) megse.addEventListener("click", () => { kerNezet.valasztott = null; rajzolHaSzabad(); });
        sav.querySelectorAll("[data-krfizet]").forEach(g => g.addEventListener("click", () => {
            if (g.disabled || kerKuldes) return;
            const e = kerErtekel(id);
            const cel = eladCel();
            if (e.hiba || !cel.mehet) { kerSavSzamol(); return; }
            if (cel.helyben) {
                const dij = kerDij(e, cel);
                if (!kinalatMegerosit(g, dij != null ? `Biztos? Díj kb. ${kinalatSzam(dij)} $` : "Biztos?")) return;
            }
            kerKuld(id, e, cel, g.getAttribute("data-krfizet") === "1" ? 1 : 0);
        }));
        kerDollarFrissit();
        kerSavSzamol();
    }
    function kerUtan() {
        sajatAtvIdo = Date.now();
        kerKuldes = false;
        kerek.allapot = "ures";
        kerTolt();
        rajzol();
    }
    function kerKuld(id, e, cel, bidtype) {
        const J = jatek(), A = J.Ajax;
        if (kerKuldes) return;
        const obj = {
            town_id: cel.townId, item_id: Number(id), itemcount: e.menny, auctioncount: "1", sellrights: 2,
            auctionlength: e.napok, description: String(kerNezet.megjegyzes || ""), direction: "BUY", bidtype: bidtype
        };
        if (e.licit != null) obj.auctionprice = e.licit;
        if (e.azonnali != null) obj.maxprice = e.azonnali;
        const leiras = `${targyNev(id)}${e.menny > 1 ? " \u00D7" + e.menny : ""}`;
        const siker = uzenet => {
            delete kerNezet.mezok[id];
            kerNezet.valasztott = null;
            kerNezet.kereses = "";
            kerUzenet(uzenet, false);
            kerUtan();
        };
        kerKuldes = true;
        kerSavSzamol();
        if (!cel.helyben) {
            if (!J.Premium || typeof J.Premium.confirmUse !== "function") {
                kerUzenet("Az aranyrögös feladás most nem érhető el.", true);
                kerKuldes = false; kerSavSzamol(); return;
            }
            try {
                J.Premium.confirmUse("expresssell " + JSON.stringify(obj), KER_EXPRESS_CIM, KER_EXPRESS_SZOVEG, null, null,
                    resp => {
                        try {
                            const ad = resp && resp.activationdata;
                            if (ad) {
                                if (ad.deposit != null) J.Character.setDeposit(ad.deposit);
                                if (ad.cash != null) J.Character.setMoney(ad.cash);
                            }
                        } catch (x) { /* nem baj */ }
                        siker(`Feladva aranyrögért: ${leiras}.`);
                    },
                    () => { kerUzenet("Feladás megszakítva, semmi nem történt.", false); kerKuldes = false; kerSavSzamol(); });
            } catch (x) {
                kerUzenet("A játék ablaka nem nyílt meg: " + (x && x.message ? x.message : x), true);
                kerKuldes = false; kerSavSzamol();
            }
            return;
        }
        if (!A || typeof A.remoteCall !== "function") {
            kerUzenet("A játék hívása nem érhető el.", true);
            kerKuldes = false; kerSavSzamol(); return;
        }
        kerUzenet("Küldés…", false);
        try {
            A.remoteCall("building_market", "putup", obj, valasz => {
                const msg = valasz && valasz.msg;
                if (!valasz || valasz.error) {
                    kerUzenet((valasz && typeof valasz.msg === "string" && valasz.msg) || "A szerver elutasította.", true);
                    kerKuldes = false; kerSavSzamol();
                    return;
                }
                try {
                    if (msg && msg.money != null) J.Character.setMoney(msg.money);
                    if (msg && msg.deposit != null) J.Character.setDeposit(msg.deposit);
                } catch (x) { /* nem baj */ }
                const costs = msg && msg.costs != null && isFinite(Number(msg.costs)) ? Number(msg.costs) : null;
                siker(`Feladva: ${leiras}.${costs != null ? " Díj: " + kinalatSzam(costs) + " $." : ""}`);
            });
        } catch (x) {
            kerUzenet("A hívás kivételt dobott: " + (x && x.message ? x.message : x), true);
            kerKuldes = false; kerSavSzamol();
        }
    }

    /* --- Visszavonas: helyben ingyen, mashonnan aranyrogert (merve). --- */
    function kerOfftake(id) {
        const A = jatek().Ajax;
        const s = kerSor(id);
        if (kerKuldes || !A || !s) return;
        if (!itteniVarosE(s)) { kerUzenet("Helyben csak a piac városában vonható vissza.", true); return; }
        kerKuldes = true;
        kerUzenet("Visszavonás…", false);
        try {
            A.remoteCall("building_market", "offtake", { offer_id: s.market_offer_id, direction: "BUY" }, valasz => {
                if (!valasz || valasz.error) {
                    kerUzenet((valasz && typeof valasz.msg === "string" && valasz.msg) || "A visszavonás nem sikerült.", true);
                } else {
                    kerUzenet(`Visszavonva: ${targyNev(s.item_id)}. Az ár a készpénzedbe jött vissza.`, false);
                }
                kerUtan();
            });
        } catch (e) {
            kerUzenet("A hívás kivételt dobott: " + (e && e.message ? e.message : e), true);
            kerUtan();
        }
    }
    function kerKezbesit(id) {
        const J = jatek();
        const s = kerSor(id);
        if (kerKuldes || !s) return;
        if (itteniVarosE(s)) { kerUzenet("Már a városban vagy, itt ingyen visszavonhatod.", false); rajzolHaSzabad(); return; }
        const vid = kezbesitesVaros(s.market_town_id);
        if (!vid || !kezbesitesElerheto() || !J.Premium || typeof J.Premium.confirmUse !== "function") {
            kerUzenet("A kézbesítés most nem érhető el.", true);
            return;
        }
        kerKuldes = true;
        try {
            J.Premium.confirmUse("marketdelivery " + s.market_offer_id + " " + vid + " offtake", KEZB_CIM, KEZB_EGY,
                null, null,
                resp => {
                    try {
                        const ad = resp && resp.activationdata;
                        if (ad) {
                            if (ad.deposit != null) J.Character.setDeposit(ad.deposit);
                            if (ad.money != null) J.Character.setMoney(ad.money);
                        }
                    } catch (e) { /* nem baj */ }
                    kerUzenet(`Visszavonva: ${targyNev(s.item_id)}. Az ár a készpénzedbe jött vissza.`, false);
                    kerUtan();
                },
                () => { kerKuldes = false; kerUzenet("Kézbesítés megszakítva, semmi nem történt.", false); rajzolHaSzabad(); });
        } catch (e) {
            kerUzenet("A játék ablaka nem nyílt meg: " + (e && e.message ? e.message : e), true);
            kerKuldes = false;
        }
    }

    function kereseimHTML() {
        let allapotSz;
        if (kerek.allapot === "tolt") allapotSz = "Betöltés…";
        else if (kerek.allapot === "hiba") allapotSz = "Hiba: " + (kerek.hibaSz || "");
        else if (kerek.allapot === "ures") allapotSz = "Még nincs letöltve.";
        else {
            const mp = Math.round((Date.now() - kerek.ido) / 1000);
            allapotSz = mp < 60 ? "Betöltve most." : `Betöltve ${kinalatIdo(mp)} ezelőtt.`;
        }
        const tilt = kerKuldes ? " disabled" : "";
        const kezb = kezbesitesElerheto();
        const csoportok = kerCsoportok().map(c => `
          <div class="acs">
            <div class="ach"><b>${varosLinkHTML(c.nev, c.x, c.y)}</b>
              ${c.itt ? `<span class="aitt">itt vagy</span>` : (c.odaut != null ? `<span class="kvaros">odaút ${odautLinkHTML(teljesIdo(c.odaut), c.id, c.x, c.y)}</span>` : "")}
            </div>
            ${c.sorok.map(s => {
                const db = Number(s.item_count) || 1;
                const megj = s.description ? String(s.description) : "";
                const oid = esc(String(s.market_offer_id));
                /* t86: ajanlat utan nem vonhato vissza (a natív listaban
                   sincs X, MERVE 2026-10-08). */
                const vanAj = s.current_bid != null;
                const gomb = vanAj
                    ? `<span class="halvany">van aj\u00E1nlat</span>`
                    : c.itt
                    ? `<button type="button" class="gomb agomb" data-kr-vissza="${oid}"${tilt}>Visszavonom</button>`
                    : `<button type="button" class="gomb agomb ket" data-kr-kezb="${oid}"${kerKuldes || !kezb ? " disabled" : ""}
                        title="${esc(kezb ? "Aranyrögért, a játék saját ablakával" : "A kézbesítés most nem érhető el.")}"
                        aria-label="Visszavonom aranyrögért">Visszavonom<br>(aranyrög)</button>`;
                return `
                  <div class="osor krsor">
                    ${targyBubIkonHTML(s.item_id, targyIkon(s.item_id))}
                    <div class="knev2 kn"><span class="knn">${esc(targyNev(s.item_id))}</span>${db > 1 ? `<span class="kdb">&times;${db}</span>` : ""}</div>
                    <div class="jobb">${s.auction_price != null ? `<span class="halvany">${kinalatSzam(s.auction_price)}</span>` : "-"}</div>
                    <div class="jobb kazon">${kinalatSzam(s.max_price)}</div>
                    <div class="jobb">${esc(kinalatIdo(kerHatra(s)))}</div>
                    <div class="aelado">${megjJelHTML(megj)}${vanAj ? `<span class="kall">aj\u00E1nlat <b>${kinalatSzam(s.current_bid)} $</b><br>${jatekosLinkHTML(s.bidder_name, s.bidder_player_id)}</span>` : ""}</div>
                    <div class="jobb">${gomb}</div>
                  </div>`;
            }).join("")}
          </div>`).join("");
        const ures = kerek.allapot === "kesz" && !kerFutoSorok().length ? `<p class="ures">Nincs futó vételi kérésed.</p>` : "";
        const jav = kerNezet.valasztott ? [] : kerJavaslatok(kerNezet.kereses);
        if (kerNezet.javAkt >= jav.length) kerNezet.javAkt = 0;
        const javHTML = jav.length ? `<ul class="jlista" id="krJavaslat" role="listbox">${jav.map((t, i) =>
            `<li data-krjav="${esc(t.id)}" role="option" class="${i === kerNezet.javAkt ? "akt" : ""}">${(k => k ? `<img class="jikon" src="${esc(k)}" alt="" data-iid="${esc(t.id)}">` : `<span class="jikon ures" aria-hidden="true" data-iid="${esc(t.id)}"></span>`)(targyIkon(t.id))}<span class="jnev">${esc(t.nev)}</span></li>`).join("")}</ul>` : "";
        return `
          <div class="kinalat">
            <div class="kinalat-fej">
              <span class="kallapot krallapot" style="margin:0">${esc(allapotSz)}</span>
              <button type="button" class="gomb" data-kr-friss ${kerek.allapot === "tolt" ? "disabled" : ""}>Frissítés</button>
            </div>
            <div class="kvuzenet${kerek.uzenetHiba ? " kvhiba" : ""}" id="krUzenet" role="status" style="margin-top:6px">${esc(kerek.uzenet)}</div>
            <div class="krkereso">
              <div class="piacmezo">
                <input id="krKereses" autocomplete="off" spellcheck="false" placeholder="Új kérés: tárgy neve" value="${esc(kerNezet.kereses)}">
                <button type="button" class="torlo" data-krtorol aria-label="Keresés törlése"${kerNezet.kereses ? "" : " hidden"}>✕</button>
                ${javHTML}
              </div>
            </div>
            ${kerNezet.valasztott ? kerSavHTML(kerNezet.valasztott) : ""}
            <div class="ofej krfej"><div></div><div>Tárgy</div><div class="jobb">Licit</div><div class="jobb">Azonnali</div>
              <div class="jobb">Lejár</div><div></div><div></div></div>
            <div class="kinalatlista atvlista" id="kerLista">${csoportok}${ures}</div>
            <p class="labj">A saját vételi kéréseid, piaconként. A teljesült kérés tárgyát és a lejárt kérés árát az Átvétel / Vételi kéréseim nézetben veszed át. Minden valódi művelet két kattintás.</p>
          </div>`;
    }
    function kereseimKotes() {
        const f = gyoker.querySelector("[data-kr-friss]");
        if (f) f.addEventListener("click", () => {
            if (kerek.allapot === "tolt") return;
            kerUzenet("", false);
            kerek.allapot = "ures";
            kerTolt();
            rajzolHaSzabad();
        });
        const k = gyoker.getElementById("krKereses");
        if (k) {
            const valaszt = tid => {
                kerNezet.valasztott = String(tid);
                kerNezet.kereses = targyNev(tid);
                kerNezet.javAkt = 0;
                rajzol();
            };
            k.addEventListener("input", () => {
                kerNezet.kereses = k.value;
                kerNezet.javAkt = 0;
                if (kerNezet.valasztott) kerNezet.valasztott = null;
                const poz = k.selectionStart;
                rajzol();
                const uj = gyoker.getElementById("krKereses");
                if (uj) { uj.focus(); try { uj.setSelectionRange(poz, poz); } catch (e) { /* nem baj */ } }
            });
            k.addEventListener("keydown", e => {
                const lis = [...gyoker.querySelectorAll("#krJavaslat [data-krjav]")];
                if (e.key === "ArrowDown" || e.key === "ArrowUp") {
                    if (!lis.length) return;
                    e.preventDefault();
                    kerNezet.javAkt = (kerNezet.javAkt + (e.key === "ArrowDown" ? 1 : lis.length - 1)) % lis.length;
                    lis.forEach((li, i) => li.classList.toggle("akt", i === kerNezet.javAkt));
                } else if (e.key === "Enter") {
                    if (!lis.length) return;
                    e.preventDefault();
                    valaszt(lis[kerNezet.javAkt].getAttribute("data-krjav"));
                } else if (e.key === "Escape") {
                    kerNezet.kereses = ""; kerNezet.valasztott = null; rajzol();
                }
            });
            gyoker.querySelectorAll("#krJavaslat [data-krjav]").forEach(li => {
                li.addEventListener("mousedown", e => e.preventDefault());
                li.addEventListener("click", () => valaszt(li.getAttribute("data-krjav")));
            });
        }
        const t = gyoker.querySelector("[data-krtorol]");
        if (t) t.addEventListener("click", () => { kerNezet.kereses = ""; kerNezet.valasztott = null; rajzol(); });
        gyoker.querySelectorAll("[data-kr-vissza]").forEach(g => g.addEventListener("click", () => {
            if (g.disabled || kerKuldes) return;
            if (!kinalatMegerosit(g, "Biztos? A díj elvész")) return;
            kerOfftake(g.getAttribute("data-kr-vissza"));
        }));
        gyoker.querySelectorAll("[data-kr-kezb]").forEach(g => g.addEventListener("click", () => {
            if (g.disabled || kerKuldes) return;
            kerKezbesit(g.getAttribute("data-kr-kezb"));
        }));
        kerSavKotes();
    }

    function licitjeimHTML() {
        const vetelek = licitVeteliSorok();
        const futo = vetelek.filter(s => !licitAtveheto(s))
            .sort((a, b) => Number(a.auction_end_date) - Number(b.auction_end_date));
        const atv = vetelek.length - futo.length;
        const sorok = futo.map(s => {
            const kep = targyIkon(s.item_id);
            const db = Number(s.item_count) || 1;
            const odaut = kinalatOdaut(s);
            const megj = s.description ? String(s.description) : "";
            return `
              <div class="ksor2 lsor">
                ${targyBubIkonHTML(s.item_id, kep)}
                <div class="knev2 kn"><span class="knn">${esc(targyNev(s.item_id))}</span>${db > 1 ? `<span class="kdb">&times;${db}</span>` : ""}</div>
                <div class="jobb kvez" title="Te vezetsz">&#9733; ${kinalatSzam(s.current_bid)}</div>
                <div class="jobb kazon">${kinalatSzam(s.max_price)}</div>
                <div class="jobb">${esc(kinalatIdo(licitHatra(s)))}</div>
                <div class="khely"><span>${megjJelHTML(megj)}${jatekosLinkHTML(s.seller_name, s.seller_player_id)}</span>
                  <span class="kvaros">${megjJelHTML("")}${varosLinkHTML(s.market_town_name, s.market_town_x, s.market_town_y, odaut)}${odaut != null ? " &middot; " + (odaut > 0 ? odautLinkHTML(kinalatIdo(odaut), s.market_town_id, s.market_town_x, s.market_town_y, s.market_town_name, odaut) : "itt vagy") : ""}</span></div>
              </div>`;
        }).join("");
        /* t86: a veteli keresekre tett futo ajanlataid, kulon csoportban,
           mint a natív "Sajat licitek" fulon. A mar letoltott fetch_bids
           sorokbol, kulon keres nelkul. */
        const ajanlatok = licitek.sorok.filter(buyFutoAjanlatE)
            .sort((a, b) => Number(a.auction_end_date) - Number(b.auction_end_date));
        const ajSorok = !ajanlatok.length ? "" : `<div class="ach lach"><b>V\u00E9teli k\u00E9r\u00E9sekre tett aj\u00E1nlataid</b></div>` + ajanlatok.map(s => {
            const db = Number(s.item_count) || 1;
            const odaut = kinalatOdaut(s);
            const megj = s.description ? String(s.description) : "";
            return `
              <div class="ksor2 lsor">
                ${targyBubIkonHTML(s.item_id, targyIkon(s.item_id))}
                <div class="knev2 kn"><span class="knn">${esc(targyNev(s.item_id))}</span>${db > 1 ? `<span class="kdb">&times;${db}</span>` : ""}<span class="kerjel">k\u00E9r\u00E9sre</span></div>
                <div class="jobb klic" title="A legjobb aj\u00E1nlat most">${kinalatSzam(s.current_bid)}</div>
                <div class="jobb kazon">${kinalatSzam(s.max_price)}</div>
                <div class="jobb">${esc(kinalatIdo(licitHatra(s)))}</div>
                <div class="khely"><span>${megjJelHTML(megj)}${jatekosLinkHTML(s.seller_name, s.seller_player_id)}</span>
                  <span class="kvaros">${megjJelHTML("")}${varosLinkHTML(s.market_town_name, s.market_town_x, s.market_town_y, odaut)}${odaut != null ? " &middot; " + (odaut > 0 ? odautLinkHTML(kinalatIdo(odaut), s.market_town_id, s.market_town_x, s.market_town_y, s.market_town_name, odaut) : "itt vagy") : ""}</span></div>
              </div>`;
        }).join("");
        const ures = licitek.allapot === "kesz" && !futo.length && !ajanlatok.length
            ? `<p class="ures">Nincs futó licited.</p>` : "";
        const lab = atv ? `<button type="button" class="gomb latvgomb" data-licit-atv>${atv} átvehető tétel &rarr; Vásárlásaim</button>` : "";
        return `
          <div class="kinalat">
            ${licitFejHTML("")}
            <div class="kfej2 lfej"><div></div><div class="krend">Tárgy</div><div class="krend jobb">Licited</div>
              <div class="krend jobb">Azonnal</div><div class="krend jobb">Lejár</div><div class="krend knevhely">Eladó, hely</div></div>
            <div class="kinalatlista" id="licitLista">${sorok}${ajSorok}</div>
            ${ures}
            <div class="llab"><span class="labj" style="margin:0">A túllicitált tétel eltűnik a listából, a pénz azonnal visszajön.</span>${lab}</div>
          </div>`;
    }
    function licitjeimKotes() {
        licitFrissKotes();
        const g = gyoker.querySelector("[data-licit-atv]");
        if (g) g.addEventListener("click", () => { beall.ful = "atvetel"; beall.nezet.atvetel = "vasarlasaim"; beallMent(); rajzol(); });
    }

    /* --- ATVETEL --- */
    /* Natív modon egy listaban: a vasarolt targyak (fetch_bids, atveheto)
       es az eladasbol atveheto tetelek (fetch_offers: penz atvetele vagy
       el nem kelt targy visszavetele, a prepareSellData tablazata szerint). */
    function atvFoglalt() { return licitKuldes || eladKuldes; }
    function atvetelNezet() {
        const n = beall.nezet.atvetel;
        return n === "eladasaim" || n === "kereseim" ? n : "vasarlasaim";
    }

    /* Az adott nezet atveheto tetelei: { s, fajta }. */
    function atvetelTetelek(nezet) {
        const ki = [];
        if (nezet === "vasarlasaim") licitVeteliSorok().filter(licitAtveheto).forEach(s => ki.push({ s, fajta: "vett" }));
        if (nezet === "eladasaim") {
            ajanlatok.sorok.forEach(s => {
                const a = ajanlatAllapot(s);
                if (a === "penz" || a === "vissza") ki.push({ s, fajta: a });
            });
            /* t83: mas veteli keresere eladott targy penze (a fetch_bids
               BUY sorai, MERVE 2.3); "kerpenz" fajta, "kérésre" jellel. */
            licitek.sorok.filter(buyKerPenzE).forEach(s => ki.push({ s, fajta: "kerpenz" }));
        }
        if (nezet === "kereseim") kerek.sorok.filter(kerAtvehetoE).forEach(s => ki.push({ s, fajta: kerLejartE(s) ? "kerlejart" : "keres" }));
        return ki;
    }

    function atvPenzE(t) { return t.fajta === "penz" || t.fajta === "kerpenz" || t.fajta === "kerlejart"; }
    /* t87: a lejart keresnel a max_price jon vissza, a tobbinel a current_bid. */
    function atvOsszeg(t) { return Number(t.fajta === "kerlejart" ? t.s.max_price : t.s.current_bid) || 0; }
    /* t84: keresre eladott penz (fetch_bids BUY sor) helyben / tavol.
       MERVE: a fetch_town_bids ezt is felveszi, ezert a Vasarlasaim
       gombjai ilyenkor nem a varosi / osszes hivast hasznaljak. */
    function kerPenzHelybenE() { return licitek.sorok.some(s => buyKerPenzE(s) && itteniVarosE(s)); }
    function kerPenzTavolE() { return licitek.sorok.some(s => buyKerPenzE(s) && !itteniVarosE(s)); }
    function atvetelCsoportok(nezet) {
        const m = new Map();
        const tesz = (s, fajta) => {
            const k = String(s.market_town_id);
            if (!m.has(k)) m.set(k, { id: k, nev: s.market_town_name, x: s.market_town_x, y: s.market_town_y,
                                      itt: itteniVarosE(s), odaut: kinalatOdaut(s), sorok: [] });
            m.get(k).sorok.push({ s, fajta });
        };
        atvetelTetelek(nezet || atvetelNezet()).forEach(t => tesz(t.s, t.fajta));
        return [...m.values()].sort((a, b) => (b.itt - a.itt) || ((a.odaut ?? Infinity) - (b.odaut ?? Infinity)));
    }

    function atvetelSorHTML(t, itt, tiltas) {
        const s = t.s;
        const kep = targyIkon(s.item_id);
        const db = Number(s.item_count) || 1;
        const megj = s.description ? String(s.description) : "";
        const id = esc(s.market_offer_id);
        const fog = atvFoglalt();
        const kezbGomb = attr => `<button type="button" class="gomb agomb" ${attr}="${id}"
            ${fog || tiltas ? "disabled" : ""} title="${esc(tiltas || "Aranyr\u00F6g\u00E9rt, a j\u00E1t\u00E9k saj\u00E1t ablak\u00E1val")}">K\u00E9zbes\u00EDt\u00E9s</button>`;
        let cimke = "", ar, partner, gomb;
        if (t.fajta === "kerlejart") {
            /* t87: lejart, nem teljesult keres; a lefoglalt ar jon vissza. */
            cimke = `<span class="acim">nem teljes\u00FClt</span>`;
            ar = `<span class="kvez">+${kinalatSzam(s.max_price)} $</span>`;
            partner = "";
            gomb = itt
                ? `<button type="button" class="gomb agomb" data-atv-kegy="${id}" ${fog ? "disabled" : ""}>Visszaveszem</button>`
                : kezbGomb("data-atv-kkezb");
        } else if (t.fajta === "keres") {
            /* Teljesult sajat veteli keres: a targy var (az arat mar
               feladaskor kifizetted). */
            ar = `${kinalatSzam(s.current_bid != null ? s.current_bid : s.max_price)} $`;
            partner = jatekosLinkHTML(s.bidder_name, s.bidder_player_id);
            gomb = itt
                ? `<button type="button" class="gomb agomb" data-atv-kegy="${id}" ${fog ? "disabled" : ""}>\u00C1tveszem</button>`
                : kezbGomb("data-atv-kkezb");
        } else if (t.fajta === "kerpenz") {
            cimke = `<span class="acim">eladva</span><span class="kerjel">k\u00E9r\u00E9sre</span>`;
            ar = `<span class="kvez">+${kinalatSzam(s.current_bid)} $</span>`;
            partner = jatekosLinkHTML(s.seller_name, s.seller_player_id);
            gomb = itt
                ? `<button type="button" class="gomb agomb" data-atv-kpenz="${id}" ${fog ? "disabled" : ""}>P\u00E9nz \u00E1tv\u00E9tele</button>`
                : kezbGomb("data-atv-kezb");
        } else if (t.fajta === "vett") {
            ar = `${kinalatSzam(s.current_bid)} $`;
            partner = jatekosLinkHTML(s.seller_name, s.seller_player_id);
            gomb = itt
                ? `<button type="button" class="gomb agomb" data-atv-egy="${id}" ${fog ? "disabled" : ""}>\u00C1tveszem</button>`
                : kezbGomb("data-atv-kezb");
        } else {
            const penz = t.fajta === "penz";
            cimke = `<span class="acim">${penz ? "eladva" : "nem kelt el"}</span>`;
            ar = penz ? `<span class="kvez">+${kinalatSzam(s.current_bid)} $</span>` : `<span class="halvany">visszaj\u00F6n</span>`;
            partner = penz ? jatekosLinkHTML(s.bidder_name, s.bidder_player_id) : "";
            gomb = itt
                ? `<button type="button" class="gomb agomb" data-atv-afetch="${id}" ${fog ? "disabled" : ""}>${penz ? "P\u00E9nz \u00E1tv\u00E9tele" : "Visszaveszem"}</button>`
                : kezbGomb("data-atv-akezb");
        }
        return `
                  <div class="asor">
                    ${targyBubIkonHTML(s.item_id, kep)}
                    <div class="knev2 kn"><span class="knn">${esc(targyNev(s.item_id))}</span>${db > 1 ? `<span class="kdb">&times;${db}</span>` : ""}${cimke}</div>
                    <div class="aar">${ar}</div>
                    <div class="aelado">${megjJelHTML(megj)}${partner}</div>
                    <div class="jobb">${gomb}</div>
                  </div>`;
    }

    function atvetelHTML() {
        const nezet = atvetelNezet();
        const eladE = nezet === "eladasaim";
        const cs = atvetelCsoportok(nezet);
        const osszes = cs.reduce((n, c) => n + c.sorok.length, 0);
        const ittVan = cs.some(c => c.itt);
        const kerE = nezet === "kereseim";
        /* t83: a fejlec "Osszes" gombja (marketdelivery all) a keresre
           eladott penzt es a veteli keresek targyait nem viszi (nem mert). */
        const mindbe = t => t.fajta !== "kerpenz" && t.fajta !== "keres" && t.fajta !== "kerlejart";
        const tavoli = cs.filter(c => !c.itt).reduce((n, c) => n + c.sorok.filter(mindbe).length, 0);
        const penz = cs.reduce((n, c) => n + c.sorok.filter(atvPenzE)
            .reduce((m, t) => m + atvOsszeg(t), 0), 0);
        const kezb = kezbesitesElerheto();
        const tiltas = !kezb ? "A k\u00E9zbes\u00EDt\u00E9s most nem \u00E9rhet\u0151 el." : "";
        /* t84 (B1): a Vasarlasaim "Osszes" tavoli kezbesitese a keresre
           eladott penzt is hozna, ezert ilyenkor tiltva. */
        const b1 = nezet === "vasarlasaim" && kerPenzTavolE();
        const b1Sz = "Egy t\u00E1voli piacon k\u00E9r\u00E9sre eladott p\u00E9nzed v\u00E1r. A j\u00E1t\u00E9k \u00F6sszes-k\u00E9zbes\u00EDt\u00E9se azt is elhozn\u00E1, ez\u00E9rt a gomb most tiltva. A t\u00E1rgyakat soronk\u00E9nt vagy helyben veheted \u00E1t.";
        const mindTiltva = atvFoglalt() || b1 || (!ittVan && (!!tiltas || !tavoli));
        const extra = (penz > 0 ? `<span class="apenz">\u00C1tvehet\u0151 p\u00E9nz: <b class="kvez">+${kinalatSzam(penz)} $</b></span>` : "") + (osszes && !kerE
            ? `<button type="button" class="gomb" data-atv-mind ${mindTiltva ? "disabled" : ""}
                 title="${esc(b1 ? b1Sz : (mindTiltva && tiltas ? tiltas : "El\u0151bb ingyen, ami itt van, azt\u00E1n a j\u00E1t\u00E9k ablaka a t\u00F6bbire (aranyr\u00F6g)"))}">${eladE ? "\u00D6sszes elad\u00E1s \u00E1tv\u00E9tele" : "\u00D6sszes t\u00E1rgy \u00E1tv\u00E9tele"}</button>` : "");
        const csoportok = cs.map(c => {
            const cp = c.sorok.filter(atvPenzE).reduce((m, t) => m + atvOsszeg(t), 0);
            return `
          <div class="acs">
            <div class="ach"><b>${varosLinkHTML(c.nev, c.x, c.y)}</b>
              ${c.itt ? `<span class="aitt">itt vagy</span>` : (c.odaut != null ? `<span class="kvaros">oda\u00FAt ${odautLinkHTML(teljesIdo(c.odaut), c.id, c.x, c.y)}</span>` : "")}
              ${cp > 0 ? `<span class="kvez apenzcs">+${kinalatSzam(cp)} $</span>` : ""}
              <span style="flex:1"></span>
              ${c.itt ? `<button type="button" class="gomb agomb" data-atv-itt ${atvFoglalt() ? "disabled" : ""}${nezet === "vasarlasaim" && kerPenzHelybenE()
                ? ` title="${esc(`Ezen a piacon k\u00E9r\u00E9sre eladott p\u00E9nzed is v\u00E1r, ez\u00E9rt a ${c.sorok.length} megvett t\u00E1rgyat egyenk\u00E9nt veszi \u00E1t (${c.sorok.length} k\u00E9r\u00E9s), a p\u00E9nzhez nem ny\u00FAl.`)}"` : ""}>Mind \u00E1tv\u00E9tele itt (${c.sorok.length})</button>` : ""}
            </div>
            ${c.sorok.map(t => atvetelSorHTML(t, c.itt, tiltas)).join("")}
          </div>`;
        }).join("");
        const forrasKesz = kerE ? kerek.allapot === "kesz" : (eladE ? ajanlatok.allapot === "kesz" : licitek.allapot === "kesz");
        const ures = forrasKesz && !osszes
            ? `<p class="ures">${kerE ? "Nincs \u00E1tvehet\u0151 t\u00E1rgy vagy visszaj\u00E1r\u00F3 p\u00E9nz v\u00E9teli k\u00E9r\u00E9sb\u0151l."
                : (eladE ? "Nincs \u00E1tvehet\u0151 p\u00E9nz vagy visszaj\u00E1r\u00F3 t\u00E1rgy." : "Nincs \u00E1tvehet\u0151 megvett t\u00E1rgy.")}</p>` : "";
        const kerAll = !kerE ? "" : (kerek.allapot === "hiba"
            ? `<p class="labj kvhiba" style="margin:0 0 6px">V\u00E9teli k\u00E9r\u00E9sek: ${esc(kerek.hibaSz || "")}</p>`
            : (kerek.allapot === "tolt" ? `<p class="labj" style="margin:0 0 6px">V\u00E9teli k\u00E9r\u00E9sek bet\u00F6lt\u00E9se\u2026</p>` : ""));
        const eladAll = !eladE ? "" : ajanlatok.allapot === "hiba"
            ? `<p class="labj kvhiba" style="margin:0 0 6px">Elad\u00E1sok: ${esc(ajanlatok.uzenet)}</p>`
            : (ajanlatok.allapot === "tolt" ? `<p class="labj" style="margin:0 0 6px">Elad\u00E1sok bet\u00F6lt\u00E9se\u2026</p>` : "");
        return `
          <div class="kinalat">
            ${licitFejHTML(extra)}
            ${eladAll}${kerAll}
            ${tavoli && tiltas ? `<p class="labj" style="margin:0 0 6px">${esc(tiltas)}</p>` : ""}
            <div class="kinalatlista atvlista" id="atvetelLista">${csoportok}${ures}</div>
            <p class="labj">${kerE
                ? "Teljes\u00FClt v\u00E9teli k\u00E9r\u00E9seid t\u00E1rgyai \u00E9s a lej\u00E1rt, nem teljes\u00FClt k\u00E9r\u00E9sek \u00E1ra (a d\u00EDj nem j\u00F6n vissza). Helyben ingyen, m\u00E1shol aranyr\u00F6g\u00E9rt, a j\u00E1t\u00E9k saj\u00E1t ablak\u00E1val."
                : (eladE
                ? "Elad\u00E1sb\u00F3l j\u00E1r\u00F3 p\u00E9nz \u00E9s el nem kelt t\u00E1rgyak. A p\u00E9nz a piacon marad, am\u00EDg \u00E1t nem veszed."
                : "Megvett t\u00E1rgyak. A p\u00E9nzhez ez a n\u00E9zet nem ny\u00FAl.")}
              Minden \u00E1tv\u00E9tel k\u00E9t kattint\u00E1s; aranyr\u00F6g csak a j\u00E1t\u00E9k saj\u00E1t ablak\u00E1ban tett Ok ut\u00E1n megy el.</p>
          </div>`;
    }

    /* A folyamatjelzo ("Atvetel...") nem maradhat kint a vegen: ha semmi
       nem irta felul, a megszakitas uzenete kerul a helyere. */
    /* t88: natív atvetel figyelese (MERVE 2026-10-09): az "Aruk a piacon"
       ablak Arukat gombja building_market / fetch_town_bids, a sorvegi
       ikon fetch; a jQuery ajaxComplete mindet latja. A sajat atveteleinket
       (folyamatban, vagy 3 mp-en belul az atvetelUtan ota) nem szamoljuk. */
    let sajatAtvIdo = 0;
    let piacFigyelve = false, piacOra = null;
    const NATIV_ATV = /[?&]action=(fetch|fetch_town_bids|fetch_town_offers)(&|$)/;
    function nativAtvetelE(url, adat) {
        const u = String(url || ""), d = String(adat || "");
        if (/window=building_market/.test(u) && NATIV_ATV.test(u)) return true;
        return /marketdelivery/.test(u + " " + d);
    }
    function nativAtvetelUtan() {
        if (atvFoglalt() || kerKuldes || Date.now() - sajatAtvIdo < 3000) return;
        const urit = o => { if (o && o.allapot !== "tolt") o.allapot = "ures"; };
        urit(licitek); urit(ajanlatok); urit(kerek);
        if (!host || !host.parentNode || host.hidden || beall.ful !== "atvetel") return;
        licitTolt();
        ajanlatTolt();
        if (beall.nezet.atvetel === "kereseim") kerTolt();
        rajzolHaSzabad();
    }
    function piacFigyelo() {
        if (piacFigyelve) return;
        try {
            const $ = jatek().jQuery;
            if (typeof $ !== "function") return;
            $(jatek().document).on("ajaxComplete", (e, x, o) => {
                if (!o || !nativAtvetelE(o.url, o.data)) return;
                if (piacOra) clearTimeout(piacOra);
                piacOra = setTimeout(() => { piacOra = null; nativAtvetelUtan(); }, 300);
            });
            piacFigyelve = true;
        } catch (e) { /* enelkul is mukodik, csak kezzel kell frissiteni */ }
    }

    function atvetelUtan(megszakitva) {
        sajatAtvIdo = Date.now();
        if (licitNezet.uzenet === "Átvétel…") {
            licitUzenet(megszakitva ? "Kézbesítés megszakítva, semmi nem történt." : "", false, false);
        }
        try { const E = jatek().EventHandler; if (E && typeof E.signal === "function") E.signal("inventory_changed"); }
        catch (e) { /* nem baj */ }
        licitKuldes = false;
        eladKuldes = false;
        licitek.allapot = "ures";
        licitTolt();
        if (ajanlatok.allapot !== "tolt") ajanlatok.allapot = "ures";
        ajanlatTolt();
        if (beall.nezet.atvetel === "kereseim" && kerek.allapot !== "tolt") { kerek.allapot = "ures"; kerTolt(); }
        rajzolHaSzabad();
    }

    function atvetelEgy(id) {
        const A = jatek().Ajax;
        if (atvFoglalt() || !A) return;
        const kerS = kerek.sorok.find(x => String(x.market_offer_id) === String(id) && kerAtvehetoE(x));
        const s = kerS || licitek.sorok.find(x => String(x.market_offer_id) === String(id));
        if (!s || !itteniVarosE(s)) { licitUzenet("Ezt csak a piac városában lehet ingyen átvenni.", true, false); return; }
        const penzE = !kerS && !licitVetelE(s);
        licitKuldes = true;
        licitUzenet("Átvétel…", false, false);
        try {
            A.remoteCall("building_market", "fetch", { market_offer_id: s.market_offer_id }, valasz => {
                const msg = valasz && valasz.msg;
                if (!valasz || valasz.error || !msg || !msg.succesfull) {
                    licitUzenet((valasz && typeof valasz.msg === "string" && valasz.msg) || "Az átvétel nem sikerült.", true, true);
                } else {
                    try { const C = jatek().Character; if (msg.money != null && typeof C.setMoney === "function") C.setMoney(msg.money); }
                    catch (e) { /* nem baj */ }
                    licitUzenet(kerS && kerLejartE(kerS) ? `Visszavetted: ${kinalatSzam(kerS.max_price)} $ (${targyNev(s.item_id)}).`
                        : (penzE ? `Pénz átvéve: ${targyNev(s.item_id)}.` : `Átvetted: ${targyNev(s.item_id)}.`), false, true);
                }
                atvetelUtan();
            });
        } catch (e) {
            licitUzenet("A hívás kivételt dobott: " + (e && e.message ? e.message : e), true, false);
            atvetelUtan();
        }
    }

    /* A natív "Osszes" sorrendje: elobb ingyen helyben (vasarolt, majd
       eladasbol jaro), utana a tavoliakra a jatek sajat kezbesitesi ablaka,
       kulon a vasaroltakra es kulon az eladasbol jarokra.
       FORRASBOL, NEM MERVE: fetch_town_offers valasza,
       get_foreign_town_offers_price valasza, "marketdelivery all <id> offers". */
    function atvetelMind(csakItt) {
        const J = jatek(), A = J.Ajax;
        if (atvFoglalt() || !A) return;
        const cs = atvetelCsoportok(atvetelNezet());
        if (csakItt && !cs.some(c => c.itt)) {
            licitUzenet("M\u00E1r nem a piac v\u00E1ros\u00E1ban \u00E1llsz, ingyen itt nem vehet\u0151 \u00E1t.", true, false);
            rajzolHaSzabad();
            return;
        }
        const vett = t => t.fajta === "vett";
        const elad = t => t.fajta === "penz" || t.fajta === "vissza";
        /* t83: a veteli keres targya es a keresre eladott penz soronkent,
           helyben (a soronkenti fetch mert; a varosi "osszes" nem). */
        const soronkent = cs.filter(c => c.itt).reduce((a, c) => a.concat(c.sorok.filter(t => t.fajta === "keres" || t.fajta === "kerpenz" || t.fajta === "kerlejart")), []);
        const itt = f => cs.some(c => c.itt && c.sorok.some(f));
        const tavolCs = f => cs.find(c => !c.itt && c.sorok.some(f));
        licitKuldes = true;
        eladKuldes = true;
        licitUzenet("\u00C1tv\u00E9tel\u2026", false, false);
        let megszakitva = false;

        const penzAllit = (cash, deposit) => {
            try {
                if (deposit != null) J.Character.setDeposit(deposit);
                if (cash != null) J.Character.setMoney(cash);
            } catch (e) { /* nem baj */ }
        };
        const helyi = (akcio, tovabb) => {
            try {
                A.remoteCall("building_market", akcio, {}, valasz => {
                    if (!valasz || valasz.error) {
                        licitUzenet((valasz && typeof valasz.msg === "string" && valasz.msg) || "Az \u00E1tv\u00E9tel nem siker\u00FClt.", true, true);
                    } else {
                        const m = valasz.msg && typeof valasz.msg === "object" ? valasz.msg : null;
                        penzAllit(valasz.cash != null ? valasz.cash : (m ? m.money : null),
                                  valasz.deposit != null ? valasz.deposit : (m ? m.deposit : null));
                        licitUzenet(typeof valasz.msg === "string" ? valasz.msg : "\u00C1tv\u00E9ve.", false, true);
                    }
                    tovabb();
                });
            } catch (e) {
                licitUzenet("A h\u00EDv\u00E1s kiv\u00E9telt dobott: " + (e && e.message ? e.message : e), true, false);
                tovabb();
            }
        };
        const tavoli = (arAkcio, fajta, csoport, siker, tovabb) => {
            const vid = kezbesitesVaros(csoport && csoport.id);
            if (!vid || !kezbesitesElerheto() || typeof A.get !== "function") { tovabb(); return; }
            try {
                A.get("building_market", arAkcio, {}, valasz => {
                    const ar = valasz && Number(valasz.price);
                    if (!ar || !J.Premium || typeof J.Premium.confirmUse !== "function") { tovabb(); return; }
                    /* Az arat a szerver adja: a Premium.getPrice csak a kulcs
                       elso szavat nezi, osszesre is 10-et mondana (mert). */
                    J.Premium.confirmUse("marketdelivery all " + vid + " " + fajta, KEZB_CIM, KEZB_MIND,
                        ar, null,
                        resp => {
                            const ad = resp && resp.activationdata;
                            if (ad) penzAllit(ad.money != null ? ad.money : ad.cash, ad.deposit);
                            licitUzenet(siker, false, false);
                            tovabb();
                        },
                        () => { megszakitva = true; tovabb(); });
                });
            } catch (e) { tovabb(); }
        };

        const egyHelyi = (t, tovabb) => {
            try {
                A.remoteCall("building_market", "fetch", { market_offer_id: t.s.market_offer_id }, valasz => {
                    const msg = valasz && valasz.msg;
                    if (!valasz || valasz.error || !msg || !msg.succesfull) {
                        licitUzenet((valasz && typeof valasz.msg === "string" && valasz.msg) || "Az \u00E1tv\u00E9tel nem siker\u00FClt.", true, true);
                    } else {
                        penzAllit(msg.money, null);
                        licitUzenet(t.fajta === "kerpenz" ? `P\u00E9nz \u00E1tv\u00E9ve: ${targyNev(t.s.item_id)}.`
                            : (t.fajta === "kerlejart" ? `Visszavetted: ${kinalatSzam(t.s.max_price)} $ (${targyNev(t.s.item_id)}).` : `\u00C1tvetted: ${targyNev(t.s.item_id)}.`), false, true);
                    }
                    tovabb();
                });
            } catch (e) {
                licitUzenet("A h\u00EDv\u00E1s kiv\u00E9telt dobott: " + (e && e.message ? e.message : e), true, false);
                tovabb();
            }
        };
        const lepesek = [];
        /* t84 (A1): ha itt keresre eladott penz is var, a megvett targyak
           egyenkent (fetch), igy a penz marad. */
        const vettEgyenkent = itt(vett) && kerPenzHelybenE();
        if (vettEgyenkent) cs.filter(c => c.itt).forEach(c => c.sorok.filter(vett).forEach(t => lepesek.push(k => egyHelyi(t, k))));
        else if (itt(vett)) lepesek.push(k => helyi("fetch_town_bids", k));
        if (itt(elad)) lepesek.push(k => helyi("fetch_town_offers", k));
        soronkent.forEach(t => lepesek.push(k => egyHelyi(t, k)));
        if (!csakItt && tavolCs(vett) && !kerPenzTavolE()) lepesek.push(k => tavoli("get_foreign_town_bids_price", "bids", tavolCs(vett),
            "A t\u00E1voli v\u00E1s\u00E1rolt t\u00E1rgyak k\u00E9zbes\u00EDt\u00E9se megt\u00F6rt\u00E9nt.", k));
        if (!csakItt && tavolCs(elad)) lepesek.push(k => tavoli("get_foreign_town_offers_price", "offers", tavolCs(elad),
            "A t\u00E1voli elad\u00E1sok k\u00E9zbes\u00EDt\u00E9se megt\u00F6rt\u00E9nt.", k));
        let i = 0;
        const tovabb = () => {
            if (i >= lepesek.length) { atvetelUtan(megszakitva); return; }
            lepesek[i++](tovabb);
        };
        tovabb();
    }

    /* Egy sor kezbesitese. Arat NEM adunk at: a jatek a sajat arat
       mutatja (Premium.getPrice, mert: 10). Aranyrog csak a jatek
       ablakaban tett Ok utan megy el. */
    function atvetelKezbesit(id) {
        const J = jatek();
        if (atvFoglalt()) return;
        const s = kerek.sorok.find(x => String(x.market_offer_id) === String(id) && kerAtvehetoE(x))
            || licitek.sorok.find(x => String(x.market_offer_id) === String(id));
        if (!s) return;
        /* t24: ha kozben beertel, ne a fizetos ablak jojjon. */
        if (itteniVarosE(s)) { licitUzenet("M\u00E1r a v\u00E1rosban vagy, itt ingyen \u00E1tveheted.", false, false); rajzolHaSzabad(); return; }
        const vid = kezbesitesVaros(s.market_town_id);
        if (!vid || !kezbesitesElerheto() || !J.Premium || typeof J.Premium.confirmUse !== "function") {
            licitUzenet("A kézbesítés most nem érhető el.", true, false);
            return;
        }
        licitKuldes = true;
        try {
            J.Premium.confirmUse("marketdelivery " + s.market_offer_id + " " + vid + " fetch", KEZB_CIM, KEZB_EGY,
                null, null,
                resp => {
                    try {
                        const ad = resp && resp.activationdata;
                        if (ad) {
                            if (ad.deposit != null) J.Character.setDeposit(ad.deposit);
                            if (ad.money != null) J.Character.setMoney(ad.money);
                        }
                    } catch (e) { /* nem baj */ }
                    licitUzenet(kerLejartE(s) ? `Kézbesítve: ${kinalatSzam(s.max_price)} $ (${targyNev(s.item_id)}).` : `Kézbesítve: ${targyNev(s.item_id)}.`, false, false);
                    atvetelUtan();
                },
                () => { licitKuldes = false; rajzolHaSzabad(); });
        } catch (e) {
            licitUzenet("A játék ablaka nem nyílt meg: " + (e && e.message ? e.message : e), true, false);
            licitKuldes = false;
        }
    }

    function atvetelKotes() {
        licitFrissKotes();
        gyoker.querySelectorAll("[data-atv-afetch]").forEach(g => g.addEventListener("click", () => {
            if (g.disabled || atvFoglalt()) return;
            if (!kinalatMegerosit(g, "Biztos?")) return;
            ajanlatFetch(g.getAttribute("data-atv-afetch"));
        }));
        gyoker.querySelectorAll("[data-atv-akezb]").forEach(g => g.addEventListener("click", () => {
            if (g.disabled || atvFoglalt()) return;
            ajanlatKezbesit(g.getAttribute("data-atv-akezb"), "fetch");
        }));
        gyoker.querySelectorAll("[data-atv-kezb]").forEach(g => g.addEventListener("click", () => {
            if (g.disabled || atvFoglalt()) return;
            atvetelKezbesit(g.getAttribute("data-atv-kezb"));
        }));
        gyoker.querySelectorAll("[data-atv-kegy], [data-atv-kpenz]").forEach(g => g.addEventListener("click", () => {
            if (g.disabled || atvFoglalt()) return;
            if (!kinalatMegerosit(g, "Biztos?")) return;
            atvetelEgy(g.getAttribute("data-atv-kegy") || g.getAttribute("data-atv-kpenz"));
        }));
        gyoker.querySelectorAll("[data-atv-kkezb]").forEach(g => g.addEventListener("click", () => {
            if (g.disabled || atvFoglalt()) return;
            atvetelKezbesit(g.getAttribute("data-atv-kkezb"));
        }));
        gyoker.querySelectorAll("[data-atv-egy]").forEach(g => g.addEventListener("click", () => {
            if (g.disabled || atvFoglalt()) return;
            if (!kinalatMegerosit(g, "Biztos?")) return;
            atvetelEgy(g.getAttribute("data-atv-egy"));
        }));
        const itt = gyoker.querySelector("[data-atv-itt]");
        if (itt) itt.addEventListener("click", () => {
            if (itt.disabled || atvFoglalt()) return;
            if (!kinalatMegerosit(itt, "Biztos? Mind átvétele itt")) return;
            atvetelMind(true);
        });
        const mind = gyoker.querySelector("[data-atv-mind]");
        if (mind) mind.addEventListener("click", () => {
            if (mind.disabled || atvFoglalt()) return;
            if (!kinalatMegerosit(mind, "Biztos? Összes átvétele")) return;
            atvetelMind(false);
        });
    }

    function licitListaMagassag(id) {
        try {
            const stage = gyoker.getElementById("stage");
            const lista = gyoker.getElementById(id);
            if (!stage || !lista) return;
            const h = stage.clientHeight - (lista.offsetTop - stage.offsetTop) - 60;
            lista.style.maxHeight = Math.max(120, h) + "px";
        } catch (e) { /* marad */ }
    }

    /* Helyorzo a meg el nem keszult fulekhez es nezetekhez. */
    function fulHamarosanHTML() {
        const n = aktNezet();
        const f = FULAK.find(x => x.kulcs === beall.ful);
        const cimke = n ? n.cimke : (f ? f.cimke : "");
        return `<p class="ures">${cimke}: hamarosan.</p>`;
    }

    /* t84 (D): a listas nezetek minden megnyitaskor ujrakerik a listajukat,
       ahogy a natív piac (MERVE: minden fulvaltas egy keres, varakozas
       nelkul). Megnyitas = nezet- vagy fulvaltas, panelnyitas. A kereses
       alapu Kinalat es Masok keresei marad gombra, mint a natívban. */
    function nyitasFrissit() {
        const urit = o => { if (o && o.allapot !== "tolt") o.allapot = "ures"; };
        const n = beall.nezet[beall.ful];
        if (beall.ful === "vetel") {
            if (n === "kereseim") urit(kerek);
            else if (n === "licitjeim") urit(licitek);
            else if (n === "megfigyeles") urit(figyelo);
        } else if (beall.ful === "piac") {
            if (n === "ajanlataim") urit(ajanlatok);
        } else if (beall.ful === "atvetel") {
            urit(licitek); urit(ajanlatok); urit(kerek);
        }
    }
    function fulKotes() {
        gyoker.querySelectorAll(".fulsor .ful").forEach(g => {
            g.addEventListener("click", () => {
                const k = g.getAttribute("data-ful");
                const uj = fulLetezik(k) ? k : "beszerzok";
                if (uj === beall.ful) return;
                beall.ful = uj;
                beallMent();
                nyitasFrissit();
                rajzol();
            });
        });
    }


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


















    /* A lista magassaga a panel meretebol jon, hogy a kereso, a napok es az
       oszlopnevek allva maradjanak, es csak a tetelek gorogjenek.

       KET hiba volt az elso valtozatban. Egyszer csak rajzolaskor szamolt,
       ezert a panel nyujtasa nem valtoztatta a listat. Masreszt rajzolas
       kozben a magassag meg nem allt be, ezert tul kicsire sikerult.
       Mindkettot a ResizeObserver oldja meg: a stage minden meretvaltozasara
       ujraszamolunk. */
    let piacMeretFigyelo = null;


    function piacMeretFigyeloLeallit() {
        try { if (piacMeretFigyelo) piacMeretFigyelo.disconnect(); }
        catch (e) { /* nem baj */ }
        piacMeretFigyelo = null;
    }

    /* HELYFIGYELES (t24). Az Ajanlataim, az Atvetel es a Licitjeim
       nezetben a helyben / kezbesites gomb es az "itt vagy" jelzes
       rajzolaskor dol el. Ha a karakter helye valtozik, ujrarajzolunk.
       Kuldes kozben nem: a helyet sem fogadjuk el, igy a kovetkezo
       korben potoljuk. */
    let helyOra = null, helyVoltPoz = "";
    function helyFigyeloAktivE() {
        if (!gyoker || !latszik) return false;
        if (beall.ful === "atvetel") return true;
        if (beall.ful === "piac") return beall.nezet.piac === "ajanlataim" || beall.nezet.piac === "kerelmek";
        if (beall.ful !== "vetel") return false;
        return beall.nezet.vetel === "licitjeim" || beall.nezet.vetel === "kinalat" || beall.nezet.vetel === "megfigyeles"
            || beall.nezet.vetel === "kereseim";
    }

    /* t25: a Kinalatban nem rajzolunk ujra (sok szaz sor lehet), csak az
       odaut szoveget csereljuk soronkent. Igy megmarad a gorgetes, a
       kijelolt sor es a nyitott vasarlasi sav a beirt licittel. A
       linkek a stage-en delegalt kattintassal mukodnek, ujrakotes nem
       kell. */
    function kinalatHelyFrissit() {
        const lista = gyoker && gyoker.getElementById("kinalatLista");
        if (!lista) return;
        const forras = kinalat.regi || kinalat.sorok || [];
        const map = new Map(forras.map(x => [String(x.market_offer_id), x]));
        lista.querySelectorAll(".ksor2[data-kid]").forEach(sor => {
            const s = map.get(sor.getAttribute("data-kid"));
            const cella = sor.querySelector(".khely .kvaros");
            if (!s || !cella) return;
            const odaut = kinalatOdaut(s);
            cella.innerHTML = megjJelHTML("") + varosLinkHTML(s.market_town_name, s.market_town_x, s.market_town_y, odaut)
                + (odaut != null ? " &middot; " + (odaut > 0 ? odautLinkHTML(kinalatIdo(odaut), s.market_town_id, s.market_town_x, s.market_town_y, s.market_town_name, odaut) : "itt vagy") : "");
        });
    }
    /* Hely szerinti rendezesnel a sorrend is valtozik, ilyenkor teljes
       ujrarajzolas kell. Nyitott vasarlasi savnal nem dobjuk el a beirt
       licitet: csak a szovegek frissulnek, a sorrend a kovetkezo
       rendezeskor vagy Frissiteskor all helyre. */
    function helyKinalatFrissit() {
        if (kinalatNezet.rendez === "hely" && !(gyoker && gyoker.getElementById("kinalatSav"))) { rajzolHaSzabad(); return; }
        kinalatHelyFrissit();
    }
    function helyFigyeloLeallit() {
        if (helyOra != null) clearInterval(helyOra);
        helyOra = null;
    }
    function helyFigyeloIndit() {
        helyVoltPoz = eladPozKulcs();
        if (helyOra != null) return;
        helyOra = setInterval(() => {
            if (!helyFigyeloAktivE()) { helyFigyeloLeallit(); return; }
            if (atvFoglalt()) return;
            kerVarosVarakozik();
            const most = eladPozKulcs();
            if (most === helyVoltPoz) return;
            helyVoltPoz = most;
            if (beall.ful === "vetel" && beall.nezet.vetel === "kinalat") { helyKinalatFrissit(); return; }
            if (beall.ful === "piac" && beall.nezet.piac === "kerelmek") {
                if (kerelemNezet.rendez === "hely" && !gyoker.getElementById("kerelemSav")) { rajzolHaSzabad(); return; }
                kerelemHelyFrissit();
                return;
            }
            rajzolHaSzabad();
        }, 3000);
    }

    function piacMeretFigyeloIndit() {
        piacMeretFigyeloLeallit();
        try {
            const stage = gyoker.getElementById("stage");
            if (!stage || typeof ResizeObserver !== "function") return;
            piacMeretFigyelo = new ResizeObserver(() => {
                if (beall.ful === "vetel" && beall.nezet.vetel === "kinalat") { kinalatListaMagassag(); return; }
                if (beall.ful === "vetel" && beall.nezet.vetel === "licitjeim") { licitListaMagassag("licitLista"); return; }
                if (beall.ful === "atvetel") { licitListaMagassag("atvetelLista"); return; }
                if (beall.ful !== "piac") { piacMeretFigyeloLeallit(); return; }
                licitListaMagassag(beall.nezet.piac === "ajanlataim" ? "ajanlatLista"
                    : (beall.nezet.piac === "kerelmek" ? "kerelemLista" : "eladLista"));
            });
            piacMeretFigyelo.observe(stage);
        } catch (e) { /* enelkul is mukodik, csak nem koveti a nyujtast */ }
    }











    /* -----------------------------------------------------------------
       ELADAS FUL, UJ VALTOZAT (t15). A natív ablakot megkeruli, a
       szervert kozvetlenul hivja, ahogy a Vetel es az Atvetel.
       FORRASBOL (tw2game.hu_HU.js, 2026-09-16), NEM MERVE:
         building_market / putup
           { town_id, item_id, itemcount, auctioncount, sellrights,
             auctionlength, description, direction: "SELL",
             auctionprice? (ha van licit), maxprice? (ha van azonnali) }
           -> siker: msg.money, msg.deposit, msg.costs
         Varoson kivul: Premium.confirmUse("expresssell " + JSON(obj), ...)
           -> activationdata.deposit / .cash
         building_market / fetch_offers { page: 0 }  (MERVE 2026-09-16:
           msg.search_result + msg.next; a sorokban NINCS direction)
         building_market / offtake { offer_id, direction }
           A natív deleteFromMarket az iranyt parameterkent kapja: az
           eladasi tablazat (marketSellsData_) fixen "SELL"-t, a veteli
           kereseke (marketBuyData_) fixen "BUY"-t kuld (forrasbol).
           -> json.money: -1 (nincs visszaterites) vagy a visszaterített osszeg
         Tavolrol: marketdelivery <id> <townId> offtake | fetch
       MERVE: town / get_town { x, y } -> varosban error: false, town_id,
         town_name, allBuildings.market.stage; mezon error: true.
       A regi, natív ablakot vezerlo kod (piacraRak) t19-ben kiment; a
       Beszerzok ful "Piacra" gombja is ezt a savot nyitja (eladasraNyit).
       ----------------------------------------------------------------- */
    const ELAD_JOGOK = [
        { ertek: 2, cimke: "Vil\u00E1g" },
        { ertek: 1, cimke: "Sz\u00F6vets\u00E9g" },
        { ertek: 0, cimke: "V\u00E1ros" }
    ];
    const ELAD_NINCS_AR = "Adj meg legal\u00E1bb egy \u00E1rat.";
    const ELAD_MIN_HIBA = "A t\u00E1rgy elad\u00E1si \u00E1ra alacsonyabb a megengedett \u00E1rn\u00E1l.";
    const ELAD_OSZLOPOK = [
        { kulcs: "nev", cimke: "T\u00E1rgy", jobb: false },
        { kulcs: "keszlet", cimke: "K\u00E9szlet", jobb: true },
        { kulcs: "min", cimke: "Minimum", jobb: true },
        { kulcs: "ertek", cimke: "\u00C9rt\u00E9k", jobb: true }
    ];

    const eladNezet = {
        kereses: "", kategoria: "mind", rendez: null, irany: 1, valasztott: null,
        sorrend: beall.eladSorrend === "leg" ? "leg" : "abc",
        uzenet: "", uzenetHiba: false,
        napok: beall.eladNapok, jog: beall.eladJog, megjegyzes: "",
        mezok: {}          /* targy -> { licit, azonnali, menny, aukcio } szovegkent */
    };
    let eladKuldes = false;

    /* --- HOL ALLOK --- */
    const eladHely = { allapot: "ures", townId: 0, nev: "", szint: 0, x: null, y: null, poz: "", uzenet: "", futas: 0 };

    function eladPozKulcs() {
        try { const p = jatek().Character.position; return Number(p.x) + "," + Number(p.y); }
        catch (e) { return ""; }
    }

    function eladHelyTolt() {
        const J = jatek(), A = J.Ajax;
        const futas = ++eladHely.futas;
        const poz = eladPozKulcs();
        eladHely.allapot = "tolt";
        eladHely.poz = poz;
        eladHelyKiir();
        const kesz = () => {
            if (futas !== eladHely.futas) return;
            eladHelyKiir(); eladSavSzamol(); kerSavSzamol();
            /* t80: a Kereseim lista a helyre vart (nem volt ismert varos). */
            if (kerek.allapot === "ures" && beall.ful === "vetel" && beall.nezet.vetel === "kereseim") { kerTolt(); rajzolHaSzabad(); }
        };
        if (!A || typeof A.remoteCallMode !== "function" || !poz) {
            eladHely.allapot = "hiba"; eladHely.uzenet = "A hely nem k\u00E9rdezhet\u0151 le."; kesz(); return;
        }
        let megjott = false;
        const ora = setTimeout(() => {
            if (megjott || futas !== eladHely.futas) return;
            megjott = true;
            eladHely.allapot = "hiba"; eladHely.uzenet = "Nem j\u00F6tt v\u00E1lasz 15 m\u00E1sodpercen bel\u00FCl."; kesz();
        }, 15000);
        const p = poz.split(",");
        try {
            A.remoteCallMode("town", "get_town", { x: Number(p[0]), y: Number(p[1]) }, valasz => {
                if (megjott || futas !== eladHely.futas) return;
                megjott = true; clearTimeout(ora);
                if (!valasz || valasz.error) {
                    eladHely.allapot = "mezo";
                    eladHely.townId = 0; eladHely.nev = ""; eladHely.szint = 0;
                } else {
                    const piac = valasz.allBuildings && valasz.allBuildings.market;
                    eladHely.allapot = "kesz";
                    eladHely.townId = Number(valasz.town_id) || 0;
                    eladHely.nev = String(valasz.town_name || "");
                    eladHely.x = valasz.town_x; eladHely.y = valasz.town_y;
                    eladHely.szint = piac ? Number(piac.stage) || 0 : 0;
                }
                kesz();
            });
        } catch (e) {
            megjott = true; clearTimeout(ora);
            eladHely.allapot = "hiba"; eladHely.uzenet = "A h\u00EDv\u00E1s kiv\u00E9telt dobott: " + (e && e.message ? e.message : e); kesz();
        }
    }

    /* t82: a hely a nezetsor jobb szelere kerult (csak Keszletem), a
       Hely frissitese gomb fole; a helyen a sorrend gombpar all. */
    function eladVarosHTML() {
        const h = eladHely;
        let bal;
        if (h.allapot === "kesz" && h.szint > 0) {
            bal = `<b>${varosLinkHTML(h.nev, h.x, h.y)}</b> piaca &middot; ${h.szint}. szint`;
        } else if (h.allapot === "kesz") {
            bal = `<b>${varosLinkHTML(h.nev, h.x, h.y)}</b> <span class="kvhiba">ebben a v\u00E1rosban nincs piac</span>`;
        } else if (h.allapot === "mezo") {
            bal = `<span class="kvhiba">Nem vagy v\u00E1rosban, felad\u00E1s csak aranyr\u00F6g\u00E9rt.</span>`;
        } else if (h.allapot === "hiba") {
            bal = `<span class="kvhiba">Hiba: ${esc(h.uzenet)}</span>`;
        } else {
            bal = `<span class="halvany">Hely lek\u00E9rdez\u00E9se\u2026</span>`;
        }
        return bal;
    }
    function eladSorrendHTML() {
        const ak = k => !eladNezet.rendez && eladNezet.sorrend === k;
        return `<span class="pkatvalaszto esorrend" role="group" aria-label="Sorrend">${[["abc", "ABC"], ["leg", "Legut\u00F3bbi"]].map(([k, c]) =>
            `<button type="button" class="pkat${ak(k) ? " aktiv" : ""}" data-esorrend="${k}" aria-pressed="${ak(k) ? "true" : "false"}"${k === "leg" ? ` title="Ahogy a t\u00E1ska: az utolj\u00E1ra megszerzett el\u00F6l"` : ""}>${c}</button>`).join("")}</span>`;
    }
    function eladSorrendJel() {
        if (!gyoker) return;
        gyoker.querySelectorAll("[data-esorrend]").forEach(b => {
            const a = !eladNezet.rendez && eladNezet.sorrend === b.getAttribute("data-esorrend");
            b.classList.toggle("aktiv", a);
            b.setAttribute("aria-pressed", a ? "true" : "false");
        });
    }
    function eladHelyHTML(tElore) {
        const h = eladHely;
        const n = eladEltero().length;
        const t = tElore !== undefined ? tElore : taskaErtek();
        const taska = t
            ? `<span class="etaska">T\u00E1sk\u00E1d \u00E9rt\u00E9ke: <b>${kinalatSzam(t.ossz)} $</b></span>`
            : "";
        return `<span class="ehelybal">${eladSorrendHTML()}</span>${taska}
            <button type="button" class="gomb agomb emind" data-emind${n ? "" : " hidden"}
              title="Minden t\u00E1rgy \u00E1ra, mennyis\u00E9ge \u00E9s \u00E1rver\u00E9se vissza alapra">Mind alapra (${n})</button>
            <button type="button" class="gomb agomb" data-ehely-friss ${h.allapot === "tolt" ? "disabled" : ""}
              title="A hely \u00FAjrak\u00E9rdez\u00E9se">Hely friss\u00EDt\u00E9se</button>`;
    }

    function eladHelyKiir() {
        const el = gyoker && gyoker.getElementById("eladHely");
        if (el) { el.innerHTML = eladHelyHTML(); eladHelyGombKotes(); }
        const v = gyoker && gyoker.getElementById("eladVaros");
        if (v) v.innerHTML = eladVarosHTML();
    }
    function eladHelyGombKotes() {
        if (gyoker) gyoker.querySelectorAll("#eladHely [data-esorrend]").forEach(b => b.addEventListener("click", () => {
            eladNezet.sorrend = b.getAttribute("data-esorrend") === "leg" ? "leg" : "abc";
            beall.eladSorrend = eladNezet.sorrend;
            beallMent();
            /* A gomb visszaveszi a fejlec rendezeset. */
            if (eladNezet.rendez) {
                eladNezet.rendez = null; eladNezet.irany = 1;
                const f = gyoker.querySelector(".efej");
                if (f) { f.outerHTML = eladFejlecHTML(); eladFejlecKotes(); }
            }
            eladSorrendJel();
            eladListaUjra();
        }));
        const g = gyoker && gyoker.querySelector("[data-ehely-friss]");
        if (g) g.addEventListener("click", () => { if (!g.disabled) eladHelyTolt(); });
        const m = gyoker && gyoker.querySelector("[data-emind]");
        if (m) m.addEventListener("click", () => {
            if (eladKuldes) return;
            eladNezet.mezok = {};
            eladListaUjra();
            eladJelekFrissit(null);
        });
    }

    /* --- KESZLETEM --- */
    /* Egy dollar alatti tarolt ar: a bolt 1 dollart fizet (a fejleszto a
       jatekban ellenorizte). Ugyanez a szabaly a taska erteke es a
       feladosav minimuma (t79). */
    function egyDollarosE(it) {
        return !!it && !(Number(it.sell_price) > 0) && it.sellable !== false
            && Number(it.price) > 0 && Math.floor(Number(it.price) / 2) === 0;
    }
    function eladMinimum(id) {
        const it = itemObj(id);
        const v = it ? Number(it.sell_price) : 0;
        if (v > 0) return Math.round(v);
        const m = piacArak(id, null, targyNev(id), false).minimum || 0;
        if (m > 0) return m;
        return egyDollarosE(it) ? 1 : 0;
    }

    /* -----------------------------------------------------------------
       A TASKAD ERTEKE (t46). A jatek bolti eladasi ara (sell_price)
       szorozva a taskaban levo darabszammal.

       MERVE (2026-09-20, konzol): 430 fajta, 3669 darab, 627 965 $;
       49 fajtanak nincs sell_price erteke, ebbol 45 sellable: false
       (nem eladhato), 4-nel csak az ar hianyzik. A tárgyakon kulon mezo
       a price, a sell_price, az auctionable, a tradeable es a sellable.
       A RAJTAD LEVO felszereles NINCS a taskaban (mert: a Wear.item_ids
       tiz targyanak a Bag.getItemCount erteke mind nulla), ezert az
       osszegben sem szerepel; a buborek kulon sorban mutatja.
       ----------------------------------------------------------------- */
    function taskaErtek() {
        const ki = { ossz: 0, fajta: 0, darab: 0, nemElado: 0, arHianyzik: 0, apro: 0, top: [], viselet: 0, viseletDb: 0 };
        try {
            const bag = jatek().Bag;
            if (!bag || typeof bag.getItemsIdsByBaseItemIds !== "function") return null;
            const cs = bag.getItemsIdsByBaseItemIds() || {};
            Object.keys(cs).forEach(alap => {
                const idk = cs[alap] || [];
                if (!idk.length) return;
                const id = idk[0];
                const it = itemObj(id);
                const n = Number(keszlet(id)) || 0;
                if (!n) return;
                ki.fajta++; ki.darab += n;
                let ar = it && Number(it.sell_price) > 0 ? Number(it.sell_price) : 0;
                if (!ar && egyDollarosE(it)) { ar = 1; ki.apro++; }
                if (!ar) {
                    if (it && it.sellable === false) ki.nemElado++; else ki.arHianyzik++;
                    return;
                }
                ki.ossz += ar * n;
                ki.top.push({ nev: targyNev(id), db: n, ertek: ar * n });
            });
            ki.top.sort((a, b) => b.ertek - a.ertek);
            ki.top = ki.top.slice(0, 5);
        } catch (e) { return null; }
        try {
            const W = jatek().Wear;
            const idk = (W && W.item_ids) || [];
            idk.forEach(id => {
                if (!id) return;
                const it = itemObj(id);
                const ar = it && Number(it.sell_price) > 0 ? Number(it.sell_price) : 0;
                if (ar > 0) { ki.viselet += ar; ki.viseletDb++; }
            });
        } catch (e) { /* a viselet marad nulla */ }
        return ki;
    }

    /* t48: a buborek helyett a lista alatti sor mondja el ugyanezt. */
    function taskaLabjegyzet(tElore) {
        const t = tElore !== undefined ? tElore : taskaErtek();
        if (!t) return "";
        const kimarad = t.nemElado + t.arHianyzik;
        const reszek = [`${t.fajta} fajta, ${t.darab} darab`];
        if (kimarad) {
            const okok = [];
            if (t.nemElado) okok.push(`${t.nemElado} eset\u00E9n a bolt nem veszi meg`);
            if (t.arHianyzik) okok.push(`${t.arHianyzik} eset\u00E9n a j\u00E1t\u00E9k nem ad bolti \u00E1rat`);
            reszek.push(`${kimarad} t\u00E1rgynak nincs \u00E9rt\u00E9ke: ` + okok.join(", "));
        }
        if (t.apro) reszek.push(`${t.apro} t\u00E1rgy 1 $/db \u00E1ron sz\u00E1m\u00EDt`);
        if (t.viseletDb) reszek.push(`a rajtad l\u00E9v\u0151 felszerel\u00E9s ${kinalatSzam(t.viselet)} $, nincs az \u00F6sszegben`);
        return reszek.join(" \u00B7 ") + ".";
    }

    function eladKeszlet() {
        const ki = [];
        try {
            const bag = jatek().Bag;
            if (!bag || typeof bag.getItemsIdsByBaseItemIds !== "function") return ki;
            const cs = bag.getItemsIdsByBaseItemIds() || {};
            Object.keys(cs).forEach(alap => {
                const idk = cs[alap] || [];
                if (!idk.length) return;
                const id = idk[0];
                /* t82: a tablazat allando reszei targyankent egyszer
                   szamolodnak (nev, ikon, minimum, kategoria); minden
                   ujraepitesnel csak a darabszam es az inv_id. */
                const al = eladAllando(id);
                if (!al) return;
                const db = Number(keszlet(id)) || 0;
                ki.push(Object.assign({}, al, { keszlet: db, ertek: al.bolti * db, inv: eladInvId(bag, idk) }));
            });
        } catch (e) { /* ures lista */ }
        return ki;
    }
    const eladAllandoTar = new Map();
    function eladAllando(id) {
        const k = String(id);
        if (eladAllandoTar.has(k)) return eladAllandoTar.get(k);
        const it = itemObj(id);
        if (!it) return null;
        /* t48: bolti elado ar (sell_price) es a sor erteke. A
           nem eladhato (sellable === false) es az ar nelkuli sorok
           kulon jelet kapnak, nem nullat. */
        const bolti = Number(it.sell_price) > 0 ? Number(it.sell_price) : 0;
        /* MERVE (2026-09-20): a bolti ar a vetelar fele, lefele
           kerekitve (8752 targybol 6405-nel pontosan ennyi). Ha a
           vetelar 1, a tarolt sell_price nulla, DE a bolt ezekert
           egy dollart fizet - a fejleszto a jatekban ellenorizte
           (Orolt kave, Torott sarkantyu, Az elso cent). Ezert az
           ilyen sor erteke darabonkent 1 $. */
        const aprope = !bolti && it.sellable !== false
            && Number(it.price) > 0 && Math.floor(Number(it.price) / 2) === 0;
        const egysegAr = bolti || (aprope ? 1 : 0);
        const nev = targyNev(id);
        const ki = {
            id: String(id), nev: nev, nevN: piacNormal(nev), ikon: targyIkon(id),
            min: eladMinimum(id),
            adhato: it.auctionable !== false,
            bolti: egysegAr, elado: it.sellable !== false, apro: aprope,
            kat: piacKategoria(it.getType ? it.getType() : it.type)
        };
        eladAllandoTar.set(k, ki);
        return ki;
    }
    /* A natív taska "utoljara megszerzett" sorrendje: a taskapeldany
       inv_id-je csokkenoen (MERVE 2026-10-07: az elso 8 egyezett). Egy
       targyfajta tobb valtozatabol a legnagyobb szamit. */
    function eladInvId(bag, idk) {
        let m = 0;
        if (!bag || typeof bag.getItemByItemId !== "function") return 0;
        idk.forEach(x => {
            try { const p = bag.getItemByItemId(x); const v = Number(p && p.inv_id) || 0; if (v > m) m = v; }
            catch (e) { /* nem baj */ }
        });
        return m;
    }

    function eladUjjlenyomat() {
        try {
            const cs = jatek().Bag.getItemsIdsByBaseItemIds() || {};
            return Object.keys(cs).sort().map(k => {
                const id = (cs[k] || [])[0];
                return id == null ? "" : id + ":" + keszlet(id);
            }).join("|");
        } catch (e) { return ""; }
    }

    function eladRendezett(sorok) {
        const q = piacNormal(eladNezet.kereses);
        const k = eladNezet.rendez, ir = eladNezet.irany;
        const nev = t => t.nevN != null ? t.nevN : piacNormal(t.nev);
        return sorok
            .filter(t => (!q || nev(t).includes(q)) && (eladNezet.kategoria === "mind" || t.kat === eladNezet.kategoria))
            .sort((a, b) => {
                if (k) {
                    let d = 0;
                    if (k === "nev") d = nev(a).localeCompare(nev(b), "hu");
                    else if (k === "keszlet") d = a.keszlet - b.keszlet;
                    else if (k === "ertek") {
                        /* Ertek nelkul a vegere, iranytol fuggetlenul. */
                        const ae = a.ertek > 0, be = b.ertek > 0;
                        if (ae !== be) return ae ? -1 : 1;
                        d = a.ertek - b.ertek;
                    }
                    else if (k === "min") {
                        /* A nem arverezheto a vegere megy, iranytol fuggetlenul. */
                        if (a.adhato !== b.adhato) return a.adhato ? -1 : 1;
                        d = a.min - b.min;
                    }
                    if (d) return d * ir;
                }
                if (q) {
                    const ka = nev(a).indexOf(q) === 0 ? 0 : 1, kb = nev(b).indexOf(q) === 0 ? 0 : 1;
                    if (ka !== kb) return ka - kb;
                }
                if (!k && eladNezet.sorrend === "leg" && (b.inv || 0) !== (a.inv || 0)) return (b.inv || 0) - (a.inv || 0);
                return nev(a).localeCompare(nev(b), "hu");
            });
    }

    function eladSorHTML(t) {
        const v = eladNezet.valasztott === t.id;
        return `
          <div class="ksor2 esor${t.adhato ? "" : " tiltott"}${v ? " valasztott" : ""}" data-eid="${esc(t.id)}">
            ${t.ikon ? `<img src="${esc(t.ikon)}" alt="" loading="lazy" decoding="async" data-iid="${esc(t.id)}">` : targyBubIkonHTML(t.id, null)}
            <div class="knev2">${esc(t.nev)}${eladJelHTML(t.id)}</div>
            <div class="jobb ekeszlet">${t.keszlet}</div>
            <div class="jobb${t.adhato ? "" : " halvany"}">${t.adhato ? (t.min > 0 ? kinalatSzam(t.min) + " $/db" : "-") : "nem \u00E1rverezhet\u0151"}</div>
            <div class="eertek${t.ertek > 0 ? "" : " nincs"}">${t.ertek > 0 ? kinalatSzam(t.ertek) + " $"
                : (t.elado ? "nincs bolti \u00E1r" : "bolt nem veszi")}</div>
          </div>`;
    }

    function eladFejlecHTML() {
        return `<div class="kfej2 efej"><div></div>${ELAD_OSZLOPOK.map(o => {
            const a = eladNezet.rendez === o.kulcs;
            const nyil = a ? (eladNezet.irany > 0 ? " \u25B2" : " \u25BC") : "";
            return `<button type="button" class="krend${o.jobb ? " jobb" : ""}${a ? " aktiv" : ""}" data-erend="${o.kulcs}">${o.cimke}${nyil}</button>`;
        }).join("")}</div>`;
    }

    function eladUzenetHTML() {
        return `<div class="kvuzenet${eladNezet.uzenetHiba ? " kvhiba" : ""}" id="evUzenet" role="status">${esc(eladNezet.uzenet)}</div>`;
    }

    function eladUzenet(szoveg, hiba, nativ) {
        eladNezet.uzenet = szoveg;
        eladNezet.uzenetHiba = !!hiba;
        /* Az Atvetel fulrol inditott eladasi muvelet ott is latszodjon. */
        if (beall.ful === "atvetel") { licitNezet.uzenet = szoveg; licitNezet.uzenetHiba = !!hiba; }
        const el = gyoker && (gyoker.getElementById("evUzenet") || gyoker.getElementById("lvUzenet"));
        if (el) { el.textContent = szoveg; el.classList.toggle("kvhiba", !!hiba); }
        uzenetIdozit("elad", szoveg, hiba, sz => {
            if (eladNezet.uzenet === sz) eladUzenet("", false, false);
            else if (licitNezet.uzenet === sz) licitUzenet("", false, false);
        });
        if (!nativ || !szoveg) return;
        try {
            const J = jatek();
            const Oszt = hiba ? J.MessageError : J.MessageSuccess;
            if (typeof Oszt === "function") new Oszt(szoveg).show();
        } catch (e) { /* a panel uzenete eleg */ }
    }

    function keszletemHTML() {
        /* t82: a taska erteke rajzolasonkent egyszer (fejlec + labjegyzet). */
        const t = taskaErtek();
        return `
          <div class="kinalat">
            <div class="ehely" id="eladHely">${eladHelyHTML(t)}</div>
            <div class="kinalat-fej">
              <div class="piacmezo">
                <input id="eKereses" autocomplete="off" spellcheck="false"
                  placeholder="Keres\u00E9s a k\u00E9szletedben" value="${esc(eladNezet.kereses)}">
                <button type="button" class="torlo" data-etorol
                  aria-label="Keres\u00E9s t\u00F6rl\u00E9se"${eladNezet.kereses ? "" : " hidden"}>\u2715</button>
              </div>
              <span class="pkatvalaszto" role="group" aria-label="T\u00EDpus">
                ${PIAC_KATEGORIAK.map(k => `<button type="button" class="pkat${eladNezet.kategoria === k.kulcs ? " aktiv" : ""}"
                  data-ekatv="${k.kulcs}" aria-pressed="${eladNezet.kategoria === k.kulcs ? "true" : "false"}">${k.cimke}</button>`).join("")}
              </span>
            </div>
            <div style="height:8px"></div>
            ${eladUzenetHTML()}
            ${eladFejlecHTML()}
            <div class="kinalatlista" id="eladLista"></div>
            <p class="labj">Sorra kattintva ny\u00EDlik a felad\u00E1si s\u00E1v. Minden felad\u00E1s k\u00E9t kattint\u00E1s.
              ${esc(taskaLabjegyzet(t))}</p>
          </div>`;
    }

    /* A lista ujraepitese. A nyitott savot a mentett mezoertekekbol
       rajzoljuk vissza. */
    /* t82: a lista reszletekben rajzolodik, mint a Kinalat: az elso
       ELAD_ELSO sor azonnal, a tobbi kepkockankent ELAD_ADAG soronkent.
       Uj ujraepites a futot leallitja (eladRajzFutas). A feladosav csak
       akkor nyilik, ha a kivalasztott sor mar kint van. */
    const ELAD_ELSO = 60, ELAD_ADAG = 120;
    let eladRajzFutas = 0;
    function eladListaUjra() {
        const lista = gyoker && gyoker.getElementById("eladLista");
        if (!lista) return;
        const sorok = eladRendezett(eladKeszlet());
        if (eladNezet.valasztott && !sorok.some(t => t.id === eladNezet.valasztott && t.adhato)) eladNezet.valasztott = null;
        const futas = ++eladRajzFutas;
        if (!sorok.length) {
            lista.innerHTML = `<div class="piacures">Nincs tal\u00E1lat a k\u00E9szletedben.</div>`;
            eladSavFrissit();
            return;
        }
        const vi = eladNezet.valasztott ? sorok.findIndex(t => t.id === eladNezet.valasztott) : -1;
        lista.innerHTML = sorok.slice(0, ELAD_ELSO).map(eladSorHTML).join("");
        if (vi < ELAD_ELSO) eladSavFrissit();
        let i = ELAD_ELSO;
        const tovabb = () => {
            if (futas !== eladRajzFutas || !lista.isConnected) return;
            const kezd = i;
            const resz = sorok.slice(i, i + ELAD_ADAG);
            i += resz.length;
            if (!resz.length) return;
            lista.insertAdjacentHTML("beforeend", resz.map(eladSorHTML).join(""));
            if (vi >= kezd && vi < i) eladSavFrissit();
            if (i < sorok.length) requestAnimationFrame(tovabb);
        };
        if (i < sorok.length) requestAnimationFrame(tovabb);
    }

    /* Csak a keszlet szamait irja at, a sav mezoihez nem nyul. */
    function eladKeszletKiir() {
        if (!gyoker) return;
        gyoker.querySelectorAll("#eladLista .esor").forEach(sor => {
            const c = sor.querySelector(".ekeszlet");
            const db = keszlet(sor.getAttribute("data-eid"));
            if (c && db != null && c.textContent !== String(db)) c.textContent = String(db);
        });
        eladSavSzamol();
    }

    function eladSavFokuszban() {
        const sav = gyoker && gyoker.getElementById("eladSav");
        const a = gyoker && gyoker.activeElement;
        return !!(sav && a && sav.contains(a));
    }

    function eladMezok(id) {
        if (!eladNezet.mezok[id]) eladNezet.mezok[id] = { licit: "", azonnali: "", menny: "1", aukcio: "1" };
        return eladNezet.mezok[id];
    }

    function eladVarosTag() {
        try { return Number(jatek().Character.homeTown.town_id) || 0; } catch (e) { return 0; }
    }

    /* Ures mezo: null. Nem egesz, pozitiv szam: NaN. */
    function eladSzam(s) {
        const x = String(s == null ? "" : s).replace(/[\s\u00A0]/g, "");
        if (x === "") return null;
        return /^\d+$/.test(x) && Number(x) > 0 ? Number(x) : NaN;
    }

    /* Hova megy a feladas. Varosban a get_town varosa. Mezon a natív
       ablak a legutobb megnyitott piac szamat kuldene (MarketWindow.townId);
       ha az 0, a sajat varos. Hogy a szerver valoban oda teszi-e, NEM
       MERT (a fejleszto feladata). */
    function eladCel() {
        const J = jatek();
        const h = eladHely;
        if (h.allapot === "tolt" || h.allapot === "ures") return { mehet: false, ok: "Hely lek\u00E9rdez\u00E9se\u2026" };
        if (h.allapot === "hiba") return { mehet: false, ok: "A hely nem ismert, friss\u00EDtsd." };
        let szabad = true;
        try { szabad = J.Game ? J.Game.marketFreeTradeEnabled !== false : true; } catch (e) { szabad = true; }
        if (!szabad && !eladVarosTag()) return { mehet: false, ok: "V\u00E1ros n\u00E9lk\u00FCl nem adhatsz el." };
        if (h.allapot === "kesz") {
            if (!(h.szint > 0)) return { mehet: false, ok: "Ebben a v\u00E1rosban nincs piac." };
            return { mehet: true, helyben: true, townId: h.townId, szint: h.szint };
        }
        let express = false;
        try { express = !!(J.Premium && J.Premium.buyable && J.Premium.buyable.expresssell); } catch (e) { express = false; }
        if (!express) return { mehet: false, ok: "Nem vagy v\u00E1rosban, \u00E9s az aranyr\u00F6g\u00F6s felad\u00E1s most nem \u00E9rhet\u0151 el." };
        const vid = piacVarosId() || eladVarosTag();
        if (!vid) return { mehet: false, ok: "Nincs c\u00E9lv\u00E1ros: nyiss meg egyszer egy piacot, vagy \u00E1llj v\u00E1rosba." };
        return { mehet: true, helyben: false, townId: vid, szint: 0,
                 celSzoveg: piacVarosId() ? `a legut\u00F3bb megnyitott piac (#${vid})` : `a saj\u00E1t v\u00E1rosod (#${vid})` };
    }

    /* A natív feladasi ablak negy szabalya (Igen gomb), plusz a
       mezok alakja. Visszaad: { hiba, ... ertekek }. */
    function eladErtekel(t) {
        const m = eladMezok(t.id);
        const licit = eladSzam(m.licit), azonnali = eladSzam(m.azonnali);
        const menny = t.keszlet > 1 ? eladSzam(m.menny) : 1;
        const aukcio = eladSzam(m.aukcio);
        const napok = eladNezet.napok;
        const tag = eladVarosTag() > 0;
        const jog = tag ? eladNezet.jog : 2;
        const ki = { licit, azonnali, menny, aukcio, napok, jog, hiba: "", egyseg: null, ossz: null, maxAuk: 1 };
        const jo = v => v != null && !isNaN(v);
        /* A maximumot az arak hibaja eseten is kiirjuk, ha a mennyiseg jo. */
        if (jo(menny) && menny <= t.keszlet) ki.maxAuk = Math.max(1, Math.floor(t.keszlet / menny));
        if ((licit != null && isNaN(licit)) || (azonnali != null && isNaN(azonnali))) { ki.hiba = "Az \u00E1r pozit\u00EDv eg\u00E9sz sz\u00E1m legyen."; return ki; }
        if (licit == null && azonnali == null) { ki.hiba = ELAD_NINCS_AR; ki.ures = true; return ki; }
        if (licit != null && azonnali != null && azonnali <= licit) { ki.hiba = "Az azonnali \u00E1r legyen nagyobb a legkisebb licitn\u00E9l."; return ki; }
        if (!jo(menny) || menny > t.keszlet) { ki.hiba = `A mennyis\u00E9g 1 \u00E9s ${t.keszlet} k\u00F6z\u00F6tt lehet.`; return ki; }
        const ar = azonnali != null ? azonnali : licit;
        ki.egyseg = Math.ceil(ar / menny);
        /* t86: a szerver a TELJES arat nezi (MERT 2026-10-08: 2 db, 399 $,
           minimum 200 $/db -> "A tárgy aukciós ára túl alacsony."; a natív
           urlap a felfele kerekitett egysegarral atengedte). A hiba szovege
           a natív urlape. */
        if (t.min > 0 && ar < t.min * menny) { ki.hiba = ELAD_MIN_HIBA; return ki; }
        if (!jo(aukcio) || aukcio > ki.maxAuk) { ki.hiba = `Az \u00E1rver\u00E9sek sz\u00E1ma 1 \u00E9s ${ki.maxAuk} k\u00F6z\u00F6tt lehet.`; return ki; }
        /* Az ar a teljes kotegre vonatkozik (Kinalat meres: egysegar =
           ar / darab), ezert az osszesen ar x arveresek. A t15-t16 meg a
           mennyiseggel is szorzott (visszavonva). */
        ki.ossz = Math.max(licit || 0, azonnali || 0) * aukcio;
        return ki;
    }

    /* Dij a natív kepletben. A tenyleges osszeget a szerver adja. */
    function eladDij(e, cel) {
        if (!cel || !cel.mehet || !(cel.szint > 0) || e.hiba) return null;
        let max = 10, sajat = 0;
        try { max = Number(jatek().MarketWindow.maxstage) || 10; } catch (x) { max = 10; }
        sajat = eladVarosTag();
        const alapAr = (e.licit != null && e.azonnali != null) ? Math.min(e.licit, e.azonnali)
            : (e.azonnali != null ? e.azonnali : e.licit);
        const alap = Math.floor(alapAr * 0.02 * max + e.napok * 3);
        return Math.ceil(alap / cel.szint * (cel.townId === sajat ? 1 : 2)) * e.aukcio;
    }

    function eladValasztottTargy() {
        const id = eladNezet.valasztott;
        if (!id) return null;
        return eladKeszlet().find(t => t.id === id) || null;
    }

    /* Halvany helyorzo az armezokben: a minimum a megadott mennyisegre
       (az ar a teljes kotegre vonatkozik). Nem ertek, nem kuldodik el. */
    function eladMinOssz(t) {
        const mz = eladMezok(t.id);
        const egyseg = Math.max(t.min || 0, Number(mz.javasolt) || 0);
        if (!(egyseg > 0)) return 0;
        const m = eladSzam(mz.menny);
        const db = t.keszlet > 1 && m != null && !isNaN(m) && m <= t.keszlet ? m : 1;
        return egyseg * db;
    }
    /* Mi ter el az alaptol egy targynal (ures ar, 1 darab, 1 arveres). */
    function eladElteres(id) {
        const m = eladNezet.mezok[id];
        if (!m) return [];
        const ki = [];
        const tr = v => String(v == null ? "" : v).trim();
        if (tr(m.licit) !== "") ki.push(`legkisebb licit ${tr(m.licit)} $`);
        if (tr(m.azonnali) !== "") ki.push(`azonnali \u00E1r ${tr(m.azonnali)} $`);
        if (tr(m.menny) !== "1" && tr(m.menny) !== "") ki.push(`mennyis\u00E9g ${tr(m.menny)}`);
        if (tr(m.menny) === "") ki.push("mennyis\u00E9g \u00FCres");
        if (Number(m.javasolt) > 0) ki.push(`javasolt egys\u00E9g\u00E1r ${m.javasolt} $/db`);
        if (tr(m.aukcio) !== "1") ki.push(tr(m.aukcio) === "" ? "\u00E1rver\u00E9sek \u00FCres" : `\u00E1rver\u00E9sek ${tr(m.aukcio)}`);
        return ki;
    }
    function eladEltero() {
        return Object.keys(eladNezet.mezok).filter(id => eladElteres(id).length);
    }
    function eladJelHTML(id) {
        const e = eladElteres(id);
        if (!e.length) return "";
        const sz = "Nem alap\u00E9rt\u00E9ken: " + e.join(", ") + ".";
        return `<span class="ejel" data-megj="${esc(sz)}" aria-label="${esc(sz)}"></span>`;
    }
    /* A sor jele es a felso gomb, ujrarajzolas nelkul. */
    function eladJelekFrissit(id) {
        if (!gyoker) return;
        if (id != null) {
            const sor = [...gyoker.querySelectorAll("#eladLista .esor")].find(x => x.getAttribute("data-eid") === id);
            const nev = sor && sor.querySelector(".knev2");
            if (nev) {
                const regi = nev.querySelector(".ejel");
                const uj = eladJelHTML(id);
                if (regi) regi.remove();
                if (uj) nev.insertAdjacentHTML("beforeend", uj);
            }
        }
        const g = gyoker.querySelector("[data-emind]");
        if (g) {
            const n = eladEltero().length;
            g.hidden = !n;
            g.textContent = `Mind alapra (${n})`;
        }
    }
    function eladTargyAlap(id) {
        delete eladNezet.mezok[id];
    }
    function eladDollarHTML(azon) {
        return `<span class="edollar" data-edollar="${azon}" title="A halv\u00E1ny sz\u00E1m be\u00EDr\u00E1sa">$</span>`;
    }
    /* A $ jel csak ures, helyorzos mezonel kattinthato. */
    function eladDollarFrissit() {
        if (!gyoker) return;
        gyoker.querySelectorAll("#eladSav [data-edollar]").forEach(d => {
            const f = gyoker.getElementById(d.getAttribute("data-edollar"));
            d.classList.toggle("aktiv", !!(f && f.value.trim() === "" && f.placeholder));
        });
    }

    function eladMinHelyorzo(t) {
        const v = eladMinOssz(t);
        return v > 0 ? ` placeholder="${esc(String(v))}"` : "";
    }

    function eladSavHTML(t) {
        const m = eladMezok(t.id);
        const tag = eladVarosTag() > 0;
        const jog = tag ? eladNezet.jog : 2;
        return `
          <div class="kvsav esav" id="eladSav">
            <button type="button" class="gomb agomb ealap" data-ealap
              title="Csak ennek a t\u00E1rgynak az \u00E1ra, mennyis\u00E9ge \u00E9s \u00E1rver\u00E9se">Alap</button>
            <div class="emezok">
              <span class="emz">Legkisebb licit <input id="eLicit" inputmode="numeric" autocomplete="off" aria-label="Legkisebb licit" value="${esc(m.licit)}"${eladMinHelyorzo(t)}> ${eladDollarHTML("eLicit")}</span>
              <span class="emz">Azonnali \u00E1r <input id="eAzonnali" inputmode="numeric" autocomplete="off" aria-label="Azonnali \u00E1r" value="${esc(m.azonnali)}"${eladMinHelyorzo(t)}> ${eladDollarHTML("eAzonnali")}</span>
              ${t.keszlet > 1 ? `<label class="emz">Mennyis\u00E9g <input id="eMenny" class="rovid" inputmode="numeric" autocomplete="off" value="${esc(m.menny)}">
                <span class="nlink" data-emennymax title="A teljes k\u00E9szlet">(max ${t.keszlet})</span></label>` : ""}
              <label class="emz">\u00C1rver\u00E9sek <input id="eAukcio" class="rovid" inputmode="numeric" autocomplete="off" value="${esc(m.aukcio)}">
                <span class="nlink" data-emax title="A legt\u00F6bb, ami a k\u00E9szletb\u0151l kif\u00E9r">(max <span id="eMaxAuk">1</span>)</span></label>
            </div>
            <div class="emezok">
              <span class="emz">Id\u0151tartam
                <span class="pkatvalaszto" role="group" aria-label="Id\u0151tartam">${[1, 2, 3, 4, 5, 6, 7].map(n =>
                  `<button type="button" class="pkat${eladNezet.napok === n ? " aktiv" : ""}" data-enap="${n}"
                    aria-pressed="${eladNezet.napok === n ? "true" : "false"}">${n}</button>`).join("")}</span> nap</span>
              <span class="emz">L\u00E1that\u00F3s\u00E1g
                <span class="pkatvalaszto" role="group" aria-label="L\u00E1that\u00F3s\u00E1g">${ELAD_JOGOK.map(j => {
                  const tilt = !tag && j.ertek !== 2;
                  const a = jog === j.ertek;
                  return `<button type="button" class="pkat${a ? " aktiv" : ""}${tilt ? " etilt" : ""}" data-ejog="${j.ertek}"
                    aria-pressed="${a ? "true" : "false"}"${tilt ? ` aria-disabled="true" title="Csak v\u00E1rosi tagnak v\u00E1laszthat\u00F3."` : ""}>${j.cimke}</button>`;
                }).join("")}</span></span>
            </div>
            <label class="emz eszeles">Megjegyz\u00E9s <input id="eMegj" autocomplete="off" spellcheck="false" value="${esc(eladNezet.megjegyzes)}"></label>
            <div class="kvhiba ehiba" id="eHiba"></div>
            <div class="elab">
              <span id="eOssz"></span>
              <span class="egombok">
                <button type="button" class="gomb agomb" data-emegse>M\u00E9gse</button>
                <button type="button" class="gomb" data-efelad>Felad\u00E1s</button>
              </span>
            </div>
            <div class="kvlab" id="eInfo"></div>
          </div>`;
    }

    /* A sav szamai es a gomb allapota. A mezokhoz nem nyul. */
    function eladSavSzamol() {
        const sav = gyoker && gyoker.getElementById("eladSav");
        if (!sav) return;
        const t = eladValasztottTargy();
        if (!t) return;
        const e = eladErtekel(t);
        const cel = eladCel();
        const dij = eladDij(e, cel);
        const hibaEl = gyoker.getElementById("eHiba");
        const ossz = gyoker.getElementById("eOssz");
        const info = gyoker.getElementById("eInfo");
        const max = gyoker.getElementById("eMaxAuk");
        const gomb = sav.querySelector("[data-efelad]");
        if (max) max.textContent = String(e.maxAuk);
        /* Az ures urlap nem hiba: piros sor csak valodi hibanal. */
        if (hibaEl) hibaEl.textContent = e.ures ? "" : e.hiba;
        if (ossz && e.ures) ossz.innerHTML = `<span class="halvany">${ELAD_NINCS_AR}</span>`;
        else if (ossz) {
            const dijSz = !cel.mehet ? "-" : (cel.helyben
                ? (dij != null ? `kb. <b>${kinalatSzam(dij)} $</b>` : "-")
                : "nem ismert");
            ossz.innerHTML = e.hiba ? "" :
                `Egys\u00E9g\u00E1r <b>${kinalatSzam(e.egyseg)} $</b> &middot; \u00F6sszesen <b>${kinalatSzam(e.ossz)} $</b> &middot; d\u00EDj ${dijSz}` +
                (e.aukcio > 1 ? ` <span class="halvany">(${e.aukcio} \u00E1rver\u00E9s)</span>` : "");
        }
        if (info) {
            const jav = Number(eladMezok(t.id).javasolt) || 0;
            const mn = t.keszlet > 1 ? eladSzam(eladMezok(t.id).menny) : 1;
            const tobb = mn != null && !isNaN(mn) && mn > 1 ? `, ${mn} db eset\u00E9n legal\u00E1bb ${kinalatSzam(t.min * mn)} $` : "";
            const minSz = (t.min > 0 ? `A j\u00E1t\u00E9k minimuma ${kinalatSzam(t.min)} $/db${tobb} (az azonnali \u00E1rra, ha nincs, a licitre).` : "") +
                (jav > 0 ? ` A halv\u00E1ny \u00E1r a Gy\u0171jt\u00E9s f\u00FCl sor\u00E1nak egys\u00E9g\u00E1ra: ${kinalatSzam(jav)} $/db.` : "");
            const celSz = !cel.mehet ? cel.ok
                : (cel.helyben ? "" : `Aranyr\u00F6g\u00E9rt, a j\u00E1t\u00E9k saj\u00E1t ablak\u00E1val. C\u00E9l: ${cel.celSzoveg}.`);
            info.textContent = [minSz, celSz].filter(Boolean).join(" ");
            info.classList.toggle("kvhiba", !cel.mehet);
        }
        if (gomb) {
            const felirat = cel.mehet && !cel.helyben ? "Felad\u00E1s aranyr\u00F6g\u00E9rt" : "Felad\u00E1s";
            if (!gomb.dataset.eredeti && gomb.textContent !== felirat) gomb.textContent = felirat;
            gomb.disabled = eladKuldes || !!e.hiba || !cel.mehet;
            gomb.title = e.hiba || (cel.mehet ? "" : cel.ok);
        }
    }

    function eladSavFrissit() {
        const regi = gyoker.getElementById("eladSav");
        if (regi) regi.remove();
        gyoker.querySelectorAll("#eladLista .esor.valasztott").forEach(x => x.classList.remove("valasztott"));
        const id = eladNezet.valasztott;
        if (!id) return;
        const sor = [...gyoker.querySelectorAll("#eladLista .esor")].find(x => x.getAttribute("data-eid") === id);
        const t = eladValasztottTargy();
        if (!sor || !t || !t.adhato) { eladNezet.valasztott = null; return; }
        sor.classList.add("valasztott");
        sor.insertAdjacentHTML("afterend", eladSavHTML(t));
        const sav = gyoker.getElementById("eladSav");
        sav.addEventListener("click", e => e.stopPropagation());
        /* A lista gorgetese, hogy a sav gombjai is latszanak (csak a lista
           mozdul, a panel nem). */
        requestAnimationFrame(() => {
            try {
                const lista = gyoker.getElementById("eladLista");
                if (!lista || !sav.isConnected) return;
                const l = lista.getBoundingClientRect(), v = sav.getBoundingClientRect(), so = sor.getBoundingClientRect();
                if (v.bottom > l.bottom) lista.scrollTop += Math.min(v.bottom - l.bottom, so.top - l.top);
            } catch (x) { /* nem baj */ }
        });

        const visszaGomb = () => kinalatMegerositesVissza(sav.querySelector("[data-efelad]"));
        const mezo = (azon, kulcs) => {
            const el = gyoker.getElementById(azon);
            if (!el) return;
            el.addEventListener("focus", () => { try { el.select(); } catch (e) { /* nem baj */ } });
            /* A kijelolt szam athuzasa a szomszed mezobe: se huzas, se ejtes. */
            el.addEventListener("dragstart", e => e.preventDefault());
            el.addEventListener("drop", e => e.preventDefault());
            el.addEventListener("input", () => {
                /* A keszletnel tobb nem irhato be. */
                if (kulcs === "menny") {
                    const v = eladSzam(el.value);
                    if (v != null && !isNaN(v) && v > t.keszlet) el.value = String(t.keszlet);
                }
                if (kulcs === "megj") eladNezet.megjegyzes = el.value;
                else {
                    const mz = eladMezok(t.id);
                    mz[kulcs] = el.value;
                    /* Kezi atiras: az armezo mar nem a $-bol jon (t79). */
                    if (kulcs === "licit" || kulcs === "azonnali") delete mz[kulcs + "Dollar"];
                    eladJelekFrissit(t.id);
                }
                if (kulcs === "menny") {
                    const v = eladMinOssz(t);
                    const mz = eladMezok(t.id);
                    [["eLicit", "licit"], ["eAzonnali", "azonnali"]].forEach(([a, k]) => {
                        const f = gyoker.getElementById(a);
                        if (f) { if (v > 0) f.placeholder = String(v); else f.removeAttribute("placeholder"); }
                        /* A $-ral elfogadott ar koveti a mennyiseget, valodi
                           ertekkent (t79). */
                        if (mz[k + "Dollar"] && v > 0) {
                            mz[k] = String(v);
                            if (f) f.value = String(v);
                        }
                    });
                }
                visszaGomb();
                eladDollarFrissit();
                eladSavSzamol();
            });
        };
        /* Programbol allitott ertek: ugyanaz az ut, mint a gepelesnel. */
        const beir = (azon, ertek) => {
            const el = gyoker.getElementById(azon);
            if (!el) return;
            el.value = String(ertek);
            el.dispatchEvent(new Event("input", { bubbles: true }));
        };
        sav.querySelectorAll("[data-edollar]").forEach(d => d.addEventListener("click", () => {
            if (!d.classList.contains("aktiv")) return;
            const f = gyoker.getElementById(d.getAttribute("data-edollar"));
            if (f && f.value.trim() === "" && f.placeholder) {
                beir(f.id, f.placeholder);
                const k = f.id === "eLicit" ? "licit" : "azonnali";
                eladMezok(t.id)[k + "Dollar"] = true;
            }
        }));
        const mennyMax = sav.querySelector("[data-emennymax]");
        if (mennyMax) mennyMax.addEventListener("click", () => beir("eMenny", t.keszlet));
        const alapG = sav.querySelector("[data-ealap]");
        if (alapG) alapG.addEventListener("click", () => {
            if (eladKuldes) return;
            eladTargyAlap(t.id);
            eladJelekFrissit(t.id);
            eladSavFrissit();
        });
        mezo("eLicit", "licit");
        mezo("eAzonnali", "azonnali");
        mezo("eMenny", "menny");
        mezo("eAukcio", "aukcio");
        mezo("eMegj", "megj");

        const maxG = sav.querySelector("[data-emax]");
        if (maxG) maxG.addEventListener("click", () => {
            const e = eladErtekel(eladValasztottTargy() || t);
            const el = gyoker.getElementById("eAukcio");
            eladMezok(t.id).aukcio = String(e.maxAuk);
            if (el) el.value = String(e.maxAuk);
            eladJelekFrissit(t.id);
            visszaGomb();
            eladSavSzamol();
        });
        sav.querySelectorAll("[data-enap]").forEach(g => g.addEventListener("click", () => {
            eladNezet.napok = Number(g.getAttribute("data-enap")) || 1;
            sav.querySelectorAll("[data-enap]").forEach(x => {
                const a = x === g;
                x.classList.toggle("aktiv", a);
                x.setAttribute("aria-pressed", a ? "true" : "false");
            });
            visszaGomb();
            eladSavSzamol();
        }));
        sav.querySelectorAll("[data-ejog]").forEach(g => g.addEventListener("click", () => {
            if (g.getAttribute("aria-disabled") === "true") return;
            eladNezet.jog = Number(g.getAttribute("data-ejog"));
            sav.querySelectorAll("[data-ejog]").forEach(x => {
                const a = x === g;
                x.classList.toggle("aktiv", a);
                x.setAttribute("aria-pressed", a ? "true" : "false");
            });
            visszaGomb();
        }));
        const megse = sav.querySelector("[data-emegse]");
        if (megse) megse.addEventListener("click", () => { eladNezet.valasztott = null; eladSavFrissit(); });
        const felad = sav.querySelector("[data-efelad]");
        if (felad) felad.addEventListener("click", () => {
            if (felad.disabled || eladKuldes) return;
            const tt = eladValasztottTargy();
            if (!tt) return;
            const e = eladErtekel(tt);
            const cel = eladCel();
            if (e.hiba || !cel.mehet) { eladSavSzamol(); return; }
            if (cel.helyben) {
                const dij = eladDij(e, cel);
                if (!kinalatMegerosit(felad, dij != null ? `Biztos? D\u00EDj kb. ${kinalatSzam(dij)} $` : "Biztos?")) return;
            }
            eladKuld(tt, e, cel);
        });
        eladDollarFrissit();
        eladSavSzamol();
    }

    /* Ugyanaz a targy-e: a feladat azonositoja lehet az alapazonosito is,
       a taska pedig a csoport elso darabjat adja. */
    function eladAlapEgyezik(feladatId, taskaId) {
        try {
            const cs = jatek().Bag.getItemsIdsByBaseItemIds() || {};
            const idk = cs[String(feladatId)] || [];
            return idk.map(String).indexOf(String(taskaId)) !== -1;
        } catch (e) { return false; }
    }

    /* A Beszerzok ful "Piacra" gombja. A feladat mennyisege es cimzettje
       a savba kerul; az ar NEM, csak halvanyan latszik a sor egysegarabol
       (A valtozat, fejleszto dontese). Feladas csak a savban, ket
       kattintassal. */
    function eladasraNyit(f, elem) {
        if (!f) return;
        const a = sorAdat(f, keszletElosztas());
        if (a.piacon) return;
        if (!a.kesz) { allapot("piac_nincs_kesz"); return; }

        /* A sor egysegar-mezojenek pillanatnyi erteke, meg mentes elott. */
        const arMezo = elem && elem.closest && elem.closest(".piac-csomag")
            ? elem.closest(".piac-csomag").querySelector("[data-piac-ar]") : null;
        if (arMezo) {
            const beirt = piacArSzam(arMezo.value);
            const alap = piacAlapAr(f);
            if (alap > 0 && beirt > 0 && beirt < alap) { allapot("piac_ar_min"); return; }
            f.piacraEgysegar = beirt > 0 ? Math.round(beirt) : 0;
            if (alap > 0) f.piacraMinimumAr = alap;
            ment();
        }

        const t = eladKeszlet().find(x => x.id === String(f.id)) ||
                  eladKeszlet().find(x => eladAlapEgyezik(f.id, x.id));
        if (!t) { allapot("piac_nincs_targy"); return; }
        if (!t.adhato) { allapot("piac_nem_adhato"); return; }

        const egyseg = piacBeallitottAr(f, t.min);
        eladNezet.mezok[t.id] = {
            licit: "", azonnali: "",
            menny: String(Math.max(1, Math.min(Number(f.db) || 1, t.keszlet))),
            aukcio: "1",
            javasolt: egyseg > t.min ? egyseg : 0,
            feladat: f.kulcs
        };
        eladNezet.megjegyzes = String(f.nev || "");
        eladNezet.kereses = "";
        eladNezet.kategoria = "mind";
        eladNezet.valasztott = t.id;
        eladUzenet("", false, false);
        munkaBubRejt();
        piacArBubRejt();
        beall.ful = "piac";
        beall.nezet.piac = "keszletem";
        beallMent();
        rajzol();
        /* A kivalasztott sor legyen lathato a lista tetejen. */
        requestAnimationFrame(() => {
            try {
                const lista = gyoker.getElementById("eladLista");
                const sor = [...lista.querySelectorAll(".esor")].find(x => x.getAttribute("data-eid") === t.id);
                if (lista && sor) lista.scrollTop += sor.getBoundingClientRect().top - lista.getBoundingClientRect().top;
            } catch (e) { /* nem baj */ }
        });
    }

    /* t67: Piacra gomb a receptfa soraiban. Csak ott, ahol a vegtermeket MAS
       mesterseg gyartja (azt a hozzavalot adod el a gyartonak), es csak ha az
       adott sorbol a teljes mennyiseg megvan (a fejleszto dontese,
       2026-09-23). A megjegyzesbe a cimzett neve kerul, a darabszam a faban
       szereplo mennyiseg, nem a teljes keszleted. A panel ezt NEM konyveli:
       eladas utan a sor visszaesik hianyba, amig a kesz termek meg nem jon. */
    function faEladasraNyit(id, db, cimzett) {
        const t = eladKeszlet().find(x => x.id === String(id)) ||
                  eladKeszlet().find(x => eladAlapEgyezik(id, x.id));
        if (!t) { allapot("piac_nincs_targy"); return; }
        if (!t.adhato) { allapot("piac_nem_adhato"); return; }
        eladNezet.mezok[t.id] = {
            licit: "", azonnali: "",
            menny: String(Math.max(1, Math.min(Number(db) || 1, t.keszlet))),
            aukcio: "1", javasolt: 0, feladat: ""
        };
        eladNezet.megjegyzes = String(cimzett || "");
        eladNezet.kereses = "";
        eladNezet.kategoria = "mind";
        eladNezet.valasztott = t.id;
        eladUzenet("", false, false);
        munkaBubRejt();
        piacArBubRejt();
        beall.ful = "piac";
        beall.nezet.piac = "keszletem";
        beallMent();
        rajzol();
    }

    function eladUtan() {
        try { const E = jatek().EventHandler; if (E && typeof E.signal === "function") E.signal("inventory_changed"); }
        catch (e) { /* nem baj */ }
        eladKuldes = false;
        if (ajanlatok.allapot !== "tolt") ajanlatok.allapot = "ures";
        eladSurit();
        eladSavSzamol();
    }

    function eladKuld(t, e, cel) {
        const J = jatek(), A = J.Ajax;
        if (eladKuldes) return;
        const obj = {
            town_id: cel.townId, item_id: Number(t.id), itemcount: e.menny, auctioncount: e.aukcio,
            sellrights: e.jog, auctionlength: e.napok, description: String(eladNezet.megjegyzes || ""),
            direction: "SELL"
        };
        if (e.licit != null) obj.auctionprice = e.licit;
        if (e.azonnali != null) obj.maxprice = e.azonnali;
        const leiras = `${t.nev}${e.menny > 1 ? " \u00D7" + e.menny : ""}${e.aukcio > 1 ? ", " + e.aukcio + " \u00E1rver\u00E9s" : ""}`;
        const feladatKulcs = eladMezok(t.id).feladat;
        const siker = uzenet => {
            /* A Beszerzok fulrol inditott feladas a feladatot "piacon"
               allapotba teszi, ahogy a regi ut. */
            const f = feladatKulcs && beszerzok.find(x => String(x.kulcs) === String(feladatKulcs));
            if (f && (String(f.id) === String(t.id) || eladAlapEgyezik(f.id, t.id))) {
                f.piacraKint = true;
                f.piacraMennyiseg = e.menny * e.aukcio;
                f.piacraAr = e.azonnali != null ? e.azonnali : e.licit;
                f.piacraMikor = ma();
                ment();
            }
            beall.eladNapok = e.napok;
            if (eladVarosTag()) beall.eladJog = e.jog;
            beallMent();
            eladNezet.valasztott = null;
            delete eladNezet.mezok[t.id];
            eladJelekFrissit(t.id);
            eladUzenet(uzenet, false, true);
            eladSavFrissit();
        };
        eladKuldes = true;
        eladSavSzamol();

        if (!cel.helyben) {
            if (!J.Premium || typeof J.Premium.confirmUse !== "function") {
                eladUzenet("Az aranyr\u00F6g\u00F6s felad\u00E1s most nem \u00E9rhet\u0151 el.", true, false);
                eladKuldes = false; eladSavSzamol(); return;
            }
            try {
                J.Premium.confirmUse("expresssell " + JSON.stringify(obj), "Azonnali k\u00E9zbes\u00EDt\u00E9s",
                    `Nem a piac v\u00E1ros\u00E1ban \u00E1llsz. N\u00E9h\u00E1ny aranyr\u00F6g\u00E9rt fel tudod adni: ${esc(leiras)}. Szeretn\u00E9d?`,
                    null, null,
                    resp => {
                        try {
                            const ad = resp && resp.activationdata;
                            if (ad) {
                                if (ad.deposit != null) J.Character.setDeposit(ad.deposit);
                                if (ad.cash != null) J.Character.setMoney(ad.cash);
                            }
                        } catch (x) { /* nem baj */ }
                        siker(`Feladva aranyr\u00F6g\u00E9rt: ${leiras}.`);
                        eladUtan();
                    },
                    () => { eladUzenet("Felad\u00E1s megszak\u00EDtva, semmi nem t\u00F6rt\u00E9nt.", false, false); eladKuldes = false; eladSavSzamol(); });
            } catch (x) {
                eladUzenet("A j\u00E1t\u00E9k ablaka nem ny\u00EDlt meg: " + (x && x.message ? x.message : x), true, false);
                eladKuldes = false; eladSavSzamol();
            }
            return;
        }

        if (!A || typeof A.remoteCall !== "function") {
            eladUzenet("A j\u00E1t\u00E9k h\u00EDv\u00E1sa nem \u00E9rhet\u0151 el.", true, false);
            eladKuldes = false; eladSavSzamol(); return;
        }
        eladUzenet("K\u00FCld\u00E9s\u2026", false, false);
        try {
            A.remoteCall("building_market", "putup", obj, valasz => {
                const msg = valasz && valasz.msg;
                if (!valasz || valasz.error) {
                    eladUzenet((valasz && typeof valasz.msg === "string" && valasz.msg) || "A szerver elutas\u00EDtotta.", true, true);
                    eladKuldes = false; eladSavSzamol();
                    return;
                }
                try {
                    if (msg && msg.money != null) J.Character.setMoney(msg.money);
                    if (msg && msg.deposit != null) J.Character.setDeposit(msg.deposit);
                } catch (x) { /* nem baj */ }
                const costs = msg && msg.costs != null && isFinite(Number(msg.costs)) ? Number(msg.costs) : null;
                siker(`Feladva: ${leiras}.${costs != null ? " D\u00EDj: " + kinalatSzam(costs) + " $." : ""}`);
                eladUtan();
            });
        } catch (x) {
            eladUzenet("A h\u00EDv\u00E1s kiv\u00E9telt dobott: " + (x && x.message ? x.message : x), true, false);
            eladKuldes = false; eladSavSzamol();
        }
    }

    /* KESZLET- ES HELYFIGYELES. Harom masodpercenkent ujjlenyomat; ha a
       taska mozdult, a lista ujraepul (gepeles kozben csak a szamok).
       Ha a karakter mashova ert, a hely ujra lekerdezodik. Feladas utan
       6 masodpercig 300 ms-onkent nez. */
    let eladOra = null, eladSuruOra = null, eladVoltUjj = "";
    function eladFigyeloLeallit() {
        if (eladOra != null) clearInterval(eladOra);
        if (eladSuruOra != null) clearInterval(eladSuruOra);
        eladOra = null; eladSuruOra = null;
    }
    function eladAktivE() {
        return !!(gyoker && latszik && beall.ful === "piac" && beall.nezet.piac === "keszletem");
    }
    function eladEllenoriz() {
        if (!eladAktivE()) { eladFigyeloLeallit(); return false; }
        if (eladHely.allapot !== "tolt" && eladPozKulcs() !== eladHely.poz) eladHelyTolt();
        const most = eladUjjlenyomat();
        if (most === eladVoltUjj) return false;
        /* Gepeles kozben csak a szamok frissulnek; az ujjlenyomatot nem
           fogadjuk el, igy a fokusz elvesztese utan a lista ujraepul. */
        if (eladSavFokuszban()) { eladKeszletKiir(); return false; }
        eladVoltUjj = most;
        eladListaUjra();
        return true;
    }
    function eladFigyeloIndit() {
        eladFigyeloLeallit();
        eladVoltUjj = eladUjjlenyomat();
        eladOra = setInterval(eladEllenoriz, 3000);
    }
    function eladSurit() {
        if (eladSuruOra != null) clearInterval(eladSuruOra);
        let hatra = 20;
        eladSuruOra = setInterval(() => {
            if (eladEllenoriz() || --hatra <= 0 || !eladAktivE()) { clearInterval(eladSuruOra); eladSuruOra = null; }
        }, 300);
    }

    function keszletemKotes() {
        eladHelyGombKotes();
        const be = gyoker.getElementById("eKereses");
        const torlo = gyoker.querySelector("[data-etorol]");
        /* Kereseskor a rendezes alapra all (a kezdodo talalatok elore),
           ahogy eddig az Eladas fulon. */
        const keres = v => {
            eladNezet.kereses = v;
            if (torlo) torlo.hidden = !v;
            if (eladNezet.rendez) {
                eladNezet.rendez = null; eladNezet.irany = 1;
                const f = gyoker.querySelector(".efej");
                if (f) { f.outerHTML = eladFejlecHTML(); eladFejlecKotes(); }
                eladSorrendJel();
            }
            eladListaUjra();
        };
        if (be) {
            be.addEventListener("input", () => keres(be.value));
            be.addEventListener("keydown", e => { if (e.key === "Escape") { be.value = ""; keres(""); } });
        }
        if (torlo) torlo.addEventListener("click", () => { if (be) { be.value = ""; be.focus(); } keres(""); });
        gyoker.querySelectorAll("[data-ekatv]").forEach(b => b.addEventListener("click", () => {
            eladNezet.kategoria = b.getAttribute("data-ekatv");
            gyoker.querySelectorAll("[data-ekatv]").forEach(x => {
                const a = x === b;
                x.classList.toggle("aktiv", a);
                x.setAttribute("aria-pressed", a ? "true" : "false");
            });
            eladListaUjra();
        }));
        eladFejlecKotes();
        const lista = gyoker.getElementById("eladLista");
        if (lista) lista.addEventListener("click", e => {
            const sor = e.target.closest && e.target.closest(".esor");
            if (!sor || sor.classList.contains("tiltott") || eladKuldes) return;
            const id = sor.getAttribute("data-eid");
            eladNezet.valasztott = eladNezet.valasztott === id ? null : id;
            eladSavFrissit();
        });
        eladListaUjra();
        if (eladHely.allapot === "ures" || (eladHely.allapot !== "tolt" && eladPozKulcs() !== eladHely.poz)) eladHelyTolt();
        eladFigyeloIndit();
    }

    function eladFejlecKotes() {
        gyoker.querySelectorAll(".efej [data-erend]").forEach(g => g.addEventListener("click", () => {
            const k = g.getAttribute("data-erend");
            if (eladNezet.rendez !== k) { eladNezet.rendez = k; eladNezet.irany = 1; }
            else if (eladNezet.irany > 0) eladNezet.irany = -1;
            else { eladNezet.rendez = null; eladNezet.irany = 1; }
            const f = gyoker.querySelector(".efej");
            if (f) { f.outerHTML = eladFejlecHTML(); eladFejlecKotes(); }
            eladSorrendJel();
            eladListaUjra();
        }));
    }

    /* --- AJANLATAIM --- */
    const ajanlatok = { allapot: "ures", sorok: [], ido: 0, uzenet: "", futas: 0 };

    /* MERT (2026-09-16): fetch_offers { page: 0 } -> msg.search_result
       (tomb) es msg.next (5 sornal false). Mas alakra hibat irunk ki.
       A sorokban nincs direction mezo. */
    function ajanlatSorok(valasz) {
        const msg = valasz && valasz.msg;
        if (msg && Array.isArray(msg.search_result)) return msg.search_result;
        return null;
    }

    function ajanlatTolt() {
        if (ajanlatok.allapot === "tolt") return;
        const A = jatek().Ajax;
        const futas = ++ajanlatok.futas;
        ajanlatok.allapot = "tolt";
        ajanlatok.uzenet = "";
        const vege = () => {
            if (futas !== ajanlatok.futas) return;
            if ((beall.ful === "piac" && beall.nezet.piac === "ajanlataim") || beall.ful === "atvetel") rajzolHaSzabad();
        };
        if (!A || typeof A.remoteCall !== "function") {
            ajanlatok.allapot = "hiba"; ajanlatok.uzenet = "A j\u00E1t\u00E9k h\u00EDv\u00E1sa nem \u00E9rhet\u0151 el."; vege(); return;
        }
        let megjott = false;
        const ora = setTimeout(() => {
            if (megjott || futas !== ajanlatok.futas) return;
            megjott = true;
            ajanlatok.allapot = "hiba"; ajanlatok.uzenet = "Nem j\u00F6tt v\u00E1lasz 15 m\u00E1sodpercen bel\u00FCl."; vege();
        }, 15000);
        try {
            A.remoteCall("building_market", "fetch_offers", { page: 0 }, valasz => {
                if (megjott || futas !== ajanlatok.futas) return;
                megjott = true; clearTimeout(ora);
                const sorok = ajanlatSorok(valasz);
                if (!valasz || valasz.error || !sorok) {
                    ajanlatok.allapot = "hiba";
                    ajanlatok.uzenet = (valasz && typeof valasz.msg === "string" && valasz.msg) || "V\u00E1ratlan v\u00E1lasz a szervert\u0151l.";
                } else {
                    ajanlatok.sorok = sorok.slice();
                    ajanlatok.ido = Date.now();
                    ajanlatok.allapot = "kesz";
                }
                vege();
            });
        } catch (e) {
            megjott = true; clearTimeout(ora);
            ajanlatok.allapot = "hiba"; ajanlatok.uzenet = "A h\u00EDv\u00E1s kiv\u00E9telt dobott: " + (e && e.message ? e.message : e); vege();
        }
    }

    function ajanlatHatra(s) {
        const alap = Number(s.auction_ends_in);
        if (!isFinite(alap)) return null;
        return alap - (Date.now() - (ajanlatok.ido || Date.now())) / 1000;
    }

    /* A natív prepareSellData tablazata (SELL):
         lejart, volt licit       -> penz atvetele
         lejart, nem volt licit   -> targy visszavetele
         fut, licit = azonnali    -> penz atvetele
         fut, van licit           -> nincs muvelet
         fut, nincs licit         -> visszavonas */
    function ajanlatAllapot(s) {
        const h = ajanlatHatra(s);
        const lejart = h != null && h <= 0;
        const licit = s.current_bid != null && Number(s.current_bid) > 0;
        const teljes = licit && s.max_price != null && Number(s.current_bid) >= Number(s.max_price);
        if (lejart) return licit ? "penz" : "vissza";
        if (teljes) return "penz";
        if (licit) return "licit";
        return "visszavon";
    }

    function ajanlatCsoportok() {
        const m = new Map();
        ajanlatok.sorok.forEach(s => {
            const k = String(s.market_town_id);
            if (!m.has(k)) m.set(k, { id: k, nev: s.market_town_name, x: s.market_town_x, y: s.market_town_y,
                                      itt: itteniVarosE(s), odaut: kinalatOdaut(s), sorok: [] });
            m.get(k).sorok.push(s);
        });
        return [...m.values()].sort((a, b) => (b.itt - a.itt) || ((a.odaut ?? Infinity) - (b.odaut ?? Infinity)));
    }

    function ajanlatGombHTML(s, itt) {
        const a = ajanlatAllapot(s);
        const id = esc(s.market_offer_id);
        const tilt = eladKuldes ? " disabled" : "";
        if (a === "licit") return `<span class="halvany">van licit</span>`;
        if (itt) {
            if (a === "visszavon") {
                return `<button type="button" class="gomb agomb" data-aj-offtake="${id}"${tilt}>Visszavon\u00E1s</button>`;
            }
            return `<button type="button" class="gomb agomb" data-aj-fetch="${id}"${tilt}>${a === "penz" ? "P\u00E9nz \u00E1tv\u00E9tele" : "Visszaveszem"}</button>`;
        }
        const kezb = kezbesitesElerheto();
        const ok = kezb ? "Aranyr\u00F6g\u00E9rt, a j\u00E1t\u00E9k saj\u00E1t ablak\u00E1val" : "A k\u00E9zbes\u00EDt\u00E9s most nem \u00E9rhet\u0151 el.";
        const kt = eladKuldes || !kezb ? " disabled" : "";
        if (a === "visszavon") {
            return `<button type="button" class="gomb agomb ket" data-aj-kezb="${id}" data-aj-mod="offtake"${kt} title="${esc(ok)}"
                aria-label="Visszavon\u00E1s aranyr\u00F6g\u00E9rt">Visszavon\u00E1s<br>(aranyr\u00F6g)</button>`;
        }
        return `<button type="button" class="gomb agomb" data-aj-kezb="${id}" data-aj-mod="fetch"${kt} title="${esc(ok)}">K\u00E9zbes\u00EDt\u00E9s</button>`;
    }

    function ajanlataimHTML() {
        const cs = ajanlatCsoportok();
        let allapotSz;
        if (ajanlatok.allapot === "tolt") allapotSz = "Bet\u00F6lt\u00E9s\u2026";
        else if (ajanlatok.allapot === "hiba") allapotSz = "Hiba: " + ajanlatok.uzenet;
        else if (ajanlatok.allapot === "ures") allapotSz = "M\u00E9g nincs let\u00F6ltve.";
        else {
            const mp = Math.round((Date.now() - ajanlatok.ido) / 1000);
            allapotSz = mp < 60 ? "Bet\u00F6ltve most." : `Bet\u00F6ltve ${kinalatIdo(mp)} ezel\u0151tt.`;
        }
        const csoportok = cs.map(c => `
          <div class="acs">
            <div class="ach"><b>${varosLinkHTML(c.nev, c.x, c.y)}</b>
              ${c.itt ? `<span class="aitt">itt vagy</span>` : (c.odaut != null ? `<span class="kvaros">oda\u00FAt ${odautLinkHTML(teljesIdo(c.odaut), c.id, c.x, c.y)}</span>` : "")}
            </div>
            ${c.sorok.map(s => {
                const db = Number(s.item_count) || 1;
                const megj = s.description ? String(s.description) : "";
                const van = s.current_bid != null && Number(s.current_bid) > 0;
                const licit = van ? `<span class="klic">${kinalatSzam(s.current_bid)}</span>`
                    : (s.auction_price != null ? `<span class="halvany" title="Kezd\u0151 licit">${kinalatSzam(s.auction_price)}</span>` : "-");
                const h = ajanlatHatra(s);
                const lej = ajanlatAllapot(s) === "penz" && h != null && h > 0 ? "k\u00E9sz" : kinalatIdo(h);
                return `
                  <div class="osor">
                    ${targyBubIkonHTML(s.item_id, targyIkon(s.item_id))}
                    <div class="knev2 kn"><span class="knn">${esc(targyNev(s.item_id))}</span>${db > 1 ? `<span class="kdb">&times;${db}</span>` : ""}</div>
                    <div class="jobb kazon">${kinalatSzam(s.max_price)}</div>
                    <div class="jobb">${licit}</div>
                    <div class="jobb">${esc(lej)}</div>
                    <div class="aelado">${megjJelHTML(megj)}${van ? jatekosLinkHTML(s.bidder_name, s.bidder_player_id) : ""}</div>
                    <div class="jobb">${ajanlatGombHTML(s, c.itt)}</div>
                  </div>`;
            }).join("")}
          </div>`).join("");
        const ures = ajanlatok.allapot === "kesz" && !ajanlatok.sorok.length ? `<p class="ures">Nincs aj\u00E1nlatod a piacon.</p>` : "";
        return `
          <div class="kinalat">
            <div class="kinalat-fej">
              <span class="kallapot" style="flex:1 1 auto;margin:0">${esc(allapotSz)}</span>
              <button type="button" class="gomb" data-aj-friss ${ajanlatok.allapot === "tolt" ? "disabled" : ""}>Friss\u00EDt\u00E9s</button>
            </div>
            <div style="height:6px"></div>
            ${eladUzenetHTML()}
            <div class="ofej"><div></div><div>T\u00E1rgy</div><div class="jobb">Azonnali</div><div class="jobb">Licit</div>
              <div class="jobb">Lej\u00E1r</div><div class="knevhely">Licit\u00E1l\u00F3</div><div></div></div>
            <div class="kinalatlista atvlista" id="ajanlatLista">${csoportok}${ures}</div>
            <p class="labj">Helyben: P\u00E9nz \u00E1tv\u00E9tele, Visszaveszem, Visszavon\u00E1s (k\u00E9t kattint\u00E1s). M\u00E1shol ugyanez aranyr\u00F6g\u00E9rt, a j\u00E1t\u00E9k saj\u00E1t ablak\u00E1val.
              Visszavon\u00E1skor a d\u00EDj nem biztos, hogy visszaj\u00E1r.</p>
          </div>`;
    }

    function ajanlatUtan() {
        try { const E = jatek().EventHandler; if (E && typeof E.signal === "function") E.signal("inventory_changed"); }
        catch (e) { /* nem baj */ }
        eladKuldes = false;
        ajanlatok.allapot = "ures";
        ajanlatTolt();
        rajzolHaSzabad();
    }

    function ajanlatSor(id) {
        return ajanlatok.sorok.find(x => String(x.market_offer_id) === String(id)) || null;
    }

    function ajanlatFetch(id) {
        const J = jatek(), A = J.Ajax;
        const s = ajanlatSor(id);
        if (eladKuldes || !A || !s) return;
        if (!itteniVarosE(s)) { eladUzenet("Ezt csak a piac v\u00E1ros\u00E1ban lehet ingyen \u00E1tvenni.", true, false); return; }
        const penz = ajanlatAllapot(s) === "penz";
        eladKuldes = true;
        eladUzenet("\u00C1tv\u00E9tel\u2026", false, false);
        try {
            A.remoteCall("building_market", "fetch", { market_offer_id: s.market_offer_id }, valasz => {
                const msg = valasz && valasz.msg;
                if (!valasz || valasz.error || !msg || !msg.succesfull) {
                    eladUzenet((valasz && typeof valasz.msg === "string" && valasz.msg) || "Az \u00E1tv\u00E9tel nem siker\u00FClt.", true, true);
                } else {
                    try { if (msg.money != null) J.Character.setMoney(msg.money); } catch (e) { /* nem baj */ }
                    eladUzenet(penz ? `P\u00E9nz \u00E1tv\u00E9ve: ${targyNev(s.item_id)}.` : `Visszavetted: ${targyNev(s.item_id)}.`, false, true);
                }
                ajanlatUtan();
            });
        } catch (e) {
            eladUzenet("A h\u00EDv\u00E1s kiv\u00E9telt dobott: " + (e && e.message ? e.message : e), true, false);
            ajanlatUtan();
        }
    }

    /* Az irany fix "SELL": a fetch_offers sorai eladasi ajanlatok, es a
       natív eladasi tablazat is ezt kuldi (forrasbol, t23). A sorokban
       nincs direction mezo (mert). */
    const AJANLAT_IRANY = "SELL";
    function ajanlatOfftake(id) {
        const J = jatek(), A = J.Ajax;
        const s = ajanlatSor(id);
        if (eladKuldes || !A || !s) return;
        if (!itteniVarosE(s)) { eladUzenet("Helyben csak a piac v\u00E1ros\u00E1ban vonhat\u00F3 vissza.", true, false); return; }
        eladKuldes = true;
        eladUzenet("Visszavon\u00E1s\u2026", false, false);
        try {
            A.remoteCall("building_market", "offtake", { offer_id: s.market_offer_id, direction: AJANLAT_IRANY }, valasz => {
                if (!valasz || valasz.error) {
                    eladUzenet((valasz && typeof valasz.msg === "string" && valasz.msg) || "A visszavon\u00E1s nem siker\u00FClt.", true, true);
                } else {
                    const m = valasz.msg && typeof valasz.msg === "object" && valasz.msg.money != null ? valasz.msg.money : valasz.money;
                    const v = Number(m);
                    eladUzenet(`Visszavonva: ${targyNev(s.item_id)}.` +
                        (v > 0 ? ` Visszakapt\u00E1l ${kinalatSzam(v)} $-t.` : (v === -1 ? " D\u00EDjat nem kapt\u00E1l vissza." : "")), false, true);
                }
                ajanlatUtan();
            });
        } catch (e) {
            eladUzenet("A h\u00EDv\u00E1s kiv\u00E9telt dobott: " + (e && e.message ? e.message : e), true, false);
            ajanlatUtan();
        }
    }

    function ajanlatKezbesit(id, mod) {
        const J = jatek();
        const s = ajanlatSor(id);
        if (eladKuldes || !s || (mod !== "fetch" && mod !== "offtake")) return;
        /* t24: ha kozben beertel, ne a fizetos ablak jojjon. */
        if (itteniVarosE(s)) {
            eladUzenet(mod === "offtake" ? "M\u00E1r a v\u00E1rosban vagy, itt ingyen visszavonhatod." : "M\u00E1r a v\u00E1rosban vagy, itt ingyen \u00E1tveheted.", false, false);
            rajzolHaSzabad();
            return;
        }
        const vid = kezbesitesVaros(s.market_town_id);
        if (!vid || !kezbesitesElerheto() || !J.Premium || typeof J.Premium.confirmUse !== "function") {
            eladUzenet("A k\u00E9zbes\u00EDt\u00E9s most nem \u00E9rhet\u0151 el.", true, false);
            return;
        }
        eladKuldes = true;
        const szoveg = mod === "offtake"
            ? "Nem tart\u00F3zkodsz a helysz\u00EDnen. N\u00E9h\u00E1ny aranyr\u00F6g\u00E9rt cser\u00E9be az aj\u00E1nlatot visszavonj\u00E1k, \u00E9s a t\u00E1rgyat k\u00E9zbes\u00EDtik. Szeretn\u00E9d?"
            : KEZB_EGY;
        try {
            J.Premium.confirmUse("marketdelivery " + s.market_offer_id + " " + vid + " " + mod, KEZB_CIM, szoveg,
                null, null,
                resp => {
                    try {
                        const ad = resp && resp.activationdata;
                        if (ad) {
                            if (ad.deposit != null) J.Character.setDeposit(ad.deposit);
                            if (ad.money != null) J.Character.setMoney(ad.money);
                        }
                    } catch (e) { /* nem baj */ }
                    eladUzenet(`${mod === "offtake" ? "Visszavonva \u00E9s k\u00E9zbes\u00EDtve" : "K\u00E9zbes\u00EDtve"}: ${targyNev(s.item_id)}.`, false, false);
                    ajanlatUtan();
                },
                () => { eladKuldes = false; eladUzenet("K\u00E9zbes\u00EDt\u00E9s megszak\u00EDtva, semmi nem t\u00F6rt\u00E9nt.", false, false); rajzolHaSzabad(); });
        } catch (e) {
            eladUzenet("A j\u00E1t\u00E9k ablaka nem ny\u00EDlt meg: " + (e && e.message ? e.message : e), true, false);
            eladKuldes = false;
        }
    }

    function ajanlataimKotes() {
        const f = gyoker.querySelector("[data-aj-friss]");
        if (f) f.addEventListener("click", () => {
            if (ajanlatok.allapot === "tolt") return;
            ajanlatok.allapot = "ures";
            ajanlatTolt();
            rajzol();
        });
        gyoker.querySelectorAll("[data-aj-fetch]").forEach(g => g.addEventListener("click", () => {
            if (g.disabled || eladKuldes) return;
            if (!kinalatMegerosit(g, "Biztos?")) return;
            ajanlatFetch(g.getAttribute("data-aj-fetch"));
        }));
        gyoker.querySelectorAll("[data-aj-offtake]").forEach(g => g.addEventListener("click", () => {
            if (g.disabled || eladKuldes) return;
            if (!kinalatMegerosit(g, "Biztos?")) return;
            ajanlatOfftake(g.getAttribute("data-aj-offtake"));
        }));
        gyoker.querySelectorAll("[data-aj-kezb]").forEach(g => g.addEventListener("click", () => {
            if (g.disabled || eladKuldes) return;
            ajanlatKezbesit(g.getAttribute("data-aj-kezb"), g.getAttribute("data-aj-mod"));
        }));
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

    /* A FEJLEC GOMBJA csak a TESZT-ben latszik (FRISS_PROBA): a
       frissitesablakot mutatja, szerverhivas nelkul. Az eles valtozatban a
       gomb rejtett, a frissites a jatek ablakaban szol. A kotes egyszer
       megy, mert a fejlec egyszer epul fel. */
    function frissJelFrissit() {
        if (!gyoker) return;
        const fj = gyoker.getElementById("frissJel");
        if (!fj) return;
        fj.classList.toggle("lathato", !!FRISS_PROBA);
    }

    function frissJelKotes() {
        if (!gyoker) return;
        const fj = gyoker.getElementById("frissJel");
        if (!fj || fj.dataset.kotve) return;
        fj.dataset.kotve = "1";
        /* MERT hiba volt: a host-ra kotott pointerdown kezelo (ami a panelt
           elore hozza) elkapja az esemenyt, ezert a gombig mar nem jut el a
           click. A pointerdown viszont igen, meressel igazolva. */
        fj.addEventListener("pointerdown", e => {
            e.stopPropagation();
            if (!FRISS_PROBA) return;
            frissitesAblak(probaVerzio(VERZIO), VALTOZASOK, true);
        });
    }

    /* A proba ablakban a sajat verzio utolso tagja eggyel nagyobb. */
    function probaVerzio(v) {
        const t = String(v).split(".");
        const u = parseInt(t[t.length - 1], 10);
        t[t.length - 1] = String(isNaN(u) ? 1 : u + 1);
        return t.join(".");
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

    /* A letoltott fajl valtozasainak kiolvasasa a ket jelolo kozul. Hiba
       vagy hianyzo blokk eseten ures lista: az ablak akkor is szol, csak
       lista nelkul. */
    function valtozasokSzovegbol(txt) {
        try {
            const m = String(txt || "").match(/\/\* VALTOZASOK KEZDETE \*\/[\s\S]*?=\s*(\[[\s\S]*?\]);\s*\/\* VALTOZASOK VEGE \*\//);
            if (!m) return [];
            const t = JSON.parse(m[1]);
            return Array.isArray(t) ? t.filter(x => typeof x === "string" && x.trim()).slice(0, 8) : [];
        } catch (e) { return []; }
    }

    /* A letoltes a mestersegkalkulator mert utja: GM_xmlhttpRequest a
       @connect-ben megadott cimre. A korabbi fetch nem volt merve (mas
       cimrol tolt, mint a jatek). Hiba eseten null, csendben. */
    function frissLetolt(url) {
        return new Promise(res => {
            try {
                GM_xmlhttpRequest({
                    method: "GET", url, responseType: "text", timeout: 10000,
                    onload: r => res(r && r.status === 200 ? String(r.responseText || r.response || "") : null),
                    onerror: () => res(null),
                    ontimeout: () => res(null)
                });
            } catch (e) { res(null); }
        });
    }

    function maNap() { return new Date().toISOString().slice(0, 10); }

    function frissitestKeres() {
        try {
            if (GM_getValue(FRISS_NAP_KULCS, "") === maNap()) return;
        } catch (e) { return; }
        frissLetolt(FRISS_URL + "?v=" + Date.now()).then(txt => {
            if (!txt) return;
            const m = txt.match(/@version\s+(\S+)/);
            if (!m || !ujabbVerzio(m[1], VERZIO)) return;
            try { GM_setValue(FRISS_NAP_KULCS, maNap()); } catch (e) { /* nem baj */ }
            frissitesAblak(m[1], valtozasokSzovegbol(txt), false);
        }).catch(() => { /* nem baj, legkozelebb ujra */ });
    }

    /* A FRISSITESABLAK a jatek sajat ablakstilusaban (a mestersegkalkulator
       frissitesAblak-janak atvetele, a mert harom hibajanak javitasaval:
       egyetlen wman.open, a cim setTitle-lel, a tartalom az
       appendToContentPane-be). Ha a jatek ablaka nem all ossze, sajat,
       a pergamenhez illo doboz a tartalek. */
    const FRISS_ABLAK_ID = "smcz-beszerzo-frissites";
    const FRISS_ABLAK_CIM = "Keresked\u0151pult - friss\u00EDt\u00E9s";

    function frissitesAblak(ver, lista, proba) {
        const W = jatek();
        const tart = document.createElement("div");
        /* t57: a tartalom a jatek ablakanak teljes szelesseget kitolti (a t56
           380 pixelre korlatozta, az ablak jobb fele uresen maradt). */
        tart.style.cssText = "padding:14px 16px;font:14px/1.5 Arial,sans-serif;color:#2b2119;box-sizing:border-box;width:100%";
        const tetelek = (lista || []).map(x => "<li style='margin:0 0 4px'>" + esc(x) + "</li>").join("");
        tart.innerHTML =
            "<div>\u00DAj verzi\u00F3 \u00E9rhet\u0151 el a Keresked\u0151pultb\u00F3l.</div>" +
            "<div style='margin:10px 0'><b>Jelenlegi:</b> " + esc(VERZIO) + " &nbsp; <b>El\u00E9rhet\u0151:</b> " + esc(ver) + "</div>" +
            (tetelek ? "<ul style='margin:0 0 10px;padding-left:20px;font-size:13px;line-height:1.45'>" + tetelek + "</ul>" : "") +
            "<div style='margin-bottom:12px'>A gombra kattintva megny\u00EDlik a Tampermonkey telep\u00EDt\u0151 ablaka, ott el\u00E9g a Friss\u00EDt\u00E9s gombot megnyomni.</div>" +
            (proba ? "<div style='margin-bottom:12px;font-size:12px;color:#923b29'>Pr\u00F3baablak a TESZT gombj\u00E1r\u00F3l: a gomb most nem nyit telep\u00EDt\u0151t.</div>" : "");

        const gomb = document.createElement("button");
        gomb.textContent = "Friss\u00EDt\u00E9s megnyit\u00E1sa";
        gomb.style.cssText = "padding:7px 14px;cursor:pointer;font:600 13px Arial,sans-serif;" +
            "background:#3a2713;color:#f0c874;border:1px solid #8a6330;border-radius:5px";
        const kesobb = document.createElement("button");
        kesobb.textContent = "K\u00E9s\u0151bb";
        kesobb.style.cssText = "padding:7px 14px;cursor:pointer;margin-left:8px;" +
            "font:13px Arial,sans-serif;background:rgba(247,238,219,.7);color:#5a4326;" +
            "border:1px solid #8a6330;border-radius:5px";
        const alairas = document.createElement("div");
        /* t59: a sziv piros, a panel alairasanak szinevel (.alairas .sziv).
           Az ablak a jatek DOM-jaban el, nem a panel arnyekgyokereben, ezert
           a szin itt helyben van megadva. */
        alairas.innerHTML = "Crafted with <span data-sziv style='color:#d7473f;font-size:13px;padding:0 2px'>\u2665</span> by smcZ";
        alairas.style.cssText = "margin-top:14px;text-align:right;font:11px Arial,sans-serif;color:rgba(43,33,25,.45)";
        tart.appendChild(gomb);
        tart.appendChild(kesobb);
        tart.appendChild(alairas);

        let bezar = () => {};
        gomb.onclick = () => { if (!proba) frissitestMegnyit(); bezar(); };
        kesobb.onclick = () => bezar();

        try {
            const wm = W.wman;
            try {
                const regi = wm && wm.getById ? wm.getById(FRISS_ABLAK_ID) : null;
                if (regi) {
                    try { if (wm.close) wm.close(FRISS_ABLAK_ID); } catch (e2) { /* nem baj */ }
                    try { if (regi.destroy) regi.destroy(); } catch (e2) { /* nem baj */ }
                }
            } catch (e2) { /* nem baj */ }
            let abl = null;
            try { if (wm && wm.open) abl = wm.open(FRISS_ABLAK_ID, FRISS_ABLAK_CIM); } catch (e2) { abl = null; }
            if (abl) {
                const hivd = (nev, ...a) => { try { if (typeof abl[nev] === "function") abl[nev](...a); } catch (e2) { /* nem baj */ } };
                hivd("setTitle", FRISS_ABLAK_CIM);
                hivd("setMiniTitle", FRISS_ABLAK_CIM);
                hivd("setResizeable", false);
                let betette = false;
                try { abl.appendToContentPane(tart); betette = true; } catch (e2) { betette = false; }
                if (betette) {
                    bezar = () => {
                        try { abl.close(); }
                        catch (e2) { try { if (wm && wm.close) wm.close(FRISS_ABLAK_ID); } catch (e3) { /* nem baj */ } }
                    };
                    return;
                }
                try { abl.close(); } catch (e2) { /* nem baj */ }
            }
        } catch (e) { /* megyunk a tartalekra */ }

        /* tartalek: sajat doboz, pergamen szinekkel */
        const box = document.createElement("div");
        box.setAttribute("data-smcz-frissites", "1");
        box.style.cssText = "position:fixed;left:50%;top:22%;transform:translateX(-50%);z-index:99999;" +
            "width:min(560px,92vw);" +
            "background:#e8d6b0;border:1px solid #5b3d1f;border-radius:3px;" +
            "box-shadow:0 0 0 3px #7a5530,0 8px 22px rgba(0,0,0,.55)";
        const fej = document.createElement("div");
        fej.textContent = FRISS_ABLAK_CIM;
        fej.style.cssText = "padding:7px 12px;background:linear-gradient(180deg,#6d4a28,#3f2814);color:#f4e0b0;" +
            "font:700 13px Georgia,serif";
        box.appendChild(fej);
        box.appendChild(tart);
        bezar = () => box.remove();
        document.body.appendChild(box);
    }

    /* A cimsav friss\u00EDt\u0151 gombja (t38): csak a LATHATO nezet adatat
       tolti ujra, ugyanazt, amit a nezet sajat Frissites gombja. A
       Beszerzokon nincs szerverhivas, ott az ujrarajzolas szamolja ujra
       a keszletet es a munkaora-becslest. */
    function nezetFrissit() {
        const n = aktNezet();
        const k = n && n.kulcs;
        if (beall.ful === "vetel") {
            if (k === "kinalat" && kinalat.allapot !== "tolt") { kinalat.allapot = "ures"; kinalatTolt(); }
            else if (k === "licitjeim" && licitek.allapot !== "tolt") { licitek.allapot = "ures"; licitTolt(); }
            else if (k === "megfigyeles" && figyelo.allapot !== "tolt") { figyeloUzenet("", false); figyelo.allapot = "ures"; figyeloTolt(); }
        } else if (beall.ful === "atvetel") {
            if (licitek.allapot !== "tolt") { licitek.allapot = "ures"; licitTolt(); }
            if (ajanlatok.allapot !== "tolt") { ajanlatok.allapot = "ures"; ajanlatTolt(); }
        } else if (beall.ful === "piac") {
            if (k === "ajanlataim" && ajanlatok.allapot !== "tolt") { ajanlatok.allapot = "ures"; ajanlatTolt(); }
            if (k === "keszletem") eladHelyTolt();
        } else if (beall.orak !== false) {
            /* t75: a Beszerzokon a munkaora-adatot is ujrakeri. */
            oraKeresMost();
        }
        rajzol();
    }

    function rajzol() {
        if (!gyoker) return;
        /* Az ujrarajzolas elviheti az ikont az eger alol. */
        targyBubRajzolUtan();
        const stage = gyoker.getElementById("stage");
        if (!stage) return;
        const felszin = felszinAllapot(stage);

        const aktFul = FULAK.find(f => f.kulcs === beall.ful);
        const aktN = aktNezet();
        if (beall.ful === "vetel" && aktN && aktN.kulcs === "kinalat") {
            /* Az elso megnyitaskor tolt le, utana csak a gombra. */
            if (kinalat.allapot === "ures") kinalatTolt();
            stage.innerHTML = fulSorHTML() + nezetSorHTML() + kinalatHTML() + ALAIRAS_HTML;
            fulKotes();
            nezetKotes();
            kinalatKotes();
            nevKattintasKotes();
            helyFigyeloIndit();
            kinalatListaMagassag();
            piacMeretFigyeloIndit();
            requestAnimationFrame(kinalatListaMagassag);
            alkalmazMagassag();
            felszinVissza(stage, felszin);
            return;
        }
        if (beall.ful === "vetel" && aktN && aktN.kulcs === "megfigyeles") {
            if (figyelo.allapot === "ures") figyeloTolt();
            stage.innerHTML = fulSorHTML() + nezetSorHTML() + megfigyelesHTML() + ALAIRAS_HTML;
            fulKotes();
            nezetKotes();
            megfigyelesKotes();
            nevKattintasKotes();
            helyFigyeloIndit();
            licitListaMagassag("figyeloLista");
            piacMeretFigyeloIndit();
            requestAnimationFrame(() => licitListaMagassag("figyeloLista"));
            alkalmazMagassag();
            felszinVissza(stage, felszin);
            return;
        }
        if (beall.ful === "vetel" && aktN && aktN.kulcs === "kereseim") {
            /* t80: a hely kell a dijhoz es a celvaroshoz; a lista az elso
               megnyitaskor jon le, utana a Frissites gombra. */
            if (eladHely.allapot === "ures" || (eladHely.allapot !== "tolt" && eladHely.poz !== eladPozKulcs())) eladHelyTolt();
            if (kerek.allapot === "ures") kerTolt();
            stage.innerHTML = fulSorHTML() + nezetSorHTML() + kereseimHTML() + ALAIRAS_HTML;
            fulKotes();
            nezetKotes();
            kereseimKotes();
            nevKattintasKotes();
            helyFigyeloIndit();
            licitListaMagassag("kerLista");
            piacMeretFigyeloIndit();
            requestAnimationFrame(() => licitListaMagassag("kerLista"));
            alkalmazMagassag();
            felszinVissza(stage, felszin);
            return;
        }
        const licitNezetE = beall.ful === "vetel" && aktN && aktN.kulcs === "licitjeim";
        if (licitNezetE || (beall.ful === "atvetel" && aktN && aktN.kesz)) {
            if (licitek.allapot === "ures") licitTolt();
            if (!licitNezetE && ajanlatok.allapot === "ures") ajanlatTolt();
            if (!licitNezetE && kerek.allapot === "ures") kerTolt();
            const listaId = licitNezetE ? "licitLista" : "atvetelLista";
            stage.innerHTML = fulSorHTML() + nezetSorHTML() + (licitNezetE ? licitjeimHTML() : atvetelHTML()) + ALAIRAS_HTML;
            fulKotes();
            nezetKotes();
            if (licitNezetE) licitjeimKotes(); else atvetelKotes();
            nevKattintasKotes();
            helyFigyeloIndit();
            licitListaMagassag(listaId);
            piacMeretFigyeloIndit();
            requestAnimationFrame(() => licitListaMagassag(listaId));
            alkalmazMagassag();
            felszinVissza(stage, felszin);
            return;
        }
        if ((aktFul && !aktFul.kesz) || (beall.ful === "atvetel" && aktN && !aktN.kesz)) {
            /* Az Atvetel helyorzo nezetenel is kell a ket lista a jelekhez. */
            if (beall.ful === "atvetel") {
                if (licitek.allapot === "ures") licitTolt();
                if (ajanlatok.allapot === "ures") ajanlatTolt();
            }
            stage.innerHTML = fulSorHTML() + nezetSorHTML() + fulHamarosanHTML() + ALAIRAS_HTML;
            fulKotes();
            nezetKotes();
            alkalmazMagassag();
            felszinVissza(stage, felszin);
            return;
        }

        /* Az uj Eladas ful (t15); a regi piacFulHTML / piacKotes t19-ben kiment. */
        if (beall.ful === "piac") {
            eladFigyeloLeallit();
            const nk = aktN ? aktN.kulcs : "keszletem";
            const listaId = nk === "ajanlataim" ? "ajanlatLista" : (nk === "kerelmek" ? "kerelemLista" : "eladLista");
            let tartalom;
            if (aktN && !aktN.kesz) tartalom = fulHamarosanHTML();
            else if (nk === "ajanlataim") {
                if (ajanlatok.allapot === "ures") ajanlatTolt();
                tartalom = ajanlataimHTML();
            } else if (nk === "kerelmek") {
                if (kerelmek.allapot === "ures") kerelemTolt();
                tartalom = kerelemHTML();
            } else tartalom = keszletemHTML();
            stage.innerHTML = fulSorHTML() + nezetSorHTML() + tartalom + ALAIRAS_HTML;
            fulKotes();
            nezetKotes();
            if (aktN && aktN.kesz) {
                if (nk === "ajanlataim") { ajanlataimKotes(); helyFigyeloIndit(); }
                else if (nk === "kerelmek") { kerelemKotes(); helyFigyeloIndit(); }
                else keszletemKotes();
                nevKattintasKotes();
                licitListaMagassag(listaId);
                piacMeretFigyeloIndit();
                requestAnimationFrame(() => licitListaMagassag(listaId));
            }
            alkalmazMagassag();
            felszinVissza(stage, felszin);
            return;
        }

        if (beall.orak !== false && ruhaCsereZartan) { ruhaCsereZartan = false; oraKeresMost(); }
        else if (beall.orak !== false && beansUres()) oraKeresHaKell();

        oraHozamHianyzott = false;
        const elosztas = keszletElosztas();
        gyartTervUrit();
        const gyartasTerv = gyartTervMost();
        const o = osszesites(elosztas, gyartasTerv);
        if (beall.orak !== false && oraHozamHianyzott) oraKeresHaKell();

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
                  <span class="priorcimke">Priorit\u00E1s</span>
                  <button class="bmozgat" data-bmozgat="${esc(nev)}" data-irany="-1" title="Feljebb a sorrendben, előbb kap a közös készletből" aria-label="Prioritás növelése"${teljesIndex <= 0 ? " disabled" : ""}>&#9650;</button>
                  <button class="bmozgat" data-bmozgat="${esc(nev)}" data-irany="1" title="Lejjebb a sorrendben, később kap a közös készletből" aria-label="Prioritás csökkentése"${teljesIndex < 0 || teljesIndex === teljesCsoportSorrend.length - 1 ? " disabled" : ""}>&#9660;</button>
                  <button class="btorol" data-bszemely="${esc(nev)}"
                    title="A teljes gy\u0171jt\u00E9s t\u00F6rl\u00E9se" aria-label="Gy\u0171jt\u00E9s t\u00F6rl\u00E9se">&#10005;</button>
                  ${utolso ? `<span class="datum">${esc(utolso)}</span>` : ""}
                </span>
              </div>
              <div class="bc-tartalom"${zart ? " hidden" : ""}>`
              + rendezettTetelek(tetelek, elosztas).map(x => itemSorHTML(x, elosztas, gyartasTerv) + gyartFaHTML(x, gyartasTerv)).join("")
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

          ${allapotHTML()}
          <p class="labj">A feladatlista a te feljegyz\u00E9sed. A \u201Emegvan\u201D a t\u00E1sk\u00E1b\u00F3l j\u00F6n, a munka\u00F3ra-becsl\u00E9s felszerel\u00E9st\u0151l f\u00FCgg.</p>
          ${ALAIRAS_HTML}
        `;

        fulKotes();
        kotesek();
        alkalmazMagassag();
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
            if (m) { munkaBubMutat(m, m.dataset.munka || m.dataset.bubid); return; }
            const h = e.target.closest && e.target.closest("[data-helybub]");
            if (h) { bubMutat(h, helyBubHTML(h)); return; }

        });
        gyoker.addEventListener("mouseout", e => {
            const m = e.target.closest && e.target.closest("[data-munka],[data-bubid],[data-helybub]");
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

        /* Targybuborek: minden egermozgasnal eldol, ikon folott vagyunk-e.
           Nem ikon folott, a panelen kivul vagy gorgeteskor lekerul. */
        gyoker.addEventListener("pointermove", e => { egerX = e.clientX; egerY = e.clientY; });
        host.addEventListener("pointerleave", () => { egerX = null; egerY = null; });
        gyoker.addEventListener("pointerover", e => {
            egerX = e.clientX; egerY = e.clientY;
            const m = e.target.closest && e.target.closest("[data-megj]");
            if (m) { megjBubFel(m.getAttribute("data-megj")); return; }
            const i = e.target.closest && e.target.closest("[data-iid]");
            if (i) targyBubFel(i.getAttribute("data-iid"));
            else targyBubLe();
        });
        host.addEventListener("pointerleave", targyBubLe);
        gyoker.addEventListener("scroll", targyBubLe, true);

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
            "[data-piac],[data-fa-piac],[data-gyart],[data-gyart-betolt],[data-munka],[data-szemely],[data-btorol],[data-bplusz],[data-bszerk],[data-bnev-szerk],[data-bmozgat],[data-bcsuk],[data-bcsuk-all],[data-bszuro-hiany],[data-bszuro-mind],[data-bszuro-szemely],[data-mit=bezar],[data-mit=minimaliz],[data-mit=ujra],[data-mit=mindzar],[data-mit=dash-toggle],#fAdd,.bujOk");
            if (!t) return;

            if (t.hasAttribute("data-piac")) {
                munkaBubRejt();
                piacArBubRejt();
                const f = beszerzok.find(x => String(x.kulcs) === String(t.getAttribute("data-piac")));
                if (f) eladasraNyit(f, t);
                return;
            }

            if (t.hasAttribute("data-fa-piac")) {
                munkaBubRejt();
                faEladasraNyit(t.getAttribute("data-fa-piac"), t.getAttribute("data-fa-db"), t.getAttribute("data-fa-cimzett"));
                return;
            }
            if (t.hasAttribute("data-gyart-betolt")) {
                munkaBubRejt();
                /* Csak betolt, nem gyart: ezert egy kattintas eleg. */
                gyartBetolt(() => rajzol());
                return;
            }
            if (t.hasAttribute("data-gyart")) {
                munkaBubRejt();
                /* Valodi muvelet: nyersanyagot hasznal el, ezert ket kattintas. */
                if (!kinalatMegerosit(t, "Biztos?")) return;
                gyartIndit(t.getAttribute("data-gyart"), t.getAttribute("data-gyart-db"), t);
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
                return;
            }

            if (t.hasAttribute("data-btorol")) {
                const k = t.getAttribute("data-btorol");
                beszerzok = beszerzok.filter(x => String(x.kulcs) !== k);
                ment(); rajzol(); return;
            }

            if (t.getAttribute("data-mit") === "ujra") { nezetFrissit(); return; }

            /* A jatek osszes ablakat bezarja, a panelt is (t40). */
            if (t.getAttribute("data-mit") === "mindzar") {
                try {
                    const wm = jatek() && jatek().wman;
                    if (wm && typeof wm.closeAll === "function") wm.closeAll();
                } catch (e) { /* a panel akkor is bezarodik */ }
                savLe();
                valt(false);
                return;
            }

            if (t.getAttribute("data-mit") === "dash-toggle") {
                beall.osszCsukva = !beall.osszCsukva;
                beallMent();
                const d = gyoker.getElementById("dash");
                if (d) d.classList.toggle("zart", beall.osszCsukva);   /* rerender nelkul */
                return;
            }

            if (t.getAttribute("data-mit") === "bezar") { savLe(); valt(false); return; }
            if (t.getAttribute("data-mit") === "minimaliz") { valt(false); return; }

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
        frame.className = "frame";
        frame.innerHTML = `
          <div class="bar">
            <span class="mark"><i class="mark-jel">\u2692\uFE0E</i><span>Keresked\u0151pult</span></span>
            <span class="ver">${esc(VERZIO)}${EPITES ? " &middot; " + esc(EPITES) : ""}</span>
            <button type="button" class="frissjel" id="frissJel" data-friss
              title="A friss\u00EDt\u00E9sablak pr\u00F3b\u00E1ja (csak a TESZT-ben)">&#9679; friss\u00EDt\u00E9s pr\u00F3ba</button>
            <span class="live-dot" title="\u00C9l\u0151 k\u00E9szletfigyel\u00E9s" aria-label="\u00C9l\u0151 k\u00E9szletfigyel\u00E9s"></span>
            <div class="ablak-vezerlok" aria-label="Ablakvez\u00E9rl\u00E9s">
              <button class="ujra" data-mit="ujra" title="N\u00E9zet friss\u00EDt\u00E9se" aria-label="N\u00E9zet friss\u00EDt\u00E9se">&#8635;</button>
              <button class="mindzar" data-mit="mindzar" title="Az \u00F6sszes nyitott ablak bez\u00E1r\u00E1sa" aria-label="Az \u00F6sszes nyitott ablak bez\u00E1r\u00E1sa">&#10005;&#10005;</button>
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
        /* t77 JAVITAS (MrA merese 2026-09-26): rejtett panelnel a nativDb nem
           frissult, ezert megnyitas utan 60 ms-mal hatralepett. Most a rejtett
           panel elfelejti a szamot (-1), megnyitas utan az elso valtozasnal
           csak feljegyzi. Ismert hataresetek: ha a megnyitas utani elso
           valtozas maga egy uj nativ ablak, elole nem lep hatra.
           Regi: let nativDb = ...length; ... if (!host || host.hidden) return;
                 ... if (most > nativDb) setTimeout(hatra, 60); */
        let nativDb = -1;
        try {
            const figyelo = new MutationObserver(() => {
                if (!host || host.hidden) { nativDb = -1; return; }
                const most = document.querySelectorAll(".tw2gui_window").length;
                if (nativDb >= 0 && most > nativDb) setTimeout(hatra, 60);
                nativDb = most;
            });
            figyelo.observe(document.body, { childList: true, subtree: true });
        } catch (e) { /* enelkul is mukodik, csak kezzel kell elorehozni */ }

        huzas(frame.querySelector(".bar"));
        magassagFogo(frame.querySelector("#grip"));
        esemenyek();
        ruhaFigyelo();
        piacFigyelo();
        gombKi();
        telepitAblakKapcsolat();
    }

    function alkalmazMagassag() {
        const stage = gyoker && gyoker.getElementById("stage");
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
            /* t77 JAVITAS (MrA merese 2026-09-26): a Kalandsegito es a
               Kereskedopult ugyanazt a reteget kapta; a tobbi smcZ panel is
               szamit, a rejtett nem.
               Regi: '[class*="window"],[class*="Window"]' es if (el === host) return; */
            document.querySelectorAll('[class*="window"],[class*="Window"],[id^="smcz-"][id*="-host"]').forEach(el => {
                if (el === host || el.hidden) return;
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

    /* A panel sajat keretet hasznal; a jatek ablaksavjaban levo
       bejegyzes cime ez. */
    const ABLAK_CIM = "Keresked\u0151pult";

    /* -----------------------------------------------------------------
       BEJEGYZES A JATEK ABLAKSAVJABAN (t40).
       MERVE (2026-09-20, forras): a savot a WestUi.WindowBar kezeli, az
       add(uid, win) egy wman-ablakot var (getMainDiv, getMiniTitle),
       amit a panel nem tud adni. Ezert a sav sajat szerkezetet epitjuk
       meg: #ui_windowbar > div.windowbar_frames ala egy
       "windowframe minimizer4<id>" doboz, benne windowframe_title es egy
       windowframe_right > windowframe_closer. A jatek sajat bejegyzeseit
       nem bantjuk. A cimre kattintva ki-be kapcsol, a keresztre bezar.
       ----------------------------------------------------------------- */
    function savKeret() {
        return document.querySelector("#ui_windowbar > div.windowbar_frames");
    }
    function savElem() {
        const k = savKeret();
        return k ? k.querySelector(".windowframe.smcz-sav") : null;
    }
    function savFel() {
        const k = savKeret();
        if (!k || savElem() || !host) return;
        const uid = host.id;
        const div = document.createElement("div");
        div.className = "windowframe smcz-sav minimizer4" + uid;
        const cim = document.createElement("div");
        cim.className = "windowframe_title";
        cim.title = ABLAK_CIM;
        cim.textContent = ABLAK_CIM;
        cim.addEventListener("click", () => valt(!latszik));
        const jobb = document.createElement("div");
        jobb.className = "windowframe_right";
        const x = document.createElement("div");
        x.className = "windowframe_closer";
        x.addEventListener("click", e => { e.stopPropagation(); savLe(); valt(false); });
        jobb.appendChild(x);
        div.appendChild(cim);
        div.appendChild(jobb);
        k.appendChild(div);
        dockMutat(true);
    }
    /* A savot a jatek sajat jQuery-jevel mutatjuk es rejtjuk, ugyanugy,
       ahogy o teszi. HIBA VOLT (t40): a style.display = "" letorolte a
       jatek beagyazott ertekét, ezert az egesz sav eltunt. */
    function dockMutat(mutasd) {
        const dock = document.getElementById("ui_windowdock");
        if (!dock) return;
        try {
            const J = jatek();
            const jq = J && (J.jQuery || J.$);
            if (jq) { jq(dock)[mutasd ? "show" : "hide"](); return; }
        } catch (e) { /* megy a tartalek ut */ }
        if (mutasd) { if (getComputedStyle(dock).display === "none") dock.style.display = "block"; }
        else dock.style.display = "none";
    }
    function savLe() {
        const d = savElem();
        if (d) d.remove();
        const k = savKeret();
        if (k && !k.children.length) dockMutat(false);
    }
    function savAllapot() {
        const d = savElem();
        if (!d) return;
        d.classList.toggle("focus", latszik);
        d.classList.toggle("minimized", !latszik);
    }

    function valt(be) {
        /* Saját keretes mód: a játéktól függetlenül ugyanazt a teljes,
           pontosan méretezett vizuális felületet használjuk. */
        latszik = !!be;
        if (!latszik) targyBubLe();
        if (host) host.hidden = !latszik;
        try { if (latszik) savFel(); savAllapot(); } catch (e) { /* a sav a jatek elemenel mulik */ }
      if (latszik) {
        if (!host.parentNode) document.body.appendChild(host);
        allitPoz();
        elore();
        nyitasFrissit();
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
            if (e.target.closest(".zar,.mini,.ujra,.mindzar")) return;
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
        b.title = "Keresked\u0151pult";
        b.setAttribute("aria-label", "Keresked\u0151pult megnyit\u00E1sa");

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
            /* t58: a feladatlista a karakter azonositojaval toltodik. Ha az
               meg nincs meg, a panel ures listaval indul, es fel
               masodpercenkent ujra probalja; amint sikerul, ujrarajzol. */
            if (!feladatokBetolt()) {
                let probak = 0;
                const t = setInterval(() => {
                    probak++;
                    if (feladatokBetolt()) { clearInterval(t); rajzol(); }
                    else if (probak > 120) clearInterval(t);
                }, 500);
            }
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
