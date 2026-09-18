# Változások

A The West mesterség-kalkulátor játékbeli paneljének változásnaplója.

A panel a böngészőben már betöltött adatot olvassa.

Az 1.2.0-tól **tud gyártani és receptet tanulni is**, gombnyomásra. Mindkét
gomb alapból ki van kapcsolva, tehát alapértelmezésben a panel csak számol.
Emellett minden panelnyitáskor egyszer megnyitja és bezárja a játék Mesterség
ablakát - ez a játék oldaláról kivált egy kérést. A teljes lista arról, hogy
hol és mikor megy kérés, az 1.2.0 bejegyzésében áll. Az 1.2.1 ezen nem
változtatott: új kérésküldő hely nem került bele.

A korábbi bejegyzések szövegét nem írtam át. Ott az akkori állapot szerepel,
és az akkor igaz volt.

---

## 1.2.5 - 2026-09-18

Kis kör a recept-tekercsek körül: a kijelölt sor ikonja, a szöveges másolás,
és a két közös termék tekercse.

### Receptek

- **A kijelölt receptsoron is látszik, zöld vagy piros a tekercs-ikon.**
  Eddig a kijelölt sor sötétítése az ikonra is ráfutott, és sötétbarnára
  váltott, így nem lehetett eldönteni, nálad van-e a tekercs. Most a
  kijelölt soron is a saját színét viseli.
- **Az ikonra kattintás követi a Kód/Szöveg kapcsolót**, ugyanúgy, mint a
  lista többi másolása. Kód módban továbbra is az `[item=...]` kód kerül a
  vágólapra, Szöveg módban a tekercs neve, pontosan úgy, ahogy a játékban
  áll, darabszám nélkül. Például: `Recept: Halászlé elkészítése`.
- **A két közös terméknél** (15. születésnapi torta, Pohárdesszert) mind a
  négy mesterségnek saját tekercse van, azonos névvel. Hogy ezek közül melyik
  számít, azt mostantól a mesterségszűrő dönti el: szűrt listán az adott
  mesterség tekercse, a "Mind" állásban a saját mesterséged tekercse. Ez a
  tekercs megy a vágólapra, ennek a színét mutatja az ikon, és a buborék is
  erről szól, a darabszámmal és az igényelt mesterséggel együtt. Az ikon
  tehát csak akkor zöld, ha az a tekercs van nálad, amit kattintásra kapsz.
  Az eddigi viselkedés szerint bármelyik mesterség tekercse zöldre festette.

A kör új kérést nem küld a játéknak: a tekercs nevét és mesterségét a
böngészőben már betöltött adatból olvassa.

---

## 1.2.4 - 2026-09-12

Nagy kör: recept-tekercsek, termékbeszerzők helyben szerkesztése, és
elmenés a terv tételeihez.

### Receptek

- **Tekercs-ikon a receptlistában.** Minden nem tanulható recept sora mellett
  kis tekercs áll: zöld, ha van a tekercsből a táskádban, piros, ha nincs. A
  jelzés független attól, hogy megtanultad-e már a receptet, mert a tekercs a
  tanulás után is nálad maradhat, sőt többet is tarthatsz belőle, és oda tudod
  adni valakinek.
- **Az ikonra kattintva** a recept tekercsének `[item=...]` kódja a vágólapra
  kerül, a szokott "Másolva" villanással. Zöld és piros ikonnal egyaránt
  működik, tehát olyan receptet is meg tudsz mutatni a chatben, ami nincs
  nálad.
- **Recept-buborék egérráhúzásra.** A receptsoron megállva kiírja a termék
  nevét, a recept nevét, hogy megtanultad-e, milyen mesterség és szint kell
  hozzá, a te szintedet és a hiányzó szinteket, hány tekercs van a táskádban,
  valamint a vételi és eladási árat, az árverezhetőséget és a
  fejleszthetőséget.
- A jelmagyarázatból kikerült két sor: amit eddig ott magyaráztunk, azt most a
  buborék mondja el a saját receptjénél.

### Termékbeszerzők

- **A beszerző neve helyben átírható.** Rákattintasz a névre, és mezővé
  válik. Amit beírsz, az az egész rendelésre vonatkozik: a beszerző minden
  tétele átkerül az új névre. Ha olyan nevet írsz be, ami már létezik, a két
  csoport összeolvad.
- **A darabszám is helyben átírható**, külön gomb nélkül. Enter és
  elkattintás ment, Esc visszaáll, üres vagy értelmetlen érték esetén a régi
  szám marad. A törlés továbbra is külön művelet, az ✕.
- A mentés kapcsolója kikerült a beállításokból, a mentés mindig elérhető.

### Munkalap

- **A robbantott ábra gyökerére is át lehet menni**, ugyanúgy, mint eddig a
  közbenső termékekre. A munkalap tervsorában a névre kattintva szintén.
- **Vissza a tervhez.** Ha többtételes tervből lépsz el, a Munkalap felirat
  mellett megjelenik egy gomb, ami visszahozza a tervet a darabszámokkal, a
  kizárás pipáival és a mesterségszűrő állásával együtt. Eltűnik, ha másik
  receptre kattintasz a listában, új tervet kezdesz, vagy mentett tervet
  nyitsz meg.

### Javítás

- A recept-buborék a pergamenhez igazodik, nem a sötét munka-buborék hátterét
  örökli, így a piros szöveg is olvasható rajta.
- A tekercs-ikon telítettebb zöldet és pirosat kapott, mert a korábbi árnyalat
  12 képponton feketésnek látszott.
- A túl magas szintet igénylő, ezért halványra tett receptsorokon az ikon nem
  barnul el többé. Pont ezeken a sorokon a legtöbbet érő az információ.
- A "Másolva" villanás felirata mindig világos marad. A halvány és a
  kiválasztott soron eddig sötét betűt kapott a sötét buborékon, alig volt
  olvasható.

---

## 1.2.3 - 2026-09-06

Az 1.2.2 nem jelent meg a közösségnek; a benne készült elérhetőség-jelzést az
1.2.3 pontosítja, és mellé két hibajavítás kerül.

### A munkaóra-jelzés minden kliensen betölt

A Mit gyűjts oszlopban a `még X óra munka` jelzés egyes gépeken üresen maradt,
és csak akkor jelent meg, ha felszerelést cseréltél, vagy ki- és bekapcsoltad
a jelzést. Mérésből derült ki, hogy a jelzéshez a játék munkaadata kell, amit
nem minden kliens tölt fel magától: ahol nem fut másik szkript, amelyik
induláskor lekéri, ott az adat üres maradt, F5 után is. Böngészőfüggetlen
volt, több gépen is előjött.

Mostantól, ha a jelzés be van kapcsolva, a panel látható, és a munkaadat
hiányzik, a panel maga kér egyet. Csukott panelnél és kikapcsolt jelzésnél
semmi nem megy el, percenként legfeljebb egyszer kérünk, és amint az adat
megjön, a kérés magától elnémul. Ez az 1.2.0 óta az első új, feltételes
kérésküldő hely; a többi kérés helye változatlan.

### A nem elérhető munkák jelzése

A munkabuborék eddig kiírta a hozamot minden munkánál, akkor is, ha azt nem
tudod elvégezni. Mostantól a zárt munkánál a **százalék helyén** a
`nem elérhető` felirat áll. Nem mellette: ha nem tudod elvégezni a munkát, a
hozama nem információ. Ugyanez a Mit gyűjts oszlopban is, a régi
`kicsi az esély` helyett - de a jelzés csak akkor jelenik meg, ha **egyik**
munka sem elérhető. Ha a legjobb zárt, de egy alatta lévő nyitott, dolgozni
tudsz érte, csak lassabban.

Az elérhetőséget a **játék saját válaszából** olvassuk ki, nem a munkapontból.
Ez azért lényeges, mert a munkapont a hozamot és a találási esélyt skálázza (a
bronz, ezüst és arany csákányokon át), nem azt dönti el, elvégezheted-e a
munkát: egy munka a teljes munkapontja alatt is megy, csak gyengébb hozammal.
Egy munkapont-alapú jelzés emiatt néhány munkát tévesen lezárt volna, pedig a
játékban indíthatók. Most a jelzés a játékkal egyezik.

Ha a panel nem tudja megállapítani az elérhetőséget, nem ír ki semmit. A
hamis "nem elérhető" rosszabb volna, mint a hallgatás.

---

## 1.2.1 - 2026-09-05

Javítások és kényelmi kiegészítések az 1.2.0-hoz. Új kapcsoló nincs, és a
panel továbbra sem küld semmit magától.

### A raktári készlet ott van minden soron

A robbantott ábrában eddig az állt, hogy a terv **mennyit használ el** a
raktárból - csakhogy azt a sor bal oldalán álló szám úgyis megmondja. Azt
viszont sehol nem lehetett megnézni, hogy **mennyi van** belőle a
táskádban.

Mostantól minden soron a készlet áll: `117 raktáron · megvan`. A szám a nyers
raktár, nem fogy a lánc mentén, és a nullát is kiírjuk. Megbízásnál a kettő
külön látszik: `0 raktáron, 3 megrendelve*`.

### Ugrás a köztes receptre

A gyártott lépések neve a fában aláhúzott lett, és kattintásra a munkalap
átvált arra a receptre, egy darabbal. Más mesterségnél a bal oldali szűrő is
átáll. Zárolt és meg nem tanult receptre ugyanúgy megy.

Visszaút szándékosan nincs: egy állandó vissza-gomb minden ugrás után ott
ülne, akkor is, amikor eszedbe sem jut visszamenni. Aki visszatérne, a bal
oldali listából választ, vagy mentett tervet nyit.

### Kattintás cserél, a + gomb hozzáad

Eddig két vagy több cél esetén a receptre kattintás **nem váltott**: a bal
oldali kiemelés elmozdult, a munkalap mégsem követte, és a tervet egyesével
kellett kiiksz-elni, mire tovább lehetett lépni.

Mostantól a kattintás mindig vált. Aki több elemű tervet akar megtartani,
mentse el. Egy kivétel van: ha ugyanarra a receptre kattintasz, ami már nyitva
van, a beírt darabszám megmarad.

### A Max jelző több helyen kiáll

Eddig, ha a recept **nem a te mesterséged**, vagy nem tanultad meg, vagy nincs
meg a szinted, a jelző meg sem jelent. Pedig a kérdés mind a háromnál ugyanaz:
mennyi alapanyagod van hozzá.

Mostantól ott a rézszínű szám. Ez akkor hasznos, ha valakit meg akarsz kérni,
hogy gyártson neked: előbb megnézed, mennyire elég a készleted, és utána
döntesz. Gyártás gomb ezekben az esetekben továbbra sincs.

### A réz szám számítása javult

A jelző eddig a más mesterségébe tartozó köztes lépést készen állónak vette,
és **nem nézte meg annak alapanyagát**. Egy mért példán ezért 134-et írt ki,
holott a köztes lépéshez kellő anyagból csak háromra volt elég.

Mostantól a köztes lépés alapanyagát is beszámítja, és bekapcsolt
Termékbeszerzőknél a megrendeléseidet is - ugyanúgy, ahogy a robbantott ábra
és a készültségi gyűrű. A zöld szám és a Gyártás gomb továbbra is kizárólag a
valódi raktárból dolgozik.

### Tanulás és szintlépés után a panel követi magát

Megtanult recept után a jelzés eltűnik, a recept átkerül a megtanultak közé, és
a Gyártás gomb is megjelenik rajta - **frissítés nélkül**. Ugyanígy, ha egy
gyártás megemeli a mesterségszintedet és ezzel új recept válik
megtanulhatóvá, a zöld jelzés magától kijön.

### Apróbb javítások

- **A Gyártás gomb elsőre is működik.** Ha a darabszám mezőben állt a kurzor,
  az első kattintás elveszett, és csak a második indított gyártást.
- **Az egyelemű mentett terv a mentett darabszámmal nyílik meg.** Eddig
  "30 Gyanta" néven mentődött, de megnyitva 1 darab állt benne. A mentett adat
  végig ép volt, csak a megnyitás dobta el.
- A Max jelző körüli térköz kikapcsolt Gyártás gombnál is egyenletes.

---

## 1.2.0 - 2026-08-31

### Amiről őszintén kell beszélni

**A panel mostantól tud gyártani és receptet tanulni.** A korábbi
bejegyzésekben és a fórumon is ez állt: "nem automatizál semmilyen játékbeli
cselekvést". Ez már nem igaz.

**Mindkét gomb alapból ki van kapcsolva**, a Beállítások fülön kapcsolható be,
és kikapcsolva meg sem jelenik. Ha nem nyúlsz hozzájuk, a panel pontosan annyit
tud, mint eddig.

- **Gyártás gomb**: valódi gyártást indít, elhasználja a nyersanyagot. Csak
  megtanult, nem zárolt recepten, és csak ha van elég alapanyag.
- **Megtanulom gomb**: megtanulja a receptet, és el is használja azt.

**A panel minden nyitáskor megnyitja és bezárja a játék Mesterség ablakát.**
Enélkül a játék nem tölti be, mely recepteket ismered - anélkül sem a
tanulás jelzése, sem a zárolás visszaszámlálása nem működne. A panel maga nem
küld kérést, de ez a megnyitás a játék oldaláról kivált egyet, ugyanazt, mint
amikor te kattintasz a Mesterség gombra.

### Hol küld a panel kérést - a teljes lista

Ezt eddig szétszórtan írtam le, itt van egyben. **Öt hely van**, és
mindegyiket megnéztem a kódban. A panel maga sehol nem állít össze hálózati
hívást a játék felé: mindenütt a játék saját függvényét hívja meg, ugyanazt,
amit a natív felület gombjai.

| mikor | mi történik | kikapcsolható |
|---|---|---|
| panelnyitáskor, menetenként egyszer | megnyitja a Mesterség ablakot (`window=crafting`) | nem |
| ugyanakkor, közvetlenül utána | bezárja ugyanazt az ablakot | nem |
| Gyártás gombra | valódi gyártás indul, fogy a nyersanyag | igen, alapból ki |
| Megtanulom gombra | megtanulja a receptet, elfogy a tekercs | igen, alapból ki |
| munkakeresés első használatakor | egyszer lekéri a minitérképet, utána nem | nem, de csak ha rákattintasz |

A minitérkép a "melyik munka adja ezt a nyersanyagot" funkcióhoz kell, és
menetenként **egyszer** kérdez, utána gyorsítótárból dolgozik.

Van egy hatodik kérés is, de az **nem a játék szerverére** megy: a
frissítésellenőrzés a GitHubról tölti le a szkript fejlécét, hogy lássa, van-e
újabb verzió. Naponta legfeljebb egyszer, és kézzel is indítható.

Ezen kívül a panel a böngészőben már betöltött adatot olvassa.

### Zárolás-visszaszámláló

Zárolt receptnél eddig annyi állt, hogy "7 nap" - ez a recept tulajdonsága,
mindig igaz. Mostantól, ha éppen zárolva vagy, a panel megmutatja, mennyi van
hátra, és a feliratra húzva azt is, hogy pontosan mikor gyárthatod újra.

A visszaszámláló rozsdaszínű, hogy ne lehessen összekeverni a statikus
címkével: az a receptről szól, ez rólad.

**A Gyártás gomb zárolt recepten mostantól tiltott.** Eddig aktív volt, és a
kérés hiába ment ki.

Ha a panel nem tudja megbízhatóan, mikor kezdődött a zárolás - ez akkor
fordul elő, ha a Mesterség ablakot már megnyitottad, mielőtt a panelt
elindítottad -, akkor **nem számol vissza**, csak a statikus címke marad. A
gomb ilyenkor is tiltott. Inkább kevesebbet mutat, mint hamisat.

### Megtanulható receptek

Ha a táskádban van egy recept, amit a mesterségszinteddel már megtanulhatnál,
a panel zölden jelzi. **Ez a jelzés semmit nem küld el**, és nem is
kapcsolható ki. A Megtanulom gomb az, ami kapcsolóhoz kötött.

### Tanulás után a panel azonnal követi magát

Megtanult recept után a panel **nem várja meg az F5-öt**: a jelzés eltűnik, a
recept átkerül a megtanultak közé, és ha be van kapcsolva a Gyártás gomb, az
is azonnal megjelenik rajta.

Ez azért nem magától értetődő, mert a játék a tanulás után a saját
recepttáblájába **nem teszi be az új receptet**, csak a terméket, és azt is
csak az újratöltésig. Mérve, két különböző recepten. A panel ezért nem onnan
dolgozik, hanem a táskából: ha a recept-tekercs elfogyott, a szerver
elfogadta a tanulást. Ha a tekercs megmarad, a panel nem jelöl semmit.

### Mesterségszint-emelés után a jelzés magától megjelenik

Ha egy gyártás megemeli a mesterségszintedet, és ezzel új recept válik
megtanulhatóvá, a zöld jelzés magától kijön, kézi frissítés nélkül.

Mérve: a szint körülbelül negyed másodperccel a gyártás után érkezik meg, a
panel pedig ehhez igazodik.

### Ismert korlát: tanulás után érdemes frissíteni

Ezt tisztességesebb leírni, mint elhallgatni, még ha nem is a panel okozza.

**Ha megtanulsz egy receptet, és utána F5 nélkül gyártasz, a játék saját
frissítési lánca hibára futhat.** A gyártás lemegy, a raktár frissül, de a
válaszfeldolgozás félbeszakad, és utána a mesterségszinted vagy más adat
késve, esetleg egyáltalán nem érkezik meg a böngésződbe.

Az okát megmértük: a tanulás egy olyan bejegyzést hagy a játék
recepttáblájában, amit a játék saját ellenőrzője receptnek néz, pedig termék.
Ez a bejegyzés az újratöltésig él.

Ez a panel nélkül is előfordul, mert a natív Gyártás gomb ugyanezt az utat
járja. **Egy F5 megszünteti.**

Az 1.2.1-ben ezt teljesen kimértük, minden más szkript kikapcsolásával: a
hibás bejegyzést **a játék saját kódja** hozza létre, és a saját ellenőrzője
száll el rajta. Szkriptekhez semmi köze, és nincs kit értesíteni róla.

### Négy funkció, amiről eddig elfelejtettem szólni

Ezek a legutóbbi bejelentés óta kerültek be, mindegyik a Beállítások fülön
kapcsolható:

- **Termékbeszerzők**: nyilvántartás arról, kinél mit rendeltél meg és
  mennyit. A hiánylistából ezt levonja, tehát csak az marad benne, amit
  tényleg neked kell beszerezned. Ehhez a böngészőhöz kötött, másik gépről
  nem látszik.
- **Munkaóra-jelzés**: a Mit gyűjts oszlopban megmutatja, melyik munka
  kínálja a legjobb eséllyel az adott nyersanyagot, óránként, lefelé
  kerekítve. Ahol nincs egyórás érték, ott nem jelenik meg.
- **Hatásszűrő**: a receptlista fölé kerül egy választó, hatás szerint
  szűkíthetsz. A lista a játék adatából épül, tehát új termék magától
  megjelenik benne.
- **Mentett tervek**: a munkalap elmenthető és bármikor visszahívható. A
  raktárad nem része a tervnek, visszatéréskor a mostani készlettel számol.

### A Max jelző harmadik állapota

Ha a lánc egy lépését más mesterség gyártja, a panel eddig csak annyit
mondott, hogy "X kell hozzá, azt nem te gyártod" - és elhallgatta, hogy
minden más megvan hozzá.

Mostantól ilyenkor is megjelenik a szám, **rézszínnel**: ennyit tudnál
gyártani, ha a köztes lépés meglenne. A magyarázat a buborékba került.

A két szám nem ugyanazt jelenti. A **zöld** azt, hogy most azonnal
elindíthatod. A **réz** azt, hogy a te oldaladról minden megvan, de addig nem
indul, amíg valaki más le nem gyártja a köztes lépést.

Ha a köztes lépésen kívül is hiányzik valami, nem jelenik meg szám: olyankor
a robbantott ábra soronként megmondja, mi kell. A régi mondat itt
félrevezetett, mert több hiányzó tétel közül egyet nevezett meg, és pont
azt, amiért nem tudsz tenni semmit.

**A réz szám a köztes lépés alapanyagát is beszámítja.** Ha a más
mesterségébe tartozó terméket valaki más gyártja le neked, az anyagot
jellemzően te adod - a robbantott ábra és a hiánylista is így számol.
Ezért ha abból hiányzik, a réz szám is ehhez igazodik. A két szám így nem
mondhat egymásnak ellent egy képernyőn belül.

**A megbízásokat a réz szám is figyelembe veszi**, ha a Termékbeszerzők
kapcsoló be van kapcsolva - ugyanúgy, mint a fa és a készültségi gyűrű.
Kikapcsolva csak a valódi raktár számít. A **zöld** szám és a Gyártás gomb
viszont mindkét állásban kizárólag a valódi raktárból dolgozik, mert az
kérést küld a szervernek, és a megbízás nyilvántartás, nem tárgy.

### Egy korábbi korlát megszűnt

Az 1.0.0 ismert korlátai közt szerepelt, hogy TW-Calc mellett a "csak a
megtanult receptjeim" szűrő nem működik. **Ez már nem áll.** Mivel a panel
minden nyitáskor betölti a Mesterség ablakot, a megtanult receptek TW-Calc
mellett is kiolvashatók.

### Felület

- **A Beállítások fül elrendezése.** A kártyák eddig szétszóródtak, mert a
  rács sorai összekötötték a két oszlopot. Most két független oszlopban
  állnak.
- **A kapcsolók külön szakaszba kerültek**, "Ki- és bekapcsolók" néven.
  Korábban a "Munkaóra-jelzés" cím alá csúsztak, aminek semmi közük nem volt
  hozzá.
- **A termékbeszerzők + gombjával nyíló sorban** eddig nem volt
  tárgyfelajánlás, csak a fenti űrlapon. Most ott is van.
- **A léptetősáv tiltott Gyártás gombnál** szétesett: a szaggatott keret a
  sáv közepén úszott. A sáv mindkét állapotban összefüggő maradt.
- **A Gyártás gomb elsőre is működik.** Ha a darabszám mezőben állt a kurzor,
  az első kattintás elveszett, és csak a második indított gyártást. A mező
  elhagyása ugyanis újraépítette a munkalapot a kattintás közepén, és a
  böngésző ilyenkor nem küld kattintás-eseményt.
- **Az egyelemű mentett terv a mentett darabszámmal nyílik meg.** Eddig "30
  Gyanta" néven mentődött, de megnyitva 1 darab állt benne. A mentett adat
  végig ép volt, csak a megnyitás dobta el. A több elemű tervek eddig is
  helyesen nyíltak.

---

## 1.0.2 - 2026-08-19

**A panel követi a készletváltozást**

Ha a játék natív ablakában gyártottál valamit, a panel eddig nem vette
észre magától: csak a tételfajták számát figyelte, gyártáskor viszont
általában csak a darabszámok mozdulnak. Mostantól a darabszámokat is nézi,
tehát a hiánylista és a készültség magától frissül - nem csak gyártás után,
hanem minden készletváltozásra.

A darabszámok azonosítóval súlyozva adódnak össze. Erre azért van szükség,
mert tizenegy recept egyetlen darab alapanyagból készít egy darab terméket
(Nyers pirit, Kén, Grafit, Cserzett bőr és társaik) - puszta összeggel ezek
kioltanák egymást, és a panel továbbra sem venné észre a gyártást.

---

## 1.0.1 - 2026-08-19

**Receptszintek pontosítása**

A recept-lépcsőszámokat összevetettük a játék natív Mesterség ablakával, és
néhány helyen eltérés volt. Ezek javítva, a panelen és a weboldalon egyaránt.
Ahol a nyitó szint volt téves, ott a "csak amit most tudok gyártani" szűrés
is helyreállt.

**A három szint színt kapott**

A munkalapon a mesterséglépcsők ugyanazt az arany, zöld és kék jelölést
kapják, mint a játék natív ablakában, csak pergamenre hangolt árnyalatokkal.
A weboldalon is, mindkét témában. A robbantott ábra és a lépéskártyák
színezetlenek maradtak, hogy ne versenyezzenek az állapotjelzésekkel.

**Max kijelzés a munkalapon**

A darabszám mellett megjelenik, hogy az adott receptből mennyit tudsz most
legyártani a készletedből. A számítás a saját mesterségedre korlátozódik:
ha a láncban más mesterség terméke szerepel, azt nem tudod magad elkészíteni,
ilyenkor a panel meg is nevezi, mi az akadály. A szintedet és a megtanult
receptjeidet is figyelembe veszi.

Zárolt receptnél 1 áll a jelzőn, mert a játékban is csak egy indítható
egyszerre; hogy hány darabra van alapanyagod, az egérráhúzáskor látszik.

A jelző kijelzés, nem gomb: a panel nem gyárt és nem küld kérést a szervernek.

---

## 1.0.0 - 2026-08-18

Első nyilvános kiadás. A panel ettől a verziótól kezdve nem fejlesztési
állapotú, és a verziószám innentől csak felfelé megy.

A korábbi, 1.x-es számozás fejlesztési sorozat volt. Aki azt használta,
ugyanezt a panelt kapja, csak rendezett számozással.

**Amit a panel tud**

- Mozgatható ablak a játék saját ablakkeretében
- A raktárat élőben olvassa, beolvasás nélkül
- A teljes gyártási lánc lebontása alapanyagokig
- Darabszám 1-től 9999-ig, léptetőgombokkal is
- Több cél egy tervben, összesített hozzávalólistával
- Három nézet: robbantott ábra, lépéskártyák, csak alapanyag
- Készültségi gyűrű százalékkal
- Másolás a játék `[item=ID]` formátumában, tételenként és egyben
- Hiánylista másolása egy gombbal
- Négy nyelv: magyar, angol, német, lengyel
- Beállítások fül: nyelv, verzió, frissítéskeresés, adatállapot
- Frissítésértesítő a játék saját ablakában, naponta legfeljebb egyszer
- A másolás formátuma választható: a játékba illeszthető `[item=ID]` alak,
  vagy olvasható név a játékon kívülre. A váltó a felső sávban áll, a
  választás mentődik, és mindhárom másolási útra hat.
- Szöveges módban a lista elé fejlécsor kerül, hogy a címzett lássa, miről
  van szó. Ez az alak a webes kalkulátorba vissza is olvasható.

**Az utolsó fejlesztési körben javított hibák**

- Az ablak elcsúszva nyílt, ha előtte a játék saját X gombjával zártad be.
  A középre igazítás őre nem állt vissza ilyenkor, ezért az új ablak
  igazítás nélkül jött létre. Az őr mostantól ablakpéldányhoz kötött.
- Darabszám beírása után nem lehetett másik receptre váltani. A darabszám
  megadása magától tervbejegyzést hozott létre, és az elnyomta a listás
  kiválasztást. Mostantól a kiválasztás vezet, kivéve ha több célt
  állítottál össze a + gombbal.

**Ismert korlátok**

- Ha fut a TW-Calc szkript, a "csak a megtanult receptjeim" szűrő nem tud
  dolgozni, mert a TW-Calc felülírja a játék `Crafting.recipes` objektumát.
  Ilyenkor a szűrő letiltva jelenik meg, és a Beállítások fül megmondja,
  miért. Minden más funkció változatlanul működik.
- Az ablak átméretezése ki van kapcsolva. A panel fix, nagy méretben nyílik.
- A frissítésellenőrzés eltérést néz, nem azt, hogy újabb-e a fenti verzió.

---

## Frissítés korábbi verzióról: ÚJRATELEPÍTÉS KELL

Ebben a kiadásban mindkét szkript **új nevet kapott**, hogy nemzetközileg is
érthető legyen:

- `The West Crafting Calculator` (a játékbeli panel)
- `The West Crafting Calculator - inventory import` (a raktár import)

A Tampermonkey a nevéből azonosítja a szkriptet, ezért ezt **új szkriptként**
telepíti a régi mellé. Ha a régit bent hagyod, két példány futna egyszerre.

Ezért a menet:

1. Nyisd meg a Tampermonkey irányítópultját
2. **Töröld a régi szkriptet** (`Mesterség-kalkulátor` kezdetű nevek)
3. Telepítsd az újat a kalkulátor oldaláról

A beállításaid (nyelv, másolási formátum) ilyenkor alaphelyzetbe állnak.
Ez egyszeri lépés, a következő kiadásoktól kezdve a Tampermonkey megint
magától frissít.

A számozás is újraindult: a panel korábban fejlesztési számozással ment
(1.6, 1.7), mostantól az 1.0.0 a kiindulópont, és innentől csak felfelé megy.
