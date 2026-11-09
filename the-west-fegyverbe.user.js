// ==UserScript==
// @name         The West Fegyverbe!
// @namespace    smcZproject
// @version      1.0.2
// @description  Erődharc segítő a natív erődharc ablakhoz: egér buborék (ki kit lő várhatóan), veszélyzóna, Most / Felkészülés / Várható erő / Statisztika panel, jelölés a térkép és a panel között. A natív ablak szerver válaszait passzívan olvassa; saját kérést csak a gombok küldenek (Lista, Ruhák, Korábbi EH, rangosztás).
// @author       smcZ
// @homepageURL  https://kiszamolja.github.io/the-west-kalkulator-inventorymanaged/
// @match        https://*.the-west.hu/game.php*
// @match        https://*.the-west.net/game.php*
// @run-at       document-idle
// @noframes
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_deleteValue
// @grant        GM_openInTab
// @grant        GM_xmlhttpRequest
// @grant        unsafeWindow
// @connect      kiszamolja.github.io
// @updateURL    https://kiszamolja.github.io/the-west-kalkulator-inventorymanaged/the-west-fegyverbe.user.js
// @downloadURL  https://kiszamolja.github.io/the-west-kalkulator-inventorymanaged/the-west-fegyverbe.user.js
// ==/UserScript==

(function () {
  'use strict';
var ErodharcMag = (function () {
  'use strict';
  var NINCS = 0xffff;
  var RANG_KULCS = ['traitor', 'reservist', 'recruit', 'private', 'sergeant', 'captain', 'major_general', 'general'];
  var OSZTALY = { '-1': 'greenhorn', '0': 'adventurer', '1': 'duelist', '2': 'worker', '3': 'soldier' };
  function rangDekod(v) {
    return { position: (v >> 6) - 1, rank: ((v >> 1) & 31) - 3, isfreelancer: v & 1 };
  }
  function uj() {
    var figyelok = [];
    var A = ujAllapot();
    function ujAllapot() {
      return {
        fortId: null,
        harcId: null,
        szabalyok: null,
        elokeszito: null,
        terkep: null,
        terkepXhr: null,
        jatek: null,
        sajatJatekosId: null,
        kor: 0,
        kovetkezoKor: null,
        zaszloKor: 0,
        jatekosok: [],
        karakterSzerint: {},
        flashSzerint: {},
        westSzerint: {},
        cellaSzerint: {},
        korok: [],
        rangok: {},
        rangCimek: null,
        rangValtozasok: [],
        vezetes: { nyilak: [], atiranyitasok: [], zaszloLemondas: null },
        kapcsolat: { nyitva: false, nyitasok: 0, zarasok: [], utolsoNyitas: null },
        vege: null,
        javitva: false
      };
    }
    function ertesit(tipus, adat) {
      for (var i = 0; i < figyelok.length; i++) { try { figyelok[i](tipus, adat); } catch (e) { } }
    }
    function ujJatekos(c) {
      return {
        karakterId: c.characterid,
        flashId: c.playerid,
        westId: c.westPlayerId,
        nev: c.name,
        osztaly: c.characterclass,
        osztalyKulcs: OSZTALY[String(c.characterclass)] || null,
        szabaduszo: !!c.freelancer,
        oldal: c.team,
        tamado: c.team > 0,
        szint: c.level,
        fegyver: c.weapon,
        sebzesMin: c.damage ? c.damage.damagemin : null,
        sebzesMax: c.damage ? c.damage.damagemax : null,
        varos: c.town,
        avatar: c.avatar,
        eletMax: c.healthmax,
        eletKezdo: c.health,
        elet: c.health,
        pozicio: c.position,
        kezdoPozicio: c.position,
        celCella: c.destinycell,
        online: null,
        csere: false,
        bonusz: c.bonusinfo || null,
        kiutotte: c.killedby !== NINCS && c.killedby != null ? c.killedby : null,
        kiesettKor: c.health <= 0 ? 0 : null,
        okozott: c.causeddamage || 0,
        okozottKoBecsles: 0,
        kapott: 0,
        lovesek: 0, talalat: 0, melle: 0, ko: 0,
        kapottLoves: 0, kapottTalalat: 0, kiteres: 0,
        legnagyobb: 0,
        onlineKorok: 0,
        get halott() { return this.elet <= 0; }
      };
    }
    function index() {
      A.karakterSzerint = {}; A.flashSzerint = {}; A.westSzerint = {}; A.cellaSzerint = {};
      A.jatekosok.forEach(function (p) {
        A.karakterSzerint[p.karakterId] = p;
        A.flashSzerint[p.flashId] = p;
        A.westSzerint[p.westId] = p;
        if (!p.halott) A.cellaSzerint[p.pozicio] = p;
      });
    }
    function jel(fortId, nev, args, ido) {
      ido = ido || Date.now();
      args = args || [];
      var a0 = args[0];
      if (fortId != null) A.fortId = String(fortId);
      switch (nev) {
        case 'connection_opened':
          A.kapcsolat.nyitva = true; A.kapcsolat.nyitasok++; A.kapcsolat.utolsoNyitas = ido;
          ertesit('kapcsolat', A.kapcsolat); break;
        case 'connection_closed':
          A.kapcsolat.nyitva = false; A.kapcsolat.zarasok.push({ ido: ido, vege: !!A.vege });
          ertesit('kapcsolat', A.kapcsolat); break;
        case 'connection_error':
          A.kapcsolat.zarasok.push({ ido: ido, hiba: true }); ertesit('kapcsolat', A.kapcsolat); break;
        case 'received_game_info': jatekInfo(a0, ido); break;
        case 'received_map_info': A.terkep = a0; ertesit('terkep', a0); break;
        case 'received_player_info': jatekosInfo(a0, ido); break;
        case 'received_round_info': korInfo(a0, ido); break;
        case 'received_online_state': onlineAllapot(args[0], args[1], ido); break;
        case 'received_swap_state': csereAllapot(a0); break;
        case 'received_confirmation': visszaigazolas(a0, ido); break;
        case 'received_finish_msg': vegeUzenet(a0, ido); break;
        default: break;
      }
    }
    function jatekInfo(g, ido) {
      if (!g) return;
      A.jatek = g;
      A.sajatJatekosId = g.playerid;
      A.kor = g.roundnumber;
      A.zaszloKor = g.flagroundcounter || 0;
      if (typeof g.starttime === 'number') A.kovetkezoKor = ido + g.starttime;
      alapOnline();
      ertesit('jatek', g);
    }
    function jatekosInfo(pi, ido) {
      if (!pi || !pi.characters) return;
      var regi = A.westSzerint;
      A.jatekosok = pi.characters.map(function (c) {
        var p = ujJatekos(c);
        var r = regi[p.westId];
        if (r) {
          ['okozottKoBecsles', 'kapott', 'lovesek', 'talalat', 'melle', 'ko', 'kapottLoves', 'kapottTalalat',
            'kiteres', 'legnagyobb', 'onlineKorok', 'online', 'kiesettKor', 'eletKezdo', 'kezdoPozicio'].forEach(function (k) { p[k] = r[k]; });
        }
        return p;
      });
      index();
      alapOnline();
      ertesit('jatekosok', A.jatekosok);
    }
    function sajatCsapat() {
      var en = A.sajatJatekosId != null ? A.flashSzerint[A.sajatJatekosId] : null;
      return en ? en.oldal : null;
    }
    function alapOnline() {
      var cs = sajatCsapat();
      if (cs == null) return;
      A.jatekosok.forEach(function (p) {
        if (p.online !== null) return;
        if (p.flashId === A.sajatJatekosId) p.online = true;
        else if (p.oldal === cs) p.online = false;
      });
    }
    function korInfo(ri, ido) {
      if (!ri || !ri.charinfo) return;
      var kor = { szam: ri.roundnumber, ido: ido, zaszloKor: ri.flagroundcounter, lovesek: [], lepesek: [] };
      for (var i = 0; i < ri.charinfo.length; i++) {
        var p = A.jatekosok[i], ci = ri.charinfo[i];
        if (!p || p.halott) continue;
        if (p.online) p.onlineKorok++;
        if (ci.shotat !== NINCS) {
          var c = A.karakterSzerint[ci.shotat];
          if (c) {
            var elotte = c.elet, dmg, koLoves = ci.shotdmg === NINCS;
            if (koLoves) { dmg = Math.max(0, c.elet); c.elet = 0; }
            else { dmg = ci.shotdmg; c.elet -= dmg; }
            p.lovesek++; c.kapottLoves++;
            if (dmg > 0 || koLoves) { p.talalat++; c.kapottTalalat++; } else { p.melle++; c.kiteres++; }
            if (koLoves) { p.ko++; p.okozottKoBecsles += dmg; c.kiutotte = p.karakterId; c.kiesettKor = ri.roundnumber; }
            p.okozott += dmg; c.kapott += dmg;
            if (!koLoves && dmg > p.legnagyobb) p.legnagyobb = dmg;
            if (c.halott) delete A.cellaSzerint[c.pozicio];
            kor.lovesek.push({ lovo: p.karakterId, cel: c.karakterId, sebzes: dmg, ko: koLoves, becsult: koLoves, eletElotte: elotte, eletUtana: c.elet, lovoPoz: p.pozicio, celPoz: c.pozicio });
          }
        }
        if (ci.position !== p.pozicio) {
          var honnan = p.pozicio, hova = ci.position, mas = A.cellaSzerint[hova];
          if (mas && mas !== p) { mas.pozicio = honnan; A.cellaSzerint[honnan] = mas; } else delete A.cellaSzerint[honnan];
          p.pozicio = hova; A.cellaSzerint[hova] = p;
          kor.lepesek.push({ karakter: p.karakterId, honnan: honnan, hova: hova, csere: mas && mas !== p ? mas.karakterId : null });
        }
        p.celCella = ci.destinycell;
        if (ci.bonusinfo) p.bonusz = ci.bonusinfo;
      }
      A.jatekosok.forEach(function (p) { p.csere = false; });
      A.kor = ri.roundnumber;
      A.zaszloKor = ri.flagroundcounter || 0;
      if (typeof ri.nextroundstart === 'number') A.kovetkezoKor = ido + ri.nextroundstart;
      kor.csapatok = csapatok();
      A.korok.push(kor);
      ertesit('kor', kor);
    }
    function onlineAllapot(flashId, online, ido) {
      var p = A.flashSzerint[flashId];
      if (!p || p.halott) return;
      p.online = !!online;
      ertesit('online', p);
    }
    function csereAllapot(flashId) {
      var p = A.flashSzerint[flashId];
      if (p) { p.csere = true; ertesit('csere', p); }
    }
    function visszaigazolas(c, ido) {
      if (!c) return;
      switch (c.opCode) {
        case 0xff03: {
          var p = A.karakterSzerint[c.charid];
          if (p) p.celCella = c.pos;
          ertesit('parancs', { karakter: c.charid, cella: c.pos });
          break;
        }
        case 0xff04:
          A.vezetes.nyilak.push({ ido: ido, kor: A.kor, nyil: c.arrowNum, honnan: c.startPos, hova: c.targetPos });
          ertesit('vezeto_nyil', c); break;
        case 0xff07:
          A.vezetes.atiranyitasok.push({ ido: ido, kor: A.kor, vezeto: c.charId, cella: c.targetPos, csoport: c.group });
          ertesit('atiranyitas', c); break;
        case 0xff08:
          A.vezetes.zaszloLemondas = { ido: ido, kor: A.kor, vezeto: c.charId };
          ertesit('zaszlo_lemondas', c); break;
        default: break;
      }
    }
    function vegeUzenet(msg, ido) {
      var j = msg;
      if (typeof msg === 'string') { try { j = JSON.parse(msg); } catch (e) { return; } }
      if (j && j.json) j = j.json;
      if (!j || !j.attackerlist) return;
      var eredmeny = {};
      j.attackerlist.concat(j.defenderlist || []).forEach(function (s) { eredmeny[s.westid] = s; });
      A.harcId = j.battleid;
      A.vege = { ido: ido, kimenet: j.outcome, korok: j.roundsplayed, maxKor: j.maxrounds, harcId: j.battleid, eredmeny: eredmeny, naplo: naploBont(j.log, j.logtypes) };
      ertesit('vege', A.vege);
    }
    function naploBont(log, tipusok) {
      if (!log || !tipusok) return null;
      var korok = [], kor = null, lepes = null;
      for (var i = 0; i + 1 < log.length; i += 2) {
        var t = tipusok[log[i]], v = log[i + 1];
        if (t === 'ROUNDSTART') { kor = { szam: v, lepesek: [] }; korok.push(kor); lepes = null; continue; }
        if (!kor) { kor = { szam: null, lepesek: [] }; korok.push(kor); }
        switch (t) {
          case 'CHARTURN': lepes = { west: v }; kor.lepesek.push(lepes); break;
          case 'CHARTARGET': if (lepes) lepes.cel = v; break;
          case 'CHARHEALTH': if (lepes) lepes.elet = v; break;
          case 'CHARONLINE': if (lepes) lepes.online = !!v; break;
          case 'SHOOTAT': if (lepes) { lepes.lott = v; lepes.sebzes = 0; } break;
          case 'HIT': if (lepes) { lepes.sebzes = v; lepes.talalt = true; } break;
          case 'KILLED': if (lepes) { lepes.sebzes = v; lepes.ko = true; lepes.talalt = true; } break;
          case 'MOVED': if (lepes) lepes.lepett = v; break;
          default: if (lepes) (lepes.egyeb = lepes.egyeb || []).push([t, v]); break;
        }
      }
      return korok;
    }
    function vegsoOsszesites() {
      if (!A.vege || !A.vege.naplo) return null;
      var o = {};
      function sor(w) { return o[w] || (o[w] = { okozott: 0, kapott: 0, talalat: 0, melle: 0, ko: 0, kapottTalalat: 0, kiteres: 0, legnagyobb: 0, onlineKorok: 0 }); }
      A.vege.naplo.forEach(function (k) {
        k.lepesek.forEach(function (l) {
          var s = sor(l.west);
          if (l.online) s.onlineKorok++;
          if (l.lott == null) return;
          var c = sor(l.lott);
          if (l.talalt) { s.talalat++; c.kapottTalalat++; } else { s.melle++; c.kiteres++; }
          if (l.ko) s.ko++;
          s.okozott += l.sebzes; c.kapott += l.sebzes;
          if (l.sebzes > s.legnagyobb) s.legnagyobb = l.sebzes;
        });
      });
      return o;
    }
    function rangBeallit(westId, adat, forras, ido) {
      var w = String(westId), regi = A.rangok[w];
      var uj = { rank: adat.rank, rangKulcs: RANG_KULCS[adat.rank + 2] || null, position: adat.position, isfreelancer: adat.isfreelancer, forras: forras, ido: ido };
      if (regi && regi.rank !== uj.rank) {
        A.rangValtozasok.push({ ido: ido, westId: w, regi: regi.rank, uj: uj.rank });
        ertesit('rang_valtozas', A.rangValtozasok[A.rangValtozasok.length - 1]);
      }
      A.rangok[w] = uj;
    }
    function chat(elemek, ido) {
      (elemek || []).forEach(function (it) {
        if (!it || it.id !== 'RankingInfo' || !it.payload || !it.payload.ranks) return;
        var r = it.payload.ranks;
        for (var i = 0; i + 1 < r.length; i += 2) rangBeallit(r[i], rangDekod(r[i + 1]), 'RankingInfo', ido);
        ertesit('rangok', A.rangok);
      });
    }
    function rangtabla(szobak, ido, cimek) {
      (szobak || []).forEach(function (s) {
        var r = s.ranks || {};
        for (var w in r) { if (Object.prototype.hasOwnProperty.call(r, w)) rangBeallit(w, r[w], 'szoba', ido); }
      });
      if (cimek) A.rangCimek = cimek;
      ertesit('rangok', A.rangok);
    }
    function xhr(url, keres, valasz, ido) {
      url = String(url || '');
      if (!valasz || typeof valasz !== 'object') return;
      if (/getfortmap/.test(url)) { A.terkepXhr = valasz; ertesit('terkep_xhr', valasz); return; }
      if (/fort_battlepage/.test(url)) {
        var m = /fort_id=(\d+)/.exec(keres || '') || /fort_id=(\d+)/.exec(url);
        if (m) A.fortId = m[1];
        if (valasz.rules) A.szabalyok = valasz.rules;
        if (valasz.playerlist) {
          A.elokeszito = {
            ido: ido, jatekosok: valasz.playerlist, kezdesMp: valasz.startTime, vedo: valasz.isDefender,
            gyakorlat: valasz.maneuver, erodKoord: valasz.fortCoords, sajatCella: valasz.selfpos != null ? valasz.selfpos : valasz.selfIdx,
            sajatCel: valasz.selftarget != null ? valasz.selftarget : valasz.selfTarget
          };
          valasz.playerlist.forEach(function (pl) {
            if (pl.privilege != null) {
              var r = A.rangok[String(pl.player_id)];
              rangBeallit(pl.player_id, { rank: Number(pl.privilege), position: pl.idx, isfreelancer: pl.freelancer ? 1 : 0 }, 'lista', ido);
              if (r && r.forras !== 'lista' && Number(pl.privilege) === r.rank) A.rangok[String(pl.player_id)].forras = r.forras;
            }
          });
          ertesit('elokeszito', A.elokeszito);
        }
      }
    }
    function csapatok() {
      var cs = { 0: ujCsapat(), 1: ujCsapat() };
      A.jatekosok.forEach(function (p) {
        var c = cs[p.tamado ? 1 : 0];
        var o = c.osztalyok[p.osztaly] || (c.osztalyok[p.osztaly] = { el: 0, kiesett: 0, elet: 0 });
        c.letszam++; c.eletMax += p.eletMax;
        if (p.halott) { c.kiesett++; o.kiesett++; }
        else { c.el++; o.el++; c.elet += p.elet; o.elet += p.elet; if (p.online) c.online++; }
      });
      [0, 1].forEach(function (k) { cs[k].szazalek = cs[k].eletMax ? cs[k].elet / cs[k].eletMax : 0; });
      return { vedo: cs[0], tamado: cs[1] };
    }
    function ujCsapat() { return { letszam: 0, el: 0, kiesett: 0, online: 0, elet: 0, eletMax: 0, szazalek: 0, osztalyok: {} }; }
    function felvetel(f, opciok) {
      opciok = opciok || {};
      var esemenyek = f && f.esemenyek ? f.esemenyek : [];
      for (var i = 0; i < esemenyek.length; i++) {
        var e = esemenyek[i], d = e.d;
        if (opciok.eddig && e.t > opciok.eddig) break;
        if (e.k === 'ws' && d) {
          var args = Array.isArray(d.d) ? d.d : [d.d];
          if (d.jel === 'received_online_state' || d.jel === 'received_swap_state') args = Array.isArray(d.d) ? d.d : [d.d];
          jel(d.fort, d.jel, args, e.t);
        } else if (e.k === 'xhr' && d) xhr(d.u, d.keres, d.valasz, e.t);
        else if (e.k === 'chat') chat(d, e.t);
        else if (e.k === 'rangok' && d) rangtabla(d.szobak, e.t, d.cimek);
      }
    }
    return {
      jel: jel, xhr: xhr, chat: chat, rangtabla: rangtabla, felvetel: felvetel,
      allapot: function () { return A; },
      csapatok: csapatok,
      vegsoOsszesites: vegsoOsszesites,
      figyel: function (fn) { figyelok.push(fn); },
      torol: function () { A = ujAllapot(); }
    };
  }
  return { uj: uj, rangDekod: rangDekod, RANG_KULCS: RANG_KULCS, OSZTALY: OSZTALY };
})();
  var W = (typeof unsafeWindow !== 'undefined') ? unsafeWindow : window;
  var NEV = 'The West Fegyverbe!', VERZIO = '1.0.2';
  /* VALTOZASOK KEZDETE */
  var VALTOZASOK = [
    "Javítva: több világon játszva a világok adatai (ruhák, várható erő) összekeveredtek."
  ];
  /* VALTOZASOK VEGE */
  var FRISS_PROBA = false;
  var EPITES = '';
  var CELLA = 15;
  var JELEK = ['received_map_info', 'received_player_info', 'received_game_info', 'received_round_info',
    'received_online_state', 'received_swap_state', 'received_confirmation', 'received_finish_msg',
    'connection_opened', 'connection_closed', 'connection_error'];
  var HO_KOROK = 3;
  var NINCS_POZ = -1;
  var VILAG = String((location && location.hostname) || '').toLowerCase();
  var VILAGOS = { ruha_tar: 1, varos_tar: 1, harc_ertek: 1, eh_archiv: 1, harc_mentes: 1 };
  function kulcs(k) { return VILAGOS[k] && VILAG ? k + '@' + VILAG : k; }
  function olvas(k, alap) { try { var v = GM_getValue(kulcs(k)); return v === undefined ? alap : v; } catch (e) { return alap; } }
  function ir(k, v) { try { GM_setValue(kulcs(k), v); } catch (e) { } }
  Object.keys(VILAGOS).forEach(function (k) { try { if (GM_getValue(k) !== undefined) GM_deleteValue(k); } catch (e) { } });
  var magok = {};
  var aktivFort = null;
  var valtozott = true;
  function EH() { return W.EventHandler && typeof W.EventHandler.listen === 'function' ? W.EventHandler : null; }
  function keresFortok() {
    var eh = EH(), fb = W.FortBattle;
    if (!eh || !fb || !fb.wsClient) return;
    for (var k in fb.wsClient) {
      if (!Object.prototype.hasOwnProperty.call(fb.wsClient, k) || magok[k]) continue;
      figyel(eh, String(k));
    }
  }
  var MENT_MEZOK = ['okozott', 'okozottKoBecsles', 'kapott', 'lovesek', 'talalat', 'melle', 'ko', 'kapottLoves', 'kapottTalalat', 'kiteres', 'legnagyobb', 'onlineKorok', 'kiesettKor', 'kiutotte', 'eletKezdo', 'kezdoPozicio'];
  var MENT_ERVENY = 15 * 60e3;
  var ELSO_KOR = 2;
  var korElso = {}, korUtolso = {}, korHiany = {}, korSzamolt = {}, visszatoltve = {}, visszaSor = {}, hianySor = {};
  function ujjlenyomat(A) {
    var l = A.jatekosok.map(function (p) { return String(p.westId); }).sort().join(','), h = 5381;
    for (var i = 0; i < l.length; i++) h = ((h << 5) + h + l.charCodeAt(i)) | 0;
    return A.jatekosok.length + ':' + (h >>> 0).toString(36);
  }
  function mentesOlvas() { var o = olvas('harc_mentes', {}) || {}, most = Date.now(), v = false; Object.keys(o).forEach(function (k) { if (!o[k] || most - (o[k].ido || 0) > MENT_ERVENY) { delete o[k]; v = true; } }); if (v) ir('harc_mentes', o); return o; }
  function mentesTorol(fortId) { var o = olvas('harc_mentes', {}) || {}; if (o[fortId]) { delete o[fortId]; ir('harc_mentes', o); } }
  function mentesIr(fortId, A) {
    if (!A || !A.jatekosok.length || A.vege) return;
    var j = {}; A.jatekosok.forEach(function (p) { var x = {}; MENT_MEZOK.forEach(function (k) { x[k] = p[k]; }); j[p.westId] = x; });
    var o = olvas('harc_mentes', {}) || {};
    o[fortId] = { ido: Date.now(), ujj: ujjlenyomat(A), kor: A.kor, elso: korElso[fortId], utolso: korUtolso[fortId], szamolt: korSzamolt[fortId] || 0, hiany: korHiany[fortId] || [], jatekosok: j, korok: A.korok.slice(-HO_KOROK), sav: savKor[fortId] };
    ir('harc_mentes', o);
  }
  function visszatolt(fortId, m) {
    if (visszatoltve[fortId]) return;
    var A = m.allapot(); if (!A.jatekosok.length) return;
    visszatoltve[fortId] = true;
    if (A.korok.length) return;
    var M = mentesOlvas()[fortId];
    if (!M || M.ujj !== ujjlenyomat(A)) return;
    A.jatekosok.forEach(function (p) { var x = M.jatekosok[p.westId]; if (x) MENT_MEZOK.forEach(function (k) { if (x[k] !== undefined) p[k] = x[k]; }); });
    A.korok = (M.korok || []).slice();
    korElso[fortId] = M.elso; korUtolso[fortId] = M.utolso; korSzamolt[fortId] = M.szamolt || 0; korHiany[fortId] = (M.hiany || []).slice();
    if (M.sav != null) savKor[fortId] = M.sav;
    visszaSor[fortId] = M.szamolt || 0;
    valtozott = true;
  }
  function figyel(eh, fortId) {
    var m = ErodharcMag.uj(), ctx = {};
    magok[fortId] = { mag: m, ctx: ctx };
    m.figyel(function (tipus, adat) {
      if (tipus === 'vege') { try { harcErtekMent(adat); } catch (e) { hiba('harc vége mentés', e); } try { savHarcVege(fortId, m.allapot()); } catch (e) { hiba('sáv vége', e); } try { mentesTorol(fortId); } catch (e) { } }
      if (tipus === 'kor') {
        try {
          var sz0 = adat.szam, ut = korUtolso[fortId];
          if (ut == null) korElso[fortId] = sz0;
          else if (sz0 > ut + 1) {
            var uj = []; for (var k = ut + 1; k < sz0; k++) uj.push(k);
            korHiany[fortId] = (korHiany[fortId] || []).concat(uj); hianySor[fortId] = uj;
          }
          if (ut == null || sz0 > ut) korUtolso[fortId] = sz0;
          korSzamolt[fortId] = (korSzamolt[fortId] || 0) + 1;
        } catch (e) { hiba('kör számláló', e); }
        try { savKorVege(fortId, m.allapot(), adat); } catch (e) { hiba('sáv kör', e); }
        try { mentesIr(fortId, m.allapot()); } catch (e) { hiba('mentés', e); }
      }
    });
    JELEK.forEach(function (jel) {
      eh.listen('fort_battle_' + fortId + '_' + jel, function () {
        try {
          m.jel(fortId, jel, Array.prototype.slice.call(arguments), Date.now());
          if (jel === 'received_player_info') { try { visszatolt(fortId, m); } catch (e) { hiba('visszatöltés', e); } }
          if (jel === 'received_round_info' || jel === 'received_map_info' || jel === 'received_player_info') aktivFort = fortId;
          valtozott = true;
        } catch (e) { hiba('jel ' + jel, e); }
      }, ctx);
    });
  }
  var hibak = 0;
  function hiba(hol, e) { if (hibak++ < 20) { try { console.warn('[' + NEV + '] ' + hol + ':', e); } catch (x) { } } }
  var modellGyors = { forras: null, M: null };
  function modell(t) {
    if (!t || typeof t.cells !== 'string') return null;
    if (modellGyors.forras === t) return modellGyors.M;
    var w = t.width, h = t.height, cellak = [], szc = {};
    for (var i = 0; i < t.cells.length; i++) cellak.push(t.cells.charAt(i));
    for (var y = 0, j = 0; y < h; y++) for (var x = 0; x < w; x++, j++) (szc[cellak[j]] = szc[cellak[j]] || []).push([x, y]);
    var M = { w: w, h: h, cellak: cellak, szektorCellak: szc };
    modellGyors = { forras: t, M: M };
    return M;
  }
  var arnyek = {};
  function arnyekTolt(fortId) {
    if (arnyek[fortId]) return;
    var G = W.Game; if (!G || !G.serviceURL) return;
    arnyek[fortId] = { kesz: false };
    var img = new Image();
    img.onload = function () {
      try {
        var c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight;
        var x = c.getContext('2d'); x.drawImage(img, 0, 0);
        var w = Math.round(Math.sqrt(img.naturalWidth)), h = Math.round(Math.sqrt(img.naturalHeight));
        if (w * w !== img.naturalWidth || h * h !== img.naturalHeight) { arnyek[fortId] = { hiba: 'méret ' + img.naturalWidth + 'x' + img.naturalHeight }; return; }
        arnyek[fortId] = { kesz: true, w: w, h: h, kepW: img.naturalWidth, adat: x.getImageData(0, 0, c.width, c.height).data };
        valtozott = true;
      } catch (e) { arnyek[fortId] = { hiba: String(e) }; hiba('árnyékolás kép', e); }
    };
    img.onerror = function () { arnyek[fortId] = { hiba: 'betöltés' }; };
    img.src = G.serviceURL + '/getfortfog/' + fortId + '.png';
  }
  function latja(m, a, b) {
    var ax = a % m.w, ay = (a - ax) / m.w, bx = b % m.w, by = (b - bx) / m.w;
    return m.adat[((ay * m.h + by) * m.kepW + (ax * m.w + bx)) * 4 + 3] === 0;
  }
  function lohetIde(A, m, cella, sajatOldal) {
    var l = [];
    A.jatekosok.forEach(function (p) {
      if (p.halott || p.pozicio == null || p.pozicio < 0 || !!p.tamado === sajatOldal) return;
      if (latja(m, p.pozicio, cella)) l.push(p);
    });
    return l;
  }
  function varhatoLovok(A, m, cella, sajatOldal, kivesz) {
    var W_ = m.w, cx = cella % W_, cy = (cella - cx) / W_, ki = [];
    var tars = A.jatekosok.filter(function (q) { return !q.halott && q.pozicio != null && q.pozicio >= 0 && !!q.tamado === sajatOldal && q.pozicio !== cella && q !== kivesz; });
    lohetIde(A, m, cella, sajatOldal).forEach(function (p) {
      var px = p.pozicio % W_, py = (p.pozicio - px) / W_, d = (px - cx) * (px - cx) + (py - cy) * (py - cy), jo = true;
      for (var i = 0; i < tars.length && jo; i++) {
        var t = tars[i].pozicio, tx = t % W_, ty = (t - tx) / W_;
        if ((px - tx) * (px - tx) + (py - ty) * (py - ty) < d && latja(m, p.pozicio, t)) jo = false;
      }
      if (jo) ki.push(p);
    });
    return ki;
  }
  function sajatJatekos(A) { return A.flashSzerint ? A.flashSzerint[A.sajatJatekosId] : null; }
  var ZONA_MINTA = [['ef-z0', '#1e9a34'], ['ef-z1', '#d9b400'], ['ef-z2', '#ff7a00'], ['ef-z3', '#d0140a']];
  function zonaKat(n) { return n === 0 ? 0 : n <= 1 ? 1 : n <= 3 ? 2 : 3; }
  function zonaElo(A, m, sajatOldal, kivesz) {
    var W_ = m.w, tars = [], ell = [];
    A.jatekosok.forEach(function (q) {
      if (q.halott || q.pozicio == null || q.pozicio < 0) return;
      if (!!q.tamado === sajatOldal) { if (q !== kivesz) tars.push(q.pozicio); } else ell.push(q);
    });
    return ell.map(function (p) {
      var px = p.pozicio % W_, py = (p.pozicio - px) / W_, dmin = Infinity;
      for (var i = 0; i < tars.length; i++) {
        var t = tars[i], tx = t % W_, ty = (t - tx) / W_, d = (px - tx) * (px - tx) + (py - ty) * (py - ty);
        if (d < dmin && latja(m, p.pozicio, t)) dmin = d;
      }
      return { p: p, px: px, py: py, dmin: dmin };
    });
  }
  function zonaVarhato(m, elo, cella) {
    var W_ = m.w, cx = cella % W_, cy = (cella - cx) / W_, v = 0, n = 0;
    for (var i = 0; i < elo.length; i++) {
      var e = elo[i];
      if (!latja(m, e.p.pozicio, cella)) continue;
      n++;
      if ((e.px - cx) * (e.px - cx) + (e.py - cy) * (e.py - cy) <= e.dmin) v++;
    }
    return { v: v, n: n };
  }
  function cimke(x, y, szoveg, feher, balra, piros) {
    var w = szoveg.length * 6 + 6, lx = balra ? x - w - 1 : x + 13, ly = y - 12;
    if (ly < 0) ly = y + 16;
    if (lx < 0) lx = x + 13;
    var hat = piros ? '#7a0f0a' : feher ? '#fff' : '#2b2b2b', ir_ = piros ? '#fff' : feher ? '#000' : '#fff';
    return '<rect x="' + lx + '" y="' + ly + '" width="' + w + '" height="13" rx="3" fill="' + hat + '" stroke="' + (feher && !piros ? '#000' : '#fff') + '" stroke-width="1"/>' +
      '<text x="' + (lx + 3) + '" y="' + (ly + 9.5) + '" font-size="10" font-weight="bold" fill="' + ir_ + '" font-family="Arial">' + szoveg + '</text>';
  }
  function keret(x, y, feher) {
    return '<rect x="' + (x - 2) + '" y="' + (y - 2) + '" width="19" height="19" rx="2" fill="none" stroke="#000" stroke-width="3.6"/>' +
      '<rect x="' + (x - 1) + '" y="' + (y - 1) + '" width="17" height="17" rx="2" fill="none" stroke="' + (feher ? '#fff' : '#2b2b2b') + '" stroke-width="2"/>';
  }
  function zonaSvg(A, m) {
    var M = modell(A.terkep), sajat = sajatJatekos(A);
    if (!M || !sajat) return '';
    var so = !!sajat.tamado, cs = CELLA, s = [];
    s.push('<svg width="' + M.w * cs + '" height="' + M.h * cs + '" xmlns="http://www.w3.org/2000/svg" style="position:absolute;left:0;top:0"><defs>');
    ZONA_MINTA.forEach(function (z) {
      s.push('<pattern id="' + z[0] + '" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="2.2" height="5" fill="' + z[1] + '" fill-opacity=".75"/></pattern>');
    });
    s.push('</defs>');
    var elo = zonaElo(A, m, so, sajat);
    for (var i = 0; i < M.w * M.h; i++) {
      var zv = zonaVarhato(m, elo, i);
      s.push('<rect x="' + (i % M.w) * cs + '" y="' + Math.floor(i / M.w) * cs + '" width="' + cs + '" height="' + cs + '" fill="url(#' + ZONA_MINTA[zonaKat(zv.v)][0] + ')"/>');
    }
    if (!sajat.halott && sajat.pozicio >= 0) {
      var p = sajat.pozicio, px = (p % M.w) * cs, py = Math.floor(p / M.w) * cs, zm = zonaVarhato(m, elo, p);
      s.push(keret(px, py, false) + cimke(px, py, 'most: ' + zm.v + ' / ' + zm.n, false, true));
      var c = sajat.celCella;
      if (c != null && c >= 0 && c !== p) {
        var cx = (c % M.w) * cs, cy = Math.floor(c / M.w) * cs;
        s.push('<line x1="' + (px + 7.5) + '" y1="' + (py + 7.5) + '" x2="' + (cx + 7.5) + '" y2="' + (cy + 7.5) + '" stroke="#fff" stroke-width="1.6" stroke-dasharray="3 2"/>');
        var zc = zonaVarhato(m, elo, c);
        s.push(keret(cx, cy, true) + cimke(cx, cy, 'cél: ' + zc.v + ' / ' + zc.n, true, false, zc.v > zm.v));
      }
    }
    s.push('</svg>');
    return s.join('');
  }
  function targyEset(nev) {
    var s = String(nev || ''), u = s.slice(-1), k = u.toLowerCase();
    if (k === 'a') return s.slice(0, -1) + (u === 'A' ? 'Át' : 'át');
    if (k === 'e') return s.slice(0, -1) + (u === 'E' ? 'Ét' : 'ét');
    if ('iouöüáéíóőúűlrnszjy'.indexOf(k) >= 0) return s + 't';
    if (/[0-9]/.test(u)) {
      var E = { 1: 'et', 2: 't', 3: 'at', 4: 'et', 5: 'öt', 6: 'ot', 7: 'et', 8: 'at', 9: 'et' }, T = { 0: 'at', 1: 'et', 2: 'at', 3: 'at', 4: 'et', 5: 'et', 6: 'at', 7: 'et', 8: 'at', 9: 'et' };
      var e2 = s.slice(-2, -1);
      return s + '-' + (u !== '0' ? E[u] : /[0-9]/.test(e2) ? T[e2] : 't');
    }
    if (!/[a-zà-ž]/i.test(u)) return s + '-t';
    var m = s.toLowerCase().match(/[aáoóuúeéiíöőüű](?=[^aáoóuúeéiíöőüű]*$)/), v = m ? m[0] : 'e';
    return s + ('aáoóuú'.indexOf(v) >= 0 ? 'ot' : 'öőüű'.indexOf(v) >= 0 ? 'öt' : 'et');
  }
  function egerSvg(A, m, cella) {
    var M = modell(A.terkep), sajat = sajatJatekos(A);
    if (!M || !sajat || cella == null) return '';
    var cs = CELLA, so = !!sajat.tamado, s = [], gy = [];
    var ott = null; A.jatekosok.forEach(function (p) { if (!ott && !p.halott && p.pozicio === cella) ott = p; });
    var v, l, sz1, sz2, sz3 = '', kozel, nevek;
    var nevL = function (L) { return L.slice(0, 3).map(function (p) { return p === sajat ? 'te' : esc(p.nev); }).join(', ') + (L.length > 3 ? ' ...' : ''); };
    if (!ott) {
      v = varhatoLovok(A, m, cella, so, sajat); l = lohetIde(A, m, cella, so); kozel = !so;
      sz1 = 'Ha ide állsz: ' + (so ? 'a következő körben' : 'még ebben a körben') + ' várhatóan ' + v.length + ' ellenfél lőhet rád';
      sz2 = 'Láthatja: ' + l.length + ' ellenfél';
    } else if (!!ott.tamado === so) {
      v = varhatoLovok(A, m, cella, so, null); l = lohetIde(A, m, cella, so); kozel = !so;
      sz1 = ott === sajat ? 'Rád várhatóan ' + v.length + ' ellenfél lő' : esc(targyEset(ott.nev)) + ' várhatóan ' + v.length + ' ellenfél lövi';
      sz2 = 'Láthatja: ' + l.length + ' ellenfél';
      if (!v.length && ott !== sajat && l.length) {
        var leg = null, legL = [];
        A.jatekosok.forEach(function (z) {
          if (z === ott || z.halott || z.pozicio == null || z.pozicio < 0 || !!z.tamado !== so) return;
          var k = varhatoLovok(A, m, cella, so, z); if (k.length > legL.length) { leg = z; legL = k; }
        });
        if (leg) {
          sz3 = 'Fedezék: ' + (leg === sajat ? 'te' : esc(leg.nev)) + ' · ha kiesik: ' + legL.length;
          gy.push([leg, '#f5c518', true]); legL.forEach(function (p) { gy.push([p, '#b9a6ff', true]); });
        }
      }
    } else {
      v = varhatoLovok(A, m, cella, !so, null); l = lohetIde(A, m, cella, !so); kozel = so;
      sz1 = esc(targyEset(ott.nev)) + ' várhatóan ' + v.length + ' társad lövi';
      sz2 = 'Láthatja: ' + l.length + ' társad';
    }
    v.forEach(function (p) { gy.push([p, '#ff2a1a', false]); });
    nevek = v.length ? nevL(v) : '';
    if (!v.length) kozel = false;
    s.push('<svg width="' + M.w * cs + '" height="' + M.h * cs + '" xmlns="http://www.w3.org/2000/svg" style="position:absolute;left:0;top:0;overflow:visible">');
    gy.forEach(function (g) {
      var p = g[0], x = (p.pozicio % M.w) * cs + cs / 2, y = Math.floor(p.pozicio / M.w) * cs + cs / 2, sd = g[2] ? ' stroke-dasharray="3 2"' : '';
      s.push('<circle cx="' + x + '" cy="' + y + '" r="9" fill="none" stroke="#000" stroke-width="3.4" stroke-opacity=".6"/><circle cx="' + x + '" cy="' + y + '" r="9" fill="none" stroke="' + g[1] + '" stroke-width="2"' + sd + '/>');
    });
    var sorok = [[sz1, 10.5, '#2a170a', 'bold', 6.2]];
    if (nevek) sorok.push([nevek, 9.5, '#b3201a', 'normal', 5.4]);
    if (sz3) sorok.push([sz3, 9.5, '#7a5a00', 'normal', 5.4]);
    if (kozel) sorok.push(['közelítő: a védők előbb lépnek', 9, '#6b5a40', 'normal', 5.1]);
    sorok.push([sz2, 9.5, '#5a4a30', 'normal', 5.4]);
    var hossz = function (t) { return String(t).replace(/&[a-z]+;/g, 'x').length; };
    var w = Math.min(M.w * cs - 4, Math.max.apply(null, sorok.map(function (r) { return hossz(r[0]) * r[4]; })) + 10), h = sorok.length * 12 + 6;
    var ex = (cella % M.w) * cs, ey = Math.floor(cella / M.w) * cs;
    var lx = Math.min(Math.max(2, ex - w / 2 + 7), M.w * cs - w - 2), ly = ey - h - 6;
    if (ly < 2) ly = ey + cs + 6;
    s.push('<rect x="' + lx + '" y="' + ly + '" width="' + w + '" height="' + h + '" rx="4" fill="#f8ecd0" stroke="#3a2210" stroke-width="1.5"/>');
    sorok.forEach(function (r, i) {
      s.push('<text x="' + (lx + 5) + '" y="' + (ly + 12 + i * 12) + '" font-size="' + r[1] + '" font-weight="' + r[3] + '" fill="' + r[2] + '" font-family="Arial">' + r[0] + '</text>');
    });
    s.push('</svg>');
    return s.join('');
  }
  function esc(t) { return String(t == null ? '' : t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function terkepTarolo() {
    if (aktivFort) { var e = document.getElementById('fort_battle_' + aktivFort + '_battleground'); if (e && e.offsetParent !== null) return e; }
    var l = document.querySelectorAll('.fort_battle_battleground'), jo = null;
    for (var i = 0; i < l.length; i++) if (l[i].offsetParent !== null) jo = l[i];
    return jo;
  }
  var reteg = null, alReteg = {}, utolso = {}, egerCella = null, figyeltTarolo = null;
  function biztositReteg(t) {
    if (reteg && reteg.parentNode === t) return reteg;
    if (reteg && reteg.parentNode) reteg.parentNode.removeChild(reteg);
    reteg = document.createElement('div');
    reteg.className = 'ef-reteg';
    reteg.style.cssText = 'position:absolute;left:0;top:0;width:100%;height:100%;z-index:4;pointer-events:none';
    ['felk', 'felkJel', 'zona'].forEach(function (n) {
      var d = document.createElement('div'); d.style.cssText = 'position:absolute;left:0;top:0;width:100%;height:100%';
      reteg.appendChild(d); alReteg[n] = d;
    });
    var cimkek = t.querySelector(':scope > .battleground_sector_labels');
    if (cimkek) t.insertBefore(reteg, cimkek); else t.appendChild(reteg);
    if (alReteg.eger && alReteg.eger.parentNode) alReteg.eger.parentNode.removeChild(alReteg.eger);
    var eg = document.createElement('div'); eg.className = 'ef-eger';
    eg.style.cssText = 'position:absolute;left:0;top:0;width:100%;height:100%;z-index:5;pointer-events:none';
    var kod = t.querySelector(':scope > .battleground_fog');
    if (kod && kod.nextSibling) t.insertBefore(eg, kod.nextSibling); else t.appendChild(eg);
    alReteg.eger = eg;
    utolso = {};
    return reteg;
  }
  function beallit(n, html) { if (utolso[n] !== html) { alReteg[n].innerHTML = html; utolso[n] = html; } }
  function figyelEger(t) {
    if (figyeltTarolo === t) return;
    figyeltTarolo = t;
    t.addEventListener('mousemove', function (e) {
      try {
        var r = t.getBoundingClientRect(), A = harcAllapot ? aktivAllapot() : null, M = A ? modell(A.terkep) : null;
        if (!M) M = { w: Math.round((t.offsetWidth || 510) / CELLA), h: Math.round((t.offsetHeight || 360) / CELLA) };
        var x = Math.floor((e.clientX - r.left) / CELLA), y = Math.floor((e.clientY - r.top) / CELLA);
        var c = (x < 0 || y < 0 || x >= M.w || y >= M.h) ? null : y * M.w + x;
        if (c !== egerCella) { egerCella = c; egerRajz(); sorJelol(egerCella); }
      } catch (er) { hiba('egér', er); }
    }, { passive: true });
    t.addEventListener('mouseleave', function () { egerCella = null; egerRajz(); nativBuborek(false); sorJelol(null); }, { passive: true });
  }
  function egerRajz() {
    if (!reteg || !alReteg.eger) { nativBuborek(false); return; }
    var A = aktivAllapot(), m = aktivFort ? arnyek[aktivFort] : null;
    var html = harcAllapot && beall.buborek && A && m && m.kesz && egerCella != null ? egerSvg(A, m, egerCella) : '';
    beallit('eger', html);
    nativBuborek(!!html);
  }
  var nativRejtve = false;
  function nativBuborek(rejt) {
    if (rejt === nativRejtve) return;
    nativRejtve = rejt; cssBe();
    var h = document.documentElement; if (!h || !h.classList) return;
    if (rejt) h.classList.add('ef-natbub-ki'); else h.classList.remove('ef-natbub-ki');
  }
  function aktivAllapot() { return aktivFort && magok[aktivFort] ? magok[aktivFort].mag.allapot() : null; }
  var gombDoboz = null, gombok = {};
  var GOMBOK = [
    { nev: 'buborek', kulcs: 'buborek_be', alap: true,
      cim: 'Egér buborék be / ki: a cellán álló karakterre számol (a lövők a legközelebbi látható élő célpontjukat lövik)\n' +
        'ellenfél: hány társad lövi várhatóan; társ / te: hány ellenfél lövi várhatóan, fedezékben a "ha kiesik" szám;\n' +
        'üres cella: ha ide állsz, hány ellenfél lőhet rád. A várható lövők piros gyűrűt kapnak.' },
    { nev: 'zona', kulcs: 'zona_be', alap: false,
      ikon: '<svg width="20" height="20" viewBox="0 0 21 21"><rect x="2" y="2" width="8" height="8" fill="#2aa83c"/><rect x="11" y="2" width="8" height="8" fill="#e6c800"/><rect x="2" y="11" width="8" height="8" fill="#ff8200"/><rect x="11" y="11" width="8" height="8" fill="#d0140a"/></svg>',
      cim: 'Veszélyzóna be / ki: várhatóan hány ellenfél lőne rád, ha az adott cellán állnál (a legközelebbi látható célpontjukat lövik)\n' +
        'zöld: 0, sárga: 1, narancs: 2-3, piros: 4 vagy több\nmost / cél: a saját cellád és a célcellád, várható / láthat\n' +
        'Védő: előbb lősz, aztán lépsz, a támadók már a célcelládra lőnek. Támadó: a védők a mostani cellád lövik, a lépés a következő körre számít.' },
    { nev: 'panel', akcio: true,
      ikon: '<svg width="20" height="20" viewBox="0 0 21 21"><rect x="3" y="3" width="15" height="15" rx="2" fill="#fbf1d6" stroke="#3a2210"/><path d="M6 7h9M6 10.5h9M6 14h6" stroke="#3a2210" stroke-width="1.6"/><circle cx="15.5" cy="14" r="2.5" fill="#c0151b"/></svg>',
      cim: 'Most panel nyitása / zárása: ami ebben a körben fontos (állás, előző kör, ki lőhet rád, veszélyben, tétlenek) + Statisztika fül' }
  ];
  var beall = {};
  GOMBOK.forEach(function (g) { if (!g.akcio) beall[g.nev] = olvas(g.kulcs, g.alap); });
  var GOMB = { bal: 26, fent: 33, meret: 25, res: 10 };
  var GOMB_IKON = {
    jeloles: '<svg xmlns="http://www.w3.org/2000/svg" width="25" height="25"><circle cx="12.5" cy="12.5" r="6.8" fill="none" stroke="#1a0d05" stroke-width="3.6"/><circle cx="12.5" cy="12.5" r="6.8" fill="none" stroke="#f0e6c0" stroke-width="1.8"/><circle cx="12.5" cy="12.5" r="2.4" fill="#d01010" stroke="#1a0d05" stroke-width="1"/></svg>',
    zona: '<svg xmlns="http://www.w3.org/2000/svg" width="25" height="25"><rect x="6.5" y="6.5" width="12" height="12" fill="#1a0d05"/><rect x="7" y="7" width="5" height="5" fill="#4caa3a"/><rect x="13" y="7" width="5" height="5" fill="#e0c830"/><rect x="7" y="13" width="5" height="5" fill="#ee8a1a"/><rect x="13" y="13" width="5" height="5" fill="#d01a10"/></svg>',
    buborek: '<svg xmlns="http://www.w3.org/2000/svg" width="25" height="25"><path d="M5.5 6.5h14v9h-7l-3.5 3.5v-3.5h-3.5z" fill="#f0e6c0" stroke="#1a0d05" stroke-width="1.1" stroke-linejoin="round"/><circle cx="9" cy="11" r="1.2" fill="#d01010"/><circle cx="12.5" cy="11" r="1.2" fill="#d01010"/><circle cx="16" cy="11" r="1.2" fill="#d01010"/></svg>',
    panel: '<svg xmlns="http://www.w3.org/2000/svg" width="25" height="25"><rect x="7" y="5.5" width="11" height="14" fill="#f0e6c0" stroke="#1a0d05" stroke-width="1"/><path d="M9 9h7M9 12h7M9 15h5" stroke="#5a3a1c" stroke-width="1.3"/></svg>'
  };
  var gombKep = null, gombKepAllapot = 0, ikonKep = {};
  function gombKepTolt() {
    if (gombKepAllapot) return;
    gombKepAllapot = 1;
    gombKep = new Image();
    gombKep.onload = function () { gombKepAllapot = 2; Object.keys(gombok).forEach(function (n) { gombRajz(n, false); }); };
    gombKep.onerror = function () { gombKepAllapot = 3; Object.keys(gombok).forEach(function (n) { gombRajz(n, false); }); };
    gombKep.src = cdnUrl() + '/images/fort/battle/buttons.png?2';
    Object.keys(GOMB_IKON).forEach(function (n) {
      var i = new Image(); i.onload = function () { if (gombok[n]) gombRajz(n, false); };
      i.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(GOMB_IKON[n]); ikonKep[n] = i;
    });
  }
  function gombRajz(nev, hover) {
    var cv = gombok[nev]; if (!cv) return;
    var c = cv.getContext('2d'); c.clearRect(0, 0, 25, 25);
    if (gombKepAllapot === 2) {
      var sor = hover ? 25 : 0, OSZL = [3, 4, 5, 19, 20, 21];
      c.drawImage(gombKep, 75, sor, 25, 25, 0, 0, 25, 25);
      for (var y = 4; y < 22; y++) for (var x = 5; x < 20; x++) c.drawImage(gombKep, 75 + OSZL[(x * 7 + y * 3) % 6], sor + y, 1, 1, x, y, 1, 1);
    } else {
      c.fillStyle = hover ? '#6a4523' : '#4a2e16'; c.fillRect(0, 0, 25, 25);
      c.strokeStyle = '#1a0d05'; c.strokeRect(0.5, 0.5, 24, 24);
    }
    var ik = ikonKep[nev]; if (ik && ik.complete && ik.naturalWidth) c.drawImage(ik, 0, 0);
  }
  function gombKeszit(g) {
    var b = document.createElement('canvas');
    b.width = GOMB.meret; b.height = GOMB.meret; b.title = g.cim;
    b.style.cssText = 'display:block;width:' + GOMB.meret + 'px;height:' + GOMB.meret + 'px;cursor:pointer';
    b.addEventListener('mouseenter', function () { gombRajz(g.nev, true); });
    b.addEventListener('mouseleave', function () { gombRajz(g.nev, false); });
    b.addEventListener('click', function (e) { e.stopPropagation(); e.preventDefault(); g.katt(); });
    ['mousedown', 'pointerdown', 'touchstart', 'dblclick'].forEach(function (ev) { b.addEventListener(ev, function (e) { e.stopPropagation(); }); });
    gombok[g.nev] = b; gombRajz(g.nev, false);
    return b;
  }
  var JELOLES_GOMB = { nev: 'jeloles', cim: 'Jelölés be / ki: a panel sora fölött a karakter cellája megjelölődik a térképen,\n' +
      'a térképen az egér alatti karakter sora kiemelődik a panelen (minden fülön)',
    katt: function () {
      jelolesBe = !jelolesBe; ir('jeloles_be', jelolesBe);
      if (!jelolesBe) { felkJelol(null); sorJelol(null); }
      gombAllapot(); panelFrissit(true);
    } };
  function panelGomb() {
    if (!panel) return;
    gombKepTolt();
    var b = gombKeszit(JELOLES_GOMB);
    if (panel.tipus === 'sajat') { var f = panel.win.querySelector('.efp-fej'); if (f) f.appendChild(b); }
    else {
      var d = panelFoDiv(); if (!d) return;
      var doboz = document.createElement('div'); doboz.className = 'ef-panel-gombok';
      doboz.style.cssText = 'position:absolute;left:' + GOMB.bal + 'px;top:' + GOMB.fent + 'px;z-index:20;pointer-events:auto;line-height:0';
      doboz.appendChild(b); d.appendChild(doboz);
    }
    gombAllapot();
  }
  function biztositGombok(t) {
    var ablak = t.closest ? t.closest('.tw2gui_window') : null;
    if (!ablak) return;
    if (gombDoboz && gombDoboz.parentNode === ablak) return;
    if (gombDoboz && gombDoboz.parentNode) gombDoboz.parentNode.removeChild(gombDoboz);
    gombKepTolt();
    gombDoboz = document.createElement('div');
    gombDoboz.className = 'ef-gombok';
    gombDoboz.style.cssText = 'position:absolute;left:' + GOMB.bal + 'px;top:' + GOMB.fent + 'px;z-index:20;display:flex;gap:' + GOMB.res + 'px;pointer-events:auto;line-height:0';
    ['mousedown', 'pointerdown', 'touchstart', 'dblclick'].forEach(function (ev) { gombDoboz.addEventListener(ev, function (e) { e.stopPropagation(); }); });
    GOMBOK.forEach(function (g) {
      g.katt = function () {
        if (g.akcio) { panelValt(); return; }
        beall[g.nev] = !beall[g.nev]; ir(g.kulcs, beall[g.nev]); valtozott = true; gombAllapot(); frissit(); if (g.nev === 'buborek') egerRajz();
      };
      gombDoboz.appendChild(gombKeszit(g));
    });
    ablak.appendChild(gombDoboz);
    gombAllapot();
  }
  var cimSavEl = null, cimSavHtml = '';
  function cimSav(t, A) {
    var ablak = t && t.closest ? t.closest('.tw2gui_window') : null;
    if (!ablak || !A || !A.jatekosok || !A.jatekosok.length || !magok[aktivFort]) {
      if (cimSavEl && cimSavEl.parentNode) cimSavEl.parentNode.removeChild(cimSavEl);
      cimSavEl = null; cimSavHtml = ''; return;
    }
    var cs = magok[aktivFort].mag.csapatok(), K = A.korok || [], u = K[K.length - 1], e = K[K.length - 2];
    var jo = !!(u && e && u.csapatok && e.csapatok && u.szam != null && e.szam != null && u.szam === e.szam + 1);
    var veszt = function (o) { return jo ? Math.max(0, Math.round(e.csapatok[o].elet - u.csapatok[o].elet)) : null; };
    var html = cimSavOldal(cs.tamado, 'Támadók', 'linear-gradient(#e2412f,#a3150d)', 'b', veszt('tamado')) + cimSavOldal(cs.vedo, 'Védők', 'linear-gradient(#4d8ce0,#1d4f9a)', 'j', veszt('vedo'));
    if (!cimSavEl || cimSavEl.parentNode !== ablak) {
      if (cimSavEl && cimSavEl.parentNode) cimSavEl.parentNode.removeChild(cimSavEl);
      cssBe();
      cimSavEl = document.createElement('div'); cimSavEl.className = 'ef-cimsav'; cimSavHtml = '';
      ablak.appendChild(cimSavEl);
    }
    if (html !== cimSavHtml) { cimSavEl.innerHTML = html; cimSavHtml = html; }
  }
  function cimSavOldal(c, nev, grad, o, veszt) {
    var sz = c.eletMax ? c.elet / c.eletMax : 0, fel = '<span>' + nev + ' · ' + c.el + ' / ' + c.letszam + ' él</span>';
    var el = veszt == null ? '' : '<span class="v">előző: ' + (veszt > 0 ? '-' : '') + fmt(veszt) + '</span>';
    return '<div class="ef-cs ' + o + '"><div class="f">' + (o === 'b' ? fel + el : el + fel) + '</div>' +
      '<div class="s"><div style="width:' + (sz * 100).toFixed(1) + '%;background:' + grad + '"></div><b>' + fmt(c.elet) + ' / ' + fmt(c.eletMax) + '  ' + Math.round(sz * 100) + '%</b></div></div>';
  }
  function gombAllapot() {
    Object.keys(gombok).forEach(function (n) {
      var be = n === 'panel' ? panelNyitva() : n === 'jeloles' ? jelolesBe : beall[n];
      gombok[n].style.opacity = be ? '1' : '.5';
    });
  }
  var savKor = {};
  function savIr(fortId, html, alosztaly) {
    var FB = W.FortBattle, d = FB && FB.flashData ? FB.flashData['info' + fortId] : null;
    if (!d || typeof d.addMessage !== 'function' || typeof FB.showMessage !== 'function') return;
    cssBe();
    try { FB.showMessage(fortId, html, 'efp ' + (alosztaly || '')); } catch (e) { hiba('üzenetsáv', e); }
  }
  function savNev(p) { return '<b>' + esc(p ? p.nev : '?') + '</b>'; }
  function savOsszegzes(cim, x, valt) {
    var lov = x.talalat + x.melle, kl = x.kapottLoves;
    return '▸ ' + cim + ': eltaláltál ' + x.talalat + ' / ' + lov + ' (' + Math.round(x.talalat / Math.max(1, lov) * 100) + '%) · ' + fmt(x.okozott) + ' sebzés' + (valt ? ' (+' + fmt(valt.okozott) + ')' : '') +
      ' · ' + x.ko + ' KO · eltaláltak ' + (kl - x.kiteres) + ' / ' + kl + ' · kitértél: ' + x.kiteres + ' · ' + fmt(x.kapott) + ' sebzést kaptál' + (valt ? ' (+' + fmt(valt.kapott) + ')' : '');
  }
  function korLista(l) {
    var r = [], i = 0;
    while (i < l.length) { var j = i; while (j + 1 < l.length && l[j + 1] === l[j] + 1) j++; r.push(j > i ? l[i] + '-' + l[j] + '.' : l[i] + '.'); i = j + 1; }
    var n = l[0];
    return (n === 1 || n === 5 || (n >= 50 && n < 60) ? 'az ' : 'a ') + r.join(', ');
  }
  function korCim(fortId, sz) {
    var hi = korHiany[fortId] || [], e = korElso[fortId];
    var nelkul = hi.length ? ', ' + korLista(hi).replace(/^az? /, '') + ' nélkül' : '';
    if (e > ELSO_KOR) return (e < sz ? e + '-' + sz : e) + '. kör' + nelkul;
    return sz + ' kör' + nelkul;
  }
  function savKorVege(fortId, A, kor) {
    var sajat = sajatJatekos(A); if (!sajat || !kor || savKor[fortId] === kor.szam) return;
    savKor[fortId] = kor.szam;
    var K = A.karakterSzerint, en = sajat.karakterId, sz = A.kor, sorok = [];
    var enyem = kor.lovesek.filter(function (l) { return l.lovo === en; })[0];
    if (!enyem) sorok.push(['▸ ' + sz + '. kör: nem lőttél', 'efp_semm']);
    else if (enyem.ko) sorok.push(['▸ ' + sz + '. kör: eltaláltad ' + savNev(K[enyem.cel]) + ' játékost, ' + fmt(enyem.sebzes) + ', <b>KO!</b>', 'efp_jo']);
    else if (enyem.sebzes > 0) sorok.push(['▸ ' + sz + '. kör: eltaláltad ' + savNev(K[enyem.cel]) + ' játékost, ' + fmt(enyem.sebzes), 'efp_jo']);
    else sorok.push(['▸ ' + sz + '. kör: mellélőttél (' + savNev(K[enyem.cel]) + ')', 'efp_semm']);
    var ram = kor.lovesek.filter(function (l) { return l.cel === en; });
    var tal = ram.filter(function (l) { return l.sebzes > 0 || l.ko; }).sort(function (a, b) { return b.sebzes - a.sebzes; }), mel = ram.filter(function (l) { return !(l.sebzes > 0 || l.ko); });
    var melSz = mel.map(function (l) { return savNev(K[l.lovo]); }).join(', ');
    if (!ram.length) sorok.push(['▸ senki nem lőtt rád', 'efp_jo2']);
    else if (!tal.length) sorok.push(['▸ mindenki mellélőtt: ' + melSz, 'efp_jo2']);
    else {
      var ossz = tal.reduce(function (a, l) { return a + l.sebzes; }, 0);
      sorok.push(['▸ ' + (tal.length > 1 ? 'eltaláltak: ' : 'eltalált: ') + tal.map(function (l) { return savNev(K[l.lovo]) + ' ' + fmt(l.sebzes) + (l.ko ? ' (KO)' : ''); }).join(' · ') +
        (tal.length > 1 ? ' (összesen ' + fmt(ossz) + ')' : '') + (mel.length ? ' · mellélőttek: ' + melSz : ''), 'efp_rossz']);
    }
    var m = arnyek[fortId];
    if (!sajat.halott && m && m.kesz && sajat.pozicio != null && sajat.pozicio >= 0) {
      var hova = !sajat.tamado && sajat.celCella != null && sajat.celCella >= 0 && sajat.celCella !== sajat.pozicio ? sajat.celCella : sajat.pozicio;
      var n = lohetIde(A, m, hova, !!sajat.tamado).length, vl = varhatoLovok(A, m, hova, !!sajat.tamado, sajat);
      var vNev = vl.slice(0, 4).map(function (p) { return savNev(p); }).join(', ') + (vl.length > 4 ? ' ...' : '');
      var hol = hova !== sajat.pozicio ? 'a célcelládon ' : '';
      if (n > 0) sorok.push(['▸ következő kör: ' + hol + (vl.length ? 'várhatóan ' + vl.length + ' ellenfél lő rád (' + vNev + ')' : 'várhatóan senki nem lő rád') + ' · ' + n + ' lát', vl.length ? 'efp_fig' : 'efp_jo2']);
    }
    var kapottMost = ram.reduce(function (a, l) { return a + (l.sebzes || 0); }, 0);
    if (sz) sorok.push([savOsszegzes('eddig (' + korCim(fortId, sz) + ')', sajat, { okozott: enyem ? enyem.sebzes || 0 : 0, kapott: kapottMost }), korElso[fortId] > ELSO_KOR ? 'efp_fig' : 'efp_ossz']);
    var hs = hianySor[fortId];
    if (hs) { hianySor[fortId] = null; sorok.unshift(['▸ ' + korLista(hs) + ' kör kimaradt (az ablak zárva volt vagy az oldal újratöltődött) · a harc végi összegzésben benne lesz', 'efp_fig']); }
    var vs = visszaSor[fortId];
    if (vs != null) { visszaSor[fortId] = null; sorok.unshift(['▸ visszatöltve: ' + vs + ' kör adatai megvannak', 'efp_jo2']); }
    setTimeout(function () { sorok.forEach(function (s) { savIr(fortId, s[0], s[1]); }); }, 60);
  }
  function savHarcVege(fortId, A) {
    var sajat = sajatJatekos(A), v = magok[fortId] ? magok[fortId].mag.vegsoOsszesites() : null;
    if (!sajat || savKor[fortId] === 'vege') return;
    savKor[fortId] = 'vege';
    var x = v && sajat.westId != null ? v[String(sajat.westId)] : null;
    var adat = x ? { talalat: x.talalat, melle: x.melle, okozott: x.okozott, ko: x.ko, kapottLoves: x.kapottTalalat + x.kiteres, kiteres: x.kiteres, kapott: x.kapott } : sajat;
    setTimeout(function () { savIr(fortId, savOsszegzes('harc vége (' + (A.vege && A.vege.korok || A.kor || 0) + ' kör)', adat), 'efp_ossz'); }, 60);
  }
  var GORGETO = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADwAAAAeCAYAAABwmH1PAAAAFXRFWHRDcmVhdGlvbiBUaW1lAAfbBA8FOwWG3Mr2AAAAB3RJTUUH2wQPDw0kmz8tewAAAAlwSFlzAAAK8AAACvABQqw0mAAADTpJREFUeNqlWVmPHOUVPbVXdfU245mxx55gMHgDYyCAjEKCUAJCUSSkKC/5A3mMlMf8Dx7zFyLlJYmSSAlBghiZYCaQ2Cw23j1Lz/RSXfuac792bCMDVqY/qTQ9rer67nLuued+pb3x8jNNkeUwNRNVUaJpUsTTKYqmQaPpcBwHZVHDtizUqKCbJnTdxGg0wiCtYdUpMg3oOzqiBLANDXlZ8H4HVVOjbABoBn+j83kGNN5vGDr0uoLjtfjZ4J4V/2rQGh3ftlLwniJDnBd47fgheP4iVhY91HqJnVGIIMpQ5CXSWkddNZhMY6RFhZh7jXYTmFYD85nnnsDxo8ewfXuE4XCMLJ0gTSrkdYOd6RimYaPmBu2Wj6qqoNk6dgchssEYHRt4/cVns/6+7hddI69vbwbY2J3Atm0srawiYQBv3trCxmCAikaY/L7UW8jTRM+S+Ch9cLCHVdc1Gl5RNMLYiGC6NoxGQ9uxMKbDccLI13KnBp1BLBkkOoKy4r0LZoho8yL+9d6/eWMO1zcxnVoIywyVYaoMZ5MpdvIcRZXDcGyMpzmSOIJja8xw9kUT777h+Nb08P4ekVKrTHpGiYRIqdIpbDCyLpHBzN4cR/A9u0MT/kyLTu3FYYt2dbo+bm2O6IeGjuGgZTfEn4O0rFFHMdFKVBKNDXQUUU2EldCIOvOFk0dgEknXL9zEOCxheA2DQ3jnJgy/hd3tLSz3ugpKBS+v20K/DwyYtWGcojGsOikxHaX11HBa6PY1ZERElBQYjaf8XMNxfW7mYhKEyuAwDBn7WQ72mmFP0MLSUQGwWDJ8HL9mGTWqRCzboF82E0dUMgFZlkFnWaqiOfydR9D2e/BafRhWGze2NvD9136E19/8MbaDEYIshOVaMD0Lboc1k0+w0HVgmA501r6m6crB3XGASRQhocNhmvLKkFU0RKBlkAM0DTVhLqUxzzL4HNPSWTomCtYnH654peE+JfeT5/vtLpHF+/i5bnI6yv80Ohxe3cFgZ5Pex2hZEW7e2MSJH76B1376c8SphedefBWbzORmEvK5Ndw8wXA7xKdf7qioJSHrvEzQ0Qr4vBxDiKlCSYcdQrjj2XBti2RGc6qCWSkVUc2zGmbRYb0uLS/SwQrBNMGUhJUTTRn3FXr1TA2VKXyp8X7GpMlg6QT4gYOrGI8niKMCQ/5Qb/fx61/9EtPdHWzcuIGFXh9HnziBMC6Y5T4Z0sBTp0/i5JPH0JDAirxClLUQlD58stj+pTYLAshYS43jw3bbcBlpi7BqHJMQJ1vX+lwOa3TAYh2urR1Eq8W9w4iOlsqWJM3Jysy0QJ82RGGMhrDu0XbuTkQy2jVDkZcGbg0jvPLmz3D5M5LY+XMIxyNVq6efeZ5wtPHBRxcwjkvWh4aVlSVVS3Jtb2+zBQRsCzGCIFBZlBXHMS/WKyGoMbryvcOMl1U2d4YFXb7vw3Vd9VkjkSUk1oi90dYtxRtSsQwva9xR5CYErIdxAtdro9E96F4Xtefj3ffP0oGIVG4RLiFGZNvnXniRDM4NvA6uXL2O9fX1u2yZF+nMEEa2KAqYZHK/3VJ9W/4XfmoUmRDWZEvD2VM3ursqduTu4gKGowmTMsU+x1PEJWzBKsK+DpGlzyBNHNMu8oadC5PAfP/ch4j1Gp9c2AJ6i9ja2mKRs9hdh/Bla+ID0jRhFAl3ZinLp0QD4NHxgH1a2JKuziwheVT1jHzvZ0vV2rid1G6cDOlwD+05UC3aICavbG2NVTB7Cz2UfHY5CWGyFUnGszRWekAET0Fk6QVZ23Shk9SQNybsto9gsouLH37AoBi4fe0Ga4C9i6SwtXEL/zx3ljRfI40CCMkKTL+NLXMytbClQE4cls9iiM17hC3nW6YiqoBtrtPpYJHZlj0kw7KfpgtXlMpGKTlFktyXMIa5dvAwLo6YXRq91PMxuXkJ7966RoMZFUZyHE0x4A/bzPgKg9K2TGzsDKU3fIUtA8JejHAYFMoxoiJlzdYq4uJsnlG2Skwam07fA8WeapitcBrESrpqZLC4iJGTdLuOgbyiDsgKtb9GQVJQWgrohD8EuXocpbh++zYiwrZFNdQhnTfTCYw8RjbehcZeWlGqadSmCf+mZEGLwRGoPowtG136r6GIZEK1VhYztjTqdK78ElsMdgHXNGc9n/A29IxE5TGblvJFHKZ/1P6G0vYG7aX+hPnHzzax/vEWDbZxkSxrGyQbLf/qBsxwQmExZj1oWoyFThutBY+bjhRM+/0VBaUhCUTzvLtsKeTUpgCYxiOFBsWW7AauRwnIGtvrqmr2fAqhQsqxyOEwfiJwBFkZnRPyrJkItaeII9qdM9gaEWZeuvIlRT0Lng9ZXOxTI7PtUODLzQo+d/6q1sJL1vbODrzc/ka2lGlG2HKRbCkCYCxsSRw3DETVSh86FT3U4aaE23KxttilaBoi4Awg5Fll1awlcnKzCOeUQRfylKxLJ7SYbb1IpjSOJOKuYlq0oNssfttl4ybjysioO0gaBoQM1xguqpJNnU54iXEfWw4wY8s2oWOpTf/HltKL72dLgTWUNNn70nWRqJzg2m1FkrKPeacPZ2yz4k+/34NDySvSUvbWKovJI8mePn6YkL7E4UD6FFsJ6yvXpGEbM17hwz06EU130DJteBTgbU4Py2aLWd2+y5bLC12KkWXsso6lZgTiMgfP2NJ4gC3nWdIIrc4MWTkdFGRVDEDNGhVkdVrmXWTJOKsnhLuekjxZw9979iR8ZmfIL1t+hzDY5WBP+LEmhOFSRo++Y/HAEkc+jn3M3LAula6+ny0VlJNASVRZFrP6bWw5F6RpuE5STeXkgbZb7BQFs2jnlmqHYZDA4zDk0obdUajItWvSS6+A3mUtPPbIqhL5cUZ6J0QstwONN9hUXg5/qFueGhk9v01lxZm3mTG2sKU45TLCEtpRMFES02FJPIwt53KY3GG1eiqIwiv9Xk+VEPFJZDlUeT7HW7ZB4RxJuYigVjlTWluDbSX/pHYHkwBrR47g2eNPMXMRNfJAOWAwe1cvf45oYxv7CV1hO02IoKZDlJUmVZf03LpsZs1ewz22NL6eLefJsXBHU+fK7lw6AnlC2l8jQkn2EG2tGSoIDygtyYAI7E0O+jaz+dTzL1NTa1hc7cPuCFRKrDyyH6e/+zSJLIffbcGxZPjOFVsKpIREJGcOM+26LZV1ga7UsdRuLGyJGVvmWaOQMd/6qtIS7hCllXP8NGU81Wek+LVK6wwdOcDWMi3fwe3cITw62OVoSF6Dw+FBfuTLiQUFiM6xzmV0C0QYy3xMR20SmkRS6lO3JIozk1ocSERhRVGkVJlpzpi65ngoBwH6HD5/E3dUzT3umE1QeFBpLfdoWDyGbxSYbN1UB3MvvfAS2jadrAx+38ZyZwUXPvoUBmERj1I8fuQRnDp1UrFlUtloVREWyIyl7mKXys0kM7Z9PlzLVDCKagZ1nbJTKyL+v3fRoTI3B3ewD8cYk3Utq4MDHN7f++3vONyfwfNnXuXsyua+toQvLn6IfLqBUycPsv2YSCvCqY7U2GVzqLcp6VI2/w3WvMzGKdFg0VGBPrQauejqPJWDQ6W9TXO+PixKS7hDnBXuqMgdvkNEWve4w3asB7hDsqyPx2OsrrBemY3lno082MRbb72lFNTBY49jlwE5d/48FpaWKThsRBweLn+yjfX3L8Nkv7bkVIPwDYsSm4MRJy6OkgWxpYne9mBb7sxI1pfAWDYXp+dy+D7ukLapO3I23WLeKZTkCIlDhHZn+C9kRmbWZRYQZJjLy8uUlIuqZyHMcejQIZz9yx+wttLBvqUezr/3NzxKZ1tsZlqZwOdEVfRYK9TP1wdDbA4Dt8qdp5O8ChNYnFzYrgLWz8ZIEUZADc5BiVlhhGs5yNelttu02N2rw+KoR/RJ/Rr8nHFnk3wT14ouFEHWjHkl9VvOlFZZ6oqXzH5/kdq3QpByhKOMtJ0OThxaxfo7b0MwcqjTwz7Ph6V6L6chLUGn10XEYTthJj/+/MpRq8r/JG0qouz0+IwwC7FDBlWnHIyqqmFd3mSQZDgj0gZmHu29OizcYbMVekxCxIfJm5GSHgYsHRlaLDnKkdbIfWraULP0DEtjAKi0vrx5HYVVIogDDDnBeJr0Vp2j3pQ9VMPa/kMYDmcnlHVVkqAqDLZ3MUkbbA3jX3Dvx2fZKu6YEz3MXpkNLz96wP/NXh0WFbi82ENI5+LJgITZVW9K6nomLX1mP89ElFQw2aIMZhhymTkzfOAgXvnJD/DkqTO4cvsqnNJidir12kWa+phipD62ih7VTBxNcWDfMi5cuYS3z34MDKN/cP//AP9XY5XpYbJXZ2XJebho9HAaUt8zmxwVmySVY0rCXFop7yFNpJGMucwqvys5Kygt7S88hr/+fR1aJuOeh2vXbmFjY4skoKlXJrZjq4e0ZejXPWQcLk4cPYkgcrH+2e8vzGP4XpegbbIzkFdr2Ne3OPtayJTUhZKWDVHYVHIEpStFZrCcCmoIeWH3X8GQiKCO1FzWAAAAAElFTkSuQmCC';
  var PANEL_CSS = [
    'html.ef-natbub-ki #popup.mousepopup{display:none!important}',
    '.ef-cimsav{position:absolute;left:50%;top:31px;width:0;height:0;z-index:19;pointer-events:none}',
    '.ef-cimsav .ef-cs{position:absolute;top:0;width:170px;font:bold 9px Arial,sans-serif}.ef-cimsav .ef-cs.b{right:72px}.ef-cimsav .ef-cs.j{left:72px}',
    '.ef-cimsav .f{color:#f6dc92;line-height:12px;white-space:nowrap;text-shadow:0 1px 2px #000;display:flex;justify-content:space-between;gap:6px}.ef-cimsav .j .f{justify-content:flex-end}',
    '.ef-cimsav .f .v{color:#ff9a7a}.ef-cimsav .j .f .v{margin-right:auto}',
    '.ef-cimsav .s{height:14px;margin-top:2px;background:#1e1208;border:1px solid #000;border-radius:3px;position:relative;overflow:hidden}.ef-cimsav .s div{height:100%}.ef-cimsav .j .s div{margin-left:auto}',
    '.ef-cimsav .s b{position:absolute;left:0;right:0;top:0;text-align:center;color:#fff;font:bold 10px Arial,sans-serif;line-height:14px;white-space:pre;text-shadow:0 0 2px #000,0 1px 1px #000}',
    '.efp{font:11px Arial;color:#3a2814}',
    '.efp .efp-fulek{display:flex;gap:3px;padding:0;border-bottom:2px solid #5a3a1c}',
    '.efp .efp-ful{padding:4px 11px 3px;border-radius:6px 6px 0 0;background:linear-gradient(#6a4522,#3e2511);color:#e9d39c;font:bold 12px Arial;border:1px solid #1a0f06;border-bottom:0;cursor:pointer}',
    '.efp .efp-ful.a{background:linear-gradient(#f4e4bd,#e2c993);color:#2a1608;position:relative;top:2px;cursor:default}',
    '.efp{display:flex;flex-direction:column;box-sizing:border-box}',
    '.efp .efp-tart{flex:1 1 auto;min-height:40px;padding:6px 2px 4px 0;overflow-y:auto;overflow-x:hidden;scrollbar-width:auto;scrollbar-color:auto}',
    '.efp .efp-tart.tablas{overflow:hidden;display:flex;flex-direction:column}.efp .efp-tart.tablas>*{flex:0 0 auto}',
    '.efp .efp-tart.tablas>.efp-tbl.gorget{flex:1 1 auto;min-height:60px;overflow-y:scroll;overflow-x:hidden;scrollbar-width:auto;scrollbar-color:auto}',
    '.efp .efp-tbl.gorget th{position:sticky;top:0;z-index:2}',
    '.efp .efp-tart::-webkit-scrollbar,.efp .efp-tbl.gorget::-webkit-scrollbar{width:15px;height:15px}',
    '.efp .efp-tart::-webkit-scrollbar-track,.efp .efp-tbl.gorget::-webkit-scrollbar-track{background:#4e3924 url(' + GORGETO + ') -30px 0 / 60px 30px repeat-y}',
    '.efp .efp-tart::-webkit-scrollbar-thumb,.efp .efp-tbl.gorget::-webkit-scrollbar-thumb{min-height:30px;border-top:2px solid #947d53;border-bottom:2px solid #382416;border-radius:0;background:#846841 url(' + GORGETO + ') -45px 0 / 60px 30px repeat-y}',
    '.efp .efp-tart::-webkit-scrollbar-thumb:hover,.efp .efp-tbl.gorget::-webkit-scrollbar-thumb:hover{background-color:#a38953;filter:brightness(1.15)}',
    '.efp .efp-tart::-webkit-scrollbar-button,.efp .efp-tbl.gorget::-webkit-scrollbar-button{display:none}',
    '.efp .efp-tart::-webkit-scrollbar-button:vertical:decrement:start,.efp .efp-tbl.gorget::-webkit-scrollbar-button:vertical:decrement:start{display:block;height:15px;background:url(' + GORGETO + ') 0 0 / 60px 30px no-repeat}',
    '.efp .efp-tart::-webkit-scrollbar-button:vertical:increment:end,.efp .efp-tbl.gorget::-webkit-scrollbar-button:vertical:increment:end{display:block;height:15px;background:url(' + GORGETO + ') 0 -15px / 60px 30px no-repeat}',
    '.efp .efp-alja{flex:0 0 15px;position:relative;margin-top:2px}',
    '.efp .efp-grip{position:absolute;left:8px;right:8px;top:0;height:15px;border-top:1px solid #a28b5d;cursor:ns-resize;touch-action:none;display:flex;align-items:center;justify-content:center}',
    '.efp .efp-grip span{width:44px;height:5px;background:#826844;border:1px solid #d4c49e;pointer-events:none}',
    '.efp .efp-alairas{position:absolute;right:10px;top:2px;font:11px Arial,sans-serif;color:rgba(43,33,25,.45);pointer-events:none}',
    '.efp .efp-alairas span{color:#d7473f;font-size:13px;padding:0 2px}',
    '.efp .efp-osz{display:grid;grid-template-columns:minmax(0,1fr) auto minmax(0,1fr);align-items:center;margin:3px 0 2px;white-space:nowrap}',
    '.efp .efp-osz>div{overflow:hidden}.efp .efp-osz .potty{width:7px;height:7px;margin-right:1px}',
    '.efp .efp-osz .bal{display:flex;align-items:center;gap:6px}.efp .efp-osz .bal .cs{margin-left:auto}',
    '.efp .efp-osz .kz{color:#8a6a3a;padding:0 6px}',
    '.efp .efp-osz .o{margin:0 3px}.efp .efp-osz .o b{color:#3a2814}',
    '.efp .g4{display:grid;grid-template-columns:auto 1fr auto 1fr;gap:1px 8px;margin-top:2px}.efp .g4 b{text-align:right}',
    '.efp .efp-ep.k{width:72px}.efp .efp-ep.k .efp-ept{font-size:8.5px}',
    '.efp .efp-ep.eh .efp-epb{background:linear-gradient(#9a63b8,#5e2f7a)}.efp .efp-ep.mo{opacity:.9}.efp tr.nl .efp-ep{opacity:.55}',
    '.efp .efp-vb{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:5px;margin:4px 0}',
    '.efp .efp-vb>div{border:1px solid #b8975c;border-radius:4px;padding:3px 6px;background:rgba(255,248,226,.55)}',
    '.efp .efp-vb .k{font-size:9.5px;color:#6a4a20}.efp .efp-vb .v{font:bold 13px Arial;color:#2a1608}',
    '.efp .efp-vsav{height:8px;border-radius:2px;overflow:hidden;display:flex;margin:2px 0}',
    '.efp .efp-ing{display:inline-block;width:13px;height:13px;line-height:12px;text-align:center;border-radius:50%;background:#e08a00;color:#fff;font:bold 9px Arial;margin-left:3px;vertical-align:middle;cursor:help}',
    '.efp .efp-src{font-size:9.5px;color:#6a4a20}',
    '.efp .efp-nagy{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:6px;margin:4px 0}',
    '.efp .efp-nagy>div{border:1px solid #b8975c;border-radius:4px;padding:3px 8px 4px;background:rgba(255,248,226,.55)}',
    '.efp .efp-nagy .k{font-size:10px;color:#6a4a20}.efp .efp-nagy .v{font:bold 21px Georgia;color:#2a1608;line-height:23px}.efp .efp-nagy .v small{font-size:13px;color:#6a4a20}',
    '.efp .efp-nsav{position:relative;height:15px;background:#3b0b08;border:1px solid #1a0503;border-radius:3px;overflow:hidden;margin-top:2px}',
    '.efp .efp-nsav b{position:absolute;left:0;top:0;bottom:0;background:linear-gradient(#e2412f,#a3150d)}.efp .efp-nsav.eh b{background:linear-gradient(#9a63b8,#5e2f7a)}',
    '.efp .efp-nsav span{position:absolute;left:0;right:0;top:0;text-align:center;color:#fff;font:bold 10px/15px Arial;text-shadow:0 1px 1px #000}',
    '.efp .efp-ures{text-align:center;padding:14px;border:1px solid #b8975c;border-radius:4px;background:rgba(255,248,226,.55);margin-top:6px}',
    '.efp td.efp-sz{padding:1px 2px;font-size:10px}.efp td.efp-kozel{text-decoration:underline dotted}.efp a.efp-nevk{display:inline-block;max-width:92px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;vertical-align:bottom}',
    '.efp td.efp-varos a.efp-varosl{font-size:10px;font-weight:normal;color:#5a4326}',
    '.efp td.efp-varos{max-width:56px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#5a4326;font-size:10px}',
    '.efp .efp-ruha{font-style:italic;color:#7a6440}',
    '.fb_message.fb_message_efp{font-style:normal;border-left:3px solid #c0151b;padding-left:6px;margin:1px 0 3px;color:#7a0f0a;user-select:text}',
    '.fb_message.fb_message_efp.efp_jo{color:#0f4d0b;border-left-color:#2f8f25}.fb_message.fb_message_efp.efp_jo2{color:#24541f;border-left-color:#7aa56f}',
    '.fb_message.fb_message_efp.efp_semm{color:#3d3020;border-left-color:#a8936c}.fb_message.fb_message_efp.efp_rossz{color:#7a0f0a;border-left-color:#c0151b}',
    '.fb_message.fb_message_efp.efp_fig{color:#6e3300;border-left-color:#e08a00}',
    '.fb_message.fb_message_efp.efp_ossz{color:#2a1608;border-left-color:#4b2f14;background:rgba(179,32,26,.07)}',
    '.efp .efp-forr{display:inline-block;font:bold 9px/12px Arial;padding:0 4px;border-radius:3px}.efp .efp-forr.h{background:#e6d3a3;color:#3a2814;border:1px solid #b8975c}.efp .efp-forr.r{color:#7a6440;border:1px dashed #a88d5c;font-style:italic}',
    '.efp .efp-tobor{display:flex;justify-content:space-between;align-items:center;margin:0 0 4px;white-space:nowrap}',
    '.efp tr.kij td{background:rgba(255,226,140,.55)!important}',
    '.efp .efp-jel{display:inline-block;width:10px;height:10px;border:1px solid #6b4c22;background:#fbf1d6;border-radius:2px;vertical-align:middle;cursor:pointer}.efp .efp-jel.be{background:#3e2511;box-shadow:inset 0 0 0 2px #fbf1d6}',
    '.efp .efp-rgomb{display:inline-block;border:1px solid transparent;border-radius:3px;cursor:pointer;min-width:18px;text-align:center}.efp .efp-rgomb:hover{border-color:#b3201a}',
    '.efp-valaszto{position:fixed;z-index:100000;width:250px;display:block;background:#efe3c6;border:2px solid #3b2412;border-radius:6px;box-shadow:0 6px 16px rgba(0,0,0,.55);font:bold 11px/22px Arial;color:#3a2814}',
    '.efp-valaszto .vf{background:linear-gradient(#5b391b,#2c1a0b);color:#f6e0a8;font:bold 12px/24px Georgia,serif;padding:0 8px;border-radius:4px 4px 0 0}',
    '.efp-valaszto .vs{padding:0 8px;display:flex;align-items:center;gap:6px;border-bottom:1px solid #d5bd8b;cursor:pointer}.efp-valaszto .vs:hover{background:rgba(255,220,120,.6)}.efp-valaszto .vs.mg{justify-content:flex-end;color:#8a6a3a}',
    '.efp .efp-b{background:rgba(255,248,226,.5);border:1px solid #b8975c;border-radius:4px;padding:4px 6px;margin-bottom:5px}',
    '.efp .efp-b h4{margin:0 0 3px;font:bold 11.5px Georgia,serif;color:#4b2f14;display:flex;justify-content:space-between}',
    '.efp .efp-b h4 small{font:normal 10px Arial;color:#8a6a3a}',
    '.efp .efp-s{display:flex;justify-content:space-between;gap:6px;padding:1px 0;white-space:nowrap}',
    '.efp .efp-s>span:first-child{overflow:hidden;text-overflow:ellipsis}',
    '.efp .v{color:#1f55b5;font-weight:bold}.efp .t{color:#b3201a;font-weight:bold}.efp .lab{color:#8a6a3a;font-size:10px}',
    '.efp .jel{display:inline-block;min-width:14px;padding:0 3px;border-radius:7px;background:#c0151b;color:#fff;font:bold 10px Arial;text-align:center}.efp .jel.s{background:#e08a00}',
    '.efp .bar{height:12px;background:#2a1a0c;border:1px solid #120a04;border-radius:2px;position:relative;overflow:hidden;margin:2px 0}.efp .bar div{height:100%}',
    '.efp .bar b{position:absolute;left:0;right:0;top:0;text-align:center;color:#fff;font:bold 9.5px Arial;line-height:12px;text-shadow:0 0 2px #000}',
    '.efp .potty{display:inline-block;width:9px;height:9px;border-radius:50%;margin-right:2px;border:1px solid #6b1a10;background:#f3e2b8}.efp .potty.t{background:#c0151b}',
    '.efp .kiem{background:rgba(255,240,176,.75)}',
    '.efp table{width:100%;border-collapse:collapse}',
    '.efp th{font:bold 9.5px Arial;color:#f4e2b2;text-align:left;padding:3px;background:linear-gradient(#6a4522,#3e2511);white-space:nowrap;cursor:pointer}',
    '.efp th.r,.efp td.r{text-align:right}.efp th.a:after{content:" \\25BE"}.efp th.a.fel:after{content:" \\25B4"}.efp .efp-dot.sz{background:#999}',
    '.efp td{padding:1.5px 3px;border-bottom:1px solid #d5bd8b;font-size:10.5px;white-space:nowrap}',
    '.efp tr:nth-child(even) td{background:rgba(255,248,226,.55)}.efp tr.en td{background:#fff0b0;font-weight:bold}.efp tr.ko td{color:#9a8a70}',
    '.efp td.nev{max-width:110px;overflow:hidden;text-overflow:ellipsis}.efp td.nev img{width:13px;height:13px;vertical-align:-2px;margin-right:2px}',
    '.efp .mini{display:inline-block;width:30px;height:5px;background:#3b0b08;border-radius:1px;vertical-align:middle;margin-right:3px;overflow:hidden}.efp .mini div{height:100%;background:#d6301f}',
    '.efp .chip{display:inline-block;border:1px solid #6b4c22;border-radius:3px;padding:1px 6px;background:linear-gradient(#fbf1d6,#e3cb98);font:bold 10px Arial;color:#4b2f14;margin-right:2px;cursor:pointer}',
    '.efp .chip.a{background:linear-gradient(#6a4522,#3e2511);color:#f6e0a8}',
    '.efp .chip.meg{background:#a3301e;color:#fff;border-color:#5a1608}',
    '.efp .efp-r1{width:14px;padding:0 1px;text-align:center;cursor:pointer;color:#6a4a20;font-size:12px}.efp .efp-r1:hover{color:#b3201a}.efp .efp-r1.v{color:#a08a60;cursor:default}.efp .efp-r1.ok{color:#3b6d11;font-weight:bold}',
    '.efp tr.efp-friss td{background:rgba(170,215,130,.55)!important}',
    '.efp .ket{display:flex;gap:5px}.efp .ket>div{flex:1}',
    '.efp .efp-fej{display:flex;justify-content:space-between;align-items:center;margin:5px 0 3px;white-space:nowrap}',
    '.efp .efp-rc{margin-right:8px;font-weight:bold;white-space:nowrap}',
    '.efp .efp-dot{display:inline-block;width:9px;height:9px;border-radius:50%;border:1px solid #300;vertical-align:middle}.efp .efp-dot.z{background:#2fc21f}.efp .efp-dot.p{background:#d0201a}',
    '.efp .efp-frs{display:inline-flex;align-items:center;gap:6px;margin-right:2px}',
    '.efp .efp-ujra{display:inline-block;width:20px;height:20px;cursor:pointer;background:url(' + cdnUrl() + '/images/tw2gui/window/window2_buttons.png?5) 0 -20px no-repeat}',
    '.efp .efp-tbl{border:1px solid #b8975c;background:rgba(255,248,226,.4)}',
    '.efp div.efp-s[data-cella]:hover{background:rgba(255,220,120,.55)}',
    '.efp .efp-tbl td.c{text-align:center}.efp .efp-tbl tr.nl td{color:#7a6a50}.efp .efp-tbl tr[data-cella]:hover td{background:rgba(255,220,120,.55)}',
    '.efp a.efp-nev.v{color:#1f55b5}.efp a.efp-nev.t{color:#b3201a}.efp a.efp-nev{color:#5a2a0a;font-weight:bold;text-decoration:none;border-bottom:1px dotted #5a2a0a;cursor:pointer}',
    '.efp .efp-ep{display:inline-block;position:relative;width:98px;height:14px;background:#3b0b08;border:1px solid #1a0503;border-radius:2px;vertical-align:middle}',
    '.efp .efp-epb{position:absolute;left:0;top:0;bottom:0;background:linear-gradient(#e2412f,#a3150d)}',
    '.efp .efp-ept{position:absolute;left:0;right:14px;text-align:center;color:#fff;font:bold 9px/14px Arial;text-shadow:0 0 2px #000}',
    '.efp .efp-sziv{position:absolute;right:0;top:0;width:14px;height:14px;background:#6a1008;color:#ff8a7a;font:10px/14px Arial;text-align:center}',
    '.efp .efp-ism{border-bottom:1px dotted #8a6a3a;cursor:help;font-style:italic}',
    '.efp .efp-epites{position:absolute;left:10px;top:2px;z-index:2;font:11px Arial,sans-serif;color:#1f55b5;cursor:pointer}',
    '.efp .efp-s.efp-sorjel{background:#fde9a6;box-shadow:inset 0 0 0 1px #d4a017}.efp .efp-tbl tr.efp-sorjel td{background:#fde9a6;box-shadow:inset 0 1px 0 #d4a017,inset 0 -1px 0 #d4a017}',
    '.efp-tartalek .efp-fej canvas{position:absolute;left:6px;top:4px}',
    '.efp-tartalek{position:fixed;z-index:9999;background:#2a190c;border:2px solid #120a04;border-radius:8px;box-shadow:0 8px 24px rgba(0,0,0,.65)}',
    '.efp-tartalek .efp-fej{height:34px;margin:3px 3px 0;border-radius:6px 6px 0 0;background:linear-gradient(#5b391b,#2c1a0b);color:#f6e0a8;font:bold 16px Georgia,serif;display:flex;align-items:center;justify-content:center;cursor:move;position:relative;user-select:none}',
    '.efp-tartalek .efp-x{position:absolute;right:6px;top:7px;width:20px;height:20px;border-radius:50%;background:#24170e;border:1px solid #a07e45;color:#e9cf8e;font:bold 11px Arial;display:flex;align-items:center;justify-content:center;cursor:pointer}',
    '.efp-tartalek .efp-test{margin:0 3px 3px;padding:6px;background:#e9d7ad;border-radius:0 0 6px 6px}'
  ].join('\n');
  var panel = null;
  var statHalott = olvas('stat_halott', false), jelolesBe = olvas('jeloles_be', true);
  var panelFul = 'most', statSzuro = 'mind', statRend = 'okozott', statLe = true, statKor = 'ossz', utolsoPanel = null;
  var PANEL_SZEL = { most: 300, felk: 698, varh: 698, stat: 698 }, MAGAS_MIN = 250, MAGAS_ALAP = 450, MAGAS_MAX = 790;
  var panelMagas = olvas('panel_magas', MAGAS_ALAP);
  function magasKorlat(h) { var vh = W.innerHeight || 800; return Math.round(Math.min(Math.max(MAGAS_MIN, h), Math.max(MAGAS_MIN, Math.min(MAGAS_MAX, vh * 0.85)))); }
  function cssBe() {
    if (document.getElementById('efp-css')) return;
    var st = document.createElement('style'); st.id = 'efp-css'; st.textContent = PANEL_CSS;
    (document.head || document.documentElement).appendChild(st);
  }
  function cdnUrl() { var G = W.Game; return (G && G.cdnURL) ? G.cdnURL : 'https://westhu.innogamescdn.com'; }
  function panelNyitva() { return !!(panel && panel.gyoker && document.contains(panel.gyoker)); }
  function panelValt() { if (panelNyitva()) panelZar(); else panelNyit(); gombAllapot(); }
  var helyUtolso = null;
  function panelFoDiv(pn) {
    pn = pn || panel; if (!pn) return null;
    if (pn.tipus === 'sajat') return pn.win;
    var d = null;
    try { d = typeof pn.win.getMainDiv === 'function' ? pn.win.getMainDiv() : pn.win.divMain; } catch (e) { }
    if (d && d.jquery) d = d[0];
    return d || null;
  }
  function panelHelyMent(pn) {
    var d = panelFoDiv(pn); if (!d || !document.contains(d)) return;
    var h = { x: Math.round(d.offsetLeft), y: Math.round(d.offsetTop) }, k = h.x + ',' + h.y;
    if (k !== helyUtolso) { helyUtolso = k; ir('panel_hely', h); }
  }
  function panelHelyVissza() {
    var h = olvas('panel_hely', null), d = panelFoDiv(); if (!h || !d) return;
    var vw = W.innerWidth || 1200, vh = W.innerHeight || 800;
    var x = Math.min(Math.max(0, h.x), Math.max(0, vw - 120)), y = Math.min(Math.max(0, h.y), Math.max(0, vh - 80));
    d.style.left = x + 'px'; d.style.top = y + 'px'; d.style.right = 'auto';
    helyUtolso = x + ',' + y;
  }
  function panelZar() {
    rangDobozZar();
    var pn = panel; if (!pn) return;
    panelHelyMent(pn);
    panel = null;
    try { if (pn.tipus === 'wman' && pn.win && pn.win.destroy) pn.win.destroy(); } catch (e) { hiba('panel zárás', e); }
    if (pn.tipus === 'sajat' && pn.win && pn.win.parentNode) pn.win.parentNode.removeChild(pn.win);
    panel = null; utolsoPanel = null; gombAllapot();
  }
  function panelNyit() {
    cssBe();
    var gy = document.createElement('div'); gy.className = 'efp';
    gy.addEventListener('click', panelKattint);
    gy.addEventListener('pointerdown', function (e) { if (e.target && e.target.classList && e.target.classList.contains('efp-grip')) fogoKezd(e); });
    gy.addEventListener('mousedown', function (e) { if (e.target && e.target.classList && e.target.classList.contains('efp-grip')) e.stopPropagation(); });
    gy.addEventListener('mouseover', function (e) { var tr = jelolesBe && e.target.closest ? e.target.closest('[data-cella]') : null; felkJelol(tr ? Number(tr.getAttribute('data-cella')) : null); });
    gy.addEventListener('mouseleave', function () { felkJelol(null); });
    try {
      if (W.wman && typeof W.wman.open === 'function') {
        var win = W.wman.open('ef_most_panel', 'Most', 'noreload');
        var cp = win && typeof win.getContentPane === 'function' ? win.getContentPane() : null;
        if (cp && cp.jquery) cp = cp[0];
        if (cp) {
          cp.innerHTML = ''; cp.appendChild(gy);
          panel = { tipus: 'wman', win: win, gyoker: gy };
          try { if (typeof win.addEventListener === 'function') win.addEventListener('WINDOW_DESTROY', function () { if (panel) panelHelyMent(panel); panel = null; utolsoPanel = null; gombAllapot(); }, {}); } catch (e) { }
          panelHelyVissza();
          panelGomb();
          panelMeret(); panelFrissit(true); return;
        }
      }
    } catch (e) { hiba('wman.open', e); }
    var d = document.createElement('div'); d.className = 'efp-tartalek';
    d.style.right = '24px'; d.style.top = '110px';
    d.innerHTML = '<div class="efp-fej"><span class="efp-cim">Most</span><div class="efp-x" title="Bezárás">X</div></div><div class="efp-test"></div>';
    d.querySelector('.efp-test').appendChild(gy);
    d.querySelector('.efp-x').addEventListener('click', function (e) { e.stopPropagation(); panelZar(); });
    var fej = d.querySelector('.efp-fej');
    fej.addEventListener('mousedown', function (e) {
      if (e.target.classList.contains('efp-x')) return;
      var r = d.getBoundingClientRect(), dx = e.clientX - r.left, dy = e.clientY - r.top;
      d.style.right = 'auto';
      function mozog(ev) { d.style.left = Math.max(0, ev.clientX - dx) + 'px'; d.style.top = Math.max(0, ev.clientY - dy) + 'px'; }
      function fel() { document.removeEventListener('mousemove', mozog); document.removeEventListener('mouseup', fel); }
      document.addEventListener('mousemove', mozog); document.addEventListener('mouseup', fel); e.preventDefault();
    });
    document.body.appendChild(d);
    panel = { tipus: 'sajat', win: d, gyoker: gy, cimEl: d.querySelector('.efp-cim') };
    panelHelyVissza();
    panelGomb();
    panelMeret(); panelFrissit(true);
  }
  function panelMeret() {
    if (!panel) return;
    var w = PANEL_SZEL[panelFul], h = panelMagas = magasKorlat(panelMagas);
    if (panel.tipus === 'wman') { try { if (typeof panel.win.setSize === 'function') panel.win.setSize(w + 50, h); } catch (e) { hiba('setSize', e); } panelHatter(); }
    else panel.win.style.width = (w + 6) + 'px';
    panel.gyoker.style.width = w + 'px';
    panel.gyoker.style.height = (h - 95) + 'px';
  }
  function panelHatter() {
    var d = panelFoDiv(); if (!d) return;
    var ins = d.querySelector('.tw2gui_window_inset'); if (!ins || ins.__efHatter) return;
    var bi = ''; try { bi = W.getComputedStyle(ins).backgroundImage || ''; } catch (e) { }
    if (!bi || bi === 'none' || bi.indexOf(',') >= 0) return;
    ins.style.backgroundImage = bi + ', ' + bi;
    ins.style.backgroundPosition = '0% 100%, 0% 0%';
    ins.style.backgroundRepeat = 'no-repeat, repeat-y';
    ins.__efHatter = true;
  }
  var fogoAktiv = false;
  function fogoKezd(e) {
    if (!panel || (e.pointerType === 'mouse' && e.button !== 0)) return;
    var grip = e.target, pid = e.pointerId, y0 = e.clientY, h0 = panelMagas;
    fogoAktiv = true;
    try { grip.setPointerCapture(pid); } catch (x) { }
    function mozog(ev) {
      if (ev.pointerId !== pid || !panel) return;
      var h = magasKorlat(h0 + (ev.clientY - y0)); if (h === panelMagas) return;
      panelMagas = h;
      if (panel.tipus === 'wman') { try { panel.win.setSize(PANEL_SZEL[panelFul] + 50, h); } catch (x) { } }
      panel.gyoker.style.height = (h - 95) + 'px';
      ev.preventDefault();
    }
    function vege(ev) {
      if (ev.pointerId !== pid) return;
      W.removeEventListener('pointermove', mozog); W.removeEventListener('pointerup', vege); W.removeEventListener('pointercancel', vege);
      fogoAktiv = false; ir('panel_magas', panelMagas); panelHatter();
    }
    W.addEventListener('pointermove', mozog, { passive: false }); W.addEventListener('pointerup', vege); W.addEventListener('pointercancel', vege);
    e.preventDefault(); e.stopPropagation();
  }
  function panelCim(s) {
    if (!panel) return;
    try { if (panel.tipus === 'wman' && typeof panel.win.setTitle === 'function') panel.win.setTitle(s); } catch (e) { }
    if (panel.cimEl) panel.cimEl.textContent = s;
  }
  function panelKattint(e) {
    var el = e.target.closest ? e.target.closest('[data-efp]') : null;
    if (!el) {
      var tr = jelolesBe && e.target.closest ? e.target.closest('[data-cella]') : null;
      if (tr) { var c = Number(tr.getAttribute('data-cella')), uj = c >= 0 && c !== utolsoErintes ? c : null; felkJelolt = undefined; felkJelol(uj); utolsoErintes = uj; }
      return;
    }
    var v = el.getAttribute('data-efp').split(':');
    if (v[0] === 'profil') { try { if (W.PlayerProfileWindow && typeof W.PlayerProfileWindow.open === 'function') W.PlayerProfileWindow.open(Number(v[1])); } catch (er) { hiba('profil', er); } return; }
    if (v[0] === 'varos') { try { if (W.TownWindow && typeof W.TownWindow.open === 'function') W.TownWindow.open(Number(v[1]), Number(v[2])); } catch (er) { hiba('város', er); } return; }
    if (v[0] === 'frissites') { felkFrissitKer(felkTarolo ? felkFortId(felkTarolo) : null); return; }
    var F = felkTarolo ? felkLista(felkTarolo) : null;
    if (v[0] === 'ruha') { ruhaGomb(F); }
    if (v[0] === 'ruha1') { ruhaEgy(Number(v[1])); }
    if (v[0] === 'fszuro') felkSzuro = v[1];
    if (v[0] === 'jel') { if (kijelolt[v[1]]) delete kijelolt[v[1]]; else kijelolt[v[1]] = true; csopMegerosit = false; }
    if (v[0] === 'jelmind') {
      var lathato = felkLathato(F), mind = lathato.length && lathato.every(function (p) { return kijelolt[p.id]; });
      kijelolt = {}; if (!mind) lathato.forEach(function (p) { kijelolt[p.id] = true; }); csopMegerosit = false;
    }
    if (v[0] === 'rangv' && F && rangJog(F) && !rangKuldes) {
      var cel = F.lista.filter(function (p) { return String(p.id) === v[1]; })[0];
      if (cel) rangDobozNyit(el, 'Sorozás: ' + cel.nev, adhatoRangok(F, cel.rang), function (r) { var o = {}; o[cel.id] = r; rangKuld(o); });
      return;
    }
    if (v[0] === 'csoprang' && F) { rangDobozNyit(el, 'Kijelöltek rangja', adhatoRangok(F, null), function (r) { csopRang = r; csopMegerosit = false; panelFrissit(true); }); return; }
    if (v[0] === 'csopkuld' && F && rangJog(F) && !rangKuldes) {
      if (!csopMegerosit) csopMegerosit = true;
      else {
        var ok = adhatoRangok(F, null).indexOf(csopRang) >= 0, o = {};
        F.lista.forEach(function (p) { if (kijelolt[p.id] && p.rang !== csopRang && adhatoRangok(F, p.rang).indexOf(csopRang) >= 0) o[p.id] = csopRang; });
        if (ok) rangKuld(o); csopMegerosit = false;
      }
    }
    if (v[0] === 'frend') { if (felkRend.k === v[1]) felkRend.le = !felkRend.le; else { felkRend.k = v[1]; felkRend.le = v[1] !== 'nev'; } }
    if (v[0] === 'shalott') { statHalott = !statHalott; ir('stat_halott', statHalott); }
    if (v[0] === 'eh') { ehGomb(); }
    if (v[0] === 'frissproba') { frissitesAblak(probaVerzio(VERZIO), VALTOZASOK, true); return; }
    if (v[0] === 'vszuro') { varhSzuro = v[1]; }
    if (v[0] === 'ful' && panelFul !== v[1]) { panelFul = v[1]; panelMeret(); }
    else if (v[0] === 'szuro') statSzuro = v[1];
    else if (v[0] === 'kor') statKor = v[1];
    else if (v[0] === 'rend') { if (statRend === v[1]) statLe = !statLe; else { statRend = v[1]; statLe = v[1] !== 'nev'; } }
    panelFrissit(true);
  }
  function jelCella(p) { return jelolesBe && p && !p.halott && p.pozicio != null && p.pozicio >= 0 ? ' data-cella="' + p.pozicio + '"' : ''; }
  function nevHtml(p) {
    var r = p.westId != null ? rangAllas[String(p.westId)] : null;
    return (r != null ? rangIkon(r) : '') + (p.osztalyKulcs ? osztIkon(p.osztalyKulcs) + ' ' : '') +
      '<a class="efp-nev ' + (p.halott ? '' : (p.tamado ? 't' : 'v')) + '"' + (p.westId != null ? ' data-efp="profil:' + p.westId + '" title="profil megnyitása"' : '') + '>' + esc(p.nev) + '</a>' + (p.halott ? ' \u271D' : '');
  }
  function epXY(p) { return fmt(Math.max(0, p.elet)) + ' / ' + fmt(p.eletMax); }
  function mostHtml(A) {
    var m = aktivFort ? arnyek[aktivFort] : null, sajat = sajatJatekos(A), K = A.karakterSzerint, h = [];
    var kor = A.korok.length ? A.korok[A.korok.length - 1] : null, so = sajat ? !!sajat.tamado : null;
    if (sajat) {
      var most = m && m.kesz && !sajat.halott ? lohetIde(A, m, sajat.pozicio, so).length : null;
      var vmost = m && m.kesz && !sajat.halott ? varhatoLovok(A, m, sajat.pozicio, so, sajat).length : null;
      var cc = sajat.celCella, vcel = !so && m && m.kesz && !sajat.halott && cc != null && cc >= 0 && cc !== sajat.pozicio ? varhatoLovok(A, m, cc, so, sajat).length : null;
      var ncel = vcel != null ? lohetIde(A, m, cc, so).length : null;
      var engem = kor ? kor.lovesek.filter(function (x) { return x.cel === sajat.karakterId; }) : [];
      h.push('<div class="efp-b kiem"><h4>Te <small>' + (so ? 'támadó' : 'védő') + ' · ' + epXY(sajat) + '</small></h4>' +
        '<div class="efp-s"><span>Várhatóan lő rád' + (vcel != null ? ' (mostani cella)' : '') + '</span><b>' + (sajat.halott ? 'kiestél' : vmost == null ? '...' : vmost + ' ellenfél') + '</b></div>' +
        (vcel != null ? '<div class="efp-s"><span>Várhatóan lő rád (célcella)</span><b' + (vcel > vmost ? ' style="color:#7a0f0a"' : '') + '>' + vcel + ' ellenfél</b></div>' : '') +
        '<div class="efp-s"><span>Láthat</span><b>' + (sajat.halott ? '-' : most == null ? '...' : most + (ncel != null ? ' / ' + ncel : '') + ' ellenfél') + '</b></div>' +
        '<div class="efp-s"><span>Előző körben rád lőttek</span><b>' + (engem.length ? engem.length + ' (' + fmt(engem.reduce(function (a, x) { return a + x.sebzes; }, 0)) + ')' : 'senki') + '</b></div>' +
        '<div class="lab">' + (so ? 'A védők a mostani cellád lövik; a lépés a következő körre számít.' : 'Előbb lősz, aztán lépsz; a támadók a célcelládra lőnek.') + '</div></div>');
    }
    if (kor && sajat) {
      var fok = {}; kor.lovesek.forEach(function (l) { (fok[l.cel] = fok[l.cel] || 0); fok[l.cel]++; });
      var ut = A.korok.slice(-HO_KOROK), kap = {}, ho = {}, M = modell(A.terkep);
      ut.forEach(function (k) { k.lovesek.forEach(function (l) { kap[l.cel] = (kap[l.cel] || 0) + l.sebzes; if (l.celPoz != null && l.celPoz >= 0) { var s = M.cellak[l.celPoz]; ho[s] = (ho[s] || 0) + l.sebzes; } }); });
      var vesz = A.jatekosok.filter(function (p) { return !p.halott && !!p.tamado === so && kap[p.karakterId] && kap[p.karakterId] / ut.length >= p.elet * 0.8; }).sort(function (a, b) { return a.elet - b.elet; });
      var lista = function (l, f) { return l.length ? l.join('') : '<div class="lab">' + f + '</div>'; };
      h.push('<div class="efp-b"><h4>Veszélyben <small>3 kör tempójával kieshet</small></h4>' + lista(vesz.slice(0, 4).map(function (p) { return '<div class="efp-s"' + jelCella(p) + '><span>' + nevHtml(p) + '</span><b style="color:#b3201a">' + epXY(p) + '</b></div>'; }), 'nincs') + '</div>');
      var fokL = function (oldal) {
        return Object.keys(fok).map(function (id) { return K[id]; }).filter(function (p) { return p && !!p.tamado === oldal && !(oldal !== so && p.halott); })
          .sort(function (a, b) { return fok[b.karakterId] - fok[a.karakterId]; }).slice(0, 3);
      };
      h.push('<div class="efp-b"><h4>Kit lő a csapat <small>előző kör</small></h4>' + lista(fokL(!so).map(function (p) { return '<div class="efp-s"' + jelCella(p) + '><span>' + nevHtml(p) + '</span><span><span class="jel">' + fok[p.karakterId] + '</span> ' + epXY(p) + '</span></div>'; }), 'senkit') + '</div>');
      h.push('<div class="efp-b"><h4>Társaidat lövik <small>előző kör</small></h4>' + lista(fokL(so).map(function (p) { return '<div class="efp-s"' + jelCella(p) + '><span>' + nevHtml(p) + '</span><span><span class="jel s">' + fok[p.karakterId] + '</span> ' + epXY(p) + '</span></div>'; }), 'senkit') + '</div>');
      var hoL = Object.keys(ho).sort(function (a, b) { return ho[b] - ho[a]; }).slice(0, 3);
      h.push('<div class="efp-b"><h4>Legnagyobb nyomás <small>3 kör sebzés</small></h4>' + lista(hoL.map(function (k) {
        var sz = A.terkep.sectors[k], nev = szektorNev(sz);
        return '<div class="efp-s"><span>' + esc(nev) + '</span><span>' + fmt(ho[k]) + '</span></div>';
      }), 'nincs') + '</div>');
      var tet = A.jatekosok.filter(function (p) { return !p.halott && !!p.tamado === so && !ut.some(function (k) { return k.lovesek.some(function (l) { return l.lovo === p.karakterId; }); }); });
      h.push('<div class="efp-b"><h4>Tétlen ' + ut.length + ' köre <small>' + tet.length + ' társ</small></h4>' + lista(tet.slice(0, 4).map(function (p) {
        return '<div class="efp-s"' + jelCella(p) + '><span>' + nevHtml(p) + '</span><span>' + (p.online ? '<span style="color:#22a01a">● online</span>' : '<span style="color:#888">● offline</span>') + '</span></div>';
      }), 'nincs') + (tet.length > 4 ? '<div class="lab">+' + (tet.length - 4) + ' további</div>' : '') + '</div>');
    } else h.push('<div class="lab">Az első kör után itt jelenik meg, ki kit lőtt.</div>');
    return h.join('');
  }
  function szektorNev(sz) {
    if (!sz) return 'udvar';
    try { if (W.FortBattleWindow && typeof W.FortBattleWindow.getSectorLabelText === 'function') { var t = W.FortBattleWindow.getSectorLabelText(sz.sourceId); if (t) return t; } } catch (e) { }
    return 'szektor ' + sz.sourceId;
  }
  var OSZT_SOR = ['soldier', 'worker', 'duelist', 'adventurer', 'greenhorn'];
  function statHianyHtml() {
    var f = aktivFort, hi = korHiany[f] || [], e = korElso[f], A = aktivAllapot();
    var st = 'color:#7a0f0a;font-weight:bold;margin-right:6px;border-bottom:1px dotted #7a0f0a;cursor:help';
    var veg = 'A harc végi összegzés teljes lesz.';
    if (e > ELSO_KOR) return '<span style="' + st + '" title="Az 1-' + (e - 1) + '. kör adatai nincsenek meg (az ablak akkor még nem volt nyitva).' + (hi.length ? '\nHiányzó körök még: ' + hi.join(', ') + '.' : '') + '\n' + veg + '">' + (A && A.kor > e ? e + '-' + A.kor : e) + '. kör</span>';
    if (hi.length) return '<span style="' + st + '" title="Hiányzó körök: ' + hi.join(', ') + '.\nAz ablak zárva volt vagy az oldal újratöltődött.\n' + veg + '">' + hi.length + ' kör hiányzik</span>';
    return '';
  }
  function statHtml(A) {
    var sajat = sajatJatekos(A), mag = magok[aktivFort].mag, vegso = mag.vegsoOsszesites(), h = [];
    var er = A.vege && A.vege.eredmeny ? A.vege.eredmeny : null, kor = A.korok.length ? A.korok[A.korok.length - 1] : null;
    var so = sajat ? !!sajat.tamado : null, K = A.karakterSzerint, cs = mag.csapatok();
    var max = (A.szabalyok && A.szabalyok.maxRounds) || (A.vege && A.vege.maxKor) || null;
    var zmax = (A.szabalyok && A.szabalyok.flagVictory) || (W.Game && W.Game.maxFlagHoldCount) || 5, zk = A.zaszloKor || 0;
    var ossz = function (p) {
      var v = vegso ? vegso[String(p.westId)] : null, e = er ? er[String(p.westId)] : null;
      var x = v ? { okozott: v.okozott, kapott: v.kapott, tal: v.talalat, lov: v.talalat + v.melle, kit: v.kiteres, kl: v.kapottTalalat + v.kiteres, ko: v.ko, leg: v.legnagyobb, onl: v.onlineKorok }
        : { okozott: p.okozott, kapott: p.kapott, tal: p.talalat, lov: p.talalat + p.melle, kit: p.kiteres, kl: p.kapottLoves, ko: p.ko, leg: p.legnagyobb, onl: p.onlineKorok };
      if (e) { x.krit = e.crithits || 0; x.pd = e.playdeadcount || 0; }
      return x;
    };
    var elozoK = {};
    if (kor) kor.lovesek.forEach(function (l) {
      var a = elozoK[l.lovo] = elozoK[l.lovo] || { okozott: 0, kapott: 0, tal: 0, lov: 0, kit: 0, kl: 0, ko: 0, leg: 0 };
      var c = elozoK[l.cel] = elozoK[l.cel] || { okozott: 0, kapott: 0, tal: 0, lov: 0, kit: 0, kl: 0, ko: 0, leg: 0 };
      var t = l.sebzes > 0 || l.ko;
      a.lov++; a.okozott += l.sebzes; if (t) a.tal++; if (l.ko) a.ko++; if (!l.ko && l.sebzes > a.leg) a.leg = l.sebzes;
      c.kl++; c.kapott += l.sebzes; if (!t) c.kit++;
    });
    var elozo = function (p) { return elozoK[p.karakterId] || { okozott: 0, kapott: 0, tal: 0, lov: 0, kit: 0, kl: 0, ko: 0, leg: 0 }; };
    function elozoSor(oldal) {
      if (!kor) return '';
      var l = kor.lovesek.filter(function (x) { return K[x.lovo] && !!K[x.lovo].tamado === oldal; });
      var tal = l.filter(function (x) { return x.sebzes > 0 || x.ko; }).length, ko = l.filter(function (x) { return x.ko; }).length;
      return '<span class="lab">előző kör: <b style="color:#3a2814">' + fmt(l.reduce(function (a, x) { return a + x.sebzes; }, 0)) + '</b> · ' + tal + '/' + l.length + ' talált · ' + ko + ' KO</span>';
    }
    var pt = ''; for (var i = 0; i < zmax; i++) pt += '<span class="potty' + (i < zk ? ' t' : '') + '"></span>';
    var zoldVan = [cs.vedo, cs.tamado].some(function (c) { var o = c.osztalyok[OSZT_KOD.greenhorn]; return o && (o.el + o.kiesett) > 0; });
    var osz = function (c) {
      return OSZT_SOR.map(function (k) {
        var o = c.osztalyok[OSZT_KOD[k]]; if (k === 'greenhorn' && !zoldVan) return '';
        return '<span class="o">' + osztIkon(k) + ' <b>' + (o ? o.el : 0) + '</b></span>';
      }).join('');
    };
    h.push('<div class="efp-osz"><div class="bal"><span><b>' + (A.kor || 0) + '. kör' + (max ? ' / ' + max : '') + '</b> <span class="lab">· zászló</span> ' + pt + ' <span class="lab">' + zk + ' / ' + zmax + '</span></span>' +
      '<span class="cs"><b class="t" style="font-size:9px">T </b>' + osz(cs.tamado) + '</span></div><span class="kz">|</span><div>' + osz(cs.vedo) + '<b class="v" style="font-size:9px"> V</b></div></div>');
    function bar(c, szin) { return '<div class="bar"><div style="width:' + (c.szazalek * 100).toFixed(1) + '%;background:' + szin + '"></div><b>' + c.el + ' / ' + c.letszam + ' él · ' + fmt(c.elet) + ' / ' + fmt(c.eletMax) + '</b></div>'; }
    function csap(oldal, nev, szin, grad, c) {
      var l = A.jatekosok.filter(function (p) { return !!p.tamado === oldal; }).map(function (p) { var o = ossz(p); o.nev = p.nev; return o; }), s = function (f) { return l.reduce(function (a, x) { return a + (x[f] || 0); }, 0); };
      var tal = s('tal'), lov = s('lov'), kit = s('kit'), kl = s('kl'), legX = l.reduce(function (a, x) { return (x.leg || 0) > (a ? a.leg || 0 : 0) ? x : a; }, null), leg = legX ? legX.leg : 0;
      var legNev = legX && leg ? String(legX.nev || '') : '';
      if (legNev.length > 16) legNev = legNev.slice(0, 15) + '…';
      var onl = so !== null && oldal === so ? c.online + ' fő' : '?';
      return '<div class="efp-b"><h4><span style="color:' + szin + '">' + nev + '</span>' + elozoSor(oldal) + '</h4>' + bar(c, grad) +
        '<div class="g4"><span>Okozott</span><b>' + fmt(s('okozott')) + '</b><span>Találat</span><b>' + tal + ' / ' + lov + ' (' + Math.round(tal / Math.max(1, lov) * 100) + '%)</b>' +
        '<span>Kitért</span><b>' + kit + ' / ' + kl + ' (' + Math.round(kit / Math.max(1, kl) * 100) + '%)</b><span>KO</span><b>' + s('ko') + '</b>' +
        '<span>Legnagyobb</span><b>' + fmt(leg) + (legNev ? ' <span class="lab" style="font-weight:normal">' + esc(legNev) + '</span>' : '') + '</b><span>Online</span><b>' + onl + '</b></div></div>';
    }
    h.push('<div class="ket">' + csap(true, 'Támadók', '#b3201a', 'linear-gradient(#e2412f,#a3150d)', cs.tamado) + csap(false, 'Védők', '#1f55b5', 'linear-gradient(#4d8ce0,#1d4f9a)', cs.vedo) + '</div>');
    var SZ = [['mind', 'Mind'], ['tamado', 'Támadók'], ['vedo', 'Védők'], ['sajat', 'Saját'], ['elo', 'Élők']];
    h.push('<div style="margin:2px 0 4px;display:flex;justify-content:space-between"><span>' + SZ.map(function (z) { return '<span class="chip' + (statSzuro === z[0] ? ' a' : '') + '" data-efp="szuro:' + z[0] + '">' + z[1] + '</span>'; }).join('') + '</span>' +
      '<span><span class="chip' + (statHalott ? ' a' : '') + '" data-efp="shalott" title="Bekapcsolva a kiesettek is a rangsorban a helyükön (szürkén, ✝); kikapcsolva alul">† is</span>' +
      statHianyHtml() +
      '<span class="chip' + (statKor === 'ossz' ? ' a' : '') + '" data-efp="kor:ossz">Összes kör</span><span class="chip' + (statKor === 'elozo' ? ' a' : '') + '" data-efp="kor:elozo"' + (kor ? '' : ' style="opacity:.5"') + '>Előző kör' + (kor ? ' (' + A.kor + '.)' : '') + '</span></span></div>');
    var ek = statKor === 'elozo';
    var l = A.jatekosok.filter(function (p) {
      return statSzuro === 'mind' || (statSzuro === 'vedo' && !p.tamado) || (statSzuro === 'tamado' && p.tamado) || (statSzuro === 'sajat' && so !== null && !!p.tamado === so) || (statSzuro === 'elo' && !p.halott);
    }).map(function (p) { var a = ek ? elozo(p) : ossz(p); a.p = p; a.elet = Math.max(0, p.elet); a.nev = String(p.nev || '').toLowerCase(); if (ek) a.onl = p.online === true ? 1 : p.online === false ? 0 : -1; return a; });
    var rk = statRend;
    l.sort(function (a, b) {
      if (!statHalott && a.p.halott !== b.p.halott) return a.p.halott ? 1 : -1;
      var x = a[rk], y = b[rk], c = x < y ? -1 : x > y ? 1 : 0;
      return (statLe ? -c : c) || (b.okozott - a.okozott);
    });
    var rgS = rangOlvas(aktivFort), vegeOszl = !!er && !ek;
    var th = function (k, n, cim) { return '<th class="r' + (statRend === k ? (statLe ? ' a' : ' a fel') : '') + '" data-efp="rend:' + k + '"' + (cim ? ' title="' + cim + '"' : '') + '>' + n + '</th>'; };
    var t = '<div class="efp-tbl gorget"><table><tr><th></th><th></th><th></th><th data-efp="rend:nev"' + (statRend === 'nev' ? ' class="a"' : '') + '>Név</th><th data-efp="rend:elet"' + (statRend === 'elet' ? ' class="a"' : '') + '>Életerő</th>' +
      th('okozott', 'Okozott') + th('kapott', 'Kapott') + th('tal', 'Talált', 'talált / leadott lövés') + th('kit', 'Kitért', 'kitért / rá leadott lövés') + th('ko', 'KO') + th('leg', 'Legn.', 'legnagyobb egy lövés') +
      th('onl', 'Onl.', ek ? 'online volt-e a körben' : 'online körök') + (vegeOszl ? th('krit', 'Krit', 'kritikus találat (harc vége)') + th('pd', 'Hal.t.', 'halottnak tettetés (harc vége)') : '') + '</tr>';
    var z = function (v) { return v ? v : '<span class="lab">0</span>'; };
    l.forEach(function (a) {
      var p = a.p, sajatCs = so !== null && !!p.tamado === so, r = sajatCs && rgS[String(p.westId)] ? rgS[String(p.westId)].rank : null;
      var dot = sajatCs ? '<span class="efp-dot ' + (p.online ? 'z' : 'sz') + '" title="' + (p.online ? 'online' : 'offline') + '"></span>' : '<span class="lab" title="az ellenfél online állapotát a szerver nem küldi">?</span>';
      var ep = '<span class="efp-ep k"><span class="efp-epb" style="width:' + (p.eletMax ? Math.round(a.elet / p.eletMax * 100) : 0) + '%"></span><span class="efp-ept">' + a.elet + ' / ' + p.eletMax + '</span><span class="efp-sziv">♥</span></span>';
      var onl = ek ? (a.onl === 1 ? 'igen' : a.onl === 0 ? 'nem' : '?') : (sajatCs ? a.onl : '?');
      t += '<tr' + (jelolesBe && !p.halott && p.pozicio != null && p.pozicio >= 0 ? ' data-cella="' + p.pozicio + '"' : '') + ' class="' + (p === sajat ? 'en ' : '') + (p.halott ? 'ko' : '') + '"><td>' + dot + '</td><td>' + (r != null ? rangIkon(r) : sajatCs ? '' : '<span class="lab">?</span>') + '</td><td>' + osztIkon(p.osztalyKulcs) + '</td>' +
        '<td class="nev"><a class="efp-nev ' + (p.halott ? '' : (p.tamado ? 't' : 'v')) + '" data-efp="profil:' + p.westId + '" title="profil megnyitása">' + esc(p.nev) + '</a>' + (p.halott ? ' ✝' : '') + '</td><td>' + ep + '</td>' +
        '<td class="r"><b>' + z(a.okozott ? fmt(a.okozott) : 0) + '</b></td><td class="r">' + z(a.kapott ? fmt(a.kapott) : 0) + '</td>' +
        '<td class="r">' + (a.lov ? a.tal + '/' + a.lov : '<span class="lab">-</span>') + '</td><td class="r">' + (a.kl ? a.kit + '/' + a.kl : '<span class="lab">-</span>') + '</td>' +
        '<td class="r">' + z(a.ko) + '</td><td class="r">' + z(a.leg ? fmt(a.leg) : 0) + '</td><td class="r">' + onl + '</td>' +
        (vegeOszl ? '<td class="r">' + z(a.krit) + '</td><td class="r">' + z(a.pd) + '</td>' : '') + '</tr>';
    });
    h.push(t + '</table></div>');
    var ne = nemErkezett(A);
    if (ne != null) h.push('<div class="lab" style="margin-top:2px">Nem érkezett meg: ' + ne + ' fő</div>');
    return h.join('');
  }
  function nemErkezett(A) {
    var r = aktivFort ? eloAdat[aktivFort] : null; if (!r || !r.v || !r.v.playerlist) return null;
    var w = {}; A.jatekosok.forEach(function (p) { if (p.westId != null) w[String(p.westId)] = 1; });
    return r.v.playerlist.filter(function (p) { return !w[String(p.player_id)]; }).length;
  }
  var OSZTALY = { '-1': 'greenhorn', '0': 'adventurer', '1': 'duelist', '2': 'worker', '3': 'soldier' };
  function fmt(n) { n = Math.round(n || 0); return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' '); }
  var RANG_KULCS = ['traitor', 'reservist', 'recruit', 'private', 'sergeant', 'captain', 'major_general', 'general'];
  var RANG_HU = { traitor: 'Áruló', reservist: 'Tartalékos', recruit: 'Újonc', private: 'Közlegény', sergeant: 'Őrmester', captain: 'Kapitány', major_general: 'Őrnagy', general: 'Tábornok' };
  var RANG_ROVID = { traitor: 'Ár.', reservist: 'Tart.', recruit: 'Új.', private: 'Közl.', sergeant: 'Őrm.', captain: 'Kap.', major_general: 'Őrn.', general: 'Táb.' };
  var rangAllas = {}, rangValtozasok = [];
  function rangCim(k) { try { var t = W.Chat && W.Chat.rankTitles; if (t && t[k]) return t[k]; } catch (e) { } return RANG_HU[k] || k; }
  function rangOlvas(fortId) {
    var ki = {};
    try {
      var man = W.Chat && W.Chat.Resource && W.Chat.Resource.Manager;
      if (!man || typeof man.getRooms !== 'function') return ki;
      var sz = man.getRooms() || {};
      for (var k in sz) {
        if (!Object.prototype.hasOwnProperty.call(sz, k)) continue;
        var r = sz[k];
        if (!r || String(r.id).indexOf('fortbattle') < 0) continue;
        if (fortId != null && r.fortId != null && String(r.fortId) !== String(fortId)) continue;
        var rk = r.ranks || {};
        for (var w in rk) if (Object.prototype.hasOwnProperty.call(rk, w) && rk[w] && typeof rk[w].rank === 'number') ki[w] = { rank: rk[w].rank, cella: rk[w].position, szabad: !!rk[w].isfreelancer };
      }
    } catch (e) { hiba('rangok', e); }
    Object.keys(ki).forEach(function (w) {
      var r = rangAllas[w];
      if (r != null && r !== ki[w].rank) { rangValtozasok.push({ w: w, regi: r, uj: ki[w].rank, ido: Date.now() }); if (rangValtozasok.length > 30) rangValtozasok.shift(); }
      rangAllas[w] = ki[w].rank;
    });
    return ki;
  }
  function rangIkon(rank) {
    var k = RANG_KULCS[rank + 2]; if (!k) return '';
    return '<img src="' + cdnUrl() + '/images/chat/servicegrade_' + k + '.png" alt="' + RANG_ROVID[k] + '" title="' + esc(rangCim(k)) + '" style="width:18px;height:15px;vertical-align:middle;margin-right:2px"' +
      ' onerror="this.outerHTML=\'<span class=&quot;lab&quot;>' + RANG_ROVID[k] + '</span>\'">';
  }
  var OSZT_KULCSOK = ['soldier', 'worker', 'duelist', 'adventurer', 'greenhorn'];
  var OSZT_ROVID = { soldier: 'kat.', worker: 'munk.', duelist: 'párb.', adventurer: 'kal.', greenhorn: 'zöldf.' };
  var OSZT_NEV_HU = { soldier: 'Katona', worker: 'Munkás', duelist: 'Párbajhős', adventurer: 'Kalandor', greenhorn: 'Zöldfülű' };
  function osztNevek() {
    var m = {};
    OSZT_KULCSOK.forEach(function (k) {
      var n = null;
      try { var IH = W.Game && W.Game.InfoHandler; if (IH && typeof IH.getLocalString4Charclass === 'function') n = IH.getLocalString4Charclass(k); } catch (e) { }
      m[k] = n || OSZT_NEV_HU[k];
    });
    return m;
  }
  function osztIkon(k) {
    if (!k) return '';
    return '<img src="' + cdnUrl() + '/images/class_choose/symbol_' + k + '_small_chat.png" alt="' + OSZT_ROVID[k] + '" title="' + esc(osztNevek()[k] || k) + '" style="width:13px;height:13px;vertical-align:-2px"' +
      ' onerror="this.outerHTML=\'<span class=&quot;lab&quot;>' + OSZT_ROVID[k] + '</span>\'">';
  }
  function felkAblak(t) { return t && t.closest ? t.closest('.tw2gui_window') : null; }
  function felkOlvas(t) {
    var ablak = felkAblak(t), lista = ablak ? ablak.querySelector('.fort_battle_playerlist_list') : null;
    if (!lista) return null;
    var nevek = osztNevek(), el = lista.querySelectorAll('.player'), l = [];
    for (var i = 0; i < el.length; i++) {
      var m = /playercell-(-?\d+)/.exec(el[i].className || ''), ti = el[i].getAttribute('title') || '', k = null, varos = '';
      OSZT_KULCSOK.forEach(function (kk) { if (!k && nevek[kk] && ti.indexOf(nevek[kk]) === 0) k = kk; });
      if (k) { varos = ti.slice(nevek[k].length).replace(/^\s+/, '').replace(/\s*városból\s*$/, ''); }
      l.push({ nev: (el[i].textContent || '').trim(), cella: m ? parseInt(m[1], 10) : -1, osztaly: k, varos: varos });
    }
    return { lista: l, megnyitva: el.length > 0 };
  }
  function felkSzektorNev(fortId, cella) {
    var mg = fortId && magok[fortId] ? magok[fortId].mag.allapot() : null, M = mg && mg.terkep ? modell(mg.terkep) : null;
    if (!M || cella < 0) return null;
    return szektorNev(mg.terkep.sectors[M.cellak[cella]]);
  }
  function felkFortId(t) { var m = t && /fort_battle_(\d+)_/.exec(t.id || ''); return m ? m[1] : null; }
  function felkJelek(t, f) {
    if (!f) return '';
    var w = Math.round((t.offsetWidth || 510) / CELLA), h = Math.round((t.offsetHeight || 360) / CELLA), db = {}, s = [];
    f.lista.forEach(function (p) { if (p.cella >= 0) db[p.cella] = (db[p.cella] || 0) + 1; });
    Object.keys(db).forEach(function (c) {
      if (db[c] < 2) return;
      var x = (c % w) * CELLA, y = Math.floor(c / w) * CELLA;
      s.push('<circle cx="' + (x + 14) + '" cy="' + (y + 1) + '" r="7" fill="#2a170a" stroke="#ffd200" stroke-width="1.5"/><text x="' + (x + 14) + '" y="' + (y + 4.5) +
        '" font-size="10" font-weight="bold" fill="#fff" text-anchor="middle" font-family="Arial">' + db[c] + '</text>');
    });
    return s.length ? '<svg width="' + w * CELLA + '" height="' + h * CELLA + '" xmlns="http://www.w3.org/2000/svg" style="position:absolute;left:0;top:0;overflow:visible">' + s.join('') + '</svg>' : '';
  }
  var eloAdat = {}, eloTerkep = {};
  (function xhrFigyel() {
    var XP = W.XMLHttpRequest && W.XMLHttpRequest.prototype;
    if (!XP || XP.__efHorog) return;
    var info = new WeakMap(), eOpen = XP.open, eSend = XP.send;
    XP.open = function (m, u) { try { info.set(this, { u: String(u) }); } catch (e) { } return eOpen.apply(this, arguments); };
    XP.send = function (body) {
      try {
        var inf = info.get(this);
        if (inf && /window=profile/.test(inf.u) && /mode=init/.test(inf.u)) {
          var pid = /playerId=(\d+)/.exec(typeof body === 'string' ? body : ''), px = this;
          if (pid) px.addEventListener('load', function () { try { var j = JSON.parse(px.responseText); ruhaTarol(pid[1], j && j.wear ? j : j && j.data); } catch (e) { } });
        }
        if (inf && /fort_battlepage|getfortmap/.test(inf.u)) {
          var b = typeof body === 'string' ? body : '', xhr = this;
          var fid = /fort_id=(\d+)/.exec(b) || /fort_id=(\d+)/.exec(inf.u) || /getfortmap\/(\d+)/.exec(inf.u);
          if (fid) xhr.addEventListener('load', function () { try { eloValasz(inf.u, fid[1], xhr); } catch (e) { hiba('válasz', e); } });
        }
      } catch (e) { }
      return eSend.apply(this, arguments);
    };
    try { Object.defineProperty(XP, '__efHorog', { value: true }); } catch (e) { }
  })();
  function eloValasz(u, fortId, xhr) {
    if (xhr.responseType !== '' && xhr.responseType !== 'text') return;
    var j = null; try { j = JSON.parse(xhr.responseText); } catch (e) { return; }
    if (!j || typeof j !== 'object') return;
    if (/getfortmap/.test(u)) { if (j.cells && j.sectors) eloTerkep[fortId] = j; }
    else if (j.playerlist) {
      var r = eloAdat[fortId] = eloAdat[fortId] || { v: {} };
      for (var k in j) if (Object.prototype.hasOwnProperty.call(j, k) && k !== 'sessionId' && k !== 'session') r.v[k] = j[k];
      r.ido = Date.now();
    }
    valtozott = true;
  }
  function felkFrissitKer(fortId) {
    if (!fortId || !W.Ajax || typeof W.Ajax.remoteCallMode !== 'function') return false;
    var r = eloAdat[fortId]; if (r && r.kerve && Date.now() - r.kerve < 5000) return false;
    (eloAdat[fortId] = eloAdat[fortId] || { v: {} }).kerve = Date.now();
    try { W.Ajax.remoteCallMode('fort_battlepage', 'index', { fort_id: fortId }, function () { valtozott = true; }); } catch (e) { hiba('frissítés', e); return false; }
    return true;
  }
  var RUHA_KEP = { health: 'strength', leadership: 'charisma', aim: 'dexterity', dodge: 'flexibility', hide: 'flexibility', pitfall: 'dexterity' };
  function egeszFel(x) { return Math.ceil(Math.round(x * 1e6) / 1e6); }
  function ruhaSzamol(szint, wear) {
    var IM = W.ItemManager, SM = W.west && W.west.storage && W.west.storage.ItemSetManager;
    if (!IM || typeof IM.get !== 'function' || !wear) return null;
    var e = {}, fb = { offense: 0, defense: 0, resistance: 0 }, sz = { offense: 0, defense: 0, damage: 0 }, kozelito = false, szettDb = {};
    var add = function (k, v) { e[k] = (e[k] || 0) + v; };
    Object.keys(wear).forEach(function (hely) {
      if (hely === 'player_id' || !wear[hely]) return;
      var it = null; try { it = IM.get(wear[hely]); } catch (x) { }
      if (!it || !it.bonus) return;
      var lv = Number(it.item_level) || 0, f = 1 + lv / 10, b = it.bonus;
      if (it.set) szettDb[it.set] = (szettDb[it.set] || 0) + 1;
      ['skills', 'attributes'].forEach(function (cs) { var o = b[cs]; if (o && !Array.isArray(o)) Object.keys(o).forEach(function (k) { add(k, Number(o[k]) || 0); }); });
      if (b.fortbattle) { fb.offense += b.fortbattle.offense || 0; fb.defense += b.fortbattle.defense || 0; fb.resistance += b.fortbattle.resistance || 0; }
      if (b.fortbattlesector) { sz.offense += b.fortbattlesector.offense || 0; sz.defense += b.fortbattlesector.defense || 0; sz.damage += b.fortbattlesector.damage || 0; }
      (b.item || []).forEach(function (x) {
        if (x.type === 'character' && x.bonus && (x.bonus.type === 'skill' || x.bonus.type === 'attribute') && x.bonus.name) {
          var v = egeszFel(x.bonus.value * szint); if (lv) v = Math.round(v * f);
          add(x.bonus.name, v);
        } else if (x.type === 'fortbattle') {
          if (lv) kozelito = true;
          var o = x.isSector ? sz : fb; if (o[x.name] != null) o[x.name] += Number(x.value) || 0;
        }
      });
    });
    Object.keys(szettDb).forEach(function (k) {
      var s = null; try { s = SM && typeof SM.get === 'function' ? SM.get(k) : null; } catch (x) { }
      if (!s || !s.bonus) return;
      var gy = {};
      for (var n = 2; n <= szettDb[k]; n++) (s.bonus[n] || s.bonus[String(n)] || []).forEach(function (x) {
        if (x.type === 'character' && x.bonus && (x.bonus.type === 'skill' || x.bonus.type === 'attribute') && x.bonus.name) gy[x.bonus.name] = (gy[x.bonus.name] || 0) + x.bonus.value;
        else if (x.type === 'fortbattle') { var o = x.isSector ? sz : fb; if (o[x.name] != null) o[x.name] += Number(x.value) || 0; }
      });
      Object.keys(gy).forEach(function (nm) { add(nm, egeszFel(gy[nm] * szint)); });
    });
    var ki = { kozelito: kozelito, nyers: e };
    Object.keys(RUHA_KEP).forEach(function (k) { ki[k] = (e[k] || 0) + (e[RUHA_KEP[k]] || 0); });
    ki.fbTam = fb.offense; ki.fbVed = fb.defense; ki.fbEll = fb.resistance; ki.szSeb = sz.damage; ki.szTam = sz.offense; ki.szVed = sz.defense;
    return ki;
  }
  var ruhaTar = olvas('ruha_tar', {}) || {}, ruhaSor = [], ruhaIdozito = null, ruhaSzunet = false, RUHA_REGI = 12 * 3600e3;
  var varosTar = olvas('varos_tar', {}) || {};
  function ruhaTarol(id, resp) {
    if (!resp || !resp.wear || id == null) return;
    var w = {}; Object.keys(resp.wear).forEach(function (k) { if (k !== 'player_id' && resp.wear[k]) w[k] = resp.wear[k]; });
    ruhaTar[String(id)] = { ido: Date.now(), szint: resp.level, wear: w };
    var tw = resp.town;
    if (tw && tw.town_id != null && tw.town_x != null && tw.town_y != null) { varosTar[String(tw.town_id)] = { x: Number(tw.town_x), y: Number(tw.town_y), nev: tw.name || '', ido: Date.now() }; ir('varos_tar', varosTar); }
    Object.keys(ruhaTar).forEach(function (k) { if (Date.now() - (ruhaTar[k].ido || 0) > 7 * 864e5) delete ruhaTar[k]; });
    ir('ruha_tar', ruhaTar); valtozott = true;
  }
  function ruhaErtek(id) { var r = ruhaTar[String(id)]; return r ? ruhaSzamol(r.szint, r.wear) : null; }
  function ruhaKell(id) { var r = ruhaTar[String(id)]; return !r || Date.now() - (r.ido || 0) > RUHA_REGI; }
  var ruhaMindMeg = false, ruhaMegIdo = null, ruhaUtolso = 0, ruhaFolyik = {}, ruhaFriss = {};
  function ruhaKer(id) {
    ruhaUtolso = Date.now(); ruhaFolyik[id] = true;
    setTimeout(function () { if (ruhaFolyik[id]) { delete ruhaFolyik[id]; valtozott = true; } }, 15000);
    try {
      W.Ajax.remoteCallMode('profile', 'init', { playerId: id }, function (resp) {
        try { ruhaTarol(id, resp && resp.wear ? resp : resp && resp.data); } catch (e) { hiba('ruha', e); }
        delete ruhaFolyik[id]; ruhaFriss[id] = Date.now(); valtozott = true;
        setTimeout(function () { valtozott = true; }, 3100);
      });
    } catch (e) { delete ruhaFolyik[id]; hiba('ruha kérés', e); }
  }
  function ruhaIndit() {
    ruhaSzunet = false;
    if (!ruhaSor.length) { valtozott = true; return; }
    var lepes = function () {
      var id = ruhaSor.shift();
      if (id == null) { clearInterval(ruhaIdozito); ruhaIdozito = null; valtozott = true; return; }
      ruhaKer(id); valtozott = true;
      if (!ruhaSor.length) { clearInterval(ruhaIdozito); ruhaIdozito = null; }
    };
    var kesl = Math.max(0, 2000 - (Date.now() - ruhaUtolso));
    ruhaIdozito = setInterval(lepes, 2000);
    setTimeout(function () { if (ruhaIdozito) lepes(); }, kesl);
  }
  function ruhaGomb(F) {
    if (ruhaIdozito) { clearInterval(ruhaIdozito); ruhaIdozito = null; ruhaSzunet = true; valtozott = true; return; }
    if (ruhaSzunet && ruhaSor.length) { ruhaIndit(); return; }
    if (!F || !F.lista) return;
    var ids = F.lista.filter(function (p) { return p.id != null; }).map(function (p) { return p.id; });
    var hiany = ids.filter(function (id) { return ruhaKell(id); });
    if (hiany.length) { ruhaMindMeg = false; ruhaSor = hiany; ruhaIndit(); return; }
    if (!ruhaMindMeg) {
      ruhaMindMeg = true; clearTimeout(ruhaMegIdo);
      ruhaMegIdo = setTimeout(function () { ruhaMindMeg = false; valtozott = true; }, 5000);
      valtozott = true; return;
    }
    ruhaMindMeg = false; clearTimeout(ruhaMegIdo); ruhaSor = ids; ruhaIndit();
  }
  function ruhaEgy(id) {
    if (id == null || ruhaFolyik[id]) return;
    if (ruhaIdozito) { ruhaSor = ruhaSor.filter(function (x) { return String(x) !== String(id); }); ruhaSor.unshift(id); valtozott = true; return; }
    var kesl = Math.max(0, 2000 - (Date.now() - ruhaUtolso));
    ruhaFolyik[id] = true; valtozott = true;
    setTimeout(function () { ruhaKer(id); }, kesl);
  }
  function ruhaAllas(F) {
    var l = F.lista.filter(function (p) { return p.id != null; }), van = l.filter(function (p) { return ruhaTar[String(p.id)]; });
    var legregebbi = van.reduce(function (a, p) { var t = ruhaTar[String(p.id)].ido || 0; return a == null || t < a ? t : a; }, null);
    return { kesz: van.length, ossz: l.length, hiany: l.filter(function (p) { return ruhaKell(p.id); }).length, sor: ruhaSor.length, fut: !!ruhaIdozito, szunet: ruhaSzunet && ruhaSor.length > 0, ido: legregebbi };
  }
  function oraPerc(t) { var d = new Date(t); return d.getHours() + ':' + ('0' + d.getMinutes()).slice(-2); }
  var harcErtek = olvas('harc_ertek', {}) || {};
  function harcErtekMent(v) {
    if (!v || !v.eredmeny) return;
    var d = new Date(v.ido || Date.now()), nap = ('0' + (d.getMonth() + 1)).slice(-2) + '.' + ('0' + d.getDate()).slice(-2) + '.', db = 0;
    Object.keys(v.eredmeny).forEach(function (w) {
      var s = v.eredmeny[w] && v.eredmeny[w].secret; if (!s || s.leadership == null) return;
      harcErtek[String(w)] = { ido: d.getTime(), nap: nap, leadership: s.leadership, aim: s.aim, dodge: s.dodge, hide: s.hide, pitfall: s.pitfall };
      db++;
    });
    Object.keys(harcErtek).forEach(function (k) { if (Date.now() - (harcErtek[k].ido || 0) > 60 * 864e5) delete harcErtek[k]; });
    if (db) { ir('harc_ertek', harcErtek); valtozott = true; }
  }
  var RANG_SZOVEG = { 4: 'Előléptetés őrnaggyá', 3: 'Előléptetés kapitánnyá', 2: 'Kinevezés őrmesternek', 1: 'Kinevezés közlegénnyé', 0: 'Kinevezés újonccá', '-1': 'Kinevezés tartalékosnak', '-2': 'Megbélyegzés árulóként' };
  var kijelolt = {}, felkSzuro = 'mind', csopRang = 1, csopMegerosit = false, rangKuldes = false, rangDoboz = null;
  function sajatRang(F) {
    var en = W.Character || {}, p = F && F.lista ? F.lista.filter(function (x) { return x.id == en.playerId; })[0] : null;
    return p && p.rang != null && !isNaN(p.rang) ? Number(p.rang) : null;
  }
  function rangJog(F) { var r = felkTarolo ? eloAdat[felkFortId(felkTarolo)] : null; return !!(r && r.v && r.v.canSetPrivilege); }
  function adhatoRangok(F, jelenlegi) {
    var en = sajatRang(F); if (en == null || (jelenlegi != null && !isNaN(jelenlegi) && jelenlegi >= en)) return [];
    return [4, 3, 2, 1, 0, -1, -2].filter(function (r) { return r < en && r !== jelenlegi; });
  }
  function rangKuld(valtas) {
    var fortId = felkTarolo ? felkFortId(felkTarolo) : null;
    if (rangKuldes || !fortId || !W.Ajax || typeof W.Ajax.remoteCall !== 'function' || !Object.keys(valtas).length) return;
    rangKuldes = true; valtozott = true;
    try {
      W.Ajax.remoteCall('fort_battlepage', 'updatePrivileges', { fort_id: fortId, privileges: valtas }, function () { rangKuldes = false; kijelolt = {}; csopMegerosit = false; valtozott = true; });
    } catch (e) { rangKuldes = false; hiba('rangosztás', e); }
    setTimeout(function () { if (rangKuldes) { rangKuldes = false; valtozott = true; } }, 10000);
  }
  function rangDobozZar() { if (rangDoboz && rangDoboz.parentNode) rangDoboz.parentNode.removeChild(rangDoboz); rangDoboz = null; }
  function rangDobozNyit(el, cim, opciok, valaszt) {
    rangDobozZar(); if (!opciok.length) return;
    var d = document.createElement('div'); d.className = 'efp efp-valaszto';
    d.innerHTML = '<div class="vf">' + esc(cim) + '</div>' + opciok.map(function (r) { return '<div class="vs" data-r="' + r + '">' + rangIkon(r) + ' ' + esc(RANG_SZOVEG[r]) + '</div>'; }).join('') + '<div class="vs mg">Mégse</div>';
    var b = el.getBoundingClientRect();
    d.style.left = Math.max(4, Math.min(b.left, (W.innerWidth || 1200) - 260)) + 'px'; d.style.top = Math.min(b.bottom + 2, (W.innerHeight || 800) - 30 * (opciok.length + 2)) + 'px';
    d.addEventListener('click', function (e) {
      var o = e.target.closest ? e.target.closest('.vs') : null; if (!o) return;
      e.stopPropagation(); var r = o.getAttribute('data-r'); rangDobozZar(); if (r != null) valaszt(Number(r));
    });
    document.body.appendChild(d); rangDoboz = d;
  }
  document.addEventListener('mousedown', function (e) { if (rangDoboz && !rangDoboz.contains(e.target)) rangDobozZar(); }, true);
  function gfModell(t) {
    if (!t || !t.cells || !t.sectors) return null;
    return { w: t.width || 34, h: t.height || 24, cellak: t.cells, szektorok: t.sectors,
      szazalek: !t.sectors.some(function (s) { return (s.attackerBonus || 0) >= 2; }) };
  }
  var OSZT_KOD = { adventurer: 0, duelist: 1, worker: 2, soldier: 3, greenhorn: -1 };
  function bonuszFmt(x, szazalek) {
    if (!x) return '0';
    if (szazalek) { var v = Math.round(x * 1000) / 10; return (v > 0 ? '+' : '') + String(v).replace('.', ',') + '%'; }
    return (x > 0 ? '+' : '') + x;
  }
  function felkLista(t) {
    var fortId = felkFortId(t), r = eloAdat[fortId], G = gfModell(eloTerkep[fortId]);
    if (r && r.v.playerlist) {
      var fc = r.v.fortCoords, en = W.Character || {};
      return { forras: 'szerver', ido: r.ido, fortCoords: fc, G: G, lista: r.v.playerlist.map(function (p) {
        var cella = p.player_id == en.playerId && r.v.selfIdx != null ? r.v.selfIdx : p.idx;
        var sz = G && cella >= 0 ? G.szektorok[G.cellak[cella]] : null;
        var ob = sz && sz.classBonus && sz.classType === OSZT_KOD[p['class']] ? sz.classBonus : 0;
        return { id: p.player_id, nev: p.name, cella: cella, osztaly: p['class'], varos: p.townname || '', townId: p.town_id != null ? p.town_id : null, szint: p.level, rang: Number(p.privilege),
          elet: p.currhealth, eletMax: p.maxhealth, erodnel: fc && p.coords ? (p.coords.x == fc.x && p.coords.y == fc.y) : null, besorozta: p.officername || null,
          tb: sz ? sz.attackerBonus || 0 : null, vb: sz ? sz.defenderBonus || 0 : null, mag: sz ? sz.height || 0 : null, ob: sz ? ob : null };
      }) };
    }
    var f = felkOlvas(t);
    if (!f || !f.megnyitva) return null;
    return { forras: 'dom', G: G, lista: f.lista.map(function (p) { return { id: null, nev: p.nev, cella: p.cella, osztaly: p.osztaly, varos: p.varos, szint: null, rang: null, elet: null, eletMax: null, erodnel: null, tb: null, vb: null, mag: null, ob: null }; }) };
  }
  var felkRend = { k: 'leadership', le: true };
  var OSZT_RANG = { soldier: 5, worker: 4, duelist: 3, adventurer: 2, greenhorn: 1 };
  var RUHA_OSZLOP = [['health', 'ÉP', 'életerő pont'], ['leadership', 'Irány.', 'irányítás', 1], ['aim', 'Célz.', 'célzás', 1],
    ['dodge', 'Kitér.', 'kitérés', 1], ['hide', 'Rejt.', 'rejtőzés', 1], ['pitfall', 'Csap.', 'csapdaállítás', 1],
    ['fbTam', 'Tám.', 'erődharc támadás (ruha)'], ['fbVed', 'Véd.', 'erődharc védekezés (ruha)'], ['fbEll', 'Ell.', 'erődharc ellenállás (ruha)']];
  function cellaErtek(p, o) {
    var h = o[3] && p.harc ? p.harc[o[0]] : null;
    if (h != null) return { v: h, ruha: false };
    if (p.ruha && p.ruha[o[0]] != null) return { v: p.ruha[o[0]], ruha: /^(health|leadership|aim|dodge|hide|pitfall)$/.test(o[0]) };
    return null;
  }
  function varosHtml(p) {
    if (!p.varos) return '<span class="lab">-</span>';
    var v = p.townId != null ? varosTar[String(p.townId)] : null;
    if (!v) return '<span title="' + esc(p.varos) + ' (a város helye a ruha frissítése után ismert: ↻)">' + esc(p.varos) + '</span>';
    return '<a class="efp-nev efp-varosl" data-efp="varos:' + v.x + ':' + v.y + '" title="' + esc(p.varos) + ': város megnyitása">' + esc(p.varos) + '</a>';
  }
  function felkLathato(F) {
    if (!F) return [];
    return F.lista.filter(function (p) { return felkSzuro === 'mind' || (felkSzuro === 'ujonc' && p.rang === 0) || (felkSzuro === 'nincsott' && p.erodnel === false); });
  }
  function felkHtml(t) {
    var F = felkLista(t), h = [];
    if (!F) return '<div class="efp-b kiem"><h4>Adat</h4><div>Még nem jött adat a játéktól. Kattints a fenti Lista gombra, vagy nyisd meg a natív <b>Játékoslista</b> linket.</div></div>';
    var l = F.lista, ott = l.filter(function (p) { return p.erodnel; }).length;
    var se = l.reduce(function (a, p) { return a + (p.elet || 0); }, 0), sm = l.reduce(function (a, p) { return a + (p.eletMax || 0); }, 0);
    var rg = rangOlvas(felkFortId(t));
    l.forEach(function (p) {
      if (p.id != null && rg[String(p.id)]) p.rang = rg[String(p.id)].rank;
      p.ruha = p.id != null ? ruhaErtek(p.id) : null;
      p.harc = p.id != null ? harcErtek[String(p.id)] || null : null;
    });
    var szerver = F.forras === 'szerver', ra = szerver ? ruhaAllas(F) : null, jog = szerver && rangJog(F);
    var ruhaCim = !ra ? '' : ra.fut ? 'Szünet · még ' + ra.sor + ' …' : ra.szunet ? 'Folytatás · még ' + ra.sor :
      !ra.kesz ? 'Ruhák betöltése · 0 / ' + ra.ossz : ra.hiany ? 'Ruhák: ' + ra.hiany + ' hiányzik ⟳' :
      ruhaMindMeg ? 'Mind újra? ' + ra.ossz + ' profil, kb. ' + (ra.ossz * 2) + ' mp' : 'Ruhák: ' + oraPerc(ra.ido) + ' · ' + ra.kesz + ' / ' + ra.ossz + ' ⟳';
    var ruhaBub = !ra ? '' : ra.fut ? 'Futás: 2 mp-enként 1 profil. Érintésre szünetel.' : ra.szunet ? 'Szünetel. Érintésre folytatja.' :
      ra.hiany ? 'Hiányzó vagy 12 óránál régebbi ruhák betöltése (' + ra.hiany + ' profil), 2 mp-enként 1 (ugyanaz, mint a profil megnyitása).' :
      'Mindenki ruhájának újratöltése (' + ra.ossz + ' profil, 2 mp-enként 1), megerősítéssel. Egy embert a sor végi ↻ frissít.';
    h.push('<div class="efp-fej"><span><b>Bajtársak ' + l.length + '</b>' +
      (szerver ? ' · <span class="efp-dot z"></span> az erődnél ' + ott : '') + '</span>' +
      '<span class="efp-frs">' + (ra ? '<span class="chip' + (ra.fut ? ' a' : ruhaMindMeg && !ra.hiany && !ra.szunet ? ' meg' : '') + '" data-efp="ruha" title="' + esc(ruhaBub) + '">' + ruhaCim + '</span>' : '') +
      '<span class="chip" data-efp="frissites" title="Bajtársak lista frissítése: 1 lekérdezés (ugyanaz, mint az ablak megnyitásakor)">Lista: <span id="efp-kor"></span> ⟳</span></span></div>');
    if (szerver) {
      var vo = varhOsszeg(l), pr = sm ? Math.round(se / sm * 100) : 0;
      var jobb = vo.nHarc ? '<div title="A Várható erő fül adataiból: a legutóbbi erődharc életereje; akiről nincs adat, annál a mostani"><div class="k">Várható erődharc életerő</div><div class="v" style="color:#5e2f7a">' + fmt(vo.ossz) + '</div>' +
          '<div class="efp-nsav eh"><b style="width:' + Math.round(vo.nEh / Math.max(1, l.length) * 100) + '%"></b><span>' + vo.nEh + ' / ' + l.length + ' fő EH adatból · ' + napCim(vo.legujabb) + '</span></div></div>' :
        '<div style="display:flex;flex-direction:column;justify-content:center;align-items:center"><div class="k">Várható erődharc életerő</div><span class="chip a" data-efp="eh" style="margin-top:4px">' + (ehAll.fut ? 'Korábbi EH: …' : 'Korábbi EH letöltése ⟳') + '</span>' + (ehAll.hiba ? '<div class="k" style="margin-top:2px;color:#7a0f0a">' + esc(ehAll.hiba) + '</div>' : '<div class="k" style="margin-top:2px">a Várható erő fülön is</div>') + '</div>';
      h.push('<div class="efp-nagy"><div><div class="k">Csapat életereje most</div><div class="v">' + fmt(se) + ' <small>/ ' + fmt(sm) + '</small></div>' +
        '<div class="efp-nsav"><b style="width:' + pr + '%"></b><span>' + pr + '%' + (sm > se ? ' · hiányzik ' + fmt(sm - se) : '') + '</span></div></div>' + jobb + '</div>');
    }
    var db = {}; l.forEach(function (p) { if (p.rang != null && !isNaN(p.rang)) db[p.rang] = (db[p.rang] || 0) + 1; });
    var rs = [5, 4, 3, 2, 1, 0, -1, -2].filter(function (r) { return db[r]; });
    if (rs.length) h.push('<div style="margin-bottom:3px">' + rs.map(function (r) { return '<span class="efp-rc">' + rangIkon(r) + ' ' + db[r] + '</span>'; }).join('') + '</div>');
    var nUj = l.filter(function (p) { return p.rang === 0; }).length, nNo = l.filter(function (p) { return p.erodnel === false; }).length;
    var nKij = l.filter(function (p) { return kijelolt[p.id]; }).length;
    var nVal = jog ? l.filter(function (p) { return kijelolt[p.id] && p.rang !== csopRang && adhatoRangok(F, p.rang).indexOf(csopRang) >= 0; }).length : 0;
    var SZ = [['mind', 'Mind'], ['ujonc', 'Csak újoncok · ' + nUj], ['nincsott', 'Nincs ott · ' + nNo]];
    h.push('<div class="efp-tobor"><span>' + SZ.map(function (z) { return '<span class="chip' + (felkSzuro === z[0] ? ' a' : '') + '" data-efp="fszuro:' + z[0] + '">' + z[1] + '</span>'; }).join('') + '</span>' +
      (jog && nKij ? '<span><b>' + nKij + ' kijelölve:</b> <span class="chip" data-efp="csoprang">' + rangIkon(csopRang) + ' ' + esc(rangCim(RANG_KULCS[csopRang + 2])) + ' ▾</span>' +
        '<span class="chip a" data-efp="csopkuld">' + (rangKuldes ? 'Küldés…' : csopMegerosit ? 'Biztos? ' + nVal + ' fő → ' + esc(rangCim(RANG_KULCS[csopRang + 2])) + (nKij > nVal ? ' (' + (nKij - nVal) + ' nem változik)' : '') : 'Rangosztás (1 kérés)') + '</span></span>' : '') + '</div>');
    var k = felkRend.k, ertek = function (p) {
      if (k === 'erodnel') return p.erodnel == null ? null : p.erodnel ? 1 : 0;
      if (k === 'rang') return p.rang != null && !isNaN(p.rang) ? p.rang : null;
      if (k === 'osztaly') return OSZT_RANG[p.osztaly] || null;
      if (k === 'nev') return String(p.nev || '').toLowerCase();
      if (k === 'varos') return p.varos ? String(p.varos).toLowerCase() : null;
      if (k === 'adat') return p.harc ? 2 : p.ruha ? 1 : null;
      var o = RUHA_OSZLOP.filter(function (x) { return x[0] === k; })[0];
      if (o) { var c = cellaErtek(p, o); return c ? c.v : null; }
      return p[k] != null ? p[k] : null;
    };
    var s = felkLathato(F).sort(function (a, b) {
      if ((a.cella < 0) !== (b.cella < 0)) return a.cella < 0 ? 1 : -1;
      var x = ertek(a), y = ertek(b), c = 0;
      if (x == null && y != null) return 1; if (y == null && x != null) return -1;
      if (x != null) { c = x < y ? -1 : x > y ? 1 : 0; if (felkRend.le) c = -c; }
      if (c) return c;
      if (k === 'osztaly') return (b.szint || 0) - (a.szint || 0);
      return String(a.nev || '').toLowerCase() < String(b.nev || '').toLowerCase() ? -1 : 1;
    });
    var th = function (key, n, r, cim) { return '<th class="' + (r ? 'r' : '') + '" data-efp="frend:' + key + '"' + (cim ? ' title="' + cim + '"' : '') + '>' + n + (felkRend.k === key ? (felkRend.le ? ' ▾' : ' ▴') : '') + '</th>'; };
    var mindJel = s.length && s.every(function (p) { return kijelolt[p.id]; });
    var t2 = '<table><tr>' + (jog ? '<th data-efp="jelmind" title="mind kijelölése"><span class="efp-jel' + (mindJel ? ' be' : '') + '"></span></th>' : '') +
      th('erodnel', '\u25CF', 0, 'az erődnél van-e') + th('rang', 'Rang', 0, 'rang') + th('osztaly', 'Oszt.', 0, 'osztály') + th('nev', 'Név') + th('varos', 'Város', 0, 'város') + th('szint', 'Szint', 1) + th('elet', 'Életerő') +
      RUHA_OSZLOP.map(function (o) { return th(o[0], o[1], 1, o[2]); }).join('') + (szerver ? '<th title="ruha frissítése (1 profil)"></th>' : '') + '</tr>';
    var sz = F.G ? F.G.szazalek : true, en = sajatRang(F);
    s.forEach(function (p) {
      var dot = p.erodnel == null ? '' : '<span class="efp-dot ' + (p.erodnel ? 'z' : 'p') + '" title="' + (p.erodnel ? 'az erődnél' : 'még nincs az erődnél') + '"></span>';
      var nev = p.id != null ? '<a class="efp-nev efp-nevk" data-efp="profil:' + p.id + '" title="profil megnyitása' + (p.varos ? ' (' + esc(p.varos) + ')' : '') + (p.besorozta ? ', besorozta: ' + esc(p.besorozta) : '') + '">' + esc(p.nev) + '</a>' : esc(p.nev);
      if (p.cella < 0) nev += ' <span class="efp-ism" title="nincs lerakva">?</span>';
      var ep = p.eletMax ? '<span class="efp-ep k"><span class="efp-epb" style="width:' + Math.round(Math.max(0, p.elet) / p.eletMax * 100) + '%"></span><span class="efp-ept">' + p.elet + ' / ' + p.eletMax + '</span><span class="efp-sziv">♥</span></span>' : '';
      var ru = (p.ruha || p.harc) ? RUHA_OSZLOP.map(function (o) {
        var c = cellaErtek(p, o);
        if (!c) return '<td class="r"><span class="lab">·</span></td>';
        var apr = p.ruha && p.ruha.kozelito && /^(fb|sz)/.test(o[0]);
        return '<td class="r efp-sz' + (c.ruha ? ' efp-ruha' : '') + (apr ? ' efp-kozel' : '') + '"' + (apr ? ' title="közelítő: fejlesztett tárgy erődharc bónusza (nincs mérve)"' : '') + (o[0] === felkRend.k ? ' style="font-weight:bold"' : '') + '>' + (c.v ? (c.ruha ? '+' : '') + fmt(c.v) : '<span class="lab">0</span>') + '</td>';
      }).join('') : '<td colspan="' + RUHA_OSZLOP.length + '" class="c lab">' + (p.id != null && (ruhaIdozito || ruhaSzunet) && ruhaSor.indexOf(p.id) >= 0 ? '·' : '') + '</td>';
      var bub = [p.nev + (p.varos ? ' \u00b7 ' + p.varos : '')];
      bub.push(p.harc ? 'teljes érték: ' + p.harc.nap + ' harc vége' : p.ruha ? 'csak ruha- és szettbónusz (+)' : 'még nincs adat');
      var sb = (p.ruha && p.ruha.szSeb ? 'szektor sebzés (ruha): ' + p.ruha.szSeb : '') + (p.tb != null ? (p.ruha && p.ruha.szSeb ? ' \u00b7 ' : '') + 'szektor: támadó ' + bonuszFmt(p.tb, sz) + ', védő ' + bonuszFmt(p.vb, sz) + ', magas ' + p.mag + (p.ob ? ', osztály ' + bonuszFmt(p.ob, sz) : '') : '');
      if (sb) bub.push(sb);
      var cim = ' title="' + esc(bub.join('\n')) + '"';
      var rIk = p.rang != null && !isNaN(p.rang) ? rangIkon(p.rang) : '';
      var friss = p.id != null && ruhaFriss[p.id] && Date.now() - ruhaFriss[p.id] < 3000;
      var r1 = '';
      if (szerver) {
        var rt = p.id != null ? ruhaTar[String(p.id)] : null, rIdo = rt && rt.ido ? 'ruha adat: ' + oraPerc(rt.ido) : 'még nincs ruha adat';
        if (p.id == null) r1 = '<td></td>';
        else if (ruhaFolyik[p.id] || ((ruhaIdozito || ruhaSzunet) && ruhaSor.indexOf(p.id) >= 0)) r1 = '<td class="efp-r1 v" title="betöltésre vár">·</td>';
        else if (friss) r1 = '<td class="efp-r1 ok" title="Ruha frissítve ' + oraPerc(ruhaFriss[p.id]) + '">✓</td>';
        else r1 = '<td class="efp-r1" data-efp="ruha1:' + p.id + '" title="' + rIdo + ' · frissítés (1 profil)">↻</td>';
      }
      var valthato = jog && p.id != null && en != null && (p.rang == null || p.rang < en);
      t2 += '<tr data-cella="' + p.cella + '" class="' + (p.cella < 0 ? 'nl ' : '') + (kijelolt[p.id] ? 'kij' : '') + (friss ? ' efp-friss' : '') + '"' + cim + '>' +
        (jog ? '<td>' + (p.id != null ? '<span class="efp-jel' + (kijelolt[p.id] ? ' be' : '') + '" data-efp="jel:' + p.id + '"></span>' : '') + '</td>' : '') +
        '<td>' + dot + '</td><td>' + (valthato ? '<span class="efp-rgomb" data-efp="rangv:' + p.id + '" title="rang változtatása">' + (rIk || '?') + '</span>' : rIk) + '</td><td>' + osztIkon(p.osztaly) + '</td><td>' + nev +
        '</td><td class="efp-varos">' + varosHtml(p) + '</td><td class="r">' + (p.szint || '') + '</td><td>' + ep + '</td>' + ru + r1 + '</tr>';
    });
    h.push('<div class="efp-tbl gorget">' + t2 + '</table></div>');
    return h.join('');
  }
  var felkJelolt = null;
  var utolsoErintes = null;
  var sorJelolt = null;
  function sorJelol(cella, ujra) {
    if (!jelolesBe) cella = null;
    if (cella === sorJelolt && !ujra) return;
    sorJelolt = cella;
    if (!panelNyitva()) return;
    var reg = panel.gyoker.querySelectorAll('.efp-sorjel');
    for (var i = 0; i < reg.length; i++) reg[i].classList.remove('efp-sorjel');
    if (cella == null || cella < 0) return;
    var l = panel.gyoker.querySelectorAll('[data-cella="' + cella + '"]');
    for (var j = 0; j < l.length; j++) l[j].classList.add('efp-sorjel');
    if (!l.length || ujra) return;
    var el = l[0], sc = el.closest('.efp-tbl.gorget') || panel.gyoker.querySelector('.efp-tart');
    if (!sc) return;
    var r = el.getBoundingClientRect(), rs = sc.getBoundingClientRect(), fej = sc.querySelector('th') ? (sc.querySelector('th').offsetHeight || 0) : 0;
    if (r.top < rs.top + fej || r.bottom > rs.bottom) sc.scrollTop += (r.top - rs.top) - (rs.height - r.height) / 2;
  }
  function felkJelol(cella) {
    if (cella === felkJelolt) return; felkJelolt = cella;
    if (!reteg || !alReteg.felkJel) return;
    if (cella == null || cella < 0) { alReteg.felkJel.innerHTML = ''; return; }
    var w = Math.round(((felkTarolo && felkTarolo.offsetWidth) || 510) / CELLA), x = (cella % w) * CELLA - 15, y = Math.floor(cella / w) * CELLA - 15;
    alReteg.felkJel.innerHTML = '<div style="position:absolute;left:' + x + 'px;top:' + y + 'px;width:45px;height:45px;background:url(' + cdnUrl() + '/images/fort/battle/marker.png) no-repeat"></div>';
  }
  var EH_MAX = 9, EH_NAP = 14 * 86400e3;
  var ehArch = olvas('eh_archiv', null) || { b: {} }, ehSor = [], ehIdozito = null, ehSzunet = false, ehUtolso = 0, ehAll = { fut: false, hiba: '', kesz: 0, ossz: 0, megallt: '' };
  var varhSzuro = 'mind', ehKeres = 0;
  var ING_SVG = '<svg width="9" height="11" viewBox="0 0 9 11" style="vertical-align:-1px"><path d="M4.5 0.5 L8 4 H5.5 V7 H8 L4.5 10.5 L1 7 H3.5 V4 H1 Z" fill="#fff"/></svg>';
  function ehTisztit() { var h = Date.now() - EH_NAP, v = false; Object.keys(ehArch.b).forEach(function (k) { if (!ehArch.b[k] || ehArch.b[k].ido < h) { delete ehArch.b[k]; v = true; } }); return v; }
  function ehMent() { ehTisztit(); ir('eh_archiv', ehArch); }
  function ehAdat(id) {
    if (id == null) return [];
    var k = String(id), l = [];
    Object.keys(ehArch.b).forEach(function (bid) { var b = ehArch.b[bid], x = b && b.j && b.j[k]; if (x) l.push({ bid: bid, ido: b.ido, erod: b.erod, vedo: x[5], hp: x[0], wmin: x[1], wmax: x[2], ok: x[6], hit: x[7], miss: x[8], dodge: x[9], th: x[10] }); });
    return l.sort(function (a, b) { return b.ido - a.ido; });
  }
  function ehBattleTarol(bid, v) {
    var st = v && v.stats, r = st && st.result; if (!r) return false;
    var j = {}, ad = function (lst, vedo) { (lst || []).forEach(function (p) { j[String(p.westid)] = [p.maxhp, p.weaponmindmg, p.weaponmaxdmg, p.charlevel, 0, vedo ? 1 : 0, p.totalcauseddamage, p.hitcount, p.misscount, p.dodgecount, p.takenhits]; }); };
    ad(r.attackerlist, false); ad(r.defenderlist, true);
    ehArch.b[String(bid)] = { ido: (st.result_date || 0) * 1000, fort: st.fort_id, erod: r.fortname || '', j: j };
    return true;
  }
  function ehHianyzik(F) { return (F && F.lista ? F.lista : []).filter(function (p) { return p.id != null && !ehAdat(p.id).length; }).length; }
  function ehLeall(ok) { clearInterval(ehIdozito); ehIdozito = null; ehAll.fut = false; ehSzunet = false; ehSor = []; ehAll.megallt = ok || ''; ehMent(); valtozott = true; }
  function ehLepes() {
    var F = felkTarolo ? felkLista(felkTarolo) : null;
    if (F && !ehHianyzik(F)) { ehLeall('mind'); return; }
    var bid = ehSor.shift();
    if (bid == null) { ehLeall('vege'); return; }
    ehUtolso = Date.now();
    try {
      W.Ajax.remoteCallMode('fort_battleresultpage', 'get_battle', { battle_id: bid }, function (v) {
        try {
          if (v && !v.error && ehBattleTarol(bid, v)) { ehAll.kesz++; if (ehArch.b[String(bid)].ido < Date.now() - EH_NAP) { ehLeall('regi'); return; } }
          else ehAll.hiba = 'a ' + bid + '. harc nem jött meg';
        } catch (e) { hiba('EH harc', e); }
        ehMent(); valtozott = true;
        var F2 = felkTarolo ? felkLista(felkTarolo) : null;
        if (F2 && !ehHianyzik(F2)) ehLeall('mind');
      });
    } catch (e) { hiba('EH kérés', e); ehLeall('hiba'); }
    if (!ehSor.length) { clearInterval(ehIdozito); ehIdozito = null; setTimeout(function () { if (!ehIdozito && !ehSzunet) { ehAll.fut = false; valtozott = true; } }, 2500); }
    valtozott = true;
  }
  function ehIndit() { ehSzunet = false; ehAll.fut = true; ehIdozito = setInterval(ehLepes, 2000); setTimeout(function () { if (ehIdozito) ehLepes(); }, Math.max(0, 2000 - (Date.now() - ehUtolso))); valtozott = true; }
  function ehGomb() {
    if (ehIdozito) { clearInterval(ehIdozito); ehIdozito = null; ehSzunet = true; valtozott = true; return; }
    if (ehSzunet && ehSor.length) { ehIndit(); return; }
    if (ehAll.fut) return;
    ehAll = { fut: true, hiba: '', kesz: 0, ossz: 0, megallt: '' }; ehUtolso = Date.now(); valtozott = true;
    var keres = ++ehKeres;
    setTimeout(function () { if (keres === ehKeres && ehAll.fut && !ehIdozito && !ehSzunet) { ehKeres++; ehAll.hiba = 'a harclista nem jött meg, próbáld újra'; ehLeall('hiba'); } }, 15000);
    try {
      W.Ajax.remoteCallMode('fort_overview', '', { offset: 0 }, function (v) {
        if (keres !== ehKeres) return;
        ehKeres++;
        try {
          var html = v && (v.page || (typeof v === 'string' ? v : '')) || '', re = /CemeteryWindow\.open\(\s*(\d+)\s*,\s*(\d+)\s*\)/g, m, ids = [];
          while ((m = re.exec(html)) && ids.length < EH_MAX) ids.push(Number(m[2]));
          ehTisztit();
          ehSor = ids.filter(function (b) { return !ehArch.b[String(b)]; });
          ehAll.ossz = ids.length;
          if (!ids.length) { ehAll.hiba = 'a harclista üres vagy nem olvasható'; ehLeall('hiba'); return; }
          var F = felkTarolo ? felkLista(felkTarolo) : null;
          if (!ehSor.length || (F && !ehHianyzik(F))) { ehLeall(ehSor.length ? 'mind' : 'megvan'); return; }
          ehIndit();
        } catch (e) { hiba('EH lista', e); ehLeall('hiba'); }
      });
    } catch (e) { hiba('EH lista kérés', e); ehLeall('hiba'); }
  }
  function varhOsszeg(l) {
    var legujabb = Object.keys(ehArch.b).reduce(function (a, k) { return Math.max(a, ehArch.b[k].ido || 0); }, 0), ossz = 0, nEh = 0, nUj = 0;
    l.forEach(function (p) { var e = ehAdat(p.id)[0]; if (e) { nEh++; if (e.ido === legujabb) nUj++; ossz += e.hp || 0; } else ossz += p.eletMax || 0; });
    return { ossz: ossz, nEh: nEh, nUj: nUj, legujabb: legujabb, nHarc: Object.keys(ehArch.b).length };
  }
  var NAP_RAG = ['', 'jén', 'án', 'án', 'én', 'én', 'án', 'én', 'án', 'én', 'én', 'én', 'én', 'án', 'én', 'én', 'án', 'én', 'án', 'én', 'án', 'én', 'én', 'án', 'én', 'én', 'án', 'én', 'án', 'én', 'án', 'én'];
  function napRagos(ms) { var c = napCim(ms), d = new Date(ms).getDate(); return c.slice(0, -1) + '-' + NAP_RAG[d]; }
  function napCim(ms) { var d = new Date(ms), H = ['jan.', 'febr.', 'márc.', 'ápr.', 'máj.', 'jún.', 'júl.', 'aug.', 'szept.', 'okt.', 'nov.', 'dec.']; return H[d.getMonth()] + ' ' + d.getDate() + '.'; }
  function varhHtml(t) {
    var F = felkLista(t), h = [];
    if (!F || F.forras !== 'szerver') return '<div class="efp-b kiem"><h4>Adat</h4><div>Még nem jött adat a játéktól. Kattints a Felkészülés fülön a Lista gombra.</div></div>';
    var l = F.lista, legujabb = Object.keys(ehArch.b).reduce(function (a, k) { return Math.max(a, ehArch.b[k].ido || 0); }, 0);
    var nHarc = Object.keys(ehArch.b).length;
    l.forEach(function (p) {
      var e = ehAdat(p.id); p.eh = e; p.eh0 = e[0] || null;
      p.varh = p.eh0 ? p.eh0.hp : p.eletMax || 0;
      var hs = e.map(function (x) { return x.hp; }).filter(function (x) { return x > 0; });
      p.valt = hs.length > 1 && Math.max.apply(null, hs) > 2 * Math.min.apply(null, hs);
      p.legjobb = hs.length ? Math.max.apply(null, hs) : 0;
    });
    var ehL = l.filter(function (p) { return p.eh0; }), moL = l.filter(function (p) { return !p.eh0; }), vL = l.filter(function (p) { return p.valt; });
    var ossz = l.reduce(function (a, p) { return a + (p.varh || 0); }, 0), most = l.reduce(function (a, p) { return a + (p.eletMax || 0); }, 0);
    var ehOssz = ehL.reduce(function (a, p) { return a + p.varh; }, 0), nUj = ehL.filter(function (p) { return p.eh0.ido === legujabb; }).length;
    var plusz = vL.reduce(function (a, p) { return a + Math.max(0, p.legjobb - p.varh); }, 0);
    var gc = ehIdozito ? 'Korábbi EH: ' + ehAll.kesz + ' / ' + (ehAll.kesz + ehSor.length) + ' harc … ⏸' : ehSzunet && ehSor.length ? 'Korábbi EH: folytatás · még ' + ehSor.length :
      ehAll.fut ? 'Korábbi EH: lista …' : nHarc ? 'Korábbi EH: ' + nHarc + ' harc · ' + napCim(legujabb) + ' ⟳' : 'Korábbi EH letöltése ⟳';
    var gb = 'A korábbi erődharcok életereje a szerver archívumából (Legutóbbi harcok). 1 kérés a listára, utána harconként 1 kérés 2 mp-enként, csak ami még nincs meg; legfeljebb ' + EH_MAX + ' harc, 14 nap. Megáll, ha minden bajtársról van adat. Futás közben érintésre szünetel.';
    var nHi = ehHianyzik(F);
    h.push('<div class="efp-fej"><span><b>Bajtársak ' + l.length + '</b> · várható erődharc életerő, a legutóbbi harcok alapján</span>' +
      '<span class="efp-frs"><span class="chip' + (ehIdozito ? ' a' : '') + '" data-efp="eh" title="' + esc(gb) + '">' + gc + '</span>' +
      '<span class="chip" data-efp="frissites" title="Bajtársak lista frissítése: 1 lekérdezés">Lista: <span id="efp-kor"></span> ⟳</span></span></div>');
    if (ehIdozito && nHi) h.push('<div class="efp-src" style="text-align:right">Még ' + nHi + ' bajtársról nincs adat; ha mind megvan, a letöltés magától megáll.</div>');
    else if (!ehAll.fut && ehAll.megallt === 'mind') h.push('<div class="efp-src" style="text-align:right">Mind a ' + l.length + ' bajtársról van adat; a többi harcot nem kellett letölteni.</div>');
    if (ehAll.hiba) h.push('<div class="efp-src" style="text-align:right;color:#7a0f0a">' + esc(ehAll.hiba) + '</div>');
    if (!nHarc && !ehAll.fut) {
      h.push('<div class="efp-ures"><b>A korábbi erődharcok adatai még nincsenek letöltve</b><br><span class="efp-src">A szerver archívumából (Legutóbbi harcok): 1 kérés a listára, utána harconként 1 kérés, 2 mp-enként, legfeljebb ' + EH_MAX + ' harc (kb. 20 mp). Utána csak az új harcokat kéri le.</span><br><span class="chip a" data-efp="eh" style="margin-top:6px;display:inline-block">Korábbi EH letöltése ⟳</span></div>' +
        '<div class="efp-src" style="margin-top:3px">Addig a táblázat a mostani életerőt mutatja (piros).</div>');
    }
    h.push('<div class="efp-vb">' +
      '<div title="A legutóbbi harc értéke, ha van; különben a mostani életerő"><div class="k">Várható életerő (összesen)</div><div class="v">' + fmt(ossz) + '</div><div class="k">most: ' + fmt(most) + '</div></div>' +
      '<div><div class="k">EH adatból</div><div class="v" style="color:#5e2f7a">' + ehL.length + ' fő</div><div class="k">' + (legujabb ? napCim(legujabb) + ': ' + nUj + ' · régebbi: ' + (ehL.length - nUj) : '-') + '</div></div>' +
      '<div title="Erősen változó: a legkisebb és legnagyobb érték között több mint kétszeres különbség az elmúlt harcokban. A legutóbbi érték számít."><div class="k">Erősen változó <span class="efp-ing">' + ING_SVG + '</span></div><div class="v" style="color:#b35a00">' + vL.length + ' fő</div><div class="k">' + (vL.length ? 'a jobbik értékükkel: +' + fmt(plusz) : '-') + '</div></div>' +
      '<div><div class="k">Mostani értékkel</div><div class="v" style="color:#a3150d">' + moL.length + ' fő</div><div class="k">nincs EH adat ' + (nHarc ? nHarc + ' harcból' : '') + '</div></div></div>');
    var pe = ossz ? Math.round(ehOssz / ossz * 100) : 0;
    h.push('<div class="efp-vsav" title="lila: EH adatból · piros: mostani életerő (napközbeni ruhával, harcban több lehet)"><span style="width:' + pe + '%;background:#6b3c86"></span><span style="width:' + (100 - pe) + '%;background:#b3201a"></span></div>');
    var nNo = l.filter(function (p) { return p.erodnel === false; }).length;
    var SZ = [['mind', 'Mind'], ['eh', 'EH adat · ' + ehL.length], ['most', 'Csak most · ' + moL.length], ['nincsott', 'Nincs ott · ' + nNo]];
    h.push('<div class="efp-tobor"><span>' + SZ.map(function (z) { return '<span class="chip' + (varhSzuro === z[0] ? ' a' : '') + '" data-efp="vszuro:' + z[0] + '">' + z[1] + '</span>'; }).join('') + '</span></div>');
    var s = l.filter(function (p) { return varhSzuro === 'eh' ? p.eh0 : varhSzuro === 'most' ? !p.eh0 : varhSzuro === 'nincsott' ? p.erodnel === false : true; })
      .sort(function (a, b) { return (b.varh || 0) - (a.varh || 0) || (String(a.nev).toLowerCase() < String(b.nev).toLowerCase() ? -1 : 1); });
    var t2 = '<table><tr><th>Oszt.</th><th>Név</th><th class="r">Szint</th><th>Várható életerő</th><th>Forrás</th><th class="r">Most</th><th class="r">Fegyver</th><th class="r" title="az utolsó EH-ban okozott sebzés">Okozott</th><th class="r" title="az utolsó EH-ban: talált / összes lövés">Talált</th><th class="r" title="az utolsó EH-ban: kitért / rá leadott találatok és kitérések">Kitért</th></tr>';
    s.forEach(function (p) {
      var e0 = p.eh0, nev = p.id != null ? '<a class="efp-nev efp-nevk" data-efp="profil:' + p.id + '">' + esc(p.nev) + '</a>' : esc(p.nev);
      var hp = p.varh || 0, sav = '<span class="efp-ep k ' + (e0 ? 'eh' : 'mo') + '"><span class="efp-epb" style="width:100%"></span><span class="efp-ept">' + fmt(hp) + '</span></span>';
      var bub = [];
      if (e0) {
        if (p.valt) {
          var elt = p.eh.reduce(function (a, x) { return x.hp > 0 && (!a || Math.abs(x.hp - e0.hp) > Math.abs(a.hp - e0.hp)) ? x : a; }, null);
          if (elt) bub.push('↕ ' + napRagos(elt.ido) + ' még ' + fmt(elt.hp) + ' ÉP volt');
        }
        if (legujabb && e0.ido < legujabb) bub.push('az utolsó harcot kihagyta');
      } else {
        bub.push('Nincs EH adat ' + (nHarc ? 'az utolsó ' + nHarc + ' harcból' : '(még nincs letöltve)') + '. Ez a mostani életerő a jelenlegi ruhával, erődharc ruhában több lehet.');
        var ru = p.id != null ? ruhaErtek(p.id) : null;
        if (ru && ru.health) bub.push('Ruhabónusz: ÉP +' + ru.health);
      }
      var src = e0 ? napCim(e0.ido) + ' ' + esc(e0.erod) + (legujabb && e0.ido < legujabb ? ' ⓘ' : '') : 'nincs EH adat' + (p.erodnel === false ? ' · nincs ott' : '');
      t2 += '<tr data-cella="' + p.cella + '" class="' + (p.erodnel === false ? 'nl' : '') + '"' + (bub.length ? ' title="' + esc(bub.join('\n')) + '"' : '') + '><td>' + osztIkon(p.osztaly) + '</td><td>' + nev + '</td><td class="r">' + (p.szint || '') + '</td>' +
        '<td>' + sav + (p.valt ? '<span class="efp-ing">' + ING_SVG + '</span>' : '') + (e0 ? '' : ' <span class="efp-src">most</span>') + '</td><td class="efp-src">' + src + '</td>' +
        '<td class="r">' + (p.eletMax ? fmt(p.eletMax) : '') + '</td><td class="r">' + (e0 && e0.wmax ? e0.wmin + '-' + e0.wmax : '-') + '</td>' +
        '<td class="r">' + (e0 ? fmt(e0.ok) : '-') + '</td><td class="r">' + (e0 ? e0.hit + ' / ' + (e0.hit + e0.miss) : '-') + '</td><td class="r">' + (e0 ? e0.dodge + ' / ' + (e0.dodge + e0.th) : '-') + '</td></tr>';
    });
    h.push('<div class="efp-tbl gorget">' + t2 + '</table></div>');
    return h.join('');
  }
  var felkMod = false, felkTarolo = null, harcAllapot = false;
  function panelFrissit(kenyszer) {
    if (!panelNyitva()) return;
    var A = aktivAllapot(), harc = !!(harcAllapot && A && A.jatekosok.length);
    if (harc && (panelFul === 'felk' || panelFul === 'varh')) { panelFul = 'most'; panelMeret(); }
    if (!harc && felkMod && panelFul === 'most') { panelFul = 'felk'; panelMeret(); }
    var elso = harc ? ['most', 'Most'] : ['felk', 'Felkészülés'];
    var html = '<div class="efp-fulek"><span class="efp-ful' + (panelFul === elso[0] ? ' a' : '') + '" data-efp="ful:' + elso[0] + '">' + elso[1] + '</span>' +
      (harc ? '' : '<span class="efp-ful' + (panelFul === 'varh' ? ' a' : '') + '" data-efp="ful:varh" title="A bajtársak várható erődharc életereje a legutóbbi harcok alapján">Várható erő</span>') +
      '<span class="efp-ful' + (panelFul === 'stat' ? ' a' : '') + '" data-efp="ful:stat"' + (harc ? '' : ' style="opacity:.55"') + '>Statisztika</span></div>' +
      '<div class="efp-tart' + ((harc && panelFul === 'stat') || (!harc && (panelFul === 'felk' || panelFul === 'varh') && felkTarolo) ? ' tablas' : '') + '">' +
      (harc ? (panelFul === 'stat' ? statHtml(A) : mostHtml(A)) :
        panelFul === 'felk' && felkTarolo ? felkHtml(felkTarolo) :
        panelFul === 'varh' && felkTarolo ? varhHtml(felkTarolo) :
        '<div class="lab">' + (panelFul === 'stat' ? 'A statisztika a harc indulásakor jelenik meg.' : 'Nincs nyitott erődharc ablak.') + '</div>') + '</div>' +
      '<div class="efp-alja"><div class="efp-grip" title="Húzd a magasság állításához"><span></span></div>' + (EPITES ? '<div class="efp-epites" data-efp="frissproba" title="TESZT: a frissítés ablak próbája, szerverhívás nélkül">TESZT ' + esc(VERZIO + ' \u00b7 ' + EPITES) + '</div>' : '') + '<div class="efp-alairas">Crafted with <span>\u2665</span> by smcZ</div></div>';
    if (kenyszer || html !== utolsoPanel) {
      var sc = panel.gyoker.querySelector('.efp-tart'), top = sc ? sc.scrollTop : 0, tb = panel.gyoker.querySelector('.efp-tbl.gorget'), ttop = tb ? tb.scrollTop : 0;
      panel.gyoker.innerHTML = html; utolsoPanel = html;
      var sc2 = panel.gyoker.querySelector('.efp-tart'); if (sc2) sc2.scrollTop = top;
      var tb2 = panel.gyoker.querySelector('.efp-tbl.gorget'); if (tb2) tb2.scrollTop = ttop;
      if (sorJelolt != null) sorJelol(sorJelolt, true);
    }
    var kk = panel.gyoker.querySelector('#efp-kor'), fr = felkTarolo ? eloAdat[felkFortId(felkTarolo)] : null;
    if (kk) { var mp = fr && fr.ido ? Math.max(0, Math.round((Date.now() - fr.ido) / 1000)) : null; kk.textContent = mp == null ? 'natív' : mp < 120 ? mp + ' mp-e' : Math.round(mp / 60) + ' perce'; }
    panelCim(harc ? (panelFul === 'stat' ? 'Statisztika' : 'Most') + ' \u00b7 ' + (A.kor ? A.kor + '. kör' : 'erődharc') : panelFul === 'varh' ? 'Várható erő' : 'Felkészülés');
  }
  var WEBOLDAL = 'https://kiszamolja.github.io/the-west-kalkulator-inventorymanaged/';
  var FRISS_URL = WEBOLDAL + 'the-west-fegyverbe.user.js';
  var FRISS_IDOKOZ = 6 * 60 * 60 * 1000, FRISS_ABLAK_ID = 'smcz-fegyverbe-frissites', FRISS_ABLAK_CIM = NEV + ' - frissítés';
  function ujabbVerzio(a, b) {
    var x = String(a).split('.'), y = String(b).split('.');
    for (var i = 0; i < Math.max(x.length, y.length); i++) {
      var xi = parseInt(x[i] || '0', 10), yi = parseInt(y[i] || '0', 10);
      if (isNaN(xi) || isNaN(yi)) return false;
      if (xi > yi) return true;
      if (xi < yi) return false;
    }
    return false;
  }
  function probaVerzio(v) { var t = String(v).split('.'), u = parseInt(t[t.length - 1], 10); t[t.length - 1] = String(isNaN(u) ? 1 : u + 1); return t.join('.'); }
  function valtozasokSzovegbol(txt) {
    try {
      var m = String(txt || '').match(/\/\* VALTOZASOK KEZDETE \*\/[\s\S]*?=\s*(\[[\s\S]*?\]);\s*\/\* VALTOZASOK VEGE \*\//);
      if (!m) return [];
      var t = JSON.parse(m[1]);
      return Array.isArray(t) ? t.filter(function (x) { return typeof x === 'string' && x.trim(); }).slice(0, 8) : [];
    } catch (e) { return []; }
  }
  function frissitestMegnyit() {
    try { if (typeof GM_openInTab === 'function') { GM_openInTab(FRISS_URL, { active: true }); return; } } catch (e) { }
    try { if (W && typeof W.open === 'function') { W.open(FRISS_URL, '_blank'); return; } } catch (e) { }
    try { window.open(FRISS_URL, '_blank'); } catch (e) { }
  }
  function frissLetolt(url, kesz) {
    try {
      GM_xmlhttpRequest({ method: 'GET', url: url, responseType: 'text', timeout: 10000,
        onload: function (r) { kesz(r && r.status === 200 ? String(r.responseText || r.response || '') : null); },
        onerror: function () { kesz(null); }, ontimeout: function () { kesz(null); } });
    } catch (e) { kesz(null); }
  }
  function maNap() { return new Date().toISOString().slice(0, 10); }
  function frissitestKeres() {
    if (olvas('friss_nap', '') === maNap()) return;
    frissLetolt(FRISS_URL + '?v=' + Date.now(), function (txt) {
      try {
        if (!txt) return;
        var m = txt.match(/@version\s+(\S+)/);
        if (!m || !ujabbVerzio(m[1], VERZIO)) return;
        ir('friss_nap', maNap());
        frissitesAblak(m[1], valtozasokSzovegbol(txt), false);
      } catch (e) { hiba('frissítés', e); }
    });
  }
  function frissitesAblak(ver, lista, proba) {
    var tart = document.createElement('div');
    tart.style.cssText = 'padding:14px 16px;font:14px/1.5 Arial,sans-serif;color:#2b2119;box-sizing:border-box;width:100%';
    var tetelek = (lista || []).map(function (x) { return "<li style='margin:0 0 4px'>" + esc(x) + '</li>'; }).join('');
    tart.innerHTML = '<div>Új verzió érhető el a ' + esc(NEV) + ' scriptből.</div>' +
      "<div style='margin:10px 0'><b>Jelenlegi:</b> " + esc(VERZIO) + ' &nbsp; <b>Elérhető:</b> ' + esc(ver) + '</div>' +
      (tetelek ? "<ul style='margin:0 0 10px;padding-left:20px;font-size:13px;line-height:1.45'>" + tetelek + '</ul>' : '') +
      "<div style='margin-bottom:12px'>A gombra kattintva megnyílik a Tampermonkey telepítő ablaka, ott elég a Frissítés gombot megnyomni.</div>" +
      (proba ? "<div style='margin-bottom:12px;font-size:12px;color:#923b29'>Próbaablak: a gomb most nem nyit telepítőt.</div>" : '');
    var gomb = document.createElement('button');
    gomb.textContent = 'Frissítés megnyitása';
    gomb.style.cssText = 'padding:7px 14px;cursor:pointer;font:600 13px Arial,sans-serif;background:#3a2713;color:#f0c874;border:1px solid #8a6330;border-radius:5px';
    var kesobb = document.createElement('button');
    kesobb.textContent = 'Később';
    kesobb.style.cssText = 'padding:7px 14px;cursor:pointer;margin-left:8px;font:13px Arial,sans-serif;background:rgba(247,238,219,.7);color:#5a4326;border:1px solid #8a6330;border-radius:5px';
    var alairas = document.createElement('div');
    alairas.innerHTML = "Crafted with <span style='color:#d7473f;font-size:13px;padding:0 2px'>♥</span> by smcZ";
    alairas.style.cssText = 'margin-top:14px;text-align:right;font:11px Arial,sans-serif;color:rgba(43,33,25,.45)';
    tart.appendChild(gomb); tart.appendChild(kesobb); tart.appendChild(alairas);
    var bezar = function () { };
    gomb.onclick = function () { if (!proba) frissitestMegnyit(); bezar(); };
    kesobb.onclick = function () { bezar(); };
    try {
      var wm = W.wman;
      try { var regi = wm && wm.getById ? wm.getById(FRISS_ABLAK_ID) : null; if (regi) { try { if (wm.close) wm.close(FRISS_ABLAK_ID); } catch (e2) { } try { if (regi.destroy) regi.destroy(); } catch (e2) { } } } catch (e2) { }
      var abl = null;
      try { if (wm && wm.open) abl = wm.open(FRISS_ABLAK_ID, FRISS_ABLAK_CIM); } catch (e2) { abl = null; }
      if (abl) {
        ['setTitle', 'setMiniTitle'].forEach(function (n) { try { if (typeof abl[n] === 'function') abl[n](FRISS_ABLAK_CIM); } catch (e2) { } });
        try { if (typeof abl.setResizeable === 'function') abl.setResizeable(false); } catch (e2) { }
        var betette = false;
        try { abl.appendToContentPane(tart); betette = true; } catch (e2) { betette = false; }
        if (betette) {
          bezar = function () { try { abl.close(); } catch (e2) { try { if (wm && wm.close) wm.close(FRISS_ABLAK_ID); } catch (e3) { } } };
          return;
        }
        try { abl.close(); } catch (e2) { }
      }
    } catch (e) { }
    var box = document.createElement('div');
    box.style.cssText = 'position:fixed;left:50%;top:22%;transform:translateX(-50%);z-index:99999;width:min(560px,92vw);background:#e8d6b0;border:1px solid #5b3d1f;border-radius:3px;box-shadow:0 0 0 3px #7a5530,0 8px 22px rgba(0,0,0,.55)';
    var fej = document.createElement('div');
    fej.textContent = FRISS_ABLAK_CIM;
    fej.style.cssText = 'padding:7px 12px;background:linear-gradient(180deg,#6d4a28,#3f2814);color:#f4e0b0;font:700 13px Georgia,serif';
    box.appendChild(fej); box.appendChild(tart);
    bezar = function () { box.remove(); };
    document.body.appendChild(box);
  }
  var rejtettFrissites = 0;
  function frissit() {
    try {
      keresFortok();
      var t = terkepTarolo();
      if (!t || !harcAllapot) nativBuborek(false);
      if (!t) {
        if (panelNyitva() && Date.now() - rejtettFrissites > 1000) { rejtettFrissites = Date.now(); panelFrissit(false); }
        return;
      }
      var A = aktivAllapot(), tf = felkFortId(t), ab0 = felkAblak(t);
      var vanLista = !!(ab0 && ab0.querySelector('.fort_battle_playerlist_list'));
      if (A && A.vege && tf != null && tf === aktivFort && vanLista) {
        try { magok[aktivFort].mag.torol(); } catch (e) { hiba('mag törlés', e); }
        delete savKor[aktivFort]; mentesTorol(aktivFort);
        [korElso, korUtolso, korHiany, korSzamolt, visszatoltve, visszaSor, hianySor].forEach(function (o) { delete o[aktivFort]; }); A = aktivAllapot(); valtozott = true;
      }
      var harcban = !!(A && A.terkep && A.jatekosok.length) && (tf == null || tf === aktivFort);
      harcAllapot = harcban;
      if (!harcban) {
        if (reteg && reteg.parentNode) { ['zona', 'eger'].forEach(function (n) { beallit(n, ''); }); }
        nativBuborek(false); cimSav(t, null);
        var ab = felkAblak(t);
        felkMod = !!(ab && ab.querySelector('.fort_battle_playerlist_list'));
        felkTarolo = felkMod ? t : null;
        if (felkMod) rangOlvas(felkFortId(t));
        if (felkMod) {
          biztositGombok(t); biztositReteg(t); figyelEger(t);
          beallit('felk', felkJelek(t, felkLista(t)));
        } else if (reteg && alReteg.felk) beallit('felk', '');
        panelFrissit(false);
        return;
      }
      felkMod = false; felkTarolo = null;
      if (alReteg.felk) beallit('felk', '');
      cimSav(t, A);
      arnyekTolt(aktivFort);
      biztositGombok(t);
      biztositReteg(t);
      figyelEger(t);
      var m = arnyek[aktivFort];
      if (valtozott || !utolso.hasOwnProperty('zona')) {
        beallit('zona', beall.zona && m && m.kesz ? zonaSvg(A, m) : '');
        egerRajz();
        panelFrissit(false);
        valtozott = false;
      }
    } catch (e) { hiba('frissit', e); }
  }
  setInterval(frissit, 500);
  setTimeout(function () {
    try { if (!FRISS_PROBA) { frissitestKeres(); setInterval(frissitestKeres, FRISS_IDOKOZ); } } catch (e) { hiba('frissítés', e); }
  }, 8000);
  ['mouseup', 'pointerup'].forEach(function (ev) { document.addEventListener(ev, function () { try { if (panelNyitva() && !fogoAktiv) panelHelyMent(); } catch (e) { } }, true); });
  try { console.info('[' + NEV + '] ' + VERZIO + ' betöltve'); } catch (e) { }
})();
