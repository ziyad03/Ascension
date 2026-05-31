const fs = require('fs');
const path = require('path');
const { generateRoundQuestions, generateCategoryBankBatch, getOllamaStatus } = require('./ai/questionGenerator');

const LOCAL_BANK_DIR = path.join(__dirname, '..', '.local-data', 'category-banks');

const PHASE1_CATEGORIES = [
  'Technology',
  'Programming',
  'Web Development',
  'Mobile Development',
  'Databases',
  'Networking',
  'Cybersecurity',
  'Artificial Intelligence',
  'Machine Learning',
  'Cloud Computing',
  'Science',
  'Mathematics',
  'Logic',
  'Engineering',
  'Electronics',
  'Business',
  'Economics',
  'Entrepreneurship',
  'History',
  'Geography',
  'Culture',
  'Cinema',
  'Literature',
  'Sports',
  'General Knowledge',
  'Mixed Challenges'
];

const BANK_PHASE_NUMBER = 11;
const CATEGORY_BANK_MIN_SIZE = 50;
const CATEGORY_SELECTION_SIZE = 10;
const CATEGORY_SELECTION_MEDIUM_COUNT = 6;
const CATEGORY_SELECTION_HARD_COUNT = 4;

const BANK_DATA = {
  Technology: [
    'Quel protocole protege une session HTTPS moderne contre l ecoute passive ?|TLS|Medium',
    'Quel principe evite qu une panne unique coupe tout un service ?|Redondance|Medium',
    'Quelle technique garde une copie proche des utilisateurs pour accelerer les pages ?|CDN|Medium',
    'Quel format structure souvent les donnees d une API REST ?|JSON|Medium',
    'Quel modele separe interface, logique et donnees dans une application ?|MVC|Medium',
    'Quel mecanisme reduit la charge en reutilisant des resultats deja calcules ?|Cache|Medium',
    'Quelle mesure exprime le temps entre requete et reponse ?|Latence|Medium',
    'Quel concept ajoute des machines plutot que grossir une seule machine ?|Scalabilite horizontale|Medium',
    'Quel protocole synchronise l heure entre machines ?|NTP|Medium',
    'Quel type de journal aide a diagnostiquer un incident de production ?|Logs|Medium',
    'Quel compromis CAP sacrifie parfois la coherence pendant une partition reseau ?|Disponibilite|Hard',
    'Quel modele garantit idempotence pour relancer une operation sans doublon ?|Idempotence|Hard',
    'Quel processus automatise test, build et deploiement apres chaque changement ?|CI/CD|Hard',
    'Quel pattern isole les pannes en arretant les appels vers un service instable ?|Circuit breaker|Hard',
    'Quelle strategie publie une nouvelle version a un petit pourcentage d utilisateurs ?|Canary release|Hard',
    'Quel indicateur SRE mesure le temps moyen de retablissement apres incident ?|MTTR|Hard',
    'Quel stockage garde les donnees sous forme cle objet plutot qu en fichiers locaux ?|Object storage|Medium',
    'Quel type de test verifie plusieurs services ensemble ?|Test integration|Medium',
    'Quel concept limite le nombre de requetes acceptees par client ?|Rate limiting|Medium',
    'Quel environnement reproduit la production avant la mise en ligne ?|Staging|Medium'
  ],
  Programming: [
    'Quelle notation decrit un algorithme dont le temps grandit lineairement avec n ?|O(n)|Medium',
    'Quel concept permet a une fonction de garder acces a son scope parent ?|Closure|Medium',
    'Quel principe conseille qu une fonction fasse une seule chose claire ?|Responsabilite unique|Medium',
    'Quel type d erreur apparait pendant l execution plutot qu a la compilation ?|Runtime error|Medium',
    'Quel fichier verrouille les versions exactes des dependances npm ?|package-lock.json|Medium',
    'Quel test verifie une petite unite de code isolee ?|Test unitaire|Medium',
    'Quelle structure traite les elements en premier entre, premier sorti ?|File|Medium',
    'Quel mot designe une fonction appelee plus tard par une autre fonction ?|Callback|Medium',
    'Quelle commande Git fusionne une branche dans la branche courante ?|git merge|Medium',
    'Quel principe evite de repeter la meme logique dans plusieurs endroits ?|DRY|Medium',
    'Quel bug arrive quand deux operations concurrentes changent le meme etat ?|Race condition|Hard',
    'Quel pattern cree des objets sans exposer leur construction exacte ?|Factory|Hard',
    'Quel mecanisme attend une operation asynchrone en JavaScript moderne ?|await|Medium',
    'Quel algorithme de tri a souvent une complexite moyenne O n log n ?|Quicksort|Hard',
    'Quelle technique remplace une fonction recursive par une boucle pour eviter la pile ?|Iteration|Medium',
    'Quel principe rend un module facile a remplacer par une abstraction ?|Inversion dependance|Hard',
    'Quel type immuable evite les modifications cachees d etat ?|Immutable|Medium',
    'Quelle analyse detecte des erreurs sans executer le programme ?|Analyse statique|Medium',
    'Quel terme designe une valeur passee a une fonction ?|Argument|Medium',
    'Quel test verifie un comportement attendu de bout en bout ?|Test end to end|Hard'
  ],
  'Web Development': [
    'Quel en-tete HTTP controle les permissions cross-origin ?|CORS|Medium',
    'Quel code HTTP indique que la ressource existe mais l acces est refuse ?|403|Medium',
    'Quel rendu genere le HTML sur le serveur avant l envoi au navigateur ?|SSR|Medium',
    'Quelle API navigateur stocke durablement des paires cle valeur ?|localStorage|Medium',
    'Quel attribut rend une image comprehensible aux lecteurs d ecran ?|alt|Medium',
    'Quel code HTTP signifie creation reussie d une ressource ?|201|Medium',
    'Quel protocole pousse des mises a jour temps reel sur une connexion persistante ?|WebSocket|Medium',
    'Quelle technique charge une image seulement quand elle devient utile ?|Lazy loading|Medium',
    'Quel fichier de config indique aux moteurs les pages a explorer ?|robots.txt|Medium',
    'Quelle politique protege contre certaines injections de scripts ?|CSP|Medium',
    'Quel risque apparait si une entree utilisateur devient du HTML executable ?|XSS|Hard',
    'Quelle attaque force un utilisateur connecte a envoyer une requete non voulue ?|CSRF|Hard',
    'Quel concept garde le meme resultat quand on repete une requete PUT ?|Idempotence|Hard',
    'Quel outil mesure performance, accessibilite et SEO dans Chrome ?|Lighthouse|Medium',
    'Quelle strategie envoie le JS critique avant le reste du bundle ?|Code splitting|Hard',
    'Quel stockage navigateur est envoye automatiquement avec chaque requete domaine ?|Cookie|Medium',
    'Quel cache HTTP oblige le navigateur a revalider avant reutilisation ?|no-cache|Hard',
    'Quel statut HTTP redirige temporairement une ressource ?|302|Medium',
    'Quel format de donnees concurrent de REST permet au client de choisir les champs ?|GraphQL|Medium',
    'Quel mode React detecte des effets de bord en developpement ?|StrictMode|Hard'
  ],
  Databases: [
    'Quelle cle identifie chaque ligne de maniere unique dans une table ?|Cle primaire|Medium',
    'Quelle operation combine les lignes de deux tables liees ?|JOIN|Medium',
    'Quelle propriete ACID garantit tout ou rien dans une transaction ?|Atomicite|Medium',
    'Quel index accelere une recherche mais peut ralentir les ecritures ?|Index|Medium',
    'Quelle commande SQL filtre les lignes retournees ?|WHERE|Medium',
    'Quel modele stocke les donnees en documents flexibles proches du JSON ?|NoSQL document|Medium',
    'Quelle relation utilise une table de liaison entre deux entites ?|Many to many|Medium',
    'Quelle anomalie est reduite par la normalisation ?|Duplication|Medium',
    'Quelle clause groupe les resultats avant une aggregation ?|GROUP BY|Medium',
    'Quel niveau evite les lectures sales dans une transaction ?|Read committed|Medium',
    'Quel plan montre comment la base execute une requete ?|Plan execution|Hard',
    'Quelle strategie divise une table tres grande en morceaux logiques ?|Partitionnement|Hard',
    'Quel mecanisme recopie les donnees sur un autre noeud ?|Replication|Medium',
    'Quelle incoherence apparait si une cle etrangere pointe vers rien ?|Reference orpheline|Hard',
    'Quel verrou empeche deux transactions de modifier la meme ligne en meme temps ?|Row lock|Hard',
    'Quel index convient souvent aux recherches plein texte ?|Full text index|Hard',
    'Quelle commande annule une transaction non validee ?|ROLLBACK|Medium',
    'Quel outil Prisma applique les changements de schema en base ?|Migration|Medium',
    'Quelle contrainte garantit l unicite d une colonne ?|UNIQUE|Medium',
    'Quel risque apparait quand une requete concatene directement une entree utilisateur ?|Injection SQL|Hard'
  ],
  Networking: [
    'Quel protocole traduit un nom de domaine en adresse IP ?|DNS|Medium',
    'Quel protocole attribue automatiquement une adresse IP sur un reseau ?|DHCP|Medium',
    'Quelle couche OSI gere le routage IP entre reseaux ?|Reseau|Medium',
    'Quel protocole transporte HTTP de facon fiable ?|TCP|Medium',
    'Quel outil montre les sauts vers une destination ?|traceroute|Medium',
    'Quel port est generalement associe a HTTPS ?|443|Medium',
    'Quel equipement relie plusieurs reseaux differents ?|Routeur|Medium',
    'Quel protocole evite les boucles dans un reseau commute ?|STP|Medium',
    'Quel mecanisme transforme une adresse privee en adresse publique ?|NAT|Medium',
    'Quel protocole envoie des paquets sans garantir livraison ni ordre ?|UDP|Medium',
    'Quel champ IPv4 diminue a chaque routeur traverse ?|TTL|Hard',
    'Quel protocole annonce les routes entre systemes autonomes Internet ?|BGP|Hard',
    'Quelle technique separe logiquement des reseaux sur les memes switchs ?|VLAN|Medium',
    'Quel message ICMP est utilise par ping ?|Echo request|Medium',
    'Quel probleme survient quand deux machines utilisent la meme adresse IP ?|Conflit IP|Medium',
    'Quel service distribue le trafic entre plusieurs serveurs ?|Load balancer|Medium',
    'Quelle mesure exprime la quantite de donnees par seconde ?|Debit|Medium',
    'Quel tunnel chiffre souvent une connexion reseau distante ?|VPN|Medium',
    'Quel protocole securise l administration distante en ligne de commande ?|SSH|Medium',
    'Quel type de table associe adresses IP et interfaces de sortie ?|Table routage|Hard'
  ],
  Cybersecurity: [
    'Quel principe donne a un compte seulement les droits strictement necessaires ?|Moindre privilege|Medium',
    'Quelle attaque trompe l utilisateur avec un faux message credible ?|Phishing|Medium',
    'Quel mecanisme transforme un mot de passe en empreinte non reversible ?|Hash|Medium',
    'Quel controle verifie qui est l utilisateur avant l acces ?|Authentification|Medium',
    'Quel second facteur utilise un code temporaire limite dans le temps ?|OTP|Medium',
    'Quelle politique force plusieurs moyens de preuve pour se connecter ?|MFA|Medium',
    'Quel journal aide a reconstruire une action suspecte ?|Audit log|Medium',
    'Quel test cherche activement des failles dans un systeme ?|Pentest|Medium',
    'Quel chiffrement utilise une meme cle pour chiffrer et dechiffrer ?|Symetrique|Medium',
    'Quel terme designe une faille encore inconnue publiquement ?|Zero day|Medium',
    'Quel risque apparait si un secret est commit dans Git ?|Fuite de secret|Hard',
    'Quelle attaque essaie de deviner un mot de passe par essais massifs ?|Brute force|Medium',
    'Quel en-tete aide a bloquer certains scripts injectes ?|CSP|Hard',
    'Quel modele ne fait jamais confiance automatiquement au reseau interne ?|Zero trust|Hard',
    'Quel systeme detecte des comportements suspects sur un reseau ?|IDS|Hard',
    'Quelle technique ajoute une valeur aleatoire avant le hash du mot de passe ?|Salage|Hard',
    'Quel protocole protege mieux les emails contre l usurpation de domaine ?|DMARC|Hard',
    'Quel principe garde les sauvegardes hors ligne contre un rancongiciel ?|Air gap|Hard',
    'Quelle attaque surcharge un service pour le rendre indisponible ?|DDoS|Medium',
    'Quel scan liste les ports ouverts d une machine ?|Scan de ports|Medium'
  ],
  'Artificial Intelligence': [
    'Quel apprentissage utilise des donnees deja etiquetees ?|Supervise|Medium',
    'Quel probleme apparait quand un modele memorise trop les exemples ?|Surapprentissage|Medium',
    'Quel score combine precision et rappel dans une seule mesure ?|F1-score|Medium',
    'Quel terme designe l instruction envoyee a un grand modele de langue ?|Prompt|Medium',
    'Quelle matrice compare classes predites et vraies classes ?|Matrice confusion|Medium',
    'Quel ensemble sert a choisir des hyperparametres sans toucher au test final ?|Validation|Medium',
    'Quel concept ajuste le pas de mise a jour des poids ?|Learning rate|Medium',
    'Quelle technique coupe aleatoirement des neurones pendant l entrainement ?|Dropout|Medium',
    'Quel type de modele predit la prochaine unite de texte ?|Modele langage|Medium',
    'Quelle mesure observe les erreurs d un modele pendant l apprentissage ?|Loss|Medium',
    'Quel phenomene produit une reponse plausible mais fausse chez un LLM ?|Hallucination|Hard',
    'Quelle methode ajoute des documents externes au contexte d un LLM ?|RAG|Hard',
    'Quel mecanisme des transformers pese les mots importants entre eux ?|Attention|Hard',
    'Quelle technique reduit un modele pour accelerer l inference ?|Quantization|Hard',
    'Quel apprentissage utilise recompenses et actions ?|Renforcement|Hard',
    'Quel risque mesure un modele excellent sur train mais faible en generalisation ?|Overfitting|Medium',
    'Quelle methode adapte un modele pre-entraine a une tache precise ?|Fine tuning|Hard',
    'Quel biais vient de donnees d entrainement non representatives ?|Biais donnees|Hard',
    'Quel parametre controle souvent la creativite d un LLM ?|Temperature|Medium',
    'Quel processus transforme du texte en unites numeriques pour le modele ?|Tokenisation|Medium'
  ],
  Science: [
    'Quel organite produit la majorite de l energie utilisable par une cellule ?|Mitochondrie|Medium',
    'Quel gaz est majoritaire dans l atmosphere terrestre ?|Azote|Medium',
    'Un pH inferieur a 7 indique quel type de solution ?|Acide|Medium',
    'Quelle force ramene un satellite vers la Terre ?|Gravite|Medium',
    'Quel type d onde transporte la lumiere visible ?|Electromagnetique|Medium',
    'Quel changement d etat passe directement du solide au gaz ?|Sublimation|Medium',
    'Quel organe filtre le sang et produit l urine ?|Rein|Medium',
    'Quelle particule porte une charge electrique negative ?|Electron|Medium',
    'Quelle loi relie force, masse et acceleration ?|Deuxieme loi Newton|Medium',
    'Quel processus permet aux plantes de produire du glucose avec la lumiere ?|Photosynthese|Medium',
    'Quelle molecule porte l information genetique hereditaire ?|ADN|Medium',
    'Quel principe dit que l energie totale se conserve dans un systeme isole ?|Conservation energie|Hard',
    'Quelle grandeur mesure la desorganisation microscopique d un systeme ?|Entropie|Hard',
    'Quel isotope du carbone sert a dater des restes organiques ?|Carbone 14|Hard',
    'Quelle liaison resulte d un partage d electrons entre atomes ?|Covalente|Medium',
    'Quel effet decrit le decalage de frequence d une source en mouvement ?|Doppler|Hard',
    'Quel type de roche se forme par refroidissement du magma ?|Magmatique|Medium',
    'Quelle hormone regule fortement la glycemie ?|Insuline|Medium',
    'Quel phenomene explique la montee de liquide dans un tube fin ?|Capillarite|Hard',
    'Quelle unite mesure la quantite de matiere ?|Mole|Medium'
  ],
  Mathematics: [
    'Dans une proportion, combien vaut 18 pour cent de 250 ?|45|Medium',
    'Quelle est la racine carree de 196 ?|14|Medium',
    'Combien vaut 2 puissance 10 ?|1024|Medium',
    'Quel est le perimetre d un rectangle 8 par 13 ?|42|Medium',
    'Quelle valeur de x verifie 3x + 7 = 31 ?|8|Medium',
    'Combien vaut la mediane de 4, 9, 12, 20, 31 ?|12|Medium',
    'Quel angle reste si deux angles d un triangle valent 35 et 65 degres ?|80|Medium',
    'Quelle fraction simplifie 18 sur 24 ?|3/4|Medium',
    'Quel est le plus grand diviseur commun de 48 et 60 ?|12|Medium',
    'Combien de combinaisons pour choisir 2 objets parmi 5 ?|10|Medium',
    'Quelle formule donne l aire d un disque de rayon r ?|pi r carre|Hard',
    'Quelle derivee a la fonction x carre ?|2x|Medium',
    'Quel logarithme vaut 3 si la base est 10 et le nombre 1000 ?|log10 1000|Hard',
    'Quelle suite ajoute les deux termes precedents pour obtenir le suivant ?|Fibonacci|Medium',
    'Quel theoreme relie les cotes d un triangle rectangle ?|Pythagore|Medium',
    'Quelle probablite d obtenir deux piles de suite avec une piece equilibree ?|1/4|Medium',
    'Quelle matrice ne change pas un vecteur apres multiplication ?|Identite|Hard',
    'Quel nombre premier suit 29 ?|31|Medium',
    'Quel terme designe une fonction dont la derivee est positive partout ?|Croissante|Hard',
    'Quel volume a un cube de cote 5 ?|125|Medium'
  ],
  Logic: [
    'Si A implique B et A est vrai, que peut-on conclure ?|B est vrai|Medium',
    'Quel operateur est vrai quand exactement une condition est vraie ?|XOR|Medium',
    'Dans la suite 3, 6, 12, 24, quel nombre suit ?|48|Medium',
    'Si tous les A sont B et aucun B n est C, que sait-on des A et C ?|Aucun A est C|Medium',
    'Quel raisonnement part de cas particuliers pour proposer une regle ?|Induction|Medium',
    'Quel raisonnement applique une regle generale a un cas precis ?|Deduction|Medium',
    'Si une assertion est vraie et sa negation aussi, quel probleme logique apparait ?|Contradiction|Medium',
    'Quel diagramme montre les relations entre ensembles ?|Venn|Medium',
    'Quel mot designe une conclusion qui ne suit pas les premises ?|Non sequitur|Medium',
    'Si une porte ment toujours et une dit vrai, quelle strategie aide ?|Question croisee|Hard',
    'Quelle erreur confond correlation et causalite ?|Fausse causalite|Hard',
    'Quel principe choisit l explication la plus simple compatible ?|Rasoir Occam|Hard',
    'Quel paradoxe parle d un menteur disant je mens ?|Paradoxe du menteur|Hard',
    'Dans une implication, comment appelle-t-on B dans A implique B ?|Consequent|Hard',
    'Quelle table liste toutes les valeurs possibles d une expression logique ?|Table verite|Medium',
    'Quel raisonnement prouve une affirmation en montrant que son contraire est impossible ?|Contradiction|Hard',
    'Quel quantificateur signifie au moins un ?|Existential|Medium',
    'Quel quantificateur signifie pour tous les cas ?|Universel|Medium',
    'Quel biais privilegie les informations confirmant une idee ?|Confirmation|Medium',
    'Quel type de probleme demande d optimiser sous contraintes ?|Programmation lineaire|Hard'
  ],
  History: [
    'Quel traite met officiellement fin a la Premiere Guerre mondiale avec l Allemagne ?|Versailles|Medium',
    'En quelle annee tombe le mur de Berlin ?|1989|Medium',
    'Quel empire avait Constantinople pour capitale ?|Byzantin|Medium',
    'Quelle revolution commence en France en 1789 ?|Revolution francaise|Medium',
    'Quel navigateur est associe a l expedition du premier tour du monde ?|Magellan|Medium',
    'Quelle periode europeenne relance fortement arts et sciences apres le Moyen Age ?|Renaissance|Medium',
    'Quel conflit oppose Nord et Sud aux Etats-Unis au XIXe siecle ?|Guerre de Secession|Medium',
    'Quel empire construit un vaste reseau de routes autour de Rome ?|Empire romain|Medium',
    'Quelle civilisation antique utilise des hieroglyphes sur le Nil ?|Egypte ancienne|Medium',
    'Quel document anglais de 1215 limite le pouvoir royal ?|Magna Carta|Medium',
    'Quelle conference de 1884 organise le partage colonial de l Afrique ?|Berlin|Hard',
    'Quel plan americain aide la reconstruction europeenne apres 1945 ?|Plan Marshall|Medium',
    'Quelle crise de 1962 rapproche Etats-Unis et URSS d un conflit nucleaire ?|Crise Cuba|Hard',
    'Quel empire chute en 1453 avec la prise de Constantinople ?|Byzantin|Medium',
    'Quel mouvement revendique les droits civiques afro-americains dans les annees 1960 ?|Civil Rights|Medium',
    'Quelle route commerciale reliait Chine, Asie centrale et Europe ?|Route de la soie|Medium',
    'Quel accord cree une communaute europeenne du charbon et de l acier ?|Traite Paris|Hard',
    'Quel evenement de 1929 declenche une crise economique mondiale ?|Krach boursier|Medium',
    'Quel dirigeant indien associe independance et non-violence ?|Gandhi|Medium',
    'Quel systeme politique sud-africain separait legalement les populations ?|Apartheid|Medium'
  ],
  Geography: [
    'Quel fleuve traverse l Egypte et nourrit son delta ?|Nil|Medium',
    'Quelle chaine separe la France et l Espagne ?|Pyrenees|Medium',
    'Quel desert couvre une grande partie de l Afrique du Nord ?|Sahara|Medium',
    'Quelle capitale europeenne est traversee par le Danube ?|Budapest|Medium',
    'Quel pays a Jakarta pour capitale ?|Indonesie|Medium',
    'Quel ocean borde la cote ouest de l Amerique du Sud ?|Pacifique|Medium',
    'Quelle ligne imaginaire separe hemispheres nord et sud ?|Equateur|Medium',
    'Quel pays possede la Patagonie avec le Chili ?|Argentine|Medium',
    'Quel detroit separe l Espagne du Maroc ?|Gibraltar|Medium',
    'Quelle mer borde l Italie a l est ?|Adriatique|Medium',
    'Quel plateau africain est souvent associe aux hauts reliefs d Ethiopie ?|Plateau ethiopien|Hard',
    'Quel canal relie la mer Rouge a la Mediterranee ?|Suez|Medium',
    'Quel pays enclavé se trouve entre Inde et Chine dans l Himalaya ?|Nepal|Medium',
    'Quelle region canadienne francophone a Quebec pour grande ville ?|Quebec|Medium',
    'Quel fleuve forme une partie de la frontiere entre Etats-Unis et Mexique ?|Rio Grande|Medium',
    'Quel archipel volcanique appartient a l Equateur dans le Pacifique ?|Galapagos|Medium',
    'Quel phenomene deplacement de population ville campagne inverse s appelle ?|Rurbanisation|Hard',
    'Quel climat a une saison seche et une saison humide marquees ?|Tropical|Medium',
    'Quelle projection cartographique deforme fortement les poles ?|Mercator|Hard',
    'Quel pays africain a Addis-Abeba pour capitale ?|Ethiopie|Medium'
  ],
  Economics: [
    'Quel indicateur mesure la hausse generale des prix ?|Inflation|Medium',
    'Quel acteur fixe souvent les taux directeurs d une economie ?|Banque centrale|Medium',
    'Quel terme designe une baisse durable de l activite economique ?|Recession|Medium',
    'Quel marche permet d acheter et vendre des actions ?|Bourse|Medium',
    'Quel indicateur additionne la valeur produite dans un pays ?|PIB|Medium',
    'Quel concept mesure la sensibilite de la demande au prix ?|Elasticite|Medium',
    'Quel cout ne depend pas directement du volume produit ?|Cout fixe|Medium',
    'Quel phenomene combine inflation elevee et croissance faible ?|Stagflation|Hard',
    'Quel solde compare exportations et importations de biens ?|Balance commerciale|Medium',
    'Quel instrument public augmente la depense ou baisse les impots ?|Politique budgetaire|Medium',
    'Quelle politique augmente les taux pour freiner la demande ?|Politique restrictive|Hard',
    'Quel taux retire l inflation du taux nominal ?|Taux reel|Hard',
    'Quel risque augmente quand une seule entreprise domine un marche ?|Monopole|Medium',
    'Quel indicateur suit les personnes sans emploi cherchant un travail ?|Chomage|Medium',
    'Quel concept designe le cout de l option abandonnee ?|Cout opportunite|Medium',
    'Quel bien voit sa demande augmenter quand le revenu baisse ?|Bien inferieur|Hard',
    'Quel effet explique une hausse de consommation quand le prix baisse ?|Effet revenu|Hard',
    'Quel deficit concerne les recettes et depenses de l Etat ?|Deficit public|Medium',
    'Quel ratio compare dette publique et richesse produite ?|Dette PIB|Medium',
    'Quel marche concerne l echange des monnaies ?|Forex|Medium'
  ],
  Business: [
    'Quel document resume strategie, marche, revenus et couts d une entreprise ?|Business plan|Medium',
    'Quel indicateur mesure le cout d acquisition d un client ?|CAC|Medium',
    'Quel indicateur mesure la valeur totale estimee d un client ?|LTV|Medium',
    'Quel terme designe la perte de clients sur une periode ?|Churn|Medium',
    'Quelle marge reste apres couts directs de production ?|Marge brute|Medium',
    'Quel outil compare forces, faiblesses, opportunites et menaces ?|SWOT|Medium',
    'Quel document visualise proposition de valeur et segments clients ?|Business model canvas|Medium',
    'Quel indicateur suit le revenu mensuel recurrent ?|MRR|Medium',
    'Quel prix couvre exactement les couts sans profit ?|Seuil rentabilite|Medium',
    'Quel type de cout varie avec le volume vendu ?|Cout variable|Medium',
    'Quel risque survient quand CAC depasse durablement LTV ?|Croissance non rentable|Hard',
    'Quel indicateur SaaS mesure le revenu annuel recurrent ?|ARR|Medium',
    'Quel terme decrit une vente additionnelle vers une offre superieure ?|Upsell|Medium',
    'Quel processus convertit prospects en clients etapes par etapes ?|Funnel|Medium',
    'Quelle strategie fixe un prix bas pour entrer vite sur un marche ?|Penetration|Hard',
    'Quel avantage difficile a copier protege une entreprise ?|Moat|Hard',
    'Quel tableau suit revenus, couts et resultat ?|Compte resultat|Medium',
    'Quel flux mesure l argent qui entre et sort réellement ?|Cash flow|Medium',
    'Quelle analyse determine les clients les plus rentables ?|Segmentation|Medium',
    'Quel contrat garantit un niveau de service attendu ?|SLA|Hard'
  ],
  Startups: [
    'Quel produit minimal teste rapidement une hypothese marche ?|MVP|Medium',
    'Quel terme designe l adequation forte entre produit et marche ?|Product-market fit|Medium',
    'Quel changement majeur de strategie sans abandonner la vision s appelle ?|Pivot|Medium',
    'Quel entretien sert a comprendre le probleme reel du client ?|Customer discovery|Medium',
    'Quel groupe adopte un produit avant le marche principal ?|Early adopters|Medium',
    'Quel revenu mensuel recurrent suit une startup SaaS ?|MRR|Medium',
    'Quel indicateur montre combien de temps reste avant manquer de cash ?|Runway|Medium',
    'Quelle vitesse de depense mensuelle de cash s appelle ?|Burn rate|Medium',
    'Quel financement echange capital contre parts de l entreprise ?|Equity|Medium',
    'Quel document court presente startup, marche et equipe aux investisseurs ?|Pitch deck|Medium',
    'Quel piege consiste a construire beaucoup avant validation client ?|Overbuilding|Hard',
    'Quelle experience teste une offre avant le produit complet ?|Landing test|Hard',
    'Quel financement vient des premiers utilisateurs sans investisseurs ?|Bootstrapping|Medium',
    'Quel indicateur mesure la croissance composee sur plusieurs periodes ?|CAGR|Hard',
    'Quel accord donne droit a des parts futures apres investissement ?|SAFE|Hard',
    'Quel ratio observe revenu gagne par rapport au cash depense ?|Burn multiple|Hard',
    'Quel objectif chiffré guide une equipe sur un cycle court ?|OKR|Medium',
    'Quel canal amene des clients sans paiement publicitaire direct ?|Organique|Medium',
    'Quel test compare deux versions d une page ou offre ?|A/B test|Medium',
    'Quel moment arrive quand la startup depasse ses premiers processus manuels ?|Scale-up|Medium'
  ],
  Engineering: [
    'Quelle grandeur mesure une force appliquee par unite de surface ?|Pression|Medium',
    'Quelle unite mesure la resistance electrique ?|Ohm|Medium',
    'Quel diagramme represente toutes les forces sur un objet ?|Corps libre|Medium',
    'Quel materiau reprend souvent la traction dans le beton arme ?|Acier|Medium',
    'Quel rendement compare energie utile et energie fournie ?|Efficacite|Medium',
    'Quelle contrainte resulte d une force qui etire une piece ?|Traction|Medium',
    'Quel composant transforme une rotation en tension electrique ?|Alternateur|Medium',
    'Quelle loi relie tension, courant et resistance ?|Loi Ohm|Medium',
    'Quel capteur mesure une temperature ?|Thermocouple|Medium',
    'Quel coefficient compare charge limite et charge de service ?|Facteur securite|Medium',
    'Quel phenomene endommage une piece sous charges repetees ?|Fatigue|Hard',
    'Quelle analyse etudie les contraintes par maillage numerique ?|Elements finis|Hard',
    'Quel mode de transfert thermique se fait par mouvement de fluide ?|Convection|Medium',
    'Quelle instabilite fait plier une colonne comprimee ?|Flambage|Hard',
    'Quel outil mesure une forme avec grande precision en atelier ?|Pied a coulisse|Medium',
    'Quelle grandeur mesure le moment d une force autour d un axe ?|Couple|Medium',
    'Quel principe conserve le debit dans un ecoulement incompressible ?|Continuite|Hard',
    'Quel type de plan precise dimensions et tolerances d une piece ?|Plan technique|Medium',
    'Quel moteur transforme energie thermique en travail mecanique ?|Moteur thermique|Medium',
    'Quelle courbe montre deformation en fonction de contrainte ?|Courbe traction|Hard'
  ],
  Culture: [
    'Quel auteur francais a ecrit Les Miserables ?|Victor Hugo|Medium',
    'Quel mouvement artistique est associe a Claude Monet ?|Impressionnisme|Medium',
    'Quel compositeur a ecrit La Flute enchantee ?|Mozart|Medium',
    'Dans quel pays est ne le tango ?|Argentine|Medium',
    'Quel musee parisien abrite La Joconde ?|Louvre|Medium',
    'Quel auteur a cree le personnage de Sherlock Holmes ?|Arthur Conan Doyle|Medium',
    'Quel peintre est associe a Guernica ?|Picasso|Medium',
    'Quel courant litteraire cherche a decrire la realite sociale avec precision ?|Realisme|Medium',
    'Quel instrument est central dans un concerto pour piano ?|Piano|Medium',
    'Quel style musical nait a La Nouvelle-Orleans au debut du XXe siecle ?|Jazz|Medium',
    'Quel prix recompense chaque annee une oeuvre litteraire francophone majeure ?|Goncourt|Hard',
    'Quel mouvement artistique rejette la logique apres la Premiere Guerre mondiale ?|Dadaisme|Hard',
    'Quel auteur algerien a ecrit L Etranger ?|Albert Camus|Medium',
    'Quel art japonais consiste a plier le papier ?|Origami|Medium',
    'Quelle langue ancienne est a la base de nombreuses langues romanes ?|Latin|Medium',
    'Quel architecte est associe a la Sagrada Familia ?|Gaudi|Medium',
    'Quel genre raconte souvent des evenements imaginaires futurs ou technologiques ?|Science fiction|Medium',
    'Quel peintre neerlandais est celebre pour La Nuit etoilee ?|Van Gogh|Medium',
    'Quel terme designe un ensemble de musiciens dirige par un chef ?|Orchestre|Medium',
    'Quel mouvement pictural decompose les formes en volumes geometriques ?|Cubisme|Hard'
  ],
  Cinema: [
    'Quel realisateur est associe au film Inception ?|Christopher Nolan|Medium',
    'Quel plan montre un visage de tres pres ?|Gros plan|Medium',
    'Quelle recompense majeure est decernee au festival de Cannes ?|Palme d Or|Medium',
    'Quel genre combine enquete, crime et ambiance sombre ?|Film noir|Medium',
    'Quel metier assemble les plans pour construire le rythme final ?|Monteur|Medium',
    'Quel document decrit scenes et dialogues d un film ?|Scenario|Medium',
    'Quel effet fait passer progressivement une image vers une autre ?|Fondu|Medium',
    'Quel mouvement de camera tourne horizontalement depuis un point fixe ?|Panoramique|Medium',
    'Quel film de 1997 met en scene le naufrage d un paquebot celebre ?|Titanic|Medium',
    'Quel genre utilise souvent tension, menace et suspense psychologique ?|Thriller|Medium',
    'Quel principe montre l effet Koulechov par association de plans ?|Montage|Hard',
    'Quel format sonore place des sons autour du spectateur ?|Surround|Medium',
    'Quel realisateur japonais est associe aux Sept Samourais ?|Kurosawa|Hard',
    'Quel prix recompense le meilleur film aux Oscars ?|Best Picture|Medium',
    'Quel terme designe un plan sans coupure visible sur une longue action ?|Plan sequence|Hard',
    'Quel departement gere costumes, decors et ambiance visuelle ?|Direction artistique|Medium',
    'Quel objectif narratif lance l histoire principale d un film ?|Incident declencheur|Hard',
    'Quel film utilise un requin comme menace centrale en 1975 ?|Les Dents de la mer|Medium',
    'Quel type d animation photographie des objets image par image ?|Stop motion|Medium',
    'Quel raccord maintient la continuite spatiale entre deux plans ?|Raccord regard|Hard'
  ],
  Sports: [
    'Au football, combien de joueurs une equipe aligne-t-elle au depart ?|11|Medium',
    'Quel sport utilise un scrum et un essai ?|Rugby|Medium',
    'Quel terme designe un score nul au tennis ?|Love|Medium',
    'Quel pays a accueilli les Jeux olympiques d ete 2016 ?|Bresil|Medium',
    'Quel sport utilise un lancer franc et un panier a trois points ?|Basketball|Medium',
    'Quel tournoi cycliste se termine traditionnellement a Paris ?|Tour de France|Medium',
    'Quel sport se joue sur glace avec un palet ?|Hockey|Medium',
    'Quel art martial japonais signifie voie de la souplesse ?|Judo|Medium',
    'Quel poste au football garde le but ?|Gardien|Medium',
    'Quel evenement combine natation, cyclisme et course ?|Triathlon|Medium',
    'Quel systeme departage souvent des equipes egalite par difference buts ?|Goal average|Hard',
    'Quel temps de course correspond a 42,195 km ?|Marathon|Medium',
    'Quel sport utilise une epee, un fleuret ou un sabre ?|Escrime|Medium',
    'Quel tournoi de tennis se joue sur gazon a Londres ?|Wimbledon|Medium',
    'Quel terme NBA designe points, rebonds et passes a deux chiffres ?|Triple double|Hard',
    'Quel sport a une position appelee quarterback ?|Football americain|Medium',
    'Quel drapeau indique la fin d une course automobile ?|Drapeau damier|Medium',
    'Quel style de nage est souvent le plus rapide en competition libre ?|Crawl|Medium',
    'Quel sport oppose deux equipes avec un filet et un ballon frappe a la main ?|Volleyball|Medium',
    'Quel concept tactique consiste a presser haut l adversaire ?|Pressing|Hard'
  ],
  'General Knowledge': [
    'Quel pays abrite le site historique du Machu Picchu ?|Perou|Medium',
    'Quelle mer separe la Grande-Bretagne du nord de l Europe continentale ?|Mer du Nord|Medium',
    'Quel canal relie Atlantique et Pacifique en Amerique centrale ?|Panama|Medium',
    'Quel pays a la plus grande population depuis 2023 ?|Inde|Medium',
    'Quelle organisation mondiale a son siege principal a New York ?|ONU|Medium',
    'Quel metal liquide a temperature ambiante est utilise dans anciens thermometres ?|Mercure|Medium',
    'Quel continent contient le plus grand nombre de pays ?|Afrique|Medium',
    'Quel instrument mesure la pression atmospherique ?|Barometre|Medium',
    'Quelle langue officielle est commune au Maroc, Algerie et Tunisie ?|Arabe|Medium',
    'Quel pays est associe au mont Fuji ?|Japon|Medium',
    'Quel calendrier utilise une annee bissextile tous les quatre ans sauf exceptions ?|Gregorien|Hard',
    'Quel organisme publie souvent des normes internationales comme ISO 9001 ?|ISO|Medium',
    'Quelle ville a donne son nom au prix Nobel de la paix ceremonie ?|Oslo|Hard',
    'Quel phenomene astronomique cache temporairement le Soleil par la Lune ?|Eclipse solaire|Medium',
    'Quel alphabet est utilise notamment en russe ?|Cyrillique|Medium',
    'Quel detroit relie mer Noire et Mediterranee via Istanbul ?|Bosphore|Hard',
    'Quel document permet de voyager officiellement entre pays ?|Passeport|Medium',
    'Quelle unite mesure la frequence ?|Hertz|Medium',
    'Quel organisme gere souvent les noms de domaine au niveau mondial ?|ICANN|Hard',
    'Quel pays est le plus grand du monde par superficie ?|Russie|Medium'
  ],
  'Mixed Challenges': [
    'Quel protocole securise le plus souvent une connexion web moderne ?|TLS|Medium',
    'Quelle propriete ACID garantit qu une transaction est tout ou rien ?|Atomicite|Medium',
    'Quel indicateur economique mesure la hausse generale des prix ?|Inflation|Medium',
    'Quel algorithme de recherche divise un espace trie en deux a chaque etape ?|Recherche binaire|Medium',
    'Quel biais pousse a retenir surtout les preuves qui confirment notre idee ?|Confirmation|Medium',
    'Quel port est generalement associe a HTTPS ?|443|Medium',
    'Quel produit minimal teste une hypothese startup ?|MVP|Medium',
    'Quel organite produit la majorite de l energie cellulaire ?|Mitochondrie|Medium',
    'Quel concept cloud execute du code sans gerer de serveur ?|Serverless|Medium',
    'Quelle clause SQL groupe les lignes avant aggregation ?|GROUP BY|Medium',
    'Quel phenomene IA produit une reponse plausible mais fausse ?|Hallucination|Hard',
    'Quel pattern protege un service instable en coupant temporairement les appels ?|Circuit breaker|Hard',
    'Quelle attaque web force une action depuis une session deja connectee ?|CSRF|Hard',
    'Quel modele securite ne fait jamais confiance automatiquement au reseau interne ?|Zero trust|Hard',
    'Quel indicateur SRE mesure le temps moyen de retablissement ?|MTTR|Hard',
    'Quel protocole annonce des routes entre grands reseaux Internet ?|BGP|Hard',
    'Quel test verifie un parcours complet comme un utilisateur ?|Test end to end|Medium',
    'Quel terme designe la perte de clients dans un service abonne ?|Churn|Medium',
    'Quel mouvement artistique decompose les formes en volumes geometriques ?|Cubisme|Hard',
    'Quel processus transforme du texte en unites numeriques pour un modele IA ?|Tokenisation|Medium'
  ]
};

function normalizeCategory(category) {
  return PHASE1_CATEGORIES.includes(category) ? category : 'Mixed Challenges';
}

function getCategoryBankRoundNumber(category) {
  const index = PHASE1_CATEGORIES.indexOf(normalizeCategory(category));
  return index >= 0 ? index + 1 : PHASE1_CATEGORIES.length;
}

function localBankFilePath(category) {
  const slug = normalizeCategory(category).toLowerCase().replace(/[^a-z0-9]+/g, '-');
  return path.join(LOCAL_BANK_DIR, `${slug}.json`);
}

function readLocalCategoryBank(category) {
  const filePath = localBankFilePath(category);
  if (!fs.existsSync(filePath)) return [];

  try {
    const payload = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const rows = Array.isArray(payload.questions) ? payload.questions : payload;
    return rows.map((question, index) => ({
      id: question.id || `local-bank-${index + 1}`,
      question: question.question || question.text,
      text: question.question || question.text,
      answer: question.answer || question.correctAnswer,
      correctAnswer: question.answer || question.correctAnswer,
      category: normalizeCategory(category),
      difficulty: question.difficulty || 'Medium',
      timeLimit: question.timeLimit || 20,
      points: question.points || 10,
      type: 'MCQ',
      choices: buildChoices(
        question.answer || question.correctAnswer,
        category,
        index,
        question.choices || question.options || []
      ),
      options: buildChoices(
        question.answer || question.correctAnswer,
        category,
        index,
        question.choices || question.options || []
      )
    }));
  } catch (error) {
    console.warn(`Local category bank unreadable (${category}):`, error.message);
    return [];
  }
}

function writeLocalCategoryBank(category, questions, source = 'ollama_phi3') {
  fs.mkdirSync(LOCAL_BANK_DIR, { recursive: true });
  fs.writeFileSync(localBankFilePath(category), JSON.stringify({
    category: normalizeCategory(category),
    source,
    count: questions.length,
    updatedAt: new Date().toISOString(),
    questions
  }, null, 2));
}

function normalizeBankKey(question) {
  return `${String(question.question || question.text || '').trim().toLowerCase()}::${String(question.answer || question.correctAnswer || '').trim().toLowerCase()}`;
}

function categoryAnswerPool(category) {
  const normalized = normalizeCategory(category);
  const lines = BANK_DATA[normalized] || BANK_DATA['Mixed Challenges'];
  return lines
    .map(line => String(line).split('|')[1])
    .filter(Boolean)
    .map(answer => answer.trim());
}

function buildChoices(answer, category, index = 0, existingChoices = []) {
  const cleanAnswer = String(answer || '').trim();
  const provided = Array.isArray(existingChoices)
    ? existingChoices.map(choice => String(choice || '').trim()).filter(Boolean)
    : [];
  const pool = [
    ...provided,
    ...categoryAnswerPool(category),
    ...categoryAnswerPool('Mixed Challenges')
  ].filter(choice => choice && choice.toLowerCase() !== cleanAnswer.toLowerCase());
  const unique = [];
  const seen = new Set([cleanAnswer.toLowerCase()]);

  for (let offset = 0; offset < pool.length && unique.length < 3; offset += 1) {
    const choice = pool[(index + offset) % pool.length];
    const key = choice.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(choice);
  }

  while (unique.length < 3) {
    unique.push(`Option ${unique.length + 1}`);
  }

  const insertAt = index % 4;
  const choices = [...unique];
  choices.splice(insertAt, 0, cleanAnswer);
  return choices.slice(0, 4);
}

function parseLine(line, index, category) {
  const [question, answer, difficulty] = String(line).split('|');
  const cleanAnswer = answer.trim();
  return {
    id: `phase1-bank-${category.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${index + 1}`,
    text: question.trim(),
    question: question.trim(),
    category,
    type: 'MCQ',
    options: buildChoices(cleanAnswer, category, index),
    choices: buildChoices(cleanAnswer, category, index),
    answer: cleanAnswer,
    correctAnswer: cleanAnswer,
    difficulty: difficulty === 'Hard' ? 'Hard' : 'Medium',
    points: 10,
    timeLimit: 20
  };
}

function buildCategoryBank(category) {
  const normalized = normalizeCategory(category);
  const lines = BANK_DATA[normalized] || BANK_DATA['Mixed Challenges'];
  const bank = lines.map((line, index) => parseLine(line, index, normalized));

  if (bank.length !== 20) {
    throw new Error(`Phase 1 category bank must contain 20 questions: ${normalized}`);
  }

  if (bank.some(question => !question.text || !question.correctAnswer)) {
    throw new Error(`Phase 1 category bank contains an invalid question: ${normalized}`);
  }

  return bank;
}

function getSelectionSlice(bank, count = CATEGORY_SELECTION_SIZE) {
  const medium = bank.filter(question => question.difficulty === 'Medium');
  const hard = bank.filter(question => question.difficulty === 'Hard');
  const selected = [
    ...medium.slice(0, Math.min(CATEGORY_SELECTION_MEDIUM_COUNT, count)),
    ...hard.slice(0, Math.max(0, Math.min(CATEGORY_SELECTION_HARD_COUNT, count - CATEGORY_SELECTION_MEDIUM_COUNT)))
  ];
  const remaining = bank.filter(question => !selected.includes(question));

  while (selected.length < count && remaining.length > 0) {
    selected.push(remaining.shift());
  }

  return selected.slice(0, count);
}

function shuffleBank(bank) {
  const list = [...bank];
  for (let i = list.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}

function buildPhase1RoundQuestions(roundNumber = 1, category = 'Mixed Challenges', shuffle = false) {
  const normalized = normalizeCategory(category);
  let bank = buildCategoryBank(normalized);

  if (shuffle) {
    bank = shuffleBank(bank);
  }

  const offset = ((Number(roundNumber) || 1) - 1) * CATEGORY_SELECTION_SIZE;
  const rotated = shuffle
    ? bank
    : Array.from({ length: bank.length }, (_, index) => bank[(offset + index) % bank.length]);
  const selected = getSelectionSlice(rotated, CATEGORY_SELECTION_SIZE);

  return selected.map((question, index) => ({
    ...question,
    id: `phase1-r${roundNumber}-${normalized.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-q${index + 1}`,
    roundNumber: Number(roundNumber) || 1
  }));
}

async function readStoredCategoryBank(prisma, category) {
  const normalized = normalizeCategory(category);
  const localBank = readLocalCategoryBank(normalized);
  if (localBank.length > 0) {
    return localBank;
  }

  if (!prisma?.roundQuestion) return [];
  let rows = [];
  try {
    rows = await prisma.roundQuestion.findMany({
      where: {
        phaseNumber: BANK_PHASE_NUMBER,
        roundNumber: getCategoryBankRoundNumber(normalized),
        category: normalized
      },
      orderBy: { questionIndex: 'asc' }
    });
  } catch {
    return [];
  }

  return rows.map(row => ({
    id: row.id,
    question: row.question,
    text: row.question,
    answer: row.answer,
    correctAnswer: row.answer,
    category: row.category,
    difficulty: row.difficulty,
    timeLimit: row.timeLimit,
    points: row.points,
    type: 'MCQ',
    choices: buildChoices(row.answer, row.category, row.questionIndex, Array.isArray(row.choices) ? row.choices : []),
    options: buildChoices(row.answer, row.category, row.questionIndex, Array.isArray(row.choices) ? row.choices : [])
  }));
}

async function saveStoredCategoryBank(prisma, category, questions, source = 'ollama_phi3') {
  const normalized = normalizeCategory(category);
  writeLocalCategoryBank(normalized, questions, source);

  if (!prisma?.roundQuestion) return questions;
  const roundNumber = getCategoryBankRoundNumber(normalized);

  try {
    await prisma.$transaction(async (tx) => {
      await tx.roundQuestion.deleteMany({
        where: {
          phaseNumber: BANK_PHASE_NUMBER,
          roundNumber,
          category: normalized
        }
      });

      for (let index = 0; index < questions.length; index += 1) {
        const question = questions[index];
        await tx.roundQuestion.create({
          data: {
            phaseNumber: BANK_PHASE_NUMBER,
            roundNumber,
            questionIndex: index,
            question: question.question || question.text,
            type: 'MCQ',
            category: normalized,
            difficulty: question.difficulty || 'Medium',
            timeLimit: question.timeLimit || 20,
            points: question.points || 10,
            answer: question.answer || question.correctAnswer || '',
            choices: buildChoices(question.answer || question.correctAnswer || '', normalized, index, question.choices || question.options || []),
            payload: question,
            source: 'phase1_category_bank'
          }
        });
      }
    });
  } catch {
    return questions;
  }

  return questions;
}

async function clearStoredCategoryBank(prisma, category) {
  const normalized = normalizeCategory(category);
  const filePath = localBankFilePath(normalized);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }

  if (!prisma?.roundQuestion) return;

  try {
    await prisma.roundQuestion.deleteMany({
      where: {
        phaseNumber: BANK_PHASE_NUMBER,
        roundNumber: getCategoryBankRoundNumber(normalized),
        category: normalized
      }
    });
  } catch {
    // ignore
  }
}

async function generateCategoryBank(prisma, category, targetCount = CATEGORY_BANK_MIN_SIZE, force = false) {
  const normalized = normalizeCategory(category);
  const targetBankSize = Math.max(targetCount, CATEGORY_BANK_MIN_SIZE);

  if (force) {
    await clearStoredCategoryBank(prisma, normalized);
  }

  const existing = force ? [] : await readStoredCategoryBank(prisma, normalized);
  const bank = [];
  const seen = new Set();

  for (const question of existing) {
    const key = normalizeBankKey(question);
    if (seen.has(key)) continue;
    seen.add(key);
    bank.push(question);
  }

  if (bank.length < targetBankSize) {
    const ollamaStatus = await getOllamaStatus();
    if (ollamaStatus.ready && ollamaStatus.modelAvailable) {
      console.log(`Generating ${targetBankSize} questions for ${normalized} via Ollama (${OLLAMA_MODEL_LABEL()})...`);
      const generated = await generateCategoryBankBatch({
        prisma,
        category: normalized,
        targetCount: targetBankSize
      });

      for (const question of generated.questions || []) {
        const normalizedQuestion = {
          question: question.question || question.text,
          text: question.question || question.text,
          answer: question.answer || question.correctAnswer,
          correctAnswer: question.answer || question.correctAnswer,
          category: normalized,
          difficulty: question.difficulty || 'Medium',
          timeLimit: question.timeLimit || 20,
          points: question.points || 10,
          type: 'MCQ',
          choices: buildChoices(
            question.answer || question.correctAnswer,
            normalized,
            bank.length,
            question.choices || question.options || []
          )
        };
        normalizedQuestion.options = normalizedQuestion.choices;
        const key = normalizeBankKey(normalizedQuestion);
        if (seen.has(key)) continue;
        seen.add(key);
        bank.push(normalizedQuestion);
      }

      if (bank.length >= 20) {
        const uniqueBank = bank.slice(0, targetBankSize);
        await saveStoredCategoryBank(prisma, normalized, uniqueBank, generated.source || 'ollama_phi3');
        return uniqueBank;
      }
    } else {
      console.warn('Ollama unavailable for category bank:', ollamaStatus.error || 'not ready');
    }
  }

  for (const question of buildCategoryBank(normalized)) {
    const key = normalizeBankKey(question);
    if (seen.has(key)) continue;
    seen.add(key);
    bank.push(question);
  }

  let generationRound = bank.length + 1;
  let attempts = 0;
  while (bank.length < targetBankSize && attempts < 20) {
    attempts += 1;
    try {
      const generated = await generateRoundQuestions({
        prisma,
        roundNumber: generationRound,
        category: normalized,
        force: true
      });

      for (const question of generated.questions || []) {
        const normalizedQuestion = {
          question: question.question || question.text,
          text: question.question || question.text,
          answer: question.answer || question.correctAnswer,
          correctAnswer: question.answer || question.correctAnswer,
          category: normalized,
          difficulty: question.difficulty || 'Medium',
          timeLimit: question.timeLimit || 20,
          points: question.points || 10,
          type: 'MCQ',
          choices: buildChoices(
            question.answer || question.correctAnswer,
            normalized,
            bank.length,
            question.choices || question.options || []
          )
        };
        normalizedQuestion.options = normalizedQuestion.choices;
        const key = normalizeBankKey(normalizedQuestion);
        if (seen.has(key)) continue;
        seen.add(key);
        bank.push(normalizedQuestion);
      }
      generationRound += 1;
    } catch (error) {
      console.warn('Category bank refill attempt failed:', error.message);
      break;
    }
  }

  const uniqueBank = bank.slice(0, targetBankSize);
  await saveStoredCategoryBank(prisma, normalized, uniqueBank, 'local_competition_bank');
  return uniqueBank;
}

function OLLAMA_MODEL_LABEL() {
  return process.env.OLLAMA_MODEL || 'phi3:latest';
}

async function getCategoryBank(prisma, category, targetCount = CATEGORY_BANK_MIN_SIZE) {
  const normalized = normalizeCategory(category);
  const stored = await readStoredCategoryBank(prisma, normalized);
  if (stored.length >= targetCount) {
    return stored;
  }

  const bank = [];
  const seen = new Set();
  for (const question of [...stored, ...buildCategoryBank(normalized)]) {
    const key = normalizeBankKey(question);
    if (seen.has(key)) continue;
    seen.add(key);
    bank.push(question);
  }
  return bank;
}

async function buildFreshCategorySelection(prisma, category, count = CATEGORY_SELECTION_SIZE, excludeKeys = []) {
  const bank = await getCategoryBank(prisma, category, CATEGORY_BANK_MIN_SIZE);
  const excludeSet = new Set(Array.isArray(excludeKeys) ? excludeKeys : []);
  let available = bank.filter((question) => !excludeSet.has(normalizeBankKey(question)));

  if (available.length < count) {
    available = shuffleBank(bank.filter((question) => !excludeSet.has(normalizeBankKey(question))));
  }

  if (available.length < count) {
    available = shuffleBank(bank);
  } else {
    available = shuffleBank(available);
  }

  const selected = getSelectionSlice(available, count);

  return selected.map((question, index) => ({
    ...question,
    id: question.id || `phase1-fresh-${normalizeCategory(category).toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Date.now()}-${index + 1}`,
    roundNumber: 1
  }));
}

async function buildCategorySelection(prisma, category, count = CATEGORY_SELECTION_SIZE, shuffle = false, roundNumber = 1) {
  const bank = await getCategoryBank(prisma, category, CATEGORY_BANK_MIN_SIZE);
  let pool;

  if (shuffle) {
    pool = shuffleBank(bank);
  } else {
    const offset = ((Number(roundNumber) || 1) - 1) * count;
    pool = bank.length > 0
      ? Array.from({ length: bank.length }, (_, index) => bank[(offset + index) % bank.length])
      : bank;
  }

  const selected = getSelectionSlice(pool, count);

  return selected.map((question, index) => ({
    ...question,
    id: question.id || `phase1-bank-${normalizeCategory(category).toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${index + 1}`,
    roundNumber: 1
  }));
}

function buildAllPhase1CategoryBanks() {
  return Object.fromEntries(PHASE1_CATEGORIES.map(category => [category, buildCategoryBank(category)]));
}

module.exports = {
  PHASE1_CATEGORIES,
  buildCategoryBank,
  buildPhase1RoundQuestions,
  buildCategorySelection,
  buildFreshCategorySelection,
  generateCategoryBank,
  getCategoryBank,
  buildAllPhase1CategoryBanks,
  normalizeCategory,
  normalizeBankKey,
  saveStoredCategoryBank,
  readStoredCategoryBank,
  readLocalCategoryBank,
  clearStoredCategoryBank
};
