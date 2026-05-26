/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { Body, Button, Container, Head, Heading, Hr, Html, Img, Preview, Section, Text } from 'npm:@react-email/components@0.0.22'

interface MagicLinkEmailProps { siteName: string; confirmationUrl: string }

export const MagicLinkEmail = ({ siteName, confirmationUrl }: MagicLinkEmailProps) => (
  <Html lang="fr" dir="ltr">
    <Head>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@400;600;700&display=swap');`}</style>
    </Head>
    <Preview>Votre lien de connexion — {siteName}</Preview>
    <Body style={main}>
      <Container style={wrapper}>
        <Section style={headerBar} />
        <Container style={container}>
          <Section style={logoSection}>
            <Img src="https://faqlafabgmlfxnyyvznq.supabase.co/storage/v1/object/public/email-assets/logo.png" alt={siteName} width="220" height="auto" style={{ margin: '0 auto 0 calc(50% - 120px)', display: 'block' }} />
          </Section>
          <Heading style={h1}>Votre lien de connexion</Heading>
          <Text style={text}>Cliquez sur le bouton ci-dessous pour vous connecter à <strong style={{ color: '#f0e6d2' }}>{siteName}</strong>.</Text>

          <Section style={buttonSection}>
            <Button style={button} href={confirmationUrl}>Se connecter</Button>
          </Section>

          <Section style={warningBox}>
            <Text style={warningText}>⏳ Ce lien est à usage unique et expirera sous peu.</Text>
          </Section>

          <Hr style={divider} />
          <Text style={footer}>Si vous n'avez pas demandé ce lien, vous pouvez ignorer cet email.</Text>
          <Text style={footerBrand}>© {new Date().getFullYear()} {siteName} — Tous droits réservés</Text>
        </Container>
      </Container>
    </Body>
  </Html>
)
export default MagicLinkEmail

const main = { backgroundColor: '#0a0e17', fontFamily: "'Montserrat', 'Segoe UI', Arial, sans-serif", padding: '20px 0' }
const wrapper = { maxWidth: '520px', margin: '0 auto' }
const headerBar = { background: 'linear-gradient(135deg, #d4a843, #b8862d)', height: '4px', borderRadius: '12px 12px 0 0' }
const container = { backgroundColor: '#111827', borderRadius: '0 0 12px 12px', padding: '40px 36px 32px', border: '1px solid #1e293b', borderTop: 'none' }
const logoSection = { textAlign: 'center' as const, marginBottom: '28px' }
const h1 = { fontSize: '24px', fontWeight: '700' as const, color: '#f0e6d2', margin: '0 0 16px', lineHeight: '1.3' }
const text = { fontSize: '15px', color: '#94a3b8', lineHeight: '1.7', margin: '0 0 20px' }
const buttonSection = { textAlign: 'center' as const, margin: '28px 0' }
const button = { background: 'linear-gradient(135deg, #d4a843, #b8862d)', color: '#0a0e17', fontSize: '15px', fontWeight: '700' as const, borderRadius: '10px', padding: '14px 32px', textDecoration: 'none', display: 'inline-block' }
const warningBox = { backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '10px', padding: '12px 16px', margin: '0 0 24px' }
const warningText = { fontSize: '13px', color: '#d4a843', margin: '0' }
const divider = { borderColor: '#1e293b', margin: '28px 0' }
const footer = { fontSize: '12px', color: '#64748b', lineHeight: '1.5', margin: '0 0 8px' }
const footerBrand = { fontSize: '11px', color: '#475569', margin: '0', textAlign: 'center' as const }
