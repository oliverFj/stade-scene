# Stade Scene

En visuel editor til apps bygget med Stades komponenter, mønstre og temaer. Scene kan redigere layout, akter, udvalgte komponentfelter, indholdssamlinger og forbindelser i lokale scene- og HTML-filer.

[Åbn Scene](https://oliver.fjordside.dk/stade-scene/) · [Åbn Stade](https://oliver.fjordside.dk/design-studio/index.html) · [Overdragelse og produktvalg](docs/OVERDRAGELSE.md)

## Status

Scene er en fungerende prototype. Den afprøver både menneskers visuelle redigering og agenters adgang til den samme gemte appstruktur. Den endelige afgrænsning mellem selvstændig appbygger og editor til agentbyggede produkter er et åbent produktvalg.

Alle 62 komponenter findes i Indsæt blok. Feltredigering, databindinger og forbindelser er mest gennemarbejdede i Blog og Webshop. De øvrige komponenter kan indsættes med deres standardopsætning og varianter. Indsættelse dokumenterer derfor kun en del af det arbejde, der kræves for at gøre dem brugbare i en færdig app.

## Byg

Node.js 20 eller nyere og en kildekopi af [Stade](https://github.com/oliverFj/design-studio) er nødvendige ved build. Scene bruger bl.a. mønstre, demo-controllere og temaer fra Stade. Den kopierede runtime i design/ dækker kun en del af byggegrundlaget.

Denne udgave er kontrolleret med Stade-commit [6591327](https://github.com/oliverFj/design-studio/commit/65913275f2c4e3efcb650bac929f76f1c1b6c020).

Klon fx begge repositories ved siden af hinanden. Kør derefter i Scenes mappe på PowerShell.

    npm ci
    $env:STADE_ROOT = (Resolve-Path ../design-studio).Path
    npm run build
    npm run doctor

På macOS og Linux kan build køres med en miljøvariabel.

    npm ci
    STADE_ROOT=../design-studio npm run build
    npm run doctor

STADE_ROOT vælges ved build. Driftsformen, filformatet og kilderne er beskrevet i overdragelsen.

## Brug

Efter build åbnes index.html i browseren. Fil → Ny app viser de medfølgende skabeloner og en tom app. Gem scene henter layout og indhold som JSON. Eksportér app henter en selvstændig HTML-fil. Åbn app og Gem app kan bruges til at redigere en eksisterende Stade-native app.

Genererede HTML-filer og brugerens gemte scener versionsstyres særskilt fra kildekoden. Bygget bevarer scenedata fra de eksisterende appfiler i projektmappen.

Tredjepartslicenser for medfølgende skrifter og ikoner bevares i design/assets/ og i de byggede filer. Dette repository tildeler ingen yderligere licens til Stades kildekode.
