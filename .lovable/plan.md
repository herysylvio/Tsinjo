

Le bandeau hors-ligne actuel (`OfflineBanner.tsx`) prend toute la largeur mais le texte se met sur 4 lignes sur mobile (visible sur le screenshot : ~120px de hauteur côté gauche). Il faut le rendre compact sur une seule ligne avec un bouton de fermeture.

## Changements proposés

**Fichier : `src/components/OfflineBanner.tsx`**

1. **Texte plus court** : "Mode hors ligne — synchronisation auto" (au lieu de la phrase longue)
2. **Une seule ligne** : `whitespace-nowrap overflow-hidden text-ellipsis` + texte raccourci
3. **Bouton X** : icône `X` de lucide-react à droite, qui masque le bandeau localement via un state `dismissed`
4. **Réapparition** : le state `dismissed` se réinitialise à `false` quand on repasse online puis offline (sinon l'utilisateur ne le verra plus jamais)
5. **Padding réduit** : `py-1` au lieu de `py-1.5`, taille de texte conservée

## Logique du dismiss

```ts
const [dismissed, setDismissed] = useState(false);
useEffect(() => {
  if (isOnline) setDismissed(false); // reset quand on récupère le réseau
}, [isOnline]);
const visible = !isOnline && !dismissed;
```

## Résultat attendu

Bandeau fin (≈28px) en haut, sur une ligne :
`📶 Mode hors ligne — sync auto                          [X]`

Pas de changement ailleurs. Le bandeau reste positionné où il est déjà monté (probablement dans `AppLayout`).

