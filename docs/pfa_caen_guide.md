# Ghid Coduri CAEN pentru PFA (Ride-sharing & Setlists MD SaaS)

Acest document detaliază structura recomandată a codurilor CAEN pentru un PFA din România care are ca activitate principală Ride-sharing-ul (Uber, Bolt) și ca activitate secundară lansarea și monetizarea aplicației de tip SaaS, Setlists MD (prin Stripe).

## 1. Activitatea Principală (Ride-sharing)

**Cod CAEN: 4932 - Transporturi cu taxiuri**

* **De ce acest cod?** Conform legislației din România (OUG 49/2019 privind transportul alternativ), codul CAEN 4932 este **obligatoriu** pentru a putea colabora cu platforme precum Uber, Bolt sau FreeNow. Deși denumirea face referire la "taxiuri", acesta este codul legal alocat transportului alternativ de persoane.
* **Notă:** Trebuie să obții și atestatul profesional pentru transport persoane în regim de închiriere și copia conformă pentru mașină.

## 2. Activități Secundare (Setlists MD - SaaS)

Pentru vânzarea unei aplicații proprii (Model SaaS - Software as a Service) pe bază de abonament prin Stripe, fără a oferi servicii de dezvoltare la comandă pentru alți clienți, cel mai potrivit cod este:

**Cod CAEN: 5829 - Activități de editare a altor produse software**

* **De ce acest cod?** Acest cod acoperă exact situația în care deții drepturile de proprietate intelectuală asupra unui produs software (Setlists MD) și îl distribui, publici sau oferi acces la el pe bază de plată (abonament SaaS, licențe). Este codul perfect pentru produse proprii vândute către masa largă de utilizatori și organizații (biserici, trupe).

**Coduri CAEN Secundare Adiționale (Opționale, dar recomandate pentru siguranță):**

* **Cod CAEN: 6311 - Prelucrarea datelor, administrarea paginilor web și activități conexe**
  * *De ce?* Deoarece aplicația ta va stoca date (Supabase), va face sincronizări de fișiere în cloud și vei administra infrastructura (baza de date pentru clienți). Este un cod util pentru partea operațională a unui SaaS.
* **Cod CAEN: 6201 - Activități de realizare a soft-ului la comandă (software orientat client)**
  * *De ce?* Deși ai menționat că nu vei face dezvoltare la comandă momentan, este bine să îl ai în actul constitutiv al PFA-ului pentru a nu trebui să modifici actele mai târziu, în caz că o organizație foarte mare dorește o funcționalitate "custom" doar pentru ei, pentru care ar fi dispuși să te plătească separat. (Nu te costă nimic în plus să ai mai multe coduri secundare înregistrate).

## 3. Particularități privind încasările prin Stripe

Deoarece vei încasa bani din străinătate (chiar și Stripe Irlanda) și este posibil să ai clienți din afara României:
1. **Cod de TVA Intracomunitar (VIES):** Chiar dacă PFA-ul tău va fi neplătitor de TVA în România, pentru a lucra cu procesatoare de plăți din UE (ex: Stripe) și pentru a plăti comisionul lor sau pentru achiziții intracomunitare, va trebui să soliciți la ANAF eliberarea unui **Cod Special de TVA Intracomunitar** (conform art. 317 din Codul Fiscal) *înainte* de a începe încasările/plățile externe.
2. **Facturare:** Stripe emite facturi către clienți în numele tău, însă tu trebuie să înregistrezi veniturile în contabilitatea PFA-ului. Facturarea se va face de pe codul CAEN de editare software (5829) sau cel principal, în funcție de programul de facturare.

*Disclaimer: Informațiile de mai sus au caracter consultativ și tehnic. Este recomandat ca înainte de înființarea PFA-ului să validezi aceste detalii cu un contabil autorizat care cunoaște specificul platformelor SaaS și de ride-sharing.*