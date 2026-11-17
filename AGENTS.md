<!-- design-studio -->
## Design Studio

Brug Design Studio-systemet i E:/AI projekter/Design Studio.
Følg produktets egne anvisninger. Start udviklingsopgaver med Stade-MCP's get_onboarding, produktets registrerede projekt-id og de relevante opgavetyper. Brug docs/AGENT-ONBOARDING.md i systemmappen, hvis værktøjet eller projektets tilknytning mangler.
Find design-studio.project.json og brug dens faktiske stier og scope. Projektets tema er design/design.json; design/design.css og design/runtime genereres af sync og må ikke håndredigeres.

Lever som standard projektets egen index.html i roden, som åbnes direkte via file:// uden server, terminal eller installeret runtime.
Brug projektets npm run build til at pakke kode, runtime, CSS og nødvendige ressourcer til offlinebrug; undgå CDN'er og lokale fetch-/modulkald, der kræver en server.
Agenten installerer udviklingsafhængigheder og genbygger efter kode-, tema- og ressourceændringer. Brugeren skal blot genindlæse browseren.
Init har oprettet src-filer, tools/build.mjs, package.json og en færdig index.html. Kør npm install ved første udviklingsopsætning. Redigér src-filerne, ikke den genererede index.html.
Bevar eksisterende arkitektur og brand. En anden driftsmodel kræver et udtrykkeligt brugerkrav eller konkret nødvendig funktionalitet.

Genbrug biblioteket fra design/runtime/components.mjs og temaets tokens under ds-scope. Brug de fælles breddeprofiler gennem createLayout eller ds-layout/data-layout; produktet ejer kolonner og placering.
Registrér kun faktiske frameworkadaptere i konfigurationens components med verificerede file og export. Direkte runtimebrug kræver ingen lokal adapter. Nye genbrugelige roller og varianter udvikles i det fælles bibliotek, ikke som lokale kopier.
Brug de fælles controllere til interaktion: mountMenuControls til kommandomenuer, mountTree til hierarkier og native showModal()/close() til dialoger. Produktet ejer data, kommandoer og validering. Bevar kladder, fejl og valg ved temaskift; ryd controllere ved genmontering.
Læs brandprincipper, sektionsregler og logobrug i temaet. Brug logo-originalerne fra design/assets efter brandreglerne og bevar licenser.
Brug createProjectFile fra design/runtime/files.mjs med produktets format-id, version og validering. Annullerede eller ugyldige åbninger bevarer state. Downloads overskriver ikke automatisk originalfilen.

Kør sync fra systemmappen ved ændret tema eller fælles runtime og genbyg derefter produktet. Rene produktændringer kræver ikke sync. Brug npm run doctor i offline-startprojektet til at finde konkrete fejl; kontrollen ændrer ikke filer.
tools/cli.mjs update PROJECT_DIR viser valgfrie skabelonopdateringer. Gennemgå planen før --apply; lokale ændringer bevares. Opdatering erstatter ikke dette produkts AGENTS.md.
Kontrollér den berørte funktion proportionelt. Agentens standard er browserkontrol af den byggede fil over lokal HTTP på loopback samt relevante statiske offlineprøver eller produktets doctor. Nye skærme kontrolleres med relevant tastatur, smal bredde og fejl-/tomtilstande. Hvis browserværktøjet kun tillader HTTP/HTTPS, skal file:// ikke forsøges; gentag ikke en kendt begrænsning, og omgå ikke URL-politikken med andre værktøjer eller scripts. HTTP- og statisk kontrol er ikke direkte filkontrol. Ved ændrede offlineafhængigheder, filhåndtering eller en bestilt samlet offlineleverance aftales særskilt manuel filkontrol, hvis ingen tilladt kontrolvej findes. Rapportér kun den udestående filkontrol, når den er relevant for opgaven. Følg systemets docs/AGENT-WORKFLOW.md.
`src/scene-view.mjs` placerer skabelonens levende blokke i appvisningen, mens det separate editorinterface ligger i `src/app.mjs`. Overblik bruger Stades `studio/scenes/workspaces.mjs` og `workspaces.css` gennem `src/overview-view.mjs`. Øverum bruger `src/practice-view.mjs` med én øvelsestilstand pr. åben scene. Øvelsesvalg og afspilning gemmes ikke i Øverums scenefil.

`scenes/overblik.scene.json` og `scenes/oeverum.scene.json` er de indbyggede skabeloner i version 2 af scenefilen. Arbejd fra brugerens senest gemte `.scene.json`, når den findes. Bevar blokkenes id’er ved flytning og omdøbning. `children` bestemmer rækkefølgen. `width` er en relativ andel i en række og en procentbredde i en stak eller et gitter. `src/templates.mjs` beskriver skabeloner og deres bloktyper, og `validateLayout` i `src/scene-model.mjs` kontrollerer scenen. Placér visuelle felter i `src/visual-fields.mjs` og det levende indhold i skabelonens egen visning. Ændringer af layout og visuelle felter skal bevare appens monterede tilstand.

Scene gemmer hver akt som `id`, `name`, `mode` (`side` eller `panel`) og `layout` under `data.acts`. Den første akt er startsiden. Blokken `act-trigger` åbner en anden akt gennem dens stabile id i `props.targetAct`. Akter deler skabelonens levende app-tilstand. Ældre filer med `data.layout` åbnes med det eksisterende layout som én akt. `src/scene-acts.mjs` håndterer tidligere formater og kontrollerer layout, unikke id’er og forbindelser mellem akterne.

`Øverum.html` er den selvstændige Stade-native app. `stade-native-app` er dens indlejrede JSON med app-id og en valideret `stade-scene`. Scene læser denne JSON ved **Åbn app** og opdaterer kun scenedelen ved **Gem app**. Bygget anvender en eksisterende appfils scene, når runtime genbygges. Brug den senest gemte appfil eller brugerens udvekslede `.scene.json` som udgangspunkt for videre arbejde.

En container med `layout.flow` sat til `wrap` lader blokke bryde til næste linje. Underblokkens `sizing.mode` vælger indholdsbredde (`fit`, også standard uden `sizing`), fyld ledig plads (`grow`) eller en fast ønsket bredde (`fixed`). For `grow` og `fixed` angives `sizing.basis` i px. Blokkens øvrige `width` kan fortsat bruges i andre layouttyper.

Kør `npm run build` igen efter ændringer i skabelonen, og afprøv forbindelsen mellem blokke i appvisningens Afprøv-tilstand.

`src/visual-fields.mjs` samler Stade-komponenter og mønstre med en `scene`-definition. Validering, biblioteket og Egenskaber bruger de samme definitioner. Slå dem op med henholdsvis `get_component` og `get_pattern`. Mønstre med `scene` monteres gennem `mountComposition` og anvender deres feltværdier gennem `setConfiguration`. Visuelle valg gemmes som `props` på det stabile blok-id. Udeladte felter bruger standardværdier. Bevar brugerens værdier, når et andet felt ændres. Fortryd og Gentag gælder editorens layout og visuelle egenskaber.
