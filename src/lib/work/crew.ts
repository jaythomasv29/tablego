import type { WorkCrewMember } from './model';
// Owner-supplied Work roster. Kept in the server dependency tree; editable in Work settings.
export function starterWorkCrew(): WorkCrewMember[] {
  const groups = [
    ['both', ['James V.', 'Tom V.']],
    ['front', ['Miguel S.', 'Nutthee D.', 'Wilder P.', 'Aijan U.', 'Maya A.', 'Liya D.', 'Oumsub G.', 'Carlos P.']],
    ['kitchen', ['Chatphinya K.', 'Yuvarin D.', 'Nam D.', 'Manuel P.', 'Sulma P.', 'Hong Hanh T.', 'Nancy T.', 'Pornphimol T.', 'Crestel P.', 'Ruddy D.', 'Santoz M.', 'Cesar F.', 'Eugenio R.']],
  ] as const;
  return groups.flatMap(([role, names]) => names.map(name => ({ id: `work-${role}-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`, name, role })));
}
