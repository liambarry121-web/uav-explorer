# UAV Design Explorer — iPhone + Windows (PWA)

This package is a **browser-based installable web app**, suitable for Windows and iPhone **without owning a Mac**. It mirrors the original C design engine in `model.js` (JavaScript, because browsers cannot run a plain `.c` file), rather than producing an Apple-signed IPA. The previously generated Xcode/C project remains separate.

## Option A — Put it on your iPhone Home Screen (recommended)

1. On **Windows**, unzip `UAV_iPhone_Browser_App.zip`.
2. Sign in at https://github.com and create a **public repository** (for example `uav-explorer`).
3. Click **Add file → Upload files** and upload the **contents of the extracted folder** to the *root* of the repository: `index.html`, `app.js`, `model.js`, `styles.css`, `manifest.webmanifest`, `sw.js`, and the entire `icons/` folder. Commit the files. **Do not upload the ZIP alone.**
4. Open repository **Settings → Pages**. Under **Build and deployment**, choose **Deploy from a branch**, select **main** and **/(root)**, then click **Save**.
5. Wait for Pages to publish, then open the HTTPS address shown in Pages settings (usually `https://YOUR-USERNAME.github.io/uav-explorer/`) in **Safari on your iPhone**.
6. In Safari tap **Share → Add to Home Screen → Add**. If available, leave **Open as Web App** turned on.
7. The UAV Explorer icon should appear on your Home Screen. Open it like an app. Once the site has loaded and the service worker finishes caching, it should also work offline on future visits.

**Hosting note:** A public GitHub Pages repository/site is viewable by others. The app contains the simulation and no private credentials. Your local slider values stay in the device browser; exporting creates a JSON file. It does not upload your settings to a server.

**If you only want to test on Windows:** Install Python, open a terminal in the extracted app folder and run:

```powershell
py -m http.server 8000
```

Visit http://localhost:8000 in Chrome, Edge or Firefox. (Opening `index.html` directly via `file://` may block the module imports.)

**Alternative to GitHub Pages:** Any static HTTPS host that serves all files from the same directory can publish this PWA.

## Included features

* 17 sliders matching the prior C/iOS prototype.
* Ground-roll numerical integration from 0 m/s, minimum takeoff airspeed, estimated ground distance and assumed thrust.
* Live flight graphs: altitude, |V|/Vx/Vy, lift/weight/drag, required and available thrust, CL/CD and Reynolds number.
* Ground-roll speed/time and forces/distance graphs.
* 10 kg mass cap, 5 kg water payload, ~4.02 km route, 150–200 ft operating altitude, 40-knot speed ceiling.
* 15-minute endurance check retaining ≥ 20% nominal battery; flight time and additional unplotted loiter requirement.
* Suggestions for changes to area, CLmax, speed, mass, battery/current and propulsion assumptions.
* Automatic local storage of slider settings, restore defaults and export of a settings JSON file.

## Model basis and limitations

The JavaScript numerical engine is a line-by-line functional port of the earlier C engine `UAVModel.c`. Defaults and assumptions: sea-level density 1.225 kg/m³, air viscosity 1.7894×10⁻⁵ Pa·s, g = 9.81 m/s², 65% propulsive efficiency and rolling resistance coefficient 0.04. Each battery is **assumed** 22.2 V / 6 Ah / 1 kg, with packs in parallel; electrical current is a user-controlled system-level input. This is a **preliminary fixed-wing sensitivity model**, not flight-control software. The static-thrust slider and propulsion-efficiency factor are **not** validated thrust-vs-airspeed data. Takeoff CL is used as a proxy for CLmax. The ground roll assumes a flat runway, no wind, constant coefficients and no rotation dynamics; it estimates reaching the required airspeed, not actual takeoff. It does not prove structural integrity or operational compliance. The 20-metre launch/landing “box” is not assigned an invented runway length. The water release is positioned on descent at 20 ft AGL as a modelling assumption. 15-minute endurance and 20% remaining are checked independently of the shorter plotted ~4 km mission, and any additional flight is not simulated. Validate all competition constraints against official IMechE requirements.

## Files

* `index.html` – app shell / tabs / graphs / sliders
* `styles.css` – mobile-friendly appearance
* `app.js` – interface, canvas graph rendering, persistence
* `model.js` – translated design calculations (original engine in C remains available in the Xcode version)
* `manifest.webmanifest`, `sw.js`, `icons/` – install-to-Home-Screen / offline functionality
