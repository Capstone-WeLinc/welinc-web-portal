import { useCallback, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { Users } from 'lucide-react';
import type { AdminMe } from '@/lib/admin';
import { cn } from '@/lib/utils';
import { useSystemsCatalog } from '../useCatalogs';
import { AddPersonDialog, type AddStart } from './AddPersonDialog';
import { PeopleListPane } from './PeopleListPane';
import { parseListSystem, personSystems } from './peopleRules';
import { PersonPane } from './PersonPane';
import { pageTitle, SUITE_MANAGEMENT, useDocumentTitle } from '@/lib/title';

/** The address without `/new` or a person, keeping `?system`, `?q` and `?sort`. */
function listHref(search: string): string {
  return `/admin/people${search}`;
}

/**
 * Suite spec 0017, AC-1, AC-14 (board `People8`): `/admin/people` is one page, the list pane beside
 * the whole person. Picking a row replaces the address with `/admin/people/:id` (keeping
 * `?system`, `?q` and `?sort`), so Back leaves People instead of stepping through people.
 * `/admin/people/new` opens the Add person dialog over the list. Below 1024px the list and the
 * person are separate screens (the person pane has a back link).
 */
export function PeoplePage({ me, onMeChanged }: { me: AdminMe; onMeChanged: () => void }) {
  const { id } = useParams();
  const { search } = useLocation();
  const navigate = useNavigate();
  const catalog = useSystemsCatalog();
  const adding = id === 'new';
  const selected = id && !adding ? id : undefined;
  // Suite spec 0019, AC-28: the open person names the tab themselves (`PersonPane`)
  useDocumentTitle(selected ? null : pageTitle('People', SUITE_MANAGEMENT));
  // Bumped after an action on the person, so the list loads again once (AC-18)
  const [listVersion, setListVersion] = useState(0);
  // Bumped when the dialog changed the open person, so the pane reads them again
  const [personVersion, setPersonVersion] = useState(0);
  // Give access opens the dialog on step 2 for the selected person (AC-14)
  const [giving, setGiving] = useState<AddStart>(null);

  const select = useCallback(
    (next: string) => navigate(`/admin/people/${next}${search}`, { replace: true }),
    [navigate, search],
  );
  const listChanged = useCallback(() => setListVersion((n) => n + 1), []);

  const start: AddStart = adding
    ? { system: parseListSystem(me, new URLSearchParams(search).get('system')) ?? undefined }
    : giving;

  const closeDialog = () => {
    if (adding) navigate(listHref(search), { replace: true });
    setGiving(null);
  };

  return (
    <div className="lg:flex lg:h-below-bar">
      <div className={cn('lg:w-90 lg:shrink-0 lg:border-r lg:border-border', selected && 'max-lg:hidden')}>
        <PeopleListPane
          me={me}
          selectedId={selected}
          reloadKey={listVersion}
          onSelect={select}
          onAdd={(system) => setGiving({ system: system ?? undefined })}
        />
      </div>
      <div className={cn('min-w-0 flex-1 lg:overflow-y-auto lg:overscroll-contain', !selected && 'max-lg:hidden')}>
        {selected ? (
          <PersonPane
            key={selected}
            me={me}
            id={selected}
            reloadKey={personVersion}
            onListChanged={listChanged}
            onMeChanged={onMeChanged}
            onGiveAccess={(person, system) =>
              setGiving({
                who: { kind: 'existing', id: person.id, name: person.name, email: person.email, systems: personSystems(person) },
                system,
              })
            }
          />
        ) : (
          <NoneSelected />
        )}
      </div>
      <AddPersonDialog
        start={start}
        me={me}
        catalog={catalog}
        onClose={closeDialog}
        onAdded={(personId) => {
          setGiving(null);
          listChanged();
          if (personId === selected) setPersonVersion((n) => n + 1);
          else navigate(`/admin/people/${personId}${search}`, { replace: true });
        }}
      />
    </div>
  );
}

function NoneSelected() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 p-10 text-center">
      <span className="flex size-10 items-center justify-center rounded-lg bg-muted text-muted-strong">
        <Users className="size-5" aria-hidden="true" />
      </span>
      <p className="text-body text-muted-strong">Pick someone from the list to see their access.</p>
    </div>
  );
}
