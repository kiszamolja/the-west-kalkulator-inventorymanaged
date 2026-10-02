// ==UserScript==
// @name         The West Boltkereső
// @namespace    the-west-boltkereso
// @version      1.0.0
// @description  Nagyító a jobb oldali menüben: beírod egy bolti tárgy nevét, és megkeresi a legközelebbi várost, ahol a boltban kapható.
// @author       smcZ
// @homepageURL  https://kiszamolja.github.io/the-west-kalkulator-inventorymanaged/
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
// @grant        none
// @updateURL    https://kiszamolja.github.io/the-west-kalkulator-inventorymanaged/the-west-boltkereso.user.js
// @downloadURL  https://kiszamolja.github.io/the-west-kalkulator-inventorymanaged/the-west-boltkereso.user.js
// ==/UserScript==

/*
    MUKODES

    Nagyito ikon a jobb oldali menuoszlopban (#ui_menubar), a Munka
    gyorsszett mintajara. Kattintasra a jatek sajat ablaka nyilik:
    - a keresomezobe irt szovegre a betoltott targylistabol (ItemManager)
      felkinalja a bolti targyakat, szerverkeres NELKUL;
    - a kivalasztott targyat a legkozelebbi varostol kezdve, varosonkent egy
      keressel, 500 ms szunettel keresi, es az elso talalatnal megall;
    - talalatkor a "Bolt megnyitasa" gomb nyitja meg a jatek boltablakat
      (Trader.open), a karakter nem indul el.

    MERT TENYEK, AMIKRE EPUL (a Kalandsegitobol atveve, ott mert es eles)

    - Bolti targy: a targy tipusa donti el a boltot (fej, test, lab, nadrag:
      szabo; jobb es bal kez: fegyverkovacs; nyak, allat, ov: szatocs), es
      akkor bolti, ha a traderlevel 1 es 30 kozott van (a TW-Calc modszere,
      a szerzok engedelyevel).
    - Egy varos boltjanak kinalata: game.php?window=building_<bolt>&town_id=..,
      a valaszban trader_inv (targyazonositok). Varosonkent egy keres.
    - A bolt szintje nem donti el a kinalatot, ezert keres nelkuli
      eloszures nincs. Varoskorlat nincs (MrA dontese, Kalandsegito t22).
    - A varosok: map / get_minimap (egyszer, munkamenetenkent), a mukodo
      varosok (tagokkal, 2000 pont folott), utido szerint rendezve
      (GameMap.calcWayTime, masodperc), a sajat varos elore.
    - Szunet a jatekszerver fele kuldott sorozatban: 500 ms (Kalandsegito,
      megbizok lekerese).
    - A bolt (MERT, 1.0.0 elott): Trader.inv targyazonosito szerinti objektum,
      a bolt ebben a sorrendben rajzolja, oldalankent Trader.invMaxLength (12);
      Trader.drawInventory(oldal) a sajat lapozoja; egy targy doboza
      Trader.inv[id].divMain. A kinalat a szerver valaszara tolt be, az uj
      ablak #trader_bag-je addig ures.
    - Targybuborek (MERT): new ItemPopup(targy, beallitas).bindTo(elem), a
      jatek sajat targyai is igy kapjak (tw2widget.Item.setTooltip).
    - A keresomezo szabalyai a Kereskedopultbol: kis- es nagybetu, ekezet
      mindegy, a nev barmely resze talal, X a mezo vegen.
*/

(function ()
{
    'use strict';

    var NEV = 'Boltkereső';
    var VERZIO = '1.0.0';
    var TESZT = false;

    var WEBOLDAL = 'https://kiszamolja.github.io/the-west-kalkulator-inventorymanaged/';

    // FRISSITES, a Munkaruha-valaszto (es azon at a Kalandsegito) mintajara. A
    // fajlnev allando: a GitHub Pages-en mindig ugyanaz a fajl frissul. A
    // felulet a jatek sajat ablaka, naponta legfeljebb egyszer. @grant none,
    // ezert sima fetch es localStorage.
    var FRISS_URL = WEBOLDAL + 'the-west-boltkereso.user.js';
    var FRISS_IDOKOZ = 6 * 60 * 60 * 1000;
    var FRISS_NAP_KULCS = 'smcz-boltkereso-frissites-nap';
    // A TESZT-epito true-ra allitja: a konzolban smczBoltkeresoFrissProba()
    // mutatja az ablakot, kulso keres nelkul. Kiadasban false.
    var FRISS_PROBA = false;
    // A KIADAS VALTOZASAI. Ezt olvassa ki a MAR TELEPITETT regi valtozat a
    // letoltott uj fajlbol. Minden eles kiadas elott MrA hagyja jova.
    // Legfeljebb 3-5 rovid sor, JSON-kent olvassuk (dupla idezojel, visszaper
    // nelkul). A ket jelolo sor nem valtozhat.
    /* VALTOZASOK KEZDETE */
    var VALTOZASOK = [
        "Az els\u0151 kiad\u00e1s: nagy\u00edt\u00f3 a jobb oldali men\u00fcben, b\u00e1rmely bolti t\u00e1rgy keres\u00e9se n\u00e9v szerint.",
        "A legk\u00f6zelebbi v\u00e1rost\u00f3l keres, \u00e9s az els\u0151 tal\u00e1latn\u00e1l meg\u00e1ll; a keres\u00e9s b\u00e1rmikor le\u00e1ll\u00edthat\u00f3.",
        "Tal\u00e1latkor egy gombbal megnyithat\u00f3 a bolt ablaka."
    ];
    /* VALTOZASOK VEGE */

    // Szunet a varosonkenti boltlekeresek kozott, ezredmasodpercben.
    var KERES_SZUNET = 500;
    // A felkinalt targyak listajanak felso hatara.
    var AJANLAT_MAX = 40;
    // Mukodo varos: legalabb ennyi pont (a Kalandsegito szurese).
    var VAROS_MIN_PONT = 2000;

    var ABLAK_ID = 'smcz-boltkereso';
    // Az ablak merete (MERT: a jatek ablaka setSize(w, h)-val meretezheto, utana
    // doLayout; alapbol 748 x 471, ami ennek a tartalomnak tul nagy).
    var ABLAK_SZEL = 380;
    // A boltablak betoltesere varunk ennyi ideig, ennyi idonkent nezve.
    var BOLT_VARAS = 10000;
    var BOLT_NEZES = 150;
    var ABLAK_MAG = 400;
    var OSZTALY = 'smcz-bk';

    var BOLT_TIPUS = {
        head: 'tailor', body: 'tailor', foot: 'tailor', pants: 'tailor',
        right_arm: 'gunsmith', left_arm: 'gunsmith',
        neck: 'general', animal: 'general', belt: 'general'
    };
    var BOLT_NEV = { tailor: 'Szabó', gunsmith: 'Fegyverkovács', general: 'Vegyesbolt' };

    var MAGYAR = new Intl.Collator('hu');

    var allapot = {
        targyak: null,       // a bolti targyak, egyszer felepitve
        terkep: null,        // a get_minimap valasza
        terkepVar: [],
        kinalat: {},         // munkamenetenkent: 'bolt:varos' -> [targyazonositok]
        kereses: '',
        aktiv: 0,
        kivalasztott: null,
        fut: false,
        megall: false,
        talalat: null,
        uzenet: '',
        haladas: null,
        ablak: null,
        gyoker: null
    };

    /* ================================================================== */
    /* Altalanos                                                           */
    /* ================================================================== */

    function naplo(szoveg, adat)
    {
        if (typeof adat === 'undefined') console.log('[' + NEV + '] ' + szoveg);
        else console.log('[' + NEV + '] ' + szoveg, adat);
    }

    function htmlVedes(x)
    {
        return String(x == null ? '' : x).replace(/[&<>"']/g, function (c)
        {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
        });
    }

    // A Kereskedopult keresoszabalya (ekNelkul, piacNormal), szo szerint.
    var EK_KIVETEL = [[/ł/g, 'l'], [/ß/g, 'ss'], [/đ/g, 'd'], [/ø/g, 'o']];
    function ekNelkul(t)
    {
        var x = String(t == null ? '' : t).toLowerCase();
        for (var i = 0; i < EK_KIVETEL.length; i++) x = x.replace(EK_KIVETEL[i][0], EK_KIVETEL[i][1]);
        return x.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    }
    function piacNormal(s)
    {
        return ekNelkul(String(s == null ? '' : s)).replace(/\s+/g, ' ').trim();
    }

    // A Kalandsegito fmtIdo-ja (masodperc).
    function fmtIdo(mp)
    {
        mp = Math.max(0, Math.round(mp));
        var h = Math.floor(mp / 3600), m = Math.floor((mp % 3600) / 60), s = mp % 60, p = [];
        if (h) p.push(h + ' óra');
        if (m) p.push(m + ' perc');
        if (s && !h) p.push(s + ' mp');
        return p.length ? p.join(' ') : '0 perc';
    }

    function keszEnAJatek()
    {
        return typeof ItemManager !== 'undefined' && typeof ItemManager.getAll === 'function' &&
            typeof Ajax !== 'undefined' && typeof Ajax.get === 'function' &&
            typeof $ !== 'undefined' && typeof $.get === 'function' &&
            typeof wman !== 'undefined' && typeof Character !== 'undefined' &&
            $('#ui_menubar').length > 0;
    }

    /* ================================================================== */
    /* Bolti targyak (keres nelkul)                                        */
    /* ================================================================== */

    function boltTipus(t)
    {
        if (!t || !BOLT_TIPUS[t.type] || !t.traderlevel || t.traderlevel > 30) return null;
        return BOLT_TIPUS[t.type];
    }

    function boltiTargyak()
    {
        if (allapot.targyak) return allapot.targyak;
        var lista = [];
        var minden = {};
        try
        {
            minden = ItemManager.getAll() || {};
        }
        catch (e)
        {
            minden = {};
        }
        Object.keys(minden).forEach(function (k)
        {
            var t = minden[k];
            if (!t || !t.item_id || Number(t.item_id) % 1000 !== 0) return;
            var bolt = boltTipus(t);
            if (!bolt || !t.name) return;
            lista.push({
                id: Number(t.item_id),
                nev: String(t.name),
                kulcs: piacNormal(t.name),
                bolt: bolt,
                kep: t.image ? String(t.image) : ''
            });
        });
        lista.sort(function (a, b)
        {
            return MAGYAR.compare(a.nev, b.nev);
        });
        // Ures listat nem tarolunk: lehet, hogy a targyak meg nem toltottek be.
        if (lista.length) allapot.targyak = lista;
        return lista;
    }

    function ajanlatok(szoveg)
    {
        var q = piacNormal(szoveg);
        if (!q) return [];
        return boltiTargyak().filter(function (t)
        {
            return t.kulcs.indexOf(q) !== -1;
        });
    }

    /* ================================================================== */
    /* Varosok es boltok (szerverkeres)                                    */
    /* ================================================================== */

    // 1 keres, munkamenetenkent egyszer.
    function terkepet(kesz)
    {
        if (allapot.terkep)
        {
            kesz(true);
            return;
        }
        allapot.terkepVar.push(kesz);
        if (allapot.terkepVar.length > 1) return;
        var vege = function (ok)
        {
            var v = allapot.terkepVar;
            allapot.terkepVar = [];
            v.forEach(function (f)
            {
                try
                {
                    f(ok);
                }
                catch (e)
                {
                    // tovabb
                }
            });
        };
        var egyszer = false;
        try
        {
            Ajax.get('map', 'get_minimap', {}, function (valasz)
            {
                if (egyszer) return;
                egyszer = true;
                if (valasz && !valasz.error && valasz.towns)
                {
                    allapot.terkep = valasz;
                    vege(true);
                }
                else vege(false);
            });
        }
        catch (e)
        {
            vege(false);
        }
    }

    function pozicio()
    {
        try
        {
            var p = Character.position;
            if (p && typeof p.x === 'number' && typeof p.y === 'number') return p;
        }
        catch (e)
        {
            // nincs
        }
        return null;
    }

    function utido(p, x, y)
    {
        try
        {
            if (!p || typeof GameMap === 'undefined' || typeof GameMap.calcWayTime !== 'function') return null;
            var t = Number(GameMap.calcWayTime(p, { x: x, y: y }));
            return t >= 0 ? t : null;
        }
        catch (e)
        {
            return null;
        }
    }

    function varosLista()
    {
        var towns = (allapot.terkep && allapot.terkep.towns) || {};
        var p = pozicio();
        var haz = Character && Character.homeTown;
        var hazId = haz && haz.town_id ? String(haz.town_id) : '';
        var lista = [];
        var hazVaros = null;
        Object.keys(towns).forEach(function (k)
        {
            var t = towns[k];
            if (!t || !t.town_id) return;
            var v = {
                town_id: t.town_id,
                nev: t.name ? String(t.name) : '',
                x: t.x,
                y: t.y,
                ido: utido(p, t.x, t.y)
            };
            if (hazId && String(t.town_id) === hazId)
            {
                hazVaros = v;
                return;
            }
            if (!t.member_count || !(t.town_points > VAROS_MIN_PONT)) return;
            lista.push(v);
        });
        lista.sort(function (a, b)
        {
            return (a.ido == null ? Infinity : a.ido) - (b.ido == null ? Infinity : b.ido);
        });
        if (hazId)
        {
            if (!hazVaros) hazVaros = { town_id: haz.town_id, nev: haz.name ? String(haz.name) : '', x: haz.x, y: haz.y, ido: utido(p, haz.x, haz.y) };
            lista.unshift(hazVaros);
        }
        return lista;
    }

    // 1 keres egy varos egy boltjara; munkamenetenkent megjegyezzuk.
    function boltKinalat(bolt, townId, kesz)
    {
        var kulcs = bolt + ':' + townId;
        if (allapot.kinalat[kulcs])
        {
            kesz(allapot.kinalat[kulcs], false);
            return;
        }
        var egyszer = false;
        var vege = function (x)
        {
            if (egyszer) return;
            egyszer = true;
            if (x) allapot.kinalat[kulcs] = x;
            kesz(x, true);
        };
        try
        {
            var k = $.get('game.php?window=building_' + bolt + '&town_id=' + encodeURIComponent(townId), function (json)
            {
                if (!json || json.error || !Array.isArray(json.trader_inv)) vege(null);
                else vege(json.trader_inv.map(function (x)
                {
                    return Number(x && x.item_id);
                }));
            });
            if (k && typeof k.fail === 'function') k.fail(function ()
            {
                vege(null);
            });
        }
        catch (e)
        {
            vege(null);
        }
    }

    function ablakNyitva()
    {
        try
        {
            return !!(allapot.gyoker && document.body.contains(allapot.gyoker));
        }
        catch (e)
        {
            return false;
        }
    }

    function keresesIndit(targy)
    {
        if (allapot.fut || !targy) return;
        allapot.kivalasztott = targy;
        allapot.fut = true;
        allapot.megall = false;
        allapot.talalat = null;
        allapot.uzenet = 'A városok betöltése...';
        allapot.haladas = null;
        rajzol();
        terkepet(function (ok)
        {
            if (!ok)
            {
                keresesVege('A városok nem töltöttek be, próbáld újra.');
                return;
            }
            var varosok = varosLista();
            if (!varosok.length)
            {
                keresesVege('Nem találtam várost a térképen.');
                return;
            }
            var kov = function (i)
            {
                if (allapot.megall || !ablakNyitva())
                {
                    keresesVege('Leállítva, ' + i + ' város után.');
                    return;
                }
                if (i >= varosok.length)
                {
                    keresesVege('Egyik városban sem találtam (' + varosok.length + ' város).');
                    return;
                }
                var v = varosok[i];
                allapot.haladas = { i: i + 1, db: varosok.length };
                allapot.uzenet = 'Keresem... ' + (i + 1) + '. város' + (v.nev ? ': ' + v.nev : '');
                haladasFrissit();
                boltKinalat(targy.bolt, v.town_id, function (lista, kertuk)
                {
                    if (lista && lista.indexOf(targy.id) !== -1)
                    {
                        allapot.talalat = { varos: v, sorszam: i + 1 };
                        keresesVege('');
                        return;
                    }
                    if (kertuk) setTimeout(function ()
                    {
                        kov(i + 1);
                    }, KERES_SZUNET);
                    else kov(i + 1);
                });
            };
            kov(0);
        });
    }

    function keresesVege(szoveg)
    {
        allapot.fut = false;
        allapot.megall = false;
        allapot.haladas = null;
        allapot.uzenet = szoveg;
        if (ablakNyitva()) rajzol();
    }

    function boltNyit()
    {
        var t = allapot.talalat, targy = allapot.kivalasztott;
        if (!t || !targy) return;
        try
        {
            Trader.open(targy.bolt, t.varos.town_id, t.varos.x, t.varos.y);
        }
        catch (e)
        {
            allapot.uzenet = 'A bolt ablaka nem nyílt meg.';
            rajzol();
            return;
        }
        boltraLapoz(targy.bolt, t.varos.town_id, targy.id);
    }

    // A friss boltablak kinalatanak betoltese utan a targy oldalara lapoz,
    // es felvillantja. Keres nelkul: a mar letoltott kinalaton belul.
    function boltraLapoz(bolt, townId, targyId)
    {
        var kezdet = Date.now();
        var nez = function ()
        {
            if (Date.now() - kezdet > BOLT_VARAS) return;
            var kesz = false;
            try
            {
                kesz = Trader.type === bolt && String(Trader.id) === String(townId) &&
                    $('#trader_bag').children().length > 0 && Trader.inv && !!Trader.getItemByItemId(targyId);
            }
            catch (e)
            {
                kesz = false;
            }
            if (!kesz)
            {
                setTimeout(nez, BOLT_NEZES);
                return;
            }
            try
            {
                var kulcsok = Object.keys(Trader.inv);
                var hely = kulcsok.indexOf(String(targyId));
                var egyOldal = Number(Trader.invMaxLength) || 12;
                if (hely < 0) return;
                var oldal = Math.floor(hely / egyOldal) + 1;
                if (Number(Trader.page) !== oldal) Trader.drawInventory(oldal);
                var doboz = Trader.inv[String(targyId)] && Trader.inv[String(targyId)].divMain;
                var el = doboz && doboz.jquery ? doboz[0] : doboz;
                if (el && el.classList)
                {
                    el.classList.remove(OSZTALY + '-villan');
                    void el.offsetWidth;
                    el.classList.add(OSZTALY + '-villan');
                    setTimeout(function ()
                    {
                        el.classList.remove(OSZTALY + '-villan');
                    }, 2600);
                }
            }
            catch (e)
            {
                // a bolt marad, ahogy megnyilt
            }
        };
        setTimeout(nez, BOLT_NEZES);
    }

    /* ================================================================== */
    /* Felulet                                                             */
    /* ================================================================== */

    var NAGYITO_SVG = '<svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true" style="display:block">' +
        '<circle cx="10" cy="10" r="6.2" fill="none" stroke="#f0d9a8" stroke-width="2.4"/>' +
        '<line x1="14.6" y1="14.6" x2="20.5" y2="20.5" stroke="#f0d9a8" stroke-width="3" stroke-linecap="round"/></svg>';

    function stilusBetoltes()
    {
        if (document.getElementById(OSZTALY + '-stilus')) return;
        var s = document.createElement('style');
        s.id = OSZTALY + '-stilus';
        var o = '.' + OSZTALY;
        s.textContent = [
            o + '{font:13px/1.4 Arial,sans-serif;color:#2b1c0e;padding:10px 12px 6px;box-sizing:border-box;width:100%}',
            o + ' .bk-mezo{position:relative;margin-bottom:8px}',
            o + ' .bk-mezo input{width:100%;box-sizing:border-box;font:inherit;font-size:13.5px;border:1px solid #a07a3c;border-radius:5px;padding:6px 26px 6px 9px;background:#fbf4e3;color:#2b1c0e;outline:none;box-shadow:none}',
            o + ' .bk-mezo input:focus{outline:none;border-color:#8a5a12;box-shadow:0 0 0 2px rgba(138,90,18,.25)}',
            o + ' .bk-torlo{position:absolute;right:4px;top:50%;transform:translateY(-50%);appearance:none;border:0;background:transparent;color:#7a6248;cursor:pointer;font:inherit;font-size:14px;line-height:1;padding:2px 5px;border-radius:4px}',
            o + ' .bk-torlo:hover{color:#2b1c0e;background:#e2cfa3}',
            o + ' .bk-lista{max-height:200px;overflow-y:auto;margin:0 0 6px;padding-right:2px;scrollbar-width:thin;scrollbar-color:#a07a3c rgba(90,63,34,.12)}',
            o + ' .bk-lista::-webkit-scrollbar{width:8px}',
            o + ' .bk-lista::-webkit-scrollbar-track{background:rgba(90,63,34,.12);border-radius:4px}',
            o + ' .bk-lista::-webkit-scrollbar-thumb{background:#a07a3c;border-radius:4px}',
            o + ' .bk-sor{display:flex;align-items:center;gap:8px;padding:3px 6px;border-radius:4px;cursor:pointer;width:100%;box-sizing:border-box;border:0;background:transparent;font:inherit;color:inherit;text-align:left}',
            o + ' .bk-sor:hover,' + o + ' .bk-sor.aktiv{background:rgba(90,63,34,.14)}',
            o + ' .bk-sor.valasztott{background:rgba(90,63,34,.14);cursor:default}',
            o + ' .bk-nev{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
            o + ' .bk-ik{width:26px;height:26px;flex:none;object-fit:contain}',
            o + ' .bk-tip{margin-left:auto;font-size:11px;color:#7a6248;white-space:nowrap}',
            o + ' .bk-all{font-size:12px;color:#5a4632;margin:4px 0 6px}',
            o + ' .bk-sav{height:6px;background:#d8c39a;border-radius:3px;margin:0 0 8px;overflow:hidden}',
            o + ' .bk-sav i{display:block;height:6px;background:#8a5a12;border-radius:3px}',
            o + ' .bk-gomb{padding:4px 12px;cursor:pointer;font:12px Arial,sans-serif;border-radius:4px;border:1px solid #a83a20;color:#a83a20;background:transparent}',
            o + ' .bk-gomb:hover{background:#a83a20;color:#fff}',
            o + ' .bk-nyit{padding:6px 14px;cursor:pointer;font:600 12px Arial,sans-serif;background:#3a2713;color:#f0c874;border:1px solid #8a6330;border-radius:5px}',
            o + ' .bk-ok{background:#dfe8c8;border:1px solid #6d8a3a;border-radius:4px;padding:6px 8px;color:#2f4a12;font-size:12px;margin:4px 0 8px}',
            o + ' .bk-uj{appearance:none;border:0;background:none;color:#7a5530;cursor:pointer;font:12px Arial,sans-serif;text-decoration:underline;padding:0;margin-left:10px}',
            o + ' .bk-al{margin:10px 0 2px;text-align:center;font-size:10.5px;font-style:italic;letter-spacing:.02em}',
            o + ' .bk-al a{color:#8b7a63;text-decoration:none}',
            o + ' .bk-al .sziv{color:#d7473f;font-style:normal;font-size:13px;line-height:1;padding:0 2px}',
            '#' + OSZTALY + '-ikon{background:#5a4632;display:flex;align-items:center;justify-content:center;cursor:pointer;user-select:none}',
            '#' + OSZTALY + '-ikon.fut{background:#2f6f3e}',
            '@keyframes ' + OSZTALY + '-villan{0%,100%{box-shadow:0 0 0 0 rgba(241,194,74,0)}50%{box-shadow:0 0 0 3px #f1c24a,0 0 12px 4px rgba(241,194,74,.85)}}',
            '.' + OSZTALY + '-villan{animation:' + OSZTALY + '-villan .8s ease-in-out 3;border-radius:4px}'
        ].join('\n');
        document.head.appendChild(s);
    }

    function ikonHTML(t)
    {
        return t.kep ? '<img class="bk-ik" src="' + htmlVedes(t.kep) + '" alt="">' : '<span class="bk-ik"></span>';
    }

    function targySorHTML(t, osztaly, idx)
    {
        return '<button type="button" class="bk-sor' + (osztaly ? ' ' + osztaly : '') + '" data-bk-tid="' + t.id + '"' +
            (idx != null ? ' data-bk-idx="' + idx + '"' : '') + '>' + ikonHTML(t) +
            '<span class="bk-nev">' + htmlVedes(t.nev) + '</span><span class="bk-tip">' + htmlVedes(BOLT_NEV[t.bolt] || t.bolt) + '</span></button>';
    }

    function alairasHTML()
    {
        return '<div class="bk-al"><a href="' + htmlVedes(WEBOLDAL) + '" target="_blank" rel="noopener">Crafted with <span class="sziv">\u2665</span> by smcZ</a></div>';
    }

    // A felkinalt targyak, a mezo alatt (csak ez rajzolodik ujra gepeleskor).
    function listaHTML()
    {
        if (!allapot.kereses.trim())
        {
            var db = boltiTargyak().length;
            return '<div class="bk-all">' + (db ? 'Írd be egy bolti tárgy nevét (' + db + ' tárgy).' : 'A tárgyak még töltődnek, próbáld újra egy kicsit később.') + '</div>';
        }
        var t = ajanlatok(allapot.kereses);
        if (!t.length) return '<div class="bk-all">Nincs ilyen nevű bolti tárgy.</div>';
        if (allapot.aktiv >= Math.min(t.length, AJANLAT_MAX)) allapot.aktiv = 0;
        var sorok = t.slice(0, AJANLAT_MAX).map(function (x, i)
        {
            return targySorHTML(x, i === allapot.aktiv ? 'aktiv' : '', i);
        }).join('');
        var tobb = t.length > AJANLAT_MAX ? ', ebből ' + AJANLAT_MAX + ' látszik, írj be többet' : '';
        return '<div class="bk-lista">' + sorok + '</div><div class="bk-all">' + t.length + ' bolti tárgy' + tobb + '.</div>';
    }

    function tartalomHTML()
    {
        var targy = allapot.kivalasztott;
        if (allapot.fut)
        {
            var h = allapot.haladas;
            var szaz = h ? Math.max(2, Math.round(h.i / h.db * 100)) : 2;
            return targySorHTML(targy, 'valasztott') +
                '<div class="bk-all" data-bk-uzenet>' + htmlVedes(allapot.uzenet) + '</div>' +
                '<div class="bk-sav"><i data-bk-sav style="width:' + szaz + '%"></i></div>' +
                '<button type="button" class="bk-gomb" data-bk-megall>Keresés leállítása</button>';
        }
        if (targy && (allapot.talalat || allapot.uzenet))
        {
            var ki = targySorHTML(targy, 'valasztott');
            if (allapot.talalat)
            {
                var v = allapot.talalat.varos;
                ki += '<div class="bk-ok">Kapható: ' + htmlVedes(v.nev || 'a város') + ', ' + htmlVedes(BOLT_NEV[targy.bolt] || '') +
                    ' (' + allapot.talalat.sorszam + '. város)' + (v.ido != null ? ', útidő kb. ' + htmlVedes(fmtIdo(v.ido)) : '') + '.</div>' +
                    '<button type="button" class="bk-nyit" data-bk-nyit>Bolt megnyitása \u25B8</button>';
            }
            else ki += '<div class="bk-all">' + htmlVedes(allapot.uzenet) + '</div>';
            return ki + '<button type="button" class="bk-uj" data-bk-uj>Új keresés</button>';
        }
        return '<div class="bk-mezo"><input data-bk-mezo autocomplete="off" spellcheck="false" placeholder="Tárgy neve" value="' + htmlVedes(allapot.kereses) + '">' +
            '<button type="button" class="bk-torlo" data-bk-torlo aria-label="Keresés törlése"' + (allapot.kereses ? '' : ' hidden') + '>\u2715</button></div>' +
            '<div data-bk-lista>' + listaHTML() + '</div>';
    }

    // A jatek sajat targyleirasa a sorokon; ha nem megy, a nev a buborek.
    function buborekok(hol)
    {
        if (!hol) return;
        [].forEach.call(hol.querySelectorAll('[data-bk-tid]'), function (el)
        {
            var id = Number(el.getAttribute('data-bk-tid'));
            var kesz = false;
            try
            {
                var t = ItemManager.get(id);
                if (t && typeof ItemPopup === 'function')
                {
                    new ItemPopup(t, {}).bindTo(el);
                    kesz = true;
                }
            }
            catch (e)
            {
                kesz = false;
            }
            if (!kesz)
            {
                var n = el.querySelector('.bk-nev');
                if (n) el.setAttribute('title', n.textContent);
            }
        });
    }

    function ikonAllapot()
    {
        var ikon = document.getElementById(OSZTALY + '-ikon');
        if (ikon) ikon.classList.toggle('fut', !!allapot.fut);
    }

    function rajzol()
    {
        ikonAllapot();
        var g = allapot.gyoker;
        if (!g || !ablakNyitva()) return;
        g.innerHTML = '<div data-bk-tartalom>' + tartalomHTML() + '</div>' + alairasHTML();
        buborekok(g);
        var mezo = g.querySelector('[data-bk-mezo]');
        if (mezo)
        {
            mezo.focus();
            try
            {
                mezo.setSelectionRange(mezo.value.length, mezo.value.length);
            }
            catch (e)
            {
                // nem baj
            }
        }
    }

    function listaFrissit()
    {
        var g = allapot.gyoker;
        if (!g) return;
        var l = g.querySelector('[data-bk-lista]');
        if (l)
        {
            l.innerHTML = listaHTML();
            buborekok(l);
        }
        var torlo = g.querySelector('[data-bk-torlo]');
        if (torlo) torlo.hidden = !allapot.kereses;
    }

    function haladasFrissit()
    {
        ikonAllapot();
        var g = allapot.gyoker;
        if (!g) return;
        var u = g.querySelector('[data-bk-uzenet]');
        var s = g.querySelector('[data-bk-sav]');
        if (!u || !s)
        {
            rajzol();
            return;
        }
        u.textContent = allapot.uzenet;
        var h = allapot.haladas;
        if (h) s.style.width = Math.max(2, Math.round(h.i / h.db * 100)) + '%';
    }

    function valaszt(idx)
    {
        var t = ajanlatok(allapot.kereses);
        var x = t[Number(idx)];
        if (x) keresesIndit(x);
    }

    function esemenyek(g)
    {
        g.addEventListener('input', function (e)
        {
            if (!e.target || !e.target.hasAttribute('data-bk-mezo')) return;
            allapot.kereses = e.target.value;
            allapot.aktiv = 0;
            listaFrissit();
        });
        g.addEventListener('keydown', function (e)
        {
            if (!e.target || !e.target.hasAttribute('data-bk-mezo')) return;
            var db = Math.min(ajanlatok(allapot.kereses).length, AJANLAT_MAX);
            if (e.key === 'ArrowDown' && db)
            {
                allapot.aktiv = (allapot.aktiv + 1) % db;
                listaFrissit();
                e.preventDefault();
            }
            else if (e.key === 'ArrowUp' && db)
            {
                allapot.aktiv = (allapot.aktiv - 1 + db) % db;
                listaFrissit();
                e.preventDefault();
            }
            else if (e.key === 'Enter' && db)
            {
                valaszt(allapot.aktiv);
                e.preventDefault();
            }
            e.stopPropagation();
        });
        g.addEventListener('click', function (e)
        {
            var el = e.target && e.target.closest ? e.target.closest('button') : null;
            if (!el || !g.contains(el)) return;
            if (el.hasAttribute('data-bk-torlo'))
            {
                allapot.kereses = '';
                allapot.aktiv = 0;
                var mezo = g.querySelector('[data-bk-mezo]');
                if (mezo)
                {
                    mezo.value = '';
                    mezo.focus();
                }
                listaFrissit();
            }
            else if (el.hasAttribute('data-bk-idx')) valaszt(el.getAttribute('data-bk-idx'));
            else if (el.hasAttribute('data-bk-megall'))
            {
                allapot.megall = true;
                allapot.uzenet = 'Leállítás...';
                haladasFrissit();
            }
            else if (el.hasAttribute('data-bk-nyit')) boltNyit();
            else if (el.hasAttribute('data-bk-uj'))
            {
                allapot.kivalasztott = null;
                allapot.talalat = null;
                allapot.uzenet = '';
                rajzol();
            }
        });
    }

    function ablakNyit()
    {
        if (ablakNyitva())
        {
            try
            {
                var regi = wman.getById ? wman.getById(ABLAK_ID) : null;
                if (regi && typeof regi.bringToTop === 'function') regi.bringToTop();
            }
            catch (e)
            {
                // nem baj
            }
            return;
        }
        var g = document.createElement('div');
        g.className = OSZTALY;
        allapot.gyoker = g;
        esemenyek(g);
        var cim = NEV + (TESZT ? ' TESZT' : '');
        try
        {
            var abl = wman.open(ABLAK_ID, cim);
            if (abl)
            {
                ['setTitle', 'setMiniTitle'].forEach(function (n)
                {
                    try
                    {
                        if (typeof abl[n] === 'function') abl[n](cim);
                    }
                    catch (e2)
                    {
                        // nem baj
                    }
                });
                try
                {
                    if (typeof abl.setResizeable === 'function') abl.setResizeable(false);
                }
                catch (e2)
                {
                    // nem baj
                }
                abl.appendToContentPane(g);
                try
                {
                    if (typeof abl.setSize === 'function') abl.setSize(ABLAK_SZEL, ABLAK_MAG);
                    if (typeof abl.center === 'function') abl.center();
                }
                catch (e2)
                {
                    // marad az alapmeret
                }
                allapot.ablak = abl;
                rajzol();
                return;
            }
        }
        catch (e)
        {
            // tartalek alabb
        }
        var box = document.createElement('div');
        box.style.cssText = 'position:fixed;right:70px;top:90px;z-index:99999;width:' + ABLAK_SZEL + 'px;background:#efe2c4;border:1px solid #5b3d1f;border-radius:3px;box-shadow:0 0 0 3px #7a5530,0 8px 22px rgba(0,0,0,.55)';
        var fej = document.createElement('div');
        fej.style.cssText = 'padding:6px 10px;background:#5a3f22;color:#f4e0b0;font:700 13px Georgia,serif;display:flex;justify-content:space-between';
        fej.innerHTML = '<span>' + htmlVedes(cim) + '</span>';
        var x = document.createElement('span');
        x.textContent = '\u2715';
        x.style.cursor = 'pointer';
        x.onclick = function ()
        {
            box.remove();
        };
        fej.appendChild(x);
        box.appendChild(fej);
        box.appendChild(g);
        document.body.appendChild(box);
        rajzol();
    }

    function ikonBekotes()
    {
        if (document.getElementById(OSZTALY + '-gomb')) return;
        var ikon = $('<div></div>').attr({ 'class': 'menulink', 'id': OSZTALY + '-ikon', 'title': NEV + ' ' + VERZIO }).html(NAGYITO_SVG)
            .on('click', function (e)
            {
                e.stopPropagation();
                ablakNyit();
            });
        $('#ui_menubar').append($('<div></div>').attr({ 'class': 'ui_menucontainer', 'id': OSZTALY + '-gomb' })
            .append(ikon).append($('<div class="menucontainer_bottom"></div>')));
    }

    /* ================================================================== */
    /* Frissites (a Munkaruha-valaszto kodjanak atvetele)                  */
    /* ================================================================== */

    function verzioSzam(v)
    {
        return String(v).split(' ')[0];
    }

    function ujabbVerzio(a, b)
    {
        var x = String(a).split('.'), y = String(b).split('.');
        for (var i = 0; i < Math.max(x.length, y.length); i++)
        {
            var xi = parseInt(x[i] || '0', 10), yi = parseInt(y[i] || '0', 10);
            if (isNaN(xi) || isNaN(yi)) return false;
            if (xi > yi) return true;
            if (xi < yi) return false;
        }
        return false;
    }

    function probaVerzio(v)
    {
        var t = verzioSzam(v).split('.');
        var u = parseInt(t[t.length - 1], 10);
        t[t.length - 1] = String(isNaN(u) ? 1 : u + 1);
        return t.join('.');
    }

    function valtozasokSzovegbol(txt)
    {
        try
        {
            var m = String(txt || '').match(/\/\* VALTOZASOK KEZDETE \*\/[\s\S]*?=\s*(\[[\s\S]*?\]);\s*\/\* VALTOZASOK VEGE \*\//);
            if (!m) return [];
            var t = JSON.parse(m[1]);
            return Array.isArray(t) ? t.filter(function (x)
            {
                return typeof x === 'string' && x.trim();
            }).slice(0, 8) : [];
        }
        catch (e)
        {
            return [];
        }
    }

    function maNap()
    {
        return new Date().toISOString().slice(0, 10);
    }

    function frissitestKeres()
    {
        try
        {
            if (localStorage.getItem(FRISS_NAP_KULCS) === maNap()) return;
        }
        catch (e)
        {
            return;
        }
        fetch(FRISS_URL + '?v=' + Date.now(), { cache: 'no-store' }).then(function (r)
        {
            return r.ok ? r.text() : null;
        }).then(function (txt)
        {
            if (!txt) return;
            var m = txt.match(/@version\s+(\S+)/);
            if (!m || !ujabbVerzio(m[1], verzioSzam(VERZIO))) return;
            try
            {
                localStorage.setItem(FRISS_NAP_KULCS, maNap());
            }
            catch (e)
            {
                // nem baj
            }
            frissitesAblak(m[1], valtozasokSzovegbol(txt), false);
        }).catch(function (e)
        {
            if (TESZT) naplo('frissites ellenorzese nem sikerult: ' + (e && e.message));
        });
    }

    var FRISS_ABLAK_ID = 'smcz-boltkereso-frissites';
    var FRISS_ABLAK_CIM = 'Boltkeres\u0151 - friss\u00EDt\u00E9s';

    function frissitesAblak(ver, lista, proba)
    {
        var tart = document.createElement('div');
        tart.style.cssText = 'padding:14px 16px;font:14px/1.5 Arial,sans-serif;color:#2b2119;box-sizing:border-box;width:100%';
        var tetelek = (lista || []).map(function (x)
        {
            return "<li style='margin:0 0 4px'>" + htmlVedes(x) + '</li>';
        }).join('');
        tart.innerHTML =
            '<div>\u00DAj verzi\u00F3 \u00E9rhet\u0151 el a Boltkeres\u0151b\u0151l.</div>' +
            "<div style='margin:10px 0'><b>Jelenlegi:</b> " + htmlVedes(verzioSzam(VERZIO)) + ' &nbsp; <b>El\u00E9rhet\u0151:</b> ' + htmlVedes(ver) + '</div>' +
            (tetelek ? "<ul style='margin:0 0 10px;padding-left:20px;font-size:13px;line-height:1.45'>" + tetelek + '</ul>' : '') +
            "<div style='margin-bottom:12px'>A gombra kattintva megny\u00EDlik a Tampermonkey telep\u00EDt\u0151 ablaka, ott el\u00E9g a Friss\u00EDt\u00E9s gombot megnyomni.</div>" +
            (proba ? "<div style='margin-bottom:12px;font-size:12px;color:#923b29'>Pr\u00F3baablak a TESZT-b\u0151l: a gomb most nem nyit telep\u00EDt\u0151t.</div>" : '');
        var gomb = document.createElement('button');
        gomb.textContent = 'Friss\u00EDt\u00E9s megnyit\u00E1sa';
        gomb.style.cssText = 'padding:7px 14px;cursor:pointer;font:600 13px Arial,sans-serif;background:#3a2713;color:#f0c874;border:1px solid #8a6330;border-radius:5px';
        var kesobb = document.createElement('button');
        kesobb.textContent = 'K\u00E9s\u0151bb';
        kesobb.style.cssText = 'padding:7px 14px;cursor:pointer;margin-left:8px;font:13px Arial,sans-serif;background:rgba(247,238,219,.7);color:#5a4326;border:1px solid #8a6330;border-radius:5px';
        var alairas = document.createElement('div');
        alairas.innerHTML = "Crafted with <span style='color:#d7473f;font-size:13px;padding:0 2px'>\u2665</span> by smcZ";
        alairas.style.cssText = 'margin-top:14px;text-align:right;font:11px Arial,sans-serif;color:rgba(43,33,25,.45)';
        tart.appendChild(gomb);
        tart.appendChild(kesobb);
        tart.appendChild(alairas);
        var bezar = function () {};
        gomb.onclick = function ()
        {
            if (!proba)
            {
                try
                {
                    window.open(FRISS_URL, '_blank');
                }
                catch (e)
                {
                    // nem sikerult
                }
            }
            bezar();
        };
        kesobb.onclick = function ()
        {
            bezar();
        };
        try
        {
            var regi = wman.getById ? wman.getById(FRISS_ABLAK_ID) : null;
            if (regi)
            {
                try
                {
                    wman.close(FRISS_ABLAK_ID);
                }
                catch (e2)
                {
                    // nem baj
                }
            }
            var abl = wman.open(FRISS_ABLAK_ID, FRISS_ABLAK_CIM);
            if (abl)
            {
                ['setTitle', 'setMiniTitle'].forEach(function (n)
                {
                    try
                    {
                        if (typeof abl[n] === 'function') abl[n](FRISS_ABLAK_CIM);
                    }
                    catch (e2)
                    {
                        // nem baj
                    }
                });
                try
                {
                    if (typeof abl.setResizeable === 'function') abl.setResizeable(false);
                }
                catch (e2)
                {
                    // nem baj
                }
                abl.appendToContentPane(tart);
                bezar = function ()
                {
                    try
                    {
                        abl.close();
                    }
                    catch (e2)
                    {
                        // nem baj
                    }
                };
                return;
            }
        }
        catch (e)
        {
            // tartalek alabb
        }
        var box = document.createElement('div');
        box.style.cssText = 'position:fixed;left:50%;top:22%;transform:translateX(-50%);z-index:99999;width:min(560px,92vw);background:#e8d6b0;border:1px solid #5b3d1f;border-radius:3px;box-shadow:0 0 0 3px #7a5530,0 8px 22px rgba(0,0,0,.55)';
        var fej = document.createElement('div');
        fej.textContent = FRISS_ABLAK_CIM;
        fej.style.cssText = 'padding:7px 12px;background:linear-gradient(180deg,#6d4a28,#3f2814);color:#f4e0b0;font:700 13px Georgia,serif';
        box.appendChild(fej);
        box.appendChild(tart);
        bezar = function ()
        {
            box.remove();
        };
        document.body.appendChild(box);
    }

    /* ================================================================== */
    /* Indulas                                                             */
    /* ================================================================== */

    var varakozo = setInterval(function ()
    {
        if (!keszEnAJatek()) return;
        clearInterval(varakozo);
        stilusBetoltes();
        ikonBekotes();
        naplo(VERZIO + ' elindult. Crafted with \u2665 by smcZ - ' + WEBOLDAL);
        if (TESZT)
        {
            window.smczBoltkereso = { allapot: allapot, boltiTargyak: boltiTargyak, ajanlatok: ajanlatok };
        }
        if (FRISS_PROBA)
        {
            window.smczBoltkeresoFrissProba = function ()
            {
                frissitesAblak(probaVerzio(VERZIO), VALTOZASOK, true);
            };
            naplo('frissitesablak probaja: smczBoltkeresoFrissProba()');
        }
        frissitestKeres();
        setInterval(frissitestKeres, FRISS_IDOKOZ);
    }, 500);
})();
