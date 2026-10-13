import { Link } from 'react-router-dom';
import { PortalShell } from '../shared/PortalShell';
import { PLink } from '../shared/primitives';
import { CloudShader } from '../../components/ui/cloud-shader';

const FEATURES = [
  {
    n: '01',
    title: 'Carte en direct',
    text: 'La position GPS de votre livreur se met à jour à chaque étape, sans rafraîchir la page.',
  },
  {
    n: '02',
    title: 'Notifications',
    text: 'Préparation, enroute, livraison : chaque changement de statut est horodaté dans votre espace.',
  },
  {
    n: '03',
    title: 'Assistant 24/7',
    text: 'Statut, délai, livreur, adresse : posez la question, l’assistant répond avec vos données réelles.',
  },
];

const STEPS = [
  { n: '01', title: 'Vous recevez un numéro', text: 'Au format LS-XXXX-XXXX-XX, transmis par votre transporteur.' },
  { n: '02', title: 'Vous activez votre suivi', text: 'E-mail de la commande + mot de passe : votre espace est créé.' },
  { n: '03', title: 'Vous suivez en direct', text: 'Carte, timeline, preuves de livraison — tout est centralisé.' },
];

const TRUST = [
  {
    title: 'Lien de suivi unique',
    text: 'Chaque commande possède son propre jeton opaque — impossible à deviner et révocable à tout moment.',
  },
  {
    title: 'Espace client dédié',
    text: 'Votre connexion est isolée de l’espace entreprise : personne d’autre n’accède à vos livraisons.',
  },
  {
    title: 'Aucun partage superflu',
    text: 'Vous ne voyez que vos commandes et les informations strictement nécessaires au suivi.',
  },
];

const FAQ = [
  {
    q: 'Comment activer mon suivi ?',
    a: 'Saisissez le numéro LS-XXXX-XXXX-XX de votre commande et l’e-mail associé, puis choisissez un mot de passe. Votre espace est créé immédiatement.',
  },
  {
    q: 'Où trouver mon numéro de commande ?',
    a: 'Votre transporteur vous le transmet par e-mail ou SMS. Il respecte le format LS-XXXX-XXXX-XX.',
  },
  {
    q: 'Plusieurs commandes, un seul compte ?',
    a: 'Oui : une fois votre espace activé, toutes les livraisons rattachées à cet e-mail apparaissent automatiquement dans votre tableau de bord.',
  },
  {
    q: 'Ai-je besoin d’installer une application ?',
    a: 'Non. Tout se passe dans votre navigateur : carte GPS en direct, notifications horodatées et assistant.',
  },
  {
    q: 'Que faire si un lien de suivi ne fonctionne plus ?',
    a: 'Un lien peut expirer ou être révoqué. Connectez-vous à votre espace client ou contactez votre transporteur pour en obtenir un nouveau.',
  },
];

export function ClientHomePage() {
  return (
    <PortalShell
      home="/client"
      links={[
        { to: '/client', label: 'Accueil', end: true },
        { to: '/client/register', label: 'Activer mon suivi' },
        { to: '/client/login', label: 'Connexion' },
      ]}
      actions={
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <Link to="/company" className="p-btn p-btn-ghost p-btn-sm">
            Espace entreprise
          </Link>
        </div>
      }
      footer={
        <div className="p-spread" style={{ flexWrap: 'wrap', gap: 16 }}>
          <span className="p-small">© LogiSmart — suivi de livraison pour les clients finaux</span>
          <span style={{ display: 'flex', gap: 18, flexWrap: 'wrap' }}>
            <Link to="/client/register" className="p-small p-link">
              Activer mon suivi
            </Link>
            <Link to="/client/login" className="p-small p-link">
              Connexion
            </Link>
          </span>
        </div>
      }
    >
      {/* Hero */}
      <section className="p-hero" style={{ position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, zIndex: 0, opacity: 0.85, pointerEvents: 'none' }}>
          <CloudShader
            speed={0.8}
            count={5}
            cloudColor="#f0f6fc"
            skyTopColor="#0f172a"
            skyBottomColor="#1e293b"
          />
        </div>
        <div className="p-container" style={{ position: 'relative', zIndex: 1 }}>
          <div className="p-hero-grid">
            <div className="p-stack p-fade-up" style={{ gap: 24 }}>
              <span className="p-eyebrow">Client portal</span>
              <h1 className="p-display">
                Suivez votre livraison.
                <br />
                <span className="p-grad">En temps réel.</span>
              </h1>
              <p className="p-lead">
                Votre colis se déplace, vous restez informé : carte GPS, notifications horodatées et assistant à
                votre écoute — sans app à installer.
              </p>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <PLink to="/client/register">Activer mon suivi</PLink>
                <PLink to="/client/login" variant="ghost">
                  J’ai déjà un compte
                </PLink>
              </div>
              <p className="p-small" style={{ opacity: 0.75 }}>
                Déjà un espace entreprise ?{' '}
                <Link to="/company" className="p-link" style={{ color: '#fff' }}>
                  Accéder au tableau de bord LogiSmart →
                </Link>
              </p>
            </div>

            <div className="p-hero-panel p-stack p-fade-up p-d2" style={{ gap: 18 }}>
              <div className="p-spread">
                <span className="p-eyebrow">Suivi</span>
                <span className="p-pill p-pill-accent" style={{ background: 'rgba(255,255,255,0.12)', color: '#fff' }}>
                  <span className="p-dot p-dot-live" />
                  En route
                </span>
              </div>

              <span className="p-mono" style={{ fontSize: 22, color: '#fff' }}>
                LS-CMLL-DEMO-01
              </span>

              <div className="p-track" style={{ marginTop: 4 }}>
                <div className="p-track-step is-done">Préparée</div>
                <div className="p-track-step is-done">Affectée</div>
                <div className="p-track-step is-done">Récupérée</div>
                <div className="p-track-step is-current">En route</div>
                <div className="p-track-step">Livrée</div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginTop: 6 }}>
                <div className="p-stack" style={{ gap: 4 }}>
                  <span className="p-eyebrow" style={{ color: '#9b9ea3' }}>
                    Livreur
                  </span>
                  <span style={{ color: '#fff', fontWeight: 700 }}>Nadia B.</span>
                </div>
                <div className="p-stack" style={{ gap: 4 }}>
                  <span className="p-eyebrow" style={{ color: '#9b9ea3' }}>
                    ETA
                  </span>
                  <span className="p-mono" style={{ color: '#fff', fontSize: 16 }}>
                    14 h 32
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Comment ça marche */}
      <section className="p-section">
        <div className="p-container">
          <div className="p-spread" style={{ marginBottom: 30, alignItems: 'flex-end' }}>
            <div className="p-stack" style={{ gap: 10 }}>
              <span className="p-eyebrow">Simple comme bonjour</span>
              <h2 className="p-h1">Comment ça marche</h2>
            </div>
          </div>

          <div className="p-grid-3">
            {STEPS.map((step, index) => (
              <article key={step.n} className={`p-card p-card-pad p-card-hover p-fade-up p-d${index + 1}`}>
                <span className="p-mono" style={{ fontSize: 30, color: 'var(--p-accent)', fontWeight: 500 }}>
                  {step.n}
                </span>
                <h3 className="p-h3" style={{ margin: '16px 0 8px' }}>
                  {step.title}
                </h3>
                <p className="p-body">{step.text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="p-section-sm">
        <div className="p-container">
          <div className="p-card p-card-dark p-card-pad p-fade-up" style={{ paddingBlock: 48 }}>
            <div className="p-stack" style={{ gap: 34 }}>
              <div className="p-stack" style={{ gap: 12 }}>
                <span className="p-eyebrow" style={{ color: '#9b9ea3' }}>
                  Tout bouge. Une plateforme intelligente.
                </span>
                <h2 className="p-h1" style={{ color: '#fff' }}>
                  Votre colis mérite mieux
                  <br />
                  qu’un e-mail « en cours ».
                </h2>
              </div>

              <div className="p-grid-3">
                {FEATURES.map((feature, index) => (
                  <div key={feature.n} className={`p-stack p-fade-up p-d${index + 2}`} style={{ gap: 12 }}>
                    <span className="p-mono" style={{ color: '#8b83ff', fontSize: 18 }}>
                      {feature.n}
                    </span>
                    <span style={{ color: '#fff', fontWeight: 700, fontSize: 18 }}>{feature.title}</span>
                    <p className="p-body" style={{ color: '#9b9ea3' }}>
                      {feature.text}
                    </p>
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <PLink to="/client/register" variant="light">
                  Créer mon accès client
                </PLink>
                <PLink to="/client/login" variant="ghost">
                  Se connecter
                </PLink>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Confiance / sécurité */}
      <section className="p-section-sm">
        <div className="p-container">
          <div className="p-grid-main" style={{ alignItems: 'center', gap: 40 }}>
            <div className="p-stack p-fade-up" style={{ gap: 16 }}>
              <span className="p-eyebrow">Confiance</span>
              <h2 className="p-h1">Vos données restent les vôtres.</h2>
              <p className="p-lead">
                Chaque livraison dispose d’un lien opaque, unique et révocable. Votre espace client est
                strictement séparé des outils de votre transporteur.
              </p>
            </div>

            <div className="p-stack" style={{ gap: 14 }}>
              {TRUST.map((item, index) => (
                <div key={item.title} className={`p-card p-card-pad p-fade-up p-d${index + 1}`}>
                  <div className="p-stack" style={{ gap: 6 }}>
                    <span style={{ fontWeight: 700 }}>{item.title}</span>
                    <span className="p-body" style={{ fontSize: 14.5 }}>
                      {item.text}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="p-section-sm">
        <div className="p-container">
          <div className="p-grid-main" style={{ alignItems: 'start', gap: 40 }}>
            <div className="p-stack p-fade-up" style={{ gap: 14 }}>
              <span className="p-eyebrow">Questions fréquentes</span>
              <h2 className="p-h1">Tout ce qu’il faut savoir.</h2>
              <p className="p-body">
                Une autre question ? L’assistant LogiSmart répond 7j/7 depuis votre espace.
              </p>
              <div>
                <PLink to="/client/support" variant="ghost">
                  Contacter le support
                </PLink>
              </div>
            </div>

            <div className="p-faq p-fade-up p-d2">
              {FAQ.map((item) => (
                <details key={item.q} className="p-faq-item">
                  <summary>{item.q}</summary>
                  <p className="p-body">{item.a}</p>
                </details>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CTA final */}
      <section className="p-section-sm" style={{ paddingBottom: 'clamp(56px, 8vw, 110px)' }}>
        <div className="p-container">
          <div className="p-card p-card-dark p-card-pad p-fade-up" style={{ paddingBlock: 56, textAlign: 'center' }}>
            <div className="p-stack" style={{ gap: 18, alignItems: 'center' }}>
              <span className="p-eyebrow" style={{ color: '#9b9ea3' }}>
                Prêt à suivre votre prochaine livraison ?
              </span>
              <h2 className="p-h1" style={{ color: '#fff', maxWidth: 720 }}>
                Activez votre suivi en moins d’une minute.
              </h2>
              <p className="p-lead" style={{ maxWidth: 620 }}>
                Munissez-vous du numéro de commande LS-XXXX-XXXX-XX transmis par votre transporteur.
              </p>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
                <PLink to="/client/register" variant="light">
                  Activer mon suivi
                </PLink>
                <PLink to="/client/login" variant="ghost">
                  J’ai déjà un compte
                </PLink>
              </div>
            </div>
          </div>
        </div>
      </section>
    </PortalShell>
  );
}
