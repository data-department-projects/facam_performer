/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { Body, Button, Container, Head, Heading, Hr, Html, Img, Preview, Section, Text } from 'npm:@react-email/components@0.0.22'

interface SignupEmailProps { siteName: string; siteUrl: string; recipient: string; firstName?: string; confirmationUrl: string }

export const SignupEmail = ({ siteName, siteUrl, recipient, firstName, confirmationUrl }: SignupEmailProps) => (
  <Html lang="fr" dir="ltr">
    <Head>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@400;600;700&display=swap');`}</style>
    </Head>
    <Preview>Bienvenue sur {siteName} — Activez votre compte</Preview>
    <Body style={main}>
      <Container style={wrapper}>
        <Section style={headerBar} />
        <Container style={container}>
          <Section style={logoSection}>
            <Img src="https://faqlafabgmlfxnyyvznq.supabase.co/storage/v1/object/public/email-assets/logo.png" alt={siteName} width="220" height="auto" style={{ margin: '0 auto 0 calc(50% - 120px)', display: 'block' }} />
          </Section>
          <Heading style={h1}>Bonjour <span style={nameHighlight}>{firstName || 'cher collaborateur'}</span> 👋</Heading>
          <Text style={text}>Bienvenue sur <strong style={nameHighlight}>{siteName}</strong> ! Votre compte a été créé avec succès. Voici vos informations de connexion :</Text>

          <Section style={infoBox}>
            <Text style={infoLabel}>Identifiant (email)</Text>
            <Text style={infoValue}>{recipient}</Text>
          </Section>

          <Text style={text}>Pour commencer, connectez-vous à la plateforme. Lors de votre première connexion, vous serez invité(e) à définir votre mot de passe.</Text>

          <Section style={buttonSection}>
            <Button style={button} href={confirmationUrl}>Me connecter</Button>
          </Section>

          <Hr style={divider} />
          <Text style={footer}>
            Si vous n'êtes pas à l'origine de cette inscription, vous pouvez ignorer cet email.
          </Text>
          <Text style={footerBrand}>© {new Date().getFullYear()} {siteName} — Tous droits réservés</Text>
        </Container>
      </Container>
    </Body>
  </Html>
)
export default SignupEmail

const main = { backgroundColor: '#0a0e17', fontFamily: "'Montserrat', 'Segoe UI', Arial, sans-serif", padding: '20px 0' }
const wrapper = { maxWidth: '520px', margin: '0 auto' }
const headerBar = { background: 'linear-gradient(135deg, #d4a843, #b8862d)', height: '4px', borderRadius: '12px 12px 0 0' }
const container = { backgroundColor: '#111827', borderRadius: '0 0 12px 12px', padding: '40px 36px 32px', border: '1px solid #1e293b', borderTop: 'none' }
const logoSection = { textAlign: 'center' as const, marginBottom: '28px' }
const h1 = { fontSize: '24px', fontWeight: '700' as const, color: '#f0e6d2', margin: '0 0 16px', lineHeight: '1.3' }
const nameHighlight = { color: '#d4a843' }
const text = { fontSize: '15px', color: '#94a3b8', lineHeight: '1.7', margin: '0 0 20px' }
const infoBox = { backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '10px', padding: '16px 20px', margin: '0 0 24px' }
const infoLabel = { fontSize: '11px', fontWeight: '600' as const, color: '#d4a843', textTransform: 'uppercase' as const, letterSpacing: '1px', margin: '0 0 6px' }
const infoValue = { fontSize: '16px', fontWeight: '600' as const, color: '#f1f5f9', margin: '0' }
const buttonSection = { textAlign: 'center' as const, margin: '28px 0' }
const button = { background: 'linear-gradient(135deg, #d4a843, #b8862d)', color: '#0a0e17', fontSize: '15px', fontWeight: '700' as const, borderRadius: '10px', padding: '14px 32px', textDecoration: 'none', display: 'inline-block' }
const divider = { borderColor: '#1e293b', margin: '28px 0' }
const footer = { fontSize: '12px', color: '#64748b', lineHeight: '1.5', margin: '0 0 8px' }
const footerBrand = { fontSize: '11px', color: '#475569', margin: '0', textAlign: 'center' as const }
