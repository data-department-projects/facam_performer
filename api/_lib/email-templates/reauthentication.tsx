import * as React from 'react'
import { Body, Container, Head, Heading, Hr, Html, Img, Preview, Section, Text } from '@react-email/components'

interface ReauthenticationEmailProps { siteName?: string; token: string }

export const ReauthenticationEmail = ({ siteName = 'FACAM PERFORMER', token }: ReauthenticationEmailProps) => (
  <Html lang="fr" dir="ltr">
    <Head>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@400;600;700&display=swap');`}</style>
    </Head>
    <Preview>Votre code de vérification</Preview>
    <Body style={main}>
      <Container style={wrapper}>
        <Section style={headerBar} />
        <Container style={container}>
          <Section style={logoSection}>
            <Img src="https://faqlafabgmlfxnyyvznq.supabase.co/storage/v1/object/public/email-assets/logo.png" alt={siteName} width={220} style={{ margin: '0 auto 0 calc(50% - 110px)', display: 'block' }} />
          </Section>
          <Heading style={h1}>Code de vérification</Heading>
          <Text style={text}>Utilisez le code ci-dessous pour confirmer votre identité :</Text>
          <Section style={codeBox}>
            <Text style={codeStyle}>{token}</Text>
          </Section>
          <Section style={warningBox}>
            <Text style={warningText}>⏳ Ce code expirera sous peu. Ne le partagez avec personne.</Text>
          </Section>
          <Hr style={divider} />
          <Text style={footer}>Si vous n'avez pas fait cette demande, vous pouvez ignorer cet email.</Text>
          <Text style={footerBrand}>© {new Date().getFullYear()} {siteName} — Tous droits réservés</Text>
        </Container>
      </Container>
    </Body>
  </Html>
)

export default ReauthenticationEmail

const main = { backgroundColor: '#0a0e17', fontFamily: "'Montserrat','Segoe UI',Arial,sans-serif", padding: '20px 0' }
const wrapper = { maxWidth: '520px', margin: '0 auto' }
const headerBar = { background: 'linear-gradient(135deg,#d4a843,#b8862d)', height: '4px', borderRadius: '12px 12px 0 0' }
const container = { backgroundColor: '#111827', borderRadius: '0 0 12px 12px', padding: '40px 36px 32px', border: '1px solid #1e293b', borderTop: 'none' }
const logoSection = { textAlign: 'center' as const, marginBottom: '28px' }
const h1 = { fontSize: '24px', fontWeight: '700' as const, color: '#f0e6d2', margin: '0 0 16px', lineHeight: '1.3' }
const text = { fontSize: '15px', color: '#94a3b8', lineHeight: '1.7', margin: '0 0 20px' }
const codeBox = { backgroundColor: '#0f172a', border: '2px solid #d4a843', borderRadius: '12px', padding: '20px', textAlign: 'center' as const, margin: '0 0 24px' }
const codeStyle = { fontFamily: "'Courier New',Courier,monospace", fontSize: '36px', fontWeight: '700' as const, color: '#d4a843', letterSpacing: '8px', margin: '0' }
const warningBox = { backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '10px', padding: '12px 16px', margin: '0 0 24px' }
const warningText = { fontSize: '13px', color: '#d4a843', margin: '0' }
const divider = { borderColor: '#1e293b', margin: '28px 0' }
const footer = { fontSize: '12px', color: '#64748b', lineHeight: '1.5', margin: '0 0 8px' }
const footerBrand = { fontSize: '11px', color: '#475569', margin: '0', textAlign: 'center' as const }
