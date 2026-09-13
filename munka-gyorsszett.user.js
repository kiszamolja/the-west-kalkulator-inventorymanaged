// ==UserScript==
// @name         Munka gyorsszett
// @namespace    smcZproject
// @version      0.5.4
// @description  Tavoli munka betetele gyors szettben, majd visszaoltozes a kiindulasi ruhara. Onallo, kulso script nelkul is fut.
// @author       smcZ
// @homepageURL  https://kiszamolja.github.io/the-west-kalkulator-inventorymanaged/
// @updateURL    https://kiszamolja.github.io/the-west-kalkulator-inventorymanaged/munka-gyorsszett.user.js
// @downloadURL  https://kiszamolja.github.io/the-west-kalkulator-inventorymanaged/munka-gyorsszett.user.js
// @include      https://*.the-west.*/game.php*
// @grant        none
// ==/UserScript==

/*
    MUKODES

    1. Elkapjuk a munkat a TaskQueue.add-ben, mielott bekerulne a sorba, es varosorba tesszuk.
    2. Munkanal megnezzuk, van-e tenyleges tavolsag a sor vegetol a munka helyeig.
    3. Ha nincs, a munka valtozatlanul bemegy, nem oltozunk.
    3b. Setanal nem merunk tavolsagot: az utjelzo tabla csak akkor jon fel,
        ha tenylegesen utazni kell, tehat a tavolsag adott.
    4. Ha van, felvesszuk a gyors szettet, es UTANA tesszuk be a munkat.
       Igy a szerver a rovidebb odauttal szamol.
    5. Tobb munka eseten a gyors szett rajtunk marad, es csak a vegen oltozunk vissza.
    6. A vegen visszaall a kiindulasi ruha.

    KET UT A GYORS SZETTHEZ

    - Ha beallitottal mentett szettet, azt egyetlen keressel vesszuk fel, merve 200 es 240 ms kozott.
    - Ha nem, a beepitett szamitas allitja ossze a legjobbat, es darabonkent oltozunk, ami lassabb.
      Ilyenkor egyszer szolunk, hogy erdemes beallitani.

    A visszaoltozes is egyetlen keres, ha a kiindulasi ruhad pontosan megegyezik valamelyik
    mentett szetteddel. Ilyenkor a script kereseinek szama es alakja megegyezik azzal,
    mintha kezzel valtanal ket mentett szett kozott. Csak akkor oltozunk darabonkent,
    ha olyan osszeallitas van rajtad, ami egyik mentett szettel sem egyezik.

    MERT TENYEK, AMIKRE EPUL

    - A setaido a sorba tetelkor rogzul. Seta kozbeni atoltozes nem valtoztatja a wayData.date_done erteket.
    - A munka kimenetelet a szerver a vegrehajtaskor szamolja, nem a sorba tetelkor.
    - A tavolsagot a sor vegetol kell merni, nem a jelenlegi poziciotol.
    - A TaskQueue.add a nativ munkaablakbol tombot kap, mas hivoktol egyedi taskot.
    - A munkaablak szorzoja tobb azonos munkat ad at egyszerre, egyetlen tombben.
    - A varosba, erodbe es kuldetesosztohoz setalas ugyanezen az uton jon, walk
      tipussal. A setataskban NINCS koordinata, csak unitId es tipus, es a
      kliensben nincs olyan nyilvantartas sem, amibol az azonositobol
      koordinata lenne (GameMap.Data, interactiveImages, Town.prototype
      mind megmerve). Ezert setanal tavolsagot nem szamolunk.
    - Egy darab sebesseget a speed mezo adja: minel kisebb, annal gyorsabb.
      A pontszam (100 + lovaglas + ms) * (1 + speed / 100).
    - A szettbonuszok szamitanak, ezert nem eleg slotonkent a legjobb darabot valasztani.

    AMI ZSAKUTCANAK BIZONYULT

    - A Guidepost.show rateteles figyelese a setacel megjegyzesehez. Egy masik
      script a fuggvenyt SZOVEGKENT olvassa ki es eval-lal ujra letrehozza,
      amivel a mi fuggvenyunk elveszti a sajat kornyezetet: a benne szereplo
      nevek megszunnek letezni, a hivas kivetellel leall, es az utjelzo tablak
      hasznalhatatlanna valnak. Ezt az utat nem szabad ujra megnyitni.
      A seta celjanak koordinatajat mashonnan kell elovenni.

    - Onallo TaskWalk tetszoleges koordinatara: a post felepul, de a jatek nem teszi a sorba.
      Ezert a seta es a munka nem valaszthato szet, egyetlen munkataskkal dolgozunk.

    ALAPSZABALY

    - A munka SOHA nem veszhet el. Ha barmelyik lepes elhasal, a munka akkor is bemegy.
*/

(function ()
{
    'use strict';

    var NEV = 'Munka gyorsszett';
    var VERZIO = '0.5.4';

    var WEBOLDAL = 'https://kiszamolja.github.io/the-west-kalkulator-inventorymanaged/';
    var FRISS_URL = WEBOLDAL + 'munka-gyorsszett.user.js';

    // Milyen surun nezzuk, van-e uj valtozat, ezredmasodpercben.
    var FRISS_IDOKOZ = 6 * 60 * 60 * 1000;

    var KULCS_BEKAPCSOLVA = 'mgy_bekapcsolva';
    var KULCS_SZETT = 'mgy_szett_nev';

    // Ez alatt a setaido alatt nem eri meg atoltozni, masodpercben.
    var MIN_SETAIDO = 25;
    // Szunet a slotonkenti keresek kozott, ezredmasodpercben.
    // Veletlen szoras, mert a fix utem gepies mintazatot ad.
    var SLOT_SZUNET_MIN = 120;
    var SLOT_SZUNET_SZORAS = 200;
    // Meddig varunk a mentett szett wear_changed jelzesere, ezredmasodpercben.
    var SZETTVALTAS_IDOKORLAT = 15000;
    // Meddig varunk a betetel utan a sor frissulesere, ezredmasodpercben.
    // Ha a szerver elutasitja a betetelt, jelzes soha nem jon, ezert legyen rovid.
    var BETETEL_IDOKORLAT = 2500;

    var allapot = {
        bekapcsolva: false,
        fut: false,
        sajatBetetel: false,
        oltozikEppen: false,
        gyorsbanVagyunk: false,
        pillanatkep: null,
        szettNev: null,
        szettId: null,
        visszaSzettId: null,
        ujVerzio: null,
        lista: null,
        frissitve: false,
        figyelmeztetve: false
    };

    var varo = [];

    function naplo(szoveg, adat)
    {
        if (typeof adat === 'undefined') console.log('[' + NEV + '] ' + szoveg);
        else console.log('[' + NEV + '] ' + szoveg, adat);
    }

    function hiba(e, hol)
    {
        console.error('[' + NEV + '] hiba itt: ' + hol, e);
    }

    function hibaUzenet(szoveg)
    {
        try
        {
            new UserMessage(szoveg, UserMessage.TYPE_ERROR).show();
        }
        catch (e)
        {
            console.error('[' + NEV + '] ' + szoveg);
        }
    }

    /* ================================================================== */
    /* Szettszamitas                                                       */
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

    // N elemu kombinaciok.
    function kombinaciok(tomb, db)
    {
        if (db > tomb.length || db <= 0) return [];
        if (db === tomb.length) return [tomb];
        if (db === 1)
        {
            var egyesek = [];
            for (var i = 0; i < tomb.length; i++) egyesek.push([tomb[i]]);
            return egyesek;
        }
        var ki = [];
        for (var j = 0; j < tomb.length - db + 1; j++)
        {
            var elso = tomb.slice(j, j + 1);
            var tobbi = kombinaciok(tomb.slice(j + 1), db - 1);
            for (var k = 0; k < tobbi.length; k++) ki.push(elso.concat(tobbi[k]));
        }
        return ki;
    }

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
    /* ================================================================== */
    /* Oltozes                                                             */
    /* ================================================================== */

    // Darabonkenti atoltozes. Slotonkent egy keres, a vegen egyszer frissiti a felulet.
    function oltoztet(idk, kesz)
    {
        if (allapot.oltozikEppen)
        {
            naplo('mar fut egy atoltozes, kihagyjuk');
            if (kesz) kesz();
            return;
        }

        var cel = {};
        for (var i = 0; i < idk.length; i++)
        {
            var darab = ItemManager.get(idk[i]);
            if (darab) cel[darab.type] = darab;
        }

        allapot.oltozikEppen = true;

        var utolsoValasz = {};
        var felvettek = [];
        var levettek = [];
        var slotok = Wear.slots;

        function lezarasErvenyesites()
        {
            if ($.isEmptyObject(utolsoValasz)) return;

            WearSet.setUpItems(utolsoValasz.setItems);
            WearSet.workPointBonus = utolsoValasz.workPointBonus;

            for (var a = 0; a < levettek.length; a++)
            {
                Wear.remove(levettek[a].type);
                if (levettek[a].type === 'right_arm') EventHandler.signal('character_weapon_changed', [levettek[a]]);
            }
            for (var r = 0; r < felvettek.length; r++)
            {
                Wear.add(felvettek[r].item_id);
                if (felvettek[r].type === 'right_arm') EventHandler.signal('character_weapon_changed', [felvettek[r]]);
            }

            Bag.updateChanges(utolsoValasz.changes, 'wear');
            CharacterSkills.updateAllBonuspoints(utolsoValasz.bonus.allBonuspoints);
            Character.setSpeed(utolsoValasz.speed);
            Character.calcMaxHealth();
            EventHandler.signal('health', [Character.health, Character.maxHealth]);
            EventHandler.signal('wear_changed', [
            {
                added: felvettek,
                removed: levettek
            }]);
            if (wman.getById(Wear.uid)) Wear.renderWear();
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
            if (index === slotok.length)
            {
                try
                {
                    lezarasErvenyesites();
                }
                catch (e)
                {
                    hiba(e, 'oltoztet / lezaras');
                }
                allapot.oltozikEppen = false;
                if (kesz) kesz();
                return;
            }

            var slot = slotok[index];
            var mostRajtam = Wear.wear[slot];

            if (cel[slot])
            {
                Ajax.remoteCall('inventory', 'carry',
                {
                    item_id: cel[slot].item_id,
                    last_inv_id: Bag.getLastInvId()
                }, kesleltet(function (valasz)
                {
                    if (!valasz.error)
                    {
                        utolsoValasz = valasz;
                        felvettek.push(ItemManager.get(cel[slot].item_id));
                        if (mostRajtam && mostRajtam.obj) levettek.push(mostRajtam.obj);
                    }
                    kovetkezo(index + 1);
                }));
            }
            else
            {
                Ajax.remoteCall('inventory', 'uncarry',
                {
                    last_inv_id: Bag.getLastInvId(),
                    type: slot
                }, kesleltet(function (valasz)
                {
                    if (!valasz.error)
                    {
                        utolsoValasz = valasz;
                        if (mostRajtam && mostRajtam.obj) levettek.push(mostRajtam.obj);
                    }
                    kovetkezo(index + 1);
                }));
            }
        }

        kovetkezo(0);
    }

    // Mentett szett felvetele egyetlen keressel.
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

        equipManagerElokeszit(function ()
        {
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
        });
    }

    /* ================================================================== */
    /* Szettlista                                                          */
    /* ================================================================== */

    function szettLista(kesz)
    {
        try
        {
            Ajax.remoteCallMode('inventory', 'show_equip',
            {}, function (d)
            {
                var lista = (d && d.data) ? d.data : [];

                // A jatek a switchEquip sikerageban ujraepiti a Felszereles kezelo listajat,
                // es ahhoz az EquipManager.list tombot hasznalja. Azt viszont csak a nativ
                // ablak megnyitasa tolti fel. Ha nincs feltoltve, a buildEquipList kivetelt
                // dob, a renderWear es a wear_changed jelzes elmarad, mi pedig hiaba varunk.
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

    // A szettlista gyorsitotarral. Menubol mindig frissitunk.
    function listaBetolt(frissites, kesz)
    {
        if (!frissites && allapot.lista) return kesz(allapot.lista);
        szettLista(function (lista)
        {
            allapot.lista = lista;
            kesz(lista);
        });
    }

    // Megegyezik-e a rajtad levo ruha pontosan valamelyik mentett szettel.
    // Ha igen, a visszaoltozes egyetlen keres lehet tiz helyett.
    function egyezoMentettSzett(lista)
    {
        var rajtam = {};
        for (var i = 0; i < Wear.slots.length; i++)
        {
            var slot = Wear.slots[i];
            rajtam[slot] = Wear.wear[slot] ? Wear.wear[slot].getId() : 0;
        }

        for (var j = 0; j < lista.length; j++)
        {
            var szett = lista[j];
            var egyezik = true;
            for (var k = 0; k < Wear.slots.length; k++)
            {
                var s2 = Wear.slots[k];
                if (!(s2 in szett)) continue;
                if ((szett[s2] || 0) !== rajtam[s2])
                {
                    egyezik = false;
                    break;
                }
            }
            if (egyezik) return szett.equip_manager_id;
        }
        return null;
    }

    // Csak akkor hivjunk switchEquip-et, ha a lista mar tomb.
    function equipManagerElokeszit(kesz)
    {
        try
        {
            if (EquipManager.list && typeof EquipManager.list.sort === 'function') return kesz();
        }
        catch (e)
        {}
        szettLista(function ()
        {
            kesz();
        });
    }

    function gyorsSzettIdFeloldas(kesz)
    {
        if (!allapot.szettNev) return kesz(null);
        if (allapot.szettId) return kesz(allapot.szettId);

        listaBetolt(false, function (lista)
        {
            for (var i = 0; i < lista.length; i++)
            {
                if (lista[i].name === allapot.szettNev)
                {
                    allapot.szettId = lista[i].equip_manager_id;
                    return kesz(allapot.szettId);
                }
            }
            naplo('a beallitott szett nem talalhato: ' + allapot.szettNev);
            kesz(null);
        });
    }

    /* ================================================================== */
    /* Segedek                                                             */
    /* ================================================================== */

    function wearPillanatkep()
    {
        var idk = [];
        for (var k in Wear.wear)
        {
            if (Wear.wear[k]) idk.push(Wear.wear[k].getId());
        }
        return idk;
    }

    function szamoltGyorsSzett()
    {
        try
        {
            var sz = new Szamito(
            {
                skills: 'ms'
            });
            var lista = sz.legjobb();
            if (!lista.length) return [];
            return sz.hasznaltDarabok(lista[0]) || [];
        }
        catch (e)
        {
            hiba(e, 'szamoltGyorsSzett');
            return [];
        }
    }

    // A sor vegenek koordinataja. Ures sor eseten a jelenlegi pozicio.
    function sorVege()
    {
        var x = Character.position.x;
        var y = Character.position.y;
        for (var i = 0; i < TaskQueue.queue.length; i++)
        {
            var w = TaskQueue.queue[i].wayData;
            if (w && w.x)
            {
                x = w.x;
                y = w.y;
            }
        }
        return {
            x: x,
            y: y
        };
    }

    // Van-e eleg szabad hely a sorban. Tele sor eseten a szerver eldobja a betetelt,
    // es ilyenkor taskqueue-updated jelzes sem jon.
    function vanHely(darab)
    {
        try
        {
            var hatar = Premium.hasBonus('automation') ? TaskQueue.limit.premium : TaskQueue.limit.normal;
            if (!hatar) return true;
            return (TaskQueue.queue.length + darab) <= hatar;
        }
        catch (e)
        {
            hiba(e, 'vanHely');
            return true;
        }
    }

    function setaido(cel)
    {
        try
        {
            if (!cel || !cel.x || !cel.y) return 0;
            return GameMap.calcWayTime(sorVege(), cel) || 0;
        }
        catch (e)
        {
            hiba(e, 'setaido');
            return 0;
        }
    }

    /* ================================================================== */
    /* Frissiteskereses                                                    */
    /*                                                                     */
    /* A Tampermonkey sajat utemben nez frissitest, es a jelzese a bongeszo */
    /* eszkoztaraban ul, ami jatek kozben konnyen elkerulhetok. Ezert magunk */
    /* is megnezzuk: letoltjuk a fajlt, es osszevetjuk a @version sorat.     */
    /* ================================================================== */

    // Verziok osszevetese. Igaz, ha az elso ujabb a masodiknal.
    function ujabbE(a, b)
    {
        var x = String(a).split('.');
        var y = String(b).split('.');
        for (var i = 0; i < Math.max(x.length, y.length); i++)
        {
            var xi = parseInt(x[i] || '0', 10);
            var yi = parseInt(y[i] || '0', 10);
            if (isNaN(xi) || isNaN(yi)) return false;
            if (xi > yi) return true;
            if (xi < yi) return false;
        }
        return false;
    }

    function frissitestKeres()
    {
        try
        {
            fetch(FRISS_URL + '?v=' + Date.now(),
            {
                cache: 'no-store'
            }).then(function (v)
            {
                return v.text();
            }).then(function (szoveg)
            {
                var talalat = szoveg.match(/@version\s+(\S+)/);
                if (!talalat) return;
                if (!ujabbE(talalat[1], VERZIO)) return;
                allapot.ujVerzio = talalat[1];
                naplo('uj valtozat elerheto: ' + allapot.ujVerzio);
                ikonFrissites();
            }).catch(function ()
            {
                // Nem baj, ha nem megy. Legkozelebb ujra megnezzuk.
            });
        }
        catch (e)
        {
            hiba(e, 'frissitestKeres');
        }
    }

    /* ================================================================== */
    /* Munkafeldolgozas                                                    */
    /* ================================================================== */

    // Betetel, es varakozas a sor frissulesere, hogy ne fedje at a visszaoltozes.
    function betesz(feladat, kesz)
    {
        var meghivva = false;

        function egyszer()
        {
            if (meghivva) return;
            meghivva = true;
            clearTimeout(ora);
            if (kesz) kesz();
        }

        function figyelo()
        {
            egyszer();
            return EventHandler.ONE_TIME_EVENT;
        }

        var ora = setTimeout(function ()
        {
            naplo('a sor nem frissult idoben, tovabblepunk');
            egyszer();
        }, BETETEL_IDOKORLAT);

        allapot.sajatBetetel = true;
        try
        {
            EventHandler.listen('taskqueue-updated', figyelo);
            TaskQueue.add(feladat);
        }
        catch (e)
        {
            hiba(e, 'betesz');
            hibaUzenet('A munkát nem sikerült a sorba tenni, vedd fel újra.');
            egyszer();
        }
        finally
        {
            allapot.sajatBetetel = false;
        }
    }

    function mindentBetesz()
    {
        while (varo.length) betesz(varo.shift().feladat, null);
    }

    function folytat(tetel)
    {
        betesz(tetel.feladat, function ()
        {
            allapot.fut = false;
            feldolgoz();
        });
    }

    function lezar()
    {
        if (!allapot.gyorsbanVagyunk || !allapot.pillanatkep)
        {
            allapot.pillanatkep = null;
            allapot.fut = false;
            return;
        }

        var vissza = allapot.pillanatkep;
        var visszaId = allapot.visszaSzettId;
        allapot.pillanatkep = null;
        allapot.visszaSzettId = null;

        function utana()
        {
            allapot.gyorsbanVagyunk = false;
            allapot.fut = false;
            naplo('kesz, a ruha visszaallt');
            if (varo.length) feldolgoz();
        }

        if (visszaId)
        {
            mentettSzettFelvetel(visszaId, utana);
            return;
        }

        oltoztet(vissza, utana);
    }

    function feldolgoz()
    {
        if (allapot.fut) return;

        if (!varo.length)
        {
            lezar();
            return;
        }

        allapot.fut = true;

        var tetel = varo.shift();

        // Ha nincs eleg hely, ne oltozzunk feleslegesen. A munka ugyanugy megy be,
        // mint script nelkul, es a jatek adja a szokasos visszajelzest.
        if (!vanHely(tetel.darab))
        {
            naplo('nincs eleg hely a sorban (' + TaskQueue.queue.length + '), a munka valtozatlanul megy be');
            folytat(tetel);
            return;
        }

        // Munkanal a tavolsagot merjuk. Setanal nincs cel, es nem is kell:
        // az utjelzo tabla csak akkor jon fel, ha utazni kell.
        var seta = !tetel.cel;
        var ido = seta ? null : setaido(tetel.cel);

        if ((!seta && ido < MIN_SETAIDO) || allapot.gyorsbanVagyunk)
        {
            folytat(tetel);
            return;
        }

        allapot.pillanatkep = wearPillanatkep();
        allapot.visszaSzettId = null;
        naplo('gyors szett felvetele, ' + (seta ? 'seta' :
            'setaido ' + Math.round(ido) + ' mp, munkak: ' + tetel.darab));

        // Ha van beallitott mentett szett, egyetlen keressel megy. Ha nincs, darabonkent.
        listaBetolt(false, function (lista)
        {
            allapot.visszaSzettId = egyezoMentettSzett(lista);

            // Ha a gyorsitotarral nincs egyezes, lehet, hogy kozben atmentettel egy szettet.
            // Egyszer frissitunk es ujraprobaljuk, mielott a lassabb utra esnenk vissza.
            if (!allapot.visszaSzettId && !allapot.frissitve)
            {
                allapot.frissitve = true;
                listaBetolt(true, function (frissLista)
                {
                    allapot.visszaSzettId = egyezoMentettSzett(frissLista);
                    visszautNaplo();
                    gyorsSzettFelvetel(tetel);
                });
                return;
            }

            visszautNaplo();
            gyorsSzettFelvetel(tetel);
        });
    }

    function visszautNaplo()
    {
        if (allapot.visszaSzettId) naplo('a kiindulasi ruha mentett szett, a visszaut egy keres lesz');
        else naplo('a kiindulasi ruha nem mentett szett, a visszaut darabonkent megy');
    }

    function gyorsSzettFelvetel(tetel)
    {
        gyorsSzettIdFeloldas(function (id)
        {
            if (id && allapot.visszaSzettId === id)
            {
                // Mar a gyors szett van rajtad, nincs mit cserelni oda vissza.
                naplo('mar a gyors szett van rajtad, nem oltozunk');
                allapot.pillanatkep = null;
                allapot.visszaSzettId = null;
                folytat(tetel);
                return;
            }

            if (id)
            {
                mentettSzettFelvetel(id, function ()
                {
                    allapot.gyorsbanVagyunk = true;
                    folytat(tetel);
                });
                return;
            }

            if (!allapot.figyelmeztetve)
            {
                allapot.figyelmeztetve = true;
                hibaUzenet('Nincs beállított gyors szett. Koppints az ikonra a beállításhoz.');
            }

            var idk = szamoltGyorsSzett();
            if (!idk.length)
            {
                naplo('nem sikerult osszeallitast szamolni, a munka valtozatlanul megy be');
                allapot.pillanatkep = null;
                folytat(tetel);
                return;
            }

            oltoztet(idk, function ()
            {
                allapot.gyorsbanVagyunk = true;
                folytat(tetel);
            });
        });
    }

    /* ================================================================== */
    /* Elkapas                                                             */
    /* ================================================================== */

    function elkapasBekotes()
    {
        var eredetiAdd = TaskQueue.add;

        TaskQueue.add = function (t)
        {
            try
            {
                if (allapot.sajatBetetel) return eredetiAdd.apply(this, arguments);
                if (!allapot.bekapcsolva) return eredetiAdd.apply(this, arguments);
                if (allapot.oltozikEppen && !allapot.fut) return eredetiAdd.apply(this, arguments);

                // A nativ ablak szorzoval tobb taskot ad at egyszerre, tombben.
                // Ilyenkor is dolgoznunk kell, csak a tomb egeszet kezeljuk egy tetelkent.
                var tomb = Array.isArray(t) ? t : [t];
                if (!tomb.length) return eredetiAdd.apply(this, arguments);

                var cel = null;

                var csupaMunka = true;
                for (var m = 0; m < tomb.length; m++)
                {
                    if (!tomb[m] || tomb[m].type !== 'job' || !tomb[m].post) csupaMunka = false;
                }

                if (csupaMunka)
                {
                    cel = {
                        x: Number(tomb[0].post.x),
                        y: Number(tomb[0].post.y)
                    };
                }
                else if (tomb.length === 1 && tomb[0] && tomb[0].type === 'walk')
                {
                    // SETA varosba, erodbe vagy kuldetesosztohoz.
                    //
                    // Itt NEM szamolunk tavolsagot, es nincs is ra szukseg:
                    // az utjelzo tabla csak akkor jon fel, ha tenylegesen
                    // utazni kell. Ha mar ott allnal, nincs mire kattintani.
                    // A setataskban egyebkent sincs koordinata, csak unitId,
                    // es a kliensben nincs olyan nyilvantartas, amibol az
                    // azonositobol koordinata lenne. Mind a kettot megmertuk.
                    cel = null;
                }
                else
                {
                    return eredetiAdd.apply(this, arguments);
                }

                if (cel && (!cel.x || !cel.y)) return eredetiAdd.apply(this, arguments);

                varo.push(
                {
                    feladat: t,
                    elso: tomb[0],
                    cel: cel,
                    darab: tomb.length
                });
                feldolgoz();
                return;
            }
            catch (e)
            {
                hiba(e, 'TaskQueue.add');
                allapot.fut = false;
                mindentBetesz();
                return eredetiAdd.apply(this, arguments);
            }
        };
    }

    /* ================================================================== */
    /* Kezelofelulet                                                       */
    /* ================================================================== */

    function ikonFrissites()
    {
        var ikon = $('#mgy_ikon');
        if (!ikon.length) return;

        ikon.css('background', allapot.bekapcsolva ? '#2f6f3e' : '#5a4632');

        // Uj valtozat eseten zold keret es egy pott, mint a panelnal.
        if (allapot.ujVerzio)
        {
            ikon.css(
            {
                'position': 'relative',
                'border': '1px solid #7fb08a'
            });
            if (!ikon.find('.mgy-pott').length)
            {
                $('<span class="mgy-pott"></span>').text('\u2022').css(
                {
                    'position': 'absolute',
                    'right': '-3px',
                    'top': '-8px',
                    'color': '#7fb08a',
                    'font-size': '20px',
                    'line-height': '1'
                }).appendTo(ikon);
            }
        }
        else
        {
            ikon.css('border', '');
            ikon.find('.mgy-pott').remove();
        }

        ikon.attr('title', NEV + ' ' + VERZIO +
            (allapot.ujVerzio ? '<br><span style="color:#7fb08a">Új változat: ' + allapot.ujVerzio + '</span>' : '') +
            '<br>Kattintás: menü' +
            '<br>Gyors szett: ' + (allapot.szettNev || 'nincs beállítva') +
            '<br>Állapot: ' + (allapot.bekapcsolva ? 'bekapcsolva' : 'kikapcsolva') +
            '<br>Crafted with <span style="color:#e05a5a">&#10084;</span> by smcZ');
    }

    function kapcsol()
    {
        allapot.bekapcsolva = !allapot.bekapcsolva;
        try
        {
            localStorage.setItem(KULCS_BEKAPCSOLVA, allapot.bekapcsolva ? '1' : '0');
        }
        catch (e)
        {}
        ikonFrissites();
    }

    // Osszerakja a legjobb osszeallitast es fel is veszi, hogy elmenthesd.
    function osszerakas()
    {
        if (allapot.oltozikEppen)
        {
            hibaUzenet('Eppen fut egy atoltozes, varj egy kicsit.');
            return;
        }

        var idk = szamoltGyorsSzett();

        if (!idk.length)
        {
            hibaUzenet('Nem sikerult osszeallitast szamolni.');
            return;
        }

        menuBezar();
        naplo('osszerakas indul, ' + idk.length + ' darab');

        oltoztet(idk, function ()
        {
            naplo('osszerakas kesz');
            var uzenet = 'Ez a leggyorsabb összeállításod. ' +
                'Mentsd el a Felszerelés kezelőben tetszőleges néven, ' +
                'majd koppints az ikonra, és válaszd ki a listából.';
            try
            {
                new UserMessage(uzenet, UserMessage.TYPE_HINT).show();
            }
            catch (e)
            {
                naplo(uzenet);
            }
        });
    }

    function szettValasztas()
    {
        allapot.frissitve = false;
        listaBetolt(true, function (lista)
        {
            if (!lista.length)
            {
                hibaUzenet('Nem sikerult lekerni a szettlistat.');
                return;
            }
            menuTartalom(lista.map(function (s)
            {
                return {
                    cimke: s.name,
                    hivas: function ()
                    {
                        allapot.szettNev = s.name;
                        allapot.szettId = s.equip_manager_id;
                        allapot.figyelmeztetve = false;
                        try
                        {
                            localStorage.setItem(KULCS_SZETT, allapot.szettNev);
                        }
                        catch (e)
                        {}
                        naplo('gyors szett beallitva: ' + allapot.szettNev);
                        menuBezar();
                        ikonFrissites();
                    }
                };
            }));
        });
    }

    function menuBezar()
    {
        $('#mgy_menu').remove();
    }

    function menuTartalom(tetelek)
    {
        menuBezar();

        var doboz = $('<div id="mgy_menu"></div>').css(
        {
            'position': 'absolute',
            'z-index': 1000,
            'background': '#2b1f14',
            'border': '2px solid #8a6a3a',
            'border-radius': '4px',
            'padding': '4px',
            'min-width': '170px',
            'max-height': '320px',
            'overflow-y': 'auto',
            'box-shadow': '0 3px 10px rgba(0,0,0,0.6)'
        });

        tetelek.forEach(function (t)
        {
            var elem = $('<div></div>');

            if (t.szinez)
            {
                // A szivet kulon szinezzuk, a tobbi szoveg marad a menu szinevel.
                var reszek = t.cimke.split('\u2764');
                elem.append(document.createTextNode(reszek[0]));
                elem.append($('<span></span>').css('color', '#e05a5a').text('\u2764'));
                elem.append(document.createTextNode(reszek.length > 1 ? reszek[1] : ''));
            }
            else
            {
                elem.text(t.cimke);
            }

            elem.css(
            {
                'padding': '7px 10px',
                'color': t.kiemel ? '#7fb08a' : '#f0d9a8',
                'font-size': t.szinez ? '11px' : '12px',
                'cursor': 'pointer',
                'border-bottom': '1px solid #4a3826',
                'text-align': t.szinez ? 'center' : 'left',
                'opacity': t.szinez ? 0.85 : 1
            }).on('mouseenter', function ()
            {
                $(this).css('background', '#4a3826');
            }).on('mouseleave', function ()
            {
                $(this).css('background', 'transparent');
            }).on('click', function (e)
            {
                e.stopPropagation();
                t.hivas();
            }).appendTo(doboz);
        });

        $('body').append(doboz);

        var hely = $('#mgy_gomb').offset();
        if (hely)
        {
            var bal = hely.left - 140;
            if (bal < 4) bal = 4;
            doboz.offset(
            {
                top: hely.top + 30,
                left: bal
            });
        }

        setTimeout(function ()
        {
            $(document).one('click.mgy', menuBezar);
        }, 50);
    }

    function menuNyit()
    {
        var tetelek = [];

        if (allapot.ujVerzio)
        {
            tetelek.push(
            {
                cimke: 'Frissítés ' + allapot.ujVerzio + ' verzióra',
                kiemel: true,
                hivas: function ()
                {
                    menuBezar();
                    window.open(FRISS_URL, '_blank');
                }
            });
        }

        tetelek.push.apply(tetelek, [
        {
            cimke: allapot.bekapcsolva ? 'Kikapcsolás' : 'Bekapcsolás',
            hivas: function ()
            {
                kapcsol();
                menuBezar();
            }
        },
        {
            cimke: 'Legjobb összeállítás felvétele',
            hivas: osszerakas
        },
        {
            cimke: 'Mentett gyors szett kiválasztása',
            hivas: szettValasztas
        },
        {
            cimke: 'Crafted with \u2764 by smcZ',
            szinez: true,
            hivas: function ()
            {
                menuBezar();
                window.open(WEBOLDAL, '_blank');
            }
        }]);

        menuTartalom(tetelek);
    }

    function feluletBekotes()
    {
        var ikon = $('<div id="mgy_ikon"></div>').attr(
        {
            'class': 'menulink'
        }).css(
        {
            'background': '#5a4632',
            'color': '#f0d9a8',
            'font-weight': 'bold',
            'font-size': '11px',
            'line-height': '25px',
            'text-align': 'center',
            'user-select': 'none'
        }).text('GY').on('click', function (e)
        {
            // Nincs rejtett mozdulat: a koppintas mindig a menut nyitja,
            // igy telefonon is minden elerheto. A be- es kikapcsolas a menu
            // elso tetele, az ikon szine pedig mutatja az allapotot.
            e.stopPropagation();
            menuNyit();
        });

        $('#ui_menubar').append($('<div></div>').attr(
        {
            'class': 'ui_menucontainer',
            'id': 'mgy_gomb'
        }).append(ikon).append($('<div class="menucontainer_bottom"></div>')));

        ikonFrissites();
    }

    /* ================================================================== */
    /* Indulas                                                             */
    /* ================================================================== */

    function keszEnAJatek()
    {
        return typeof TaskQueue !== 'undefined' && TaskQueue.queue &&
            typeof GameMap !== 'undefined' && GameMap.calcWayTime &&
            typeof Wear !== 'undefined' && Wear.wear && Wear.slots &&
            typeof Bag !== 'undefined' && Bag.loaded &&
            typeof ItemManager !== 'undefined' && ItemManager.isLoaded && ItemManager.isLoaded() &&
            typeof west !== 'undefined' && west.storage && west.storage.ItemSetManager &&
            west.storage.ItemSetManager._initialized &&
            typeof EquipManager !== 'undefined' && typeof EquipManager.switchEquip === 'function' &&
            typeof CharacterSkills !== 'undefined' && typeof Premium !== 'undefined' &&
            typeof $ !== 'undefined' && $('#ui_menubar').length;
    }

    function indulas()
    {
        try
        {
            allapot.bekapcsolva = localStorage.getItem(KULCS_BEKAPCSOLVA) === '1';
            allapot.szettNev = localStorage.getItem(KULCS_SZETT) || null;
        }
        catch (e)
        {}

        elkapasBekotes();
        feluletBekotes();

        frissitestKeres();
        setInterval(frissitestKeres, FRISS_IDOKOZ);
        naplo(NEV + ' ' + VERZIO + ' elindult, allapot: ' + (allapot.bekapcsolva ? 'be' : 'ki') +
            ', gyors szett: ' + (allapot.szettNev || 'nincs beallitva'));
    }

    var probalkozas = 0;
    var varakozo = setInterval(function ()
    {
        probalkozas++;
        if (keszEnAJatek())
        {
            clearInterval(varakozo);
            indulas();
            return;
        }
        if (probalkozas > 180)
        {
            clearInterval(varakozo);
            console.error('[' + NEV + '] a jatek nem toltodott be idoben, a script nem indul el.');
        }
    }, 500);

})();
