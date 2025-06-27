import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { verifyAccessToken } from '@/lib/jwt';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = cookies();
  const accessToken = cookieStore.get('accessToken');

  if (!accessToken?.value) {
    redirect('/login');
  }

  try {
    await verifyAccessToken(accessToken.value);
  } catch (error) {
    redirect('/login');
  }

  return <>{children}</>;
}
