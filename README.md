# ELAK

Ankle rehab site for patients and clinicians. This folder is the web copy: HTML, CSS, and JavaScript only. There is no `.env` and no laptop calendar or Kale server.

## Pages

After you deploy this folder as a static site:

- Patient: `https://YOUR-DOMAIN/`
- Clinician: `https://YOUR-DOMAIN/clinician.html`

The home link is the patient page. Open `/clinician.html` for the clinician page, or use **Clinician sign in** on the patient card.

## Deploy on Zeabur

1. Push this repository to GitHub.
2. Open [zeabur.com](https://zeabur.com) and create a project.
3. Add Service → GitHub → this repo.
4. Choose **static** if Zeabur asks. Leave the root as this folder (`index.html` at the top).
5. Open **Domains** and add a free `*.zeabur.app` name.

Or from this folder:

```bash
npx zeabur@latest deploy
```

Do not add a Python or Node start command. This is a static website.

## What stays on each person's browser

Accounts, exercise plans, and rewards are saved in that browser only. They do not travel with this GitHub repo.

Laptop Calendar.app and the Kale language model stay on the home computer. The live site still runs sign-in, exercises, rewards, Kale's Revenge, and reports.

## Local check

```bash
python3 -m http.server 8765
```

Then open `http://127.0.0.1:8765/` and `http://127.0.0.1:8765/clinician.html`.
