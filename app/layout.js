import './globals.css';
import NavBar from '../components/NavBar';
import InviteBanner from '../components/InviteBanner';

export const metadata = {
  title: 'Memory Vault',
  description: 'Your personal photo and video memories',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <NavBar />
        <InviteBanner />
        <main>{children}</main>
      </body>
    </html>
  );
}