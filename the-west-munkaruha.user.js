// ==UserScript==
// @name         The West Munkaruha-választó
// @namespace    the-west-munkaruha
// @version      1.0.4
// @description  Gombok a munkaablakban: egy kattintással a legtöbb munkapontot, tapasztalatot, terméket vagy szerencsét adó ruha, a munka fokozatát is figyelembe véve; villám gomb a leggyorsabb ruhához az úthoz; zZ gomb a hotelben a legjobb regenerációs ruhához.
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
// @updateURL    https://kiszamolja.github.io/the-west-kalkulator-inventorymanaged/the-west-munkaruha.user.js
// @downloadURL  https://kiszamolja.github.io/the-west-kalkulator-inventorymanaged/the-west-munkaruha.user.js
// ==/UserScript==

/*
    MUKODES

    A nativ munkaablak sorainak vegere kis gombok kerulnek:
    - tapasztalat sora (csillag): Tapasztalat - a legtobb tapasztalat;
    - szerencse sora (lohere): Szerencse - a legtobb munkapont (a szerencses
      talalat erteke csak a munkaponttol fugg);
    - termek sora (ing): Gyujtogeto - a legtobb termek;
    - a Tavolsag mellett (villam): Gyorsszett - a leggyorsabb ruha az uthoz,
      mentett szettbol egy keressel, ha van eleg gyors.
    Zart (lakatos) munkanal a felirat fole kerul, hany munkapont hianyzik, es
    Munkapont / Tapasztalat / Gyujtogeto gomb. Az erod, a varos es a
    kuldetesado ablakanak fejleceben villam gomb.

    MERT TENYEK, AMIKRE EPUL

    - Egy darab munkapontja: item.getValue(skills) es a munkara szolo resz
      (BonusExtractor.getWorkPointAddition), egy szette ItemSet.getSetValue.
      munkapont(uj ruha) = munkapont(most) - ruha(most) + ruha(uj).
    - A termekesely- es a tapasztalat-bonusz: BonusExtractor.getExportValue
      (drop, experience); a szett drop-jat a getMergedBonus kihagyja, ezert a
      getMergedStages fokozataibol adjuk ossze.
    - Elvegezhetoseg (west.job.Job.prototype.canDo): a karakter szintje eleri
      a munka szintjet, VAGY a munkapont eleri a nehezseget (malus + 1).
    - A munka fokozata (csakanyok, JobCalculator) a munkapontbol es a
      nehezsegbol jon. A termekesely es a tapasztalat a fokozattal no: bronz k
      csillagnal (k+1)/6,25 resz, bronz 5-tol teljes, a teli arany 5 a termekre
      meg x1,5. Merve harom karakteren, bronz 0-tol arany 5-ig.
    - A premium es az osztalybonusz allando szorzo, a ruha valasztasan nem
      valtoztat.
    - A JobsModel.Beans munkapontja ruhacsere utan egy lepessel le van maradva,
      ezert a friss erteket a calcJobPoints adja.
    - A munkaablak oszlopait a jatek ruhacsere utan ujrarajzolja, ezert a gombok
      a tartalompanelbe kerulnek, nem az oszlopokba.
*/

(function ()
{
    'use strict';

    var NEV = 'Munkaruha-választó';
    var VERZIO = '1.0.4';
    var TESZT = false;

    var WEBOLDAL = 'https://kiszamolja.github.io/the-west-kalkulator-inventorymanaged/';

    // FRISSITES, a Kalandsegito es a Kereskedopult mintajara. A fajlnev allando,
    // verzio nelkul: a GitHub Pages-en mindig ugyanaz a fajl frissul. A felulet
    // a jatek sajat ablaka, naponta legfeljebb egyszer. A script @grant none
    // modban fut, ezert sima fetch es localStorage (nincs GM_*).
    var FRISS_URL = WEBOLDAL + 'the-west-munkaruha.user.js';
    var FRISS_IDOKOZ = 6 * 60 * 60 * 1000;
    var FRISS_NAP_KULCS = 'smcz-munkaruha-frissites-nap';
    // A TESZT-epito true-ra allitja: a konzolban smczMunkaruhaFrissProba() mutatja
    // az ablakot, kulso keres nelkul. Kiadasban false.
    var FRISS_PROBA = false;
    // A KIADAS VALTOZASAI. Ezt olvassa ki a MAR TELEPITETT regi valtozat a
    // letoltott uj fajlbol. Minden eles kiadas elott jovahagyott sorok. Legfeljebb 3-5 rovid sor, JSON-kent olvassuk (dupla idezojel,
    // visszaper nelkul). A ket jelolo sor nem valtozhat.
    /* VALTOZASOK KEZDETE */
    var VALTOZASOK = [
        "Jav\u00edtva: ha egy m\u00e1sik script hib\u00e1t dob \u00f6lt\u00f6z\u00e9s k\u00f6zben, a karakter \u00e9s a munkaablak akkor is friss\u00fcl"
    ];
    /* VALTOZASOK VEGE */

    // Szunet a slotonkenti keresek kozott, ezredmasodpercben, veletlen szorassal.
    var SLOT_SZUNET_MIN = 120;
    var SLOT_SZUNET_SZORAS = 200;
    // A kereso egy allapotban legfeljebb ennyi reszeredmenyt tart meg.
    var FRONT_MAX = 400;
    // Egy szett darabszam-kombinacioinak felso hatara.
    var KOMBO_MAX = 3000;
    // Milyen surun nezzuk a nyitott munkaablakokat, ezredmasodpercben.
    var FIGYELES_IDOKOZ = 600;

    var OSZTALY = 'smcz-mrv';
    var IKONLAP = 'https://westhu.innogamescdn.com/images/tw2gui/iconset.png?15';

    // A munkaablak ruhacsere utan 2000 ms mulva kerdezi le ujra a szervert (nativ
    // checkWearChanged). Ha a friss munkapontot nem a calcJobPoints adja, hanem a
    // csillagsav, ennyit varunk az utolso ruhacsere utan.
    var FRISSULES_VARAS = 3000;

    var allapot = {
        dolgozik: false,
        utolsoRuhacsere: 0,
        // a "mentsd el" tipp: 'most' az elso darabonkenti gyors oltozeskor, utana 'volt'
        gyorsTipp: null,
        alvasTipp: null,
        // a "mentsd el" tipp a Tapasztalat es a Gyujtogeto gombnal (t23), egyszer
        munkaTipp: null,
        // t23: a kovetkezo munkagomb-szamitas ne nezze a mentett szetteket (elavult szett utan)
        mentettNelkul: false,
        // TESZT: az uj ablakok osztalyanak kiirasa, alapbol kikapcsolva
        ablakNaplo: false
    };

    function naplo(szoveg, adat)
    {
        if (typeof adat === 'undefined') console.log('[' + NEV + '] ' + szoveg);
        else console.log('[' + NEV + '] ' + szoveg, adat);
    }

    function hiba(e, hol)
    {
        console.error('[' + NEV + '] hiba itt: ' + hol, e);
    }

    function uzenet(szoveg, hibaE)
    {
        try
        {
            new UserMessage(szoveg, hibaE ? UserMessage.TYPE_ERROR : UserMessage.TYPE_HINT).show();
        }
        catch (e)
        {
            naplo(szoveg);
        }
    }

    function kerekit(x)
    {
        return Math.round(x * 10000) / 10000;
    }

    /* ================================================================== */
    /* Ertekeles                                                           */
    /* ================================================================== */

    // Merve: a JobsModel.Beans neha ures (0 elem), a JobList viszont ott van.
    // (Hogy a Beans mitol telik meg, nem mertuk.) A nehezseg a malus + 1 (harom munkan ellenorizve:
    // Marhahajtas 39, Aranyasok kifosztasa 2761, Antilopvadaszat 2801).
    // Merve (west.job.Job.prototype.canDo): egy munka elvegezheto, ha
    //   Character.level >= munka.level  VAGY  munka.malus < calcJobPoints().
    // A bevezeto kuldetessor alatt csak a szint szamit. Vagyis a munkapont-hatar
    // csak akkor szamit, ha a karakter meg nem erte el a munka szintjet.
    // Merve: Katonai korhaz epitese (szint 104) 131-es karakterrel -690 munkaponttal
    // is elvegezheto; Munkavallalas regeszkent (szint 215) a hatar alatt minden
    // tovabbi carry-t elutasit a szerver.
    function munkapontKell(szint)
    {
        if (typeof szint !== 'number' || typeof Character === 'undefined') return true;
        return Character.level < szint;
    }

    // A munka fokozata (csakanyok) a jatek JobCalculator-a szerint (merve, 2026-10-01):
    // lepcso = nehezseg / 5 felfele kerekitve, tobblet = munkapont - nehezseg.
    // Bronz, ha a tobblet kisebb, mint lepcso + 1 (csillag = munkapont / lepcso);
    // kulonben tobblet / lepcso csillag: 1-5 ezust, 6-10 arany 1-5, folotte arany 5.
    function fokozat(mp, nehezseg)
    {
        var lepcso = Math.ceil(nehezseg / 5) || 1;
        var tobblet = mp - nehezseg;
        if (mp <= 5 || tobblet - lepcso < 1) return {
            szin: 'bronz',
            csillag: Math.max(0, Math.floor(mp / lepcso)),
            lepcso: lepcso
        };
        var c = Math.floor(tobblet / lepcso);
        if (c <= 5) return {
            szin: 'ezüst',
            csillag: c,
            lepcso: lepcso
        };
        return {
            szin: 'arany',
            csillag: c > 10 ? 5 : c - 5,
            lepcso: lepcso
        };
    }

    function fokozatSzoveg(f)
    {
        return f.szin + ' ' + Math.min(f.csillag, 5);
    }

    // Merve 18 munkan (alapertek / termek alapesely / 6, a jatek felfele kerekit):
    // bronz k csillag (k+1)/6,25, bronz 5-tol, ezustben es aranyban teljes;
    // a teli arany 5 meg x1,5.
    function termekResz(f)
    {
        var r = f.szin === 'bronz' && f.csillag < 5 ? (f.csillag + 1) / 6.25 : 1;
        if (f.szin === 'arany' && f.csillag >= 5) r *= 1.5;
        return r;
    }

    // Merve 16 munkan (1 oras tapasztalat / alap tapasztalat): bronz k csillag (k+1),
    // bronz 5-tol 6,25 es ott megall (ezust, arany, arany 5 sem ad tobbet).
    function tapasztalatResz(f)
    {
        return f.szin === 'bronz' && f.csillag < 5 ? (f.csillag + 1) / 6.25 : 1;
    }

    // A gomb celja: a fokozat resze szor (1 + a ruha bonusza).
    function pontszam(cel, mp, nehezseg, bonusz)
    {
        var f = fokozat(mp, nehezseg);
        return (cel === 'drop' ? termekResz(f) : tapasztalatResz(f)) * (1 + bonusz);
    }

    // Ennyi munkapont felett a fokozat mar nem ad tobbet.
    function teljesFokozatMp(cel, nehezseg)
    {
        var lepcso = Math.ceil(nehezseg / 5) || 1;
        return cel === 'drop' ? nehezseg + 10 * lepcso : 5 * lepcso;
    }

    function jobAdat(jobId)
    {
        var j = JobList.getJobById(jobId);
        if (!j || !j.skills || typeof j.malus !== 'number') return null;
        var b = typeof JobsModel !== 'undefined' && JobsModel.Beans ? JobsModel.Beans[jobId] : null;
        return {
            id: jobId,
            skills: j.skills,
            nehezseg: j.malus + 1,
            szint: j.level,
            mpKell: munkapontKell(j.level),
            nev: j.name,
            beansMp: b ? b.jobpoints : undefined
        };
    }

    // Egy darab: munkapont, termekesely, szerencse.
    function darabErtek(darab, skills, jobId)
    {
        var lp = darab.getValue(skills) || 0;
        var drop = 0;
        var luck = 0;
        var exp = 0;
        var lista = (darab.bonus && darab.bonus.item) || [];
        if (lista.length)
        {
            var ex = new west.item.BonusExtractor(Character, darab.getItemLevel());
            for (var i = 0; i < lista.length; i++)
            {
                lp += ex.getWorkPointAddition(lista[i], jobId) - ex.getWorkPointAddition(lista[i], -1);
                var e = ex.getExportValue(lista[i]);
                if (e.key === 'drop') drop += e.value;
                if (e.key === 'luck') luck += e.value;
                if (e.key === 'experience') exp += e.value;
            }
        }
        return {
            lp: lp,
            drop: kerekit(drop),
            luck: kerekit(luck),
            exp: kerekit(exp)
        };
    }

    // Egy szett bonusza az adott darabokkal.
    function szettErtek(kulcs, idk, skills, jobId)
    {
        var ki = {
            lp: 0,
            drop: 0,
            luck: 0,
            exp: 0
        };
        var leiro = west.storage.ItemSetManager.get(kulcs);
        if (!leiro) return ki;
        var szett = new west.item.ItemSet(
        {
            key: kulcs,
            items: idk,
            bonus: leiro.bonus
        });
        ki.lp = szett.getSetValue(skills, jobId) || 0;
        var fokok = szett.getMergedStages() || [];
        var ex = new west.item.BonusExtractor(Character);
        for (var i = 0; i < fokok.length; i++)
        {
            var e = ex.getExportValue(fokok[i]);
            if (e.key === 'drop') ki.drop += e.value;
            if (e.key === 'luck') ki.luck += e.value;
            if (e.key === 'experience') ki.exp += e.value;
        }
        ki.drop = kerekit(ki.drop);
        ki.luck = kerekit(ki.luck);
        ki.exp = kerekit(ki.exp);
        return ki;
    }

    // Egy teljes osszeallitas pontos erteke, szettbonuszokkal.
    function pontosErtek(idk, skills, jobId)
    {
        var ki = {
            lp: 0,
            drop: 0,
            luck: 0,
            exp: 0
        };
        var szettek = {};
        for (var i = 0; i < idk.length; i++)
        {
            var d = ItemManager.get(idk[i]);
            if (!d) continue;
            var e = darabErtek(d, skills, jobId);
            ki.lp += e.lp;
            ki.drop += e.drop;
            ki.luck += e.luck;
            ki.exp += e.exp;
            if (d.set) (szettek[d.set] = szettek[d.set] || []).push(idk[i]);
        }
        for (var k in szettek)
        {
            var s = szettErtek(k, szettek[k], skills, jobId);
            ki.lp += s.lp;
            ki.drop += s.drop;
            ki.luck += s.luck;
            ki.exp += s.exp;
        }
        ki.drop = kerekit(ki.drop);
        ki.luck = kerekit(ki.luck);
        ki.exp = kerekit(ki.exp);
        return ki;
    }

    function rajtamIdk()
    {
        var ki = [];
        for (var i = 0; i < Wear.slots.length; i++)
        {
            var w = Wear.wear[Wear.slots[i]];
            if (w) ki.push(w.getId());
        }
        return ki;
    }

    // A csillagsav szovege ("N kepessegpontot adsz hozza."), ruhacsere utan 2 mp-ig regi.
    function csillagsav(ab)
    {
        var sav = ab && ab.querySelector('.job_starprogressbar');
        var cim = sav ? (sav.getAttribute('title') || '') : '';
        var m = cim.match(/(-?\d+)/);
        return m ? parseInt(m[1], 10) : null;
    }

    function friss(jobId)
    {
        var j = JobList.getJobById(jobId);
        return !!(j && typeof j.calcJobPoints === 'function');
    }

    // A friss munkapont. Merve: a JobList calcJobPoints() ruhacsere utan azonnal az uj
    // erteket adja, egyebkent egyezik a csillagsavval (nyitott es zart ablakban is).
    // Tartalek: a csillagsav, vegul a Beans.
    function ablakMunkapont(ab, job)
    {
        try
        {
            var j = JobList.getJobById(job.id);
            if (j && typeof j.calcJobPoints === 'function')
            {
                var v = j.calcJobPoints();
                if (typeof v === 'number' && !isNaN(v)) return {
                    ertek: v,
                    forras: 'calcJobPoints'
                };
            }
        }
        catch (e)
        {
            hiba(e, 'calcJobPoints');
        }
        var c = csillagsav(ab);
        if (c !== null) return {
            ertek: c,
            forras: 'munkaablak'
        };
        if (typeof job.beansMp === 'number') return {
            ertek: job.beansMp,
            forras: 'Beans (lehet, hogy regi)'
        };
        return null;
    }

    /* ================================================================== */
    /* Jeloltek                                                            */
    /* ================================================================== */

    // Alapazonositonkent a legmagasabb szintu viselheto darab, a viseltekkel egyutt.
    function elerhetoDarabok()
    {
        var alaponkent = {};
        var alapok = Bag.getItemsIdsByBaseItemIds();
        for (var b in alapok)
        {
            var idk = alapok[b];
            for (var i = 0; i < idk.length; i++)
            {
                var o = ItemManager.get(idk[i]);
                if (!o || Wear.slots.indexOf(o.type) === -1) continue;
                if (typeof o.wearable === 'function' && !o.wearable()) continue;
                if (!alaponkent[b] || o.getItemLevel() > alaponkent[b].getItemLevel()) alaponkent[b] = o;
            }
        }
        for (var j = 0; j < Wear.slots.length; j++)
        {
            var w = Wear.wear[Wear.slots[j]];
            if (!w) continue;
            var r = ItemManager.get(w.getId());
            if (!r) continue;
            var ab = r.getItemBaseId();
            if (!alaponkent[ab] || r.getItemLevel() >= alaponkent[ab].getItemLevel()) alaponkent[ab] = r;
        }
        var ki = [];
        for (var k in alaponkent) ki.push(alaponkent[k]);
        return ki;
    }

    function kombinaciok(tomb, db)
    {
        if (db > tomb.length || db <= 0) return [];
        if (db === tomb.length) return [tomb];
        if (db === 1) return tomb.map(function (x)
        {
            return [x];
        });
        var ki = [];
        for (var j = 0; j < tomb.length - db + 1; j++)
        {
            var tobbi = kombinaciok(tomb.slice(j + 1), db - 1);
            for (var k = 0; k < tobbi.length; k++) ki.push([tomb[j]].concat(tobbi[k]));
        }
        return ki;
    }

    function binom(n, k)
    {
        var r = 1;
        for (var i = 1; i <= k; i++) r = r * (n - k + i) / i;
        return r;
    }

    // Egyes darabok slotonkent, es szettblokkok (a szettbonuszhoz szukseges darabszamokkal).
    function adatEpites(job, cel)
    {
        var slotIndex = {};
        Wear.slots.forEach(function (s, i)
        {
            slotIndex[s] = i;
        });
        var egyes = Wear.slots.map(function ()
        {
            return [];
        });
        var szettDarabok = {};
        var viselt = {};
        rajtamIdk().forEach(function (id)
        {
            viselt[id] = true;
        });

        elerhetoDarabok().forEach(function (o)
        {
            var e = darabErtek(o, job.skills, job.id);
            var j = {
                idk: [o.getId()],
                mask: 1 << slotIndex[o.type],
                lp: e.lp,
                cel: e[cel],
                szett: o.set || null,
                blokk: false,
                rajta: !!viselt[o.getId()]
            };
            egyes[slotIndex[o.type]].push(j);
            if (o.set) (szettDarabok[o.set] = szettDarabok[o.set] || []).push(j);
        });

        var blokkok = [];
        for (var kulcs in szettDarabok)
        {
            var lista = szettDarabok[kulcs];
            if (lista.length < 2) continue;
            var leiro = west.storage.ItemSetManager.get(kulcs);
            if (!leiro || !leiro.bonus) continue;
            var szamok = Object.keys(leiro.bonus).map(Number).filter(function (n)
            {
                return n >= 2 && n <= lista.length;
            });
            for (var s = 0; s < szamok.length; s++)
            {
                var n = szamok[s];
                var forras = lista;
                if (binom(forras.length, n) > KOMBO_MAX)
                {
                    forras = lista.slice(0).sort(function (a, b)
                    {
                        return (b.cel - a.cel) || (b.lp - a.lp);
                    }).slice(0, Math.max(n, 10));
                }
                var kombok = kombinaciok(forras, n);
                for (var q = 0; q < kombok.length; q++)
                {
                    var k = kombok[q];
                    var mask = 0;
                    var utkozik = false;
                    var lp = 0;
                    var celOssz = 0;
                    var idk = [];
                    for (var z = 0; z < k.length; z++)
                    {
                        if (mask & k[z].mask) utkozik = true;
                        mask |= k[z].mask;
                        lp += k[z].lp;
                        celOssz += k[z].cel;
                        idk.push(k[z].idk[0]);
                    }
                    if (utkozik) continue;
                    var sz = szettErtek(kulcs, idk, job.skills, job.id);
                    blokkok.push(
                    {
                        idk: idk,
                        mask: mask,
                        lp: lp + sz.lp,
                        cel: kerekit(celOssz + sz[cel]),
                        szett: kulcs,
                        blokk: true
                    });
                }
            }
        }
        return {
            egyes: egyes,
            blokkok: blokkok
        };
    }

    /* SZURES-KEZDET */
    // A kereso elott kidobja a bizonyithatoan felesleges jelolteket (t22). Csak azt,
    // amit ugyanazokon a helyeken mas jeloltek munkapontban ES celban is legalabb
    // ugyanugy kivaltanak, igy a kereso legjobb eredmenye nem valtozhat. A pontszam
    // mindkettoben no (soha nem csokken), ezert ez a jatek pontszamara is igaz.
    // Szettdarabot egyedul soha nem dob ki (a szettbonusz miatt kesobb jo lehet).

    // A nem megvert pontok: munkapont szerint csokkeno, a cel szigoruan novekvo.
    function paretoSzur(lista)
    {
        var r = lista.slice(0).sort(function (a, b)
        {
            return (b.lp - a.lp) || (b.cel - a.cel);
        });
        var ki = [];
        var legCel = -Infinity;
        for (var i = 0; i < r.length; i++)
        {
            if (r[i].cel > legCel)
            {
                ki.push(r[i]);
                legCel = r[i].cel;
            }
        }
        return ki;
    }

    // Egyes darabok: a szett nelkulit kidobja, ha ugyanarra a helyre van mas darab,
    // ami munkapontban es celban is legalabb annyit ad. Pontos egyezesnel egy marad:
    // a rajta levo, kulonben az elobbi.
    function szuresEgyes(egyes)
    {
        return egyes.map(function (lista)
        {
            return lista.filter(function (x, i)
            {
                if (x.szett) return true;
                for (var j = 0; j < lista.length; j++)
                {
                    if (j === i) continue;
                    var y = lista[j];
                    if (y.lp < x.lp || y.cel < x.cel) continue;
                    if (y.lp > x.lp || y.cel > x.cel) return false;
                    if (x.rajta) continue;
                    if (y.rajta || j < i) return false;
                }
                return true;
            });
        });
    }

    // Szettblokk: kidobja, ha ugyanazokon a helyeken egyes darabokbol (vagy ures
    // hellyel) kirakhato legalabb ugyanannyi munkapont es cel.
    function szuresBlokkok(slotSzam, egyes, blokkok)
    {
        var helyFront = [];
        for (var s = 0; s < slotSzam; s++) helyFront.push(paretoSzur((egyes[s] || []).concat([
        {
            lp: 0,
            cel: 0
        }])));
        var tar = {};

        function maszkFront(mask)
        {
            if (tar[mask]) return tar[mask];
            var f = [
            {
                lp: 0,
                cel: 0
            }];
            for (var h = 0; h < slotSzam; h++)
            {
                if (!(mask & (1 << h))) continue;
                var uj = [];
                for (var a = 0; a < f.length; a++)
                {
                    for (var b = 0; b < helyFront[h].length; b++)
                    {
                        uj.push(
                        {
                            lp: f[a].lp + helyFront[h][b].lp,
                            cel: f[a].cel + helyFront[h][b].cel
                        });
                    }
                }
                f = paretoSzur(uj);
            }
            tar[mask] = f;
            return f;
        }
        return blokkok.filter(function (bl)
        {
            var f = maszkFront(bl.mask);
            for (var i = 0; i < f.length; i++)
            {
                if (f[i].lp >= bl.lp && f[i].cel >= bl.cel - 1e-9) return false;
            }
            return true;
        });
    }

    function szures(slotSzam, adat)
    {
        var egyes = szuresEgyes(adat.egyes);
        return {
            egyes: egyes,
            blokkok: szuresBlokkok(slotSzam, egyes, adat.blokkok)
        };
    }
    /* SZURES-VEGE */

    /* OPT-KEZDET */
    // A kereso. Slotonkent halad, minden reszallapotban csak a nem megvert
    // (munkapont, cel) parokat tartja meg. A munkapontot a szukseges mennyisegnel
    // levagja, mert afolott mar csak a cel szamit. Egy szettbol legfeljebb egy blokk.
    function optimalizal(slotSzam, egyes, blokkok, kell, frontMax)
    {
        var TELJES = (1 << slotSzam) - 1;
        var frontok = new Array(TELJES + 1);
        frontok[0] = [
        {
            lp: 0,
            cel: 0,
            idk: [],
            szettek: '|'
        }];

        var alsoBlokk = [];
        for (var i = 0; i < slotSzam; i++) alsoBlokk.push([]);
        for (var b = 0; b < blokkok.length; b++)
        {
            var also = 0;
            while (!(blokkok[b].mask & (1 << also))) also++;
            alsoBlokk[also].push(blokkok[b]);
        }

        function kapott(lp)
        {
            return lp < kell ? lp : kell;
        }

        // Csak azonos szetthasznalatu reszeredmenyek verhetik meg egymast.
        function nyes(lista)
        {
            lista.sort(function (a, b)
            {
                return (b.cel - a.cel) || (kapott(b.lp) - kapott(a.lp));
            });
            var ki = [];
            var legjobbLp = {};
            for (var i = 0; i < lista.length; i++)
            {
                var k = kapott(lista[i].lp);
                var sz = lista[i].szettek;
                if (!(sz in legjobbLp) || k > legjobbLp[sz])
                {
                    ki.push(lista[i]);
                    legjobbLp[sz] = k;
                }
            }
            if (ki.length > frontMax) ki = ritkit(ki);
            return ki;
        }

        // Ritkitas: eloszor a szetthasznalattol fuggetlenul meg nem vert elemek
        // (igy a legtobb munkapontot ado is biztosan marad), a maradek helyre a tobbi.
        function ritkit(ki)
        {
            var alap = [];
            var tobbi = [];
            var legjobb = -Infinity;
            for (var i = 0; i < ki.length; i++)
            {
                var k = kapott(ki[i].lp);
                if (k > legjobb)
                {
                    alap.push(ki[i]);
                    legjobb = k;
                }
                else tobbi.push(ki[i]);
            }
            if (alap.length > frontMax)
            {
                var r = [];
                var lepes = (alap.length - 1) / (frontMax - 1);
                for (var j = 0; j < frontMax; j++) r.push(alap[Math.round(j * lepes)]);
                return r;
            }
            return alap.concat(tobbi.slice(0, frontMax - alap.length));
        }

        // Egyes darabok: ami slotjaban mindket szamban meg van verve, sosem jobb valasztas.
        egyes = egyes.map(function (lista)
        {
            var rendezett = lista.slice(0).sort(function (a, b)
            {
                return (b.cel - a.cel) || (kapott(b.lp) - kapott(a.lp));
            });
            var ki = [];
            var legjobb = -Infinity;
            for (var i = 0; i < rendezett.length; i++)
            {
                if (kapott(rendezett[i].lp) > legjobb)
                {
                    ki.push(rendezett[i]);
                    legjobb = kapott(rendezett[i].lp);
                }
            }
            return ki;
        });

        function tovabb(uj, forrasok, elem)
        {
            var cel = frontok[uj] || (frontok[uj] = []);
            for (var i = 0; i < forrasok.length; i++)
            {
                var x = forrasok[i];
                if (!elem)
                {
                    cel.push(x);
                    continue;
                }
                if (elem.blokk && x.szettek.indexOf('|' + elem.szett + '|') !== -1) continue;
                cel.push(
                {
                    lp: x.lp + elem.lp,
                    cel: Math.round((x.cel + elem.cel) * 10000) / 10000,
                    idk: x.idk.concat(elem.idk),
                    szettek: elem.blokk ? x.szettek + elem.szett + '|' : x.szettek
                });
            }
            if (cel.length > frontMax * 8) frontok[uj] = nyes(cel);
        }

        for (var mask = 0; mask < TELJES; mask++)
        {
            if (!frontok[mask]) continue;
            var f = nyes(frontok[mask]);
            frontok[mask] = null;
            var s = 0;
            while (mask & (1 << s)) s++;
            var bit = 1 << s;
            tovabb(mask | bit, f, null);
            for (var c = 0; c < egyes[s].length; c++) tovabb(mask | bit, f, egyes[s][c]);
            for (var d = 0; d < alsoBlokk[s].length; d++)
            {
                if (alsoBlokk[s][d].mask & mask) continue;
                tovabb(mask | alsoBlokk[s][d].mask, f, alsoBlokk[s][d]);
            }
        }
        return frontok[TELJES] ? nyes(frontok[TELJES]) : [];
    }
    /* OPT-VEGE */

    // A kivalasztott darabok mellett a kihagyott slotokban maradnak a viseltek.
    function teljesOsszeallitas(idk)
    {
        var slotok = {};
        for (var i = 0; i < idk.length; i++)
        {
            var d = ItemManager.get(idk[i]);
            if (d) slotok[d.type] = idk[i];
        }
        for (var j = 0; j < Wear.slots.length; j++)
        {
            var s = Wear.slots[j];
            if (!slotok[s] && Wear.wear[s]) slotok[s] = Wear.wear[s].getId();
        }
        var ki = [];
        for (var k in slotok) ki.push(slotok[k]);
        return ki;
    }

    // A legjobb ruha a gomb celjara: a legnagyobb fokozat-resz x (1 + bonusz).
    // A munkapont a fokozaton at szamit (merve), ezert a kereso a teljes fokozatig
    // figyeli. Ha a karakter meg nem erte el a munka szintjet, a munkapont a
    // nehezseget is el kell erje (canDo). Dontetlennel a tobb munkapont nyer.
    function celSzett(job, alap, cel)
    {
        var kezdes = Date.now();
        var adat = adatEpites(job, cel);
        var adatKesz = Date.now();
        var celMp = teljesFokozatMp(cel, job.nehezseg);
        if (job.mpKell) celMp = Math.max(celMp, job.nehezseg);
        var kell = Math.max(0, celMp - alap);
        var szurt = szures(Wear.slots.length, adat);
        var szuresKesz = Date.now();
        var front = optimalizal(Wear.slots.length, szurt.egyes, szurt.blokkok, kell, FRONT_MAX);
        var keresesKesz = Date.now();

        // Biztonsagi halo: a kereso eredmenyei melle a mostani ruha es a nativ
        // Munkaruhazat ruhaja is jelolt.
        var tobbi = [rajtamIdk()];
        try
        {
            var nativ = west.item.Calculator.getBestSet(job.skills, job.id);
            if (nativ && nativ.getItems) tobbi.push(nativ.getItems());
        }
        catch (e)
        {
            hiba(e, 'nativ getBestSet');
        }

        var most = {};
        rajtamIdk().forEach(function (id)
        {
            most[id] = true;
        });

        // A legjobb pontszam nyer. Egyenlo pontszamnal a kevesebb cserevel jaro
        // (a mostani ruha 0 csere, igy az marad), utana a tobb munkapont (t22;
        // elotte egyenlo pontszamnal a tobb munkapont nyert, es feleslegesen cserelt).
        function valaszt(front)
        {
            var jeloltek = front.map(function (f)
            {
                return f.idk;
            }).concat(tobbi);
            var legjobb = null;
            for (var i = 0; i < jeloltek.length; i++)
            {
                var idk = teljesOsszeallitas(jeloltek[i]);
                var e = pontosErtek(idk, job.skills, job.id);
                if (job.mpKell && alap + e.lp < job.nehezseg) continue;
                var p = kerekit(pontszam(cel, alap + e.lp, job.nehezseg, e[cel]));
                var csere = 0;
                for (var c = 0; c < idk.length; c++)
                {
                    if (!most[idk[c]]) csere++;
                }
                if (!legjobb || p > legjobb.pont || (p === legjobb.pont && (csere < legjobb.csere ||
                        (csere === legjobb.csere && e.lp > legjobb.ertek.lp))))
                {
                    legjobb = {
                        idk: idk,
                        ertek: e,
                        pont: p,
                        csere: csere,
                        forras: i < front.length ? 'kereso' : (i === front.length ? 'mostani ruha' : 'nativ Munkaruhazat')
                    };
                }
            }
            return legjobb;
        }
        var legjobb = valaszt(front);

        if (TESZT)
        {
            var darab = function (eg)
            {
                return eg.reduce(function (a, l)
                {
                    return a + l.length;
                }, 0);
            };
            naplo('kereses: ' + darab(adat.egyes) + ' darab, ' + adat.blokkok.length + ' szettblokk; szures utan ' +
                darab(szurt.egyes) + ' darab, ' + szurt.blokkok.length + ' szettblokk; vegso front ' + front.length +
                ', adat ' + (adatKesz - kezdes) + ' ms, szures ' + (szuresKesz - adatKesz) + ' ms, kereses ' +
                (keresesKesz - szuresKesz) + ' ms, teljes fokozat ' + celMp + ' munkapontnal (meg ' + kell + ')' +
                (job.mpKell ? ', a nehezseg is feltetel' : '') + ', gyoztes: ' + (legjobb ? legjobb.forras + ', ' +
                fokozatSzoveg(fokozat(alap + legjobb.ertek.lp, job.nehezseg)) + ', pontszam ' + legjobb.pont +
                ', csere ' + legjobb.csere : 'nincs'));
            // Kettos futas: a szures nelkuli kereso is lefut, es a pontszamuknak egyeznie kell.
            try
            {
                var t0 = Date.now();
                var regiFront = optimalizal(Wear.slots.length, adat.egyes, adat.blokkok, kell, FRONT_MAX);
                var regi = valaszt(regiFront);
                var rp = regi ? regi.pont : null;
                var up = legjobb ? legjobb.pont : null;
                if (rp !== up) naplo('SZURES ELTERES: szurve pontszam ' + up + ', szures nelkul ' + rp +
                    (regi ? ' (' + regi.forras + ')' : ''));
                else naplo('szures ellenorzes: a pontszam egyezik (' + up + '), szures nelkul a kereses ' +
                    (Date.now() - t0) + ' ms');
            }
            catch (e)
            {
                hiba(e, 'szures ellenorzes');
            }
        }
        return legjobb;
    }

    /* ================================================================== */
    /* Gyorsszett szamitas (a Munka gyorsszett 0.5.6 Szamito-ja, szo szerint) */
    /* ================================================================== */

    function Szamito(opciok)
    {
        this.opciok = {
            skills: {},
            sort: null,
            weapon: null,
            side: 'attack',
            level: Character.level,
            wearable: true
        };
        for (var k in (opciok || {})) this.opciok[k] = opciok[k];
        this.memo = {};
    }

    // Alap azonosito-e, vagy fejlesztett darab azonositoja.
    Szamito.prototype.alapAzonosito = function (id)
    {
        var veg = id.toString().substr(-3);
        for (var i = 0; i <= 5; i++)
        {
            var minta = ('000' + (i || 0).toString()).slice(-3);
            if (veg.match(minta)) return false;
        }
        return true;
    };

    // Egy bonusz-leiro objektum kulcsa es erteke.
    Szamito.prototype.bonuszErtek = function (leiro, darabSzint, szint)
    {
        szint = szint || (this.opciok.level ? this.opciok.level : Character.level);
        var kivon = new west.item.BonusExtractor(
        {
            level: szint
        }, darabSzint);
        var ertek;
        var elem = leiro;

        if (elem.type === 'character')
        {
            ertek = kivon.getCharacterItemValue(elem);
            elem = elem.bonus;
            if (elem.type in kivon.keyDescMapping) ertek = Math.round(100 * ertek);
        }
        else if (elem.type in kivon.keyDescMapping)
        {
            ertek = kivon.getValue(elem);
            ertek = Math.round(100 * ertek);
        }
        else
        {
            ertek = kivon.getValue(elem);
        }

        var kulcs;
        switch (elem.type)
        {
            case 'skill':
            case 'attribute':
                kulcs = elem.name;
                break;
            case 'fortbattle':
                kulcs = 'fort_' + elem.name + (elem.isSector ? '_sector' : '');
                break;
            case 'job':
                kulcs = elem.type + (elem.job && elem.job === 'all' ? '' : '_' + elem.job);
                break;
            default:
                kulcs = elem.type;
        }

        return {
            key: kulcs,
            value: ertek
        };
    };

    // Egy darab osszes bonusza kulcs-ertek terkepkent.
    Szamito.prototype.darabBonusz = function (darab, kepessegre, szint)
    {
        szint = szint || (this.opciok.level ? this.opciok.level : Character.level);

        var kulcs = darab.short + '_' + darab.getItemLevel() + '_' + szint + '_' +
            JSON.stringify(this.opciok) + '_' + kepessegre;
        if (this.memo[kulcs]) return this.memo[kulcs];

        var kivon = new west.item.BonusExtractor(
        {
            level: szint
        }, darab.getItemLevel());
        var ki = {};
        var opciok = this.opciok;

        function hozzaad(k, v)
        {
            if (k === 'damage') return;
            ki[k] = ki[k] || 0;
            ki[k] += v;
        }

        function kepessegVagyAttributum(k, csakAttributum)
        {
            if (CharacterSkills.allAttrKeys.includes(k)) return true;
            return !csakAttributum && CharacterSkills.allSkillKeys.includes(k);
        }

        function darabszam(o)
        {
            return o && Object.keys ? Object.keys(o).length : 0;
        }

        // A lo sebessege: minel kisebb a speed, annal gyorsabb.
        if (darab.speed) hozzaad('ms', Math.round(1 / darab.speed * 100 - 100));

        if (darab instanceof west.item.Weapon)
        {
            hozzaad(darab.type + '_damage_min', darab.getDamage(
            {
                level: szint
            }).min);
            hozzaad(darab.type + '_damage_max', darab.getDamage(
            {
                level: szint
            }).max);
        }

        if (typeof darab.bonus.attributes === 'object' && darabszam(darab.bonus.attributes) > 0)
        {
            for (var a in darab.bonus.attributes)
            {
                if (kepessegre && darab.bonus.attributes[a])
                {
                    if (typeof opciok.skills === 'object' && a in opciok.skills)
                    {
                        hozzaad(a, darab.bonus.attributes[a]);
                    }
                    var kulcsok = CharacterSkills.getSkillKeys4Attribute(a);
                    for (var c = 0; c < kulcsok.length; c++) hozzaad(kulcsok[c], darab.bonus.attributes[a]);
                }
                else if (!kepessegre && darab.bonus.attributes[a])
                {
                    hozzaad(a, darab.bonus.attributes[a]);
                }
            }
        }

        if (typeof darab.bonus.skills === 'object' && darabszam(darab.bonus.skills) > 0)
        {
            for (var s in darab.bonus.skills)
            {
                if (darab.bonus.skills[s]) hozzaad(s, darab.bonus.skills[s]);
            }
        }

        if (darab.bonus.item.length)
        {
            for (var i = 0; i < darab.bonus.item.length; i++)
            {
                var erintett = kivon.getAffectedSkills(darab.bonus.item[i]);
                var kulon = this.bonuszErtek(darab.bonus.item[i], darab.getItemLevel(), szint);
                if (kepessegre)
                {
                    for (var k in erintett) hozzaad(k, erintett[k]);
                }
                var beveszi = !kepessegre || !kepessegVagyAttributum(kulon.key) ||
                    (kepessegre && kepessegVagyAttributum(kulon.key, true) &&
                        typeof opciok.skills === 'object' && kulon.key in opciok.skills);
                if (beveszi) hozzaad(kulon.key, kulon.value);
            }
        }

        // Hasznalati targy, akcio vagy munkabol eso darab nem szamit.
        if (darab.usebonus || darab.action || JobList.dropsItem(darab.item_id)) ki = {};

        this.memo[kulcs] = ki;
        return ki;
    };

    // Egy szett sajat bonusza a mar elert fokozatok alapjan.
    Szamito.prototype.szettBonusz = function (szett, kepessegre, szint)
    {
        szint = szint || (this.opciok.level ? this.opciok.level : Character.level);

        var kivon = new west.item.BonusExtractor(
        {
            level: szint
        });
        var ki = {};
        var fokozatok = szett.getMergedStages();
        var opciok = this.opciok;

        function hozzaad(k, v)
        {
            if (k === 'damage') return;
            ki[k] = ki[k] || 0;
            ki[k] += v;
        }

        function kepessegVagyAttributum(k, csakAttributum)
        {
            if (CharacterSkills.allAttrKeys.includes(k)) return true;
            return !csakAttributum && CharacterSkills.allSkillKeys.includes(k);
        }

        for (var i = 0; i < fokozatok.length; i++)
        {
            var erintett = kivon.getAffectedSkills(fokozatok[i]);
            var kulon = this.bonuszErtek(fokozatok[i], 0, szint);
            if (kepessegre)
            {
                for (var k in erintett) hozzaad(k, erintett[k]);
            }
            var beveszi = !kepessegre || !kepessegVagyAttributum(kulon.key) ||
                (kepessegre && kepessegVagyAttributum(kulon.key, true) &&
                    typeof opciok.skills === 'object' && kulon.key in opciok.skills);
            if (beveszi) hozzaad(kulon.key, kulon.value);
        }

        return ki;
    };

    // Szett bonusza es a benne levo darabok bonuszai egyben.
    Szamito.prototype.szettOsszesen = function (szett, nyersen)
    {
        var ki = this.szettBonusz(szett, true);
        var darabok = szett.items;
        for (var i = 0; i < darabok.length; i++)
        {
            var id = darabok[i] * (this.alapAzonosito(darabok[i]) ? 1000 : 1);
            var b = this.darabBonusz(ItemManager.get(id), true);
            for (var k in b)
            {
                ki[k] = ki[k] || 0;
                ki[k] += b[k];
            }
        }
        return nyersen ? ki : this.keplet(ki);
    };

    // Egy szettkonteener osszes bonusza, darabok es szettek egyutt.
    Szamito.prototype.konteenerBonusz = function (konteener, kepessegre, szint)
    {
        var ki = {};
        var darabok = konteener.getItems();
        for (var i = 0; i < darabok.length; i++)
        {
            var b = this.darabBonusz(ItemManager.get(darabok[i]), kepessegre, szint);
            for (var k in b)
            {
                ki[k] = ki[k] || 0;
                ki[k] += b[k];
            }
        }
        for (var j = 0; j < konteener.sets.length; j++)
        {
            var sz = this.szettBonusz(konteener.sets[j], kepessegre, szint);
            for (var k2 in sz)
            {
                ki[k2] = ki[k2] || 0;
                ki[k2] += sz[k2];
            }
        }
        return ki;
    };

    // A vegso pontszam. Mozgassebessegre: (100 + lovaglas + ms) * (1 + speed / 100).
    Szamito.prototype.keplet = function (bonusz, tipusFelulir)
    {
        var opciok = this.opciok;
        var pont = 0;

        function pontok(k)
        {
            return CharacterSkills.getSkill(k).points;
        }

        function kerekit(szam, tizedes)
        {
            return Math.round(szam * Math.pow(10, tizedes)) / Math.pow(10, tizedes);
        }

        var premium = Premium.hasBonus('character');
        var vezetes = Math.pow(((bonusz.leadership || 0) + pontok('leadership')) *
            (Character.charClass === 'soldier' ? (premium ? 1.5 : 1.25) : 1), 0.5);
        var munkasSzorzo = Character.charClass === 'worker' ? (premium ? 1.4 : 1.2) : 1;
        var munkasPlusz = Character.charClass === 'worker' ? (premium ? 10 : 5) : 0;
        var eletero = ((bonusz.health || 0) + pontok('health')) *
            (Character.charClass === 'soldier' ? (premium ? 20 : 15) : 10) + 10 * opciok.level + 90;
        var eroderSebzes = (bonusz.fort_damage || 0) + (bonusz.fort_damage_sector || 0);
        var kozelharc = ((bonusz.left_arm_damage_min || 0) + (bonusz.left_arm_damage_max || 0)) / 2 + eroderSebzes;
        var rejtozes = opciok.side === 'attack' ?
            (bonusz.hide || 0) + pontok('hide') : (bonusz.pitfall || 0) + pontok('pitfall');
        var vezetesNyers = (bonusz.leadership || 0) + pontok('leadership');
        var celzas = (bonusz.aim || 0) + pontok('aim');
        var kiteres = (bonusz.dodge || 0) + pontok('dodge');
        var kezdoBonusz = 15 * (1 - Character.level / 250) + 10;

        var tipus = tipusFelulir || (typeof opciok.skills === 'string' ? opciok.skills : undefined);

        switch (tipus)
        {
            case 'ms':
                pont += kerekit((100 + (bonusz.ride || 0) + (bonusz.ms || 0) + pontok('ride')) *
                    (1 + (bonusz.speed || 0) / 100), 0);
                if (!bonusz.ride && !bonusz.speed) pont = 0;
                break;
            case 'fort_resistance':
                pont += kerekit(300 * rejtozes / eletero + (bonusz.fort_resistance || 0), 0);
                break;
            case 'fort_offense':
                pont += kerekit((vezetes + Math.pow(celzas, 0.5) + Math.pow(rejtozes, 0.6) +
                    (bonusz.fort_offense || 0) + (bonusz.fort_offense_sector || 0) + kezdoBonusz) * 1.15 * munkasSzorzo, 2);
                break;
            case 'fort_defense':
                pont += kerekit((vezetes + Math.pow(kiteres, 0.5) + Math.pow(rejtozes, 0.6) +
                    (bonusz.fort_defense || 0) + (bonusz.fort_defense_sector || 0) + kezdoBonusz) * munkasSzorzo, 2);
                break;
            case 'fort_damage':
                pont += Math.round(kozelharc + kozelharc * vezetesNyers / eletero);
                break;
            case 'fort_hp':
                pont += eletero || 0;
                break;
            case 'construct':
                pont += Math.floor((3 * ((bonusz.build || 0) + pontok('build')) +
                    (bonusz.repair || 0) + pontok('repair') +
                    (bonusz.leadership || 0) + pontok('leadership')) / 100 * (100 + munkasPlusz)) + (bonusz.job || 0);
                break;
            default:
                if (typeof opciok.skills === 'object')
                {
                    for (var k in opciok.skills)
                    {
                        if (bonusz[k]) pont += opciok.skills[k] * (bonusz[k] || 0);
                    }
                }
        }

        // A ruha nelkuli alapertek levonasa.
        if (!tipusFelulir && typeof opciok.skills === 'string')
        {
            pont -= this.keplet({}, opciok.skills);
        }

        if (isNaN(pont) || pont < 1) pont = 0;
        return pont;
    };

    // Rendezesi ertek: mi szamit elsodlegesen es masodlagosan.
    Szamito.prototype.rendezesiErtek = function (bonusz, szettkent)
    {
        var ki = {};
        var tipus = typeof this.opciok.skills === 'string' ? this.opciok.skills : undefined;
        switch (tipus)
        {
            case 'ms':
                ki.tmp = (bonusz.ride || 0) + (bonusz.ms || 0);
                ki.val = bonusz.speed || 0;
                break;
            case 'fort_resistance':
                ki.tmp = this.keplet(bonusz);
                ki.val = bonusz.fort_resistance || 0;
                break;
            case 'fort_offense':
                ki.tmp = this.keplet(bonusz);
                ki.val = (bonusz.fort_offense || 0) + (bonusz.fort_offense_sector || 0);
                if (szettkent) ki.val = 0;
                break;
            case 'fort_defense':
                ki.tmp = this.keplet(bonusz);
                ki.val = (bonusz.fort_defense || 0) + (bonusz.fort_defense_sector || 0);
                if (szettkent) ki.val = 0;
                break;
            default:
                ki.tmp = this.keplet(bonusz);
                ki.val = 0;
        }
        return ki;
    };

    // Fel tudod-e venni a darabot.
    Szamito.prototype.viselheto = function (darab)
    {
        if (this.opciok.wearable === true)
        {
            if (darab.characterSex && (darab.characterSex !== Character.charSex || Character.charClass === 'greenhorn')) return false;
            if (darab.characterClass && darab.characterClass !== Character.charClass) return false;
            if (darab.duelLevel && darab.duelLevel > Character.duelLevel) return false;
        }
        var kedvezmeny = Character.itemLevelRequirementDecrease;
        var osszes = kedvezmeny.all + (kedvezmeny[darab.type] || 0);
        return !(darab.level && darab.level - osszes > this.opciok.level);
    };

    // Egy szetthez tartozo darabok kozul melyek vannak meg neked.
    Szamito.prototype.elerhetoDarabok = function (alapIdk, mindet)
    {
        var elsok = [];
        var osszes = [];
        for (var i = 0; i < alapIdk.length; i++)
        {
            var idk = Bag.getItemsIdsByBaseItemId(alapIdk[i]);
            if (idk.length)
            {
                var darabok = Bag.getItemsByItemIds(idk);
                for (var j = 0; j < darabok.length; j++)
                {
                    if (mindet || this.viselheto(darabok[j].obj))
                    {
                        if (j === 0) elsok.push(darabok[j].getId());
                        osszes.push(darabok[j].getId());
                    }
                }
            }
            else if (Wear.carries(alapIdk[i]))
            {
                elsok.push(Wear.getByBaseId(alapIdk[i]).getId());
                osszes.push(Wear.getByBaseId(alapIdk[i]).getId());
            }
        }
        return [elsok, osszes];
    };

    // Darablistabol szettek kiemelese.
    Szamito.prototype.darabokbolSzettek = function (eredmeny)
    {
        var szettek = {};
        var darabok = eredmeny.items;
        var maradek = [];

        for (var i = 0; i < darabok.length; i++)
        {
            var o = ItemManager.get(darabok[i]);
            if (o.set)
            {
                if (szettek[o.set])
                {
                    szettek[o.set].items.push(o.getId());
                }
                else
                {
                    var leiro = west.storage.ItemSetManager.get(o.set);
                    szettek[o.set] = new west.item.ItemSet(
                    {
                        key: leiro.key,
                        items: [o.getId()],
                        bonus: leiro.bonus
                    });
                }
            }
            else
            {
                maradek.push(o.getId());
            }
        }

        for (var kulcs in szettek)
        {
            var vanMar = eredmeny.sets.findIndex(function (s)
            {
                return s.key === kulcs;
            });
            if (vanMar === -1) eredmeny.sets.push(szettek[kulcs]);
        }

        eredmeny.items = maradek;
        return eredmeny;
    };

    // A vegleges darablista egy eredmenybol.
    Szamito.prototype.hasznaltDarabok = function (eredmeny, alapIdKent)
    {
        var ki = [];
        if (typeof eredmeny !== 'object') return ki;

        var mind = eredmeny.items.slice(0);
        for (var i = 0; i < eredmeny.sets.length; i++)
        {
            mind.push.apply(mind, eredmeny.sets[i].getItems());
        }

        for (var j = 0; j < mind.length; j++)
        {
            var taskaban = Bag.getItemByItemId(mind[j]);
            if (!taskaban)
            {
                ki.push(alapIdKent ? parseInt(mind[j] / 1000, 10) : mind[j]);
                continue;
            }
            var rajtam = Wear.get(taskaban.getType());
            var rajtamJobb = rajtam &&
                rajtam.getItemBaseId() === taskaban.getItemBaseId() &&
                rajtam.getItemLevel() >= taskaban.getItemLevel();
            var valasztott = rajtamJobb ? rajtam : taskaban;
            ki.push(alapIdKent ? valasztott.getItemBaseId() : valasztott.getId());
        }
        return ki;
    };

    // A fo szamitas.
    Szamito.prototype.legjobb = function ()
    {
        var onmaga = this;
        var eroderKulcsok = ['fort_offense', 'fort_defense', 'fort_damage', 'fort_resistance', 'fort_hp'];

        if (typeof this.opciok.skills === 'object' && $.isEmptyObject(this.opciok.skills)) return [];

        // 1. Minden jatekbeli szett, a nalad levo darabokkal.
        var osszesSzett = [];
        var szettLeirok = west.storage.ItemSetManager.getAll();
        for (var i = 0; i < szettLeirok.length; i++)
        {
            var leiro = szettLeirok[i];
            var elerheto = this.elerhetoDarabok(leiro.items)[0];
            if (elerheto.length)
            {
                osszesSzett.push(new west.item.ItemSet(
                {
                    key: leiro.key,
                    items: elerheto,
                    bonus: leiro.bonus
                }));
            }
        }

        // 2. Slotonkent a legjobb onallo darab.
        var legjobbDarabok = (function ()
        {
            var slotok = {};
            var ki = [];
            var alapok = Bag.getItemsIdsByBaseItemIds();

            for (var n in alapok)
            {
                var darab = ItemManager.get(alapok[n][0]);
                var tipus = darab.getType();
                var ertek = onmaga.rendezesiErtek(onmaga.darabBonusz(darab, true));
                slotok[tipus] = slotok[tipus] || [];

                var fegyverSzures = tipus === 'right_arm' && onmaga.opciok.weapon &&
                    darab.sub_type !== onmaga.opciok.weapon;
                if (!fegyverSzures && (ertek.tmp || ertek.val) && onmaga.viselheto(darab))
                {
                    slotok[tipus].push(
                    {
                        item: darab,
                        id: darab.getId(),
                        base_id: darab.getItemBaseId(),
                        tmp: ertek.tmp,
                        val: ertek.val
                    });
                }
            }

            for (var p in slotok)
            {
                var lista = slotok[p];
                var rajtam = Wear.get(p);
                if (rajtam)
                {
                    var r = ItemManager.get(rajtam.getId());
                    var re = onmaga.rendezesiErtek(onmaga.darabBonusz(r, true));
                    var fegyverSzures2 = p === 'right_arm' && onmaga.opciok.weapon &&
                        r.sub_type !== onmaga.opciok.weapon;
                    if (!fegyverSzures2)
                    {
                        lista.push(
                        {
                            item: r,
                            id: r.getId(),
                            base_id: r.getItemBaseId(),
                            tmp: re.tmp,
                            val: re.val
                        });
                    }
                }

                slotok[p] = lista.sort(function (a, b)
                {
                    if (!(a.tmp || a.val)) return 1;
                    if (!(b.tmp || b.val)) return -1;
                    if (p === 'animal' && onmaga.opciok.skills === 'ms')
                    {
                        return b.tmp * (1 + b.val / 100) - a.tmp * (1 + a.val / 100);
                    }
                    return (b.val - a.val) || (b.tmp - a.tmp);
                });

                if (slotok[p].length) ki.push(slotok[p][0].item);
            }
            return ki;
        })();

        // 3. Konteener a legjobb onallo darabokbol.
        var alapKonteener = new west.item.ItemSetContainer();
        for (var c = 0; c < legjobbDarabok.length; c++)
        {
            alapKonteener.addItem(legjobbDarabok[c].getId());
        }

        // 4. Szettkombinaciok, amik jobbak, mint az onallo darabok ugyanazokban a slotokban.
        var jeloltek = (function (szettek, legjobbak)
        {
            var ki = [];

            function fegyverSzures(idk)
            {
                if (!onmaga.opciok.weapon) return idk;
                var jobbKezuek = [];
                var kidobando;
                for (var i = 0; i < idk.length; i++)
                {
                    var o = ItemManager.get(idk[i]);
                    if (o.type === 'right_arm') jobbKezuek.push(idk[i]);
                    if (o.type === 'right_arm' && o.sub_type !== onmaga.opciok.weapon) kidobando = idk[i];
                }
                if (jobbKezuek.length < 2) return idk;
                return idk.filter(function (x)
                {
                    return x !== kidobando;
                });
            }

            function csupaKulonSlot(idk)
            {
                var latott = {};
                for (var i = 0; i < idk.length; i++)
                {
                    var t = ItemManager.get(idk[i]).type;
                    if (latott[t] === true) return false;
                    latott[t] = true;
                }
                return true;
            }

            function jobbMintAzOnallok(szett, legjobbak2)
            {
                var slotok = szett.getUsedSlots();
                var osszeg = {};
                for (var i = 0; i < legjobbak2.length; i++)
                {
                    if (slotok.indexOf(legjobbak2[i].getType()) !== -1)
                    {
                        var b = onmaga.darabBonusz(legjobbak2[i], true);
                        for (var k in b)
                        {
                            osszeg[k] = osszeg[k] || 0;
                            osszeg[k] += b[k];
                        }
                    }
                }
                return onmaga.szettOsszesen(szett) > onmaga.keplet(osszeg);
            }

            for (var d = 0; d < szettek.length; d++)
            {
                var szett = szettek[d];
                for (var db = szett.items.length; db > 0; db--)
                {
                    if (!szett.bonus.hasOwnProperty(db)) continue;
                    var szurt = fegyverSzures(szett.items);
                    var valtozatok = kombinaciok(szurt, db);
                    for (var h = 0; h < valtozatok.length; h++)
                    {
                        if (!csupaKulonSlot(valtozatok[h])) continue;
                        var uj = new west.item.ItemSet(
                        {
                            key: szett.key,
                            items: valtozatok[h],
                            bonus: szett.bonus
                        });
                        if (jobbMintAzOnallok(uj, legjobbak)) ki.push(uj);
                    }
                }
            }
            return ki;
        })(osszesSzett, legjobbDarabok);

        // 5. Azonos slotokat lefedo jeloltek kozul a legjobb.
        var szurtJeloltek = (function (lista)
        {
            var ki = [];
            var csoportok = {};
            for (var i = 0; i < lista.length; i++)
            {
                var sajat = onmaga.rendezesiErtek(onmaga.szettBonusz(lista[i], true), true);
                if (sajat.tmp < 1 && sajat.val < 1) continue;

                var jel = JSON.stringify(lista[i].getUsedSlots().sort());
                var egyutt = onmaga.rendezesiErtek(onmaga.szettOsszesen(lista[i], true), true);
                if (egyutt.tmp || egyutt.val)
                {
                    csoportok[jel] = csoportok[jel] || [];
                    csoportok[jel].push(
                    {
                        set: lista[i],
                        tmp: egyutt.tmp,
                        val: egyutt.val
                    });
                }
            }
            for (var p in csoportok)
            {
                csoportok[p] = csoportok[p].sort(function (a, b)
                {
                    if (!(a.tmp || a.val)) return 1;
                    if (!(b.tmp || b.val)) return -1;
                    return (b.val - a.val) || (b.tmp - a.tmp);
                });
                if (csoportok[p].length) ki.push(csoportok[p][0].set);
            }
            return ki;
        })(jeloltek);

        // 6. A jatek sajat kombinalo es kiegeszito logikaja.
        var eredmenyek = west.item.Calculator.fillEmptySlots(
            west.item.Calculator.combineSets(szurtJeloltek), legjobbDarabok);
        eredmenyek.push(alapKonteener);

        // 7. Pontozas.
        for (var e = 0; e < eredmenyek.length; e++)
        {
            eredmenyek[e] = this.darabokbolSzettek(eredmenyek[e]);
            var osszBonusz = this.konteenerBonusz(eredmenyek[e], true);
            eredmenyek[e].tmp = this.keplet(osszBonusz);
            eredmenyek[e].hp = this.keplet(osszBonusz, 'fort_hp');
            if (typeof this.opciok.skills === 'string' && eroderKulcsok.includes(this.opciok.skills))
            {
                eredmenyek[e].stats = {};
                for (var f = 0; f < eroderKulcsok.length; f++)
                {
                    eredmenyek[e].stats[eroderKulcsok[f]] = this.keplet(osszBonusz, eroderKulcsok[f]);
                }
            }
        }

        // 8. Rendezes.
        var opciok = this.opciok;
        eredmenyek.sort(function (a, b)
        {
            if (opciok.sort)
            {
                var lepes = (a.tmp >= 10000 && b.tmp >= 10000) ? 1000 :
                    ((a.tmp >= 1000 && b.tmp >= 1000) ? 100 : 25);
                var ax = Math.round(a.tmp / lepes) * lepes;
                var bx = Math.round(b.tmp / lepes) * lepes;
                return (bx - ax) || (b.stats[opciok.sort] - a.stats[opciok.sort]);
            }
            return b.tmp - a.tmp;
        });

        return eredmenyek;
    };

    // A leggyorsabb osszeallitas targyazonositoi (a gyorsszett szamoltGyorsSzett-je szerint).
    function gyorsIdk()
    {
        return celIdk('gyors');
    }

    /* ================================================================== */
    /* Celok a villamhoz es a zZ gombhoz                                   */
    /*                                                                     */
    /* Merve (2026-10-03): a regen bonusz sima tort (0.3 = 30%), szintfuggo */
    /* sehol, a szettfokozatok osszeadodnak (getMergedStages). Alvas       */
    /* kozben a maximum szoba-szorzo x (1 + regen) toltodik orankent, az   */
    /* energia es az eletero egyforman (Character.energyRegen / healthRegen).*/
    /* A cel ezert a regen-osszeg; a ruha maximum eleterejet a jatek       */
    /* atoltozeskor visszavagja, az nem szamit.                            */
    /* ================================================================== */

    var CELOK = {
        gyors:
        {
            skills: 'ms',
            tipp: 'gyorsTipp',
            nincs: 'Nem találtam gyorsabb ruhát.',
            kesz: 'Felvettem a leggyorsabb ruhát',
            marRajta: 'Már a leggyorsabb ruha van rajtad',
            szettben: 'a gyors szettben'
        },
        alvas:
        {
            skills:
            {
                regen: 1
            },
            tipp: 'alvasTipp',
            nincs: 'Nincs regenerációs tárgyad.',
            kesz: 'Felvettem az alvó ruhát',
            marRajta: 'Már a legjobb alvó ruha van rajtad',
            szettben: 'az alvó szettben'
        }
    };

    function celIdk(celNev)
    {
        var sz = new Szamito(
        {
            skills: CELOK[celNev].skills
        });
        var lista = sz.legjobb();
        if (!lista.length) return [];
        return sz.hasznaltDarabok(lista[0]) || [];
    }

    // A ruha pontos regeneracios bonusza (tort, 2.46 = 246%), szettfokozatokkal.
    // A kereso bonuszonkent egeszre kerekit, ezert az uzenet ezt irja ki.
    function regenOsszeg(idk)
    {
        var ossz = 0;
        var szettek = {};

        function ertek(b, ex)
        {
            var v, t;
            if (b.type === 'character')
            {
                v = ex.getCharacterItemValue(b);
                t = b.bonus && b.bonus.type;
            }
            else
            {
                v = ex.getValue(b);
                t = b.type;
            }
            return t === 'regen' ? (v || 0) : 0;
        }
        for (var i = 0; i < idk.length; i++)
        {
            var d = ItemManager.get(idk[i]);
            if (!d) continue;
            var lista = (d.bonus && d.bonus.item) || [];
            if (lista.length)
            {
                var ex = new west.item.BonusExtractor(Character, d.getItemLevel());
                for (var j = 0; j < lista.length; j++) ossz += ertek(lista[j], ex);
            }
            if (d.set) (szettek[d.set] = szettek[d.set] || []).push(idk[i]);
        }
        var ex0 = new west.item.BonusExtractor(Character);
        for (var k in szettek)
        {
            var leiro = west.storage.ItemSetManager.get(k);
            if (!leiro) continue;
            var szett = new west.item.ItemSet(
            {
                key: k,
                items: szettek[k],
                bonus: leiro.bonus
            });
            var fokok = szett.getMergedStages() || [];
            for (var f = 0; f < fokok.length; f++) ossz += ertek(fokok[f], ex0);
        }
        return ossz;
    }

    // Az uzenet vege: a gyorsszettnel semmi, az alvo ruhanal a regeneracio.
    function celUtotag(celNev, idk)
    {
        if (celNev !== 'alvas') return '';
        try
        {
            var sz = Math.round(regenOsszeg(idk) * 1000) / 10;
            return ' (+' + String(sz).replace('.', ',') + '% regeneráció)';
        }
        catch (e)
        {
            hiba(e, 'celUtotag');
            return '';
        }
    }

    /* ================================================================== */
    /* Munkasor vedelme                                                    */
    /*                                                                     */
    /* Merve: ha a munkasorban van munka, es a ruha munkapontja a munka    */
    /* nehezsege ala esik, a szerver minden tovabbi carry-t elutasit       */
    /* ("Jelenleg ervenytelen targyakat viselsz!"), azt a cseret viszont   */
    /* meg atengedi, amelyik a hatar ala visz. A sorban levo feladat        */
    /* data.job-ja tartalmazza a munka id-jet, skills-et es malus-at;      */
    /* a data.job_points a sorba tetelkori tobblet volt (3520 - 2641 = 879).*/
    /* ================================================================== */

    function sorbanLevoMunkak()
    {
        var ki = [];
        var volt = {};
        var q = (typeof TaskQueue !== 'undefined' && TaskQueue.queue) || [];
        for (var i = 0; i < q.length; i++)
        {
            var t = q[i];
            if (!t || t.type !== 'job' || !t.data || !t.data.job) continue;
            var j = t.data.job;
            if (volt[j.id] || !j.skills || typeof j.malus !== 'number') continue;
            volt[j.id] = true;
            var szint = typeof j.level === 'number' ? j.level : (JobList.getJobById(j.id) || {}).level;
            if (!munkapontKell(szint)) continue;
            ki.push(
            {
                id: j.id,
                nev: j.name,
                skills: j.skills,
                nehezseg: j.malus + 1
            });
        }
        return ki;
    }

    // Minden sorban levo munkara a karakter sajat resze: friss munkapont - mostani ruha.
    function kotesekEpitese(most)
    {
        return sorbanLevoMunkak().map(function (m)
        {
            var jl = JobList.getJobById(m.id);
            var friss = jl && typeof jl.calcJobPoints === 'function' ? jl.calcJobPoints() : null;
            if (typeof friss !== 'number' || isNaN(friss)) return null;
            m.alap = friss - pontosErtek(most, m.skills, m.id).lp;
            return m;
        }).filter(function (m)
        {
            return m;
        });
    }

    // Egy osszeallitasra a legkisebb munkapont-tobblet a sorban levo munkak kozott.
    function legkisebbTobblet(idk, kotesek)
    {
        var ki = {
            tobblet: Infinity,
            munka: null
        };
        for (var i = 0; i < kotesek.length; i++)
        {
            var k = kotesek[i];
            var t = k.alap + pontosErtek(idk, k.skills, k.id).lp - k.nehezseg;
            if (t < ki.tobblet) ki = {
                tobblet: t,
                munka: k
            };
        }
        return ki;
    }

    function ertekLista(allas)
    {
        var ki = [];
        for (var s in allas) ki.push(allas[s]);
        return ki;
    }

    // Biztonsagos sorrend: mindig azt a cseret valasztja, amely utan a legkisebb
    // tobblet a legnagyobb. Ha valamelyik lepesnel minden lehetoseg 0 ala vinne, nem jo.
    function biztonsagosSorrend(celIdk, kotesek)
    {
        var cel = {};
        celIdk.forEach(function (id)
        {
            var d = ItemManager.get(id);
            if (d) cel[d.type] = id;
        });
        var allas = {};
        Wear.slots.forEach(function (s)
        {
            if (Wear.wear[s]) allas[s] = Wear.wear[s].getId();
        });
        var hatra = Wear.slots.filter(function (s)
        {
            return cel[s] && allas[s] !== cel[s];
        });
        var sorrend = [];
        var lepesek = [];
        while (hatra.length)
        {
            var legjobb = null;
            for (var i = 0; i < hatra.length; i++)
            {
                var proba = {};
                for (var k in allas) proba[k] = allas[k];
                proba[hatra[i]] = cel[hatra[i]];
                var e = legkisebbTobblet(ertekLista(proba), kotesek);
                if (!legjobb || e.tobblet > legjobb.e.tobblet) legjobb = {
                    slot: hatra[i],
                    e: e,
                    allas: proba
                };
            }
            if (legjobb.e.tobblet < 0) return {
                ok: false,
                sorrend: sorrend,
                lepesek: lepesek,
                akad: legjobb
            };
            sorrend.push(legjobb.slot);
            lepesek.push(legjobb.slot + ' ' + legjobb.e.tobblet);
            allas = legjobb.allas;
            hatra.splice(hatra.indexOf(legjobb.slot), 1);
        }
        return {
            ok: true,
            sorrend: sorrend,
            lepesek: lepesek
        };
    }

    /* ================================================================== */
    /* Oltozes (a Munka gyorsszett 0.5.6 oltoztet fuggvenye alapjan)       */
    /* ================================================================== */

    // Csak azokat a slotokat valtjuk, ahol mas darab kell. Levetni nem vetkoztetunk.
    // sorrend: ha meg van adva, ebben a slotsorrendben cserel (munkasor vedelme).
    // Ha a szerver elutasit egy cseret, megall, es a hibauzenetet visszaadja.
    // Az oltozes vegen a jatek kepernyojenek frissitese a szerver utolso valaszabol.
    // Merve (2026-10-10): egy masik script altal becsomagolt Bag.updateChanges hibat dobott
    // ("Crafting.recipes[itemID].resources is not iterable"), es mivel a lepesek egy
    // blokkban futottak, a bonuszpontok, a sebesseg, a wear_changed jelzes es a karakterkep
    // frissitese elmaradt (a karakter nem frissult F5-ig). A nativ ruhacserenel is jott.
    // Ezert minden lepes kulon fut: egy hiba csak a sajat lepeset hagyja ki (t28).
    function lezarasAlkalmaz(valasz, felvettek, levettek)
    {
        var hibak = [];

        function lepes(nev, fv)
        {
            try
            {
                fv();
            }
            catch (e)
            {
                hibak.push(nev);
                hiba(e, 'oltoztet / lezaras / ' + nev);
            }
        }
        lepes('szettbonusz', function ()
        {
            WearSet.setUpItems(valasz.setItems);
            WearSet.workPointBonus = valasz.workPointBonus;
        });
        lepes('levetel', function ()
        {
            for (var a = 0; a < levettek.length; a++)
            {
                Wear.remove(levettek[a].type);
                if (levettek[a].type === 'right_arm') EventHandler.signal('character_weapon_changed', [levettek[a]]);
            }
        });
        lepes('felvetel', function ()
        {
            for (var r = 0; r < felvettek.length; r++)
            {
                Wear.add(felvettek[r].item_id);
                if (felvettek[r].type === 'right_arm') EventHandler.signal('character_weapon_changed', [felvettek[r]]);
            }
        });
        lepes('taska', function ()
        {
            Bag.updateChanges(valasz.changes, 'wear');
        });
        lepes('bonuszpontok', function ()
        {
            CharacterSkills.updateAllBonuspoints(valasz.bonus.allBonuspoints);
        });
        lepes('sebesseg', function ()
        {
            Character.setSpeed(valasz.speed);
        });
        lepes('eletero', function ()
        {
            Character.calcMaxHealth();
            EventHandler.signal('health', [Character.health, Character.maxHealth]);
        });
        lepes('jelzes', function ()
        {
            EventHandler.signal('wear_changed', [
            {
                added: felvettek,
                removed: levettek
            }]);
        });
        lepes('karakterkep', function ()
        {
            if (wman.getById(Wear.uid)) Wear.renderWear();
        });
        return hibak;
    }

    function oltoztet(idk, kesz, sorrend)
    {
        var cel = {};
        for (var i = 0; i < idk.length; i++)
        {
            var darab = ItemManager.get(idk[i]);
            if (darab) cel[darab.type] = darab;
        }

        var teendo = [];
        var slotok = sorrend || Wear.slots;
        for (var j = 0; j < slotok.length; j++)
        {
            var s = slotok[j];
            var most = Wear.wear[s];
            if (cel[s] && (!most || most.getId() !== cel[s].item_id)) teendo.push(s);
        }
        if (!teendo.length)
        {
            kesz(0);
            return;
        }

        var utolsoValasz = {};
        var felvettek = [];
        var levettek = [];
        var hibaSzoveg = null;

        function lezarasErvenyesites()
        {
            if ($.isEmptyObject(utolsoValasz)) return;
            lezarasAlkalmaz(utolsoValasz, felvettek, levettek);
        }

        function kesleltet(fuggveny)
        {
            return function ()
            {
                var ervek = arguments;
                var onmaga = this;
                setTimeout(function ()
                {
                    fuggveny.apply(onmaga, ervek);
                }, SLOT_SZUNET_MIN + Math.floor(Math.random() * SLOT_SZUNET_SZORAS));
            };
        }

        function kovetkezo(index)
        {
            if (index === teendo.length)
            {
                try
                {
                    lezarasErvenyesites();
                }
                catch (e)
                {
                    hiba(e, 'oltoztet / lezaras');
                }
                kesz(felvettek.length, hibaSzoveg);
                return;
            }

            var slot = teendo[index];
            var mostRajtam = Wear.wear[slot];

            Ajax.remoteCall('inventory', 'carry',
            {
                item_id: cel[slot].item_id,
                last_inv_id: Bag.getLastInvId()
            }, kesleltet(function (valasz)
            {
                if (valasz && !valasz.error)
                {
                    utolsoValasz = valasz;
                    felvettek.push(ItemManager.get(cel[slot].item_id));
                    if (mostRajtam && mostRajtam.obj) levettek.push(mostRajtam.obj);
                }
                else
                {
                    naplo('nem sikerult felvenni: ' + slot, valasz);
                    hibaSzoveg = (valasz && valasz.error) || 'ismeretlen hiba';
                    kovetkezo(teendo.length);
                    return;
                }
                kovetkezo(index + 1);
            }));
        }

        kovetkezo(0);
    }

    /* ================================================================== */
    /* Gombok                                                              */
    /* ================================================================== */

    function jobIdAblakbol(ab)
    {
        var m = ab.className.match(/wjob-(\d+)/);
        return m ? parseInt(m[1], 10) : null;
    }

    function szazalek(x)
    {
        return Math.round(x * 100) + '%';
    }

    function josoltAblak(szoveg, arany)
    {
        var n = parseInt(String(szoveg).replace(/[^0-9]/g, ''), 10);
        if (isNaN(n) || typeof arany !== 'number' || !isFinite(arany)) return '-';
        return Math.round(n * arany) + (String(szoveg).indexOf('%') >= 0 ? '%' : '');
    }

    function ellenorzesNaplo(ab, jobert, elotte, joslat)
    {
        if (!TESZT) return;
        setTimeout(function ()
        {
            try
            {
                var mp = ablakMunkapont(ab, jobert);
                var sav = ab.querySelector('.job_durationbar_long .job_value_yieldfound.yield1');
                var xp = ab.querySelector('.job_durationbar_long .job_value_experience:not(.nextStage)');
                var ut = ab.querySelector('.job_way_time');
                naplo('ELLENORZES munka ' + jobert.id + ' ' + jobert.nev +
                    ' | josolt munkapont ' + joslat.mp + ', ' + (mp ? mp.forras + ' ' + mp.ertek : '-') +
                    ', csillagsav ' + csillagsav(ab) +
                    ' | drop elotte ' + szazalek(elotte.drop) + ', josolt ' + szazalek(joslat.drop) +
                    ' | exp elotte ' + szazalek(elotte.exp) + ', josolt ' + szazalek(joslat.exp) +
                    ' | fokozat josolt ' + joslat.fok +
                    ' | 1 oras termek elotte ' + elotte.sav + ', josolt ' + josoltAblak(elotte.sav, joslat.termekArany) + ', most ' + (sav ? sav.textContent : '-') +
                    ' | 1 oras tapasztalat elotte ' + elotte.xp + ', josolt ' + josoltAblak(elotte.xp, joslat.xpArany) + ', most ' + (xp ? xp.textContent : '-') +
                    ' | ut elotte ' + elotte.ut + ', most ' + (ut ? ut.textContent : '-'));
            }
            catch (e)
            {
                hiba(e, 'ellenorzesNaplo');
            }
        }, 3000);
    }

    // Ha nemreg volt ruhacsere, megvarjuk, amig a munkaablak frissul.
    function inditas(ab, mod)
    {
        if (allapot.dolgozik) return;
        var eltelt = Date.now() - allapot.utolsoRuhacsere;
        var jid = jobIdAblakbol(ab);
        if (eltelt < FRISSULES_VARAS && !(jid !== null && friss(jid)))
        {
            if (TESZT) naplo('utolso ruhacsere ' + eltelt + ' ms-e volt, varunk ' + (FRISSULES_VARAS - eltelt) + ' ms-ot');
            allapot.dolgozik = true;
            gombAllapot();
            setTimeout(function ()
            {
                allapot.dolgozik = false;
                gombAllapot();
                inditas(ab, mod);
            }, FRISSULES_VARAS - eltelt + 100);
            return;
        }
        if (mod === 'gyors' || mod === 'alvas') gyorsInditas(ab, eltelt, mod);
        else szamolasEsOltozes(ab, mod, eltelt);
    }

    /* ================================================================== */
    /* Gyors ruha mentett szettbol                                         */
    /*                                                                     */
    /* Nincs beegetett nev: az osszes mentett szettet pontozzuk a gyorsszett*/
    /* sebessegkepletevel, es ha barmelyik legalabb olyan gyors, mint a     */
    /* kiszamolt legjobb, arra valtunk egy keressel (switch_equip).         */
    /* A szettlista betoltese (inventory/show_equip), a valtas es az        */
    /* idokorlat a Munka gyorsszett 0.5.6 szerint.                          */
    /* ================================================================== */

    var SZETTVALTAS_IDOKORLAT = 15000;

    function szettLista(kesz)
    {
        try
        {
            Ajax.remoteCallMode('inventory', 'show_equip',
            {}, function (d)
            {
                var lista = (d && d.data) ? d.data : [];
                // A switchEquip sikeraga az EquipManager.list tombbol epiti ujra a Felszereles
                // kezelot. Ha ez nincs feltoltve, kivetel jon, es a wear_changed jelzes elmarad.
                try
                {
                    EquipManager.list = lista;
                    if (d && typeof d.max !== 'undefined') EquipManager.max = d.max;
                    if (d && typeof d.premium_max !== 'undefined') EquipManager.premiumMax = d.premium_max;
                    if (d && typeof d.hasPremium !== 'undefined') EquipManager.hasPremium = d.hasPremium;
                }
                catch (e)
                {
                    hiba(e, 'szettLista / EquipManager feltoltes');
                }
                kesz(lista);
            });
        }
        catch (e)
        {
            hiba(e, 'szettLista');
            kesz([]);
        }
    }

    function mentettSzettFelvetel(id, kesz)
    {
        var meghivva = false;

        function egyszer()
        {
            if (meghivva) return;
            meghivva = true;
            clearTimeout(ora);
            try
            {
                EventHandler.unlisten('wear_changed', figyelo);
            }
            catch (e)
            {}
            kesz();
        }

        function figyelo()
        {
            egyszer();
            return EventHandler.ONE_TIME_EVENT;
        }

        var ora = setTimeout(function ()
        {
            naplo('a szettvaltas nem jelzett vissza idoben');
            egyszer();
        }, SZETTVALTAS_IDOKORLAT);

        try
        {
            EventHandler.listen('wear_changed', figyelo);
            EquipManager.switchEquip(id);
        }
        catch (e)
        {
            hiba(e, 'mentettSzettFelvetel');
            egyszer();
        }
    }

    // Egy osszeallitas sebessegpontja a gyorsszett kepletevel.
    function sebessegPont(sz, idk)
    {
        var k = new west.item.ItemSetContainer();
        if (!k.sets) k.sets = [];
        if (!k.items) k.items = [];
        for (var i = 0; i < idk.length; i++) k.addItem(idk[i]);
        return sz.keplet(sz.konteenerBonusz(sz.darabokbolSzettek(k), true));
    }

    // Merve (2026-09-29): a nativ EquipManager.replaceEquip a lista bejegyzeset helyben
    // frissiti, de a cipot elirassal a "food" mezobe irja, a "foot" a regi marad.
    // Ezert ha van "food" mezo, az a friss cipo.
    function mentettIdk(szett)
    {
        var ki = [];
        for (var i = 0; i < Wear.slots.length; i++)
        {
            var s = Wear.slots[i];
            var id = (s === 'foot' && ('food' in szett)) ? szett.food : szett[s];
            if (id) ki.push(id);
        }
        return ki;
    }

    // A jatek sajat szettlistaja, ha mar be van toltve (a Felszereles kezelo ezt frissiti).
    function jatekLista()
    {
        try
        {
            if (EquipManager.list && typeof EquipManager.list.sort === 'function') return EquipManager.list;
        }
        catch (e)
        {}
        return null;
    }

    // t23: a Tapasztalat es a Gyujtogeto gomb mentett szettje. Csak akkor nyer, ha a
    // pontszama legalabb a kiszamolt legjobb (rosszabbat soha nem valaszt); akkor egy
    // keressel (switch_equip) valtunk ra a darabonkenti oltozes helyett.
    function mentettMunkara(job, alap, celKulcs, legjobb, lista)
    {
        var jo = null;
        var naploSor = [];
        for (var i = 0; i < lista.length; i++)
        {
            var idk = mentettIdk(lista[i]);
            if (!idk.length) continue;
            var e;
            try
            {
                e = pontosErtek(idk, job.skills, job.id);
            }
            catch (h)
            {
                hiba(h, 'mentettMunkara ' + lista[i].name);
                continue;
            }
            if (job.mpKell && alap + e.lp < job.nehezseg) continue;
            var p = kerekit(pontszam(celKulcs, alap + e.lp, job.nehezseg, e[celKulcs]));
            naploSor.push(lista[i].name + ' ' + p);
            if (p < legjobb.pont) continue;
            if (!jo || p > jo.pont || (p === jo.pont && e.lp > jo.ertek.lp)) jo = {
                szett: lista[i],
                idk: idk,
                ertek: e,
                pont: p
            };
        }
        if (TESZT) naplo('mentett szettek a munkahoz (legjobb ' + legjobb.pont + '): ' + (naploSor.join(', ') || 'nincs') +
            ' | ' + (jo ? 'valasztott: ' + jo.szett.name + ' ' + jo.pont : 'egyik sem eleg jo'));
        return jo;
    }

    function gyorsInditas(ab, eltelt, celNev)
    {
        celNev = celNev || 'gyors';
        var cel = CELOK[celNev];
        var sz, legjobb, legjobbPont;
        try
        {
            sz = new Szamito(
            {
                skills: cel.skills
            });
            var eredmeny = sz.legjobb();
            legjobb = eredmeny.length ? (sz.hasznaltDarabok(eredmeny[0]) || []) : [];
            if (!legjobb.length) return gyorsDarabonkent(ab, eltelt, celNev);
            legjobbPont = sebessegPont(sz, legjobb);
        }
        catch (e)
        {
            hiba(e, 'gyorsInditas / szamitas');
            return gyorsDarabonkent(ab, eltelt, celNev);
        }

        function keres(frissit)
        {
            var betolt = function (kesz)
            {
                var meglevo = jatekLista();
                if (!frissit && meglevo) return kesz(meglevo, false);
                szettLista(function (lista)
                {
                    kesz(lista, true);
                });
            };
            allapot.dolgozik = true;
            gombAllapot();
            betolt(function (lista, friss)
            {
                allapot.dolgozik = false;
                gombAllapot();
                var jo = null;
                var naploSor = [];
                for (var i = 0; i < lista.length; i++)
                {
                    var idk = mentettIdk(lista[i]);
                    if (!idk.length) continue;
                    var p;
                    try
                    {
                        p = sebessegPont(sz, idk);
                    }
                    catch (e)
                    {
                        hiba(e, 'sebessegPont ' + lista[i].name);
                        continue;
                    }
                    naploSor.push(lista[i].name + ' ' + p);
                    if (p >= legjobbPont && (!jo || p > jo.pont)) jo = {
                        szett: lista[i],
                        pont: p,
                        idk: idk
                    };
                }
                if (TESZT) naplo(celNev + ': kiszamolt legjobb ' + legjobbPont + ' | mentett szettek: ' + (naploSor.join(', ') || 'nincs') +
                    ' | ' + (jo ? 'valasztott: ' + jo.szett.name : 'nincs eleg gyors') + (friss ? ' (friss lista)' : ' (tarolt lista)'));
                if (jo) return mentettreValtas(ab, jo, celNev);
                if (!friss) return keres(true);
                allapot[cel.tipp] = !allapot[cel.tipp] ? 'most' : 'volt';
                gyorsDarabonkent(ab, eltelt, celNev);
            });
        }
        keres(false);
    }

    function munkaAblak(ab)
    {
        return !!(ab && ab.classList && ab.classList.contains('jobwindow'));
    }

    // Darabonkenti gyors oltozes. Munkaablakban a regi ut (a munka adataival es a TESZT
    // ellenorzessel), mas ablakban (erod, varos, kuldetesado) munka nelkul.
    function gyorsDarabonkent(ab, eltelt, celNev)
    {
        celNev = celNev || 'gyors';
        var cel = CELOK[celNev];
        if (celNev === 'gyors' && munkaAblak(ab)) return szamolasEsOltozes(ab, 'gyors', eltelt);
        var gy;
        try
        {
            gy = celIdk(celNev);
        }
        catch (e)
        {
            hiba(e, 'gyorsDarabonkent / szamitas');
            uzenet('A számítás hibára futott, részletek a konzolban.', true);
            return;
        }
        if (!gy.length)
        {
            uzenet(cel.nincs);
            return;
        }
        var celIdkLista = teljesOsszeallitas(gy);
        var sorrend = null;
        var kotesek = kotesekEpitese(rajtamIdk());
        if (kotesek.length)
        {
            var vegso = legkisebbTobblet(celIdkLista, kotesek);
            if (vegso.tobblet < 0)
            {
                uzenet('A sorban lévő munkához (' + vegso.munka.nev + ') ebben a ruhában nem lenne elég munkapontod (' +
                    (vegso.munka.nehezseg + vegso.tobblet) + ', kell ' + vegso.munka.nehezseg + ').', true);
                return;
            }
            var bs = biztonsagosSorrend(celIdkLista, kotesek);
            if (!bs.ok)
            {
                uzenet('Nem tudok úgy átöltözni, hogy közben megmaradjon a munkapont a sorban lévő munkához (' +
                    bs.akad.e.munka.nev + '). Mentett szettel egy lépésben átválthatsz.', true);
                return;
            }
            sorrend = bs.sorrend;
        }
        allapot.dolgozik = true;
        gombAllapot();
        oltoztet(celIdkLista, function (db, hibaSz)
        {
            allapot.dolgozik = false;
            gombAllapot();
            if (hibaSz)
            {
                uzenet('Nem sikerült minden darabot felvenni (' + db + ' sikerült): ' + hibaSz, true);
                return;
            }
            var utotag = celUtotag(celNev, celIdkLista);
            if (!db)
            {
                uzenet(cel.marRajta + utotag + '.');
                return;
            }
            uzenet(cel.kesz + utotag + '.' + (allapot[cel.tipp] === 'most' ?
                ' Ha elmented a Felszerelés kezelőben (bármilyen néven), legközelebb egy lépésben átöltözöl.' : ''));
        }, sorrend);
    }

    function mentettreValtas(ab, jo, celNev)
    {
        celNev = celNev || 'gyors';
        var cel = CELOK[celNev];
        var utotag = celUtotag(celNev, jo.idk);
        var rajtam = rajtamIdk().slice(0).sort().join(',');
        if (rajtam === jo.idk.slice(0).sort().join(','))
        {
            uzenet(cel.marRajta + ' (' + jo.szett.name + ')' + utotag + '.');
            return;
        }
        var kotesek = kotesekEpitese(rajtamIdk());
        if (kotesek.length)
        {
            var v = legkisebbTobblet(jo.idk, kotesek);
            if (v.tobblet < 0)
            {
                uzenet('A sorban lévő munkához (' + v.munka.nev + ') ' + cel.szettben + ' nem lenne elég munkapontod (' +
                    (v.munka.nehezseg + v.tobblet) + ', kell ' + v.munka.nehezseg + ').', true);
                return;
            }
        }
        var elottUt = ab.querySelector('.job_way_time');
        var elotte = elottUt ? elottUt.textContent : '-';
        allapot.dolgozik = true;
        gombAllapot();
        mentettSzettFelvetel(jo.szett.equip_manager_id, function ()
        {
            allapot.dolgozik = false;
            gombAllapot();
            // Ellenorzes: azt kaptuk-e, amit vartunk. Ha a mentett szett kozben megvaltozott
            // (a lista elavult volt), friss listaval a legjobbat vesszuk fel darabonkent.
            var kapott = rajtamIdk().slice(0).sort().join(',');
            if (kapott !== jo.idk.slice(0).sort().join(','))
            {
                if (TESZT) naplo(celNev + ': a valtas utan mas van rajtad, mint vartuk | vart: ' + jo.idk.join(',') + ' | kapott: ' + kapott);
                szettLista(function ()
                {
                    uzenet('A mentett szett (' + jo.szett.name + ') megváltozott, ezért most a legjobbat veszem fel.', true);
                    gyorsDarabonkent(ab, FRISSULES_VARAS, celNev);
                });
                return;
            }
            uzenet(cel.kesz + ' egy lépésben: ' + jo.szett.name + utotag + '.' + (munkaAblak(ab) ? ' Munka indítása után öltözz át a munkához.' : ''));
            if (TESZT) setTimeout(function ()
            {
                var ut = ab.querySelector('.job_way_time');
                naplo('ELLENORZES gyors szett: ' + jo.szett.name + ' | ut elotte ' + elotte + ', most ' + (ut ? ut.textContent : '-'));
            }, 3000);
        });
    }

    function szamolasEsOltozes(ab, mod, eltelt, opciok)
    {
        opciok = opciok || {};
        var mentettNelkul = allapot.mentettNelkul;
        allapot.mentettNelkul = false;
        var jobId = jobIdAblakbol(ab);
        var job = jobId !== null ? jobAdat(jobId) : null;
        if (!job)
        {
            uzenet('Nem találom a munka adatait.', true);
            return;
        }

        var most = rajtamIdk();
        var mostErtek = pontosErtek(most, job.skills, job.id);
        var ablakMp = ablakMunkapont(ab, job);
        if (!ablakMp)
        {
            uzenet('Nem tudom kiolvasni a munkapontodat a munkaablakból.', true);
            return;
        }
        var alap = ablakMp.ertek - mostErtek.lp;
        var elottSav = ab.querySelector('.job_durationbar_long .job_value_yieldfound.yield1');
        var elottXp = ab.querySelector('.job_durationbar_long .job_value_experience:not(.nextStage)');
        var elottUt = ab.querySelector('.job_way_time');

        if (TESZT) naplo('munka ' + job.id + ' ' + job.nev + ' | szint ' + job.szint + ' (karakter ' + Character.level + ', munkapont ' +
            (job.mpKell ? 'kell' : 'nem feltetel') + ') | nehezseg ' + job.nehezseg + ' | munkapont most ' +
            ablakMp.ertek + ' (' + ablakMp.forras + ') | ruha most ' + mostErtek.lp + ' | karakter sajat resze ' + alap +
            ' | utolso ruhacsere ota ' + (allapot.utolsoRuhacsere ? Math.round(eltelt / 1000) + ' mp' : 'nem volt'));

        var cel;
        try
        {
            if (mod === 'gyors')
            {
                var gy = gyorsIdk();
                if (!gy.length)
                {
                    uzenet('Nem találtam gyorsabb ruhát.');
                    return;
                }
                var gyTeljes = teljesOsszeallitas(gy);
                cel = {
                    idk: gyTeljes,
                    ertek: pontosErtek(gyTeljes, job.skills, job.id)
                };
            }
            else if (mod === 'munkapont' || mod === 'szerencse')
            {
                var szett = west.item.Calculator.getBestSet(job.skills, job.id);
                var idk = szett && szett.getItems ? szett.getItems() : [];
                if (!idk.length)
                {
                    uzenet('A játék nem talált jobb munkaruhát.');
                    return;
                }
                var teljes = teljesOsszeallitas(idk);
                cel = {
                    idk: teljes,
                    ertek: pontosErtek(teljes, job.skills, job.id)
                };
            }
            else
            {
                cel = celSzett(job, alap, mod === 'tapasztalat' ? 'exp' : 'drop');
                if (!cel)
                {
                    uzenet('Nincs olyan ruhád, amiben ezt a munkát el tudod végezni.', true);
                    return;
                }
            }
        }
        catch (e)
        {
            hiba(e, 'szamitas');
            uzenet('A számítás hibára futott, részletek a konzolban.', true);
            return;
        }

        // t23: ha cserelni kell, egy legalabb ilyen jo mentett szett egy keressel felveheto.
        // A szettlistat egyszer toltjuk be (1 show_equip), utana a jatek tarolt listajat nezzuk.
        var mentett = null;
        if ((mod === 'tapasztalat' || mod === 'gyujtogeto') && cel.csere > 0 && !mentettNelkul)
        {
            var lista = jatekLista();
            if (!lista && !opciok.listaUtan)
            {
                allapot.dolgozik = true;
                gombAllapot();
                szettLista(function ()
                {
                    allapot.dolgozik = false;
                    gombAllapot();
                    szamolasEsOltozes(ab, mod, eltelt,
                    {
                        listaUtan: true
                    });
                });
                return;
            }
            try
            {
                mentett = mentettMunkara(job, alap, mod === 'tapasztalat' ? 'exp' : 'drop', cel, lista || []);
            }
            catch (e)
            {
                hiba(e, 'mentettMunkara');
                mentett = null;
            }
            if (mentett) cel = {
                idk: mentett.idk,
                ertek: mentett.ertek,
                pont: mentett.pont,
                csere: 1,
                forras: 'mentett szett'
            };
        }

        var joslat = {
            mp: alap + cel.ertek.lp,
            drop: cel.ertek.drop,
            exp: cel.ertek.exp
        };
        joslat.fok = fokozatSzoveg(fokozat(joslat.mp, job.nehezseg));
        // A jatek ablakaban latott ertek varhato valtozasa (a mert szabaly szerint).
        joslat.termekArany = pontszam('drop', joslat.mp, job.nehezseg, joslat.drop) /
            pontszam('drop', ablakMp.ertek, job.nehezseg, mostErtek.drop);
        joslat.xpArany = pontszam('exp', joslat.mp, job.nehezseg, joslat.exp) /
            pontszam('exp', ablakMp.ertek, job.nehezseg, mostErtek.exp);
        if (TESZT) naplo('valasztott ruha', cel.idk.map(function (id)
        {
            var d = ItemManager.get(id);
            return d ? d.name : id;
        }));

        // Munkasor vedelme: a sorban levo munkak nehezsege egyik lepesnel se legyen alatta.
        var sorrend = null;
        var kotesek = kotesekEpitese(most);
        if (kotesek.length)
        {
            var vegso = legkisebbTobblet(cel.idk, kotesek);
            if (vegso.tobblet < 0)
            {
                uzenet('A sorban lévő munkához (' + vegso.munka.nev + ') ebben a ruhában nem lenne elég munkapontod (' +
                    (vegso.munka.nehezseg + vegso.tobblet) + ', kell ' + vegso.munka.nehezseg + ').', true);
                return;
            }
            if (mentett)
            {
                // Egy keressel valtunk, nincs koztes allapot: csak a vegso ruha szamit.
                if (TESZT) naplo('munkasor: mentett szett, csak a vegso allapot szamit, legkisebb tobblet ' + vegso.tobblet);
            }
            else
            {
                var bs = biztonsagosSorrend(cel.idk, kotesek);
                if (TESZT) naplo('munkasor: ' + kotesek.map(function (k)
                {
                    return k.id + ' ' + k.nev + ' (kell ' + k.nehezseg + ', sajat resz ' + k.alap + ')';
                }).join(', ') + ' | sorrend es legkisebb tobblet: ' + bs.lepesek.join(', ') + (bs.ok ? '' : ' | NINCS biztonsagos sorrend'));
                if (!bs.ok)
                {
                    uzenet('Nem tudok úgy átöltözni, hogy közben megmaradjon a munkapont a sorban lévő munkához (' +
                        bs.akad.e.munka.nev + '). Mentett szettel egy lépésben átválthatsz.', true);
                    return;
                }
                sorrend = bs.sorrend;
            }
        }

        allapot.dolgozik = true;
        gombAllapot();

        function vege(db, hibaSz)
        {
            allapot.dolgozik = false;
            gombAllapot();
            if (hibaSz)
            {
                uzenet('Nem sikerült minden darabot felvenni (' + db + ' sikerült): ' + hibaSz, true);
                ellenorzesNaplo(ab, job,
                {
                    drop: mostErtek.drop,
                    exp: mostErtek.exp,
                    sav: elottSav ? elottSav.textContent : '-',
                    xp: elottXp ? elottXp.textContent : '-',
                    ut: elottUt ? elottUt.textContent : '-'
                }, joslat);
                return;
            }
            var szovegek = {
                munkapont: ['Már a legtöbb munkapontot adó ruha van rajtad (' + joslat.mp + ' munkapont).',
                    'Felvettem a legtöbb munkapontot adó ruhát (' + joslat.mp + ' munkapont).'],
                szerencse: ['Már a legszerencsésebb ruha van rajtad (' + joslat.mp + ' munkapont).',
                    'Felvettem a legszerencsésebb ruhát (' + joslat.mp + ' munkapont).'],
                tapasztalat: ['Már a legjobb tapasztalat ruha van rajtad (+' + szazalek(joslat.exp) + ' tapasztalat, ' + joslat.fok + ').',
                    'Felvettem a tapasztalat ruhát (+' + szazalek(joslat.exp) + ' tapasztalat, ' + joslat.fok + ').'],
                gyors: ['Már a leggyorsabb ruha van rajtad.',
                    'Felvettem a leggyorsabb ruhát. Munka indítása után öltözz át a munkához.' +
                    (allapot.gyorsTipp === 'most' ? ' Ha elmented a Felszerelés kezelőben (bármilyen néven), legközelebb egy lépésben átöltözöl.' : '')],
                gyujtogeto: ['Már a legjobb gyűjtögető ruha van rajtad (+' + szazalek(joslat.drop) + ' termékesély, ' + joslat.fok + ').',
                    'Felvettem a gyűjtögető ruhát (+' + szazalek(joslat.drop) + ' termékesély, ' + joslat.fok + ').']
            };
            var sz = szovegek[mod] || szovegek.munkapont;
            if (!db)
            {
                uzenet(sz[0]);
                return;
            }
            var szoveg = sz[1];
            if (mentett) szoveg = szoveg.replace(/\)\.$/, ', egy lépésben: ' + mentett.szett.name + ').');
            else if ((mod === 'tapasztalat' || mod === 'gyujtogeto') && db > 1 && !allapot.munkaTipp)
            {
                allapot.munkaTipp = 'volt';
                szoveg += ' Ha elmented a Felszerelés kezelőben (bármilyen néven), legközelebb egy lépésben átöltözöl.';
            }
            uzenet(szoveg);
            ellenorzesNaplo(ab, job,
            {
                drop: mostErtek.drop,
                exp: mostErtek.exp,
                sav: elottSav ? elottSav.textContent : '-',
                xp: elottXp ? elottXp.textContent : '-',
                ut: elottUt ? elottUt.textContent : '-'
            }, joslat);
        }

        if (mentett)
        {
            if (rajtamIdk().slice(0).sort().join(',') === mentett.idk.slice(0).sort().join(',')) return vege(0, null);
            if (TESZT) naplo('valtas mentett szettre: ' + mentett.szett.name + ' (1 keres, switch_equip)');
            mentettSzettFelvetel(mentett.szett.equip_manager_id, function ()
            {
                // Ellenorzes: azt kaptuk-e, amit vartunk. Ha a mentett szett kozben megvaltozott,
                // friss listaval, mentett szett nelkul, darabonkent szamolunk ujra.
                var kapott = rajtamIdk().slice(0).sort().join(',');
                if (kapott !== mentett.idk.slice(0).sort().join(','))
                {
                    allapot.dolgozik = false;
                    gombAllapot();
                    if (TESZT) naplo(mod + ': a valtas utan mas van rajtad, mint vartuk | vart: ' + mentett.idk.join(',') + ' | kapott: ' + kapott);
                    szettLista(function ()
                    {
                        uzenet('A mentett szett (' + mentett.szett.name + ') megváltozott, ezért most darabonként öltözöm.', true);
                        allapot.mentettNelkul = true;
                        inditas(ab, mod);
                    });
                    return;
                }
                vege(1, null);
            });
            return;
        }
        oltoztet(cel.idk, vege, sorrend);
    }

    // A zart ablak Munkapont gombjanak ikonja: a jatek kis csakanya.
    var CSAKANY = 'https://westhu.innogamescdn.com/images/window/job/jobstar_small_gold.png';

    // Az ikonok eltolasa (eltolas: [x, y] pixel): a jatek ikonlapjan a rajz nem mindig
    // a 16x16-os kocka kozepen ul; a jatekban elo allitva (2026-09-29).
    // A villam a Tavolsag lathato csikjahoz (.job_way) igazodik, nem a kulso kerethez.

    // Merve (Marhak megjelolese, 7 ruha): a tapasztalat = alap x (1 + tapasztalat-bonusz),
    // a munkapont nem szamit bele; a szerencses talalat dollarerteke csak a munkaponttol
    // fugg, a ruha szerencse-bonuszatol nem. Ezert a Szerencse a legtobb munkapontot adja.
    var GOMBOK = [
    {
        mod: 'gyors',
        melle: '.job_way',
        ikon: '-96px -32px',
        buborek: '<b>Gyorsszett</b><br>Felveszi a leggyorsabb ruhát, hogy hamarabb odaérj.<br>Az út ideje a munka indításakor rögzül: indítás után öltözz át a munkához<br>(Tapasztalat, Szerencse vagy Gyűjtögető).'
    },
    {
        mod: 'tapasztalat',
        sor: '.job_value_experience:not(.nextStage)',
        ikon: '-128px -16px',
        eltolas: [-1, -1],
        buborek: '<b>Tapasztalat</b><br>Felveszi a legnagyobb tapasztalat-bónuszt adó ruhát,<br>amelyben ezt a munkát még el tudod végezni.'
    },
    {
        mod: 'szerencse',
        sor: '.job_value_luck',
        ikon: '-144px -32px',
        eltolas: [1, 1],
        buborek: '<b>Szerencse</b><br>Felveszi a legtöbb munkapontot adó ruhát.<br>Ez adja a legértékesebb szerencsés találatot.'
    },
    {
        mod: 'gyujtogeto',
        sor: '.job_value_yieldfound.yield1:not(.nextStage)',
        ikon: '-32px -48px',
        eltolas: [-1, 0],
        buborek: '<b>Gyűjtögető</b><br>Felveszi a legnagyobb termékesélyt adó ruhát,<br>amelyben ezt a munkát még el tudod végezni.'
    }];

    function gombAllapot()
    {
        $('.' + OSZTALY + '-gomb, .' + OSZTALY + '-cimkes, .' + OSZTALY + '-akcio').each(function ()
        {
            var tiltott = this.getAttribute('data-tiltva') === '1';
            this.style.opacity = tiltott ? '0.4' : (allapot.dolgozik ? '0.5' : '1');
            this.style.cursor = tiltott || allapot.dolgozik ? 'default' : 'pointer';
        });
    }

    function stilusBetoltes()
    {
        if (document.getElementById(OSZTALY + '-stilus')) return;
        var st = document.createElement('style');
        st.id = OSZTALY + '-stilus';
        st.textContent =
            '.' + OSZTALY + '-gomb{position:absolute;z-index:5;width:24px;height:24px;box-sizing:border-box;' +
            'display:flex;align-items:center;justify-content:center;background:#4a2c1a;border:1px solid #c9a26b;' +
            'border-radius:4px;cursor:pointer}' +
            '.' + OSZTALY + '-gomb[data-tiltva="1"]{border-style:dashed}' +
            '.' + OSZTALY + '-gomb:hover{border-color:#f3e2b8}' +
            '.' + OSZTALY + '-gomb span{display:block;width:16px;height:16px;background-image:url(' + IKONLAP + ');background-repeat:no-repeat}' +
            '.' + OSZTALY + '-zart{position:absolute;z-index:6;display:flex;flex-direction:column;align-items:center;gap:8px}' +
            '.' + OSZTALY + '-hiany{font-size:12px;color:#f3e2b8;background:rgba(30,18,10,.75);padding:3px 10px;border-radius:3px;white-space:nowrap}' +
            '.' + OSZTALY + '-sor{display:flex;gap:8px}' +
            '.' + OSZTALY + '-cimkes{display:flex;align-items:center;gap:6px;padding:7px 10px;background:#4a2c1a;border:1px solid #c9a26b;' +
            'border-radius:4px;color:#f3e2b8;font-family:Georgia,serif;font-size:13px;cursor:pointer;white-space:nowrap}' +
            '.' + OSZTALY + '-cimkes[data-tiltva="1"]{border-style:dashed}' +
            '.' + OSZTALY + '-cimkes:hover{border-color:#f3e2b8}' +
            '.' + OSZTALY + '-cimkes span{display:block;width:16px;height:16px;background-image:url(' + IKONLAP + ');background-repeat:no-repeat}' +
            '.' + OSZTALY + '-akcioikon{position:absolute;left:50%;top:50%;width:16px;height:16px;margin:-8px 0 0 -8px;z-index:2;' +
            'background-image:url(' + IKONLAP + ');background-repeat:no-repeat;background-position:-96px -32px}';
        document.head.appendChild(st);
    }

    function gombokFelrakasa(ab, pane)
    {
        GOMBOK.forEach(function (g)
        {
            var el = document.createElement('div');
            el.className = OSZTALY + '-gomb';
            el.setAttribute('data-mod', g.mod);
            if (g.tiltva) el.setAttribute('data-tiltva', '1');
            el.style.display = 'none';
            if (g.kep)
            {
                var kep = document.createElement('img');
                kep.src = g.kep;
                kep.alt = '';
                kep.style.cssText = 'width:16px;height:16px;object-fit:contain';
                el.appendChild(kep);
            }
            else
            {
                var ik = document.createElement('span');
                ik.style.backgroundPosition = g.ikon;
                if (g.eltolas) ik.style.transform = 'translate(' + g.eltolas[0] + 'px,' + g.eltolas[1] + 'px)';
                el.appendChild(ik);
            }
            pane.appendChild(el);
            try
            {
                $(el).addMousePopup(g.buborek);
            }
            catch (e)
            {
                hiba(e, 'buborek');
            }
            el.addEventListener('mousedown', function (e)
            {
                e.stopPropagation();
            });
            el.addEventListener('click', function (e)
            {
                e.stopPropagation();
                e.preventDefault();
                if (g.tiltva || allapot.dolgozik) return;
                inditas(ab, g.mod);
            });
        });
        gombAllapot();
    }

    // A gombokat minden koron a sorokhoz igazitjuk, mert a jatek ujrarajzolja az oszlopokat.
    function igazitas(ab, pane)
    {
        var p = pane.getBoundingClientRect();
        if (!p.width) return;
        var sav = ab.querySelector('.job_durationbar_long') || [].slice.call(ab.querySelectorAll('.job_durationbar')).pop();
        GOMBOK.forEach(function (g)
        {
            var el = pane.querySelector('.' + OSZTALY + '-gomb[data-mod="' + g.mod + '"]');
            if (!el) return;
            if (g.melle)
            {
                var m = ab.querySelector(g.melle);
                var mr = m ? m.getBoundingClientRect() : null;
                if (!mr || !mr.width || ab.querySelector('.job_rightSide.job_overlay'))
                {
                    el.style.display = 'none';
                    return;
                }
                el.style.left = Math.round(Math.min(mr.right - p.left + 6, p.width - 26)) + 'px';
                el.style.top = Math.round(mr.top - p.top + mr.height / 2 - 12) + 'px';
                el.style.display = 'flex';
                return;
            }
            var sor = sav ? sav.querySelector(g.sor) : null;
            if (!sor)
            {
                el.style.display = 'none';
                return;
            }
            var r = sor.getBoundingClientRect();
            var s = sav.getBoundingClientRect();
            var jobbSzel = Math.max(r.right, s.right) - p.left;
            el.style.left = Math.round(Math.min(jobbSzel + 6, p.width - 26)) + 'px';
            el.style.top = Math.round(r.top - p.top + r.height / 2 - 12) + 'px';
            el.style.display = 'flex';
        });
    }

    /* ================================================================== */
    /* Zart munkaablak                                                     */
    /*                                                                     */
    /* Merve: a munkapontzarat a .job_rightSide.job_overlay jelzi, a       */
    /* csillagsav ilyenkor is mutatja a friss munkapontot, a Beans         */
    /* jobpoints erteke viszont ures.                                      */
    /* ================================================================== */

    var ZART_GOMBOK = [
    {
        mod: 'munkapont',
        felirat: 'Munkapont',
        kep: CSAKANY,
        buborek: '<b>Munkapont</b><br>Felveszi a legtöbb munkapontot adó ruhát, ami kinyitja a munkát.'
    },
    {
        mod: 'tapasztalat',
        felirat: 'Tapasztalat',
        ikon: '-128px -16px',
        eltolas: [-1, -1],
        buborek: '<b>Tapasztalat</b><br>Felveszi azt a ruhát, ami épp kinyitja a munkát,<br>és a lehető legtöbb tapasztalatot adja.'
    },
    {
        mod: 'gyujtogeto',
        felirat: 'Gyűjtögető',
        ikon: '-32px -48px',
        eltolas: [-1, 0],
        buborek: '<b>Gyűjtögető</b><br>Felveszi azt a ruhát, ami épp kinyitja a munkát,<br>és a lehető legtöbb termékesélyt adja.'
    }];

    // A panel tartalma. Csak akkor epul ujra, ha a munka vagy a ruha valtozott.
    function zartTartalom(ab, panel, jobId)
    {
        var job = jobAdat(jobId);
        if (!job) return;
        var eltelt = Date.now() - allapot.utolsoRuhacsere;
        if (eltelt < FRISSULES_VARAS && !friss(jobId)) return;
        var kulcs = jobId + '|' + allapot.utolsoRuhacsere;
        if (panel.getAttribute('data-kulcs') === kulcs) return;
        panel.setAttribute('data-kulcs', kulcs);

        var mp = ablakMunkapont(ab, job);
        if (!mp) return;
        var hiany = job.nehezseg - mp.ertek;
        var lehetseges = null;
        try
        {
            var alap = mp.ertek - pontosErtek(rajtamIdk(), job.skills, job.id).lp;
            var nativ = west.item.Calculator.getBestSet(job.skills, job.id);
            var idk = teljesOsszeallitas(nativ && nativ.getItems ? nativ.getItems() : []);
            lehetseges = alap + pontosErtek(idk, job.skills, job.id).lp;
        }
        catch (e)
        {
            hiba(e, 'zart panel / legjobb munkaruha');
        }
        var elerhetetlen = lehetseges !== null && lehetseges < job.nehezseg;

        while (panel.firstChild) panel.removeChild(panel.firstChild);
        var sor1 = document.createElement('div');
        sor1.className = OSZTALY + '-hiany';
        sor1.textContent = hiany > 0 ?
            hiany + ' munkapont hiányzik (' + job.nehezseg + ' kell, most ' + mp.ertek + ')' :
            'A munkapontod elég (' + job.nehezseg + ' kell, most ' + mp.ertek + ')';
        panel.appendChild(sor1);

        var sor2 = document.createElement('div');
        sor2.className = OSZTALY + '-sor';
        ZART_GOMBOK.forEach(function (g)
        {
            var el = document.createElement('div');
            el.className = OSZTALY + '-cimkes';
            if (elerhetetlen) el.setAttribute('data-tiltva', '1');
            if (g.kep)
            {
                var kp = document.createElement('img');
                kp.src = g.kep;
                kp.alt = '';
                kp.style.cssText = 'width:16px;height:16px;object-fit:contain';
                el.appendChild(kp);
            }
            else
            {
                var ik = document.createElement('span');
                ik.style.backgroundPosition = g.ikon;
                if (g.eltolas) ik.style.transform = 'translate(' + g.eltolas[0] + 'px,' + g.eltolas[1] + 'px)';
                el.appendChild(ik);
            }
            el.appendChild(document.createTextNode(g.felirat));
            sor2.appendChild(el);
            try
            {
                $(el).addMousePopup(elerhetetlen ?
                    '<b>' + g.felirat + '</b><br>A legjobb munkaruhádban is csak ' + lehetseges + ' munkapontod lenne, ' + job.nehezseg + ' kell.' :
                    g.buborek);
            }
            catch (e)
            {
                hiba(e, 'zart buborek');
            }
            el.addEventListener('mousedown', function (e)
            {
                e.stopPropagation();
            });
            el.addEventListener('click', function (e)
            {
                e.stopPropagation();
                e.preventDefault();
                if (elerhetetlen || allapot.dolgozik) return;
                inditas(ab, g.mod);
            });
        });
        panel.appendChild(sor2);
        gombAllapot();
        if (TESZT) naplo('zart munka ' + jobId + ' ' + job.nev + ' | nehezseg ' + job.nehezseg + ' | munkapont most ' + mp.ertek +
            ' (' + mp.forras + ') | legjobb munkaruhaban ' + lehetseges);
    }

    function zartPanel(ab, pane)
    {
        var zar = ab.querySelector('.job_rightSide.job_overlay');
        var panel = pane.querySelector('.' + OSZTALY + '-zart');
        if (!zar)
        {
            if (panel) panel.style.display = 'none';
            return;
        }
        var jobId = jobIdAblakbol(ab);
        if (jobId === null) return;
        if (!panel)
        {
            panel = document.createElement('div');
            panel.className = OSZTALY + '-zart';
            pane.appendChild(panel);
        }
        zartTartalom(ab, panel, jobId);
        if (!panel.firstChild) return;

        panel.style.display = 'flex';
        var p = pane.getBoundingClientRect();
        var z = zar.getBoundingClientRect();
        var szoveg = zar.querySelector('.job_overlay_text');
        var t = szoveg ? szoveg.getBoundingClientRect() : z;
        panel.style.left = Math.round(z.left - p.left + (z.width - panel.offsetWidth) / 2) + 'px';
        panel.style.top = Math.round((szoveg ? t.top : z.bottom - 60) - p.top - panel.offsetHeight - 10) + 'px';
    }

    /* ================================================================== */
    /* Villam az uti celok ablakainak fejleceben                           */
    /*                                                                     */
    /* Merve (2026-09-30): a kerek gombok (.tw2gui_window_buttons) az      */
    /* ablak tetejen 5-25 px magasan, jobb szeluk mindig ugyanott (724);   */
    /* a szalag a huzhato .tw2gui_inner_window_title, a tartalom 70 px-nel */
    /* kezdodik. A villam az ablakba kerul, nem a szalag elembe, igy a     */
    /* kattintas nem indit huzast. Az utazo vasar osztalyat meg nem        */
    /* mertuk (nem volt elerheto): a TESZT kiirja az uj ablakok osztalyat, */
    /* ha a konzolban bekapcsoljak: smczMunkaruhaAblakNaplo(true).         */
    /* Merve (2026-10-03): a varosi boltok osztalya tailor / gunsmith /    */
    /* general (mind trader is, de a trader-t nem vesszuk, mert mas        */
    /* kereskedoablak is viselheti).                                       */
    /* t25 (MrA): az Eszkozok ablak (wear) is ide kerult; a kalandoszto    */
    /* (window-quest_employer) villamja a Seta gomb melle koltozott.       */
    /* ================================================================== */

    var UTICEL_ABLAKOK = ['townoverview', 'fort', 'tailor', 'gunsmith', 'general', 'wear'];
    var FEJLEC_BUBOREK = '<b>Gyorsszett</b><br>Felveszi a leggyorsabb ruhát, hogy hamarabb odaérj.';
    var latottAblakok = typeof WeakSet === 'function' ? new WeakSet() : null;

    function uticelAblak(ab)
    {
        for (var i = 0; i < UTICEL_ABLAKOK.length; i++)
        {
            if (ab.classList.contains(UTICEL_ABLAKOK[i])) return true;
        }
        return false;
    }

    function fejlecVillam(ab)
    {
        var el = ab.querySelector(':scope > .' + OSZTALY + '-fejlec');
        if (!el)
        {
            el = document.createElement('div');
            el.className = OSZTALY + '-gomb ' + OSZTALY + '-fejlec';
            el.setAttribute('data-mod', 'gyors');
            el.style.zIndex = '10';
            var ik = document.createElement('span');
            ik.style.backgroundPosition = '-96px -32px';
            el.appendChild(ik);
            ab.appendChild(el);
            try
            {
                $(el).addMousePopup(FEJLEC_BUBOREK);
            }
            catch (e)
            {
                hiba(e, 'fejlec buborek');
            }
            el.addEventListener('mousedown', function (e)
            {
                e.stopPropagation();
            });
            el.addEventListener('click', function (e)
            {
                e.stopPropagation();
                e.preventDefault();
                if (allapot.dolgozik) return;
                inditas(ab, 'gyors');
            });
            gombAllapot();
        }
        var g = ab.querySelector(':scope > .tw2gui_window_buttons');
        var gr = g ? g.getBoundingClientRect() : null;
        if (!gr || !gr.width)
        {
            el.style.display = 'none';
            return;
        }
        var a = ab.getBoundingClientRect();
        el.style.left = Math.round(gr.right - a.left - 24) + 'px';
        el.style.top = Math.round(gr.bottom - a.top + 9) + 'px';
        el.style.display = 'flex';
    }

    // TESZT: minden ujonnan megnyitott ablakrol egy sor, hogy uj uti celokat (pl. az utazo
    // vasart) konnyen hozzaadhassunk.
    function ablakNaplo()
    {
        if (!TESZT || !allapot.ablakNaplo || !latottAblakok) return;
        var ablakok = document.querySelectorAll('.tw2gui_window');
        for (var i = 0; i < ablakok.length; i++)
        {
            var ab = ablakok[i];
            if (latottAblakok.has(ab)) continue;
            latottAblakok.add(ab);
            var cim = ab.querySelector('.tw2gui_inner_window_title');
            naplo('uj ablak | cim: ' + (cim ? cim.textContent.replace(/\s+/g, ' ').trim().slice(0, 50) : '?') + ' | osztaly: ' + ab.className);
        }
    }

    /* ================================================================== */
    /* zZ gomb a hotel ablakaban                                           */
    /*                                                                     */
    /* Merve (2026-10-03): az ablak osztalya hotel-<szam> (pl. hotel-2568),*/
    /* az Alvas gomb a jatek haromreszes gombja (div.tw2gui_button,        */
    /* bal es jobb vegzaro, kozepso hatter, textart_title) a .buttonsleep  */
    /* dobozban, 100 x 36. A zZ ugyanebbol a gombbol epul, ugyanolyan      */
    /* magasan, az Alvas bal oldalara (MrA, t25; t20-t24 a szobalista      */
    /* keretenek jobb also sarkaban, t19 az Alvas jobb oldalan volt).      */
    /* Csak atoltoztet, aludni nem kuld; alvas kozben is mukodik (MrA).    */
    /* ================================================================== */

    var ALVAS_BUBOREK = '<b>Alvó ruha</b><br>Felveszi a legjobb regenerációs ruhát. Alvás közben is működik.';

    function hotelAblak(ab)
    {
        for (var i = 0; i < ab.classList.length; i++)
        {
            if (/^hotel-\d+$/.test(ab.classList[i])) return true;
        }
        return false;
    }

    /* ================================================================== */
    /* Gomb a jatek akciogombja (Seta, Alvas) bal oldalan (t25, MrA)       */
    /*                                                                     */
    /* Merve (2026-10-09): a Seta es az Alvas 100 x 36-os tw2gui_button.   */
    /* Hotel: .buttonsleep; kalandoszto: .fingerboard (az ablak            */
    /* window-quest_employer); utmutato tabla: parbeszedablak              */
    /* (tw2gui_dialog), a gombsor .tw2gui_dialog_actions, az elso gomb a   */
    /* Seta (mas script utana tehet sajat gombot, majd a Megse jon).    */
    /* A gomb negyzet, az akciogomb magassagaval, AKCIO_RES px-re balra,   */
    /* a helyet minden korben az akciogomb tenyleges helyebol szamoljuk.   */
    /* Merve (2026-10-09, t25): a tw2gui_button stilusa margin-top: -2px;  */
    /* a mi gombunk helyet a jatek gombjanak mar eltolt helyebol szamoljuk,*/
    /* ezert a sajat margonkat nullazzuk (t25-ben 2 px-szel feljebb volt). */
    /* A res t25-ben 6 px volt, MrA szerint tul nagy.                      */
    /* ================================================================== */

    // A gomb es az akciogomb kozti res, pixelben (TESZT-ben a konzolbol allithato).
    var AKCIO_RES = 2;

    function akcioGomb(tarto, akcio, mod, buborek)
    {
        var el = tarto.querySelector('.' + OSZTALY + '-akcio[data-mod="' + mod + '"]');
        var ar = akcio ? akcio.getBoundingClientRect() : null;
        if (!ar || !ar.width)
        {
            if (el) el.style.display = 'none';
            return;
        }
        // Az abszolut hely viszonyitasi doboza: a tarto ablak vagy parbeszedablak, ha
        // pozicionalt, kulonben az akciogomb sajat viszonyitasi doboza.
        var szulo = tarto;
        try
        {
            if (getComputedStyle(tarto).position === 'static' && akcio.offsetParent) szulo = akcio.offsetParent;
        }
        catch (e)
        {}
        if (!el)
        {
            el = document.createElement('div');
            el.className = 'tw2gui_button ' + OSZTALY + '-akcio' + (mod === 'alvas' ? ' ' + OSZTALY + '-alvas' : '');
            el.setAttribute('data-mod', mod);
            el.innerHTML = '<div class="tw2gui_button_right_cap"></div><div class="tw2gui_button_left_cap"></div>' +
                '<div class="tw2gui_button_middle_bg"></div>' +
                (mod === 'alvas' ? '<div class="textart_title">zZ</div>' : '<span class="' + OSZTALY + '-akcioikon"></span>');
            el.style.position = 'absolute';
            el.style.zIndex = '10';
            el.style.margin = '0';
            szulo.appendChild(el);
            try
            {
                $(el).addMousePopup(buborek);
            }
            catch (e)
            {
                hiba(e, 'akciogomb buborek');
            }
            el.addEventListener('mousedown', function (e)
            {
                e.stopPropagation();
            });
            el.addEventListener('click', function (e)
            {
                e.stopPropagation();
                e.preventDefault();
                if (allapot.dolgozik) return;
                inditas(tarto, mod);
            });
            gombAllapot();
        }
        var sr = el.parentNode.getBoundingClientRect();
        var bx = el.parentNode.clientLeft || 0, by = el.parentNode.clientTop || 0;
        var meret = Math.round(ar.height);
        el.style.width = meret + 'px';
        el.style.minWidth = meret + 'px';
        el.style.height = meret + 'px';
        el.style.left = Math.round(ar.left - AKCIO_RES - meret - sr.left - bx) + 'px';
        el.style.top = Math.round(ar.top - sr.top - by) + 'px';
        el.style.display = '';
    }

    function alvasGomb(ab)
    {
        akcioGomb(ab, ab.querySelector('.buttonsleep .tw2gui_button:not(.' + OSZTALY + '-akcio)'), 'alvas', ALVAS_BUBOREK);
    }

    function kalandosztoAblak(ab)
    {
        return ab.classList.contains('window-quest_employer');
    }

    function kalandosztoVillam(ab)
    {
        akcioGomb(ab, ab.querySelector('.fingerboard .tw2gui_button:not(.' + OSZTALY + '-akcio)'), 'gyors', FEJLEC_BUBOREK);
    }

    // Utmutato tabla (t26): a parbeszedablak tartalmaban a tabla kepe van
    // (.fingerboard_dialog, images/fingerboard/fingerboard.png; merve 2026-10-09), ez
    // nyelvfuggetlen. A Guidepost.show-hoz nem nyulunk: mas script a forrasszovegebol forditja
    // ujra, igy egy csomagolo eltori (t25-ben a tabla nem nyilt meg).
    function utmutatoParbeszed(d)
    {
        if (d.getAttribute('data-smcz-utmutato') === '1') return true;
        if (d.getAttribute('data-smcz-utmutato') === '0') return false;
        var tartalom = d.querySelector('.tw2gui_dialog_content');
        if (!tartalom) return false;
        var ok = !!tartalom.querySelector('.fingerboard_dialog img[src*="fingerboard/fingerboard"]');
        d.setAttribute('data-smcz-utmutato', ok ? '1' : '0');
        if (TESZT) naplo('parbeszedablak: ' + (ok ? 'utmutato tabla' : 'mas'));
        return ok;
    }

    function utmutatoVillam(d)
    {
        akcioGomb(d, d.querySelector('.tw2gui_dialog_actions .tw2gui_button:not(.' + OSZTALY + '-akcio)'), 'gyors', FEJLEC_BUBOREK);
    }

    function figyeles()
    {
        try
        {
            ablakNaplo();
            var uticelok = document.querySelectorAll('.tw2gui_window');
            for (var u = 0; u < uticelok.length; u++)
            {
                if (uticelAblak(uticelok[u])) fejlecVillam(uticelok[u]);
                if (hotelAblak(uticelok[u])) alvasGomb(uticelok[u]);
                if (kalandosztoAblak(uticelok[u])) kalandosztoVillam(uticelok[u]);
            }
            var parbeszedek = document.querySelectorAll('.tw2gui_dialog');
            for (var p = 0; p < parbeszedek.length; p++)
            {
                if (utmutatoParbeszed(parbeszedek[p])) utmutatoVillam(parbeszedek[p]);
            }
            var ablakok = document.querySelectorAll('.jobwindow');
            for (var i = 0; i < ablakok.length; i++)
            {
                var ab = ablakok[i];
                var pane = ab.querySelector('.tw2gui_window_content_pane');
                if (!pane) continue;
                if (!pane.querySelector('.' + OSZTALY + '-gomb')) gombokFelrakasa(ab, pane);
                igazitas(ab, pane);
                zartPanel(ab, pane);
            }
        }
        catch (e)
        {
            hiba(e, 'figyeles');
        }
    }

    /* ================================================================== */
    /* Indulas                                                             */
    /* ================================================================== */

    function keszEnAJatek()
    {
        return typeof JobList !== 'undefined' && typeof JobList.getJobById === 'function' &&
            typeof Wear !== 'undefined' && Wear.wear && Wear.slots &&
            typeof Bag !== 'undefined' && typeof ItemManager !== 'undefined' &&
            typeof west !== 'undefined' && west.item && west.item.Calculator && west.storage &&
            typeof Character !== 'undefined' && typeof $ !== 'undefined' && typeof EventHandler !== 'undefined';
    }

    /* ================================================================== */
    /* Frissites (a Kalandsegito t16m kodjanak atvetele, @grant none-ra)   */
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

    function htmlVedes(x)
    {
        return String(x == null ? '' : x).replace(/[&<>"']/g, function (c)
        {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
        });
    }

    var FRISS_ABLAK_ID = 'smcz-munkaruha-frissites';
    var FRISS_ABLAK_CIM = 'Munkaruha-v\u00E1laszt\u00F3 - friss\u00EDt\u00E9s';

    function frissitesAblak(ver, lista, proba)
    {
        var tart = document.createElement('div');
        tart.style.cssText = 'padding:14px 16px;font:14px/1.5 Arial,sans-serif;color:#2b2119;box-sizing:border-box;width:100%';
        var tetelek = (lista || []).map(function (x)
        {
            return "<li style='margin:0 0 4px'>" + htmlVedes(x) + '</li>';
        }).join('');
        tart.innerHTML =
            '<div>\u00DAj verzi\u00F3 \u00E9rhet\u0151 el a Munkaruha-v\u00E1laszt\u00F3b\u00F3l.</div>' +
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

    var varakozo = setInterval(function ()
    {
        if (!keszEnAJatek()) return;
        clearInterval(varakozo);
        stilusBetoltes();
        EventHandler.listen('wear_changed', function ()
        {
            allapot.utolsoRuhacsere = Date.now();
        });
        setInterval(figyeles, FIGYELES_IDOKOZ);
        naplo(VERZIO + ' elindult. Crafted with \u2665 by smcZ - ' + WEBOLDAL);
        if (FRISS_PROBA)
        {
            window.smczMunkaruhaFrissProba = function ()
            {
                frissitesAblak(probaVerzio(VERZIO), VALTOZASOK, true);
            };
            naplo('frissitesablak probaja: smczMunkaruhaFrissProba()');
        }
        if (TESZT)
        {
            window.smczMunkaruhaAblakNaplo = function (be)
            {
                allapot.ablakNaplo = be !== false;
                naplo('uj ablakok kiirasa: ' + (allapot.ablakNaplo ? 'be' : 'ki'));
            };
            naplo('uj ablakok kiirasa (alapbol ki): smczMunkaruhaAblakNaplo(true)');
            window.smczMunkaruhaAkcioRes = function (px)
            {
                AKCIO_RES = Number(px) || 0;
                naplo('res a Seta / Alvas gomb mellett: ' + AKCIO_RES + ' px');
            };
            naplo('res a Seta / Alvas mellett (most ' + AKCIO_RES + ' px): smczMunkaruhaAkcioRes(4)');
        }
        frissitestKeres();
        setInterval(frissitestKeres, FRISS_IDOKOZ);
    }, 500);
})();
