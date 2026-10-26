import type { CountryId, Outcome } from '../types';

export interface EventOption {
  label: string;
  /** Base success chance (0..1) before crew / module / trait bonuses. */
  chance: number;
  success: Outcome;
  fail?: Outcome;
}

export interface EventDef {
  id: string;
  country: CountryId | 'any';
  title: string;
  text: string;
  emoji: string;
  kind: 'bonus' | 'malus' | 'choice';
  weight: number;
  /** Only rolled on "Mystère" destinations. */
  rare?: boolean;
  outcome?: Outcome;
  options?: EventOption[];
}

const DAMAGE: Outcome = { text: "L'avion doit passer au garage avant de repartir.", damage: true };

export const EVENTS: EventDef[] = [
  // --- Generic -------------------------------------------------------------
  {
    id: 'g_turbulence', country: 'any', title: 'Turbulences', emoji: '🌪️', kind: 'malus', weight: 2,
    text: 'Le retour a sérieusement secoué.',
    outcome: { text: 'Quelques plateaux-repas ont volé : −20 % de recettes.', coinsMult: -0.2 },
  },
  {
    id: 'g_bird', country: 'any', title: 'Collision avec un oiseau', emoji: '🐦', kind: 'malus', weight: 1,
    text: 'Un pigeon têtu a percuté le moteur.', outcome: DAMAGE,
  },
  {
    id: 'g_tip', country: 'any', title: 'Passager généreux', emoji: '💸', kind: 'bonus', weight: 2,
    text: "Un passager discret a adoré le service.",
    outcome: { text: 'Gros pourboire : +30 % de recettes.', coinsMult: 0.3 },
  },
  {
    id: 'g_bag', country: 'any', title: 'Bagage mystérieux', emoji: '🧳', kind: 'choice', weight: 2,
    text: 'Un sac non réclamé tourne seul sur le tapis…',
    options: [
      { label: 'Le rapporter aux objets trouvés', chance: 1, success: { text: 'Son propriétaire, ravi, vous fait de la pub. +20 ⭐', rep: 20 } },
      {
        label: "L'ouvrir", chance: 0.5,
        success: { text: 'Des bons Miles oubliés ! +3 ✈️', miles: 3 },
        fail: { text: "C'était du linge sale… et une amende : −10 % de recettes.", coinsMult: -0.1 },
      },
    ],
  },
  {
    id: 'g_portal', country: 'any', title: 'Porte des étoiles', emoji: '🌌', kind: 'choice', weight: 3, rare: true,
    text: 'Un anneau lumineux flotte au milieu du ciel. Il bourdonne doucement.',
    options: [
      {
        label: 'Le traverser', chance: 0.5,
        success: { text: "Un raccourci cosmique ! +15 ✈️ et ressources ×3.", miles: 15, resourceMult: 2 },
        fail: { text: "L'avion ressort… à l'envers. Recettes −50 %.", coinsMult: -0.5, damage: true },
      },
      { label: 'Faire demi-tour', chance: 1, success: { text: 'Prudence récompensée : +50 % de ressources.', resourceMult: 0.5 } },
    ],
  },
  {
    id: 'g_treasure', country: 'any', title: 'Épave au trésor', emoji: '🏴‍☠️', kind: 'bonus', weight: 2, rare: true,
    text: "L'équipage a repéré une vieille épave d'avion pleine de valises dorées.",
    outcome: { text: 'Trésor ! Recettes ×2 et +10 ✈️.', coinsMult: 1, miles: 10 },
  },

  // --- Mélodia ---------------------------------------------------------------
  {
    id: 'm_concert', country: 'melodia', title: 'Concert improvisé', emoji: '🎺', kind: 'bonus', weight: 3,
    text: 'Une fanfare locale a joué dans la cabine pendant tout le retour.',
    outcome: { text: 'Les passagers ont adoré : +50 % de pourboires.', coinsMult: 0.5 },
  },
  {
    id: 'm_dj', country: 'melodia', title: 'Un DJ veut rentrer avec vous', emoji: '🎧', kind: 'choice', weight: 3,
    text: 'Il promet de "mettre l\'ambiance" dans votre aéroport.',
    options: [
      {
        label: "L'embarquer", chance: 0.6,
        success: { text: 'Il ouvre un Karaoké chez vous ! (ajouté au pool de magasins)', unlockShop: 'karaoke' },
        fail: { text: 'Il a mixé si fort que les passagers ont demandé un remboursement : −15 %.', coinsMult: -0.15 },
      },
      { label: 'Refuser poliment', chance: 1, success: { text: 'Il vous offre une démo dédicacée. +5 ⭐', rep: 5 } },
    ],
  },
  {
    id: 'm_detune', country: 'melodia', title: 'Moteur désaccordé', emoji: '🎼', kind: 'malus', weight: 2,
    text: 'Le réacteur joue faux, en si bémol.', outcome: DAMAGE,
  },
  {
    id: 'm_chorale', country: 'melodia', title: 'Concours de chant', emoji: '🎶', kind: 'choice', weight: 3,
    text: 'Les passagers lancent un concours de chant et défient votre équipage.',
    options: [
      {
        label: "Faire chanter l'équipage", chance: 0.5,
        success: { text: 'Standing ovation ! +100 % de Notes.', resourceMult: 1, crewXp: 15 },
        fail: { text: 'Quelle cacophonie… −10 % de recettes.', coinsMult: -0.1 },
      },
      { label: "Distribuer des bouchons d'oreille", chance: 1, success: { text: 'Vol calme et reposant.' } },
    ],
  },

  // --- Tropicalia --------------------------------------------------------------
  {
    id: 't_coco', country: 'tropicalia', title: 'Noix de coco sur la piste', emoji: '🥥', kind: 'malus', weight: 2,
    text: 'Un palmier a bombardé le train d’atterrissage.', outcome: DAMAGE,
  },
  {
    id: 't_surf', country: 'tropicalia', title: 'Vague parfaite', emoji: '🌊', kind: 'bonus', weight: 3,
    text: "L'équipage a pris une journée de surf avant de rentrer.",
    outcome: { text: 'Moral au top : +30 XP d’équipage et +50 % de coquillages.', crewXp: 30, resourceMult: 0.5 },
  },
  {
    id: 't_parrot', country: 'tropicalia', title: 'Perroquet clandestin', emoji: '🦜', kind: 'choice', weight: 3,
    text: 'Un perroquet bavard s’est caché dans la soute.',
    options: [
      {
        label: "L'adopter", chance: 0.6,
        success: { text: 'Il devient la mascotte du hall ! +15 ⭐', rep: 15 },
        fail: { text: 'Il a mangé tous les plateaux-repas : −15 %.', coinsMult: -0.15 },
      },
      { label: 'Le relâcher', chance: 1, success: { text: 'Il revient avec des coquillages en remerciement (+30 %).', resourceMult: 0.3 } },
    ],
  },
  {
    id: 't_cyclone', country: 'tropicalia', title: 'Cyclone en approche', emoji: '🌀', kind: 'choice', weight: 2,
    text: 'Un cyclone arrive sur la côte. Partir maintenant ou attendre ?',
    options: [
      {
        label: 'Décoller quand même', chance: 0.45,
        success: { text: 'Arrivée héroïque, les passagers paient le double ! +60 %', coinsMult: 0.6 },
        fail: DAMAGE,
      },
      { label: 'Attendre au bar de la plage', chance: 1, success: { text: 'Retard, mais équipage reposé. −10 %, +15 XP', coinsMult: -0.1, crewXp: 15 } },
    ],
  },

  // --- Gourmandie --------------------------------------------------------------
  {
    id: 'go_feast', country: 'gourmandie', title: 'Festin à bord', emoji: '🍗', kind: 'bonus', weight: 3,
    text: 'Le traiteur local a rempli les soutes de spécialités.',
    outcome: { text: 'Vente de paniers gourmands : +40 %.', coinsMult: 0.4 },
  },
  {
    id: 'go_indigestion', country: 'gourmandie', title: 'Indigestion générale', emoji: '🤢', kind: 'malus', weight: 2,
    text: 'Trop de crème au beurre pour tout le monde.',
    outcome: { text: 'Remboursements en série : −30 %.', coinsMult: -0.3 },
  },
  {
    id: 'go_chef', country: 'gourmandie', title: 'Un chef étoilé à bord', emoji: '👨‍🍳', kind: 'choice', weight: 3,
    text: 'Il propose de cuisiner pour tous les passagers.',
    options: [
      {
        label: 'Lui laisser la cuisine', chance: 0.6,
        success: { text: 'Un repas légendaire ! +5 ✈️ et +10 ⭐', miles: 5, rep: 10 },
        fail: { text: "Un soufflé a explosé dans l'office.", damage: true },
      },
      { label: 'Servir les sandwichs habituels', chance: 1, success: { text: 'Personne ne se plaint. Personne ne se souvient.' } },
    ],
  },
  {
    id: 'go_cheese', country: 'gourmandie', title: 'Fromage très affiné', emoji: '🧀', kind: 'choice', weight: 2,
    text: 'Un fromage confisqué embaume toute la soute.',
    options: [
      {
        label: 'Le garder', chance: 0.5,
        success: { text: 'Un fromager vous propose de s’installer ! (Fromagerie ajoutée au pool)', unlockShop: 'fromagerie' },
        fail: { text: "L'odeur a fait fuir les passagers : −20 %.", coinsMult: -0.2 },
      },
      { label: 'Le jeter par le hublot', chance: 1, success: { text: 'Un village entier vous maudit. Tant pis.' } },
    ],
  },

  // --- Bitopia ---------------------------------------------------------------
  {
    id: 'b_bug', country: 'bitopia', title: 'Bug de navigation', emoji: '🐛', kind: 'malus', weight: 2,
    text: "Le GPS affiche « Erreur 404 : ciel introuvable ».", outcome: DAMAGE,
  },
  {
    id: 'b_viral', country: 'bitopia', title: 'Vol devenu viral', emoji: '📈', kind: 'bonus', weight: 3,
    text: 'Une vidéo du vol fait 10 millions de vues.',
    outcome: { text: 'Votre aéroport est célèbre : +30 ⭐', rep: 30 },
  },
  {
    id: 'b_hack', country: 'bitopia', title: 'Hackeuse à bord', emoji: '👩‍💻', kind: 'choice', weight: 3,
    text: 'Elle propose « d’optimiser » vos systèmes de fidélité.',
    options: [
      {
        label: 'Accepter', chance: 0.5,
        success: { text: 'Un bug… de Miles ! +8 ✈️', miles: 8 },
        fail: { text: 'Virus dans le cockpit ! −20 %', coinsMult: -0.2, damage: true },
      },
      { label: 'Refuser', chance: 1, success: { text: 'Elle hausse les épaules et retourne à son code.' } },
    ],
  },
  {
    id: 'b_crypto', country: 'bitopia', title: 'Paiement en BitoCoins', emoji: '🪙', kind: 'choice', weight: 2,
    text: 'Les passagers veulent payer leurs billets en BitoCoins.',
    options: [
      {
        label: 'Accepter', chance: 0.4,
        success: { text: 'Le cours a explosé ! Recettes ×2.', coinsMult: 1 },
        fail: { text: 'Le cours s’est effondré… −50 %.', coinsMult: -0.5 },
      },
      { label: 'Exiger des pièces', chance: 1, success: { text: 'Quelques râleurs : −10 %.', coinsMult: -0.1 } },
    ],
  },

  // --- Givrebourg --------------------------------------------------------------
  {
    id: 'gi_frost', country: 'givrebourg', title: 'Givre sur les ailes', emoji: '🥶', kind: 'malus', weight: 2,
    text: 'Les ailes ressemblent à des sorbets.', outcome: DAMAGE,
  },
  {
    id: 'gi_aurora', country: 'givrebourg', title: 'Aurore boréale', emoji: '🌌', kind: 'bonus', weight: 3,
    text: 'Le ciel s’est illuminé pendant tout le vol.',
    outcome: { text: 'Photos magnifiques : +50 % et +10 ⭐', coinsMult: 0.5, rep: 10 },
  },
  {
    id: 'gi_penguins', country: 'givrebourg', title: 'Manchots voyageurs', emoji: '🐧', kind: 'choice', weight: 3,
    text: 'Une colonie de manchots veut absolument voyager.',
    options: [
      {
        label: 'Les embarquer', chance: 0.7,
        success: { text: 'Ils paient en cristaux ! +100 %', resourceMult: 1 },
        fail: { text: 'Ils ont vidé le stock de poisson : −20 %.', coinsMult: -0.2 },
      },
      { label: 'Refuser', chance: 1, success: { text: 'Ils vous regardent partir, déçus.' } },
    ],
  },
  {
    id: 'gi_yeti', country: 'givrebourg', title: 'Traces de yéti', emoji: '👣', kind: 'choice', weight: 2,
    text: 'Des empreintes géantes partent de la piste vers la montagne.',
    options: [
      {
        label: 'Suivre les traces', chance: 0.35,
        success: { text: 'Le yéti vous offre un cristal rare ! +12 ✈️', miles: 12 },
        fail: { text: "L'équipage revient gelé et bredouille : −20 %.", coinsMult: -0.2 },
      },
      { label: 'Rester au chaud', chance: 1, success: { text: 'Chocolat chaud pour tout le monde.' } },
    ],
  },

  // --- Désolande ---------------------------------------------------------------
  {
    id: 'd_sand', country: 'desolande', title: 'Tempête de sable', emoji: '🌫️', kind: 'malus', weight: 2,
    text: 'Le sable s’est infiltré partout. Partout.', outcome: DAMAGE,
  },
  {
    id: 'd_scrap', country: 'desolande', title: 'Trouvaille dans les dunes', emoji: '⚙️', kind: 'bonus', weight: 3,
    text: 'Une carcasse de robot géant gisait près de la piste.',
    outcome: { text: '+100 % de Ferraille.', resourceMult: 1 },
  },
  {
    id: 'd_raiders', country: 'desolande', title: 'Pillards à moto', emoji: '🏍️', kind: 'choice', weight: 3,
    text: 'Une bande vous barre la piste de décollage.',
    options: [
      {
        label: 'Négocier', chance: 0.5,
        success: { text: 'Ils deviennent des clients fidèles. −10 %, +15 ⭐', coinsMult: -0.1, rep: 15 },
        fail: { text: 'Ils prennent un « péage » : −40 %.', coinsMult: -0.4 },
      },
      {
        label: 'Foncer', chance: 0.6,
        success: { text: 'Décollage spectaculaire ! +40 XP d’équipage', crewXp: 40 },
        fail: DAMAGE,
      },
    ],
  },
  {
    id: 'd_oasis', country: 'desolande', title: 'Mirage ou oasis ?', emoji: '🏝️', kind: 'choice', weight: 2,
    text: 'Une oasis scintille à l’horizon.',
    options: [
      {
        label: 'Faire un détour', chance: 0.5,
        success: { text: 'Une vraie oasis ! +80 % de ressources et +4 ✈️', resourceMult: 0.8, miles: 4 },
        fail: { text: 'Un mirage… carburant gaspillé : −20 %.', coinsMult: -0.2 },
      },
      { label: 'Garder le cap', chance: 1, success: { text: 'Le désert reste le désert.' } },
    ],
  },

  // --- Nuagelande --------------------------------------------------------------
  {
    id: 'n_rainbow', country: 'nuagelande', title: 'Arc-en-ciel solide', emoji: '🌈', kind: 'bonus', weight: 3,
    text: "L'avion a glissé sur un arc-en-ciel pendant 200 km.",
    outcome: { text: 'Vol magique : +60 %.', coinsMult: 0.6 },
  },
  {
    id: 'n_fog', country: 'nuagelande', title: 'Brouillard de coton', emoji: '☁️', kind: 'malus', weight: 2,
    text: 'Impossible de voir le bout de l’aile.',
    outcome: { text: 'Gros retard : −25 %.', coinsMult: -0.25 },
  },
  {
    id: 'n_dream', country: 'nuagelande', title: 'Sommeil collectif', emoji: '😴', kind: 'choice', weight: 3,
    text: 'Tout le monde s’est endormi… même le pilote.',
    options: [
      { label: 'Réveiller tout le monde', chance: 1, success: { text: 'Café pour tous. +10 XP', crewXp: 10 } },
      {
        label: 'Laisser rêver', chance: 0.5,
        success: { text: 'Les rêves se condensent en vapeur : +120 % !', resourceMult: 1.2 },
        fail: { text: "L'avion a rêvé qu'il était un sous-marin.", damage: true },
      },
    ],
  },
  {
    id: 'n_angel', country: 'nuagelande', title: 'Ange en détresse', emoji: '👼', kind: 'choice', weight: 2,
    text: 'Un ange a perdu une aile et fait du stop.',
    options: [
      {
        label: "L'aider", chance: 0.7,
        success: { text: 'Bénédiction ! +10 ✈️ et +20 ⭐', miles: 10, rep: 20 },
        fail: { text: 'Il a mis des plumes partout : −10 %.', coinsMult: -0.1 },
      },
      { label: 'Continuer la route', chance: 1, success: { text: 'Il vous regarde partir avec un air triste.' } },
    ],
  },

  // --- Infernia ----------------------------------------------------------------
  {
    id: 'i_heat', country: 'infernia', title: 'Chaleur infernale', emoji: '🥵', kind: 'malus', weight: 2,
    text: 'Les pneus ont fondu sur la piste.', outcome: DAMAGE,
  },
  {
    id: 'i_lava', country: 'infernia', title: 'Surf sur la lave', emoji: '🌋', kind: 'bonus', weight: 3,
    text: "L'équipage a testé le sport local.",
    outcome: { text: '+100 % de Braises et +20 XP.', resourceMult: 1, crewXp: 20 },
  },
  {
    id: 'i_deal', country: 'infernia', title: 'Pacte diabolique', emoji: '📜', kind: 'choice', weight: 3,
    text: 'Un démon en costume trois-pièces propose un « petit contrat ».',
    options: [
      {
        label: 'Signer', chance: 0.5,
        success: { text: 'Le contrat était honnête (!). Recettes ×3.', coinsMult: 2 },
        fail: { text: 'Petites lignes… −60 % et avion endommagé.', coinsMult: -0.6, damage: true },
      },
      { label: 'Fuir', chance: 1, success: { text: 'Sage décision.' } },
    ],
  },
  {
    id: 'i_cerberus', country: 'infernia', title: 'Cerbère à la douane', emoji: '🐕', kind: 'choice', weight: 2,
    text: 'Le chien à trois têtes bloque le contrôle des passeports.',
    options: [
      {
        label: 'Lui lancer trois os', chance: 0.6,
        success: { text: 'Il remue ses trois queues. +25 ⭐', rep: 25 },
        fail: { text: 'Il a mangé les bagages : −30 %.', coinsMult: -0.3 },
      },
      {
        label: 'Le caresser', chance: 0.3,
        success: { text: 'Il vous adore ! +15 ✈️', miles: 15 },
        fail: DAMAGE,
      },
    ],
  },
];

export const EVENT_BY_ID = Object.fromEntries(EVENTS.map((e) => [e.id, e])) as Record<string, EventDef>;
