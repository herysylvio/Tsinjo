import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { ArrowLeft, Shield, Trash2, Mail, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function PrivacyPolicy() {
  const { t } = useTranslation();

  return (
    <div className="min-h-screen bg-background text-foreground px-4 py-8 max-w-3xl mx-auto">
      <div className="mb-6">
        <Link to="/">
          <Button variant="ghost" size="sm" className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Retour
          </Button>
        </Link>
      </div>

      <div className="space-y-6">
        <div className="border-b pb-4">
          <div className="flex items-center gap-2 text-primary mb-2">
            <Shield className="h-6 w-6" />
            <h1 className="text-2xl font-bold">Politique de Confidentialité — Tsinjo</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Dernière mise à jour : 13 octobre 2026 | Édité par DIGITAL 514
          </p>
        </div>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Lock className="h-5 w-5 text-primary" />
            1. Collecte et Utilisation des Données
          </h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            L'application <strong>Tsinjo</strong> (« nous », « notre »), développée par DIGITAL 514, est une application de gestion financière personnelle et familiale. 
            Nous accordons une importance primordiale à la confidentialité de vos informations.
          </p>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Les seules données collectées sont celles strictement nécessaires au bon fonctionnement du service :
          </p>
          <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1 ml-2">
            <li>Votre adresse e-mail (pour l'authentification et la sécurisation du compte).</li>
            <li>Vos données financières saisies manuellement (revenus, dépenses, budgets, objectifs d'épargne).</li>
            <li>Vos préférences de configuration (langue, devise, thème).</li>
          </ul>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Vos données financières ne sont <strong>jamais vendues, louées, ni transmises à des tiers</strong> à des fins publicitaires.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            2. Sécurité et Chiffrement
          </h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Toutes les communications entre votre appareil et nos serveurs sont chiffrées selon les standards de l'industrie (HTTPS / SSL). 
            Les données hébergées sur notre infrastructure Supabase sont protégées par des politiques de sécurité strictes au niveau des lignes (RLS - Row Level Security).
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold flex items-center gap-2 text-destructive">
            <Trash2 className="h-5 w-5 text-destructive" />
            3. Suppression de Compte et de Données (Conformité Google Play)
          </h2>
          <Card className="border-destructive/30 bg-destructive/5">
            <CardContent className="p-4 space-y-3">
              <p className="text-sm leading-relaxed">
                Conformément aux exigences de Google Play relatives aux données des utilisateurs, vous pouvez à tout moment demander la <strong>suppression intégrale et irréversible</strong> de votre compte ainsi que de toutes les données associées (transactions, portefeuilles, budgets, historique).
              </p>
              <div className="space-y-2 text-sm text-muted-foreground">
                <p><strong>Comment procéder ?</strong></p>
                <ol className="list-decimal list-inside space-y-1 ml-2">
                  <li>Directement dans l'application : Rendez-vous dans <strong>Paramètres &gt; Sécurité &gt; Supprimer mon compte</strong>.</li>
                  <li>Par e-mail : Envoyez une demande à <strong>contact@digital514.mg</strong> en précisant l'adresse e-mail associée à votre compte Tsinjo. Vos données seront définitivement purgées sous 48 heures.</li>
                </ol>
              </div>
            </CardContent>
          </Card>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Mail className="h-5 w-5 text-primary" />
            4. Contact
          </h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Pour toute question concernant cette politique ou pour exercer vos droits sur vos données personnelles :
          </p>
          <div className="p-4 rounded-lg bg-card border text-sm space-y-1">
            <p><strong>DIGITAL 514</strong></p>
            <p>Moramanga, Madagascar</p>
            <p>E-mail : <a href="mailto:contact@digital514.mg" className="text-primary underline">contact@digital514.mg</a></p>
            <p>Site officiel : <a href="https://digital514.mg" target="_blank" rel="noreferrer" className="text-primary underline">https://digital514.mg</a></p>
          </div>
        </section>
      </div>
    </div>
  );
}
