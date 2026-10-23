import { useEffect, useMemo } from 'react';
import { WEAPON_IDS } from '@calculo-royale/shared/constants';
import { Character } from './character/Character.js';

// Personaje quieto (selector de skins y galería): el mismo Character que en la partida
export default function SoldierModel({ skin, color, vest = 0, weapon = 'rifle', ...props }) {
  const character = useMemo(() => new Character({ skin, color, vest }), []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => character.setSkin(skin), [character, skin]);
  useEffect(() => character.setColor(color), [character, color]);
  useEffect(() => character.setVest(vest), [character, vest]);
  useEffect(() => {
    character.setWeapon(WEAPON_IDS.indexOf(weapon));
    character.holdStill();
  }, [character, weapon]);
  useEffect(() => () => character.dispose(), [character]);
  return <primitive object={character.visualRoot} {...props} />;
}
