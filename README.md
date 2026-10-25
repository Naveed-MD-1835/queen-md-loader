# 👑 Queen MD Loader

Ye loader private **Queen-Md** repo ko GitHub se zip ki shakal me
download karta hai, unzip karta hai, phir us ke andar wali `index.js`
ko run karta hai — aur ek chhota status page bhi dikhata hai.

## Kaam karne ka tareeqa

1. `index.js` kholo — upar CONFIG me ye 4 cheezein hain:
   - `GITHUB_TOKEN` — **YAHAN APNA TOKEN LAGAO**
     (pehle se likha hai: `'your_github_token_here'` — is ki jagah
     apna token likh do)
   - `REPO_OWNER` — `naveedahmed35581-arch`
   - `REPO_NAME` — `Queen-Md`
   - `BRANCH` — `main`
2. Token lagane ke baad file ko **lock** (obfuscate) kar do, jese
   pehle wale loader ki file lock thi.
3. Locked file ko public repo `queen-md-loader` me daal do.
4. Heroku par deploy karo. Procfile me dono dyno hain:
   - `worker: node index.js` — sirf bot chalane ke liye
   - `web: node index.js` — status page ke liye (Heroku ka PORT
     use hota hai). Web dyno scale karne par `/` par status page
     khulega: bot running/stopped, last download time aur restart
     count nazar ayega. JSON ke liye `/status` kholo.

## Run karne ki command (apne computer / server par test ke liye)

```bash
npm install
node index.js
```

## Flow

```
CONFIG check (token/repo/branch)
   → purani extraction saaf karo
      → zip download (3 koshish, backoff ke sath)
         → unzip (repo_extracted folder me)
            → index.js dhoondo
               → npm install (bot folder me)
                  → node index.js (spawn se, bot folder se)
                     → band ho to auto-restart (5s, double hota hua 60s tak)
```

## Environment variables (sirf zaroorat par)

- `GITHUB_TOKEN` — sirf tab use hota hai jab file me abhi bhi
  placeholder token ho. Pehle file wala token hi chalta hai.
- `QUEEN_MAIN_REPO` — format `owner/repo` (ya `owner/repo@branch`).
  Set ho to file wali repo ki jagah ye use hogi.
- `QUEEN_MAIN_BRANCH` — branch override.
- `MONGODB_URL` — bot ko pass ho jata hai (bot ke sessions ke liye).

## ⚠️ Token ki hifazat

- Sirf **read-only** token use karo (sirf private repo parhne ki
  permission ho) — taake agar token kisi ke haath lag bhi jaye to
  wo repo me kuch badal na sake.
- Token kabhi kisi ko mat bhejo, aur agar leak ho jaye to foran
  GitHub se revoke karke naya bana lo.
- Token ghalat ho to loader saaf likh dega: `401/403` ka matlab
  token ka masla hai, `404` ka matlab repo/branch ka naam ghalat hai.
