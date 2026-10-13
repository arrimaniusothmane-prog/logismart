import { Link } from 'react-router-dom';
import { Button, Card, EmptyState } from '../components/ui';

export function NotFoundPage() {
  return (
    <div className="flex min-h-[70vh] items-center justify-center p-6">
      <Card className="max-w-md text-center">
        <EmptyState
          title="404 — Page introuvable"
          description="Cette adresse ne correspond à aucune page de LogiSmart. Elle a peut-être été renommée ou n'existe pas encore."
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <Link to="/dashboard">
                <Button>Retour au tableau de bord</Button>
              </Link>
              <Link to="/login">
                <Button variant="secondary">Se connecter</Button>
              </Link>
            </div>
          }
        />
      </Card>
    </div>
  );
}
