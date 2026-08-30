// OneDrive-Anbindung (Phase 3): Microsoft-Login (MSAL) + Graph-API-Zugriff.
// ponytail: nur Login + Lese-Beweis (Wurzelordner listen); Datei-Sync und
// Book-Zugriff kommen in Phase 3b, wenn der Login auf dem Handy steht.
// Die Client-ID ist kein Geheimnis - sie identifiziert nur die App-Registrierung
// "UGC Cockpit" (Entra, Kontotyp: nur persoenliche Microsoft-Konten).

const OD_CLIENT_ID = "0f2952a6-fb67-4a72-a17d-d919b6aa3fa7";
const OD_SCOPES = ["User.Read", "Files.ReadWrite"];

let odApp = null;
let odBereit = false;
let odFehler = null;

(async () => {
  try {
    if (typeof msal === "undefined") throw new Error("msal-browser.min.js fehlt");
    odApp = new msal.PublicClientApplication({
      auth: {
        clientId: OD_CLIENT_ID,
        // "consumers" = nur persoenliche Microsoft-Konten (365 Family)
        authority: "https://login.microsoftonline.com/consumers",
        // muss exakt zur registrierten Redirect-URI passen. Relativ zur
        // aktuellen Seite aufgeloest, damit beide Hosts funktionieren:
        // lokal  -> http://localhost:8791/index.html
        // Pages  -> https://<user>.github.io/<repo>/index.html
        redirectUri: new URL("index.html", location.href).href,
      },
      // localStorage statt sessionStorage: Login uebersteht App-Neustart
      cache: { cacheLocation: "localStorage" },
    });
    await odApp.initialize();
    // Faengt die Rueckkehr vom Microsoft-Login ab (Redirect-Flow)
    const antwort = await odApp.handleRedirectPromise();
    if (antwort) {
      odApp.setActiveAccount(antwort.account);
    } else if (!odApp.getActiveAccount() && odApp.getAllAccounts().length) {
      odApp.setActiveAccount(odApp.getAllAccounts()[0]);
    }
    odBereit = true;
  } catch (fehler) {
    odFehler = fehler.message;
  }
  window.dispatchEvent(new Event("od-ready")); // app.js rendert dann neu
})();

const OD = {
  bereit: () => odBereit,
  fehler: () => odFehler,
  konto: () => (odBereit ? odApp.getActiveAccount() : null),
  anmelden: () => odApp.loginRedirect({ scopes: OD_SCOPES }),
  abmelden: () => odApp.logoutRedirect(),

  // Access-Token: erst still aus dem Cache, sonst neuer Login-Redirect
  async token() {
    try {
      const r = await odApp.acquireTokenSilent({
        scopes: OD_SCOPES,
        account: odApp.getActiveAccount(),
      });
      return r.accessToken;
    } catch (_) {
      await odApp.acquireTokenRedirect({ scopes: OD_SCOPES });
    }
  },

  // Wie graph(), aber ohne Login-Redirect: null statt Fehler/Umleitung.
  // Fuer Hintergrund-Abrufe (Snapshot laden), die den Nutzer nie
  // unerwartet auf die Microsoft-Login-Seite werfen duerfen.
  async graphLeise(pfad) {
    if (!odBereit || !odApp.getActiveAccount()) return null;
    try {
      const r = await odApp.acquireTokenSilent({
        scopes: OD_SCOPES,
        account: odApp.getActiveAccount(),
      });
      const antwort = await fetch("https://graph.microsoft.com/v1.0" + pfad, {
        headers: { Authorization: "Bearer " + r.accessToken },
      });
      return antwort.ok ? antwort.json() : null;
    } catch (_) {
      return null;
    }
  },

  // Schreiben ohne Login-Redirect (Phase 4): JSON per PUT nach OneDrive.
  // Gibt true/false zurueck statt zu werfen - der Aufrufer meldet per Banner.
  async graphPutLeise(pfad, daten) {
    if (!odBereit || !odApp.getActiveAccount()) return false;
    try {
      const r = await odApp.acquireTokenSilent({
        scopes: OD_SCOPES,
        account: odApp.getActiveAccount(),
      });
      const antwort = await fetch("https://graph.microsoft.com/v1.0" + pfad, {
        method: "PUT",
        headers: {
          Authorization: "Bearer " + r.accessToken,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(daten),
      });
      return antwort.ok;
    } catch (_) {
      return false;
    }
  },

  // Graph-API-Aufruf, z.B. OD.graph("/me/drive/root/children")
  async graph(pfad) {
    const token = await this.token();
    const antwort = await fetch("https://graph.microsoft.com/v1.0" + pfad, {
      headers: { Authorization: "Bearer " + token },
    });
    if (!antwort.ok) throw new Error("Graph HTTP " + antwort.status);
    return antwort.json();
  },
};
