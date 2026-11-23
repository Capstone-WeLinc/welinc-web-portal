import { useCallback, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { Users } from 'lucide-react';
import type { AdminMe } from '@/lib/admin';
import { cn } from '@/lib/utils';
import { PeopleListPane } from './PeopleListPane';
import { PersonPane } from './PersonPane';

/**
 * Suite spec 0017, AC-1 (board `People8`): `/admin/people` is one page, the list pane beside the
 * whole person. Picking a row replaces the address with `/admin/people/:id` (keeping `?system`,
 * `?q` and `?sort`), so Back leaves People instead of stepping through people. Below 1024px the
 * list and the person are separate screens (the person pane has a back link).
 */
export function PeoplePage({ me }: { me: AdminMe }) {
  const { id } = useParams();
  const { search } = useLocation();
  const navigate = useNavigate();
  const selected = id && id !== 'new' ? id : undefined;
  // Bumped after an action on the person, so the list loads again once (AC-18)
  const [listVersion, setListVersion] = useState(0);

  const select = useCallback(
    (next: string) => navigate(`/admin/people/${next}${search}`, { replace: true }),
    [navigate, search],
  );

  return (
    <div className="lg:flex lg:h-below-bar">
      <div className={cn('lg:w-90 lg:shrink-0 lg:border-r lg:border-border', selected && 'max-lg:hidden')}>
        <PeopleListPane me={me} selectedId={selected} reloadKey={listVersion} onSelect={select} />
      </div>
      <div className={cn('min-w-0 flex-1 lg:overflow-y-auto', !selected && 'max-lg:hidden')}>
        {selected ? (
          <PersonPane key={selected} me={me} id={selected} onListChanged={() => setListVersion((n) => n + 1)} />
        ) : (
          <NoneSelected />
        )}
      </div>
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
