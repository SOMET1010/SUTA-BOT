# Assets de marque ANSUT

⚠️ **Logo officiel ANSUT manquant.** Aucun fichier de logo ANSUT (l'icône
et le sigle de l'agence, visibles en haut à gauche de la maquette de
référence) n'est présent dans ce dépôt à ce jour. Il n'a pas été fourni
par l'équipe ANSUT.

`components/layout/SutaHeader.tsx` affiche donc un **placeholder
clairement identifié** (pas une recréation approximative du logo) en
attendant le fichier officiel — voir cahier des charges section 7 et la
consigne UI : « Ne jamais recréer approximativement le logo ANSUT avec du
texte. Si le logo officiel n'est pas disponible, créer un placeholder
clairement identifié et documenter l'asset manquant. »

## Pour intégrer le vrai logo

1. Déposer le fichier officiel ici, par exemple :
   `logo-ansut.svg` (format vectoriel recommandé) ou `logo-ansut.png`
   (haute résolution, fond transparent).
2. Mettre à jour `components/layout/SutaHeader.tsx` pour utiliser
   `next/image` avec ce fichier, en retirant le composant placeholder.

Le wordmark « ANSUT CONNECTE » affiché à droite du header n'est **pas**
concerné par cette limitation : il s'agit du nom du produit lui-même
(texte), pas d'un logo graphique à reproduire.
