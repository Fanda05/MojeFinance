## MojeFinance – vývojové spuštění

Celý projekt teď běží jako tři Node.js mikroslužby + frontend. Aby registrace, přihlášení i mock banky fungovaly, je potřeba spustit všechny části.

### 1. Konfigurace
1. `cp .env.example .env` a případně upravte hodnoty (např. přístup k Postgresu).  
2. Výchozí administrátor se vytváří automaticky podle proměnných `DEFAULT_ADMIN_USERNAME` a `DEFAULT_ADMIN_PASSWORD` (default `admin` / `admin123`).

### 2. Databáze
Nejrychlejší je použít připravený Postgres z Docker Compose:

```bash
docker compose up -d postgres
```

Služba spustí také `db/init.sql`, které vytvoří tabulky a naplní bankovní poskytovatele.

### 3. Instalace závislostí

```bash
npm install             # v kořenovém adresáři kvůli sdíleným balíčkům (frontend)
npm install --prefix auth_service
npm install --prefix bank_service
npm install --prefix analytics_service
```

Frontend má vlastní `package.json`, takže případně ještě `npm install` ve složce `frontend`.

### 4. Spuštění služeb
Každou službu spusťte v samostatném terminálu:

```bash
npm --prefix auth_service start
npm --prefix bank_service start
npm --prefix analytics_service start
npm --prefix frontend run dev   # spustí Vite na http://localhost:5173
```

> Poznámka: Bank a analytics služba očekávají, že autentizace běží a všechny čtyři služby sdílí stejné `.env`.

### 5. Přihlášení / registrace
- Můžete začít přihlášením pomocí výchozího účtu `admin` / `admin123`.
- Nebo použijte stránku Registrace; po registraci lze připojit mock banky (reálné banky vrací 501 do doby, než doplníte PSD2 certifikáty).

Pokud ve frontendové aplikaci uvidíte hlášku o nedostupném API, znamená to, že některá z výše zmíněných služeb neběží nebo se nepropojila s databází.
