import './globals.css';
import NavBar from '../components/NavBar';

export const metadata = {
  title: 'Memory Vault',
  description: 'Your personal photo and video memories',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <NavBar />
        <main>{children}</main>
      </body>
    </html>
  );
}
