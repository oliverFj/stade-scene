# Overdragelse af Stade Scene

Opdateret 17. november 2026.

## Produktets rolle skal afklares

Scene begyndte som en måde at se, flytte og justere levende dele i en Stade-app. Arbejdet med Blog, Webshop og Editor har udvidet det til en prototype på en visuel appbygger med samlinger, handlinger og databindinger. Omfanget vokser, fordi hver komponent også skal have korrekte data, tilstande, hændelser og forbindelser.

Brugeren har efterspurgt, at mennesker kan bygge egne apps og websider. Samtidig er Stade på vej mod en agentisk udviklingsplatform, hvor Scene skal hjælpe agenter med at sammensætte og vedligeholde produkter. Der er endnu ikke truffet en endelig beslutning om, hvilket af disse forløb der skal bestemme produktets omfang.

Tre mulige retninger bør vurderes.

| Retning | Det skal produktet kunne bære | Konsekvens |
| --- | --- | --- |
| Visuel editor til agentbyggede apps | Redigere udstillede felter, layout, data og forbindelser i et produkt med registrerede funktioner | Agenten og produktkoden leverer specialiseret adfærd. Scene skal vise præcist, hvad der kan ændres. |
| Selvstændig app- og websitebygger | Oprette datamodeller, komponere komponenter, forbinde tilstand og hændelser, vælge lagring og integrere eksterne tjenester | Kræver en betydeligt større editor, en generel runtime og et løfte om at understøtte hele opbygningen af en app. |
| Fælles dokument med gradvis udvidelse | Lade mennesker og agenter arbejde på samme gemte struktur, mens moduler deklarerer deres muligheder | Kræver klare grænser og kompatibilitetsregler, så produktet kan vokse uden skjulte særtilfælde. |

Den foreløbige anbefaling er at afprøve den tredje retning med et afgrænset, komplet brugerforløb. Det er en anbefaling til næste produktbeslutning. Det nuværende system opfylder endnu ikke et generelt løfte om at bygge vilkårlige apps.

## Faktisk implementeret

- Menulinje med Fil, Redigér, Indhold og Moduler. De indbyggede moduler indsætter eksisterende mønstre. Der er endnu ingen installation eller opdatering af eksterne plugins.
- Akter som sider eller modale paneler, containere med stak, række, gitter og fleksibel række, stabile blok-id’er samt fortryd/gentag.
- Et søgbart bibliotek med 62 komponenter. Komponenter uden en særlig sceneaftale får standardindhold og variantvalg. Det giver ikke i sig selv redigerbare indholdspladser, hændelser eller korrekt forbindelse til en controller.
- Fælles registrering af mønstrets dele, felter, handlinger, samlingsbehov og modtagelse af en post. Blog, Webshop og Editor bruger registreringen i bibliotek, Egenskaber og den indbyggede metadata.
- Artikler og Varer i samme formularbaserede indholdseditor. Medier importeres og gemmes lokalt i projektet.
- Handlinger kan pege på en akt eller en blok. En blok findes via sit id efter flytning. Varelinks kan sende en vares id til en blok med varedetaljer.
- Blog har en fremhævet artikel, lister og en læser. Et kortlayout kan bestå af komponentblokke og gentages for hver artikel. Udvalgte komponentfelter kan bindes til artikelfelter.
- Magasinbutik afprøver en artikel, som åbner en vare. Katalog, varedetaljer og kurv bruger samme varepost.
- Scene kan åbne og hente scenefiler samt åbne og opdatere Stade-native HTML. Eksportér app pakker den aktuelle runtime med scenen.

## Begrænsninger der påvirker næste skridt

**Komponenternes redigerbarhed er ujævn.** Fem roller har en scene-definition i det fælles bibliotek. Scene tilføjer billed- og knapfelter. De øvrige roller får primært variantvalg. En komponent med menuer, valglister eller komplekst indhold skal have en egentlig aftale om indhold, struktur, hændelser og controller. Komponentkatalogets eksempler fungerer som standardmarkup ved indsættelse.

**Kortlayoutet er en Blog-pilot.** Det ligger under en blog-list-blok og bruger en fast liste af understøttede artikelfelter. Knapper inde i kortet forbindes til artikellæsning. Der findes endnu ikke en generel gentagelsescontainer, et udtrykssystem eller en samlingsuafhængig binding.

**Indholdsskemaerne er faste.** Artikler og Varer er registreret i kode. Brugeren kan redigere poster, men endnu ikke oprette egne samlingstyper og felter. Post-id’er og mediereferencer valideres. En samling kan rumme 100 poster. Projektets medier har en samlet grænse på 4 MB.

**Samspil er deklareret for bestemte tilfælde.** Der findes mål og en aftale om at sende et post-id. Der mangler en generel model for hændelser, kommandoer, formularindsendelse, resultater, fejl og forbindelse mellem komponenters tilstand. Domæneregler som kurvens beregning ligger i produktets controller.

**Modulgrænsen er tidlig.** Registrering, runtime-adaptere og indholdsskemaer er stadig fordelt på filer. Der er ingen samlet installationspakke med versioner, afhængigheder, migrationsregler, rettigheder og en kontrolleret afinstallation. En stor pluginsatsning bør følge en afprøvet kontrakt.

**Layout og appdata har forskellige levetider.** Scenefilen gemmer opsætning, samlinger og medier. Åben artikel, kurv og arbejdsfladens kladder er løbende app-tilstand. Der findes ingen generel lagring, brugerkonto, server eller publiceringsproces for indholdsændringer. Webudgaven arbejder i den besøgendes browser.

**Flere dele kan kun forekomme én gang.** Artikellister kan gentages. Mange levende mønsterdele deler fortsat én controller pr. mønster i scenen. Uafhængige instanser af samme produktmønster kræver en eksplicit model for instans, tilstand og datakontekst.

**Kompatibilitet kræver omtanke.** Scene kan læse tidligere sceneformater, og bygget bevarer eksisterende appfiler. Ældre HTML har sin egen runtime og kan ikke køre alle nyere funktioner. Eksportér app er den aktuelle vej til en fil med den nye runtime. Dataformatet er fortsat version 2, suppleret med capability-markører i HTML.

## Foreslået næste beslutning og afprøvning

Afklar først den primære bruger og en konkret færdig opgave. Et muligt forløb er, at en agent opretter en lille app, hvorefter en person selv kan ændre data, sammensætte et kort og forbinde en formular uden at redigere kode. Det bør bruges til at afgøre, hvilke redigeringsmuligheder der mangler, og hvilke produktfunktioner modulet leverer.

Udform derefter én fælles komponentaftale for indholdspladser, tilladte børn, egenskaber, hændelser, kommandoer, datakontekst og oprydning. Menneskets editor og agentens værktøjer skal kunne læse samme aftale. En komponent skal kunne fortælle, hvilke muligheder der faktisk er tilgængelige.

Afprøv aftalen med et tekstfelt, en knap, en liste og en detaljevisning i samme forløb. Udvid kortlayoutet til en generel gentagelse, når piloten kan genbruges på tværs af Artikler og Varer. Beslut dataformatets versions- og migrationsmodel, før flere specialfelter tilføjes.

Editoren har fået faste menuer, men den samlede informationsstruktur bør fortsat vurderes med rigtige opgaver. Indhold og Medier er fælles projektressourcer. Egenskaber bør vise indstillinger for den valgte blok og give en direkte vej til relevante data og forbindelser.

## Kilder og ansvar

| Område | Kilder |
| --- | --- |
| Editor, menuer og udvalg | src/app.mjs, src/command-menus.mjs, src/block-library.mjs, src/outline.mjs |
| Sceneformat, akter og validering | src/scene-file.mjs, src/scene-model.mjs, src/scene-acts.mjs |
| Mønsterregistrering og felter | src/demo-patterns.mjs, src/pattern-definition.mjs, src/scene-patterns.mjs, src/visual-fields.mjs |
| Data, referencer og formular | src/content-schema.mjs, src/content-data.mjs, src/content-editor.mjs, src/scene-media.mjs |
| Kortlayout og rendering | src/article-card.mjs, src/scene-view.mjs, src/blog-view.mjs |
| Handlinger og navigation | src/scene-actions.mjs, src/act-navigation.mjs |
| HTML og build | src/native-package.mjs, src/native-app.mjs, tools/build.mjs |
| Skabeloner | scenes/*.scene.json og src/templates.mjs |

Stade ejer de fælles komponenter og controllere samt referencerne i studio/scenes/. Scene bruger disse ved build og har en kopieret runtime i design/. En frisk kildekopi af Scene kræver derfor også Stade-kilder. STADE_ROOT kan angives ved build. De to repositories skal holdes på kompatible versioner.

Denne overdragelse er kontrolleret sammen med Stade-commit [b58c468](https://github.com/oliverFj/design-studio/commit/b58c468d32a7cc8418b61ade8fcc5fa74e17485e).

Stades agentværktøjer ligger i collaboration/scene-context.mjs, collaboration/scene-move.mjs og tools/mcp-server.mjs i Stade. get_scene_context læser gemt struktur, feltdefinitioner, bindinger og forbindelser fra HTML. Flytteværktøjet bruger revisioner og kontrollerer resultatet. Det er endnu ikke en generel API til at oprette, slette eller ændre alle data og egenskaber.

## Kontrol og udgivelse

Seneste funktionelle kontrol før denne overdragelse omfattede 68 målrettede Stade-tests, Scenes doctor, browserprøver af kortenes rækkefølge og feltbindinger, navigation og 320 px samt statisk gemning og genåbning af HTML. En browserprøve viste også alle 62 komponenter indlæst fra en scene. Det dokumenterer standardrendering, og yderligere komponentadfærd skal afprøves efter den konkrete integration.

Ved klargøringen til offentliggørelse bestod hele Stades testsamling med 625 tests, tema- og dokumentationskontrollen samt Scenes doctor. Stade, Scene og hjemmesidens produktionspakke er genbygget. Hjemmesidens kontrol af links, ressourcer, kilder og offlinepakning bestod.

En frisk GitHub-kopi afdækkede, at Windows-linjeskift gav falske fejl i doctor. Sammenligningen af CSS og kopieret runtime er nu uafhængig af LF/CRLF, og doctor følger STADE_ROOT eller projektets relative sti. De målrettede kontroller bestod med 98 tests, herunder regressionen for checkout og kildeplacering. Onlinefilerne er desuden hentet og sammenlignet med produktionspakkens SHA-256-fingeraftryk.

HTTP-kontrol og statisk filkontrol er udført. Direkte åbning ved dobbeltklik, hele operativsystemets gemmeforløb og en samlet hjælpemiddelprøve kræver stadig manuel kontrol.

Den offentlige editor ligger på https://oliver.fjordside.dk/stade-scene/. Stades Scener-side indeholder en bygget Scene-editor sammen med demoerne. Logoet i Scenes header linker tilbage til Stade. Hjemmesiden ejer de offentliggjorte kopier, og et almindeligt Scene-build offentliggør dem ikke.

Kildekode offentliggøres som oliverFj/stade-scene og oliverFj/design-studio. Gemte HTML-apps og lokale brugerfiler holdes ude af kilde-repositoryet. Læs README.md for build fra et nyt checkout.
